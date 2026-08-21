begin;

create or replace function public.is_active_admin_writer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = auth.uid()
      and active = true
      and role = 'admin'::public.admin_role
  );
$$;

create table if not exists public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  section_slug text not null
    check (section_slug in ('terrace', 'landscape', 'interior', 'bathroom', 'bedroom', 'fire-pit')),
  storage_path text unique,
  legacy_path text unique,
  display_order integer not null default 0 check (display_order >= 0),
  alt_es text check (alt_es is null or char_length(alt_es) <= 180),
  alt_en text check (alt_en is null or char_length(alt_en) <= 180),
  width_px integer check (width_px is null or width_px > 0),
  height_px integer check (height_px is null or height_px > 0),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gallery_photos_single_source check (
    ((storage_path is not null)::integer + (legacy_path is not null)::integer) = 1
  ),
  constraint gallery_photos_storage_path_not_blank check (
    storage_path is null or char_length(btrim(storage_path)) > 0
  ),
  constraint gallery_photos_legacy_path_not_blank check (
    legacy_path is null or char_length(btrim(legacy_path)) > 0
  )
);

create index if not exists gallery_photos_section_order_idx
on public.gallery_photos (section_slug, display_order, created_at, id);

drop trigger if exists gallery_photos_touch_updated_at on public.gallery_photos;
create trigger gallery_photos_touch_updated_at
before update on public.gallery_photos
for each row execute function public.touch_updated_at();

alter table public.gallery_photos enable row level security;

drop policy if exists "Anyone reads gallery photos" on public.gallery_photos;
create policy "Anyone reads gallery photos"
on public.gallery_photos
for select
to anon, authenticated
using (true);

drop policy if exists "Admin writers insert gallery photos" on public.gallery_photos;
create policy "Admin writers insert gallery photos"
on public.gallery_photos
for insert
to authenticated
with check (public.is_active_admin_writer());

drop policy if exists "Admin writers update gallery photos" on public.gallery_photos;
create policy "Admin writers update gallery photos"
on public.gallery_photos
for update
to authenticated
using (public.is_active_admin_writer())
with check (public.is_active_admin_writer());

drop policy if exists "Admin writers delete gallery photos" on public.gallery_photos;
create policy "Admin writers delete gallery photos"
on public.gallery_photos
for delete
to authenticated
using (public.is_active_admin_writer());

revoke all on public.gallery_photos from anon, authenticated;
grant select on public.gallery_photos to anon, authenticated;
grant insert, update, delete on public.gallery_photos to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'copal-gallery',
  'copal-gallery',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin writers read gallery objects" on storage.objects;
create policy "Admin writers read gallery objects"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'copal-gallery'
  and public.is_active_admin_writer()
);

drop policy if exists "Admin writers upload gallery objects" on storage.objects;
create policy "Admin writers upload gallery objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'copal-gallery'
  and public.is_active_admin_writer()
);

drop policy if exists "Admin writers update gallery objects" on storage.objects;
create policy "Admin writers update gallery objects"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'copal-gallery'
  and public.is_active_admin_writer()
)
with check (
  bucket_id = 'copal-gallery'
  and public.is_active_admin_writer()
);

drop policy if exists "Admin writers delete gallery objects" on storage.objects;
create policy "Admin writers delete gallery objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'copal-gallery'
  and public.is_active_admin_writer()
);

insert into public.gallery_photos (section_slug, legacy_path, display_order)
values
  ('bathroom', 'assets/gallery/bathroom/image-0001.jpeg', 1),
  ('bedroom', 'assets/gallery/bedroom/image-0001.jpeg', 1),
  ('bedroom', 'assets/gallery/bedroom/image-0002.jpeg', 2),
  ('bedroom', 'assets/gallery/bedroom/image-0003.jpeg', 3),
  ('bedroom', 'assets/gallery/bedroom/image-0004.jpeg', 4),
  ('fire-pit', 'assets/gallery/fire-pit/image-0001.jpeg', 1),
  ('fire-pit', 'assets/gallery/fire-pit/image-0002.jpeg', 2),
  ('fire-pit', 'assets/gallery/fire-pit/image-0003.jpeg', 3),
  ('fire-pit', 'assets/gallery/fire-pit/image-0004.jpeg', 4),
  ('fire-pit', 'assets/gallery/fire-pit/image-0005.jpeg', 5),
  ('fire-pit', 'assets/gallery/fire-pit/image-0006.jpeg', 6),
  ('fire-pit', 'assets/gallery/fire-pit/image-0007.jpeg', 7),
  ('fire-pit', 'assets/gallery/fire-pit/image-0008.jpeg', 8),
  ('interior', 'assets/gallery/interior/image-0001.jpeg', 1),
  ('interior', 'assets/gallery/interior/image-0002.jpeg', 2),
  ('interior', 'assets/gallery/interior/image-0003.png', 3),
  ('interior', 'assets/gallery/interior/image-0004.jpeg', 4),
  ('landscape', 'assets/gallery/landscape/image-0001.jpeg', 1),
  ('landscape', 'assets/gallery/landscape/image-0002.jpeg', 2),
  ('landscape', 'assets/gallery/landscape/image-0003.jpeg', 3),
  ('landscape', 'assets/gallery/landscape/image-0004.jpeg', 4),
  ('landscape', 'assets/gallery/landscape/image-0005.jpeg', 5),
  ('landscape', 'assets/gallery/landscape/image-0006.jpeg', 6),
  ('landscape', 'assets/gallery/landscape/image-0007.jpeg', 7),
  ('landscape', 'assets/gallery/landscape/image-0008.jpeg', 8),
  ('landscape', 'assets/gallery/landscape/image-0009.jpeg', 9),
  ('landscape', 'assets/gallery/landscape/image-0010.jpeg', 10),
  ('landscape', 'assets/gallery/landscape/image-0011.jpeg', 11),
  ('landscape', 'assets/gallery/landscape/image-0012.jpeg', 12),
  ('terrace', 'assets/gallery/terrace/image-0001.jpeg', 1),
  ('terrace', 'assets/gallery/terrace/image-0002.jpeg', 2),
  ('terrace', 'assets/gallery/terrace/image-0003.jpeg', 3),
  ('terrace', 'assets/gallery/terrace/image-0004.jpeg', 4),
  ('terrace', 'assets/gallery/terrace/image-0005.jpeg', 5),
  ('terrace', 'assets/gallery/terrace/image-0006.jpeg', 6),
  ('terrace', 'assets/gallery/terrace/image-0007.jpeg', 7),
  ('terrace', 'assets/gallery/terrace/image-0008.jpeg', 8),
  ('terrace', 'assets/gallery/terrace/image-0009.jpeg', 9),
  ('terrace', 'assets/gallery/terrace/image-0010.jpeg', 10),
  ('terrace', 'assets/gallery/terrace/image-0011.jpeg', 11),
  ('terrace', 'assets/gallery/terrace/image-0012.jpeg', 12),
  ('terrace', 'assets/gallery/terrace/image-0013.jpeg', 13)
on conflict (legacy_path) do nothing;

commit;
