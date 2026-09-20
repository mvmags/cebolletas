begin;

do $$
declare
  v_admin_id uuid := gen_random_uuid();
  v_viewer_id uuid := gen_random_uuid();
  v_request_id uuid;
  v_credit_request_id uuid;
  v_quote_request_id uuid;
  v_cash_request_id uuid;
  v_invalid_request_id uuid;
  v_access_id uuid := gen_random_uuid();
  v_spei_id uuid;
  v_cash_id uuid;
  v_deposit_id uuid;
  v_inactive_id uuid;
  v_result jsonb;
  v_state jsonb;
  v_projection jsonb;
  v_payment_id uuid;
  v_replacement_id uuid;
  v_receipt_id uuid;
  v_receipt_hash text;
  v_receipt_snapshot jsonb;
  v_receipt_checksum text;
  v_status text;
  v_reference text;
  v_recipient_id uuid;
  v_today date := (now() at time zone 'America/Mexico_City')::date;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
  (
    '00000000-0000-0000-0000-000000000000', v_admin_id,
    'authenticated', 'authenticated', 'v10.7-admin@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', v_viewer_id,
    'authenticated', 'authenticated', 'v10.7-viewer@example.com', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', ''
  );

  insert into public.admin_profiles (user_id, display_name, role, active)
  values
    (v_admin_id, 'V10.7 Administrator', 'admin', true),
    (v_viewer_id, 'V10.7 Viewer', 'viewer', true);

  insert into public.whatsapp_recipients (display_name, phone_e164, is_active)
  values ('V10.7 Recipient', '+524495551099', true)
  returning id into v_recipient_id;
  update public.management_settings
  set default_whatsapp_recipient_id = v_recipient_id
  where singleton;

  select id into v_spei_id from public.payment_methods where code = 'spei';
  select id into v_cash_id from public.payment_methods where code = 'cash';
  select id into v_deposit_id from public.payment_methods where code = 'bank_deposit';
  if v_spei_id is null or v_cash_id is null or v_deposit_id is null then
    raise exception 'Initial payment methods were not seeded';
  end if;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants,
    requested_services, pricing_status, estimated_total_cents,
    currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'es', 'Persona de Pagos', 'payment@example.com',
    '+524495551001', current_date + 20, current_date + 22, 2, 1, 0,
    array['copal'], 'estimated', 250000, 'MXN',
    jsonb_build_object('pricing_status', 'estimated', 'pricing', jsonb_build_object('estimated_total_cents', 250000))
  ) returning id into v_request_id;

  -- One-way lookup remains valid, but legacy records stay unrecoverable.
  insert into public.information_request_access (
    information_request_id, token_hash, language, created_by
  ) values (v_request_id, repeat('a', 64), 'es', v_admin_id);

  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- Every active management account, including a viewer, may record payments.
  select public.record_verified_payment(
    v_request_id, 100000, v_today, v_spei_id, 'SPEI-EXTERNAL-001', null, null
  ) into v_result;
  v_payment_id := (v_result->>'payment_id')::uuid;
  v_receipt_id := (v_result->>'receipt_id')::uuid;
  if v_result->>'receipt_type' <> 'partial'
     or v_result->>'status_transition' <> 'new_to_booked'
     or (v_result->'financials'->>'balance_due_cents')::bigint <> 150000 then
    raise exception 'First partial payment result is incorrect: %', v_result;
  end if;
  select status into v_status from public.information_requests where id = v_request_id;
  if v_status <> 'booked' then raise exception 'First payment did not book the request'; end if;
  if (select count(*) from public.information_request_status_history
      where information_request_id = v_request_id and previous_status = 'new' and new_status = 'booked') <> 1 then
    raise exception 'First payment did not append exactly one status event';
  end if;
  if (select language from public.payment_receipts where id = v_receipt_id) <> 'es' then
    raise exception 'Active private-link language was not used for the receipt';
  end if;

  select public.resolve_public_information_request(repeat('a', 64)) into v_projection;
  if v_projection->'payments'->0->>'masked_reference' <> '••••-001'
     or v_projection::text like '%SPEI-EXTERNAL-001%' then
    raise exception 'Public projection did not mask the payment reference: %', v_projection;
  end if;

  begin
    perform public.record_verified_payment(
      v_request_id, 1000, v_today, v_deposit_id, 'SPEI-EXTERNAL-001', null, null
    );
    raise exception 'Duplicate active external reference was accepted across methods';
  exception when unique_violation then null;
  end;
  begin
    perform public.record_verified_payment(
      v_request_id, 1000, v_today + 1, v_spei_id, 'FUTURE-001', null, null
    );
    raise exception 'Future payment date was accepted';
  exception when others then
    if sqlerrm not like '%Future payment dates%' then raise; end if;
  end;
  begin
    perform public.record_verified_payment(
      v_request_id, 0, v_today, v_spei_id, 'ZERO-001', null, null
    );
    raise exception 'Zero payment was accepted';
  exception when others then
    if sqlerrm not like '%must be positive%' then raise; end if;
  end;

  -- Facts and receipt snapshots are immutable outside the controlled void path.
  begin
    update public.reservation_payments set amount_cents = amount_cents + 1 where id = v_payment_id;
    raise exception 'Payment facts were mutable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.payment_receipts set snapshot = snapshot || '{"tampered":true}'::jsonb where id = v_receipt_id;
    raise exception 'Receipt snapshot was mutable';
  exception when insufficient_privilege then null;
  end;

  select snapshot, content_checksum, verification_code_hash
  into v_receipt_snapshot, v_receipt_checksum, v_receipt_hash
  from public.payment_receipts where id = v_receipt_id;
  select public.void_verified_payment(v_payment_id, 'Referencia capturada incorrectamente') into v_result;
  if (v_result->'financials'->>'staff_review_required')::boolean is not true
     or (v_result->'financials'->>'gross_verified_cents')::bigint <> 0 then
    raise exception 'Zero-active-payment review state is incorrect: %', v_result;
  end if;
  if (select status from public.information_requests where id = v_request_id) <> 'booked' then
    raise exception 'Voiding the only payment reversed booked status';
  end if;
  if (select snapshot from public.payment_receipts where id = v_receipt_id) is distinct from v_receipt_snapshot
     or (select content_checksum from public.payment_receipts where id = v_receipt_id) <> v_receipt_checksum then
    raise exception 'Void changed immutable receipt content';
  end if;
  select public.resolve_payment_receipt_verification(v_receipt_hash) into v_projection;
  if v_projection->>'validity' <> 'voided'
     or (select count(*) from jsonb_object_keys(v_projection)) <> 6
     or v_projection ? 'beneficiary' or v_projection ? 'reference_full' then
    raise exception 'Receipt verification result is not a limited voided projection: %', v_projection;
  end if;
  select public.resolve_public_information_request(repeat('a', 64)) into v_projection;
  if jsonb_array_length(v_projection->'payments') <> 0 then
    raise exception 'Voided payment remained visible to the visitor';
  end if;

  -- A corrected replacement may reuse a voided external reference.
  select public.record_verified_payment(
    v_request_id, 100000, v_today, v_spei_id, 'SPEI-EXTERNAL-001', null, v_payment_id
  ) into v_result;
  v_replacement_id := (v_result->>'payment_id')::uuid;
  if v_result->>'receipt_number' not like 'RCP-SOL-%-02'
     or (select replacement_for_payment_id from public.reservation_payments where id = v_replacement_id) <> v_payment_id then
    raise exception 'Replacement payment or receipt sequence is incorrect: %', v_result;
  end if;
  select public.record_verified_payment(
    v_request_id, 150000, v_today, v_deposit_id, 'DEPOSIT-EXTERNAL-002', null, null
  ) into v_result;
  v_payment_id := (v_result->>'payment_id')::uuid;
  if v_result->>'receipt_type' <> 'final'
     or (v_result->'financials'->>'balance_due_cents')::bigint <> 0
     or (v_result->'financials'->>'quote_locked')::boolean is not true then
    raise exception 'Final payment did not create a final locked receipt: %', v_result;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  begin
    perform public.revise_information_request_quote(v_request_id, 300000, 'Attempt after final receipt');
    raise exception 'Quote changed after final receipt';
  exception when others then
    if sqlerrm not like '%final receipt exists%' then raise; end if;
  end;
  perform public.void_verified_payment(v_payment_id, 'Final payment was matched to the wrong request');
  begin
    perform public.revise_information_request_quote(v_request_id, 300000, 'Attempt after voided final receipt');
    raise exception 'Quote changed after a final receipt was voided';
  exception when others then
    if sqlerrm not like '%final receipt exists%' then raise; end if;
  end;
  if (select status from public.information_requests where id = v_request_id) <> 'booked' then
    raise exception 'Voiding a final payment reversed booked status';
  end if;

  -- Only administrators may configure payment methods; stable codes cannot change.
  select (public.save_payment_method(
    null, 'test_disabled', 'Prueba inactiva', 'Disabled test',
    'external_required', false, 999
  )).id into v_inactive_id;
  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  begin
    perform public.save_payment_method(
      null, 'viewer_method', 'Método visor', 'Viewer method', 'external_required', true, 999
    );
    raise exception 'Viewer configured a payment method';
  exception when insufficient_privilege then null;
  end;

  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    pricing_status, estimated_total_cents, currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'en', 'Inactive Method Test', 'inactive@example.com', '+524495551002',
    current_date + 20, current_date + 21, 1, 0, 0, array['copal'],
    'estimated', 100000, 'MXN', '{}'::jsonb
  ) returning id into v_invalid_request_id;
  begin
    perform public.record_verified_payment(
      v_invalid_request_id, 1000, v_today, v_inactive_id, 'INACTIVE-001', 'en', null
    );
    raise exception 'Inactive payment method was accepted';
  exception when others then
    if sqlerrm not like '%active payment method%' then raise; end if;
  end;

  -- No quote and terminal states must reject payment recording.
  update public.information_requests set pricing_status = null, estimated_total_cents = null,
    currency_code = null, quote_snapshot = null where id = v_invalid_request_id;
  begin
    perform public.record_verified_payment(
      v_invalid_request_id, 1000, v_today, v_spei_id, 'NOQUOTE-001', 'en', null
    );
    raise exception 'Payment without authoritative quote was accepted';
  exception when others then
    if sqlerrm not like '%authoritative positive quoted total%' then raise; end if;
  end;
  update public.information_requests set status = 'cancelled' where id = v_invalid_request_id;
  begin
    perform public.record_verified_payment(
      v_invalid_request_id, 1000, v_today, v_spei_id, 'TERMINAL-001', 'en', null
    );
    raise exception 'Payment on terminal request was accepted';
  exception when others then
    if sqlerrm not like '%status does not accept payments%' then raise; end if;
  end;

  foreach v_status in array array['not_converted', 'closed'] loop
    insert into public.information_requests (
      submission_key, locale, customer_name, customer_email, customer_cellphone,
      checkin_date, checkout_date, adults, children, infants, requested_services,
      status, status_changed_at, closed_at,
      pricing_status, estimated_total_cents, currency_code, quote_snapshot
    ) values (
      gen_random_uuid(), 'es', 'Terminal Status Test', 'terminal@example.com', '+524495551006',
      current_date + 60, current_date + 61, 1, 0, 0, array['copal'],
      v_status, now(), case when v_status = 'closed' then now() else null end,
      'estimated', 100000, 'MXN', '{}'::jsonb
    ) returning id into v_invalid_request_id;
    begin
      perform public.record_verified_payment(
        v_invalid_request_id, 1000, v_today, v_spei_id,
        'TERMINAL-' || v_status, 'es', null
      );
      raise exception 'Payment on % request was accepted', v_status;
    exception when others then
      if sqlerrm not like '%status does not accept payments%' then raise; end if;
    end;
  end loop;

  -- Quote revisions are audited before final receipt and constrained by active gross.
  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    pricing_status, estimated_total_cents, currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'en', 'Quote Revision Test', 'quote@example.com', '+524495551003',
    current_date + 30, current_date + 31, 1, 0, 0, array['copal'],
    'estimated', 200000, 'MXN', '{}'::jsonb
  ) returning id into v_quote_request_id;
  select public.record_verified_payment(
    v_quote_request_id, 50000, v_today, v_spei_id, 'QUOTE-001', 'en', null
  ) into v_result;
  select snapshot into v_receipt_snapshot from public.payment_receipts
  where id = (v_result->>'receipt_id')::uuid;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  select public.revise_information_request_quote(
    v_quote_request_id, 150000, 'Customer approved a smaller package'
  ) into v_result;
  if (v_result->>'quoted_total_cents')::bigint <> 150000
     or (select count(*) from public.quote_revision_events where information_request_id = v_quote_request_id) <> 1 then
    raise exception 'Valid quote revision was not applied or audited: %', v_result;
  end if;
  if (select snapshot from public.payment_receipts where information_request_id = v_quote_request_id limit 1)
     is distinct from v_receipt_snapshot then
    raise exception 'Quote revision changed an earlier receipt snapshot';
  end if;
  begin
    perform public.revise_information_request_quote(v_quote_request_id, 160000, null);
    raise exception 'Quote revision after payment was accepted without a reason';
  exception when others then
    if sqlerrm not like '%reason is required%' then raise; end if;
  end;
  begin
    perform public.revise_information_request_quote(v_quote_request_id, 40000, 'Below active verified payment');
    raise exception 'Quote was reduced below active payment gross';
  exception when others then
    if sqlerrm not like '%lower than active verified payments%' then raise; end if;
  end;
  perform public.record_verified_payment(
    v_quote_request_id, 100000, v_today, v_spei_id, 'QUOTE-002', 'en', null
  );
  begin
    perform public.revise_information_request_quote(v_quote_request_id, 175000, 'Final receipt already exists');
    raise exception 'Quote changed after final receipt on revision test';
  exception when others then
    if sqlerrm not like '%final receipt exists%' then raise; end if;
  end;

  -- Overpayment credit is explicit, resolved in full, and constrains later voids.
  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    pricing_status, estimated_total_cents, currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'es', 'Credit Resolution Test', 'credit@example.com', '+524495551004',
    current_date + 40, current_date + 41, 1, 0, 0, array['copal'],
    'estimated', 100000, 'MXN', '{}'::jsonb
  ) returning id into v_credit_request_id;
  insert into public.information_request_access (
    information_request_id, token_hash, language, created_by
  ) values (v_credit_request_id, repeat('b', 64), 'es', v_admin_id);
  select public.record_verified_payment(
    v_credit_request_id, 120000, v_today, v_spei_id, 'CREDIT-001', null, null
  ) into v_result;
  v_payment_id := (v_result->>'payment_id')::uuid;
  if v_result->>'receipt_type' <> 'final_credit'
     or (v_result->'financials'->>'credit_cents')::bigint <> 20000 then
    raise exception 'Overpayment credit was not identified: %', v_result;
  end if;
  select public.resolve_information_request_credit(
    v_credit_request_id, v_today, 'REFUND-001', 'Returned by bank transfer'
  ) into v_result;
  if (v_result->>'resolved_credit_cents')::bigint <> 20000
     or (v_result->'financials'->>'credit_cents')::bigint <> 0
     or (v_result->'financials'->>'verified_paid_cents')::bigint <> 100000 then
    raise exception 'Credit resolution totals are incorrect: %', v_result;
  end if;
  begin
    perform public.void_verified_payment(v_payment_id, 'Attempt after resolving customer credit');
    raise exception 'Payment void created an inconsistent resolved credit state';
  exception when others then
    if sqlerrm not like '%resolved credit would exceed%' then raise; end if;
  end;
  select public.resolve_public_information_request(repeat('b', 64)) into v_projection;
  if v_projection->'credit_resolutions'->0->>'masked_reference' <> '••••-001'
     or v_projection::text like '%REFUND-001%' then
    raise exception 'Public credit resolution exposed a full reference: %', v_projection;
  end if;

  -- Cash references are generated internally and receipts remain request-sequential.
  insert into public.information_requests (
    submission_key, locale, customer_name, customer_email, customer_cellphone,
    checkin_date, checkout_date, adults, children, infants, requested_services,
    pricing_status, estimated_total_cents, currency_code, quote_snapshot
  ) values (
    gen_random_uuid(), 'es', 'Cash Payment Test', 'cash@example.com', '+524495551005',
    current_date + 50, current_date + 51, 1, 0, 0, array['copal'],
    'estimated', 50000, 'MXN', '{}'::jsonb
  ) returning id into v_cash_request_id;
  select public.record_verified_payment(
    v_cash_request_id, 10000, v_today, v_cash_id, null, 'es', null
  ) into v_result;
  select reference_full into v_reference from public.reservation_payments
  where id = (v_result->>'payment_id')::uuid;
  if v_reference not like 'CASH-SOL-%-001' then
    raise exception 'Cash reference was not generated safely: %', v_reference;
  end if;

  insert into public.information_request_access (
    information_request_id, token_hash, language, created_by
  ) values (v_cash_request_id, repeat('d', 64), 'es', v_admin_id);

  -- Recoverable-link metadata supersedes a legacy link while preserving hash lookup.
  perform set_config('request.jwt.claim.sub', v_viewer_id::text, true);
  begin
    perform public.publish_recoverable_information_request_access(
      gen_random_uuid(), v_cash_request_id, repeat('c', 64), 'cipherText123', 'ivValue123', 'k1', 'es'
    );
    raise exception 'Viewer published a recoverable link';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform public.publish_recoverable_information_request_access(
    v_access_id, v_cash_request_id, repeat('c', 64), 'cipherText123', 'ivValue123', 'k1', 'es'
  );
  if not exists (
    select 1 from public.information_request_access
    where id = v_access_id and token_ciphertext = 'cipherText123'
      and token_iv = 'ivValue123' and encryption_key_version = 'k1'
      and revoked_at is null
  ) or public.resolve_public_information_request(repeat('c', 64)) is null
     or public.resolve_public_information_request(repeat('d', 64)) is not null then
    raise exception 'Recoverable link metadata or one-way lookup is invalid';
  end if;

  if has_table_privilege('anon', 'public.reservation_payments', 'select')
     or has_table_privilege('anon', 'public.payment_receipts', 'select')
     or has_table_privilege('authenticated', 'public.reservation_payments', 'insert')
     or has_table_privilege('authenticated', 'public.payment_receipts', 'update')
     or has_function_privilege('authenticated', 'public.publish_information_request_access(uuid,text,text)', 'execute') then
    raise exception 'Ledger table privileges bypass the approved RPC paths';
  end if;
end;
$$;

rollback;
