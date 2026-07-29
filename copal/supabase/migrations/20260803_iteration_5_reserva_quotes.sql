begin;

alter table public.information_requests
  add column selected_service_id uuid references public.services(id),
  add column selected_service_version_id uuid references public.service_versions(id),
  add column infants integer not null default 0 check (infants between 0 and 20),
  add column pricing_status text
    check (pricing_status in ('estimated', 'manual')),
  add column estimated_total_cents integer
    check (estimated_total_cents is null or estimated_total_cents >= 0),
  add column currency_code text
    check (currency_code is null or currency_code = 'MXN'),
  add column quote_snapshot jsonb;

alter table public.information_requests
  add constraint information_requests_selected_service_pair
  check (
    (selected_service_id is null and selected_service_version_id is null)
    or
    (selected_service_id is not null and selected_service_version_id is not null)
  ),
  add constraint information_requests_quote_complete
  check (
    pricing_status is null
    or (
      quote_snapshot is not null
      and currency_code = 'MXN'
      and (
        (pricing_status = 'estimated' and estimated_total_cents is not null)
        or
        (pricing_status = 'manual' and estimated_total_cents is null)
      )
    )
  );

create index information_requests_service_version_idx
  on public.information_requests (selected_service_version_id);

create or replace function public.get_active_service_catalog()
returns table (
  service_id uuid,
  service_version_id uuid,
  service_code text,
  category_code text,
  display_order integer,
  name_es text,
  name_en text,
  description_es text,
  description_en text,
  price_on_request boolean,
  currency_code text,
  base_price_cents integer,
  included_guests integer,
  max_occupancy integer,
  adult_extra_cents integer,
  child_extra_cents integer,
  amenities_es text[],
  amenities_en text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    service.id,
    version.id,
    service.service_code,
    service.category_code,
    service.display_order,
    version.name_es,
    version.name_en,
    version.description_es,
    version.description_en,
    version.price_on_request,
    version.currency_code,
    version.base_price_cents,
    version.included_guests,
    version.max_occupancy,
    version.adult_extra_cents,
    version.child_extra_cents,
    version.amenities_es,
    version.amenities_en
  from public.services service
  join public.service_versions version
    on version.id = service.current_version_id
   and version.service_id = service.id
  where service.is_active = true
  order by service.display_order, service.created_at;
$$;

create or replace function public.create_information_request(
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
  p_service_id uuid,
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
  v_version public.service_versions;
  v_name text := btrim(p_customer_name);
  v_email text := lower(btrim(p_customer_email));
  v_cellphone text := btrim(p_customer_cellphone);
  v_message text := nullif(btrim(p_customer_message), '');
  v_nights integer;
  v_total_people integer;
  v_extra_adults integer;
  v_remaining_included integer;
  v_extra_children integer;
  v_nightly_total integer;
  v_estimated_total integer;
  v_pricing_status text;
  v_snapshot jsonb;
  v_created boolean := false;
begin
  if p_submission_key is null then
    raise exception 'Submission key is required';
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

  select *
    into v_request
  from public.information_requests
  where submission_key = p_submission_key;

  if v_request.id is not null then
    return query select v_request.id, v_request.request_number;
    return;
  end if;

  select *
    into v_service
  from public.services
  where id = p_service_id
    and is_active = true
  for share;

  if v_service.id is null or v_service.current_version_id is null then
    raise exception 'Selected service is not available';
  end if;

  select *
    into v_version
  from public.service_versions
  where id = v_service.current_version_id
    and service_id = v_service.id;

  if v_version.id is null then
    raise exception 'Selected service version is not available';
  end if;

  v_total_people := p_adults + p_children + p_infants;
  if v_total_people > v_version.max_occupancy then
    raise exception 'Guest count exceeds service capacity';
  end if;

  v_nights := p_checkout_date - p_checkin_date;
  if v_version.price_on_request then
    v_pricing_status := 'manual';
    v_nightly_total := null;
    v_estimated_total := null;
  else
    v_pricing_status := 'estimated';
    v_extra_adults := greatest(p_adults - v_version.included_guests, 0);
    v_remaining_included := greatest(v_version.included_guests - p_adults, 0);
    v_extra_children := greatest(p_children - v_remaining_included, 0);
    v_nightly_total := v_version.base_price_cents
      + (v_extra_adults * v_version.adult_extra_cents)
      + (v_extra_children * v_version.child_extra_cents);
    v_estimated_total := v_nightly_total * v_nights;
  end if;

  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'calculated_at', now(),
    'pricing_status', v_pricing_status,
    'service', jsonb_build_object(
      'service_id', v_service.id,
      'service_version_id', v_version.id,
      'service_code', v_service.service_code,
      'category_code', v_service.category_code,
      'version_number', v_version.version_number,
      'name_es', v_version.name_es,
      'name_en', v_version.name_en
    ),
    'stay', jsonb_build_object(
      'checkin', p_checkin_date,
      'checkout', p_checkout_date,
      'nights', v_nights
    ),
    'occupancy', jsonb_build_object(
      'adults', p_adults,
      'children', p_children,
      'infants', p_infants,
      'total', v_total_people,
      'max_occupancy', v_version.max_occupancy
    ),
    'pricing', jsonb_build_object(
      'currency_code', v_version.currency_code,
      'base_price_cents', v_version.base_price_cents,
      'included_guests', v_version.included_guests,
      'adult_extra_cents', v_version.adult_extra_cents,
      'child_extra_cents', v_version.child_extra_cents,
      'infant_price_cents', v_version.infant_price_cents,
      'extra_adults', coalesce(v_extra_adults, 0),
      'extra_children', coalesce(v_extra_children, 0),
      'nightly_total_cents', v_nightly_total,
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
    v_version.id,
    v_message,
    v_pricing_status,
    v_estimated_total,
    v_version.currency_code,
    v_snapshot
  )
  on conflict (submission_key) do nothing
  returning * into v_request;

  v_created := v_request.id is not null;
  if not v_created then
    select *
      into v_request
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

revoke all on function public.get_active_service_catalog() from public;
grant execute on function public.get_active_service_catalog() to anon, authenticated;

revoke all on function public.create_information_request(
  uuid, text, text, text, text, date, date, integer, integer, integer, uuid, text
) from public;
grant execute on function public.create_information_request(
  uuid, text, text, text, text, date, date, integer, integer, integer, uuid, text
) to anon, authenticated;

comment on function public.get_active_service_catalog() is
  'Public projection of active services and current pricing versions for Reserva.';

comment on column public.information_requests.quote_snapshot is
  'Immutable quotation inputs and server-calculated result shown at submission time.';

commit;
