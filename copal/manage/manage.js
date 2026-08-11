import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://myqaotknkriuhdssbzlz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XuDt5xNF3EzE0K2TSE9QCg_hnDMWsVN";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (selector) => document.querySelector(selector);

const loginView = $("#login-view");
const appView = $("#app-view");
const loginForm = $("#login-form");
const loginError = $("#login-error");
const sidebar = $("#sidebar");
const scrim = $("#sidebar-scrim");
const menuButton = $("#menu-button");
const modal = $("#recipient-modal");
const recipientForm = $("#recipient-form");
const recipientMessage = $("#recipient-message");
const serviceModal = $("#service-modal");
const serviceForm = $("#service-form");
const serviceMessage = $("#service-message");
const serviceHistoryModal = $("#service-history-modal");
const serviceHistoryMessage = $("#service-history-message");
const requestDetailModal = $("#request-detail-modal");
const requestDetailMessage = $("#request-detail-message");
const calculatorModal = $("#calculator-modal");
const requestMessage = $("#request-message");
const refreshButton = $("#refresh-button");
const refreshStatus = $("#refresh-status");
let recipients = [];
let defaultRecipientId = null;
let services = [];
let historyServiceId = null;
let informationRequests = [];
let detailRequestId = null;
let calculatorService = null;
let calculatorCopyText = "";
let calendarMonth = null;

const CATEGORY_LABELS = {
  copal: "Cebolletas Copal",
  camping: "Camping",
  events: "Eventos",
};

const PRICING_UNIT_LABELS = {
  per_night: "por noche",
  per_person: "por persona",
  per_person_night: "por persona/noche",
  fixed: "precio fijo",
};
const TIME_MODEL_LABELS = { overnight: "por noche", calendar_day: "por día", fixed_window: "por ventana" };
const PRICING_MODEL_LABELS = { fixed: "precio fijo", base_plus_guests: "base + adicionales", manual_quote: "estimación manual" };

const REQUEST_STATUS_LABELS = {
  new: "Nueva",
  booked: "Reservada",
  closed: "Cerrada",
  cancelled: "Cancelada",
  not_converted: "No convertida",
};

const REQUEST_SERVICE_LABELS = {
  copal: "Cebolletas Copal",
  camping: "Camping",
  events: "Eventos",
};

const REQUEST_REASON_LABELS = {
  "Price not accepted": "Precio no aceptado",
  "No response after receiving information": "Sin respuesta despu\u00e9s de recibir informaci\u00f3n",
  "Dates unavailable": "Fechas no disponibles",
  "Customer chose another option": "El cliente eligi\u00f3 otra opci\u00f3n",
  Other: "Otro",
  "Requested dates passed without booking": "Las fechas solicitadas pasaron sin reservaci\u00f3n",
  "Booking confirmed": "Reservaci\u00f3n confirmada",
  "Booking cancelled": "Reservaci\u00f3n cancelada",
  "Stay completed": "Estancia terminada",
  "Visitor contacted again": "El visitante volvi\u00f3 a contactar",
  "Request submitted": "Solicitud enviada",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function showApp(show) {
  loginView.classList.toggle("hidden", show);
  appView.classList.toggle("hidden", !show);
}

function closeMenu() {
  sidebar.classList.remove("open");
  scrim.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}

function openView(name) {
  document.querySelectorAll("[data-page]").forEach((page) => page.classList.toggle("active", page.dataset.page === name));
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    active ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
  });
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function linkedRequestId() {
  const requestId = new URL(window.location.href).searchParams.get("request");
  return requestId && UUID_PATTERN.test(requestId) ? requestId : null;
}

function syncRequestUrl(requestId = null) {
  const url = new URL(window.location.href);
  if (requestId) {
    url.searchParams.set("request", requestId);
  } else {
    url.searchParams.delete("request");
  }
  window.history.replaceState({}, "", url);
}

function setRecipientMessage(text = "", type = "") {
  recipientMessage.textContent = text;
  recipientMessage.className = `message ${type}`.trim();
}

function setServiceMessage(text = "", type = "") {
  serviceMessage.textContent = text;
  serviceMessage.className = `message ${type}`.trim();
}

function setRequestMessage(text = "", type = "") {
  requestMessage.textContent = text;
  requestMessage.className = `message ${type}`.trim();
}

function friendlyError(error) {
  if (error?.code === "23505") return "Este n\u00famero ya est\u00e1 registrado.";
  if (error?.code === "23503") return "No se puede eliminar porque una solicitud conserva este servicio o una de sus versiones.";
  if (error?.message?.includes("default before")) return "Selecciona otro contacto predeterminado antes de continuar.";
  if (error?.message?.includes("must be active")) return "El contacto predeterminado debe estar activo.";
  if (error?.message?.includes("Service not found")) return "El servicio ya no existe.";
  if (error?.message?.includes("Service is referenced")) return "No se puede eliminar porque una reservaci\u00f3n conserva esta versi\u00f3n.";
  if (error?.message?.includes("Version conflict")) return "El servicio cambi\u00f3 en otra sesi\u00f3n. Recarga el cat\u00e1logo antes de editar.";
  if (error?.message?.includes("Service version does not belong")) return "La versi\u00f3n seleccionada no pertenece a este servicio.";
  if (error?.message?.includes("Status conflict")) return "La solicitud cambi\u00f3 en otra sesi\u00f3n. Recarga las solicitudes antes de continuar.";
  if (error?.message?.includes("Invalid status transition")) return "Ese cambio de estado no est\u00e1 permitido.";
  if (error?.message?.includes("Checkout date must have passed")) return "La solicitud solo puede cerrarse despu\u00e9s de la fecha de salida.";
  if (error?.message?.includes("not-converted reason")) return "Selecciona el motivo por el que no se convirti\u00f3.";
  if (error?.message?.includes("Information request not found")) return "La solicitud ya no existe.";
  return error?.message || "No fue posible completar la operaci\u00f3n.";
}

function filteredRecipients() {
  const query = $("#recipient-search").value.trim().toLowerCase();
  const status = $("#recipient-status-filter").value;
  return recipients.filter((recipient) => {
    const matchesQuery = !query || recipient.display_name.toLowerCase().includes(query) || recipient.phone_e164.includes(query);
    const matchesStatus = status === "all" || (status === "active" ? recipient.is_active : !recipient.is_active);
    return matchesQuery && matchesStatus;
  });
}

function renderRecipients() {
  const list = $("#recipient-list");
  const visible = filteredRecipients();
  list.replaceChildren();
  $("#recipient-empty").classList.toggle("hidden", recipients.length !== 0);

  visible.forEach((recipient) => {
    const row = document.createElement("div");
    row.className = "recipient-row";
    const isDefault = recipient.id === defaultRecipientId;
    row.innerHTML = `
      <div class="recipient-name"><span>${escapeHtml(recipient.display_name)}</span>${isDefault ? '<span class="default-badge">Predeterminado</span>' : ""}</div>
      <span>${escapeHtml(recipient.phone_e164)}</span>
      <span class="status-badge ${recipient.is_active ? "active" : "inactive"}">${recipient.is_active ? "Activo" : "Inactivo"}</span>
      <div class="row-actions">
        ${!isDefault && recipient.is_active ? `<button data-action="default" data-id="${recipient.id}" type="button">Predeterminar</button>` : ""}
        <button data-action="edit" data-id="${recipient.id}" type="button">Editar</button>
        <button class="danger" data-action="delete" data-id="${recipient.id}" type="button" ${isDefault ? "disabled title=\"Selecciona otro predeterminado primero\"" : ""}>Eliminar</button>
      </div>`;
    list.append(row);
  });

  $("#whatsapp-count").textContent = String(recipients.length);
  const selected = recipients.find((item) => item.id === defaultRecipientId);
  $("#whatsapp-default-summary").textContent = selected ? `Predeterminado: ${selected.display_name}` : "Sin contacto predeterminado";
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function formatRequestCode(number) {
  return `SOL-${String(number).padStart(6, "0")}`;
}

function formatDate(value) {
  if (!value) return "\u2014";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" })
    .format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
  if (!value) return "\u2014";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function mexicoCityDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function requestServicesLabel(request) {
  const snapshotName = request.quote_snapshot?.service?.name_es;
  if (snapshotName) return snapshotName;
  return (request.requested_services || [])
    .map((service) => REQUEST_SERVICE_LABELS[service] || service)
    .join(", ");
}

function filteredInformationRequests() {
  if (!calendarMonth) calendarMonth = monthStart(mexicoCityDate());
  const query = $("#request-search").value.trim().toLocaleLowerCase("es-MX");
  const status = $("#request-status-filter").value;
  const service = $("#request-service-filter").value;
  const firstDay = monthStart(calendarMonth);
  const monthStartKey = dateKey(firstDay);
  const monthEndKey = dateKey(new Date(
    firstDay.getFullYear(),
    firstDay.getMonth() + 1,
    0,
    12,
  ));
  return informationRequests.filter((request) => {
    const haystack = [
      formatRequestCode(request.request_number),
      request.customer_name,
      request.customer_email,
      request.customer_cellphone,
    ].join(" ").toLocaleLowerCase("es-MX");
    return (!query || haystack.includes(query))
      && (status === "all" || request.status === status)
      && (service === "all" || request.requested_services.includes(service))
      && request.checkin_date <= monthEndKey
      && request.checkout_date >= monthStartKey;
  });
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStart(value) {
  const date = typeof value === "string" ? dateFromKey(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function moveCalendarMonth(offset) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1, 12);
  renderInformationRequests();
}

function requestTouchesDate(request, value) {
  return request.checkin_date <= value && request.checkout_date >= value;
}

function renderRequestCalendar() {
  if (!calendarMonth) calendarMonth = monthStart(mexicoCityDate());

  const visible = filteredInformationRequests();
  const grid = $("#request-calendar-grid");
  const today = mexicoCityDate();
  const firstDay = monthStart(calendarMonth);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - mondayOffset);

  $("#calendar-month").textContent = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(firstDay);
  grid.replaceChildren();

  for (let offset = 0; offset < 42; offset += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + offset);
    const value = dateKey(day);
    const requestsForDay = visible
      .filter((request) => requestTouchesDate(request, value))
      .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date)
        || a.request_number - b.request_number);

    const cell = document.createElement("div");
    cell.className = [
      "calendar-day",
      day.getMonth() === firstDay.getMonth() ? "" : "outside",
      value === today ? "today" : "",
    ].filter(Boolean).join(" ");
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", new Intl.DateTimeFormat("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(day));

    const events = requestsForDay.slice(0, 3).map((request) => {
      const position = value === request.checkin_date
        ? "Entrada"
        : value === request.checkout_date
          ? "Salida"
          : "Estancia";
      return `
        <button
          class="calendar-request ${request.status.replace("_", "-")}"
          data-calendar-request="${request.id}"
          type="button"
          title="${escapeHtml(`${formatRequestCode(request.request_number)} \u00b7 ${request.customer_name} \u00b7 ${formatDate(request.checkin_date)} \u2013 ${formatDate(request.checkout_date)}`)}"
        >
          <strong>${escapeHtml(request.customer_name)}</strong>
          <small>${position} \u00b7 ${formatRequestCode(request.request_number)}</small>
        </button>`;
    }).join("");
    const remaining = requestsForDay.length - 3;

    cell.innerHTML = `
      <span class="calendar-day-number">${day.getDate()}</span>
      <div class="calendar-events">
        ${events}
        ${remaining > 0 ? `<p class="calendar-more">+${remaining} solicitud${remaining === 1 ? "" : "es"}</p>` : ""}
      </div>`;
    grid.append(cell);
  }

  $("#request-calendar-empty").classList.toggle("hidden", visible.length > 0);
}

function setRequestView(view) {
  const calendarActive = view === "calendar";
  $("#request-calendar-panel").classList.toggle("hidden", !calendarActive);
  $("#request-list-panel").classList.toggle("hidden", calendarActive);
  $("#request-calendar-view").classList.toggle("active", calendarActive);
  $("#request-list-view").classList.toggle("active", !calendarActive);
  $("#request-calendar-view").setAttribute("aria-pressed", String(calendarActive));
  $("#request-list-view").setAttribute("aria-pressed", String(!calendarActive));
  if (calendarActive) renderRequestCalendar();
}

function renderInformationRequests() {
  const list = $("#request-list");
  const visible = filteredInformationRequests();
  const empty = $("#request-empty");
  list.replaceChildren();

  empty.classList.toggle("hidden", visible.length > 0);
  empty.querySelector("h2").textContent = informationRequests.length
    ? "No hay solicitudes que coincidan en este mes"
    : "No hay solicitudes registradas";
  empty.querySelector("p").textContent = informationRequests.length
    ? "Cambia el mes o prueba con otros t\u00e9rminos y filtros."
    : "Las solicitudes enviadas desde Reserva aparecer\u00e1n aqu\u00ed.";

  visible.forEach((request) => {
    const row = document.createElement("div");
    row.className = "request-row";
    row.innerHTML = `
      <div class="request-identity">
        <span class="request-code">${formatRequestCode(request.request_number)}</span>
        <strong>${escapeHtml(request.customer_name)}</strong>
        <small>${escapeHtml(request.customer_email)} \u00b7 ${escapeHtml(request.customer_cellphone)}</small>
      </div>
      <div class="request-dates">
        <span>${formatDate(request.checkin_date)}</span>
        <small>Salida: ${formatDate(request.checkout_date)}</small>
      </div>
      <div class="request-services">
        <span>${escapeHtml(requestServicesLabel(request))}</span>
        <small>${request.adults} adulto${request.adults === 1 ? "" : "s"} \u00b7 ${request.children} ni\u00f1o${request.children === 1 ? "" : "s"}${request.infants ? ` \u00b7 ${request.infants} menor${request.infants === 1 ? "" : "es"} de 3` : ""}</small>
      </div>
      <span class="request-submitted">${formatDateTime(request.submitted_at)}</span>
      <span class="status-badge ${request.status.replace("_", "-")}">${REQUEST_STATUS_LABELS[request.status]}</span>
      <div class="row-actions"><button data-request-action="detail" data-id="${request.id}" type="button">Ver detalle</button></div>`;
    list.append(row);
  });

  const newCount = informationRequests.filter((request) => request.status === "new").length;
  const bookedCount = informationRequests.filter((request) => request.status === "booked").length;
  $("#request-new-count").textContent = String(newCount);
  $("#request-new-summary").textContent = newCount === 1
    ? "1 solicitud requiere seguimiento"
    : `${newCount} solicitudes requieren seguimiento`;
  $("#request-booked-count").textContent = String(bookedCount);
  $("#request-booked-summary").textContent = bookedCount === 1
    ? "1 solicitud confirmada"
    : `${bookedCount} solicitudes confirmadas`;
  renderRequestCalendar();
}

async function loadInformationRequests() {
  const { data, error } = await supabase
    .from("information_requests")
    .select(`
      id, request_number, submitted_at, updated_at, locale,
      customer_name, customer_email, customer_cellphone,
      checkin_date, checkout_date, adults, children, infants,
      requested_services, customer_message, status,
      status_reason, status_notes, status_changed_at,
      selected_service_id, selected_service_version_id,
      pricing_status, estimated_total_cents, currency_code, quote_snapshot
    `)
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  informationRequests = data || [];
  renderInformationRequests();
}

function formatMoney(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: Number(cents) % 100 === 0 ? 0 : 2,
  }).format(Number(cents || 0) / 100);
}

function serviceShareText(service, version = currentVersion(service)) {
  if (!version) return "";
  const lines = [
    version.name_es,
    version.description_es,
    "",
    version.price_on_request
      ? "Precio: cotizaci\u00f3n personalizada"
      : `Precio base: ${formatMoney(version.base_price_cents)} ${PRICING_UNIT_LABELS[version.pricing_unit] || ""}`,
    `Capacidad m\u00e1xima: ${version.max_occupancy} hu\u00e9spedes`,
  ];
  if (!version.price_on_request) {
    lines.push(
      `Hu\u00e9spedes incluidos: ${version.included_guests}`,
      `Adulto adicional: ${formatMoney(version.adult_extra_cents)} por noche`,
      `Ni\u00f1o adicional: ${formatMoney(version.child_extra_cents)} por noche`,
      "Menores de 3 a\u00f1os: sin costo; cuentan para la capacidad"
    );
  }
  if (version.amenities_es?.length) {
    lines.push("", "Incluye:", ...version.amenities_es.map((item) => `- ${item}`));
  }
  return lines.join("\n");
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  setServiceMessage(successMessage, "success");
}

function currentVersion(service) {
  return service.service_versions?.find((version) => version.id === service.current_version_id)
    || service.service_versions?.[0]
    || null;
}

function currentRateVersion(service) {
  const plan = service.rate_plans?.find((item) => item.rate_code === "standard") || service.rate_plans?.[0];
  return plan?.rate_plan_versions?.find((version) => version.id === plan.current_version_id)
    || plan?.rate_plan_versions?.[0] || null;
}

function filteredServices() {
  const query = $("#service-search").value.trim().toLocaleLowerCase("es-MX");
  const category = $("#service-category-filter").value;
  const status = $("#service-status-filter").value;
  return services.filter((service) => {
    const version = currentVersion(service);
    const haystack = [
      version?.name_es,
      version?.name_en,
      version?.description_es,
      version?.description_en,
    ].filter(Boolean).join(" ").toLocaleLowerCase("es-MX");
    return (!query || haystack.includes(query))
      && (category === "all" || service.category_code === category)
      && (status === "all" || (status === "active" ? service.is_active : !service.is_active));
  });
}

function renderServices() {
  const list = $("#service-list");
  const visible = filteredServices();
  list.replaceChildren();

  const emptyState = $("#service-empty");
  const hasMatches = visible.length > 0;

  emptyState.classList.toggle("hidden", hasMatches);
  emptyState.querySelector("h2").textContent = services.length
    ? "No hay servicios que coincidan"
    : "No hay servicios registrados";
  emptyState.querySelector("p").textContent = services.length
    ? "Prueba con otros t\u00e9rminos o filtros."
    : "Agrega el primer servicio para comenzar el cat\u00e1logo.";

  visible.forEach((service) => {
    const version = currentVersion(service);
    const rate = currentRateVersion(service);
    if (!version) return;
    const row = document.createElement("div");
    row.className = "service-row";
    const price = !rate || rate.pricing_model === "manual_quote"
      ? "Precio estimado"
      : `${rate.pricing_model === "base_plus_guests" ? "Desde " : ""}${formatMoney(rate.base_price_cents)} ${TIME_MODEL_LABELS[rate.booking_time_model] || ""}`;
    row.innerHTML = `
      <div class="service-title">
        <strong>${escapeHtml(version.name_es)}</strong>
        <small>${escapeHtml(version.name_en)} \u00b7 ${escapeHtml(CATEGORY_LABELS[service.category_code] || service.category_code)} \u00b7 v${version.version_number}</small>
      </div>
      <div class="service-description">
        <span>${escapeHtml(version.description_es)}</span>
        <small>${escapeHtml(version.description_en)}</small>
      </div>
      <div class="service-price">
        <strong>${escapeHtml(price)}</strong>
        <small>${rate ? `${PRICING_MODEL_LABELS[rate.pricing_model]} · mínimo ${rate.min_guests} · máximo ${rate.max_occupancy}` : "Sin plan de tarifa"}</small>
      </div>
      <span class="status-badge ${service.is_active ? "active" : "inactive"}">${service.is_active ? "Activo" : "Inactivo"}</span>
      <div class="row-actions">
        <button data-service-action="copy" data-id="${service.id}" type="button">Copiar</button>
        <button data-service-action="calculate" data-id="${service.id}" type="button">Calcular</button>
        <button data-service-action="history" data-id="${service.id}" type="button">Historial</button>
        <button data-service-action="edit" data-id="${service.id}" type="button">Nueva versi\u00f3n</button>
        <button data-service-action="toggle" data-id="${service.id}" type="button">${service.is_active ? "Desactivar" : "Activar"}</button>
        <button class="danger" data-service-action="delete" data-id="${service.id}" type="button">Eliminar</button>
      </div>`;
    list.append(row);
  });

  const activeCount = services.filter((service) => service.is_active).length;
  $("#service-count").textContent = String(activeCount);
  $("#service-count-summary").textContent = `${services.length} servicio${services.length === 1 ? "" : "s"} en el cat\u00e1logo`;
}

async function loadServices() {
  const { data, error } = await supabase
    .from("services")
    .select(`
      id, service_code, category_code, is_active, display_order,
      current_version_id, created_at, updated_at,
      service_versions!service_versions_service_id_fkey (
        id, version_number, name_es, name_en, description_es, description_en,
        pricing_unit, price_on_request, base_price_cents, included_guests,
        max_occupancy, adult_extra_cents, child_extra_cents,
        child_min_age, child_max_age, adult_min_age,
        amenities_es, amenities_en, created_at
      ),
      rate_plans (
        id, rate_code, is_active, display_order, current_version_id,
        rate_plan_versions (
          id, version_number, booking_time_model, pricing_model, base_price_cents,
          included_guests, min_guests, max_occupancy, max_adults, max_children,
          max_infants, adult_extra_cents, child_extra_cents, infant_extra_cents,
          supplement_basis, min_units, max_units, window_start, window_end,
          buffer_before_minutes, buffer_after_minutes, restrictions_es, restrictions_en, created_at
        )
      )
    `)
    .order("display_order")
    .order("created_at");
  if (error) throw error;
  services = data || [];
  services.forEach((service) => {
    service.service_versions?.sort((a, b) => b.version_number - a.version_number);
    service.rate_plans?.forEach((plan) => plan.rate_plan_versions?.sort((a, b) => b.version_number - a.version_number));
  });
  renderServices();
}

async function loadRecipients() {
  const [{ data: recipientData, error: recipientError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("whatsapp_recipients").select("id, display_name, phone_e164, is_active, created_at, updated_at").order("display_name"),
    supabase.from("management_settings").select("default_whatsapp_recipient_id").eq("singleton", true).single(),
  ]);
  if (recipientError) throw recipientError;
  if (settingsError) throw settingsError;
  recipients = recipientData || [];
  defaultRecipientId = settings?.default_whatsapp_recipient_id || null;
  renderRecipients();
}

async function loadProfile(userId) {
  const { data, error } = await supabase.from("admin_profiles").select("display_name, role, active").eq("user_id", userId).single();
  if (error || !data?.active) throw new Error("Esta cuenta no tiene acceso administrativo activo.");
  $("#account-name").textContent = `${data.display_name} \u00b7 ${data.role}`;
}

async function refreshManagementData({ announce = true } = {}) {
  const openRequestId = requestDetailModal.classList.contains("hidden") ? null : detailRequestId;
  refreshButton.disabled = true;
  refreshButton.setAttribute("aria-busy", "true");
  refreshButton.textContent = "Actualizando\u2026";
  refreshStatus.textContent = announce ? "Cargando datos\u2026" : "";
  refreshStatus.className = "refresh-status";

  try {
    await Promise.all([
      loadRecipients(),
      loadServices(),
      loadInformationRequests(),
    ]);

    if (openRequestId) {
      const refreshedRequest = informationRequests.find((item) => item.id === openRequestId);
      if (refreshedRequest) {
        renderRequestDetail(refreshedRequest);
        await loadRequestHistory(refreshedRequest.id);
      } else {
        closeRequestDetail();
      }
    }

    refreshStatus.textContent = announce ? "Datos actualizados." : "";
  } catch (error) {
    refreshStatus.textContent = announce
      ? `No se pudo actualizar: ${friendlyError(error)}`
      : "";
    refreshStatus.className = "refresh-status error";
    throw error;
  } finally {
    refreshButton.disabled = false;
    refreshButton.removeAttribute("aria-busy");
    refreshButton.textContent = "Actualizar";
  }
}

async function startSession(session) {
  if (!session?.user) return showApp(false);
  try {
    await loadProfile(session.user.id);
    await refreshManagementData({ announce: false });
    showApp(true);
    await openDeepLinkedRequest();
  } catch (error) {
    await supabase.auth.signOut();
    loginError.textContent = friendlyError(error);
    showApp(false);
  }
}

function openRecipientModal(recipient = null) {
  recipientForm.reset();
  $("#recipient-id").value = recipient?.id || "";
  $("#recipient-name").value = recipient?.display_name || "";
  $("#recipient-phone").value = recipient?.phone_e164 || "";
  $("#recipient-active").checked = recipient?.is_active ?? true;
  $("#recipient-modal-title").textContent = recipient ? "Editar contacto" : "Agregar contacto";
  $("#recipient-form-error").textContent = "";
  modal.classList.remove("hidden");
  $("#recipient-name").focus();
}

function closeRecipientModal() {
  modal.classList.add("hidden");
}

function pesosFromCents(cents) {
  return Number(cents || 0) / 100;
}

function centsFromInput(selector) {
  return Math.round(Number($(selector).value || 0) * 100);
}

function linesFromTextarea(selector) {
  return $(selector).value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function slugify(value) {
  const stem = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${stem || "service"}-${Date.now().toString(36)}`;
}

function updatePricingFieldState() {
  const model = $("#service-pricing-model").value;
  const disabled = model === "manual_quote";
  ["#service-base-price", "#service-included-guests", "#service-adult-extra", "#service-child-extra"].forEach((selector) => {
    const input = $(selector);
    input.disabled = disabled;
    input.required = !disabled;
  });
  $("#service-included-guests").disabled = disabled || model === "fixed";
  $("#service-included-guests").required = model === "base_plus_guests";
  $("#service-window-fields").classList.toggle("hidden", $("#service-booking-time-model").value !== "fixed_window");
  $(".pricing-definition").classList.toggle("manual", disabled);
  updatePricingPreview();
}

function updatePricingPreview() {
  const model = $("#service-pricing-model").value;
  const manual = model === "manual_quote";
  const base = centsFromInput("#service-base-price");
  const included = Number($("#service-included-guests").value || 0);
  const capacity = Number($("#service-max-occupancy").value || 0);
  const adultExtra = centsFromInput("#service-adult-extra");
  const childExtra = centsFromInput("#service-child-extra");

  if (manual) {
    $("#pricing-preview-formula").textContent = "Cotizaci\u00f3n manual";
    $("#pricing-preview-description").textContent = "El servicio conservar\u00e1 su capacidad, pero no producir\u00e1 un precio autom\u00e1tico.";
    $("#pricing-preview-total").textContent = "A consultar";
    return;
  }

  const unit = TIME_MODEL_LABELS[$("#service-booking-time-model").value];
  $("#pricing-preview-formula").textContent = PRICING_MODEL_LABELS[model];
  $("#pricing-preview-description").textContent = model === "fixed"
    ? `${formatMoney(base)} ${unit}; el número de huéspedes no cambia el precio.`
    : `${formatMoney(base)} ${unit} incluye ${included || "\u2014"} huésped(es). Después se suman ${formatMoney(adultExtra)} por adulto y ${formatMoney(childExtra)} por niño.`;

  if (!capacity || (model === "base_plus_guests" && (!included || included > capacity))) {
    $("#pricing-preview-total").textContent = "Revisa incluidos y capacidad";
    return;
  }

  const extraAdults = model === "base_plus_guests" ? Math.max(capacity - included, 0) : 0;
  $("#pricing-preview-total").textContent = `${formatMoney(base + (extraAdults * adultExtra))} ${unit}`;
}

function openServiceModal(service = null) {
  const version = service ? currentVersion(service) : null;
  const rate = service ? currentRateVersion(service) : null;
  serviceForm.reset();
  $("#service-id").value = service?.id || "";
  $("#service-category").value = service?.category_code || "copal";
  $("#service-booking-time-model").value = rate?.booking_time_model || "overnight";
  $("#service-pricing-model").value = rate?.pricing_model || "base_plus_guests";
  $("#service-display-order").value = service?.display_order ?? services.length * 10;
  $("#service-name-es").value = version?.name_es || "";
  $("#service-name-en").value = version?.name_en || "";
  $("#service-description-es").value = version?.description_es || "";
  $("#service-description-en").value = version?.description_en || "";
  $("#service-amenities-es").value = (version?.amenities_es || []).join("\n");
  $("#service-amenities-en").value = (version?.amenities_en || []).join("\n");
  $("#service-base-price").value = rate ? pesosFromCents(rate.base_price_cents) : 1200;
  $("#service-included-guests").value = rate?.included_guests ?? 3;
  $("#service-min-guests").value = rate?.min_guests ?? 1;
  $("#service-max-occupancy").value = rate?.max_occupancy ?? 6;
  $("#service-max-adults").value = rate?.max_adults ?? "";
  $("#service-max-children").value = rate?.max_children ?? "";
  $("#service-max-infants").value = rate?.max_infants ?? "";
  $("#service-adult-extra").value = rate ? pesosFromCents(rate.adult_extra_cents) : 500;
  $("#service-child-extra").value = rate ? pesosFromCents(rate.child_extra_cents) : 350;
  $("#service-infant-extra").value = rate ? pesosFromCents(rate.infant_extra_cents) : 0;
  $("#service-supplement-basis").value = rate?.supplement_basis || "per_unit";
  $("#service-min-units").value = rate?.min_units ?? 1;
  $("#service-max-units").value = rate?.max_units ?? "";
  $("#service-window-start").value = rate?.window_start?.slice(0, 5) || "10:00";
  $("#service-window-end").value = rate?.window_end?.slice(0, 5) || "18:00";
  $("#service-restrictions-es").value = rate?.restrictions_es || "";
  $("#service-restrictions-en").value = rate?.restrictions_en || "";
  $("#service-active").checked = service?.is_active ?? true;
  $("#service-modal-title").textContent = service ? `Nueva versi\u00f3n de ${version.name_es}` : "Agregar servicio";
  $("#service-form-error").textContent = "";
  updatePricingFieldState();
  serviceModal.classList.remove("hidden");
  $("#service-name-es").focus();
}

function closeServiceModal() {
  serviceModal.classList.add("hidden");
}

function openServiceHistory(service) {
  const versions = service.service_versions || [];
  const current = currentVersion(service);
  historyServiceId = service.id;
  $("#service-history-title").textContent = `Versiones de ${current?.name_es || "servicio"}`;
  serviceHistoryMessage.textContent = "";
  serviceHistoryMessage.className = "message";
  $("#service-history-list").innerHTML = versions.map((version) => `
    <article class="history-item ${version.id === service.current_version_id ? "current" : ""}">
      <div class="history-item-head">
        <strong>Versi\u00f3n ${version.version_number}${version.id === service.current_version_id ? " \u00b7 actual" : ""}</strong>
        <span>${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at))}</span>
      </div>
      <p><strong>${escapeHtml(version.name_es)}</strong> / ${escapeHtml(version.name_en)}</p>
      <p>${version.price_on_request ? "Precio a consultar" : `${formatMoney(version.base_price_cents)} ${PRICING_UNIT_LABELS[version.pricing_unit] || ""}; adulto adicional ${formatMoney(version.adult_extra_cents)}; ni\u00f1o adicional ${formatMoney(version.child_extra_cents)}.`}</p>
      <p>Incluye ${version.included_guests} hu\u00e9sped(es); capacidad m\u00e1xima ${version.max_occupancy}. Menores de 3 a\u00f1os sin costo y cuentan en capacidad.</p>
      <div class="history-item-actions">
        ${version.id === service.current_version_id
          ? '<span class="current-label">Versi\u00f3n actual</span>'
          : `<button data-history-action="make-current" data-version-id="${version.id}" type="button">Hacer versi\u00f3n actual</button>`}
      </div>
    </article>
  `).join("");
  serviceHistoryModal.classList.remove("hidden");
}

function closeServiceHistory() {
  historyServiceId = null;
  serviceHistoryModal.classList.add("hidden");
}

function requestStatusActions(request) {
  const checkoutPassed = request.checkout_date < mexicoCityDate();
  if (request.status === "new") {
    return `
      <button data-next-status="booked" type="button">Marcar como reservada</button>
      <button data-next-status="not_converted" type="button">Marcar como no convertida</button>`;
  }
  if (request.status === "booked") {
    return `
      <button class="danger" data-next-status="cancelled" type="button">Marcar como cancelada</button>
      <button data-next-status="closed" type="button" ${checkoutPassed ? "" : 'disabled title="Disponible despu\u00e9s de la fecha de salida"'}>Marcar como cerrada</button>`;
  }
  if (request.status === "not_converted") {
    return '<button data-next-status="new" type="button">Reabrir como nueva</button>';
  }
  return "";
}

function renderRequestQuote(request) {
  const snapshot = request.quote_snapshot;
  if (!snapshot || !request.pricing_status) {
    return '<article class="request-detail-item full"><span>Cotizaci\u00f3n</span><p>Solicitud anterior sin estimaci\u00f3n guardada.</p></article>';
  }
  if (request.pricing_status === "manual") {
    return `<article class="request-detail-item full"><span>Cotizaci\u00f3n</span>
      <p><strong>Cotizaci\u00f3n personalizada pendiente</strong><br>
      ${snapshot.stay?.nights || "\u2014"} noche(s) \u00b7 capacidad ${snapshot.occupancy?.total || "\u2014"}/${snapshot.occupancy?.max_occupancy || "\u2014"}</p></article>`;
  }

  const pricing = snapshot.pricing || {};
  const nights = snapshot.stay?.nights || 0;
  const rows = [
    `<div><span>${nights} \u00d7 base por noche</span><strong>${formatMoney((pricing.base_price_cents || 0) * nights)}</strong></div>`,
  ];
  if (pricing.extra_adults) {
    rows.push(`<div><span>${pricing.extra_adults} adulto(s) extra \u00d7 ${nights}</span><strong>${formatMoney(pricing.extra_adults * pricing.adult_extra_cents * nights)}</strong></div>`);
  }
  if (pricing.extra_children) {
    rows.push(`<div><span>${pricing.extra_children} ni\u00f1o(s) extra \u00d7 ${nights}</span><strong>${formatMoney(pricing.extra_children * pricing.child_extra_cents * nights)}</strong></div>`);
  }
  if (snapshot.occupancy?.infants) {
    rows.push(`<div><span>${snapshot.occupancy.infants} menor(es) de 3 a\u00f1os</span><strong>${formatMoney(0)}</strong></div>`);
  }
  return `<article class="request-detail-item full request-quote-detail">
    <span>Estimaci\u00f3n presentada</span>
    <div class="request-quote-rows">${rows.join("")}
      <div class="total"><span>Total estimado</span><strong>${formatMoney(request.estimated_total_cents)}</strong></div>
    </div>
    <small>Versi\u00f3n ${snapshot.service?.version_number || "\u2014"} \u00b7 c\u00e1lculo guardado al enviar la solicitud</small>
  </article>`;
}

function requestCommunicationText(request) {
  const snapshot = request.quote_snapshot || {};
  const serviceName =
    snapshot.service?.name_es || requestServicesLabel(request);

  const adults =
    snapshot.occupancy?.adults ?? request.adults;

  const children =
    snapshot.occupancy?.children ?? request.children;

  const infants =
    snapshot.occupancy?.infants ?? request.infants ?? 0;

  const checkin =
    snapshot.stay?.checkin || request.checkin_date;

  const checkout =
    snapshot.stay?.checkout || request.checkout_date;

  const total =
    request.pricing_status === "estimated"
      ? formatMoney(
          snapshot.pricing?.estimated_total_cents ??
            request.estimated_total_cents
        )
      : "Cotizaci\u00f3n personalizada";

  return [
    `Hola ${request.customer_name},`,
    "",
    `Te contactamos de Cebolletas Copal respecto a tu solicitud ${formatRequestCode(request.request_number)}.`,
    `Servicio: ${serviceName}`,
    `Fechas: ${formatDate(checkin)} - ${formatDate(checkout)}`,
    `Hu\u00e9spedes: ${adults} adulto(s), ${children} ni\u00f1o(s), ${infants} menor(es) de 3 a\u00f1os`,
    `Estimaci\u00f3n: ${total}`,
    "",
    "Quedamos atentos para ayudarte.",
  ].join("\n");
}

function requestCalculatorService(request) {
  const snapshot = request.quote_snapshot;
  if (!snapshot?.pricing || !snapshot?.occupancy) return null;
  return {
    name: snapshot.service?.name_es || requestServicesLabel(request),
    versionNumber: snapshot.service?.version_number || null,
    priceOnRequest: request.pricing_status === "manual",
    basePriceCents: snapshot.pricing.base_price_cents || 0,
    includedGuests: snapshot.pricing.included_guests || 0,
    maxOccupancy: snapshot.occupancy.max_occupancy || 0,
    adultExtraCents: snapshot.pricing.adult_extra_cents || 0,
    childExtraCents: snapshot.pricing.child_extra_cents || 0,
  };
}

function catalogCalculatorService(service) {
  const version = currentVersion(service);
  if (!version) return null;
  return {
    name: version.name_es,
    versionNumber: version.version_number,
    priceOnRequest: version.price_on_request,
    basePriceCents: version.base_price_cents,
    includedGuests: version.included_guests,
    maxOccupancy: version.max_occupancy,
    adultExtraCents: version.adult_extra_cents,
    childExtraCents: version.child_extra_cents,
  };
}

function calculatorValues() {
  return {
    nights: Number($("#calculator-nights").value),
    adults: Number($("#calculator-adults").value),
    children: Number($("#calculator-children").value),
    infants: Number($("#calculator-infants").value),
  };
}

function renderCalculator() {
  if (!calculatorService) return;
  const values = calculatorValues();
  const errorHost = $("#calculator-error");
  const resultHost = $("#calculator-result");
  errorHost.textContent = "";
  calculatorCopyText = "";

  if (Object.values(values).some((value) => !Number.isInteger(value) || value < 0) || values.nights < 1) {
    errorHost.textContent = "Ingresa cantidades enteras v\u00e1lidas.";
    resultHost.innerHTML = "";
    return;
  }

  const totalGuests = values.adults + values.children + values.infants;
  if (!totalGuests) {
    errorHost.textContent = "Agrega al menos un hu\u00e9sped.";
    resultHost.innerHTML = "";
    return;
  }
  if (totalGuests > calculatorService.maxOccupancy) {
    errorHost.textContent = `La capacidad m\u00e1xima es de ${calculatorService.maxOccupancy} hu\u00e9spedes. Este escenario tiene ${totalGuests}.`;
    resultHost.innerHTML = "";
    return;
  }

  const commonLines = [
    calculatorService.name,
    `Escenario: ${values.nights} noche(s)`,
    `${values.adults} adulto(s), ${values.children} ni\u00f1o(s), ${values.infants} menor(es) de 3 a\u00f1os`,
    `Ocupaci\u00f3n: ${totalGuests} de ${calculatorService.maxOccupancy}`,
  ];

  if (calculatorService.priceOnRequest) {
    resultHost.innerHTML = `
      <div class="calculator-result-head"><span>Resultado</span><strong>Cotizaci\u00f3n personalizada</strong></div>
      <p>La capacidad es v\u00e1lida, pero este servicio no tiene una f\u00f3rmula autom\u00e1tica.</p>`;
    calculatorCopyText = [...commonLines, "Resultado: cotizaci\u00f3n personalizada"].join("\n");
    return;
  }

  const extraAdults = Math.max(values.adults - calculatorService.includedGuests, 0);
  const remainingIncluded = Math.max(calculatorService.includedGuests - values.adults, 0);
  const extraChildren = Math.max(values.children - remainingIncluded, 0);
  const baseTotal = calculatorService.basePriceCents * values.nights;
  const adultTotal = extraAdults * calculatorService.adultExtraCents * values.nights;
  const childTotal = extraChildren * calculatorService.childExtraCents * values.nights;
  const total = baseTotal + adultTotal + childTotal;
  const rows = [
    `<div><span>${values.nights} \u00d7 base por noche</span><strong>${formatMoney(baseTotal)}</strong></div>`,
    extraAdults ? `<div><span>${extraAdults} adulto(s) extra \u00d7 ${values.nights}</span><strong>${formatMoney(adultTotal)}</strong></div>` : "",
    extraChildren ? `<div><span>${extraChildren} ni\u00f1o(s) extra \u00d7 ${values.nights}</span><strong>${formatMoney(childTotal)}</strong></div>` : "",
    values.infants ? `<div><span>${values.infants} menor(es) de 3 a\u00f1os</span><strong>${formatMoney(0)}</strong></div>` : "",
  ].filter(Boolean);
  resultHost.innerHTML = `
    <div class="calculator-result-head"><span>Ocupaci\u00f3n</span><strong>${totalGuests} de ${calculatorService.maxOccupancy}</strong></div>
    <div class="request-quote-rows">${rows.join("")}
      <div class="total"><span>Total estimado</span><strong>${formatMoney(total)}</strong></div>
    </div>
    <small>Estimaci\u00f3n sujeta a disponibilidad y confirmaci\u00f3n.</small>`;
  calculatorCopyText = [
    ...commonLines,
    `Base: ${formatMoney(baseTotal)}`,
    ...(extraAdults ? [`Adultos adicionales: ${formatMoney(adultTotal)}`] : []),
    ...(extraChildren ? [`Ni\u00f1os adicionales: ${formatMoney(childTotal)}`] : []),
    ...(values.infants ? ["Menores de 3 a\u00f1os: sin costo"] : []),
    `Total estimado: ${formatMoney(total)}`,
    "Sujeto a disponibilidad y confirmaci\u00f3n.",
  ].join("\n");
}

function openCalculator(service, initialValues = null) {
  calculatorService = service;
  if (!service) return;
  $("#calculator-title").textContent = `Calculadora \u00b7 ${service.name}`;
  $("#calculator-version").textContent = `Versi\u00f3n ${service.versionNumber || "\u2014"} \u00b7 capacidad m\u00e1xima ${service.maxOccupancy}`;
  $("#calculator-nights").value = initialValues?.nights || 1;
  $("#calculator-adults").value = initialValues?.adults ?? 2;
  $("#calculator-children").value = initialValues?.children ?? 0;
  $("#calculator-infants").value = initialValues?.infants ?? 0;
  calculatorModal.classList.remove("hidden");
  renderCalculator();
}

function closeCalculator() {
  calculatorService = null;
  calculatorCopyText = "";
  calculatorModal.classList.add("hidden");
}

function renderRequestDetail(request) {
  detailRequestId = request.id;
  $("#request-detail-title").textContent = `${formatRequestCode(request.request_number)} \u00b7 ${request.customer_name}`;
  requestDetailMessage.textContent = "";
  requestDetailMessage.className = "message";
  const requestCalculator = requestCalculatorService(request);

  $("#request-contact-actions").innerHTML = `
    <button
      class="contact-action whatsapp"
      data-request-contact-action="whatsapp"
      type="button"
    >
      Abrir WhatsApp
    </button>

    <button
      class="contact-action email"
      data-request-contact-action="email"
      type="button"
    >
      Enviar correo
    </button>

    ${
      requestCalculator
        ? '<button class="contact-action calculate" data-request-contact-action="calculate" type="button">Calcular escenario</button>'
        : ""
    }
  `;
  $("#request-detail-content").innerHTML = `
    <article class="request-detail-item"><span>Estado</span><strong class="status-badge ${request.status.replace("_", "-")}">${REQUEST_STATUS_LABELS[request.status]}</strong></article>
    <article class="request-detail-item"><span>Recibida</span><strong>${formatDateTime(request.submitted_at)}</strong></article>
    <article class="request-detail-item"><span>Visitante</span><strong>${escapeHtml(request.customer_name)}</strong></article>
    <article class="request-detail-item"><span>Contacto</span><p>${escapeHtml(request.customer_email)}<br>${escapeHtml(request.customer_cellphone)}</p></article>
    <article class="request-detail-item"><span>Estancia solicitada</span><p>${formatDate(request.checkin_date)} \u2013 ${formatDate(request.checkout_date)}</p></article>
    <article class="request-detail-item"><span>Hu\u00e9spedes</span><p>${request.adults} adulto${request.adults === 1 ? "" : "s"} \u00b7 ${request.children} ni\u00f1o${request.children === 1 ? "" : "s"}${request.infants ? ` \u00b7 ${request.infants} menor${request.infants === 1 ? "" : "es"} de 3` : ""}</p></article>
    <article class="request-detail-item full"><span>Servicio solicitado</span><p>${escapeHtml(requestServicesLabel(request))}</p></article>
    ${renderRequestQuote(request)}
    <article class="request-detail-item full"><span>Mensaje del visitante</span><p>${request.customer_message ? escapeHtml(request.customer_message).replaceAll("\n", "<br>") : "Sin mensaje adicional"}</p></article>
    ${request.status_reason ? `<article class="request-detail-item full"><span>Motivo del estado actual</span><p>${escapeHtml(REQUEST_REASON_LABELS[request.status_reason] || request.status_reason)}</p></article>` : ""}`;

  const actionHost = $("#request-status-actions");
  actionHost.innerHTML = requestStatusActions(request);
  $("#request-status-notes").value = "";
  $("#request-status-reason").value = "";
  $("#request-reason-label").classList.add("hidden");
  const hasActions = actionHost.children.length > 0;
  $("#request-status-notes").disabled = !hasActions;
  $("#request-status-help").textContent = hasActions
    ? "Solo se muestran las transiciones v\u00e1lidas para el estado actual."
    : "Este estado es terminal y no admite m\u00e1s cambios.";
}

async function loadRequestHistory(requestId) {
  const { data, error } = await supabase
    .from("information_request_status_history")
    .select(`
      id, previous_status, new_status, actor_type, actor_display_name,
      changed_by, reason, notes, changed_at
    `)
    .eq("information_request_id", requestId)
    .order("changed_at", { ascending: false });
  if (error) throw error;

  $("#request-history-list").innerHTML = (data || []).map((item) => `
    <article class="history-item">
      <span class="status-badge ${item.new_status.replace("_", "-")}">${REQUEST_STATUS_LABELS[item.new_status]}</span>
      <div>
        <strong>${item.previous_status ? `${REQUEST_STATUS_LABELS[item.previous_status]} \u2192 ` : ""}${REQUEST_STATUS_LABELS[item.new_status]}</strong>
        ${item.reason ? `<p>${escapeHtml(REQUEST_REASON_LABELS[item.reason] || item.reason)}</p>` : ""}
        ${item.notes ? `<p>${escapeHtml(item.notes).replaceAll("\n", "<br>")}</p>` : ""}
      </div>
      <div class="history-actor">${escapeHtml(item.actor_display_name)}<br>${formatDateTime(item.changed_at)}</div>
    </article>
  `).join("");
}

async function openRequestDetail(request) {
  syncRequestUrl(request.id);
  renderRequestDetail(request);
  requestDetailModal.classList.remove("hidden");
  $("#request-history-list").innerHTML = '<p class="muted">Cargando historial\u2026</p>';
  try {
    await loadRequestHistory(request.id);
  } catch (error) {
    requestDetailMessage.textContent = friendlyError(error);
    requestDetailMessage.className = "message error";
  }
}

function closeRequestDetail() {
  detailRequestId = null;
  requestDetailModal.classList.add("hidden");
  syncRequestUrl();
}

async function openDeepLinkedRequest() {
  const requestId = linkedRequestId();
  if (!requestId) return;

  openView("requests");
  const request = informationRequests.find((item) => item.id === requestId);
  if (!request) {
    setRequestMessage("La solicitud vinculada no existe o ya no está disponible.", "error");
    syncRequestUrl();
    return;
  }

  calendarMonth = monthStart(request.checkin_date);
  renderInformationRequests();
  await openRequestDetail(request);
}

async function changeRequestStatus(button) {
  const request = informationRequests.find((item) => item.id === detailRequestId);
  if (!request) return;
  const nextStatus = button.dataset.nextStatus;
  const reasonInput = $("#request-status-reason");
  const reasonLabel = $("#request-reason-label");
  let reason = {
    booked: "Booking confirmed",
    cancelled: "Booking cancelled",
    closed: "Stay completed",
    new: "Visitor contacted again",
  }[nextStatus] || null;

  if (nextStatus === "not_converted") {
    reasonLabel.classList.remove("hidden");
    if (!reasonInput.value) {
      requestDetailMessage.textContent = "Selecciona el motivo por el que la solicitud no se convirti\u00f3.";
      requestDetailMessage.className = "message error";
      reasonInput.focus();
      return;
    }
    reason = reasonInput.value;
  }

  button.disabled = true;
  requestDetailMessage.textContent = "Actualizando estado\u2026";
  requestDetailMessage.className = "message";
  const { error } = await supabase.rpc("change_information_request_status", {
    p_request_id: request.id,
    p_expected_status: request.status,
    p_new_status: nextStatus,
    p_reason: reason,
    p_notes: $("#request-status-notes").value.trim() || null,
  });

  if (error) {
    button.disabled = false;
    requestDetailMessage.textContent = friendlyError(error);
    requestDetailMessage.className = "message error";
    return;
  }

  try {
    await loadInformationRequests();
    const refreshed = informationRequests.find((item) => item.id === request.id);
    if (refreshed) {
      renderRequestDetail(refreshed);
      await loadRequestHistory(refreshed.id);
      requestDetailMessage.textContent = `Estado actualizado a ${REQUEST_STATUS_LABELS[nextStatus].toLowerCase()}.`;
      requestDetailMessage.className = "message success";
    }
    setRequestMessage(`La solicitud ${formatRequestCode(request.request_number)} fue actualizada.`, "success");
  } catch (refreshError) {
    requestDetailMessage.textContent = friendlyError(refreshError);
    requestDetailMessage.className = "message error";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const submit = loginForm.querySelector("button");
  submit.disabled = true;
  submit.textContent = "Ingresando\u2026";
  const form = new FormData(loginForm);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
  });
  submit.disabled = false;
  submit.textContent = "Ingresar";
  if (error) return void (loginError.textContent = "Correo o contrase\u00f1a incorrectos.");
  await startSession(data.session);
});

recipientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = recipientForm.querySelector('[type="submit"]');
  submit.disabled = true;
  $("#recipient-form-error").textContent = "";
  const id = $("#recipient-id").value;
  const args = {
    p_display_name: $("#recipient-name").value.trim(),
    p_phone_e164: $("#recipient-phone").value.trim(),
    p_is_active: $("#recipient-active").checked,
  };
  const { error } = id
    ? await supabase.rpc("update_whatsapp_recipient", { p_id: id, ...args })
    : await supabase.rpc("create_whatsapp_recipient", args);
  submit.disabled = false;
  if (error) return void ($("#recipient-form-error").textContent = friendlyError(error));
  closeRecipientModal();
  await loadRecipients();
  setRecipientMessage(id ? "Contacto actualizado." : "Contacto agregado.", "success");
});

serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = serviceForm.querySelector('[type="submit"]');
  submit.disabled = true;
  $("#service-form-error").textContent = "";
  const id = $("#service-id").value;
  const pricingModel = $("#service-pricing-model").value;
  const priceOnRequest = pricingModel === "manual_quote";
  const includedGuests = Number($("#service-included-guests").value);
  const minGuests = Number($("#service-min-guests").value);
  const maxOccupancy = Number($("#service-max-occupancy").value);
  if (!priceOnRequest && includedGuests > maxOccupancy) {
    submit.disabled = false;
    $("#service-form-error").textContent = "Los hu\u00e9spedes incluidos no pueden exceder la capacidad f\u00edsica m\u00e1xima.";
    $("#service-included-guests").focus();
    return;
  }
  if (minGuests > maxOccupancy) {
    submit.disabled = false;
    $("#service-form-error").textContent = "El mínimo de huéspedes no puede exceder la capacidad máxima.";
    $("#service-min-guests").focus();
    return;
  }
  if ($("#service-booking-time-model").value === "fixed_window"
    && $("#service-window-start").value >= $("#service-window-end").value) {
    submit.disabled = false;
    $("#service-form-error").textContent = "La hora final debe ser posterior a la hora inicial.";
    $("#service-window-start").focus();
    return;
  }
  const commonArgs = {
    p_category_code: $("#service-category").value,
    p_is_active: $("#service-active").checked,
    p_display_order: Number($("#service-display-order").value),
    p_name_es: $("#service-name-es").value.trim(),
    p_name_en: $("#service-name-en").value.trim(),
    p_description_es: $("#service-description-es").value.trim(),
    p_description_en: $("#service-description-en").value.trim(),
    p_pricing_unit: "per_night",
    p_price_on_request: priceOnRequest,
    p_base_price_cents: priceOnRequest ? 0 : centsFromInput("#service-base-price"),
    p_included_guests: priceOnRequest ? 0 : includedGuests,
    p_max_occupancy: maxOccupancy,
    p_adult_extra_cents: priceOnRequest ? 0 : centsFromInput("#service-adult-extra"),
    p_child_extra_cents: priceOnRequest ? 0 : centsFromInput("#service-child-extra"),
    p_amenities_es: linesFromTextarea("#service-amenities-es"),
    p_amenities_en: linesFromTextarea("#service-amenities-en"),
  };
  const { data: savedService, error } = id
    ? await supabase.rpc("create_service_version", {
      p_service_id: id,
      p_expected_current_version_id: services.find((service) => service.id === id)?.current_version_id,
      ...commonArgs,
    })
    : await supabase.rpc("create_service", {
      p_service_code: slugify(commonArgs.p_name_en),
      ...commonArgs,
    });
  submit.disabled = false;
  if (error) return void ($("#service-form-error").textContent = friendlyError(error));

  const serviceId = id || savedService?.id;
  const existingPlan = services.find((service) => service.id === serviceId)?.rate_plans?.find((plan) => plan.rate_code === "standard");
  const integerOrNull = (selector) => $(selector).value === "" ? null : Number($(selector).value);
  const fixedWindow = $("#service-booking-time-model").value === "fixed_window";
  const { error: rateError } = await supabase.rpc("save_primary_rate_plan", {
    p_service_id: serviceId,
    p_expected_current_version_id: existingPlan?.current_version_id || null,
    p_booking_time_model: $("#service-booking-time-model").value,
    p_pricing_model: pricingModel,
    p_base_price_cents: priceOnRequest ? 0 : centsFromInput("#service-base-price"),
    p_included_guests: pricingModel === "base_plus_guests" ? includedGuests : 0,
    p_min_guests: minGuests,
    p_max_occupancy: maxOccupancy,
    p_max_adults: integerOrNull("#service-max-adults"),
    p_max_children: integerOrNull("#service-max-children"),
    p_max_infants: integerOrNull("#service-max-infants"),
    p_adult_extra_cents: pricingModel === "base_plus_guests" ? centsFromInput("#service-adult-extra") : 0,
    p_child_extra_cents: pricingModel === "base_plus_guests" ? centsFromInput("#service-child-extra") : 0,
    p_infant_extra_cents: pricingModel === "base_plus_guests" ? centsFromInput("#service-infant-extra") : 0,
    p_supplement_basis: $("#service-supplement-basis").value,
    p_min_units: Number($("#service-min-units").value),
    p_max_units: integerOrNull("#service-max-units"),
    p_window_start: fixedWindow ? $("#service-window-start").value : null,
    p_window_end: fixedWindow ? $("#service-window-end").value : null,
    p_buffer_before_minutes: 0,
    p_buffer_after_minutes: 0,
    p_restrictions_es: $("#service-restrictions-es").value.trim(),
    p_restrictions_en: $("#service-restrictions-en").value.trim(),
  });
  if (rateError) {
    submit.disabled = false;
    return void ($("#service-form-error").textContent = friendlyError(rateError));
  }

  closeServiceModal();
  await loadServices();
  setServiceMessage(id ? "Nueva versi\u00f3n creada." : "Servicio agregado.", "success");
});

$("#recipient-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const recipient = recipients.find((item) => item.id === button.dataset.id);
  if (!recipient) return;
  if (button.dataset.action === "edit") return openRecipientModal(recipient);

  button.disabled = true;
  let error;
  if (button.dataset.action === "default") {
    ({ error } = await supabase.rpc("set_default_whatsapp_recipient", { p_recipient_id: recipient.id }));
  } else if (button.dataset.action === "delete") {
    if (!window.confirm(`\u00bfEliminar a ${recipient.display_name}?`)) {
      button.disabled = false;
      return;
    }
    ({ error } = await supabase.rpc("delete_whatsapp_recipient", { p_id: recipient.id }));
  }
  if (error) setRecipientMessage(friendlyError(error), "error");
  else {
    await loadRecipients();
    setRecipientMessage(button.dataset.action === "default" ? "Contacto predeterminado actualizado." : "Contacto eliminado.", "success");
  }
  button.disabled = false;
});

$("#service-list").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-service-action]");
  if (!button) return;
  const service = services.find((item) => item.id === button.dataset.id);
  if (!service) return;
  const action = button.dataset.serviceAction;
  if (action === "copy") {
    copyText(serviceShareText(service), "Detalles del servicio copiados.");
    return;
  }
  if (action === "calculate") {
    openCalculator(catalogCalculatorService(service));
    return;
  }
  if (action === "edit") return openServiceModal(service);
  if (action === "history") return openServiceHistory(service);
  if (action === "delete" && !window.confirm(`\u00bfEliminar ${currentVersion(service)?.name_es}? Esta acci\u00f3n elimina todo su historial.`)) return;

  button.disabled = true;
  const { error } = action === "toggle"
    ? await supabase.rpc("set_service_active", { p_service_id: service.id, p_is_active: !service.is_active })
    : await supabase.rpc("delete_service", { p_service_id: service.id });
  if (error) setServiceMessage(friendlyError(error), "error");
  else {
    await loadServices();
    setServiceMessage(action === "toggle" ? "Estado del servicio actualizado." : "Servicio eliminado.", "success");
  }
  button.disabled = false;
});

$("#service-history-list").addEventListener("click", async (event) => {
  const button = event.target.closest('button[data-history-action="make-current"]');
  if (!button || !historyServiceId) return;

  const service = services.find((item) => item.id === historyServiceId);
  const version = service?.service_versions?.find((item) => item.id === button.dataset.versionId);
  if (!service || !version) return;

  const confirmed = window.confirm(
    `\u00bfHacer la versi\u00f3n ${version.version_number} la versi\u00f3n actual de ${version.name_es}?`
  );
  if (!confirmed) return;

  button.disabled = true;
  serviceHistoryMessage.textContent = "Actualizando versi\u00f3n\u2026";
  serviceHistoryMessage.className = "message";

  const { error } = await supabase.rpc("set_current_service_version", {
    p_service_id: service.id,
    p_version_id: version.id,
    p_expected_current_version_id: service.current_version_id,
  });

  if (error) {
    button.disabled = false;
    serviceHistoryMessage.textContent = friendlyError(error);
    serviceHistoryMessage.className = "message error";
    return;
  }

  await loadServices();
  const refreshedService = services.find((item) => item.id === service.id);
  if (refreshedService) openServiceHistory(refreshedService);
  serviceHistoryMessage.textContent = `La versi\u00f3n ${version.version_number} ahora es la versi\u00f3n actual.`;
  serviceHistoryMessage.className = "message success";
  setServiceMessage(`La versi\u00f3n ${version.version_number} de ${version.name_es} ahora es la versi\u00f3n actual.`, "success");
});

$("#request-list").addEventListener("click", (event) => {
  const button = event.target.closest('button[data-request-action="detail"]');
  if (!button) return;
  const request = informationRequests.find((item) => item.id === button.dataset.id);
  if (request) openRequestDetail(request);
});

$("#request-calendar-grid").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-calendar-request]");
  if (!button) return;
  const request = informationRequests.find((item) => item.id === button.dataset.calendarRequest);
  if (request) openRequestDetail(request);
});

$("#request-status-actions").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-next-status]");
  if (button && !button.disabled) changeRequestStatus(button);
});

$("#request-contact-actions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-request-contact-action]");
  if (!button) return;

  const request = informationRequests.find(
    (item) => item.id === detailRequestId
  );

  if (!request) return;

  const action = button.dataset.requestContactAction;
  const message = requestCommunicationText(request);

  if (action === "whatsapp") {
    const phone = request.customer_cellphone.replace(/\D/g, "");

    window.open(
      `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener"
    );

    return;
  }

  if (action === "email") {
    const subject =
      `Cebolletas Copal \u00b7 ${formatRequestCode(request.request_number)}`;

    window.location.href =
      `mailto:${encodeURIComponent(request.customer_email)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(message)}`;

    return;
  }

  if (action !== "calculate") return;

  const service = requestCalculatorService(request);
  if (!service) return;

  openCalculator(service, {
    nights: request.quote_snapshot?.stay?.nights || 1,
    adults:
      request.quote_snapshot?.occupancy?.adults ?? request.adults,
    children:
      request.quote_snapshot?.occupancy?.children ?? request.children,
    infants:
      request.quote_snapshot?.occupancy?.infants ??
      request.infants ??
      0,
  });
});

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  loginForm.reset();
  openView("overview");
  showApp(false);
});
refreshButton.addEventListener("click", async () => {
  try {
    await refreshManagementData();
  } catch {
    // The refresh status contains the actionable error for the administrator.
  }
});
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => openView(button.dataset.go)));
$("#add-recipient-button").addEventListener("click", () => openRecipientModal());
$("#add-service-button").addEventListener("click", () => openServiceModal());
$("#close-recipient-modal").addEventListener("click", closeRecipientModal);
$("#cancel-recipient").addEventListener("click", closeRecipientModal);
$(".modal-backdrop").addEventListener("click", closeRecipientModal);
$("#close-service-modal").addEventListener("click", closeServiceModal);
$("#cancel-service").addEventListener("click", closeServiceModal);
$(".service-modal-backdrop").addEventListener("click", closeServiceModal);
$("#close-service-history").addEventListener("click", closeServiceHistory);
$(".history-modal-backdrop").addEventListener("click", closeServiceHistory);
$("#close-request-detail").addEventListener("click", closeRequestDetail);
$(".request-modal-backdrop").addEventListener("click", closeRequestDetail);
$("#close-calculator").addEventListener("click", closeCalculator);
$(".calculator-modal-backdrop").addEventListener("click", closeCalculator);
["#calculator-nights", "#calculator-adults", "#calculator-children", "#calculator-infants"].forEach((selector) => {
  $(selector).addEventListener("input", renderCalculator);
});
$("#copy-calculator-result").addEventListener("click", async (event) => {
  if (!calculatorCopyText) return;
  const button = event.currentTarget;
  await copyText(calculatorCopyText, "");
  button.textContent = "Escenario copiado";
  window.setTimeout(() => { button.textContent = "Copiar escenario"; }, 1800);
});
["#service-pricing-model", "#service-booking-time-model"].forEach((selector) => $(selector).addEventListener("change", updatePricingFieldState));
["#service-base-price", "#service-included-guests", "#service-max-occupancy", "#service-adult-extra", "#service-child-extra", "#service-infant-extra"].forEach((selector) => {
  $(selector).addEventListener("input", updatePricingPreview);
});
$("#recipient-search").addEventListener("input", renderRecipients);
$("#recipient-status-filter").addEventListener("change", renderRecipients);
$("#service-search").addEventListener("input", renderServices);
$("#service-category-filter").addEventListener("change", renderServices);
$("#service-status-filter").addEventListener("change", renderServices);
$("#request-search").addEventListener("input", renderInformationRequests);
$("#request-status-filter").addEventListener("change", renderInformationRequests);
$("#request-service-filter").addEventListener("change", renderInformationRequests);
$("#request-calendar-view").addEventListener("click", () => setRequestView("calendar"));
$("#request-list-view").addEventListener("click", () => setRequestView("list"));
$("#calendar-previous").addEventListener("click", () => moveCalendarMonth(-1));
$("#calendar-next").addEventListener("click", () => moveCalendarMonth(1));
$("#calendar-today").addEventListener("click", () => {
  calendarMonth = monthStart(mexicoCityDate());
  renderInformationRequests();
});
menuButton.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  scrim.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});
scrim.addEventListener("click", closeMenu);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
    closeRecipientModal();
    closeServiceModal();
    closeServiceHistory();
    closeRequestDetail();
    closeCalculator();
  }
});

const { data: { session } } = await supabase.auth.getSession();
await startSession(session);
