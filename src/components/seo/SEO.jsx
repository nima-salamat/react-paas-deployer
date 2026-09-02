import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import {
  PUBLIC_PAGES,
  buildSchema,
  canonicalUrl,
  getSiteConfig,
  isNoIndex,
  isDocsPath,
  normalizePathname,
} from "../../seo-config.js";

const siteConfig = getSiteConfig(import.meta.env);

export default function SEO() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const [doc, setDoc] = useState(null);
  const isDocDetail = isDocsPath(pathname) && pathname !== "/docs";
  const slug = isDocDetail ? pathname.slice("/docs/".length).split("/")[0] : "";

  useEffect(() => {
    if (!isDocDetail || !slug) {
      setDoc(null);
      return undefined;
    }
    let cancelled = false;
    fetch(`${siteConfig.apiOrigin}/api/docs/public/${encodeURIComponent(slug)}/`, {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (!cancelled) setDoc(data); })
      .catch(() => { if (!cancelled) setDoc(null); });
    return () => { cancelled = true; };
  }, [isDocDetail, slug]);

  const staticPage = PUBLIC_PAGES[pathname];
  const page = doc
    ? {
        title: `${doc.title} | Documentation | ${siteConfig.siteName}`,
        description: doc.description || `Learn how to use ${siteConfig.siteName}: ${doc.title}.`,
      }
    : staticPage;
  const noindex = isNoIndex(pathname) || (isDocDetail && !doc);
  const title = page?.title || `${siteConfig.siteName} | Application Deployment Platform`;
  const description = page?.description || "Application deployment and infrastructure management platform.";
  const url = canonicalUrl(pathname, siteConfig.siteUrl);
  const robots = noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const schema = useMemo(() => buildSchema(page, pathname, siteConfig, { docs: doc }), [page, pathname, doc]);

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />
      <meta name="theme-color" content="#081325" />
      {!noindex && <link rel="canonical" href={url} />}
      {!noindex && pathname === "/" && <link rel="amphtml" href={`${siteConfig.siteUrl}/amp/`} />}
      {!noindex && <link rel="alternate" hrefLang="en" href={url} />}
      {!noindex && <link rel="alternate" hrefLang="x-default" href={url} />}
      {page && (
        <>
          <meta property="og:type" content={doc ? "article" : "website"} />
          <meta property="og:site_name" content={siteConfig.siteName} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={url} />
          <meta property="og:image" content={siteConfig.preview} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="675" />
          <meta property="og:image:alt" content={`${title} preview`} />
          <meta property="og:locale" content="en_US" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <meta name="twitter:image" content={siteConfig.preview} />
          <meta name="twitter:image:alt" content={`${title} preview`} />
          {schema && <script type="application/ld+json">{JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>}
        </>
      )}
    </Helmet>
  );
}
