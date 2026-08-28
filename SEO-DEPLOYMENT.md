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
