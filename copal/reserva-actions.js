// Reserva validation and delivery actions.
// Intentionally independent from the Version 4 navigation code.
(function initReservaActions() {
  "use strict";

  const RESERVA_CONTACT = Object.freeze({
    whatsapp: "524491028878",
    email: "cebolletascalvillo@gmail.com",
    emailCc: "elcrio88@gmail.com"
  });

  const SUPABASE = Object.freeze({
    url: "https://myqaotknkriuhdssbzlz.supabase.co",
    publishableKey: "sb_publishable_XuDt5xNF3EzE0K2TSE9QCg_hnDMWsVN"
  });

//  const RESERVA_CONTACT = Object.freeze({
//    whatsapp: "524491576284",
//    email: "cebolletascalvillo@gmail.com",
//    emailCc: "thecoyoteco@gmail.com"
//  });

  const limits = Object.freeze({
    adults: 20,
    kids: 20,
    name: 100,
    email: 254,
    cell: 25,
    otherDetails: 1000
  });
  let activeServices = [];

  const messages = {
    es: {
      requiredCheckin: "La fecha de llegada es requerida.",
      pastCheckin: "La fecha de llegada no puede estar en el pasado.",
      requiredCheckout: "La fecha de salida es requerida.",
      invalidCheckout: "La fecha de salida debe ser posterior a la fecha de llegada.",
      invalidAdults: "Adultos debe ser un n\u00famero entero entre 1 y 20.",
      invalidKids: "Ni\u00f1os debe ser un n\u00famero entero entre 0 y 20.",
      invalidInfants: "Menores de 3 a\u00f1os debe ser un n\u00famero entero entre 0 y 20.",
      requiredService: "Selecciona un servicio.",
      capacityExceeded: "El n\u00famero de hu\u00e9spedes excede la capacidad del servicio.",
      requiredName: "El nombre es requerido.",
      shortName: "El nombre debe contener al menos 5 letras.",
      invalidName: "Usa \u00fanicamente letras, espacios, ap\u00f3strofes, puntos o guiones.",
      longName: "El nombre es demasiado largo (m\u00e1ximo 100 caracteres).",
      requiredEmail: "El email es requerido.",
      invalidEmail: "El formato del email no es v\u00e1lido.",
      requiredCell: "El celular es requerido.",
      invalidCell: "Ingresa un celular v\u00e1lido de 10 a 15 d\u00edgitos.",
      requiredInfo: "Selecciona al menos una opci\u00f3n.",
      longOther: "El texto es demasiado largo (m\u00e1ximo 1000 caracteres).",
      savingRequest: "Guardando tu solicitud\u2026",
      openingChannels: "Solicitud guardada. Abriendo WhatsApp y email\u2026",
      saveFailed: "No fue posible guardar la solicitud. Intenta nuevamente.",
      automaticAction: "Solicitar reservaci\u00f3n",
      manualAction: "Solicitar cotizaci\u00f3n",
      infoSubject: "Solicitud de informaci\u00f3n",
      labels: {
        staySummary: "Resumen de estancia",
        checkin: "Fecha llegada",
        checkout: "Fecha salida",
        nights: "Noches",
        weekendNights: "Noches de fin de semana",
        weekdayNights: "Noches entre semana",
        adults: "Adultos",
        kids: "Ni\u00f1os",
        infants: "Menores de 3 a\u00f1os",
        name: "Nombre",
        email: "Email",
        cell: "Celular",
        requestedInfo: "Servicio",
        estimatedTotal: "Total estimado",
        otherDetails: "Otra informaci\u00f3n"
      },
      infoOptions: {
        copal: "Hospedarse en Cebolletas Copal",
        camping: "Acampar",
        events: "Eventos"
      }
    },
    en: {
      requiredCheckin: "Check-in is required.",
      pastCheckin: "Check-in cannot be in the past.",
      requiredCheckout: "Checkout is required.",
      invalidCheckout: "Checkout must be later than check-in.",
      invalidAdults: "Adults must be a whole number between 1 and 20.",
      invalidKids: "Kids must be a whole number between 0 and 20.",
      invalidInfants: "Children under 3 must be a whole number between 0 and 20.",
      requiredService: "Select one service.",
      capacityExceeded: "The number of guests exceeds this service's capacity.",
      requiredName: "Name is required.",
      shortName: "Name must contain at least 5 letters.",
      invalidName: "Use only letters, spaces, apostrophes, periods, or hyphens.",
      longName: "Name is too long (maximum 100 characters).",
      requiredEmail: "Email is required.",
      invalidEmail: "Email format is invalid.",
      requiredCell: "Cellphone is required.",
      invalidCell: "Enter a valid cellphone number containing 10 to 15 digits.",
      requiredInfo: "Select at least one option.",
      longOther: "Text is too long (maximum 1000 characters).",
      savingRequest: "Saving your request\u2026",
      openingChannels: "Request saved. Opening WhatsApp and email\u2026",
      saveFailed: "We could not save your request. Please try again.",
      automaticAction: "Request booking",
      manualAction: "Request quotation",
      infoSubject: "Information request",
      labels: {
        staySummary: "Stay summary",
        checkin: "Check-in",
        checkout: "Checkout",
        nights: "Nights",
        weekendNights: "Weekend nights",
        weekdayNights: "Weekday nights",
        adults: "Adults",
        kids: "Kids",
        infants: "Children under 3",
        name: "Name",
        email: "Email",
        cell: "Cellphone",
        requestedInfo: "Service",
        estimatedTotal: "Estimated total",
        otherDetails: "Other information"
      },
      infoOptions: {
        copal: "Staying at Cebolletas Copal",
        camping: "Camping",
        events: "Events"
      }
    }
  };

  function getLanguage() {
    return document.documentElement.lang === "en" ? "en" : "es";
  }

  function getForm() {
    return document.getElementById("reserva-form");
  }

  function formatMoney(cents, locale = getLanguage()) {
    return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0
    }).format(cents / 100);
  }

  function selectedService(form) {
    const id = form?.querySelector('input[name="service-id"]:checked')?.value;
    return activeServices.find((service) => service.service_id === id) || null;
  }

  function localized(service, field) {
    return service?.[`${field}_${getLanguage()}`] || "";
  }

  function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function calculateQuote(service, stay, adults, children, infants) {
    if (!service || !stay) return null;
    const totalGuests = adults + children + infants;
    if (![adults, children, infants].every(Number.isInteger) || totalGuests > service.max_occupancy) {
      return { capacityExceeded: true, totalGuests };
    }
    if (service.price_on_request) {
      return { manual: true, totalGuests, nights: stay.nights };
    }
    const extraAdults = Math.max(adults - service.included_guests, 0);
    const remainingIncluded = Math.max(service.included_guests - adults, 0);
    const extraChildren = Math.max(children - remainingIncluded, 0);
    const nightlyTotal = service.base_price_cents
      + (extraAdults * service.adult_extra_cents)
      + (extraChildren * service.child_extra_cents);
    return {
      manual: false,
      totalGuests,
      nights: stay.nights,
      extraAdults,
      extraChildren,
      nightlyTotal,
      total: nightlyTotal * stay.nights
    };
  }

  function renderServices(form) {
    const host = form?.querySelector("#br-service-options");
    if (!host) return;
    const legend = host.querySelector("legend")?.outerHTML || "";
    if (!activeServices.length) {
      host.innerHTML = `${legend}<p class="service-empty">${getLanguage() === "es"
        ? "No hay servicios activos disponibles por el momento."
        : "There are no active services available right now."}</p>`;
      return;
    }
    host.innerHTML = `${legend}<div class="service-grid">${activeServices.map((service, index) => {
      const amenities = service[`amenities_${getLanguage()}`] || [];
      const price = service.price_on_request
        ? (getLanguage() === "es" ? "Precio a consultar" : "Custom quotation")
        : `${getLanguage() === "es" ? "Desde" : "From"} ${formatMoney(service.base_price_cents)} / ${getLanguage() === "es" ? "noche" : "night"}`;
      return `<label class="service-card">
        <input type="radio" name="service-id" value="${service.service_id}" ${index === 0 ? "checked" : ""}>
        <strong>${escapeHtml(localized(service, "name"))}</strong>
        <p>${escapeHtml(localized(service, "description"))}</p>
        ${amenities.length ? `<ul>${amenities.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        <small>${price} \u00b7 ${getLanguage() === "es" ? "M\u00e1ximo" : "Up to"} ${service.max_occupancy}</small>
      </label>`;
    }).join("")}</div>`;
  }

  function updateQuoteSummary(form) {
    const host = form?.querySelector("#br-quote-summary");
    if (!host) return null;
    const service = selectedService(form);
    const stay = calculateStay(
      form.querySelector("#br-checkin")?.value || "",
      form.querySelector("#br-checkout")?.value || ""
    );
    const adults = Number(form.querySelector("#br-adults")?.value);
    const children = Number(form.querySelector("#br-kids")?.value);
    const infants = Number(form.querySelector("#br-infants")?.value);
    const quote = calculateQuote(service, stay, adults, children, infants);
    const isEs = getLanguage() === "es";
    const action = form.querySelector("#br-request-info");
    if (action && !action.disabled) {
      action.textContent = quote?.manual
        ? messages[getLanguage()].manualAction
        : messages[getLanguage()].automaticAction;
    }

    host.classList.toggle("manual", Boolean(quote?.manual));
    if (!service || !stay || !quote) {
      host.innerHTML = `<p class="quote-summary-placeholder">${isEs
        ? "Selecciona un servicio, fechas y hu\u00e9spedes para ver el total estimado."
        : "Select a service, dates and guests to see the estimated total."}</p>`;
      return quote;
    }
    if (quote.capacityExceeded) {
      host.innerHTML = `<p class="quote-capacity-error">${messages[getLanguage()].capacityExceeded} (${quote.totalGuests}/${service.max_occupancy})</p>`;
      return quote;
    }
    if (quote.manual) {
      host.innerHTML = `<h3>${escapeHtml(localized(service, "name"))}</h3>
        <div class="quote-summary-row"><span>${stay.nights} ${isEs ? "noche(s)" : "night(s)"}</span><span>${quote.totalGuests}/${service.max_occupancy} ${isEs ? "hu\u00e9spedes" : "guests"}</span></div>
        <div class="quote-summary-row total"><span>${isEs ? "Cotizaci\u00f3n personalizada" : "Custom quotation"}</span><strong>${isEs ? "A consultar" : "Contact us"}</strong></div>
        <p class="quote-summary-note">${isEs ? "Revisaremos los detalles y confirmaremos el precio contigo." : "We will review the details and confirm the price with you."}</p>`;
      return quote;
    }

    host.innerHTML = `<h3>${escapeHtml(localized(service, "name"))}</h3>
      <div class="quote-summary-row"><span>${stay.nights} \u00d7 ${isEs ? "base por noche" : "nightly base"}</span><strong>${formatMoney(service.base_price_cents * stay.nights)}</strong></div>
      ${quote.extraAdults ? `<div class="quote-summary-row"><span>${quote.extraAdults} \u00d7 ${isEs ? "adulto extra" : "extra adult"} \u00d7 ${stay.nights}</span><strong>${formatMoney(quote.extraAdults * service.adult_extra_cents * stay.nights)}</strong></div>` : ""}
      ${quote.extraChildren ? `<div class="quote-summary-row"><span>${quote.extraChildren} \u00d7 ${isEs ? "ni\u00f1o extra" : "extra child"} \u00d7 ${stay.nights}</span><strong>${formatMoney(quote.extraChildren * service.child_extra_cents * stay.nights)}</strong></div>` : ""}
      ${infants ? `<div class="quote-summary-row"><span>${infants} \u00d7 ${isEs ? "menor de 3 a\u00f1os" : "child under 3"}</span><strong>${formatMoney(0)}</strong></div>` : ""}
      <div class="quote-summary-row total"><span>${isEs ? "Total estimado" : "Estimated total"}</span><strong>${formatMoney(quote.total)}</strong></div>
      <p class="quote-summary-note">${isEs ? "Sujeto a confirmaci\u00f3n de disponibilidad." : "Subject to availability confirmation."}</p>`;
    return quote;
  }

  async function loadActiveServices(form) {
    const response = await fetch(`${SUPABASE.url}/rest/v1/rpc/get_active_service_catalog`, {
      method: "POST",
      headers: {
        apikey: SUPABASE.publishableKey,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    if (!response.ok) throw new Error(`Catalog request failed with status ${response.status}`);
    activeServices = await response.json();
    renderServices(form);
    updateQuoteSummary(form);
  }

  function getLocalDate() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseIsoDateUtc(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  function calculateStay(checkinValue, checkoutValue) {
    const checkin = parseIsoDateUtc(checkinValue);
    const checkout = parseIsoDateUtc(checkoutValue);
    if (!checkin || !checkout || checkout <= checkin) return null;

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const nights = Math.round((checkout - checkin) / millisecondsPerDay);
    let weekendNights = 0;

    for (
      const night = new Date(checkin);
      night < checkout;
      night.setUTCDate(night.getUTCDate() + 1)
    ) {
      const dayOfWeek = night.getUTCDay();
      if (dayOfWeek === 5 || dayOfWeek === 6) weekendNights += 1;
    }

    return {
      nights,
      weekendNights,
      weekdayNights: nights - weekendNights
    };
  }

  function updateStaySummary(form) {
    if (!form) return null;
    const summary = form.querySelector("#br-stay-summary");
    const stay = calculateStay(
      form.querySelector("#br-checkin")?.value || "",
      form.querySelector("#br-checkout")?.value || ""
    );

    if (!summary) return stay;
    summary.hidden = !stay;
    if (stay) {
      summary.querySelector("#br-nights").textContent = String(stay.nights);
      summary.querySelector("#br-weekend-nights").textContent = String(
        stay.weekendNights
      );
      summary.querySelector("#br-weekday-nights").textContent = String(
        stay.weekdayNights
      );
    }
    return stay;
  }

  function sanitizeSingleLine(value) {
    return String(value)
      .normalize("NFKC")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeMultiline(value) {
    return String(value)
      .normalize("NFKC")
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim();
  }

  function getErrorHost(input) {
    if (!input) return null;
    if (input.matches("fieldset")) return input;
    return input.closest("label") || input;
  }

  function clearFieldError(input) {
    if (!input) return;
    const host = getErrorHost(input);
    host?.querySelector(":scope > .reserva-field-error")?.remove();
    input.removeAttribute("aria-invalid");
    if (input.matches("fieldset")) {
      input.querySelectorAll("[aria-invalid]").forEach((item) => {
        item.removeAttribute("aria-invalid");
      });
    }
  }

  function showFieldError(input, message) {
    if (!input) return;
    clearFieldError(input);
    const error = document.createElement("span");
    error.className = "reserva-field-error";
    error.textContent = message;
    const host = getErrorHost(input);
    host.appendChild(error);
    input.setAttribute("aria-invalid", "true");
  }

  function validate(form) {
    const text = messages[getLanguage()];
    const fields = {
      checkin: form.querySelector("#br-checkin"),
      checkout: form.querySelector("#br-checkout"),
      adults: form.querySelector("#br-adults"),
      kids: form.querySelector("#br-kids"),
      infants: form.querySelector("#br-infants"),
      name: form.querySelector("#br-name"),
      email: form.querySelector("#br-email"),
      cell: form.querySelector("#br-cell"),
      service: form.querySelector("#br-service-options"),
      otherDetails: form.querySelector("#br-other-details")
    };
    const service = selectedService(form);

    const data = {
      checkin: fields.checkin.value,
      checkout: fields.checkout.value,
      stay: calculateStay(fields.checkin.value, fields.checkout.value),
      adults: Number(fields.adults.value),
      kids: Number(fields.kids.value),
      infants: Number(fields.infants.value),
      name: sanitizeSingleLine(fields.name.value),
      email: sanitizeSingleLine(fields.email.value),
      cell: sanitizeSingleLine(fields.cell.value),
      service,
      otherDetails: sanitizeMultiline(fields.otherDetails.value)
    };

    form.querySelectorAll(".reserva-field-error").forEach((element) => element.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute("aria-invalid");
    });

    let firstInvalid = null;
    const reject = (field, message, focusTarget = field) => {
      showFieldError(field, message);
      firstInvalid ||= focusTarget;
    };
    const today = getLocalDate();

    if (!data.checkin) reject(fields.checkin, text.requiredCheckin);
    else if (data.checkin < today) reject(fields.checkin, text.pastCheckin);

    if (!data.checkout) reject(fields.checkout, text.requiredCheckout);
    else if (data.checkin && (!data.stay || data.checkout <= data.checkin)) {
      reject(fields.checkout, text.invalidCheckout);
    }

    if (!Number.isInteger(data.adults) || data.adults < 1 || data.adults > limits.adults) {
      reject(fields.adults, text.invalidAdults);
    }

    if (!Number.isInteger(data.kids) || data.kids < 0 || data.kids > limits.kids) {
      reject(fields.kids, text.invalidKids);
    }

    if (!Number.isInteger(data.infants) || data.infants < 0 || data.infants > limits.kids) {
      reject(fields.infants, text.invalidInfants);
    }

    if (!data.service) {
      reject(
        fields.service,
        text.requiredService,
        fields.service.querySelector('input[name="service-id"]') || fields.service
      );
    } else if (
      Number.isInteger(data.adults) &&
      Number.isInteger(data.kids) &&
      Number.isInteger(data.infants) &&
      data.adults + data.kids + data.infants > data.service.max_occupancy
    ) {
      reject(fields.service, text.capacityExceeded, fields.adults);
    }

    const letterCount = (data.name.match(/\p{L}/gu) || []).length;
    if (!data.name) reject(fields.name, text.requiredName);
    else if (letterCount < 5) reject(fields.name, text.shortName);
    else if (data.name.length > limits.name) reject(fields.name, text.longName);
    else if (!/^[\p{L}\p{M} .'\-]+$/u.test(data.name)) {
      reject(fields.name, text.invalidName);
    }

    if (!data.email) reject(fields.email, text.requiredEmail);
    else if (
      data.email.length > limits.email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)
    ) {
      reject(fields.email, text.invalidEmail);
    }

    const cellDigits = data.cell.replace(/\D/g, "");
    if (!data.cell) reject(fields.cell, text.requiredCell);
    else if (
      data.cell.length > limits.cell ||
      !/^\+?[\d\s().-]+$/.test(data.cell) ||
      cellDigits.length < 10 ||
      cellDigits.length > 15
    ) {
      reject(fields.cell, text.invalidCell);
    }

    if (data.otherDetails.length > limits.otherDetails) {
      reject(fields.otherDetails, text.longOther);
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return { isValid: false, data: null };
    }

    fields.name.value = data.name;
    fields.email.value = data.email;
    fields.cell.value = data.cell;
    fields.otherDetails.value = data.otherDetails;
    return { isValid: true, data };
  }

  function buildMessage(data) {
    const text = messages[getLanguage()];
    const labels = text.labels;
    const quote = calculateQuote(data.service, data.stay, data.adults, data.kids, data.infants);
    const lines = [
      `${labels.staySummary}:`,
      `${labels.checkin}: ${data.checkin}`,
      `${labels.checkout}: ${data.checkout}`,
      `${labels.nights}: ${data.stay.nights}`,
      `${labels.weekendNights}: ${data.stay.weekendNights}`,
      `${labels.weekdayNights}: ${data.stay.weekdayNights}`,
      "",
      `${labels.adults}: ${data.adults}`,
      `${labels.kids}: ${data.kids}`,
      `${labels.infants}: ${data.infants}`,
      `${labels.name}: ${data.name}`,
      `${labels.email}: ${data.email}`,
      `${labels.cell}: ${data.cell}`,
      `${labels.requestedInfo}: ${localized(data.service, "name")}`
    ];

    if (quote && !quote.manual && !quote.capacityExceeded) {
      lines.push(`${labels.estimatedTotal}: ${formatMoney(quote.total)}`);
    } else if (quote?.manual) {
      lines.push(`${labels.estimatedTotal}: ${getLanguage() === "es" ? "Cotizaci\u00f3n personalizada" : "Custom quotation"}`);
    }

    if (data.otherDetails) {
      lines.push(`${labels.otherDetails}: ${data.otherDetails}`);
    }
    return lines.join("\n");
  }

  function buildSubject(data) {
    const text = messages[getLanguage()];
    return `${getLocalDate()} | ${text.infoSubject} - ${data.name}`;
  }

  function showStatus(message, duration = 1800) {
    document.querySelector(".reserva-status-overlay")?.remove();
    const overlay = document.createElement("div");
    const modal = document.createElement("div");
    overlay.className = "reserva-status-overlay";
    overlay.setAttribute("role", "status");
    modal.className = "reserva-status-modal";
    modal.textContent = message;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    window.setTimeout(() => overlay.remove(), duration);
  }

  function configureDateLimits(form) {
    if (!form) return;
    const checkin = form.querySelector("#br-checkin");
    const checkout = form.querySelector("#br-checkout");
    const today = getLocalDate();
    checkin.min = today;
    checkout.min = checkin.value || today;
  }

  function clearForm(form) {
    form.reset();
    form.querySelectorAll(".reserva-field-error").forEach((element) => element.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute("aria-invalid");
    });
    configureDateLimits(form);
    updateStaySummary(form);
    renderServices(form);
    updateQuoteSummary(form);
  }

  function buildWhatsAppUrl(message) {
    return (
      `https://wa.me/${RESERVA_CONTACT.whatsapp}` +
      `?text=${encodeURIComponent(message)}`
    );
  }

  function buildEmailUrl(data, message) {
    const query = new URLSearchParams({
      cc: RESERVA_CONTACT.emailCc,
      subject: buildSubject(data),
      body: message
    });
    return `mailto:${RESERVA_CONTACT.email}?${query.toString()}`;
  }

  function createSubmissionKey() {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10).join("")
    ].join("-");
  }

  async function saveInformationRequest(data, submissionKey) {
    const response = await fetch(
      `${SUPABASE.url}/rest/v1/rpc/create_information_request`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE.publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_submission_key: submissionKey,
          p_locale: getLanguage(),
          p_customer_name: data.name,
          p_customer_email: data.email,
          p_customer_cellphone: data.cell,
          p_checkin_date: data.checkin,
          p_checkout_date: data.checkout,
          p_adults: data.adults,
          p_children: data.kids,
          p_infants: data.infants,
          p_service_id: data.service.service_id,
          p_customer_message: data.otherDetails || null
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Information request failed with status ${response.status}`);
    }

    return response.json();
  }

  document.addEventListener("reserva:rendered", () => {
    const form = getForm();
    configureDateLimits(form);
    updateStaySummary(form);
    loadActiveServices(form).catch((error) => {
      console.error(error);
      const host = form?.querySelector("#br-service-options");
      if (host) {
        const legend = host.querySelector("legend")?.outerHTML || "";
        host.innerHTML = `${legend}<p class="service-empty">${getLanguage() === "es"
          ? "No fue posible cargar los servicios. Intenta nuevamente."
          : "Services could not be loaded. Please try again."}</p>`;
      }
    });
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#reserva-form")) event.preventDefault();
  });

  document.addEventListener("focusin", (event) => {
    if (!event.target.closest("#reserva-form")) return;
    clearFieldError(event.target);
    if (event.target.matches('input[name="service-id"]')) {
      clearFieldError(event.target.closest(".service-options"));
    }
  });

  function handleDateUpdate(event) {
    if (
      !event.target.matches(
        "#reserva-form #br-checkin, #reserva-form #br-checkout"
      )
    ) {
      return;
    }
    const form = getForm();
    if (event.target.matches("#br-checkin")) {
      const checkout = form.querySelector("#br-checkout");
      checkout.min = event.target.value || getLocalDate();
    }
    updateStaySummary(form);
    updateQuoteSummary(form);
  }

  document.addEventListener("input", handleDateUpdate);
  document.addEventListener("change", handleDateUpdate);
  document.addEventListener("input", (event) => {
    if (event.target.matches("#br-adults, #br-kids, #br-infants")) {
      updateQuoteSummary(getForm());
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches('input[name="service-id"]')) {
      updateQuoteSummary(getForm());
    }
  });

  let pendingSubmission = null;

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("#reserva-form #br-request-info");
    if (!button) return;
    const form = getForm();
    const result = validate(form);
    if (!result.isValid) return;

    // Build the outbound content once so WhatsApp and email receive the exact
    // same validated stay breakdown.
    const outboundMessage = buildMessage(result.data);
    const whatsappUrl = buildWhatsAppUrl(outboundMessage);
    const emailUrl = buildEmailUrl(result.data, outboundMessage);
    const text = messages[getLanguage()];
    const originalLabel = button.textContent;
    const whatsappWindow = window.open("", "_blank");
    const submissionFingerprint = JSON.stringify(result.data);
    if (pendingSubmission?.fingerprint !== submissionFingerprint) {
      pendingSubmission = {
        key: createSubmissionKey(),
        fingerprint: submissionFingerprint
      };
    }

    button.disabled = true;
    button.textContent = text.savingRequest;
    showStatus(text.savingRequest);

    try {
      await saveInformationRequest(result.data, pendingSubmission.key);
    } catch (error) {
      console.error(error);
      whatsappWindow?.close();
      button.disabled = false;
      button.textContent = originalLabel;
      showStatus(text.saveFailed, 4500);
      return;
    }

    showStatus(text.openingChannels);
    if (whatsappWindow) {
      whatsappWindow.opener = null;
      whatsappWindow.location.href = whatsappUrl;
    } else {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    }
    window.location.href = emailUrl;
    clearForm(form);
    pendingSubmission = null;
    button.disabled = false;
    button.textContent = originalLabel;
  });
})();
