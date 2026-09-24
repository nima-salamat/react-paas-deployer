import { spawn } from "node:child_process";

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

  console.log("Server shell smoke test passed for /.");
} finally {
  child.kill("SIGTERM");
}
