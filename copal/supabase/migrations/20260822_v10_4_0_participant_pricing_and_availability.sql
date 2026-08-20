begin;

alter table public.rate_plan_versions
  drop constraint rate_plan_versions_pricing_model_check,
  add constraint rate_plan_versions_pricing_model_check
    check (pricing_model in ('fixed', 'base_plus_guests', 'per_person', 'manual_quote')),
  add column availability_model text not null default 'open_calendar'
    check (availability_model in ('open_calendar', 'specific_dates')),
  add column person_price_cents integer check (person_price_cents is null or person_price_cents >= 0),
  add column adult_price_cents integer check (adult_price_cents is null or adult_price_cents >= 0),
  add column child_price_cents integer check (child_price_cents is null or child_price_cents >= 0),
  add column infant_price_cents integer check (infant_price_cents is null or infant_price_cents >= 0);

create table public.rate_plan_available_dates (
  rate_plan_version_id uuid not null references public.rate_plan_versions(id) on delete cascade,
  available_date date not null,
  created_at timestamptz not null default now(),
  primary key (rate_plan_version_id, available_date)
);

create index rate_plan_available_dates_date_idx
  on public.rate_plan_available_dates (available_date, rate_plan_version_id);

alter table public.rate_plan_available_dates enable row level security;
create policy "Active admins read rate plan available dates"
  on public.rate_plan_available_dates for select to authenticated
  using (public.is_active_admin());
grant select on public.rate_plan_available_dates to authenticated;

drop function public.get_active_service_catalog();
create function public.get_active_service_catalog()
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
  restrictions_es text, restrictions_en text,
  availability_model text, available_dates date[], person_price_cents integer,
  adult_price_cents integer, child_price_cents integer, infant_price_cents integer
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
    rate_version.restrictions_es, rate_version.restrictions_en,
    rate_version.availability_model,
    coalesce(dates.available_dates, '{}'::date[]),
    rate_version.person_price_cents, rate_version.adult_price_cents,
    rate_version.child_price_cents, rate_version.infant_price_cents
  from public.services service
  join public.service_versions service_version on service_version.id = service.current_version_id
  join public.rate_plans plan on plan.service_id = service.id and plan.is_active
  join public.rate_plan_versions rate_version on rate_version.id = plan.current_version_id
  left join lateral (
    select array_agg(item.available_date order by item.available_date) as available_dates
    from public.rate_plan_available_dates item
    where item.rate_plan_version_id = rate_version.id
  ) dates on true
  where service.is_active
    and (
      rate_version.availability_model = 'open_calendar'
      or exists (
        select 1 from public.rate_plan_available_dates available
        where available.rate_plan_version_id = rate_version.id
          and available.available_date >= (now() at time zone 'America/Mexico_City')::date
      )
    )
  order by service.display_order, plan.display_order, service.created_at, plan.created_at;
$$;
revoke all on function public.get_active_service_catalog() from public;
grant execute on function public.get_active_service_catalog() to anon, authenticated;

create function public.save_service_with_primary_rate_plan_v2(
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
  p_restrictions_en text,
  p_availability_model text,
  p_available_dates date[],
  p_person_price_cents integer,
  p_adult_price_cents integer,
  p_child_price_cents integer,
  p_infant_price_cents integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service_id uuid;
  v_rate_version_id uuid;
  v_dates date[];
begin
  if not public.is_active_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_availability_model not in ('open_calendar', 'specific_dates') then
    raise exception 'Unsupported availability model';
  end if;

  select coalesce(array_agg(value order by value), '{}'::date[])
    into v_dates
  from (
    select distinct value
    from unnest(coalesce(p_available_dates, '{}'::date[])) value
    where value is not null
  ) normalized_dates;

  if p_availability_model = 'specific_dates' and cardinality(v_dates) = 0 then
    raise exception 'At least one available date is required';
  elsif p_availability_model = 'open_calendar' and cardinality(v_dates) > 0 then
    raise exception 'Open-calendar rate plans cannot contain specific dates';
  end if;

  if p_pricing_model = 'per_person' then
    if p_person_price_cents is null
       and p_adult_price_cents is null
       and p_child_price_cents is null
       and p_infant_price_cents is null then
      raise exception 'At least one participant price is required';
    end if;
    if coalesce(p_person_price_cents, 0) < 0
       or coalesce(p_adult_price_cents, 0) < 0
       or coalesce(p_child_price_cents, 0) < 0
       or coalesce(p_infant_price_cents, 0) < 0 then
      raise exception 'Participant prices cannot be negative';
    end if;
  end if;

  select public.save_service_with_primary_rate_plan(
    p_service_id,
    p_expected_service_version_id,
    p_expected_rate_plan_version_id,
    p_service_code,
    p_category_code,
    p_is_active,
    p_display_order,
    p_name_es,
    p_name_en,
    p_description_es,
    p_description_en,
    p_amenities_es,
    p_amenities_en,
    p_booking_time_model,
    p_pricing_model,
    case when p_pricing_model = 'per_person' then 0 else p_base_price_cents end,
    case when p_pricing_model = 'per_person' then 0 else p_included_guests end,
    p_min_guests,
    p_max_occupancy,
    p_max_adults,
    p_max_children,
    p_max_infants,
    case when p_pricing_model = 'per_person' then 0 else p_adult_extra_cents end,
    case when p_pricing_model = 'per_person' then 0 else p_child_extra_cents end,
    case when p_pricing_model = 'per_person' then 0 else p_infant_extra_cents end,
    p_supplement_basis,
    p_min_units,
    p_max_units,
    p_window_start,
    p_window_end,
    p_buffer_before_minutes,
    p_buffer_after_minutes,
    p_restrictions_es,
    p_restrictions_en
  ) into v_service_id;

  select plan.current_version_id into v_rate_version_id
  from public.rate_plans plan
  where plan.service_id = v_service_id and plan.rate_code = 'standard';

  update public.rate_plan_versions
  set availability_model = p_availability_model,
      person_price_cents = case when p_pricing_model = 'per_person' then p_person_price_cents end,
      adult_price_cents = case when p_pricing_model = 'per_person' then p_adult_price_cents end,
      child_price_cents = case when p_pricing_model = 'per_person' then p_child_price_cents end,
      infant_price_cents = case when p_pricing_model = 'per_person' then p_infant_price_cents end
  where id = v_rate_version_id;

  if p_availability_model = 'specific_dates' then
    insert into public.rate_plan_available_dates (rate_plan_version_id, available_date)
    select v_rate_version_id, value from unnest(v_dates) value;
  end if;

  return v_service_id;
end;
$$;

revoke all on function public.save_service_with_primary_rate_plan_v2(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text, text, date[], integer, integer, integer, integer
) from public;
grant execute on function public.save_service_with_primary_rate_plan_v2(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text, text, date[], integer, integer, integer, integer
) to authenticated;

create function public.enforce_information_request_rate_model_v10_4()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate public.rate_plan_versions;
  v_available_dates date[];
  v_units integer;
  v_adult_price integer;
  v_child_price integer;
  v_infant_price integer;
  v_adult_total integer;
  v_child_total integer;
  v_infant_total integer;
begin
  if new.selected_rate_plan_version_id is null then
    return new;
  end if;

  select * into v_rate
  from public.rate_plan_versions
  where id = new.selected_rate_plan_version_id;

  select coalesce(array_agg(item.available_date order by item.available_date), '{}'::date[])
    into v_available_dates
  from public.rate_plan_available_dates item
  where item.rate_plan_version_id = v_rate.id;

  if v_rate.availability_model = 'specific_dates'
     and not (new.checkin_date = any(v_available_dates)) then
    raise exception 'Selected date is not available for this rate plan';
  end if;

  new.quote_snapshot := jsonb_set(
    new.quote_snapshot,
    '{rate_plan}',
    coalesce(new.quote_snapshot->'rate_plan', '{}'::jsonb) || jsonb_build_object(
      'availability_model', v_rate.availability_model,
      'available_dates', v_available_dates,
      'person_price_cents', v_rate.person_price_cents,
      'adult_price_cents', v_rate.adult_price_cents,
      'child_price_cents', v_rate.child_price_cents,
      'infant_price_cents', v_rate.infant_price_cents
    )
  );

  if v_rate.pricing_model <> 'per_person' then
    return new;
  end if;

  v_units := case v_rate.booking_time_model
    when 'fixed_window' then 1
    when 'calendar_day' then (new.checkout_date - new.checkin_date) + 1
    else new.checkout_date - new.checkin_date
  end;
  v_adult_price := coalesce(v_rate.adult_price_cents, v_rate.person_price_cents, 0);
  v_child_price := coalesce(v_rate.child_price_cents, v_rate.person_price_cents, 0);
  v_infant_price := coalesce(v_rate.infant_price_cents, v_rate.person_price_cents, 0);
  v_adult_total := new.adults * v_adult_price * v_units;
  v_child_total := new.children * v_child_price * v_units;
  v_infant_total := new.infants * v_infant_price * v_units;

  new.pricing_status := 'estimated';
  new.estimated_total_cents := v_adult_total + v_child_total + v_infant_total;
  new.quote_snapshot := jsonb_set(
    new.quote_snapshot,
    '{pricing}',
    jsonb_build_object(
      'currency_code', v_rate.currency_code,
      'pricing_model', 'per_person',
      'person_price_cents', v_rate.person_price_cents,
      'adult_price_cents', v_adult_price,
      'child_price_cents', v_child_price,
      'infant_price_cents', v_infant_price,
      'adult_total_cents', v_adult_total,
      'child_total_cents', v_child_total,
      'infant_total_cents', v_infant_total,
      'units', v_units,
      'estimated_total_cents', new.estimated_total_cents
    )
  );
  return new;
end;
$$;

create trigger enforce_information_request_rate_model_v10_4
before insert on public.information_requests
for each row execute function public.enforce_information_request_rate_model_v10_4();

comment on table public.rate_plan_available_dates is
  'Versioned dates on which a specific-date rate plan may start.';
comment on function public.save_service_with_primary_rate_plan_v2(
  uuid, uuid, uuid, text, text, boolean, integer,
  text, text, text, text, text[], text[], text, text,
  integer, integer, integer, integer, integer, integer, integer,
  integer, integer, integer, text, integer, integer, time, time,
  integer, integer, text, text, text, date[], integer, integer, integer, integer
) is 'Atomically versions a service, participant prices, and optional specific availability dates.';

notify pgrst, 'reload schema';
commit;
