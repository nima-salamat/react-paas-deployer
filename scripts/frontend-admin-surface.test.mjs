import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const ADMIN_DOMAINS = [
  "tickets",
  "users",
  "invites",
  "auth_codes",
  "emails",
  "departments",
  "services",
  "deploys",
  "volumes",
  "networks",
  "plans",
  "login_settings",
  "auth_sessions",
  "tables",
  "docs",
];

test("App exposes the major application areas and compatibility redirects", () => {
  const app = read("src/App.jsx");

  for (const route of [
    'path="dashboard"',
    'path="ready-apps"',
    'path="ready-apps/installations/:id"',
    'path="ready-apps/:id"',
    'path="services"',
    'path="agents"',
    'path="agents/:id"',
    'path="networks"',
    'path="volumes"',
    'path="plans"',
    'path="tickets"',
    'path="tickets/new"',
    'path="tickets/:id"',
    'path="profile"',
    'path="dashboard/services/:id"',
    'path="dashboard/services/:id/:section"',
    'path="signin_or_signup"',
    'path="aboutUs"',
    'path="staff"',
    'path="admin/emails"',
  ]) {
    assert.ok(app.includes(route), "Missing route marker: " + route);
  }

  for (const pathMarker of ["/docs", "/messenger", "/admin"]) {
    assert.ok(
      app.includes('path="' + pathMarker + '"') ||
      app.includes('path="' + pathMarker + '/*"'),
      "Missing top-level area: " + pathMarker,
    );
  }
});

test("Admin dashboard keeps titles, sidebar entries and panel renderers aligned", () => {
  const dashboard = read("src/components/admin/AdminDashboard.jsx");
  const sidebar = read("src/components/admin/layout/AdminSidebar.jsx");

  const expected = [
    ["overview", "Overview"],
    ["tickets", "Tickets"],
    ["users", "Users & access"],
    ["services", "Services"],
    ["plans", "Plans"],
    ["tables", "Database tables"],
    ["login", "Login system"],
    ["invites", "Invites"],
    ["codes", "Auth codes"],
    ["emails", "Email"],
    ["profile", "My profile"],
    ["docs", "Documentation"],
  ];

  for (const [id, title] of expected) {
    assert.ok(
      dashboard.includes(id + ': "' + title + '"'),
      "Missing dashboard title: " + id,
    );
    assert.ok(
      dashboard.includes('tab === "' + id + '"') || id === "overview",
      "Missing dashboard renderer: " + id,
    );
    assert.ok(sidebar.includes('id: "' + id + '"'), "Sidebar lost tab " + id);
  }

  for (const component of [
    "OverviewPanel",
    "TicketsPanel",
    "UsersPanel",
    "ServicesPanel",
    "PlansPanel",
    "TablesPanel",
    "LoginSettingsPanel",
    "InvitesPanel",
    "AuthCodesPanel",
    "EmailsPanel",
    "ProfilePanel",
    "DocsPanel",
  ]) {
    assert.match(
      dashboard,
      new RegExp("import " + component + " from [\\\"']"),
      "Dashboard does not import " + component,
    );
  }

  for (const marker of [
    'tab === "users"',
    'tab === "services" && canSeeNav("services")',
    'tab === "plans" && canSeeNav("plans")',
    'tab === "docs" && canSeeNav("docs")',
  ]) {
    assert.ok(dashboard.includes(marker), "Missing panel gate: " + marker);
  }
});

test("Admin permission strings used in admin UI belong to the fallback catalog", () => {
  const utils = read("src/components/admin/adminUtils.js");
  const catalogBlock = utils.match(/Fallback mirror of backend KNOWN_PERMISSIONS[\s\S]*?\n\s*\];/)?.[0] || "";
  assert.ok(catalogBlock, "Could not locate permission catalog");
  const catalog = new Set(
    catalogBlock.match(/"([a-z_]+\.[a-z_]+)"/g)?.map((value) => value.slice(1, -1)) || [],
  );

  assert.ok(catalog.size >= 20);

  const failures = [];
  const adminRoot = path.join(root, "src/components/admin");

  for (const file of walk(adminRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const regex = /["']([a-z_]+\.[a-z_]+)["']/g;
    for (const match of source.matchAll(regex)) {
      const code = match[1];
      if (!ADMIN_DOMAINS.includes(code.split(".")[0])) continue;
      if (!catalog.has(code)) {
        failures.push(
          path.relative(root, file) + ' -> unknown permission "' + code + '"',
        );
      }
    }
  }

  assert.deepEqual(
    failures,
    [],
    "Admin permission typos found:\n" + failures.join("\n"),
  );
});

test("credential-bearing admin API hooks stay behind apiRequest", () => {
  const helpers = [
    "src/components/security/sessionApi.js",
    "src/components/agents/agentApi.js",
    "src/components/admin/hooks/useAdminIdentity.js",
    "src/components/admin/hooks/useInvitesAndCodes.js",
  ];

  for (const relativePath of helpers) {
    const source = read(relativePath);
    assert.match(source, /apiRequest/, relativePath + " lost apiRequest");
    assert.doesNotMatch(source, /\bfetch\(/, relativePath + " added direct fetch");
    assert.doesNotMatch(source, /\baxios(?:\.|\s*\()/, relativePath + " added direct axios");
  }
});

test("Users & access keeps session viewing and management permission-gated", () => {
  const source = read("src/components/admin/panels/UsersPanel.jsx");

  assert.match(source, /auth_sessions\.view/);
  assert.match(source, /auth_sessions\.manage/);
  assert.match(source, /canViewSessions &&/);
  assert.match(source, /canManageSessions/);
  assert.match(source, /canManage=\{canManageSessions\}/);
});

test("security-sensitive websocket entry points use session refresh and heartbeat contracts", () => {
  const files = [
    "src/components/admin/hooks/useTicketWebSocket.js",
    "src/components/tickets/TicketNotifyContext.jsx",
    "src/components/messenger/hooks/useMessengerWebSocket.js",
    "src/components/service_detail/hooks/useServiceLogs.js",
    "src/components/service_detail/hooks/useDeployLogs.js",
  ];

  for (const relativePath of files) {
    const source = read(relativePath);
    assert.match(source, /isSessionBoundToken/, relativePath);
    assert.match(source, /refreshAccessToken/, relativePath);
    assert.match(source, /type:\s*["']ping["']/, relativePath);
  }
});

test("admin-specific security surfaces remain connected to logout and identity state", () => {
  const dashboard = read("src/components/admin/AdminDashboard.jsx");
  const topbar = read("src/components/admin/layout/AdminTopBar.jsx");
  const sidebar = read("src/components/admin/layout/AdminSidebar.jsx");
  const identity = read("src/components/admin/hooks/useAdminIdentity.js");

  assert.match(dashboard, /clearSessionPermissions/);
  assert.match(dashboard, /localStorage\.removeItem\("access"\)/);
  assert.match(dashboard, /localStorage\.removeItem\("refresh"\)/);
  assert.match(topbar, /Users &amp; access/);
  assert.match(topbar, /onNavigate\?\.\("users"\)/);
  assert.match(sidebar, /onLogout/);
  assert.match(identity, /setSessionPermissions/);
  assert.match(identity, /clearSessionPermissions/);
});

test("admin table/profile/session tools have direct action handlers wired in their panels", () => {
  const users = read("src/components/admin/panels/UsersPanel.jsx");
  const tables = read("src/components/admin/panels/TablesPanel.jsx");
  const fkPicker = read("src/components/admin/components/FKPicker.jsx");
  const sessions = read("src/components/admin/components/AdminUserSessionsDialog.jsx");

  for (const marker of [
    "loadUsers",
    "saveUser",
    "createUser",
    "deactivateUser",
    "loadPerms",
    "AdminUserSessionsDialog",
  ]) {
    assert.ok(users.includes(marker), "Missing user action contract: " + marker);
  }

  for (const marker of [
    "adminTablesApi",
    "loadTables",
    "loadRows",
    "confirmDelete",
    'method: "DELETE"',
  ]) {
    assert.ok(tables.includes(marker), "Missing tables contract: " + marker);
  }
  assert.ok(fkPicker.includes("adminTableFKSearchUrl"), "FK picker lost admin lookup helper");

  for (const marker of [
    "fetchAdminUserSessions",
    "revokeAdminUserSession",
    "logoutAllAdminUserSessions",
  ]) {
    assert.ok(sessions.includes(marker), "Missing session operation: " + marker);
  }
});


test("admin user profile photos use crop and robust reorder interaction", () => {
  const manager = read("src/components/admin/components/ProfileImageManager.jsx");
  const users = read("src/components/admin/panels/UsersPanel.jsx");
  const profile = read("src/components/profile/profile.jsx");

  assert.match(manager, /ImageCropDialog/);
  assert.match(manager, /circular/);
  assert.match(manager, /outputSize=\{512\}/);
  assert.match(manager, /TouchSensor/);
  assert.match(manager, /KeyboardSensor/);
  assert.match(manager, /sortableKeyboardCoordinates/);
  assert.match(manager, /touchAction: disabled \? "auto" : "none"/);
  assert.match(manager, /Primary avatar/);
  assert.match(manager, /adminUserProfileReorderApi/);
  assert.match(manager, /MediaLightbox/);
  assert.match(users, /<ProfileImageManager/);
  assert.match(profile, /useSensor\(TouchSensor/);
  assert.match(profile, /useSensor\(KeyboardSensor/);
});
