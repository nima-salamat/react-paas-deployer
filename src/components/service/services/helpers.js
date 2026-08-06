export const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
export const PLANS_API = `${API_BASE}/plans/`;
export const NETWORK_API_ROOT = `${API_BASE}/api/networks/`;
export const VOLUME_API_ROOT = `${API_BASE}/api/volumes/`;
export const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
export const SERVICE_API = `${API_BASE}/services/service/`;

export const DB_PLATFORMS = new Set([
  "mysql",
  "mariadb",
  "postgresql",
  "postgres",
  "mongodb",
  "mongo",
  "redis",
  "oracle",
]);

export function getKey(s) {
  if (!s) return "null";
  if (s.id != null) return String(s.id);
  if (s.pk != null) return String(s.pk);
  return String(s.name || "");
}

export function friendlyError(err, fallback = "Something went wrong.") {
  if (!err) return fallback;
  const status = err?.response?.status;
  if (status === 404) return "Not found.";
  if (status === 403) return "You don't have permission.";
  if (status === 401) return "Please sign in again.";
  if (status === 409) {
    return (
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      "Conflict — try again later."
    );
  }
  const data = err?.response?.data;
  if (typeof data === "string" && data.length < 200) return data;
  if (data?.detail && typeof data.detail === "string") return data.detail;
  if (data?.error && typeof data.error === "string") return data.error;
  if (data?.result === "error" && data?.detail) return String(data.detail);
  if (err?.message && !String(err.message).includes("status code")) return err.message;
  return fallback;
}

export function extractList(data) {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

export function buildUrl(apiUrl, extraQueryParams, page, pageSize, query) {
  const base = apiUrl.startsWith("http") ? apiUrl : `${API_BASE}${apiUrl}`;
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", String(pageSize));
  if (query?.trim()) params.set("search", query.trim());
  Object.entries(extraQueryParams || {}).forEach(([k, v]) => {
    if (v != null && v !== "") params.set(k, String(v));
  });
  return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
}

export function resolveServiceKind(service, planCache = {}) {
  const planIsObj = service?.plan && typeof service.plan === "object";
  const planId = planIsObj ? service.plan.id ?? service.plan.pk : service?.plan;
  const plan = planIsObj ? service.plan : planCache[planId];
  const planType = String(plan?.plan_type || service?.plan_type || "")
    .toLowerCase()
    .trim();
  if (planType === "db" || planType === "database") return "db";
  if (planType === "app" || planType === "application") return "app";
  const platform = String(
    plan?.platform || service?.platform || service?.plan?.platform || ""
  )
    .toLowerCase()
    .trim();
  if (platform && DB_PLATFORMS.has(platform)) return "db";
  if (platform) return "app";
  return "unknown";
}

export function clampPct(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(Math.min(x, 100) * 100) / 100;
}

/** Live CPU/RAM % from service object or status map. */
export function resolveUsage(service, statusMap = {}) {
  if (!service) return { cpu: null, ram: null };
  const sid = String(service.id ?? service.pk ?? "");
  const live = statusMap[sid] || {};
  const stats = service.stats || service.metrics || service.usage || {};

  const cpu = clampPct(
    live.cpu ??
      service.cpu_percent ??
      service.cpu_usage ??
      service.cpu ??
      stats.cpu_percent ??
      stats.cpu_usage ??
      stats.cpu
  );
  const ram = clampPct(
    live.ram ??
      service.memory_percent ??
      service.ram_percent ??
      service.ram_usage ??
      service.memory_usage ??
      service.mem_percent ??
      stats.memory_percent ??
      stats.ram_percent ??
      stats.memory_usage ??
      stats.ram
  );
  return { cpu, ram };
}

export function volumesAttachedToService(volumes, serviceId) {
  if (!serviceId || !Array.isArray(volumes)) return [];
  const sid = String(serviceId);
  return volumes
    .filter((v) => {
      const owner = v.service?.id ?? v.service?.pk ?? v.service ?? null;
      if (owner != null && String(owner) === sid) return true;
      // Legacy fallback: service_attachments single key
      const att = v.service_attachments || {};
      return Object.keys(att).length === 1 && String(Object.keys(att)[0]) === sid;
    })
    .map((v) => String(v.id ?? v.pk));
}

export function sameListById(prev, next, extraKeys = []) {
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  return prev.every((p, i) => {
    const n = next[i];
    if (String(p.id ?? p.pk) !== String(n.id ?? n.pk)) return false;
    if (p.name !== n.name) return false;
    for (const k of extraKeys) {
      if (p[k] !== n[k]) return false;
    }
    return true;
  });
}
