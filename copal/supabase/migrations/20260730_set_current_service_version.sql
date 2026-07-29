begin;

create or replace function public.set_current_service_version(
  p_service_id uuid,
  p_version_id uuid,
  p_expected_current_version_id uuid
)
returns public.services
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_version_service_id uuid;
begin
  if not public.is_active_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select *
    into v_service
  from public.services
  where id = p_service_id
  for update;

  if v_service.id is null then
    raise exception 'Service not found';
  end if;

  if p_expected_current_version_id is distinct from v_service.current_version_id then
    raise exception 'Version conflict: reload the catalog before continuing';
  end if;

  select service_id
    into v_version_service_id
  from public.service_versions
  where id = p_version_id;

  if v_version_service_id is null
     or v_version_service_id is distinct from p_service_id then
    raise exception 'Service version does not belong to service';
  end if;

  if v_service.current_version_id is distinct from p_version_id then
    update public.services
       set current_version_id = p_version_id
     where id = p_service_id
    returning * into v_service;
  end if;

  return v_service;
end;
$$;

revoke all on function public.set_current_service_version(
  uuid, uuid, uuid
) from public;

grant execute on function public.set_current_service_version(
  uuid, uuid, uuid
) to authenticated;

comment on function public.set_current_service_version(
  uuid, uuid, uuid
) is
  'Promotes an existing immutable service version to current after admin authorization and optimistic-concurrency validation.';

commit;
