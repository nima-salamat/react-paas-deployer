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
