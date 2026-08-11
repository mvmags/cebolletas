// Reserva validation and delivery actions.
// Intentionally independent from the Version 4 navigation code.
(function initReservaActions() {
  "use strict";

  const SUPABASE = Object.freeze({
    url: "https://myqaotknkriuhdssbzlz.supabase.co",
    publishableKey: "sb_publishable_XuDt5xNF3EzE0K2TSE9QCg_hnDMWsVN"
  });

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
      requestReceived: "Hemos recibido tu solicitud y a la brevedad nos pondremos en contacto",
      requestId: "ID de solicitud",
      closeConfirmation: "Cerrar",
      saveFailed: "No fue posible guardar la solicitud. Intenta nuevamente.",
      automaticAction: "Solicitar Informaci\u00f3n/Reservar",
      manualAction: "Solicitar cotizaci\u00f3n"
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
      requestReceived: "We have received your request and will contact you shortly",
      requestId: "Request ID",
      closeConfirmation: "Close",
      saveFailed: "We could not save your request. Please try again.",
      automaticAction: "Request Information/Book",
      manualAction: "Request quotation"
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
    return activeServices.find((service) => service.rate_plan_id === id) || null;
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
    if (![adults, children, infants].every(Number.isInteger)
      || totalGuests < service.min_guests || totalGuests > service.max_occupancy
      || (service.max_adults !== null && adults > service.max_adults)
      || (service.max_children !== null && children > service.max_children)
      || (service.max_infants !== null && infants > service.max_infants)) {
      return { capacityExceeded: true, totalGuests };
    }
    const units = service.booking_time_model === "fixed_window" ? 1
      : service.booking_time_model === "calendar_day" ? stay.nights + 1 : stay.nights;
    if (units < service.min_units || (service.max_units !== null && units > service.max_units)) {
      return { durationExceeded: true, totalGuests, units };
    }
    if (service.pricing_model === "manual_quote") {
      return { manual: true, totalGuests, units };
    }
    if (service.pricing_model === "fixed") {
      return { manual: false, fixed: true, totalGuests, units, total: service.base_price_cents * units };
    }
    const extraAdults = Math.max(adults - service.included_guests, 0);
    const remainingIncluded = Math.max(service.included_guests - adults, 0);
    const extraChildren = Math.max(children - remainingIncluded, 0);
    const supplementUnits = service.supplement_basis === "per_reservation" ? 1 : units;
    const supplements = (extraAdults * service.adult_extra_cents)
      + (extraChildren * service.child_extra_cents)
      + (infants * service.infant_extra_cents);
    return {
      manual: false,
      totalGuests,
      units,
      extraAdults,
      extraChildren,
      total: (service.base_price_cents * units) + (supplements * supplementUnits)
    };
  }

  function unitLabel(service, plural = false) {
    const es = getLanguage() === "es";
    if (service.booking_time_model === "fixed_window") return es ? "ventana" : "window";
    if (service.booking_time_model === "calendar_day") return es ? (plural ? "días" : "día") : (plural ? "days" : "day");
    return es ? (plural ? "noches" : "noche") : (plural ? "nights" : "night");
  }

  function priceLabel(service) {
    if (service.pricing_model === "manual_quote") return getLanguage() === "es" ? "Precio estimado" : "Estimated price";
    const prefix = service.pricing_model === "base_plus_guests" ? (getLanguage() === "es" ? "Desde " : "From ") : "";
    return `${prefix}${formatMoney(service.base_price_cents)} / ${unitLabel(service)}`;
  }

  function showServiceDetails(service) {
    const es = getLanguage() === "es";
    const amenities = service[`amenities_${getLanguage()}`] || [];
    const restrictions = localized(service, "restrictions");
    let dialog = document.querySelector("#service-details-dialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "service-details-dialog";
      dialog.className = "service-details-dialog";
      document.body.append(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog || event.target.closest("[data-close-service-details]")) dialog.close();
      });
    }
    const duration = service.booking_time_model === "fixed_window"
      ? `${String(service.window_start).slice(0, 5)}–${String(service.window_end).slice(0, 5)}`
      : `${service.min_units}${service.max_units ? `–${service.max_units}` : "+"} ${unitLabel(service, true)}`;
    dialog.innerHTML = `<article>
      <button class="service-details-close" data-close-service-details type="button" aria-label="${es ? "Cerrar" : "Close"}">×</button>
      <p class="section-label">${escapeHtml(localized(service, "rate_name"))}</p>
      <h3>${escapeHtml(localized(service, "name"))}</h3>
      <strong class="service-details-price">${escapeHtml(priceLabel(service))}</strong>
      <p>${escapeHtml(localized(service, "description"))}</p>
      <dl><div><dt>${es ? "Duración" : "Duration"}</dt><dd>${escapeHtml(duration)}</dd></div>
      <div><dt>${es ? "Capacidad" : "Capacity"}</dt><dd>${service.min_guests}–${service.max_occupancy}</dd></div></dl>
      ${restrictions ? `<section><h4>${es ? "Restricciones" : "Restrictions"}</h4><p>${escapeHtml(restrictions)}</p></section>` : ""}
      ${amenities.length ? `<section><h4>${es ? "Incluye" : "Includes"}</h4><ul>${amenities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    </article>`;
    dialog.showModal();
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
      return `<label class="service-card">
        <input type="radio" name="service-id" value="${service.rate_plan_id}" ${index === 0 ? "checked" : ""}>
        <span class="service-card-copy"><strong>${escapeHtml(localized(service, "name"))}</strong><small>${escapeHtml(priceLabel(service))}</small></span>
        <button class="service-info-button" data-service-info="${service.rate_plan_id}" type="button" aria-label="${getLanguage() === "es" ? "Ver detalles de" : "View details for"} ${escapeHtml(localized(service, "name"))}">?</button>
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
    if (quote.durationExceeded) {
      host.innerHTML = `<p class="quote-capacity-error">${isEs ? "La duración no cumple las reglas de este servicio." : "The duration does not meet this service's rules."}</p>`;
      return quote;
    }
    if (quote.manual) {
      host.innerHTML = `<h3>${escapeHtml(localized(service, "name"))}</h3>
        <div class="quote-summary-row"><span>${quote.units} ${unitLabel(service, quote.units !== 1)}</span><span>${quote.totalGuests}/${service.max_occupancy} ${isEs ? "hu\u00e9spedes" : "guests"}</span></div>
        <div class="quote-summary-row total"><span>${isEs ? "Cotizaci\u00f3n personalizada" : "Custom quotation"}</span><strong>${isEs ? "A consultar" : "Contact us"}</strong></div>
        <p class="quote-summary-note">${isEs ? "Revisaremos los detalles y confirmaremos el precio contigo." : "We will review the details and confirm the price with you."}</p>`;
      return quote;
    }

    if (quote.fixed) {
      host.innerHTML = `<h3>${escapeHtml(localized(service, "name"))}</h3>
        <div class="quote-summary-row"><span>${quote.units} × ${isEs ? "precio fijo" : "fixed price"}</span><strong>${formatMoney(quote.total)}</strong></div>
        <div class="quote-summary-row total"><span>${isEs ? "Total estimado" : "Estimated total"}</span><strong>${formatMoney(quote.total)}</strong></div>
        <p class="quote-summary-note">${isEs ? "Sujeto a confirmación de disponibilidad." : "Subject to availability confirmation."}</p>`;
      return quote;
    }

    host.innerHTML = `<h3>${escapeHtml(localized(service, "name"))}</h3>
      <div class="quote-summary-row"><span>${quote.units} × ${isEs ? "precio base" : "base price"}</span><strong>${formatMoney(service.base_price_cents * quote.units)}</strong></div>
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

  function formatRequestNumber(requestNumber) {
    return `SOL-${String(requestNumber).padStart(6, "0")}`;
  }

  function showConfirmation(requestNumber) {
    document.querySelector(".reserva-status-overlay")?.remove();
    const text = messages[getLanguage()];
    const overlay = document.createElement("div");
    const modal = document.createElement("div");
    const message = document.createElement("p");
    const reference = document.createElement("p");
    const requestId = document.createElement("strong");
    const closeButton = document.createElement("button");

    overlay.className = "reserva-status-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "reserva-confirmation-message");
    modal.className = "reserva-status-modal reserva-confirmation-modal";
    message.id = "reserva-confirmation-message";
    message.className = "reserva-confirmation-message";
    message.textContent = text.requestReceived;
    reference.className = "reserva-confirmation-reference";
    reference.textContent = `${text.requestId}: `;
    requestId.textContent = formatRequestNumber(requestNumber);
    closeButton.className = "reserva-confirmation-close";
    closeButton.type = "button";
    closeButton.textContent = text.closeConfirmation;

    const close = () => {
      document.removeEventListener("keydown", handleKeydown);
      overlay.remove();
    };
    const handleKeydown = (event) => {
      if (event.key === "Escape") close();
    };

    reference.appendChild(requestId);
    modal.append(message, reference, closeButton);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    closeButton.addEventListener("click", close);
    document.addEventListener("keydown", handleKeydown);
    closeButton.focus();
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

    const payload = await response.json();
    const savedRequest = Array.isArray(payload) ? payload[0] : payload;
    const requestNumber = Number(savedRequest?.request_number);

    if (!Number.isSafeInteger(requestNumber) || requestNumber < 1) {
      throw new Error("Information request response did not include a valid request number");
    }

    return {
      ...savedRequest,
      request_number: requestNumber
    };
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
    const infoButton = event.target.closest("[data-service-info]");
    if (infoButton) {
      event.preventDefault();
      const service = activeServices.find((item) => item.rate_plan_id === infoButton.dataset.serviceInfo);
      if (service) showServiceDetails(service);
      return;
    }
    const button = event.target.closest("#reserva-form #br-request-info");
    if (!button) return;
    const form = getForm();
    const result = validate(form);
    if (!result.isValid) return;

    const text = messages[getLanguage()];
    const originalLabel = button.textContent;
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

    let savedRequest;
    try {
      savedRequest = await saveInformationRequest(result.data, pendingSubmission.key);
    } catch (error) {
      console.error(error);
      button.disabled = false;
      button.textContent = originalLabel;
      showStatus(text.saveFailed, 4500);
      return;
    }

    clearForm(form);
    pendingSubmission = null;
    button.disabled = false;
    button.textContent = originalLabel;
    showConfirmation(savedRequest.request_number);
  });
})();
