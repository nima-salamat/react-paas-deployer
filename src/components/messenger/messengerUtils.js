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
 *
 * IMPORTANT: group avatar URLs are now served by ProtectedMediaView, which
 * requires JWT auth. <img> tags can't send Authorization headers, so we
 * append ?token=<jwt> via withTokenQuery(). User avatars go through the
 * same ProtectedMediaView path so they also need the token.
 */
export function convAvatar(c, meId) {
  if (!c) return undefined;
  if (c.type === "group") {
    const url = c.avatar_url || c.avatar;
    return url ? withTokenQuery(url) : undefined;
  }
  // Trust peer object even when avatar is null (privacy-restricted)
  if (c.peer) {
    const url = c.peer.avatar;
    return url ? withTokenQuery(url) : undefined;
  }
  const meStr = String(meId ?? "");
  const other = (c.participants || []).find((p) => String(p.user?.id) !== meStr);
  const url = other?.user?.avatar;
  return url ? withTokenQuery(url) : undefined;
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

  // Images first
  if (kind === "image" || kind === "gif" || ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) {
    return "image";
  }

  // Voice MUST be checked before .webm video extension — MediaRecorder voice
  // messages are typically audio/webm named voice_*.webm. Treating them as
  // video produced empty black VideoPlayer bubbles.
  if (
    kind === "voice" ||
    name.startsWith("voice_") ||
    ct === "audio/webm" ||
    ct === "audio/ogg" ||
    ct === "audio/opus"
  ) {
    return "audio";
  }

  // Explicit audio kinds / extensions (music files)
  if (
    kind === "audio" ||
    ct.startsWith("audio/") ||
    /\.(mp3|wav|ogg|m4a|aac|opus)$/.test(name)
  ) {
    return "audio";
  }

  // Video (including circular video messages: video_message_*.webm)
  if (
    kind === "video" ||
    ct.startsWith("video/") ||
    /\.(mp4|webm|mov|mkv)$/.test(name)
  ) {
    return "video";
  }

  if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("text/") || /\.(txt|md|csv|log|json)$/.test(name)) return "text";
  return "file";
}

/** Whether an attachment is a voice message (vs. a regular audio file). */

/**
 * If body is ONLY emoji (1–3 grapheme clusters) with optional whitespace,
 * return the count; otherwise null. Used for Telegram-style big-emoji bubbles.
 */
export function emojiOnlyCount(body) {
  if (body == null) return null;
  const s = String(body).trim();
  if (!s) return null;
  try {
    const stripped = s.replace(
      /(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)|\p{Emoji_Component}|\s/gu,
      ""
    );
    if (stripped.length > 0) return null;
    const matches = s.match(
      /\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*/gu
    );
    if (!matches || matches.length === 0) return null;
    return matches.length;
  } catch {
    return null;
  }
}

/** True when attachment is an animated GIF (or named .gif). */
export function isGifAttachment(a) {
  const ct = (a?.content_type || "").toLowerCase();
  const name = (a?.original_filename || a?.name || "").toLowerCase();
  const kind = (a?.kind || "").toLowerCase();
  return kind === "gif" || ct === "image/gif" || name.endsWith(".gif");
}

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
 *  Backend AttachmentDownloadAPIView + ProtectedMediaView accept ?token= as
 *  alternative auth.
 *
 *  SAFETY: only append to the API host (same-origin OR VITE_API_BASE) — never
 *  leak the JWT to a third-party host. The backend typically returns relative
 *  URLs like "/media/images/xxx.jpg" so we resolve them against VITE_API_BASE
 *  before comparing. */
/**
 * Attach JWT access token as ?token= so <img>/<audio>/<video> can load
 * protected media (ProtectedMediaView + AttachmentDownloadAPIView).
 *
 * - Resolves relative paths against the API host (VITE_API_BASE)
 * - Only attaches token for our API origin (never leaks JWT)
 * - Replaces an existing token= so a refreshed access token is used
 * - Safe for data: blob: and already-tokenized URLs
 */
export function withTokenQuery(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const rawBase = (import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!rawBase) {
    // Misconfigured env — still try relative resolution on current origin
    const token = localStorage.getItem("access");
    if (!token) return url;
    try {
      const u = new URL(url, window.location.origin);
      u.searchParams.set("token", token);
      return u.toString();
    } catch {
      return url;
    }
  }

  const apiHost = `https://${rawBase}`;
  let abs = url;
  if (url.startsWith("/")) {
    abs = `${apiHost}${url}`;
  } else if (!/^https?:\/\//i.test(url)) {
    abs = `${apiHost}/${url}`;
  }

  try {
    const u = new URL(abs);
    const apiOrigin = new URL(apiHost).origin;
    // Only attach token for our API (or same origin if media is co-hosted)
    if (u.origin !== apiOrigin && u.origin !== window.location.origin) {
      return url;
    }
    const token = localStorage.getItem("access");
    if (!token) {
      // Still return absolute API URL so the browser does not hit the SPA origin
      return u.toString();
    }
    // Always refresh the token query param (handles rotated access tokens)
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    return url;
  }
}

export function mediaUrl(url) {
  return withTokenQuery(url);
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


/**
 * Parse message body into rich segments for rendering.
 * Supports (Telegram-style markers stored as plain text):
 *   ||spoiler||   — hidden until clicked
 *   `inline code`
 *   ``` ... ```   — multiline code block
 *   > quote        — lines starting with "> "
 *   @mention
 * Returns array of { type, value } where type is one of:
 *   text | mention | spoiler | code | codeblock | quote
 */
/**
 * Parse message body into rich segments for rendering.
 * Supports (Telegram-style markers stored as plain text):
 *   ||spoiler||   — hidden until clicked
 *   `inline code`
 *   ``` ... ```   — multiline code block
 *   > quote        — lines starting with "> "
 *   @mention
 * Returns [{ type, value }] type ∈ text|mention|spoiler|code|codeblock|quote
 */
export function parseFormattedBody(body) {
  if (!body || typeof body !== "string") return [];

  // Extract fenced code blocks first so inner markers stay literal
  const parts = [];
  const fenceRe = /```([\w+-]*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m;
  while ((m = fenceRe.exec(body)) !== null) {
    if (m.index > last) parts.push({ kind: "raw", value: body.slice(last, m.index) });
    const lang = (m[1] || "").trim().toLowerCase();
    const code = m[2].replace(/^\n/, "").replace(/\n$/, "");
    parts.push({ kind: "codeblock", value: code, lang });
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push({ kind: "raw", value: body.slice(last) });
  if (!parts.length) parts.push({ kind: "raw", value: body });

  const out = [];
  const inlineRe = /(\|\|[\s\S]+?\|\||`[^`\n]+`|@[A-Za-z][A-Za-z0-9_]{2,31})/g;

  const parseInline = (chunk) => {
    if (!chunk) return;
    let iLast = 0;
    let im;
    inlineRe.lastIndex = 0;
    while ((im = inlineRe.exec(chunk)) !== null) {
      if (im.index > iLast) out.push({ type: "text", value: chunk.slice(iLast, im.index) });
      const tok = im[1];
      if (tok.startsWith("||") && tok.endsWith("||") && tok.length >= 4) {
        out.push({ type: "spoiler", value: tok.slice(2, -2) });
      } else if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
        out.push({ type: "code", value: tok.slice(1, -1) });
      } else if (tok.startsWith("@")) {
        out.push({ type: "mention", value: tok.slice(1) });
      } else {
        out.push({ type: "text", value: tok });
      }
      iLast = im.index + tok.length;
    }
    if (iLast < chunk.length) out.push({ type: "text", value: chunk.slice(iLast) });
  };

  const parseRaw = (raw) => {
    const lines = raw.split("\n");
    let quoteLines = [];
    const flushQuote = () => {
      if (!quoteLines.length) return;
      out.push({ type: "quote", value: quoteLines.join("\n") });
      quoteLines = [];
    };
    lines.forEach((line, idx) => {
      if (/^>\s?/.test(line)) {
        quoteLines.push(line.replace(/^>\s?/, ""));
        return;
      }
      flushQuote();
      if (idx > 0) out.push({ type: "text", value: "\n" });
      parseInline(line);
    });
    flushQuote();
  };

  for (const part of parts) {
    if (part.kind === "codeblock") out.push({ type: "codeblock", value: part.value, lang: part.lang || "" });
    else parseRaw(part.value);
  }

  const merged = [];
  for (const seg of out) {
    if (seg.type === "text" && merged.length && merged[merged.length - 1].type === "text") {
      merged[merged.length - 1].value += seg.value;
    } else if (!(seg.type === "text" && seg.value === "")) {
      merged.push({ ...seg });
    }
  }
  return merged;
}


/** In-memory blob cache for messenger attachments (Telegram-style offline-ready preview). */
const _attCache = new Map(); // key -> { status, progress, blobUrl, blob, error, contentType }

export function getCachedAttachment(key) {
  return _attCache.get(String(key)) || null;
}

export function clearAttachmentCache(key) {
  const k = String(key);
  const cur = _attCache.get(k);
  if (cur?.blobUrl) {
    try { URL.revokeObjectURL(cur.blobUrl); } catch { /* */ }
  }
  _attCache.delete(k);
}

/**
 * Download an attachment into a blob URL with progress (0..1).
 * Reuses cache if already ready. onProgress(progress, status) optional.
 */
export async function downloadAttachmentToCache(att, authHeaders = {}, onProgress) {
  const key = String(att?.id || att?.url || "");
  if (!key || !att?.url) throw new Error("No attachment url");

  const existing = _attCache.get(key);
  if (existing?.status === "ready" && existing.blobUrl) {
    onProgress?.(1, "ready");
    return existing;
  }
  if (existing?.status === "downloading" && existing._promise) {
    return existing._promise;
  }

  const entry = {
    status: "downloading",
    progress: 0,
    blobUrl: null,
    blob: null,
    error: null,
    contentType: att.content_type || "",
    filename: att.original_filename || "file",
    _promise: null,
  };
  _attCache.set(key, entry);

  const promise = (async () => {
    try {
      const url = withTokenQuery(att.url);
      const headers = { ...(authHeaders || {}) };
      // browser sets content-type for FormData; for fetch of media Authorization is enough
      const res = await fetch(url, { headers, credentials: "include" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      const total = Number(res.headers.get("Content-Length")) || 0;
      const ctype = res.headers.get("Content-Type") || entry.contentType || "application/octet-stream";
      entry.contentType = ctype;

      let blob;
      if (res.body && typeof res.body.getReader === "function" && total > 0) {
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength || value.length || 0;
          entry.progress = Math.min(0.99, received / total);
          onProgress?.(entry.progress, "downloading");
        }
        blob = new Blob(chunks, { type: ctype });
      } else {
        blob = await res.blob();
        entry.progress = 0.99;
        onProgress?.(0.99, "downloading");
      }

      const blobUrl = URL.createObjectURL(blob);
      entry.blob = blob;
      entry.blobUrl = blobUrl;
      entry.progress = 1;
      entry.status = "ready";
      entry._promise = null;
      onProgress?.(1, "ready");
      return entry;
    } catch (e) {
      entry.status = "error";
      entry.error = e?.message || "Download failed";
      entry._promise = null;
      onProgress?.(entry.progress || 0, "error");
      throw e;
    }
  })();

  entry._promise = promise;
  return promise;
}



/**
 * True mobile/tablet device (OS / UA / pointer), NOT "narrow browser window".
 * Use this for Enter-key behavior and soft-keyboard layout. Keep CSS breakpoints
 * (useMediaQuery) for responsive chrome (sidebar, padding, etc.).
 */
export function isMobileDevice() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  const platform = navigator.platform || "";
  const maxTouch = navigator.maxTouchPoints || 0;

  // Phones
  if (/iPhone|iPod/i.test(ua)) return true;
  // iPad (including iPadOS 13+ desktop UA)
  if (/iPad/i.test(ua) || (platform === "MacIntel" && maxTouch > 1)) return true;
  // Android
  if (/Android/i.test(ua)) return true;
  // Other mobile UAs
  if (/webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i.test(ua)) return true;

  // Touch-primary devices without fine hover (phones/tablets, not resized desktop)
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    // Desktop with a touch screen usually still has fine pointer + hover
    if (coarse && !fine && !canHover && maxTouch > 0) return true;
  } catch { /* */ }

  return false;
}

/** Cached at first call; UA/device class does not change mid-session. */
let _mobileDeviceCached = null;
export function getIsMobileDevice() {
  if (_mobileDeviceCached == null) _mobileDeviceCached = isMobileDevice();
  return _mobileDeviceCached;
}

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "🤔", "👎"];
export const PAGE_SIZE = 30;
