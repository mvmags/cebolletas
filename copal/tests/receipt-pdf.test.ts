import assert from "node:assert/strict";
import { PDFDocument } from "https://esm.sh/@pdfme/pdf-lib@6.1.12?target=deno";
import {
  generatePaymentReceiptPdf,
  paymentReceiptFilename,
  PaymentReceiptSnapshot,
} from "../supabase/functions/request-summary/receipt-pdf.ts";

const assets = {
  cebolletasLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/cebolletas.png", import.meta.url)),
  copalLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/copal.png", import.meta.url)),
};

const base: PaymentReceiptSnapshot = {
  schema_version: 1,
  receipt_number: "RCP-SOL-000027-01",
  receipt_type: "partial",
  language: "es",
  request_folio: "SOL-000027",
  issued_at: "2026-09-08T19:30:00-06:00",
  payment_date: "2026-09-08",
  payment_amount_cents: 123456,
  accumulated_verified_cents: 123456,
  gross_verified_cents: 123456,
  quoted_total_cents: 350000,
  balance_due_cents: 226544,
  credit_cents: 0,
  currency_code: "MXN",
  payment_method: { code: "spei", label_es: "SPEI / transferencia bancaria", label_en: "SPEI / bank transfer" },
  masked_reference: "••••9X7Q",
  beneficiary: {
    name: "María José del Rocío Hernández de la Barrera y Fernández",
    phone: "+52 (449) 555-0198",
    email: "maria.jose.hernandez.nombre-extraordinariamente-largo@example.com",
  },
  request_contact: { name: "Jonathán Pérez Álvarez", phone: "+52 449 555 0101", email: "jonathan.perez@example.com" },
  service: {
    name_es: "Hospedaje en Cebolletas Copal y campamento en zona natural reservada",
    name_en: "Cebolletas Copal lodging and camping in a reserved natural area",
  },
  stay: { checkin_date: "2026-09-12", checkout_date: "2026-09-13" },
  guests: { adults: 12, children: 8, infants: 3 },
  identities: { cebolletas: "Cebolletas", copal: "Cebolletas Copal" },
  recorded_by: "00000000-0000-4000-8000-000000000001",
  recorded_by_display_name: "Personal Cebolletas",
  verification_code: "0123456789abcdef0123456789abcdef0123456789abcdef",
  verification_url: "https://cebolletas.mx/copal/verificar-recibo/#code=0123456789abcdef0123456789abcdef0123456789abcdef",
};

Deno.test("Spanish partial and English final-credit receipts render as one-page letter PDFs", async () => {
  const variants: PaymentReceiptSnapshot[] = [
    base,
    {
      ...base,
      receipt_number: "RCP-SOL-000027-02",
      receipt_type: "final_credit",
      language: "en",
      payment_amount_cents: 250000,
      accumulated_verified_cents: 350000,
      gross_verified_cents: 373456,
      balance_due_cents: 0,
      credit_cents: 23456,
    },
  ];
  for (const receipt of variants) {
    const bytes = await generatePaymentReceiptPdf(receipt, assets);
    assert.ok(bytes.length > 20_000);
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1);
    assert.deepEqual(document.getPage(0).getSize(), { width: 612, height: 792 });
    assert.equal(document.getTitle(), `${receipt.language === "es" ? "Recibo de pago" : "Payment receipt"} ${receipt.receipt_number}`);
  }
});

Deno.test("receipt filenames are localized and immutable-data based", () => {
  assert.equal(paymentReceiptFilename(base), "Recibo_Pago_Parcial_RCP-SOL-000027-01.pdf");
  assert.equal(
    paymentReceiptFilename({ ...base, language: "en", receipt_type: "final" }),
    "Final_Payment_Receipt_RCP-SOL-000027-01.pdf",
  );
});
