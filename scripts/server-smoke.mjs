import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = 34123;
const child = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let errorOutput = "";

child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  errorOutput += chunk.toString();
});

function extractRoot(html) {
  const rootOpen = /<div\b[^>]*\bid=["']root["'][^>]*>/i.exec(html);
  if (!rootOpen) throw new Error("Missing #root");
  const openEnd = rootOpen.index + rootOpen[0].length;
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = openEnd;
  let depth = 1;
  let match;
  while ((match = tags.exec(html))) {
    depth += /^<div\b/i.test(match[0]) ? 1 : -1;
    if (depth === 0) {
      return html.slice(openEnd, match.index);
    }
  }
  throw new Error("Could not locate closing #root");
}

function findFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(fullPath, predicate, results);
    } else if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findWasmAssets(dir) {
  return findFiles(dir, (filePath) => path.extname(filePath).toLowerCase() === ".wasm");
}

function isReferencedByBuiltJavaScript(distDir, assetPath) {
  const basename = path.basename(assetPath);
  const bundles = findFiles(
    distDir,
    (filePath) => [".js", ".mjs"].includes(path.extname(filePath).toLowerCase()),
  );
  return bundles.some((bundlePath) => fs.readFileSync(bundlePath, "utf8").includes(basename));
}

async function waitForServer(url) {
  const deadline = Date.now() + 10_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Server did not become ready: ${lastError?.message || errorOutput || output || "unknown error"}`,
  );
}

try {
  const response = await waitForServer(`http://127.0.0.1:${port}/`);
  const permissionsPolicy = response.headers.get("permissions-policy") || "";
  if (!permissionsPolicy.includes("camera=(self)") || !permissionsPolicy.includes("microphone=(self)")) {
    throw new Error("Permissions-Policy does not allow browser media access for calls.");
  }

  const html = await response.text();
  const root = extractRoot(html);

  if (!root.includes('class="app-loading"')) {
    throw new Error("Root does not contain the loading shell.");
  }

  if (/<h1\b/i.test(root)) {
    throw new Error("Prerendered page content is still being served inside #root.");
  }

  if (!html.includes("Deploy faster. Manage more. Worry less.")) {
    throw new Error("Expected public SEO fallback content is missing.");
  }

  const distDir = path.join(process.cwd(), "dist");
  const wasmAssets = findWasmAssets(distDir);
  if (!wasmAssets.length) {
    throw new Error("Built frontend does not contain the Matrix crypto WASM asset.");
  }

  // Verify that the actual WASM URL referenced by the production JS bundle
  // resolves to the emitted binary; an unrelated file in dist is not enough.
  const referencedWasmAssets = wasmAssets.filter((assetPath) =>
    isReferencedByBuiltJavaScript(distDir, assetPath),
  );
  if (!referencedWasmAssets.length) {
    throw new Error("No emitted Matrix crypto WASM asset is referenced by a built JavaScript bundle.");
  }

  for (const wasmAsset of referencedWasmAssets) {
    const wasmPath = `/${path.relative(distDir, wasmAsset).split(path.sep).join("/")}`;
    const wasmResponse = await fetch(`http://127.0.0.1:${port}${wasmPath}`);
    const wasmContentType = (wasmResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!wasmResponse.ok || wasmContentType !== "application/wasm") {
      throw new Error(
        `Matrix crypto WASM asset was not served with application/wasm (path=${wasmPath}, status=${wasmResponse.status}, content-type=${wasmContentType || "missing"}).`,
      );
    }
    if (!(wasmResponse.headers.get("cache-control") || "").toLowerCase().includes("no-cache")) {
      throw new Error(`Matrix crypto WASM must revalidate to avoid retaining stale MIME headers: ${wasmPath}`);
    }

    const wasmMagic = Buffer.from(await wasmResponse.arrayBuffer()).subarray(0, 4);
    if (!wasmMagic.equals(Buffer.from([0x00, 0x61, 0x73, 0x6d]))) {
      throw new Error(`Matrix crypto WASM URL returned a non-WASM body: ${wasmPath}`);
    }
  }

  // Missing WASM files must not fall through to an HTML SPA/SEO response.
  const missingWasmResponse = await fetch(
    `http://127.0.0.1:${port}/assets/__paasdeployer_missing_${Date.now()}.wasm`,
  );
  const missingWasmType = (missingWasmResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (
    missingWasmResponse.status !== 404 ||
    missingWasmType !== "text/plain" ||
    !(missingWasmResponse.headers.get("cache-control") || "").toLowerCase().includes("no-store")
  ) {
    throw new Error("Missing WASM paths must return a no-store 404, not an HTML SPA fallback.");
  }

  console.log("Server shell smoke test passed for referenced Matrix WASM assets, MIME, body signature and cache policy.");
} finally {
  child.kill("SIGTERM");
}
