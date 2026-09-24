import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist");

const ROUTES = [
  {
    path: "index.html",
    url: "https://echonode.website/",
    title: "PassDeployer | Application Deployment & Management",
  },
  {
    path: "plans/index.html",
    url: "https://echonode.website/plans",
    title: "Plans & Pricing | PassDeployer",
  },
  {
    path: "aboutUs/index.html",
    url: "https://echonode.website/aboutUs",
    title: "About PassDeployer | Application Deployment Platform",
  },
];

function fail(message) {
  throw new Error(message);
}

function readHtml(relativePath) {
  const filePath = path.join(root, relativePath);

  if (!fs.existsSync(filePath)) {
    fail(`Missing prerendered document: ${relativePath}. Run "npm run build" first.`);
  }

  return fs.readFileSync(filePath, "utf8");
}

function count(html, pattern) {
  return [...html.matchAll(pattern)].length;
}

for (const route of ROUTES) {
  const html = readHtml(route.path);

  if (!/^<!doctype html>/i.test(html.trim())) {
    fail(`${route.path}: invalid HTML document header.`);
  }

  if (count(html, /<title\b[^>]*>/gi) !== 1) {
    fail(`${route.path}: expected exactly one <title>.`);
  }

  if (count(html, /<link\b[^>]*rel=["']canonical["'][^>]*>/gi) !== 1) {
    fail(`${route.path}: expected exactly one canonical link.`);
  }

  if (count(html, /<meta\b[^>]*name=["']description["'][^>]*>/gi) !== 1) {
    fail(`${route.path}: expected exactly one meta description.`);
  }

  if (count(html, /<meta\b[^>]*name=["']robots["'][^>]*>/gi) !== 1) {
    fail(`${route.path}: expected exactly one robots directive.`);
  }

  if (count(html, /<meta\b[^>]*name=["']x-prerendered["'][^>]*content=["']true["'][^>]*>/gi) !== 1) {
    fail(`${route.path}: missing prerender marker.`);
  }

  if (!/<style\b[^>]*data-emotion=["']pd\s+/i.test(html)) {
    fail(`${route.path}: prerendered HTML is missing critical Emotion CSS.`);
  }

  if (!html.includes(`<link rel="canonical" href="${route.url}"`)) {
    fail(`${route.path}: canonical URL does not match ${route.url}.`);
  }

  const escapedTitle = route.title.replaceAll(
    "&",
    "&amp;",
  );

  if (
    !html.includes(
      `<title>${escapedTitle}</title>`,
    )
  ) {
    fail(
      `${route.path}: title does not match the route registry.`,
    );
  }

  if (!/<h1\b[^>]*>/i.test(html)) {
    fail(`${route.path}: prerendered HTML contains no H1.`);
  }

  if (
    /rel=["']amphtml["']/i.test(html) ||
    html.includes("/amp/")
  ) {
    fail(
      `${route.path}: stale AMP references remain in prerendered HTML.`,
    );
  }

  if (!/name=["']robots["'][^>]*content=["']index, follow/i.test(html)) {
    fail(`${route.path}: public route is not indexable in the prerendered HTML.`);
  }
}

const ampDir = path.join(root, "amp");

if (fs.existsSync(ampDir)) {
  fail("dist/amp still exists. AMP output must not be generated.");
}

console.log(`SEO build contract passed for ${ROUTES.length} public routes.`);
