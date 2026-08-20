import { normalizeMessage } from "./callSystemMessage";

/** Session message cache (survives route remounts within the tab). */

export const MSG_SESSION_CACHE_KEY = "messenger.msgCache.v2";
export const MSG_SESSION_MAX_CONVS = 15;
export const MSG_SESSION_MAX_MSGS = 120;

export function slimMessageForCache(m) {
  if (!m || typeof m !== "object") return m;
  const n = normalizeMessage(m);
  return {
    id: n.id,
    body: n.body,
    created_at: n.created_at,
    updated_at: n.updated_at,
    sender: n.sender,
    attachments: n.attachments,
    reactions: n.reactions,
    reply_to: n.reply_to,
    reply_to_preview: n.reply_to_preview,
    forwarded_from_user: n.forwarded_from_user,
    is_edited: n.is_edited,
    is_deleted: n.is_deleted,
    is_system: n.is_system,
    is_scheduled: n.is_scheduled,
    scheduled_at: n.scheduled_at,
    read_state: n.read_state,
    seen_by: n.seen_by,
    delivered_to: n.delivered_to,
    type: n.type,
    metadata: n.metadata,
    pinned: n.pinned,
    _call_label: n._call_label,
    _call_icon: n._call_icon,
  };
}

export function readMessengerMsgCache() {
  try {
    const raw = sessionStorage.getItem(MSG_SESSION_CACHE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return new Map();
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function writeMessengerMsgCache(map) {
  try {
    const entries = Array.from(map.entries()).slice(-MSG_SESSION_MAX_CONVS);
    const obj = {};
    for (const [k, v] of entries) {
      if (!v || !Array.isArray(v.messages)) continue;
      obj[k] = {
        ...v,
        messages: v.messages.slice(-MSG_SESSION_MAX_MSGS).map(slimMessageForCache),
      };
    }
    sessionStorage.setItem(MSG_SESSION_CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* quota */
  }
}

export function touchMessengerMsgCache(map, key, patch) {
  const prev = map.get(key) || { messages: [], hasMore: true };
  map.set(key, { ...prev, ...patch });
  writeMessengerMsgCache(map);
  return map;
}
