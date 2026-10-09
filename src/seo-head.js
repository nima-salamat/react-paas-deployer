const MANAGED_META_NAMES = new Set([
  "description",
  "robots",
  "googlebot",
  "referrer",
  "theme-color",
]);

function getAttribute(tag, name) {
  const pattern = new RegExp(
    "(?:^|\\s)" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s/>]+))",
    "i",
  );
  const match = pattern.exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function stripTags(markup, tagName, shouldRemove) {
  const pattern = new RegExp("<" + tagName + "\\b[^>]*>", "gi");
  return markup.replace(pattern, (tag) => (shouldRemove(tag) ? "" : tag));
}

/**
 * Remove SEO tags owned by the per-request server renderer.
 * The Vite template may already contain prerendered SEO markup. Clean only
 * server-managed tags, then inject one authoritative set for this URL.
 * Unrelated head markup is intentionally preserved.
 */
export function stripManagedSeoTags(markup) {
  let html = String(markup ?? "");
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title\s*>/gi, "");

  html = stripTags(html, "meta", (tag) => {
    const name = getAttribute(tag, "name")?.toLowerCase();
    const property = getAttribute(tag, "property")?.toLowerCase();
    return (
      MANAGED_META_NAMES.has(name) ||
      name?.startsWith("twitter:") ||
      property?.startsWith("og:")
    );
  });

  html = stripTags(html, "link", (tag) => {
    const rel = (getAttribute(tag, "rel") || "").toLowerCase().split(/\s+/);
    return (
      rel.includes("canonical") ||
      (rel.includes("alternate") && getAttribute(tag, "hreflang") !== null)
    );
  });

  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (script) => {
    const openingTag = /^<script\b[^>]*>/i.exec(script)?.[0] || "";
    return getAttribute(openingTag, "type")?.toLowerCase() === "application/ld+json"
      ? ""
      : script;
  });

  return html;
}
