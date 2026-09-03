begin;

do $$
declare
  v_viewer_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_expected_mutations text[] := array[
    'create_whatsapp_recipient',
    'set_default_whatsapp_recipient',
    'update_whatsapp_recipient',
    'delete_whatsapp_recipient',
    'create_service',
    'create_service_version',
    'set_service_active',
    'delete_service',
    'set_current_service_version',
    'change_information_request_status',
    'save_primary_rate_plan',
    'save_service_with_primary_rate_plan',
    'save_service_with_primary_rate_plan_v2'
  ];
  v_hardened_count integer;
  v_delete_source text;
  v_compatibility_source text;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_viewer_id,
    'authenticated', 'authenticated', 'management-viewer@example.com', '',
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

  insert into public.admin_profiles (user_id, display_name, role, active)
  values (v_viewer_id, 'Management Viewer', 'viewer', true);

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services
  ) values (
    gen_random_uuid(), 'es', 'Solicitud de Prueba', 'viewer-test@example.com',
    '+524495550161', current_date + 20, current_date + 21, 1, 0, 0,
    array['copal']
  ) returning id into v_request_id;

  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if not public.is_active_admin() or public.is_active_admin_writer() then
    raise exception 'Viewer read/write predicates are incorrect';
  end if;

  begin
    perform public.create_whatsapp_recipient(
      'Viewer mutation', '+524495550162', true
    );
    raise exception 'Viewer created a WhatsApp recipient';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.set_service_active(gen_random_uuid(), true);
    raise exception 'Viewer changed a service';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.delete_service(gen_random_uuid());
    raise exception 'Viewer deleted a service';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.change_information_request_status(
      v_request_id,
      'new',
      'not_converted',
      'No response after receiving information',
      null
    );
    raise exception 'Viewer changed an information-request status';
  exception when insufficient_privilege then
    null;
  end;

  select count(*) into v_hardened_count
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname = any(v_expected_mutations)
    and routine.prosrc like '%public.is_active_admin_writer()%'
    and routine.prosrc not like '%public.is_active_admin()%';

  if v_hardened_count <> cardinality(v_expected_mutations) then
    raise exception 'Expected % writer-only mutation RPCs, found %',
      cardinality(v_expected_mutations),
      v_hardened_count;
  end if;

  if exists (
    select 1
    from pg_proc routine
    join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'create_booking_request_internal'
  ) then
    raise exception 'Orphan create_booking_request_internal function still exists';
  end if;

  select routine.prosrc into v_delete_source
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname = 'delete_service';
  if v_delete_source like '%booking_service_items%' then
    raise exception 'delete_service still references the removed booking table';
  end if;

  select routine.prosrc into v_compatibility_source
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname = 'create_information_request'
    and pg_get_function_identity_arguments(routine.oid) like '%p_legacy_compat boolean%';
  if v_compatibility_source not like '%perform p_legacy_compat%' then
    raise exception 'Legacy compatibility parameter remains unused';
  end if;
end;
$$;

rollback;
