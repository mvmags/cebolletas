import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const copalDirectory = path.resolve(testDirectory, "..");
const [actions, script, styles, index] = await Promise.all([
  readFile(path.join(copalDirectory, "reserva-actions.js"), "utf8"),
  readFile(path.join(copalDirectory, "script.js"), "utf8"),
  readFile(path.join(copalDirectory, "styles.css"), "utf8"),
  readFile(path.join(copalDirectory, "index.html"), "utf8")
]);

assert.match(actions, /SERVICE_CATALOG_ATTEMPTS\s*=\s*2/);
assert.match(actions, /AbortController/);
assert.match(actions, /cache:\s*"no-store"/);
assert.match(actions, /Authorization:\s*`Bearer \$\{SUPABASE\.publishableKey\}`/);
assert.match(actions, /data-retry-services/);
assert.match(actions, /servicesLoadFailed/);
assert.match(styles, /\.service-retry-button/);
assert.match(script, /preserveBookingView/);
assert.match(script, /scrollToSection\("booking",\s*"auto"\)/);
assert.match(index, /script\.js\?v=10\.7\.2/);
assert.match(index, /reserva-actions\.js\?v=10\.7\.2/);
assert.match(index, /styles\.css\?v=10\.7\.2/);

console.log("Reserva service loading regression checks passed.");
