// Reserva validation and delivery actions.
// Intentionally independent from the Version 4 navigation code.
(function initReservaActions() {
  "use strict";

  const RESERVA_CONTACT = Object.freeze({
    whatsapp: "524491028878",
    email: "cebolletascalvillo@gmail.com",
    emailCc: "elcrio88@gmail.com"
  });

  const limits = Object.freeze({
    adults: 20,
    kids: 20,
    name: 100,
    email: 254,
    cell: 25,
    otherDetails: 1000
  });

  const messages = {
    es: {
      requiredCheckin: "La fecha de llegada es requerida.",
      pastCheckin: "La fecha de llegada no puede estar en el pasado.",
      requiredCheckout: "La fecha de salida es requerida.",
      invalidCheckout: "La fecha de salida debe ser posterior a la fecha de llegada.",
      invalidAdults: "Adultos debe ser un número entero entre 1 y 20.",
      invalidKids: "Niños debe ser un número entero entre 0 y 20.",
      requiredName: "El nombre es requerido.",
      shortName: "El nombre debe contener al menos 5 letras.",
      invalidName: "Usa únicamente letras, espacios, apóstrofes, puntos o guiones.",
      longName: "El nombre es demasiado largo (máximo 100 caracteres).",
      requiredEmail: "El email es requerido.",
      invalidEmail: "El formato del email no es válido.",
      requiredCell: "El celular es requerido.",
      invalidCell: "Ingresa un celular válido de 10 a 15 dígitos.",
      requiredInfo: "Selecciona al menos una opción.",
      requiredOther: "Describe qué otra información necesitas.",
      longOther: "El texto es demasiado largo (máximo 1000 caracteres).",
      openingChannels: "Abriendo WhatsApp y email…",
      infoSubject: "Solicitud de información",
      labels: {
        staySummary: "Resumen de estancia",
        checkin: "Fecha llegada",
        checkout: "Fecha salida",
        nights: "Noches",
        weekendNights: "Noches de fin de semana",
        weekdayNights: "Noches entre semana",
        adults: "Adultos",
        kids: "Niños",
        name: "Nombre",
        email: "Email",
        cell: "Celular",
        requestedInfo: "Información solicitada",
        otherDetails: "Otra información"
      },
      infoOptions: {
        copal: "Hospedarse en Cebolletas Copal",
        camping: "Acampar",
        other: "Otro"
      }
    },
    en: {
      requiredCheckin: "Check-in is required.",
      pastCheckin: "Check-in cannot be in the past.",
      requiredCheckout: "Checkout is required.",
      invalidCheckout: "Checkout must be later than check-in.",
      invalidAdults: "Adults must be a whole number between 1 and 20.",
      invalidKids: "Kids must be a whole number between 0 and 20.",
      requiredName: "Name is required.",
      shortName: "Name must contain at least 5 letters.",
      invalidName: "Use only letters, spaces, apostrophes, periods, or hyphens.",
      longName: "Name is too long (maximum 100 characters).",
      requiredEmail: "Email is required.",
      invalidEmail: "Email format is invalid.",
      requiredCell: "Cellphone is required.",
      invalidCell: "Enter a valid cellphone number containing 10 to 15 digits.",
      requiredInfo: "Select at least one option.",
      requiredOther: "Describe what other information you need.",
      longOther: "Text is too long (maximum 1000 characters).",
      openingChannels: "Opening WhatsApp and email…",
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
        name: "Name",
        email: "Email",
        cell: "Cellphone",
        requestedInfo: "Requested information",
        otherDetails: "Other information"
      },
      infoOptions: {
        copal: "Staying at Cebolletas Copal",
        camping: "Camping",
        other: "Other"
      }
    }
  };

  function getLanguage() {
    return document.documentElement.lang === "en" ? "en" : "es";
  }

  function getForm() {
    return document.getElementById("reserva-form");
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
      name: form.querySelector("#br-name"),
      email: form.querySelector("#br-email"),
      cell: form.querySelector("#br-cell"),
      info: form.querySelector(".info-options"),
      other: form.querySelector("#br-other"),
      otherDetails: form.querySelector("#br-other-details")
    };
    const selectedInfo = Array.from(
      form.querySelectorAll('input[name="requested-info"]:checked'),
      (input) => input.value
    );

    const data = {
      checkin: fields.checkin.value,
      checkout: fields.checkout.value,
      stay: calculateStay(fields.checkin.value, fields.checkout.value),
      adults: Number(fields.adults.value),
      kids: Number(fields.kids.value),
      name: sanitizeSingleLine(fields.name.value),
      email: sanitizeSingleLine(fields.email.value),
      cell: sanitizeSingleLine(fields.cell.value),
      requestedInfo: selectedInfo,
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

    if (data.requestedInfo.length === 0) {
      reject(
        fields.info,
        text.requiredInfo,
        fields.info.querySelector('input[name="requested-info"]')
      );
    }

    if (fields.other.checked) {
      if (!data.otherDetails) reject(fields.otherDetails, text.requiredOther);
      else if (data.otherDetails.length > limits.otherDetails) {
        reject(fields.otherDetails, text.longOther);
      }
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
    const requestedInfo = data.requestedInfo
      .map((option) => text.infoOptions[option])
      .filter(Boolean)
      .join(", ");
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
      `${labels.name}: ${data.name}`,
      `${labels.email}: ${data.email}`,
      `${labels.cell}: ${data.cell}`,
      `${labels.requestedInfo}: ${requestedInfo}`
    ];

    if (data.requestedInfo.includes("other")) {
      lines.push(`${labels.otherDetails}: ${data.otherDetails}`);
    }
    return lines.join("\n");
  }

  function buildSubject(data) {
    const text = messages[getLanguage()];
    return `${getLocalDate()} | ${text.infoSubject} - ${data.name}`;
  }

  function showStatus(message) {
    document.querySelector(".reserva-status-overlay")?.remove();
    const overlay = document.createElement("div");
    const modal = document.createElement("div");
    overlay.className = "reserva-status-overlay";
    overlay.setAttribute("role", "status");
    modal.className = "reserva-status-modal";
    modal.textContent = message;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    window.setTimeout(() => overlay.remove(), 1800);
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
    form.querySelector(".other-details").hidden = true;
    form.querySelectorAll(".reserva-field-error").forEach((element) => element.remove());
    form.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
      element.removeAttribute("aria-invalid");
    });
    configureDateLimits(form);
    updateStaySummary(form);
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

  document.addEventListener("reserva:rendered", () => {
    const form = getForm();
    configureDateLimits(form);
    updateStaySummary(form);
  });

  document.addEventListener("submit", (event) => {
    if (event.target.matches("#reserva-form")) event.preventDefault();
  });

  document.addEventListener("focusin", (event) => {
    if (!event.target.closest("#reserva-form")) return;
    clearFieldError(event.target);
    if (event.target.matches('input[name="requested-info"]')) {
      clearFieldError(event.target.closest(".info-options"));
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
  }

  document.addEventListener("input", handleDateUpdate);
  document.addEventListener("change", handleDateUpdate);

  document.addEventListener("click", (event) => {
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

    showStatus(messages[getLanguage()].openingChannels);
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    window.location.href = emailUrl;
    clearForm(form);
  });
})();
