import React from "react";
import { createRoot } from "react-dom/client";
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

// The production server may serve a prerendered document shell. The browser
// client owns #root completely, so discard every leftover child before mount.
// This also prevents SEO/prerender markup from remaining visible when a route
// crashes during its first React render.
rootElement.replaceChildren();

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
