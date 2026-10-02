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
export async function deleteAgent(id) {
  const res = await apiRequest({ method: "DELETE", url: AGENTS_API + "/" + id + "/" });
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
export async function generateManifest(id) {
  const res = await apiRequest({
    method: "POST",
    url: AGENTS_API + "/" + id + "/manifest/",
    responseType: "text",
  });
  const disposition = String(res?.headers?.["content-disposition"] || "");
  const match = disposition.match(/filename="([^"]+)"/i);
  return {
    content: String(res?.data || ""),
    filename: match?.[1] || "AGENT-" + id + ".md",
  };
}

export function downloadManifest(content, filename = "AGENT.md") {
  const blob = new Blob([String(content || "")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}