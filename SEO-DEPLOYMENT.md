# SEO deployment

The frontend uses a Node.js HTTP server behind Nginx. Public SEO metadata is generated server-side from the same source of truth used by React, while the visible application remains a single React UI.

## What was fixed

- Removed the SEO-only HTML page that was being injected into `#root` and then replaced by `createRoot()`.
- Replaced that content swap with a neutral, app-like loading shell so the first paint never shows one page and then jumps to another.
- Centralized public-page SEO data, canonical URLs, noindex rules and JSON-LD in `src/seo-config.js`.
- Kept private/dashboard routes out of search with `noindex, nofollow, noarchive` and `X-Robots-Tag`.
- Kept only the real public marketing routes in `sitemap.xml`.
- Preserved Open Graph/Twitter metadata, canonical links and structured data for the public routes.
- Kept a small `<noscript>` fallback with real site links/content for users who have JavaScript disabled.

The project no longer relies on a hidden keyword page as an SEO technique. Search engines receive authoritative metadata and structured data, while the page content intended for visitors is the actual React application.

## 1. Build and start

```bash
npm ci
npm run build
npm run start
```

The server listens on port `3000` inside the container. Map it to host port `3005` (or use the port configured by your deployment).

## 2. Nginx

Use `nginx-seo.conf.example` as the replacement for the current site server block. The important change is that `robots.txt`, `sitemap.xml`, public HTML routes and SPA routes all reach the Node server.

The canonical host is `https://echonode.website`; `http://www` and `https://www` redirect to it.

## 3. Verify before submitting to Google

```bash
curl -I https://echonode.website/
curl -s https://echonode.website/ | grep -E '<title>|<meta name="description"|<meta name="robots"|canonical|application/ld\+json'
curl -s https://echonode.website/plans | grep -E '<title>|<meta name="description"|<meta name="robots"|canonical|application/ld\+json'
curl -s https://echonode.website/aboutUs | grep -E '<title>|<meta name="description"|<meta name="robots"|canonical|application/ld\+json'
curl -s https://echonode.website/robots.txt
curl -s https://echonode.website/sitemap.xml
curl -I https://echonode.website/this-page-does-not-exist
```

Expected:
- `/`, `/plans`, `/aboutUs`: `200`, unique title/description/canonical, JSON-LD and the real React application after JS loads.
- Unknown pages: `404` plus `noindex`.
- Private/app pages: `200` with `noindex, nofollow, noarchive`.
- Only `/`, `/plans`, `/aboutUs` appear in the sitemap.

## 4. Google Search Console

After deployment, use URL Inspection for `/`, `/plans`, and `/aboutUs`, then submit `/sitemap.xml`.

## ads.txt

`/ads.txt` intentionally contains no seller record until a real advertising platform is connected. Never invent a publisher/ad-network line.
