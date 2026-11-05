const PREFIX = "paas.profile-cache.v1:";
const VERSION = 1;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function storageOrNull(storage) {
  try { return storage || (typeof window !== "undefined" ? window.localStorage : null); }
  catch { return null; }
}

export function getProfileCacheKey(scope) {
  return typeof scope === "string" && scope ? PREFIX + encodeURIComponent(scope) : "";
}

export function readProfileCache(scope, storage) {
  const target = storageOrNull(storage);
  const key = getProfileCacheKey(scope);
  if (!target || !key) return null;
  try {
    const cached = JSON.parse(target.getItem(key) || "null");
    const savedAt = Number(cached?.savedAt);
    if (cached?.version !== VERSION || !Array.isArray(cached?.profiles) ||
        !Number.isFinite(savedAt) || savedAt > Date.now() ||
        Date.now() - savedAt > MAX_AGE_MS) {
      if (cached) target.removeItem(key);
      return null;
    }
    return cached.profiles.filter(p => p && typeof p === "object" && !Array.isArray(p));
  } catch { return null; }
}

export function writeProfileCache(scope, profiles, storage) {
  const target = storageOrNull(storage);
  const key = getProfileCacheKey(scope);
  if (!target || !key || !Array.isArray(profiles)) return false;
  try {
    // Store raw API objects, never derived image URLs with a short-lived token.
    target.setItem(key, JSON.stringify({
      version: VERSION,
      savedAt: Date.now(),
      profiles: profiles.filter(p => p && typeof p === "object" && !Array.isArray(p)).slice(0, 100),
    }));
    return true;
  } catch { return false; }
}

export function clearProfileCache(scope, storage) {
  const target = storageOrNull(storage);
  const key = getProfileCacheKey(scope);
  if (!target || !key) return false;
  try { target.removeItem(key); return true; }
  catch { return false; }
}
