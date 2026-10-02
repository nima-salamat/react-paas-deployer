import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("agent manifest API consumes generated markdown without forcing a browser download", () => {
  const api = read("src/components/agents/agentApi.js");

  assert.match(api, /generateManifest/);
  assert.match(api, /method: "POST"/);
  assert.match(api, /responseType: "text"/);
  assert.match(api, /content: String\(res\?\.data \|\| ""\)/);
  assert.match(api, /filename: match\?\.\[1\] \|\| "AGENT-" \+ id \+ "\.md"/);
});

test("agent detail exposes manifest content for review, copy and download", () => {
  const source = read("src/components/agents/AgentDetail.jsx");

  assert.match(source, /generateManifest\(id\)/);
  assert.match(source, /setManifestDialog\(/);
  assert.match(source, /const copyManifest = async/);
  assert.match(source, /navigator\.clipboard\.writeText\(manifestDialog\.content\)/);
  assert.match(source, /\{manifestCopied \? "Copied" : "Copy"\}/);
  assert.match(source, /downloadManifest\(manifestDialog\.content/);
  assert.match(source, /This generated file contains a short-lived, single-use enrollment token/);
  assert.doesNotMatch(source, /await downloadManifest\(id\)/);
});

test("agent API exposes permanent deletion", () => {
  const api = read("src/components/agents/agentApi.js");

  assert.match(api, /export async function deleteAgent\(id\)/);
  assert.match(api, /method: "DELETE"/);
  assert.match(api, /AGENTS_API \+ "\/" \+ id \+ "\/"/);
});

test("agent list uses five-item oldest-first pagination", () => {
  const source = read("src/components/agents/Agents.jsx");
  const api = read("src/components/agents/agentApi.js");

  assert.match(source, /Pagination/);
  assert.match(source, /Math\.ceil\(agentCount \/ 5\)/);
  assert.match(source, /page_size: 5/);
  assert.match(api, /params: \{ page_size: 5, \.\.\.params \}/);
  assert.match(source, /onClick=\{\(\) => refresh\(agentPage\)\}/);
});

test("agent detail uses ten-item pagination for credentials and audit", () => {
  const source = read("src/components/agents/AgentDetail.jsx");
  const api = read("src/components/agents/agentApi.js");

  assert.match(source, /credentialsPage/);
  assert.match(source, /auditPage/);
  assert.match(source, /Math\.ceil\(credentialsCount \/ 10\)/);
  assert.match(source, /Math\.ceil\(auditCount \/ 10\)/);
  assert.match(source, /listCredentials\(id, \{ page: credentialsPage, page_size: 10 \}\)/);
  assert.match(source, /listAudit\(id, \{ page: auditPage, page_size: 10 \}\)/);
  assert.match(api, /params: \{ page_size: 10, \.\.\.params \}/);
});

test("agent credentials expose permanent delete action in the API client", () => {
  const api = read("src/components/agents/agentApi.js");

  assert.match(api, /export async function deleteCredential\(agentId, credentialId\)/);
  assert.match(api, /method: "DELETE"/);
  assert.match(api, /AGENTS_API \+ "\/" \+ agentId \+ "\/credentials" \+ "\/" \+ credentialId \+ "\/"/);
});

test("agent detail exposes credential deletion and provisioning source", () => {
  const source = read("src/components/agents/AgentDetail.jsx");

  assert.match(source, /deleteCredential/);
  assert.match(source, /Delete this credential permanently/);
  assert.match(source, /Provisioned via/);
  assert.match(source, /Request \{event\.request_id/);
  assert.match(source, /credential\.issued_via/);
});

test("agent list exposes provisioning source", () => {
  const source = read("src/components/agents/Agents.jsx");

  assert.match(source, /Provisioned via/);
  assert.match(source, /provisioningLabel/);
});

test("agent list uses a styled dialog for permanent Agent deletion", () => {
  const source = read("src/components/agents/Agents.jsx");

  assert.match(source, /setDeleteTarget/);
  assert.match(source, /open=\{Boolean\(deleteTarget\)\}/);
  assert.match(source, /Delete permanently/);
  assert.match(source, /all credentials, enrollment tokens and idempotency records/);
  assert.doesNotMatch(source, /window\.confirm\(\s*["']Delete Agent/);
});

test("agent detail uses styled dialogs for Agent and credential deletion", () => {
  const source = read("src/components/agents/AgentDetail.jsx");

  assert.match(source, /deleteAgent\(id\)/);
  assert.match(source, /deleteCredential\(id, target\.credential\.id\)/);
  assert.match(source, /open=\{Boolean\(deleteTarget\)\}/);
  assert.match(source, /Delete credential/);
  assert.match(source, /Delete permanently/);
  assert.match(source, /A revoked Agent can still be deleted/);
  assert.doesNotMatch(source, /window\.confirm\(\s*["']Delete this credential/);
  assert.doesNotMatch(source, /window\.confirm\(\s*["']Delete Agent/);
});

test("agent create dialog provides All and Reset scope presets", () => {
  const source = read("src/components/agents/Agents.jsx");

  assert.match(source, />All<\/Button>/);
  assert.match(source, />Reset<\/Button>/);
  assert.match(source, /scopes: \(scopeCatalog\.scopes \|\| \[\]\)\.map\(\(scope\) => scope\.name\)/);
  assert.match(source, /scopes: \[\.\.\.\(scopeCatalog\.defaults \|\| \[\]\)\]/);
});
