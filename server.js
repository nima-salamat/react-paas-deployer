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
    ${page && !noindex ? `<link rel="canonical" href="${escapeHtml(url)}" />` : ''}
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

function renderDocument(pathname, statusCode = 200) {
  const page = PUBLIC_PAGES[pathname];
  const noindex = !page || isNoIndex(pathname);
  let html = loadTemplate();

  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']googlebot["'][^>]*>/i, '');
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
