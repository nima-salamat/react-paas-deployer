import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exportedFunctionNames(source) {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)]
    .map((match) => match[1]);
}

test("Agent API wrapper exposes every lifecycle and credential operation", () => {
  const source = read("src/components/agents/agentApi.js");
  const expected = {
    listAgents: "GET",
    getAgent: "GET",
    createAgent: "POST",
    updateAgent: "PATCH",
    deleteAgent: "DELETE",
    listScopes: "GET",
    listCredentials: "GET",
    issueCredential: "POST",
    rotateCredentials: "POST",
    revokeCredential: "POST",
    deleteCredential: "DELETE",
    setAgentStatus: "POST",
    listAudit: "GET",
    generateManifest: "POST",
  };

  for (const name of Object.keys(expected)) {
    assert.ok(
      exportedFunctionNames(source).includes(name),
      "Missing Agent API function: " + name,
    );
  }

  for (const [name, method] of Object.entries(expected)) {
    const start = source.indexOf("function " + name);
    const end = source.indexOf("\nexport ", start + 8);
    const block = source.slice(start, end > start ? end : source.length);
    assert.ok(
      new RegExp("method:\\s*[\"']" + method + "[\"']").test(block),
      name + " must use " + method,
    );
    assert.match(block, /url:\s*[A-Z0-9_]+_API|url:\s*AGENTS_API/);
  }
});

test("Session API wrapper covers self and admin session operations with safe identifiers", () => {
  const source = read("src/components/security/sessionApi.js");
  for (const name of [
    "fetchMySessions",
    "revokeMySession",
    "logoutAllMySessions",
    "fetchMyDevices",
    "adminUserSessionsUrl",
    "fetchAdminUserSessions",
    "revokeAdminUserSession",
    "logoutAllAdminUserSessions",
  ]) {
    assert.ok(
      exportedFunctionNames(source).includes(name),
      "Missing session API function: " + name,
    );
  }

  assert.match(source, /encodeURIComponent\(String\(sessionId\)\)/);
  assert.match(source, /encodeURIComponent\(String\(userId\)\)/);
  assert.match(source, /logout-all/);
  assert.match(source, /method:\s*"DELETE"/);
  assert.match(source, /method:\s*"POST"/);
});

test("ticket and service-share API modules have explicit backend contracts", () => {
  const tickets = read("src/components/tickets/api.js");
  const shares = read("src/components/service/services/shareApi.js");

  assert.match(tickets, /TICKETS_API = .*\/api\/tickets/);
  assert.match(tickets, /EMAILS_API = .*\/api\/emails/);
  assert.match(tickets, /function unwrapList/);
  assert.match(tickets, /function unwrapData/);

  for (const endpoint of [
    "/services/unified/",
    "/services/shared/",
    "/services/share/",
    "/services/shares/",
    "/permissions/",
    "/events/",
  ]) {
    assert.ok(shares.includes(endpoint), "Missing share endpoint contract: " + endpoint);
  }

  for (const method of ["POST", "PATCH", "DELETE"]) {
    assert.ok(shares.includes('method: "' + method + '"'), "Missing share method: " + method);
  }

  assert.match(shares, /Accept:\s*"application\/json"/);
  assert.match(shares, /Content-Type":\s*"application\/json"/);
  assert.match(shares, /data\.result === "error"/);
});
