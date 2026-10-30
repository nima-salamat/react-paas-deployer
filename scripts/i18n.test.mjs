import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeLanguage, translateText } from "../src/i18n/messages.js";

test("normalizes supported language tags and rejects unsupported ones", () => {
  assert.equal(normalizeLanguage("fa-IR"), "fa");
  assert.equal(normalizeLanguage("FA"), "fa");
  assert.equal(normalizeLanguage("en-GB"), "en-us");
  assert.equal(normalizeLanguage("de"), null);
});

test("translates Persian UI labels and preserves surrounding whitespace", () => {
  assert.equal(translateText("Home", "fa"), "خانه");
  assert.equal(translateText(" Dashboard ", "fa"), " داشبورد ");
  assert.equal(translateText("Home", "en-us"), "Home");
  assert.equal(translateText("Service identifier", "fa"), "Service identifier");
});

test("React locale preference is connected to the account language API", async () => {
  const provider = await readFile(new URL("../src/i18n/LocaleProvider.jsx", import.meta.url), "utf8");
  const requests = await readFile(new URL("../src/components/customHooks/apiRequest.jsx", import.meta.url), "utf8");
  assert.match(provider, /\/api\/users\/user\/language\//);
  assert.match(provider, /method:\s*"PATCH"/);
  assert.match(requests, /Accept-Language/);
  assert.match(requests, /localizeApiPayload/);
});

test("the application sets RTL document and theme direction for Persian", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const root = await readFile(new URL("../src/Root.jsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(app, /document\.documentElement\.dir = isRTL \? "rtl" : "ltr"/);
  assert.match(app, /direction: isRTL \? "rtl" : "ltr"/);
  assert.match(root, /<LocaleProvider>/);
  assert.match(css, /html\[dir="rtl"\]/);
});

test("Vite localizes visible JSX copy without changing code or form input content", async () => {
  const vite = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(vite, /localizeJsxTextPlugin/);
  assert.match(vite, /LocalizedText/);
  assert.match(vite, /\["code", "pre", "textarea", "script", "style"\]/);
});
