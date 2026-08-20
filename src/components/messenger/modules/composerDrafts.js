/** Composer text drafts — local cache + backend/WS sync */

const DRAFTS_LS_KEY = "messenger.composerDrafts.v2";

function safeParse(raw) {
  try {
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

function storageGet() {
  try {
    const fromLs = safeParse(localStorage.getItem(DRAFTS_LS_KEY));
    if (Object.keys(fromLs).length) return fromLs;
  } catch { /* */ }
  try {
    return safeParse(sessionStorage.getItem(DRAFTS_LS_KEY));
  } catch {
    return {};
  }
}

function storageSet(all) {
  const payload = JSON.stringify(all);
  try {
    localStorage.setItem(DRAFTS_LS_KEY, payload);
  } catch { /* quota / private mode */ }
  try {
    sessionStorage.setItem(DRAFTS_LS_KEY, payload);
  } catch { /* */ }
}

export function readComposerDrafts() {
  return storageGet();
}

/**
 * Persist draft for a conversation.
 * Stores { text, updatedAt } so we can resolve conflicts with server.
 */
export function writeComposerDraft(convId, text) {
  if (convId == null) return;
  const key = String(convId);
  try {
    const all = storageGet();
    const t = String(text ?? "");
    if (!t.trim()) {
      delete all[key];
    } else {
      all[key] = { text: t, updatedAt: Date.now() };
    }
    storageSet(all);
  } catch {
    /* ignore */
  }
}

export function readComposerDraft(convId) {
  if (convId == null) return "";
  try {
    const all = storageGet();
    const entry = all[String(convId)];
    if (typeof entry === "string") return entry; // legacy
    if (entry && typeof entry.text === "string") return entry.text;
    return "";
  } catch {
    return "";
  }
}

export function readComposerDraftMeta(convId) {
  if (convId == null) return { text: "", updatedAt: 0 };
  try {
    const all = storageGet();
    const entry = all[String(convId)];
    if (typeof entry === "string") return { text: entry, updatedAt: 0 };
    if (entry && typeof entry.text === "string") {
      return { text: entry.text, updatedAt: Number(entry.updatedAt) || 0 };
    }
    return { text: "", updatedAt: 0 };
  } catch {
    return { text: "", updatedAt: 0 };
  }
}

/**
 * Prefer the newest non-empty draft: local vs server.
 * Server wins only when it has text and is not clearly older empty.
 */
export function resolveComposerDraft(convId, serverDraft) {
  const local = readComposerDraftMeta(convId);
  const server = typeof serverDraft === "string" ? serverDraft : "";
  if (local.text.trim() && !server.trim()) return local.text;
  if (server.trim() && !local.text.trim()) return server;
  if (local.text.trim() && server.trim()) {
    // Prefer local while typing on this device (always fresher for openChat)
    return local.text.length >= server.length ? local.text : server;
  }
  return local.text || server || "";
}
