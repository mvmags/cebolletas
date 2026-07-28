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
let recipients = [];
let defaultRecipientId = null;

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

function friendlyError(error) {
  if (error?.code === "23505") return "Este número ya está registrado.";
  if (error?.message?.includes("default before")) return "Selecciona otro contacto predeterminado antes de continuar.";
  if (error?.message?.includes("must be active")) return "El contacto predeterminado debe estar activo.";
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
    await loadRecipients();
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

    ({ error } = await supabase.rpc("delete_whatsapp_recipient", {
      p_id: recipient.id,
    }));
  }
  if (error) setRecipientMessage(friendlyError(error), "error");
  else {
    await loadRecipients();
    setRecipientMessage(button.dataset.action === "default" ? "Contacto predeterminado actualizado." : "Contacto eliminado.", "success");
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
$("#close-recipient-modal").addEventListener("click", closeRecipientModal);
$("#cancel-recipient").addEventListener("click", closeRecipientModal);
$(".modal-backdrop").addEventListener("click", closeRecipientModal);
$("#recipient-search").addEventListener("input", renderRecipients);
$("#recipient-status-filter").addEventListener("change", renderRecipients);
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
  }
});

const { data: { session } } = await supabase.auth.getSession();
await startSession(session);
