import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';

import {
  PUBLIC_PAGES,
  buildSchema,
  canonicalUrl,
  getSiteConfig,
  isNoIndex,
} from './src/seo-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const { siteUrl: SITE_URL, siteName: SITE_NAME, preview: PREVIEW } = getSiteConfig(process.env);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonLd(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function buildHead(page, pathname, noindex = false) {
  const url = canonicalUrl(pathname, SITE_URL);
  const robots = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const schema = page
    ? buildSchema(page, pathname, { siteUrl: SITE_URL, siteName: SITE_NAME, preview: PREVIEW })
    : null;

  return `
    <title>${escapeHtml(page?.title || `404 | ${SITE_NAME}`)}</title>
    <meta name="description" content="${escapeHtml(page?.description || 'The requested page could not be found.')}" />
    <meta name="robots" content="${robots}" />
    <meta name="googlebot" content="${robots}" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="theme-color" content="#081325" />
    ${page && !noindex ? `
      <link rel="canonical" href="${escapeHtml(url)}" />
      ${pathname === "/" ? '<link rel="amphtml" href="' + escapeHtml(SITE_URL + '/amp/') + '" />' : ''}
      <link rel="alternate" hreflang="en" href="${escapeHtml(url)}" />
      <link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}" />
    ` : ''}
    <link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    ${page && !noindex ? `
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
      <meta property="og:title" content="${escapeHtml(page.title)}" />
      <meta property="og:description" content="${escapeHtml(page.description)}" />
      <meta property="og:url" content="${escapeHtml(url)}" />
      <meta property="og:image" content="${escapeHtml(PREVIEW)}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="675" />
      <meta property="og:image:alt" content="${escapeHtml(SITE_NAME)} deployment platform" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(page.title)}" />
      <meta name="twitter:description" content="${escapeHtml(page.description)}" />
      <meta name="twitter:image" content="${escapeHtml(PREVIEW)}" />
    ` : ''}
    ${schema ? `<script type="application/ld+json">${escapeJsonLd(schema)}</script>` : ''}
  `;
}

function loadTemplate() {
  return fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
}

const PUBLIC_SHELLS = {
  "/": {
    eyebrow: "PassDeployer",
    heading: "Deploy faster. Manage more. Worry less.",
    paragraphs: [
      "PassDeployer is an application deployment and infrastructure management platform for teams that want a simpler path from configured service to running application. Create services, choose CPU and memory resources, connect networks, keep persistent storage, and manage operational tasks from one focused control panel. The public experience explains the product clearly while the authenticated workspace remains focused on practical service operations.",
      "Instead of stitching together separate deployment utilities for every workload, PassDeployer brings the most common application operations into a consistent workflow. It is designed for developers and operators who need practical service controls without adding unnecessary infrastructure ceremony, giving them a focused place to deploy applications, manage resources, connect supporting infrastructure, and handle the service lifecycle with fewer repetitive steps.",
    ],
    sections: [
      { heading: "One place for deployment and infrastructure management", paragraphs: [
        "PassDeployer keeps service deployment, resource selection, networking, and persistent storage close together. You can define a service, give it the resources it needs, connect it to the right network, and keep its persistent data available across the service lifecycle. The goal is a predictable operational experience that lets teams spend more time improving their applications and less time repeating routine infrastructure work across disconnected tools.",
        "<strong>Service management</strong> covers the everyday actions required to run an application, while <strong>resource controls</strong> help you choose CPU, memory, and storage based on the workload. Networks and persistent volumes are treated as first-class resources so that an application can grow without forcing every operational task into a separate tool. This keeps infrastructure concepts close to the service that actually uses them.",
      ]},
      { heading: "From resources to a running service", paragraphs: [
        "The deployment workflow is built around a few clear steps. Choose the resources that fit the application, create the service and configuration, deploy it through a repeatable process, and then manage the running workload from the same control surface. When requirements change, resource plans can be adjusted instead of rebuilding the entire operating model around the new workload. That approach keeps routine deployments consistent while leaving room for applications to grow.",
      ]},
      { heading: "Built in the open for developers", paragraphs: [
        "PassDeployer is built as an open-source stack with a Django API and a React frontend. That architecture keeps the deployment API and operator experience distinct while making the project easier to inspect, extend, and integrate. Developers can review the implementation, understand the service workflow, and adapt the platform to their own deployment environment instead of relying on an opaque hosted interface. The public project pages provide context before users enter private operations.",
        "<strong>Application deployment</strong>, <strong>service lifecycle management</strong>, <strong>networks</strong>, and <strong>persistent volumes</strong> are the core concepts exposed by the platform. These capabilities make the public site useful as a product overview while the authenticated control panel remains dedicated to private operational data. Keeping public information separate from private service details also gives search engines a clean set of pages to crawl and index.",
      ]},
      { heading: "Ready to deploy?", paragraphs: [
        "Explore the available plans, learn how the platform works, or continue to the application to create and manage services. The public pages are intended to explain the product clearly to people and search engines, while private application routes remain protected from search indexing. Visitors can move from product information to the appropriate workflow without passing through a temporary SEO-only page.",
      ]},
    ],
    links: [["/plans", "Plans & Pricing"], ["/aboutUs", "About PassDeployer"], ["/signin_or_signup", "Sign in"]],
  },
  "/plans": {
    eyebrow: "PassDeployer plans",
    heading: "Choose resources that fit your application.",
    paragraphs: [
      "PassDeployer plans help you choose an appropriate amount of CPU, memory, and persistent storage for the workload you need to run. Start with the resources that fit your current application, then change the plan when traffic, processing requirements, or stored data grows. This gives teams a clear starting point for capacity planning before they move into the private service workspace.",
      "The public plans page explains resource options before you enter the authenticated control panel. This makes it easier to compare capacity and understand how <strong>resource limits</strong> relate to day-to-day application deployment and service management before you create a private service. It also gives visitors enough context to choose a plan without exposing private account or workload information or internal service details.",
    ],
    sections: [
      { heading: "Resource plans for different workloads", paragraphs: [
        "CPU and memory capacity affect how much work a service can process, while persistent storage provides a durable place for application data. Choosing resources around the actual workload helps you avoid both unnecessary capacity and restrictive limits that could slow a growing application. Reviewing these resources together makes the deployment decision easier to understand and adjust later as demand changes.",
      ]},
      { heading: "Scale the service as needs change", paragraphs: [
        "A deployment plan should not lock an application into the resources it needed on its first day. PassDeployer is designed so that resource choices can be revisited as the workload changes, keeping the operational workflow focused on the application instead of forcing a manual infrastructure redesign. This makes growth easier to manage when real usage differs from an initial estimate.",
      ]},
    ],
    links: [["/", "Back to PassDeployer"], ["/aboutUs", "About the platform"]],
  },
  "/aboutUs": {
    eyebrow: "About PassDeployer",
    heading: "A simpler way to run applications.",
    paragraphs: [
      "PassDeployer brings <strong>application deployment</strong> and day-to-day infrastructure management into one focused control plane. The project is designed for developers and operators who want practical service controls without having to navigate a collection of unrelated interfaces for every deployment task. The product keeps the common deployment workflow close to the resources and services that support each application and its ongoing operations.",
      "The platform combines a Django API with a React frontend so that orchestration logic and the operator experience can evolve independently. The result is a product architecture that is easier to inspect, extend, and adapt to a deployment environment, with <strong>service management</strong> kept close to the resources an application actually uses. The public documentation and product pages provide a clear introduction before authenticated operations begin.",
    ],
    sections: [
      { heading: "Focused service management", paragraphs: [
        "The platform centers on services, resources, networks, and persistent volumes. Those building blocks cover the common operational actions around deploying an application, keeping its configuration consistent, connecting supporting resources, and managing the service lifecycle after deployment. Together they give teams a coherent model for running applications without scattering basic operational controls across unrelated tools or separate dashboards used every day.",
      ]},
      { heading: "Open-source architecture", paragraphs: [
        "PassDeployer is built as an open-source stack, giving developers a way to inspect the implementation and understand how the deployment workflow works. The public product pages explain the platform, while authenticated routes are reserved for private operational information. This separation keeps search-visible product information useful and keeps account-specific service data safely outside the public index and public-facing HTML that search engines can crawl.",
      ]},
    ],
    links: [["/", "Home"], ["/plans", "Plans & Pricing"]],
  },
};

function buildPublicShell(pathname) {
  const shell = PUBLIC_SHELLS[pathname];
  if (!shell) {
    if (!isNoIndex(pathname)) {
      return `\n        <main class="seo-shell" aria-labelledby="not-found-heading">\n          <div class="seo-shell__eyebrow">${escapeHtml(SITE_NAME)}</div>\n          <h1 id="not-found-heading">Page not found</h1>\n          <p>The page you requested could not be found. Return to the PassDeployer home page to explore application deployment, resource plans, and service management.</p>\n          <nav aria-label="Page navigation"><a href="/">Back to PassDeployer</a></nav>\n        </main>\n      `;
    }
    return `\n      <main class="seo-shell" aria-labelledby="app-loading-heading">\n        <div class="seo-shell__eyebrow">${escapeHtml(SITE_NAME)}</div>\n        <h1 id="app-loading-heading">Loading your workspace</h1>\n        <p>Your authenticated application workspace is loading. Private operational pages are intentionally excluded from search indexing.</p>\n      </main>\n    `;
  }

  const sectionHtml = shell.sections.map((section) => `
    <section aria-labelledby="${slugify(section.heading)}">
      <h2 id="${slugify(section.heading)}">${escapeHtml(section.heading)}</h2>
      ${section.heading === "One place for deployment and infrastructure management" ? '<h3>Keep everyday operations in one workflow</h3>' : ''}
      ${section.paragraphs.map(paragraph => `<p>${safeInlineHtml(paragraph)}</p>`).join('')}
    </section>
  `).join('');
  const links = shell.links?.length ? `<nav aria-label="Primary navigation">${shell.links.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}</nav>` : '';

  return `
    <main class="seo-shell" aria-labelledby="seo-shell-heading">
      <header class="seo-shell__hero">
        <div class="seo-shell__eyebrow">${escapeHtml(shell.eyebrow)}</div>
        <h1 id="seo-shell-heading">${escapeHtml(shell.heading)}</h1>
        ${shell.paragraphs.map(paragraph => `<p>${safeInlineHtml(paragraph)}</p>`).join('')}
        ${links}
      </header>
      ${sectionHtml}
    </main>
  `;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function safeInlineHtml(value) {
  return String(value).replace(/<(strong|b)>/g, '&lt;$1&gt;').replace(/<\/(strong|b)>/g, '&lt;/$1&gt;').replace(/&lt;(strong|b)&gt;/g, '<$1>').replace(/&lt;\/(strong|b)&gt;/g, '</$1>');
}

function renderDocument(pathname, statusCode = 200) {
  const page = PUBLIC_PAGES[pathname];
  const noindex = !page || isNoIndex(pathname);
  let html = loadTemplate();
  const shell = buildPublicShell(pathname);
  html = html.replace(/<!--[ ]*APP_SHELL_START[ ]*-->[\s\S]*?<!--[ ]*APP_SHELL_END[ ]*-->/i, `<!-- APP_SHELL_START -->${shell}<!-- APP_SHELL_END -->`);

  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']googlebot["'][^>]*>/i, '');
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, '');
  html = html.replace(/<link\s+rel=["']alternate["'][^>]*hreflang=["'][^"']+["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']referrer["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']theme-color["'][^>]*>/i, '');
  html = html.replace('</head>', `${buildHead(page, pathname, noindex)}\n</head>`);

  return { statusCode, html };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  })[ext] || 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const filePath = path.resolve(DIST_DIR, relative);
  if (!filePath.startsWith(path.resolve(DIST_DIR) + path.sep)) return false;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return false;

  const type = contentType(filePath);
  const cacheable = /\.(?:js|mjs|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(filePath);
  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': cacheable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(filePath).pipe(res);
  return true;
}

function sitemapXml() {
  const urls = Object.keys(PUBLIC_PAGES).map((pathname) => `
    <url>
      <loc>${escapeHtml(canonicalUrl(pathname, SITE_URL))}</loc>
      <changefreq>${pathname === '/' ? 'weekly' : 'monthly'}</changefreq>
      <priority>${pathname === '/' ? '1.0' : '0.7'}</priority>
    </url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
}

function robotsTxt() {
  // Keep ordinary application pages crawlable so Google can see their noindex
  // directives. robots.txt is not an access-control mechanism.
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function adsTxt() {
  // The site currently has no advertising partners. Keep this endpoint valid
  // and intentionally empty until an advertising platform provides an
  // authorized-seller record. Never invent a publisher/ad-network line.
  return `# ${SITE_NAME} currently has no authorized digital advertising sellers.\n`;
}

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', SITE_URL);
  const pathname = decodeURIComponent(requestUrl.pathname || '/');

  // The canonical host is controlled at the edge by Nginx. Keep this process simple.
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  if (pathname === '/robots.txt') {
    res.writeHead(200, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(robotsTxt());
    return;
  }

  if (pathname === '/amp' || pathname === '/amp/') {
    const ampPath = path.join(DIST_DIR, 'amp', 'index.html');
    if (fs.existsSync(ampPath)) {
      res.writeHead(200, { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      if (req.method === 'HEAD') res.end();
      else createReadStream(ampPath).pipe(res);
      return;
    }
  }

  if (pathname === '/sitemap.xml') {
    res.writeHead(200, { ...securityHeaders, 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
    res.end(sitemapXml());
    return;
  }

  if (pathname === '/ads.txt') {
    res.writeHead(200, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    res.end(adsTxt());
    return;
  }

  if (pathname !== '/' && pathname.endsWith('/')) {
    const target = `${pathname.replace(/\/+$/, '')}${requestUrl.search}`;
    res.writeHead(308, { ...securityHeaders, Location: target });
    res.end();
    return;
  }

  if (serveStatic(req, res, pathname)) return;

  const isNotFound = !PUBLIC_PAGES[pathname] && !isNoIndex(pathname);
  const { statusCode, html } = renderDocument(pathname, isNotFound ? 404 : 200);
  const headers = {
    ...securityHeaders,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    ...(isNotFound || isNoIndex(pathname) ? { 'X-Robots-Tag': 'noindex, nofollow' } : {}),
  };
  res.writeHead(statusCode, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(html);
});

const port = Number(process.env.PORT || 3000);
server.listen(port, '0.0.0.0', () => {
  console.log(`${SITE_NAME} SEO server listening on :${port}`);
});
