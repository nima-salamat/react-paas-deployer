import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import {
  PUBLIC_PAGES,
  buildSchema,
  canonicalUrl,
  getSiteConfig,
  isNoIndex,
  normalizePathname,
} from "../../seo-config.js";

const siteConfig = getSiteConfig(import.meta.env);

export default function SEO() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const page = PUBLIC_PAGES[pathname];
  const noindex = !page || isNoIndex(pathname);
  const title = page?.title || `${siteConfig.siteName} | Application Deployment Platform`;
  const description =
    page?.description ||
    "Application deployment and infrastructure management platform.";
  const url = canonicalUrl(pathname, siteConfig.siteUrl);
  const robots = noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const schema = buildSchema(page, pathname, siteConfig);

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />

      {!noindex && (
        <>
          <link rel="canonical" href={url} />
          {pathname === "/" && (
            <link rel="amphtml" href={`${siteConfig.siteUrl}/amp/`} />
          )}
          <link rel="alternate" hrefLang="en" href={url} />
          <link rel="alternate" hrefLang="x-default" href={url} />
        </>
      )}

      {!noindex && (
        <>
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={siteConfig.siteName} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={url} />
          <meta property="og:image" content={siteConfig.preview} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="675" />
          <meta property="og:image:alt" content={`${siteConfig.siteName} deployment platform`} />
          <meta property="og:locale" content="en_US" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <meta name="twitter:image" content={siteConfig.preview} />
          <script type="application/ld+json">
            {JSON.stringify(schema).replaceAll("<", "\\u003c")}
          </script>
        </>
      )}
    </Helmet>
  );
}
