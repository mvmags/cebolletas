# Cebolletas v10.7.0 — local testing

This environment is isolated from production. It uses the local Supabase stack,
local test users, and synthetic request data. No production database or visitor
data is involved.

## Ready-to-use local URLs

| Area | URL |
| --- | --- |
| Cebolletas Copal | <http://localhost:8080/copal/> |
| Management application | <http://localhost:8080/copal/manage/> |
| Receipt verification | <http://localhost:8080/copal/verificar-recibo/> |
| Supabase Studio | <http://127.0.0.1:54323> |
| Local email inbox (Mailpit) | <http://127.0.0.1:54324> |

## Local accounts

These credentials exist only in the local seed data:

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@cebolletas.local` | `CebolletasLocal!1070` |
| Viewer | `viewer@cebolletas.local` | `CebolletasLocal!1070` |

Never reuse these credentials in a hosted environment.

## Suggested v10.7.0 walkthrough

1. Open the management application and sign in as the local administrator.
2. Open **Solicitudes**, switch to **Lista**, and move to the next month.
3. Open `SOL-000001`, the request for **Cliente de prueba local**.
4. Under **Enlace privado**, generate the link. Reload the page and confirm that
   the same active link is still available to copy.
5. Open that link and confirm that the visitor sees the quoted total, verified
   amount, outstanding balance, and current payment status.
6. In management, record a partial payment. For example:
   - Amount: `1000`
   - Method: `SPEI / transferencia bancaria`
   - Reference: `LOCAL-SPEI-001`
7. Confirm that the request becomes reserved, the outstanding balance changes,
   and a partial-payment receipt becomes available.
8. Record the remaining amount with a different reference, then confirm the
   status is paid in full and the final receipt is available.
9. Open a receipt and use its verification link or QR code. Confirm that the
   public verification page reports the receipt as valid without exposing
   internal notes or customer contact data.
10. Try to reuse `LOCAL-SPEI-001`. The duplicate active reference should be
    rejected.
11. Void a payment with a reason. Confirm that the old receipt is reported as
    void and that the financial totals are recalculated.
12. Sign in as the local viewer and confirm that restricted configuration and
    quotation edits remain unavailable.

To repeat the walkthrough from a clean state, reset the local database as
described below.

## Start the environment again

Docker Desktop must be running. From the repository root:

```bash
npx --yes supabase@2.116.0 --workdir copal start
```

In a second terminal, serve the Edge Functions:

```bash
npx --yes supabase@2.116.0 --workdir copal functions serve \
  --env-file copal/supabase/functions/.env.local
```

In a third terminal, serve the website:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Then open <http://localhost:8080/copal/manage/>.

The local-only files `copal/config/development.js` and
`copal/supabase/functions/.env.local` are intentionally ignored by Git. The
encryption key in the local Edge Function environment is a disposable test key
and must never be copied to production.

## Reset the local database

This deletes only local Supabase data, reapplies every migration, and reloads
the local test users and sample request:

```bash
npx --yes supabase@2.116.0 --workdir copal db reset --local
```

All payments, links, and other records created during local testing are removed
by the reset.

## Stop the environment

Stop the website and Edge Function terminals with `Control-C`, then run:

```bash
npx --yes supabase@2.116.0 --workdir copal stop
```
