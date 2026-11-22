-- 0007: planes Básico / Standard / Pro (antes gratis / negocio / pro) y registro de uso de Marketing con IA.

-- Planes ---------------------------------------------------------------------------------------------------------------
alter table public.businesses drop constraint if exists businesses_plan_check;
update public.businesses set plan = 'basico' where plan = 'gratis';
update public.businesses set plan = 'standard' where plan = 'negocio';
alter table public.businesses alter column plan set default 'basico';
alter table public.businesses add constraint businesses_plan_check check (plan in ('basico','standard','pro'));

-- create_business_access validaba los nombres viejos: se reescribe solo esa línea de la función existente.
do $$
declare v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_business_access';
  if v_def is not null and position('''gratis'',''negocio'',''pro''' in v_def) > 0 then
    execute replace(v_def, '''gratis'',''negocio'',''pro''', '''basico'',''standard'',''pro''');
  end if;
end $$;

-- Marketing ------------------------------------------------------------------------------------------------------------
-- Cada generación con IA queda registrada: sirve para el límite mensual por plan y para ver el costo por negocio.
create table if not exists public.marketing_generations (
  id               text primary key default public.gen_id('mkt'),
  business_id      text not null references public.businesses(id) on delete cascade,
  staff_id         text references public.staff(id) on delete set null,
  kind             text not null check (kind in ('post','data_post','calendar','review_reply')),
  topic            text,
  output           jsonb not null default '{}'::jsonb,
  model            text,
  prompt_tokens    integer not null default 0,
  cached_tokens    integer not null default 0,
  completion_tokens integer not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists marketing_generations_business_idx on public.marketing_generations (business_id, created_at desc);
alter table public.marketing_generations enable row level security;
revoke all on public.marketing_generations from anon, authenticated;
