export const LAST_LOGIN_IDENTIFIER_KEY = "paas.auth.last-identifier.v1";
export const AUTH_LIFECYCLE_KEY = "paas.auth.lifecycle.v1";
const SESSION_REAUTH_REQUIRED_KEY = "paas.auth.reauth-required.v1";

export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function isSessionBoundToken(token) {
  return Boolean(decodeJwtPayload(token)?.sid);
}

export function clearStoredAuth(storage) {
  storage?.removeItem?.("access");
  storage?.removeItem?.("refresh");
}

function safeStorage(name) {
  try {
    return typeof window !== "undefined" ? window[name] : null;
  } catch {
    return null;
  }
}

export function recordAuthLifecycleEvent(event, reason = "") {
  const storage = safeStorage("localStorage");
  try {
    storage?.setItem?.(AUTH_LIFECYCLE_KEY, JSON.stringify({
      event,
      reason: String(reason || "").slice(0, 80),
      occurredAt: Date.now(),
      eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    }));
  } catch {
    // The in-tab CustomEvent remains the fallback when storage is unavailable.
  }
}

export function rememberLoginIdentifier({ username = "", email = "", phone = "", method = "" } = {}, storage = safeStorage("localStorage")) {
  const safe = {
    username: String(username || "").trim().slice(0, 255),
    email: String(email || "").trim().slice(0, 255),
    phone: String(phone || "").trim().slice(0, 64),
    method: ["email", "phone"].includes(method) ? method : "",
  };
  if (!safe.username && !safe.email && !safe.phone) return;
  try {
    storage?.setItem?.(LAST_LOGIN_IDENTIFIER_KEY, JSON.stringify(safe));
  } catch {
    // Remembering an identifier is optional; credentials are never persisted here.
  }
}

export function readLastLoginIdentifier(storage = safeStorage("localStorage")) {
  try {
    const value = JSON.parse(storage?.getItem?.(LAST_LOGIN_IDENTIFIER_KEY) || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return {
      username: typeof value.username === "string" ? value.username.slice(0, 255) : "",
      email: typeof value.email === "string" ? value.email.slice(0, 255) : "",
      phone: typeof value.phone === "string" ? value.phone.slice(0, 64) : "",
      method: ["email", "phone"].includes(value.method) ? value.method : "",
    };
  } catch {
    return {};
  }
}

export function clearRememberedLoginIdentifier(storage = safeStorage("localStorage")) {
  try {
    storage?.removeItem?.(LAST_LOGIN_IDENTIFIER_KEY);
  } catch {
    // Continue clearing authentication credentials even if storage is unavailable.
  }
}

export function clearSessionReauthRequired(storage = safeStorage("sessionStorage")) {
  try {
    storage?.removeItem?.(SESSION_REAUTH_REQUIRED_KEY);
  } catch {
    // Optional in-tab state.
  }
}

export function isSessionReauthRequired(storage = safeStorage("sessionStorage")) {
  try {
    return storage?.getItem?.(SESSION_REAUTH_REQUIRED_KEY) === "1";
  } catch {
    return false;
  }
}

function readLifecycleEventFromStorage() {
  try {
    const value = JSON.parse(safeStorage("localStorage")?.getItem?.(AUTH_LIFECYCLE_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Mark a hard authentication rejection without navigating away from the
 * current route. Only Django bearer tokens are discarded: Matrix credentials,
 * device identity and local crypto storage belong to a separate session.
 */
export function expireStoredAuth(storage, reason = "session_expired") {
  let hadCredentials = false;
  try {
    hadCredentials = Boolean(
      storage?.getItem?.("access") || storage?.getItem?.("refresh"),
    );
  } catch {
    // Still notify the app; the browser may have blocked storage access.
  }

  let expiryAlreadyPending = isSessionReauthRequired();
  if (!expiryAlreadyPending) {
    try {
      expiryAlreadyPending = readLifecycleEventFromStorage()?.event === "expired";
    } catch {
      expiryAlreadyPending = false;
    }
  }

  // A public endpoint may return 401 even when the visitor never had a
  // session. Do not turn an unauthenticated error into a global login modal.
  if (!hadCredentials && !expiryAlreadyPending) {
    clearStoredAuth(storage);
    return;
  }

  recordAuthLifecycleEvent("expired", reason);
  clearStoredAuth(storage);
  try {
    safeStorage("sessionStorage")?.setItem?.(SESSION_REAUTH_REQUIRED_KEY, "1");
  } catch {
    // The in-tab event below still opens the dialog.
  }

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent("session-expired", {
        detail: { reason, hadCredentials, occurredAt: Date.now() },
      }));
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("auth"));
    } catch {
      /* Ignore browser event errors. */
    }
  }
}

export function isAuthRoute(pathname) {
  const path = String(pathname || "");
  return path.includes("signin") || path.includes("signup") || path.includes("login");
}

export function invalidateSessionlessAuth(storage) {
  expireStoredAuth(storage, "session_context_missing");
}

export function getSessionBoundAccessToken(storage) {
  let token = null;
  try {
    token = storage?.getItem?.("access") || null;
  } catch {
    return null;
  }

  if (token && !isSessionBoundToken(token)) {
    invalidateSessionlessAuth(storage);
    return null;
  }

  return token;
}
