import { createClient } from "matrix-js-sdk";
import { decodeRecoveryKey } from "matrix-js-sdk/lib/crypto-api/recovery-key";

import { MSG_API, authHeaders } from "../api";
import { getSessionBoundAccessToken } from "../../customHooks/authSession.js";

const SESSION_KEY = "pd.matrix.secure-session.v1";
const PERSISTENT_DEVICE_KEY_PREFIX = "pd.matrix.device-id.v1:";
const DEVICE_MARKER_DB = "pd-messenger-matrix-device-marker";
const DEVICE_MARKER_STORE = "devices";

let client = null;
let clientPromise = null;
let currentSession = null;
let releaseDeviceLock = null;
let recoveryKeyBytesPending = null;
let recoveryKeyIdPending = null;
const secretStorageKeyCache = new Map();
const preparedSyncClients = new WeakSet();

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

function currentDjangoUserNamespace() {
  try {
    const token = getSessionBoundAccessToken(localStorage);
    const encoded = token?.split(".")?.[1];
    if (!encoded) return "";
    const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
    const id = payload.user_id ?? payload.user;
    return id == null ? "" : String(id);
  } catch {
    return "";
  }
}

function getOrCreatePersistentDeviceId() {
  const namespace = currentDjangoUserNamespace();
  if (!namespace) return { deviceId: newDeviceId(), createdNewDeviceId: true };
  const storageKey = `${PERSISTENT_DEVICE_KEY_PREFIX}${namespace}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (typeof existing === "string" && /^[A-Z0-9._=-]{4,255}$/.test(existing)) {
      return { deviceId: existing, createdNewDeviceId: false, storageKey };
    }
    const deviceId = newDeviceId();
    localStorage.setItem(storageKey, deviceId);
    return { deviceId, createdNewDeviceId: true, storageKey };
  } catch {
    return { deviceId: newDeviceId(), createdNewDeviceId: true };
  }
}

export function forgetPersistentMatrixDeviceId(deviceId) {
  const namespace = currentDjangoUserNamespace();
  if (!namespace || !deviceId) return;
  const storageKey = `${PERSISTENT_DEVICE_KEY_PREFIX}${namespace}`;
  try {
    if (localStorage.getItem(storageKey) === deviceId) localStorage.removeItem(storageKey);
  } catch { /* browser storage may be disabled */ }
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

async function acquireDeviceLock() {
  if (!globalThis.navigator?.locks?.request) {
    throw new MatrixSecureError(
      "This browser cannot safely coordinate Matrix encryption storage across tabs. Use a current browser that supports Web Locks.",
      "web_locks_unavailable",
    );
  }
  let release;
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const hold = new Promise((resolve) => { release = resolve; });
  // matrix-js-sdk's Rust crypto storage is profile-scoped. Use one exclusive
  // profile-wide lock, not one per Matrix device ID, so two different devices
  // cannot initialize concurrently against the same IndexedDB crypto store.
  // Always settle the readiness promise if the browser rejects the lock request.
  let lockTask;
  try {
    lockTask = globalThis.navigator.locks.request(
      "pd-matrix-crypto-store",
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
    ).catch(() => {
      rejectReady(new MatrixSecureError(
        "The browser could not lock the local Matrix encryption store. Close other Messenger tabs and retry.",
        "web_locks_failed",
      ));
      return undefined;
    });
  } catch {
    rejectReady(new MatrixSecureError(
      "The browser could not lock the local Matrix encryption store. Check browser privacy/storage settings and retry.",
      "web_locks_failed",
    ));
  }
  const acquired = await ready;
  if (!acquired) {
    await lockTask;
    return false;
  }
  // The lock request stays pending until the release callback is called.
  lockTask?.catch(() => {
    releaseDeviceLock = null;
  });
  return true;
}

async function validateStoredSession(session) {
  let response;
  try {
    response = await fetch(
      `${session.homeserverUrl.replace(/\/+$/, "")}/_matrix/client/v3/account/whoami`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    );
  } catch {
    throw new MatrixSecureError(
      "Could not reach the Matrix homeserver to validate this browser's existing device. The saved device session was preserved; retry when the connection is available.",
      "matrix_session_validation_unavailable",
    );
  }
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) {
    throw new MatrixSecureError(
      "The Matrix homeserver could not validate this browser's existing device session. The saved session was preserved; retry later.",
      "matrix_session_validation_unavailable",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new MatrixSecureError(
      "The Matrix homeserver returned an invalid device-session response. The saved session was preserved.",
      "matrix_session_validation_failed",
    );
  }
  if (data.user_id !== session.userId || data.device_id !== session.deviceId) return false;

  // The Matrix token must also belong to the Django account currently logged
  // in to this tab. A stale session from a previous app user is never reused.
  let bindingResponse;
  try {
    bindingResponse = await fetch(`${MSG_API}/secure/device-session/`, {
      headers: authHeaders({
        "X-Matrix-Access-Token": session.accessToken,
        "X-Matrix-Device-ID": session.deviceId,
      }),
    });
  } catch {
    throw new MatrixSecureError(
      "Could not contact Paas Deployer to verify this Matrix device. The saved device session was preserved; retry when connected.",
      "device_binding_unavailable",
    );
  }
  if (bindingResponse.status >= 500 || bindingResponse.status === 429) {
    throw new MatrixSecureError(
      "Paas Deployer could not verify this Matrix device right now. The saved session was preserved; retry later.",
      "device_binding_unavailable",
    );
  }

  let bindingBody;
  try {
    bindingBody = await bindingResponse.json();
  } catch {
    throw new MatrixSecureError(
      "Paas Deployer returned an invalid Matrix device-binding response. The saved session was preserved.",
      "device_binding_failed",
    );
  }
  if (!bindingResponse.ok || bindingBody?.success === false) {
    const reason = String(bindingBody?.message || bindingBody?.detail || "");
    // An expired/revoked/foreign Matrix device is genuinely invalid. In
    // contrast, a stale Django session or an unexplained authorization error
    // must not silently replace the browser's device and its only local keys.
    if (/matrix (?:access )?token.*(?:invalid|expired)|device.*(?:revoked|belongs to another|different device|not found)/i.test(reason)) {
      return false;
    }
    throw new MatrixSecureError(
      "Paas Deployer could not verify that the saved Matrix device belongs to the current app session. Sign in again and retry; the saved device session was preserved.",
      "device_binding_failed",
    );
  }

  const binding = bindingBody?.data || bindingBody;
  return binding?.valid === true && binding?.device_id === session.deviceId;
}

async function requestNewDeviceSession() {
  const remembered = getOrCreatePersistentDeviceId();
  const { deviceId } = remembered;
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
    createdNewDeviceId: remembered.createdNewDeviceId,
  };
  // Do not persist the "new ID" bookkeeping inside the reusable session; it is
  // only needed to decide whether a first-time failed device should be revoked.
  const stored = {
    deviceId: result.deviceId,
    userId: result.userId,
    accessToken: result.accessToken,
    homeserverUrl: result.homeserverUrl,
  };
  storeSession(stored);
  currentSession = stored;
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

async function revokeLostLocalDevice(deviceId) {
  if (!deviceId) return;
  forgetPersistentMatrixDeviceId(deviceId);
  try {
    await fetch(`${MSG_API}/secure/devices/${encodeURIComponent(deviceId)}/revoke/`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
  } catch {
    // The new device still receives a fresh random ID; never reuse the lost
    // device's ID even if remote revocation is temporarily unavailable.
  }
}

function safeInitializationError(error) {
  const name = typeof error?.name === "string" ? error.name.slice(0, 60) : "Error";
  const rawMessage = typeof error?.message === "string" ? error.message : "";
  const message = rawMessage
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/((?:access_token|refresh_token|token|password|authorization)\s*[=:]\s*)[^&\s,;]+/gi, "$1[redacted]")
    .replace(/([?&](?:access_token|refresh_token|password)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL]")
    .slice(0, 220);
  return message ? `${name}: ${message}` : name;
}

async function initializeClient() {
  let lockAcquired = false;
  let nextClient = null;
  let session = null;
  let createdDeviceSession = false;
  let deviceMarkerWritten = false;
  let stage = "checking browser crypto-store ownership";
  try {
    lockAcquired = await acquireDeviceLock();
    if (!lockAcquired) {
      throw new MatrixSecureError(
        "Matrix encryption is already open in another tab of this browser. Close the other Messenger tab before opening secure chats here.",
        "device_lock_conflict",
      );
    }

    stage = "restoring local Matrix device state";
    session = readSession();
    if (session) {
      const hasMarker = await hasDeviceMarker(session.deviceId);
      if (!hasMarker) {
        // The device's local crypto storage appears to have been lost. Revoke
        // the old session and never initialize fresh keys under its device ID.
        await revokeLostLocalDevice(session.deviceId);
        clearSession();
        session = null;
      }
    }

    stage = "validating or creating the Matrix device session";
    if (session && !(await validateStoredSession(session))) {
      // Do not carry a token across Django-account changes. The old device's
      // remote mapping is not trusted under the current logged-in account.
      clearSession();
      session = null;
    }
    if (!session) {
      session = await requestNewDeviceSession();
      createdDeviceSession = session.createdNewDeviceId !== false;
    }

    stage = "creating the Matrix client";
    nextClient = createClient({
      baseUrl: session.homeserverUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      deviceId: session.deviceId,
      cryptoCallbacks: cryptoCallbacks(),
    });

    stage = "initializing Matrix Rust/WASM encryption and IndexedDB";
    await nextClient.initRustCrypto();

    stage = "recording local device state";
    await writeDeviceMarker(session.deviceId);
    deviceMarkerWritten = true;

    stage = "starting Matrix synchronization";
    const markInitialSyncPrepared = (state) => {
      if (state !== "PREPARED") return;
      preparedSyncClients.add(nextClient);
      nextClient.off("sync", markInitialSyncPrepared);
    };
    nextClient.on("sync", markInitialSyncPrepared);
    nextClient.startClient({ initialSyncLimit: 40 });
    client = nextClient;
    currentSession = session;
    return client;
  } catch (error) {
    try { nextClient?.stopClient(); } catch { /* no-op */ }
    // If this initialization created a brand-new server-side Matrix device
    // but could not establish its local crypto store, retire that unusable
    // device rather than leaving an orphan on every retry. Preserve a device
    // that already had a local marker so a transient failure cannot silently
    // throw away the only working local key store/session binding.
    if (createdDeviceSession && !deviceMarkerWritten) {
      await revokeLostLocalDevice(session?.deviceId);
      clearSession();
    }
    if (lockAcquired && releaseDeviceLock) releaseDeviceLock();
    if (lockAcquired) releaseDeviceLock = null;
    if (error instanceof MatrixSecureError) throw error;
    throw new MatrixSecureError(
      `Matrix cryptography could not initialize while ${stage}. ${safeInitializationError(error)} Device encryption remains disabled; no message was sent.`,
      "crypto_init_failed",
    );
  }
}

export async function getSecureMatrixClient() {
  if (client) {
    const session = currentSession || readSession();
    if (session && await validateStoredSession(session)) return client;
    // The Django login changed or the Matrix device was revoked while this
    // tab stayed open. Clear cached auth and fail closed; a user gesture/reload
    // can establish a fresh, separate device.
    shutdownSecureMatrixClient();
    throw new MatrixSecureError(
      "The Matrix device no longer belongs to the current Messenger session. Reopen secure chat to establish a new device and recover keys.",
      "account_binding_changed",
    );
  }
  if (!clientPromise) {
    clientPromise = initializeClient().finally(() => { clientPromise = null; });
  }
  return clientPromise;
}

export function getSecureMatrixSession() {
  return currentSession || readSession();
}

export function hasSecureMatrixInitialSync(matrixClient) {
  return Boolean(
    matrixClient
    && (preparedSyncClients.has(matrixClient) || matrixClient.getSyncState?.() === "PREPARED"),
  );
}

export async function getRecoveryState(matrixClient) {
  const crypto = matrixClient.getCrypto();
  const [secretStatus, backupInfo, crossSigningReady] = await Promise.all([
    crypto.getSecretStorageStatus(),
    crypto.getKeyBackupInfo().catch(() => null),
    crypto.isCrossSigningReady().catch(() => false),
  ]);
  let deviceCount = null;
  let deviceInventoryUnavailable = false;
  try {
    const response = await fetch(`${MSG_API}/secure/devices/`, {
      headers: authHeaders({
        "X-Matrix-Device-ID": matrixClient.getDeviceId(),
      }),
    });
    const body = await response.json();
    const data = body?.data || body;
    if (response.ok && Array.isArray(data?.results)) {
      deviceCount = data.results.filter((row) => !row.revoked_at).length;
    } else {
      deviceInventoryUnavailable = true;
    }
  } catch {
    // Unknown inventory is not the same as an actual count. Never fabricate it.
    deviceInventoryUnavailable = true;
  }

  if (secretStatus.ready && backupInfo) {
    try {
      const checked = await crypto.checkKeyBackupAndEnable();
      if (
        checked?.trustInfo?.trusted === true
        && checked?.trustInfo?.matchesDecryptionKey === true
      ) {
        return { state: "ready", backupInfo, crossSigningReady, deviceCount, deviceInventoryUnavailable };
      }
    } catch {
      // Continue below and require recovery rather than assuming key backup works.
    }
  }
  if (secretStatus.defaultKeyId || backupInfo) {
    return {
      state: "recovery_required",
      backupInfo,
      defaultKeyId: secretStatus.defaultKeyId,
      crossSigningReady,
      deviceCount,
      deviceInventoryUnavailable,
    };
  }
  // Multiple devices without an existing backup are not a reason to overwrite
  // anything: no backup exists. Let the user verify an existing device first,
  // or create a new backup while explicitly warning that old history may stay
  // unreadable without its keys.
  return {
    state: "needs_setup",
    backupInfo: null,
    crossSigningReady,
    deviceCount,
    historyMayBeUnavailable: deviceCount > 1,
  };
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
    if (
      !ready
      || backupCheck?.trustInfo?.trusted !== true
      || backupCheck?.trustInfo?.matchesDecryptionKey !== true
    ) {
      throw new MatrixSecureError("Matrix did not confirm that the encrypted key backup is trusted and matches this recovery key. Sending remains disabled.", "backup_not_ready");
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
    if (
      checked?.trustInfo?.trusted !== true
      || checked?.trustInfo?.matchesDecryptionKey !== true
    ) {
      throw new MatrixSecureError("The recovery key did not verify a trusted Matrix backup or does not match its decryption key.", "backup_untrusted");
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
  let crypto;
  try {
    crypto = matrixClient?.getCrypto?.();
  } catch {
    crypto = null;
  }
  if (!crypto) {
    throw new MatrixSecureError(
      "Matrix end-to-end encryption is not initialized on this device. Retry secure-device setup before sending.",
      "crypto_not_initialized",
    );
  }

  // Recovery is checked globally when Messenger opens and on demand in Settings.
  // A missing backup never blocks otherwise safe E2EE text/media messages.
  return { state: "not_checked" };
}



function encodeUnpaddedBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary).replace(/=+$/g, "");
}

function encodeBase64Url(value) {
  return encodeUnpaddedBase64(value).replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeUnpaddedBase64(value, { urlSafe = false } = {}) {
  if (typeof value !== "string" || !value) throw new MatrixSecureError("Encrypted attachment metadata is incomplete.", "invalid_encrypted_media");
  const normalized = urlSafe ? value.replace(/-/g, "+").replace(/_/g, "/") : value;
  const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function assertMatrixRoomReadyForMedia(matrixClient, roomId) {
  const room = matrixClient?.getRoom?.(roomId);
  if (!room || room.getMyMembership?.() !== "join") {
    throw new MatrixSecureError("Join the encrypted room before sending media.", "not_joined");
  }
  let events;
  try { events = room.currentState?.getStateEvents?.("m.room.member"); } catch { events = null; }
  if (!Array.isArray(events) || events.some((event) => event?.getContent?.()?.membership === "invite")) {
    throw new MatrixSecureError("Media sending is paused until all invited participants have joined the encrypted room.", "participants_pending");
  }
  return room;
}

/** Encrypt locally and upload ciphertext only, then send the descriptor through Matrix E2EE. */
export async function sendEncryptedMedia(matrixClient, roomId, file, options = {}) {
  if (!file || typeof file.arrayBuffer !== "function" || Number(file.size || 0) <= 0) {
    throw new MatrixSecureError("Choose a non-empty file to send.", "empty_media");
  }
  if (Number(file.size || 0) > 100 * 1024 * 1024) {
    throw new MatrixSecureError("Encrypted attachments are limited to 100 MiB per file.", "media_too_large");
  }
  assertMatrixRoomReadyForMedia(matrixClient, roomId);
  const crypto = matrixClient?.getCrypto?.();
  if (!crypto) throw new MatrixSecureError("Matrix encryption is not initialized.", "crypto_not_initialized");
  await assertSecureMessagingReady(matrixClient);
  if (!(await crypto.isEncryptionEnabledInRoom(roomId))) {
    throw new MatrixSecureError("Room encryption is not confirmed. Media sending has been stopped.", "encryption_lost");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || !globalThis.crypto?.getRandomValues) {
    throw new MatrixSecureError("This browser does not provide the cryptography required for encrypted attachments.", "crypto_unavailable");
  }

  const plainBytes = await file.arrayBuffer();
  const keyBytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(16));
  try {
    const key = await subtle.importKey("raw", keyBytes, { name: "AES-CTR" }, false, ["encrypt"]);
    const ciphertext = await subtle.encrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, plainBytes);
    const hash = await subtle.digest("SHA-256", ciphertext);
    const encryptedBlob = new Blob([ciphertext], { type: "application/octet-stream" });
    const uploaded = await matrixClient.uploadContent(encryptedBlob, {
      name: "encrypted-attachment.bin",
      type: "application/octet-stream",
      includeFilename: false,
    });
    const mxcUrl = uploaded?.content_uri || uploaded?.contentUri;
    if (typeof mxcUrl !== "string" || !mxcUrl.startsWith("mxc://")) {
      throw new MatrixSecureError("Matrix did not return a media content URI.", "media_upload_failed");
    }

    const mimeType = String(file.type || "application/octet-stream").slice(0, 255);
    const fallbackName = mimeType.startsWith("image/") ? "Image"
      : mimeType.startsWith("audio/") ? "Voice message"
        : mimeType.startsWith("video/") ? "Video" : "Attachment";
    const filename = String(file.name || options.filename || fallbackName).slice(0, 255);
    const msgtype = options.msgtype || (mimeType.startsWith("image/") ? "m.image"
      : mimeType.startsWith("audio/") ? "m.audio"
        : mimeType.startsWith("video/") ? "m.video" : "m.file");
    const info = { mimetype: mimeType, size: Number(file.size || plainBytes.byteLength) };
    const duration = Number(options.durationMs);
    if (Number.isFinite(duration) && duration >= 0 && (msgtype === "m.audio" || msgtype === "m.video")) {
      info.duration = Math.round(duration);
    }
    const content = {
      msgtype,
      body: String(options.caption || filename).slice(0, 1000),
      filename,
      info,
      file: {
        url: mxcUrl,
        key: {
          kty: "oct",
          key_ops: ["encrypt", "decrypt"],
          alg: "A256CTR",
          k: encodeBase64Url(keyBytes),
          ext: true,
        },
        iv: encodeUnpaddedBase64(iv),
        hashes: { sha256: encodeUnpaddedBase64(hash) },
        v: "v2",
      },
    };
    assertMatrixRoomReadyForMedia(matrixClient, roomId);
    if (!(await crypto.isEncryptionEnabledInRoom(roomId))) {
      throw new MatrixSecureError("Room encryption changed during upload. The media event was not sent.", "encryption_lost");
    }
    return await matrixClient.sendEvent(roomId, "m.room.message", content);
  } finally {
    keyBytes.fill(0);
    iv.fill(0);
  }
}

/** Download and authenticate ciphertext before decrypting an E2EE attachment. */
export async function decryptEncryptedMedia(matrixClient, message) {
  const encryptedFile = message?.file;
  if (!encryptedFile || encryptedFile.v !== "v2" || encryptedFile.key?.alg !== "A256CTR" || !encryptedFile.url?.startsWith("mxc://")) {
    throw new MatrixSecureError("The message does not contain a supported encrypted attachment.", "invalid_encrypted_media");
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new MatrixSecureError("This browser cannot decrypt encrypted attachments.", "crypto_unavailable");
  const url = matrixClient.mxcUrlToHttp(encryptedFile.url, undefined, undefined, undefined, false, true, true);
  if (!url) throw new MatrixSecureError("Matrix returned an invalid media URL.", "invalid_media_url");
  const mediaUrl = new URL(url);
  const homeserverUrl = new URL(matrixClient.getHomeserverUrl());
  if (mediaUrl.origin !== homeserverUrl.origin) {
    throw new MatrixSecureError("Encrypted media URL did not match the configured homeserver.", "media_origin_mismatch");
  }
  const token = matrixClient.getAccessToken?.();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "omit",
    redirect: "error",
  });
  if (!response.ok) throw new MatrixSecureError("Could not download the encrypted Matrix attachment.", "media_download_failed");
  const ciphertext = await response.arrayBuffer();
  const expectedHash = decodeUnpaddedBase64(encryptedFile.hashes?.sha256);
  const actualHash = new Uint8Array(await subtle.digest("SHA-256", ciphertext));
  if (expectedHash.length !== actualHash.length || expectedHash.some((byte, index) => byte !== actualHash[index])) {
    throw new MatrixSecureError("Encrypted media integrity verification failed; the file was not opened.", "media_hash_mismatch");
  }
  const iv = decodeUnpaddedBase64(encryptedFile.iv);
  if (iv.length !== 16) throw new MatrixSecureError("Encrypted media counter is invalid.", "invalid_media_iv");
  const key = await subtle.importKey("jwk", encryptedFile.key, { name: "AES-CTR" }, false, ["decrypt"]);
  const plaintext = await subtle.decrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, ciphertext);
  return new Blob([plaintext], { type: String(message.info?.mimetype || "application/octet-stream") });
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
      initial_state: [
        encryptionState,
        {
          type: "m.room.history_visibility",
          state_key: "",
          content: { history_visibility: "invited" },
        },
        parentState,
      ],
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
    initial_state: [
      encryptionState,
      {
        type: "m.room.history_visibility",
        state_key: "",
        content: { history_visibility: "invited" },
      },
    ],
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
        type: "m.room.history_visibility",
        state_key: "",
        content: { history_visibility: "invited" },
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
  clearSession();
  secretStorageKeyCache.clear();
  recoveryKeyBytesPending?.fill(0);
  recoveryKeyBytesPending = null;
  recoveryKeyIdPending = null;
  if (releaseDeviceLock) releaseDeviceLock();
  releaseDeviceLock = null;
}
