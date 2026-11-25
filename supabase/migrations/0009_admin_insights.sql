-- 0009: panel de administrador con métricas, cobros, historial de acciones y celular del dueño.
-- Requiere 0001..0008. Idempotente: se puede volver a ejecutar.
--
-- Decisiones:
--  * admin_payments y admin_actions solo las usa el servidor con la service role (como platform_admins en 0004):
--    RLS activado SIN políticas y se revoca todo a anon y authenticated.
--  * Las fechas de calendario (día, semana lunes-domingo, mes) se agrupan en America/Guayaquil, igual que
--    src/lib/domain/admin-insights.ts (ecDayKey, ecWeekKey, ecMonthKey).
--  * admin_business_stats cambia de columnas (agrega n_stamps_7d y last_stamp_at al final): Postgres no permite cambiar
--    el tipo de retorno con create or replace, así que se borra y se vuelve a crear.
--  * admin_record_payment hace todo en una transacción: pago + nuevo vencimiento + acción + registro de actividad.
--    El nuevo vencimiento lo calcula la app (nextPlanExpiry); la función verifica que el vencimiento no haya cambiado.

/* ===================================== Celular del dueño ===================================== */

alter table public.businesses add column if not exists owner_phone text;   -- E.164 de Ecuador: +5939XXXXXXXX
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_owner_phone_check' and conrelid = 'public.businesses'::regclass) then
    alter table public.businesses add constraint businesses_owner_phone_check check (owner_phone is null or owner_phone ~ '^\+5939[0-9]{8}$');
  end if;
end $$;

/* ===================================== Pagos ===================================== */

create table if not exists public.admin_payments (
  id                  text primary key default public.gen_id('pay'),
  business_id         text not null references public.businesses(id) on delete cascade,
  amount_cents        integer not null check (amount_cents > 0 and amount_cents <= 1000000),
  paid_at             date not null,                                   -- día del pago (calendario de Ecuador)
  plan                text not null check (plan in ('basico','standard','pro')),
  months              integer check (months between 1 and 24),         -- null = se fijó la fecha a mano
  previous_expires_at timestamptz,
  new_expires_at      timestamptz not null,
  method              text not null check (method in ('transferencia','efectivo','tarjeta','otro')),
  note                text check (note is null or length(note) <= 500),
  created_by          text references public.platform_admins(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index if not exists admin_payments_business_idx on public.admin_payments (business_id, paid_at desc, created_at desc);
create index if not exists admin_payments_paid_idx on public.admin_payments (paid_at);

/* ===================================== Historial de acciones del admin ===================================== */

create table if not exists public.admin_actions (
  id           text primary key default public.gen_id('act'),
  business_id  text not null references public.businesses(id) on delete cascade,
  admin_id     text references public.platform_admins(id) on delete set null,
  kind         text not null check (kind in ('access_created','suspended','reactivated','plan_changed','expiry_changed',
                                             'payment_recorded','access_resent','note_changed','phone_changed')),
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists admin_actions_business_idx on public.admin_actions (business_id, created_at desc);

alter table public.admin_payments enable row level security;
alter table public.admin_actions  enable row level security;
revoke all on public.admin_payments from anon, authenticated;
revoke all on public.admin_actions  from anon, authenticated;
grant all on public.admin_payments to service_role;
grant all on public.admin_actions  to service_role;

/* ===================================== Índices para las series de la plataforma ===================================== */

create index if not exists stamp_claims_at_idx on public.stamp_claims (at) where voided_at is null;
create index if not exists redemptions_at_idx on public.redemptions (at);
create index if not exists customers_created_idx on public.customers (created_at);

/* ===================================== Funciones ===================================== */

-- Métricas por negocio (reemplaza la de 0004: mismas columnas + n_stamps_7d y last_stamp_at al final).
drop function if exists public.admin_business_stats(text);
create function public.admin_business_stats(p_business_id text default null)
returns table (
  biz_id text, n_customers bigint, n_stamps_30d bigint, n_redemptions_30d bigint, last_activity_at timestamptz,
  n_stamps_7d bigint, last_stamp_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select b.id,
    (select count(*) from public.customers c where c.business_id = b.id),
    (select count(*) from public.stamp_claims s where s.business_id = b.id and s.voided_at is null and s.at >= now() - interval '30 days'),
    (select count(*) from public.redemptions r where r.business_id = b.id and r.at >= now() - interval '30 days'),
    greatest((select max(s.at) from public.stamp_claims s where s.business_id = b.id),
             (select max(r.at) from public.redemptions r where r.business_id = b.id)),
    (select count(*) from public.stamp_claims s where s.business_id = b.id and s.voided_at is null and s.at >= now() - interval '7 days'),
    (select max(s.at) from public.stamp_claims s where s.business_id = b.id and s.voided_at is null)
  from public.businesses b
  where p_business_id is null or b.id = p_business_id
$$;

-- Conteos para las series del admin, agrupados en hora de Ecuador (p_business_id null = toda la plataforma):
--   stamps / redemptions por día ('YYYY-MM-DD', 92 días) · customers por semana (lunes 'YYYY-MM-DD', 13 semanas)
--   · businesses por mes ('YYYY-MM', 13 meses). La app rellena con ceros (fillSeries).
create or replace function public.admin_series(p_business_id text default null)
returns table (kind text, bucket text, n bigint)
language sql stable security definer set search_path = public as $$
  select 'stamps'::text, to_char((s.at at time zone 'America/Guayaquil')::date, 'YYYY-MM-DD'), count(*)
    from public.stamp_claims s
    where s.voided_at is null and s.at >= now() - interval '92 days' and (p_business_id is null or s.business_id = p_business_id)
    group by 2
  union all
  select 'redemptions'::text, to_char((r.at at time zone 'America/Guayaquil')::date, 'YYYY-MM-DD'), count(*)
    from public.redemptions r
    where r.at >= now() - interval '92 days' and (p_business_id is null or r.business_id = p_business_id)
    group by 2
  union all
  select 'customers'::text, to_char(date_trunc('week', c.created_at at time zone 'America/Guayaquil')::date, 'YYYY-MM-DD'), count(*)
    from public.customers c
    where c.created_at >= now() - interval '13 weeks' and (p_business_id is null or c.business_id = p_business_id)
    group by 2
  union all
  select 'businesses'::text, to_char(b.created_at at time zone 'America/Guayaquil', 'YYYY-MM'), count(*)
    from public.businesses b
    where b.created_at >= now() - interval '13 months' and (p_business_id is null or b.id = p_business_id)
    group by 2
$$;

-- Uso de IA por negocio desde p_since: textos (todo menos photo_edit), fotos (photo_edit) y tokens.
create or replace function public.admin_ai_usage(p_since timestamptz, p_business_id text default null)
returns table (biz_id text, texts bigint, images bigint, prompt_tokens bigint, cached_tokens bigint, completion_tokens bigint)
language sql stable security definer set search_path = public as $$
  select m.business_id,
    count(*) filter (where m.kind <> 'photo_edit'),
    count(*) filter (where m.kind = 'photo_edit'),
    coalesce(sum(m.prompt_tokens), 0)::bigint,
    coalesce(sum(m.cached_tokens), 0)::bigint,
    coalesce(sum(m.completion_tokens), 0)::bigint
  from public.marketing_generations m
  where m.created_at >= p_since and (p_business_id is null or m.business_id = p_business_id)
  group by m.business_id
$$;

-- Registra un pago y extiende el vencimiento en una transacción. p_prev_expires_at = vencimiento que leyó la app
-- (sirve de control: si otro cambio llegó antes, no se pisa). No cambia el estado ni el plan del negocio.
create or replace function public.admin_record_payment(
  p_business_id text, p_amount_cents integer, p_paid_at date, p_plan text, p_months integer,
  p_prev_expires_at timestamptz, p_new_expires_at timestamptz, p_method text, p_note text, p_admin_id text,
  p_detail jsonb, p_audit_detail text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_biz public.businesses; v_id text; v_admin text;
begin
  select * into v_biz from public.businesses where id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese negocio.'); end if;
  if date_trunc('milliseconds', v_biz.plan_expires_at) is distinct from date_trunc('milliseconds', p_prev_expires_at) then
    return jsonb_build_object('ok', false, 'error', 'El vencimiento cambió mientras registrabas el pago. Vuelve a intentarlo.');
  end if;
  select id into v_admin from public.platform_admins where id = p_admin_id;
  insert into public.admin_payments (business_id, amount_cents, paid_at, plan, months, previous_expires_at, new_expires_at, method, note, created_by)
  values (p_business_id, p_amount_cents, p_paid_at, p_plan, p_months, v_biz.plan_expires_at, p_new_expires_at, p_method,
          nullif(btrim(coalesce(p_note, '')), ''), v_admin)
  returning id into v_id;
  update public.businesses set plan_expires_at = p_new_expires_at where id = p_business_id;
  insert into public.admin_actions (business_id, admin_id, kind, detail)
  values (p_business_id, v_admin, 'payment_recorded', coalesce(p_detail, '{}'::jsonb) || jsonb_build_object('paymentId', v_id));
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, null, 'business.plan', coalesce(p_audit_detail, 'Pago registrado.'));
  return jsonb_build_object('ok', true, 'payment_id', v_id);
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_business_stats','admin_series','admin_ai_usage','admin_record_payment')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
