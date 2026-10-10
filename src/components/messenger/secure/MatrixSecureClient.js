import { createClient } from "matrix-js-sdk";
import { decodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api/recovery-key";

import { MSG_API, authHeaders } from "../api";

const SESSION_KEY = "pd.matrix.secure-session.v1";
const DEVICE_MARKER_DB = "pd-messenger-matrix-device-marker";
const DEVICE_MARKER_STORE = "devices";

let client = null;
let clientPromise = null;
let currentSession = null;
let releaseDeviceLock = null;
let recoveryKeyBytesPending = null;
let recoveryKeyIdPending = null;
const secretStorageKeyCache = new Map();

export class MatrixSecureError extends Error {
  constructor(message, code = "matrix_secure_error") {
    super(message);
    this.name = "MatrixSecureError";
    this.code = code;
  }
}

function readSession() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (
      parsed
      && typeof parsed.homeserverUrl === "string"
      && typeof parsed.userId === "string"
      && typeof parsed.deviceId === "string"
      && typeof parsed.accessToken === "string"
    ) return parsed;
  } catch {
    // Invalid local state is treated as a lost local device, not recovered by
    // reusing the old remote device ID.
  }
  return null;
}

function storeSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  currentSession = null;
}

function newDeviceId() {
  if (!globalThis.crypto?.getRandomValues) {
    throw new MatrixSecureError("Secure device creation requires a cryptographically secure browser.", "crypto_unavailable");
  }
  const bytes = new Uint8Array(18);
  globalThis.crypto.getRandomValues(bytes);
  return `PD${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function openMarkerDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new MatrixSecureError(
      "This browser cannot store the local encryption device securely. Use a supported browser with IndexedDB enabled.",
      "indexeddb_unavailable",
    ));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEVICE_MARKER_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DEVICE_MARKER_STORE)) {
        db.createObjectStore(DEVICE_MARKER_STORE, { keyPath: "deviceId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new MatrixSecureError("Could not access local Matrix device state.", "indexeddb_error"));
    request.onblocked = () => reject(new MatrixSecureError("Local Matrix storage is blocked by another tab.", "indexeddb_blocked"));
  });
}

async function hasDeviceMarker(deviceId) {
  const db = await openMarkerDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(DEVICE_MARKER_STORE, "readonly")
        .objectStore(DEVICE_MARKER_STORE).get(deviceId);
      request.onsuccess = () => resolve(Boolean(request.result));
      request.onerror = () => reject(new MatrixSecureError("Could not read the local Matrix device marker.", "indexeddb_error"));
    });
  } finally {
    db.close();
  }
}

async function writeDeviceMarker(deviceId) {
  const db = await openMarkerDatabase();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(DEVICE_MARKER_STORE, "readwrite")
        .objectStore(DEVICE_MARKER_STORE)
        .put({ deviceId, initializedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new MatrixSecureError("Could not record the local encryption device.", "indexeddb_error"));
    });
  } finally {
    db.close();
  }
}

async function acquireDeviceLock(deviceId) {
  if (!globalThis.navigator?.locks?.request) {
    throw new MatrixSecureError(
      "This browser cannot safely coordinate Matrix encryption storage across tabs. Use a current browser that supports Web Locks.",
      "web_locks_unavailable",
    );
  }
  let release;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });
  const hold = new Promise((resolve) => { release = resolve; });
  const lockTask = globalThis.navigator.locks.request(
    `pd-matrix-crypto-${deviceId}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      if (!lock) {
        resolveReady(false);
        return false;
      }
      releaseDeviceLock = release;
      resolveReady(true);
      await hold;
      return true;
    },
  );
  const acquired = await ready;
  if (!acquired) {
    lockTask.catch(() => {});
    return false;
  }
  lockTask.catch(() => {
    releaseDeviceLock = null;
  });
  return true;
}

async function validateStoredSession(session) {
  try {
    const response = await fetch(
      `${session.homeserverUrl.replace(/\\/+$/, "")}/_matrix/client/v3/account/whoami`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
    if (!response.ok) return false;
    const data = await response.json();
    if (data.user_id !== session.userId || data.device_id !== session.deviceId) return false;

    // The Matrix token must also belong to the Django account currently logged
    // in to this tab. A stale session from a previous app user is never reused.
    const bindingResponse = await fetch(`${MSG_API}/secure/device-session/`, {
      headers: authHeaders({
        "X-Matrix-Access-Token": session.accessToken,
        "X-Matrix-Device-ID": session.deviceId,
      }),
    });
    if (!bindingResponse.ok) return false;
    const bindingBody = await bindingResponse.json();
    const binding = bindingBody?.data || bindingBody;
    return bindingBody?.success !== false
      && binding?.valid === true
      && binding?.device_id === session.deviceId;
  } catch {
    return false;
  }
}

async function requestNewDeviceSession() {
  const deviceId = newDeviceId();
  let response;
  try {
    response = await fetch(`${MSG_API}/secure/device-session/`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        device_id: deviceId,
        display_name: (navigator.userAgent || "Browser").slice(0, 90),
      }),
    });
  } catch {
    throw new MatrixSecureError("Could not contact the Messenger secure-device endpoint.", "backend_unavailable");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new MatrixSecureError("The secure-device endpoint returned an invalid response.", "invalid_response");
  }
  const session = body?.data || body;
  if (!response.ok || body?.success === false) {
    throw new MatrixSecureError(body?.message || "Could not create a Matrix device session.", "device_session_failed");
  }
  if (
    session?.device_id !== deviceId
    || !session?.access_token
    || !session?.user_id
    || !session?.homeserver_url
  ) {
    throw new MatrixSecureError("The Matrix server returned an incomplete device session.", "invalid_session");
  }
  const result = {
    deviceId: session.device_id,
    userId: session.user_id,
    accessToken: session.access_token,
    homeserverUrl: session.homeserver_url,
  };
  storeSession(result);
  currentSession = result;
  return result;
}

function cryptoCallbacks() {
  return {
    getSecretStorageKey: async ({ keys }) => {
      for (const [keyId, key] of secretStorageKeyCache.entries()) {
        if (keys?.[keyId]) return [keyId, key];
      }
      if (recoveryKeyBytesPending) {
        const keyId = (
          recoveryKeyIdPending && keys?.[recoveryKeyIdPending]
            ? recoveryKeyIdPending
            : Object.keys(keys || {})[0]
        );
        if (keyId) return [keyId, recoveryKeyBytesPending];
      }
      return null;
    },
    cacheSecretStorageKey: (keyId, _keyInfo, key) => {
      // Keep recovery key bytes in memory only. Never persist them in storage,
      // send them to Django, or include them in diagnostics.
      secretStorageKeyCache.set(keyId, key);
    },
  };
}

async function initializeClient() {
  let session = readSession();
  if (session) {
    const hasMarker = await hasDeviceMarker(session.deviceId);
    if (!hasMarker) {
      // A session without its local crypto-store marker may be a browser that
      // lost local crypto state. Never reuse that device ID with fresh keys.
      clearSession();
      session = null;
    }
  }

  if (session && !(await validateStoredSession(session))) {
    clearSession();
    session = null;
  }

  if (session) {
    const locked = await acquireDeviceLock(session.deviceId);
    if (!locked) {
      // sessionStorage may be copied into a second tab. Give that tab a new
      // Matrix device ID and thus an independent Rust crypto store.
      sessionStorage.removeItem(SESSION_KEY);
      session = await requestNewDeviceSession();
      const newLock = await acquireDeviceLock(session.deviceId);
      if (!newLock) throw new MatrixSecureError("Could not isolate the Matrix device across tabs.", "device_lock_conflict");
    }
  } else {
    session = await requestNewDeviceSession();
    const locked = await acquireDeviceLock(session.deviceId);
    if (!locked) throw new MatrixSecureError("Could not isolate the Matrix device across tabs.", "device_lock_conflict");
  }

  const nextClient = createClient({
    baseUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
    cryptoCallbacks: cryptoCallbacks(),
  });
  try {
    await nextClient.initRustCrypto();
    await writeDeviceMarker(session.deviceId);
    nextClient.startClient({ initialSyncLimit: 40 });
  } catch (error) {
    nextClient.stopClient();
    if (releaseDeviceLock) releaseDeviceLock();
    releaseDeviceLock = null;
    clearSession();
    throw new MatrixSecureError(
      "Matrix cryptography could not initialize. The device was not enabled for sending messages.",
      "crypto_init_failed",
    );
  }
  client = nextClient;
  currentSession = session;
  return client;
}

export async function getSecureMatrixClient() {
  if (client) return client;
  if (!clientPromise) {
    clientPromise = initializeClient().finally(() => { clientPromise = null; });
  }
  return clientPromise;
}

export function getSecureMatrixSession() {
  return currentSession || readSession();
}

export async function getRecoveryState(matrixClient) {
  const crypto = matrixClient.getCrypto();
  const [secretStatus, backupInfo, crossSigningReady] = await Promise.all([
    crypto.getSecretStorageStatus(),
    crypto.getKeyBackupInfo().catch(() => null),
    crypto.isCrossSigningReady().catch(() => false),
  ]);
  let deviceCount = 0;
  try {
    const response = await fetch(`${MSG_API}/secure/devices/`, {
      headers: authHeaders({
        "X-Matrix-Device-ID": matrixClient.getDeviceId(),
      }),
    });
    const body = await response.json();
    const data = body?.data || body;
    if (response.ok) {
      deviceCount = (data?.results || []).filter((row) => !row.revoked_at).length;
    }
  } catch {
    // If device inventory cannot be read, do not assume this is the first device.
    deviceCount = 2;
  }

  if (secretStatus.ready && backupInfo) {
    try {
      const checked = await crypto.checkKeyBackupAndEnable();
      if (checked) {
        return { state: "ready", backupInfo, crossSigningReady, deviceCount };
      }
    } catch {
      // Continue below and require recovery rather than assuming key backup works.
    }
  }
  if (secretStatus.defaultKeyId || backupInfo || deviceCount > 1) {
    return {
      state: "recovery_required",
      backupInfo,
      defaultKeyId: secretStatus.defaultKeyId,
      crossSigningReady,
      deviceCount,
    };
  }
  return { state: "needs_setup", backupInfo: null, crossSigningReady, deviceCount };
}

export async function prepareRecoveryKey(matrixClient) {
  const state = await getRecoveryState(matrixClient);
  if (state.state !== "needs_setup") {
    throw new MatrixSecureError(
      "This account already has devices or recovery state. Do not replace its recovery key; restore the existing backup or use an existing device.",
      "recovery_already_exists",
    );
  }
  const generated = await matrixClient.getCrypto().createRecoveryKeyFromPassphrase();
  if (!generated?.encodedPrivateKey || !generated?.privateKey) {
    throw new MatrixSecureError("The Matrix SDK did not generate a displayable recovery key.", "recovery_key_generation_failed");
  }
  return generated;
}

export async function commitRecoveryKey(matrixClient, generatedKey) {
  if (!generatedKey?.privateKey || !generatedKey?.encodedPrivateKey) {
    throw new MatrixSecureError("Recovery key data is missing.", "recovery_key_missing");
  }
  const crypto = matrixClient.getCrypto();
  const currentStatus = await crypto.getSecretStorageStatus();
  const existingBackup = await crypto.getKeyBackupInfo();
  if (currentStatus.defaultKeyId || existingBackup) {
    throw new MatrixSecureError("Existing recovery configuration was detected; refusing to replace it.", "recovery_overwrite_refused");
  }
  try {
    await crypto.bootstrapSecretStorage({
      createSecretStorageKey: async () => generatedKey,
      setupNewKeyBackup: true,
    });
    const ready = await crypto.isSecretStorageReady();
    const backupCheck = await crypto.checkKeyBackupAndEnable();
    if (!ready || !backupCheck) {
      throw new MatrixSecureError("Matrix did not confirm a trusted key backup. Sending remains disabled.", "backup_not_ready");
    }
    const backupInfo = await crypto.getKeyBackupInfo();
    if (!backupInfo) {
      throw new MatrixSecureError("Matrix did not publish the key backup. Sending remains disabled.", "backup_missing");
    }
    return getRecoveryState(matrixClient);
  } catch (error) {
    if (error instanceof MatrixSecureError) throw error;
    throw new MatrixSecureError(
      "Could not securely configure secret storage and key backup. No encrypted message was sent.",
      "recovery_setup_failed",
    );
  }
}

export async function restoreRecoveryKey(matrixClient, rawRecoveryKey) {
  const recoveryKey = String(rawRecoveryKey || "").trim();
  if (!recoveryKey) throw new MatrixSecureError("Enter the recovery key.", "recovery_key_required");
  let bytes;
  try {
    bytes = decodeRecoveryKey(recoveryKey);
  } catch {
    throw new MatrixSecureError("The recovery key format is invalid.", "invalid_recovery_key");
  }
  const crypto = matrixClient.getCrypto();
  const secretStatus = await crypto.getSecretStorageStatus();
  const backupInfo = await crypto.getKeyBackupInfo();
  if (!backupInfo?.version) {
    throw new MatrixSecureError(
      "No server-side key backup exists. The recovery key alone cannot restore old message keys.",
      "backup_missing",
    );
  }
  recoveryKeyBytesPending = bytes;
  recoveryKeyIdPending = secretStatus.defaultKeyId || null;
  try {
    if (secretStatus.defaultKeyId) {
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
    } else {
      await crypto.storeSessionBackupPrivateKey(bytes, backupInfo.version);
    }
    const checked = await crypto.checkKeyBackupAndEnable();
    if (!checked) {
      throw new MatrixSecureError("The recovery key could not verify this account's backup.", "backup_untrusted");
    }
    const restored = await crypto.restoreKeyBackup();
    const now = await getRecoveryState(matrixClient);
    if (now.state !== "ready") {
      throw new MatrixSecureError("Key recovery finished but the backup is not fully ready.", "backup_not_ready");
    }
    return { ...now, restored };
  } catch (error) {
    if (error instanceof MatrixSecureError) throw error;
    throw new MatrixSecureError("The recovery key could not unlock the existing key backup.", "restore_failed");
  } finally {
    recoveryKeyBytesPending = null;
    recoveryKeyIdPending = null;
    bytes.fill(0);
  }
}

export async function assertSecureMessagingReady(matrixClient) {
  const state = await getRecoveryState(matrixClient);
  if (state.state !== "ready") {
    throw new MatrixSecureError(
      state.state === "recovery_required"
        ? "This device needs the existing Matrix recovery key before it can send secure messages."
        : "Set up and verify an encrypted key backup before starting a secure chat.",
      state.state,
    );
  }
  return state;
}

async function matrixPost(path, data, session, extraHeaders = {}) {
  let response;
  try {
    response = await fetch(`${MSG_API}${path}`, {
      method: "POST",
      headers: authHeaders({
        "Content-Type": "application/json",
        ...(session?.accessToken ? { "X-Matrix-Access-Token": session.accessToken } : {}),
        ...extraHeaders,
      }),
      body: JSON.stringify(data),
    });
  } catch {
    throw new MatrixSecureError("Could not contact the secure Messenger API.", "backend_unavailable");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new MatrixSecureError("The secure Messenger API returned an invalid response.", "invalid_response");
  }
  if (!response.ok || body?.success === false) {
    throw new MatrixSecureError(body?.message || "The secure Messenger operation failed.", "secure_api_failed");
  }
  return body?.data ?? body;
}

export async function resolveMatrixUsers(userIds, session) {
  const data = await matrixPost("/secure/identities/", {
    user_ids: [...new Set((userIds || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))],
  }, session);
  return Array.isArray(data?.users) ? data.users : [];
}

export async function mapEncryptedConversation(payload, session) {
  return matrixPost("/secure/conversations/", payload, session);
}

export async function createEncryptedConversation({ type, title = "", description = "", memberIds = [] }) {
  const matrixClient = await getSecureMatrixClient();
  const session = getSecureMatrixSession();
  await assertSecureMessagingReady(matrixClient);
  const resolvedUsers = await resolveMatrixUsers(memberIds, session);
  const currentUserId = matrixClient.getUserId();
  if (!currentUserId) throw new MatrixSecureError("Matrix client is not authenticated.", "not_authenticated");
  const invites = resolvedUsers
    .map((row) => row.matrix_user_id)
    .filter((matrixUserId) => matrixUserId && matrixUserId !== currentUserId);
  const serverName = currentUserId.slice(currentUserId.indexOf(":") + 1);
  const encryptionState = {
    type: "m.room.encryption",
    state_key: "",
    content: { algorithm: "m.megolm.v1.aes-sha2" },
  };

  if (type === "group") {
    const spaceResult = await matrixClient.createRoom({
      name: title.trim(),
      visibility: "private",
      preset: "private_chat",
      creation_content: { type: "m.space" },
      invite: invites,
    });
    const spaceId = spaceResult?.room_id;
    if (!spaceId) throw new MatrixSecureError("Matrix did not create the group Space.", "space_creation_failed");
    const parentState = {
      type: "m.space.parent",
      state_key: spaceId,
      content: { via: [serverName], canonical: true },
    };
    const generalResult = await matrixClient.createRoom({
      name: "General",
      visibility: "private",
      preset: "private_chat",
      invite: invites,
      initial_state: [encryptionState, parentState],
    });
    const roomId = generalResult?.room_id;
    if (!roomId) throw new MatrixSecureError("Matrix did not create the encrypted General room.", "room_creation_failed");
    await matrixClient.sendStateEvent(spaceId, "m.space.child", {
      via: [serverName],
      suggested: true,
    }, roomId);
    const localUserIds = [...new Set(memberIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const mapped = await mapEncryptedConversation({
      type: "group",
      title: title.trim(),
      description,
      member_ids: localUserIds,
      room_id: roomId,
      space_id: spaceId,
    }, session);
    return mapped;
  }

  if (type !== "private") throw new MatrixSecureError("Unsupported secure conversation type.", "unsupported_type");
  const roomResult = await matrixClient.createRoom({
    is_direct: true,
    visibility: "private",
    preset: "private_chat",
    invite: invites,
    initial_state: [encryptionState],
  });
  if (!roomResult?.room_id) throw new MatrixSecureError("Matrix did not create the encrypted direct room.", "room_creation_failed");
  return mapEncryptedConversation({
    type: "private",
    member_ids: [...new Set([...memberIds.map(Number)])],
    room_id: roomResult.room_id,
    space_id: null,
  }, session);
}

export async function createEncryptedTopic({ conversation, title, description = "" }) {
  if (!conversation?.matrix_space_id || !conversation?.is_forum) {
    throw new MatrixSecureError("This encrypted group is missing its Matrix Space mapping.", "space_missing");
  }
  const matrixClient = await getSecureMatrixClient();
  const session = getSecureMatrixSession();
  await assertSecureMessagingReady(matrixClient);
  const localMembers = (conversation.participants || [])
    .map((participant) => Number(participant?.user?.id ?? participant?.user_id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!localMembers.length) {
    throw new MatrixSecureError("Could not resolve the secure group's member list.", "members_missing");
  }
  const resolvedUsers = await resolveMatrixUsers(localMembers, session);
  const currentUserId = matrixClient.getUserId();
  const invites = resolvedUsers
    .map((row) => row.matrix_user_id)
    .filter((matrixUserId) => matrixUserId && matrixUserId !== currentUserId);
  const serverName = currentUserId.slice(currentUserId.indexOf(":") + 1);
  const roomResult = await matrixClient.createRoom({
    name: title.trim(),
    visibility: "private",
    preset: "private_chat",
    invite: invites,
    initial_state: [
      {
        type: "m.room.encryption",
        state_key: "",
        content: { algorithm: "m.megolm.v1.aes-sha2" },
      },
      {
        type: "m.space.parent",
        state_key: conversation.matrix_space_id,
        content: { via: [serverName], canonical: false },
      },
    ],
  });
  const roomId = roomResult?.room_id;
  if (!roomId) throw new MatrixSecureError("Matrix did not create the encrypted topic room.", "topic_creation_failed");
  await matrixClient.sendStateEvent(conversation.matrix_space_id, "m.space.child", {
    via: [serverName],
    suggested: true,
  }, roomId);
  return matrixPost(
    `/conversations/${conversation.id}/topics/`,
    { title: title.trim(), description, room_id: roomId },
    session,
  );
}

export function shutdownSecureMatrixClient() {
  try { client?.stopClient(); } catch { /* no-op */ }
  client = null;
  clientPromise = null;
  currentSession = null;
  secretStorageKeyCache.clear();
  recoveryKeyBytesPending?.fill(0);
  recoveryKeyBytesPending = null;
  recoveryKeyIdPending = null;
  if (releaseDeviceLock) releaseDeviceLock();
  releaseDeviceLock = null;
}
