-- Local-only development fixtures. Supabase does not apply seed.sql to hosted
-- projects during `db push`; it is used by `supabase db reset` locally.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
(
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'admin@cebolletas.local',
  extensions.crypt('CebolletasLocal!1070', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Administración local"}'::jsonb,
  now(), now(), '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000002',
  'authenticated', 'authenticated', 'viewer@cebolletas.local',
  extensions.crypt('CebolletasLocal!1070', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Consulta local"}'::jsonb,
  now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
(
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '{"sub":"10000000-0000-4000-8000-000000000001","email":"admin@cebolletas.local","email_verified":true,"phone_verified":false}'::jsonb,
  'email', now(), now(), now()
),
(
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '{"sub":"10000000-0000-4000-8000-000000000002","email":"viewer@cebolletas.local","email_verified":true,"phone_verified":false}'::jsonb,
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;

insert into public.admin_profiles (user_id, display_name, role, active)
values
  ('10000000-0000-4000-8000-000000000001', 'Administración local', 'admin', true),
  ('10000000-0000-4000-8000-000000000002', 'Consulta local', 'viewer', true)
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role,
    active = excluded.active;

insert into public.whatsapp_recipients (id, display_name, phone_e164, is_active)
values (
  '20000000-0000-4000-8000-000000000001',
  'Cebolletas local',
  '+524490000000',
  true
)
on conflict (id) do nothing;

update public.management_settings
set default_whatsapp_recipient_id = '20000000-0000-4000-8000-000000000001',
    updated_at = now()
where singleton;

insert into public.services (id, service_code, category_code, is_active, display_order)
values (
  '30000000-0000-4000-8000-000000000001',
  'hospedaje-local-v107',
  'copal',
  true,
  10
)
on conflict (id) do nothing;

insert into public.service_versions (
  id, service_id, version_number, name_es, name_en,
  description_es, description_en, pricing_unit, price_on_request,
  base_price_cents, included_guests, max_occupancy,
  adult_extra_cents, child_extra_cents, amenities_es, amenities_en, created_by
)
values (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  1,
  'Hospedaje local v10.7',
  'Local lodging v10.7',
  'Servicio de prueba local para validar solicitudes, pagos y recibos.',
  'Local test service for validating requests, payments, and receipts.',
  'per_night', false, 200000, 4, 10, 50000, 25000,
  array['Acceso a senderos', 'Área reservada', 'Estacionamiento'],
  array['Trail access', 'Reserved area', 'Parking'],
  '10000000-0000-4000-8000-000000000001'
)
on conflict (id) do nothing;

update public.services
set current_version_id = '31000000-0000-4000-8000-000000000001'
where id = '30000000-0000-4000-8000-000000000001';

insert into public.rate_plans (id, service_id, rate_code, is_active, display_order)
values (
  '32000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'standard',
  true,
  10
)
on conflict (id) do nothing;

insert into public.rate_plan_versions (
  id, rate_plan_id, version_number, name_es, name_en,
  booking_time_model, pricing_model, base_price_cents, included_guests,
  min_guests, max_occupancy, max_adults, max_children, max_infants,
  adult_extra_cents, child_extra_cents, infant_extra_cents,
  supplement_basis, min_units, max_units, restrictions_es, restrictions_en,
  availability_model
)
values (
  '33000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  1,
  'Tarifa local estándar',
  'Standard local rate',
  'overnight', 'base_plus_guests', 200000, 4,
  1, 10, 10, 10, 10,
  50000, 25000, 0,
  'per_unit', 1, 7,
  'Prueba local: no representa una reservación real.',
  'Local test only: this is not a real reservation.',
  'open_calendar'
)
on conflict (id) do nothing;

update public.rate_plans
set current_version_id = '33000000-0000-4000-8000-000000000001'
where id = '32000000-0000-4000-8000-000000000001';

select * from public.create_information_request(
  p_submission_key => '40000000-0000-4000-8000-000000000001',
  p_locale => 'es',
  p_customer_name => 'Cliente de prueba local',
  p_customer_email => 'cliente@cebolletas.local',
  p_customer_cellphone => '+524491111111',
  p_checkin_date => (now() at time zone 'America/Mexico_City')::date + 30,
  p_checkout_date => (now() at time zone 'America/Mexico_City')::date + 32,
  p_adults => 2,
  p_children => 1,
  p_infants => 0,
  p_rate_plan_id => '32000000-0000-4000-8000-000000000001',
  p_customer_message => 'Solicitud local preparada para probar pagos y recibos.'
);
