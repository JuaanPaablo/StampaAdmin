-- Stampa: acceso al panel con correo + contraseña (reemplaza el acceso demo por negocio + nombre + PIN).
-- No hay registro público: las cuentas las crea el equipo de Stampa (scripts/create-account.ts, vía service_role).
-- El PIN (staff.pin_hash) sigue existiendo SOLO para aprobaciones dentro del panel.
-- NO toca la tabla public.waitlist (es de otra aplicación) ni usa "revoke all on all tables".

/* ---------- Columnas ---------- */
alter table public.staff
  add column if not exists email           text,
  add column if not exists password_hash   text,                       -- scrypt$N$r$p$salt$hash (lo calcula la aplicación)
  add column if not exists last_login_at   timestamptz,
  add column if not exists failed_logins   integer not null default 0,
  add column if not exists locked_until    timestamptz;

-- El correo se guarda en minúsculas (la aplicación lo normaliza); el índice lo hace único sin importar mayúsculas.
create unique index if not exists staff_email_uidx on public.staff (lower(email)) where email is not null;

/* ---------- Permisos de columnas ---------- */
-- password_hash, last_login_at, failed_logins y locked_until nunca llegan a un cliente (anon / authenticated): no están
-- en el GRANT de select (0001). Además se retira la escritura de tabla completa de staff para que un gerente autenticado
-- no pueda fijar password_hash, pin_hash, email ni el bloqueo de nadie desde la API: solo service_role los escribe.
revoke insert, update on public.staff from anon, authenticated;
grant insert (id, business_id, name, role, active, location_id) on public.staff to authenticated;
grant update (name, role, active, location_id) on public.staff to authenticated;

/* ---------- Funciones (SECURITY DEFINER, solo service_role) ---------- */

-- Datos mínimos para validar un acceso. El correo llega ya normalizado por la aplicación; aquí se vuelve a normalizar.
create or replace function public.auth_lookup(p_email text)
returns table (id text, business_id text, password_hash text, active boolean, locked_until timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.business_id, s.password_hash, s.active, s.locked_until
  from public.staff s
  where s.email is not null and lower(s.email) = lower(btrim(p_email))
  limit 1
$$;

-- Suma un fallo. Al quinto seguido bloquea la cuenta 15 minutos y reinicia el contador. Si el bloqueo ya venció,
-- el conteo empieza de nuevo. Los intentos durante un bloqueo vigente no lo extienden.
create or replace function public.auth_record_failure(p_staff_id text) returns void
language plpgsql security definer set search_path = public as $$
declare v_n integer; v_until timestamptz;
begin
  select failed_logins, locked_until into v_n, v_until from public.staff where id = p_staff_id for update;
  if not found then return; end if;
  if v_until is not null and v_until > now() then return; end if;
  if v_until is not null then v_n := 0; end if;
  v_n := v_n + 1;
  if v_n >= 5 then
    update public.staff set failed_logins = 0, locked_until = now() + interval '15 minutes' where id = p_staff_id;
  else
    update public.staff set failed_logins = v_n, locked_until = null where id = p_staff_id;
  end if;
end $$;

create or replace function public.auth_record_success(p_staff_id text) returns void
language sql security definer set search_path = public as $$
  update public.staff set failed_logins = 0, locked_until = null, last_login_at = now() where id = p_staff_id
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('auth_lookup','auth_record_failure','auth_record_success')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
