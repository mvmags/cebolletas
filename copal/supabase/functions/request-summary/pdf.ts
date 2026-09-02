import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "https://esm.sh/@pdfme/pdf-lib@6.1.12?target=deno";

export type ContactDetails = {
  name: string;
  phone: string;
  email: string;
};

export type RequestSummaryData = {
  publication_language: "es" | "en";
  folio: string;
  status_label: string;
  beneficiary: ContactDetails;
  request_contact?: ContactDetails;
  service: string;
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  infants: number;
  quoted_total_cents?: number;
  currency_code?: "MXN";
  last_updated_at: string;
};

type PdfAssets = {
  cebolletasLogo: Uint8Array;
  copalLogo: Uint8Array;
};

const INK = rgb(0.10, 0.12, 0.10);
const MUTED = rgb(0.43, 0.45, 0.42);
const LINE = rgb(0.82, 0.82, 0.79);
const FOREST = rgb(0.09, 0.25, 0.20);
const PAPER = rgb(0.995, 0.99, 0.97);

const COPY = {
  es: {
    title: "Resumen de solicitud",
    generated: "Generado",
    status: "Estado",
    beneficiary: "A favor de",
    phone: "Teléfono",
    email: "Correo electrónico",
    requestContact: "Contacto de la solicitud",
    service: "Servicio",
    dates: "Fechas solicitadas",
    checkin: "Llegada",
    checkout: "Salida",
    guests: "Huéspedes",
    adults: "Adultos",
    children: "Niños",
    infants: "Menores de 3",
    total: "Total cotizado",
    updated: "Información actualizada",
    disclaimer: "Este resumen no confirma una reservación ni acredita la recepción de pago.",
    filename: "Resumen_Solicitud",
    locale: "es-MX",
  },
  en: {
    title: "Request summary",
    generated: "Generated",
    status: "Status",
    beneficiary: "For",
    phone: "Telephone",
    email: "Email",
    requestContact: "Request contact",
    service: "Service",
    dates: "Requested dates",
    checkin: "Check-in",
    checkout: "Checkout",
    guests: "Guests",
    adults: "Adults",
    children: "Children",
    infants: "Children under 3",
    total: "Quoted total",
    updated: "Information updated",
    disclaimer: "This summary does not confirm a reservation or acknowledge receipt of payment.",
    filename: "Request_Summary",
    locale: "en-US",
  },
} as const;

function latinSafe(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = latinSafe(text).trim();
  if (!safe) return [""];
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const originalWord of words) {
    let word = originalWord;
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
      let split = word.length - 1;
      while (split > 1 && font.widthOfTextAtSize(`${word.slice(0, split)}-`, size) > maxWidth) {
        split -= 1;
      }
      lines.push(`${word.slice(0, split)}-`);
      word = word.slice(split);
    }
    current = word;
  }

  if (current) lines.push(current);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color?: ReturnType<typeof rgb>;
    lineHeight?: number;
    maxLines?: number;
  },
): number {
  const lineHeight = options.lineHeight ?? options.size * 1.3;
  const lines = wrapText(text, options.font, options.size, options.maxWidth)
    .slice(0, options.maxLines ?? Number.POSITIVE_INFINITY);
  lines.forEach((line, index) => {
    page.drawText(line, {
      x: options.x,
      y: options.y - index * lineHeight,
      font: options.font,
      size: options.size,
      color: options.color ?? INK,
    });
  });
  return options.y - lines.length * lineHeight;
}

function drawLabel(page: PDFPage, text: string, x: number, y: number, font: PDFFont): void {
  page.drawText(latinSafe(text).toUpperCase(), {
    x,
    y,
    font,
    size: 7.5,
    color: MUTED,
  });
}

function drawDivider(page: PDFPage, y: number): void {
  page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 0.65, color: LINE });
}

function formatDate(value: string, language: "es" | "en"): string {
  const date = new Date(`${value}T12:00:00-06:00`);
  return latinSafe(new Intl.DateTimeFormat(COPY[language].locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(date));
}

function formatDateTime(value: Date | string, language: "es" | "en"): string {
  return latinSafe(new Intl.DateTimeFormat(COPY[language].locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(typeof value === "string" ? new Date(value) : value));
}

function formatMoney(cents: number, language: "es" | "en"): string {
  return latinSafe(new Intl.NumberFormat(COPY[language].locale, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100));
}

function drawContact(
  page: PDFPage,
  contact: ContactDetails,
  x: number,
  y: number,
  width: number,
  regular: PDFFont,
  bold: PDFFont,
  language: "es" | "en",
): number {
  let cursor = drawWrapped(page, contact.name, {
    x,
    y,
    maxWidth: width,
    font: bold,
    size: 12,
    lineHeight: 14.5,
    maxLines: 2,
  });
  cursor -= 4;
  drawLabel(page, COPY[language].phone, x, cursor, bold);
  cursor -= 12;
  cursor = drawWrapped(page, contact.phone, {
    x,
    y: cursor,
    maxWidth: width,
    font: regular,
    size: 9.5,
    lineHeight: 12,
    maxLines: 2,
  });
  cursor -= 3;
  drawLabel(page, COPY[language].email, x, cursor, bold);
  cursor -= 12;
  return drawWrapped(page, contact.email, {
    x,
    y: cursor,
    maxWidth: width,
    font: regular,
    size: 9,
    lineHeight: 11,
    maxLines: 3,
  });
}

export function requestSummaryFilename(data: RequestSummaryData): string {
  return `${COPY[data.publication_language].filename}_${data.folio}.pdf`;
}

export async function generateRequestSummaryPdf(
  data: RequestSummaryData,
  assets: PdfAssets,
  generatedAt = new Date(),
): Promise<Uint8Array> {
  const language = data.publication_language;
  const copy = COPY[language];
  const document = await PDFDocument.create();
  document.setTitle(`${copy.title} ${data.folio}`);
  document.setAuthor("Cebolletas");
  document.setSubject(copy.disclaimer);
  document.setCreator("Cebolletas Copal request summary");
  document.setProducer("pdf-lib");

  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const serif = await document.embedFont(StandardFonts.TimesRomanBold);
  const cebolletasLogo = await document.embedPng(assets.cebolletasLogo);
  const copalLogo = await document.embedPng(assets.copalLogo);

  page.drawRectangle({ x: 24, y: 24, width: 564, height: 744, color: PAPER, borderColor: LINE, borderWidth: 0.8 });

  const cebolletasSize = cebolletasLogo.scaleToFit(145, 64);
  const copalSize = copalLogo.scaleToFit(54, 64);
  page.drawImage(cebolletasLogo, { x: 48, y: 690, width: cebolletasSize.width, height: cebolletasSize.height });
  page.drawImage(copalLogo, { x: 205, y: 688, width: copalSize.width, height: copalSize.height });
  page.drawText("CEBOLLETAS COPAL", { x: 274, y: 716, font: bold, size: 9, color: FOREST });
  page.drawText("Calvillo, Aguascalientes", { x: 413, y: 720, font: regular, size: 9, color: MUTED });
  page.drawText("cebolletas.mx", { x: 478, y: 705, font: regular, size: 9, color: MUTED });
  page.drawLine({ start: { x: 24, y: 677 }, end: { x: 588, y: 677 }, thickness: 2.2, color: FOREST });

  page.drawText(copy.title, { x: 48, y: 631, font: serif, size: 25, color: INK });
  page.drawText(data.folio, { x: 456, y: 636, font: bold, size: 12, color: INK });
  page.drawText(`${copy.generated}: ${formatDateTime(generatedAt, language)}`, { x: 390, y: 620, font: regular, size: 8.5, color: MUTED });
  drawLabel(page, copy.status, 48, 602, bold);
  page.drawText(latinSafe(data.status_label), { x: 48, y: 586, font: bold, size: 10, color: FOREST });

  drawDivider(page, 568);
  drawLabel(page, copy.beneficiary, 48, 548, bold);
  const beneficiaryBottom = drawContact(page, data.beneficiary, 48, 529, data.request_contact ? 236 : 500, regular, bold, language);
  let contactBottom = beneficiaryBottom;
  if (data.request_contact) {
    drawLabel(page, copy.requestContact, 330, 548, bold);
    contactBottom = drawContact(page, data.request_contact, 330, 529, 234, regular, bold, language);
  }

  const detailsTop = Math.min(beneficiaryBottom, contactBottom) - 13;
  drawDivider(page, detailsTop);
  const sectionLabelY = detailsTop - 20;
  drawLabel(page, copy.service, 48, sectionLabelY, bold);
  const serviceBottom = drawWrapped(page, data.service, {
    x: 48,
    y: sectionLabelY - 17,
    maxWidth: 516,
    font: bold,
    size: 11,
    lineHeight: 13.5,
    maxLines: 3,
  });

  const rowsTop = serviceBottom - 12;
  drawLabel(page, copy.dates, 48, rowsTop, bold);
  drawLabel(page, copy.guests, 330, rowsTop, bold);
  page.drawText(`${copy.checkin}: ${formatDate(data.checkin_date, language)}`, { x: 48, y: rowsTop - 18, font: regular, size: 9.5, color: INK });
  page.drawText(`${copy.checkout}: ${formatDate(data.checkout_date, language)}`, { x: 48, y: rowsTop - 34, font: regular, size: 9.5, color: INK });
  page.drawText(`${copy.adults}: ${data.adults}`, { x: 330, y: rowsTop - 18, font: regular, size: 9.5, color: INK });
  page.drawText(`${copy.children}: ${data.children}`, { x: 330, y: rowsTop - 34, font: regular, size: 9.5, color: INK });
  page.drawText(`${copy.infants}: ${data.infants}`, { x: 330, y: rowsTop - 50, font: regular, size: 9.5, color: INK });

  let footerTop = rowsTop - 73;
  if (Number.isSafeInteger(data.quoted_total_cents) && Number(data.quoted_total_cents) >= 0) {
    drawDivider(page, footerTop);
    footerTop -= 25;
    page.drawText(copy.total, { x: 48, y: footerTop, font: regular, size: 11, color: MUTED });
    const amount = formatMoney(Number(data.quoted_total_cents), language);
    const amountWidth = bold.widthOfTextAtSize(amount, 17);
    page.drawText(amount, { x: 564 - amountWidth, y: footerTop - 2, font: bold, size: 17, color: INK });
    footerTop -= 29;
  }

  drawDivider(page, footerTop);
  page.drawText(`${copy.updated}: ${formatDateTime(data.last_updated_at, language)}`, { x: 48, y: footerTop - 17, font: regular, size: 8.5, color: MUTED });

  page.drawRectangle({ x: 24, y: 24, width: 564, height: 66, color: rgb(0.96, 0.95, 0.92) });
  const disclaimerLines = wrapText(copy.disclaimer, regular, 9, 486);
  disclaimerLines.forEach((line, index) => {
    const width = regular.widthOfTextAtSize(line, 9);
    page.drawText(line, { x: 306 - width / 2, y: 57 - index * 12, font: regular, size: 9, color: MUTED });
  });
  page.drawText("CEBOLLETAS.MX", { x: 48, y: 36, font: bold, size: 7, color: FOREST });

  return await document.save({ useObjectStreams: true });
}
