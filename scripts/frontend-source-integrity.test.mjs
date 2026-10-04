import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function resolveLocalImport(file, specifier) {
  if (!specifier.startsWith(".")) return null;

  const base = path.resolve(path.dirname(file), specifier);
  const candidates = [
    base,
    base + ".js",
    base + ".jsx",
    base + ".mjs",
    base + ".json",
    path.join(base, "index.js"),
    path.join(base, "index.jsx"),
    path.join(base, "index.mjs"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function importsFrom(source) {
  const found = [];
  const staticImport =
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicImport = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

  for (const match of source.matchAll(staticImport)) found.push(match[1]);
  for (const match of source.matchAll(dynamicImport)) found.push(match[1]);

  return [...new Set(found)];
}

test("every local JS/JSX import resolves to a real source file", () => {
  const failures = [];

  for (const file of walk(srcRoot)) {
    const source = fs.readFileSync(file, "utf8");
    for (const specifier of importsFrom(source)) {
      if (!specifier.startsWith(".")) continue;
      if (!resolveLocalImport(file, specifier)) {
        failures.push(
          path.relative(root, file) + ' -> missing local import "' + specifier + '"',
        );
      }
    }
  }

  assert.deepEqual(
    failures,
    [],
    "Broken local imports found:\n" + failures.join("\n"),
  );
});

test("startup and React runtime recovery boundaries are wired", () => {
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const main = fs.readFileSync(path.join(srcRoot, "main.jsx"), "utf8");
  const rootComponent = fs.readFileSync(path.join(srcRoot, "Root.jsx"), "utf8");
  const boundaryPath = path.join(srcRoot, "components", "error", "AppErrorBoundary.jsx");
  const boundary = fs.readFileSync(boundaryPath, "utf8");

  assert.match(index, /__PASSDEPLOYER_BOOT__/);
  assert.match(index, /unhandledrejection/);
  assert.match(index, /BOOT_TIMEOUT_MS/);
  assert.match(index, /app-boot-failed/);

  assert.match(main, /AppErrorBoundary/);
  assert.match(main, /createRoot\(rootElement\)\.render\(app\)/);
  assert.match(main, /showError/);

  assert.match(rootComponent, /useBootReady/);
  assert.match(rootComponent, /<BootReadyMarker \/>/);

  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /componentDidCatch/);
  assert.match(boundary, /unhandledrejection/);
  assert.match(boundary, /window\.history\.back/);
  assert.match(boundary, /window\.location\.assign\(["']\/["']\)/);
  assert.match(boundary, /Error message/);
});

test("application route modules referenced by App.jsx are backed by real files", () => {
  const source = fs.readFileSync(path.join(srcRoot, "App.jsx"), "utf8");
  const failures = [];

  for (const specifier of importsFrom(source)) {
    if (!specifier.startsWith("./")) continue;
    if (!resolveLocalImport(path.join(srcRoot, "App.jsx"), specifier)) {
      failures.push(specifier);
    }
  }

  assert.deepEqual(failures, []);
});

test("direct axios usage is limited to the audited public-auth/public-plans modules", () => {
  const allowed = new Set([
    "src/components/home/PlansPreview.jsx",
    "src/components/plans/plans.jsx",
    "src/components/signin_or_signup/signin_or_signup.jsx",
    "src/components/customHooks/apiRequest.jsx",
  ]);
  const failures = [];

  for (const file of walk(srcRoot)) {
    const relative = path.relative(root, file);
    const source = fs.readFileSync(file, "utf8");
    if (/\baxios(?:\.|\s*\()/.test(source) && !allowed.has(relative)) {
      failures.push(relative);
    }
  }

  assert.deepEqual(
    failures,
    [],
    "Unexpected direct axios usage found:\\n" + failures.join("\\n"),
  );
});
