import test from "node:test";
import assert from "node:assert/strict";
import { stripManagedSeoTags } from "../src/seo-head.js";

const count = (html, pattern) => [...html.matchAll(pattern)].length;
const template = "<!doctype html>\n<html lang=\"en\"><head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<meta name=\"author\" content=\"PaaSDeployer\">\n<meta name=\"application-name\" content=\"PaaSDeployer\">\n<meta name=\"theme-color\" content=\"#000\">\n<title>Build-time title</title><title>Duplicate title</title>\n<meta name=\"description\" content=\"Build-time description\">\n<meta name='description' content='Duplicate description'>\n<meta name=\"robots\" content=\"index, follow\"><meta name=\"googlebot\" content=\"index, follow\">\n<meta name=\"referrer\" content=\"unsafe-url\">\n<link rel=\"canonical\" href=\"https://example.test/old\">\n<link rel=\"alternate\" hreflang=\"en\" href=\"https://example.test/old\">\n<link rel=\"alternate\" href=\"/feed.xml\" type=\"application/rss+xml\">\n<meta property=\"og:title\" content=\"Old title\"><meta name=\"twitter:card\" content=\"summary\">\n<script type=\"application/ld+json\">{\"@type\":\"WebPage\"}</script>\n<script type=\"application/json\">{\"preserve\":true}</script>\n<link rel=\"stylesheet\" href=\"/assets/site.css\">\n</head><body><div id=\"root\"></div></body></html>";

test("removes server-managed SEO tags and preserves unrelated head markup", () => {
  const cleaned = stripManagedSeoTags(template);
  assert.equal(count(cleaned, /<title\b/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']description["']/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']robots["']/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']googlebot["']/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']referrer["']/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']theme-color["']/gi), 0);
  assert.equal(count(cleaned, /<link\b[^>]*rel=["']canonical["']/gi), 0);
  assert.equal(count(cleaned, /hreflang=/gi), 0);
  assert.equal(count(cleaned, /property=["']og:/gi), 0);
  assert.equal(count(cleaned, /name=["']twitter:/gi), 0);
  assert.equal(count(cleaned, /application\/ld\+json/gi), 0);
  assert.equal(count(cleaned, /<meta\b[^>]*charset=/gi), 1);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']viewport["']/gi), 1);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']author["']/gi), 1);
  assert.equal(count(cleaned, /<meta\b[^>]*name=["']application-name["']/gi), 1);
  assert.equal(count(cleaned, /rel=["']alternate["']/gi), 1);
  assert.equal(count(cleaned, /application\/json/gi), 1);
  assert.match(cleaned, /href=["']\/assets\/site\.css["']/);
});

test("is idempotent", () => {
  const input = '<head><title>Old</title><meta name="description" content="Old"></head>';
  assert.equal(stripManagedSeoTags(stripManagedSeoTags(input)), stripManagedSeoTags(input));
});
