import React from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import Root from "./Root.jsx";

import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);

const prerendered = Boolean(
  document.head.querySelector(
    'meta[name="x-prerendered"][content="true"]',
  ),
);

if (prerendered) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
