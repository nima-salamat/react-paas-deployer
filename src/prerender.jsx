import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";

import Root from "./Root.jsx";

export async function prerender({ url }) {
  const html = renderToString(
    <StaticRouter location={url}>
      <Root />
    </StaticRouter>
  );

  return {
    html,
  };
}