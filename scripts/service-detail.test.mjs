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
