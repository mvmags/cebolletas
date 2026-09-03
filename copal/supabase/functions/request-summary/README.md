# Private request summary endpoint

This Edge Function is the only anonymous read boundary for private request
pages. The browser submits the bearer token in a JSON request body. The
function hashes it with SHA-256 and calls the service-role-only database
projection; raw tokens and complete request rows are never returned or logged.

Supported requests:

- `{ "token": "...", "format": "json" }` returns the approved live-page data.
- `{ "token": "...", "format": "pdf" }` returns the current one-page PDF.
- Authenticated management users may send `{ "request_id": "...", "language":
  "es", "format": "pdf" }` to generate a staff PDF after visitor access ends.

The function requires the standard hosted Supabase values `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not expose the service
role key in browser configuration.

Deploy only after applying the v10.6.0 migration. Deployment is intentionally
outside the release commit workflow.
