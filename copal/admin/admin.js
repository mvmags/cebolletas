import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://myqaotknkriuhdssbzlz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XuDt5xNF3EzE0K2TSE9QCg_hnDMWsVN";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const STATUS_LABELS = {
  interested: "Interesado",
  booked: "Reservado",
  cancelled: "Cancelado",
  archived: "Archivado",
};

const TOPIC_LABELS = {
  stay_copal: "Cebolletas Copal",
  camping: "Camping",
  other: "Otro",
};

const state = { requests: [], selectedId: null, profile: null };
const $ = (selector) => document.querySelector(selector);
const loginView = $("#login-view");
const dashboardView = $("#dashboard-view");
const loginForm = $("#login-form");
const loginError = $("#login-error");
const list = $("#request-list");
const detail = $("#request-detail");
const loadMessage = $("#load-message");
const searchInput = $("#search-input");
const statusFilter = $("#status-filter");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

function formatCreated(value) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function nightsBetween(start, end) {
  return Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000);
}

function showDashboard(show) {
  loginView.classList.toggle("hidden", show);
  dashboardView.classList.toggle("hidden", !show);
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("display_name, role, active")
    .eq("user_id", userId)
    .single();
  if (error || !data?.active) throw new Error("Esta cuenta no tiene acceso administrativo activo.");
  state.profile = data;
  $("#account-name").textContent = `${data.display_name} · ${data.role}`;
}

async function loadRequests() {
  loadMessage.textContent = "Cargando solicitudes…";
  const { data, error } = await supabase
    .from("booking_requests")
    .select(`
      id, reference_code, visitor_name, visitor_email, visitor_cellphone,
      check_in, check_out, adults, children, other_request, status, created_at,
      booking_request_topics ( topic_code )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    loadMessage.textContent = `No se pudieron cargar las solicitudes: ${error.message}`;
    loadMessage.classList.add("error");
    return;
  }

  loadMessage.classList.remove("error");
  loadMessage.textContent = "";
  state.requests = data ?? [];
  if (!state.requests.some((item) => item.id === state.selectedId)) {
    state.selectedId = state.requests[0]?.id ?? null;
  }
  updateStats();
  renderRequests();
  renderDetail();
}

function filteredRequests() {
  const query = searchInput.value.trim().toLocaleLowerCase("es-MX");
  const filter = statusFilter.value;
  return state.requests.filter((item) => {
    const statusMatches = filter === "all" || item.status === filter;
    const haystack = `${item.visitor_name} ${item.visitor_email} ${item.reference_code}`.toLocaleLowerCase("es-MX");
    return statusMatches && (!query || haystack.includes(query));
  });
}

function updateStats() {
  $("#stat-total").textContent = state.requests.length;
  $("#stat-interested").textContent = state.requests.filter((item) => item.status === "interested").length;
  $("#stat-booked").textContent = state.requests.filter((item) => item.status === "booked").length;
}

function renderRequests() {
  const records = filteredRequests();
  if (!records.length) {
    list.innerHTML = '<p class="muted">No hay solicitudes que coincidan con el filtro.</p>';
    return;
  }
  list.innerHTML = records.map((item) => `
    <button class="request-row ${item.id === state.selectedId ? "active" : ""}" data-id="${item.id}" type="button">
      <span>
        <strong>${escapeHtml(item.visitor_name)}</strong>
        <small>${escapeHtml(item.reference_code)} · ${formatDate(item.check_in)}–${formatDate(item.check_out)}</small>
      </span>
      <span class="badge ${item.status}">${STATUS_LABELS[item.status]}</span>
    </button>
  `).join("");
  list.querySelectorAll("[data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedId = button.dataset.id;
      renderRequests();
      renderDetail();
    });
  });
}

function renderDetail() {
  const item = state.requests.find((record) => record.id === state.selectedId);
  if (!item) {
    detail.innerHTML = '<div class="empty-state"><div><h2>No hay solicitudes</h2><p>Cuando el formulario público almacene una solicitud, aparecerá aquí.</p></div></div>';
    return;
  }
  const topics = (item.booking_request_topics ?? []).map(({ topic_code }) =>
    `<span>${escapeHtml(TOPIC_LABELS[topic_code] ?? topic_code)}</span>`).join("");
  const canManage = state.profile?.role === "admin";
  detail.innerHTML = `
    <div class="detail-head">
      <div><span class="folio">${escapeHtml(item.reference_code)}</span><h2>${escapeHtml(item.visitor_name)}</h2></div>
      <span class="badge ${item.status}">${STATUS_LABELS[item.status]}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span>Entrada</span><strong>${formatDate(item.check_in)}</strong></div>
      <div class="detail-item"><span>Salida</span><strong>${formatDate(item.check_out)} · ${nightsBetween(item.check_in, item.check_out)} noches</strong></div>
      <div class="detail-item"><span>Huéspedes</span><strong>${item.adults} adultos · ${item.children} niños</strong></div>
      <div class="detail-item"><span>Recibida</span><strong>${formatCreated(item.created_at)}</strong></div>
      <div class="detail-item"><span>Correo</span><a href="mailto:${escapeHtml(item.visitor_email)}">${escapeHtml(item.visitor_email)}</a></div>
      <div class="detail-item"><span>Celular</span><a href="tel:${escapeHtml(item.visitor_cellphone)}">${escapeHtml(item.visitor_cellphone)}</a></div>
      <div class="detail-item full"><span>Interés</span><div class="topic-list">${topics || "<span>Sin tema</span>"}</div></div>
      <div class="detail-item full"><span>Mensaje</span><p>${escapeHtml(item.other_request || "Sin mensaje adicional.")}</p></div>
    </div>
    ${canManage ? `
      <div class="status-actions">
        <button class="status-button" data-status="interested">Marcar interesado</button>
        <button class="status-button book" data-status="booked">Confirmar reservación</button>
        <button class="status-button" data-status="cancelled">Cancelar</button>
        <button class="status-button" data-status="archived">Archivar</button>
      </div>
      <p id="status-message" class="message" role="status"></p>` : ""}
  `;
  detail.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(item.id, button.dataset.status));
  });
}

async function updateStatus(id, status) {
  const statusMessage = $("#status-message");
  statusMessage.textContent = "Guardando cambio…";
  statusMessage.classList.remove("error");
  const { error } = await supabase.from("booking_requests").update({ status }).eq("id", id);
  if (error) {
    statusMessage.textContent = error.code === "23P01"
      ? "No se puede confirmar: las fechas coinciden con otra reservación confirmada."
      : `No se pudo actualizar: ${error.message}`;
    statusMessage.classList.add("error");
    return;
  }
  await loadRequests();
}

async function startSession(session) {
  if (!session?.user) {
    showDashboard(false);
    return;
  }
  try {
    await loadProfile(session.user.id);
    showDashboard(true);
    await loadRequests();
  } catch (error) {
    await supabase.auth.signOut();
    loginError.textContent = error.message;
    showDashboard(false);
  }
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
  if (error) {
    loginError.textContent = "Correo o contraseña incorrectos.";
    return;
  }
  await startSession(data.session);
});

$("#logout-button").addEventListener("click", async () => {
  await supabase.auth.signOut();
  state.requests = [];
  state.selectedId = null;
  showDashboard(false);
});
$("#refresh-button").addEventListener("click", loadRequests);
searchInput.addEventListener("input", renderRequests);
statusFilter.addEventListener("change", renderRequests);

const { data: { session } } = await supabase.auth.getSession();
await startSession(session);
