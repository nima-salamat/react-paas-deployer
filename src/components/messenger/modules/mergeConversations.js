/**
 * Merge server conversation list into previous state without remounting
 * unchanged rows (preserves Avatar DOM / image cache).
 */
export function mergeConversations(prev, next) {
  if (!prev?.length) return next || [];
  if (!next?.length) return [];
  const prevMap = new Map(prev.map((c) => [String(c.id), c]));
  let changed = prev.length !== next.length;
  const merged = next.map((c) => {
    const old = prevMap.get(String(c.id));
    if (!old) {
      changed = true;
      return c;
    }
    const same =
      old.title === c.title
      && old.updated_at === c.updated_at
      && old.unread_count === c.unread_count
      && old.avatar === c.avatar
      && old.avatar_url === c.avatar_url
      && (old.peer?.avatar === c.peer?.avatar)
      && (old.peer?.username === c.peer?.username)
      && (old.last_message?.id === c.last_message?.id)
      && (old.last_message?.body === c.last_message?.body)
      && (old.is_pinned === c.is_pinned)
      && (old.draft_text || "") === (c.draft_text || "");
    if (same) return old;
    changed = true;
    // Never clobber a non-empty local draft with an empty server field
    const serverDraft = typeof c.draft_text === "string" ? c.draft_text : "";
    const localDraft = typeof old.draft_text === "string" ? old.draft_text : "";
    const draft_text = serverDraft.trim() ? serverDraft : (localDraft || serverDraft);
    return { ...old, ...c, draft_text };
  });
  return changed ? merged : prev;
}
