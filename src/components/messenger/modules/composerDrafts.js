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
 *
 * Rules (same-device UX first):
 * 1. Local non-empty always wins when opening a chat on this device —
 *    localStorage is updated on every keystroke and is the source of truth.
 * 2. If local is empty, use server.
 * 3. If both empty → "".
 *
 * Optional serverUpdatedAt (ms) can be passed if the API ever provides it;
 * then we prefer the strictly newer side when both have text.
 */
export function resolveComposerDraft(convId, serverDraft, serverUpdatedAt = 0) {
  const local = readComposerDraftMeta(convId);
  const server = typeof serverDraft === "string" ? serverDraft : "";
  const localTrim = local.text.trim();
  const serverTrim = server.trim();

  if (localTrim && !serverTrim) return local.text;
  if (serverTrim && !localTrim) return server;
  if (!localTrim && !serverTrim) return "";

  // Both non-empty
  const sAt = Number(serverUpdatedAt) || 0;
  if (sAt > 0 && local.updatedAt > 0) {
    // Prefer strictly newer timestamp
    if (local.updatedAt >= sAt) return local.text;
    return server;
  }
  // No reliable server timestamp: local is fresher on this device
  // (written on every keystroke; server only via debounced WS).
  return local.text;
}

/**
 * Hydrate a conversations array with the best draft for each row
 * (localStorage takes priority when non-empty).
 */
export function hydrateConversationDrafts(conversations) {
  if (!Array.isArray(conversations)) return conversations || [];
  return conversations.map((c) => {
    if (!c || c.id == null) return c;
    const resolved = resolveComposerDraft(c.id, c.draft_text);
    if ((c.draft_text || "") === resolved) return c;
    return { ...c, draft_text: resolved };
  });
}

/**
 * Build the WS/API payload for the current draft of a conversation.
 * Returns null if nothing to send (same as last sync) when lastSynced is provided.
 */
export function draftPayload(convId, text) {
  return {
    type: "draft",
    conversation_id: Number(convId),
    text: String(text ?? ""),
  };
}
