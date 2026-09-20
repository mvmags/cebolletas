import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const pageHtml = read("../solicitud/index.html");
const pageJs = read("../solicitud/solicitud.js");
const manageJs = read("../manage/manage.js");
const edge = read("../supabase/functions/request-summary/index.ts");
const pdf = read("../supabase/functions/request-summary/pdf.ts");
const migration = read("../supabase/migrations/20260901_v10_6_0_private_request_access.sql");
const config = read("../supabase/config.toml");
const privateAccessEdge = read("../supabase/functions/private-access/index.ts");
const verifiedPaymentsMigration = read("../supabase/migrations/20260908_v10_7_0_verified_payments.sql");

assert.match(pageHtml, /meta name="robots" content="noindex, nofollow, noarchive, nosnippet"/);
assert.match(pageHtml, /meta name="referrer" content="no-referrer"/);
assert.match(pageHtml, /http-equiv="Cache-Control" content="no-store, no-cache/);
assert.match(pageJs, /window\.location\.hash\.slice\(1\)/);
assert.match(pageJs, /history\.replaceState/);
assert.match(pageJs, /body: JSON\.stringify\(\{ token: accessToken, format: "json" \}\)/);
assert.doesNotMatch(pageJs, /[?&](access|token)=/);
assert.doesNotMatch(pageHtml, /<script[^>]+(?:analytics|tagmanager|facebook|hotjar)/i);

assert.doesNotMatch(manageJs, /PRIVATE_TOKEN_BYTES|createPrivateBearerToken|sha256Hex\(rawToken\)/);
assert.match(manageJs, /functions\/v1\/private-access/);
assert.doesNotMatch(manageJs, /SUPABASE_SERVICE_ROLE_KEY|service_role/i);
assert.match(privateAccessEdge, /name: "AES-GCM"/);
assert.match(privateAccessEdge, /PRIVATE_LINK_ENCRYPTION_KEY_VERSION/);
assert.match(privateAccessEdge, /PRIVATE_LINK_ENCRYPTION_KEYS/);
assert.match(privateAccessEdge, /publish_recoverable_information_request_access/);
assert.match(privateAccessEdge, /staff\.role !== "admin"/);
assert.doesNotMatch(privateAccessEdge, /console\.(?:log|error)\([^\n]*(?:token|url|ciphertext)/i);
assert.match(verifiedPaymentsMigration, /token_ciphertext text/);
assert.match(verifiedPaymentsMigration, /revoke execute on function public\.publish_information_request_access/);

assert.match(migration, /token_hash text not null unique/);
assert.match(migration, /where revoked_at is null/);
assert.match(migration, /is_active_admin_writer\(\)/);
assert.match(migration, /grant execute on function public\.resolve_public_information_request\(text\)\s+to service_role/);
assert.doesNotMatch(migration, /\btoken\s+text\b/i);
assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]*?'status_notes'/);
assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]*?'quote_snapshot'/);
assert.doesNotMatch(migration, /jsonb_build_object\([\s\S]*?'customer_message'/);

assert.match(edge, /"content-type": "application\/pdf"/);
assert.match(edge, /"content-disposition": `attachment/);
assert.match(edge, /"cache-control": "private, no-store/);
assert.match(edge, /resolve_public_information_request/);
assert.doesNotMatch(edge, /\.select\(["']\*["']\)/);
assert.doesNotMatch(edge, /console\.(?:log|error)\([^\n]*\btoken\b/i);
assert.match(edge, /Esta página de solicitud no está disponible/);
assert.match(edge, /This request page is unavailable/);
assert.match(config, /\[functions\.request-summary\]\s+verify_jwt = false/);
assert.match(config, /static_files = \["\.\/functions\/request-summary\/assets\/\*\.png"\]/);
assert.match(pdf, /https:\/\/esm\.sh\/@pdfme\/pdf-lib@6\.1\.12\?target=deno/);

assert.match(pageJs, /Number\.isSafeInteger\(request\.quoted_total_cents\)/);
assert.match(pdf, /Number\.isSafeInteger\(data\.quoted_total_cents\)/);
assert.match(pdf, /Este resumen no confirma una reservación ni acredita la recepción de pago\./);
assert.match(pdf, /This summary does not confirm a reservation or acknowledge receipt of payment\./);
for (const forbidden of [
  "Recibo de pago",
  "Payment receipt",
  "Anticipo recibido",
  "Deposit received",
  "Saldo pendiente",
  "Payment method",
  "CFDI",
]) {
  assert.doesNotMatch(pdf, new RegExp(forbidden, "i"));
}

console.log("private request security tests passed");
