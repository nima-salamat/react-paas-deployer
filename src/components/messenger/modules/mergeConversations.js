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
      && (old.is_pinned === c.is_pinned);
    if (same) return old;
    changed = true;
    return { ...old, ...c };
  });
  return changed ? merged : prev;
}
