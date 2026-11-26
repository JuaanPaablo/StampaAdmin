-- 0010: tarjetas extra en Wallet — cupones (offers), gift cards, coordenadas de sucursales, tope de avisos y servicio
-- web de Apple Wallet. Contrato en docs/TARJETAS.md. Requiere 0001..0009. Idempotente: se puede volver a ejecutar.
--
-- Decisiones:
--  * Todas las tablas nuevas solo las usa el servidor con la service role (como 0009): RLS activado SIN políticas y se
--    revoca todo a anon y authenticated.
--  * El saldo de una gift card SOLO cambia por gift_card_apply() (bloquea la fila con `for update`, rechaza saldo
--    negativo y más de US$500, inserta el movimiento y el registro de actividad en la misma transacción).
--    gift_card_issue() crea la tarjeta con saldo 0 y carga el monto inicial llamando a gift_card_apply().
--  * offer_send() envía un cupón en una transacción: bloquea el negocio (serializa envíos y el conteo de campañas del
--    mes), crea un customer_offer por cliente (on conflict do nothing) y marca el cupón como enviado.
--    El tope mensual (features(plan).pushCampaigns) y el inicio del mes en Ecuador los pasa la app.
--  * Los mensajes de error son los mismos de src/lib/domain/wallet-cards.ts y del repo en memoria.

/* ===================================== Coordenadas de sucursales ===================================== */

alter table public.locations add column if not exists latitude double precision;
alter table public.locations add column if not exists longitude double precision;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'locations_coords_check' and conrelid = 'public.locations'::regclass) then
    alter table public.locations add constraint locations_coords_check check (
      (latitude is null and longitude is null)
      or (latitude between -90 and 90 and longitude between -180 and 180)
    );
  end if;
end $$;

/* ===================================== Cupones ===================================== */

create table if not exists public.offers (
  id           text primary key default public.gen_id('ofr'),
  business_id  text not null references public.businesses(id) on delete cascade,
  title        text not null check (length(btrim(title)) between 2 and 40),
  description  text not null check (length(btrim(description)) between 2 and 200),
  terms        text check (terms is null or length(terms) <= 300),
  image_url    text check (image_url is null or (image_url ~ '^https://' and length(image_url) <= 500)),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  status       text not null default 'draft' check (status in ('draft','sent','ended')),
  sent_at      timestamptz,
  created_by   text references public.staff(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status = 'draft' or status = 'ended' or sent_at is not null)
);
create index if not exists offers_business_idx on public.offers (business_id, created_at desc);
create index if not exists offers_sent_idx on public.offers (business_id, sent_at) where sent_at is not null;

create table if not exists public.customer_offers (
  id                    text primary key default public.gen_id('cof'),
  offer_id              text not null references public.offers(id) on delete cascade,
  business_id           text not null references public.businesses(id) on delete cascade,
  customer_id           text not null references public.customers(id) on delete cascade,
  created_at            timestamptz not null default now(),
  redeemed_at           timestamptz,
  redeemed_by           text references public.staff(id) on delete set null,
  redeemed_location_id  text references public.locations(id) on delete set null,
  unique (offer_id, customer_id)
);
create index if not exists customer_offers_customer_idx on public.customer_offers (business_id, customer_id);
create index if not exists customer_offers_offer_idx on public.customer_offers (offer_id) include (redeemed_at);

/* ===================================== Gift cards ===================================== */

create table if not exists public.gift_cards (
  id             text primary key default public.gen_id('gft'),
  business_id    text not null references public.businesses(id) on delete cascade,
  customer_id    text references public.customers(id) on delete set null,   -- null = vendida sin cliente registrado
  code           text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$'),
  balance_cents  integer not null default 0 check (balance_cents between 0 and 50000),
  initial_cents  integer not null check (initial_cents between 1 and 50000),
  status         text not null default 'active' check (status in ('active','void')),
  created_at     timestamptz not null default now(),
  created_by     text references public.staff(id) on delete set null
);
create index if not exists gift_cards_business_idx on public.gift_cards (business_id, created_at desc);
create index if not exists gift_cards_customer_idx on public.gift_cards (business_id, customer_id) where customer_id is not null;

create table if not exists public.gift_card_movements (
  id                   text primary key default public.gen_id('gmv'),
  gift_card_id         text not null references public.gift_cards(id) on delete cascade,
  business_id          text not null references public.businesses(id) on delete cascade,
  kind                 text not null check (kind in ('issue','topup','charge','void','adjust')),
  amount_cents         integer not null,                                        -- con signo
  balance_after_cents  integer not null check (balance_after_cents between 0 and 50000),
  staff_id             text references public.staff(id) on delete set null,
  location_id          text references public.locations(id) on delete set null,
  note                 text check (note is null or length(note) <= 200),
  -- Id de la operación que manda la pantalla (crypto.randomUUID al confirmar): el mismo id nunca mueve el saldo dos
  -- veces (doble toque, reintento por red). Único por negocio.
  request_id           text check (request_id is null or request_id ~ '^[A-Za-z0-9-]{8,64}$'),
  created_at           timestamptz not null default now()
);
alter table public.gift_card_movements add column if not exists request_id text;
create unique index if not exists gift_card_movements_request_idx on public.gift_card_movements (business_id, request_id)
  where request_id is not null;
create index if not exists gift_card_movements_card_idx on public.gift_card_movements (gift_card_id, created_at desc);
create index if not exists gift_card_movements_business_idx on public.gift_card_movements (business_id, created_at desc);

/* ===================================== Avisos enviados (tope 3 / 24 h) ===================================== */

create table if not exists public.wallet_notifications (
  id           text primary key default public.gen_id('wnt'),
  business_id  text not null references public.businesses(id) on delete cascade,
  customer_id  text not null references public.customers(id) on delete cascade,
  platform     text not null check (platform in ('google','apple')),
  kind         text not null check (length(kind) between 1 and 40),
  created_at   timestamptz not null default now()
);
create index if not exists wallet_notifications_customer_idx on public.wallet_notifications (business_id, customer_id, created_at desc);

/* ===================================== Servicio web de Apple Wallet ===================================== */

create table if not exists public.apple_devices (
  device_library_id  text primary key check (length(device_library_id) between 1 and 200),
  push_token         text not null check (length(push_token) between 1 and 200),
  updated_at         timestamptz not null default now()
);
create index if not exists apple_devices_token_idx on public.apple_devices (push_token);   -- baja por APNs 410

create table if not exists public.apple_registrations (
  device_library_id  text not null references public.apple_devices(device_library_id) on delete cascade,
  pass_type_id       text not null check (length(pass_type_id) between 1 and 200),
  serial             text not null check (length(serial) between 1 and 200),
  -- Milisegundos: lastUpdated vuelve como passesUpdatedSince (ms) y `updated_at > tag` no debe repetir el serial.
  updated_at         timestamptz not null default date_trunc('milliseconds', now()),   -- último cambio del pase
  created_at         timestamptz not null default date_trunc('milliseconds', now()),
  primary key (device_library_id, pass_type_id, serial)
);
create index if not exists apple_registrations_serial_idx on public.apple_registrations (pass_type_id, serial);

/* ===================================== Permisos ===================================== */

alter table public.offers               enable row level security;
alter table public.customer_offers      enable row level security;
alter table public.gift_cards           enable row level security;
alter table public.gift_card_movements  enable row level security;
alter table public.wallet_notifications enable row level security;
alter table public.apple_devices        enable row level security;
alter table public.apple_registrations  enable row level security;
revoke all on public.offers               from anon, authenticated;
revoke all on public.customer_offers      from anon, authenticated;
revoke all on public.gift_cards           from anon, authenticated;
revoke all on public.gift_card_movements  from anon, authenticated;
revoke all on public.wallet_notifications from anon, authenticated;
revoke all on public.apple_devices        from anon, authenticated;
revoke all on public.apple_registrations  from anon, authenticated;
grant all on public.offers               to service_role;
grant all on public.customer_offers      to service_role;
grant all on public.gift_cards           to service_role;
grant all on public.gift_card_movements  to service_role;
grant all on public.wallet_notifications to service_role;
grant all on public.apple_devices        to service_role;
grant all on public.apple_registrations  to service_role;

/* ===================================== Funciones ===================================== */

-- "$1.234,56" (mismo formato que formatCents en la app).
create or replace function public.fmt_cents(p_cents integer) returns text
language sql immutable set search_path = public as $$
  select case when p_cents < 0 then '-' else '' end || '$'
    || regexp_replace((abs(p_cents) / 100)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || ',' || lpad((abs(p_cents) % 100)::text, 2, '0')
$$;

-- Firmas de borradores anteriores de esta migración (sin p_request_id): se quitan para no dejar sobrecargas.
drop function if exists public.gift_card_apply(text, text, text, integer, text, text, text, text);
drop function if exists public.gift_card_issue(text, text, text, integer, text, text, text, text);

-- Único punto donde cambia el saldo de una gift card. p_amount_cents con signo:
--   issue/topup > 0 · charge < 0 · adjust <> 0 · void: se ignora (resta todo el saldo y anula la tarjeta).
-- p_request_id (opcional): si ya hay un movimiento con ese id en el negocio, NO hace nada y devuelve ese movimiento
-- ({ok, movement_id, balance_cents, replayed:true}); se revisa con la tarjeta bloqueada, así dos envíos iguales a la
-- vez no cobran dos veces. Devuelve {ok, movement_id, balance_cents} o {ok:false, error}.
create or replace function public.gift_card_apply(
  p_business_id text, p_gift_card_id text, p_kind text, p_amount_cents integer, p_staff_id text,
  p_location_id text, p_note text, p_audit_detail text, p_request_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_card public.gift_cards; v_delta integer; v_new integer; v_mov text; v_loc text; v_prev public.gift_card_movements;
begin
  if p_kind not in ('issue','topup','charge','void','adjust') then
    return jsonb_build_object('ok', false, 'error', 'Movimiento no válido.');
  end if;
  select * into v_card from public.gift_cards where id = p_gift_card_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos esa gift card.'); end if;
  if p_request_id is not null then
    select * into v_prev from public.gift_card_movements where business_id = p_business_id and request_id = p_request_id;
    if found then
      if v_prev.gift_card_id <> v_card.id or v_prev.kind <> p_kind then
        return jsonb_build_object('ok', false, 'error', 'Esta operación ya se registró. Recarga la página y revisa el saldo.');
      end if;
      return jsonb_build_object('ok', true, 'movement_id', v_prev.id, 'balance_cents', v_card.balance_cents, 'replayed', true);
    end if;
  end if;
  if v_card.status <> 'active' then return jsonb_build_object('ok', false, 'error', 'Esta gift card está anulada.'); end if;
  if p_staff_id is not null and not exists (select 1 from public.staff where id = p_staff_id and business_id = p_business_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Esta persona no está activa en este negocio.');
  end if;
  if p_location_id is not null then
    select id into v_loc from public.locations where id = p_location_id and business_id = p_business_id and deleted_at is null;
    if v_loc is null then return jsonb_build_object('ok', false, 'error', 'No encontramos esa sucursal.'); end if;
  end if;

  v_delta := case when p_kind = 'void' then -v_card.balance_cents else coalesce(p_amount_cents, 0) end;
  if (p_kind in ('issue','topup') and v_delta <= 0) or (p_kind = 'charge' and v_delta >= 0) or (p_kind = 'adjust' and v_delta = 0) then
    return jsonb_build_object('ok', false, 'error', 'Escribe un monto válido.');
  end if;
  v_new := v_card.balance_cents + v_delta;
  if v_new < 0 then
    return jsonb_build_object('ok', false, 'error', 'Saldo insuficiente: quedan ' || public.fmt_cents(v_card.balance_cents) || '.');
  end if;
  if v_new > 50000 then
    return jsonb_build_object('ok', false, 'error', 'El saldo máximo es ' || public.fmt_cents(50000) || '.');
  end if;

  update public.gift_cards
    set balance_cents = v_new, status = case when p_kind = 'void' then 'void' else status end
    where id = v_card.id;
  insert into public.gift_card_movements (gift_card_id, business_id, kind, amount_cents, balance_after_cents, staff_id, location_id, note, request_id)
  values (v_card.id, p_business_id, p_kind, v_delta, v_new, p_staff_id, v_loc, nullif(left(btrim(coalesce(p_note, '')), 200), ''), p_request_id)
  returning id into v_mov;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'gift.' || p_kind, coalesce(nullif(btrim(p_audit_detail), ''), 'Movimiento de gift card.'));
  return jsonb_build_object('ok', true, 'movement_id', v_mov, 'balance_cents', v_new);
end $$;

-- Vende una gift card: la crea con saldo 0 y carga el monto con gift_card_apply('issue').
-- El código lo genera la app (generateGiftCardCode); si ya existe devuelve {ok:false, code:'code_taken'} para reintentar.
-- p_request_id (opcional): repetir el mismo id devuelve la venta ya hecha (bloquea el negocio para que dos envíos
-- iguales a la vez no creen dos tarjetas).
create or replace function public.gift_card_issue(
  p_business_id text, p_code text, p_customer_id text, p_amount_cents integer, p_staff_id text,
  p_location_id text, p_note text, p_audit_detail text, p_request_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text; v_res jsonb; v_prev public.gift_card_movements;
begin
  if p_request_id is not null then
    perform 1 from public.businesses where id = p_business_id for update;
    select * into v_prev from public.gift_card_movements where business_id = p_business_id and request_id = p_request_id;
    if found then
      if v_prev.kind <> 'issue' then
        return jsonb_build_object('ok', false, 'error', 'Esta operación ya se registró. Recarga la página y revisa el saldo.');
      end if;
      return jsonb_build_object('ok', true, 'movement_id', v_prev.id, 'gift_card_id', v_prev.gift_card_id,
        'balance_cents', (select balance_cents from public.gift_cards where id = v_prev.gift_card_id), 'replayed', true);
    end if;
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 50000 then
    return jsonb_build_object('ok', false, 'error', 'El saldo máximo es ' || public.fmt_cents(50000) || '.');
  end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id and business_id = p_business_id) then
    return jsonb_build_object('ok', false, 'error', 'No encontramos a ese cliente.');
  end if;
  if exists (select 1 from public.gift_cards where code = p_code) then
    return jsonb_build_object('ok', false, 'code', 'code_taken', 'error', 'Código repetido.');
  end if;
  begin
    insert into public.gift_cards (business_id, customer_id, code, balance_cents, initial_cents, status, created_by)
    values (p_business_id, p_customer_id, p_code, 0, p_amount_cents, 'active', p_staff_id)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'code_taken', 'error', 'Código repetido.');
  end;
  v_res := public.gift_card_apply(p_business_id, v_id, 'issue', p_amount_cents, p_staff_id, p_location_id, p_note, p_audit_detail, p_request_id);
  if (v_res->>'ok')::boolean is not true then
    raise exception using message = coalesce(v_res->>'error', 'No se pudo vender la gift card.');   -- deshace la tarjeta
  end if;
  return v_res || jsonb_build_object('gift_card_id', v_id);
end $$;

-- Envía un cupón en borrador a todos los clientes del negocio. p_month_start = inicio del mes en Ecuador;
-- p_max_campaigns = features(plan).pushCampaigns; p_limit_error = mensaje si ya llegó al tope.
-- Devuelve {ok, customer_ids: [...], title} o {ok:false, error}.
create or replace function public.offer_send(
  p_business_id text, p_offer_id text, p_staff_id text, p_month_start timestamptz, p_max_campaigns integer, p_limit_error text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_offer public.offers; v_used integer; v_ids jsonb; v_n integer;
begin
  perform 1 from public.businesses where id = p_business_id for update;      -- serializa los envíos del negocio
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese negocio.'); end if;
  select * into v_offer from public.offers where id = p_offer_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos ese cupón.'); end if;
  if v_offer.status = 'sent' then return jsonb_build_object('ok', false, 'error', 'Ese cupón ya se envió.'); end if;
  if v_offer.status = 'ended' then return jsonb_build_object('ok', false, 'error', 'Ese cupón ya terminó.'); end if;
  if v_offer.ends_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'La fecha final ya pasó. Cambia las fechas antes de enviarlo.');
  end if;
  if not exists (select 1 from public.staff where id = p_staff_id and business_id = p_business_id and active and role in ('owner','manager')) then
    return jsonb_build_object('ok', false, 'error', 'Solo el dueño o un gerente pueden hacer esto.');
  end if;
  select count(*) into v_used from public.offers where business_id = p_business_id and sent_at >= p_month_start;
  if v_used >= coalesce(p_max_campaigns, 0) then
    return jsonb_build_object('ok', false, 'error', coalesce(p_limit_error, 'Ya llegaste al límite de cupones de este mes.'));
  end if;

  with ins as (
    insert into public.customer_offers (offer_id, business_id, customer_id)
    select p_offer_id, p_business_id, c.id from public.customers c where c.business_id = p_business_id
    on conflict (offer_id, customer_id) do nothing
    returning customer_id
  )
  select coalesce(jsonb_agg(customer_id), '[]'::jsonb), count(*) into v_ids, v_n from ins;

  update public.offers set status = 'sent', sent_at = now() where id = p_offer_id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'offer.send',
          'Cupón "' || v_offer.title || '" enviado a ' || v_n || case when v_n = 1 then ' cliente.' else ' clientes.' end);
  return jsonb_build_object('ok', true, 'customer_ids', v_ids, 'title', v_offer.title);
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('fmt_cents','gift_card_apply','gift_card_issue','offer_send')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
