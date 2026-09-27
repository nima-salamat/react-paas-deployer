/**
 * Merge server conversation list into previous state without remounting
 * unchanged rows (preserves Avatar DOM / image cache).
 */
import { readComposerDraft } from "./composerDrafts";

function conversationTimestamp(conv) {
  const value = conv?.last_message_at || conv?.created_at;
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Keep chat-list order deterministic:
 * pinned first, then newest activity, preserving input order for exact ties.
 */
export function sortConversations(items) {
  return (items || [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const aPinned = Boolean(a.item?.is_pinned);
      const bPinned = Boolean(b.item?.is_pinned);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;

      const activityDiff =
        conversationTimestamp(b.item) - conversationTimestamp(a.item);
      return activityDiff || (a.index - b.index);
    })
    .map(({ item }) => item);
}

export function mergeConversations(prev, next) {
  if (!prev?.length) {
    return sortConversations(
      (next || []).map((c) => {
        if (!c || c.id == null) return c;
        const local = readComposerDraft(c.id);
        if (!local.trim()) return c;
        // Prefer non-empty local over empty/missing server draft
        if (!(c.draft_text || "").trim()) return { ...c, draft_text: local };
        return c;
      })
    );
  }
  if (!next?.length) return [];

  // Reconcile server payload with the same client-side ordering rule.
  const orderedNext = sortConversations(next);
  const prevMap = new Map(prev.map((c) => [String(c.id), c]));
  const merged = orderedNext.map((c) => {
    const old = prevMap.get(String(c.id));
    if (!old) {
      const local = readComposerDraft(c.id);
      if (local.trim() && !(c.draft_text || "").trim()) {
        return { ...c, draft_text: local };
      }
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
    // Resolve draft: never clobber non-empty local (React state or localStorage)
    // with an empty server field. Prefer localStorage if state is also empty.
    const serverDraft = typeof c.draft_text === "string" ? c.draft_text : "";
    const stateDraft = typeof old.draft_text === "string" ? old.draft_text : "";
    const storedDraft = readComposerDraft(c.id);
    let draft_text = serverDraft;
    if (!serverDraft.trim()) {
      draft_text = stateDraft.trim() ? stateDraft : (storedDraft || serverDraft);
    } else if (storedDraft.trim() && storedDraft !== serverDraft) {
      // Local keystrokes are authoritative on this device until server catches up
      draft_text = storedDraft;
    }
    return { ...old, ...c, draft_text };
  });
  const orderedMerged = sortConversations(merged);
  const sameOrder =
    orderedMerged.length === prev.length &&
    orderedMerged.every((item, index) => item === prev[index]);

  return sameOrder ? prev : orderedMerged;
}
