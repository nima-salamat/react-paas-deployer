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

  const cleanupPoll = detail.match(
    /const refreshDeleteStatus = async \(\) =>[\\s\\S]*?const timer = window\.setInterval\(refreshDeleteStatus, 2000\)/
  );
  assert.ok(cleanupPoll, "Ready App cleanup poller must remain present");
  assert.doesNotMatch(cleanupPoll[0], /method:\s*"DELETE"/);

  assert.match(list, /function isDeletionPending/);
  assert.match(list, /Cleaning up/);
});
