# Cebolletas Copal gallery source archive

This directory contains the original 42 photographs that seeded the managed
gallery in v10.5.0. The public gallery catalog now lives in
`public.gallery_photos`, and v10.5.1 serves responsive WebP files from the
Supabase Storage bucket `copal-gallery`.

These repository files remain the recoverable source for the initial backfill.
Visitors should not receive them after the responsive-image migration is
complete.

## Current public workflow

Use `/copal/manage/` to add, remove, move, or reorder public photographs. Each
new upload creates:

- `full/<section>/<photo-id>.webp`: maximum 1,800-pixel edge and 500 KB, used by
  the modal.
- `thumbnail/<section>/<photo-id>.webp`: maximum 720-pixel edge and 100 KB, used
  by management previews.
- `tile/<section>/<photo-id>.webp`: maximum 480-pixel edge and 40 KB, used by
  the public gallery landing tiles.

The database record stores all three paths and their dimensions and file sizes.
Deleting a managed photo removes all three Storage objects.

## Initial responsive-image backfill

Apply `20260828_v10_5_1_gallery_responsive_images.sql` to the target Supabase
project, then follow the backfill instructions in `copal/manage/README.md`.
The script reads these originals, applies their EXIF orientation, creates
temporary WebP variants, uploads all three variants, and replaces each row's
`legacy_path` with its Storage paths. It retains `source_archive_path` as
provenance so the recoverable originals can be used again without being served
to visitors.

The dry run is safe and does not contact Supabase:

```bash
node scripts/backfill-gallery-responsive-images.mjs
```

Keep the original files in this directory until the development and production
backfills, public gallery, modal loop, deletion flow, and rollback procedure
have all been verified.

## Section mapping

| Folder | Spanish label | English label |
| --- | --- | --- |
| `terrace` | Terraza | Terrace |
| `landscape` | El paisaje | The landscape |
| `interior` | Interior | Interior |
| `bathroom` | Baño | Bathroom |
| `bedroom` | Recámara | Bedroom |
| `fire-pit` | Fogata | Fire Pit |

The visible labels and section order remain defined in
`copal/script.js#gallerySectionDefinitions`.
