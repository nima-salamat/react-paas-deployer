export const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
export const DEPLOY_BASE = `${API_BASE}/deploy/`;
export const SERVICE_BASE = `${API_BASE}/services/service/`;
export const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
export const NETWORK_API_ROOT = `${API_BASE}/api/networks/`;
export const VOLUME_API_ROOT = `${API_BASE}/api/volumes/`;
export const PLANS_BASE = `${API_BASE}/plans/`;

export const SERVICE_LOG_MAX_LINES = 5000;
export const DEPLOY_LOG_PAGE_SIZE = 10;
export const DEPLOY_LOG_POLL_INTERVAL = 4000;
export const DEFAULT_REFRESH_INTERVAL_MS = 2000;

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