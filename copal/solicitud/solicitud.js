import config from "../config/environment.js?v=10.7.1";

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
    paymentEyebrow: "Pagos verificados",
    paymentSummary: "Estado de pago",
    paid: "Pagado verificado",
    balance: "Saldo pendiente",
    credit: "Saldo a favor",
    paymentStates: { unpaid: "Sin pago", partially_paid: "Pago parcial", paid_in_full: "Pagado", paid_in_full_with_credit: "Pagado con saldo a favor", quote_required: "Cotización pendiente" },
    review: "La información de pagos está siendo revisada. El saldo mostrado refleja los pagos verificados activos.",
    historyEyebrow: "Movimientos activos",
    history: "Historial de pagos",
    receiptTypes: { partial: "Recibo parcial", final: "Recibo final", final_credit: "Recibo final con saldo a favor" },
    receipt: "Descargar recibo",
    receiptLoading: "Preparando recibo…",
    receiptError: "No fue posible descargar el recibo. Intenta nuevamente.",
    reference: "Referencia",
    creditEyebrow: "Conciliación",
    creditHistory: "Saldos a favor resueltos",
    creditResolved: "Saldo a favor resuelto",
    whatsapp: "Preguntar por WhatsApp",
    whatsappUnavailable: "El contacto de WhatsApp no está disponible temporalmente. Comunícate con Cebolletas por otro medio.",
    whatsappMessage: (folio) => `Hola, tengo una pregunta sobre la solicitud ${folio}.`,
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
    paymentEyebrow: "Verified payments",
    paymentSummary: "Payment status",
    paid: "Verified paid",
    balance: "Balance due",
    credit: "Credit balance",
    paymentStates: { unpaid: "Unpaid", partially_paid: "Partially paid", paid_in_full: "Paid in full", paid_in_full_with_credit: "Paid in full with credit", quote_required: "Quote pending" },
    review: "Payment information is under staff review. The balance shown reflects active verified payments.",
    historyEyebrow: "Active transactions",
    history: "Payment history",
    receiptTypes: { partial: "Partial receipt", final: "Final receipt", final_credit: "Final receipt with credit" },
    receipt: "Download receipt",
    receiptLoading: "Preparing receipt…",
    receiptError: "We could not download the receipt. Please try again.",
    reference: "Reference",
    creditEyebrow: "Reconciliation",
    creditHistory: "Resolved credit balances",
    creditResolved: "Credit balance resolved",
    whatsapp: "Ask on WhatsApp",
    whatsappUnavailable: "The WhatsApp contact is temporarily unavailable. Please contact Cebolletas another way.",
    whatsappMessage: (folio) => `Hello, I have a question about request ${folio}.`,
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

  renderPayments(request, language, copy);

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

  $("#disclaimer").textContent = copy.disclaimer;
  $("#last-updated").textContent = `${copy.updated}: ${formatDateTime(request.last_updated_at, language)}`;
  showState("request");
}

function renderPayments(request, language, copy) {
  const financial = request.financial;
  const validFinancial = financial && Number.isSafeInteger(financial.quoted_total_cents);
  $("#payment-summary-section").classList.toggle("hidden", !validFinancial);
  if (!validFinancial) return;
  $("#payment-summary-eyebrow").textContent = copy.paymentEyebrow;
  $("#payment-summary-title").textContent = copy.paymentSummary;
  $("#payment-status").textContent = copy.paymentStates[financial.payment_status] || financial.payment_status;
  $("#financial-quoted-label").textContent = copy.total;
  $("#financial-paid-label").textContent = copy.paid;
  $("#financial-balance-label").textContent = copy.balance;
  $("#financial-credit-label").textContent = copy.credit;
  $("#financial-quoted").textContent = formatMoney(financial.quoted_total_cents, language);
  $("#financial-paid").textContent = formatMoney(financial.verified_paid_cents, language);
  $("#financial-balance").textContent = formatMoney(financial.balance_due_cents, language);
  $("#financial-credit").textContent = formatMoney(financial.credit_cents, language);
  $("#financial-credit-item").classList.toggle("hidden", financial.credit_cents <= 0);
  $("#payment-review-message").textContent = copy.review;
  $("#payment-review-message").classList.toggle("hidden", !financial.staff_review_required);

  const payments = Array.isArray(request.payments) ? request.payments : [];
  $("#payment-history-section").classList.toggle("hidden", !payments.length);
  $("#payment-history-eyebrow").textContent = copy.historyEyebrow;
  $("#payment-history-title").textContent = copy.history;
  $("#payment-history").innerHTML = payments.map((payment) => `
    <article class="public-payment-item">
      <div><span>${formatDate(payment.payment_date, language)}</span><p>${escapeHtml(payment.method)} · ${copy.reference} ${escapeHtml(payment.masked_reference)}</p></div>
      <strong>${formatMoney(payment.amount_cents, language)}</strong>
      <p>${escapeHtml(payment.receipt_number)} · ${escapeHtml(copy.receiptTypes[payment.receipt_type] || payment.receipt_type)}</p>
      <button class="receipt-download" type="button" data-receipt-code="${escapeHtml(payment.receipt_download_code)}">${copy.receipt}</button>
    </article>`).join("");

  const resolutions = Array.isArray(request.credit_resolutions) ? request.credit_resolutions : [];
  $("#credit-resolution-section").classList.toggle("hidden", !resolutions.length);
  $("#credit-resolution-eyebrow").textContent = copy.creditEyebrow;
  $("#credit-resolution-title").textContent = copy.creditHistory;
  $("#credit-resolution-history").innerHTML = resolutions.map((resolution) => `
    <article class="credit-resolution-item">
      <span>${formatDate(resolution.resolution_date, language)}</span>
      <strong>${formatMoney(resolution.amount_cents, language)}</strong>
      <p>${copy.creditResolved} · ${copy.reference} ${escapeHtml(resolution.masked_reference)}</p>
    </article>`).join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value ?? "");
  return element.innerHTML;
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

async function downloadReceipt(button) {
  const code = button.dataset.receiptCode || "";
  if (!accessToken || !/^[0-9a-f]{48}$/.test(code)) return;
  const language = currentRequest?.publication_language === "en" ? "en" : "es";
  const copy = COPY[language];
  const original = button.textContent;
  button.disabled = true;
  button.textContent = copy.receiptLoading;
  $("#receipt-download-message").textContent = "";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token: accessToken, verification_code: code, format: "receipt_pdf" }),
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Receipt unavailable");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const disposition = response.headers.get("content-disposition") || "";
    anchor.href = url;
    anchor.download = disposition.match(/filename="([^"]+)"/)?.[1] || "Recibo_Cebolletas.pdf";
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch {
    $("#receipt-download-message").textContent = copy.receiptError;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

$("#retry-button").addEventListener("click", fetchSummary);
$("#payment-history").addEventListener("click", (event) => {
  const button = event.target.closest("[data-receipt-code]");
  if (button) downloadReceipt(button);
});
accessToken = fragmentToken();
await fetchSummary();
