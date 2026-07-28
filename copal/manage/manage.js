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
let recipients = [];
let defaultRecipientId = null;
let services = [];

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

function setRecipientMessage(text = "", type = "") {
  recipientMessage.textContent = text;
  recipientMessage.className = `message ${type}`.trim();
}

function setServiceMessage(text = "", type = "") {
  serviceMessage.textContent = text;
  serviceMessage.className = `message ${type}`.trim();
}

function friendlyError(error) {
  if (error?.code === "23505") return "Este número ya está registrado.";
  if (error?.message?.includes("default before")) return "Selecciona otro contacto predeterminado antes de continuar.";
  if (error?.message?.includes("must be active")) return "El contacto predeterminado debe estar activo.";
  if (error?.message?.includes("Service not found")) return "El servicio ya no existe.";
  if (error?.message?.includes("Service is referenced")) return "No se puede eliminar porque una reservación conserva esta versión.";
  if (error?.message?.includes("Version conflict")) return "El servicio cambió en otra sesión. Recarga el catálogo antes de editar.";
  return error?.message || "No fue posible completar la operación.";
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

function formatMoney(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: Number(cents) % 100 === 0 ? 0 : 2,
  }).format(Number(cents || 0) / 100);
}

function currentVersion(service) {
  return service.service_versions?.find((version) => version.id === service.current_version_id)
    || service.service_versions?.[0]
    || null;
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
  $("#service-empty").classList.toggle("hidden", services.length !== 0);

  visible.forEach((service) => {
    const version = currentVersion(service);
    if (!version) return;
    const row = document.createElement("div");
    row.className = "service-row";
    const price = version.price_on_request
      ? "Precio a consultar"
      : `${formatMoney(version.base_price_cents)} ${PRICING_UNIT_LABELS[version.pricing_unit] || ""}`;
    row.innerHTML = `
      <div class="service-title">
        <strong>${escapeHtml(version.name_es)}</strong>
        <small>${escapeHtml(version.name_en)} · ${escapeHtml(CATEGORY_LABELS[service.category_code] || service.category_code)} · v${version.version_number}</small>
      </div>
      <div class="service-description">
        <span>${escapeHtml(version.description_es)}</span>
        <small>${escapeHtml(version.description_en)}</small>
      </div>
      <div class="service-price">
        <strong>${escapeHtml(price)}</strong>
        <small>${version.price_on_request ? "Sin tarifa automática" : `Incluye ${version.included_guests} · máximo ${version.max_occupancy}`}</small>
      </div>
      <span class="status-badge ${service.is_active ? "active" : "inactive"}">${service.is_active ? "Activo" : "Inactivo"}</span>
      <div class="row-actions">
        <button data-service-action="history" data-id="${service.id}" type="button">Historial</button>
        <button data-service-action="edit" data-id="${service.id}" type="button">Nueva versión</button>
        <button data-service-action="toggle" data-id="${service.id}" type="button">${service.is_active ? "Desactivar" : "Activar"}</button>
        <button class="danger" data-service-action="delete" data-id="${service.id}" type="button">Eliminar</button>
      </div>`;
    list.append(row);
  });

  const activeCount = services.filter((service) => service.is_active).length;
  $("#service-count").textContent = String(activeCount);
  $("#service-count-summary").textContent = `${services.length} servicio${services.length === 1 ? "" : "s"} en el catálogo`;
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
      )
    `)
    .order("display_order")
    .order("created_at");
  if (error) throw error;
  services = data || [];
  services.forEach((service) => {
    service.service_versions?.sort((a, b) => b.version_number - a.version_number);
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
  $("#account-name").textContent = `${data.display_name} · ${data.role}`;
}

async function startSession(session) {
  if (!session?.user) return showApp(false);
  try {
    await loadProfile(session.user.id);
    await Promise.all([loadRecipients(), loadServices()]);
    showApp(true);
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
  const disabled = $("#service-price-on-request").checked;
  ["#service-base-price", "#service-included-guests", "#service-adult-extra", "#service-child-extra"].forEach((selector) => {
    const input = $(selector);
    input.disabled = disabled;
    input.required = !disabled;
  });
}

function openServiceModal(service = null) {
  const version = service ? currentVersion(service) : null;
  serviceForm.reset();
  $("#service-id").value = service?.id || "";
  $("#service-category").value = service?.category_code || "copal";
  $("#service-pricing-unit").value = version?.pricing_unit || "per_night";
  $("#service-display-order").value = service?.display_order ?? services.length * 10;
  $("#service-name-es").value = version?.name_es || "";
  $("#service-name-en").value = version?.name_en || "";
  $("#service-description-es").value = version?.description_es || "";
  $("#service-description-en").value = version?.description_en || "";
  $("#service-amenities-es").value = (version?.amenities_es || []).join("\n");
  $("#service-amenities-en").value = (version?.amenities_en || []).join("\n");
  $("#service-price-on-request").checked = version?.price_on_request || false;
  $("#service-base-price").value = pesosFromCents(version?.base_price_cents);
  $("#service-included-guests").value = version?.included_guests ?? 0;
  $("#service-max-occupancy").value = version?.max_occupancy ?? 1;
  $("#service-adult-extra").value = pesosFromCents(version?.adult_extra_cents);
  $("#service-child-extra").value = pesosFromCents(version?.child_extra_cents);
  $("#service-active").checked = service?.is_active ?? true;
  $("#service-modal-title").textContent = service ? `Nueva versión de ${version.name_es}` : "Agregar servicio";
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
  $("#service-history-title").textContent = `Versiones de ${current?.name_es || "servicio"}`;
  $("#service-history-list").innerHTML = versions.map((version) => `
    <article class="history-item ${version.id === service.current_version_id ? "current" : ""}">
      <div class="history-item-head">
        <strong>Versión ${version.version_number}${version.id === service.current_version_id ? " · actual" : ""}</strong>
        <span>${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at))}</span>
      </div>
      <p><strong>${escapeHtml(version.name_es)}</strong> / ${escapeHtml(version.name_en)}</p>
      <p>${version.price_on_request ? "Precio a consultar" : `${formatMoney(version.base_price_cents)} ${PRICING_UNIT_LABELS[version.pricing_unit] || ""}; adulto adicional ${formatMoney(version.adult_extra_cents)}; niño adicional ${formatMoney(version.child_extra_cents)}.`}</p>
      <p>Incluye ${version.included_guests} huésped(es); capacidad máxima ${version.max_occupancy}. Menores de 3 años sin costo y cuentan en capacidad.</p>
    </article>
  `).join("");
  serviceHistoryModal.classList.remove("hidden");
}

function closeServiceHistory() {
  serviceHistoryModal.classList.add("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const submit = loginForm.querySelector("button");
  submit.disabled = true;
  submit.textContent = "Ingresando…";
  const form = new FormData(loginForm);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")).trim(),
    password: String(form.get("password")),
  });
  submit.disabled = false;
  submit.textContent = "Ingresar";
  if (error) return void (loginError.textContent = "Correo o contraseña incorrectos.");
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
  const priceOnRequest = $("#service-price-on-request").checked;
  const commonArgs = {
    p_category_code: $("#service-category").value,
    p_is_active: $("#service-active").checked,
    p_display_order: Number($("#service-display-order").value),
    p_name_es: $("#service-name-es").value.trim(),
    p_name_en: $("#service-name-en").value.trim(),
    p_description_es: $("#service-description-es").value.trim(),
    p_description_en: $("#service-description-en").value.trim(),
    p_pricing_unit: $("#service-pricing-unit").value,
    p_price_on_request: priceOnRequest,
    p_base_price_cents: priceOnRequest ? 0 : centsFromInput("#service-base-price"),
    p_included_guests: priceOnRequest ? 0 : Number($("#service-included-guests").value),
    p_max_occupancy: Number($("#service-max-occupancy").value),
    p_adult_extra_cents: priceOnRequest ? 0 : centsFromInput("#service-adult-extra"),
    p_child_extra_cents: priceOnRequest ? 0 : centsFromInput("#service-child-extra"),
    p_amenities_es: linesFromTextarea("#service-amenities-es"),
    p_amenities_en: linesFromTextarea("#service-amenities-en"),
  };
  const { error } = id
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

  closeServiceModal();
  await loadServices();
  setServiceMessage(id ? "Nueva versión creada." : "Servicio agregado.", "success");
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
    if (!window.confirm(`¿Eliminar a ${recipient.display_name}?`)) {
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
  if (action === "edit") return openServiceModal(service);
  if (action === "history") return openServiceHistory(service);
  if (action === "delete" && !window.confirm(`¿Eliminar ${currentVersion(service)?.name_es}? Esta acción elimina todo su historial.`)) return;

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

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  loginForm.reset();
  openView("overview");
  showApp(false);
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
$("#service-price-on-request").addEventListener("change", updatePricingFieldState);
$("#recipient-search").addEventListener("input", renderRecipients);
$("#recipient-status-filter").addEventListener("change", renderRecipients);
$("#service-search").addEventListener("input", renderServices);
$("#service-category-filter").addEventListener("change", renderServices);
$("#service-status-filter").addEventListener("change", renderServices);
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
  }
});

const { data: { session } } = await supabase.auth.getSession();
await startSession(session);
