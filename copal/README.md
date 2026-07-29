# Cebolletas Copal — Version 7

Static browser-only microsite for `https://cebolletas.mx/copal/`.

This variant preserves the Version 4 layout and adds the complete bilingual
Reserva form:

- Check-in and checkout calendars.
- Automatic total-night calculation.
- Weekend-night and weekday-night breakdown. Weekend nights are Friday and
  Saturday nights; checkout day is not counted.
- Adult and child counters, defaulting to 1 and 0.
- Required name, email, and cellphone fields.
- Required information selection: Copal, camping, or events.
- Optional visitor message.
- A single “Solicitar Información” / “Request info” button.
- The request is saved through a narrowly scoped Supabase RPC before delivery.
- The button opens WhatsApp and email with the reservation information prepared.
- One validated message snapshot is shared by WhatsApp and email. It includes
  total nights, weekend nights, and weekday nights.
- The visitor confirms each final send inside WhatsApp and their email app.
- Idempotent submission keys prevent accidental duplicate records.
- Sanitization, validation, persistence, and delivery behavior are isolated in
  `reserva-actions.js`.
- Validation/status styles are isolated in `reserva-actions.css`.

The original Version 4 archive is unchanged.

## Security boundary

All data is normalized, length-limited, validated, and URL-encoded before it is
used. The public database RPC repeats validation and grants visitors no direct
table access. Reads, lifecycle updates, and status history remain restricted to
active administrators through RLS. Infrastructure-level rate limiting and abuse
monitoring remain deployment responsibilities.

## Deployment

Copy all files and the `assets` directory into:

`public_html/copal/`

The final structure must be:

- `public_html/copal/index.html`
- `public_html/copal/styles.css`
- `public_html/copal/script.js`
- `public_html/copal/reserva-actions.css`
- `public_html/copal/reserva-actions.js`
- `public_html/copal/assets/...`

No Node.js, npm, build process, framework, database, or server runtime is required.
