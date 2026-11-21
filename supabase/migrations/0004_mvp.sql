-- Stampa MVP (noviembre 2026): panel de administrador, invitaciones y enlaces de un solo uso, asistente del dueño,
-- tarjeta pública del cliente con correo verificado (código de 6 dígitos) e imágenes del negocio. Ver docs/MVP.md.
--
-- Requiere 0001..0003. Pensada para Postgres 17 en Supabase. Idempotente donde es razonable (if not exists / create or
-- replace / on conflict): se puede volver a ejecutar sin romper nada.
--
-- Decisiones no obvias:
--  * Los tokens de enlace y los códigos de 6 dígitos se guardan HASHEADOS (SHA-256 en hex, lo calcula la app con
--    hashToken / hashOtp de src/lib/tokens.ts). La base solo compara hashes; nunca ve el valor en claro.
--  * Las tablas nuevas solo las usa el servidor con la service role: RLS activado SIN políticas y se revoca todo a anon y
--    authenticated. NO se toca public.waitlist (es de otra aplicación) ni se usa "revoke all on all tables".
--  * Las operaciones que deben ser atómicas son funciones SECURITY DEFINER con search_path fijo, ejecutables solo por
--    service_role. Como en 0002, los errores de reglas de negocio se DEVUELVEN como jsonb {ok:false,error} (mensajes
--    idénticos a src/lib/repo/memory.ts) para que los efectos previstos (sumar un intento) se confirmen.
--  * Orden de bloqueo para enlaces: persona (staff) -> enlaces (access_tokens), en todas las funciones.

/* ===================================== Columnas nuevas ===================================== */

alter table public.businesses
  add column if not exists status             text not null default 'active' check (status in ('setup','active','suspended')),
  add column if not exists plan_expires_at    timestamptz,
  add column if not exists suspended_at       timestamptz,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists admin_note         text;          -- nota interna de Stampa; la app la lee solo con service_role

-- Los negocios que ya existían están operando: cuentan como configurados (así suspender y reactivar no los manda al asistente).
update public.businesses set setup_completed_at = created_at where status = 'active' and setup_completed_at is null;

alter table public.programs
  add column if not exists cover_url text;

alter table public.customers
  add column if not exists birthday_y        smallint check (birthday_y between 1900 and 2100),
  add column if not exists email_verified_at timestamptz;

-- Saber si alguien ya creó su contraseña (invitación pendiente) sin leer el hash.
alter table public.staff
  add column if not exists has_password boolean generated always as (password_hash is not null) stored;

create index if not exists customers_email_contact_idx on public.customers (contact) where contact_kind = 'email';

/* ===================================== Tablas nuevas ===================================== */

-- Cuentas del panel de administrador de Stampa. Aparte del equipo de los negocios.
create table if not exists public.platform_admins (
  id             text primary key default public.gen_id('adm'),
  email          text not null unique check (email = lower(btrim(email))),
  password_hash  text not null,                      -- scrypt$N$r$p$salt$hash (lo calcula la aplicación)
  failed_logins  integer not null default 0,
  locked_until   timestamptz,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now()
);
create unique index if not exists platform_admins_email_lower_uidx on public.platform_admins (lower(email));

-- Enlaces de un solo uso: invitación (72 h) y restablecer contraseña (60 min).
create table if not exists public.access_tokens (
  id          text primary key default public.gen_id('tok'),
  token_hash  text not null unique,
  staff_id    text not null references public.staff(id) on delete cascade,
  kind        text not null check (kind in ('invite','reset')),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists access_tokens_staff_open_idx on public.access_tokens (staff_id, kind) where used_at is null;

-- Códigos de verificación de correo de los clientes (6 dígitos, 10 min, 5 intentos, 5 por hora).
create table if not exists public.email_otps (
  id           text primary key default public.gen_id('otp'),
  email        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists email_otps_email_created_idx on public.email_otps (lower(email), created_at desc);

alter table public.platform_admins enable row level security;
alter table public.access_tokens   enable row level security;
alter table public.email_otps      enable row level security;

revoke all on public.platform_admins from anon, authenticated;
revoke all on public.access_tokens   from anon, authenticated;
revoke all on public.email_otps      from anon, authenticated;
grant all on public.platform_admins to service_role;
grant all on public.access_tokens   to service_role;
grant all on public.email_otps      to service_role;

/* ===================================== Reclamar sello (reemplaza 0002) ===================================== */

-- Igual que en 0002, más: el negocio debe estar 'active' (en 'setup' o 'suspended' no recibe sellos).
create or replace function public.claim_stamp_code(p_business_id text, p_code text, p_customer_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prog public.programs; v_code public.stamp_codes; v_cust public.customers; v_count integer; v_now timestamptz := now();
  v_last timestamptz; v_ready_at timestamptz; v_mins integer;
begin
  select * into v_prog from public.programs where business_id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese negocio no tiene programa configurado.'); end if;
  if coalesce((select status from public.businesses where id = p_business_id), 'active') <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'Este negocio no está recibiendo sellos por ahora.');
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and business_id = p_business_id) then
    return jsonb_build_object('ok', false, 'error', 'No encontramos tu tarjeta en este negocio.');
  end if;

  -- Si un número se reutilizó con el tiempo, manda el vivo; si no, el más reciente. FOR UPDATE serializa a quienes
  -- compiten por los últimos cupos: el segundo espera, ve el cupo ocupado y recibe "agotado".
  select * into v_code from public.stamp_codes
    where business_id = p_business_id and code = btrim(coalesce(p_code, ''))
    order by live desc, created_at desc limit 1
    for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese código no existe. Revisa los 6 dígitos.'); end if;

  select * into v_cust from public.customers where id = p_customer_id for update;
  select count(*) into v_count from public.stamp_claims where code_id = v_code.id;   -- incluye anulados: siguen ocupando cupo

  -- Prioridad igual a codeStatus(): cancelado > agotado > vencido.
  if v_code.cancelled_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Este código fue cancelado por el negocio.');
  end if;
  if v_count >= v_code.seats then
    update public.stamp_codes set attempts = attempts + 1, live = false where id = v_code.id;
    insert into public.rejections (business_id, kind, code_id, customer_id) values (p_business_id, 'burned_code', v_code.id, p_customer_id);
    return jsonb_build_object('ok', false, 'error', 'Este código ya se agotó: todos los cupos fueron usados.');
  end if;
  if v_code.expires_at <= v_now then
    update public.stamp_codes set live = false where id = v_code.id;
    return jsonb_build_object('ok', false, 'error', 'Este código venció. Pide uno nuevo en caja.');
  end if;
  if exists (select 1 from public.stamp_claims where code_id = v_code.id and customer_id = p_customer_id) then
    return jsonb_build_object('ok', false, 'error', 'Ya reclamaste un sello con este código.');
  end if;
  if v_cust.stamps >= v_prog.stamps_required then
    return jsonb_build_object('ok', false, 'error', 'Tu tarjeta está completa. Canjea tu premio antes de sumar más sellos.');
  end if;

  if v_prog.cooldown_minutes > 0 then
    select max(at) into v_last from public.stamp_claims where customer_id = p_customer_id and business_id = p_business_id and voided_at is null;
    if v_last is not null then
      v_ready_at := v_last + make_interval(mins => v_prog.cooldown_minutes);
      if v_now < v_ready_at then
        v_mins := ceil(extract(epoch from (v_ready_at - v_now)) / 60)::int;
        insert into public.rejections (business_id, kind, code_id, customer_id, minutes) values (p_business_id, 'cooldown', v_code.id, p_customer_id, v_prog.cooldown_minutes);
        return jsonb_build_object('ok', false, 'error',
          'Aún no puedes sumar otro sello: espera ' || v_mins || case when v_mins = 1 then ' minuto.' else ' minutos.' end);
      end if;
    end if;
  end if;

  insert into public.stamp_claims (code_id, business_id, customer_id, customer_name, at) values (v_code.id, p_business_id, p_customer_id, v_cust.name, v_now);
  update public.customers set stamps = stamps + 1, total_stamps = total_stamps + 1, last_visit_at = v_now where id = p_customer_id;
  if v_count + 1 >= v_code.seats then update public.stamp_codes set live = false where id = v_code.id; end if;   -- se quema al llenarse

  return jsonb_build_object('ok', true, 'code_id', v_code.id, 'customer_id', p_customer_id, 'reward_ready', v_cust.stamps + 1 >= v_prog.stamps_required);
end $$;

/* ===================================== Enlaces de un solo uso ===================================== */

-- Invalida los enlaces sin usar del mismo tipo para esa persona y guarda el nuevo (solo su hash).
create or replace function public.issue_access_token(p_staff_id text, p_kind text, p_token_hash text, p_ttl_seconds integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_staff public.staff; v_exp timestamptz;
begin
  if p_kind is null or p_kind not in ('invite','reset') then return jsonb_build_object('ok', false, 'error', 'Tipo de enlace no válido.'); end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'Enlace no válido.'); end if;
  select * into v_staff from public.staff where id = p_staff_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos a esa persona del equipo.'); end if;
  if not v_staff.active then return jsonb_build_object('ok', false, 'error', 'Esa persona está desactivada.'); end if;
  if v_staff.email is null then return jsonb_build_object('ok', false, 'error', 'Esa persona no tiene correo de acceso.'); end if;

  update public.access_tokens set used_at = now() where staff_id = p_staff_id and kind = p_kind and used_at is null;
  v_exp := now() + make_interval(secs => greatest(p_ttl_seconds, 60));
  insert into public.access_tokens (token_hash, staff_id, kind, expires_at) values (p_token_hash, p_staff_id, p_kind, v_exp);
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (v_staff.business_id, null, case when p_kind = 'invite' then 'access.invite' else 'access.reset' end,
    case when p_kind = 'invite' then 'Invitación' else 'Enlace para restablecer la contraseña' end || ' para ' || v_staff.email || '.');
  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end $$;

-- Datos del enlace si es válido (existe, no vencido, no usado, persona activa); si no, null.
create or replace function public.peek_access_token(p_hash text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'kind', t.kind, 'staff_id', s.id, 'business_id', b.id, 'email', s.email, 'staff_name', s.name,
    'business_name', b.name, 'business_status', b.status, 'expires_at', t.expires_at)
  from public.access_tokens t
  join public.staff s on s.id = t.staff_id
  join public.businesses b on b.id = s.business_id
  where t.token_hash = p_hash and t.used_at is null and t.expires_at > now() and s.active
  limit 1
$$;

-- Usa el enlace: fija la contraseña (hash calculado por la app) y el nombre si viene, limpia el bloqueo y lo marca usado.
create or replace function public.consume_access_token(p_hash text, p_password_hash text, p_name text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_staff_id text; v_tok public.access_tokens; v_staff public.staff; v_name text;
  c_invalid constant text := 'Este enlace ya no es válido. Pide uno nuevo.';
begin
  select staff_id into v_staff_id from public.access_tokens where token_hash = p_hash;
  if not found then return jsonb_build_object('ok', false, 'error', c_invalid); end if;
  -- Orden de bloqueo: persona -> enlace (igual que issue_access_token y set_staff_email).
  select * into v_staff from public.staff where id = v_staff_id for update;
  select * into v_tok from public.access_tokens where token_hash = p_hash for update;
  if v_tok.used_at is not null or v_tok.expires_at <= now() or v_staff.id is null or not v_staff.active then
    return jsonb_build_object('ok', false, 'error', c_invalid);
  end if;
  if p_password_hash is null or p_password_hash = '' then
    return jsonb_build_object('ok', false, 'error', 'No se pudo guardar la contraseña.');
  end if;
  v_name := btrim(p_name);
  if v_name is not null and (length(v_name) < 2) then return jsonb_build_object('ok', false, 'error', 'Escribe un nombre de al menos 2 letras.'); end if;
  if v_name is not null and (length(v_name) > 80) then return jsonb_build_object('ok', false, 'error', 'El nombre es demasiado largo (máximo 80 letras).'); end if;

  update public.staff
    set password_hash = p_password_hash, name = coalesce(v_name, name), failed_logins = 0, locked_until = null
    where id = v_staff.id;
  update public.access_tokens set used_at = now() where id = v_tok.id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (v_staff.business_id, v_staff.id, 'access.password',
    coalesce(v_name, v_staff.name) || case when v_tok.kind = 'invite' then ' creó' else ' cambió' end || ' su contraseña.');
  return jsonb_build_object('ok', true, 'business_id', v_staff.business_id, 'staff_id', v_staff.id, 'kind', v_tok.kind);
end $$;

-- Asigna o cambia el correo de acceso (único en la plataforma). Si cambia, invalida los enlaces sin usar de esa persona.
create or replace function public.set_staff_email(p_business_id text, p_staff_id text, p_email text, p_actor_id text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_staff public.staff; v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'error', 'Escribe un correo válido.'); end if;
  -- Serializa por correo: dos altas simultáneas con el mismo correo no pasan las dos (el índice único es la red final).
  perform pg_advisory_xact_lock(hashtext('staff_email:' || v_email));
  select * into v_staff from public.staff where id = p_staff_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos a esa persona del equipo.'); end if;
  if exists (select 1 from public.staff where id <> p_staff_id and email is not null and lower(email) = v_email) then
    return jsonb_build_object('ok', false, 'error', 'Ese correo ya tiene acceso a Stampa.');
  end if;
  if v_staff.email is distinct from v_email then
    update public.staff set email = v_email where id = p_staff_id;
    update public.access_tokens set used_at = now() where staff_id = p_staff_id and used_at is null;
  end if;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_actor_id, 'staff.email', 'Correo de acceso de ' || v_staff.name || ': ' || v_email || '.');
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'Ese correo ya tiene acceso a Stampa.');
end $$;

/* ===================================== Alta de un negocio por Stampa ===================================== */

-- Crea negocio ('setup', nombre provisional), programa con la plantilla 'otro', dueño con correo y SIN contraseña, nota
-- interna e invitación, todo en una transacción: si algo falla no queda nada a medias.
-- p_program: jsonb con los valores de la plantilla (templates.ts), claves en camelCase como en create_business (0002).
create or replace function public.create_business_access(
  p_email text, p_plan text, p_plan_expires_at timestamptz, p_note text, p_business_name text, p_slug text,
  p_owner_name text, p_program jsonb, p_token_hash text, p_invite_ttl_seconds integer
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); v_slug text := nullif(btrim(p_slug), '');
  v_biz text; v_owner text; v_tok jsonb; v_try integer := 0; v_constraint text;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'error', 'Escribe un correo válido.'); end if;
  if p_plan is null or p_plan not in ('gratis','negocio','pro') then return jsonb_build_object('ok', false, 'error', 'Elige un plan válido.'); end if;

  perform pg_advisory_xact_lock(hashtext('staff_email:' || v_email));
  if exists (select 1 from public.staff where email is not null and lower(email) = v_email) then
    return jsonb_build_object('ok', false, 'error', 'Ese correo ya tiene acceso a Stampa.');
  end if;

  while v_slug is null or exists (select 1 from public.businesses where slug = v_slug) loop
    v_slug := 'nuevo-' || encode(gen_random_bytes(3), 'hex');
    v_try := v_try + 1;
    if v_try > 50 then raise exception 'No se pudo generar un enlace para el negocio.'; end if;
  end loop;
  v_biz := 'biz_' || replace(v_slug, '-', '_');
  if exists (select 1 from public.businesses where id = v_biz) then v_biz := public.gen_id('biz'); end if;

  insert into public.businesses (id, name, slug, type, plan, plan_expires_at, status, admin_note)
  values (v_biz, p_business_name, v_slug, 'otro', p_plan, p_plan_expires_at, 'setup', nullif(left(btrim(coalesce(p_note, '')), 500), ''));
  insert into public.programs (
    business_id, name, stamps_required, reward_title, reward_description, require_amount, min_spend_cents_per_stamp,
    code_ttl_seconds, max_seats_without_approval, cooldown_minutes, colors, logo_text, birthday_reward
  ) values (
    v_biz, p_program->>'name', (p_program->>'stampsRequired')::int, p_program->>'rewardTitle', p_program->>'rewardDescription',
    (p_program->>'requireAmount')::boolean, (p_program->>'minSpendCentsPerStamp')::int, (p_program->>'codeTtlSeconds')::int,
    (p_program->>'maxSeatsWithoutApproval')::int, (p_program->>'cooldownMinutes')::int, p_program->'colors',
    'ST', p_program->>'birthdayReward'
  );
  insert into public.staff (business_id, name, role, email) values (v_biz, p_owner_name, 'owner', v_email) returning id into v_owner;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (v_biz, null, 'business.access', 'Stampa autorizó el acceso de ' || v_email || '.');

  v_tok := public.issue_access_token(v_owner, 'invite', p_token_hash, p_invite_ttl_seconds);
  if not coalesce((v_tok->>'ok')::boolean, false) then raise exception '%', coalesce(v_tok->>'error', 'No se pudo crear la invitación.'); end if;

  return jsonb_build_object('ok', true, 'business_id', v_biz, 'owner_id', v_owner, 'expires_at', v_tok->'expires_at');
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  return jsonb_build_object('ok', false, 'error',
    case when v_constraint = 'staff_email_uidx' then 'Ese correo ya tiene acceso a Stampa.' else 'No se pudo crear el negocio. Inténtalo de nuevo.' end);
end $$;

/* ===================================== Administradores ===================================== */

-- Igual que auth_record_failure (0003): 5 fallos seguidos bloquean 15 minutos.
create or replace function public.admin_record_failure(p_admin_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_n integer; v_until timestamptz;
begin
  select failed_logins, locked_until into v_n, v_until from public.platform_admins where id = p_admin_id for update;
  if not found then return; end if;
  if v_until is not null and v_until > now() then return; end if;
  if v_until is not null then v_n := 0; end if;
  v_n := v_n + 1;
  if v_n >= 5 then
    update public.platform_admins set failed_logins = 0, locked_until = now() + interval '15 minutes' where id = p_admin_id;
  else
    update public.platform_admins set failed_logins = v_n, locked_until = null where id = p_admin_id;
  end if;
end $$;

create or replace function public.admin_record_success(p_admin_id text) returns void
language sql security definer set search_path = public as $$
  update public.platform_admins set failed_logins = 0, locked_until = null, last_login_at = now() where id = p_admin_id
$$;

-- Métricas por negocio para el panel de administrador (p_business_id null = todos).
create or replace function public.admin_business_stats(p_business_id text default null)
returns table (biz_id text, n_customers bigint, n_stamps_30d bigint, n_redemptions_30d bigint, last_activity_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id,
    (select count(*) from public.customers c where c.business_id = b.id),
    (select count(*) from public.stamp_claims s where s.business_id = b.id and s.voided_at is null and s.at >= now() - interval '30 days'),
    (select count(*) from public.redemptions r where r.business_id = b.id and r.at >= now() - interval '30 days'),
    greatest((select max(s.at) from public.stamp_claims s where s.business_id = b.id),
             (select max(r.at) from public.redemptions r where r.business_id = b.id))
  from public.businesses b
  where p_business_id is null or b.id = p_business_id
$$;

-- Totales de la plataforma (los conteos de negocios por estado los calcula la app con la lista de negocios).
create or replace function public.platform_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customers',         (select count(*) from public.customers),
    'stamps_total',      (select count(*) from public.stamp_claims where voided_at is null),
    'stamps_30d',        (select count(*) from public.stamp_claims where voided_at is null and at >= now() - interval '30 days'),
    'redemptions_total', (select count(*) from public.redemptions),
    'redemptions_30d',   (select count(*) from public.redemptions where at >= now() - interval '30 days'))
$$;

/* ===================================== Códigos de verificación de correo ===================================== */

-- Máx. p_max_per_hour códigos por correo en la última hora; invalida los anteriores sin usar y guarda el nuevo (su hash).
create or replace function public.request_email_otp(p_email text, p_code_hash text, p_ttl_seconds integer default 600, p_max_per_hour integer default 5)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_recent integer; v_exp timestamptz;
begin
  if v_email = '' then return jsonb_build_object('ok', false, 'error', 'Escribe un correo válido.'); end if;
  if p_code_hash is null or p_code_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'error', 'No se pudo generar el código.'); end if;
  -- Serializa por correo para que el límite por hora no se salte con pedidos simultáneos.
  perform pg_advisory_xact_lock(hashtext('email_otp:' || v_email));
  select count(*) into v_recent from public.email_otps where lower(email) = v_email and created_at > now() - interval '1 hour';
  if v_recent >= p_max_per_hour then
    return jsonb_build_object('ok', false, 'error', 'Pediste demasiados códigos. Espera un rato e inténtalo de nuevo.');
  end if;
  update public.email_otps set consumed_at = now() where lower(email) = v_email and consumed_at is null;
  v_exp := now() + make_interval(secs => p_ttl_seconds);
  insert into public.email_otps (email, code_hash, expires_at) values (v_email, p_code_hash, v_exp);
  return jsonb_build_object('ok', true, 'expires_at', v_exp);
end $$;

-- Toma el último código vigente sin usar del correo. Si coincide lo consume y devuelve true. Si no, suma un intento y al
-- p_max_attempts-ésimo lo consume (queda inservible).
create or replace function public.verify_email_otp(p_email text, p_code_hash text, p_max_attempts integer default 5)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_otp public.email_otps;
begin
  select * into v_otp from public.email_otps
    where lower(email) = v_email and consumed_at is null and expires_at > now()
    order by created_at desc limit 1
    for update;
  if not found then return false; end if;
  if p_code_hash is null or v_otp.code_hash <> p_code_hash then
    update public.email_otps
      set attempts = attempts + 1, consumed_at = case when attempts + 1 >= p_max_attempts then now() else null end
      where id = v_otp.id;
    return false;
  end if;
  update public.email_otps set consumed_at = now() where id = v_otp.id;
  return true;
end $$;

/* ===================================== Permisos de funciones ===================================== */

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'claim_stamp_code','issue_access_token','peek_access_token','consume_access_token','set_staff_email',
      'create_business_access','admin_record_failure','admin_record_success','admin_business_stats','platform_stats',
      'request_email_otp','verify_email_otp')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

/* ===================================== Storage: imágenes del negocio ===================================== */

-- Bucket público (lectura por URL pública). Las subidas las hace la app con la service role: no hacen falta políticas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
