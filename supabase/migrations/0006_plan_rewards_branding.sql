-- 0006: renovación automática, provincia, sucursales eliminadas, premios intermedios, encuadre de imágenes y diseño del póster.

-- Negocio: provincia (métrica) y renovación automática mensual del plan.
alter table public.businesses add column if not exists province text;
alter table public.businesses add column if not exists auto_renew boolean not null default false;
create index if not exists businesses_province_idx on public.businesses (province);

-- Sucursales: eliminar = ocultar (el historial de sellos conserva la referencia). Orden estable por creación.
alter table public.locations add column if not exists deleted_at timestamptz;
alter table public.locations add column if not exists created_at timestamptz not null default now();
-- Las que se "quitaron" antes (inactivas) pasan a eliminadas: así ya no aparecen en Ajustes.
update public.locations set deleted_at = now() where active = false and deleted_at is null;

-- Programa: premios intermedios [{ "at": 4, "title": "Postre gratis" }], encuadre de logo y portada, y diseño del póster.
alter table public.programs add column if not exists milestones jsonb not null default '[]'::jsonb;
alter table public.programs add column if not exists image_framing jsonb not null default '{}'::jsonb;
alter table public.programs add column if not exists poster jsonb not null default '{}'::jsonb;

-- Cliente: sellos intermedios ya canjeados en la tarjeta actual (se vacía al canjear el premio final).
alter table public.customers add column if not exists milestones_claimed integer[] not null default '{}';

-- Canje: qué premio se entregó (null = premio final).
alter table public.redemptions add column if not exists milestone integer;
alter table public.redemptions add column if not exists reward_title text;

-- Canjear: premio final (p_milestone null) o el premio intermedio de un sello.
drop function if exists public.redeem_reward(text, text, text);
create or replace function public.redeem_reward(p_business_id text, p_customer_id text, p_staff_id text, p_milestone integer default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_prog public.programs; v_cust public.customers; v_id text; v_title text;
begin
  select * into v_prog from public.programs where business_id = p_business_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'Ese negocio no tiene programa configurado.'); end if;
  select * into v_cust from public.customers where id = p_customer_id and business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'No encontramos a ese cliente.'); end if;
  if not exists (select 1 from public.staff where id = p_staff_id and business_id = p_business_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Esta persona no está activa en este negocio.');
  end if;

  if p_milestone is null then
    if v_cust.stamps < v_prog.stamps_required then
      return jsonb_build_object('ok', false, 'error', 'Aún no completa la tarjeta: tiene ' || v_cust.stamps || ' de ' || v_prog.stamps_required || ' sellos.');
    end if;
    v_title := v_prog.reward_title;
    update public.customers set stamps = stamps - v_prog.stamps_required, rewards_redeemed = rewards_redeemed + 1, milestones_claimed = '{}'
      where id = p_customer_id;
  else
    select m->>'title' into v_title from jsonb_array_elements(v_prog.milestones) m where (m->>'at')::int = p_milestone limit 1;
    if v_title is null or p_milestone >= v_prog.stamps_required then
      return jsonb_build_object('ok', false, 'error', 'Ese premio ya no existe en la tarjeta.');
    end if;
    if v_cust.stamps < p_milestone then
      return jsonb_build_object('ok', false, 'error', 'Aún no llega al sello ' || p_milestone || ': tiene ' || v_cust.stamps || '.');
    end if;
    if p_milestone = any(v_cust.milestones_claimed) then
      return jsonb_build_object('ok', false, 'error', 'Ese premio ya se canjeó en esta tarjeta.');
    end if;
    update public.customers set milestones_claimed = array_append(milestones_claimed, p_milestone), rewards_redeemed = rewards_redeemed + 1
      where id = p_customer_id;
  end if;

  insert into public.redemptions (business_id, customer_id, customer_name, staff_id, milestone, reward_title)
  values (p_business_id, p_customer_id, v_cust.name, p_staff_id, p_milestone, v_title) returning id into v_id;
  insert into public.audit_log (business_id, staff_id, action, detail)
  values (p_business_id, p_staff_id, 'redeem', 'Premio canjeado a ' || v_cust.name || ': ' || v_title || '.');
  return jsonb_build_object('ok', true, 'redemption_id', v_id);
end $$;

revoke execute on function public.redeem_reward(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.redeem_reward(text, text, text, integer) to service_role;
