begin;

create extension if not exists pgcrypto;

-- Recoverable links keep the existing one-way lookup hash. Only the Edge
-- Function can decrypt these optional envelope fields.
alter table public.information_request_access
  add column token_ciphertext text,
  add column token_iv text,
  add column encryption_key_version text;

alter table public.information_request_access
  add constraint information_request_access_encryption_complete
  check (
    (token_ciphertext is null and token_iv is null and encryption_key_version is null)
    or (
      token_ciphertext ~ '^[A-Za-z0-9_-]+$'
      and token_iv ~ '^[A-Za-z0-9_-]+$'
      and encryption_key_version ~ '^[A-Za-z0-9._-]{1,40}$'
    )
  );

comment on column public.information_request_access.token_ciphertext is
  'AES-GCM ciphertext containing the raw bearer token. Decryption is restricted to the private-access Edge Function.';
comment on column public.information_request_access.encryption_key_version is
  'Version that selects a retained server-side encryption key during rotation.';

create function public.information_request_public_access_eligible(
  p_status text,
  p_closed_at timestamptz
)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select p_status in ('new', 'booked')
    or (
      p_status = 'closed'
      and p_closed_at is not null
      and now() <= p_closed_at + interval '7 days'
    );
$$;

revoke all on function public.information_request_public_access_eligible(text, timestamptz)
from public, anon, authenticated;

create function public.publish_recoverable_information_request_access(
  p_access_id uuid,
  p_request_id uuid,
  p_token_hash text,
  p_token_ciphertext text,
  p_token_iv text,
  p_encryption_key_version text,
  p_language text
)
returns table (access_id uuid, language text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_access public.information_request_access;
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;

  if p_access_id is null then
    raise exception 'Access identifier is required';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token hash is invalid';
  end if;
  if p_token_ciphertext !~ '^[A-Za-z0-9_-]+$'
     or p_token_iv !~ '^[A-Za-z0-9_-]+$'
     or p_encryption_key_version !~ '^[A-Za-z0-9._-]{1,40}$' then
    raise exception 'Encrypted token envelope is invalid';
  end if;
  if p_language not in ('es', 'en') then
    raise exception 'Publication language is invalid';
  end if;

  select * into v_request
  from public.information_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Information request not found';
  end if;
  if not public.information_request_public_access_eligible(v_request.status, v_request.closed_at) then
    raise exception 'Request is not eligible for public access';
  end if;
  if not exists (
    select 1
    from public.management_settings settings
    join public.whatsapp_recipients recipient
      on recipient.id = settings.default_whatsapp_recipient_id
     and recipient.is_active = true
    where settings.singleton = true
  ) then
    raise exception 'An active default WhatsApp contact is required';
  end if;

  update public.information_request_access
  set revoked_at = now()
  where information_request_id = p_request_id
    and revoked_at is null;

  insert into public.information_request_access (
    id,
    information_request_id,
    token_hash,
    token_ciphertext,
    token_iv,
    encryption_key_version,
    language,
    created_by
  ) values (
    p_access_id,
    p_request_id,
    p_token_hash,
    p_token_ciphertext,
    p_token_iv,
    p_encryption_key_version,
    p_language,
    auth.uid()
  ) returning * into v_access;

  return query select v_access.id, v_access.language, v_access.created_at;
end;
$$;

revoke all on function public.publish_recoverable_information_request_access(
  uuid, uuid, text, text, text, text, text
) from public;
grant execute on function public.publish_recoverable_information_request_access(
  uuid, uuid, text, text, text, text, text
) to authenticated;
revoke execute on function public.publish_information_request_access(uuid, text, text)
from authenticated;

drop function public.get_information_request_access_state(uuid);
create function public.get_information_request_access_state(p_request_id uuid)
returns table (
  has_active_access boolean,
  language text,
  created_at timestamptz,
  is_recoverable boolean,
  can_regenerate boolean,
  inactive_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin() then
    raise exception 'Active management access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.information_requests where id = p_request_id) then
    raise exception 'Information request not found';
  end if;

  return query
  select
    access.revoked_at is null
      and public.information_request_public_access_eligible(request.status, request.closed_at),
    access.language,
    access.created_at,
    access.token_ciphertext is not null,
    public.information_request_public_access_eligible(request.status, request.closed_at),
    case
      when access.id is null then 'not_published'
      when access.revoked_at is not null then 'revoked'
      when request.status in ('cancelled', 'not_converted') then request.status
      when request.status = 'closed'
        and not public.information_request_public_access_eligible(request.status, request.closed_at)
        then 'expired'
      when not public.information_request_public_access_eligible(request.status, request.closed_at)
        then 'terminal'
      else null
    end
  from public.information_requests request
  left join lateral (
    select item.*
    from public.information_request_access item
    where item.information_request_id = request.id
    order by (item.revoked_at is null) desc, item.created_at desc
    limit 1
  ) access on true
  where request.id = p_request_id;
end;
$$;

revoke all on function public.get_information_request_access_state(uuid) from public;
grant execute on function public.get_information_request_access_state(uuid) to authenticated;

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  label_es text not null check (char_length(btrim(label_es)) between 2 and 80),
  label_en text not null check (char_length(btrim(label_en)) between 2 and 80),
  reference_behavior text not null
    check (reference_behavior in ('external_required', 'internal_cash')),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.payment_methods (
  code, label_es, label_en, reference_behavior, display_order
) values
  ('spei', 'SPEI / transferencia bancaria', 'SPEI / bank transfer', 'external_required', 10),
  ('cash', 'Efectivo', 'Cash', 'internal_cash', 20),
  ('bank_deposit', 'Depósito bancario', 'Bank deposit', 'external_required', 30);

create table public.reservation_payments (
  id uuid primary key default gen_random_uuid(),
  information_request_id uuid not null
    references public.information_requests(id) on delete restrict,
  amount_cents bigint not null check (amount_cents between 1 and 9007199254740991),
  currency_code text not null default 'MXN' check (currency_code = 'MXN'),
  payment_date date not null,
  payment_method_id uuid not null references public.payment_methods(id) on delete restrict,
  method_code_snapshot text not null,
  method_label_es_snapshot text not null,
  method_label_en_snapshot text not null,
  reference_full text not null check (char_length(reference_full) between 1 and 160),
  reference_masked text not null check (char_length(reference_masked) between 2 and 24),
  replacement_for_payment_id uuid references public.reservation_payments(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  resulting_financials jsonb not null,
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text check (void_reason is null or char_length(btrim(void_reason)) between 5 and 500),
  constraint reservation_payments_void_complete check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and void_reason is not null)
  )
);

create unique index reservation_payments_active_reference_unique
on public.reservation_payments (
  information_request_id,
  lower(reference_full)
)
where voided_at is null
  and method_code_snapshot <> 'cash';

create unique index reservation_payments_cash_reference_unique
on public.reservation_payments (reference_full)
where method_code_snapshot = 'cash';

create index reservation_payments_request_recorded_idx
on public.reservation_payments (information_request_id, recorded_at, id);

create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  information_request_id uuid not null
    references public.information_requests(id) on delete restrict,
  payment_id uuid not null unique
    references public.reservation_payments(id) on delete restrict,
  receipt_sequence integer not null check (receipt_sequence > 0),
  receipt_number text not null unique,
  receipt_type text not null check (receipt_type in ('partial', 'final', 'final_credit')),
  language text not null check (language in ('es', 'en')),
  issued_at timestamptz not null,
  snapshot_schema_version integer not null default 1 check (snapshot_schema_version = 1),
  snapshot jsonb not null,
  content_checksum text not null check (content_checksum ~ '^[0-9a-f]{64}$'),
  verification_code_hash text not null unique check (verification_code_hash ~ '^[0-9a-f]{64}$'),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  unique (information_request_id, receipt_sequence)
);

create index payment_receipts_request_issued_idx
on public.payment_receipts (information_request_id, issued_at, id);

create table public.payment_void_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null references public.reservation_payments(id) on delete restrict,
  information_request_id uuid not null references public.information_requests(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  voided_at timestamptz not null default now(),
  voided_by uuid not null references auth.users(id),
  resulting_financials jsonb not null
);

create unique index payment_void_events_one_per_payment
on public.payment_void_events (payment_id);

create table public.quote_revision_events (
  id bigint generated always as identity primary key,
  information_request_id uuid not null references public.information_requests(id) on delete restrict,
  previous_total_cents bigint,
  new_total_cents bigint not null check (new_total_cents > 0),
  reason text check (reason is null or char_length(btrim(reason)) between 5 and 500),
  changed_at timestamptz not null default now(),
  changed_by uuid not null references auth.users(id),
  resulting_financials jsonb not null
);

create table public.credit_resolution_events (
  id bigint generated always as identity primary key,
  information_request_id uuid not null references public.information_requests(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  resolution_date date not null,
  reference_full text not null check (char_length(reference_full) between 1 and 160),
  reference_masked text not null check (char_length(reference_masked) between 2 and 24),
  internal_note text check (internal_note is null or char_length(btrim(internal_note)) <= 1000),
  resolved_at timestamptz not null default now(),
  resolved_by uuid not null references auth.users(id),
  resulting_financials jsonb not null
);

create index credit_resolution_events_request_idx
on public.credit_resolution_events (information_request_id, resolved_at, id);

alter table public.payment_methods enable row level security;
alter table public.reservation_payments enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.payment_void_events enable row level security;
alter table public.quote_revision_events enable row level security;
alter table public.credit_resolution_events enable row level security;

create policy "Active management reads payment methods"
on public.payment_methods for select to authenticated
using (public.is_active_admin());
create policy "Active management reads reservation payments"
on public.reservation_payments for select to authenticated
using (public.is_active_admin());
create policy "Active management reads payment receipts"
on public.payment_receipts for select to authenticated
using (public.is_active_admin());
create policy "Active management reads payment void events"
on public.payment_void_events for select to authenticated
using (public.is_active_admin());
create policy "Active management reads quote revision events"
on public.quote_revision_events for select to authenticated
using (public.is_active_admin());
create policy "Active management reads credit resolution events"
on public.credit_resolution_events for select to authenticated
using (public.is_active_admin());

revoke all on public.payment_methods from public, anon, authenticated;
revoke all on public.reservation_payments from public, anon, authenticated;
revoke all on public.payment_receipts from public, anon, authenticated;
revoke all on public.payment_void_events from public, anon, authenticated;
revoke all on public.quote_revision_events from public, anon, authenticated;
revoke all on public.credit_resolution_events from public, anon, authenticated;
grant select on public.payment_methods to authenticated;
grant select on public.reservation_payments to authenticated;
grant select on public.payment_receipts to authenticated;
grant select on public.payment_void_events to authenticated;
grant select on public.quote_revision_events to authenticated;
grant select on public.credit_resolution_events to authenticated;

create function public.prevent_append_only_change_v10_7()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception '% records are append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger payment_receipts_no_update_or_delete
before update or delete on public.payment_receipts
for each row execute function public.prevent_append_only_change_v10_7();
create trigger payment_void_events_no_update_or_delete
before update or delete on public.payment_void_events
for each row execute function public.prevent_append_only_change_v10_7();
create trigger quote_revision_events_no_update_or_delete
before update or delete on public.quote_revision_events
for each row execute function public.prevent_append_only_change_v10_7();
create trigger credit_resolution_events_no_update_or_delete
before update or delete on public.credit_resolution_events
for each row execute function public.prevent_append_only_change_v10_7();

create function public.protect_reservation_payment_v10_7()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Verified payments cannot be deleted' using errcode = '42501';
  end if;
  if new.id is distinct from old.id
     or new.information_request_id is distinct from old.information_request_id
     or new.amount_cents is distinct from old.amount_cents
     or new.currency_code is distinct from old.currency_code
     or new.payment_date is distinct from old.payment_date
     or new.payment_method_id is distinct from old.payment_method_id
     or new.method_code_snapshot is distinct from old.method_code_snapshot
     or new.method_label_es_snapshot is distinct from old.method_label_es_snapshot
     or new.method_label_en_snapshot is distinct from old.method_label_en_snapshot
     or new.reference_full is distinct from old.reference_full
     or new.reference_masked is distinct from old.reference_masked
     or new.replacement_for_payment_id is distinct from old.replacement_for_payment_id
     or new.recorded_at is distinct from old.recorded_at
     or new.recorded_by is distinct from old.recorded_by
     or new.resulting_financials is distinct from old.resulting_financials then
    raise exception 'Verified payment facts are immutable' using errcode = '42501';
  end if;
  if old.voided_at is not null then
    raise exception 'A voided payment cannot be changed' using errcode = '42501';
  end if;
  if new.voided_at is null or new.voided_by is null or nullif(btrim(new.void_reason), '') is null then
    raise exception 'Payments may only be updated by a complete void operation' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reservation_payments_protect
before update or delete on public.reservation_payments
for each row execute function public.protect_reservation_payment_v10_7();

revoke all on function public.prevent_append_only_change_v10_7()
from public, anon, authenticated;
revoke all on function public.protect_reservation_payment_v10_7()
from public, anon, authenticated;

create function public.mask_payment_reference(p_reference text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_reference text := btrim(p_reference);
  v_length integer := char_length(v_reference);
begin
  if v_length >= 7 then
    return '••••' || right(v_reference, 4);
  elsif v_length >= 3 then
    return repeat('•', greatest(v_length - 2, 2)) || right(v_reference, 2);
  end if;
  return repeat('•', greatest(v_length, 2));
end;
$$;

revoke all on function public.mask_payment_reference(text) from public, anon, authenticated;

create function public.calculate_information_request_financials(p_request_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with request_data as (
    select request.id,
      case when request.pricing_status = 'estimated' then request.estimated_total_cents::bigint end as quote,
      request.status
    from public.information_requests request
    where request.id = p_request_id
  ), totals as (
    select request_data.*,
      coalesce((
        select sum(payment.amount_cents)
        from public.reservation_payments payment
        where payment.information_request_id = request_data.id
          and payment.voided_at is null
      ), 0)::bigint as gross,
      coalesce((
        select sum(resolution.amount_cents)
        from public.credit_resolution_events resolution
        where resolution.information_request_id = request_data.id
      ), 0)::bigint as resolved,
      exists (
        select 1 from public.reservation_payments payment
        where payment.information_request_id = request_data.id
      ) as has_payment_history,
      exists (
        select 1 from public.payment_receipts receipt
        where receipt.information_request_id = request_data.id
          and receipt.receipt_type in ('final', 'final_credit')
      ) as has_final_receipt
    from request_data
  ), calculated as (
    select *, greatest(gross - resolved, 0)::bigint as effective
    from totals
  )
  select jsonb_build_object(
    'quoted_total_cents', quote,
    'gross_verified_cents', gross,
    'resolved_credit_cents', resolved,
    'verified_paid_cents', effective,
    'balance_due_cents', case when quote is null then null else greatest(quote - effective, 0) end,
    'credit_cents', case when quote is null then 0 else greatest(gross - quote - resolved, 0) end,
    'payment_status', case
      when quote is null then 'quote_required'
      when effective = 0 then 'unpaid'
      when effective < quote then 'partially_paid'
      when greatest(gross - quote - resolved, 0) > 0 then 'paid_in_full_with_credit'
      else 'paid_in_full'
    end,
    'quote_locked', has_final_receipt,
    'staff_review_required', status = 'booked' and has_payment_history and gross = 0
  )
  from calculated;
$$;

revoke all on function public.calculate_information_request_financials(uuid)
from public, anon, authenticated;

create function public.save_payment_method(
  p_method_id uuid,
  p_code text,
  p_label_es text,
  p_label_en text,
  p_reference_behavior text,
  p_is_active boolean,
  p_display_order integer
)
returns public.payment_methods
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_method public.payment_methods;
  v_code text := lower(btrim(p_code));
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;
  if v_code !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'Payment method code is invalid';
  end if;
  if p_reference_behavior not in ('external_required', 'internal_cash') then
    raise exception 'Payment reference behavior is invalid';
  end if;
  if p_display_order < 0 then
    raise exception 'Payment method display order is invalid';
  end if;

  if p_method_id is null then
    insert into public.payment_methods (
      code, label_es, label_en, reference_behavior, is_active, display_order,
      created_by, updated_by
    ) values (
      v_code, btrim(p_label_es), btrim(p_label_en), p_reference_behavior,
      coalesce(p_is_active, true), p_display_order, auth.uid(), auth.uid()
    ) returning * into v_method;
  else
    update public.payment_methods
    set label_es = btrim(p_label_es),
        label_en = btrim(p_label_en),
        reference_behavior = p_reference_behavior,
        is_active = p_is_active,
        display_order = p_display_order,
        updated_at = now(),
        updated_by = auth.uid()
    where id = p_method_id
      and code = v_code
    returning * into v_method;
    if v_method.id is null then
      raise exception 'Payment method not found or stable code changed';
    end if;
  end if;
  return v_method;
end;
$$;

revoke all on function public.save_payment_method(uuid, text, text, text, text, boolean, integer)
from public;
grant execute on function public.save_payment_method(uuid, text, text, text, text, boolean, integer)
to authenticated;

create function public.record_verified_payment(
  p_request_id uuid,
  p_amount_cents bigint,
  p_payment_date date,
  p_payment_method_id uuid,
  p_reference text default null,
  p_receipt_language text default null,
  p_replacement_for_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_method public.payment_methods;
  v_payment public.reservation_payments;
  v_actor_name text;
  v_reference text;
  v_masked text;
  v_sequence integer;
  v_folio text;
  v_receipt_number text;
  v_receipt_type text;
  v_language text;
  v_now timestamptz := now();
  v_gross_before bigint;
  v_gross_after bigint;
  v_resolved bigint;
  v_effective bigint;
  v_balance bigint;
  v_credit bigint;
  v_financials jsonb;
  v_verification_code text;
  v_verification_hash text;
  v_snapshot jsonb;
  v_checksum text;
  v_payment_id uuid := gen_random_uuid();
  v_receipt_id uuid := gen_random_uuid();
  v_service_es text;
  v_service_en text;
begin
  if not public.is_active_admin() then
    raise exception 'Active management access required' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents not between 1 and 9007199254740991 then
    raise exception 'Payment amount must be positive';
  end if;
  if p_payment_date is null then
    raise exception 'Payment date is required';
  end if;
  if p_payment_date > (v_now at time zone 'America/Mexico_City')::date then
    raise exception 'Future payment dates are not allowed';
  end if;

  select * into v_request
  from public.information_requests
  where id = p_request_id
  for update;
  if v_request.id is null then
    raise exception 'Information request not found';
  end if;
  if v_request.status not in ('new', 'booked') then
    raise exception 'Request status does not accept payments';
  end if;
  if v_request.pricing_status <> 'estimated'
     or v_request.estimated_total_cents is null
     or v_request.estimated_total_cents <= 0 then
    raise exception 'An authoritative positive quoted total is required';
  end if;

  select * into v_method from public.payment_methods
  where id = p_payment_method_id and is_active
  for share;
  if v_method.id is null then
    raise exception 'An active payment method is required';
  end if;

  if p_replacement_for_payment_id is not null and not exists (
    select 1 from public.reservation_payments replaced
    where replaced.id = p_replacement_for_payment_id
      and replaced.information_request_id = p_request_id
      and replaced.voided_at is not null
  ) then
    raise exception 'Replacement payment must reference a voided payment on this request';
  end if;

  select coalesce(max(receipt.receipt_sequence), 0) + 1 into v_sequence
  from public.payment_receipts receipt
  where receipt.information_request_id = p_request_id;
  v_folio := 'SOL-' || lpad(v_request.request_number::text, 6, '0');
  v_receipt_number := 'RCP-' || v_folio || '-' || lpad(v_sequence::text, 2, '0');

  if v_method.reference_behavior = 'internal_cash' then
    v_reference := 'CASH-' || v_folio || '-' || lpad(v_sequence::text, 3, '0');
  else
    v_reference := nullif(btrim(p_reference), '');
    if v_reference is null or char_length(v_reference) not between 1 and 160 then
      raise exception 'Payment reference is required';
    end if;
  end if;
  v_masked := public.mask_payment_reference(v_reference);

  select coalesce(sum(payment.amount_cents), 0) into v_gross_before
  from public.reservation_payments payment
  where payment.information_request_id = p_request_id
    and payment.voided_at is null;
  select coalesce(sum(resolution.amount_cents), 0) into v_resolved
  from public.credit_resolution_events resolution
  where resolution.information_request_id = p_request_id;

  v_gross_after := v_gross_before + p_amount_cents;
  v_effective := greatest(v_gross_after - v_resolved, 0);
  v_balance := greatest(v_request.estimated_total_cents::bigint - v_effective, 0);
  v_credit := greatest(v_gross_after - v_request.estimated_total_cents::bigint - v_resolved, 0);
  v_receipt_type := case
    when v_effective < v_request.estimated_total_cents then 'partial'
    when v_credit > 0 then 'final_credit'
    else 'final'
  end;

  select access.language into v_language
  from public.information_request_access access
  where access.information_request_id = p_request_id
    and access.revoked_at is null
    and public.information_request_public_access_eligible(v_request.status, v_request.closed_at)
  order by access.created_at desc
  limit 1;
  if v_language is null then
    if p_receipt_language not in ('es', 'en') then
      raise exception 'Receipt language is required when no active private link exists';
    end if;
    v_language := p_receipt_language;
  end if;

  select profile.display_name into v_actor_name
  from public.admin_profiles profile
  where profile.user_id = auth.uid() and profile.active;

  select
    coalesce(service_version.name_es, v_request.quote_snapshot->'service'->>'name_es', 'Cebolletas Copal'),
    coalesce(service_version.name_en, v_request.quote_snapshot->'service'->>'name_en', 'Cebolletas Copal')
  into v_service_es, v_service_en
  from (select 1) singleton
  left join public.service_versions service_version
    on service_version.id = v_request.selected_service_version_id;

  v_financials := jsonb_build_object(
    'quoted_total_cents', v_request.estimated_total_cents,
    'gross_verified_cents', v_gross_after,
    'resolved_credit_cents', v_resolved,
    'verified_paid_cents', v_effective,
    'balance_due_cents', v_balance,
    'credit_cents', v_credit,
    'payment_status', case
      when v_effective < v_request.estimated_total_cents then 'partially_paid'
      when v_credit > 0 then 'paid_in_full_with_credit'
      else 'paid_in_full'
    end,
    'quote_locked', v_receipt_type in ('final', 'final_credit'),
    'staff_review_required', false
  );

  insert into public.reservation_payments (
    id, information_request_id, amount_cents, payment_date, payment_method_id,
    method_code_snapshot, method_label_es_snapshot, method_label_en_snapshot,
    reference_full, reference_masked, replacement_for_payment_id,
    recorded_at, recorded_by, resulting_financials
  ) values (
    v_payment_id, p_request_id, p_amount_cents, p_payment_date, v_method.id,
    v_method.code, v_method.label_es, v_method.label_en,
    v_reference, v_masked, p_replacement_for_payment_id,
    v_now, auth.uid(), v_financials
  ) returning * into v_payment;

  v_verification_code := encode(extensions.gen_random_bytes(24), 'hex');
  v_verification_hash := encode(extensions.digest(v_verification_code, 'sha256'), 'hex');
  v_snapshot := jsonb_build_object(
    'schema_version', 1,
    'receipt_number', v_receipt_number,
    'receipt_type', v_receipt_type,
    'language', v_language,
    'request_folio', v_folio,
    'issued_at', v_now,
    'payment_date', p_payment_date,
    'payment_amount_cents', p_amount_cents,
    'accumulated_verified_cents', v_effective,
    'gross_verified_cents', v_gross_after,
    'quoted_total_cents', v_request.estimated_total_cents,
    'balance_due_cents', v_balance,
    'credit_cents', v_credit,
    'currency_code', 'MXN',
    'payment_method', jsonb_build_object(
      'code', v_method.code,
      'label_es', v_method.label_es,
      'label_en', v_method.label_en
    ),
    'masked_reference', v_masked,
    'beneficiary', jsonb_build_object(
      'name', coalesce(v_request.designated_contact_name, v_request.customer_name),
      'phone', coalesce(v_request.designated_contact_phone, v_request.customer_cellphone),
      'email', coalesce(v_request.designated_contact_email, v_request.customer_email)
    ),
    'request_contact', case when v_request.designated_contact_name is not null then jsonb_build_object(
      'name', v_request.customer_name,
      'phone', v_request.customer_cellphone,
      'email', v_request.customer_email
    ) end,
    'service', jsonb_build_object('name_es', v_service_es, 'name_en', v_service_en),
    'stay', jsonb_build_object('checkin_date', v_request.checkin_date, 'checkout_date', v_request.checkout_date),
    'guests', jsonb_build_object('adults', v_request.adults, 'children', v_request.children, 'infants', v_request.infants),
    'identities', jsonb_build_object('cebolletas', 'Cebolletas', 'copal', 'Cebolletas Copal'),
    'recorded_by', auth.uid(),
    'recorded_by_display_name', coalesce(v_actor_name, 'Management staff'),
    'verification_code', v_verification_code,
    'verification_url', 'https://cebolletas.mx/copal/verificar-recibo/#code=' || v_verification_code
  );
  v_checksum := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');

  insert into public.payment_receipts (
    id, information_request_id, payment_id, receipt_sequence, receipt_number,
    receipt_type, language, issued_at, snapshot, content_checksum,
    verification_code_hash
  ) values (
    v_receipt_id, p_request_id, v_payment_id, v_sequence, v_receipt_number,
    v_receipt_type, v_language, v_now, v_snapshot, v_checksum,
    v_verification_hash
  );

  if v_request.status = 'new' then
    update public.information_requests
    set status = 'booked',
        status_reason = 'First verified payment received',
        status_notes = null,
        status_changed_at = v_now
    where id = p_request_id;

    insert into public.information_request_status_history (
      information_request_id, previous_status, new_status, actor_type,
      changed_by, actor_display_name, reason
    ) values (
      p_request_id, 'new', 'booked', 'administrator', auth.uid(),
      coalesce(v_actor_name, 'Management staff'), 'First verified payment received'
    );
  else
    update public.information_requests set updated_at = v_now where id = p_request_id;
  end if;

  return jsonb_build_object(
    'payment_id', v_payment_id,
    'receipt_id', v_receipt_id,
    'receipt_number', v_receipt_number,
    'receipt_type', v_receipt_type,
    'financials', v_financials,
    'status_transition', case when v_request.status = 'new' then 'new_to_booked' else null end
  );
end;
$$;

revoke all on function public.record_verified_payment(uuid, bigint, date, uuid, text, text, uuid)
from public;
grant execute on function public.record_verified_payment(uuid, bigint, date, uuid, text, text, uuid)
to authenticated;

-- Only this definer function needs to update receipt validity. ALTER TABLE in a
-- function is intentionally avoided below by replacing the trigger guard with
-- a transaction-local authorization flag.
create or replace function public.prevent_append_only_change_v10_7()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'payment_receipts'
     and tg_op = 'UPDATE'
     and current_setting('cebolletas.receipt_void_operation', true) = 'allowed'
     and new.id is not distinct from old.id
     and new.information_request_id is not distinct from old.information_request_id
     and new.payment_id is not distinct from old.payment_id
     and new.receipt_sequence is not distinct from old.receipt_sequence
     and new.receipt_number is not distinct from old.receipt_number
     and new.receipt_type is not distinct from old.receipt_type
     and new.language is not distinct from old.language
     and new.issued_at is not distinct from old.issued_at
     and new.snapshot_schema_version is not distinct from old.snapshot_schema_version
     and new.snapshot is not distinct from old.snapshot
     and new.content_checksum is not distinct from old.content_checksum
     and new.verification_code_hash is not distinct from old.verification_code_hash
     and old.voided_at is null
     and new.voided_at is not null
     and new.voided_by is not null then
    return new;
  end if;
  raise exception '% records are append-only', tg_table_name using errcode = '42501';
end;
$$;

create or replace function public.void_verified_payment(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment public.reservation_payments;
  v_request public.information_requests;
  v_reason text := nullif(btrim(p_reason), '');
  v_now timestamptz := now();
  v_gross bigint;
  v_resolved bigint;
  v_effective bigint;
  v_balance bigint;
  v_credit bigint;
  v_financials jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Active management access required' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 500 then
    raise exception 'A void reason is required';
  end if;

  select * into v_payment from public.reservation_payments where id = p_payment_id;
  if v_payment.id is null then raise exception 'Payment not found'; end if;
  select * into v_request from public.information_requests
  where id = v_payment.information_request_id for update;
  select * into v_payment from public.reservation_payments
  where id = p_payment_id for update;
  if v_payment.voided_at is not null then raise exception 'Payment is already voided'; end if;

  select coalesce(sum(payment.amount_cents), 0) - v_payment.amount_cents into v_gross
  from public.reservation_payments payment
  where payment.information_request_id = v_request.id and payment.voided_at is null;
  select coalesce(sum(resolution.amount_cents), 0) into v_resolved
  from public.credit_resolution_events resolution
  where resolution.information_request_id = v_request.id;
  if v_resolved > greatest(v_gross - v_request.estimated_total_cents::bigint, 0) then
    raise exception 'Payment cannot be voided because resolved credit would exceed resulting credit';
  end if;

  v_effective := greatest(v_gross - v_resolved, 0);
  v_balance := greatest(v_request.estimated_total_cents::bigint - v_effective, 0);
  v_credit := greatest(v_gross - v_request.estimated_total_cents::bigint - v_resolved, 0);
  v_financials := jsonb_build_object(
    'quoted_total_cents', v_request.estimated_total_cents,
    'gross_verified_cents', v_gross,
    'resolved_credit_cents', v_resolved,
    'verified_paid_cents', v_effective,
    'balance_due_cents', v_balance,
    'credit_cents', v_credit,
    'payment_status', case
      when v_effective = 0 then 'unpaid'
      when v_effective < v_request.estimated_total_cents then 'partially_paid'
      when v_credit > 0 then 'paid_in_full_with_credit'
      else 'paid_in_full'
    end,
    'quote_locked', exists (
      select 1 from public.payment_receipts receipt
      where receipt.information_request_id = v_request.id
        and receipt.receipt_type in ('final', 'final_credit')
    ),
    'staff_review_required', v_request.status = 'booked' and v_gross = 0
  );

  insert into public.payment_void_events (
    payment_id, information_request_id, reason, voided_at, voided_by,
    resulting_financials
  ) values (
    v_payment.id, v_request.id, v_reason, v_now, auth.uid(), v_financials
  );
  update public.reservation_payments
  set voided_at = v_now, voided_by = auth.uid(), void_reason = v_reason
  where id = v_payment.id;
  perform set_config('cebolletas.receipt_void_operation', 'allowed', true);
  update public.payment_receipts
  set voided_at = v_now, voided_by = auth.uid()
  where payment_id = v_payment.id;
  update public.information_requests set updated_at = v_now where id = v_request.id;

  return jsonb_build_object('payment_id', v_payment.id, 'financials', v_financials);
end;
$$;

revoke all on function public.void_verified_payment(uuid, text) from public;
grant execute on function public.void_verified_payment(uuid, text) to authenticated;

create function public.resolve_information_request_credit(
  p_request_id uuid,
  p_resolution_date date,
  p_reference text,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_reference text := nullif(btrim(p_reference), '');
  v_note text := nullif(btrim(p_internal_note), '');
  v_before jsonb;
  v_credit bigint;
  v_after jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Active management access required' using errcode = '42501';
  end if;
  if p_resolution_date is null then raise exception 'Credit resolution date is required'; end if;
  if p_resolution_date > (now() at time zone 'America/Mexico_City')::date then
    raise exception 'Future credit resolution dates are not allowed';
  end if;
  if v_reference is null or char_length(v_reference) not between 1 and 160 then
    raise exception 'Credit resolution reference is required';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'Credit resolution note is too long';
  end if;

  select * into v_request from public.information_requests
  where id = p_request_id for update;
  if v_request.id is null then raise exception 'Information request not found'; end if;
  v_before := public.calculate_information_request_financials(p_request_id);
  v_credit := coalesce((v_before->>'credit_cents')::bigint, 0);
  if v_credit <= 0 then raise exception 'No outstanding credit is available to resolve'; end if;

  v_after := jsonb_build_object(
    'quoted_total_cents', (v_before->>'quoted_total_cents')::bigint,
    'gross_verified_cents', (v_before->>'gross_verified_cents')::bigint,
    'resolved_credit_cents', (v_before->>'resolved_credit_cents')::bigint + v_credit,
    'verified_paid_cents', (v_before->>'verified_paid_cents')::bigint - v_credit,
    'balance_due_cents', 0,
    'credit_cents', 0,
    'payment_status', 'paid_in_full',
    'quote_locked', (v_before->>'quote_locked')::boolean,
    'staff_review_required', false
  );
  insert into public.credit_resolution_events (
    information_request_id, amount_cents, resolution_date,
    reference_full, reference_masked, internal_note, resolved_by,
    resulting_financials
  ) values (
    p_request_id, v_credit, p_resolution_date,
    v_reference, public.mask_payment_reference(v_reference), v_note, auth.uid(),
    v_after
  );
  update public.information_requests set updated_at = now() where id = p_request_id;
  return jsonb_build_object('resolved_credit_cents', v_credit, 'financials', v_after);
end;
$$;

revoke all on function public.resolve_information_request_credit(uuid, date, text, text)
from public;
grant execute on function public.resolve_information_request_credit(uuid, date, text, text)
to authenticated;

create function public.revise_information_request_quote(
  p_request_id uuid,
  p_new_total_cents bigint,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_reason text := nullif(btrim(p_reason), '');
  v_gross bigint;
  v_has_payments boolean;
  v_financials jsonb;
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;
  if p_new_total_cents is null or p_new_total_cents not between 1 and 2147483647 then
    raise exception 'Quoted total must be positive';
  end if;

  select * into v_request from public.information_requests
  where id = p_request_id for update;
  if v_request.id is null then raise exception 'Information request not found'; end if;
  if v_request.status not in ('new', 'booked') then
    raise exception 'Request status does not accept quote revisions';
  end if;
  if exists (
    select 1 from public.payment_receipts receipt
    where receipt.information_request_id = p_request_id
      and receipt.receipt_type in ('final', 'final_credit')
  ) then
    raise exception 'Quoted total is locked because a final receipt exists';
  end if;

  select coalesce(sum(payment.amount_cents) filter (where payment.voided_at is null), 0), count(*) > 0
  into v_gross, v_has_payments
  from public.reservation_payments payment
  where payment.information_request_id = p_request_id;
  if p_new_total_cents < v_gross then
    raise exception 'Quoted total cannot be lower than active verified payments';
  end if;
  if v_has_payments and (v_reason is null or char_length(v_reason) < 5) then
    raise exception 'A quote revision reason is required after payment activity';
  end if;
  if v_reason is not null and char_length(v_reason) > 500 then
    raise exception 'Quote revision reason is too long';
  end if;

  update public.information_requests
  set pricing_status = 'estimated',
      estimated_total_cents = p_new_total_cents,
      currency_code = 'MXN',
      quote_snapshot = jsonb_set(
        jsonb_set(
          coalesce(quote_snapshot, '{}'::jsonb),
          '{pricing_status}', '"estimated"'::jsonb, true
        ),
        '{pricing,estimated_total_cents}', to_jsonb(p_new_total_cents), true
      )
  where id = p_request_id;

  v_financials := public.calculate_information_request_financials(p_request_id);
  insert into public.quote_revision_events (
    information_request_id, previous_total_cents, new_total_cents,
    reason, changed_by, resulting_financials
  ) values (
    p_request_id, v_request.estimated_total_cents, p_new_total_cents,
    v_reason, auth.uid(), v_financials
  );
  return v_financials;
end;
$$;

revoke all on function public.revise_information_request_quote(uuid, bigint, text)
from public;
grant execute on function public.revise_information_request_quote(uuid, bigint, text)
to authenticated;

create function public.get_information_request_financial_state(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_active_admin() then
    raise exception 'Active management access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.information_requests where id = p_request_id) then
    raise exception 'Information request not found';
  end if;

  select jsonb_build_object(
    'summary', public.calculate_information_request_financials(p_request_id),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', payment.id,
      'amount_cents', payment.amount_cents,
      'payment_date', payment.payment_date,
      'payment_method_id', payment.payment_method_id,
      'method_code', payment.method_code_snapshot,
      'method_label_es', payment.method_label_es_snapshot,
      'method_label_en', payment.method_label_en_snapshot,
      'reference_full', payment.reference_full,
      'reference_masked', payment.reference_masked,
      'replacement_for_payment_id', payment.replacement_for_payment_id,
      'recorded_at', payment.recorded_at,
      'recorded_by', payment.recorded_by,
      'recorded_by_name', recorder.display_name,
      'voided_at', payment.voided_at,
      'voided_by', payment.voided_by,
      'voided_by_name', voider.display_name,
      'void_reason', payment.void_reason,
      'receipt_id', receipt.id,
      'receipt_number', receipt.receipt_number,
      'receipt_type', receipt.receipt_type,
      'receipt_language', receipt.language,
      'receipt_checksum', receipt.content_checksum
    ) order by payment.recorded_at desc, payment.id desc)
      from public.reservation_payments payment
      left join public.admin_profiles recorder on recorder.user_id = payment.recorded_by
      left join public.admin_profiles voider on voider.user_id = payment.voided_by
      left join public.payment_receipts receipt on receipt.payment_id = payment.id
      where payment.information_request_id = p_request_id), '[]'::jsonb),
    'quote_revisions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', revision.id,
      'previous_total_cents', revision.previous_total_cents,
      'new_total_cents', revision.new_total_cents,
      'reason', revision.reason,
      'changed_at', revision.changed_at,
      'changed_by', revision.changed_by,
      'changed_by_name', actor.display_name
    ) order by revision.changed_at desc, revision.id desc)
      from public.quote_revision_events revision
      left join public.admin_profiles actor on actor.user_id = revision.changed_by
      where revision.information_request_id = p_request_id), '[]'::jsonb),
    'credit_resolutions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', resolution.id,
      'amount_cents', resolution.amount_cents,
      'resolution_date', resolution.resolution_date,
      'reference_full', resolution.reference_full,
      'reference_masked', resolution.reference_masked,
      'internal_note', resolution.internal_note,
      'resolved_at', resolution.resolved_at,
      'resolved_by', resolution.resolved_by,
      'resolved_by_name', actor.display_name
    ) order by resolution.resolved_at desc, resolution.id desc)
      from public.credit_resolution_events resolution
      left join public.admin_profiles actor on actor.user_id = resolution.resolved_by
      where resolution.information_request_id = p_request_id), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_information_request_financial_state(uuid) from public;
grant execute on function public.get_information_request_financial_state(uuid) to authenticated;

create or replace function public.build_information_request_customer_projection(
  p_request_id uuid,
  p_language text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'publication_language', p_language,
    'folio', 'SOL-' || lpad(request.request_number::text, 6, '0'),
    'status_label', case p_language
      when 'en' then case request.status
        when 'new' then 'Request received' when 'booked' then 'Request processed'
        when 'closed' then 'Completed request' when 'cancelled' then 'Cancelled request'
        when 'not_converted' then 'Request not converted' end
      else case request.status
        when 'new' then 'Solicitud recibida' when 'booked' then 'Solicitud procesada'
        when 'closed' then 'Solicitud concluida' when 'cancelled' then 'Solicitud cancelada'
        when 'not_converted' then 'Solicitud no convertida' end
    end,
    'beneficiary', jsonb_build_object(
      'name', coalesce(request.designated_contact_name, request.customer_name),
      'phone', coalesce(request.designated_contact_phone, request.customer_cellphone),
      'email', coalesce(request.designated_contact_email, request.customer_email)
    ),
    'request_contact', case when request.designated_contact_name is not null then jsonb_build_object(
      'name', request.customer_name, 'phone', request.customer_cellphone, 'email', request.customer_email
    ) end,
    'service', coalesce(
      case p_language when 'en' then service_version.name_en else service_version.name_es end,
      case when request.requested_services @> array['copal']::text[] then 'Cebolletas Copal'
        when request.requested_services @> array['camping']::text[] then 'Camping'
        when request.requested_services @> array['events']::text[] then case p_language when 'en' then 'Events' else 'Eventos' end
        else case p_language when 'en' then 'Requested service' else 'Servicio solicitado' end end
    ),
    'checkin_date', request.checkin_date,
    'checkout_date', request.checkout_date,
    'adults', request.adults,
    'children', request.children,
    'infants', request.infants,
    'quoted_total_cents', case when request.pricing_status = 'estimated' then request.estimated_total_cents end,
    'currency_code', case when request.pricing_status = 'estimated' then 'MXN' end,
    'financial', public.calculate_information_request_financials(request.id),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
      'payment_date', payment.payment_date,
      'amount_cents', payment.amount_cents,
      'method', case p_language when 'en' then payment.method_label_en_snapshot else payment.method_label_es_snapshot end,
      'masked_reference', payment.reference_masked,
      'receipt_number', receipt.receipt_number,
      'receipt_type', receipt.receipt_type,
      'receipt_language', receipt.language,
      'receipt_download_code', receipt.snapshot->>'verification_code'
    ) order by payment.payment_date, payment.recorded_at, payment.id)
      from public.reservation_payments payment
      join public.payment_receipts receipt on receipt.payment_id = payment.id
      where payment.information_request_id = request.id
        and payment.voided_at is null
        and receipt.voided_at is null), '[]'::jsonb),
    'credit_resolutions', coalesce((select jsonb_agg(jsonb_build_object(
      'resolution_date', resolution.resolution_date,
      'amount_cents', resolution.amount_cents,
      'masked_reference', resolution.reference_masked
    ) order by resolution.resolution_date, resolution.resolved_at)
      from public.credit_resolution_events resolution
      where resolution.information_request_id = request.id), '[]'::jsonb),
    'whatsapp', case when whatsapp.id is not null then jsonb_build_object(
      'display_name', whatsapp.display_name, 'phone_e164', whatsapp.phone_e164
    ) end,
    'last_updated_at', request.updated_at
  ))
  from public.information_requests request
  left join public.service_versions service_version on service_version.id = request.selected_service_version_id
  left join lateral (
    select recipient.id, recipient.display_name, recipient.phone_e164
    from public.management_settings settings
    join public.whatsapp_recipients recipient
      on recipient.id = settings.default_whatsapp_recipient_id and recipient.is_active
    where settings.singleton = true limit 1
  ) whatsapp on true
  where request.id = p_request_id and p_language in ('es', 'en')
  limit 1;
$$;

create function public.resolve_public_payment_receipt(
  p_token_hash text,
  p_verification_code_hash text
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select receipt.snapshot
  from public.information_request_access access
  join public.information_requests request on request.id = access.information_request_id
  join public.payment_receipts receipt on receipt.information_request_id = request.id
  join public.reservation_payments payment on payment.id = receipt.payment_id
  where access.token_hash = p_token_hash
    and access.revoked_at is null
    and public.information_request_public_access_eligible(request.status, request.closed_at)
    and receipt.verification_code_hash = p_verification_code_hash
    and receipt.voided_at is null
    and payment.voided_at is null
  limit 1;
$$;

create function public.build_payment_receipt_for_staff(p_receipt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select receipt.snapshot
  from public.payment_receipts receipt
  where receipt.id = p_receipt_id
  limit 1;
$$;

create function public.resolve_payment_receipt_verification(p_verification_code_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'identity', 'Cebolletas · Cebolletas Copal',
    'receipt_number', receipt.receipt_number,
    'issued_at', receipt.issued_at,
    'payment_amount_cents', (receipt.snapshot->>'payment_amount_cents')::bigint,
    'currency_code', 'MXN',
    'validity', case when receipt.voided_at is null then 'valid' else 'voided' end
  )
  from public.payment_receipts receipt
  where receipt.verification_code_hash = p_verification_code_hash
  limit 1;
$$;

revoke all on function public.resolve_public_payment_receipt(text, text) from public;
revoke all on function public.build_payment_receipt_for_staff(uuid) from public;
revoke all on function public.resolve_payment_receipt_verification(text) from public;
grant execute on function public.resolve_public_payment_receipt(text, text) to service_role;
grant execute on function public.build_payment_receipt_for_staff(uuid) to service_role;
grant execute on function public.resolve_payment_receipt_verification(text) to service_role;

comment on table public.reservation_payments is
  'Immutable verified-payment ledger. Voids preserve the original facts and are audited separately.';
comment on table public.payment_receipts is
  'Immutable receipt snapshots. Only current void validity metadata may change through the void RPC.';
comment on function public.record_verified_payment(uuid, bigint, date, uuid, text, text, uuid) is
  'Atomically records a verified payment, issues its receipt, calculates totals, and books a new request.';

notify pgrst, 'reload schema';
commit;
