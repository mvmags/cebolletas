import {
  generatePaymentReceiptPdf,
  PaymentReceiptSnapshot,
} from "../supabase/functions/request-summary/receipt-pdf.ts";

const outputDirectory = new URL("../../tmp/pdfs/", import.meta.url);
await Deno.mkdir(outputDirectory, { recursive: true });
const assets = {
  cebolletasLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/cebolletas.png", import.meta.url)),
  copalLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/copal.png", import.meta.url)),
};
const common: PaymentReceiptSnapshot = {
  schema_version: 1,
  receipt_number: "RCP-SOL-000027-01",
  receipt_type: "partial",
  language: "es",
  request_folio: "SOL-000027",
  issued_at: "2026-09-08T19:30:00-06:00",
  payment_date: "2026-09-08",
  payment_amount_cents: 150000,
  accumulated_verified_cents: 150000,
  gross_verified_cents: 150000,
  quoted_total_cents: 350000,
  balance_due_cents: 200000,
  credit_cents: 0,
  currency_code: "MXN",
  payment_method: { code: "spei", label_es: "SPEI / transferencia bancaria", label_en: "SPEI / bank transfer" },
  masked_reference: "••••9X7Q",
  beneficiary: { name: "María José del Rocío Hernández de la Barrera y Fernández", phone: "+52 449 555 0198", email: "maria.jose.hernandez.nombre-extraordinariamente-largo@example.com" },
  request_contact: { name: "Jonathán Pérez Álvarez", phone: "+52 449 555 0101", email: "jonathan.perez@example.com" },
  service: { name_es: "Hospedaje en Cebolletas Copal y campamento en zona natural reservada", name_en: "Cebolletas Copal lodging and camping in a reserved natural area" },
  stay: { checkin_date: "2026-09-12", checkout_date: "2026-09-13" },
  guests: { adults: 12, children: 8, infants: 3 },
  identities: { cebolletas: "Cebolletas", copal: "Cebolletas Copal" },
  recorded_by: "00000000-0000-4000-8000-000000000001",
  recorded_by_display_name: "Personal Cebolletas",
  verification_code: "0123456789abcdef0123456789abcdef0123456789abcdef",
  verification_url: "https://cebolletas.mx/copal/verificar-recibo/#code=0123456789abcdef0123456789abcdef0123456789abcdef",
};
const variants: Array<[string, PaymentReceiptSnapshot]> = [
  ["Recibo_Pago_Parcial_RCP-SOL-000027-01.pdf", common],
  ["Final_Payment_Receipt_RCP-SOL-000027-02.pdf", { ...common, receipt_number: "RCP-SOL-000027-02", receipt_type: "final", language: "en", payment_amount_cents: 200000, accumulated_verified_cents: 350000, gross_verified_cents: 350000, balance_due_cents: 0 }],
  ["Recibo_Pago_Final_Credito_RCP-SOL-000027-03.pdf", { ...common, receipt_number: "RCP-SOL-000027-03", receipt_type: "final_credit", payment_amount_cents: 225000, accumulated_verified_cents: 350000, gross_verified_cents: 375000, balance_due_cents: 0, credit_cents: 25000 }],
];
for (const [filename, receipt] of variants) {
  await Deno.writeFile(new URL(filename, outputDirectory), await generatePaymentReceiptPdf(receipt, assets));
}
console.log(new URL(".", outputDirectory).pathname);
