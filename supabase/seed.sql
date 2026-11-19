-- Datos mínimos para probar contra Supabase (el repo en memoria trae el conjunto completo de ejemplo).
-- PIN de demo: dueño 1234, gerente 2345, cajeros 1111. Ejecutar con `supabase db reset` o pegar en el editor SQL.
-- Los códigos de sello NO se siembran: se crean desde el panel (create_stamp_code) para que las fechas sean vigentes.

insert into public.businesses (id, name, slug, type, city) values
  ('biz_esquina', 'Café La Esquina', 'cafe-la-esquina', 'cafeteria', 'Guayaquil')
on conflict (id) do nothing;

insert into public.locations (id, business_id, name, address) values
  ('loc_esquina_1', 'biz_esquina', 'Principal', 'Av. Víctor Emilio Estrada 1020 y Ebanos, Urdesa'),
  ('loc_esquina_2', 'biz_esquina', 'Mall del Sol', 'Av. Juan Tanca Marengo, local 214')
on conflict (id) do nothing;

insert into public.programs (
  business_id, name, stamps_required, reward_title, reward_description, require_amount, min_spend_cents_per_stamp,
  code_ttl_seconds, max_seats_without_approval, cooldown_minutes, colors, logo_text, birthday_reward
) values (
  'biz_esquina', 'Tarjeta de cafés', 10, 'Café gratis', 'Un café a elección', true, 250, 300, 4, 0,
  '{"bg":"#001D3D","accent":"#D9A86C","ink":"#FFFFFF"}', 'CL', 'Un café de regalo'
) on conflict (business_id) do nothing;

insert into public.staff (id, business_id, name, role, location_id, pin_hash) values
  ('emp_esquina_andrea',  'biz_esquina', 'Andrea Zambrano', 'owner',   'loc_esquina_1', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('emp_esquina_ricardo', 'biz_esquina', 'Ricardo Vera',    'manager', 'loc_esquina_1', extensions.crypt('2345', extensions.gen_salt('bf'))),
  ('emp_esquina_marco',   'biz_esquina', 'Marco',           'cashier', 'loc_esquina_2', extensions.crypt('1111', extensions.gen_salt('bf'))),
  ('emp_esquina_lucia',   'biz_esquina', 'Lucía',           'cashier', 'loc_esquina_1', extensions.crypt('1111', extensions.gen_salt('bf')))
on conflict (id) do nothing;

insert into public.customers (id, business_id, name, contact, contact_kind, birthday_d, birthday_m, stamps, total_stamps) values
  ('cli_esquina_001', 'biz_esquina', 'Daniela Cevallos', '0991234567', 'whatsapp', 14, 10, 3, 3),
  ('cli_esquina_002', 'biz_esquina', 'Kevin Loor', 'kevin.loor@gmail.com', 'email', null, null, 9, 9),
  ('cli_esquina_003', 'biz_esquina', 'Mayra Intriago', '0987654321', 'whatsapp', 2, 11, 10, 10)
on conflict (id) do nothing;

-- Para entrar al panel con un usuario real de Supabase Auth, vincúlalo (reemplaza el uuid):
-- insert into public.staff_members (user_id, business_id, staff_id)
--   values ('00000000-0000-0000-0000-000000000000', 'biz_esquina', 'emp_esquina_andrea');
