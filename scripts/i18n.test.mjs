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
  assert.match(vite, /jsxExpressionContainer\(t\.stringLiteral\(value\)\)/);
  assert.match(vite, /\["code", "pre", "textarea", "script", "style"\]/);
});


test("Emotion uses MUI's RTL Stylis plugin whenever the Persian locale is active", async () => {
  const cache = await readFile(new URL("../src/emotionCache.js", import.meta.url), "utf8");
  const root = await readFile(new URL("../src/Root.jsx", import.meta.url), "utf8");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies["@mui/stylis-plugin-rtl"], "7.3.10");
  assert.match(cache, /stylisPlugins: \[prefixer, rtlPlugin\]/);
  assert.match(cache, /key: isRTL \? "pdrtl" : "pd"/);
  assert.match(root, /createEmotionCache\("ltr"\)/);
  assert.match(root, /createEmotionCache\("rtl"\)/);
  assert.match(root, /caches\.rtl : caches\.ltr/);
  assert.match(root, /<LocaleProvider>[\s\S]*<DirectionalCacheProvider>/);
});


test("explicit language preference markers are scoped to the authenticated account", async () => {
  const provider = await readFile(new URL("../src/i18n/LocaleProvider.jsx", import.meta.url), "utf8");
  assert.match(provider, /decodeJwtPayload/);
  assert.match(provider, /EXPLICIT_LANGUAGE_KEY_PREFIX/);
  assert.match(provider, /getAuthenticatedAccountId\(\) === accountId/);
});

test("Persian locale includes secure-chat recovery, language API and admin table messages", async () => {
  const messages = await readFile(new URL("../src/i18n/messages.js", import.meta.url), "utf8");
  assert.match(messages, /"Secure chat recovery":/);
  assert.match(messages, /"Database tables": "جدول‌های پایگاه داده"/);
  assert.match(messages, /"Language preference updated.":/);
});


test("Persian locale covers admin console, Services and all Ready Apps screens", async () => {
  const messages = await readFile(new URL("../src/i18n/messages.js", import.meta.url), "utf8");
  const helper = await readFile(new URL("../src/i18n/TranslatedTextTree.jsx", import.meta.url), "utf8");
  const surfaces = [
    "../src/components/admin/AdminDashboard.jsx",
    "../src/components/admin/layout/AdminSidebar.jsx",
    "../src/components/admin/layout/AdminTopBar.jsx",
    "../src/components/admin/panels/OverviewPanel.jsx",
    "../src/components/admin/panels/TicketsPanel.jsx",
    "../src/components/admin/panels/UsersPanel.jsx",
    "../src/components/admin/panels/DepartmentsPanel.jsx",
    "../src/components/admin/panels/ServicesPanel.jsx",
    "../src/components/admin/panels/PlansPanel.jsx",
    "../src/components/admin/panels/LoginSettingsPanel.jsx",
    "../src/components/admin/panels/InvitesPanel.jsx",
    "../src/components/admin/panels/AuthCodesPanel.jsx",
    "../src/components/admin/panels/EmailsPanel.jsx",
    "../src/components/admin/panels/ProfilePanel.jsx",
    "../src/components/admin/panels/docs/DocsPanel.jsx",
    "../src/components/service/Services.jsx",
    "../src/components/service/services/ServicesToolbar.jsx",
    "../src/components/service/services/ServiceItem.jsx",
    "../src/components/service/services/ServiceEditDialog.jsx",
    "../src/components/service/services/ServiceDeleteDialog.jsx",
    "../src/components/service/services/ShareServiceDialog.jsx",
    "../src/components/ready_apps/ReadyApps.jsx",
    "../src/components/ready_apps/ReadyAppDetail.jsx",
    "../src/components/ready_apps/ReadyAppInstallations.jsx",
    "../src/components/ready_apps/ReadyAppInstallation.jsx",
    "../src/components/ready_apps/ReadyAppWizard.jsx",
  ];

  assert.match(helper, /useLocale/);
  assert.match(helper, /TRANSLATABLE_PROPS/);
  for (const relativePath of surfaces) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /TranslatedTextTree/, relativePath + " must use the active locale");
  }

  for (const [english, persian] of [
    ["App Library", "کتابخانهٔ اپلیکیشن‌ها"],
    ["Deployed Apps", "اپلیکیشن‌های مستقرشده"],
    ["Users & access", "کاربران و دسترسی‌ها"],
    ["Departments", "دپارتمان‌ها"],
    ["cms", "مدیریت محتوا"],
    ["helpdesk", "پشتیبانی"],
    ["devtools", "ابزارهای توسعه"],
    ["messaging", "پیام‌رسانی"],
  ]) {
    assert.ok(messages.includes(JSON.stringify(english) + ": " + JSON.stringify(persian)), "Missing Persian translation: " + english);
  }
});


test("backend Ready App descriptions have Persian translations without translating user-rendered children", async () => {
  const messages = await readFile(new URL("../src/i18n/messages.js", import.meta.url), "utf8");
  const helper = await readFile(new URL("../src/i18n/TranslatedTextTree.jsx", import.meta.url), "utf8");

  assert.equal(
    translateText("Open source no-code business automation.", "fa"),
    "راهکار متن‌باز و بدون نیاز به کدنویسی برای خودکارسازی فرایندهای کسب‌وکار.",
  );
  assert.equal(
    translateText("WordPress is open source software you can use to create a beautiful website, blog, or app.", "fa"),
    "WordPress نرم‌افزاری متن‌باز برای ساخت وب‌سایت، وبلاگ یا برنامه‌ای زیباست.",
  );
  assert.equal(translateText("cms", "fa"), "مدیریت محتوا");
  assert.equal(translateText("helpdesk", "fa"), "پشتیبانی");
  assert.equal(translateText("devtools", "fa"), "ابزارهای توسعه");

  assert.match(helper, /TRANSLATABLE_PROPS/);
  assert.match(helper, /Raw rendered child strings may be service names, usernames, ticket subjects/);
  assert.doesNotMatch(helper, /if \(typeof node === "string"\)/);
  assert.match(helper, /nextProps\.children = translated/);
});
