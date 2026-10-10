import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("encrypted conversations never render the plaintext Messenger timeline or composer", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(app, /const isMatrixE2EE = activeConv\?\.security_mode === "matrix_e2ee"/);
  assert.match(app, /\{isMatrixE2EE \? \(/);
  assert.match(app, /Encrypted chat is not ready/);
  assert.match(app, /No messages will be sent through the normal plaintext Messenger path/);
  assert.match(app, /<MessageTimeline/);
  assert.match(app, /<MessageComposer/);
});

test("encrypted conversations disable plaintext upload and call affordances", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(app, /onDragEnter=\{isMatrixE2EE \? undefined : onChatDragEnter\}/);
  assert.match(app, /onDragOver=\{isMatrixE2EE \? undefined : onChatDragOver\}/);
  assert.match(app, /onDrop=\{isMatrixE2EE \? undefined : onDropFilesToChat\}/);
  assert.match(app, /const visibleIncomingCall = incomingCallConversation\?\.security_mode === "matrix_e2ee"/);
  assert.match(app, /incomingCall=\{visibleIncomingCall\}/);
});

test("encrypted-room fallback explains missing Matrix device authentication and recovery", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(app, /Matrix device authentication,/);
  assert.match(app, /verification and key recovery are not configured/);
  assert.match(app, /To prevent an unsafe downgrade/);
});
