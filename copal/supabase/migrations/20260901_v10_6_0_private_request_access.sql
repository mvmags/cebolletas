begin;

alter table public.information_requests
  add column designated_contact_name text,
  add column designated_contact_phone text,
  add column designated_contact_email text,
  add column closed_at timestamptz;

alter table public.information_requests
  add constraint information_requests_designated_contact_complete
  check (
    (
      designated_contact_name is null
      and designated_contact_phone is null
      and designated_contact_email is null
    )
    or
    (
      char_length(btrim(designated_contact_name)) between 5 and 100
      and char_length(btrim(designated_contact_email)) between 3 and 254
      and designated_contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
      and char_length(btrim(designated_contact_phone)) between 10 and 25
      and designated_contact_phone ~ '^\+?[0-9[:space:]().-]+$'
      and char_length(regexp_replace(designated_contact_phone, '[^0-9]', '', 'g')) between 10 and 15
    )
  );

update public.information_requests
set closed_at = status_changed_at
where status = 'closed'
  and closed_at is null;

alter table public.information_requests
  add constraint information_requests_closed_at_present
  check (status <> 'closed' or closed_at is not null);

create function public.enforce_information_request_closed_at_v10_6()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'closed' and new.status = 'closed' then
    new.closed_at := now();
  elsif old.status = 'closed' then
    new.closed_at := old.closed_at;
  elsif new.closed_at is distinct from old.closed_at then
    new.closed_at := old.closed_at;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_information_request_closed_at_v10_6()
from public, anon, authenticated;

create trigger enforce_information_request_closed_at_v10_6
before update of status, closed_at on public.information_requests
for each row
execute function public.enforce_information_request_closed_at_v10_6();

create table public.information_request_access (
  id uuid primary key default gen_random_uuid(),
  information_request_id uuid not null
    references public.information_requests(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  language text not null check (language in ('es', 'en')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  revoked_at timestamptz
);

create unique index information_request_access_one_active_per_request
on public.information_request_access (information_request_id)
where revoked_at is null;

create index information_request_access_request_created_idx
on public.information_request_access (information_request_id, created_at desc);

alter table public.information_request_access enable row level security;

revoke all on public.information_request_access
from public, anon, authenticated;

create function public.update_information_request_designated_contact(
  p_request_id uuid,
  p_name text,
  p_phone text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_request_status text;
  v_name text := nullif(btrim(p_name), '');
  v_phone text := nullif(btrim(p_phone), '');
  v_email text := nullif(lower(btrim(p_email)), '');
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;

  select request.id, request.status
  into v_request_id, v_request_status
  from public.information_requests
  request
  where request.id = p_request_id
  for update;

  if v_request_id is null then
    raise exception 'Information request not found';
  end if;

  if v_request_status <> 'new' then
    raise exception 'Designated contact can only be changed for new requests';
  end if;

  if v_name is null and v_phone is null and v_email is null then
    update public.information_requests
    set designated_contact_name = null,
        designated_contact_phone = null,
        designated_contact_email = null
    where id = p_request_id;
    return;
  end if;

  if v_name is null or v_phone is null or v_email is null then
    raise exception 'Designated contact name, phone, and email are all required';
  end if;

  if char_length(v_name) not between 5 and 100 then
    raise exception 'Designated contact name is invalid';
  end if;

  if char_length(v_email) not between 3 and 254
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' then
    raise exception 'Designated contact email is invalid';
  end if;

  if char_length(v_phone) not between 10 and 25
     or v_phone !~ '^\+?[0-9[:space:]().-]+$'
     or char_length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise exception 'Designated contact phone is invalid';
  end if;

  update public.information_requests
  set designated_contact_name = v_name,
      designated_contact_phone = v_phone,
      designated_contact_email = v_email
  where id = p_request_id;
end;
$$;

create function public.publish_information_request_access(
  p_request_id uuid,
  p_token_hash text,
  p_language text
)
returns table (language text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_id uuid;
  v_request_status text;
  v_access public.information_request_access;
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Token hash is invalid';
  end if;

  if p_language not in ('es', 'en') then
    raise exception 'Publication language is invalid';
  end if;

  select request.id, request.status
  into v_request_id, v_request_status
  from public.information_requests
  request
  where request.id = p_request_id
  for update;

  if v_request_id is null then
    raise exception 'Information request not found';
  end if;

  if v_request_status <> 'new' then
    raise exception 'Only new requests can be published';
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
    information_request_id,
    token_hash,
    language,
    created_by
  )
  values (
    p_request_id,
    p_token_hash,
    p_language,
    auth.uid()
  )
  returning * into v_access;

  return query select v_access.language, v_access.created_at;
end;
$$;

create function public.revoke_information_request_access(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.information_requests where id = p_request_id
  ) then
    raise exception 'Information request not found';
  end if;

  update public.information_request_access
  set revoked_at = now()
  where information_request_id = p_request_id
    and revoked_at is null;
end;
$$;

create function public.get_information_request_access_state(p_request_id uuid)
returns table (
  has_active_access boolean,
  language text,
  created_at timestamptz
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

  if not exists (
    select 1 from public.information_requests where id = p_request_id
  ) then
    raise exception 'Information request not found';
  end if;

  return query
  select
    (
      access.id is not null
      and (
        request.status in ('new', 'booked')
        or (
          request.status = 'closed'
          and request.closed_at is not null
          and now() <= request.closed_at + interval '7 days'
        )
      )
    ) as has_active_access,
    access.language,
    access.created_at
  from public.information_requests request
  left join lateral (
    select current_access.id, current_access.language, current_access.created_at
    from public.information_request_access current_access
    where current_access.information_request_id = request.id
      and current_access.revoked_at is null
    order by current_access.created_at desc
    limit 1
  ) access on true
  where request.id = p_request_id;
end;
$$;

create function public.revoke_information_request_access_on_status_v10_6()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('cancelled', 'not_converted')
     and new.status is distinct from old.status then
    update public.information_request_access
    set revoked_at = now()
    where information_request_id = new.id
      and revoked_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.revoke_information_request_access_on_status_v10_6()
from public, anon, authenticated;

create trigger revoke_information_request_access_on_status_v10_6
after update of status on public.information_requests
for each row
execute function public.revoke_information_request_access_on_status_v10_6();

create function public.build_information_request_customer_projection(
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
        when 'new' then 'Request received'
        when 'booked' then 'Request processed'
        when 'closed' then 'Completed request'
        when 'cancelled' then 'Cancelled request'
        when 'not_converted' then 'Request not converted'
      end
      else case request.status
        when 'new' then 'Solicitud recibida'
        when 'booked' then 'Solicitud procesada'
        when 'closed' then 'Solicitud concluida'
        when 'cancelled' then 'Solicitud cancelada'
        when 'not_converted' then 'Solicitud no convertida'
      end
    end,
    'beneficiary', jsonb_build_object(
      'name', coalesce(request.designated_contact_name, request.customer_name),
      'phone', coalesce(request.designated_contact_phone, request.customer_cellphone),
      'email', coalesce(request.designated_contact_email, request.customer_email)
    ),
    'request_contact', case
      when request.designated_contact_name is not null then jsonb_build_object(
        'name', request.customer_name,
        'phone', request.customer_cellphone,
        'email', request.customer_email
      )
    end,
    'service', coalesce(
      case p_language when 'en' then service_version.name_en else service_version.name_es end,
      case
        when request.requested_services @> array['copal']::text[] then 'Cebolletas Copal'
        when request.requested_services @> array['camping']::text[] then 'Camping'
        when request.requested_services @> array['events']::text[]
          then case p_language when 'en' then 'Events' else 'Eventos' end
        else case p_language when 'en' then 'Requested service' else 'Servicio solicitado' end
      end
    ),
    'checkin_date', request.checkin_date,
    'checkout_date', request.checkout_date,
    'adults', request.adults,
    'children', request.children,
    'infants', request.infants,
    'quoted_total_cents', case
      when request.pricing_status = 'estimated'
        and request.estimated_total_cents is not null
      then request.estimated_total_cents
    end,
    'currency_code', case
      when request.pricing_status = 'estimated'
        and request.estimated_total_cents is not null
      then 'MXN'
    end,
    'whatsapp', case when whatsapp.id is not null then jsonb_build_object(
      'display_name', whatsapp.display_name,
      'phone_e164', whatsapp.phone_e164
    ) end,
    'last_updated_at', request.updated_at
  ))
  from public.information_requests request
  left join public.service_versions service_version
    on service_version.id = request.selected_service_version_id
  left join lateral (
    select recipient.id, recipient.display_name, recipient.phone_e164
    from public.management_settings settings
    join public.whatsapp_recipients recipient
      on recipient.id = settings.default_whatsapp_recipient_id
     and recipient.is_active = true
    where settings.singleton = true
    limit 1
  ) whatsapp on true
  where request.id = p_request_id
    and p_language in ('es', 'en')
  limit 1;
$$;

create function public.resolve_public_information_request(p_token_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.build_information_request_customer_projection(
    access.information_request_id,
    access.language
  )
  from public.information_request_access access
  join public.information_requests request
    on request.id = access.information_request_id
  where p_token_hash ~ '^[0-9a-f]{64}$'
    and access.token_hash = p_token_hash
    and access.revoked_at is null
    and (
      request.status in ('new', 'booked')
      or (
        request.status = 'closed'
        and request.closed_at is not null
        and now() <= request.closed_at + interval '7 days'
      )
    )
  limit 1;
$$;

revoke all on function public.update_information_request_designated_contact(
  uuid, text, text, text
) from public;
revoke all on function public.publish_information_request_access(
  uuid, text, text
) from public;
revoke all on function public.revoke_information_request_access(uuid)
from public;
revoke all on function public.get_information_request_access_state(uuid)
from public;
revoke all on function public.build_information_request_customer_projection(
  uuid, text
) from public;
revoke all on function public.resolve_public_information_request(text)
from public;

grant execute on function public.update_information_request_designated_contact(
  uuid, text, text, text
) to authenticated;
grant execute on function public.publish_information_request_access(
  uuid, text, text
) to authenticated;
grant execute on function public.revoke_information_request_access(uuid)
to authenticated;
grant execute on function public.get_information_request_access_state(uuid)
to authenticated;
grant execute on function public.build_information_request_customer_projection(
  uuid, text
) to service_role;
grant execute on function public.resolve_public_information_request(text)
to service_role;

comment on table public.information_request_access is
  'Hashed bearer-token access records for private, read-only request summaries. Raw tokens are never stored.';

comment on column public.information_requests.closed_at is
  'Timestamp of the transition to closed. Unrelated edits cannot extend public access.';

comment on function public.resolve_public_information_request(text) is
  'Service-role-only customer projection. Returns no internal identifiers, notes, token hashes, or quote metadata.';

notify pgrst, 'reload schema';

commit;
