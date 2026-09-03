begin;

-- Management readers and writers share the authenticated Postgres role, so
-- mutation RPCs must enforce the application-level admin role themselves.
do $hardening$
declare
  v_mutation_names text[] := array[
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
  v_function record;
  v_definition text;
  v_hardened_count integer := 0;
begin
  for v_function in
    select routine.oid, routine.proname
    from pg_proc routine
    join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = any(v_mutation_names)
    order by routine.proname
  loop
    v_definition := pg_get_functiondef(v_function.oid);
    if strpos(v_definition, 'public.is_active_admin()') = 0 then
      raise exception 'Expected active-admin guard was not found in public.%',
        v_function.proname;
    end if;

    execute replace(
      v_definition,
      'public.is_active_admin()',
      'public.is_active_admin_writer()'
    );
    v_hardened_count := v_hardened_count + 1;
  end loop;

  if v_hardened_count <> cardinality(v_mutation_names) then
    raise exception 'Expected to harden % management RPCs, hardened %',
      cardinality(v_mutation_names),
      v_hardened_count;
  end if;
end;
$hardening$;

-- The legacy booking table was removed in 20260801. Keeping a dynamic
-- reference to it makes the database linter report a missing relation even
-- though the guarded branch cannot execute.
create or replace function public.delete_service(p_service_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_admin_writer() then
    raise exception 'Administrator write access required' using errcode = '42501';
  end if;

  update public.services
  set current_version_id = null
  where id = p_service_id;

  delete from public.services
  where id = p_service_id;

  if not found then
    raise exception 'Service not found';
  end if;
end;
$$;

revoke all on function public.delete_service(uuid) from public;
grant execute on function public.delete_service(uuid) to authenticated;

-- Production predates the checked-in migrations and retained this function
-- after its backing booking_requests table was removed. Drop every overload
-- without CASCADE; an unexpected dependency aborts the migration safely.
do $cleanup$
declare
  v_function record;
begin
  for v_function in
    select
      namespace.nspname as schema_name,
      routine.proname as function_name,
      pg_get_function_identity_arguments(routine.oid) as identity_arguments
    from pg_proc routine
    join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'create_booking_request_internal'
  loop
    execute format(
      'drop function %I.%I(%s)',
      v_function.schema_name,
      v_function.function_name,
      v_function.identity_arguments
    );
  end loop;
end;
$cleanup$;

-- The trailing compatibility parameter intentionally distinguishes this
-- service-ID overload from the rate-plan overload. Referencing it keeps that
-- compatibility contract while avoiding an unused-parameter warning.
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
  p_customer_message text,
  p_legacy_compat boolean default true
)
returns table (request_id uuid, request_number bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate_plan_id uuid;
begin
  perform p_legacy_compat;

  select plan.id into v_rate_plan_id
  from public.rate_plans plan
  where plan.service_id = p_service_id
    and plan.rate_code = 'standard'
    and plan.is_active;

  if v_rate_plan_id is null then
    raise exception 'Selected service is not available';
  end if;

  return query
  select result.request_id, result.request_number
  from public.create_information_request(
    p_submission_key => p_submission_key,
    p_locale => p_locale,
    p_customer_name => p_customer_name,
    p_customer_email => p_customer_email,
    p_customer_cellphone => p_customer_cellphone,
    p_checkin_date => p_checkin_date,
    p_checkout_date => p_checkout_date,
    p_adults => p_adults,
    p_children => p_children,
    p_infants => p_infants,
    p_rate_plan_id => v_rate_plan_id,
    p_customer_message => p_customer_message
  ) result;
end;
$$;

revoke all on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text, boolean
) from public;
grant execute on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text, boolean
) to anon, authenticated;

comment on function public.create_information_request(
  uuid, text, text, text, text, date, date,
  integer, integer, integer, uuid, text, boolean
) is 'Compatibility entry point for the pre-v10.4 visitor client keyed by service ID.';

notify pgrst, 'reload schema';

commit;
