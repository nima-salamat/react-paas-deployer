import assert from "node:assert/strict";
import testFn from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

testFn("Ready App wizard imports every MUI component it renders", () => {
  const source = read("src/components/ready_apps/ReadyAppWizard.jsx");

  assert.match(source, /import \{[\s\S]*IconButton[\s\S]*\} from "@mui\/material";/);
  assert.match(source, /<IconButton\b/);
});

testFn("Ready App detail has no undeclared IconButton reference", () => {
  const source = read("src/components/ready_apps/ReadyAppDetail.jsx");

  assert.doesNotMatch(source, /<IconButton\b/);
});
