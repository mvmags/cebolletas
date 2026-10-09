# Supabase one-time backup — v10.8.1

Production project: cebolletas-copal (`myqaotknkriuhdssbzlz`).
Backup date: 2026-10-08 (America/Mexico_City).
Source application commit: ebeda11 (merged v10.8.0).
Development project was not exported. Production application data/configuration
was not modified; the Supabase CLI may initialize its temporary database login
role as part of authenticating the read-only dumps.

## Completed exports

| Component | Result |
|---|---|
| Roles, application schema and data | CLI exports succeeded; 54 COPY tables / 545 rows in data.sql |
| Auth | Included in data.sql; 3 users; additional managed-schema definitions saved |
| Storage metadata and bytes | 1 bucket / 165 objects; every file matches recorded size and MD5 |
| Remote migration history | Separate schema/data SQL; 25 history rows |
| Scheduler and Vault | Separate schema/data SQL; 1 cron job; database root encryption key exported privately |
| Deployed Edge Functions | All 4 sources plus original ESZIP bundles saved |
| Function deployment metadata | Version, verify_jwt and other returned fields preserved |
| Local Supabase sources | Tracked migrations, seed, config, functions and assets preserved separately |
| Project settings | Project, Auth, Storage, PostgREST and Postgres configuration saved |
| Network and SSL | CLI exports succeeded with required experimental flag |
| Saved SQL snippets | All 4 listed snippets downloaded |
| Runtime secrets | Metadata for all 16 names/digests saved; original secret values not returned |
| Platform backup inventory | Available backup metadata saved; this is not a physical/PITR backup download |
| Extensions / Realtime publications | Read-only inventory preserved |

Deployed functions: submit-booking v3, notify-new-request v2,
request-summary v5, private-access v2. submit-booking was remote-only.
The extracted request-summary source does not include embedded PNG assets;
original ESZIP bundles and separately tracked local assets are retained.

## Verification

All eight SQL files are nonempty and their CLI commands completed successfully.
Schema exports contain DDL; data exports have completion markers. PostgreSQL
COPY sections account for 57 tables and 571 rows across application, migration
history, and scheduler/Vault data files. There were no missing or mismatched
Storage files: 165/165 sizes and 165/165 MD5 values match the remote inventory.
All four deployed functions have downloaded entrypoints and original bundles.
`verification.json`, `storage-verification.json`, and `table-row-counts.json`
contain the detailed checks. `SHA256SUMS` covers all files in this folder except
itself; the sibling tar.gz archive has its own SHA-256 file.

This is content/integrity verification. No restore into an isolated Supabase
project has been performed. The separate exports are not a globally atomic
snapshot; live database/Storage writes can occur between their capture times.

## Recovery gaps and limitations

Runtime secret digests do not recover original values. Preserve production
PRIVATE_LINK_ENCRYPTION_KEY, PRIVATE_LINK_ENCRYPTION_KEY_VERSION,
PRIVATE_LINK_ENCRYPTION_KEYS, Telegram credentials, and Turnstile credentials
from their original secure custody. The database root encryption key is
separate from those application encryption keys. Local .env.local values were
excluded because they are synthetic test credentials.

Auth settings may include masked values; provider/SMTP credentials and project
signing keys are not guaranteed recoverable from this export. Custom role
passwords may need resetting. External DNS, email/Telegram services, billing,
platform infrastructure, transient network queues and historical provider logs
are outside this logical backup. Review platform-managed schemas and extension
versions before applying them to another managed project.

Custom-domain inspection was unavailable because the project lacks the paid
custom-domain add-on; no add-on was purchased. An attempted Management API
snippet endpoint returned HTTP 404, but all four snippets were successfully
exported through the CLI. Earlier settings attempts lacked --experimental;
the later successes are recorded in extra-status.json. Logs retain attempts.

## Restore procedure

Follow the repository's copal/SUPABASE_BACKUP.md and Supabase's official backup
and restore guide. Verify checksums first, use a new isolated target with
compatible extensions, review roles/schema, restore application rows and
migration history, recreate buckets and upload files, restore/redeploy function
sources with their recorded JWT configuration and secrets, and restore any
Vault encryption root key using the supported procedure. Treat the ESZIP files
as original deployment artifacts rather than assuming every CLI can redeploy
them directly. Validate Auth, RLS, private-link decryption, receipts, Storage,
and functions before directing traffic to the restored target.

The archive contains private data and encryption material. Keep it private and
copy it to secure off-device storage. No off-device copy was made in this task.

References:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/platform/backups
