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
  assert.match(homeCurtain, /const visualSide = isRTL/);
  assert.match(homeCurtain, /\[visualSide\]: 0/);
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
