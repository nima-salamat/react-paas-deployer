import {
  DB_PLATFORMS,
  MUTABLE_DB_CONFIG_KEYS,
  DB_DEFAULT_PORTS,
  PASSWORD_ALPHABET_SAFE,
  DB_IDENTIFIER_ALPHABET,
  SENTINEL_KEEP_EXISTING,
} from "./constants";

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
      // Coerce common boolean-ish celery flags if user typed "true" as string
      for (const key of ["celery", "celery_beat", "celery-beat"]) {
        if (typeof obj[key] === "string") {
          const v = obj[key].trim().toLowerCase();
          if (v === "true" || v === "1" || v === "yes") obj[key] = true;
          else if (v === "false" || v === "0" || v === "no") obj[key] = false;
        }
      }
      // alias beat → celery_beat
      if (obj.beat != null && obj.celery_beat == null) {
        obj.celery_beat = Boolean(obj.beat);
      }
      return obj;
    }
  } catch {
    /* not valid JSON */
  }
  // JSONField on the API requires valid JSON — never send raw free text
  throw new Error(
    "Config must be valid JSON. Example: {\"celery\": true, \"platform\": \"django\"}"
  );
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
    /\berror\b/.test(lower) ||
    lower.includes("exception")
  ) {
    return "error";
  }
  if (/\bwarn(ing)?\b/.test(lower) || lower.includes("deprecated")) return "warning";
  if (/\bdebug\b/.test(lower)) return "debug";
  return "info";
}

/**
 * Canonical log entry shape used by LogPanel / LogRow.
 * Accepts heterogeneous backend payloads (service WS, deploy WS, REST history).
 */
export function normalizeLogEntry(raw, fallbackText, extra = {}) {
  if (raw == null && fallbackText == null) return null;

  if (typeof raw === "string" || (raw == null && fallbackText != null)) {
    const text = String(fallbackText ?? raw ?? "").replace(/\r$/, "");
    if (!text.trim()) return null;
    const timestamp = extra.timestamp || null;
    return {
      id: extra.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      key: extra.key || null,
      text,
      message: text,
      level: extra.level || inferLogLevel(text),
      timestamp,
      ts: timestamp,
      cursor: extra.cursor || null,
      stream: extra.stream || null,
      stage: extra.stage || null,
      progress: extra.progress != null ? extra.progress : null,
      seq: extra.seq != null ? extra.seq : null,
      raw: extra.raw ?? raw ?? fallbackText,
    };
  }

  if (typeof raw !== "object") {
    return normalizeLogEntry(null, String(raw), extra);
  }

  const timestamp =
    raw.timestamp ||
    raw.ts ||
    raw.created_at ||
    raw.time ||
    raw.datetime ||
    extra.timestamp ||
    null;

  let level = String(raw.level || raw.severity || raw.type || extra.level || "")
    .toLowerCase()
    .trim();
  if (level === "warn") level = "warning";
  if (!level || level === "null" || level === "undefined") level = "";

  let text =
    raw.message ??
    raw.text ??
    raw.log ??
    raw.line ??
    raw.detail ??
    raw.content ??
    fallbackText ??
    null;

  if (text == null && (raw.stage || raw.progress != null)) {
    const parts = [];
    if (raw.stage) parts.push(`[${raw.stage}]`);
    if (raw.progress != null && raw.progress !== "") parts.push(`(${raw.progress}%)`);
    text = parts.join(" ") || JSON.stringify(raw);
  }

  if (text != null && typeof text === "object") {
    text = JSON.stringify(text, null, 2);
  }
  text = String(text ?? "").replace(/\r$/, "");
  if (!text.trim() && !raw.stage) return null;

  if (!level) level = inferLogLevel(text);

  const id = String(
    raw.cursor ||
      raw.id ||
      raw.pk ||
      extra.id ||
      `${timestamp || Date.now()}-${raw.seq ?? Math.random().toString(36).slice(2, 8)}`
  );

  return {
    id,
    key: extra.key || id,
    text,
    message: text,
    level,
    timestamp,
    ts: timestamp,
    cursor: raw.cursor || extra.cursor || null,
    stream: raw.stream || null,
    stage: raw.stage || extra.stage || null,
    progress:
      raw.progress != null
        ? raw.progress
        : extra.progress != null
        ? extra.progress
        : null,
    seq: raw.seq != null ? raw.seq : null,
    raw,
  };
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

// ---------------------------------------------------------------------------
// Random credential generation (client-side, no API round-trip)
// ---------------------------------------------------------------------------

/**
 * Pick a cryptographically-random index in [0, max) using the Web Crypto
 * API.  Falls back to Math.random() if crypto is unavailable (old browser).
 * Uses rejection sampling to avoid modulo bias.
 */
function _secureRandomInt(max) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    // Rejection sampling — eliminate modulo bias for small alphabets.
    const maxUint32 = 0xFFFFFFFF;
    const limit = maxUint32 - (maxUint32 % max);
    const arr = new Uint32Array(1);
    let x;
    do {
      crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);
    return x % max;
  }
  // Fallback — not crypto-secure, but better than nothing.
  return Math.floor(Math.random() * max);
}

/**
 * Generate a random password of the given length from PASSWORD_ALPHABET_SAFE.
 * Uses the Web Crypto API for cryptographic randomness so the password is
 * safe to use for production databases.
 */
export function generatePassword(length = 24) {
  const alphabet = PASSWORD_ALPHABET_SAFE;
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet.charAt(_secureRandomInt(alphabet.length));
  }
  return out;
}

/**
 * Generate a random DB-safe identifier (lowercase + digits) of the given
 * length.  Used for username suffixes and database name suffixes.
 */
export function generateDbIdentifier(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += DB_IDENTIFIER_ALPHABET.charAt(_secureRandomInt(DB_IDENTIFIER_ALPHABET.length));
  }
  return out;
}

/**
 * Generate a complete set of DB credentials for the given platform.
 * Returns { username, password, root_password?, database, port }.
 *
 * The generated values follow these rules:
 *   * username: `<platform>_user_<6 random lowercase+digits>` (≤32 chars)
 *   * password: 24 chars from PASSWORD_ALPHABET_SAFE
 *   * root_password: same as password (only for mysql/mariadb)
 *   * database: `<platform>_db_<8 random lowercase+digits>` (≤64 chars)
 *   * port: null (use platform default — backend picks the standard port)
 *
 * This is the client-side generator.  The backend has a matching
 * generator at POST /deploy/generate_db_credentials/ for API-only clients.
 */
export function generateDbCredentials(platform) {
  const p = String(platform || "").toLowerCase().trim();
  const creds = {
    username: `${p}_user_${generateDbIdentifier(6)}`,
    password: generatePassword(24),
    database: `${p}_db_${generateDbIdentifier(8)}`,
    port: "",
  };
  if (p === "mysql" || p === "mariadb") {
    creds.root_password = generatePassword(24);
  }
  return creds;
}

// ---------------------------------------------------------------------------
// Connection string builder
// ---------------------------------------------------------------------------

/**
 * Build a connection-string URI for the given DB platform + config.
 *
 * Returns a string like:
 *   mysql:      mysql://user:password@host:3306/database
 *   postgresql: postgresql://user:password@host:5432/database
 *   mongodb:    mongodb://user:password@host:27017/database?authSource=admin
 *   redis:      redis://:password@host:6379   (or redis://user:password@... with ACL)
 *   oracle:     oracle+cx_oracle://user:password@host:1521/?service_name=database
 *
 * Returns "" if the platform is unknown or required fields are missing.
 *
 * @param platform  DB platform key (mysql, postgresql, mongodb, redis, oracle)
 * @param cfg       Deploy config dict (must contain at least username + password
 *                  for most platforms; redis can have just password)
 * @param serviceHost  The hostname clients should connect from outside the
 *                  Docker network — typically `service.service_host` from
 *                  the services API.  Falls back to "localhost" if absent.
 */
export function buildConnectionString(platform, cfg = {}, serviceHost = "localhost") {
  const p = String(platform || "").toLowerCase().trim();
  const host = String(serviceHost || "localhost").trim() || "localhost";
  const port = Number(cfg?.port) || DB_DEFAULT_PORTS[p] || "";
  const user = encodeURIComponent(String(cfg?.username || ""));
  const pass = encodeURIComponent(String(cfg?.password || ""));
  const db = encodeURIComponent(String(cfg?.database || ""));

  const authPart = user || pass
    ? `${user}:${pass}@`
    : (pass && p === "redis" ? `:${pass}@` : "");

  const portPart = port ? `:${port}` : "";

  switch (p) {
    case "mysql":
    case "mariadb":
      return `mysql://${authPart}${host}${portPart}/${db}`;
    case "postgresql":
    case "postgres":
      return `postgresql://${authPart}${host}${portPart}/${db}`;
    case "mongodb":
    case "mongo": {
      const qs = db ? `?authSource=admin` : "";
      return `mongodb://${authPart}${host}${portPart}/${db}${qs}`;
    }
    case "redis": {
      // Redis ACL users (Redis 6+) can have a username; older Redis only has password.
      if (user && pass) return `redis://${user}:${pass}@${host}${portPart}`;
      if (pass) return `redis://:${pass}@${host}${portPart}`;
      return `redis://${host}${portPart}`;
    }
    case "oracle": {
      // SQLAlchemy / cx_oracle style.
      const svc = db ? `/?service_name=${db}` : "";
      return `oracle+cx_oracle://${authPart}${host}${portPart}${svc}`;
    }
    default:
      return "";
  }
}

/**
 * Build a human-readable "how to connect" hint for the given platform.
 * Returned as an array of strings, each a line of instructions.
 */
export function buildConnectionHints(platform, cfg = {}, serviceHost = "localhost") {
  const p = String(platform || "").toLowerCase().trim();
  const host = String(serviceHost || "localhost").trim() || "localhost";
  const port = Number(cfg?.port) || DB_DEFAULT_PORTS[p] || "";
  const user = cfg?.username || "";
  const pass = cfg?.password || "";
  const db = cfg?.database || "";

  switch (p) {
    case "mysql":
    case "mariadb":
      return [
        `Connect with the MySQL CLI:`,
        `mysql -h ${host} -P ${port} -u ${user} -p${pass} ${db}`,
        ``,
        `Or from Python (PyMySQL / mysql-connector):`,
        `import pymysql; conn = pymysql.connect(host="${host}", port=${port}, user="${user}", password="${pass}", database="${db}")`,
      ];
    case "postgresql":
    case "postgres":
      return [
        `Connect with psql:`,
        `PGPASSWORD=${pass} psql -h ${host} -p ${port} -U ${user} -d ${db}`,
        ``,
        `Or from Python (psycopg2):`,
        `import psycopg2; conn = psycopg2.connect(host="${host}", port=${port}, user="${user}", password="${pass}", dbname="${db}")`,
      ];
    case "mongodb":
    case "mongo":
      return [
        `Connect with mongosh:`,
        `mongosh "mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin"`,
        ``,
        `Or from Python (pymongo):`,
        `from pymongo import MongoClient; client = MongoClient("mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin")`,
      ];
    case "redis":
      return [
        `Connect with redis-cli:`,
        `redis-cli -h ${host} -p ${port} -a ${pass}`,
        ``,
        `Or from Python (redis-py):`,
        `import redis; r = redis.Redis(host="${host}", port=${port}, password="${pass}")`,
      ];
    case "oracle":
      return [
        `Connect with sqlplus:`,
        `sqlplus ${user}/${pass}@${host}:${port}/${db}`,
        ``,
        `Or from Python (cx_Oracle):`,
        `import cx_Oracle; conn = cx_Oracle.connect("${user}", "${pass}", "${host}:${port}/${db}")`,
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Django config suggestion helper (maps inspect_zip API response -> config JSON)
// ---------------------------------------------------------------------------

/**
 * Map the response of POST /deploy/inspect_zip/ to a config JSON object
 * suitable for pasting into the Create Deploy form's config textarea.
 *
 * Returns a JSON string (pretty-printed, 2-space indent).
 *
 * The shape matches what the backend's _parse_deploy_config expects:
 *   {
 *     "platform": "django",
 *     "server_type": "wsgi" | "asgi" | null,
 *     "celery": false,
 *     "celery_beat": false,
 *     "worker_count": 1,
 *     "entry_point": "..." | null
 *   }
 */
/** Platforms that support Celery / gunicorn-style worker_count / server_type. */
const PYTHON_WORKER_PLATFORMS = new Set([
  "django",
  "flask",
  "python",
  "fastapi",
]);

export function buildDjangoConfigSuggestion(inspection) {
  if (!inspection || typeof inspection !== "object") return "";
  const platform = String(
    inspection.platform || inspection.suggested_config?.platform || "django"
  )
    .toLowerCase()
    .trim();
  const cfg = { platform };
  const isPythonFamily = PYTHON_WORKER_PLATFORMS.has(platform);

  // server_type / celery / worker_count only for Django/Flask/Python/FastAPI
  if (isPythonFamily) {
    const st = inspection.server_type || inspection.suggested_config?.server_type;
    if (st) cfg.server_type = st;
    cfg.celery = Boolean(inspection.suggested_config?.celery);
    cfg.celery_beat = Boolean(inspection.suggested_config?.celery_beat);
    cfg.worker_count =
      Number(inspection.suggested_config?.worker_count) ||
      Number(inspection.worker_count) ||
      1;
  }

  // entry_point: include only if detected
  const ep = inspection.entrypoint || inspection.suggested_config?.entry_point;
  if (ep) cfg.entry_point = ep;
  return JSON.stringify(cfg, null, 2);
}

/**
 * Sentinel value to send for password fields the user wants to KEEP.
 * The backend's update_db_config + update endpoints treat this the same
 * as null / empty string — they skip the field instead of overwriting.
 */
export { SENTINEL_KEEP_EXISTING };