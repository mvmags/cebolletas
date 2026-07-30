type JsonObject = Record<string, unknown>;

type InformationRequestRecord = {
  id?: string;
  request_number?: number | string;
  checkin_date?: string;
  checkout_date?: string;
  adults?: number;
  children?: number;
  infants?: number;
  requested_services?: string[];
  pricing_status?: "estimated" | "manual" | null;
  estimated_total_cents?: number | null;
  quote_snapshot?: JsonObject | null;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: InformationRequestRecord;
};

const TELEGRAM_API_BASE = "https://api.telegram.org";
const DEFAULT_MANAGE_APP_URL = "https://cebolletas.mx/copal/manage/";

const SERVICE_LABELS: Record<string, string> = {
  copal: "Cebolletas Copal",
  camping: "Camping",
  events: "Eventos",
};

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function jsonResponse(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatRequestCode(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number)
    ? `SOL-${String(Math.trunc(number)).padStart(6, "0")}`
    : "SOL-PRUEBA";
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  }).format(new Date(`${value}T12:00:00-06:00`));
}

function formatMoney(cents: unknown): string {
  const value = Number(cents);
  if (!Number.isFinite(value)) return "Cotización personalizada";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function numericValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function notificationDetails(record: InformationRequestRecord) {
  const snapshot = objectValue(record.quote_snapshot);
  const service = objectValue(snapshot.service);
  const stay = objectValue(snapshot.stay);
  const occupancy = objectValue(snapshot.occupancy);
  const pricing = objectValue(snapshot.pricing);

  const fallbackServices = (record.requested_services || [])
    .map((code) => SERVICE_LABELS[code] || code)
    .join(", ");

  const serviceName = String(
    service.name_es || fallbackServices || "Servicio por confirmar",
  );

  const adults = numericValue(occupancy.adults, numericValue(record.adults));
  const children = numericValue(
    occupancy.children,
    numericValue(record.children),
  );
  const infants = numericValue(
    occupancy.infants,
    numericValue(record.infants),
  );

  const estimate = record.pricing_status === "estimated"
    ? formatMoney(
      pricing.estimated_total_cents ?? record.estimated_total_cents,
    )
    : "Cotización personalizada";

  return {
    requestCode: formatRequestCode(record.request_number),
    serviceName,
    checkin: stay.checkin || record.checkin_date,
    checkout: stay.checkout || record.checkout_date,
    adults,
    children,
    infants,
    estimate,
  };
}

function buildTelegramMessage(
  record: InformationRequestRecord,
  isTest: boolean,
): { text: string; serviceName: string; requestCode: string } {
  const details = notificationDetails(record);
  const heading = isTest
    ? "🧪 <b>Prueba de notificación</b>"
    : `🔔 <b>Nueva solicitud ${escapeHtml(details.requestCode)}</b>`;

  return {
    requestCode: details.requestCode,
    serviceName: details.serviceName,
    text: [
      heading,
      "",
      `<b>Servicio:</b> ${escapeHtml(details.serviceName)}`,
      `<b>Fechas:</b> ${escapeHtml(formatDate(details.checkin))} – ${escapeHtml(formatDate(details.checkout))}`,
      `<b>Huéspedes:</b> ${details.adults} adulto(s) · ${details.children} niño(s) · ${details.infants} menor(es) de 3`,
      `<b>Estimación:</b> ${escapeHtml(details.estimate)}`,
    ].join("\n"),
  };
}

async function secureEquals(actual: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(actualHash);
  const right = new Uint8Array(expectedHash);
  return left.every((value, index) => value === right[index]);
}

async function writeDeliveryLog(entry: JsonObject): Promise<void> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/notification_delivery_logs`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(entry),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Delivery log failed (${response.status}): ${await response.text()}`,
    );
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let webhookSecret: string;
  let botToken: string;
  let chatId: string;

  try {
    webhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
    botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
    chatId = requiredEnv("TELEGRAM_CHAT_ID");
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: "Notification service is not configured" });
  }

  const suppliedSecret = request.headers.get("x-webhook-secret") || "";
  if (!await secureEquals(suppliedSecret, webhookSecret)) {
    return jsonResponse(401, { error: "Unauthorized" });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return jsonResponse(400, { error: "Invalid JSON body" });
  }

  const isTest = payload.type === "TEST";
  const isNewRequest = payload.type === "INSERT"
    && payload.schema === "public"
    && payload.table === "information_requests";

  if ((!isTest && !isNewRequest) || !payload.record) {
    return jsonResponse(400, { error: "Unsupported webhook event" });
  }

  const record = payload.record;
  const notification = buildTelegramMessage(record, isTest);
  const manageUrl = new URL(
    Deno.env.get("MANAGE_APP_URL") || DEFAULT_MANAGE_APP_URL,
  );

  if (!isTest && record.id) {
    manageUrl.searchParams.set("request", record.id);
  }

  const eventType = isTest ? "test" : "information_request.insert";
  let telegramStatus: number | null = null;

  try {
    const telegramResponse = await fetch(
      `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: notification.text,
          parse_mode: "HTML",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[
              {
                text: isTest ? "Abrir Manage" : "Abrir solicitud",
                url: manageUrl.toString(),
              },
            ]],
          },
        }),
      },
    );

    telegramStatus = telegramResponse.status;
    const telegramBody = await telegramResponse.json() as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };

    if (!telegramResponse.ok || !telegramBody.ok) {
      throw new Error(
        telegramBody.description || `Telegram returned ${telegramResponse.status}`,
      );
    }

    await writeDeliveryLog({
      information_request_id: isTest ? null : record.id || null,
      provider: "telegram",
      event_type: eventType,
      status: "sent",
      provider_message_id: telegramBody.result?.message_id || null,
      http_status: telegramResponse.status,
      payload_summary: {
        request_code: notification.requestCode,
        service_name: notification.serviceName,
        test: isTest,
      },
    });

    return jsonResponse(200, {
      ok: true,
      message_id: telegramBody.result?.message_id || null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message.slice(0, 1000)
      : "Unknown Telegram delivery error";

    console.error(error);

    try {
      await writeDeliveryLog({
        information_request_id: isTest ? null : record.id || null,
        provider: "telegram",
        event_type: eventType,
        status: "failed",
        http_status: telegramStatus,
        error_message: errorMessage,
        payload_summary: {
          request_code: notification.requestCode,
          service_name: notification.serviceName,
          test: isTest,
        },
      });
    } catch (logError) {
      console.error(logError);
    }

    return jsonResponse(502, {
      ok: false,
      error: "Telegram delivery failed",
    });
  }
});
