import hljs from "highlight.js/lib/common";

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

const safeUrl = (value = "") => {
  const url = String(value).trim();
  if (!url) return "#";
  // Placeholder asset tokens are left for resolveUrl to rewrite
  if (url.includes("/ASSET_ID/")) return url;
  if (
    /^https?:\/\//i.test(url) ||
    url.startsWith("/") ||
    url.startsWith("#") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  // Relative paths without leading slash — treat as site-relative
  if (/^[\w./%-]+(\?.*)?(#.*)?$/.test(url)) return `/${url}`;
  return "#";
};

const isInternalHash = (url) => typeof url === "string" && url.startsWith("#") && url.length > 1;

const LANGUAGE_ALIASES = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  yml: "yaml",
  md: "markdown",
  html: "xml",
  vue: "xml",
  svelte: "xml",
  docker: "dockerfile",
  text: "plaintext",
  plain: "plaintext",
  plaintext: "plaintext",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "csharp",
  cs: "csharp",
  go: "go",
  rust: "rust",
  rs: "rust",
  sql: "sql",
  kotlin: "kotlin",
  kt: "kotlin",
  swift: "swift",
  java: "java",
  r: "r",
};

const normalizeLanguage = (value) =>
  LANGUAGE_ALIASES[String(value || "").toLowerCase()] || String(value || "").toLowerCase();

const FILE_EXT_ICON = {
  pdf: "PDF",
  doc: "DOC",
  docx: "DOC",
  xls: "XLS",
  xlsx: "XLS",
  ppt: "PPT",
  pptx: "PPT",
  zip: "ZIP",
  rar: "ZIP",
  "7z": "ZIP",
  gz: "ZIP",
  tar: "ZIP",
  txt: "TXT",
  csv: "CSV",
  json: "JSON",
  md: "MD",
  mp3: "AUD",
  wav: "AUD",
  ogg: "AUD",
  mp4: "VID",
  webm: "VID",
  mov: "VID",
  png: "IMG",
  jpg: "IMG",
  jpeg: "IMG",
  gif: "IMG",
  webp: "IMG",
  svg: "IMG",
};

const guessFileKind = (url = "", label = "") => {
  const path = `${url} ${label}`.toLowerCase();
  const m = path.match(/\.([a-z0-9]{1,8})(?:\?|#|$)/i);
  const ext = (m?.[1] || "").toLowerCase();
  if (FILE_EXT_ICON[ext]) return { ext, badge: FILE_EXT_ICON[ext] };
  return { ext: ext || "file", badge: "FILE" };
};

/**
 * Inline markdown: media, images, links, code, bold/italic/strike.
 * Links starting with # are internal anchors (no target=_blank).
 */
const inline = (raw, resolveUrl = safeUrl) => {
  let s = escapeHtml(raw);

  // Custom media: ::audio[title](url) / ::video[title](url)
  s = s.replace(/::(audio|video)\[([^\]]*)\]\(([^)]+)\)/g, (_, kind, title, url) => {
    const safe = resolveUrl(url);
    const caption = title ? `<figcaption>${title}</figcaption>` : "";
    if (kind === "audio") {
      return `<figure class="doc-media doc-audio">${caption}<audio controls preload="metadata" src="${safe}"></audio></figure>`;
    }
    return `<figure class="doc-media doc-video">${caption}<video controls preload="metadata" src="${safe}"></video></figure>`;
  });

  // Images ![alt](url "title")
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title = "") => {
    const safe = resolveUrl(url);
    const cap = title ? `<figcaption>${title}</figcaption>` : "";
    return `<figure class="doc-image"><img src="${safe}" alt="${alt}" loading="lazy" decoding="async"/>${cap}</figure>`;
  });

  // Links [label](url "title") — internal hash stays on-page
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title = "") => {
    const safe = resolveUrl(url);
    const titleAttr = title ? ` title="${title}"` : "";
    if (isInternalHash(safe)) {
      return `<a href="${safe}" class="doc-anchor-link"${titleAttr}>${label}</a>`;
    }
    // File-like links get a richer chip
    const looksLikeFile =
      /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|gz|tar|csv|json|txt|md)(\?|#|$)/i.test(safe) ||
      /\/media\/|\/assets\//i.test(safe);
    if (looksLikeFile && !/\.(png|jpe?g|gif|webp|svg|mp4|webm|mp3|wav|ogg)(\?|#|$)/i.test(safe)) {
      const { badge } = guessFileKind(safe, label);
      return `<a href="${safe}" class="doc-file-link" target="_blank" rel="noopener noreferrer"${titleAttr}><span class="doc-file-badge">${badge}</span><span class="doc-file-label">${label}</span></a>`;
    }
    const external = /^https?:\/\//i.test(safe);
    return `<a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}${titleAttr}>${label}</a>`;
  });

  // Inline code
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Strikethrough
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // Bold then italic (order matters)
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/(?<![\w])_([^_]+)_(?![\w])/g, "<em>$1</em>");

  return s;
};

/** Parse GFM table alignment from separator row. */
const parseAlign = (sepCells) =>
  sepCells.map((cell) => {
    const t = cell.trim();
    const left = t.startsWith(":");
    const right = t.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return "";
  });

const renderTable = (rows, resolveUrl) => {
  if (rows.length < 2) return `<p>${inline(rows[0] || "", resolveUrl)}</p>`;

  const split = (row) =>
    row
      .trim()
      .replace(/^\|\s?|\s?\|$/g, "")
      .split("|")
      .map((x) => x.trim());

  const head = split(rows[0]);
  const aligns = parseAlign(split(rows[1]));
  const body = rows.slice(2).map(split);

  const th = head
    .map((x, i) => {
      const a = aligns[i];
      return `<th${a ? ` style="text-align:${a}"` : ""}>${inline(x, resolveUrl)}</th>`;
    })
    .join("");

  const trs = body
    .map((r) => {
      const tds = head
        .map((_, i) => {
          const a = aligns[i];
          return `<td${a ? ` style="text-align:${a}"` : ""}>${inline(r[i] || "", resolveUrl)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<div class="doc-table-wrap" dir="auto"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
};

const highlightCode = (raw, langHint) => {
  const normalizedLang = normalizeLanguage(langHint);
  let highlighted = escapeHtml(raw);
  let detectedLang = normalizedLang || "text";

  if (normalizedLang && normalizedLang !== "plaintext") {
    try {
      if (hljs.getLanguage(normalizedLang)) {
        highlighted = hljs.highlight(raw, { language: normalizedLang, ignoreIllegals: true }).value;
        detectedLang = normalizedLang;
      } else {
        const auto = hljs.highlightAuto(raw);
        highlighted = auto.value || highlighted;
        detectedLang = auto.language || normalizedLang || "text";
      }
    } catch {
      highlighted = escapeHtml(raw);
    }
  } else if (!langHint && raw.trim()) {
    try {
      const detected = hljs.highlightAuto(raw);
      highlighted = detected.value || highlighted;
      detectedLang = detected.language || "text";
    } catch {
      /* plain */
    }
  }

  return { highlighted, detectedLang };
};

/**
 * Full Markdown → safe HTML renderer.
 * Supports: headings (+ id anchors), GFM tables (alignment), fenced code + highlight.js,
 * lists / task lists, callouts, images, audio/video, file chips, internal # links,
 * blockquotes, hr, auto dir for RTL paragraphs.
 *
 * options.resolveUrl(url) — rewrite media/asset URLs (e.g. auth token).
 */
export function renderMarkdown(markdown = "", options = {}) {
  const resolveUrl = options.resolveUrl || safeUrl;
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let paragraph = [];
  let list = null;
  let quote = [];
  const usedIds = new Map();

  const uniqueId = (base) => {
    const n = usedIds.get(base) || 0;
    usedIds.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ");
    // dir=auto so Persian/Arabic and mixed LTR content render correctly
    out.push(`<p dir="auto">${inline(text, resolveUrl)}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    const items = list.items
      .map((x) => {
        const task = x.task
          ? `<input type="checkbox" disabled ${x.checked ? "checked" : ""} class="doc-task"/> `
          : "";
        return `<li dir="auto">${task}${inline(x.text, resolveUrl)}</li>`;
      })
      .join("");
    out.push(`<${tag} dir="auto">${items}</${tag}>`);
    list = null;
  };

  const flushQuote = () => {
    if (!quote.length) return;
    out.push(`<blockquote dir="auto">${renderMarkdown(quote.join("\n"), options)}</blockquote>`);
    quote = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code blocks ``` or ~~~
    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      const marker = trimmed.slice(0, 3);
      const lang = trimmed.slice(3).trim().split(/\s+/)[0] || "";
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        code.push(lines[i]);
        i += 1;
      }
      const raw = code.join("\n");
      const { highlighted, detectedLang } = highlightCode(raw, lang);
      const lineCount = Math.max(1, raw ? raw.split("\n").length : 1);
      const languageLabel = `<span class="doc-code-lang">${escapeHtml(lang || detectedLang || "text")}</span>`;
      out.push(
        `<div class="doc-code" data-lang="${escapeHtml(detectedLang || "text")}">` +
          `<div class="doc-code-head">` +
          `<span class="doc-code-meta">${languageLabel}<span class="doc-code-lines">${lineCount} lines</span></span>` +
          `<button type="button" class="doc-copy-btn" aria-label="Copy code" title="Copy code">` +
            `<span class="doc-copy-icon" aria-hidden="true">` +
              `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
                `<rect x="9" y="9" width="11" height="11" rx="2"></rect>` +
                `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>` +
              `</svg>` +
            `</span>` +
            `<span class="doc-copy-label">Copy</span>` +
          `</button>` +
          `</div>` +
          `<pre><code class="hljs language-${escapeHtml(detectedLang || "text")}">${highlighted}</code></pre>` +
          `</div>`
      );
      i += 1;
      continue;
    }

    // Callouts :::note / tip / warning / danger
    if (/^:::(note|tip|warning|danger)\s*$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      const kind = trimmed.match(/^:::(\w+)/i)[1].toLowerCase();
      const body = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== ":::") {
        body.push(lines[i]);
        i += 1;
      }
      out.push(
        `<aside class="doc-callout doc-callout-${kind}" dir="auto"><strong>${kind[0].toUpperCase() + kind.slice(1)}</strong>${renderMarkdown(body.join("\n"), options)}</aside>`
      );
      i += 1;
      continue;
    }

    // GFM tables
    if (/^\|.*\|\s*$/.test(line) && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(lines[i + 1] || "")) {
      flushParagraph();
      flushList();
      flushQuote();
      const rows = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) {
        rows.push(lines[i]);
        i += 1;
      }
      out.push(renderTable(rows, resolveUrl));
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushParagraph();
      flushList();
      flushQuote();
      i += 1;
      continue;
    }

    // Headings — id for #anchor navigation
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const level = heading[1].length;
      const rawTitle = heading[2].replace(/\s+#+\s*$/, "");
      const id = uniqueId(slugifyHeading(rawTitle));
      const html = inline(rawTitle, resolveUrl);
      out.push(`<h${level} id="${id}" dir="auto"><a class="doc-heading-anchor" href="#${id}" aria-hidden="true"></a>${html}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^([-*_])(?:\s*\1){2,}\s*$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      out.push("<hr/>");
      i += 1;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^>\s?/, ""));
      i += 1;
      continue;
    }

    // Ordered / unordered / task lists
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ordered || unordered) {
      flushParagraph();
      flushQuote();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      const text = (ordered || unordered)[1];
      const task = text.match(/^\[([ xX])\]\s+(.*)$/);
      list.items.push(
        task
          ? { task: true, checked: task[1].toLowerCase() === "x", text: task[2] }
          : { text, task: false }
      );
      i += 1;
      continue;
    }

    // Bare URL on its own line
    if (/^<https?:\/\/[^>]+>$/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      const url = trimmed.slice(1, -1);
      out.push(
        `<p dir="auto"><a href="${resolveUrl(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`
      );
      i += 1;
      continue;
    }

    paragraph.push(trimmed);
    i += 1;
  }

  flushParagraph();
  flushList();
  flushQuote();
  return out.join("\n");
}

export const MARKDOWN_CHEATSHEET = [
  { group: "Structure", label: "Heading", icon: "H", snippet: "## Section title\n" },
  {
    group: "Structure",
    label: "Table",
    icon: "▦",
    snippet: "| Column | Value |\n| --- | --- |\n| Item | Value |\n",
  },
  {
    group: "Structure",
    label: "Aligned table",
    icon: "☰",
    snippet: "| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |\n",
  },
  { group: "Formatting", label: "Bold", icon: "B", snippet: "**important text**" },
  { group: "Formatting", label: "Italic", icon: "I", snippet: "*emphasis*" },
  { group: "Formatting", label: "Strike", icon: "S", snippet: "~~removed~~" },
  { group: "Formatting", label: "Link", icon: "↗", snippet: "[label](https://example.com)" },
  { group: "Formatting", label: "Anchor link", icon: "#", snippet: "[Jump to section](#section-title)" },
  { group: "Code", label: "Code block", icon: "</>", snippet: "```js\nconsole.log('hello')\n```\n" },
  { group: "Code", label: "Inline code", icon: "`", snippet: "`value`" },
  { group: "Content", label: "Image from library", icon: "▧", action: "library-image" },
  { group: "Content", label: "File from library", icon: "↓", action: "library-file" },
  { group: "Content", label: "Audio from library", icon: "♫", action: "library-audio" },
  { group: "Content", label: "Video from library", icon: "▶", action: "library-video" },
  { group: "Content", label: "Callout", icon: "!", snippet: ":::note\nUseful information.\n:::\n" },
  { group: "Content", label: "Quote", icon: "❝", snippet: "> Useful note\n" },
  { group: "Lists", label: "Bullet list", icon: "•", snippet: "- First item\n- Second item\n" },
  { group: "Lists", label: "Task list", icon: "☑", snippet: "- [ ] Todo\n- [x] Done\n" },
];
