import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260908_v10_7_0_verified_payments.sql");
const referenceScopeMigration = read("../supabase/migrations/20260921_v10_7_0_payment_reference_scope.sql");
const manage = read("../manage/manage.js");
const customer = read("../solicitud/solicitud.js");
const edge = read("../supabase/functions/request-summary/index.ts");
const receiptPdf = read("../supabase/functions/request-summary/receipt-pdf.ts");
const verification = read("../verificar-recibo/verificar-recibo.js");

for (const table of [
  "payment_methods", "reservation_payments", "payment_receipts",
  "payment_void_events", "quote_revision_events", "credit_resolution_events",
]) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`));
}

assert.match(migration, /create function public\.record_verified_payment[\s\S]*?public\.is_active_admin\(\)/);
assert.match(migration, /create or replace function public\.void_verified_payment[\s\S]*?public\.is_active_admin\(\)/);
assert.match(migration, /create function public\.resolve_information_request_credit[\s\S]*?public\.is_active_admin\(\)/);
assert.match(migration, /create function public\.save_payment_method[\s\S]*?public\.is_active_admin_writer\(\)/);
assert.match(migration, /for update/);
assert.match(migration, /reservation_payments_active_reference_unique/);
assert.match(
  referenceScopeMigration,
  /information_request_id,\s*payment_method_id,\s*lower\(reference_full\)/,
);
assert.match(migration, /payment_receipts_no_update_or_delete/);
assert.match(migration, /Request status does not accept payments/);
assert.match(migration, /Future payment dates are not allowed/);
assert.match(migration, /resolved credit would exceed resulting credit/);
assert.match(migration, /First verified payment received/);
assert.match(migration, /RCP-' \|\| v_folio/);
assert.match(migration, /CASH-' \|\| v_folio/);
assert.match(migration, /verification_code_hash/);
assert.match(migration, /content_checksum/);
assert.match(migration, /reference_masked/);

assert.doesNotMatch(manage, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
for (const rpc of ["record_verified_payment", "void_verified_payment", "resolve_information_request_credit", "revise_information_request_quote"]) {
  assert.match(manage, new RegExp(rpc));
}
assert.match(manage, /window\.confirm/);
assert.match(customer, /receipt_download_code/);
assert.doesNotMatch(customer, /reference_full/);
assert.match(edge, /resolve_public_payment_receipt/);
assert.match(edge, /resolve_payment_receipt_verification/);
assert.match(edge, /"cache-control": "private, no-store/);
assert.match(verification, /window\.location\.hash\.slice\(1\)/);
assert.match(verification, /history\.replaceState/);

assert.match(receiptPdf, /qrcode@1\.5\.4/);
assert.match(receiptPdf, /Cebolletas Copal verified payments/);
assert.match(receiptPdf, /const verificationUrl = safe\(data\.verification_url\)/);
assert.doesNotMatch(receiptPdf, /drawWrapped\(page, "cebolletas\.mx\/copal\/verificar-recibo\/"/);
assert.match(receiptPdf, /No constituye un CFDI ni sustituye una factura fiscal/);
assert.match(receiptPdf, /does not replace a tax invoice/);
assert.doesNotMatch(receiptPdf, /reference_full/);

const verificationProjection = migration.slice(
  migration.indexOf("create function public.resolve_payment_receipt_verification"),
  migration.indexOf("revoke all on function public.resolve_public_payment_receipt"),
);
for (const forbidden of ["customer_name", "phone", "email", "reference_full", "information_request_id"]) {
  assert.doesNotMatch(verificationProjection, new RegExp(forbidden, "i"));
}

console.log("verified payment security tests passed");
