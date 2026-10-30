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
  ];

  for (const page of chrome) {
    const source = await readFile(new URL(page, import.meta.url), "utf8");
    assert.match(source, /useLocale/, `${page} should localize dynamic strings`);
  }

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
