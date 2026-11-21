-- Endurecimiento señalado por el linter de Supabase (no cambia el comportamiento).
-- La app solo usa service_role desde el servidor; anon nunca necesita estas funciones.
alter function public.gen_id(text) set search_path = public, extensions;
alter function public.fmt_money(integer) set search_path = public;
alter function public.cupos(integer) set search_path = public;
alter function public.max_seats(integer, public.programs) set search_path = public;
revoke execute on function public.my_business_ids() from public, anon;
revoke execute on function public.is_manager_of(text) from public, anon;
