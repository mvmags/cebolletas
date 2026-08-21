begin;

create or replace function public.swap_gallery_photo_order(
  p_photo_id uuid,
  p_target_id uuid,
  p_photo_order integer,
  p_target_order integer
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_photo public.gallery_photos%rowtype;
  v_target public.gallery_photos%rowtype;
begin
  if not public.is_active_admin_writer() then
    raise exception 'Gallery write access denied' using errcode = '42501';
  end if;

  if p_photo_id = p_target_id then
    raise exception 'Gallery order conflict: identical photos';
  end if;

  perform 1
  from public.gallery_photos
  where id in (p_photo_id, p_target_id)
  order by id
  for update;

  select * into v_photo
  from public.gallery_photos
  where id = p_photo_id;

  select * into v_target
  from public.gallery_photos
  where id = p_target_id;

  if v_photo.id is null or v_target.id is null then
    raise exception 'Gallery order conflict: photo not found';
  end if;

  if v_photo.section_slug <> v_target.section_slug
     or v_photo.display_order <> p_photo_order
     or v_target.display_order <> p_target_order then
    raise exception 'Gallery order conflict: gallery changed';
  end if;

  update public.gallery_photos
  set display_order = case id
    when p_photo_id then v_target.display_order
    when p_target_id then v_photo.display_order
  end
  where id in (p_photo_id, p_target_id);
end;
$$;

revoke all on function public.swap_gallery_photo_order(uuid, uuid, integer, integer) from public;
grant execute on function public.swap_gallery_photo_order(uuid, uuid, integer, integer) to authenticated;

commit;
