begin;

create function public.validate_rate_plan_category_limits_v10_4()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.max_adults is not null and new.max_adults > new.max_occupancy then
    raise exception 'Maximum adults cannot exceed total capacity' using errcode = '23514';
  end if;

  if new.max_children is not null and new.max_children > new.max_occupancy then
    raise exception 'Maximum children cannot exceed total capacity' using errcode = '23514';
  end if;

  if new.max_infants is not null and new.max_infants > new.max_occupancy then
    raise exception 'Maximum infants cannot exceed total capacity' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_rate_plan_category_limits_v10_4() from public;

create trigger validate_rate_plan_category_limits_v10_4
before insert or update of max_occupancy, max_adults, max_children, max_infants
on public.rate_plan_versions
for each row
execute function public.validate_rate_plan_category_limits_v10_4();

comment on function public.validate_rate_plan_category_limits_v10_4() is
  'Returns an actionable validation error when a participant-category maximum exceeds total service capacity.';

notify pgrst, 'reload schema';

commit;
