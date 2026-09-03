import assert from "node:assert/strict";
import { PDFDocument } from "https://esm.sh/@pdfme/pdf-lib@6.1.12?target=deno";
import {
  generateRequestSummaryPdf,
  requestSummaryFilename,
  RequestSummaryData,
} from "../supabase/functions/request-summary/pdf.ts";

const cebolletasLogo = await Deno.readFile(new URL(
  "../supabase/functions/request-summary/assets/cebolletas.png",
  import.meta.url,
));
const copalLogo = await Deno.readFile(new URL(
  "../supabase/functions/request-summary/assets/copal.png",
  import.meta.url,
));
const assets = { cebolletasLogo, copalLogo };

const spanish: RequestSummaryData = {
  publication_language: "es",
  folio: "SOL-000027",
  status_label: "Solicitud recibida",
  beneficiary: {
    name: "María José del Rocío Hernández de la Barrera",
    phone: "+52 449 555 0198",
    email: "maria.jose.hernandez.con.nombre.extenso@example.com",
  },
  request_contact: {
    name: "Jonathán Pérez Álvarez",
    phone: "+52 449 555 0101",
    email: "jonathan.perez@example.com",
  },
  service: "Hospedaje en Cebolletas Copal con descripción suficientemente larga para validar el ajuste de línea",
  checkin_date: "2026-09-12",
  checkout_date: "2026-09-13",
  adults: 2,
  children: 2,
  infants: 1,
  quoted_total_cents: 123456789,
  currency_code: "MXN",
  last_updated_at: "2026-09-01T22:15:00Z",
};

const english: RequestSummaryData = {
  ...spanish,
  publication_language: "en",
  status_label: "Request processed",
  service: "Cebolletas Copal lodging with a sufficiently long description to validate line wrapping",
  beneficiary: spanish.request_contact!,
  request_contact: undefined,
  quoted_total_cents: undefined,
  currency_code: undefined,
};

Deno.test("Spanish and English request summaries are one-page letter PDFs", async () => {
  for (const data of [spanish, english]) {
    const bytes = await generateRequestSummaryPdf(data, assets, new Date("2026-09-01T22:30:00Z"));
    assert.ok(bytes.length > 20_000);
    const document = await PDFDocument.load(bytes);
    assert.equal(document.getPageCount(), 1);
    const { width, height } = document.getPage(0).getSize();
    assert.equal(width, 612);
    assert.equal(height, 792);
    assert.equal(document.getTitle(), `${data.publication_language === "es" ? "Resumen de solicitud" : "Request summary"} ${data.folio}`);
  }
});

Deno.test("localized filenames are stable", () => {
  assert.equal(requestSummaryFilename(spanish), "Resumen_Solicitud_SOL-000027.pdf");
  assert.equal(requestSummaryFilename(english), "Request_Summary_SOL-000027.pdf");
});
