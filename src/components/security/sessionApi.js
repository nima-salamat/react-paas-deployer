import apiRequest from "../customHooks/apiRequest.jsx";

const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");

const SELF_SESSIONS_URL = () => `${API_HOST}/auth/api/sessions/`;
const SELF_LOGOUT_ALL_URL = () => `${API_HOST}/auth/api/sessions/logout-all/`;
const SELF_DEVICES_URL = () => `${API_HOST}/auth/api/devices/`;

export async function fetchMySessions() {
  const response = await apiRequest({ method: "GET", url: SELF_SESSIONS_URL() });
  return response.data || {};
}

export async function revokeMySession(sessionId) {
  return apiRequest({
    method: "DELETE",
    url: `${SELF_SESSIONS_URL()}${encodeURIComponent(String(sessionId))}/`,
  });
}

export async function logoutAllMySessions() {
  const response = await apiRequest({
    method: "POST",
    url: SELF_LOGOUT_ALL_URL(),
    data: {},
  });
  return response.data || {};
}

export async function fetchMyDevices() {
  const response = await apiRequest({ method: "GET", url: SELF_DEVICES_URL() });
  return response.data || {};
}

export function adminUserSessionsUrl(userId) {
  return `${API_HOST}/api/users/admin/users/${encodeURIComponent(String(userId))}/sessions/`;
}

export async function fetchAdminUserSessions(userId) {
  const response = await apiRequest({
    method: "GET",
    url: adminUserSessionsUrl(userId),
  });
  return response.data?.data || response.data || {};
}

export async function revokeAdminUserSession(userId, sessionId) {
  return apiRequest({
    method: "DELETE",
    url: `${adminUserSessionsUrl(userId)}${encodeURIComponent(String(sessionId))}/`,
  });
}

export async function logoutAllAdminUserSessions(userId) {
  const response = await apiRequest({
    method: "POST",
    url: `${adminUserSessionsUrl(userId)}logout-all/`,
    data: {},
  });
  return response.data?.data || response.data || {};
}
