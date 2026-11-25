-- Borra TODOS los datos inventados de supabase/demo/admin_demo_seed.sql, y nada más.
-- Se identifican por el negocio: id 'demo_biz_%' Y slug 'demo-%'. Todo lo que cuelga de esos negocios se borra
-- (también lo que la app haya creado después en ellos: acciones del admin, auditoría, etc.).
-- Orden seguro para las claves foráneas (hijos antes que padres). Una sola transacción. Se puede ejecutar varias veces.
--
--   psql "$DATABASE_URL" -f supabase/demo/admin_demo_clean.sql      (o pégalo en el editor SQL de Supabase)

begin;

create temp table demo_clean_ids on commit drop as
  select id from public.businesses where id like 'demo\_biz\_%' and slug like 'demo-%';

delete from public.stamp_claims          where business_id in (select id from demo_clean_ids);
delete from public.redemptions           where business_id in (select id from demo_clean_ids);
delete from public.rejections            where business_id in (select id from demo_clean_ids);
delete from public.audit_log             where business_id in (select id from demo_clean_ids);
delete from public.marketing_generations where business_id in (select id from demo_clean_ids);
delete from public.admin_payments        where business_id in (select id from demo_clean_ids);
delete from public.admin_actions         where business_id in (select id from demo_clean_ids);
delete from public.access_tokens         where staff_id in (select s.id from public.staff s where s.business_id in (select id from demo_clean_ids));
delete from public.stamp_codes           where business_id in (select id from demo_clean_ids);
delete from public.customers             where business_id in (select id from demo_clean_ids);
delete from public.staff                 where business_id in (select id from demo_clean_ids);
delete from public.locations             where business_id in (select id from demo_clean_ids);
delete from public.programs              where business_id in (select id from demo_clean_ids);
-- Lo que quede (p. ej. staff_members) cae por "on delete cascade".
delete from public.businesses            where id in (select id from demo_clean_ids);
-- Códigos de verificación que alguien haya pedido con un correo inventado.
delete from public.email_otps            where email like '%@demo.stampaecu.app';

commit;
