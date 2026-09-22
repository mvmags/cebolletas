import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "https://esm.sh/@pdfme/pdf-lib@6.1.12?target=deno";
import * as QRCode from "https://esm.sh/qrcode@1.5.4?target=deno";

export type ReceiptContact = { name: string; phone: string; email: string };
export type PaymentReceiptSnapshot = {
  schema_version: 1;
  receipt_number: string;
  receipt_type: "partial" | "final" | "final_credit";
  language: "es" | "en";
  request_folio: string;
  issued_at: string;
  payment_date: string;
  payment_amount_cents: number;
  accumulated_verified_cents: number;
  gross_verified_cents: number;
  quoted_total_cents: number;
  balance_due_cents: number;
  credit_cents: number;
  currency_code: "MXN";
  payment_method: { code: string; label_es: string; label_en: string };
  masked_reference: string;
  beneficiary: ReceiptContact;
  request_contact?: ReceiptContact;
  service: { name_es: string; name_en: string };
  stay: { checkin_date: string; checkout_date: string };
  guests: { adults: number; children: number; infants: number };
  identities: { cebolletas: string; copal: string };
  recorded_by: string;
  recorded_by_display_name: string;
  verification_code: string;
  verification_url: string;
};

type PdfAssets = { cebolletasLogo: Uint8Array; copalLogo: Uint8Array };

const INK = rgb(0.10, 0.12, 0.10);
const MUTED = rgb(0.42, 0.44, 0.41);
const LINE = rgb(0.82, 0.82, 0.79);
const FOREST = rgb(0.09, 0.25, 0.20);
const WINE = rgb(0.40, 0.04, 0.04);
const PAPER = rgb(0.995, 0.99, 0.97);

const COPY = {
  es: {
    title: "Recibo de pago",
    partial: "Pago parcial",
    final: "Pago final",
    finalCredit: "Pago final con saldo a favor",
    issued: "Emitido",
    beneficiary: "A favor de",
    requestContact: "Contacto de la solicitud",
    service: "Servicio",
    dates: "Fechas del servicio",
    guests: "Huéspedes",
    adults: "Adultos",
    children: "Niños",
    infants: "Menores de 3",
    currentPayment: "Pago verificado",
    accumulated: "Pagos verificados acumulados",
    quoted: "Total cotizado",
    balance: "Saldo pendiente",
    credit: "Saldo a favor",
    method: "Método de pago",
    reference: "Referencia",
    verification: "Verificación",
    verifyHint: "Escanea el código o visita el enlace para comprobar la vigencia.",
    generalDisclaimer: "Este documento acredita únicamente el pago verificado que se identifica en el mismo. No constituye un CFDI ni sustituye una factura fiscal.",
    partialDisclaimer: "Este pago no liquida el importe total del servicio. El saldo pendiente se muestra en este documento.",
    finalDisclaimer: "El importe total registrado para el servicio ha sido cubierto mediante los pagos verificados indicados.",
    filenamePartial: "Recibo_Pago_Parcial",
    filenameFinal: "Recibo_Pago_Final",
    locale: "es-MX",
  },
  en: {
    title: "Payment receipt",
    partial: "Partial payment",
    final: "Final payment",
    finalCredit: "Final payment with credit balance",
    issued: "Issued",
    beneficiary: "For",
    requestContact: "Request contact",
    service: "Service",
    dates: "Service dates",
    guests: "Guests",
    adults: "Adults",
    children: "Children",
    infants: "Children under 3",
    currentPayment: "Verified payment",
    accumulated: "Accumulated verified payments",
    quoted: "Quoted total",
    balance: "Balance due",
    credit: "Credit balance",
    method: "Payment method",
    reference: "Reference",
    verification: "Verification",
    verifyHint: "Scan the code or open the link to confirm current validity.",
    generalDisclaimer: "This document acknowledges only the verified payment identified here. It is not a CFDI and does not replace a tax invoice.",
    partialDisclaimer: "This payment does not settle the full service amount. The remaining balance is shown in this document.",
    finalDisclaimer: "The total recorded amount for the service has been covered by the verified payments shown.",
    filenamePartial: "Partial_Payment_Receipt",
    filenameFinal: "Final_Payment_Receipt",
    locale: "en-US",
  },
} as const;

function safe(value: unknown): string {
  return String(value ?? "").normalize("NFC")
    .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF\u2022]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safe(text).trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const original of words) {
    let word = original;
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    while (font.widthOfTextAtSize(word, size) > width && word.length > 1) {
      let split = word.length - 1;
      while (split > 1 && font.widthOfTextAtSize(`${word.slice(0, split)}-`, size) > width) split -= 1;
      lines.push(`${word.slice(0, split)}-`);
      word = word.slice(split);
    }
    line = word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawWrapped(page: PDFPage, text: string, x: number, y: number, width: number, font: PDFFont, size: number, color = INK): number {
  const lineHeight = size * 1.28;
  const lines = wrap(text, font, size, width);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, font, size, color }));
  return y - lines.length * lineHeight;
}

function label(page: PDFPage, text: string, x: number, y: number, font: PDFFont): void {
  page.drawText(safe(text).toUpperCase(), { x, y, font, size: 7.1, color: MUTED });
}

function money(cents: number, language: "es" | "en"): string {
  return safe(new Intl.NumberFormat(COPY[language].locale, {
    style: "currency", currency: "MXN",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100));
}

function date(value: string, language: "es" | "en"): string {
  return safe(new Intl.DateTimeFormat(COPY[language].locale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City",
  }).format(new Date(`${value}T12:00:00-06:00`)));
}

function dateTime(value: string, language: "es" | "en"): string {
  return safe(new Intl.DateTimeFormat(COPY[language].locale, {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City",
  }).format(new Date(value)));
}

function dataUrlBytes(value: string): Uint8Array {
  const encoded = value.slice(value.indexOf(",") + 1);
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function receiptKind(data: PaymentReceiptSnapshot): string {
  const copy = COPY[data.language];
  return data.receipt_type === "partial" ? copy.partial : data.receipt_type === "final_credit" ? copy.finalCredit : copy.final;
}

export function paymentReceiptFilename(data: PaymentReceiptSnapshot): string {
  const copy = COPY[data.language];
  const prefix = data.receipt_type === "partial" ? copy.filenamePartial : copy.filenameFinal;
  return `${prefix}_${data.receipt_number}.pdf`;
}

export async function generatePaymentReceiptPdf(data: PaymentReceiptSnapshot, assets: PdfAssets): Promise<Uint8Array> {
  const language = data.language;
  const copy = COPY[language];
  const document = await PDFDocument.create();
  const issued = new Date(data.issued_at);
  document.setTitle(`${copy.title} ${data.receipt_number}`);
  document.setAuthor("Cebolletas");
  document.setSubject(copy.generalDisclaimer);
  document.setCreator("Cebolletas Copal verified payments");
  document.setProducer("pdf-lib");
  document.setCreationDate(issued);
  document.setModificationDate(issued);

  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const serif = await document.embedFont(StandardFonts.TimesRomanBold);
  const cebolletasLogo = await document.embedPng(assets.cebolletasLogo);
  const copalLogo = await document.embedPng(assets.copalLogo);
  const qrUrl = await QRCode.toDataURL(data.verification_url, { errorCorrectionLevel: "M", margin: 1, width: 220 });
  const qr = await document.embedPng(dataUrlBytes(qrUrl));

  page.drawRectangle({ x: 24, y: 24, width: 564, height: 744, color: PAPER, borderColor: LINE, borderWidth: 0.8 });
  const cebolletasSize = cebolletasLogo.scaleToFit(138, 58);
  const copalSize = copalLogo.scaleToFit(50, 58);
  page.drawImage(cebolletasLogo, { x: 48, y: 698, width: cebolletasSize.width, height: cebolletasSize.height });
  page.drawImage(copalLogo, { x: 198, y: 696, width: copalSize.width, height: copalSize.height });
  page.drawText("CEBOLLETAS COPAL", { x: 260, y: 720, font: bold, size: 8.5, color: FOREST });
  page.drawText("cebolletas.mx", { x: 493, y: 717, font: regular, size: 8.5, color: MUTED });
  page.drawLine({ start: { x: 24, y: 685 }, end: { x: 588, y: 685 }, thickness: 2.2, color: FOREST });

  page.drawText(copy.title, { x: 48, y: 647, font: serif, size: 24, color: INK });
  page.drawText(receiptKind(data), { x: 48, y: 628, font: bold, size: 9.5, color: WINE });
  const numberWidth = bold.widthOfTextAtSize(data.receipt_number, 11);
  page.drawText(data.receipt_number, { x: 564 - numberWidth, y: 648, font: bold, size: 11, color: INK });
  const folioWidth = regular.widthOfTextAtSize(data.request_folio, 8.5);
  page.drawText(data.request_folio, { x: 564 - folioWidth, y: 633, font: regular, size: 8.5, color: MUTED });
  const issuedText = `${copy.issued}: ${dateTime(data.issued_at, language)}`;
  page.drawText(issuedText, { x: 564 - regular.widthOfTextAtSize(issuedText, 7.8), y: 618, font: regular, size: 7.8, color: MUTED });

  page.drawLine({ start: { x: 48, y: 602 }, end: { x: 564, y: 602 }, thickness: 0.7, color: LINE });
  label(page, copy.beneficiary, 48, 584, bold);
  let leftY = drawWrapped(page, data.beneficiary.name, 48, 568, data.request_contact ? 235 : 500, bold, 10.5);
  leftY = drawWrapped(page, `${data.beneficiary.phone} · ${data.beneficiary.email}`, 48, leftY - 1, data.request_contact ? 235 : 500, regular, 8.2, MUTED);
  let rightY = leftY;
  if (data.request_contact) {
    label(page, copy.requestContact, 330, 584, bold);
    rightY = drawWrapped(page, data.request_contact.name, 330, 568, 234, bold, 10.5);
    rightY = drawWrapped(page, `${data.request_contact.phone} · ${data.request_contact.email}`, 330, rightY - 1, 234, regular, 8.2, MUTED);
  }

  let y = Math.min(leftY, rightY) - 10;
  page.drawLine({ start: { x: 48, y }, end: { x: 564, y }, thickness: 0.7, color: LINE });
  y -= 18;
  label(page, copy.service, 48, y, bold);
  y = drawWrapped(page, language === "en" ? data.service.name_en : data.service.name_es, 48, y - 16, 516, bold, 10.2);
  y -= 4;
  label(page, copy.dates, 48, y, bold);
  label(page, copy.guests, 330, y, bold);
  y -= 16;
  page.drawText(`${date(data.stay.checkin_date, language)} - ${date(data.stay.checkout_date, language)}`, { x: 48, y, font: regular, size: 8.8, color: INK });
  page.drawText(`${copy.adults}: ${data.guests.adults}  ·  ${copy.children}: ${data.guests.children}  ·  ${copy.infants}: ${data.guests.infants}`, { x: 330, y, font: regular, size: 8.8, color: INK });

  y -= 23;
  page.drawRectangle({ x: 48, y: y - 88, width: 516, height: 96, color: rgb(0.96, 0.96, 0.94) });
  const rows: Array<[string, number, boolean]> = [
    [copy.currentPayment, data.payment_amount_cents, true],
    [copy.accumulated, data.accumulated_verified_cents, false],
    [copy.quoted, data.quoted_total_cents, false],
    [data.credit_cents > 0 ? copy.credit : copy.balance, data.credit_cents > 0 ? data.credit_cents : data.balance_due_cents, true],
  ];
  rows.forEach(([rowLabel, amount, important], index) => {
    const rowY = y - 16 - index * 21;
    page.drawText(rowLabel, { x: 62, y: rowY, font: important ? bold : regular, size: important ? 9.2 : 8.8, color: important ? INK : MUTED });
    const formatted = money(amount, language);
    page.drawText(formatted, { x: 550 - (important ? bold : regular).widthOfTextAtSize(formatted, important ? 11 : 9), y: rowY - 1, font: important ? bold : regular, size: important ? 11 : 9, color: important ? WINE : INK });
  });
  y -= 105;
  label(page, copy.method, 48, y, bold);
  label(page, copy.reference, 330, y, bold);
  y -= 16;
  page.drawText(safe(language === "en" ? data.payment_method.label_en : data.payment_method.label_es), { x: 48, y, font: bold, size: 9.2, color: INK });
  page.drawText(safe(data.masked_reference), { x: 330, y, font: bold, size: 9.2, color: INK });
  page.drawText(date(data.payment_date, language), { x: 48, y: y - 14, font: regular, size: 8.2, color: MUTED });

  const verificationTop = y - 31;
  page.drawLine({ start: { x: 48, y: verificationTop }, end: { x: 564, y: verificationTop }, thickness: 0.7, color: LINE });
  page.drawImage(qr, { x: 48, y: verificationTop - 91, width: 82, height: 82 });
  label(page, copy.verification, 145, verificationTop - 14, bold);
  page.drawText(safe(data.verification_code), { x: 145, y: verificationTop - 31, font: bold, size: 7.4, color: FOREST });
  drawWrapped(page, copy.verifyHint, 145, verificationTop - 48, 255, regular, 8.1, MUTED);
  const verificationUrl = safe(data.verification_url);
  const verificationUrlWidth = 419;
  let verificationUrlSize = 7.2;
  while (verificationUrlSize > 5.5 && regular.widthOfTextAtSize(verificationUrl, verificationUrlSize) > verificationUrlWidth) {
    verificationUrlSize -= 0.2;
  }
  page.drawText(verificationUrl, {
    x: 145,
    y: verificationTop - 72,
    font: regular,
    size: verificationUrlSize,
    color: FOREST,
  });

  const disclaimer = `${copy.generalDisclaimer} ${data.receipt_type === "partial" ? copy.partialDisclaimer : copy.finalDisclaimer}`;
  page.drawRectangle({ x: 24, y: 24, width: 564, height: 84, color: rgb(0.96, 0.95, 0.92) });
  drawWrapped(page, disclaimer, 48, 87, 516, regular, 8.2, MUTED);
  page.drawText("CEBOLLETAS.MX", { x: 48, y: 36, font: bold, size: 7, color: FOREST });

  return await document.save({ useObjectStreams: true });
}
