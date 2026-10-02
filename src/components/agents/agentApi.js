import apiRequest from "../customHooks/apiRequest.jsx";

const API_BASE = "https://" + import.meta.env.VITE_API_BASE.replace(/\/+$/, "");
export const AGENTS_API = API_BASE + "/api/agents";

export async function listAgents(params = {}) {
  const res = await apiRequest({ method: "GET", url: AGENTS_API + "/", params });
  return res?.data || {};
}
export async function getAgent(id) {
  const res = await apiRequest({ method: "GET", url: AGENTS_API + "/" + id + "/" });
  return res?.data?.agent || res?.data || {};
}
export async function createAgent(payload) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/", data: payload });
  return res?.data || {};
}
export async function updateAgent(id, payload) {
  const res = await apiRequest({ method: "PATCH", url: AGENTS_API + "/" + id + "/", data: payload });
  return res?.data || {};
}
export async function listScopes() {
  const res = await apiRequest({ method: "GET", url: AGENTS_API + "/scopes/" });
  return res?.data || {};
}
export async function listCredentials(id) {
  const res = await apiRequest({ method: "GET", url: AGENTS_API + "/" + id + "/credentials/", params: { page_size: 100 } });
  return res?.data || {};
}
export async function issueCredential(id, payload = {}) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/" + id + "/credentials/", data: payload });
  return res?.data || {};
}
export async function rotateCredentials(id) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/" + id + "/credentials/rotate/", data: {} });
  return res?.data || {};
}
export async function revokeCredential(agentId, credentialId) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/" + agentId + "/credentials/" + credentialId + "/revoke/", data: {} });
  return res?.data || {};
}
export async function setAgentStatus(id, action) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/" + id + "/" + action + "/", data: {} });
  return res?.data || {};
}
export async function listAudit(id) {
  const res = await apiRequest({ method: "GET", url: AGENTS_API + "/" + id + "/audit/", params: { page_size: 100 } });
  return res?.data || {};
}
export async function downloadManifest(id) {
  const res = await apiRequest({ method: "POST", url: AGENTS_API + "/" + id + "/manifest/", responseType: "blob" });
  const blob = new Blob([res.data], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "AGENT-" + id + ".md";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally { URL.revokeObjectURL(url); }
}