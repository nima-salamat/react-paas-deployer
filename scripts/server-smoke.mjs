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

function findWasmAsset(dir) {
  if (!fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findWasmAsset(fullPath);
      if (nested) return nested;
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".wasm")) {
      return fullPath;
    }
  }
  return null;
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

  const wasmAsset = findWasmAsset(path.join(process.cwd(), "dist"));
  if (!wasmAsset) {
    throw new Error("Built frontend does not contain the Matrix crypto WASM asset.");
  }
  const wasmPath = `/${path.relative(path.join(process.cwd(), "dist"), wasmAsset).split(path.sep).join("/")}`;
  const wasmResponse = await fetch(`http://127.0.0.1:${port}${wasmPath}`);
  const wasmContentType = (wasmResponse.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!wasmResponse.ok || wasmContentType !== "application/wasm") {
    throw new Error(
      `Matrix crypto WASM asset was not served with application/wasm (status=${wasmResponse.status}, content-type=${wasmContentType || "missing"}).`,
    );
  }
  if (!(wasmResponse.headers.get("cache-control") || "").toLowerCase().includes("no-cache")) {
    throw new Error("Matrix crypto WASM must revalidate to avoid retaining stale MIME headers.");
  }

  console.log("Server shell smoke test passed for / and Matrix crypto WASM MIME.");
} finally {
  child.kill("SIGTERM");
}
