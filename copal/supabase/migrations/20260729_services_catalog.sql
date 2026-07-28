begin;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  service_code text not null unique
    check (service_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category_code text not null
    check (category_code in ('copal', 'camping', 'events')),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name_es text not null check (char_length(btrim(name_es)) between 1 and 120),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 120),
  description_es text not null check (char_length(btrim(description_es)) between 1 and 1200),
  description_en text not null check (char_length(btrim(description_en)) between 1 and 1200),
  pricing_unit text not null
    check (pricing_unit in ('per_night', 'per_person', 'per_person_night', 'fixed')),
  price_on_request boolean not null default false,
  currency_code text not null default 'MXN' check (currency_code = 'MXN'),
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  included_guests integer not null default 0 check (included_guests >= 0),
  max_occupancy integer not null check (max_occupancy > 0),
  adult_extra_cents integer not null default 0 check (adult_extra_cents >= 0),
  child_extra_cents integer not null default 0 check (child_extra_cents >= 0),
  infant_price_cents integer not null default 0 check (infant_price_cents = 0),
  child_min_age integer not null default 3 check (child_min_age = 3),
  child_max_age integer not null default 12 check (child_max_age = 12),
  adult_min_age integer not null default 13 check (adult_min_age = 13),
  amenities_es text[] not null default '{}',
  amenities_en text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (service_id, version_number),
  check (included_guests <= max_occupancy)
);

alter table public.services
  add column current_version_id uuid;

alter table public.services
  add constraint services_current_version_id_fkey
  foreign key (current_version_id)
  references public.service_versions(id)
  on delete set null;

create index services_display_order_idx
  on public.services (display_order, created_at);

create index service_versions_service_id_idx
  on public.service_versions (service_id, version_number desc);

create trigger services_touch_updated_at
before update on public.services
for each row execute function public.touch_updated_at();

create or replace function public.create_service(
  p_service_code text,
  p_category_code text,
  p_is_active boolean,
  p_display_order integer,
  p_name_es text,
  p_name_en text,
  p_description_es text,
  p_description_en text,
  p_pricing_unit text,
  p_price_on_request boolean,
  p_base_price_cents integer,
  p_included_guests integer,
  p_max_occupancy integer,
  p_adult_extra_cents integer,
  p_child_extra_cents integer,
  p_amenities_es text[],
  p_amenities_en text[]
)
returns public.services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_version_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  insert into public.services (
    service_code, category_code, is_active, display_order
  )
  values (
    btrim(lower(p_service_code)),
    p_category_code,
    coalesce(p_is_active, true),
    coalesce(p_display_order, 0)
  )
  returning * into v_service;

  insert into public.service_versions (
    service_id, version_number, name_es, name_en,
    description_es, description_en, pricing_unit, price_on_request,
    base_price_cents, included_guests, max_occupancy,
    adult_extra_cents, child_extra_cents,
    amenities_es, amenities_en, created_by
  )
  values (
    v_service.id, 1, btrim(p_name_es), btrim(p_name_en),
    btrim(p_description_es), btrim(p_description_en),
    p_pricing_unit, coalesce(p_price_on_request, false),
    coalesce(p_base_price_cents, 0),
    coalesce(p_included_guests, 0),
    p_max_occupancy,
    coalesce(p_adult_extra_cents, 0),
    coalesce(p_child_extra_cents, 0),
    coalesce(p_amenities_es, '{}'),
    coalesce(p_amenities_en, '{}'),
    auth.uid()
  )
  returning id into v_version_id;

  update public.services
     set current_version_id = v_version_id
   where id = v_service.id
  returning * into v_service;

  return v_service;
end;
$$;

create or replace function public.create_service_version(
  p_service_id uuid,
  p_expected_current_version_id uuid,
  p_category_code text,
  p_is_active boolean,
  p_display_order integer,
  p_name_es text,
  p_name_en text,
  p_description_es text,
  p_description_en text,
  p_pricing_unit text,
  p_price_on_request boolean,
  p_base_price_cents integer,
  p_included_guests integer,
  p_max_occupancy integer,
  p_adult_extra_cents integer,
  p_child_extra_cents integer,
  p_amenities_es text[],
  p_amenities_en text[]
)
returns public.service_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_version public.service_versions;
  v_next_version integer;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
  for update;

  if v_service.id is null then
    raise exception 'Service not found';
  end if;

  if p_expected_current_version_id is distinct from v_service.current_version_id then
    raise exception 'Version conflict: reload the catalog before editing';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
  from public.service_versions
  where service_id = p_service_id;

  insert into public.service_versions (
    service_id, version_number, name_es, name_en,
    description_es, description_en, pricing_unit, price_on_request,
    base_price_cents, included_guests, max_occupancy,
    adult_extra_cents, child_extra_cents,
    amenities_es, amenities_en, created_by
  )
  values (
    p_service_id, v_next_version, btrim(p_name_es), btrim(p_name_en),
    btrim(p_description_es), btrim(p_description_en),
    p_pricing_unit, coalesce(p_price_on_request, false),
    coalesce(p_base_price_cents, 0),
    coalesce(p_included_guests, 0),
    p_max_occupancy,
    coalesce(p_adult_extra_cents, 0),
    coalesce(p_child_extra_cents, 0),
    coalesce(p_amenities_es, '{}'),
    coalesce(p_amenities_en, '{}'),
    auth.uid()
  )
  returning * into v_version;

  update public.services
     set category_code = p_category_code,
         is_active = p_is_active,
         display_order = coalesce(p_display_order, display_order),
         current_version_id = v_version.id
   where id = p_service_id;

  return v_version;
end;
$$;

create or replace function public.set_service_active(
  p_service_id uuid,
  p_is_active boolean
)
returns public.services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.services
     set is_active = p_is_active
   where id = p_service_id
  returning * into v_service;

  if v_service.id is null then
    raise exception 'Service not found';
  end if;

  return v_service;
end;
$$;

create or replace function public.delete_service(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referenced boolean := false;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if to_regclass('public.booking_service_items') is not null then
    execute $query$
      select exists (
        select 1
        from public.booking_service_items item
        join public.service_versions version
          on version.id = item.service_version_id
        where version.service_id = $1
      )
    $query$
    into v_referenced
    using p_service_id;
  end if;

  if v_referenced then
    raise exception 'Service is referenced by a booking and cannot be deleted';
  end if;

  update public.services
     set current_version_id = null
   where id = p_service_id;

  delete from public.services
  where id = p_service_id;

  if not found then
    raise exception 'Service not found';
  end if;
end;
$$;

create or replace function public.calculate_service_price(
  p_service_version_id uuid,
  p_adults integer,
  p_children integer,
  p_infants integer
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_version public.service_versions;
  v_total_people integer;
  v_extra_adults integer;
  v_remaining_included integer;
  v_extra_children integer;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if least(p_adults, p_children, p_infants) < 0 then
    raise exception 'Guest counts cannot be negative';
  end if;

  select * into v_version
  from public.service_versions
  where id = p_service_version_id;

  if v_version.id is null then
    raise exception 'Service version not found';
  end if;

  if v_version.price_on_request then
    raise exception 'This service requires a manual price';
  end if;

  v_total_people := p_adults + p_children + p_infants;
  if v_total_people > v_version.max_occupancy then
    raise exception 'Guest count exceeds service capacity';
  end if;

  v_extra_adults := greatest(p_adults - v_version.included_guests, 0);
  v_remaining_included := greatest(v_version.included_guests - p_adults, 0);
  v_extra_children := greatest(p_children - v_remaining_included, 0);

  return v_version.base_price_cents
    + (v_extra_adults * v_version.adult_extra_cents)
    + (v_extra_children * v_version.child_extra_cents);
end;
$$;

alter table public.services enable row level security;
alter table public.service_versions enable row level security;

create policy "Active admins read services"
on public.services for select
to authenticated
using (public.is_active_admin());

create policy "Active admins read service versions"
on public.service_versions for select
to authenticated
using (public.is_active_admin());

revoke all on public.services from anon, authenticated;
revoke all on public.service_versions from anon, authenticated;
grant select on public.services to authenticated;
grant select on public.service_versions to authenticated;

revoke all on function public.create_service(
  text, text, boolean, integer, text, text, text, text, text, boolean,
  integer, integer, integer, integer, integer, text[], text[]
) from public;
revoke all on function public.create_service_version(
  uuid, uuid, text, boolean, integer, text, text, text, text, text, boolean,
  integer, integer, integer, integer, integer, text[], text[]
) from public;
revoke all on function public.set_service_active(uuid, boolean) from public;
revoke all on function public.delete_service(uuid) from public;
revoke all on function public.calculate_service_price(uuid, integer, integer, integer) from public;

grant execute on function public.create_service(
  text, text, boolean, integer, text, text, text, text, text, boolean,
  integer, integer, integer, integer, integer, text[], text[]
) to authenticated;
grant execute on function public.create_service_version(
  uuid, uuid, text, boolean, integer, text, text, text, text, text, boolean,
  integer, integer, integer, integer, integer, text[], text[]
) to authenticated;
grant execute on function public.set_service_active(uuid, boolean) to authenticated;
grant execute on function public.delete_service(uuid) to authenticated;
grant execute on function public.calculate_service_price(uuid, integer, integer, integer) to authenticated;

insert into public.services (
  service_code, category_code, is_active, display_order
)
values
  ('container-lodging', 'copal', true, 10),
  ('camping-near-copal-container', 'copal', true, 20)
on conflict (service_code) do nothing;

insert into public.service_versions (
  service_id, version_number, name_es, name_en,
  description_es, description_en, pricing_unit, price_on_request,
  base_price_cents, included_guests, max_occupancy,
  adult_extra_cents, child_extra_cents,
  amenities_es, amenities_en
)
select
  service.id,
  1,
  seed.name_es,
  seed.name_en,
  seed.description_es,
  seed.description_en,
  'per_night',
  false,
  seed.base_price_cents,
  seed.included_guests,
  seed.max_occupancy,
  seed.adult_extra_cents,
  seed.child_extra_cents,
  seed.amenities_es,
  seed.amenities_en
from (
  values
    (
      'container-lodging',
      'Hospedaje en contenedor',
      'Container lodging',
      'Pasa la noche en nuestra zona privada de glamping rodeada de naturaleza. El contenedor puede alojar hasta seis personas, con espacio adicional para acampar al aire libre previa solicitud.',
      'Spend the night in our private glamping area surrounded by nature. The container can accommodate up to six overnight guests, with additional outdoor camping available upon request.',
      120000, 3, 6, 50000, 35000,
      array[
        'Acceso a puentes colgantes y senderos',
        'Área reservada',
        'Fogatero',
        'Cama queen size y sofá cama para dos personas dentro del contenedor',
        'Asador',
        'Mesas tipo picnic para hasta 16 personas',
        'Estacionamiento'
      ]::text[],
      array[
        'Access to suspension bridges and trails',
        'Reserved area',
        'Fire pit',
        'Queen-size bed and a two-person sofa bed inside the container',
        'Grill',
        'Picnic-style tables for up to 16 people',
        'Parking area'
      ]::text[]
    ),
    (
      'camping-near-copal-container',
      'Campamento cerca del contenedor Copal',
      'Camping near the Copal container',
      'Pasa la noche acampando en una zona natural reservada cerca del contenedor Cebolletas Copal. El área puede recibir grupos de hasta 20 personas e incluye acceso a amenidades exteriores compartidas.',
      'Spend the night camping in a reserved natural area near the Cebolletas Copal container. The camping area can accommodate groups of up to 20 people and includes access to shared outdoor amenities.',
      70000, 2, 20, 35000, 25000,
      array[
        'Acceso a puentes colgantes y senderos',
        'Área reservada',
        'Fogatero',
        'Asador',
        'Mesas tipo picnic para hasta 16 personas',
        'Estacionamiento',
        'Área techada'
      ]::text[],
      array[
        'Access to suspension bridges and trails',
        'Reserved area',
        'Fire pit',
        'Grill',
        'Picnic-style tables for up to 16 people',
        'Parking area',
        'Covered area'
      ]::text[]
    )
) as seed (
  service_code, name_es, name_en, description_es, description_en,
  base_price_cents, included_guests, max_occupancy,
  adult_extra_cents, child_extra_cents, amenities_es, amenities_en
)
join public.services service
  on service.service_code = seed.service_code
where not exists (
  select 1
  from public.service_versions version
  where version.service_id = service.id
);

update public.services service
set current_version_id = (
  select version.id
  from public.service_versions version
  where version.service_id = service.id
  order by version.version_number desc
  limit 1
)
where service.current_version_id is null;

comment on table public.service_versions is
  'Immutable catalog snapshots. Booking-specific percentage discounts, fixed discounts, or manually agreed totals must reference a version without modifying it.';

commit;
