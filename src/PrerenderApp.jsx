import React from "react";
import { StaticRouter } from "react-router";

import Root from "./Root.jsx";
import {
  INDEXABLE_PUBLIC_ROUTES,
  normalizePathname,
} from "./seo-config.js";

export default function PrerenderApp({ url }) {
  const pathname = normalizePathname(
    new URL(url, "http://prerender.local").pathname,
  );

  if (!INDEXABLE_PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <StaticRouter location={pathname}>
      <Root />
    </StaticRouter>
  );
}
