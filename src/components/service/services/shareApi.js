/**
 * Service sharing API helpers.
 * apiBase should point to the services API root (e.g. "/api").
 */

export async function fetchUnifiedServices(apiBase, headers = {}) {
  const res = await fetch(`${apiBase}/services/unified/`, {
    headers: { Accept: "application/json", ...headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Failed to load services");
  }
  return data; // { mine, shared_with_me, shared_by_me }
}

export async function fetchSharedServices(apiBase, headers = {}, scope = "all") {
  const res = await fetch(
    `${apiBase}/services/shared/?scope=${encodeURIComponent(scope)}`,
    { headers: { Accept: "application/json", ...headers } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Failed to load shared services");
  }
  return data.shares || [];
}

export async function createShare(apiBase, headers, payload) {
  const res = await fetch(`${apiBase}/services/share/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Share failed");
  }
  return data.share;
}

export async function updateShare(apiBase, headers, shareId, payload) {
  const res = await fetch(`${apiBase}/services/shares/${shareId}/`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Update failed");
  }
  return data.share;
}

export async function unshare(apiBase, headers, shareId) {
  const res = await fetch(`${apiBase}/services/shares/${shareId}/`, {
    method: "DELETE",
    headers: { Accept: "application/json", ...headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Unshare failed");
  }
  return data;
}

export async function fetchSharePermissions(apiBase, headers, shareId) {
  const res = await fetch(
    `${apiBase}/services/shares/${shareId}/permissions/`,
    { headers: { Accept: "application/json", ...headers } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Failed to load permissions");
  }
  return data; // { permissions, is_owner, known_actions }
}

export async function fetchShareEvents(apiBase, headers, shareId) {
  const res = await fetch(
    `${apiBase}/services/shares/${shareId}/events/`,
    { headers: { Accept: "application/json", ...headers } }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.result === "error") {
    throw new Error(data.detail || "Failed to load events");
  }
  return data.events || [];
}
