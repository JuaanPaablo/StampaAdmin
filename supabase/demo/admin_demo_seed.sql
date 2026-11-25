-- DATOS INVENTADOS para ver el panel de administrador con vida en producción. Requiere 0001..0009 aplicadas.
--
--   psql "$DATABASE_URL" -f supabase/demo/admin_demo_seed.sql      (o pégalo en el editor SQL de Supabase)
--   Para quitarlos: supabase/demo/admin_demo_clean.sql
--
-- Qué crea: 12 negocios de mentira (Ecuador) en todos los estados que el admin debe ver: activos con mucho, poco y
-- ningún uso, por vencer, vencido, suspendido, atascado en el asistente e invitación vencida; con sucursales, programa,
-- equipo, clientes, sellos (un código por visita) y canjes repartidos en hasta 12 meses (crecimiento y fines de
-- semana más altos), pagos, historial del admin, celulares y uso de IA del mes.
--
-- Cómo se reconoce: negocios con id 'demo_biz_%' y slug 'demo-%'; todas las demás filas llevan id 'demo_...'.
-- Correos @demo.stampaecu.app (dominio sin buzones).
-- Nadie puede entrar como estos negocios: ninguna persona tiene contraseña real (password_hash = 'demo$sin-acceso',
-- que no es un hash válido y nunca verifica), nadie tiene PIN, y la única invitación pendiente ya venció.
--
-- Una sola transacción. Se puede volver a ejecutar: primero borra lo de una ejecución anterior.
-- Las fechas son relativas a now(): ejecútalo de nuevo para "refrescar" la demo.

begin;

/* ---------- 1. Limpieza de una ejecución anterior (igual que admin_demo_clean.sql) ---------- */
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
delete from public.businesses            where id in (select id from demo_clean_ids);

select setseed(0.4242);

/* ---------- 2. Configuración de los 12 negocios ---------- */
create temp table demo_cfg (
  ord int, k text, name text, slug text, type text, city text, province text, plan text,
  age int,               -- días desde el alta
  status text,           -- active | setup | suspended
  expires_in int,        -- días hasta el vencimiento (negativo = vencido)
  auto_renew boolean,
  daily numeric,         -- visitas por día al final del periodo (empieza en ~35 %)
  idle int,              -- días sin sellos al final
  n_cust int,
  owner_name text, manager_name text, cashier_name text, phone text, note text,
  cycle int,             -- meses por pago
  setup_kind text,       -- solo setup: 'stuck' (ya tiene "contraseña") | 'expired' (invitación vencida)
  suspended_ago int,
  ai_texts int, ai_images int,
  prog_name text, stamps_req int, reward text, req_amount boolean, min_spend int, cooldown int, bg text, accent text
) on commit drop;

insert into demo_cfg values
 (1,'sabor','Sabor Manabita','demo-sabor-manabita','restaurante','Portoviejo','Manabí','pro',360,'active',12,false,11,0,170,'Ramón Mendoza','Gina Zambrano','Tito Loor','+593987654321','Dos locales. Paga por transferencia.',3,null,null,34,12,'Tarjeta de almuerzos',8,'Postre de la casa',true,800,0,'#7A1F1F','#FFC301'),
 (2,'dulce','Panadería Dulce Hogar','demo-panaderia-dulce-hogar','panaderia','Quito','Pichincha','standard',330,'active',3,false,16,0,210,'Patricia Guerrero','Miguel Ortiz','Andrea Lara','+593991112233',null,1,null,null,21,6,'Tarjeta del pan',10,'Combo gratis',true,300,0,'#5B3A1E','#FFD60C'),
 (3,'zen','Spa Zen Cumbayá','demo-spa-zen-cumbaya','spa','Quito','Pichincha','pro',300,'active',20,true,5,10,90,'Lucía Salazar','Diana Chávez','Paúl Herrera','+593998877665',null,1,null,null,12,9,'Tarjeta de bienestar',8,'Masaje de 30 min',true,2000,1440,'#1F4D3A','#FFC301'),
 (4,'rizos','Peluquería Rizos y Estilo','demo-peluqueria-rizos-y-estilo','peluqueria','Guayaquil','Guayas','basico',270,'active',-8,false,6,25,85,'Johanna Villamar',null,'Erika Tomalá','+593984561230','Dice que paga a fin de mes.',1,null,null,3,0,'Tarjeta de cortes',8,'Tratamiento gratis',true,1200,1440,'#4A1F5B','#FFC301'),
 (5,'pepe','Tienda Don Pepe','demo-tienda-don-pepe','tienda','Ambato','Tungurahua','basico',240,'active',27,false,9,0,120,'José Naranjo',null,'Rosa Naranjo','+593967894561',null,1,null,null,6,2,'Tarjeta del barrio',10,'$5 de descuento',true,1000,0,'#013565','#FFC301'),
 (6,'parque','Café del Parque','demo-cafe-del-parque','cafeteria','Loja','Loja','standard',200,'active',6,true,13,0,150,'Valeria Espinoza','Andrés Ochoa','Mateo Jiménez','+593978123456',null,1,null,null,18,5,'Tarjeta de cafés',10,'Café gratis',true,250,0,'#3B2416','#FFC301'),
 (7,'montana','CrossFit Montaña','demo-crossfit-montana','gimnasio','Cuenca','Azuay','standard',150,'suspended',-35,false,10,22,75,'Sebastián Moreno','Paola Rivera','Henry Briones','+593995551234','Suspendido por falta de pago. Llamar antes de reactivar.',1,null,20,0,0,'Tarjeta de socio',12,'Clase personalizada',false,0,240,'#111827','#FFC301'),
 (8,'mitad','Flores Mitad del Mundo','demo-flores-mitad-del-mundo','floristeria','Quito','Pichincha','standard',90,'active',58,false,5,0,60,'Carolina Paredes',null,'Mónica Delgado','+593963214785',null,3,null,null,9,4,'Tarjeta de flores',6,'Ramo pequeño gratis',true,1000,0,'#7A2E4D','#FFD60C'),
 (9,'station','Burger Station Samborondón','demo-burger-station-samborondon','restaurante','Samborondón','Guayas','pro',45,'active',15,false,0,0,0,'Diego Cabrera','Ximena Franco','Bryan Ponce','+593993216547','Imprimió el póster pero aún no lo usa.',1,null,null,0,0,'Tarjeta burger',8,'Hamburguesa gratis',true,800,0,'#1A1A1A','#FFC301'),
 (10,'bigote','Barbería El Bigote','demo-barberia-el-bigote','barberia','Machala','El Oro','basico',120,'active',1,false,7,0,70,'Galo Intriago',null,'Wilson Cedeño','+593986543210',null,1,null,null,4,1,'Tarjeta de cortes',10,'Corte gratis',true,500,1440,'#0F172A','#FFC301'),
 (11,'polar','Heladería Polar','demo-heladeria-polar','otro','Manta','Manabí','basico',6,'setup',24,false,0,0,0,'Fabián Alcívar',null,null,'+593981237894',null,1,'stuck',null,0,0,'Tarjeta de sellos',10,'Premio de la casa',true,500,0,'#001D3D','#FFC301'),
 (12,'nuevo','Negocio nuevo','demo-nuevo-pizzeria','otro',null,null,'standard',5,'setup',25,false,0,0,0,'mariela',null,null,null,'Pizzería en Machala, 2 sucursales.',1,'expired',null,0,0,'Tarjeta de sellos',10,'Premio de la casa',true,500,0,'#001D3D','#FFC301');

create temp table demo_biz on commit drop as
select c.*, 'demo_biz_' || c.k as id, t.today,
  t.today - c.age as created_day,
  ((t.today - c.age) + time '10:00') at time zone 'America/Guayaquil' as created_at,
  case when c.status <> 'setup' then ((t.today - c.age + 2) + time '11:30') at time zone 'America/Guayaquil' end as active_from,
  date_trunc('minute', now() - make_interval(days => c.idle) - interval '20 minutes') as active_to,
  case when c.expires_in is not null then t.today + c.expires_in end as exp_day,
  case when c.expires_in is not null then ((t.today + c.expires_in) + time '23:59:59') at time zone 'America/Guayaquil' end as exp_at,
  (case c.plan when 'basico' then 2999 when 'standard' then 5499 else 7999 end) as price,
  'dueno.' || c.k || '@demo.stampaecu.app' as owner_email
from demo_cfg c cross join (select (now() at time zone 'America/Guayaquil')::date as today) t;

/* ---------- 3. Negocios, sucursales, programa y equipo ---------- */
insert into public.businesses (id, name, slug, type, city, province, country, currency, timezone, plan, created_at, status,
  plan_expires_at, suspended_at, setup_completed_at, admin_note, auto_renew, owner_phone)
select id, name, slug, type, city, province, 'EC', 'USD', 'America/Guayaquil', plan, created_at, status,
  exp_at, case when suspended_ago is not null then date_trunc('second', now() - make_interval(days => suspended_ago)) end,
  active_from, note, auto_renew, phone
from demo_biz;

insert into public.locations (id, business_id, name, address, active, created_at)
select 'demo_loc_' || k || '_1', id, 'Principal', coalesce(city, 'Ecuador') || ', centro', true, created_at + interval '1 day'
from demo_biz where coalesce(setup_kind, '') <> 'expired'
union all
select 'demo_loc_' || k || '_2', id, 'Sucursal norte', city || ', norte', true, created_at + interval '3 days'
from demo_biz where plan = 'pro' and status <> 'setup';

insert into public.programs (business_id, name, stamps_required, reward_title, require_amount, min_spend_cents_per_stamp,
  code_ttl_seconds, max_seats_without_approval, cooldown_minutes, colors, logo_text, terms, reward_expires_days)
select id, prog_name, stamps_req, reward, req_amount, min_spend, 300, 4, cooldown,
  jsonb_build_object('bg', bg, 'accent', accent, 'ink', '#FFFFFF'),
  case when setup_kind = 'expired' then 'ST' else upper(left(split_part(name, ' ', 1), 1) || left(split_part(name, ' ', 2), 1)) end,
  'Un sello por visita registrada en caja. Datos de demostración.', 60
from demo_biz;

-- password_hash 'demo$sin-acceso' no es un hash válido: verifyPassword siempre devuelve false (nadie puede entrar).
insert into public.staff (id, business_id, name, role, active, location_id, email, password_hash, created_at)
select 'demo_emp_' || k || '_owner', id, owner_name, 'owner', true,
  case when coalesce(setup_kind, '') <> 'expired' then 'demo_loc_' || k || '_1' end, owner_email,
  case when setup_kind = 'expired' then null else 'demo$sin-acceso' end, created_at
from demo_biz
union all
select 'demo_emp_' || k || '_gerente', id, manager_name, 'manager', true, 'demo_loc_' || k || '_1',
  'gerente.' || k || '@demo.stampaecu.app', 'demo$sin-acceso', created_at + interval '4 days'
from demo_biz where manager_name is not null
union all
select 'demo_emp_' || k || '_caja', id, cashier_name, 'cashier', true, 'demo_loc_' || k || '_1', null, null, created_at + interval '5 days'
from demo_biz where cashier_name is not null;

-- La invitación del negocio 'nuevo' venció hace 2 días (nadie conoce el enlace: el hash es de un valor aleatorio).
insert into public.access_tokens (id, token_hash, staff_id, kind, expires_at, used_at, created_at)
select 'demo_tok_' || k, encode(sha256(convert_to('demo-' || gen_random_uuid()::text, 'UTF8')), 'hex'), 'demo_emp_' || k || '_owner',
  'invite', date_trunc('second', now() - interval '2 days 3 hours'), null, date_trunc('second', now() - interval '5 days 3 hours')
from demo_biz where setup_kind = 'expired';

insert into public.audit_log (id, business_id, staff_id, action, detail, at)
select 'demo_aud_' || k || '_ready', id, 'demo_emp_' || k || '_owner', 'business.ready', name || ' terminó su configuración.', active_from
from demo_biz where active_from is not null;

/* ---------- 4. Clientes (el alta se concentra hacia el final: crecimiento) ---------- */
create temp table demo_cust on commit drop as
select b.id as business_id, b.k, i as seq,
  'demo_cli_' || b.k || '_' || lpad(i::text, 4, '0') as id,
  (fn.a)[1 + ((i * 7 + b.ord * 5) % array_length(fn.a, 1))] || ' ' || (sn.a)[1 + ((i * 11 + b.ord * 3 + i / 7) % array_length(sn.a, 1))] as name,
  date_trunc('second', b.active_from + (b.active_to - b.active_from) * power((i - 0.5) / b.n_cust, 0.7)) as created_at
from demo_biz b
cross join lateral generate_series(1, b.n_cust) i
cross join (select array['María','Andrea','Daniela','Gabriela','Camila','Valeria','Paola','Karla','Fernanda','Estefanía','Carolina','Mónica','Tatiana','Lorena','Verónica','Ximena','Nathaly','Doménica','Juan','Carlos','Luis','José','Diego','Andrés','Kevin','Bryan','Jorge','Wilson','Fabián','Mauricio','Santiago','Esteban','Galo','Patricio','Xavier','Byron','Mateo','Sebastián','Henry','Iván'] as a) fn
cross join (select array['Cevallos','Zambrano','Mero','Villamar','Intriago','Cedeño','Loor','Párraga','Macías','Alcívar','Vera','Quimí','Tomalá','Reyes','Salazar','Calderón','Naranjo','Chávez','Andrade','Pazmiño','Yánez','Villacís','Espinoza','Mora','Burgos','Franco','Ponce','Bravo','Morán','Suárez'] as a) sn
where b.active_from is not null and b.n_cust > 0;

insert into public.customers (id, business_id, name, contact, contact_kind, birthday_d, birthday_m, consent_at, created_at, email_verified_at, wallet)
select id, business_id, name,
  translate(lower(name), 'áéíóúñü ', 'aeiounu.') || '.' || seq || '@demo.stampaecu.app', 'email',
  case when seq % 5 <> 0 then 1 + (seq * 13) % 28 end, case when seq % 5 <> 0 then (seq * 7) % 12 end,
  created_at, created_at, created_at,
  case seq % 4 when 1 then 'google' when 2 then 'apple' end
from demo_cust;

/* ---------- 5. Visitas: un código de un cupo y un sello por visita ---------- */
create temp table demo_visit0 on commit drop as
select b.id as business_id, b.k, b.n_cust, b.active_from, b.active_to, d::date as day,
  ((d::date) + make_interval(hours => 8 + floor(random() * 13)::int, mins => floor(random() * 60)::int, secs => floor(random() * 60)::int))
    at time zone 'America/Guayaquil' as at
from demo_biz b
cross join lateral generate_series(((b.active_from at time zone 'America/Guayaquil')::date + 1)::timestamp, ((b.active_to at time zone 'America/Guayaquil')::date)::timestamp, interval '1 day') d
cross join lateral generate_series(1, floor(
    b.daily
    * (0.35 + 0.65 * ((d::date - (b.active_from at time zone 'America/Guayaquil')::date)::numeric
        / greatest(1, (b.active_to at time zone 'America/Guayaquil')::date - (b.active_from at time zone 'America/Guayaquil')::date)))
    * (array[1.25, 0.75, 0.8, 0.85, 0.95, 1.3, 1.45])[extract(dow from d)::int + 1]   -- fines de semana más altos
    * (0.7 + 0.6 * random()) + random())::int) v
where b.daily > 0 and b.n_cust > 0;

-- Cliente de cada visita: solo los que ya existían a esa hora (los primeros clientes vuelven más). Uno por día.
create temp table demo_visit on commit drop as
select distinct on (business_id, seq, day) business_id, k, day, at, seq
from (
  select v.*, case
      when x.kmax < 1 then null
      when random() < 0.45 then 1 + floor(random() * greatest(1, ceil(x.kmax * 0.3)))::int
      else 1 + floor(random() * x.kmax)::int end as seq
  from demo_visit0 v
  cross join lateral (select floor(v.n_cust * power(greatest(0, least(1,
      extract(epoch from (v.at - v.active_from)) / extract(epoch from (v.active_to - v.active_from)))), 1 / 0.7) + 0.5)::int as kmax) x
  where v.at > v.active_from and v.at < v.active_to
) s
where seq is not null
order by business_id, seq, day, at;

create temp table demo_v on commit drop as
select v.business_id, v.k, v.at, c.id as customer_id, c.name as customer_name,
  row_number() over (partition by v.business_id order by v.at, v.seq) as n
from demo_visit v join demo_cust c on c.business_id = v.business_id and c.seq = v.seq;

insert into public.stamp_codes (id, business_id, location_id, code, ticket, amount_cents, seats, created_by, created_at, expires_at, attempts, live)
select 'demo_cod_' || v.k || '_' || lpad(v.n::text, 5, '0'), v.business_id, 'demo_loc_' || v.k || '_1',
  lpad(floor(random() * 1000000)::int::text, 6, '0'), 'D-' || lpad(v.n::text, 5, '0'),
  case when b.req_amount then b.min_spend + floor(random() * b.min_spend / 5)::int * 5 else 0 end, 1,
  case when b.manager_name is not null and v.n % 3 = 0 then 'demo_emp_' || v.k || '_gerente' else 'demo_emp_' || v.k || '_caja' end,
  v.at - interval '30 seconds', v.at + interval '270 seconds', 0, false
from demo_v v join demo_biz b on b.id = v.business_id;

insert into public.stamp_claims (id, code_id, business_id, customer_id, customer_name, at)
select 'demo_clm_' || k || '_' || lpad(n::text, 5, '0'), 'demo_cod_' || k || '_' || lpad(n::text, 5, '0'), business_id, customer_id, customer_name, at
from demo_v;

/* ---------- 6. Canjes (cada tarjeta completa) y contadores de los clientes ---------- */
insert into public.redemptions (id, business_id, customer_id, customer_name, staff_id, at, reward_title)
select 'demo_can_' || x.k || '_' || lpad((row_number() over (partition by x.business_id order by x.at))::text, 5, '0'),
  x.business_id, x.customer_id, x.customer_name, 'demo_emp_' || x.k || '_caja',
  least(x.at + make_interval(mins => 10 + floor(random() * 1800)::int), now() - interval '5 minutes'), b.reward
from (select v.*, row_number() over (partition by v.customer_id order by v.at) as rn from demo_v v) x
join demo_biz b on b.id = x.business_id
where x.rn % b.stamps_req = 0;

update public.customers c set
  total_stamps = s.n, rewards_redeemed = s.n / b.stamps_req, stamps = s.n % b.stamps_req, last_visit_at = s.last
from (select customer_id, business_id, count(*)::int as n, max(at) as last from demo_v group by 1, 2) s
join demo_biz b on b.id = s.business_id
where c.id = s.customer_id;

-- Una alerta de ticket repetido reciente por negocio con actividad.
insert into public.rejections (id, business_id, kind, staff_id, code_id, ticket, at)
select 'demo_rej_' || v.k, v.business_id, 'duplicate_ticket', 'demo_emp_' || v.k || '_caja',
  'demo_cod_' || v.k || '_' || lpad(v.n::text, 5, '0'), 'D-' || lpad(v.n::text, 5, '0'), least(v.at + interval '2 hours', now() - interval '1 minute')
from (select v.*, max(n) over (partition by business_id) as last_n from demo_v v) v
where v.n = v.last_n - 2;

/* ---------- 7. Pagos: hacia atrás desde el vencimiento, un periodo por pago ---------- */
create temp table demo_pay on commit drop as
select b.id as business_id, b.k, j, b.plan, b.price * b.cycle as amount_cents, b.cycle,
  (b.exp_day - make_interval(months => (j + 1) * b.cycle))::date as from_day,
  (b.exp_day - make_interval(months => j * b.cycle))::date as to_day,
  greatest((b.exp_day - make_interval(months => (j + 1) * b.cycle))::date - floor(random() * 4)::int, b.created_day) as paid_day,
  (array['transferencia','transferencia','transferencia','efectivo','efectivo','tarjeta','otro'])[1 + floor(random() * 7)::int] as method
from demo_biz b cross join generate_series(0, 40) j
where b.exp_day is not null
  and (j = 0 or (b.exp_day - make_interval(months => j * b.cycle))::date > b.created_day + 10);

insert into public.admin_payments (id, business_id, amount_cents, paid_at, plan, months, previous_expires_at, new_expires_at, method, note, created_by, created_at)
select 'demo_pay_' || p.k || '_' || lpad(p.j::text, 2, '0'), p.business_id, p.amount_cents, p.paid_day, p.plan, p.cycle,
  (p.from_day + time '23:59:59') at time zone 'America/Guayaquil', (p.to_day + time '23:59:59') at time zone 'America/Guayaquil',
  p.method, case when p.method = 'otro' then 'Pago por PayPhone.' end,
  (select id from public.platform_admins order by created_at limit 1),
  least((p.paid_day + time '12:00') at time zone 'America/Guayaquil', now() - interval '1 minute')
from demo_pay p
where p.paid_day <= (now() at time zone 'America/Guayaquil')::date;

/* ---------- 8. Historial del admin ---------- */
insert into public.admin_actions (id, business_id, admin_id, kind, detail, created_at)
select a.id, a.business_id, (select id from public.platform_admins order by created_at limit 1), a.kind, a.detail, a.created_at
from (
  select 'demo_act_' || k || '_alta' as id, id as business_id, 'access_created' as kind,
    jsonb_build_object('email', owner_email, 'plan', case when k = 'dulce' then 'basico' else plan end) as detail, created_at
  from demo_biz
  union all
  select 'demo_act_' || k || '_cel', id, 'phone_changed', jsonb_build_object('to', phone), created_at + interval '2 hours' from demo_biz where phone is not null
  union all
  select 'demo_act_' || k || '_nota', id, 'note_changed', '{}'::jsonb, created_at + interval '3 hours' from demo_biz where note is not null
  union all
  select 'demo_act_' || k || '_plan', id, 'plan_changed', jsonb_build_object('from', 'basico', 'to', plan), date_trunc('second', now() - interval '120 days') from demo_biz where k = 'dulce'
  union all
  select 'demo_act_' || k || '_renov', id, 'expiry_changed', jsonb_build_object('autoRenew', true), created_at + interval '1 day' from demo_biz where auto_renew
  union all
  select 'demo_act_' || k || '_susp', id, 'suspended', jsonb_build_object('status', 'suspended'), date_trunc('second', now() - make_interval(days => suspended_ago)) from demo_biz where suspended_ago is not null
  union all
  select 'demo_act_' || k || '_reenvio', id, 'access_resent', jsonb_build_object('kind', 'invite', 'email', owner_email), created_at + interval '2 hours' from demo_biz where setup_kind = 'expired'
  union all
  select 'demo_act_' || p.id, p.business_id, 'payment_recorded',
    jsonb_build_object('paymentId', p.id, 'amountCents', p.amount_cents, 'months', p.months, 'method', p.method,
      'previousExpiresAt', p.previous_expires_at, 'newExpiresAt', p.new_expires_at), p.created_at
  from public.admin_payments p where p.id like 'demo\_pay\_%'
) a;

/* ---------- 9. Uso de IA del mes ---------- */
insert into public.marketing_generations (id, business_id, staff_id, kind, topic, output, model, prompt_tokens, cached_tokens, completion_tokens, created_at)
select 'demo_mkt_' || b.k || '_' || lpad(i::text, 3, '0'), b.id, 'demo_emp_' || b.k || '_owner',
  case when i > b.ai_texts then 'photo_edit' else (array['post','post','data_post','review_reply','calendar'])[1 + (i % 5)] end,
  case when i > b.ai_texts then 'retoque' else 'Promoción de la semana' end, '{}'::jsonb,
  case when i > b.ai_texts then 'fal-ai/bytedance/seedream/v5/lite/edit' else 'deepseek-chat' end,
  case when i > b.ai_texts then 0 else 450 + floor(random() * 500)::int end,
  case when i > b.ai_texts then 0 else 250 + floor(random() * 170)::int end,
  case when i > b.ai_texts then 0 else 500 + floor(random() * 900)::int end,
  m.start + (now() - interval '1 hour' - m.start) * random()
from demo_biz b
cross join lateral generate_series(1, b.ai_texts + b.ai_images) i
cross join (select (date_trunc('month', now() at time zone 'America/Guayaquil')) at time zone 'America/Guayaquil' as start) m
where b.ai_texts + b.ai_images > 0;

commit;

-- Resumen rápido (opcional):
-- select b.name, b.status, b.plan, b.plan_expires_at::date, (select count(*) from stamp_claims s where s.business_id = b.id) sellos
-- from businesses b where b.id like 'demo\_biz\_%' order by b.created_at;
