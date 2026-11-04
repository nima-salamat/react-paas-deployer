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
  assert.match(app, /<ChatHeader[\s\S]*?secureMode=\{isMatrixE2EE\}[\s\S]*?onOpenSecuritySettings=/);
  assert.match(app, /<SecureChatPanel[\s\S]*?conversation=\{activeConv\}[\s\S]*?currentUserId=\{meId\}/);
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
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.ok(client.includes("The browser could not lock the local Matrix encryption store"));
  assert.ok(client.includes('const preparedSyncClients = new WeakSet()'));
  assert.ok(client.includes("export async function assertSecureMessagingReady"));
  assert.ok(!client.includes("Set up and verify an encrypted key backup before starting a secure chat."));
  assert.ok(panel.includes("They can do that when they come online."));
  assert.ok(app.includes("onOpenSecuritySettings"));
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
  assert.match(app, /onOpenSecuritySettings=/);
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
  assert.match(panel, /if \(recordingVoice\) \{\s*setMediaBusy\(true\);\s*try \{ mediaRecorderRef\.current\?\.stop\(\); \} catch \{/);
  assert.match(panel, /recorder\.onstop = \(\) => \{[\s\S]*?const blob = new Blob\(chunks, \{ type: mimeType \}\);/);
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


test("Matrix initialization resolves a stale tab ID against the persisted local crypto store", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const migrate = client.slice(
    client.indexOf("} else if (session) {", client.indexOf("async function initializeClient")),
    client.indexOf("if (!session) {", client.indexOf("} else if (session) {", client.indexOf("async function initializeClient"))),
  );
  assert.match(migrate, /persistentDeviceId !== session\.deviceId/);
  assert.match(migrate, /persistentMarkerExists = await hasDeviceMarker\(persistentDeviceId\)/);
  assert.match(migrate, /await revokeLostLocalDevice\(session\.deviceId\)/);
  assert.match(migrate, /await revokeLostLocalDevice\(persistentDeviceId\)/);
});


test("Matrix device sessions survive tab and browser restarts in account-scoped durable storage", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(client, /SESSION_KEY_PREFIX = "pd\.matrix\.secure-session\.v2:"/);
  assert.match(client, /localStorage\.getItem\(storageKey\)/);
  assert.match(client, /localStorage\.setItem\(key, JSON\.stringify\(stored\)\)/);
  assert.match(client, /currentDjangoUserNamespace\(\)/);
  assert.match(client, /sessionStorage\.removeItem\(LEGACY_SESSION_KEY\)/);
  assert.match(client, /storeSession\(session\)/);
});

test("ordinary Matrix client shutdown preserves saved credentials, while explicit revocation clears them", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const devices = read("src/components/messenger/secure/MatrixDevicesDialog.jsx");

  assert.match(client, /shutdownSecureMatrixClient\(\{ clearStoredSession = false \} = \{\}\)/);
  assert.match(client, /if \(clearStoredSession\) \{\s*clearSession\(\)/);
  assert.match(client, /Normal shutdown and account switching release SDK resources and locks/);
  assert.match(devices, /shutdownSecureMatrixClient\(\{ clearStoredSession: true \}\)/);
});

test("revoked stable Matrix device IDs rotate once instead of leaving the account stuck", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(client, /requestNewDeviceSession\(retryRevokedDevice = true\)/);
  assert.match(client, /retryRevokedDevice[\s\S]*?response\.status === 410[\s\S]*?forgetPersistentMatrixDeviceId\(deviceId\)/);
  assert.match(client, /forgetPersistentMatrixDeviceId\(deviceId\);\s*return requestNewDeviceSession\(false\)/);
  assert.match(client, /timeout, 429 and 5xx failures must never trigger a new device/);
});

test("direct Messenger API fetches carry the selected language to Django", () => {
  const api = read("src/components/messenger/api.js");
  assert.match(api, /Accept-Language/);
  assert.match(api, /paas-language/);
});

test("admin database tables render translated schema labels and choice display values without replacing raw values", () => {
  const panel = read("src/components/admin/panels/TablesPanel.jsx");
  const messages = read("src/i18n/messages.js");

  assert.match(panel, /useLocale/);
  assert.match(panel, /f\.label \|\| translate\(f\.name\)/);
  assert.match(panel, /displayValue=\{r\?\._display\?\.\[f\.name\]\}/);
  assert.match(panel, /displayValue !== null && displayValue !== undefined/);
  assert.match(messages, /"Database tables": "جدول‌های دیتابیس"/);
});

test("home, dashboard, messenger and admin have Persian navigation and visible-label translations", () => {
  const messages = read("src/i18n/messages.js");

  for (const label of [
    "Ready Apps",
    "Start deploying",
    "Overview",
    "Quick access",
    "Recent services",
    "Your conversations",
    "New message",
    "New group",
    "Admin",
    "Database tables",
    "Forgot Password?",
    "Send Code",
  ]) {
    assert.ok(messages.includes(JSON.stringify(label)), "Missing locale entry for a main application area");
  }
});


test("account-scoped Matrix sessions do not get confused during concurrent account initialization", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(client, /let clientPromiseNamespace = ""/);
  assert.match(client, /if \(clientPromise && clientPromiseNamespace !== namespace\)/);
  assert.match(client, /account_initialization_in_progress/);
  assert.match(client, /clientPromiseNamespace = namespace/);
});

test("a verified legacy session cannot overwrite an existing account-scoped device before conflict resolution", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  const start = client.indexOf("stage = \"validating or creating the Matrix device session\"");
  const end = client.indexOf("stage = \"creating the Matrix client\"", start);
  const flow = client.slice(start, end);
  assert.ok(flow.indexOf("persistentDeviceId !== session.deviceId") < flow.indexOf("if (session) storeSession(session)"));
  assert.match(flow, /persistentMarkerExists[\s\S]*?clearSession\(\)[\s\S]*?session = null/);
});

test("only an explicit revoked-device response rotates a Matrix device ID; foreign-account legacy sessions are rejected", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");
  assert.match(client, /response\.status === 410/);
  assert.match(client, /retryRevokedDevice[\s\S]*?forgetPersistentMatrixDeviceId\(deviceId\)/);
  assert.match(client, /bindingResponse.status === 403/);
  assert.match(client, /matrix_session_validation_unavailable/);
});

test("Matrix recovery and verification errors are translated at their display boundary", () => {
  const recovery = read("src/components/messenger/secure/MatrixRecoveryDialog.jsx");
  const verification = read("src/components/messenger/secure/MatrixDeviceVerificationDialog.jsx");
  const app = read("src/components/messenger/MessengerApp.jsx");
  assert.match(recovery, /useLocale/);
  assert.match(recovery, /<Alert severity="error">\{t\(error\)\}<\/Alert>/);
  assert.match(recovery, /<Alert severity="info">\{t\(message\)\}<\/Alert>/);
  assert.match(verification, /<Alert severity="error">\{t\(error\)\}<\/Alert>/);
  assert.match(verification, /\{t\(phaseLabel\)\}/);
  assert.match(app, /error=\{t\(error\)\}/);
  assert.match(app, /\{t\(matrixNotice\.body\)\}/);
});

test("Matrix Rust crypto uses a per-account-device IndexedDB and safely retries an old shared-store mismatch", () => {
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(client, /CRYPTO_STORE_MODE_KEY_PREFIX/);
  assert.match(client, /function readCryptoStoreMode\(session\)/);
  assert.match(client, /function rememberCryptoStoreMode\(session, mode\)/);
  assert.match(client, /async function isolatedCryptoDatabasePrefix\(session\)/);
  assert.match(client, /JSON\.stringify\(\[/);
  assert.match(client, /String\(session\?\.homeserverUrl/);
  assert.match(client, /String\(session\?\.userId/);
  assert.match(client, /String\(session\?\.deviceId/);
  assert.match(client, /cryptoDatabasePrefix/);
  assert.match(client, /createdDeviceSession \? "isolated" : "legacy"/);
  assert.match(client, /isMatrixCryptoAccountMismatch\(initializationError\)/);
  assert.match(client, /nextClient = buildClientForSession\(\)[\s\S]*?initRustCrypto\(\{ cryptoDatabasePrefix \}\)/);
  assert.match(client, /rememberCryptoStoreMode\(session, cryptoStoreMode\)/);
  assert.match(client, /Never delete or overwrite the old global database/);
  assert.doesNotMatch(client, /indexedDB\.deleteDatabase/);
});

test("secure private chats use a distinct #s username hash and cannot open the plaintext DM from that route", () => {
  const utils = read("src/components/messenger/messengerUtils.js");
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(utils, /h\.startsWith\("s\/"\).*type: "s"/);
  assert.match(utils, /type === "u" \|\| type === "s"/);
  assert.match(app, /setHash\(securePrivateChat \? "s" : "u", hashUser\)/);
  assert.match(app, /setHash\(securePrivateChat \? "s" : "u", c\.peer\.username\)/);
  assert.match(app, /const isSecureLink = h\.type === "s"/);
  assert.match(app, /return isSecureLink \? secureConversation : !secureConversation/);
});

test("secure conversations reuse the Messenger identity header and profile action without plaintext chat controls", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(app, /<ChatHeader[\s\S]*?secureMode=\{isMatrixE2EE\}/);
  assert.match(header, /onClick=\{\(\) => \(peer\?\.id \? loadUserProfile\(peer\.id\) : pushPanel\("info"\)\)\}/);
  assert.ok(header.includes('tr("End-to-end encrypted")'));
  assert.match(header, /secureMode && \(/);
  assert.match(header, /!secureMode && \(/);
  assert.match(panel, /role="region" aria-label=\{appConversationTitle\(conversation, currentUserId\)\}/);
  assert.doesNotMatch(panel, /onOpenSecuritySettings/);
  assert.match(panel, /onRegisterSecureSearch/);
  assert.match(header, /onOpenSecureSearch/);
  assert.match(header, /tr\("Search messages"\)/);
  assert.match(app, /onOpenSecureSearch=\{\(\) => secureSearchRef\.current\?\.\(\)\}/);
});


test("secure chat uses Matrix-native receipts, unread navigation, and reconnect controls", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.doesNotMatch(panel, /Text, photos, voice notes, videos and files are end-to-end encrypted/);
  assert.match(header, /onReconnectSecureChat/);
  assert.match(header, /Reconnect secure room/);
  assert.match(app, /onReconnectSecureChat=\{\(\) => secureReconnectRef\.current\?\.\(\)\}/);
  assert.match(app, /secureUnreadCountsRef\.current\.set/);
  assert.match(app, /secureUnreadCountsRef\.current\.get/);
  assert.match(app, /matrixClient\.on\("Room\.timeline", onRoomTimeline\)/);
  assert.match(app, /matrixClient\.on\("Room\.receipt", onRoomReceipt\)/);
  assert.match(app, /matrixClient\.on\("sync", onSync\)/);
  assert.match(app, /secureRoomToConversationIdRef\.current\.get/);
  assert.match(panel, /onRegisterReconnect/);
  assert.match(panel, /onRegisterSecureSearch/);
  assert.match(app, /registerSecureSearch/);
  assert.match(panel, /prepareInitialSecureTimeline/);
  assert.match(panel, /getReadReceiptForUserId/);
  assert.match(panel, /matrixClient\.sendReadReceipt\(event\)/);
  assert.match(panel, /new IntersectionObserver/);
  assert.match(panel, /onSecureUnreadCountChange/);
});

test("secure media auto-decrypt is size bounded and reports each encryption stage", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(panel, /AUTO_DECRYPT_MEDIA_MAX_BYTES = 12 \* 1024 \* 1024/);
  assert.match(panel, /size > AUTO_DECRYPT_MEDIA_MAX_BYTES/);
  assert.match(panel, /decryptSmallMedia/);
  assert.match(panel, /mediaStatus\[message\.id\]/);
  assert.match(panel, /Download decrypted file/);
  assert.match(client, /Downloading encrypted attachment/);
  assert.match(client, /Verifying encrypted attachment integrity/);
  assert.match(client, /Decrypting securely on this device/);
  assert.match(client, /Uploading encrypted attachment/);
});

test("secure composer restores focus and additional local search, copy, and Matrix reactions stay in E2EE", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(panel, /inputRef=\{draftInputRef\}/);
  assert.match(panel, /requestAnimationFrame\(\(\) => draftInputRef\.current\?\.focus\(\)\)/);
  assert.match(panel, /filteredMessages/);
  assert.match(panel, /navigator\.clipboard\?\.writeText/);
  assert.match(panel, /matrixClient\.sendEvent\(roomId, "m\.reaction"/);
  assert.match(panel, /matrixClient\.redactEvent\(roomId, ownReaction\.id\)/);
  assert.ok(panel.includes('relation?.rel_type === "m.annotation"'));
  assert.match(panel, /getReactionGroups/);
});


test("secure chat loads a bounded recent window and extends it to include unread history", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const client = read("src/components/messenger/secure/MatrixSecureClient.js");

  assert.match(client, /startClient\(\{ initialSyncLimit: 50 \}\)/);
  assert.match(panel, /INITIAL_SECURE_MESSAGE_COUNT = 50/);
  assert.match(panel, /SECURE_HISTORY_PAGE_SIZE = 40/);
  assert.match(panel, /MAX_INITIAL_UNREAD_HISTORY_PAGES = 100/);
  assert.match(panel, /async function prepareInitialSecureTimeline/);
  assert.match(panel, /findUnreadEventIdByCount/);
  assert.match(panel, /const hasReadMarker = Boolean/);
  assert.match(panel, /hasReadMarker\s*\?/);
  assert.match(panel, /messageCount >= INITIAL_SECURE_MESSAGE_COUNT && unreadBoundaryAvailable/);
  assert.match(panel, /unreadCount <= 0\s*\?/);
  assert.match(panel, /setUnreadAnchorId\(initialHistory\.unreadAnchorId\)/);
  assert.match(panel, /setHasMoreHistory\(initialHistory\.hasMoreHistory\)/);
  assert.match(panel, /scroller\.scrollTo\(\{ top: scroller\.scrollHeight, behavior: "instant" \}\)/);
  assert.match(panel, /secondFrame = requestAnimationFrame/);
});

test("secure voice recording can be cancelled without sending the captured audio", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(panel, /const cancelVoiceRecording = \(\) =>/);
  assert.match(panel, /voiceRecordingCancelledRef\.current = true/);
  assert.match(panel, /if \(cancelled\) return/);
  assert.match(panel, /onClick=\{cancelVoiceRecording\}/);
  assert.match(panel, />\s*Cancel\s*</);
});

test("secure composer icon actions remain circular and fixed-size", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(panel, /flex: "0 0 38px", width: 38, height: 38/);
  assert.match(panel, /minHeight: 40/);
  assert.match(panel, /fullWidth multiline minRows=\{1\} maxRows=\{3\}/);
  assert.match(panel, /& \.MuiOutlinedInput-inputMultiline[\s\S]*?padding: "8px 18px"/);
  assert.match(panel, /borderRadius: "50%"/);
  assert.match(panel, /maxWidth: 960,[\s\S]*?alignItems: "center",[\s\S]*?gap: \{ xs: 0\.55, sm: 0\.75 \}/);
  assert.match(panel, /Message securely…/);
  assert.match(panel, /bgcolor: "background\.default"/);
});

test("secure composer keeps text input and voice waveform at the same height and uses one full-width background", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const formStart = panel.indexOf('component="form"');
  const formEnd = panel.indexOf("</>", formStart);
  const composer = panel.slice(formStart, formEnd);

  assert.ok(formStart >= 0 && formEnd > formStart);
  assert.match(composer, /width: "100%"[\s\S]*?bgcolor: "background\.default"/);
  assert.match(composer, /maxWidth: 960/);
  assert.match(composer, /minHeight: 40/);
  assert.match(composer, /height: 40/);
  assert.match(composer, /&\.MuiInputBase-multiline": \{ padding: 0 \}/);
  assert.match(composer, /MuiOutlinedInput-inputMultiline[\s\S]*?padding: "8px 10px"/);
  const formSurfaceEnd = composer.indexOf("\n            <Box");
  const formSurface = composer.slice(0, formSurfaceEnd);

  assert.ok(formSurfaceEnd > 0);
  assert.equal(formSurface.includes('bgcolor: "background.paper"'), false);
  assert.doesNotMatch(formSurface, /backgroundImage:/);
});

test("secure message actions edit with Matrix replacements and delete with Matrix redactions", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(panel, /MoreVertIcon/);
  assert.match(panel, /Message options/);
  assert.match(panel, /Edit message/);
  assert.match(panel, /Delete message/);
  assert.ok(panel.includes('relation?.rel_type === "m.annotation"'));
  assert.match(panel, /"m\.new_content": \{ msgtype: "m\.text", body \}/);
  assert.match(panel, /event\?\.getRelation\?\.\(\)/);
  assert.match(panel, /event\.replacingEvent\?\.\(\)/);
  assert.match(panel, /relationForMatrixEvent\(event\)/);
  assert.match(panel, /matrixClient\.redactEvent\(roomId, deletingMessage\.id\)/);
  assert.match(panel, /This message was deleted/);
  assert.match(panel, /Only the original sender can edit this secure message/);
});

test("secure Matrix unread effect reads only state and refs declared before its render-time dependencies", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const unreadEffect = app.indexOf("const updateRoomUnread = (room) =>");
  const recoveryState = app.indexOf("const [matrixRecoveryState, setMatrixRecoveryState] = useState(null);");
  const unreadCounts = app.indexOf("const secureUnreadCountsRef = useRef(new Map());");

  assert.ok(unreadEffect >= 0, "the Matrix unread-count effect must exist");
  assert.ok(recoveryState >= 0 && recoveryState < unreadEffect,
    "matrixRecoveryState must be initialized before its effect dependency array is evaluated");
  assert.ok(unreadCounts >= 0 && unreadCounts < unreadEffect,
    "secureUnreadCountsRef must be initialized before its effect can use it");
  assert.ok(app.includes("}, [meId, matrixRecoveryState?.state, secureRoomToConversationId.size]);"));
});


test("redacting a Matrix reaction never renders it as a deleted message and only removes the actor's matching annotation", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const describeStart = panel.indexOf("function describeEvent(");
  const describeEnd = panel.indexOf("\nfunction getRoomMessages", describeStart);
  const describeEvent = panel.slice(describeStart, describeEnd);

  assert.ok(describeStart >= 0 && describeEnd > describeStart);
  assert.ok(
    describeEvent.indexOf('if (type !== "m.room.message" && type !== "m.room.encrypted") return null;')
      < describeEvent.indexOf("if (isRedacted)"),
    "non-message relations must be discarded before the deleted-message branch",
  );
  assert.match(panel, /if \(event\.isRedacted\?\.\(\)\) continue/);
  assert.ok(panel.includes('reactionEvent.getType?.() === "m.reaction"'));
  assert.ok(panel.includes('relation?.rel_type === "m.annotation"'));
  assert.match(panel, /String\(relation\.event_id \|\| ""\) === String\(message\.id\)/);
  assert.match(panel, /String\(relation\.key \|\| ""\) === String\(emoji\)/);
  assert.match(panel, /matrixClient\.redactEvent\(roomId, ownReaction\.id\)/);
  assert.match(panel, /"reaction_state_stale"/);
});

test("secure search highlights all loaded matches and navigates between them", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");

  assert.match(panel, /const \[activeSearchIndex, setActiveSearchIndex\] = useState\(0\)/);
  assert.match(panel, /const activeSearchResultId = searchQuery\.trim\(\)/);
  assert.match(panel, /const searchMatchIds = useMemo/);
  assert.match(panel, /setActiveSearchIndex\(0\)/);
  assert.match(panel, /const moveSearchResult = \(direction\) =>/);
  assert.match(panel, /Previous search result/);
  assert.match(panel, /Next search result/);
  assert.match(panel, /disabled=\{!searchQuery\.trim\(\) \|\| filteredMessages\.length < 2\}/);
  assert.match(panel, /searchQuery\.trim\(\) && filteredMessages\.length \?/);
  assert.match(panel, /KeyboardArrowUpRoundedIcon/);
  assert.match(panel, /KeyboardArrowDownRoundedIcon/);
  assert.match(panel, /activeSearchIndex \+ 1\) \+ " \/ " \+ filteredMessages\.length/);
  assert.match(panel, /scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/);
  assert.match(panel, /data-search-match=\{isSearchMatch \? "true" : undefined\}/);
  assert.match(panel, /data-search-active=\{isActiveSearchMatch \? "true" : undefined\}/);
  assert.match(panel, /outline: isActiveSearchMatch \? "3px solid"/);
  assert.match(panel, /ArrowRightAltRoundedIcon/);
  assert.match(panel, /messages\.map\(\(message, messageIndex\) => \{/);
  assert.doesNotMatch(panel, /filteredMessages\.map\(\(message, messageIndex\) => \{/);
});

test("secure media viewers, floating reactions, search menu and unread jump control are available", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");
  const app = read("src/components/messenger/MessengerApp.jsx");

  assert.match(panel, /import MediaGalleryDialog from "\.\.\/components\/MediaGalleryDialog"/);
  assert.match(panel, /setSecureViewerAttachment\(\{/);
  assert.match(panel, /<MediaGalleryDialog[\s\S]*?initialItems=\{secureViewerItems\}/);
  assert.match(panel, /function SecureAudioPlayer\([\s\S]*?<audio ref=\{audioRef\}[\s\S]*?aria-label="Audio progress"/);
  assert.match(panel, /message\.mediaType === "m\.audio"[\s\S]*?<SecureAudioPlayer/);
  assert.match(panel, /message\.mediaType === "m\.video"[\s\S]*?<VideoPlayer/);

  assert.match(panel, /<Popover[\s\S]*?anchorEl=\{reactionPickerAnchor\}/);
  assert.doesNotMatch(panel, /reactionPickerMessageId === message\.id && \["👍", "❤️"/);
  assert.match(panel, /const toggleReactionPicker = \(message, event\) => \{/);
  assert.match(panel, /const anchorEl = event\.currentTarget;[\s\S]*?setReactionPickerAnchor\(anchorEl\)/);
  assert.doesNotMatch(panel, /setReactionPickerAnchor\(\(current\) =>[\s\S]*?event\.currentTarget/);
  assert.match(panel, /onClick=\{\(event\) => toggleReactionPicker\(message, event\)\}/);
  assert.match(panel, /aria-haspopup="dialog"/);
  assert.match(panel, /bottom: 7,[\s\S]*?\[message\.isOwn \? "left" : "right"\]: -32/);
  assert.match(panel, /marginThreshold=\{12\}/);

  assert.doesNotMatch(panel, /aria-label="Secure chat options"/);
  assert.match(header, /onOpenSecureSearch/);
  assert.match(header, /tr\("Search messages"\)/);
  assert.match(app, /secureSearchRef\.current\?\.\(\)/);
  assert.match(panel, /Search loaded encrypted history on this device/);

  assert.match(panel, /<Badge[\s\S]*?badgeContent=\{unreadCount > 99 \? "99\+" : unreadCount\}/);
  assert.match(panel, /<KeyboardArrowDownRoundedIcon/);
  assert.match(panel, /unreadCountRef\.current - 1/);
  assert.match(panel, /scroller\.scrollTo\(\{ top: scroller\.scrollHeight, behavior: "smooth" \}\)/);
});


test("secure Messenger visual refresh keeps timeline date groups, compact bubbles, status surface and cohesive composer", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  const header = read("src/components/messenger/components/ChatHeader.jsx");

  assert.match(panel, /function secureDateLabel\(timestamp\)/);
  assert.match(panel, /messages\.map\(\(message, messageIndex\) => \{/);
  assert.match(panel, /data-search-active=\{isActiveSearchMatch \? "true" : undefined\}/);
  assert.match(panel, /showSender && \(/);
  assert.match(panel, /linear-gradient\(145deg/);
  assert.match(panel, /className="secure-message-reaction"/);
  assert.match(panel, /&:hover \.secure-message-reaction/);
  assert.match(panel, /reaction\.own[\s\S]*?alpha\(message\.isOwn \? theme\.palette\.primary\.contrastText/);
  assert.match(panel, /translateY\(-1px\)/);
  assert.doesNotMatch(panel, /messages on this device|End-to-end encrypted|Secure chat options/);
  assert.match(panel, /searchOpen && \(/);
  assert.match(panel, /onRegisterSecureSearch/);
  assert.match(panel, /scrollBehavior: "smooth"/);
  assert.match(panel, /Message securely…/);
  assert.match(panel, /& .MuiOutlinedInput-root/);
  assert.match(header, /minHeight: 56/);
  assert.match(header, /alpha\(t\.palette\.success\.main, 0\.5\)/);
});


test("secure timeline settles at the latest message when there is no unread anchor", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(panel, /if \(!unreadAnchorId\) settledScroller\.scrollTo\(\{ top: settledScroller\.scrollHeight, behavior: "instant" \}\)/);
  assert.match(panel, /secondFrame = requestAnimationFrame/);
  assert.match(panel, /initialScrollHandledRef\.current = true/);
});

test("secure sent and seen states use distinct one-tick and two-tick icons", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(panel, /import DoneIcon from "@mui\/icons-material\/Done"/);
  assert.match(panel, /const hasBeenSeen = receiptStatus !== "Sent"/);
  assert.match(panel, /hasBeenSeen[\s\S]*?<DoneAllIcon[\s\S]*?<DoneIcon/);
  assert.match(panel, /<Tooltip title=\{receiptStatus\}>/);
});

test("redacted secure messages never expose message options or open an empty menu", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(panel, /!message\.redacted && \([\s\S]*?<Tooltip title="Message options">/);
  assert.match(panel, /open=\{Boolean\(messageMenuAnchor && messageMenuTarget && !messageMenuTarget\.redacted\)\}/);
  assert.match(panel, /if \(message\.redacted\) return/);
});

test("secure voice recording shows live microphone waveform and elapsed time inside the composer", () => {
  const panel = read("src/components/messenger/secure/SecureChatPanel.jsx");
  assert.match(panel, /createAnalyser\(\)/);
  assert.match(panel, /getByteTimeDomainData\(samples\)/);
  assert.match(panel, /recordingWaveform\.map/);
  assert.match(panel, /formatDuration\(Math\.floor\(recordingElapsedMs \/ 1000\)\)/);
  assert.match(panel, /voiceRecordingStartedAtRef\.current = Date\.now\(\)/);
});
