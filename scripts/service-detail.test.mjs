import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  describeServiceStatus,
  getApiErrorMessage,
  getApiErrorMeta,
  isServiceBusy,
} from "../src/components/service_detail/errorUtils.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("service API errors prefer backend detail and expose status/code", () => {
  const error = {
    response: {
      status: 409,
      data: {
        result: "error",
        code: "deploy_not_ready",
        detail: "Only a successfully completed deployment can be selected as active.",
      },
    },
  };

  assert.equal(
    getApiErrorMessage(error),
    "Only a successfully completed deployment can be selected as active.",
  );

  assert.deepEqual(getApiErrorMeta(error), {
    status: 409,
    code: "deploy_not_ready",
    message: "Only a successfully completed deployment can be selected as active.",
    statusMessage: "This action conflicts with the service's current state.",
  });
});

test("service API validation errors are flattened instead of rendered as JSON", () => {
  const error = {
    response: {
      status: 400,
      data: {
        error: "Validation failed.",
        errors: {
          size_mb: ["Storage quota exceeded."],
          config: { port: ["Port must be between 1 and 65535."] },
        },
      },
    },
  };

  assert.equal(
    getApiErrorMessage(error),
    "size_mb: Storage quota exceeded. · config.port: Port must be between 1 and 65535.",
  );
});

test("service HTTP status fallbacks are human-readable", () => {
  assert.equal(
    getApiErrorMessage({ response: { status: 403, data: {} } }),
    "You do not have permission to perform this action.",
  );
  assert.equal(
    getApiErrorMessage({ response: { status: 404, data: {} } }),
    "The requested service or resource was not found.",
  );
});

test("service status helpers distinguish busy from runtime state", () => {
  assert.equal(isServiceBusy("deploying"), true);
  assert.equal(isServiceBusy("running"), false);
  assert.equal(describeServiceStatus("stopping"), "Stopping");
  assert.equal(describeServiceStatus(""), "Unknown");
});

test("service list keeps last known CPU/RAM visible during background status refresh", () => {
  const service = read("src/components/service/Services.jsx");
  const item = read("src/components/service/services/ServiceItem.jsx");

  assert.match(
    service,
    /cpu: val\.cpu \?\? old\?\.cpu \?\? null/,
  );
  assert.match(
    service,
    /ram: val\.ram \?\? old\?\.ram \?\? null/,
  );
  assert.match(
    item,
    /const cpuUsageLoading =\s*usage\.cpu == null && \(!statusEntry \|\| statusEntry\.loading\)/,
  );
  assert.match(
    item,
    /const ramUsageLoading =\s*usage\.ram == null && \(!statusEntry \|\| statusEntry\.loading\)/,
  );
  assert.match(
    item,
    /statusEntry\.cpu != null \? \{ cpu_percent: statusEntry\.cpu \} : \{\}/,
  );
});

test("service detail uses the central request/error layer", () => {
  const files = [
    "src/components/service_detail/ServiceDetail.jsx",
    "src/components/service_detail/components/CreateDeployPanel.jsx",
    "src/components/service_detail/components/OverviewPanel.jsx",
    "src/components/service_detail/hooks/useServiceLogs.js",
    "src/components/service_detail/hooks/useDeployLogs.js",
  ];

  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /axios\.(get|post|put|patch|delete)\(/);
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.match(source, /apiRequest/);
  }
});

test("service detail has a persistent structured error surface", () => {
  const source = read("src/components/service_detail/ServiceDetail.jsx");
  const alert = read("src/components/service_detail/components/ServiceErrorAlert.jsx");

  assert.match(source, /<ServiceErrorAlert/);
  assert.match(source, /errorMeta \|\| error/);
  assert.match(source, /setServiceStatusError/);
  assert.match(source, /setServiceLoading\(true\)/);
  assert.match(alert, /Retry/);
  assert.match(alert, /Dismiss/);
  assert.match(alert, /meta\.status/);
  assert.match(alert, /meta\.code/);
});

test("service detail regression sources keep critical callback and error state declarations valid", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const settings = read("src/components/service_detail/components/SettingsPanel.jsx");

  assert.match(
    service,
    /const handleDownloadVolume = useCallback\(async \(volume\) =>[\s\S]*?\n {2}\}, \[safeSetSnackbar\]\);/,
  );
  assert.equal(
    (settings.match(
      /const \[deleteServiceError, setDeleteServiceError\] = useState\(null\);/g,
    ) || []).length,
    1,
  );
  assert.equal(
    (settings.match(
      /const \[volumeActionError, setVolumeActionError\] = useState\(null\);/g,
    ) || []).length,
    1,
  );
});

test("service detail avoids static shell highlighter loading and hidden shell mounts", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const shell = read("src/components/service_detail/components/ShellPanel.jsx");

  assert.doesNotMatch(shell, /import\s+hljs\s+from\s+["']highlight\.js\/lib\/common["']/);
  assert.match(shell, /loadHljs\(\)/);
  assert.match(shell, /highlightReady/);
  assert.match(service, /\{activeTab === "shell" \? \(/);
  assert.doesNotMatch(service, /display: activeTab === "shell" \? "block" : "none"/);
});

test("service detail declares shell context-menu callback before consumers", () => {
  const source = read("src/components/service_detail/components/ShellPanel.jsx");
  const closeIndex = source.indexOf("const closeContextMenu = useCallback");
  const downloadIndex = source.indexOf("const downloadSelection = useCallback");
  assert.ok(closeIndex >= 0);
  assert.ok(downloadIndex >= 0);
  assert.ok(closeIndex < downloadIndex);
});

test("FastAPI deploy UI keeps runtime profile and inspection output connected", async () => {
  const builder = read("src/components/service_detail/components/ConfigBuilder.jsx");
  const utils = read("src/components/service_detail/utils.js");
  const create = read("src/components/service_detail/components/CreateDeployPanel.jsx");
  const icon = read("src/components/plans/PlatformIcon.jsx");
  const admin = read("src/components/admin/adminUtils.js");

  assert.match(builder, /fastapi:\s*\{/);
  assert.match(builder, /FastApiRuntimePanel/);
  assert.match(builder, /proxy_headers/);
  assert.match(builder, /forwarded_allow_ips/);
  assert.match(builder, /limit_concurrency/);
  assert.match(builder, /timeout_graceful_shutdown/);
  assert.match(builder, /DATABASE_URL/);
  assert.match(builder, /REDIS_URL/);
  assert.match(utils, /const PYTHON_WORKER_PLATFORMS = new Set\([\s\S]*"fastapi"/);
  assert.match(utils, /cfg\.fastapi = fastapi/);
  assert.match(utils, /if \(platform === "fastapi"\)/);
  assert.match(utils, /const detectedProfile = inspection\.fastapi_profile \|\| suggested\.fastapi/);
  assert.match(create, /fastapi_profile/);
  assert.match(create, /App dir:/);
  assert.match(icon, /SiFastapi/);
  assert.match(icon, /fastapi:\s*SiFastapi/);
  assert.match(admin, /value: "fastapi", label: "FastAPI"/);
});

test("service settings exposes managed database bindings", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const settings = read("src/components/service_detail/components/SettingsPanel.jsx");

  assert.match(service, /fetchDatabaseConfiguration/);
  assert.match(service, /database-resources/);
  assert.match(service, /databases/);
  assert.match(service, /onBindDatabase=\{handleBindDatabase\}/);
  assert.match(settings, /id="database"/);
  assert.match(settings, /Connect a database resource/);
  assert.match(settings, /Environment prefix/);
  assert.match(settings, /onUnbindDatabase/);
});

test("service detail forwards fetched database state and handlers into SettingsPanel", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const start = service.indexOf("<SettingsPanel");
  const end = service.indexOf("/>", start);
  assert.ok(start >= 0 && end > start, "SettingsPanel invocation should exist");
  const invocation = service.slice(start, end);

  for (const prop of [
    "databaseBindings={databaseBindings}",
    "databaseResources={databaseResources}",
    "databaseLoading={databaseLoading}",
    "databaseActionLoading={databaseActionLoading}",
    "onBindDatabase={handleBindDatabase}",
    "onUnbindDatabase={handleUnbindDatabase}",
  ]) {
    assert.ok(invocation.includes(prop), `SettingsPanel is missing ${prop}`);
  }
});

test("service detail keeps the backend route contract", () => {
  const constants = read("src/components/service_detail/constants.js");
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const overview = read("src/components/service_detail/components/OverviewPanel.jsx");
  const create = read("src/components/service_detail/components/CreateDeployPanel.jsx");
  const serviceLogs = read("src/components/service_detail/hooks/useServiceLogs.js");
  const deployLogs = read("src/components/service_detail/hooks/useDeployLogs.js");

  assert.match(constants, /SERVICE_BASE = .*\/services\/service\//);
  assert.match(constants, /DEPLOY_BASE = .*\/deploy\//);
  assert.match(constants, /SERVICE_ACTION_ROOT = .*\/services\//);
  assert.match(constants, /NETWORK_API_ROOT = .*\/api\/networks\//);
  assert.match(constants, /VOLUME_API_ROOT = .*\/api\/volumes\//);
  assert.match(service, /database-resources/);
  assert.match(service, /databases/);

  for (const endpoint of [
    "start_service/",
    "stop_service/",
    "service_status/",
    "force_cancel_deploy/",
    "purge_service_runtime/",
  ]) {
    assert.match(service, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  for (const endpoint of [
    "name_is_available/",
    "update_db_config/",
    "reveal_db_credentials/",
    "download/",
  ]) {
    assert.match(service, new RegExp(endpoint.replaceAll("/", "\\/")));
  }

  assert.match(service, /plans\/\$\{planId\}\/apply\//);
  const downloadStart = service.indexOf("const handleDownloadVolume");
  const planStart = service.indexOf("const handleApplyPlan");
  assert.ok(downloadStart >= 0 && planStart > downloadStart);
  assert.equal(
    service.slice(downloadStart, planStart).includes("setPlanActionLoading(false)"),
    false,
  );

  assert.match(overview, /reveal_db_credentials/);
  assert.match(create, /inspect_zip/);
  assert.match(serviceLogs, /\/logs\//);
  assert.match(deployLogs, /\/logs\//);
});

test("service detail uses backend service host directly", () => {
  const source = read("src/components/service_detail/ServiceDetail.jsx");
  assert.match(source, /service\?\.service_host/);
  assert.doesNotMatch(source, /VITE_DEPLOY_BASE\}/);
});

test("service detail prefers backend active revision over legacy selected deploy", () => {
  const source = read("src/components/service_detail/ServiceDetail.jsx");
  assert.match(source, /const activeRevisionId = service\?\.active_revision/);
  assert.match(source, /d\.revision\?\.id \?\? d\.revision/);
  assert.match(source, /service\?\.selected_deploy/);
});

test("service status polling uses the canonical API route", () => {
  for (const file of [
    "src/components/service/Services.jsx",
    "src/components/service_detail/ServiceDetail.jsx",
    "src/components/ready_apps/ReadyAppInstallation.jsx",
  ]) {
    const source = read(file);
    assert.match(source, /api\/services\/service_status\//);
    assert.doesNotMatch(source, /SERVICE_ACTION_ROOT[^\n]*service_status\//);
  }
});

test("service settings normalizes plan API envelopes and offers retry", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const settings = read("src/components/service_detail/components/SettingsPanel.jsx");

  assert.match(service, /const \[plansLoadError, setPlansLoadError\] = useState\(""\)/);
  assert.match(service, /Array\.isArray\(data\?\.items\)/);
  assert.match(service, /plansError=\{plansLoadError\}/);
  assert.match(service, /onRefreshPlans=\{fetchPlans\}/);
  assert.match(settings, /function normalizePlanPlatform/);
  assert.match(settings, /normalizePlanPlatform\(plan\?\.platform\)/);
  assert.match(settings, /Refresh plans/);
  assert.match(settings, /plansError/);
});


test("service detail uses semantic resource icons and distinct navigation actions", () => {
  const detail = read("src/components/service_detail/ServiceDetail.jsx");
  const navbar = read("src/components/dashboard/DashboardNavbar.jsx");
  const toolbar = read("src/components/service_detail/components/ServiceToolbar.jsx");
  const overview = read("src/components/service_detail/components/OverviewPanel.jsx");
  const globalControls = read("src/components/service_detail/components/GlobalServiceControls.jsx");
  const mobileHeader = read("src/components/service_detail/components/MobileServiceHeader.jsx");
  const tabs = read("src/components/service_detail/components/TabSidebar.jsx");
  const mobileNav = read("src/components/service_detail/components/MobileNavFab.jsx");
  const settings = read("src/components/service_detail/components/SettingsPanel.jsx");
  const editDialog = read("src/components/service/services/ServiceEditDialog.jsx");
  const serviceItem = read("src/components/service/services/ServiceItem.jsx");

  assert.match(toolbar, /const handleBack = \(\) => navigate\("\/dashboard\/services"\);/);
  assert.doesNotMatch(toolbar, /navigate\(-1\)/);
  assert.match(navbar, /const showBack = profileMode && !serviceDetail/);
  assert.match(navbar, /serviceDetail && servicePlatform/);
  assert.match(navbar, /PlatformIcon/);
  assert.match(detail, /servicePlatform = String\([\s\S]*selectedPlatform \|\| planPlatform/);
  assert.match(detail, /servicePlatform=\{servicePlatform\}/);
  assert.match(mobileHeader, /ServicePlatformBadge/);
  assert.match(mobileHeader, /RocketLaunchRoundedIcon/);
  assert.match(mobileHeader, /VolumeIcon/);

  for (const content of [overview, globalControls, settings, editDialog]) {
    assert.match(content, /LuCpu/);
    assert.match(content, /LuMemoryStick/);
  }
  for (const content of [overview, settings, editDialog, serviceItem]) {
    assert.match(content, /LuHardDrive/);
  }
  for (const content of [overview, settings, mobileHeader, mobileNav]) {
    assert.match(content, /VolumeIcon/);
  }
  for (const content of [overview, settings, serviceItem]) {
    assert.match(content, /LuDatabase/);
  }
  assert.match(overview, /LuDatabase size=\{18\}/);
  assert.match(settings, /id="database"[\s\S]*LuDatabase/);
  assert.match(settings, /id="volume"[\s\S]*VolumeIcon/);
  assert.match(settings, /SellOutlinedIcon/);
  assert.match(editDialog, /SellOutlinedIcon/);
  assert.match(editDialog, /PlatformIcon/);
  assert.match(tabs, /RocketLaunchRoundedIcon/);
  assert.match(mobileNav, /RocketLaunchRoundedIcon/);
  assert.match(serviceItem, /ArrowForwardRoundedIcon/);
  assert.match(serviceItem, /Details/);
  assert.doesNotMatch(serviceItem, />\s*Open\s*<\/Button>/);
  assert.match(globalControls, /openServiceInNewTab/);
  assert.match(globalControls, /LinkIcon/);
});


test("dashboard theme, cursor selection, service identity badges and wizard icons stay consistent", () => {
  const app = read("src/App.jsx");
  const detail = read("src/components/service_detail/ServiceDetail.jsx");
  const navbar = read("src/components/dashboard/DashboardNavbar.jsx");
  const cursorSettings = read("src/components/layout/cursorSettings.js");
  const cursor = read("src/components/layout/CustomCursor.jsx");
  const cursorCss = read("src/index.css");
  const profile = read("src/components/profile/profile.jsx");
  const cursorPicker = read("src/components/layout/CursorPreferencePicker.jsx");
  const messengerRightPanel = read("src/components/messenger/components/RightPanel.jsx");
  const badge = read("src/components/service/ServicePlatformBadge.jsx");
  const serviceItem = read("src/components/service/services/ServiceItem.jsx");
  const globalControls = read("src/components/service_detail/components/GlobalServiceControls.jsx");
  const mobileHeader = read("src/components/service_detail/components/MobileServiceHeader.jsx");
  const mobileNavFab = read("src/components/service_detail/components/MobileNavFab.jsx");
  const deleteDialog = read("src/components/service/services/ServiceDeleteDialog.jsx");
  const wizard = read("src/components/plans/CreateDeploymentModal.jsx");
  const networks = read("src/components/networks/Networks.jsx");
  const sidebar = read("src/components/dashboard/DashboardSidebar.jsx");
  const dashboardOverview = read("src/components/dashboard/DashboardOverview.jsx");
  const volumes = read("src/components/volumes/Volumes.jsx");
  const volumeIcon = read("src/components/VolumeIcon.jsx");
  const toolbar = read("src/components/service/services/ServicesToolbar.jsx");
  const plans = read("src/components/plans/plans.jsx");
  const plansPreview = read("src/components/home/PlansPreview.jsx");
  const adminServiceDrawer = read("src/components/admin/components/ServiceAdminDrawer.jsx");
  const adminServicesPanel = read("src/components/admin/panels/ServicesPanel.jsx");

  assert.match(app, /element={<ServiceDetail themeMode=\{themeMode\} onThemeModeChange=\{handleThemeModeChange\} \/>}/);
  assert.match(detail, /themeMode=\{themeMode\}/);
  assert.match(detail, /onThemeModeChange=\{onThemeModeChange\}/);
  assert.match(navbar, /<ThemeMenuButton[\s\S]*themeMode=\{themeMode\}[\s\S]*onThemeModeChange=\{onThemeModeChange\}/);

  assert.match(cursorSettings, /id: "custom",[\s\S]*label: "Ring"/);
  assert.match(cursorSettings, /id: "dot"/);
  assert.match(cursorSettings, /id: "crosshair"/);
  assert.match(cursorSettings, /value === "ring"/);
  assert.match(cursorPicker, /<ButtonBase[\s\S]*aria-pressed=\{selected\}/);
  assert.match(cursorPicker, /onClick=\{\(\) => setCursorPreference\(writeCursorPreference\(option\.id\)\)\}/);
  assert.match(cursorPicker, /paasdeployer:cursor-preference/);
  assert.match(profile, /<CursorPreferencePicker/);
  assert.match(messengerRightPanel, /<CursorPreferencePicker compact/);
  assert.doesNotMatch(messengerRightPanel, /value=\{cursorPreference\}/);
  assert.match(cursor, /root\.classList\.remove\([\s\S]*"is-visible"/);
  assert.match(cursor, /document\.documentElement\.classList\.remove\("custom-cursor-enabled"\)/);
  assert.match(cursorCss, /\.custom-cursor\.variant-dot/);
  assert.match(cursorCss, /\.custom-cursor\.variant-crosshair/);

  assert.match(badge, /width: \{ xs: 132, sm: 156 \}/);
  assert.match(serviceItem, /@container \(max-width: 560px\)/);
  assert.match(serviceItem, /gridTemplateColumns: "auto minmax\(0, 1fr\) auto"/);
  assert.match(globalControls, /gridTemplateAreas: '"badge title status"'/);
  assert.match(globalControls, /textAlign: "left"/);
  assert.match(mobileHeader, /textAlign: "left"/);
  assert.match(mobileHeader, /\["failed", "error"\]\.includes/);
  assert.match(mobileNavFab, /\["failed", "error"\]\.includes/);
  assert.match(deleteDialog, /\["failed", "error"\]\.includes\(status\)/);
  assert.match(dashboardOverview, /error: "Failed"/);
  assert.match(dashboardOverview, /\["failed", "error"\]\.includes\(status\)/);
  assert.match(toolbar, /gridTemplateColumns:[\s\S]*minmax\(220px, 1fr\)/);
  assert.match(toolbar, /WidgetsOutlinedIcon/);
  assert.match(toolbar, /startIcon={<AppsOutlinedIcon/);
  assert.match(plans, /SellOutlinedIcon/);
  assert.doesNotMatch(plans, /LayersOutlinedIcon/);
  assert.match(plansPreview, /SellOutlinedIcon/);
  assert.doesNotMatch(plansPreview, /LayersOutlinedIcon/);
  assert.match(sidebar, /label: "App Library", path: "\/dashboard\/ready-apps", icon: AppsOutlinedIcon/);
  assert.match(sidebar, /label: "Deployed Apps", path: "\/dashboard\/ready-apps\/installations", icon: Inventory2OutlinedIcon/);
  assert.match(dashboardOverview, /\["App Library", "\/dashboard\/ready-apps", AppsOutlinedIcon\]/);
  assert.match(dashboardOverview, /\["Deployed Apps", "\/dashboard\/ready-apps\/installations", Inventory2OutlinedIcon\]/);
  assert.match(serviceItem, /ServicePlatformBadge/);
  assert.match(globalControls, /ServicePlatformBadge/);
  assert.ok(globalControls.includes('icon={<VolumeIcon size={16} />}'));
  assert.ok(globalControls.includes('label={`Volumes: ${volumeCount}`}'));
  assert.match(globalControls, /servicePlatformKey/);

  assert.match(networks, /HubIcon/);
  assert.match(wizard, /HubIcon/);
  assert.match(wizard, /VolumeIcon/);
  assert.match(sidebar, /icon: HubIcon/);
  assert.match(dashboardOverview, /\["Networks", "\/dashboard\/networks", HubIcon\]/);
  assert.match(sidebar, /icon: VolumeIcon/);
  assert.match(dashboardOverview, /\["Volumes", "\/dashboard\/volumes", VolumeIcon\]/);
  assert.match(volumes, /VolumeIcon/);
  assert.match(volumeIcon, /LuHardDrive/);
  assert.ok(adminServiceDrawer.includes("startIcon={<VolumeIcon size={18} />}"));
  assert.doesNotMatch(adminServiceDrawer, /StorageIcon/);
  assert.match(adminServiceDrawer, /\["failed", "error"\]\.includes\(String\(svcDetail\.status \|\| ""\)\.toLowerCase\(\)\)/);
  assert.match(adminServicesPanel, /error: "error"/);
  assert.match(adminServicesPanel, /st === "failed" \|\| st === "error"/);
});
