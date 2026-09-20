import config from "../config/environment.js?v=10.7.0";

const $ = (selector) => document.querySelector(selector);
const endpoint = `${config.supabaseUrl}/functions/v1/request-summary`;

function verificationCode() {
  const code = new URLSearchParams(window.location.hash.slice(1)).get("code") || "";
  if (window.location.hash) window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
  return /^[0-9a-f]{48}$/.test(code) ? code : "";
}

function show(name) {
  ["loading", "unavailable", "receipt"].forEach((state) => {
    $(`#${state}-state`).classList.toggle("hidden", state !== name);
  });
}

function formatMoney(cents) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(cents) / 100);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

async function verify() {
  const code = verificationCode();
  if (!code) return show("unavailable");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ verification_code: code, format: "verification" }),
    });
    if (!response.ok) return show("unavailable");
    const receipt = (await response.json())?.receipt;
    if (!receipt) return show("unavailable");
    $("#receipt-number").textContent = receipt.receipt_number;
    $("#issued-at").textContent = formatDateTime(receipt.issued_at);
    $("#payment-amount").textContent = formatMoney(receipt.payment_amount_cents);
    const valid = receipt.validity === "valid";
    $("#validity").textContent = valid ? "Válido · Valid" : "Anulado · Voided";
    $("#validity").classList.toggle("voided", !valid);
    show("receipt");
  } catch {
    show("unavailable");
  }
}

await verify();
