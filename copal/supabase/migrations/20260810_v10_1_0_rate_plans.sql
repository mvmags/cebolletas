begin;

create table public.rate_plans (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  rate_code text not null check (rate_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, rate_code)
);

create table public.rate_plan_versions (
  id uuid primary key default gen_random_uuid(),
  rate_plan_id uuid not null references public.rate_plans(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  name_es text not null check (char_length(btrim(name_es)) between 1 and 120),
  name_en text not null check (char_length(btrim(name_en)) between 1 and 120),
  booking_time_model text not null check (booking_time_model in ('overnight', 'calendar_day', 'fixed_window')),
  pricing_model text not null check (pricing_model in ('fixed', 'base_plus_guests', 'manual_quote')),
  currency_code text not null default 'MXN' check (currency_code = 'MXN'),
  base_price_cents integer not null default 0 check (base_price_cents >= 0),
  included_guests integer not null default 0 check (included_guests >= 0),
  min_guests integer not null default 1 check (min_guests >= 1),
  max_occupancy integer not null check (max_occupancy >= 1),
  max_adults integer check (max_adults is null or max_adults >= 1),
  max_children integer check (max_children is null or max_children >= 0),
  max_infants integer check (max_infants is null or max_infants >= 0),
  adult_extra_cents integer not null default 0 check (adult_extra_cents >= 0),
  child_extra_cents integer not null default 0 check (child_extra_cents >= 0),
  infant_extra_cents integer not null default 0 check (infant_extra_cents >= 0),
  supplement_basis text not null default 'per_unit' check (supplement_basis in ('per_unit', 'per_reservation')),
  min_units integer not null default 1 check (min_units >= 1),
  max_units integer check (max_units is null or max_units >= min_units),
  window_start time,
  window_end time,
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  restrictions_es text not null default '',
  restrictions_en text not null default '',
  created_at timestamptz not null default now(),
  unique (rate_plan_id, version_number),
  check (included_guests <= max_occupancy),
  check (min_guests <= max_occupancy),
  check (
    (booking_time_model = 'fixed_window' and window_start is not null and window_end is not null and window_start < window_end)
    or (booking_time_model <> 'fixed_window' and window_start is null and window_end is null)
  ),
  check (pricing_model = 'base_plus_guests' or included_guests = 0)
);

alter table public.rate_plans
  add constraint rate_plans_current_version_id_fkey
  foreign key (current_version_id) references public.rate_plan_versions(id) deferrable initially deferred;

create index rate_plans_service_idx on public.rate_plans(service_id, display_order, created_at);
create index rate_plan_versions_plan_idx on public.rate_plan_versions(rate_plan_id, version_number desc);

insert into public.rate_plans (service_id, rate_code, is_active, display_order)
select id, 'standard', is_active, 0 from public.services;

insert into public.rate_plan_versions (
  rate_plan_id, version_number, name_es, name_en, booking_time_model, pricing_model,
  currency_code, base_price_cents, included_guests, min_guests, max_occupancy,
  adult_extra_cents, child_extra_cents, infant_extra_cents, supplement_basis,
  min_units, restrictions_es, restrictions_en
)
select
  plan.id, 1, 'Tarifa estándar', 'Standard rate', 'overnight',
  case when version.price_on_request then 'manual_quote' else 'base_plus_guests' end,
  version.currency_code, version.base_price_cents,
  case when version.price_on_request then 0 else version.included_guests end,
  1, version.max_occupancy, version.adult_extra_cents, version.child_extra_cents,
  version.infant_price_cents, 'per_unit', 1, '', ''
from public.rate_plans plan
join public.services service on service.id = plan.service_id
join public.service_versions version on version.id = service.current_version_id;

update public.rate_plans plan
set current_version_id = version.id
from public.rate_plan_versions version
where version.rate_plan_id = plan.id and version.version_number = 1;

-- Validate the deferred FK and clear its pending trigger events
-- before later ALTER TABLE statements.
set constraints rate_plans_current_version_id_fkey immediate;

alter table public.information_requests
  add column selected_rate_plan_id uuid references public.rate_plans(id),
  add column selected_rate_plan_version_id uuid references public.rate_plan_versions(id);

drop function if exists public.get_active_service_catalog();

create or replace function public.get_active_service_catalog()
returns table (
  service_id uuid, service_version_id uuid, rate_plan_id uuid, rate_plan_version_id uuid,
  service_code text, category_code text, display_order integer,
  name_es text, name_en text, description_es text, description_en text,
  amenities_es text[], amenities_en text[], rate_name_es text, rate_name_en text,
  booking_time_model text, pricing_model text, currency_code text,
  base_price_cents integer, included_guests integer, min_guests integer,
  max_occupancy integer, max_adults integer, max_children integer, max_infants integer,
  adult_extra_cents integer, child_extra_cents integer, infant_extra_cents integer,
  supplement_basis text, min_units integer, max_units integer,
  window_start time, window_end time, buffer_before_minutes integer, buffer_after_minutes integer,
  restrictions_es text, restrictions_en text
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select service.id, service_version.id, plan.id, rate_version.id,
    service.service_code, service.category_code,
    service.display_order * 1000 + plan.display_order,
    service_version.name_es, service_version.name_en,
    service_version.description_es, service_version.description_en,
    service_version.amenities_es, service_version.amenities_en,
    rate_version.name_es, rate_version.name_en,
    rate_version.booking_time_model, rate_version.pricing_model, rate_version.currency_code,
    rate_version.base_price_cents, rate_version.included_guests, rate_version.min_guests,
    rate_version.max_occupancy, rate_version.max_adults, rate_version.max_children, rate_version.max_infants,
    rate_version.adult_extra_cents, rate_version.child_extra_cents, rate_version.infant_extra_cents,
    rate_version.supplement_basis, rate_version.min_units, rate_version.max_units,
    rate_version.window_start, rate_version.window_end,
    rate_version.buffer_before_minutes, rate_version.buffer_after_minutes,
    rate_version.restrictions_es, rate_version.restrictions_en
  from public.services service
  join public.service_versions service_version on service_version.id = service.current_version_id
  join public.rate_plans plan on plan.service_id = service.id and plan.is_active
  join public.rate_plan_versions rate_version on rate_version.id = plan.current_version_id
  where service.is_active
  order by service.display_order, plan.display_order, service.created_at, plan.created_at;
$$;
revoke all on function public.get_active_service_catalog() from public;
grant execute on function public.get_active_service_catalog() to anon, authenticated;

create or replace function public.save_primary_rate_plan(
  p_service_id uuid, p_expected_current_version_id uuid, p_booking_time_model text,
  p_pricing_model text, p_base_price_cents integer, p_included_guests integer,
  p_min_guests integer, p_max_occupancy integer, p_max_adults integer,
  p_max_children integer, p_max_infants integer, p_adult_extra_cents integer,
  p_child_extra_cents integer, p_infant_extra_cents integer, p_supplement_basis text,
  p_min_units integer, p_max_units integer, p_window_start time, p_window_end time,
  p_buffer_before_minutes integer, p_buffer_after_minutes integer,
  p_restrictions_es text, p_restrictions_en text
)
returns public.rate_plan_versions
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan public.rate_plans;
  v_version public.rate_plan_versions;
  v_next integer;
begin
  if not public.is_active_admin() then raise exception 'Administrator access required'; end if;
  select * into v_plan from public.rate_plans
   where service_id = p_service_id and rate_code = 'standard' for update;
  if v_plan.id is null then
    insert into public.rate_plans(service_id, rate_code) values (p_service_id, 'standard') returning * into v_plan;
  elsif v_plan.current_version_id is distinct from p_expected_current_version_id then
    raise exception 'Rate plan version conflict';
  end if;
  select coalesce(max(version_number), 0) + 1 into v_next
    from public.rate_plan_versions where rate_plan_id = v_plan.id;
  insert into public.rate_plan_versions(
    rate_plan_id, version_number, name_es, name_en, booking_time_model, pricing_model,
    base_price_cents, included_guests, min_guests, max_occupancy,
    max_adults, max_children, max_infants, adult_extra_cents, child_extra_cents,
    infant_extra_cents, supplement_basis, min_units, max_units, window_start, window_end,
    buffer_before_minutes, buffer_after_minutes, restrictions_es, restrictions_en
  ) values (
    v_plan.id, v_next, 'Tarifa estándar', 'Standard rate', p_booking_time_model, p_pricing_model,
    p_base_price_cents, p_included_guests, p_min_guests, p_max_occupancy,
    p_max_adults, p_max_children, p_max_infants, p_adult_extra_cents, p_child_extra_cents,
    p_infant_extra_cents, p_supplement_basis, p_min_units, p_max_units, p_window_start, p_window_end,
    p_buffer_before_minutes, p_buffer_after_minutes, btrim(p_restrictions_es), btrim(p_restrictions_en)
  ) returning * into v_version;
  update public.rate_plans set current_version_id = v_version.id, updated_at = now() where id = v_plan.id;
  return v_version;
end;
$$;

alter table public.rate_plans enable row level security;
alter table public.rate_plan_versions enable row level security;
create policy "Active admins read rate plans" on public.rate_plans for select to authenticated using (public.is_active_admin());
create policy "Active admins read rate plan versions" on public.rate_plan_versions for select to authenticated using (public.is_active_admin());
grant select on public.rate_plans, public.rate_plan_versions to authenticated;
revoke all on function public.save_primary_rate_plan(uuid,uuid,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,integer,integer,time,time,integer,integer,text,text) from public;
grant execute on function public.save_primary_rate_plan(uuid,uuid,text,text,integer,integer,integer,integer,integer,integer,integer,integer,integer,integer,text,integer,integer,time,time,integer,integer,text,text) to authenticated;

comment on table public.rate_plans is 'Ways a service is sold; kept separate from the service identity.';
comment on table public.rate_plan_versions is 'Immutable booking, capacity, restriction, and price rules for a rate plan.';

alter function public.create_information_request(uuid,text,text,text,text,date,date,integer,integer,integer,uuid,text)
  rename to create_information_request_legacy_v10_0_1;

create function public.create_information_request(
  p_submission_key uuid, p_locale text, p_customer_name text, p_customer_email text,
  p_customer_cellphone text, p_checkin_date date, p_checkout_date date,
  p_adults integer, p_children integer, p_infants integer, p_service_id uuid,
  p_customer_message text default null
)
returns table (request_id uuid, request_number bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_result record;
  v_request public.information_requests;
  v_plan public.rate_plans;
  v_rate public.rate_plan_versions;
  v_service public.services;
  v_service_version public.service_versions;
  v_units integer;
  v_total_guests integer := p_adults + p_children + p_infants;
  v_extra_adults integer := 0;
  v_extra_children integer := 0;
  v_remaining integer := 0;
  v_supplement_units integer := 1;
  v_total integer;
  v_status text;
  v_snapshot jsonb;
begin
  select * into v_request from public.information_requests where submission_key = p_submission_key;
  if v_request.id is not null then
    return query select v_request.id, v_request.request_number;
    return;
  end if;
  select * into v_plan from public.rate_plans
   where service_id = p_service_id and rate_code = 'standard' and is_active;
  select * into v_rate from public.rate_plan_versions where id = v_plan.current_version_id;
  if v_rate.id is null then raise exception 'Selected rate plan is not available'; end if;
  if v_total_guests not between v_rate.min_guests and v_rate.max_occupancy
    or (v_rate.max_adults is not null and p_adults > v_rate.max_adults)
    or (v_rate.max_children is not null and p_children > v_rate.max_children)
    or (v_rate.max_infants is not null and p_infants > v_rate.max_infants) then
    raise exception 'Guest count exceeds rate plan limits';
  end if;
  v_units := case v_rate.booking_time_model
    when 'fixed_window' then 1
    when 'calendar_day' then (p_checkout_date - p_checkin_date) + 1
    else p_checkout_date - p_checkin_date end;
  if v_units < v_rate.min_units or (v_rate.max_units is not null and v_units > v_rate.max_units) then
    raise exception 'Duration is outside rate plan limits';
  end if;

  select * into v_result
    from public.create_information_request_legacy_v10_0_1(
      p_submission_key,
      p_locale,
      p_customer_name,
      p_customer_email,
      p_customer_cellphone,
      p_checkin_date,
      p_checkout_date,
      p_adults,
      p_children,
      p_infants,
      p_service_id,
      p_customer_message
    );
  select * into v_request from public.information_requests where id = v_result.request_id;
  select * into v_service from public.services where id = p_service_id;
  select * into v_service_version from public.service_versions where id = v_service.current_version_id;

  if v_rate.pricing_model = 'manual_quote' then
    v_status := 'manual'; v_total := null;
  elsif v_rate.pricing_model = 'fixed' then
    v_status := 'estimated'; v_total := v_rate.base_price_cents * v_units;
  else
    v_status := 'estimated';
    v_extra_adults := greatest(p_adults - v_rate.included_guests, 0);
    v_remaining := greatest(v_rate.included_guests - p_adults, 0);
    v_extra_children := greatest(p_children - v_remaining, 0);
    v_supplement_units := case when v_rate.supplement_basis = 'per_unit' then v_units else 1 end;
    v_total := v_rate.base_price_cents * v_units + v_supplement_units * (
      v_extra_adults * v_rate.adult_extra_cents
      + v_extra_children * v_rate.child_extra_cents
      + p_infants * v_rate.infant_extra_cents);
  end if;

  v_snapshot := jsonb_build_object(
    'schema_version', 2, 'calculated_at', now(), 'pricing_status', v_status,
    'service', jsonb_build_object(
      'service_id', v_service.id, 'service_version_id', v_service_version.id,
      'service_code', v_service.service_code, 'category_code', v_service.category_code,
      'version_number', v_service_version.version_number,
      'name_es', v_service_version.name_es, 'name_en', v_service_version.name_en),
    'rate_plan', jsonb_build_object(
      'rate_plan_id', v_plan.id, 'rate_plan_version_id', v_rate.id,
      'rate_code', v_plan.rate_code, 'version_number', v_rate.version_number,
      'booking_time_model', v_rate.booking_time_model, 'pricing_model', v_rate.pricing_model,
      'supplement_basis', v_rate.supplement_basis,
      'window_start', v_rate.window_start, 'window_end', v_rate.window_end,
      'restrictions_es', v_rate.restrictions_es, 'restrictions_en', v_rate.restrictions_en),
    'stay', jsonb_build_object('checkin', p_checkin_date, 'checkout', p_checkout_date, 'units', v_units),
    'occupancy', jsonb_build_object('adults',p_adults,'children',p_children,'infants',p_infants,
      'total',v_total_guests,'min_guests',v_rate.min_guests,'max_occupancy',v_rate.max_occupancy),
    'pricing', jsonb_build_object('currency_code','MXN','base_price_cents',v_rate.base_price_cents,
      'included_guests',v_rate.included_guests,'adult_extra_cents',v_rate.adult_extra_cents,
      'child_extra_cents',v_rate.child_extra_cents,'infant_extra_cents',v_rate.infant_extra_cents,
      'extra_adults',v_extra_adults,'extra_children',v_extra_children,
      'estimated_total_cents',v_total)
  );
  update public.information_requests set
    selected_rate_plan_id = v_plan.id, selected_rate_plan_version_id = v_rate.id,
    pricing_status = v_status, estimated_total_cents = v_total, quote_snapshot = v_snapshot
  where id = v_request.id;
  return query select v_request.id, v_request.request_number;
end;
$$;

revoke all on function public.create_information_request_legacy_v10_0_1(uuid,text,text,text,text,date,date,integer,integer,integer,uuid,text) from public;
revoke all on function public.create_information_request(uuid,text,text,text,text,date,date,integer,integer,integer,uuid,text) from public;
grant execute on function public.create_information_request(uuid,text,text,text,text,date,date,integer,integer,integer,uuid,text) to anon, authenticated;

commit;
