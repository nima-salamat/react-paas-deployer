import assert from "node:assert/strict";
import testFn from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

testFn("Ready App wizard imports every MUI component it renders", () => {
  const source = read("src/components/ready_apps/ReadyAppWizard.jsx");

  assert.match(source, /import \{[\s\S]*IconButton[\s\S]*\} from "@mui\/material";/);
  assert.match(source, /<IconButton\b/);
});

testFn("Ready App detail has no undeclared IconButton reference", () => {
  const source = read("src/components/ready_apps/ReadyAppDetail.jsx");

  assert.doesNotMatch(source, /<IconButton\b/);
});


testFn("Ready Apps catalog remains backend-driven and does not hard-code a WordPress allowlist", () => {
  const source = read("src/components/ready_apps/ReadyApps.jsx");

  assert.match(source, /\/api\/application-catalog/);
  assert.match(source, /\/apps\//);
  assert.match(source, /setApps\(normalizeList\(response\.data\)\)/);
  assert.doesNotMatch(source, /(?:if|filter|find).*wordpress/i);
});

testFn("Ready Apps catalog accepts both plain arrays and paginated results", () => {
  const source = read("src/components/ready_apps/ReadyApps.jsx");

  assert.match(source, /function normalizeList\(data\)/);
  assert.match(source, /if \(Array\.isArray\(data\)\) return data/);
  assert.match(source, /Array\.isArray\(data\?\.results\)/);
});

testFn("Ready Apps lists expose manual refresh and retry failed catalog requests", () => {
  const library = read("src/components/ready_apps/ReadyApps.jsx");
  const installations = read("src/components/ready_apps/ReadyAppInstallations.jsx");
  for (const source of [library, installations]) {
    assert.match(source, /RefreshRoundedIcon/);
    assert.match(source, /onClick=\{\(\) => load\(true\)\}/);
    assert.match(source, /setTimeout\(\(\) => load\(true\), 12000\)/);
    assert.match(source, /disabled=\{loading \|\| refreshing\}/);
  }

  const wizard = read("src/components/ready_apps/ReadyAppWizard.jsx");
  assert.match(wizard, /VisibilityRoundedIcon/);
  assert.match(wizard, /VisibilityOffRoundedIcon/);
  assert.match(wizard, /Show password/);
  assert.match(wizard, /Hide password/);
  assert.match(wizard, /setShowSecret\(\(visible\) => !visible\)/);
});

testFn("Ready App wizard keeps required settings visible and groups optional defaults", () => {
  const source = read("src/components/ready_apps/ReadyAppWizard.jsx");

  assert.match(source, /function isOptionalAdvancedField\(field\)/);
  assert.match(source, /return !field\.required && \(/);
  assert.match(source, /field\.ui\?\.advanced === true/);
  assert.match(source, /const primaryFields = visibleFields\.filter/);
  assert.match(source, /const optionalFields = visibleFields\.filter/);
  assert.match(source, /Show optional settings/);
  assert.match(source, /Hide optional settings/);
  assert.match(source, /setShowAdvancedFields\(false\)/);
  assert.match(source, /<Collapse in=\{showAdvancedFields\} unmountOnExit>/);
});


testFn("Ready App brands stay consistent from catalog to details, install flow and deployed apps", () => {
  const brand = read("src/components/ready_apps/ReadyAppBrandMark.jsx");
  const catalog = read("src/components/ready_apps/ReadyApps.jsx");
  const detail = read("src/components/ready_apps/ReadyAppDetail.jsx");
  const wizard = read("src/components/ready_apps/ReadyAppWizard.jsx");
  const installations = read("src/components/ready_apps/ReadyAppInstallations.jsx");
  const platform = read("src/components/plans/PlatformIcon.jsx");

  for (const logo of [
    "ready-app-wordpress.svg",
    "ready-app-uptime-kuma.svg",
    "ready-app-mattermost.svg",
    "ready-app-synapse.svg",
    "ready-app-forgejo.svg",
  ]) {
    assert.ok(brand.includes(logo), "Missing Ready App brand fallback " + logo);
  }
  assert.match(platform, /SiWordpress/);
  assert.match(platform, /SiUptimekuma/);
  assert.match(platform, /SiGrafana/);
  assert.match(catalog, /ReadyAppBrandMark/);
  assert.match(detail, /ReadyAppBrandMark/);
  assert.match(detail, /platformKey=\{component\.id \|\| component\.key \|\| component\.label\}/);
  assert.doesNotMatch(detail, /SecurityRoundedIcon/);
  assert.match(wizard, /ReadyAppBrandMark/);
  assert.match(installations, /ReadyAppBrandMark/);
});
