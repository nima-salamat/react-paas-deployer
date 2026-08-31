/** Shared markdown utilities (no circular deps). */

export const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** Stable, unicode-aware slug for heading anchors (Persian/Arabic included). */
export const slugifyHeading = (value) => {
  const text = String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim()
    .toLowerCase();
  const slug = text
    .replace(/[^\p{L}\p{N}\s\-_]/gu, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
};
