# Recoverable private-link endpoint

This authenticated Edge Function is the only component allowed to encrypt or
decrypt private-request bearer tokens. Public request validation continues to
use the SHA-256 token hash and never decrypts a token.

Required hosted values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRIVATE_LINK_ENCRYPTION_KEY_VERSION` — active version label, for example `v1`
- `PRIVATE_LINK_ENCRYPTION_KEY` — 32 random bytes encoded as base64/base64url
- `PRIVATE_LINK_ENCRYPTION_KEYS` — optional JSON keyring retaining prior versions
- `PRIVATE_REQUEST_BASE_URL` — optional; defaults to the production private page

Generate a key locally without printing it into application logs or source:

```bash
openssl rand -base64 32
```

Upload the value directly as an Edge Function secret. Never place it in a
browser environment file, migration, issue, screenshot, or commit.

For rotation, add the old and new keys to `PRIVATE_LINK_ENCRYPTION_KEYS`, change
`PRIVATE_LINK_ENCRYPTION_KEY_VERSION` and `PRIVATE_LINK_ENCRYPTION_KEY` to the
new version, deploy, and retain prior keys while historical encrypted URLs must
remain recoverable. Rows store their key version and AES-GCM nonce.

The endpoint accepts authenticated management requests only:

- `{ "action": "list", "request_id": "..." }` for any active management account.
- `{ "action": "regenerate", "request_id": "...", "language": "es" }` for an
  active administrator.

Raw tokens, decrypted tokens, URLs, and encryption values are never logged.
