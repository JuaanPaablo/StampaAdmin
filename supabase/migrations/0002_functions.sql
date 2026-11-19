-- Stampa: operaciones atómicas. Replican EXACTAMENTE las reglas y los mensajes de src/lib/domain y de repo/memory.ts.
-- Si cambias un mensaje aquí, cámbialo también en src/lib/domain/index.ts (y viceversa).
--
-- Convenciones:
--  * Todas son SECURITY DEFINER con search_path fijo: se ejecutan con permisos del dueño de la función, así que NO se
--    conceden a anon ni authenticated; solo las invoca el servidor con la service role (src/lib/repo/supabase.ts).
--  * Los errores de reglas de negocio se DEVUELVEN como jsonb {ok:false,error[,field]} y no se lanzan con RAISE:
--    así los efectos secundarios previstos (sumar attempts, registrar un rechazo) se confirman en la misma transacción.
--  * El bloqueo es pesimista (SELECT ... FOR UPDATE). Orden de bloqueo fijo para evitar interbloqueos:
--    código -> cliente. Canjear solo bloquea al cliente.

/* ---------- Auxiliares (puros) ---------- */

create or replace function public.fmt_money(cents integer) returns text
language sql immutable as $$
  select '$' || replace(to_char(cents / 100.0, 'FM999999990.00'), '.', ',')
$$;

create or replace function public.cupos(n integer) returns text
language sql immutable as $$
  select n || case when n = 1 then ' cupo' else ' cupos' end
$$;

-- Igual que maxSeats() de domain.
create or replace function public.max_seats(p_amount integer, p public.programs) returns integer
language sql immutable as $$
  select case
    when not p.require_amount or p.min_spend_cents_per_stamp <= 0
      then greatest(10, p.max_seats_without_approval * 2)
    when p_amount is null or p_amount <= 0 then 0
    else floor(p_amount::numeric / p.min_spend_cents_per_stamp)::integer
  end
$$;

create or replace function public.verify_staff_pin(p_business_id text, p_staff_id text, p_pin text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.business_id = p_business_id and s.active
      and s.pin_hash is not null and p_pin ~ '^[0-9]{4}$' and s.pin_hash = crypt(p_pin, s.pin_hash)
  )
$$;

create or replace function public.set_staff_pin(p_business_id text, p_staff_id text, p_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener exactamente 4 dígitos.'; end if;
  update public.staff set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_staff_id and business_id = p_business_id;
  if not found then raise exception 'No encontramos a esa persona del equipo.'; end if;
end $$;

/* ---------- Crear negocio ---------- */

-- p_program: jsonb con los valores de la plantilla (templates.ts), claves en camelCase como en el contrato.
create or replace function public.create_business(
  p_name text, p_type text, p_city text, p_owner_name text, p_owner_pin text, p_program jsonb, p_logo_text text
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_slug text; v_base text; v_n integer := 1; v_biz text; v_loc text; v_owner text;
begin
  if length(btrim(coalesce(p_name, ''))) < 2 then raise exception 'Escribe el nombre del negocio.'; end if;
  if length(btrim(coalesce(p_owner_name, ''))) < 2 then raise exception 'Escribe un nombre de al menos 2 letras.'; end if;
  if p_owner_pin is null or p_owner_pin !~ '^[0-9]{4}$' then raise exception 'El PIN debe tener exactamente 4 dígitos.'; end if;

  -- Slug sin tildes ni símbolos; si ya existe se agrega -2, -3...
  v_base := regexp_replace(lower(translate(btrim(p_name), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then v_base := 'negocio'; end if;
  v_slug := v_base;
  while exists (select 1 from public.businesses where slug = v_slug) loop v_n := v_n + 1; v_slug := v_base || '-' || v_n; end loop;

  v_biz := 'biz_' || replace(v_slug, '-', '_');
  if exists (select 1 from public.businesses where id = v_biz) then v_biz := public.gen_id('biz'); end if;

  insert into public.businesses (id, name, slug, type, city) values (v_biz, btrim(p_name), v_slug, p_type, nullif(btrim(p_city), ''));
  insert into public.locations (business_id, name) values (v_biz, 'Principal') returning id into v_loc;
  insert into public.programs (
    business_id, name, stamps_required, reward_title, reward_description, require_amount, min_spend_cents_per_stamp,
    code_ttl_seconds, max_seats_without_approval, cooldown_minutes, colors, logo_text, birthday_reward
  ) values (
    v_biz, p_program->>'name', (p_program->>'stampsRequired')::int, p_program->>'rewardTitle', p_program->>'rewardDescription',
    (p_program->>'requireAmount')::boolean, (p_program->>'minSpendCentsPerStamp')::int, (p_program->>'codeTtlSeconds')::int,
    (p_program->>'maxSeatsWithoutApproval')::int, (p_program->>'cooldownMinutes')::int, p_program->'colors',
    coalesce(p_logo_text, 'ST'), p_program->>'birthdayReward'
  );
  insert into public.staff (business_id, name, role, location_id, pin_hash)
    values (v_biz, btrim(p_owner_name), 'owner', v_loc, crypt(p_owner_pin, gen_salt('bf'))) returning id into v_owner;
  insert into public.audit_log (business_id, staff_id, action, detail) values (v_biz, v_owner, 'business.create', 'Se creó ' || btrim(p_name) || '.');
  return jsonb_build_object('business_id', v_biz, 'owner_id', v_owner);
end $$;

/* ---------- Crear código ---------- */

create or replace function public.create_stamp_code(
  p_business_id text, p_staff_id text, p_location_id text, p_ticket text, p_amount_cents integer, p_seats integer,
  p_approval_pin text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prog public.programs; v_staff public.staff; v_ticket text; v_norm text; v_max integer;
  v_approver text; v_code text; v_id text; v_loc text; v_now timestamptz := now(); v_try integer := 0;
  v_dup_code text;
begin
  select * into v_staff from public.staff where id = p_staff_id and business_id = p_business_id and active;
  if not found then return jsonb_build_object('ok', false, 'error', 'Esta persona no está activa en este negocio.'); end if;
  select * into v_prog from public.programs where business_id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese negocio no tiene programa configurado.'); end if;

  -- Serializa la creación de códigos de un negocio: evita que dos cajeros reciban el mismo número vivo o
  -- registren el mismo ticket a la vez. El índice único sigue siendo la red de seguridad final.
  perform pg_advisory_xact_lock(hashtext('stamp_codes:' || p_business_id));

  v_ticket := btrim(coalesce(p_ticket, ''));
  if v_ticket = '' then return jsonb_build_object('ok', false, 'field', 'ticket', 'error', 'Escribe el número de ticket.'); end if;
  v_norm := upper(regexp_replace(v_ticket, '\s+', ' ', 'g'));
  select id into v_dup_code from public.stamp_codes where business_id = p_business_id and ticket_norm = v_norm;
  if found then
    insert into public.rejections (business_id, kind, staff_id, ticket, code_id) values (p_business_id, 'duplicate_ticket', p_staff_id, v_ticket, v_dup_code);
    return jsonb_build_object('ok', false, 'field', 'ticket', 'error', 'Ese ticket ya generó un código. Cada ticket genera un solo código.');
  end if;

  if v_prog.require_amount then
    if p_amount_cents is null or p_amount_cents < 1 then
      return jsonb_build_object('ok', false, 'field', 'amount', 'error', 'Escribe el monto del ticket.');
    end if;
    if p_amount_cents < v_prog.min_spend_cents_per_stamp then
      return jsonb_build_object('ok', false, 'field', 'amount',
        'error', 'El monto no alcanza para un sello: el mínimo es ' || public.fmt_money(v_prog.min_spend_cents_per_stamp) || ' por sello.');
    end if;
  end if;

  if p_seats is null or p_seats < 1 then
    return jsonb_build_object('ok', false, 'field', 'seats', 'error', 'Indica cuántos cupos necesita el ticket (mínimo 1).');
  end if;
  v_max := public.max_seats(case when v_prog.require_amount then p_amount_cents else 0 end, v_prog);
  if p_seats > v_max then
    return jsonb_build_object('ok', false, 'field', 'seats', 'error',
      case when v_prog.require_amount and v_prog.min_spend_cents_per_stamp > 0
        then 'Con ese monto el máximo es ' || public.cupos(v_max) || ' (un sello por cada ' || public.fmt_money(v_prog.min_spend_cents_per_stamp) || ').'
        else 'El máximo es ' || public.cupos(v_max) || ' por código.' end);
  end if;

  -- Más cupos de los permitidos sin aprobación: PIN de un dueño o gerente ACTIVO de este negocio.
  if p_seats > v_prog.max_seats_without_approval then
    if p_approval_pin is null or p_approval_pin = '' then
      return jsonb_build_object('ok', false, 'field', 'pin',
        'error', 'Más de ' || public.cupos(v_prog.max_seats_without_approval) || ' necesita el PIN de un dueño o gerente.');
    end if;
    select s.id into v_approver from public.staff s
      where s.business_id = p_business_id and s.active and s.role in ('owner','manager')
        and s.pin_hash is not null and p_approval_pin ~ '^[0-9]{4}$' and s.pin_hash = crypt(p_approval_pin, s.pin_hash)
      limit 1;
    if v_approver is null then return jsonb_build_object('ok', false, 'field', 'pin', 'error', 'El PIN no es correcto.'); end if;
  end if;

  -- La sucursal debe ser de este negocio y estar activa; si no, se usa la del cajero.
  select id into v_loc from public.locations where id = p_location_id and business_id = p_business_id and active;
  if v_loc is null then v_loc := v_staff.location_id; end if;

  -- Barrido perezoso: los códigos vencidos dejan de estar "vivos" y liberan su número (ver comentario de stamp_codes.live).
  update public.stamp_codes set live = false where business_id = p_business_id and live and expires_at <= v_now;

  loop
    v_code := lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
    exit when not exists (select 1 from public.stamp_codes where business_id = p_business_id and code = v_code and live);
    v_try := v_try + 1;
    if v_try > 200 then raise exception 'No quedan códigos libres.'; end if;
  end loop;

  insert into public.stamp_codes (business_id, location_id, code, ticket, amount_cents, seats, created_by, created_at, expires_at, approved_by)
  values (p_business_id, v_loc, v_code, v_ticket, case when v_prog.require_amount then p_amount_cents else 0 end, p_seats,
          p_staff_id, v_now, v_now + make_interval(secs => v_prog.code_ttl_seconds), v_approver)
  returning id into v_id;

  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'code.create',
    'Código ' || v_code || ' para el ticket ' || v_ticket || ': ' || public.cupos(p_seats) ||
    coalesce(', aprobado por ' || (select name from public.staff where id = v_approver), '') || '.');

  return jsonb_build_object('ok', true, 'code_id', v_id);
end $$;

/* ---------- Reclamar sello ---------- */

create or replace function public.claim_stamp_code(p_business_id text, p_code text, p_customer_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prog public.programs; v_code public.stamp_codes; v_cust public.customers; v_count integer; v_now timestamptz := now();
  v_last timestamptz; v_ready_at timestamptz; v_mins integer;
begin
  select * into v_prog from public.programs where business_id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese negocio no tiene programa configurado.'); end if;
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

/* ---------- Anular sello ---------- */

-- Resta el sello al cliente pero NO devuelve el cupo (el reclamo anulado sigue en stamp_claims y sigue contando).
create or replace function public.void_claim(p_business_id text, p_code_id text, p_claim_id text, p_staff_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code public.stamp_codes; v_claim public.stamp_claims;
begin
  select * into v_code from public.stamp_codes where id = p_code_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese código.'); end if;
  select * into v_claim from public.stamp_claims where id = p_claim_id and code_id = p_code_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese sello.'); end if;
  if not exists (select 1 from public.staff where id = p_staff_id and business_id = p_business_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Esta persona no está activa en este negocio.');
  end if;
  if v_claim.voided_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;

  update public.stamp_claims set voided_at = now(), voided_by = p_staff_id where id = p_claim_id;
  update public.customers set stamps = greatest(0, stamps - 1), total_stamps = greatest(0, total_stamps - 1) where id = v_claim.customer_id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'claim.void', 'Se anuló el sello de ' || v_claim.customer_name || ' (ticket ' || v_code.ticket || ').');
  return jsonb_build_object('ok', true);
end $$;

/* ---------- Cancelar código ---------- */

create or replace function public.cancel_stamp_code(p_business_id text, p_code_id text, p_staff_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_code public.stamp_codes;
begin
  select * into v_code from public.stamp_codes where id = p_code_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese código.'); end if;
  if v_code.cancelled_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  update public.stamp_codes set cancelled_at = now(), live = false where id = p_code_id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'code.cancel', 'Se canceló el código ' || v_code.code || ' (ticket ' || v_code.ticket || ').');
  return jsonb_build_object('ok', true);
end $$;

/* ---------- Canjear premio ---------- */

create or replace function public.redeem_reward(p_business_id text, p_customer_id text, p_staff_id text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prog public.programs; v_cust public.customers; v_id text;
begin
  select * into v_prog from public.programs where business_id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese negocio no tiene programa configurado.'); end if;
  select * into v_cust from public.customers where id = p_customer_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos a ese cliente.'); end if;
  if not exists (select 1 from public.staff where id = p_staff_id and business_id = p_business_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Esta persona no está activa en este negocio.');
  end if;
  if v_cust.stamps < v_prog.stamps_required then
    return jsonb_build_object('ok', false, 'error', 'Aún no completa la tarjeta: tiene ' || v_cust.stamps || ' de ' || v_prog.stamps_required || ' sellos.');
  end if;

  update public.customers set stamps = stamps - v_prog.stamps_required, rewards_redeemed = rewards_redeemed + 1 where id = p_customer_id;
  insert into public.redemptions (business_id, customer_id, customer_name, staff_id) values (p_business_id, p_customer_id, v_cust.name, p_staff_id) returning id into v_id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'redeem', 'Premio canjeado a ' || v_cust.name || ': ' || v_prog.reward_title || '.');
  return jsonb_build_object('ok', true, 'redemption_id', v_id);
end $$;

/* ---------- Permisos ---------- */
-- Las funciones nacen con EXECUTE para PUBLIC. Se retira y se concede solo a service_role.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'create_business','create_stamp_code','claim_stamp_code','void_claim','cancel_stamp_code','redeem_reward','verify_staff_pin','set_staff_pin')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
