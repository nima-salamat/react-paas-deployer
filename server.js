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
  isDocsPath,
} from './src/seo-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const SITE_CONFIG = getSiteConfig(process.env);
const { siteUrl: SITE_URL, siteName: SITE_NAME, preview: PREVIEW, apiOrigin: API_ORIGIN } = SITE_CONFIG;
const DOCS_CACHE_TTL_MS = 5 * 60 * 1000;
let docsSitemapCache = { expiresAt: 0, items: [] };


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

function buildHead(page, pathname, noindex = false, docs = null) {
  const url = canonicalUrl(pathname, SITE_URL);
  const robots = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const schema = page
    ? buildSchema(page, pathname, SITE_CONFIG, { docs })
    : null;

  const ogImageAlt = docs ? `${docs.title} | ${SITE_NAME}` : `${SITE_NAME} deployment platform`;

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
    ${page ? `
      <meta property="og:type" content="${docs ? 'article' : 'website'}" />
      <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
      <meta property="og:title" content="${escapeHtml(page.title)}" />
      <meta property="og:description" content="${escapeHtml(page.description)}" />
      <meta property="og:url" content="${escapeHtml(url)}" />
      <meta property="og:image" content="${escapeHtml(PREVIEW)}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="675" />
      <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${escapeHtml(page.title)}" />
      <meta name="twitter:description" content="${escapeHtml(page.description)}" />
      <meta name="twitter:image" content="${escapeHtml(PREVIEW)}" />
      <meta name="twitter:image:alt" content="${escapeHtml(ogImageAlt)}" />
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
      "Instead of stitching together separate deployment utilities for every workload, PassDeployer brings the most common application operations into a consistent workflow. It is designed for developers and operators who need practical service controls without adding unnecessary infrastructure ceremony.",
    ],
    sections: [
      { heading: "One place for deployment and infrastructure management", paragraphs: [
        "PassDeployer keeps service deployment, resource selection, networking, and persistent storage close together. You can define a service, give it the resources it needs, connect it to the right network, and keep its persistent data available across the service lifecycle.",
        "<strong>Service management</strong> covers the everyday actions required to run an application, while <strong>resource controls</strong> help you choose CPU, memory, and storage based on the workload.",
      ]},
      { heading: "From resources to a running service", paragraphs: [
        "Choose the resources that fit the application, create the service and configuration, deploy it through a repeatable process, and then manage the running workload from the same control surface.",
      ]},
      { heading: "Built in the open for developers", paragraphs: [
        "PassDeployer is built as an open-source stack with a Django API and a React frontend. <strong>Application deployment</strong>, <strong>service lifecycle management</strong>, <strong>networks</strong>, and <strong>persistent volumes</strong> are the core concepts exposed by the platform.",
      ]},
    ],
    links: [["/plans", "Plans & Pricing"], ["/aboutUs", "About PassDeployer"], ["/signin_or_signup", "Sign in"]],
  },
  "/plans": {
    eyebrow: "PassDeployer plans",
    heading: "Choose resources that fit your application.",
    paragraphs: [
      "PassDeployer plans help you choose an appropriate amount of CPU, memory, and persistent storage for the workload you need to run. Start with the resources that fit your current application, then change the plan when traffic, processing requirements, or stored data grows.",
      "The public plans page explains resource options before you enter the authenticated control panel. This makes it easier to compare capacity and understand how <strong>resource limits</strong> relate to day-to-day application deployment and service management.",
    ],
    sections: [
      { heading: "Resource plans for different workloads", paragraphs: [
        "CPU and memory capacity affect how much work a service can process, while persistent storage provides a durable place for application data. Choosing resources around the actual workload helps you avoid both unnecessary capacity and restrictive limits.",
      ]},
      { heading: "Scale the service as needs change", paragraphs: [
        "A deployment plan should not lock an application into the resources it needed on its first day. PassDeployer is designed so that resource choices can be revisited as the workload changes.",
      ]},
    ],
    links: [["/", "Back to PassDeployer"], ["/aboutUs", "About the platform"]],
  },
  "/docs": {
    eyebrow: "PassDeployer documentation",
    heading: "Documentation for deploying and managing applications.",
    paragraphs: [
      "Browse published PassDeployer guides, references and practical how-tos for deploying, configuring and managing applications.",
      "Documentation pages are published individually and linked from the documentation index, so each guide can be discovered, shared and indexed on its own canonical URL.",
    ],
    sections: [
      { heading: "Guides and references", paragraphs: [
        "Use the documentation index to find deployment guides, configuration references, service-management instructions, and other practical material for working with PassDeployer.",
      ]},
      { heading: "Published documentation only", paragraphs: [
        "The public documentation API exposes published pages and their public assets. Draft documentation and unattached library files remain in the authenticated administration area.",
      ]},
    ],
    links: [["/plans", "Plans & Pricing"], ["/aboutUs", "About PassDeployer"]],
  },
  "/aboutUs": {
    eyebrow: "About PassDeployer",
    heading: "A simpler way to run applications.",
    paragraphs: [
      "PassDeployer brings <strong>application deployment</strong> and day-to-day infrastructure management into one focused control plane. The project is designed for developers and operators who want practical service controls without having to navigate a collection of unrelated interfaces for every deployment task.",
      "The platform combines a Django API with a React frontend so that orchestration logic and the operator experience can evolve independently, with <strong>service management</strong> kept close to the resources an application actually uses.",
    ],
    sections: [
      { heading: "Focused service management", paragraphs: [
        "The platform centers on services, resources, networks, and persistent volumes. Those building blocks cover the common operational actions around deploying an application, keeping its configuration consistent, connecting supporting resources, and managing the service lifecycle after deployment.",
      ]},
      { heading: "Open-source architecture", paragraphs: [
        "PassDeployer is built as an open-source stack, giving developers a way to inspect the implementation and understand how the deployment workflow works. The public product pages explain the platform, while authenticated routes are reserved for private operational information.",
      ]},
    ],
    links: [["/", "Home"], ["/plans", "Plans & Pricing"]],
  },
};

/** Visible shell shown to users (and while JS loads). Neutral — never a marketing SEO page. */
function buildLoadingShell(pathname) {
  const isPrivate = isNoIndex(pathname);
  const label = isPrivate ? "Loading your workspace…" : "Loading PassDeployer…";
  return `
    <div class="app-loading" role="status" aria-live="polite" aria-label="${escapeHtml(label)}">
      <div class="app-loading__inner">
        <div class="app-loading__spinner" aria-hidden="true"></div>
        <p class="app-loading__text">${escapeHtml(label)}</p>
      </div>
    </div>
  `;
}

function buildDocsNoscriptContent(doc) {
  if (!doc) return "";
  const raw = String(doc.content || "").replace(/```[\s\S]*?```/g, "");
  const blocks = raw
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .slice(0, 18);
  const html = blocks.map((block) => {
    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = Math.min(3, heading[1].length);
      return `<h${level + 1}>${escapeHtml(heading[2])}</h${level + 1}>`;
    }
    const text = block
      .replace(/^[-*+]\s+/gm, "• ")
      .replace(/^\d+\.\s+/gm, "• ")
      .replace(/[*_`]+/g, "");
    return `<p>${escapeHtml(text).replaceAll("\n", "<br />")}</p>`;
  }).join("");
  return `<main class="seo-noscript" aria-labelledby="seo-doc-heading"><header class="seo-noscript__hero"><div class="seo-noscript__eyebrow">Documentation</div><h1 id="seo-doc-heading">${escapeHtml(doc.title)}</h1>${doc.description ? `<p>${escapeHtml(doc.description)}</p>` : ""}<nav aria-label="Documentation navigation"><a href="/docs">All documentation</a><a href="/">PassDeployer home</a></nav></header><article>${html}</article></main>`;
}

/** Rich HTML for <noscript> and non-JS crawlers only. Users with JS never see this. */
function buildNoscriptContent(pathname, docs = null) {
  if (docs) return buildDocsNoscriptContent(docs);
  const shell = PUBLIC_SHELLS[pathname];
  if (!shell) {
    if (!isNoIndex(pathname)) {
      return `
        <main class="seo-noscript" aria-labelledby="not-found-heading">
          <div class="seo-noscript__eyebrow">${escapeHtml(SITE_NAME)}</div>
          <h1 id="not-found-heading">Page not found</h1>
          <p>The page you requested could not be found. Return to the PassDeployer home page to explore application deployment, resource plans, and service management.</p>
          <nav aria-label="Page navigation"><a href="/">Back to PassDeployer</a></nav>
        </main>
      `;
    }
    return "";
  }

  const sectionHtml = shell.sections.map((section) => `
    <section aria-labelledby="${slugify(section.heading)}">
      <h2 id="${slugify(section.heading)}">${escapeHtml(section.heading)}</h2>
      ${section.paragraphs.map((paragraph) => `<p>${safeInlineHtml(paragraph)}</p>`).join("")}
    </section>
  `).join("");

  const links = shell.links?.length
    ? `<nav aria-label="Primary navigation">${shell.links.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join("")}</nav>`
    : "";

  return `
    <main class="seo-noscript" aria-labelledby="seo-shell-heading">
      <header class="seo-noscript__hero">
        <div class="seo-noscript__eyebrow">${escapeHtml(shell.eyebrow)}</div>
        <h1 id="seo-shell-heading">${escapeHtml(shell.heading)}</h1>
        ${shell.paragraphs.map((paragraph) => `<p>${safeInlineHtml(paragraph)}</p>`).join("")}
        ${links}
      </header>
      ${sectionHtml}
    </main>
  `;
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeInlineHtml(value) {
  return String(value)
    .replace(/<(strong|b)>/g, "&lt;$1&gt;")
    .replace(/<\/(strong|b)>/g, "&lt;/$1&gt;")
    .replace(/&lt;(strong|b)&gt;/g, "<$1>")
    .replace(/&lt;\/(strong|b)&gt;/g, "</$1>");
}



async function fetchPublicJson(pathname) {
  if (!API_ORIGIN) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${API_ORIGIN}${pathname}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function docsPageFromRecord(doc) {
  if (!doc?.slug || doc.status === 'draft') return null;
  return {
    title: `${doc.title} | Documentation | ${SITE_NAME}`,
    description: doc.description || `Learn how to use ${SITE_NAME}: ${doc.title}.`,
  };
}

async function resolvePageMetadata(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const staticPage = PUBLIC_PAGES[normalized];
  if (staticPage) {
    return { page: staticPage, docs: null };
  }

  if (isDocsPath(normalized) && normalized !== '/docs') {
    const slug = normalized.slice('/docs/'.length).split('/')[0];
    if (!slug || slug.includes('..')) return { page: null, docs: null };
    const doc = await fetchPublicJson(`/api/docs/public/${encodeURIComponent(slug)}/`);
    const page = docsPageFromRecord(doc);
    return { page, docs: page ? doc : null };
  }

  return { page: null, docs: null };
}

async function buildSitemapItems() {
  if (Date.now() < docsSitemapCache.expiresAt) return docsSitemapCache.items;

  const items = Object.entries(PUBLIC_PAGES)
    .filter(([pathname]) => !isNoIndex(pathname))
    .map(([pathname]) => ({
      pathname,
      changefreq: pathname === '/' ? 'weekly' : 'monthly',
      priority: pathname === '/' ? '1.0' : '0.7',
      lastmod: null,
    }));

  const docs = await fetchPublicJson('/api/docs/');
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      if (!doc?.slug || doc.status === 'draft') continue;
      items.push({
        pathname: `/docs/${doc.slug}`,
        changefreq: 'monthly',
        priority: '0.7',
        lastmod: doc.updated_at || doc.published_at || null,
      });
    }
  }

  const deduped = [...new Map(items.map((item) => [item.pathname, item])).values()];
  docsSitemapCache = { expiresAt: Date.now() + DOCS_CACHE_TTL_MS, items: deduped };
  return deduped;
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

const server = http.createServer(async (req, res) => {
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
    res.end(await sitemapXml());
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

  const resolved = await resolvePageMetadata(pathname);
  const knownPublic = Boolean(resolved.page);
  const isNotFound = !knownPublic && !isNoIndex(pathname);
  const { statusCode, html } = renderDocument(pathname, isNotFound ? 404 : 200, resolved);
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
