begin;

do $$
declare
  v_service_id uuid;
  v_service_version_id uuid;
  v_rate_plan_id uuid;
  v_rate_version_id uuid;
  v_request_id uuid;
  v_legacy_request_id uuid;
  v_event_date date := current_date + 30;
  v_total integer;
  v_catalog record;
begin
  insert into public.services (service_code, category_code, is_active, display_order)
  values ('integration-per-person-event', 'events', true, 999)
  returning id into v_service_id;

  insert into public.service_versions (
    service_id, version_number, name_es, name_en, description_es, description_en,
    pricing_unit, price_on_request, base_price_cents, included_guests,
    max_occupancy, adult_extra_cents, child_extra_cents, amenities_es, amenities_en
  ) values (
    v_service_id, 1, 'Evento de integración', 'Integration event',
    'Servicio temporal para validar la tarifa.', 'Temporary service used to validate the rate.',
    'per_night', false, 0, 0, 20, 0, 0, array['Acceso'], array['Access']
  ) returning id into v_service_version_id;

  update public.services set current_version_id = v_service_version_id where id = v_service_id;

  insert into public.rate_plans (service_id, rate_code, is_active, display_order)
  values (v_service_id, 'standard', true, 0)
  returning id into v_rate_plan_id;

  insert into public.rate_plan_versions (
    rate_plan_id, version_number, name_es, name_en, booking_time_model,
    pricing_model, base_price_cents, included_guests, min_guests, max_occupancy,
    adult_extra_cents, child_extra_cents, infant_extra_cents, supplement_basis,
    min_units, max_units, window_start, window_end, restrictions_es, restrictions_en,
    availability_model, person_price_cents, adult_price_cents,
    child_price_cents, infant_price_cents
  ) values (
    v_rate_plan_id, 1, 'Tarifa estándar', 'Standard rate', 'fixed_window',
    'per_person', 0, 0, 1, 20, 0, 0, 0, 'per_unit',
    1, 1, '18:00', '23:59', 'Sin alimentos', 'No food',
    'specific_dates', 25000, null, 15000, 0
  ) returning id into v_rate_version_id;

  update public.rate_plans set current_version_id = v_rate_version_id where id = v_rate_plan_id;
  set constraints all immediate;

  insert into public.rate_plan_available_dates (rate_plan_version_id, available_date)
  values (v_rate_version_id, v_event_date);

  select * into v_catalog
  from public.get_active_service_catalog()
  where rate_plan_id = v_rate_plan_id;

  if v_catalog.pricing_model <> 'per_person'
     or v_catalog.availability_model <> 'specific_dates'
     or v_catalog.available_dates <> array[v_event_date]
     or v_catalog.person_price_cents <> 25000
     or v_catalog.child_price_cents <> 15000
     or v_catalog.infant_price_cents <> 0 then
    raise exception 'Catalog did not expose the participant rate correctly';
  end if;

  select request_id into v_request_id
  from public.create_information_request(
    p_submission_key => gen_random_uuid(),
    p_locale => 'es',
    p_customer_name => 'Persona Prueba',
    p_customer_email => 'test@example.com',
    p_customer_cellphone => '+524491234567',
    p_checkin_date => v_event_date,
    p_checkout_date => v_event_date,
    p_adults => 2,
    p_children => 1,
    p_infants => 1,
    p_rate_plan_id => v_rate_plan_id,
    p_customer_message => null
  );

  select estimated_total_cents into v_total
  from public.information_requests where id = v_request_id;
  if v_total <> 65000 then
    raise exception 'Expected participant total 65000, got %', v_total;
  end if;

  begin
    perform * from public.create_information_request(
      p_submission_key => gen_random_uuid(),
      p_locale => 'es',
      p_customer_name => 'Persona Prueba',
      p_customer_email => 'test@example.com',
      p_customer_cellphone => '+524491234567',
      p_checkin_date => v_event_date + 1,
      p_checkout_date => v_event_date + 1,
      p_adults => 1,
      p_children => 0,
      p_infants => 0,
      p_rate_plan_id => v_rate_plan_id,
      p_customer_message => null
    );
    raise exception 'Unavailable date was accepted';
  exception
    when others then
      if sqlerrm not like '%Selected date is not available%' then
        raise;
      end if;
  end;

  select request_id into v_legacy_request_id
  from public.create_information_request(
    p_submission_key => gen_random_uuid(),
    p_locale => 'es',
    p_customer_name => 'Persona Prueba',
    p_customer_email => 'test@example.com',
    p_customer_cellphone => '+524491234567',
    p_checkin_date => v_event_date,
    p_checkout_date => v_event_date,
    p_adults => 1,
    p_children => 0,
    p_infants => 0,
    p_service_id => v_service_id,
    p_customer_message => null
  );

  select estimated_total_cents into v_total
  from public.information_requests where id = v_legacy_request_id;
  if v_total <> 25000 then
    raise exception 'Legacy compatibility entry point returned total %', v_total;
  end if;
end;
$$;

rollback;
