# Supabase one-time backup — v10.8.1

The production project is `cebolletas-copal` (`myqaotknkriuhdssbzlz`).
The development project is separate and is not part of this export.

## Private artifact location

The one-time export lives outside the GitHub Pages checkout:

`/Users/marcovelasco/code/cebolletas-backups/v10.8.1-supabase-2026-10-08/`

Consult its `BACKUP_REPORT.md`, `export-status.json`, and `SHA256SUMS` for the
actual coverage and validation. Backup files contain private application data,
Auth records and possibly SMTP/OAuth credentials; keep the folder private and
copy the finished archive to secure off-device storage. Do not put it under
this repository or publish it with the site.

## Backup components

- `roles.sql`, `schema.sql`, `data.sql`: Supabase CLI logical exports.
- `managed-schema.sql`: additional Auth/Storage definitions, including policies
  and triggers; review customizations before restoring onto managed services.
- `migration-schema.sql`, `migration-data.sql`: remote migration history.
- `remote/supabase/functions/`: source downloaded from each deployed function,
  including the remote-only `submit-booking` function.
- `local-source/`: tracked Supabase migrations, configuration, seed and function
  source from the application checkout. The seed is synthetic local data.
- `storage/`: separately downloaded bucket object bytes.
- `scheduler-vault-schema.sql`, `scheduler-vault-data.sql`: cron and Vault exports.
- `settings/function-bundles/`: original deployed ESZIP bundles. Extracted source
  downloads may omit embedded static assets; the original bundles are retained.
- `vault-root-key.txt`: original database encryption root key, kept private.
- Auth, Storage, API/database, SSL and network settings; deployed function
  metadata; names/digests for 16 runtime secrets; and four saved SQL snippets.

An inventory entry or a successful empty response does not by itself mean that
all corresponding resource contents were exported. Use the private report.

## Recovery limits

The database export does not include Storage object bytes. Functions need their
runtime secret values separately; a secret digest cannot recover its value.
Preserve the production `PRIVATE_LINK_ENCRYPTION_KEY`, version and historical
`PRIVATE_LINK_ENCRYPTION_KEYS` securely. Losing these values prevents decryption
of existing recoverable private-link tokens. Local `.env.local` values are test
credentials and must not be substituted for production values.

Auth provider credentials, SMTP settings, signing/encryption keys, external email
services, DNS, and account/billing configuration may need separate recovery.
The database encryption root key was exported privately for Vault/column
encryption recovery; follow the current Supabase instructions. This key does
not replace the application’s separate private-link encryption keyring. Platform-managed schemas are not a portable
replacement for a provisioned Supabase project. Database and Storage exports
are taken at separate times; this is not a globally atomic snapshot.

## Restore review

Verify every checksum first. Restore into a new, isolated Supabase project with
compatible PostgreSQL and enabled extensions. Inspect role definitions and
review platform-schema customizations before applying them. Follow the official
role → schema → data restore sequence with a single transaction and
`ON_ERROR_STOP`; restore migration history separately. Recreate Storage buckets
with their recorded access settings, upload object bytes, restore function
configuration and sources, and supply production secrets from secure custody.
Re-enable the recorded Realtime publications where needed.

Validate table counts, Auth users, RLS, private-link decryption, function behavior,
and Storage object hashes before directing application traffic to a restored
project. The one-time export has not been restored into a new project unless
`BACKUP_REPORT.md` explicitly records that test. Never test restoration against
production.

References:

- [Supabase backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
