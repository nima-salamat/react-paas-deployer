import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Plans admin exposes the complete Resource Plan policy", () => {
  const panel = read("src/components/admin/panels/PlansPanel.jsx");

  for (const field of [
    "max_cpu",
    "max_ram",
    "max_storage",
    "price_per_hour",
    "storage_type",
    "log_retention_days",
    "log_storage_mb",
    "log_ingest_bytes_per_sec",
    "persistent_logging",
    "realtime_logging",
    "log_quota_behavior",
  ]) {
    assert.match(panel, new RegExp(field));
  }

  assert.match(panel, /PermissionGate anyOf=\{\["plans\.view", "plans\.manage"\]\}/);
  assert.match(panel, /hasAnyRule\("plans\.manage"\)/);
  assert.match(panel, /"inherit"/);
});

test("plans.manage is sufficient to reveal the admin Resource Plans navigation item", () => {
  const utils = read("src/components/admin/adminUtils.js");

  // The shared permission map must expose the tab for either read or manage
  // capability; canSeeNav applies the same array-based rule to every area.
  assert.match(utils, /plans: \["plans\\.view", "plans\\.manage"\]/);
  assert.match(utils, /if \(Array\.isArray\(rule\)\) return rule\.some/);
});
