// Admin panel shared utilities + permission helpers.
//
// Centralizes:
//   * backend URL builders (hostBase / svcApi / deployApi / plansAdminApi / etc)
//   * session permission state (setSessionPermissions / hasAnyRule / canSeeNav)
//   * status color map for tickets
//   * plan / login-settings choice constants mirrored from backend
//
// Permission model
// ----------------
//   - Superuser bypasses everything.
//   - Staff with a given rule code (e.g. "users.view") can perform that action.
//   - The frontend NEVER authorizes destructive actions on its own — it only
//     HIDES UI affordances. The backend is the source of truth.
//
// Rule codes are stored in Rule.rules (ArrayField). See backend
// users.admin_apis.KNOWN_PERMISSIONS.

let _session = {
  isStaff: false,
  isSuperuser: false,
  rules: [],
  allPermissions: [],
};

// ---------------------------------------------------------------------------
// Backend URL builders
// ---------------------------------------------------------------------------
export function hostBase() {
  return `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
}

/**
 * Build an authenticated media URL for use in <img src=...> / <Avatar src=...>.
 *
 * Backend's ProtectedMediaView (core/apis.py) accepts either:
 *   - Authorization: Bearer <token> header (which <img> can't send), OR
 *   - ?token=<token> query parameter (which <img> CAN send).
 *
 * This helper takes a path like "/media/images/foo.jpg" (or a full URL),
 * appends the current access token as a query parameter, and returns the
 * absolute URL. Returns "" for empty input.
 */
export function authMediaSrc(url) {
  if (!url) return "";
  const base = hostBase();
  const absolute = url.startsWith("http")
    ? url
    : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  const token = localStorage.getItem("access");
  if (!token) return absolute;
  try {
    const u = new URL(absolute);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    const sep = absolute.includes("?") ? "&" : "?";
    return `${absolute}${sep}token=${encodeURIComponent(token)}`;
  }
}

export function svcApi() {
  return `${hostBase()}/services`;
}

export function deployApi() {
  return `${hostBase()}/deploy`;
}

// Admin users API base — used by UsersPanel and AdminDashboard.
export function adminUsersApi() {
  return `${hostBase()}/api/users/admin/users`;
}

export function adminTablesApi() {
  return `${hostBase()}/api/users/admin/tables`;
}

// FK picker autocomplete: GET /api/users/admin/tables/<model_key>/fk-search/?q=&field=&limit=
export function adminTableFKSearchUrl(modelKey) {
  return `${adminTablesApi()}/${modelKey}/fk-search/`;
}

// Admin Profile image management (per-user)
export function adminUserProfilesApi(userId) {
  return `${hostBase()}/api/users/admin/users/${userId}/profiles/`;
}
export function adminUserProfileDetailApi(userId, profileId) {
  return `${hostBase()}/api/users/admin/users/${userId}/profiles/${profileId}/`;
}
export function adminUserProfileReorderApi(userId) {
  return `${hostBase()}/api/users/admin/users/${userId}/profiles/reorder/`;
}

export function adminPermissionsUrl() {
  return `${hostBase()}/api/users/admin/permissions/`;
}

export function adminMeUrl() {
  return `${hostBase()}/api/users/admin/me/permissions/`;
}

// Plans admin CRUD API — backend mounts PlanAdminViewSet at /plans/admin/plans/
export function plansAdminApi() {
  return `${hostBase()}/plans/admin/plans`;
}

// Public plans catalog (for read-only browsing of platform choices)
export function plansPublicApi() {
  return `${hostBase()}/plans`;
}

// Login settings singleton API (admin)
export function loginSettingsAdminApi() {
  return `${hostBase()}/auth/api/admin/login-settings/`;
}

export const STATUS_COLOR = {
  open: "info",
  in_progress: "warning",
  waiting_user: "secondary",
  resolved: "success",
  closed: "default",
};

// ---------------------------------------------------------------------------
// Choice constants — mirrored from backend core/global_settings/config.py
// ---------------------------------------------------------------------------
export const PLAN_NAME_CHOICES = [
  { value: "Bronze", label: "Bronze" },
  { value: "Silver", label: "Silver" },
  { value: "Gold", label: "Gold" },
  { value: "Diamond", label: "Diamond" },
];

export const PLAN_PLATFORM_CHOICES = [
  { value: "php", label: "PHP" },
  { value: "python", label: "Python" },
  { value: "django", label: "Django" },
  { value: "nextjs", label: "Next.js" },
  { value: "nodejs", label: "Node.js" },
  { value: "flask", label: "Flask" },
  { value: "docker", label: "Docker" },
  { value: "go", label: "Go" },
  { value: "statichtmlcss", label: "Static HTML/CSS" },
  { value: "vuejs", label: "Vue.js" },
  { value: "angular", label: "Angular" },
  { value: "react", label: "React" },
  { value: "dotnet", label: ".NET" },
  { value: "mysql", label: "MySQL" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "mongodb", label: "MongoDB" },
  { value: "redis", label: "Redis" },
  { value: "oracle", label: "Oracle" },
];

export const PLAN_TYPE_CHOICES = [
  { value: "APP", label: "Application" },
  { value: "DB", label: "Database" },
  { value: "READY", label: "Ready-made" },
];

export const STORAGE_TYPE_CHOICES = [
  { value: "SSD", label: "SSD" },
  { value: "HDD", label: "HDD" },
];

// Color hint for plan badges (Bronze/Silver/Gold/Diamond)
export const PLAN_NAME_COLORS = {
  Bronze: "#cd7f32",
  Silver: "#94a3b8",
  Gold: "#eab308",
  Diamond: "#06b6d4",
};

/**
 * Resolve a dotted color path (e.g. "primary.main", "info.main") against a
 * theme's palette. Returns a real color value (#hex / rgb()) that can be
 * passed to MUI's `alpha()` utility. Falls back to primary.main if the path
 * is unknown, or returns the input as-is if it already looks like a color.
 *
 * MUI v7's `alpha()` no longer accepts dotted color strings — it requires
 * an actual #hex / rgb() / hsl() value. Use this helper whenever you need
 * to apply alpha to a theme color received as a string.
 */
export function resolveThemeColor(theme, colorPath) {
  if (!colorPath) {
    return theme?.palette?.primary?.main || "#1976d2";
  }
  // Already a color literal? (#hex / rgb / hsl / color() / named CSS color)
  if (typeof colorPath === "string" &&
      (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(colorPath) ||
       colorPath.startsWith("rgb") ||
       colorPath.startsWith("hsl") ||
       colorPath.startsWith("color(") ||
       colorPath === "transparent")) {
    return colorPath;
  }
  // Dotted path: "primary.main", "info.light", "text.secondary", etc.
  const parts = String(colorPath).split(".");
  let cur = theme?.palette;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) {
      cur = cur[p];
    } else {
      return theme?.palette?.primary?.main || "#1976d2";
    }
  }
  // If we landed on an object (e.g. palette.primary), pick .main
  if (cur && typeof cur === "object") {
    return cur.main || theme?.palette?.primary?.main || "#1976d2";
  }
  return cur || theme?.palette?.primary?.main || "#1976d2";
}

// ---------------------------------------------------------------------------
// Session permissions
// ---------------------------------------------------------------------------
export function setSessionPermissions({ rules = [], isSuperuser = false, isStaff = false, allPermissions = [] } = {}) {
  _session.isStaff = Boolean(isStaff);
  _session.isSuperuser = Boolean(isSuperuser);
  _session.rules = Array.isArray(rules) ? [...rules] : [];
  _session.allPermissions = Array.isArray(allPermissions) ? [...allPermissions] : [];
}

export function clearSessionPermissions() {
  _session = { isStaff: false, isSuperuser: false, rules: [], allPermissions: [] };
}

export function getSessionPermissions() {
  return { ..._session, rules: [..._session.rules] };
}

/** Convenience alias that returns the session's rules array. */
export function getSessionRules() {
  return [..._session.rules];
}

/** True if the current session is a superuser. */
export function isSuperuser() {
  return Boolean(_session.isSuperuser);
}

/** True if the current session holds the given rule code (or is superuser). */
export function hasAnyRule(code) {
  if (!code) return Boolean(_session.isStaff || _session.isSuperuser);
  if (_session.isSuperuser) return true;
  return _session.rules.includes(code);
}

/** Alias for hasAnyRule — kept for ergonomic clarity in gate components. */
export function hasRule(code) {
  return hasAnyRule(code);
}

/** True if the current session has ANY of the listed rule codes. */
export function hasOneOfRules(codes = []) {
  if (_session.isSuperuser) return true;
  if (!Array.isArray(codes) || codes.length === 0) return Boolean(_session.isStaff || _session.isSuperuser);
  return codes.some((c) => _session.rules.includes(c));
}

export function isSessionSuperuser() {
  return Boolean(_session.isSuperuser);
}

export function isSessionStaff() {
  return Boolean(_session.isStaff || _session.isSuperuser);
}

/**
 * Whether the nav item for a given tab should be visible.
 *
 * Tab IDs are mapped to permission codes here so the entire nav table lives
 * in one place. Superuser sees everything.
 */
const TAB_RULES = {
  overview: null,           // every staff sees overview
  tickets: "tickets.view",  // also tickets.manage / tickets.delete accepted below
  users: null,              // gated manually (users.view / users.manage / users.create)
  services: "services.view",
  plans: "plans.view",
  login: "login_settings.view",
  invites: null,            // superuser only
  codes: "auth_codes.view",
  emails: "emails.manage",
  tables: "tables.view",
  docs: "docs.manage",
};

export function canSeeNav(tabId) {
  if (_session.isSuperuser) return true;
  if (!_session.isStaff) return false;

  // Special cases that accept multiple rules
  if (tabId === "tickets") {
    return (
      _session.rules.includes("tickets.view") ||
      _session.rules.includes("tickets.manage") ||
      _session.rules.includes("tickets.delete")
    );
  }
  if (tabId === "users") {
    return (
      _session.rules.includes("users.view") ||
      _session.rules.includes("users.manage") ||
      _session.rules.includes("users.create")
    );
  }
  if (tabId === "invites") {
    // invites.manage is the only meaningful rule; for clarity only superuser + invites.manage
    return _session.rules.includes("invites.manage");
  }

  const rule = TAB_RULES[tabId];
  if (rule === null) return true;
  return _session.rules.includes(rule);
}

/** Returns the full catalog of all permission codes (for the rule editor). */
export function getAllPermissionCodes() {
  return _session.allPermissions && _session.allPermissions.length
    ? [..._session.allPermissions]
    : [
        // Fallback mirror of backend KNOWN_PERMISSIONS (kept in sync manually)
        "tickets.view", "tickets.manage", "tickets.delete",
        "users.view", "users.create", "users.manage", "users.manage_rules",
        "invites.manage", "auth_codes.view", "auth_codes.manage",
        "emails.manage", "departments.manage",
        "services.view", "services.manage", "services.delete",
        "deploys.manage", "volumes.manage", "networks.manage",
        "plans.view", "plans.manage",
        "login_settings.view", "login_settings.manage",
        "tables.view", "tables.manage", "docs.manage",
      ];
}

/**
 * Group permission codes by domain (for nicer display in the rule editor).
 * Returns [{ group: 'Tickets', codes: ['tickets.view', ...] }, ...]
 */
export function getGroupedPermissions() {
  const codes = getAllPermissionCodes();
  const groups = {};
  for (const code of codes) {
    const domain = code.split(".")[0];
    if (!groups[domain]) groups[domain] = [];
    groups[domain].push(code);
  }
  // Stable human-friendly ordering
  const order = [
    "tickets", "users", "invites", "auth_codes", "emails", "departments",
    "services", "deploys", "volumes", "networks", "plans", "login_settings",
    "tables",
  ];
  const seen = new Set();
  const out = [];
  for (const d of order) {
    if (groups[d]) {
      out.push({ group: prettifyDomain(d), codes: groups[d] });
      seen.add(d);
    }
  }
  for (const d of Object.keys(groups)) {
    if (!seen.has(d)) {
      out.push({ group: prettifyDomain(d), codes: groups[d] });
    }
  }
  return out;
}

function prettifyDomain(d) {
  const map = {
    tickets: "Tickets",
    users: "Users & access",
    invites: "Invites",
    auth_codes: "Auth codes",
    emails: "Email",
    departments: "Departments",
    services: "Services",
    deploys: "Deploys",
    volumes: "Volumes",
    networks: "Networks",
    plans: "Plans",
    login_settings: "Login system",
    tables: "Database tables",
  };
  return map[d] || d.charAt(0).toUpperCase() + d.slice(1);
}

/**
 * Returns true if the current session is allowed to grant a given rule code.
 * Mirrors the backend check: "you cannot grant permissions you don't own".
 * Superuser can grant anything.
 */
export function canGrantRule(code) {
  if (_session.isSuperuser) return true;
  return _session.rules.includes(code);
}
