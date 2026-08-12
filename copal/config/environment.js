const DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const isDevelopment = DEVELOPMENT_HOSTS.has(window.location.hostname);
const modulePath = isDevelopment ? "./development.js" : "./production.js";

let config;

try {
  ({ default: config } = await import(modulePath));
} catch (error) {
  if (isDevelopment) {
    throw new Error(
      "Missing copal/config/development.js. Copy development.example.js to development.js and add the development Supabase project URL and publishable key.",
      { cause: error }
    );
  }

  throw error;
}

if (
  !config?.supabaseUrl?.startsWith("https://") ||
  !config?.supabasePublishableKey ||
  config.supabaseUrl.includes("YOUR_") ||
  config.supabasePublishableKey.includes("YOUR_")
) {
  throw new Error(`Invalid Supabase configuration for ${config?.environment || "unknown"}.`);
}

export default config;
