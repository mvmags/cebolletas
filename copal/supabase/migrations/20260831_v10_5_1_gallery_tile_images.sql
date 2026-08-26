begin;

alter table public.gallery_photos
  add column if not exists tile_storage_path text,
  add column if not exists tile_width_px integer,
  add column if not exists tile_height_px integer,
  add column if not exists tile_file_size_bytes bigint,
  add column if not exists source_archive_path text;

create unique index if not exists gallery_photos_tile_storage_path_key
on public.gallery_photos (tile_storage_path)
where tile_storage_path is not null;

create unique index if not exists gallery_photos_source_archive_path_key
on public.gallery_photos (source_archive_path)
where source_archive_path is not null;

alter table public.gallery_photos
  drop constraint if exists gallery_photos_tile_storage_path_not_blank,
  add constraint gallery_photos_tile_storage_path_not_blank check (
    tile_storage_path is null or char_length(btrim(tile_storage_path)) > 0
  ),
  drop constraint if exists gallery_photos_tile_requires_storage_source,
  add constraint gallery_photos_tile_requires_storage_source check (
    tile_storage_path is null or storage_path is not null
  ),
  drop constraint if exists gallery_photos_tile_width_positive,
  add constraint gallery_photos_tile_width_positive check (
    tile_width_px is null or tile_width_px > 0
  ),
  drop constraint if exists gallery_photos_tile_height_positive,
  add constraint gallery_photos_tile_height_positive check (
    tile_height_px is null or tile_height_px > 0
  ),
  drop constraint if exists gallery_photos_tile_file_size_positive,
  add constraint gallery_photos_tile_file_size_positive check (
    tile_file_size_bytes is null or tile_file_size_bytes > 0
  ),
  drop constraint if exists gallery_photos_tile_file_size_limit,
  add constraint gallery_photos_tile_file_size_limit check (
    tile_file_size_bytes is null or tile_file_size_bytes <= 40000
  ),
  drop constraint if exists gallery_photos_tile_metadata_complete,
  add constraint gallery_photos_tile_metadata_complete check (
    tile_storage_path is null
    or (
      tile_width_px is not null
      and tile_height_px is not null
      and tile_file_size_bytes is not null
    )
  ),
  drop constraint if exists gallery_photos_source_archive_path_not_blank,
  add constraint gallery_photos_source_archive_path_not_blank check (
    source_archive_path is null or char_length(btrim(source_archive_path)) > 0
  );

commit;
