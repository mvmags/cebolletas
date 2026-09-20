type JsonObject = Record<string, unknown>;

const ALLOWED_ORIGINS = new Set([
  "https://cebolletas.mx",
  "https://www.cebolletas.mx",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LANGUAGE_PATTERN = /^(es|en)$/;
const KEY_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;
const TOKEN_BYTES = 32;

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

function response(request: Request, status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store, max-age=0",
      pragma: "no-cache",
      expires: "0",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
      "referrer-policy": "no-referrer",
    },
  });
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function activeKeyVersion(): string {
  const version = requiredEnv("PRIVATE_LINK_ENCRYPTION_KEY_VERSION");
  if (!KEY_VERSION_PATTERN.test(version)) throw new Error("Invalid encryption key version");
  return version;
}

function keyMaterial(version: string): Uint8Array {
  const keyringText = Deno.env.get("PRIVATE_LINK_ENCRYPTION_KEYS")?.trim();
  let encoded = "";
  if (keyringText) {
    const keyring = JSON.parse(keyringText) as Record<string, unknown>;
    encoded = typeof keyring[version] === "string" ? String(keyring[version]) : "";
  }
  if (!encoded && version === activeKeyVersion()) {
    encoded = requiredEnv("PRIVATE_LINK_ENCRYPTION_KEY");
  }
  if (!encoded) throw new Error("Encryption key version is unavailable");
  const bytes = decodeBase64(encoded);
  if (bytes.byteLength !== 32) throw new Error("Private-link encryption keys must contain 32 bytes");
  return bytes;
}

async function aesKey(version: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", arrayBuffer(keyMaterial(version)), "AES-GCM", false, ["encrypt", "decrypt"]);
}

function additionalData(accessId: string, requestId: string, version: string): ArrayBuffer {
  return new TextEncoder().encode(`cebolletas-private-access:${accessId}:${requestId}:${version}`).buffer;
}

async function encryptToken(token: string, accessId: string, requestId: string, version: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv,
    additionalData: additionalData(accessId, requestId, version),
    tagLength: 128,
  }, await aesKey(version), new TextEncoder().encode(token));
  return { ciphertext: base64Url(new Uint8Array(ciphertext)), iv: base64Url(iv) };
}

async function decryptToken(row: AccessRow): Promise<string> {
  const plaintext = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv: arrayBuffer(decodeBase64(row.token_iv!)),
    additionalData: additionalData(row.id, row.information_request_id, row.encryption_key_version!),
    tagLength: 128,
  }, await aesKey(row.encryption_key_version!), arrayBuffer(decodeBase64(row.token_ciphertext!)));
  return new TextDecoder().decode(plaintext);
}

async function readBody(request: Request): Promise<JsonObject | null> {
  if (Number(request.headers.get("content-length") || 0) > 4096) return null;
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as JsonObject : null;
  } catch {
    return null;
  }
}

interface StaffProfile { userId: string; role: "admin" | "viewer" }

async function authenticatedStaff(request: Request): Promise<StaffProfile | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization },
  });
  if (!userResponse.ok) return null;
  const user = await userResponse.json() as { id?: string };
  if (!user.id || !UUID_PATTERN.test(user.id)) return null;

  const query = new URL(`${supabaseUrl}/rest/v1/admin_profiles`);
  query.searchParams.set("user_id", `eq.${user.id}`);
  query.searchParams.set("active", "eq.true");
  query.searchParams.set("select", "role");
  query.searchParams.set("limit", "1");
  const profileResponse = await fetch(query, {
    headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json() as Array<{ role?: string }>;
  const role = profiles[0]?.role;
  return role === "admin" || role === "viewer" ? { userId: user.id, role } : null;
}

interface RequestRow { id: string; status: string; closed_at: string | null }
interface AccessRow {
  id: string;
  information_request_id: string;
  language: "es" | "en";
  created_at: string;
  revoked_at: string | null;
  token_ciphertext: string | null;
  token_iv: string | null;
  encryption_key_version: string | null;
}

async function serviceRows<T>(path: string): Promise<T[]> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const result = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      "cache-control": "no-store",
    },
  });
  if (!result.ok) throw new Error("Database read failed");
  return await result.json() as T[];
}

function requestEligible(request: RequestRow): boolean {
  if (request.status === "new" || request.status === "booked") return true;
  if (request.status !== "closed" || !request.closed_at) return false;
  return Date.now() <= new Date(request.closed_at).getTime() + 7 * 24 * 60 * 60 * 1000;
}

function inactiveReason(request: RequestRow, access: AccessRow): string | null {
  if (access.revoked_at) return "revoked";
  if (request.status === "cancelled" || request.status === "not_converted") return request.status;
  if (request.status === "closed" && !requestEligible(request)) return "expired";
  return requestEligible(request) ? null : "terminal";
}

function privateUrl(token: string): string {
  const configured = Deno.env.get("PRIVATE_REQUEST_BASE_URL")?.trim();
  const url = new URL(configured || "https://cebolletas.mx/copal/solicitud/");
  url.hash = `access=${encodeURIComponent(token)}`;
  return url.href;
}

async function listAccess(requestId: string): Promise<JsonObject> {
  const requestRows = await serviceRows<RequestRow>(
    `information_requests?id=eq.${encodeURIComponent(requestId)}&select=id,status,closed_at&limit=1`,
  );
  const request = requestRows[0];
  if (!request) throw new Error("Request unavailable");
  const rows = await serviceRows<AccessRow>(
    `information_request_access?information_request_id=eq.${encodeURIComponent(requestId)}` +
      "&select=id,information_request_id,language,created_at,revoked_at,token_ciphertext,token_iv,encryption_key_version" +
      "&order=created_at.desc",
  );
  const eligible = requestEligible(request);
  const records: JsonObject[] = [];
  for (const row of rows) {
    const encrypted = Boolean(row.token_ciphertext && row.token_iv && row.encryption_key_version);
    const active = !row.revoked_at && eligible;
    let url: string | null = null;
    let recoveryError: string | null = null;
    // Only the currently valid link is ever revealed. Historical envelopes stay
    // encrypted for audit/key-rotation purposes and are never returned as URLs.
    if (encrypted && active) {
      try {
        url = privateUrl(await decryptToken(row));
      } catch {
        recoveryError = "key_unavailable";
      }
    }
    records.push({
      id: row.id,
      language: row.language,
      created_at: row.created_at,
      revoked_at: row.revoked_at,
      active,
      recoverable: encrypted,
      url,
      can_copy: active && Boolean(url),
      inactive_reason: active ? null : inactiveReason(request, row),
      recovery_error: recoveryError,
      legacy: !encrypted,
    });
  }
  return {
    request_status: request.status,
    can_regenerate: eligible,
    records,
  };
}

async function regenerate(request: Request, requestId: string, language: "es" | "en"): Promise<JsonObject> {
  const authorization = request.headers.get("authorization") || "";
  const accessId = crypto.randomUUID();
  const token = base64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
  const version = activeKeyVersion();
  const encrypted = await encryptToken(token, accessId, requestId, version);
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/publish_recoverable_information_request_access`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify({
      p_access_id: accessId,
      p_request_id: requestId,
      p_token_hash: await sha256Hex(token),
      p_token_ciphertext: encrypted.ciphertext,
      p_token_iv: encrypted.iv,
      p_encryption_key_version: version,
      p_language: language,
    }),
  });
  if (!rpcResponse.ok) throw new Error("Private access regeneration failed");
  return await listAccess(requestId);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return response(request, 404, { error: "unavailable" });
  try {
    const body = await readBody(request);
    if (!body) return response(request, 400, { error: "invalid_request" });
    const staff = await authenticatedStaff(request);
    if (!staff) return response(request, 401, { error: "unauthorized" });
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    if (!UUID_PATTERN.test(requestId)) return response(request, 400, { error: "invalid_request" });
    if (body.action === "list") {
      return response(request, 200, await listAccess(requestId));
    }
    if (body.action === "regenerate") {
      if (staff.role !== "admin") return response(request, 403, { error: "writer_required" });
      const language = typeof body.language === "string" ? body.language : "";
      if (!LANGUAGE_PATTERN.test(language)) return response(request, 400, { error: "invalid_request" });
      return response(request, 200, await regenerate(request, requestId, language as "es" | "en"));
    }
    return response(request, 400, { error: "invalid_request" });
  } catch {
    console.error("Private access operation failed");
    return response(request, 500, { error: "unavailable" });
  }
});
