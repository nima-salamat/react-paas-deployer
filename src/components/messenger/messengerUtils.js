/** Shared messenger utilities (pure functions, no React). */

export function useAuthUserId() {
  try {
    const t = localStorage.getItem("access");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id ?? payload.user ?? null;
  } catch {
    return null;
  }
}

export function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/** Format seconds → "M:SS" (audio player / voice messages). */
export function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function convTitle(c, meId) {
  if (!c) return "";
  if (c.type === "group") return c.title || "Group";
  // For private chats, always use peer (even if peer.avatar is null due to privacy)
  if (c.peer) return c.peer.username || "User";
  const meStr = String(meId ?? "");
  const other = (c.participants || []).find((p) => String(p.user?.id) !== meStr);
  return other?.user?.username || "Chat";
}

/**
 * Avatar URL for a conversation.
 * BUGFIX: previously used `c.peer?.avatar` which is falsy when privacy restricts the
 * photo — the function then fell through to a participants.find() that compared
 * p.user?.id !== meId with strict !==, returning the FIRST participant (often the
 * current user) when meId was null/undefined (e.g. during initial token load).
 * Now we trust c.peer whenever it exists (even with null avatar), and the
 * participants fallback uses a type-safe String comparison with a "" default.
 *
 * For groups: prefer avatar_url (absolute URL from backend) over the relative avatar path.
 */
export function convAvatar(c, meId) {
  if (!c) return undefined;
  if (c.type === "group") return c.avatar_url || c.avatar || undefined;
  // Trust peer object even when avatar is null (privacy-restricted)
  if (c.peer) return c.peer.avatar || undefined;
  const meStr = String(meId ?? "");
  const other = (c.participants || []).find((p) => String(p.user?.id) !== meStr);
  return other?.user?.avatar || undefined;
}

/**
 * The "other" user in a private conversation.
 * Same bugfix as convAvatar — trust c.peer, and use type-safe comparison for fallback.
 */
export function peerUser(c, meId) {
  if (!c || c.type === "group") return null;
  if (c.peer) return c.peer;
  const meStr = String(meId ?? "");
  const other = (c.participants || []).find((p) => String(p.user?.id) !== meStr);
  return other?.user || null;
}

export function myRole(c, meId) {
  const meStr = String(meId ?? "");
  const p = (c?.participants || []).find((x) => String(x.user?.id) === meStr);
  return p?.role || "member";
}

export async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t || "");
    return true;
  } catch {
    return false;
  }
}

export function parseHash() {
  const h = (window.location.hash || "").replace(/^#/, "");
  if (h.startsWith("c/")) return { type: "c", value: h.slice(2) };
  if (h.startsWith("u/")) return { type: "u", value: decodeURIComponent(h.slice(2)) };
  return null;
}

export function setHash(type, value) {
  if (!type || value == null || value === "") {
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search);
    return;
  }
  const hash = type === "u" ? `#u/${encodeURIComponent(value)}` : `#c/${value}`;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", pathname + search + hash);
}

export function attachmentKind(a) {
  const kind = (a?.kind || "").toLowerCase();
  const ct = (a?.content_type || "").toLowerCase();
  const name = (a?.original_filename || "").toLowerCase();
  if (kind === "image" || kind === "gif" || ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return "image";
  if (kind === "video" || ct.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/.test(name)) return "video";
  // Voice and audio both render in the audio player; UI can distinguish via `kind === "voice"`
  if (kind === "audio" || kind === "voice" || ct.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|opus|webm)$/.test(name)) return "audio";
  if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("text/") || /\.(txt|md|csv|log|json)$/.test(name)) return "text";
  return "file";
}

/** Whether an attachment is a voice message (vs. a regular audio file). */
export function isVoiceAttachment(a) {
  const kind = (a?.kind || "").toLowerCase();
  const name = (a?.original_filename || "").toLowerCase();
  return kind === "voice" || name.startsWith("voice_");
}

/** Whether an attachment is a video message (circular, Telegram-style). */
export function isVideoMessageAttachment(a) {
  const name = (a?.original_filename || "").toLowerCase();
  return name.startsWith("video_message_");
}

/** Append the JWT as ?token=... to a URL — needed for <img src=...> since the
 *  browser cannot send Authorization headers with <img> requests.
 *  Backend AttachmentDownloadAPIView accepts ?token= as alternative auth. */
export function withTokenQuery(url) {
  if (!url) return url;
  const token = localStorage.getItem("access");
  if (!token) return url;
  const sep = url.indexOf("?") === -1 ? "?" : "&";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

/** Format unread count: 0..999 as number, >999 as "999+". */
export function formatUnread(n) {
  if (!n || n <= 0) return 0;
  if (n > 999) return "999+";
  return n;
}

/**
 * Split a message body into segments: plain text and @mentions.
 * Mentions must be a valid username (3-32 chars, alphanumeric + underscore,
 * starting with a letter). Returns [{type: 'text'|'mention', value: '...'}].
 *
 * Used to render clickable @mentions inside MessageBubble.
 */
export function parseMentions(body) {
  if (!body || typeof body !== "string") return [];
  // Match @username where username matches the backend validator (3-32 chars,
  // letter/digit/underscore, starting with a letter)
  const regex = /(@[A-Za-z][A-Za-z0-9_]{2,31})/g;
  const out = [];
  let last = 0;
  let m;
  while ((m = regex.exec(body)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", value: body.slice(last, m.index) });
    }
    out.push({ type: "mention", value: m[1].slice(1) }); // strip @
    last = m.index + m[1].length;
  }
  if (last < body.length) {
    out.push({ type: "text", value: body.slice(last) });
  }
  return out;
}

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "🤔", "👎"];
export const PAGE_SIZE = 30;
