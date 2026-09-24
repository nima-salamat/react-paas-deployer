import { renderToString } from "react-dom/server.edge";
import { createEmotionCache, getEmotionStyleTags } from "./emotionCache.js";

import PrerenderApp from "./PrerenderApp.jsx";
import {
  INDEXABLE_PUBLIC_ROUTES,
  PRERENDERABLE_PUBLIC_ROUTES,
  PUBLIC_PAGES,
  buildSchema,
  canonicalUrl,
  getSiteConfig,
  normalizePathname,
} from "./seo-config.js";

const SITE_CONFIG = getSiteConfig(import.meta.env);
const PRERENDER_ROUTES = PRERENDERABLE_PUBLIC_ROUTES;

function escapeJsonLd(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function buildHead(page, pathname, emotionStyles = "") {
  const url = canonicalUrl(pathname, SITE_CONFIG.siteUrl);
  const schema = buildSchema(page, pathname, SITE_CONFIG);

  return {
    lang: "en",
    title: page.title,
    elements: new Set([
      {
        type: "style",
        props: {},
        children: emotionStyles,
      },
      {
        type: "meta",
        props: {
          name: "description",
          content: page.description,
        },
      },
      {
        type: "meta",
        props: {
          name: "robots",
          content:
            "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        },
      },
      {
        type: "meta",
        props: {
          name: "googlebot",
          content:
            "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
        },
      },
      {
        type: "meta",
        props: {
          name: "author",
          content: SITE_CONFIG.siteName,
        },
      },
      {
        type: "meta",
        props: {
          name: "application-name",
          content: SITE_CONFIG.siteName,
        },
      },
      {
        type: "meta",
        props: {
          name: "x-prerendered",
          content: "true",
        },
      },
      {
        type: "link",
        props: {
          rel: "canonical",
          href: url,
        },
      },
      {
        type: "link",
        props: {
          rel: "alternate",
          hrefLang: "en",
          href: url,
        },
      },
      {
        type: "link",
        props: {
          rel: "alternate",
          hrefLang: "x-default",
          href: url,
        },
      },
      {
        type: "link",
        props: {
          rel: "icon",
          href: "/favicon.ico",
          sizes: "48x48",
          type: "image/x-icon",
        },
      },
      {
        type: "link",
        props: {
          rel: "icon",
          href: "/icon.svg",
          type: "image/svg+xml",
        },
      },
      {
        type: "link",
        props: {
          rel: "apple-touch-icon",
          href: "/apple-touch-icon.png",
          sizes: "180x180",
        },
      },
      {
        type: "meta",
        props: {
          property: "og:type",
          content: "website",
        },
      },
      {
        type: "meta",
        props: {
          property: "og:site_name",
          content: SITE_CONFIG.siteName,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:title",
          content: page.title,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:description",
          content: page.description,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:url",
          content: url,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:image",
          content: SITE_CONFIG.preview,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:image:width",
          content: "1200",
        },
      },
      {
        type: "meta",
        props: {
          property: "og:image:height",
          content: "675",
        },
      },
      {
        type: "meta",
        props: {
          property: "og:image:alt",
          content: `${page.title} preview`,
        },
      },
      {
        type: "meta",
        props: {
          property: "og:locale",
          content: "en_US",
        },
      },
      {
        type: "meta",
        props: {
          name: "twitter:card",
          content: "summary_large_image",
        },
      },
      {
        type: "meta",
        props: {
          name: "twitter:title",
          content: page.title,
        },
      },
      {
        type: "meta",
        props: {
          name: "twitter:description",
          content: page.description,
        },
      },
      {
        type: "meta",
        props: {
          name: "twitter:image",
          content: SITE_CONFIG.preview,
        },
      },
      {
        type: "meta",
        props: {
          name: "twitter:image:alt",
          content: `${page.title} preview`,
        },
      },
      {
        type: "script",
        props: {
          type: "application/ld+json",
        },
        children: schema
          ? escapeJsonLd(schema)
          : "{}",
      },
    ]),
  };
}

export async function prerender({ url }) {
  const pathname = normalizePathname(
    new URL(url, "http://prerender.local").pathname,
  );
  const page = PUBLIC_PAGES[pathname];

  if (!page || !PRERENDER_ROUTES.includes(pathname)) {
    return {
      html: "<div></div>",
      links: new Set(),
    };
  }

  const emotionCache = createEmotionCache({ forceServer: true });
  const html = renderToString(
    <PrerenderApp url={url} emotionCache={emotionCache} />,
  );
  const emotionStyles = getEmotionStyleTags(emotionCache);

  return {
    html,
    links: new Set(PRERENDER_ROUTES),
    head: buildHead(page, pathname, emotionStyles),
  };
}
