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


test("Matrix crypto initialization reports a sanitized failing stage", () => {
  const source = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(source, /initializing Matrix Rust\/WASM encryption and IndexedDB/);
  assert.match(source, /safeInitializationError/);
  assert.match(source, /access_token\|refresh_token\|password\|authorization/);
  assert.match(source, /Device encryption remains disabled; no message was sent/);
});


test("secure chats preserve a distinct plaintext conversation and use explicit invitations", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const backend = read("../django-paas-deployer/src/messenger/api/matrix.py");

  assert.ok(panel.includes('phase === "invited"'));
  assert.ok(panel.includes("Accept secure invitation"));
  assert.ok(panel.includes("waiting_for_peer"));
  assert.ok(panel.includes("Your existing standard conversation and its history will remain unchanged."));
  assert.ok(panel.includes("participants_pending"));
  assert.ok(panel.includes('client.on("RoomMember.membership", onMembership)'));
  assert.ok(!panel.includes("await client.joinRoom(roomId)"));
  assert.ok(client.includes('content: { history_visibility: "invited" }'));
  assert.ok(client.includes("export function hasSecureMatrixInitialSync"));
  assert.ok(client.includes("recovery is strongly recommended but not a prerequisite"));
  assert.ok(backend.includes("security_mode=Conversation.SecurityMode.MATRIX_E2EE"));
  assert.ok(backend.includes("matrix_room_id=room_id"));
});

test("first-time and offline peers do not turn recovery setup into a crypto-init requirement", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.ok(client.includes("The browser could not lock the local Matrix encryption store"));
  assert.ok(client.includes('const preparedSyncClients = new WeakSet()'));
  assert.ok(client.includes("export async function assertSecureMessagingReady"));
  assert.ok(!client.includes("Set up and verify an encrypted key backup before starting a secure chat."));
  assert.ok(panel.includes("They can do that when they come online."));
  assert.ok(panel.includes("Set up recovery"));
  assert.ok(!panel.includes('phase === "recovery_required"'));
});
