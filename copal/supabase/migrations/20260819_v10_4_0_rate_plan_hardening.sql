begin;

alter table public.rate_plan_versions
  add constraint rate_plan_versions_id_plan_unique
  unique (id, rate_plan_id),
  add constraint rate_plan_versions_category_limits
  check (
    (max_adults is null or max_adults <= max_occupancy)
    and (max_children is null or max_children <= max_occupancy)
    and (max_infants is null or max_infants <= max_occupancy)
  ) not valid,
  add constraint rate_plan_versions_fixed_window_units
  check (
    booking_time_model <> 'fixed_window'
    or (min_units = 1 and (max_units is null or max_units = 1))
  ) not valid;

alter table public.rate_plans
  add constraint rate_plans_current_version_belongs_to_plan
  foreign key (current_version_id, id)
  references public.rate_plan_versions (id, rate_plan_id)
  deferrable initially deferred;

alter table public.information_requests
  add constraint information_requests_selected_rate_plan_pair
  check (
    (selected_rate_plan_id is null and selected_rate_plan_version_id is null)
    or
    (selected_rate_plan_id is not null and selected_rate_plan_version_id is not null)
  ),
  add constraint information_requests_rate_version_belongs_to_plan
  foreign key (selected_rate_plan_version_id, selected_rate_plan_id)
  references public.rate_plan_versions (id, rate_plan_id);

create index information_requests_rate_plan_version_idx
  on public.information_requests (selected_rate_plan_version_id);

create or replace function public.save_service_with_primary_rate_plan(
  p_service_id uuid,
  p_expected_service_version_id uuid,
  p_expected_rate_plan_version_id uuid,
  p_service_code text,
  p_category_code text,
  p_is_active boolean,
  p_display_order integer,
  p_name_es text,
  p_name_en text,
  p_description_es text,
  p_description_en text,
  p_amenities_es text[],
  p_amenities_en text[],
  p_booking_time_model text,
  p_pricing_model text,
  p_base_price_cents integer,
  p_included_guests integer,
  p_min_guests integer,
  p_max_occupancy integer,
  p_max_adults integer,
  p_max_children integer,
  p_max_infants integer,
  p_adult_extra_cents integer,
  p_child_extra_cents integer,
  p_infant_extra_cents integer,
  p_supplement_basis text,
  p_min_units integer,
  p_max_units integer,
  p_window_start time,
  p_window_end time,
  p_buffer_before_minutes integer,
  p_buffer_after_minutes integer,
  p_restrictions_es text,
  p_restrictions_en text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service public.services;
  v_price_on_request boolean := p_pricing_model = 'manual_quote';
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_service_id is null then
    select * into v_service
    from public.create_service(
      p_service_code,
      p_category_code,
      p_is_active,
      p_display_order,
      p_name_es,
      p_name_en,
      p_description_es,
      p_description_en,
      'per_night',
      v_price_on_request,
      p_base_price_cents,
      p_included_guests,
      p_max_occupancy,
      p_adult_extra_cents,
      p_child_extra_cents,
      p_amenities_es,
      p_amenities_en
    );
  else
    perform public.create_service_version(
      p_service_id,
      p_expected_service_version_id,
      p_category_code,
      p_is_active,
      p_display_order,
      p_name_es,
      p_name_en,
      p_description_es,
      p_description_en,
      'per_night',
      v_price_on_request,
      p_base_price_cents,
      p_included_guests,
      p_max_occupancy,
      p_adult_extra_cents,
      p_child_extra_cents,
      p_amenities_es,
      p_amenities_en
    );

    select * into v_service
    from public.services
    where id = p_service_id;
  end if;

  perform public.save_primary_rate_plan(
    v_service.id,
    p_expected_rate_plan_version_id,
    p_booking_time_model,
    p_pricing_model,
    p_base_price_cents,
    p_included_guests,
    p_min_guests,
    p_max_occupancy,
    p_max_adults,
    p_max_children,
    p_max_infants,
    p_adult_extra_cents,
    p_child_extra_cents,
    p_infant_extra_cents,
    p_supplement_basis,
    p_min_units,
    p_max_units,
    p_window_start,
    p_window_end,
    p_buffer_before_minutes,
    p_buffer_after_minutes,
    p_restrictions_es,
    p_restrictions_en
  );

  return v_service.id;
end;
$$;

revoke all on function public.save_service_with_primary_rate_plan(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text
) from public;
grant execute on function public.save_service_with_primary_rate_plan(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text
) to authenticated;

drop function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text
);

create function public.create_information_request(
  p_submission_key uuid,
  p_locale text,
  p_customer_name text,
  p_customer_email text,
  p_customer_cellphone text,
  p_checkin_date date,
  p_checkout_date date,
  p_adults integer,
  p_children integer,
  p_infants integer,
  p_rate_plan_id uuid,
  p_customer_message text default null
)
returns table (request_id uuid, request_number bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_service public.services;
  v_service_version public.service_versions;
  v_plan public.rate_plans;
  v_rate public.rate_plan_versions;
  v_service_id uuid;
  v_service_version_id uuid;
  v_plan_id uuid;
  v_rate_id uuid;
  v_name text := btrim(p_customer_name);
  v_email text := lower(btrim(p_customer_email));
  v_cellphone text := btrim(p_customer_cellphone);
  v_message text := nullif(btrim(p_customer_message), '');
  v_units integer;
  v_total_guests integer;
  v_extra_adults integer := 0;
  v_remaining_included integer := 0;
  v_extra_children integer := 0;
  v_supplement_units integer := 1;
  v_estimated_total integer;
  v_pricing_status text;
  v_snapshot jsonb;
  v_created boolean := false;
begin
  if p_submission_key is null then
    raise exception 'Submission key is required';
  end if;

  select * into v_request
  from public.information_requests
  where submission_key = p_submission_key;

  if v_request.id is not null then
    return query select v_request.id, v_request.request_number;
    return;
  end if;

  if p_locale not in ('es', 'en') then
    raise exception 'Unsupported locale';
  end if;

  if char_length(v_name) not between 5 and 100 then
    raise exception 'Customer name is invalid';
  end if;

  if char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'Customer email is invalid';
  end if;

  if char_length(v_cellphone) not between 10 and 25
     or v_cellphone !~ '^\+?[0-9[:space:]().-]+$'
     or char_length(regexp_replace(v_cellphone, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Customer cellphone is invalid';
  end if;

  if p_checkin_date is null or p_checkout_date is null
     or p_checkout_date <= p_checkin_date then
    raise exception 'Stay dates are invalid';
  end if;

  if p_checkin_date < (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Check-in cannot be in the past';
  end if;

  if p_adults not between 1 and 20
     or p_children not between 0 and 20
     or p_infants not between 0 and 20 then
    raise exception 'Guest counts are invalid';
  end if;

  if v_message is not null and char_length(v_message) > 1000 then
    raise exception 'Customer message is too long';
  end if;

  select plan.id, service.id, rate_version.id, service_version.id
    into v_plan_id, v_service_id, v_rate_id, v_service_version_id
  from public.rate_plans plan
  join public.services service
    on service.id = plan.service_id
   and service.is_active
  join public.rate_plan_versions rate_version
    on rate_version.id = plan.current_version_id
   and rate_version.rate_plan_id = plan.id
  join public.service_versions service_version
    on service_version.id = service.current_version_id
   and service_version.service_id = service.id
  where plan.id = p_rate_plan_id
    and plan.is_active
  for share of plan, service;

  if v_rate_id is null then
    raise exception 'Selected rate plan is not available';
  end if;

  select * into v_plan from public.rate_plans where id = v_plan_id;
  select * into v_service from public.services where id = v_service_id;
  select * into v_rate from public.rate_plan_versions where id = v_rate_id;
  select * into v_service_version from public.service_versions where id = v_service_version_id;

  v_total_guests := p_adults + p_children + p_infants;
  if v_total_guests not between v_rate.min_guests and v_rate.max_occupancy
     or (v_rate.max_adults is not null and p_adults > v_rate.max_adults)
     or (v_rate.max_children is not null and p_children > v_rate.max_children)
     or (v_rate.max_infants is not null and p_infants > v_rate.max_infants) then
    raise exception 'Guest count exceeds rate plan limits';
  end if;

  if v_rate.booking_time_model = 'fixed_window'
     and p_checkout_date <> p_checkin_date + 1 then
    raise exception 'Fixed-window services must use one calendar date';
  end if;

  v_units := case v_rate.booking_time_model
    when 'fixed_window' then 1
    when 'calendar_day' then (p_checkout_date - p_checkin_date) + 1
    else p_checkout_date - p_checkin_date
  end;

  if v_units < v_rate.min_units
     or (v_rate.max_units is not null and v_units > v_rate.max_units) then
    raise exception 'Duration is outside rate plan limits';
  end if;

  if v_rate.pricing_model = 'manual_quote' then
    v_pricing_status := 'manual';
    v_estimated_total := null;
  elsif v_rate.pricing_model = 'fixed' then
    v_pricing_status := 'estimated';
    v_estimated_total := v_rate.base_price_cents * v_units;
  else
    v_pricing_status := 'estimated';
    v_extra_adults := greatest(p_adults - v_rate.included_guests, 0);
    v_remaining_included := greatest(v_rate.included_guests - p_adults, 0);
    v_extra_children := greatest(p_children - v_remaining_included, 0);
    v_supplement_units := case
      when v_rate.supplement_basis = 'per_unit' then v_units
      else 1
    end;
    v_estimated_total := (v_rate.base_price_cents * v_units)
      + v_supplement_units * (
        v_extra_adults * v_rate.adult_extra_cents
        + v_extra_children * v_rate.child_extra_cents
        + p_infants * v_rate.infant_extra_cents
      );
  end if;

  v_snapshot := jsonb_build_object(
    'schema_version', 2,
    'calculated_at', now(),
    'pricing_status', v_pricing_status,
    'service', jsonb_build_object(
      'service_id', v_service.id,
      'service_version_id', v_service_version.id,
      'service_code', v_service.service_code,
      'category_code', v_service.category_code,
      'version_number', v_service_version.version_number,
      'name_es', v_service_version.name_es,
      'name_en', v_service_version.name_en
    ),
    'rate_plan', jsonb_build_object(
      'rate_plan_id', v_plan.id,
      'rate_plan_version_id', v_rate.id,
      'rate_code', v_plan.rate_code,
      'version_number', v_rate.version_number,
      'booking_time_model', v_rate.booking_time_model,
      'pricing_model', v_rate.pricing_model,
      'supplement_basis', v_rate.supplement_basis,
      'window_start', v_rate.window_start,
      'window_end', v_rate.window_end,
      'restrictions_es', v_rate.restrictions_es,
      'restrictions_en', v_rate.restrictions_en
    ),
    'stay', jsonb_build_object(
      'checkin', p_checkin_date,
      'checkout', p_checkout_date,
      'units', v_units
    ),
    'occupancy', jsonb_build_object(
      'adults', p_adults,
      'children', p_children,
      'infants', p_infants,
      'total', v_total_guests,
      'min_guests', v_rate.min_guests,
      'max_occupancy', v_rate.max_occupancy,
      'max_adults', v_rate.max_adults,
      'max_children', v_rate.max_children,
      'max_infants', v_rate.max_infants
    ),
    'pricing', jsonb_build_object(
      'currency_code', v_rate.currency_code,
      'base_price_cents', v_rate.base_price_cents,
      'base_total_cents', v_rate.base_price_cents * v_units,
      'included_guests', v_rate.included_guests,
      'adult_extra_cents', v_rate.adult_extra_cents,
      'child_extra_cents', v_rate.child_extra_cents,
      'infant_extra_cents', v_rate.infant_extra_cents,
      'extra_adults', v_extra_adults,
      'extra_children', v_extra_children,
      'extra_infants', p_infants,
      'supplement_units', v_supplement_units,
      'estimated_total_cents', v_estimated_total
    )
  );

  insert into public.information_requests (
    submission_key,
    locale,
    customer_name,
    customer_email,
    customer_cellphone,
    checkin_date,
    checkout_date,
    adults,
    children,
    infants,
    requested_services,
    selected_service_id,
    selected_service_version_id,
    selected_rate_plan_id,
    selected_rate_plan_version_id,
    customer_message,
    pricing_status,
    estimated_total_cents,
    currency_code,
    quote_snapshot
  )
  values (
    p_submission_key,
    p_locale,
    v_name,
    v_email,
    v_cellphone,
    p_checkin_date,
    p_checkout_date,
    p_adults,
    p_children,
    p_infants,
    array[v_service.category_code],
    v_service.id,
    v_service_version.id,
    v_plan.id,
    v_rate.id,
    v_message,
    v_pricing_status,
    v_estimated_total,
    v_rate.currency_code,
    v_snapshot
  )
  on conflict (submission_key) do nothing
  returning * into v_request;

  v_created := v_request.id is not null;
  if not v_created then
    select * into v_request
    from public.information_requests
    where submission_key = p_submission_key;
  else
    insert into public.information_request_status_history (
      information_request_id,
      previous_status,
      new_status,
      actor_type,
      actor_display_name,
      reason
    )
    values (
      v_request.id,
      null,
      'new',
      'visitor',
      'Visitor',
      'Request submitted'
    );
  end if;

  return query select v_request.id, v_request.request_number;
end;
$$;

revoke all on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text
) from public;
grant execute on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text
) to anon, authenticated;

comment on function public.save_service_with_primary_rate_plan(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text
) is 'Atomically versions a service and its primary rate plan.';

comment on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text
) is 'Validates and stores one immutable server-calculated rate-plan quotation.';

commit;
