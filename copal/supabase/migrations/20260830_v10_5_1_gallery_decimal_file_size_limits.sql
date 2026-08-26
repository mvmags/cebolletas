begin;

alter table public.gallery_photos
  drop constraint if exists gallery_photos_modal_file_size_limit,
  add constraint gallery_photos_modal_file_size_limit check (
    file_size_bytes is null or file_size_bytes <= 500000
  ),
  drop constraint if exists gallery_photos_thumbnail_file_size_limit,
  add constraint gallery_photos_thumbnail_file_size_limit check (
    thumbnail_file_size_bytes is null or thumbnail_file_size_bytes <= 100000
  );

commit;
