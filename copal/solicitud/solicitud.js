import config from "../config/environment.js";

const $ = (selector) => document.querySelector(selector);
const endpoint = `${config.supabaseUrl}/functions/v1/request-summary`;
let accessToken = "";
let currentRequest = null;

const COPY = {
  es: {
    title: "Resumen de solicitud",
    eyebrow: "Información actual de tu solicitud",
    beneficiary: "A favor de",
    requestContact: "Contacto de la solicitud",
    phone: "Teléfono",
    email: "Correo electrónico",
    details: "Detalle de la solicitud",
    service: "Servicio",
    checkin: "Llegada",
    checkout: "Salida",
    adults: "Adultos",
    children: "Niños",
    infants: "Menores de 3 años",
    total: "Total cotizado",
    whatsapp: "Preguntar por WhatsApp",
    whatsappUnavailable: "El contacto de WhatsApp no está disponible temporalmente. Comunícate con Cebolletas por otro medio.",
    whatsappMessage: (folio) => `Hola, tengo una pregunta sobre la solicitud ${folio}.`,
    pdf: "Descargar Resumen de solicitud",
    pdfLoading: "Preparando PDF...",
    pdfError: "No fue posible descargar el PDF. Intenta nuevamente.",
    disclaimer: "Este resumen no confirma una reservación ni acredita la recepción de pago.",
    updated: "Última actualización",
    locale: "es-MX",
  },
  en: {
    title: "Request summary",
    eyebrow: "Current request information",
    beneficiary: "For",
    requestContact: "Request contact",
    phone: "Telephone",
    email: "Email",
    details: "Request details",
    service: "Service",
    checkin: "Check-in",
    checkout: "Checkout",
    adults: "Adults",
    children: "Children",
    infants: "Children under 3",
    total: "Quoted total",
    whatsapp: "Ask on WhatsApp",
    whatsappUnavailable: "The WhatsApp contact is temporarily unavailable. Please contact Cebolletas another way.",
    whatsappMessage: (folio) => `Hello, I have a question about request ${folio}.`,
    pdf: "Download Request summary",
    pdfLoading: "Preparing PDF...",
    pdfError: "We could not download the PDF. Please try again.",
    disclaimer: "This summary does not confirm a reservation or acknowledge receipt of payment.",
    updated: "Last updated",
    locale: "en-US",
  },
};

function showState(name) {
  ["loading", "unavailable", "network"].forEach((state) => {
    $(`#${state}-state`).classList.toggle("hidden", state !== name);
  });
  $("#request-view").classList.toggle("hidden", name !== "request");
}

function fragmentToken() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get("access") || "";
  if (window.location.hash) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  return token;
}

function formatDate(value, language) {
  return new Intl.DateTimeFormat(COPY[language].locale, {
    dateStyle: "long",
    timeZone: "America/Mexico_City",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

function formatDateTime(value, language) {
  return new Intl.DateTimeFormat(COPY[language].locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function formatMoney(cents, language) {
  return new Intl.NumberFormat(COPY[language].locale, {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: Number(cents) % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(cents) / 100);
}

function setContact(prefix, contact, copy) {
  $(`#${prefix}-name`).textContent = contact.name;
  $(`#${prefix}-phone-label`).textContent = copy.phone;
  $(`#${prefix}-email-label`).textContent = copy.email;
  const phone = $(`#${prefix}-phone`);
  const email = $(`#${prefix}-email`);
  phone.textContent = contact.phone;
  phone.href = `tel:${contact.phone.replace(/[^+\d]/g, "")}`;
  email.textContent = contact.email;
  email.href = `mailto:${contact.email}`;
}

function renderRequest(request) {
  const language = request.publication_language === "en" ? "en" : "es";
  const copy = COPY[language];
  document.documentElement.lang = language;
  document.title = `${copy.title} ${request.folio} | Cebolletas Copal`;

  $("#request-eyebrow").textContent = copy.eyebrow;
  $("#request-title").textContent = copy.title;
  $("#request-folio").textContent = request.folio;
  $("#request-status").textContent = request.status_label;
  $("#beneficiary-title").textContent = copy.beneficiary;
  setContact("beneficiary", request.beneficiary, copy);

  const contactSection = $("#request-contact-section");
  contactSection.classList.toggle("hidden", !request.request_contact);
  if (request.request_contact) {
    $("#request-contact-title").textContent = copy.requestContact;
    setContact("request-contact", request.request_contact, copy);
  }

  $("#details-title").textContent = copy.details;
  $("#service-label").textContent = copy.service;
  $("#service-value").textContent = request.service;
  $("#checkin-label").textContent = copy.checkin;
  $("#checkout-label").textContent = copy.checkout;
  $("#checkin-value").textContent = formatDate(request.checkin_date, language);
  $("#checkout-value").textContent = formatDate(request.checkout_date, language);
  [["adults", copy.adults], ["children", copy.children], ["infants", copy.infants]].forEach(([key, label]) => {
    $(`#${key}-label`).textContent = label;
    $(`#${key}-value`).textContent = String(request[key]);
  });

  const hasAmount = Number.isSafeInteger(request.quoted_total_cents) && request.quoted_total_cents >= 0;
  $("#amount-section").classList.toggle("hidden", !hasAmount);
  if (hasAmount) {
    $("#amount-label").textContent = copy.total;
    $("#amount-value").textContent = formatMoney(request.quoted_total_cents, language);
  }

  const whatsapp = $("#whatsapp-action");
  const unavailable = $("#whatsapp-unavailable");
  const validWhatsApp = /^\+[1-9]\d{7,14}$/.test(request.whatsapp?.phone_e164 || "");
  whatsapp.classList.toggle("hidden", !validWhatsApp);
  unavailable.classList.toggle("hidden", validWhatsApp);
  if (validWhatsApp) {
    whatsapp.textContent = copy.whatsapp;
    whatsapp.href = `https://wa.me/${request.whatsapp.phone_e164.slice(1)}?text=${encodeURIComponent(copy.whatsappMessage(request.folio))}`;
    whatsapp.setAttribute("aria-label", `${copy.whatsapp} - ${request.whatsapp.display_name}`);
  } else {
    unavailable.textContent = copy.whatsappUnavailable;
  }

  $("#pdf-action").textContent = copy.pdf;
  $("#disclaimer").textContent = copy.disclaimer;
  $("#last-updated").textContent = `${copy.updated}: ${formatDateTime(request.last_updated_at, language)}`;
  showState("request");
}

async function fetchSummary() {
  if (!accessToken) {
    showState("unavailable");
    return;
  }
  showState("loading");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token: accessToken, format: "json" }),
    });
    if (!response.ok) {
      showState("unavailable");
      return;
    }
    const payload = await response.json();
    if (!payload?.request) {
      showState("unavailable");
      return;
    }
    currentRequest = payload.request;
    renderRequest(currentRequest);
  } catch {
    showState("network");
  }
}

async function downloadPdf() {
  if (!accessToken || !currentRequest) return;
  const language = currentRequest.publication_language === "en" ? "en" : "es";
  const copy = COPY[language];
  const button = $("#pdf-action");
  const message = $("#pdf-message");
  button.disabled = true;
  button.textContent = copy.pdfLoading;
  message.textContent = "";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token: accessToken, format: "pdf" }),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("PDF unavailable");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const disposition = response.headers.get("content-disposition") || "";
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `${currentRequest.folio}.pdf`;
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch {
    message.textContent = copy.pdfError;
  } finally {
    button.disabled = false;
    button.textContent = copy.pdf;
  }
}

$("#retry-button").addEventListener("click", fetchSummary);
$("#pdf-action").addEventListener("click", downloadPdf);
accessToken = fragmentToken();
await fetchSummary();
