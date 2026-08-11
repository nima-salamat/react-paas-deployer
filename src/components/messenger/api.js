/** Messenger API helpers */
export const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
export const MSG_API = `${API_HOST}/api/messenger`;
export const USERS_API = `${API_HOST}/users`;
export const WS_URL = `${API_HOST.replace(/^https/, "wss").replace(/^http/, "ws")}/ws/messenger/`;

export function unwrapData(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

export function unwrapList(res) {
  const body = res?.data;
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.results)) return body.results;
  if (body.data && Array.isArray(body.data.results)) return body.data.results;
  return [];
}

/** Build an Authorization header from localStorage JWT (used for fetch() calls
 *  that bypass apiRequest — e.g. fetching text-attachment content). */
export function authHeaders(extra = {}) {
  const token = localStorage.getItem("access");
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}
