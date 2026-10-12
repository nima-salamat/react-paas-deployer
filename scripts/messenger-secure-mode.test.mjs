import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("encrypted conversations never render the plaintext Messenger timeline or composer", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(app, /const isMatrixE2EE = activeConv\?\.security_mode === "matrix_e2ee" \|\| Boolean\(activeConv\?\.matrix_room_id\)/);
  assert.match(app, /\{isMatrixE2EE \? \(/);
  assert.match(app, /<SecureChatPanel[\s\S]*?conversation=\{activeConv\}[\s\S]*?currentUserId=\{meId\}[\s\S]*?onOpenSecuritySettings=/);
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
  assert.match(app, /incomingCallConversation\?\.security_mode === "matrix_e2ee"/);
  assert.match(app, /Boolean\(incomingCallConversation\?\.matrix_room_id\)/);
  assert.match(app, /incomingCall=\{visibleIncomingCall\}/);
});

test("encrypted-room fallback explains missing Matrix device authentication and recovery", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(app, /device verification and key-recovery flow are/);
  assert.match(app, /encrypted conversations must never fall through to the/);
  assert.match(app, /incomingCallConversation\?\.security_mode === "matrix_e2ee"/);
  assert.match(app, /Boolean\(incomingCallConversation\?\.matrix_room_id\)/);
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
  assert.match(source, /createdDeviceSession = session\.createdNewDeviceId !== false/);
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
  assert.ok(client.includes("Recovery is checked globally when Messenger opens and on demand in Settings."));
});

test("first-time and offline peers do not turn recovery setup into a crypto-init requirement", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.ok(client.includes("The browser could not lock the local Matrix encryption store"));
  assert.ok(client.includes('const preparedSyncClients = new WeakSet()'));
  assert.ok(client.includes("export async function assertSecureMessagingReady"));
  assert.ok(!client.includes("Set up and verify an encrypted key backup before starting a secure chat."));
  assert.ok(panel.includes("They can do that when they come online."));
  assert.ok(panel.includes("onOpenSecuritySettings"));
  assert.ok(!panel.includes("Set up recovery"));
  assert.ok(!panel.includes("MatrixRecoveryDialog"));
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


test("secure chat uses Messenger profiles, Matrix encrypted media, Enter-to-send, and no per-room recovery prompt", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const devices = read("src/components/messenger/secure/MatrixDevicesDialog.jsx");

  assert.match(panel, /resolveMatrixUsers\(localUserIds/);
  assert.match(panel, /appConversationTitle\(conversation, currentUserId\)/);
  assert.match(panel, /sendEncryptedMedia/);
  assert.match(panel, /decryptEncryptedMedia/);
  assert.match(panel, /event\.key === "Enter" && !event\.shiftKey && !event\.nativeEvent\?\.isComposing/);
  assert.doesNotMatch(panel, /MatrixRecoveryDialog|Set up recovery/);
  assert.match(client, /export async function sendEncryptedMedia/);
  assert.match(client, /uploadContent\(encryptedBlob/);
  assert.match(client, /hashes: \{ sha256: encodeUnpaddedBase64\(hash\) \}/);
  assert.match(client, /media_hash_mismatch/);
  assert.match(client, /getOrCreatePersistentDeviceId/);
  assert.match(client, /deviceInventoryUnavailable/);
  assert.match(devices, /active Matrix device\(s\)/);
});


test("secure recovery is global and dismissible; standard Messenger APIs do not receive Matrix room history", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const settings = read("src/components/messenger/components/RightPanel.jsx");
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(app, /messenger\.matrix-recovery-notice\.v1/);
  assert.match(app, /anchorOrigin=\{\{ vertical: "top", horizontal: "left" \}\}/);
  assert.match(app, /onOpenSecureSettings=\{\(\) => \{[\s\S]*?pushPanel\("secure-settings"\)/);
  assert.match(app, /if \(!cid \|\| isMatrixConversationId\(cid\)\) return/);
  assert.doesNotMatch(app, /\+ \(token \? `&token=\$\{encodeURIComponent\(token\)\}` : ""\)/);
  assert.match(settings, /kind === "secure-settings"/);
  assert.match(panel, /onOpenSecuritySettings/);
  assert.doesNotMatch(panel, /MatrixRecoveryDialog|Set up recovery/);
  assert.match(client, /return \{ state: "not_checked" \}/);
});


test("Messenger startup never provisions a Matrix device merely to show a recovery notice", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(app, /hasRecoverableLocalMatrixDevice\(\)/);
  assert.match(client, /export async function hasRecoverableLocalMatrixDevice\(\)/);
  assert.match(client, /if \(!remembered\.createdNewDeviceId\)/);
  assert.match(client, /markerExists = await hasDeviceMarker\(remembered\.deviceId\)/);
  assert.match(client, /The existing device ID was not reused/);
});


test("secure attachments accept arbitrary file types and voice recording has an explicit stop action", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(panel, /sendEncryptedMedia/);
  assert.match(panel, /recordingVoice \? <StopIcon \/> : <MicIcon \/>/);
  assert.doesNotMatch(panel, /accept="image\/\*,audio\/\*,video\/\*/);
  assert.match(panel, /setRecordingVoice\(false\);\s*const blob = new Blob/);
});


test("Matrix device setup fails closed when a stable account-scoped browser ID cannot be persisted", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(client, /device_owner_unavailable/);
  assert.match(client, /persistent_device_id_unavailable/);
  assert.match(client, /localStorage\.getItem\(storageKey\) !== deviceId/);
  assert.doesNotMatch(client, /if \(!namespace\) return \{ deviceId: newDeviceId\(\), createdNewDeviceId: true \}/);
});


test("the recovery notification Settings action dismisses the toast and refreshes security state", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  assert.match(app, /dismissMatrixNotice\(\); pushPanel\("secure-settings"\); void refreshSecureRecoveryState\(\)/);
});


test("Matrix profile lookup cannot block invitation acceptance or initial room validation", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const connectStart = panel.indexOf("async function connect()");
  const profileLookup = panel.indexOf("void resolveMatrixUsers(localUserIds", connectStart);
  const inviteBranch = panel.indexOf('if (membership === "invite")', profileLookup);
  assert.ok(connectStart >= 0);
  assert.ok(profileLookup > connectStart);
  assert.ok(inviteBranch > profileLookup);
  assert.match(panel, /Profile API failure must not block invite acceptance or secure chat/);
  assert.match(panel, /if \(!cancelled && roomReadyForTimeline\) refreshTimeline\(client\)/);
  assert.doesNotMatch(panel, /const identities = await resolveMatrixUsers\(localUserIds/);
});


test("recovery preflight is scoped to the current Messenger account's persistent device ID", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const start = client.indexOf("export async function hasRecoverableLocalMatrixDevice");
  const end = client.indexOf("function openMarkerDatabase", start);
  const preflight = client.slice(start, end);
  assert.match(preflight, /PERSISTENT_DEVICE_KEY_PREFIX.*namespace/);
  assert.match(preflight, /session && session\.deviceId !== deviceId\) return false/);
  assert.doesNotMatch(preflight, /let deviceId = session\?\.deviceId/);
});


test("validated legacy Matrix sessions migrate to a stable account-scoped device ID", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(client, /function rememberValidatedPersistentDeviceId\(deviceId\)/);
  assert.match(client, /else if \(session\) \{[\s\S]*?rememberValidatedPersistentDeviceId\(session\.deviceId\)/);
  assert.match(client, /if \(existing && existing !== deviceId\) return/);
});


test("legacy Matrix recovery preflight validates ownership before migrating tab-only sessions", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const start = client.indexOf("export async function hasRecoverableLocalMatrixDevice");
  const end = client.indexOf("function openMarkerDatabase", start);
  const preflight = client.slice(start, end);
  assert.match(preflight, /valid = await validateStoredSession\(session\)/);
  assert.match(preflight, /hasDeviceMarker\(session\.deviceId\)/);
  assert.match(preflight, /rememberValidatedPersistentDeviceId\(session\.deviceId\)/);
  assert.match(preflight, /session && session\.deviceId !== deviceId/);
});


test("invalid saved Matrix sessions retire the old device ID before provisioning a replacement", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const invalidSession = client.slice(
    client.indexOf("if (session && !(await validateStoredSession(session)))"),
    client.indexOf("} else if (session)", client.indexOf("if (session && !(await validateStoredSession(session)))")),
  );
  assert.match(invalidSession, /await revokeLostLocalDevice\(session\.deviceId\)/);
  assert.match(invalidSession, /clearSession\(\)/);
});


test("opening Messenger shows a dismissible recovery warning without provisioning a Matrix device", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  assert.match(app, /void refreshSecureRecoveryState\(\);/);
  assert.match(app, /if \(!hasLocalDevice\) \{/);
  assert.match(app, /status = \{ state: "not_configured", deviceCount: null \}/);
  assert.match(app, /Recovery status must not provision a new Matrix device/);
});
