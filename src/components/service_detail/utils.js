import { DB_PLATFORMS, MUTABLE_DB_CONFIG_KEYS } from "./constants";

export function parseDeployConfig(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) return { ...raw };
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* plain text config */
    }
  }
  return {};
}

export function getDeployPlatform(deploy) {
  const cfg = parseDeployConfig(deploy?.config);
  const p = String(cfg.platform || deploy?.platform || "").toLowerCase().trim();
  return p || "docker";
}

export function isDbPlatform(platformOrDeploy) {
  if (platformOrDeploy == null) return false;
  if (typeof platformOrDeploy === "string") {
    return DB_PLATFORMS.has(platformOrDeploy.toLowerCase().trim());
  }
  return DB_PLATFORMS.has(getDeployPlatform(platformOrDeploy));
}

export function buildConfigPayload(platform, { configText, dbFields, isDb }) {
  if (isDb) {
    const out = { platform };
    for (const key of MUTABLE_DB_CONFIG_KEYS) {
      const v = dbFields?.[key];
      if (v === undefined || v === null || String(v).trim() === "") continue;
      if (key === "port") {
        const n = Number(v);
        if (!Number.isNaN(n)) out.port = n;
        else out.port = v;
      } else if (key === "env") {
        try {
          out.env = typeof v === "string" ? JSON.parse(v || "{}") : v;
        } catch {
          out.env = v;
        }
      } else {
        out[key] = v;
      }
    }
    if (
      (platform === "mysql" || platform === "mariadb") &&
      !String(out.root_password || "").trim() &&
      String(out.password || "").trim()
    ) {
      out.root_password = String(out.password);
    }
    return out;
  }
  const text = String(configText || "").trim();
  if (!text) return { platform: platform || "docker" };
  try {
    const obj = JSON.parse(text);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      if (!obj.platform) obj.platform = platform || "docker";
      return obj;
    }
  } catch {
    /* free-form text kept as string for non-JSON app configs */
  }
  return text;
}

export function shallowEqualObj(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) if (a[key] !== b[key]) return false;
  return true;
}

export function mergeObjects(prev = {}, incoming = {}) {
  if (!incoming) return prev;
  if (!prev) return { ...incoming };
  if (typeof incoming !== "object" || Array.isArray(incoming)) return incoming;

  const out = { ...prev };
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val === undefined) continue;
    if (val === null) {
      out[key] = null;
      continue;
    }
    if (typeof val === "object" && !Array.isArray(val)) {
      out[key] = mergeObjects(out[key] ?? {}, val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

export function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function formatLogTime(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

export function inferLogLevel(line) {
  const lower = String(line || "").toLowerCase();
  if (
    lower.includes("fatal") ||
    lower.includes("panic") ||
    lower.includes("traceback") ||
    lower.includes("error") ||
    lower.includes("exception")
  ) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("deprecated")) return "warning";
  if (lower.includes("debug")) return "debug";
  return "info";
}

export function normalizeTextEntries(input) {
  if (input == null) return [];

  const toEntry = (text, index, raw, extra = {}) => {
    const clean = String(text ?? "").replace(/\r$/, "").trim();
    if (!clean) return null;
    return {
      key: extra.key || `${index}-${clean.slice(0, 40)}`,
      text: clean,
      level: extra.level || inferLogLevel(clean),
      timestamp: extra.timestamp || null,
      raw,
    };
  };

  const normalizeOne = (item, index) => {
    if (item == null) return null;

    if (typeof item === "string") {
      const lines = item.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return null;
      if (lines.length === 1) return toEntry(lines[0], index, item);
      return lines.map((line, subIndex) => toEntry(line, `${index}-${subIndex}`, item)).filter(Boolean);
    }

    if (typeof item !== "object") {
      return toEntry(String(item), index, item);
    }

    const timestamp = item.created_at || item.timestamp || item.time || item.datetime || null;
    const level = String(item.level || item.severity || item.type || "").toLowerCase();

    let payload =
      item.message ??
      item.log ??
      item.text ??
      item.line ??
      item.detail ??
      item.content ??
      null;

    if (payload == null) {
      const copy = { ...item };
      delete copy.id;
      delete copy.pk;
      delete copy.created_at;
      delete copy.timestamp;
      delete copy.time;
      delete copy.datetime;
      delete copy.level;
      delete copy.severity;
      delete copy.type;
      delete copy.message;
      delete copy.log;
      delete copy.text;
      delete copy.line;
      delete copy.detail;
      delete copy.content;
      payload = Object.keys(copy).length ? JSON.stringify(copy, null, 2) : JSON.stringify(item, null, 2);
    }

    if (typeof payload === "object") {
      payload = JSON.stringify(payload, null, 2);
    }

    const tsPrefix = timestamp ? `[${formatDate(timestamp)}] ` : "";
    const lvlPrefix = level ? `${level.toUpperCase()} ` : "";
    const text = `${tsPrefix}${lvlPrefix}${String(payload).trim()}`.trim();

    return toEntry(text, index, item, {
      level: level || inferLogLevel(text),
      timestamp,
      key: String(item.id ?? item.pk ?? `${timestamp || ""}-${index}-${text.slice(0, 36)}`),
    });
  };

  const items = Array.isArray(input) ? input : [input];
  return items
    .flatMap((item, index) => normalizeOne(item, index) || [])
    .filter(Boolean);
}

export function mergeEntries(prev = [], incoming = []) {
  if (!Array.isArray(incoming)) return prev;
  if (!Array.isArray(prev) || prev.length === 0) return incoming;

  const seen = new Set(prev.map((x) => x.key));
  const out = [...prev];

  for (const item of incoming) {
    if (!item?.key) continue;
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

export function mergeEntriesPrepend(prev = [], incoming = []) {
  if (!Array.isArray(incoming)) return prev;
  if (!Array.isArray(prev) || prev.length === 0) return incoming;

  const seen = new Set(prev.map((x) => x.key));
  const out = [];

  for (const item of incoming) {
    if (!item?.key) continue;
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }

  return [...out, ...prev];
}

export function downloadTextFile(filename, lines) {
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getDeployEntryText(entry) {
  if (!entry) return "";
  if (typeof entry.text === "string") return entry.text;
  if (typeof entry === "string") return entry;
  return String(entry);
}

export function isNearBottom(el, threshold = 100) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

export function scrollToBottom(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}