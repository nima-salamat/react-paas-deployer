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
