# SEO deployment

This frontend now uses a small Node.js HTTP server instead of `serve` as the process behind Nginx.

## 1. Build and start

The Dockerfile runs:

```bash
npm ci
npm run build
npm run start
```

The server listens on port `3000` inside the container. Map it to host port `3005` (or use the same port already used by your current React container).

Example compose mapping:

```yaml
ports:
  - "3005:3000"
```

## 2. Nginx

Use `nginx-seo.conf.example` as the replacement for the current site server block. The important change is that `robots.txt`, `sitemap.xml`, public HTML routes and SPA routes all reach the Node server.

The canonical host is `https://echonode.website`; `http://www` and `https://www` redirect to it.

## 3. Verify before submitting to Google

```bash
curl -I https://echonode.website/
curl -s https://echonode.website/ | grep -E '<title>|<meta name="description"|<h1|application/ld\+json'
curl -s https://echonode.website/plans | grep -E '<title>|<meta name="description"|<h1|application/ld\+json'
curl -s https://echonode.website/aboutUs | grep -E '<title>|<meta name="description"|<h1|application/ld\+json'
curl -s https://echonode.website/robots.txt
curl -s https://echonode.website/sitemap.xml
curl -I https://echonode.website/this-page-does-not-exist
```

Expected:
- public pages: `200`, unique title/description/canonical, visible HTML content and JSON-LD
- unknown pages: `404` plus `noindex`
- private pages: `200` for the app shell but `noindex, nofollow`
- only `/`, `/plans`, `/aboutUs` appear in the sitemap

## 4. Google Search Console

After deployment, inspect `/`, `/plans`, and `/aboutUs` with URL Inspection. Submit `/sitemap.xml`. Google can take days or longer to recrawl and reprocess favicon/indexing changes. Google recommends the URL Inspection and Sitemap reports for this verification. 

## ads.txt

`/ads.txt` is served by the Node SEO server and intentionally contains only a comment because PassDeployer currently has no advertising sellers. Do not add a made-up Google/ads network publisher record. When an ad platform is actually connected, replace the comment with the exact authorized-seller line supplied by that platform.


## SEO content strategy

The public pages are intentionally optimized around the product's core value rather than a list of runtimes. The main Home messaging emphasizes faster deployment, less infrastructure busywork, centralized service management, networks, persistent volumes, resource control, and the ability to change plans as workloads change. Platform/runtime names can still appear naturally where relevant, but they are not the primary keyword strategy.

The Home page also contains visible FAQ content covering deployment simplicity, network and persistent-volume management, plan changes, and post-deployment operations. The SSR HTML contains the same core information so crawlers can access meaningful content before client-side JavaScript runs.
