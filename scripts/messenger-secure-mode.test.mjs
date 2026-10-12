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
  assert.match(app, /<SecureChatPanel conversation=\{activeConv\} currentUserId=\{meId\} \/>/);
  const securePanel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(securePanel, /Secure room unavailable/);
  assert.match(securePanel, /phase === "error"/);
  assert.match(securePanel, /The normal Messenger timeline is intentionally not shown/);
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

  assert.match(app, /device verification and key-recovery flow are/);
  assert.match(app, /encrypted conversations must never fall through to the/);
  assert.match(app, /const visibleIncomingCall = incomingCallConversation\?\.security_mode === "matrix_e2ee"/);
});


test("Matrix crypto initialization reports a sanitized failing stage", () => {
  const source = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(source, /initializing Matrix Rust\/WASM encryption and IndexedDB/);
  assert.match(source, /safeInitializationError/);
  assert.match(source, /access_token\|refresh_token\|token\|password\|authorization/);
  assert.match(source, /Device encryption remains disabled; no message was sent/);
});


test("transient Matrix validation failures preserve the existing device/session", () => {
  const source = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(source, /matrix_session_validation_unavailable/);
  assert.match(source, /device_binding_unavailable/);
  assert.match(source, /The saved device session was preserved/);
  assert.match(source, /a stale Django session or an unexplained authorization error/);
  assert.match(source, /if \(createdDeviceSession && !deviceMarkerWritten\)/);
});

test("failed first-time crypto initialization retires only the unusable new device", () => {
  const source = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(source, /createdDeviceSession && !deviceMarkerWritten/);
  assert.match(source, /await revokeLostLocalDevice\(session\?\.deviceId\)/);
  assert.ok(source.includes("Preserve a device"));
  assert.ok(source.includes("local marker so a transient failure cannot silently"));
  assert.match(source, /createdDeviceSession = true/);
  assert.match(source, /deviceMarkerWritten = true/);
});

test("secure chats preserve a distinct plaintext conversation and use explicit invitations", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

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


test("invited Matrix devices can reach explicit invitation acceptance before Rust crypto room confirmation", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const inviteBranch = panel.indexOf('if (membership === "invite")');
  const encryptionCheck = panel.indexOf('await client.getCrypto().isEncryptionEnabledInRoom(roomId)');
  const joinedMembershipCheck = panel.indexOf('if (membership !== "join")');
  const acceptAction = panel.indexOf('await matrixClient.joinRoom(roomId)');

  assert.ok(inviteBranch >= 0, "the invited membership branch must exist");
  assert.ok(acceptAction >= 0, "the explicit invitation accept action must exist");
  assert.ok(encryptionCheck > inviteBranch, "invites must be rendered before requiring the local Rust crypto marker");
  assert.ok(encryptionCheck > joinedMembershipCheck, "Rust crypto room confirmation must only be required after the device joined");
  assert.match(panel, /if \(!body \|\| !matrixClient \|\| !roomId \|\| sending \|\| phase !== "ready"\) return/);
  assert.match(panel, /if \(roomHasPendingInvites\(room\)\)/);

  const membershipUpdateStart = panel.indexOf("const updateRoomMembershipState");
  const membershipUpdate = panel.slice(
    membershipUpdateStart,
    panel.indexOf("const onSync", membershipUpdateStart),
  );
  const revalidationBranch = membershipUpdate.slice(
    membershipUpdate.indexOf("if (waitingForInviteAcceptance)"),
    membershipUpdate.indexOf("attachRoomListeners();"),
  );
  assert.match(revalidationBranch, /if \(inviteJoinInProgressRef\.current\) return/);
  assert.match(revalidationBranch, /setPhase\("connecting"\)/);
  assert.match(revalidationBranch, /setRevision\(\(value\) => value \+ 1\)/);
  assert.match(revalidationBranch, /return;/);
  assert.match(panel, /inviteJoinInProgressRef\.current = true/);
  assert.match(panel, /await matrixClient\.joinRoom\(roomId\)/);
  assert.match(panel, /await waitForRoomMembership\(matrixClient, roomId, "join"\)/);
  assert.match(panel, /join_sync_timeout/);
});

test("new secure conversations notify the recipient's live chat list without plaintext message delivery", () => {
  const api = read("src/components/messenger/hooks/useMessengerWebSocket.js");

  assert.ok(api.includes('data.type === "conversation.created"'));
  assert.ok(api.includes("loadConversations({ silent: true })"));
  assert.ok(api.includes("Secure-room registration"));
  assert.ok(api.includes("never pull E2EE room content"));
});
