# Telegram notification setup

This Edge Function receives an `INSERT` event from the custom `pg_net` trigger
on `public.information_requests` and sends an operational alert to a private
Telegram support group.

The visitor's email and cellphone are intentionally excluded from the message
and from `notification_delivery_logs`.

## Required secrets

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `MANAGE_APP_URL` (optional; defaults to the production Manage URL)

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied automatically to
hosted Supabase Edge Functions.

Generate a webhook secret locally:

```bash
openssl rand -hex 32
```

Never commit the generated secret or the Telegram bot token.

## Deploy

From the repository root, with the Supabase CLI authenticated:

```bash
npx supabase --workdir copal link \
  --project-ref myqaotknkriuhdssbzlz
```

Create `/tmp/cebolletas-telegram-secrets.env` with:

```dotenv
TELEGRAM_BOT_TOKEN=replace-with-bot-token
TELEGRAM_CHAT_ID=replace-with-negative-group-id
TELEGRAM_WEBHOOK_SECRET=replace-with-generated-secret
MANAGE_APP_URL=https://cebolletas.mx/copal/manage/
```

Upload the secrets and remove the temporary local file:

```bash
npx supabase --workdir copal secrets set \
  --env-file /tmp/cebolletas-telegram-secrets.env \
  --project-ref myqaotknkriuhdssbzlz

rm /tmp/cebolletas-telegram-secrets.env

npx supabase --workdir copal functions deploy notify-new-request \
  --project-ref myqaotknkriuhdssbzlz \
  --no-verify-jwt
```

## Database trigger

The Supabase Dashboard Database Webhook cannot be used in this project because
its internal `supabase_functions` schema is unavailable. The migration instead
creates an `AFTER INSERT` trigger that queues the Edge Function call
asynchronously through `pg_net`.

Before the trigger receives production traffic:

1. Enable the `pg_net` extension in the Supabase project.
2. Store the same value used for `TELEGRAM_WEBHOOK_SECRET` in Supabase Vault
   under the name `telegram_webhook_secret`.
3. Apply
   `copal/supabase/migrations/20260804_iteration_7_telegram_notifications.sql`.

The trigger reads the secret from Vault when it runs. The secret is never
embedded in the migration or trigger definition. Enqueue errors are caught and
reported as PostgreSQL warnings so notification failure cannot invalidate a
saved information request.

Verify the Vault entry without displaying its value:

```sql
select
  name,
  char_length(decrypted_secret) as secret_length
from vault.decrypted_secrets
where name = 'telegram_webhook_secret';
```

Verify the trigger:

```sql
select
  trigger_name,
  event_manipulation,
  action_timing,
  event_object_schema,
  event_object_table
from information_schema.triggers
where trigger_name = 'notify_new_information_request';
```

## Test without creating a visitor request

```bash
curl --fail-with-body \
  'https://myqaotknkriuhdssbzlz.supabase.co/functions/v1/notify-new-request' \
  -H 'content-type: application/json' \
  -H 'x-webhook-secret: replace-with-generated-secret' \
  --data '{
    "type": "TEST",
    "record": {
      "request_number": 0,
      "checkin_date": "2026-08-15",
      "checkout_date": "2026-08-17",
      "adults": 2,
      "children": 1,
      "infants": 0,
      "requested_services": ["copal"],
      "pricing_status": "estimated",
      "estimated_total_cents": 310000
    }
  }'
```

Expected HTTP response:

```json
{"ok":true,"message_id":123}
```

The support group should receive a message labelled `Prueba de notificación`.

## Inspect delivery results

```sql
select
  attempted_at,
  event_type,
  status,
  http_status,
  provider_message_id,
  error_message,
  payload_summary
from public.notification_delivery_logs
order by attempted_at desc
limit 25;
```
