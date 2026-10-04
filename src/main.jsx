import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import Root from "./Root.jsx";
import AppErrorBoundary from "./components/error/AppErrorBoundary.jsx";

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
    <AppErrorBoundary>
      <BrowserRouter>
        <Root />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);

rootElement.replaceChildren();

try {
  createRoot(rootElement).render(app);
  document.getElementById("seo-noscript-fallback")?.remove();
} catch (error) {
  window.__PASSDEPLOYER_BOOT__?.showError?.(
    error?.message || "React could not be started.",
    error,
  );
}

