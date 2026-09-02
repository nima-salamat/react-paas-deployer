export const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
export const DEPLOY_BASE = `${API_BASE}/deploy/`;
export const DEPLOY_DOWNLOAD_BASE = `${API_BASE}/media/`;
export const SERVICE_BASE = `${API_BASE}/services/service/`;
export const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
export const NETWORK_API_ROOT = `${API_BASE}/api/networks/`;
export const VOLUME_API_ROOT = `${API_BASE}/api/volumes/`;
export const PLANS_BASE = `${API_BASE}/plans/`;

/** Max entries kept in the client-side live/history buffer (service + deploy). */
export const LOG_BUFFER_MAX = 3000;
/** Page size when loading history / older pages from the API. */
export const LOG_PAGE_SIZE = 100;
/** Deploy history page size (backend may return fewer stage events). */
export const DEPLOY_LOG_PAGE_SIZE = 50;
/** Poll interval fallback for deploy logs while a deploy is active. */
export const DEPLOY_LOG_POLL_INTERVAL = 4000;
export const DEFAULT_REFRESH_INTERVAL_MS = 2000;
/** @deprecated use LOG_BUFFER_MAX */
export const SERVICE_LOG_MAX_LINES = LOG_BUFFER_MAX;

export const REFRESH_INTERVAL_OPTIONS = [
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
];

export const DB_PLATFORMS = new Set([
  "mysql",
  "mariadb",
  "postgresql",
  "postgres",
  "mongodb",
  "mongo",
  "redis",
  "oracle",
]);

export const APP_PLATFORM_OPTIONS = [
  { value: "docker", label: "Docker / app (zip)" },
];

export const DB_PLATFORM_OPTIONS = [
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mongodb", label: "MongoDB" },
  { value: "redis", label: "Redis" },
  { value: "oracle", label: "Oracle" },
];

export const MUTABLE_DB_CONFIG_KEYS = [
  "root_password",
  "password",
  "username",
  "database",
  "port",
  "env",
];

export const LOG_COLLAPSE_CHARS = 180;
export const LOG_COLLAPSE_LINES = 3;

// ---------------------------------------------------------------------------
// DB credential generation + connection strings
// ---------------------------------------------------------------------------

// Default port per DB platform — used by buildConnectionString() when the
// deploy config doesn't specify a port, and by the create-deploy form when
// pre-filling the port field after "Fill automatically".
export const DB_DEFAULT_PORTS = {
  mysql:      3306,
  mariadb:    3306,
  postgresql: 5432,
  postgres:   5432,
  mongodb:    27017,
  mongo:      27017,
  redis:      6379,
  oracle:     1521,
};

// Safe alphabet for DB passwords — excludes characters that break:
//   * URL encoding in connection strings (`@`, `:`, `/`, `#`, `?`)
//   * Shell quoting (`'`, `"`, `` ` ``, `\`, `$`)
//   * SQL string literals (`'`, `"`)
//   * JSON string escaping (`"`, `\`)
//   * Whitespace (breaks copy-paste and config files)
// Includes a healthy mix of upper/lower/digits/symbols so the password
// satisfies typical DB password policy requirements.
export const PASSWORD_ALPHABET_SAFE =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789" +
  "!.*_+-=";

// Sentinel value sent to the backend for password fields when the user
// wants to KEEP the existing password (i.e. didn't type a new one).
// The backend's update_db_config + update endpoints treat this the same
// as null / empty string — they skip the field instead of overwriting.
export const SENTINEL_KEEP_EXISTING = "__unchanged__";

// Username / database name alphabet — DB identifiers are case-sensitive
// on most platforms and lowercase-only on some, so stick to lowercase
// letters + digits to be universally safe.
export const DB_IDENTIFIER_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";