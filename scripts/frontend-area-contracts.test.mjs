import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("dashboard shell preserves nested workspace and responsive navigation contracts", () => {
  const app = read("src/App.jsx");
  const dashboard = read("src/components/dashboard/Dashboard.jsx");

  assert.match(app, /path="dashboard"/);
  assert.match(app, /<DashboardOverview \/>/);
  assert.match(app, /<ReadyApps \/>/);
  assert.match(app, /<Services \/>/);
  assert.match(app, /<Agents \/>/);
  assert.match(app, /<Volumes \/>/);
  assert.match(app, /<Networks \/>/);
  assert.match(app, /<Plans \/>/);
  assert.match(app, /<TicketList \/>/);
  assert.match(app, /<Profile embedded \/>/);

  assert.match(dashboard, /useState/);
  assert.match(dashboard, /setMobileOpen/);
  assert.match(dashboard, /DashboardSidebar/);
  assert.match(dashboard, /Outlet/);
});

test("public Plans page keeps platform discovery, pagination and creation flow", () => {
  const source = read("src/components/plans/plans.jsx");

  assert.match(source, /PLATFORMS_API/);
  assert.match(source, /PLANS_API/);
  assert.match(source, /axios\.get\(PLATFORMS_API/);
  assert.match(source, /axios\.get\(PLANS_API/);
  assert.match(source, /hasNext/);
  assert.match(source, /loadingMore/);
  assert.match(source, /CreateDeploymentModal/);
  assert.match(source, /selectedPlatforms/);
  assert.match(source, /setModalOpen/);
});

test("Plan service wizard stages new volumes until a Service id exists", () => {
  const wizard = read("src/components/plans/CreateDeploymentModal.jsx");
  const createStart = wizard.indexOf("const handleCreateVolume = () =>");
  const attachStart = wizard.indexOf("const attachVolumesToService =");
  assert.ok(createStart >= 0 && attachStart > createStart, "volume draft handler must be present");
  const draftHandler = wizard.slice(createStart, attachStart);

  assert.match(draftHandler, /setPendingNewVolumes/);
  assert.doesNotMatch(draftHandler, /apiRequest|volumesUrl/);

  const createStartAfterService = wizard.indexOf("const createPendingVolumesForService = async (serviceId)");
  const submitStart = wizard.indexOf("const handleSubmit = async () =>", createStartAfterService);
  assert.ok(createStartAfterService >= 0 && submitStart > createStartAfterService);
  const createAfterService = wizard.slice(createStartAfterService, submitStart);
  assert.match(createAfterService, /method:\s*"POST"/);
  assert.match(createAfterService, /service:\s*serviceId/);
  assert.match(wizard, /createPendingVolumesForService\(serviceId\)/);
  assert.match(wizard, /Storage setup incomplete/);
  assert.match(wizard, /warning:\s*storageSetupIncomplete/);
  assert.match(wizard, /pendingNewVolumes\.map\(/);
});

test("CPU and RAM metrics use distinct, semantically correct icons in Services and Plans", () => {
  const serviceItem = read("src/components/service/services/ServiceItem.jsx");
  const plans = read("src/components/plans/plans.jsx");

  for (const source of [serviceItem, plans]) {
    assert.match(source, /import \{ LuCpu, LuMemoryStick \} from "react-icons\/lu"/);
    assert.match(source, /LuCpu size=\{/);
    assert.match(source, /LuMemoryStick size=\{/);
    assert.doesNotMatch(source, /Computer(?:Rounded)?Icon/);
    assert.doesNotMatch(source, /Memory(?:Rounded)?Icon/);
  }
});

test("Volumes and Networks implement protected CRUD with recoverable errors", () => {
  const volumes = read("src/components/volumes/Volumes.jsx");
  const networks = read("src/components/networks/Networks.jsx");

  for (const source of [volumes, networks]) {
    assert.match(source, /apiRequest/);
    assert.match(source, /method:\s*"GET"/);
    assert.match(source, /method:\s*"(?:POST|PATCH|DELETE)"/);
    assert.match(source, /setError/);
    assert.match(source, /setSuccess/);
    assert.match(source, /status === 404/);
  }

  assert.match(volumes, /Bind path must be an absolute container path/);
  assert.match(networks, /Network name is required/);
});

test("Profile area includes account editing, media management and session management", () => {
  const source = read("src/components/profile/profile.jsx");

  assert.match(source, /apiRequest/);
  assert.match(source, /SessionManager/);
  assert.match(source, /dnd-kit|useSortable|useDroppable/);
  assert.match(source, /loadingProfiles/);
  assert.match(source, /passwordOperationLoading/);
  assert.match(source, /CloudUploadIcon/);
  assert.match(source, /handleDeleteProfile|deleteProfile/);
});

test("Documentation workspace separates public asset URLs from authenticated admin assets", () => {
  const home = read("src/components/docs/DocsHome.jsx");
  const workspace = read("src/components/docs/DocumentationWorkspace.jsx");
  const utils = read("src/components/admin/adminUtils.js");

  assert.match(home, /publicDocsAssetSrc/);
  assert.match(home, /apiRequest/);
  assert.match(workspace, /fetch/);
  assert.match(utils, /publicDocsAssetSrc/);
  assert.match(utils, /fetchDocsAssetBlob/);
  assert.match(utils, /responseType:\s*"blob"/);
});

test("Home page preserves the primary deploy, dashboard, docs and FAQ surfaces", () => {
  const source = read("src/components/home/home.jsx");

  assert.match(source, /goPrimary/);
  assert.match(source, /\/dashboard/);
  assert.match(source, /\/signin_or_signup/);
  assert.match(source, /goDocs/);
  assert.match(source, /\/docs/);
  assert.match(source, /AccordionSummary/);
  assert.match(source, /FAQ|Frequently/);
});

test("Messenger keeps authenticated API, hash navigation, WebSocket and draft persistence", () => {
  const source = read("src/components/messenger/MessengerApp.jsx");

  assert.match(source, /apiRequest/);
  assert.match(source, /refreshAccessToken/);
  assert.match(source, /useMessengerWebSocket/);
  assert.match(source, /parseHash/);
  assert.match(source, /setHash/);
  assert.match(source, /writeComposerDraft|readComposerDraft/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /flushSeenReceiptsRef/);
});

test("Ticket list/detail/create surfaces share consistent routing and error handling", () => {
  const list = read("src/components/tickets/TicketList.jsx");
  const detail = read("src/components/tickets/TicketDetail.jsx");
  const create = read("src/components/tickets/CreateTicket.jsx");

  for (const source of [list, detail, create]) {
    assert.match(source, /apiRequest/);
    assert.match(source, /setError|setErr/);
  }

  assert.match(list, /\/dashboard\/tickets\/\$\{id\}/);
  assert.match(list, /\/dashboard\/tickets\/new/);
  assert.match(create, /SimpleHtmlEditor/);
  assert.match(detail, /MessageBubble/);
});

test("Ready Apps use the catalog and deployment workflow instead of a browser-side Docker layer", () => {
  const list = read("src/components/ready_apps/ReadyApps.jsx");
  const detail = read("src/components/ready_apps/ReadyAppDetail.jsx");
  const wizard = read("src/components/ready_apps/ReadyAppWizard.jsx");

  for (const source of [list, detail, wizard]) {
    assert.match(source, /apiRequest/);
    assert.doesNotMatch(source, /\bdocker\b.*\bexec\b/i);
    assert.doesNotMatch(source, /compose\.ya?ml/i);
  }

  assert.match(list, /ready-apps/);
  assert.match(detail, /install/i);
  assert.match(wizard, /\/install/);
});

test("Service workspace keeps API, deployment, logs, shell and session-aware transports wired", () => {
  const service = read("src/components/service_detail/ServiceDetail.jsx");
  const serviceLogs = read("src/components/service_detail/hooks/useServiceLogs.js");
  const deployLogs = read("src/components/service_detail/hooks/useDeployLogs.js");

  assert.match(service, /apiRequest/);
  assert.match(service, /CreateDeployPanel/);
  assert.match(service, /LogsPanel/);
  assert.match(service, /ShellPanel/);
  assert.match(service, /SettingsPanel/);
  assert.match(service, /activeTab/);
  assert.match(service, /ServiceErrorAlert/);
  for (const transport of [serviceLogs, deployLogs]) {
    assert.match(transport, /refreshAccessToken|isSessionBoundToken/);
  }
});


test("Ready App deletion uses durable backend state without repeat DELETE polling", () => {
  const detail = read("src/components/ready_apps/ReadyAppInstallation.jsx");
  const list = read("src/components/ready_apps/ReadyAppInstallations.jsx");

  assert.match(detail, /deletion_pending/);
  assert.match(detail, /APPLICATION_DELETION_PENDING/);
  assert.match(detail, /cleanupDeletePending/);
  assert.match(detail, /setInterval\(refreshDeleteStatus, 2000\)/);
  assert.match(detail, /statusCode === 404/);

  const pollerStart = detail.indexOf("const refreshDeleteStatus = async () =>");
  const pollerEnd = detail.indexOf("const timer = window.setInterval(refreshDeleteStatus, 2000)");
  assert.ok(pollerStart >= 0, "Ready App cleanup poller must remain present");
  assert.ok(pollerEnd > pollerStart, "Ready App cleanup poller must have a stable interval");
  assert.doesNotMatch(
    detail.slice(pollerStart, pollerEnd),
    /method:\s*"DELETE"/
  );

  assert.match(list, /function isDeletionPending/);
  assert.match(list, /Cleaning up/);
});

test("Messenger member selection normalizes list responses before mapping contacts", () => {
  const app = read("src/components/messenger/MessengerApp.jsx");
  const dialogs = read("src/components/messenger/components/MessengerDialogs.jsx");

  assert.match(app, /setContacts\(unwrapList\(res\)\)/);
  assert.match(dialogs, /const safeContacts = Array\.isArray\(contacts\)/);
  assert.match(dialogs, /const safeConversations = Array\.isArray\(conversations\)/);
  assert.match(dialogs, /safeContacts\.map\(/);
  assert.match(dialogs, /safeConversations\.map\(/);
  assert.doesNotMatch(dialogs, /\{contacts\.map\(/);
});

test("Ready App cleanup only redirects while its detail route is still active", () => {
  const source = read("src/components/ready_apps/ReadyAppInstallation.jsx");

  assert.match(source, /useLocation/);
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*locationPathRef\.current = location\.pathname/);
  assert.match(source, /location\.pathname !== installationPath/);
  assert.match(source, /locationPathRef\.current === installationPath\) navigate/);
});

test("Home Ready Apps uses authentic local brand marks and keeps mobile copy visible", () => {
  const home = read("src/components/home/home.jsx");
  const logoPaths = [
    "ready-app-wordpress.svg",
    "ready-app-n8n.svg",
    "ready-app-mattermost.svg",
    "ready-app-synapse.svg",
    "ready-app-uptime-kuma.svg",
    "ready-app-forgejo.svg",
  ];

  for (const logoPath of logoPaths) {
    assert.ok(home.includes(logoPath), "Missing local Ready App brand mark: " + logoPath);
    const icon = read("src/assets/home/" + logoPath);
    assert.match(icon, /<title>/);
    assert.match(icon, /fill="#[0-9A-Fa-f]{6}"/);
    assert.match(icon, /<path\s+d=/);
  }

  assert.match(home, /FEATURED_READY_APPS\.map\(/);
  assert.match(home, /initial=\{reduceMotion \|\| !isMdUp \? "show" : "hidden"\}/);
});

test("About page fills its Ready Apps visual section with branded marks and responsive columns", () => {
  const about = read("src/components/aboutUs/aboutUs.jsx");
  const surfaceStart = about.indexOf("function Surface(");
  const visualStart = about.indexOf("function ArchitectureVisual(", surfaceStart);
  const surfaceComponent = about.slice(surfaceStart, visualStart);
  assert.ok(surfaceStart >= 0 && visualStart > surfaceStart, "About Surface component must be present");
  assert.match(surfaceComponent, /<Paper[\s\S]*>\s*\{children\}\s*<\/Paper>/);

  assert.match(about, /ABOUT_READY_APPS/);
  assert.match(about, /ABOUT_READY_APPS\.map/);
  for (const logo of [
    "ready-app-wordpress.svg",
    "ready-app-n8n.svg",
    "ready-app-mattermost.svg",
    "ready-app-synapse.svg",
    "ready-app-uptime-kuma.svg",
    "ready-app-forgejo.svg",
  ]) {
    assert.ok(about.includes(logo), "About page does not use " + logo);
  }
  assert.match(about, /gridTemplateColumns: \{ xs: "minmax\(0, 1fr\)", md:/);
  assert.match(about, /component="img"/);
  assert.match(about, /PLATFORM WORKFLOW/);
  assert.match(about, /From commit to running service/);
  assert.match(about, /Runtime health/);
  assert.match(about, /gridTemplateColumns: \{ xs: "repeat\(2, minmax\(0, 1fr\)\)", sm:/);
  assert.match(about, /APPLICATION FLOW/);
  assert.match(about, /Data layer/);
  assert.match(about, /Public route/);
  assert.match(about, /ArrowForwardRounded sx=\{\{ fontSize: 16, transform: \{ xs: "rotate\(90deg\)", sm: "none" \} \}\}/);
});

test("dashboard shell and workspace header support narrow viewports consistently", () => {
  const shell = read("src/components/dashboard/Dashboard.jsx");
  const navbar = read("src/components/dashboard/DashboardNavbar.jsx");
  const sidebar = read("src/components/dashboard/DashboardSidebar.jsx");
  const volumes = read("src/components/volumes/Volumes.jsx");
  const networks = read("src/components/networks/Networks.jsx");

  assert.match(shell, /overflowX: \{ xs: "clip", md: "visible" \}/);
  assert.match(shell, /"& \.MuiTableContainer-root": \{ maxWidth: "100%", overflowX: "auto" \}/);
  assert.match(navbar, /return "App Library"/);
  assert.match(navbar, /return "Deployed Apps"/);
  assert.match(navbar, /return "Agents"/);
  assert.match(navbar, /p\.startsWith\("\/dashboard\/tickets\/new"\)\) return "New ticket"/);
  assert.match(navbar, /p === "\/dashboard" \? "Overview" : "Dashboard"/);
  assert.match(sidebar, /aria-label="Close dashboard menu"/);
  assert.match(volumes, /borderRadius: 1\.75/);
  assert.match(networks, /borderRadius: 1\.75/);
});

test("primary navigation omits Tickets while the Dashboard sidebar keeps it", () => {
  const navbar = read("src/components/layout/Navbar.jsx");
  const dashboardSidebar = read("src/components/dashboard/DashboardSidebar.jsx");

  assert.doesNotMatch(navbar, /path:\s*["']\/tickets["'],\s*label:\s*["']Tickets["']/);
  assert.doesNotMatch(navbar, /ConfirmationNumberOutlinedIcon/);
  assert.equal((navbar.match(/visibleNavItems\.map\(/g) || []).length, 2);

  assert.match(dashboardSidebar, /label: "Tickets", path: "\/dashboard\/tickets"/);
  assert.match(dashboardSidebar, /pathname\.startsWith\("\/dashboard\/tickets"\)/);
});


test("homepage metrics keep a four-cell mobile layout with a centered plus divider", () => {
  const source = read("src/components/home/home.jsx");
  const metricsStart = source.indexOf("/* ───────────────── METRICS ───────────────── */");
  const plansStart = source.indexOf("/* ───────────────── PLANS ───────────────── */", metricsStart);
  assert.ok(metricsStart >= 0 && plansStart > metricsStart, "metrics panel should remain between hero and plans");
  const metrics = source.slice(metricsStart, plansStart);

  for (const label of [
    "1 control plane",
    "Docker-native",
    "Hourly-ready",
    "Self-hosted",
  ]) {
    assert.ok(metrics.includes(label), `missing homepage metric: ${label}`);
  }

  assert.ok(metrics.includes('gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }'));
  assert.ok(metrics.includes('gridTemplateRows: { xs: "repeat(2, minmax(0, 1fr))", md: "none" }'));
  assert.ok(metrics.includes("xs: i % 2 === 0"));
  assert.ok(metrics.includes("xs: i < 2"));
  assert.ok(metrics.includes('display: { xs: "grid", md: "none" }'));
  assert.ok(metrics.includes("\n              +\n            </Box>"), "mobile plus marker should be present");
});
