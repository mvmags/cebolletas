begin;

alter table public.gallery_photos
  add column if not exists thumbnail_storage_path text,
  add column if not exists thumbnail_width_px integer,
  add column if not exists thumbnail_height_px integer,
  add column if not exists thumbnail_file_size_bytes bigint;

create unique index if not exists gallery_photos_thumbnail_storage_path_key
on public.gallery_photos (thumbnail_storage_path)
where thumbnail_storage_path is not null;

alter table public.gallery_photos
  drop constraint if exists gallery_photos_thumbnail_storage_path_not_blank,
  add constraint gallery_photos_thumbnail_storage_path_not_blank check (
    thumbnail_storage_path is null or char_length(btrim(thumbnail_storage_path)) > 0
  ),
  drop constraint if exists gallery_photos_thumbnail_requires_storage_source,
  add constraint gallery_photos_thumbnail_requires_storage_source check (
    thumbnail_storage_path is null or storage_path is not null
  ),
  drop constraint if exists gallery_photos_thumbnail_width_positive,
  add constraint gallery_photos_thumbnail_width_positive check (
    thumbnail_width_px is null or thumbnail_width_px > 0
  ),
  drop constraint if exists gallery_photos_thumbnail_height_positive,
  add constraint gallery_photos_thumbnail_height_positive check (
    thumbnail_height_px is null or thumbnail_height_px > 0
  ),
  drop constraint if exists gallery_photos_thumbnail_file_size_positive,
  add constraint gallery_photos_thumbnail_file_size_positive check (
    thumbnail_file_size_bytes is null or thumbnail_file_size_bytes > 0
  ),
  drop constraint if exists gallery_photos_thumbnail_metadata_complete,
  add constraint gallery_photos_thumbnail_metadata_complete check (
    thumbnail_storage_path is null
    or (
      thumbnail_width_px is not null
      and thumbnail_height_px is not null
      and thumbnail_file_size_bytes is not null
    )
  );

commit;
