/**
 * Pure helpers for importing Markdown files as documentation articles
 * and for generating URL slugs from titles.
 *
 * Everything here is framework-free and side-effect-free (except the
 * async file read in `readTextFile`), so the import pipeline is fully
 * unit-testable in Node — see scripts/test_docs_import_dnd.js.
 *
 * Import contract (user-facing behaviour):
 *   1. The FIRST non-empty line of the file becomes the article title.
 *      A leading ATX heading ("# Title") is stripped of its hashes.
 *      That line is consumed (removed from the body) so the public page
 *      does not render the title twice.
 *   2. When the file has no usable first line the file NAME becomes the
 *      title ("getting-started.md" → "getting started") and the whole
 *      file stays in the body.
 *   3. The slug is generated from the title: lower-cased, every
 *      non-alphanumeric run collapsed into a single "-", trimmed.
 *      Titles with no Latin characters (e.g. Persian) fall back to a
 *      generated URL-safe slug — the backend's <slug:slug> URL converter
 *      only matches ASCII, so we never send a blank slug.
 */

/** Mirrors backend DocumentSerializer.validate_content (500 000 chars). */
export const MAX_IMPORT_CHARS = 500_000;
/** Hard byte ceiling before decoding (500k chars can be up to ~2 MB as UTF-8/UTF-16). */
export const MAX_IMPORT_BYTES = 2_000_000;

/**
 * Lower-case a title and join words with single dashes.
 * Accents are decomposed (é → e); every other non [a-z0-9] run becomes
 * a separator. Returns "" when nothing Latin remains (caller decides
 * the fallback) — never returns leading/trailing or doubled dashes.
 */
export function makeSlug(title) {
  return String(title ?? "")
    .replace(/^\uFEFF/, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 190);
}

/**
 * Normalise a slug the admin typed by hand: lower-case, whitespace →
 * single dash, drop characters outside the backend SlugField alphabet
 * ([-a-zA-Z0-9_]). Underscores are kept for parity with the model.
 */
export function sanitizeSlugInput(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]+/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 220);
}

/**
 * URL-safe fallback slug for titles with no Latin characters
 * (Persian/Arabic/CJK…): deterministic-ish, unique enough to pass the
 * backend's unique constraint on first save.
 */
export function fallbackSlug() {
  const rand = Math.random().toString(36).slice(2, 6);
  return `doc-${Date.now().toString(36)}-${rand}`;
}

/**
 * Turn "getting-started.md" into a display title "getting started".
 * Strips the extension, converts -/_ runs to spaces, trims.
 */
export function filenameTitle(filename) {
  const base = String(filename ?? "").replace(/\.[^.]+$/, "");
  const spaced = base.replace(/[-_]+/g, " ").trim();
  return spaced.slice(0, 180);
}

/**
 * Split an imported file into { title, content, titleSource }.
 *
 * titleSource: "first-line" (the file's first non-empty line was consumed
 * as the title) or "filename" (nothing usable in the body; the whole
 * file stays as content and the file name became the title).
 */
export function parseImportedDoc(text, filename = "") {
  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  let firstIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "") {
      firstIdx = i;
      break;
    }
  }

  let title = "";
  let bodyFrom = 0;
  let titleSource = "filename";

  if (firstIdx !== -1) {
    const firstLine = lines[firstIdx].trim();
    const heading = firstLine.match(/^#{1,6}\s+(.+)$/);
    // The first line IS the subject per the import contract — headings
    // additionally lose their # markers. Quote marks around the line are
    // decorative and dropped.
    title = (heading ? heading[1] : firstLine)
      .trim()
      .replace(/^["“'‘]+|["”'’]+$/g, "")
      .trim();
    bodyFrom = firstIdx + 1;
    titleSource = "first-line";
  }

  if (!title) {
    title = filenameTitle(filename) || "Imported document";
    bodyFrom = 0;
    titleSource = "filename";
  }

  const content = lines
    .slice(bodyFrom)
    .join("\n")
    .replace(/^[ \t]*\n+/, "")
    .replace(/\s+$/, "");

  return { title: title.slice(0, 180), content, titleSource };
}

/**
 * Read a File/Blob as text with BOM sniffing: UTF-8 (default),
 * UTF-16 LE and UTF-16 BE are detected from the first bytes. Windows
 * editors commonly save .md as UTF-16 — without this the import would
 * produce mojibake. Strips a UTF-8 BOM if present.
 */
export async function readTextFile(file) {
  const buffer = await file.arrayBuffer();
  const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  let decoded = "";

  if (head[0] === 0xff && head[1] === 0xfe) {
    decoded = new TextDecoder("utf-16le").decode(buffer);
  } else if (head[0] === 0xfe && head[1] === 0xff) {
    try {
      decoded = new TextDecoder("utf-16be").decode(buffer);
    } catch {
      // Rare engines without utf-16be support: byte-swap then decode LE.
      const swapped = new Uint8Array(buffer);
      for (let i = 0; i + 1 < swapped.length; i += 2) {
        const tmp = swapped[i];
        swapped[i] = swapped[i + 1];
        swapped[i + 1] = tmp;
      }
      decoded = new TextDecoder("utf-16le").decode(swapped);
    }
  } else {
    decoded = new TextDecoder("utf-8").decode(buffer);
  }

  return decoded.replace(/^\uFEFF/, "");
}

/**
 * Heuristic "is this actually a text file" check — rejects binaries
 * dragged into the .md input: either several U+FFFD replacement chars
 * (broken UTF-8 decode) or control characters (NUL, ESC…) in the head
 * of the file. Tab/newline/CR are legitimate and excluded.
 */
export function looksBinary(text) {
  if (!text) return false;
  const replacements = (text.match(/\uFFFD/g) || []).length;
  if (replacements >= 5) return true;
  return /[\u0000-\u0008\u000E-\u001F]/.test(text.slice(0, 4000));
}
