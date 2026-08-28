import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const SITE_URL = (process.env.VITE_APP_URL || 'https://echonode.website').replace(/\/+$/, '');
const SITE_NAME = process.env.VITE_APP_NAME || 'PassDeployer';

const PUBLIC_PAGES = {
  '/': {
    title: 'PassDeployer | Deploy Django, Node.js, Flask & Docker Apps',
    description:
      'Deploy Django, Node.js, Flask and Docker applications from one modern PaaS control panel. Create services, manage resources and monitor deployments with PassDeployer.',
    heading: 'Deploy applications without the deployment headache',
    intro:
      'PassDeployer is a developer-focused PaaS for deploying and managing Django, Node.js, Flask and Docker applications from one place.',
    sections: [
      ['Deploy popular application stacks', 'Create services for Django, Node.js, Flask and containerized applications without building your own deployment control plane.'],
      ['Manage services and resources', 'Choose CPU, memory and storage plans, then manage service lifecycle, logs, networks and persistent volumes from a single dashboard.'],
      ['Built for practical deployment workflows', 'Upload an application, configure the runtime, deploy it and keep control over the service after it goes live.'],
    ],
  },
  '/plans': {
    title: 'Plans & Pricing | PassDeployer',
    description:
      'Explore PassDeployer plans for Django, Node.js, Flask and Docker applications. Compare CPU, RAM, storage and deployment resources for your next service.',
    heading: 'Choose a deployment plan for your application',
    intro:
      'PassDeployer plans let you choose the compute and storage resources that fit the workload you want to deploy.',
    sections: [
      ['Application plans', 'Select a plan based on the CPU, RAM and storage requirements of your web application or API.'],
      ['Database and data services', 'Use dedicated resource options for databases, caches and other supporting services when your application needs persistent data.'],
      ['Scale as your workload grows', 'Start with the resources you need today and move to a larger plan as traffic, background jobs or application requirements increase.'],
    ],
  },
  '/aboutUs': {
    title: 'About PassDeployer | Developer-focused PaaS',
    description:
      'Learn about PassDeployer, an open-source developer-focused PaaS for deploying and managing Django, Node.js, Flask and Docker applications.',
    heading: 'About PassDeployer',
    intro:
      'PassDeployer is a developer-focused deployment platform built around a Django control plane and a React operator interface.',
    sections: [
      ['A focused deployment platform', 'The goal is simple: make application deployment, service management and operational tasks easier without hiding the underlying infrastructure.'],
      ['Open-source stack', 'The project combines a Django backend for orchestration with a React frontend for the management experience.'],
      ['One control plane for your services', 'Plans, services, private networks, persistent volumes and deployment workflows are managed from one interface.'],
    ],
  },
};

const NOINDEX_PREFIXES = [
  '/profile', '/services', '/service/', '/volumes', '/networks', '/tickets',
  '/staff', '/admin', '/messenger', '/signin_or_signup'
];

function normalizePath(input) {
  const raw = new URL(input, SITE_URL).pathname || '/';
  if (raw === '/') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

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

function isNoIndex(pathname) {
  return NOINDEX_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

function canonicalUrl(pathname) {
  return `${SITE_URL}${pathname === '/' ? '/' : pathname}`;
}

function buildSchema(page, pathname) {
  const pageUrl = canonicalUrl(pathname);
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/icon.svg`,
      sameAs: [
        'https://github.com/nima-salamat/react-paas-deployer',
        'https://github.com/nima-salamat/django-paas-deployer',
      ],
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: page.title,
      description: page.description,
      inLanguage: 'en',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      primaryImageOfPage: { '@type': 'ImageObject', url: `${SITE_URL}/preview.png` },
    },
  ];

  if (pathname !== '/') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: page.heading, item: pageUrl },
      ],
    });
  }

  if (pathname === '/') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      url: pageUrl,
      description: page.description,
      image: `${SITE_URL}/preview.png`,
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

function buildPublicBody(page, pathname) {
  return `
    <main class="seo-page" id="seo-content">
      <div class="seo-container">
        <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
          <a href="/">Home</a>${pathname !== '/' ? `<span aria-hidden="true">/</span><span>${escapeHtml(page.heading)}</span>` : ''}
        </nav>
        <h1>${escapeHtml(page.heading)}</h1>
        <p class="seo-lead">${escapeHtml(page.intro)}</p>
        <section class="seo-sections" aria-label="${escapeHtml(page.heading)}">
          ${page.sections.map(([heading, text]) => `<article><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p></article>`).join('')}
        </section>
        <nav class="seo-links" aria-label="Explore PassDeployer">
          <a href="/">Deploy applications</a>
          <a href="/plans">Plans</a>
          <a href="/aboutUs">About PassDeployer</a>
          <a href="/signin_or_signup">Create an account</a>
        </nav>
      </div>
    </main>`;
}

function buildNotFoundBody() {
  return `
    <main class="seo-page" id="seo-content">
      <div class="seo-container">
        <h1>Page not found</h1>
        <p class="seo-lead">The page you requested does not exist.</p>
        <p><a href="/">Return to PassDeployer home</a></p>
      </div>
    </main>`;
}

function buildHead(page, pathname, noindex = false) {
  const url = canonicalUrl(pathname);
  const robots = noindex ? 'noindex, nofollow, noarchive' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const schema = page ? buildSchema(page, pathname) : null;
  const preview = `${SITE_URL}/preview.png`;

  return `
    <title>${escapeHtml(page?.title || `404 | ${SITE_NAME}`)}</title>
    <meta name="description" content="${escapeHtml(page?.description || 'The requested page could not be found.')}" />
    <meta name="robots" content="${robots}" />
    <meta name="googlebot" content="${robots}" />
    ${page && !noindex ? `<link rel="canonical" href="${escapeHtml(url)}" />` : ''}
    <link rel="icon" href="/favicon.ico" sizes="48x48" type="image/x-icon" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
    ${page && !noindex ? `
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
      <meta property="og:title" content="${escapeHtml(page.title)}" />
      <meta property="og:description" content="${escapeHtml(page.description)}" />
      <meta property="og:url" content="${escapeHtml(url)}" />
      <meta property="og:image" content="${escapeHtml(preview)}" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="675" />
      <meta property="og:image:alt" content="PassDeployer deployment platform" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content="${escapeHtml(url)}" />
      <meta name="twitter:title" content="${escapeHtml(page.title)}" />
      <meta name="twitter:description" content="${escapeHtml(page.description)}" />
      <meta name="twitter:image" content="${escapeHtml(preview)}" />
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
  const titlePage = page || null;
  const body = page ? buildPublicBody(page, pathname) : buildNotFoundBody();
  let html = loadTemplate();
  html = html.replace(/<title>[\s\S]*?<\/title>/i, '');
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, '');
  html = html.replace(/<meta\s+name=["']googlebot["'][^>]*>/i, '');
  html = html.replace('</head>', `${buildHead(titlePage, pathname, noindex)}\n</head>`);
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${body}</div>`);
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
      <loc>${escapeHtml(canonicalUrl(pathname))}</loc>
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
