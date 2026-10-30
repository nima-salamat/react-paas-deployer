import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { translateText } from "../src/i18n/messages.js";

test("Persian locale covers the requested public, dashboard, service and Messenger pages", () => {
  const samples = [
    "About PaaSDeployer",
    "Infrastructure should feel like a product.",
    "One control plane",
    "Choose the resources that fit your workload.",
    "Select a plan and create a deployment",
    "Account details",
    "Theme preference",
    "Recovery key & encrypted backup",
    "Media settings",
    "No services shared with this group yet.",
    "Open dashboard",
    "Loading service",
    "Infrastructure should feel like a product.",
    "pipeline · build · release",
    "The boring parts should stay boring.",
    "Plans are temporarily unavailable.",
    "PaaSDeployer — open-source PaaS platform.",
    "Quick navigation",
    "Open-source PaaS · Docker-native",
    "Healthy",
    "Complete",
    "Container",
    "Running",
    "Release progress",
    "A calmer way to operate",
    "Less infrastructure assembly. More time shipping.",
    "PaaSDeployer keeps the operational surface area small: one place to create services, ship releases, read logs and manage the runtime boundary around your workloads.",
    "Create a service, connect code, deploy, inspect logs and manage the runtime without jumping between disconnected tools.",
    "Docker-backed services provide a predictable boundary for applications, data services and supporting workloads.",
    "See resource usage, service health, networking and persistent data from one focused control plane.",
    "Search public groups…",
    "Search conversations or people…",
    "All",
    "Unread",
    "Pinned",
    "Pin",
    "Unpin",
    "Message pinned",
    "Message unpinned",
    "Pin message",
    "Unpin message",
    "You're all caught up.",
    "No pinned conversations.",
    "Photos, bio & privacy",
    "Devices & sessions",
    "Manage signed-in sessions",
    "Secure chat & recovery",
    "Encrypted history, recovery key and Matrix devices",
    "Preferences",
    "Camera & microphone",
    "Devices for voice and video messages",
    "Themes, avatars & message style",
    "Encrypted key backup is verified for this device.",
    "An encrypted backup already exists. Restore its existing recovery key or verify a trusted device; do not replace it.",
    "Recovery status could not be verified. Retry before relying on this device for encrypted history.",
    "Set up an encrypted key backup to help restore message history if this browser or device is lost.",
    "Unblock",
    "Photos · Videos · Music",
    "Share & manage group services",
    "Connection lost",
    "We could not reach the PaaSDeployer service. Check your connection and reconnect to continue.",
    "Reconnect",
    "Workspace",
    "Infrastructure",
    "Automation",
    "Account",
    "Apps",
    "Databases",
    "All plans",
    "Select all",
    "No app platforms",
    "No database platforms",
    "Network Error",
    "Your conversations",
    "Search messages…",
    "Lock recording",
    "Your profile",
    "Manage account, photos & security",
    "Upload photo",
    "Screen share",
    "Developer knowledge base",
    "Search docs…",
    "PaaS Docs",
    "Back to app",
    "Documentation page not found",
    "Browse documentation",
    "Service name is required.",
    "Please select or create a network.",
    "Volume added to this wizard. It will be created and attached after the Service is created.",
    "The backend reports that volume changes are unavailable until the service is idle.",
    "No deploy history available. Start a deploy to see live events.",
  ];

  for (const source of samples) {
    assert.notEqual(
      translateText(source, "fa"),
      source,
      `Expected a Persian translation for: ${source}`,
    );
  }
});

test("dynamic page data and non-JSX labels are connected to the active locale", async () => {
  const chrome = [
    "../src/components/layout/Footer.jsx",
    "../src/components/layout/FloatingNav.jsx",
    "../src/components/home/PlansPreview.jsx",
    "../src/components/layout/ConnectionReconnectDialog.jsx",
    "../src/components/plans/plans.jsx",
    "../src/components/messenger/components/MessengerHome.jsx",
    "../src/components/messenger/components/Sidebar.jsx",
    "../src/components/messenger/components/RightPanel.jsx",
    "../src/components/messenger/components/ChatHeader.jsx",
    "../src/components/messenger/components/MessageComposer.jsx",
    "../src/components/messenger/components/MessengerDialogs.jsx",
    "../src/components/messenger/components/ProfileView.jsx",
    "../src/components/messenger/components/JitsiCallModal.jsx",
    "../src/components/messenger/components/MediaSettingsDialog.jsx",
    "../src/components/messenger/components/GroupSharedServicesPanel.jsx",
  ];

  for (const page of chrome) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /useLocale/, `${page} should localize dynamic strings`);
  }

  const home = await readFile(new URL("../src/components/home/home.jsx", import.meta.url), "utf8");
  assert.match(home, /label=\{t\("Open-source PaaS · Docker-native"\)\}/);
  assert.match(home, /\{t\(a\)\}[\s\S]*\{t\(b\)\}/);
  const footer = await readFile(new URL("../src/components/layout/Footer.jsx", import.meta.url), "utf8");
  assert.equal((footer.match(/className="public-site-footer"/g) || []).length, 2);

  const homeCurtain = await readFile(new URL("../src/components/home/home.jsx", import.meta.url), "utf8");
  assert.match(homeCurtain, /side === "left"/);
  assert.match(homeCurtain, /left: side === "left" \? 0 : "auto"/);
  assert.match(homeCurtain, /right: side === "right" \? 0 : "auto"/);
  assert.doesNotMatch(homeCurtain, /const visualSide = isRTL/);

  const floatingNav = await readFile(new URL("../src/components/layout/FloatingNav.jsx", import.meta.url), "utf8");
  assert.match(floatingNav, /style=\{containerStyle\}/);
  assert.match(floatingNav, /left: isRTL \? horizontalOffset : "auto"/);
  assert.match(floatingNav, /right: isRTL \? "auto" : horizontalOffset/);
  assert.match(floatingNav, /alignItems: "flex-end"/);

  const messengerSettings = await readFile(new URL("../src/components/messenger/components/RightPanel.jsx", import.meta.url), "utf8");
  assert.match(messengerSettings, /\{t\(headerTitle\)\}/);
  assert.match(messengerSettings, /primary=\{t\("My profile"\)\}/);
  assert.match(messengerSettings, /secondary=\{t\("Photos, bio & privacy"\)\}/);
  assert.match(messengerSettings, /t\("Secure chat & recovery"\)/);
  assert.match(messengerSettings, /t\("Themes, avatars & message style"\)/);

  const messengerSidebar = await readFile(new URL("../src/components/messenger/components/Sidebar.jsx", import.meta.url), "utf8");
  assert.match(messengerSidebar, /placeholder=\{t\(listTab === 1 \? "Search public groups…"/);
  assert.match(messengerSidebar, /label=\{t\(label\)\}/);
  assert.match(messengerSidebar, /t\(ctx\.conv\.is_pinned \? "Unpin" : "Pin"\)/);

  const messageBubble = await readFile(new URL("../src/components/messenger/components/MessageBubble.jsx", import.meta.url), "utf8");
  assert.match(messageBubble, /tr\(isPinned \? "Unpin message" : "Pin message"\)/);

  const messengerApp = await readFile(new URL("../src/components/messenger/MessengerApp.jsx", import.meta.url), "utf8");
  assert.match(messengerApp, /flash\(t\(data\?\.pinned \? "Message pinned" : "Message unpinned"\)\)/);
  const reconnect = await readFile(new URL("../src/components/layout/ConnectionReconnectDialog.jsx", import.meta.url), "utf8");
  assert.match(reconnect, /t\(state\.title\)/);
  assert.match(reconnect, /t\(state\.body\)/);
  const plans = await readFile(new URL("../src/components/plans/plans.jsx", import.meta.url), "utf8");
  assert.match(plans, /t\(allSelectedInTab/);
  assert.match(plans, /t\(fetchError\)/);
  const sidebar = await readFile(new URL("../src/components/dashboard/DashboardSidebar.jsx", import.meta.url), "utf8");
  assert.match(sidebar, /t\(group\.group\)/);

  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /public-marketing-page/);
  assert.match(css, /letter-spacing: 0 !important/);

  const pages = [
    "../src/components/home/home.jsx",
    "../src/components/aboutUs/aboutUs.jsx",
    "../src/components/dashboard/DashboardSidebar.jsx",
    "../src/components/dashboard/DashboardOverview.jsx",
    "../src/components/profile/profile.jsx",
    "../src/components/messenger/MessengerProfileEditor.jsx",
    "../src/components/messenger/components/RightPanel.jsx",
    "../src/components/service_detail/components/SettingsPanel.jsx",
  ];

  for (const page of pages) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /useLocale/, `${page} should translate dynamic UI copy`);
  }
});

test("documentation, plan service creation, service editing and Service Detail panels localize UI chrome", async () => {
  const surfaces = [
    "../src/components/docs/DocumentationWorkspace.jsx",
    "../src/components/admin/panels/DocumentationPanel.jsx",
    "../src/components/plans/CreateDeploymentModal.jsx",
    "../src/components/service/services/ServiceEditDialog.jsx",
    "../src/components/service_detail/ServiceDetail.jsx",
    "../src/components/service_detail/components/OverviewPanel.jsx",
    "../src/components/service_detail/components/CreateDeployPanel.jsx",
    "../src/components/service_detail/components/ConfigBuilder.jsx",
    "../src/components/service_detail/components/DeployCard.jsx",
    "../src/components/service_detail/components/GlobalServiceControls.jsx",
    "../src/components/service_detail/components/LogsPanel.jsx",
    "../src/components/service_detail/components/LogPanel.jsx",
    "../src/components/service_detail/components/LogRow.jsx",
    "../src/components/service_detail/components/MobileServiceHeader.jsx",
    "../src/components/service_detail/components/MobileNavFab.jsx",
    "../src/components/service_detail/components/ServiceSharingPanel.jsx",
    "../src/components/service_detail/components/ServiceToolbar.jsx",
    "../src/components/service_detail/components/SettingsPanel.jsx",
    "../src/components/service_detail/components/TabSidebar.jsx",
    "../src/components/service_detail/components/ShellPanel.jsx",
  ];
  for (const page of surfaces) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /TranslatedTextTree/, page + " should translate text-bearing UI props");
  }
  const workspace = await readFile(new URL("../src/components/docs/DocumentationWorkspace.jsx", import.meta.url), "utf8");
  assert.match(workspace, /t\(block\.text\)/);
  assert.match(workspace, /block\.code/);
  const editService = await readFile(new URL("../src/components/service/services/ServiceEditDialog.jsx", import.meta.url), "utf8");
  assert.match(editService, /useLocale/);
  const serviceDetail = await readFile(new URL("../src/components/service_detail/ServiceDetail.jsx", import.meta.url), "utf8");
  assert.ok(serviceDetail.includes("message: t(message)"));
});
