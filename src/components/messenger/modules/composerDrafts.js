/** Composer text drafts — local cache + backend/WS sync */

const DRAFTS_LS_KEY = "messenger.composerDrafts";

export function readComposerDrafts() {
  try {
    const raw = localStorage.getItem(DRAFTS_LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function writeComposerDraft(convId, text) {
  if (convId == null) return;
  const key = String(convId);
  try {
    const all = readComposerDrafts();
    const t = String(text || "");
    if (!t.trim()) delete all[key];
    else all[key] = t;
    localStorage.setItem(DRAFTS_LS_KEY, JSON.stringify(all));
  } catch {
    /* quota / private mode */
  }
}

export function readComposerDraft(convId) {
  if (convId == null) return "";
  try {
    const all = readComposerDrafts();
    return typeof all[String(convId)] === "string" ? all[String(convId)] : "";
  } catch {
    return "";
  }
}

/** Prefer server draft when present, then fall back to localStorage. */
export function resolveComposerDraft(convId, serverDraft) {
  if (typeof serverDraft === "string" && serverDraft.length) return serverDraft;
  return readComposerDraft(convId);
}
