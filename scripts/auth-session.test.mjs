import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  clearStoredAuth,
  decodeJwtPayload,
  getSessionBoundAccessToken,
  isAuthRoute,
  isSessionBoundToken,
} from "../src/components/customHooks/authSession.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function encodeSegment(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fakeJwt(payload) {
  return `eyJhbGciOiJIUzI1NiJ9.${encodeSegment(payload)}.signature`;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("session-bound token helper requires sid", () => {
  assert.equal(
    isSessionBoundToken(fakeJwt({ user_id: 1, sid: "session-123" })),
    true,
  );
  assert.equal(
    isSessionBoundToken(fakeJwt({ user_id: 1 })),
    false,
  );
  assert.equal(isSessionBoundToken("not-a-jwt"), false);
  assert.equal(decodeJwtPayload("not-a-jwt"), null);
});

test("session-bound helper preserves JWT payload semantics", () => {
  const token = fakeJwt({ user_id: 17, sid: "abc", exp: 123 });
  assert.deepEqual(decodeJwtPayload(token), {
    user_id: 17,
    sid: "abc",
    exp: 123,
  });
});


test("stored access helper clears and rejects a sessionless token", () => {
  const values = new Map([
    ["access", fakeJwt({ user_id: 1 })],
    ["refresh", "legacy-refresh"],
  ]);
  const storage = {
    getItem(key) {
      return values.get(key) || null;
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  assert.equal(getSessionBoundAccessToken(storage), null);
  assert.equal(values.has("access"), false);
  assert.equal(values.has("refresh"), false);
});

test("logout storage helper clears both credentials", () => {
  const values = new Map([
    ["access", "old-access"],
    ["refresh", "old-refresh"],
    ["other", "preserve"],
  ]);
  const storage = {
    removeItem(key) {
      values.delete(key);
    },
  };

  clearStoredAuth(storage);

  assert.equal(values.has("access"), false);
  assert.equal(values.has("refresh"), false);
  assert.equal(values.get("other"), "preserve");
});

test("authentication route detection avoids redirect loops", () => {
  assert.equal(isAuthRoute("/signin_or_signup"), true);
  assert.equal(isAuthRoute("/signup"), true);
  assert.equal(isAuthRoute("/login/reset"), true);
  assert.equal(isAuthRoute("/dashboard/services"), false);
});

test("api request layer rejects sessionless credentials before network I/O", () => {
  const source = read("src/components/customHooks/apiRequest.jsx");
  assert.match(source, /isSessionBoundToken\(accessToken\)/);
  assert.match(source, /clearAuthAndRedirect\(\);/);
  assert.match(source, /clearStoredAuth\(localStorage\);/);
});

test("sign-in bootstrap clears sessionless stored credentials", () => {
  const source = read("src/components/signin_or_signup/signin_or_signup.jsx");
  assert.match(source, /isSessionBoundToken\(token\)/);
  assert.match(source, /clearAuthAndRedirect\(\);/);
});

test("messenger direct media auth rejects sessionless credentials", () => {
  const source = read("src/components/messenger/api.js");
  assert.match(source, /isSessionBoundToken\(token\)/);
  assert.match(source, /clearAuthAndRedirect\(\);/);
});

test("all browser websocket entry points enforce session-bound credentials", () => {
  const files = [
    "src/components/messenger/hooks/useMessengerWebSocket.js",
    "src/components/service_detail/hooks/useServiceLogs.js",
    "src/components/service_detail/hooks/useDeployLogs.js",
    "src/components/service_detail/components/ShellPanel.jsx",
    "src/components/tickets/TicketNotifyContext.jsx",
    "src/components/admin/hooks/useTicketWebSocket.js",
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /isSessionBoundToken/);
  }
});

test("browser websocket clients emit heartbeat pings where server revalidation is required", () => {
  const files = [
    "src/components/messenger/hooks/useMessengerWebSocket.js",
    "src/components/service_detail/hooks/useServiceLogs.js",
    "src/components/service_detail/hooks/useDeployLogs.js",
    "src/components/service_detail/components/ShellPanel.jsx",
    "src/components/tickets/TicketNotifyContext.jsx",
    "src/components/admin/hooks/useTicketWebSocket.js",
  ];

  for (const file of files) {
    const source = read(file);
    assert.match(source, /type:\s*["']ping["']/);
  }
});

test("shared session manager keeps the 2-hour policy contract visible to UI", () => {
  const source = read("src/components/security/SessionManager.jsx");
  assert.match(source, /minimum_age_seconds/);
  assert.match(source, /can_revoke_others/);
  assert.match(source, /session_too_new_for_management/);
});

test("shared session API exposes self and admin session operations", () => {
  const source = read("src/components/security/sessionApi.js");
  for (const symbol of [
    "fetchMySessions",
    "revokeMySession",
    "logoutAllMySessions",
    "fetchAdminUserSessions",
    "revokeAdminUserSession",
    "logoutAllAdminUserSessions",
  ]) {
    assert.match(source, new RegExp(`export (?:async )?function ${symbol}`));
  }
});

test("source uses session-bound helper: app login state", () => {
  const source = read("src/App.jsx");
  for (const pattern of ["getSessionBoundAccessToken"]) assert.match(source, new RegExp(pattern));
});

test("source uses session-bound helper: floating navigation auth state", () => {
  const source = read("src/components/layout/FloatingNav.jsx");
  for (const pattern of ["getSessionBoundAccessToken"]) assert.match(source, new RegExp(pattern));
});

test("source uses session-bound helper: profile provider auth state", () => {
  const source = read("src/components/profile/profileContext.jsx");
  for (const pattern of ["getSessionBoundAccessToken"]) assert.match(source, new RegExp(pattern));
});

test("source uses session-bound helper: messenger local identity", () => {
  const source = read("src/components/messenger/messengerUtils.js");
  for (const pattern of ["getSessionBoundAccessToken"]) assert.match(source, new RegExp(pattern));
});

test("source uses session-bound helper: ticket notification identity", () => {
  const source = read("src/components/tickets/TicketNotifyContext.jsx");
  for (const pattern of ["getSessionBoundAccessToken"]) assert.match(source, new RegExp(pattern));
});
