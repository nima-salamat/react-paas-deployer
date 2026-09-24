import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import Root from "./Root.jsx";

import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

/*
 * The server may place a boot shell or prerendered HTML inside #root.
 * The browser owns the root after this point, so remove stale shell nodes
 * before mounting the interactive React application.
 */
Array.from(
  document.querySelectorAll('div[id="root"]'),
).forEach((element, index) => {
  if (index > 0) element.remove();
});

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);

const isPrerenderedDocument =
  rootElement.hasChildNodes() &&
  document.head.querySelector(
    'meta[name="x-prerendered"][content="true"]',
  );

// Public prerendered routes already contain the exact page structure.
// Hydrate them in place so there is no server-HTML -> empty-root -> React flash.
// Dynamic/private routes keep the normal createRoot path.
if (isPrerenderedDocument) {
  hydrateRoot(rootElement, app);
} else {
  rootElement.replaceChildren();
  createRoot(rootElement).render(app);
}

// Remove crawler-only SEO content once the interactive React app owns the page.
document.getElementById("seo-noscript-fallback")?.remove();

