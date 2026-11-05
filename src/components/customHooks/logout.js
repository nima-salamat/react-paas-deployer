import {
  clearStoredAuth,
  decodeJwtPayload,
  getSessionBoundAccessToken,
  clearRememberedLoginIdentifier,
  clearSessionReauthRequired,
  recordAuthLifecycleEvent,
} from "./authSession.js";
import { revokeMySession } from "../security/sessionApi.js";
import { logoutSecureMatrixSession } from "../messenger/secure/MatrixSecureClient.js";

/**
 * User-confirmed logout for this browser.
 *
 * Matrix is logged out before Django's session is revoked, because the Matrix
 * token must still be available locally for the homeserver logout request.
 * Automatic token expiry deliberately does not call this function. It keeps
 * the non-secret remembered identifier for the in-place reauthentication UI.
 */
export async function logoutCurrentBrowser({ revokeDjangoSession = true, logoutMatrix = true } = {}) {
  // Tell other tabs that this is an intentional logout, not a refresh-token
  // rejection. The lifecycle marker is written before bearer tokens disappear.
  recordAuthLifecycleEvent("logout", "user_initiated");
  let storage = null;
  let sessionId = null;

  try {
    storage = typeof window !== "undefined" ? window.localStorage : null;
    const accessToken = getSessionBoundAccessToken(storage);
    sessionId = decodeJwtPayload(accessToken)?.sid || null;
  } catch {
    // Local credential cleanup must continue even if browser storage is blocked.
  }

  let matrixLogout = null;
  try {
    if (logoutMatrix) matrixLogout = await logoutSecureMatrixSession();
  } catch (error) {
    // The Matrix helper is designed to clear locally in all cases, but keep
    // logout fail-safe if a browser API unexpectedly throws.
    console.warn("Matrix local logout cleanup encountered an error.", error);
  }

  let djangoSessionRevoked = false;
  if (revokeDjangoSession && sessionId) {
    try {
      // This endpoint permits the current session to revoke itself. Do this
      // only after Matrix logout so auth failures cannot hide its local token.
      await revokeMySession(sessionId);
      djangoSessionRevoked = true;
    } catch {
      // An expired, already-revoked or offline Django session must not block
      // the user's explicit local sign-out.
    }
  }

  try {
    clearStoredAuth(storage);
    clearRememberedLoginIdentifier();
    clearSessionReauthRequired();
  } catch {
    // Continue with navigation/event notification when storage is unavailable.
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event("auth-logged-out"));
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("auth"));
    } catch {
      /* Ignore browser event errors. */
    }
  }

  return { matrixLogout, djangoSessionRevoked };
}
