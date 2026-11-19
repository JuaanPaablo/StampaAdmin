-- Stampa: esquema multi-negocio. Aplicar con `supabase db push` (ver supabase/README.md).
-- Decisiones no obvias:
--  * Los ids son TEXT legibles ('biz_esquina', 'cod_a1b2c3d4e5'), no uuid: coinciden con los que usa el repo en memoria
--    y con el contrato de la app. gen_id() los genera cuando no se pasan.
--  * Los PIN se guardan con bcrypt (pgcrypto.crypt) en staff.pin_hash. Esa columna NO se concede a `authenticated`.
--  * Dinero siempre en centavos (integer). Fechas en timestamptz (UTC); el negocio guarda su zona en businesses.timezone.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.gen_id(prefix text) returns text
language sql volatile as $$
  select prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)
$$;

/* ---------- Negocios, sucursales, equipo, programa ---------- */

create table public.businesses (
  id          text primary key default public.gen_id('biz'),
  name        text not null check (length(btrim(name)) >= 2),
  slug        text not null unique,
  type        text not null check (type in ('restaurante','cafeteria','gimnasio','floristeria','barberia','peluqueria','panaderia','tienda','spa','otro')),
  city        text,
  country     text not null default 'EC',
  currency    text not null default 'USD' check (currency = 'USD'),
  timezone    text not null default 'America/Guayaquil',
  plan        text not null default 'gratis' check (plan in ('gratis','negocio','pro')),
  created_at  timestamptz not null default now()
);

create table public.locations (
  id           text primary key default public.gen_id('loc'),
  business_id  text not null references public.businesses(id) on delete cascade,
  name         text not null,
  address      text,
  active       boolean not null default true
);
create index locations_business_idx on public.locations (business_id);

create table public.staff (
  id           text primary key default public.gen_id('emp'),
  business_id  text not null references public.businesses(id) on delete cascade,
  name         text not null,
  role         text not null check (role in ('owner','manager','cashier')),
  active       boolean not null default true,
  location_id  text references public.locations(id) on delete set null,
  pin_hash     text,                                   -- bcrypt; nunca se expone a clientes
  has_pin      boolean generated always as (pin_hash is not null) stored,
  created_at   timestamptz not null default now()
);
create index staff_business_idx on public.staff (business_id, role);

-- Vincula usuarios de Supabase Auth con un negocio (y opcionalmente con su fila de equipo).
-- Todas las políticas RLS cuelgan de esta tabla: un usuario ve solo los negocios en los que es miembro.
create table public.staff_members (
  user_id      uuid not null references auth.users(id) on delete cascade,
  business_id  text not null references public.businesses(id) on delete cascade,
  staff_id     text references public.staff(id) on delete set null,
  primary key (user_id, business_id)
);
create index staff_members_business_idx on public.staff_members (business_id);

create table public.programs (
  business_id                text primary key references public.businesses(id) on delete cascade,  -- un programa por negocio
  name                       text not null,
  stamps_required            integer not null check (stamps_required between 4 and 20),
  reward_title               text not null,
  reward_description         text,
  require_amount             boolean not null default true,
  min_spend_cents_per_stamp  integer not null default 0 check (min_spend_cents_per_stamp >= 0),
  code_ttl_seconds           integer not null default 300 check (code_ttl_seconds between 30 and 3600),
  max_seats_without_approval integer not null default 4 check (max_seats_without_approval between 1 and 20),
  cooldown_minutes           integer not null default 0 check (cooldown_minutes between 0 and 10080),
  colors                     jsonb not null default '{"bg":"#001D3D","accent":"#FFC301","ink":"#FFFFFF"}',
  logo_text                  text not null default 'ST',
  logo_url                   text,
  terms                      text,
  birthday_reward            text,
  reward_expires_days        integer
);

/* ---------- Clientes ---------- */

create table public.customers (
  id               text primary key default public.gen_id('cli'),
  business_id      text not null references public.businesses(id) on delete cascade,
  name             text not null,
  contact          text not null,
  contact_kind     text not null check (contact_kind in ('whatsapp','email')),
  birthday_d       smallint check (birthday_d between 1 and 31),
  birthday_m       smallint check (birthday_m between 0 and 11),      -- 0 = enero, igual que el contrato de la app
  consent_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  stamps           integer not null default 0 check (stamps >= 0),
  total_stamps     integer not null default 0 check (total_stamps >= 0),
  rewards_redeemed integer not null default 0 check (rewards_redeemed >= 0),
  last_visit_at    timestamptz,
  wallet           text check (wallet in ('apple','google')),
  notes            text,
  unique (business_id, contact)                                         -- un contacto, un cliente por negocio
);
create index customers_business_visit_idx on public.customers (business_id, last_visit_at desc);

/* ---------- Códigos de sello y reclamos ---------- */

create table public.stamp_codes (
  id           text primary key default public.gen_id('cod'),
  business_id  text not null references public.businesses(id) on delete cascade,
  location_id  text references public.locations(id) on delete set null,
  code         text not null check (code ~ '^[0-9]{6}$'),
  ticket       text not null check (length(btrim(ticket)) > 0),
  -- Ticket comparado sin espacios sobrantes ni mayúsculas: 'a-100 ' y 'A-100' son el mismo ticket.
  ticket_norm  text generated always as (upper(btrim(regexp_replace(ticket, '\s+', ' ', 'g')))) stored,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  seats        integer not null check (seats >= 1),
  created_by   text not null references public.staff(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  approved_by  text references public.staff(id),
  cancelled_at timestamptz,
  attempts     integer not null default 0 check (attempts >= 0),        -- intentos rechazados con el código ya quemado
  -- `live` = el código todavía puede reclamarse. Existe porque Postgres no permite now() en un índice parcial:
  -- se apaga al agotarse, cancelarse o (de forma perezosa) al crear un código nuevo del mismo negocio y vencer.
  -- Así la unicidad (business_id, code) solo aplica a códigos vivos y los números pueden reciclarse.
  live         boolean not null default true
);
-- Un ticket genera un solo código por negocio, para siempre.
create unique index stamp_codes_ticket_uq on public.stamp_codes (business_id, ticket_norm);
-- Un número de código vivo es único en el negocio.
create unique index stamp_codes_live_code_uq on public.stamp_codes (business_id, code) where live;
create index stamp_codes_lookup_idx on public.stamp_codes (business_id, code, created_at desc);
create index stamp_codes_created_idx on public.stamp_codes (business_id, created_at desc);
create index stamp_codes_staff_idx on public.stamp_codes (business_id, created_by, created_at desc);

create table public.stamp_claims (
  id             text primary key default public.gen_id('clm'),
  code_id        text not null references public.stamp_codes(id) on delete cascade,
  business_id    text not null references public.businesses(id) on delete cascade,
  customer_id    text not null references public.customers(id) on delete cascade,
  customer_name  text not null,                                          -- copia del nombre al momento del sello (historial estable)
  at             timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      text references public.staff(id),
  -- Un cliente reclama un solo cupo por código; el sello anulado sigue contando (no se puede volver a reclamar).
  unique (code_id, customer_id)
);
create index stamp_claims_business_at_idx on public.stamp_claims (business_id, at desc);
create index stamp_claims_customer_idx on public.stamp_claims (customer_id, at desc);

create table public.redemptions (
  id             text primary key default public.gen_id('can'),
  business_id    text not null references public.businesses(id) on delete cascade,
  customer_id    text not null references public.customers(id) on delete cascade,
  customer_name  text not null,
  staff_id       text not null references public.staff(id),
  at             timestamptz not null default now()
);
create index redemptions_business_at_idx on public.redemptions (business_id, at desc);
create index redemptions_customer_idx on public.redemptions (customer_id);

create table public.audit_log (
  id           text primary key default public.gen_id('aud'),
  business_id  text not null references public.businesses(id) on delete cascade,
  staff_id     text references public.staff(id) on delete set null,
  action       text not null,                                            -- 'code.create' | 'claim.void' | 'redeem' | ...
  detail       text not null,
  at           timestamptz not null default now()
);
create index audit_business_at_idx on public.audit_log (business_id, at desc);

-- Intentos rechazados. Las alertas (ticket repetido, espera entre sellos, código quemado) se DERIVAN de aquí y de
-- los códigos: no se guardan alertas. Tabla extra respecto al contrato: no hay otra forma de contar lo que no ocurrió.
create table public.rejections (
  id           text primary key default public.gen_id('rej'),
  business_id  text not null references public.businesses(id) on delete cascade,
  kind         text not null check (kind in ('duplicate_ticket','cooldown','burned_code')),
  staff_id     text references public.staff(id) on delete set null,
  code_id      text references public.stamp_codes(id) on delete set null,
  customer_id  text references public.customers(id) on delete set null,
  ticket       text,
  minutes      integer,
  at           timestamptz not null default now()
);
create index rejections_business_at_idx on public.rejections (business_id, at desc);

/* ---------- Seguridad: RLS por negocio ---------- */

-- SECURITY DEFINER para evitar recursión de RLS al consultar staff_members desde las políticas.
create or replace function public.my_business_ids() returns setof text
language sql stable security definer set search_path = public as $$
  select business_id from public.staff_members where user_id = auth.uid()
$$;

create or replace function public.is_manager_of(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_members m join public.staff s on s.id = m.staff_id
    where m.user_id = auth.uid() and m.business_id = b and s.active and s.role in ('owner','manager')
  )
$$;

alter table public.businesses     enable row level security;
alter table public.locations      enable row level security;
alter table public.staff          enable row level security;
alter table public.staff_members  enable row level security;
alter table public.programs       enable row level security;
alter table public.customers      enable row level security;
alter table public.stamp_codes    enable row level security;
alter table public.stamp_claims   enable row level security;
alter table public.redemptions    enable row level security;
alter table public.audit_log      enable row level security;
alter table public.rejections     enable row level security;

-- Lectura: todo miembro del negocio ve los datos de SU negocio y de ningún otro.
create policy businesses_read   on public.businesses    for select using (id in (select public.my_business_ids()));
create policy locations_read    on public.locations     for select using (business_id in (select public.my_business_ids()));
create policy staff_read        on public.staff         for select using (business_id in (select public.my_business_ids()));
create policy programs_read     on public.programs      for select using (business_id in (select public.my_business_ids()));
create policy customers_read    on public.customers     for select using (business_id in (select public.my_business_ids()));
create policy codes_read        on public.stamp_codes   for select using (business_id in (select public.my_business_ids()));
create policy claims_read       on public.stamp_claims  for select using (business_id in (select public.my_business_ids()));
create policy redemptions_read  on public.redemptions   for select using (business_id in (select public.my_business_ids()));
create policy audit_read        on public.audit_log     for select using (business_id in (select public.my_business_ids()));
create policy rejections_read   on public.rejections    for select using (business_id in (select public.my_business_ids()));
create policy members_read      on public.staff_members for select using (user_id = auth.uid());

-- Escritura directa: solo dueño/gerente sobre configuración; cualquier miembro puede registrar y editar clientes.
create policy businesses_write  on public.businesses for update using (public.is_manager_of(id)) with check (public.is_manager_of(id));
create policy locations_write   on public.locations  for all using (public.is_manager_of(business_id)) with check (public.is_manager_of(business_id));
create policy staff_write       on public.staff      for all using (public.is_manager_of(business_id)) with check (public.is_manager_of(business_id));
create policy programs_write    on public.programs   for all using (public.is_manager_of(business_id)) with check (public.is_manager_of(business_id));
create policy customers_insert  on public.customers  for insert with check (business_id in (select public.my_business_ids()));
create policy customers_update  on public.customers  for update using (business_id in (select public.my_business_ids())) with check (business_id in (select public.my_business_ids()));

-- Códigos, reclamos, canjes, auditoría y rechazos NO tienen políticas de escritura: solo se modifican con las
-- funciones de 0002_functions.sql (SECURITY DEFINER), que aplican las reglas de negocio de forma atómica.

-- El hash del PIN nunca llega a un cliente autenticado (columna fuera del GRANT). El service_role lo conserva.
revoke select on public.staff from anon, authenticated;
grant select (id, business_id, name, role, active, location_id, has_pin, created_at) on public.staff to authenticated;
-- Los clientes no autenticados (anon) no deben tocar nada: sin políticas ya no ven filas, y además se revoca.
revoke all on all tables in schema public from anon;
