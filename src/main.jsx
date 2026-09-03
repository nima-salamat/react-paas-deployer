import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import Root from "./Root.jsx";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

/*
 * Boot-shell cleanup (defense in depth).
 *
 * The server injects a loading shell so users see feedback while the JS
 * bundle loads. React only owns the FIRST #root in the document, so any
 * duplicate #root (or a stray shell outside the root) would keep
 * spinning below the app forever. Remove leftovers before mounting.
 */
Array.from(
  document.querySelectorAll('div[id="root"]'),
).forEach((element, index) => {
  if (index > 0) element.remove();
});

document
  .querySelectorAll(".app-loading, #app-boot-shell")
  .forEach((element) => {
    if (!rootElement.contains(element)) {
      element.remove();
    }
  });

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
