/**
 * Parse and format __call__:… system message bodies.
 * Designed to never throw — bad bodies fall back to a generic "Call" label.
 */

const CALL_PREFIX = "__call__:";

function stripInvisible(s) {
  try {
    return String(s == null ? "" : s)
      .replace(/^\uFEFF/, "")
      .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
      .trim();
  } catch {
    return "";
  }
}

function tryParseJson(raw) {
  try {
    if (raw == null) return null;
    let t = stripInvisible(raw);
    if (!t) return null;
    if (
      (t.charAt(0) === '"' && t.charAt(t.length - 1) === '"')
      || (t.charAt(0) === "'" && t.charAt(t.length - 1) === "'")
    ) {
      try {
        const inner = JSON.parse(t);
        if (typeof inner === "string") t = stripInvisible(inner);
        else if (inner && typeof inner === "object") return inner;
      } catch { /* continue */ }
    }
    try {
      const data = JSON.parse(t);
      if (data && typeof data === "object") return data;
    } catch { /* */ }
    try {
      const end = t.lastIndexOf("}");
      if (end > 0) {
        const data = JSON.parse(t.slice(0, end + 1));
        if (data && typeof data === "object") return data;
      }
    } catch { /* */ }
    return null;
  } catch {
    return null;
  }
}

export function parseCallSystemBody(body) {
  try {
    if (body == null) return null;
    if (typeof body === "object" && !Array.isArray(body)) {
      if (body.event || body.call_id || body.status || body.v != null) return body;
      if (typeof body.body === "string") return parseCallSystemBody(body.body);
      return null;
    }
    const s = stripInvisible(body);
    if (!s) return null;
    const idx = s.indexOf(CALL_PREFIX);
    if (idx < 0) {
      const asJson = tryParseJson(s);
      if (asJson && (asJson.event || asJson.call_id)) return asJson;
      return null;
    }
    return tryParseJson(s.slice(idx + CALL_PREFIX.length));
  } catch {
    return null;
  }
}

export function isCallSystemBody(body) {
  try {
    if (body == null) return false;
    if (typeof body === "object" && !Array.isArray(body)) {
      return !!(body.event || body.call_id || body.v != null);
    }
    const s = stripInvisible(body);
    if (s.indexOf(CALL_PREFIX) >= 0) return true;
    return parseCallSystemBody(body) != null;
  } catch {
    return false;
  }
}

function fmtDuration(seconds) {
  try {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m + ":" + String(sec).padStart(2, "0");
  } catch {
    return "0:00";
  }
}

export function formatCallSystemLabel(bodyOrPayload) {
  try {
    let callInfo = null;
    if (
      bodyOrPayload
      && typeof bodyOrPayload === "object"
      && !Array.isArray(bodyOrPayload)
      && (bodyOrPayload.event || bodyOrPayload.call_id || bodyOrPayload.status || bodyOrPayload.v != null)
    ) {
      callInfo = bodyOrPayload;
    } else {
      callInfo = parseCallSystemBody(bodyOrPayload);
    }
    if (!callInfo) {
      if (isCallSystemBody(bodyOrPayload)) return "Call";
      return null;
    }

    const isVideo = !!callInfo.is_video;
    const dur = Number(callInfo.duration || 0);
    const who = callInfo.initiator_username || "Someone";
    const st = String(callInfo.status || "ended");

    if (callInfo.event === "started" || st === "ringing") {
      return isVideo ? (who + " started a video call") : (who + " started a voice call");
    }
    if (st === "missed" || st === "no_answer") {
      return isVideo ? "Missed video call" : "Missed voice call";
    }
    if (st === "declined") {
      return isVideo ? "Declined video call" : "Declined voice call";
    }
    if (st === "busy") {
      return isVideo ? "Busy · video call" : "Busy · voice call";
    }
    if (dur > 0) {
      return isVideo
        ? ("Video call · " + fmtDuration(dur))
        : ("Voice call · " + fmtDuration(dur));
    }
    return isVideo ? "Video call ended" : "Voice call ended";
  } catch {
    return "Call";
  }
}

/** Prefer plain ASCII marker for max browser compatibility (Opera etc.). */
export function callSystemIcon(callInfoOrBody) {
  try {
    const info =
      callInfoOrBody
      && typeof callInfoOrBody === "object"
      && !Array.isArray(callInfoOrBody)
        ? callInfoOrBody
        : parseCallSystemBody(callInfoOrBody);
    return info && info.is_video ? "cam" : "phone";
  } catch {
    return "phone";
  }
}

export function normalizeMessage(m) {
  try {
    if (!m || typeof m !== "object") return m;
    const body = m.body;
    if (!isCallSystemBody(body)) return m;
    return {
      ...m,
      is_system: true,
      _call_label: formatCallSystemLabel(body) || "Call",
      _call_icon: callSystemIcon(body),
    };
  } catch {
    return m;
  }
}

export function normalizeMessages(list) {
  try {
    if (!Array.isArray(list)) return list;
    return list.map(normalizeMessage);
  } catch {
    return list;
  }
}
