begin;

do $$
declare
  v_admin_id uuid := gen_random_uuid();
  v_viewer_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_second_request_id uuid;
  v_closed_recent_id uuid;
  v_closed_expired_id uuid;
  v_transition_closed_id uuid;
  v_recipient_id uuid;
  v_projection jsonb;
  v_closed_at timestamptz;
  v_hash_a text := repeat('a', 64);
  v_hash_b text := repeat('b', 64);
  v_hash_c text := repeat('c', 64);
  v_hash_d text := repeat('d', 64);
  v_hash_e text := repeat('e', 64);
  v_hash_f text := repeat('f', 64);
  v_hash_unique text := repeat('9', 64);
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
  (
    '00000000-0000-0000-0000-000000000000', v_admin_id,
    'authenticated', 'authenticated', 'v10.6-admin@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', v_viewer_id,
    'authenticated', 'authenticated', 'v10.6-viewer@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

  insert into public.admin_profiles (user_id, display_name, role, active)
  values
    (v_admin_id, 'V10.6 Admin', 'admin', true),
    (v_viewer_id, 'V10.6 Viewer', 'viewer', true);

  insert into public.whatsapp_recipients (display_name, phone_e164, is_active)
  values ('Cebolletas pruebas', '+524495550106', true)
  returning id into v_recipient_id;
  update public.management_settings
  set default_whatsapp_recipient_id = v_recipient_id;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants,
    requested_services, pricing_status, estimated_total_cents,
    currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'es', 'Persona Solicitante', 'requester@example.com',
    '+524495550100', current_date + 20, current_date + 22, 2, 1, 0,
    array['copal'], 'estimated', 245000, 'MXN', '{}'::jsonb
  ) returning id into v_request_id;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  perform public.publish_information_request_access(v_request_id, v_hash_a, 'es');
  if (select count(*) from public.information_request_access where information_request_id = v_request_id and revoked_at is null) <> 1 then
    raise exception 'Expected exactly one active access record';
  end if;

  begin
    insert into public.information_request_access (
      information_request_id, token_hash, language, created_by
    ) values (v_request_id, v_hash_unique, 'es', v_admin_id);
    raise exception 'A second active access record was accepted';
  exception when unique_violation then
    null;
  end;

  select public.resolve_public_information_request(v_hash_a) into v_projection;
  if v_projection->'beneficiary'->>'name' <> 'Persona Solicitante'
     or v_projection ? 'request_contact'
     or v_projection->>'quoted_total_cents' <> '245000'
     or v_projection->'whatsapp'->>'phone_e164' <> '+524495550106' then
    raise exception 'Requester fallback or approved projection failed: %', v_projection;
  end if;

  perform public.update_information_request_designated_contact(
    v_request_id,
    'Persona Designada',
    '+52 449 555 0102',
    'DESIGNATED@EXAMPLE.COM'
  );
  select public.resolve_public_information_request(v_hash_a) into v_projection;
  if v_projection->'beneficiary'->>'name' <> 'Persona Designada'
     or v_projection->'request_contact'->>'name' <> 'Persona Solicitante'
     or v_projection->'beneficiary'->>'email' <> 'designated@example.com' then
    raise exception 'Designated contact projection failed: %', v_projection;
  end if;
  if (select customer_name from public.information_requests where id = v_request_id) <> 'Persona Solicitante' then
    raise exception 'Original requester was overwritten';
  end if;

  perform public.publish_information_request_access(v_request_id, v_hash_b, 'en');
  if (select count(*) from public.information_request_access where information_request_id = v_request_id and revoked_at is null) <> 1
     or (select count(*) from public.information_request_access where information_request_id = v_request_id and revoked_at is not null) <> 1 then
    raise exception 'Regeneration did not revoke the previous access record';
  end if;
  if public.resolve_public_information_request(v_hash_a) is not null then
    raise exception 'Previous token remained valid after regeneration';
  end if;
  select public.resolve_public_information_request(v_hash_b) into v_projection;
  if v_projection->>'publication_language' <> 'en' then
    raise exception 'Stored publication language was not enforced';
  end if;

  begin
    perform public.publish_information_request_access(v_request_id, v_hash_a, 'es');
    raise exception 'A previously used token hash was accepted again';
  exception when unique_violation then
    null;
  end;

  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  begin
    perform public.publish_information_request_access(v_request_id, v_hash_c, 'es');
    raise exception 'Viewer generated public access';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.revoke_information_request_access(v_request_id);
    raise exception 'Viewer revoked public access';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.update_information_request_designated_contact(
      v_request_id, 'Viewer Contact', '+524495550109', 'viewer-contact@example.com'
    );
    raise exception 'Viewer changed the designated contact';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  update public.management_settings set default_whatsapp_recipient_id = null;
  select public.resolve_public_information_request(v_hash_b) into v_projection;
  if v_projection ? 'whatsapp' then
    raise exception 'Projection exposed an unavailable WhatsApp contact';
  end if;
  begin
    perform public.publish_information_request_access(v_request_id, v_hash_c, 'es');
    raise exception 'Publishing succeeded without a default WhatsApp contact';
  exception when others then
    if sqlerrm not like '%active default WhatsApp contact%' then raise; end if;
  end;
  update public.management_settings set default_whatsapp_recipient_id = v_recipient_id;

  update public.information_requests set status = 'cancelled' where id = v_request_id;
  if exists (select 1 from public.information_request_access where information_request_id = v_request_id and revoked_at is null)
     or public.resolve_public_information_request(v_hash_b) is not null then
    raise exception 'Cancelled request retained public access';
  end if;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services
  ) values (
    gen_random_uuid(), 'es', 'Segunda Persona', 'second@example.com',
    '+524495550103', current_date + 25, current_date + 26, 1, 0, 0, array['copal']
  ) returning id into v_second_request_id;
  perform public.publish_information_request_access(v_second_request_id, v_hash_c, 'es');
  select public.resolve_public_information_request(v_hash_c) into v_projection;
  if v_projection ? 'quoted_total_cents' or v_projection ? 'currency_code' then
    raise exception 'Projection exposed an unavailable quoted total';
  end if;
  update public.information_requests set status = 'not_converted' where id = v_second_request_id;
  if public.resolve_public_information_request(v_hash_c) is not null then
    raise exception 'Not-converted request retained public access';
  end if;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    status, status_changed_at, closed_at
  ) values (
    gen_random_uuid(), 'es', 'Cierre Reciente', 'recent@example.com',
    '+524495550104', current_date - 8, current_date - 7, 1, 0, 0, array['copal'],
    'closed', now() - interval '6 days', now() - interval '6 days'
  ) returning id into v_closed_recent_id;
  insert into public.information_request_access (information_request_id, token_hash, language, created_by)
  values (v_closed_recent_id, v_hash_d, 'es', v_admin_id);
  if public.resolve_public_information_request(v_hash_d) is null then
    raise exception 'Recently closed request was unavailable before seven days';
  end if;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    status, status_changed_at, closed_at
  ) values (
    gen_random_uuid(), 'en', 'Expired Closed Request', 'expired@example.com',
    '+524495550105', current_date - 10, current_date - 9, 1, 0, 0, array['copal'],
    'closed', now() - interval '8 days', now() - interval '8 days'
  ) returning id into v_closed_expired_id;
  insert into public.information_request_access (information_request_id, token_hash, language, created_by)
  values (v_closed_expired_id, v_hash_e, 'en', v_admin_id);
  if public.resolve_public_information_request(v_hash_e) is not null then
    raise exception 'Closed request remained available after seven days';
  end if;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services
  ) values (
    gen_random_uuid(), 'es', 'Cierre por Transición', 'transition@example.com',
    '+524495550107', current_date + 30, current_date + 31, 1, 0, 0, array['copal']
  ) returning id into v_transition_closed_id;
  perform public.publish_information_request_access(v_transition_closed_id, v_hash_f, 'es');
  update public.information_requests set status = 'closed' where id = v_transition_closed_id;
  select closed_at into v_closed_at
  from public.information_requests where id = v_transition_closed_id;
  if v_closed_at is null or abs(extract(epoch from (now() - v_closed_at))) > 2 then
    raise exception 'Transition to closed did not set closed_at';
  end if;
  update public.information_requests
  set updated_at = now() + interval '1 day'
  where id = v_transition_closed_id;
  if (select closed_at from public.information_requests where id = v_transition_closed_id)
     is distinct from v_closed_at then
    raise exception 'Unrelated update changed transition closed_at';
  end if;

  update public.information_requests set updated_at = now() + interval '1 day' where id = v_closed_recent_id;
  select closed_at into v_closed_at from public.information_requests where id = v_closed_recent_id;
  if v_closed_at is distinct from now() - interval '6 days' and abs(extract(epoch from (v_closed_at - (now() - interval '6 days')))) > 2 then
    raise exception 'Unrelated update changed closed_at';
  end if;

  if has_table_privilege('anon', 'public.information_requests', 'select')
     or has_table_privilege('anon', 'public.information_request_access', 'select')
     or has_table_privilege('authenticated', 'public.information_request_access', 'select') then
    raise exception 'Anonymous or authenticated table privileges expose private records';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'information_request_access') then
    raise exception 'Access table unexpectedly has a direct-read RLS policy';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'information_request_access'
      and column_name in ('token', 'raw_token', 'access_token')
  ) then
    raise exception 'Raw token storage column exists';
  end if;
end;
$$;

rollback;
