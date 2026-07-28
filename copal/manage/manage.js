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
  document.querySelectorAll("[data-page]").forEach((page) => {
    page.classList.toggle("active", page.dataset.page === name);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("admin_profiles")
    .select("display_name, role, active")
    .eq("user_id", userId)
    .single();

  if (error || !data?.active) {
    throw new Error("Esta cuenta no tiene acceso administrativo activo.");
  }

  $("#account-name").textContent = `${data.display_name} · ${data.role}`;
}

async function startSession(session) {
  if (!session?.user) {
    showApp(false);
    return;
  }

  try {
    await loadProfile(session.user.id);
    showApp(true);
  } catch (error) {
    await supabase.auth.signOut();
    loginError.textContent = error.message;
    showApp(false);
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
  loginForm.reset();
  openView("overview");
  showApp(false);
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.view));
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => openView(button.dataset.go));
});
menuButton.addEventListener("click", () => {
  const open = sidebar.classList.toggle("open");
  scrim.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});
scrim.addEventListener("click", closeMenu);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});

const { data: { session } } = await supabase.auth.getSession();
await startSession(session);
