import {
  generateRequestSummaryPdf,
  requestSummaryFilename,
  RequestSummaryData,
} from "./pdf.ts";

type JsonObject = Record<string, unknown>;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  expires: "0",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow, noarchive",
  "referrer-policy": "no-referrer",
};

const GENERIC_UNAVAILABLE = Object.freeze({
  error: "unavailable",
  messages: {
    es: "Esta página de solicitud no está disponible. Verifica el enlace o comunícate con Cebolletas.",
    en: "This request page is unavailable. Verify the link or contact Cebolletas.",
  },
});

const ALLOWED_ORIGINS = new Set([
  "https://cebolletas.mx",
  "https://www.cebolletas.mx",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WINDOW_MS = 10 * 60 * 1000;
const rateWindows = new Map<string, { startedAt: number; count: number }>();
let logoAssetsPromise: Promise<{ cebolletasLogo: Uint8Array; copalLogo: Uint8Array }> | null = null;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment value: ${name}`);
  return value;
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://cebolletas.mx",
    "access-control-allow-headers": "authorization, content-type, apikey",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function jsonResponse(request: Request, status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request) },
  });
}

function unavailableResponse(request: Request): Response {
  return jsonResponse(request, 404, GENERIC_UNAVAILABLE);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function clientKey(request: Request, bucket: string): Promise<string> {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = request.headers.get("cf-connecting-ip")?.trim() || forwarded || "unknown";
  return `${bucket}:${(await sha256Hex(address)).slice(0, 24)}`;
}

async function isRateLimited(request: Request, bucket: string, maximum: number): Promise<boolean> {
  const key = await clientKey(request, bucket);
  const now = Date.now();
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > maximum;
}

async function readBody(request: Request): Promise<JsonObject | null> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2048) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as JsonObject : null;
  } catch {
    return null;
  }
}

async function rpc(functionName: string, body: JsonObject): Promise<unknown> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Database request failed with status ${response.status}`);
  return await response.json();
}

function validSummary(value: unknown): value is RequestSummaryData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Partial<RequestSummaryData>;
  return (data.publication_language === "es" || data.publication_language === "en")
    && typeof data.folio === "string"
    && typeof data.status_label === "string"
    && typeof data.service === "string"
    && typeof data.checkin_date === "string"
    && typeof data.checkout_date === "string"
    && typeof data.last_updated_at === "string"
    && Number.isInteger(data.adults)
    && Number.isInteger(data.children)
    && Number.isInteger(data.infants)
    && Boolean(data.beneficiary?.name && data.beneficiary?.phone && data.beneficiary?.email);
}

async function publicSummary(token: string): Promise<RequestSummaryData | null> {
  const tokenHash = await sha256Hex(token);
  const result = await rpc("resolve_public_information_request", { p_token_hash: tokenHash });
  return validSummary(result) ? result : null;
}

async function authenticatedStaffId(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization },
  });
  if (!response.ok) return null;
  const user = await response.json() as { id?: string };
  return user.id && UUID_PATTERN.test(user.id) ? user.id : null;
}

async function hasActiveManagementProfile(userId: string): Promise<boolean> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const query = new URL(`${supabaseUrl}/rest/v1/admin_profiles`);
  query.searchParams.set("user_id", `eq.${userId}`);
  query.searchParams.set("active", "eq.true");
  query.searchParams.set("select", "user_id");
  query.searchParams.set("limit", "1");
  const response = await fetch(query, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) return false;
  const rows = await response.json() as unknown[];
  return rows.length === 1;
}

async function staffSummary(request: Request, requestId: string, language: "es" | "en"): Promise<RequestSummaryData | null> {
  const userId = await authenticatedStaffId(request);
  if (!userId || !await hasActiveManagementProfile(userId)) return null;
  const result = await rpc("build_information_request_customer_projection", {
    p_request_id: requestId,
    p_language: language,
  });
  return validSummary(result) ? result : null;
}

function loadLogoAssets(): Promise<{ cebolletasLogo: Uint8Array; copalLogo: Uint8Array }> {
  logoAssetsPromise ??= Promise.all([
    Deno.readFile(new URL("./assets/cebolletas.png", import.meta.url)),
    Deno.readFile(new URL("./assets/copal.png", import.meta.url)),
  ]).then(([cebolletasLogo, copalLogo]) => ({ cebolletasLogo, copalLogo }));
  return logoAssetsPromise;
}

async function pdfResponse(request: Request, summary: RequestSummaryData): Promise<Response> {
  const bytes = await generateRequestSummaryPdf(summary, await loadLogoAssets());
  const filename = requestSummaryFilename(summary).replace(/[^A-Za-z0-9_.-]/g, "_");
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "referrer-policy": "no-referrer",
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (request.method !== "POST") return unavailableResponse(request);

  const startedAt = performance.now();
  const body = await readBody(request);
  if (!body) {
    await delay(Math.max(0, 140 - (performance.now() - startedAt)));
    return unavailableResponse(request);
  }

  try {
    const format = body.format === "pdf" ? "pdf" : "json";
    const token = typeof body.token === "string" ? body.token : "";
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const requestedLanguage = body.language === "en" ? "en" : "es";
    let summary: RequestSummaryData | null = null;

    if (token) {
      if (!TOKEN_PATTERN.test(token) || await isRateLimited(request, `public-${format}`, format === "pdf" ? 12 : 60)) {
        await delay(Math.max(0, 140 - (performance.now() - startedAt)));
        return unavailableResponse(request);
      }
      summary = await publicSummary(token);
    } else if (format === "pdf" && UUID_PATTERN.test(requestId)) {
      if (await isRateLimited(request, "staff-pdf", 30)) return unavailableResponse(request);
      summary = await staffSummary(request, requestId, requestedLanguage);
    }

    if (!summary) {
      await delay(Math.max(0, 140 - (performance.now() - startedAt)));
      return unavailableResponse(request);
    }

    if (format === "pdf") return await pdfResponse(request, summary);
    return jsonResponse(request, 200, { request: summary });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Request summary failed");
    await delay(Math.max(0, 140 - (performance.now() - startedAt)));
    return unavailableResponse(request);
  }
});
