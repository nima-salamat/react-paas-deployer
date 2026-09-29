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

export function isAuthRoute(pathname) {
  const path = String(pathname || "");
  return path.includes("signin") || path.includes("signup") || path.includes("login");
}

export function invalidateSessionlessAuth(storage) {
  clearStoredAuth(storage);
  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("auth"));
    } catch {
      /* ignore browser event errors */
    }
    if (!isAuthRoute(window.location?.pathname)) {
      window.location.href = "/signin_or_signup";
    }
  }
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
