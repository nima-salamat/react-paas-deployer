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
  assert.match(source, /getSessionBoundAccessToken\(localStorage\)/);
  assert.match(source, /clearAuthAndRedirect\(\);/);
  assert.match(source, /invalidateSessionlessAuth\(localStorage\)/);
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

test("authenticated navbar renders only imported logout icon symbols", () => {
  const source = read("src/components/layout/Navbar.jsx");
  assert.match(source, /import LogoutOutlinedIcon from "@mui\/icons-material\/LogoutOutlined";/);
  assert.match(source, /<LogoutOutlinedIcon \/>/);
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

test("browser websocket clients can recover a 4401 through refresh", () => {
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
    assert.match(source, /refreshAccessToken/);
    if (file !== "src/components/tickets/TicketNotifyContext.jsx") {
      assert.match(source, /4401/);
    }
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

test("home and dashboard account triggers share the same account menu", () => {
  const navbar = read("src/components/layout/Navbar.jsx");
  const dashboardNavbar = read("src/components/dashboard/DashboardNavbar.jsx");
  const accountMenu = read("src/components/layout/AccountMenu.jsx");

  assert.match(navbar, /import AccountMenu from "\.\/AccountMenu\.jsx"/);
  assert.match(dashboardNavbar, /import AccountMenu from "\.\.\/layout\/AccountMenu\.jsx"/);
  assert.match(navbar, /<AccountMenu[\s\S]*profilePath="\/profile"/);
  assert.match(dashboardNavbar, /<AccountMenu[\s\S]*profilePath="\/dashboard\/profile"/);
  assert.match(accountMenu, /Profile/);
  assert.match(accountMenu, /Sign out/);
  assert.match(accountMenu, /Confirm logout/);
});


test("browser login payload includes persistent device metadata", () => {
  const identity = read("src/components/security/deviceIdentity.js");
  const signin = read("src/components/signin_or_signup/signin_or_signup.jsx");
  assert.match(identity, /paas_device_id/);
  assert.match(identity, /getDeviceAuthPayload/);
  assert.match(identity, /client_signature/);
  assert.match(identity, /client_metadata/);
  assert.ok(signin.includes("await getPayload()"));
  assert.match(signin, /getDeviceAuthPayload/);
});


test("session UIs render rich device details instead of unavailable placeholders", () => {
  const sessionUi = read("src/components/security/SessionManager.jsx");
  const adminUi = read("src/components/admin/components/AdminUserSessionsDialog.jsx");

  for (const source of [sessionUi, adminUi]) {
    assert.match(source, /browser/);
    assert.match(source, /browser_version/);
    assert.match(source, /device_model/);
    assert.match(source, /device_type/);
    assert.match(source, /last_ip/);
    assert.doesNotMatch(source, /Device details unavailable/);
  }
});


test("session activity heartbeat is visible-aware and server-timestamp driven", () => {
  const source = read("src/components/security/SessionActivityHeartbeat.jsx");
  const sessionUi = read("src/components/security/SessionManager.jsx");

  for (const marker of [
    "visibilityState",
    "/auth/api/sessions/activity/",
    "HEARTBEAT_MS = 30_000",
    "session-activity",
    "auth-changed",
  ]) {
    assert.ok(source.includes(marker), `Missing heartbeat contract marker: ${marker}`);
  }

  for (const marker of [
    "serverClockOffset",
    "server_now",
    "session-activity",
  ]) {
    assert.ok(sessionUi.includes(marker), `Missing session UI contract marker: ${marker}`);
  }
});

test("messenger read tracking flushes before chat switches and serializes list refreshes", () => {
  const messenger = read("src/components/messenger/MessengerApp.jsx");

  assert.match(messenger, /flushSeenReceiptsRef/);
  assert.match(
    messenger,
    /Flush viewport reads before switching chats[sS]*flushSeenReceiptsRef.current(leavingId)/,
  );
  assert.match(messenger, /conversationRefreshSeqRef/);
  assert.match(messenger, /serverReadAtRef/);
  assert.match(messenger, /last_read_at/);
  assert.match(
    messenger,
    /Only the newest silent response is allowed to mutate the list state/,
  );
});

test("messenger confirmed uploads cannot disappear with the transient upload row", () => {
  const messenger = read("src/components/messenger/MessengerApp.jsx");

  assert.match(messenger, /upsertConfirmedMessage/);
  assert.match(messenger, /confirmedMessageId: created.id/);
  assert.match(
    messenger,
    /Remove the transient upload row only after that confirmed message is actually present/,
  );
});

test("recorded video messages do not perform a redundant second encoding pass", () => {
  const composer = read("src/components/messenger/components/MessageComposer.jsx");
  const start = composer.indexOf(`const filename = mode === "video"`);
  const end = composer.indexOf("    mediaRecorderRef.current = mr;", start);

  assert.ok(start >= 0 && end > start);
  const recordingFinalizeBlock = composer.slice(start, end);
  assert.doesNotMatch(recordingFinalizeBlock, /_messengerProcessing/);
  assert.doesNotMatch(recordingFinalizeBlock, /cropVideoMessageToSquare(blob)/);
  assert.match(recordingFinalizeBlock, /flushSync(() => setFiles/);
});
