import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  decodeJwtPayload,
  isSessionBoundToken,
  clearStoredAuth,
  getSessionBoundAccessToken,
} from "../src/components/customHooks/authSession.js";
import {
  getDeviceId,
  collectClientMetadata,
  getDeviceAuthPayload,
} from "../src/components/security/deviceIdentity.js";
import {
  getApiErrorMessage,
  getApiErrorMeta,
  isServiceBusy,
  describeServiceStatus,
} from "../src/components/service_detail/errorUtils.js";
import {
  setSessionPermissions,
  clearSessionPermissions,
  getSessionPermissions,
  getSessionRules,
  hasAnyRule,
  hasRule,
  hasOneOfRules,
  isSessionStaff,
  isSessionSuperuser,
  canSeeNav,
  getAllPermissionCodes,
  getGroupedPermissions,
  canGrantRule,
  resolveThemeColor,
} from "../src/components/admin/adminUtils.js";
import {
  fetchUnifiedServices,
  fetchSharedServices,
  createShare,
  updateShare,
  unshare,
  fetchSharePermissions,
  fetchShareEvents,
} from "../src/components/service/services/shareApi.js";

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fakeJwt(payload) {
  return "eyJhbGciOiJIUzI1NiJ9." + encodeSegment(payload) + ".signature";
}

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("auth session helpers reject malformed and sessionless credentials", () => {
  assert.equal(decodeJwtPayload(""), null);
  assert.equal(decodeJwtPayload("one.two"), null);
  assert.equal(isSessionBoundToken(fakeJwt({ sid: "s-1" })), true);
  assert.equal(isSessionBoundToken(fakeJwt({ user_id: 1 })), false);

  const values = new Map([
    ["access", fakeJwt({ user_id: 1 })],
    ["refresh", "legacy"],
  ]);
  const storage = {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
  };

  assert.equal(getSessionBoundAccessToken(storage), null);
  assert.equal(values.has("access"), false);
  assert.equal(values.has("refresh"), false);

  values.set("access", fakeJwt({ sid: "valid" }));
  values.set("refresh", "refresh");
  clearStoredAuth(storage);
  assert.equal(values.size, 0);
});

test("device identity is stable and authentication metadata is bounded", async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };

  const first = getDeviceId(storage);
  const second = getDeviceId(storage);
  assert.equal(first, second);
  assert.ok(first.length > 0);
  assert.equal(values.size, 1);

  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let navigatorWasMocked = false;
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        language: "x".repeat(200),
        platform: "x".repeat(200),
        hardwareConcurrency: 16,
        maxTouchPoints: 2,
        userAgentData: {
          mobile: true,
          platform: "Browser",
          brands: [{ brand: "Test", version: "1" }],
        },
      },
    });
    navigatorWasMocked = true;
  } catch {
    // Some Node runtimes expose a non-configurable navigator; use the real one.
  }

  try {
    const metadata = collectClientMetadata();
    if (navigatorWasMocked) {
      assert.equal(metadata.locale.length, 64);
      assert.equal(metadata.platform_hint.length, 64);
      assert.equal(metadata.mobile, true);
    }

    const payload = await getDeviceAuthPayload(storage);
    assert.equal(payload.device_id, first);
    assert.equal(typeof payload.client_signature, "string");
    assert.equal(typeof payload.client_metadata, "object");
  } finally {
    if (navigatorWasMocked) {
      if (originalNavigatorDescriptor) {
        Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
      } else {
        delete globalThis.navigator;
      }
    }
  }
});

test("ticket API module keeps stable endpoint constants and payload unwrapping logic", () => {
  const source = read("src/components/tickets/api.js");
  assert.match(source, /TICKETS_API = .*\/api\/tickets/);
  assert.match(source, /EMAILS_API = .*\/api\/emails/);
  assert.match(source, /function unwrapList/);
  assert.match(source, /function unwrapData/);
  assert.match(source, /Array\.isArray\(body\)/);
  assert.match(source, /Array\.isArray\(body\.results\)/);
  assert.match(source, /"data" in body/);
});

test("service error normalization preserves backend detail and readable fallbacks", () => {
  const error = {
    response: {
      status: 409,
      data: {
        code: "deploy_not_ready",
        detail: "Deployment is not ready.",
      },
    },
  };
  assert.equal(getApiErrorMessage(error), "Deployment is not ready.");
  assert.deepEqual(getApiErrorMeta(error), {
    status: 409,
    code: "deploy_not_ready",
    message: "Deployment is not ready.",
    statusMessage: "This action conflicts with the service's current state.",
  });
  assert.equal(
    getApiErrorMessage({ response: { status: 403, data: {} } }),
    "You do not have permission to perform this action.",
  );
  assert.equal(isServiceBusy("deploying"), true);
  assert.equal(isServiceBusy("running"), false);
  assert.equal(describeServiceStatus("stopping"), "Stopping");
});

test("admin permission matrix separates anonymous, view, manage and superuser sessions", () => {
  clearSessionPermissions();
  assert.equal(isSessionStaff(), false);
  assert.equal(isSessionSuperuser(), false);
  assert.equal(canSeeNav("tickets"), false);

  setSessionPermissions({
    isStaff: true,
    rules: ["tickets.view", "plans.manage", "users.create"],
  });
  assert.equal(isSessionStaff(), true);
  assert.equal(hasAnyRule("tickets.view"), true);
  assert.equal(hasRule("tickets.view"), true);
  assert.equal(hasOneOfRules(["missing", "tickets.view"]), true);
  assert.equal(canSeeNav("tickets"), true);
  assert.equal(canSeeNav("plans"), true);
  assert.equal(canSeeNav("users"), true);
  assert.equal(canSeeNav("invites"), false);
  assert.equal(canGrantRule("tickets.view"), true);
  assert.equal(canGrantRule("users.manage"), false);

  const snapshot = getSessionPermissions();
  snapshot.rules.push("injected");
  assert.equal(getSessionRules().includes("injected"), false);

  setSessionPermissions({ isSuperuser: true, isStaff: true, rules: [] });
  for (const tab of [
    "overview", "tickets", "users", "services", "plans", "tables",
    "docs", "login", "invites", "codes", "emails", "profile",
  ]) {
    assert.equal(canSeeNav(tab), true, "superuser cannot see " + tab);
  }
  assert.equal(canGrantRule("anything.manage"), true);
});

test("permission catalog is internally complete and grouped deterministically", () => {
  const codes = getAllPermissionCodes();
  assert.ok(codes.length >= 20);

  for (const required of [
    "tickets.view",
    "users.manage",
    "services.view",
    "services.manage",
    "plans.view",
    "plans.manage",
    "tables.view",
    "docs.view",
    "docs.manage",
    "auth_sessions.view",
    "auth_sessions.manage",
  ]) {
    assert.ok(codes.includes(required), "missing permission code " + required);
  }

  const groups = getGroupedPermissions();
  assert.ok(groups.some((group) => group.group === "Users & access"));
  assert.ok(groups.some((group) => group.group === "Documentation"));
  assert.deepEqual(groups.flatMap((group) => group.codes), codes);
});

test("theme color resolver handles literals, palette paths and unknown paths", () => {
  const theme = {
    palette: {
      primary: { main: "#123456" },
      error: { main: "#ff0000" },
      text: { secondary: "#555555" },
    },
  };

  assert.equal(resolveThemeColor(theme, "#abcdef"), "#abcdef");
  assert.equal(resolveThemeColor(theme, "primary.main"), "#123456");
  assert.equal(resolveThemeColor(theme, "error"), "#ff0000");
  assert.equal(resolveThemeColor(theme, "missing.path"), "#123456");
  assert.equal(resolveThemeColor(theme, ""), "#123456");
});

test("service share API helpers cover success and backend-error contracts", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return jsonResponse({ mine: [], shared_with_me: [], shared_by_me: [] });
  };
  const unified = await fetchUnifiedServices("/api", { Authorization: "Bearer test" });
  assert.deepEqual(unified.mine, []);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test");

  globalThis.fetch = async () => jsonResponse({ shares: [{ id: "s1" }] });
  assert.deepEqual(await fetchSharedServices("/api", {}, "mine"), [{ id: "s1" }]);

  let lastOptions = null;
  globalThis.fetch = async (_url, options = {}) => {
    lastOptions = options;
    return jsonResponse({ share: { id: "s2" } });
  };
  assert.deepEqual(await createShare("/api", {}, { service_id: 1 }), { id: "s2" });
  assert.equal(JSON.parse(lastOptions.body).service_id, 1);
  assert.equal(lastOptions.method, "POST");

  globalThis.fetch = async (_url, options = {}) => {
    lastOptions = options;
    return jsonResponse({ share: { id: "s3" } });
  };
  assert.deepEqual(await updateShare("/api", {}, "s3", { label: "x" }), { id: "s3" });
  assert.equal(lastOptions.method, "PATCH");

  globalThis.fetch = async (_url, options = {}) => {
    lastOptions = options;
    return jsonResponse({ result: "ok" });
  };
  assert.deepEqual(await unshare("/api", {}, "s3"), { result: "ok" });
  assert.equal(lastOptions.method, "DELETE");

  globalThis.fetch = async () => jsonResponse({ permissions: [], is_owner: true, known_actions: [] });
  assert.deepEqual((await fetchSharePermissions("/api", {}, "s3")).is_owner, true);

  globalThis.fetch = async () => jsonResponse({ events: [{ id: 1 }] });
  assert.deepEqual(await fetchShareEvents("/api", {}, "s3"), [{ id: 1 }]);

  globalThis.fetch = async () => jsonResponse({ result: "error", detail: "Denied" }, false);
  await assert.rejects(() => fetchSharedServices("/api"), /Denied/);

  globalThis.fetch = async () => jsonResponse({ result: "error", detail: "Denied" }, true);
  await assert.rejects(() => unshare("/api", {}, "s3"), /Denied/);
});
