import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manage = read("../manage/manage.js");
const migration = read("../supabase/migrations/20260902_v10_6_1_management_authorization_hardening.sql");

assert.match(manage, /function canEditManagement\(\)/);
assert.match(manage, /managementProfile\?\.active && managementProfile\.role === "admin"/);
assert.match(manage, /const mutationDisabled = editable \? "" :/);
assert.match(manage, /function requestStatusActions\(request\) \{\s+if \(!canEditManagement\(\)\) return "";/);
assert.match(manage, /recipientForm\.addEventListener\("submit", async \(event\) => \{\s+event\.preventDefault\(\);\s+if \(!canEditManagement\(\)\) return;/);
assert.match(manage, /serviceForm\.addEventListener\("submit", async \(event\) => \{\s+event\.preventDefault\(\);\s+if \(!canEditManagement\(\)\) return;/);
assert.match(manage, /if \(!button \|\| !canEditManagement\(\)\) return;/);

for (const functionName of [
  "create_whatsapp_recipient",
  "set_default_whatsapp_recipient",
  "update_whatsapp_recipient",
  "delete_whatsapp_recipient",
  "create_service",
  "create_service_version",
  "set_service_active",
  "delete_service",
  "set_current_service_version",
  "change_information_request_status",
  "save_primary_rate_plan",
  "save_service_with_primary_rate_plan",
  "save_service_with_primary_rate_plan_v2",
]) {
  assert.match(migration, new RegExp(`'${functionName}'`));
}

assert.match(migration, /public\.is_active_admin_writer\(\)/);
assert.match(migration, /drop function %I\.%I\(%s\)/);
assert.match(migration, /perform p_legacy_compat;/);

console.log("management authorization static tests passed");
