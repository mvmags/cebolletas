begin;

create function public.create_information_request(
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
