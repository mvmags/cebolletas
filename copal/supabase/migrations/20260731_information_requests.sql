begin;

create table public.information_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  submission_key uuid not null unique,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  locale text not null check (locale in ('es', 'en')),
  customer_name text not null
    check (char_length(btrim(customer_name)) between 5 and 100),
  customer_email text not null
    check (char_length(btrim(customer_email)) between 3 and 254),
  customer_cellphone text not null
    check (char_length(btrim(customer_cellphone)) between 10 and 25),
  checkin_date date not null,
  checkout_date date not null,
  adults integer not null check (adults between 1 and 20),
  children integer not null check (children between 0 and 20),
  requested_services text[] not null,
  customer_message text
    check (customer_message is null or char_length(customer_message) <= 1000),
  status text not null default 'new'
    check (status in ('new', 'booked', 'closed', 'cancelled', 'not_converted')),
  status_reason text,
  status_notes text check (status_notes is null or char_length(status_notes) <= 1000),
  status_changed_at timestamptz not null default now(),
  constraint information_requests_dates_valid
    check (checkout_date > checkin_date),
  constraint information_requests_services_valid
    check (
      cardinality(requested_services) between 1 and 3
      and requested_services <@ array['copal', 'camping', 'events']::text[]
    )
);

create table public.information_request_status_history (
  id bigint generated always as identity primary key,
  information_request_id uuid not null
    references public.information_requests(id) on delete cascade,
  previous_status text
    check (
      previous_status is null
      or previous_status in ('new', 'booked', 'closed', 'cancelled', 'not_converted')
    ),
  new_status text not null
    check (new_status in ('new', 'booked', 'closed', 'cancelled', 'not_converted')),
  actor_type text not null check (actor_type in ('visitor', 'administrator', 'system')),
  changed_by uuid,
  actor_display_name text not null,
  reason text,
  notes text check (notes is null or char_length(notes) <= 1000),
  changed_at timestamptz not null default now()
);

create index information_requests_status_checkout_idx
  on public.information_requests (status, checkout_date);

create index information_requests_submitted_at_idx
  on public.information_requests (submitted_at desc);

create index information_request_history_request_idx
  on public.information_request_status_history (
    information_request_id,
    changed_at desc
  );

create trigger information_requests_touch_updated_at
before update on public.information_requests
for each row execute function public.touch_updated_at();

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
  p_requested_services text[],
  p_customer_message text default null
)
returns table (request_id uuid, request_number bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_services text[];
  v_name text := btrim(p_customer_name);
  v_email text := lower(btrim(p_customer_email));
  v_cellphone text := btrim(p_customer_cellphone);
  v_message text := nullif(btrim(p_customer_message), '');
  v_created boolean := false;
begin
  if p_submission_key is null then
    raise exception 'Submission key is required';
  end if;

  select array_agg(service order by service)
    into v_services
  from (
    select distinct unnest(p_requested_services) as service
  ) selected;

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

  if p_adults not between 1 and 20 or p_children not between 0 and 20 then
    raise exception 'Guest counts are invalid';
  end if;

  if coalesce(cardinality(v_services), 0) not between 1 and 3
     or not v_services <@ array['copal', 'camping', 'events']::text[] then
    raise exception 'Requested services are invalid';
  end if;

  if v_message is not null and char_length(v_message) > 1000 then
    raise exception 'Customer message is too long';
  end if;

  select *
    into v_request
  from public.information_requests
  where submission_key = p_submission_key;

  if v_request.id is null then
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
      requested_services,
      customer_message
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
      v_services,
      v_message
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
  end if;

  return query select v_request.id, v_request.request_number;
end;
$$;

create or replace function public.change_information_request_status(
  p_request_id uuid,
  p_expected_status text,
  p_new_status text,
  p_reason text default null,
  p_notes text default null
)
returns public.information_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.information_requests;
  v_reason text := nullif(btrim(p_reason), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_today date := (now() at time zone 'America/Mexico_City')::date;
  v_actor_name text;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select *
    into v_request
  from public.information_requests
  where id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Information request not found';
  end if;

  if v_request.status <> p_expected_status then
    raise exception 'Status conflict';
  end if;

  if not (
    (v_request.status = 'new' and p_new_status in ('booked', 'not_converted'))
    or (v_request.status = 'booked' and p_new_status in ('closed', 'cancelled'))
    or (v_request.status = 'not_converted' and p_new_status = 'new')
  ) then
    raise exception 'Invalid status transition';
  end if;

  if p_new_status = 'closed' and v_request.checkout_date >= v_today then
    raise exception 'Checkout date must have passed before closing';
  end if;

  if p_new_status = 'not_converted' and v_reason is null then
    raise exception 'A not-converted reason is required';
  end if;

  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'Status notes are too long';
  end if;

  select display_name
    into v_actor_name
  from public.admin_profiles
  where user_id = auth.uid()
    and active = true;

  update public.information_requests
     set status = p_new_status,
         status_reason = v_reason,
         status_notes = v_notes,
         status_changed_at = now()
   where id = v_request.id
   returning * into v_request;

  insert into public.information_request_status_history (
    information_request_id,
    previous_status,
    new_status,
    actor_type,
    changed_by,
    actor_display_name,
    reason,
    notes
  )
  values (
    v_request.id,
    p_expected_status,
    p_new_status,
    'administrator',
    auth.uid(),
    coalesce(v_actor_name, 'Administrator'),
    v_reason,
    v_notes
  );

  return v_request;
end;
$$;

create or replace function public.expire_information_requests()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.information_requests
       set status = 'not_converted',
           status_reason = 'Requested dates passed without booking',
           status_notes = null,
           status_changed_at = now()
     where status = 'new'
       and checkout_date < (now() at time zone 'America/Mexico_City')::date
    returning id
  ),
  history as (
    insert into public.information_request_status_history (
      information_request_id,
      previous_status,
      new_status,
      actor_type,
      actor_display_name,
      reason
    )
    select
      id,
      'new',
      'not_converted',
      'system',
      'System',
      'Requested dates passed without booking'
    from expired
    returning 1
  )
  select count(*) into v_count from history;

  return v_count;
end;
$$;

alter table public.information_requests enable row level security;
alter table public.information_request_status_history enable row level security;

create policy "Active admins read information requests"
on public.information_requests for select
to authenticated
using (public.is_active_admin());

create policy "Active admins read information request history"
on public.information_request_status_history for select
to authenticated
using (public.is_active_admin());

revoke all on public.information_requests from anon, authenticated;
revoke all on public.information_request_status_history from anon, authenticated;
grant select on public.information_requests to authenticated;
grant select on public.information_request_status_history to authenticated;

revoke all on function public.create_information_request(
  uuid, text, text, text, text, date, date, integer, integer, text[], text
) from public;
revoke all on function public.change_information_request_status(
  uuid, text, text, text, text
) from public;
revoke all on function public.expire_information_requests() from public;

grant execute on function public.create_information_request(
  uuid, text, text, text, text, date, date, integer, integer, text[], text
) to anon, authenticated;
grant execute on function public.change_information_request_status(
  uuid, text, text, text, text
) to authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'copal-expire-information-requests',
  '10 6 * * *',
  'select public.expire_information_requests();'
);

comment on table public.information_requests is
  'Visitor information requests submitted from the public Reserva section.';

comment on function public.expire_information_requests() is
  'Daily lifecycle update. Date comparisons use America/Mexico_City; the cron job runs at 06:10 UTC.';

commit;
