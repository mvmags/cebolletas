import {
  generateRequestSummaryPdf,
  RequestSummaryData,
} from "../supabase/functions/request-summary/pdf.ts";

const outputDirectory = new URL("../../tmp/pdfs/", import.meta.url);
await Deno.mkdir(outputDirectory, { recursive: true });
const assets = {
  cebolletasLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/cebolletas.png", import.meta.url)),
  copalLogo: await Deno.readFile(new URL("../supabase/functions/request-summary/assets/copal.png", import.meta.url)),
};
const common: Omit<RequestSummaryData, "publication_language" | "status_label" | "beneficiary"> = {
  folio: "SOL-000027",
  request_contact: {
    name: "Jonathán Reyes de la Peña",
    phone: "+52 449 555 0101",
    email: "jonathan.reyes@example.com",
  },
  service: "Hospedaje en Cebolletas Copal - experiencia privada con una descripción larga para revisar el ajuste automático",
  checkin_date: "2026-09-12",
  checkout_date: "2026-09-13",
  adults: 12,
  children: 8,
  infants: 3,
  quoted_total_cents: 123456789,
  currency_code: "MXN",
  last_updated_at: "2026-09-01T22:15:00Z",
};
const spanish: RequestSummaryData = {
  ...common,
  publication_language: "es",
  status_label: "Solicitud recibida",
  beneficiary: {
    name: "María José del Rocío Hernández de la Barrera y Fernández",
    phone: "+52 (449) 555-0198",
    email: "maria.jose.hernandez.nombre-extraordinariamente-largo@example.com",
  },
};
const english: RequestSummaryData = {
  ...common,
  publication_language: "en",
  status_label: "Request processed",
  service: "Cebolletas Copal lodging - a private experience with a long description to verify automatic wrapping",
  beneficiary: {
    name: "Alexandra Catherine Montgomery-Wellington",
    phone: "+52 449 555 0198",
    email: "alexandra.montgomery-wellington@example.com",
  },
  request_contact: undefined,
  quoted_total_cents: undefined,
  currency_code: undefined,
};

await Deno.writeFile(new URL("Resumen_Solicitud_SOL-000027.pdf", outputDirectory), await generateRequestSummaryPdf(spanish, assets, new Date("2026-09-01T22:30:00Z")));
await Deno.writeFile(new URL("Request_Summary_SOL-000027.pdf", outputDirectory), await generateRequestSummaryPdf(english, assets, new Date("2026-09-01T22:30:00Z")));
console.log(new URL(".", outputDirectory).pathname);
