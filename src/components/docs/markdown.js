import hljs from "highlight.js/lib/common";
import { escapeHtml, slugifyHeading } from "./markdownShared";
import {
  expandCustomInline,
  tryRenderDirective,
  isSpecialFence,
  renderSpecialFence,
  postProcessHtml,
  tryDefinitionList,
} from "./docComponents";

export { escapeHtml, slugifyHeading };

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
  // Custom inline: kbd, badge, copy, term
  s = expandCustomInline(s);

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

/**
 * Minimal sanitizer for live-HTML fences.
 * Removes script/style/iframe/object/embed/form and on* event handlers.
 * Allows common presentation tags so docs can embed diagrams, cards, etc.
 */
const sanitizeLiveHtml = (raw = "") => {
  let html = String(raw);
  // Remove dangerous tags entirely (opening + content + closing when possible)
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|link|meta|base|svg\s+onload)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|link|meta|base)[^>]*\/?\s*>/gi,
    ""
  );
  // Strip event handlers and javascript: URLs
  html = html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(
    /\s+(href|src|xlink:href)\s*=\s*(["'])\s*javascript:[^"']*\2/gi,
    ' $1="#"'
  );
  html = html.replace(
    /\s+(href|src)\s*=\s*javascript:[^\s>]*/gi,
    ' $1="#"'
  );
  return html;
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
 * Full Markdown → safe HTML renderer (Docs-as-Code).
 * Supports: headings (+ id anchors), GFM tables (alignment), fenced code + highlight.js,
 * live HTML fences (```html-render / :::html), lists / task lists, callouts,
 * images, audio/video, file chips, internal # links, blockquotes, hr,
 * auto dir for RTL paragraphs.
 *
 * Live HTML: ```html-render | ```live-html | ```raw-html | ```html! | :::html
 * (scripts / iframes / on* handlers stripped).
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

  const alertClass = (kind) => {
    const k = String(kind || "").toLowerCase();
    const map = {
      note: "note",
      tip: "tip",
      important: "important",
      warning: "warning",
      caution: "danger",
      danger: "danger",
    };
    return map[k] || "note";
  };

  const alertLabel = (kind) => {
    const k = String(kind || "").toLowerCase();
    return ({ note: "Note", tip: "Tip", important: "Important", warning: "Warning", caution: "Caution", danger: "Danger" })[k] || kind;
  };

  const flushQuote = () => {
    if (!quote.length) return;
    const body = quote.join("\n");
    // GitHub-style alerts: first line is [!NOTE] / [!IMPORTANT] / ...
    const m = body.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]\s*(.*)$/is);
    if (m) {
      const kind = m[1].toLowerCase();
      const rest = (m[2] || "").replace(/^\n+/, "");
      const cls = alertClass(kind);
      out.push(
        `<aside class="doc-callout doc-callout-${cls}" dir="auto"><strong>${alertLabel(kind)}</strong>${renderMarkdown(rest, options)}</aside>`
      );
    } else {
      out.push(`<blockquote dir="auto">${renderMarkdown(body, options)}</blockquote>`);
    }
    quote = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code blocks ``` or ~~~
    // Special langs that RENDER as live HTML (not highlighted source):
    //   ```html-render | ```render-html | ```live-html | ```html! | ```raw-html
    if (/^```/.test(trimmed) || /^~~~/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      const marker = trimmed.slice(0, 3);
      const langRaw = trimmed.slice(3).trim();
      const lang = langRaw.split(/\s+/)[0] || "";
      const langLower = lang.toLowerCase();
      const isLiveHtml =
        /^(html-render|render-html|live-html|raw-html|html!)$/i.test(langLower) ||
        (langLower === "html" && /\brender\b/i.test(langRaw));
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        code.push(lines[i]);
        i += 1;
      }
      const raw = code.join("\n");

      if (isLiveHtml) {
        const safeHtml = sanitizeLiveHtml(raw);
        out.push(
          `<div class="doc-html">` +
            `<div class="doc-html-head"><span>Live HTML</span></div>` +
            `<div class="doc-html-body">${safeHtml}</div>` +
          `</div>`
        );
      } else if (isSpecialFence(langLower)) {
        const special = renderSpecialFence(langLower, raw, highlightCode);
        if (special) out.push(special);
      } else {
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
      }
      i += 1;
      continue;
    }

    // Live HTML block via :::html ... :::
    if (/^:::html\s*$/i.test(trimmed)) {
      flushParagraph();
      flushList();
      flushQuote();
      const body = [];
      i += 1;
      while (i < lines.length && lines[i].trim() !== ":::") {
        body.push(lines[i]);
        i += 1;
      }
      const safeHtml = sanitizeLiveHtml(body.join("\n"));
      out.push(
        `<div class="doc-html">` +
          `<div class="doc-html-head"><span>Live HTML</span></div>` +
          `<div class="doc-html-body">${safeHtml}</div>` +
        `</div>`
      );
      i += 1;
      continue;
    }

    // Extended ::: directives (tabs, steps, api, …)
    if (/^:::[a-z]/i.test(trimmed)) {
      const renderInner = (md) => renderMarkdown(md, options);
      const dir = tryRenderDirective(trimmed, lines, i, renderInner, resolveUrl);
      if (dir) {
        flushParagraph();
        flushList();
        flushQuote();
        out.push(dir.html);
        i = dir.nextIndex;
        continue;
      }
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

    // GitHub / Docs alerts: [!IMPORTANT] title-or-body (standalone, not blockquote)
    // Also supports multi-line: [!WARNING] on its own line, body until blank line
    {
      const alertStart = trimmed.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]\s*(.*)$/i);
      if (alertStart) {
        flushParagraph();
        flushList();
        flushQuote();
        const kind = alertStart[1].toLowerCase();
        const firstRest = (alertStart[2] || "").trim();
        const body = [];
        if (firstRest) body.push(firstRest);
        i += 1;
        while (i < lines.length) {
          const n = lines[i];
          const nt = n.trim();
          if (!nt) break;
          if (/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|DANGER)\]/i.test(nt)) break;
          if (/^#{1,6}\s/.test(nt)) break;
          if (/^:::/.test(nt)) break;
          if (/^```/.test(nt) || /^~~~/.test(nt)) break;
          if (/^>\s?/.test(n)) break;
          body.push(n);
          i += 1;
        }
        const cls = alertClass(kind);
        out.push(
          `<aside class="doc-callout doc-callout-${cls}" dir="auto"><strong>${alertLabel(kind)}</strong>${renderMarkdown(body.join("\n"), options)}</aside>`
        );
        continue;
      }
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

    // Definition list: Term\n: definition
    {
      const dl = tryDefinitionList(lines, i, (t) => inline(t, resolveUrl));
      if (dl) {
        flushParagraph();
        flushList();
        flushQuote();
        out.push(dl.html);
        i = dl.nextIndex;
        continue;
      }
    }

    paragraph.push(trimmed);
    i += 1;
  }

  flushParagraph();
  flushList();
  flushQuote();
  const joined = out.join("\n");
  return postProcessHtml(joined, String(markdown));
}

export const MARKDOWN_CHEATSHEET = [
  { group: "Structure", label: "Heading", icon: "H", snippet: "## Section title\n" },
  { group: "Structure", label: "Table", icon: "▦", snippet: "| Column | Value |\n| --- | --- |\n| Item | Value |\n" },
  { group: "Structure", label: "TOC", icon: "☰", snippet: ":::toc\n:::\n" },
  { group: "Structure", label: "Anchors menu", icon: "↕", snippet: ":::anchors h2\n:::\n" },
  { group: "Structure", label: "Breadcrumb", icon: "›", snippet: ":::breadcrumb Home > API > Auth\n:::\n" },
  { group: "Structure", label: "Reading time", icon: "⏱", snippet: ":::reading-time\n:::\n" },
  { group: "Structure", label: "Meta bar", icon: "i", snippet: ":::meta author=Team updated=2026-08-31 tags=api,guide\n:::\n" },
  { group: "Structure", label: "Page nav", icon: "⇔", snippet: ":::nav prev=intro|Introduction next=auth|Authentication\n:::\n" },
  { group: "Structure", label: "Steps", icon: "1", snippet: ":::steps\n1. Install\n   Details here\n2. Configure\n3. Run\n:::\n" },
  { group: "Structure", label: "Tabs", icon: "◫", snippet: ":::tabs\n=== JavaScript\n`npm i pkg`\n=== Python\n`pip install pkg`\n:::\n" },
  { group: "Structure", label: "Accordion", icon: "▾", snippet: ":::details FAQ title\nHidden content\n:::\n" },
  { group: "Structure", label: "Cards", icon: "▦", snippet: ":::cards\n=== Feature A\nDescription\n=== Feature B\nDescription\n:::\n" },
  { group: "Structure", label: "Compare", icon: "▥", snippet: ":::compare Free | Pro\n=== Free\n- Basic\n=== Pro\n- Advanced\n:::\n" },
  { group: "Structure", label: "Timeline", icon: "∴", snippet: ":::timeline\n2026-01-01 — Launch\nInitial release\n2026-06-01 — v2\nMajor update\n:::\n" },
  { group: "Formatting", label: "Bold", icon: "B", snippet: "**important**" },
  { group: "Formatting", label: "Italic", icon: "I", snippet: "*emphasis*" },
  { group: "Formatting", label: "Strike", icon: "S", snippet: "~~removed~~" },
  { group: "Formatting", label: "Link", icon: "↗", snippet: "[label](https://example.com)" },
  { group: "Formatting", label: "Kbd", icon: "⌨", snippet: "[[kbd:Ctrl+K]]" },
  { group: "Formatting", label: "Badge", icon: "●", snippet: "[[badge:success New]]" },
  { group: "Formatting", label: "Copy value", icon: "⧉", snippet: "[[copy:sk_live_xxx]]" },
  { group: "Formatting", label: "Term", icon: "?", snippet: "[[term:OAuth]]" },
  { group: "Code", label: "Code block", icon: "</>", snippet: "```js\nconsole.log('hello')\n```\n" },
  { group: "Code", label: "Terminal", icon: "$", snippet: "```terminal\n$ npm install\n+ pkg@1.0.0\n```\n" },
  { group: "Code", label: "Output", icon: "◀", snippet: "```output\n{ \"ok\": true }\n```\n" },
  { group: "Code", label: "Diff", icon: "±", snippet: "```diff\n- old\n+ new\n```\n" },
  { group: "Code", label: "Code group", icon: "{ }", snippet: ":::code-group\n=== index.js\n```js\nexport default 1\n```\n=== index.ts\n```ts\nexport default 1\n```\n:::\n" },
  { group: "Code", label: "Live HTML", icon: "<>", snippet: "```html-render\n<div style=\"padding:12px;border:1px solid #334155\">Hello</div>\n```\n" },
  { group: "Code", label: "Mermaid", icon: "⬡", snippet: "```mermaid\nflowchart LR\n  A-->B\n```\n" },
  { group: "API", label: "API endpoint", icon: "API", snippet: ":::api GET /v1/users\nReturns a list of users.\n:::\n" },
  { group: "API", label: "Env table", icon: "ENV", snippet: ":::env\nAPI_KEY · yes · — · Secret key\nDEBUG · no · false · Verbose logs\n:::\n" },
  { group: "API", label: "Props table", icon: "P", snippet: ":::props\nid · string · — · Unique id\nsize · number · 16 · Icon size\n:::\n" },
  { group: "API", label: "File tree", icon: "🌳", snippet: ":::tree\nsrc/\n  components/\n    App.jsx\n  index.js\n:::\n" },
  { group: "API", label: "Matrix", icon: "⊞", snippet: ":::matrix\n| Feature | Free | Pro |\n| --- | --- | --- |\n| API | ✓ | ✓ |\n| SSO | ✗ | ✓ |\n:::\n" },
  { group: "Callouts", label: "Note", icon: "!", snippet: ":::note\nUseful information.\n:::\n" },
  { group: "Callouts", label: "Tip", icon: "✓", snippet: ":::tip\nHelpful tip.\n:::\n" },
  { group: "Callouts", label: "Warning", icon: "⚠", snippet: ":::warning\nBe careful.\n:::\n" },
  { group: "Callouts", label: "Danger", icon: "✕", snippet: ":::danger\nDestructive action.\n:::\n" },
  { group: "Callouts", label: "Deprecated", icon: "⛔", snippet: ":::deprecated since=2.0 use=newApi\nOld endpoint removed soon.\n:::\n" },
  { group: "Callouts", label: "Security", icon: "🔒", snippet: ":::security critical\nRotate keys immediately.\n:::\n" },
  { group: "Callouts", label: "Best practice", icon: "★", snippet: ":::best-practice\nPrefer idempotent writes.\n:::\n" },
  { group: "Callouts", label: "Example", icon: "✓", snippet: ":::example\nCorrect usage.\n:::\n" },
  { group: "Callouts", label: "Anti-example", icon: "✗", snippet: ":::anti-example\nAvoid this pattern.\n:::\n" },
  { group: "Callouts", label: "Draft", icon: "✎", snippet: ":::draft\nWork in progress.\n:::\n" },
  { group: "Callouts", label: "Changelog", icon: "📦", snippet: ":::changelog 1.2.0 2026-08-01\n- Added tabs\n- Fixed anchors\n:::\n" },
  { group: "Media", label: "Image library", icon: "▧", action: "library-image" },
  { group: "Media", label: "File library", icon: "↓", action: "library-file" },
  { group: "Media", label: "Audio library", icon: "♫", action: "library-audio" },
  { group: "Media", label: "Video library", icon: "▶", action: "library-video" },
  { group: "Media", label: "Figure", icon: "▣", snippet: ":::figure\n![Alt](url)\nCaption text\n:::\n" },
  { group: "Media", label: "Download", icon: "⬇", snippet: ":::download /files/spec.pdf API Spec PDF\n:::\n" },
  { group: "Media", label: "Embed YT", icon: "▶", snippet: ":::embed youtube dQw4w9WgXcQ\n:::\n" },
  { group: "Media", label: "QR code", icon: "▦", snippet: ":::qr https://example.com/app\n:::\n" },
  { group: "Content", label: "Definition", icon: "≡", snippet: "OAuth\n: Open protocol for authorization\n" },
  { group: "Content", label: "Spoiler", icon: "▒", snippet: ":::spoiler Answer\n42\n:::\n" },
  { group: "Content", label: "Related", icon: "→", snippet: ":::related\n[Auth guide](/docs/auth) — tokens\n[Errors](/docs/errors)\n:::\n" },
  { group: "Content", label: "Feedback", icon: "?", snippet: ":::feedback\n:::\n" },
  { group: "Content", label: "Author", icon: "☺", snippet: ":::author @team\nPlatform engineering\n:::\n" },
  { group: "Content", label: "Progress", icon: "%", snippet: ":::progress 70\nRoadmap complete\n:::\n" },
  { group: "Content", label: "Date", icon: "📅", snippet: ":::date 2026-12-01\n:::\n" },
  { group: "Content", label: "i18n note", icon: "文", snippet: ":::i18n فارسی\n:::\n" },
  { group: "Content", label: "Quote", icon: "❝", snippet: "> Useful note\n" },
  { group: "Lists", label: "Bullet list", icon: "•", snippet: "- First item\n- Second item\n" },
  { group: "Lists", label: "Task list", icon: "☑", snippet: "- [ ] Todo\n- [x] Done\n" },
];

/** Full syntax reference for admin — paste into a doc or open from helper */
export const DOCS_COMPONENT_REFERENCE = `# Docs-as-Code component reference

:::meta author=Docs Team updated=2026-08-31 tags=markdown,components
:::

:::reading-time
:::

:::note
Every custom block available in the admin Markdown editor is listed below. Use **Ctrl/Cmd+K** in the editor to insert snippets.
:::

## Inline tokens

| Token | Syntax |
| --- | --- |
| Keyboard | [[kbd:Ctrl+K]] |
| Badge | [[badge:success New]] |
| Copy value | [[copy:sk_live_xxx]] |
| Term | [[term:OAuth]] |

## Layout blocks

Tabs, Accordion (\`:::details\`), Steps, Cards, Compare, Timeline, TOC (\`:::toc\`), Anchors (\`:::anchors h2\`), Breadcrumb, Page nav, Reading time, Meta bar.

## API & code

\`:::api GET /path\`, \`:::env\`, \`:::props\`, \`:::tree\`, \`:::matrix\`, \`:::code-group\`

Fences: \`\`\`terminal\` \`\`\`output\` \`\`\`diff\` \`\`\`mermaid\` \`\`\`html-render\` \`\`\`math\`

## Callouts

\`:::note\` \`:::tip\` \`:::warning\` \`:::danger\` \`:::deprecated\` \`:::security\` \`:::best-practice\` \`:::example\` \`:::anti-example\` \`:::draft\` \`:::changelog\`

## Media

\`:::figure\` \`:::download\` \`:::embed youtube ID\` \`:::qr URL\`

## Other

Definition lists, \`:::spoiler\`, \`:::related\`, \`:::feedback\`, \`:::author\`, \`:::progress\`, \`:::date\`, \`:::i18n\`

:::feedback
:::
`;
