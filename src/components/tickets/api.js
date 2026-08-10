/** Ticket & email API base — must use full host like the rest of the app. */
export const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
export const TICKETS_API = `${API_HOST}/api/tickets`;
export const EMAILS_API = `${API_HOST}/api/emails`;

/** Normalize list payloads from either {data: [...]} or DRF pagination. */
export function unwrapList(res) {
  const body = res?.data;
  if (!body) return [];
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.data)) return body.data;
  if (Array.isArray(body.results)) return body.results;
  return [];
}

export function unwrapData(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}
