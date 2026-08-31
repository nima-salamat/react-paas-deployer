/**
 * Docs-as-Code custom components (50 extensions).
 * Used by renderMarkdown — returns HTML strings.
 */
import { escapeHtml, slugifyHeading } from "./markdownShared";

export { escapeHtml, slugifyHeading };

const METHOD_COLORS = {
  get: "get",
  post: "post",
  put: "put",
  patch: "patch",
  delete: "delete",
  head: "head",
  options: "options",
};

/** Collect body until closing ::: */
export function collectUntilClose(lines, startIndex) {
  const body = [];
  let i = startIndex;
  while (i < lines.length && lines[i].trim() !== ":::") {
    body.push(lines[i]);
    i += 1;
  }
  return { body, nextIndex: i + 1 };
}

/** Split body into sections by lines matching `=== Title` or `--- Title` */
function splitSections(bodyLines, marker = "===") {
  const sections = [];
  let current = null;
  for (const line of bodyLines) {
    const m = line.match(new RegExp(`^${marker}\\s+(.+)$`));
    if (m) {
      if (current) sections.push(current);
      current = { title: m[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      // preamble ignored or first section without marker
      if (!current) current = { title: "Section", lines: [line] };
      else current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function parseAttrs(headerRest = "") {
  const attrs = {};
  const re = /(\w+)=("([^"]*)"|'([^']*)'|(\S+))/g;
  let m;
  while ((m = re.exec(headerRest))) {
    attrs[m[1]] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  // bare tokens
  headerRest
    .replace(re, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .forEach((t) => {
      if (!t.includes("=")) attrs[t] = true;
    });
  return attrs;
}

/** Inline tokens processed after basic markdown inline */
export function expandCustomInline(html) {
  // [[kbd:Ctrl+K]]
  html = html.replace(/\[\[kbd:([^\]]+)\]\]/gi, (_, keys) => {
    const parts = keys.split("+").map((k) => `<kbd class="doc-kbd">${escapeHtml(k.trim())}</kbd>`);
    return parts.join('<span class="doc-kbd-plus">+</span>');
  });
  // [[badge:success New]] or [[badge New]]
  html = html.replace(/\[\[badge(?::([a-z]+))?\s+([^\]]+)\]\]/gi, (_, tone, label) => {
    const t = (tone || "neutral").toLowerCase();
    return `<span class="doc-badge doc-badge-${escapeHtml(t)}">${escapeHtml(label.trim())}</span>`;
  });
  // [[copy:value]]
  html = html.replace(/\[\[copy:([^\]]+)\]\]/gi, (_, val) => {
    const v = escapeHtml(val.trim());
    return `<button type="button" class="doc-inline-copy" data-copy="${v}" title="Copy"><code>${v}</code><span class="doc-inline-copy-label">Copy</span></button>`;
  });
  // [[term:OAuth]]
  html = html.replace(/\[\[term:([^\]]+)\]\]/gi, (_, term) => {
    const t = escapeHtml(term.trim());
    return `<abbr class="doc-term" data-term="${t}" title="${t}">${t}</abbr>`;
  });
  return html;
}

/**
 * Try to handle a :::directive line. Returns HTML or null.
 * renderInner(md) renders nested markdown.
 */
export function tryRenderDirective(trimmed, lines, i, renderInner, resolveUrl) {
  // :::tabs
  if (/^:::tabs\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const sections = splitSections(body, "===");
    const id = `tabs-${Math.random().toString(36).slice(2, 9)}`;
    const tabs = sections
      .map((s, idx) => {
        const tid = `${id}-${idx}`;
        return `<button type="button" class="doc-tab${idx === 0 ? " is-active" : ""}" data-tab-target="${tid}" role="tab">${escapeHtml(s.title)}</button>`;
      })
      .join("");
    const panels = sections
      .map((s, idx) => {
        const tid = `${id}-${idx}`;
        return `<div class="doc-tab-panel${idx === 0 ? " is-active" : ""}" id="${tid}" role="tabpanel">${renderInner(s.lines.join("\n"))}</div>`;
      })
      .join("");
    return {
      html: `<div class="doc-tabs" data-doc-tabs><div class="doc-tabs-list" role="tablist">${tabs}</div><div class="doc-tabs-panels">${panels}</div></div>`,
      nextIndex,
    };
  }

  // :::details Title  OR  :::details Title open
  if (/^:::details\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::details\s*/i, "");
    const open = /\bopen\b/i.test(rest);
    const title = rest.replace(/\bopen\b/i, "").trim() || "Details";
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<details class="doc-details"${open ? " open" : ""}><summary class="doc-details-summary">${escapeHtml(title)}</summary><div class="doc-details-body">${renderInner(body.join("\n"))}</div></details>`,
      nextIndex,
    };
  }

  // :::spoiler [Title]
  if (/^:::spoiler\b/i.test(trimmed)) {
    const title = trimmed.replace(/^:::spoiler\s*/i, "").trim() || "Spoiler";
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<details class="doc-spoiler"><summary class="doc-spoiler-summary">${escapeHtml(title)}</summary><div class="doc-spoiler-body">${renderInner(body.join("\n"))}</div></details>`,
      nextIndex,
    };
  }

  // :::steps
  if (/^:::steps\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const steps = [];
    let cur = null;
    for (const line of body) {
      const m = line.match(/^\d+[.)]\s+(.+)$/) || line.match(/^#{1,3}\s+(.+)$/) || line.match(/^[-*]\s+(.+)$/);
      if (m && (line.match(/^\d+[.)]/) || line.match(/^#{1,3}\s/) || (cur === null && line.match(/^[-*]\s/)))) {
        if (cur) steps.push(cur);
        cur = { title: m[1], lines: [] };
      } else if (cur) {
        cur.lines.push(line);
      } else if (line.trim()) {
        cur = { title: line.trim(), lines: [] };
      }
    }
    if (cur) steps.push(cur);
    const items = steps
      .map(
        (s, idx) =>
          `<li class="doc-step"><div class="doc-step-num">${idx + 1}</div><div class="doc-step-body"><div class="doc-step-title">${escapeHtml(s.title)}</div>${s.lines.length ? renderInner(s.lines.join("\n")) : ""}</div></li>`
      )
      .join("");
    return {
      html: `<ol class="doc-steps">${items}</ol>`,
      nextIndex,
    };
  }

  // :::cards
  if (/^:::cards\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const sections = splitSections(body, "===");
    const cards = sections
      .map((s) => {
        const first = s.lines.find((l) => l.trim()) || "";
        const linkM = first.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        const href = linkM ? resolveUrl(linkM[2]) : null;
        const content = renderInner(s.lines.join("\n"));
        const inner = `<div class="doc-card-title">${escapeHtml(s.title)}</div><div class="doc-card-body">${content}</div>`;
        return href
          ? `<a class="doc-card" href="${escapeHtml(href)}">${inner}</a>`
          : `<div class="doc-card">${inner}</div>`;
      })
      .join("");
    return { html: `<div class="doc-cards">${cards}</div>`, nextIndex };
  }

  // :::api METHOD /path
  if (/^:::api\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::api\s*/i, "").trim();
    const m = rest.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(.*)$/i);
    const method = (m?.[1] || "GET").toUpperCase();
    const path = m?.[2] || rest;
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const tone = METHOD_COLORS[method.toLowerCase()] || "get";
    return {
      html: `<div class="doc-api"><div class="doc-api-head"><span class="doc-api-method doc-api-method-${tone}">${escapeHtml(method)}</span><code class="doc-api-path">${escapeHtml(path)}</code></div>${body.length ? `<div class="doc-api-body">${renderInner(body.join("\n"))}</div>` : ""}</div>`,
      nextIndex,
    };
  }

  // :::tree
  if (/^:::tree\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const rows = body
      .filter((l) => l.trim())
      .map((line) => {
        const stripped = line.replace(/\t/g, "  ");
        const indent = (stripped.match(/^ */)?.[0].length || 0) / 2;
        const name = stripped.trim();
        const isDir = name.endsWith("/") || name.endsWith("\\");
        return `<div class="doc-tree-row" style="--depth:${Math.floor(indent)}"><span class="doc-tree-icon">${isDir ? "📁" : "📄"}</span><span class="doc-tree-name">${escapeHtml(name.replace(/\/$/, ""))}${isDir ? "/" : ""}</span></div>`;
      })
      .join("");
    return { html: `<div class="doc-tree">${rows}</div>`, nextIndex };
  }

  // :::toc
  if (/^:::toc\b/i.test(trimmed)) {
    const { nextIndex } = collectUntilClose(lines, i + 1);
    // Placeholder — filled by post-process from headings
    return { html: `<nav class="doc-toc" data-doc-toc><div class="doc-toc-title">On this page</div><div class="doc-toc-list"></div></nav>`, nextIndex };
  }

  // :::callout variants already handled in main — extra tones:
  // :::deprecated since=2.0 use=Other
  if (/^:::deprecated\b/i.test(trimmed)) {
    const attrs = parseAttrs(trimmed.replace(/^:::deprecated\s*/i, ""));
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const meta = [
      attrs.since ? `Since ${escapeHtml(attrs.since)}` : "",
      attrs.use ? `Use <code>${escapeHtml(attrs.use)}</code> instead` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      html: `<aside class="doc-callout doc-callout-deprecated" dir="auto"><strong>Deprecated</strong>${meta ? `<div class="doc-callout-meta">${meta}</div>` : ""}${renderInner(body.join("\n"))}</aside>`,
      nextIndex,
    };
  }

  if (/^:::security\b/i.test(trimmed)) {
    const level = (trimmed.replace(/^:::security\s*/i, "").trim().split(/\s+/)[0] || "warning").toLowerCase();
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<aside class="doc-callout doc-callout-security doc-security-${escapeHtml(level)}" dir="auto"><strong>Security · ${escapeHtml(level)}</strong>${renderInner(body.join("\n"))}</aside>`,
      nextIndex,
    };
  }

  if (/^:::best-practice\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<aside class="doc-callout doc-callout-best" dir="auto"><strong>Best practice</strong>${renderInner(body.join("\n"))}</aside>`,
      nextIndex,
    };
  }

  if (/^:::example\s*$/i.test(trimmed) || /^:::anti-example\s*$/i.test(trimmed)) {
    const anti = /^:::anti-example/i.test(trimmed);
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<aside class="doc-callout ${anti ? "doc-callout-anti" : "doc-callout-example"}" dir="auto"><strong>${anti ? "Anti-example" : "Example"}</strong>${renderInner(body.join("\n"))}</aside>`,
      nextIndex,
    };
  }

  // :::changelog version date
  if (/^:::changelog\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::changelog\s*/i, "").trim();
    const parts = rest.split(/\s+/);
    const version = parts[0] || "";
    const date = parts[1] || "";
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<div class="doc-changelog"><div class="doc-changelog-head"><span class="doc-badge doc-badge-success">${escapeHtml(version)}</span>${date ? `<time class="doc-changelog-date">${escapeHtml(date)}</time>` : ""}</div><div class="doc-changelog-body">${renderInner(body.join("\n"))}</div></div>`,
      nextIndex,
    };
  }

  // :::code-group
  if (/^:::code-group\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    // Body should contain fenced code blocks; we parse labels from === File or first line of fence
    const sections = [];
    let j = 0;
    while (j < body.length) {
      const line = body[j];
      const sec = line.match(/^===\s+(.+)$/);
      if (sec) {
        const title = sec[1].trim();
        j += 1;
        const codeLines = [];
        if (j < body.length && /^```/.test(body[j].trim())) {
          const marker = body[j].trim().slice(0, 3);
          const lang = body[j].trim().slice(3).trim();
          j += 1;
          while (j < body.length && !body[j].trim().startsWith(marker)) {
            codeLines.push(body[j]);
            j += 1;
          }
          j += 1; // close fence
          sections.push({ title, lang, code: codeLines.join("\n") });
        } else {
          while (j < body.length && !/^===\s+/.test(body[j]) && !/^```/.test(body[j].trim())) {
            codeLines.push(body[j]);
            j += 1;
          }
          sections.push({ title, lang: "text", code: codeLines.join("\n") });
        }
        continue;
      }
      if (/^```/.test(line.trim())) {
        const marker = line.trim().slice(0, 3);
        const lang = line.trim().slice(3).trim() || "text";
        j += 1;
        const codeLines = [];
        while (j < body.length && !body[j].trim().startsWith(marker)) {
          codeLines.push(body[j]);
          j += 1;
        }
        j += 1;
        sections.push({ title: lang || "code", lang, code: codeLines.join("\n") });
        continue;
      }
      j += 1;
    }
    const id = `cg-${Math.random().toString(36).slice(2, 9)}`;
    const tabs = sections
      .map(
        (s, idx) =>
          `<button type="button" class="doc-tab${idx === 0 ? " is-active" : ""}" data-tab-target="${id}-${idx}">${escapeHtml(s.title)}</button>`
      )
      .join("");
    const panels = sections
      .map((s, idx) => {
        // Use a simple pre; highlighting applied if we pass through highlight — keep escaped
        const esc = escapeHtml(s.code);
        return `<div class="doc-tab-panel${idx === 0 ? " is-active" : ""}" id="${id}-${idx}"><div class="doc-code" data-lang="${escapeHtml(s.lang)}"><div class="doc-code-head"><span class="doc-code-meta"><span class="doc-code-lang">${escapeHtml(s.lang || "text")}</span></span><button type="button" class="doc-copy-btn" aria-label="Copy code"><span class="doc-copy-label">Copy</span></button></div><pre><code class="hljs">${esc}</code></pre></div></div>`;
      })
      .join("");
    return {
      html: `<div class="doc-tabs doc-code-group" data-doc-tabs><div class="doc-tabs-list">${tabs}</div><div class="doc-tabs-panels">${panels}</div></div>`,
      nextIndex,
    };
  }

  // :::output
  if (/^:::output\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<div class="doc-output"><div class="doc-output-head">Output</div><pre class="doc-output-body">${escapeHtml(body.join("\n"))}</pre></div>`,
      nextIndex,
    };
  }

  // :::env
  if (/^:::env\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const rows = body
      .filter((l) => l.trim() && !l.trim().startsWith("|"))
      .map((line) => {
        // KEY · required · default · description  OR KEY | required | default | desc
        const parts = line.includes("|")
          ? line.split("|").map((x) => x.trim()).filter(Boolean)
          : line.split("·").map((x) => x.trim());
        const [key, req, def, ...desc] = parts;
        return `<tr><td><code>${escapeHtml(key || "")}</code></td><td>${escapeHtml(req || "")}</td><td><code>${escapeHtml(def || "")}</code></td><td>${escapeHtml(desc.join(" · ") || "")}</td></tr>`;
      })
      .join("");
    return {
      html: `<div class="doc-table-wrap doc-env"><table><thead><tr><th>Variable</th><th>Required</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      nextIndex,
    };
  }

  // :::props
  if (/^:::props\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const rows = body
      .filter((l) => l.trim())
      .map((line) => {
        const parts = line.includes("|")
          ? line.split("|").map((x) => x.trim()).filter((_, i, a) => !(i === 0 && !a[0]) && !(i === a.length - 1 && !a[i]))
          : line.split("·").map((x) => x.trim());
        const cells = parts.map((p) => `<td>${p.startsWith("`") ? p : escapeHtml(p)}</td>`).join("");
        // If markdown-ish, still escape simply
        const safe = parts.map((p) => `<td><code>${escapeHtml(p.replace(/^`|`$/g, ""))}</code></td>`).join("");
        return `<tr>${parts.map((p, idx) => (idx === 0 ? `<td><code>${escapeHtml(p)}</code></td>` : `<td>${escapeHtml(p)}</td>`)).join("")}</tr>`;
      })
      .join("");
    return {
      html: `<div class="doc-table-wrap doc-props"><table><thead><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`,
      nextIndex,
    };
  }

  // :::matrix
  if (/^:::matrix\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const tableLines = body.filter((l) => /^\|/.test(l.trim()));
    // reuse simple table render via join as markdown table — handled by returning pre-built if enough lines
    if (tableLines.length >= 2) {
      // Let outer table parser style — emit as raw table HTML simplified
      const split = (row) =>
        row
          .trim()
          .replace(/^\|\s?|\s?\|$/g, "")
          .split("|")
          .map((x) => x.trim());
      const head = split(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(split);
      const th = head.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
      const trs = bodyRows
        .map((r) => `<tr>${head.map((_, i) => {
          const cell = r[i] || "";
          const ok = /^(✓|✔|yes|true|✅)$/i.test(cell);
          const no = /^(✗|✘|no|false|❌|—|-)$/i.test(cell);
          const cls = ok ? " doc-matrix-yes" : no ? " doc-matrix-no" : "";
          return `<td class="${cls.trim()}">${escapeHtml(cell)}</td>`;
        }).join("")}</tr>`)
        .join("");
      return {
        html: `<div class="doc-table-wrap doc-matrix"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`,
        nextIndex,
      };
    }
    return { html: `<div class="doc-matrix">${renderInner(body.join("\n"))}</div>`, nextIndex };
  }

  // :::timeline
  if (/^:::timeline\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const items = [];
    let cur = null;
    for (const line of body) {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}|\w[\w\s]*?)\s*[—–-]\s*(.+)$/) || line.match(/^#{1,3}\s+(.+)$/);
      if (m) {
        if (cur) items.push(cur);
        cur = { date: m[1], title: m[2] || m[1], lines: [] };
        if (!m[2]) cur = { date: "", title: m[1], lines: [] };
      } else if (cur) cur.lines.push(line);
    }
    if (cur) items.push(cur);
    const lis = items
      .map(
        (it) =>
          `<li class="doc-timeline-item"><div class="doc-timeline-dot"></div><div class="doc-timeline-content">${it.date ? `<time>${escapeHtml(it.date)}</time>` : ""}<div class="doc-timeline-title">${escapeHtml(it.title)}</div>${it.lines.length ? renderInner(it.lines.join("\n")) : ""}</div></li>`
      )
      .join("");
    return { html: `<ul class="doc-timeline">${lis}</ul>`, nextIndex };
  }

  // :::compare
  if (/^:::compare\b/i.test(trimmed)) {
    const labels = trimmed.replace(/^:::compare\s*/i, "").split("|").map((x) => x.trim()).filter(Boolean);
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const sections = splitSections(body, "===");
    const cols = sections.map((s, idx) => {
      const label = labels[idx] || s.title;
      return `<div class="doc-compare-col"><div class="doc-compare-label">${escapeHtml(label)}</div><div class="doc-compare-body">${renderInner(s.lines.join("\n"))}</div></div>`;
    }).join("");
    return { html: `<div class="doc-compare">${cols}</div>`, nextIndex };
  }

  // :::figure
  if (/^:::figure\b/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const joined = body.join("\n");
    const img = joined.match(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/);
    const caption = body.find((l) => l.trim() && !l.includes("![")) || img?.[3] || "";
    if (img) {
      const src = resolveUrl(img[2]);
      return {
        html: `<figure class="doc-figure"><a class="doc-figure-zoom" href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="${escapeHtml(img[1])}" loading="lazy"/></a>${caption ? `<figcaption>${escapeHtml(caption.trim())}</figcaption>` : ""}</figure>`,
        nextIndex,
      };
    }
    return { html: `<figure class="doc-figure">${renderInner(joined)}</figure>`, nextIndex };
  }

  // :::download url label
  if (/^:::download\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::download\s*/i, "").trim();
    const m = rest.match(/^(\S+)\s+(.+)$/) || [null, rest, "Download"];
    const url = resolveUrl(m[1] || "#");
    const label = m[2] || "Download";
    const { nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<a class="doc-download" href="${escapeHtml(url)}" download><span class="doc-download-icon">↓</span><span>${escapeHtml(label)}</span></a>`,
      nextIndex,
    };
  }

  // :::embed youtube id  OR  :::embed vimeo id
  if (/^:::embed\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::embed\s*/i, "").trim();
    const parts = rest.split(/\s+/);
    const kind = (parts[0] || "").toLowerCase();
    const id = (parts[1] || "").replace(/[^\w-]/g, "");
    const { nextIndex } = collectUntilClose(lines, i + 1);
    let src = "";
    if (kind === "youtube" && id) src = `https://www.youtube-nocookie.com/embed/${id}`;
    if (kind === "vimeo" && id) src = `https://player.vimeo.com/video/${id}`;
    if (!src) {
      return { html: `<p class="doc-embed-error">Unsupported embed</p>`, nextIndex };
    }
    return {
      html: `<div class="doc-embed"><iframe src="${src}" title="Embedded ${escapeHtml(kind)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`,
      nextIndex,
    };
  }

  // :::nav prev=slug next=slug  or  :::nav prev="Title|url" next="Title|url"
  if (/^:::nav\b/i.test(trimmed)) {
    const attrs = parseAttrs(trimmed.replace(/^:::nav\s*/i, ""));
    const { nextIndex } = collectUntilClose(lines, i + 1);
    const parseLink = (v) => {
      if (!v || v === true) return null;
      if (v.includes("|")) {
        const [label, url] = v.split("|");
        return { label: label.trim(), url: resolveUrl(url.trim()) };
      }
      return { label: v, url: resolveUrl(v.startsWith("/") ? v : `/docs/${v}`) };
    };
    const prev = parseLink(attrs.prev);
    const next = parseLink(attrs.next);
    return {
      html: `<nav class="doc-page-nav">${prev ? `<a class="doc-page-nav-prev" href="${escapeHtml(prev.url)}"><span class="doc-page-nav-dir">← Previous</span><span class="doc-page-nav-title">${escapeHtml(prev.label)}</span></a>` : `<span></span>`}${next ? `<a class="doc-page-nav-next" href="${escapeHtml(next.url)}"><span class="doc-page-nav-dir">Next →</span><span class="doc-page-nav-title">${escapeHtml(next.label)}</span></a>` : ""}</nav>`,
      nextIndex,
    };
  }

  // :::breadcrumb A > B > C
  if (/^:::breadcrumb\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::breadcrumb\s*/i, "");
    const { nextIndex } = collectUntilClose(lines, i + 1);
    const crumbs = rest.split(/>|›|→/).map((x) => x.trim()).filter(Boolean);
    const html = crumbs
      .map((c, idx) => {
        const m = c.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) return `<a href="${escapeHtml(resolveUrl(m[2]))}">${escapeHtml(m[1])}</a>`;
        const last = idx === crumbs.length - 1;
        return last ? `<span aria-current="page">${escapeHtml(c)}</span>` : `<span>${escapeHtml(c)}</span>`;
      })
      .join(`<span class="doc-bc-sep">/</span>`);
    return { html: `<nav class="doc-breadcrumb" aria-label="Breadcrumb">${html}</nav>`, nextIndex };
  }

  // :::anchors h2
  if (/^:::anchors\b/i.test(trimmed)) {
    const level = trimmed.replace(/^:::anchors\s*/i, "").trim() || "h2";
    const { nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<nav class="doc-anchors" data-doc-anchors="${escapeHtml(level)}"><div class="doc-anchors-title">Jump to</div><div class="doc-anchors-list"></div></nav>`,
      nextIndex,
    };
  }

  // :::related
  if (/^:::related\s*$/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    const items = body
      .filter((l) => l.trim())
      .map((line) => {
        const m = line.match(/^\[([^\]]+)\]\(([^)]+)\)(?:\s+[—–-]\s*(.+))?$/);
        if (m) {
          return `<li><a href="${escapeHtml(resolveUrl(m[2]))}">${escapeHtml(m[1])}</a>${m[3] ? `<span class="doc-related-desc">${escapeHtml(m[3])}</span>` : ""}</li>`;
        }
        return `<li>${escapeHtml(line.trim())}</li>`;
      })
      .join("");
    return {
      html: `<aside class="doc-related"><div class="doc-related-title">Related</div><ul>${items}</ul></aside>`,
      nextIndex,
    };
  }

  // :::feedback
  if (/^:::feedback\b/i.test(trimmed)) {
    const { nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<div class="doc-feedback" data-doc-feedback><span class="doc-feedback-q">Was this page helpful?</span><button type="button" class="doc-feedback-btn" data-value="yes">Yes</button><button type="button" class="doc-feedback-btn" data-value="no">No</button><span class="doc-feedback-thanks" hidden>Thanks for the feedback.</span></div>`,
      nextIndex,
    };
  }

  // :::draft
  if (/^:::draft\b/i.test(trimmed)) {
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<aside class="doc-callout doc-callout-draft" dir="auto"><strong>Draft / WIP</strong>${body.length ? renderInner(body.join("\n")) : "<p>This page is a work in progress.</p>"}</aside>`,
      nextIndex,
    };
  }

  // :::i18n lang
  if (/^:::i18n\b/i.test(trimmed)) {
    const lang = trimmed.replace(/^:::i18n\s*/i, "").trim() || "en";
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<aside class="doc-i18n"><strong>Also available:</strong> ${escapeHtml(lang)}${body.length ? ` — ${renderInner(body.join("\n"))}` : ""}</aside>`,
      nextIndex,
    };
  }

  // :::author @name or name
  if (/^:::author\b/i.test(trimmed)) {
    const name = trimmed.replace(/^:::author\s*/i, "").trim() || "Author";
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<div class="doc-author"><div class="doc-author-avatar">${escapeHtml(name.replace(/^@/, "").slice(0, 1).toUpperCase())}</div><div class="doc-author-meta"><div class="doc-author-name">${escapeHtml(name)}</div>${body.length ? `<div class="doc-author-bio">${renderInner(body.join("\n"))}</div>` : ""}</div></div>`,
      nextIndex,
    };
  }

  // :::progress 70%
  if (/^:::progress\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^:::progress\s*/i, "").trim();
    const pct = Math.min(100, Math.max(0, parseInt(rest, 10) || 0));
    const { body, nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<div class="doc-progress"><div class="doc-progress-label">${body.length ? escapeHtml(body.join(" ").trim()) : `${pct}%`}</div><div class="doc-progress-track"><div class="doc-progress-bar" style="width:${pct}%"></div></div></div>`,
      nextIndex,
    };
  }

  // :::date 2026-12-01
  if (/^:::date\b/i.test(trimmed)) {
    const d = trimmed.replace(/^:::date\s*/i, "").trim();
    const { nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<time class="doc-date" datetime="${escapeHtml(d)}">${escapeHtml(d)}</time>`,
      nextIndex,
    };
  }

  // :::qr url
  if (/^:::qr\b/i.test(trimmed)) {
    const url = trimmed.replace(/^:::qr\s*/i, "").trim();
    const { nextIndex } = collectUntilClose(lines, i + 1);
    const safe = resolveUrl(url);
    // Use public QR API (no extra dep)
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(safe)}`;
    return {
      html: `<figure class="doc-qr"><img src="${escapeHtml(qrSrc)}" alt="QR code" width="160" height="160" loading="lazy"/><figcaption><a href="${escapeHtml(safe)}" target="_blank" rel="noopener">${escapeHtml(safe)}</a></figcaption></figure>`,
      nextIndex,
    };
  }

  // :::meta author=.. updated=.. tags=a,b  (frontmatter bar)
  if (/^:::meta\b/i.test(trimmed)) {
    const attrs = parseAttrs(trimmed.replace(/^:::meta\s*/i, ""));
    const { nextIndex } = collectUntilClose(lines, i + 1);
    const tags = (attrs.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => `<span class="doc-badge doc-badge-neutral">${escapeHtml(t)}</span>`)
      .join("");
    return {
      html: `<div class="doc-meta-bar">${attrs.author ? `<span>By ${escapeHtml(attrs.author)}</span>` : ""}${attrs.updated ? `<span>Updated ${escapeHtml(attrs.updated)}</span>` : ""}${attrs.reading ? `<span>${escapeHtml(attrs.reading)}</span>` : ""}${tags}</div>`,
      nextIndex,
    };
  }

  // :::reading-time (auto placeholder)
  if (/^:::reading-time\s*$/i.test(trimmed)) {
    const { nextIndex } = collectUntilClose(lines, i + 1);
    return {
      html: `<p class="doc-reading-time" data-doc-reading-time></p>`,
      nextIndex,
    };
  }

  // :::glossary or definition handled via definition lists in main parser

  return null;
}

/** Special fenced languages beyond html-render */
export function isSpecialFence(langLower) {
  return ["terminal", "console", "shell-session", "output", "diff", "mermaid", "math"].includes(langLower);
}

export function renderSpecialFence(langLower, raw, highlightCode) {
  if (langLower === "terminal" || langLower === "console" || langLower === "shell-session") {
    const lines = raw.split("\n").map((line) => {
      if (/^\s*[$#%>]/.test(line)) {
        return `<span class="doc-term-line"><span class="doc-term-prompt">${escapeHtml(line.match(/^\s*[$#%>]+/)[0])}</span>${escapeHtml(line.replace(/^\s*[$#%>]+\s?/, ""))}</span>`;
      }
      return `<span class="doc-term-line doc-term-out">${escapeHtml(line)}</span>`;
    }).join("\n");
    return (
      `<div class="doc-code doc-terminal" data-lang="terminal">` +
      `<div class="doc-code-head"><span class="doc-code-meta"><span class="doc-code-lang">terminal</span></span>` +
      `<button type="button" class="doc-copy-btn" aria-label="Copy"><span class="doc-copy-label">Copy</span></button></div>` +
      `<pre class="doc-terminal-pre">${lines}</pre></div>`
    );
  }
  if (langLower === "output") {
    return (
      `<div class="doc-output"><div class="doc-output-head">Output</div>` +
      `<pre class="doc-output-body">${escapeHtml(raw)}</pre></div>`
    );
  }
  if (langLower === "diff") {
    const { highlighted } = highlightCode(raw, "diff");
    return (
      `<div class="doc-code" data-lang="diff">` +
      `<div class="doc-code-head"><span class="doc-code-meta"><span class="doc-code-lang">diff</span></span>` +
      `<button type="button" class="doc-copy-btn"><span class="doc-copy-label">Copy</span></button></div>` +
      `<pre><code class="hljs language-diff">${highlighted}</code></pre></div>`
    );
  }
  if (langLower === "mermaid") {
    return (
      `<div class="doc-mermaid" data-mermaid>` +
      `<div class="doc-mermaid-head">Diagram</div>` +
      `<pre class="doc-mermaid-source">${escapeHtml(raw)}</pre>` +
      `<div class="doc-mermaid-render"></div></div>`
    );
  }
  if (langLower === "math") {
    return `<div class="doc-math-block" data-math="${escapeHtml(raw)}"><code>${escapeHtml(raw)}</code></div>`;
  }
  return null;
}

/** Post-process HTML: TOC, anchors, reading time */
export function postProcessHtml(html, plainTextForReading) {
  // Reading time
  const words = (plainTextForReading || "").trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  html = html.replace(
    /<p class="doc-reading-time"[^>]*><\/p>/g,
    `<p class="doc-reading-time">${mins} min read · ${words.toLocaleString()} words</p>`
  );

  // Build TOC from h2/h3
  const headings = [];
  html.replace(/<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, id, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    headings.push({ level: Number(level), id, text });
    return _;
  });
  if (headings.length) {
    const tocItems = headings
      .map((h) => `<a class="doc-toc-item doc-toc-h${h.level}" href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`)
      .join("");
    html = html.replace(
      /<div class="doc-toc-list"><\/div>/g,
      `<div class="doc-toc-list">${tocItems}</div>`
    );
    const h2 = headings.filter((h) => h.level === 2);
    const anchorItems = h2
      .map((h) => `<a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a>`)
      .join("");
    html = html.replace(
      /<div class="doc-anchors-list"><\/div>/g,
      `<div class="doc-anchors-list">${anchorItems}</div>`
    );
  }
  return html;
}

/** Definition list: lines "Term" followed by ": definition" */
export function tryDefinitionList(lines, i, inlineFn) {
  if (!lines[i].trim() || lines[i].startsWith(":") || lines[i].startsWith("#") || lines[i].startsWith("|") || lines[i].startsWith("```")) {
    return null;
  }
  // Look ahead for ": "
  if (!/^\s*:\s+/.test(lines[i + 1] || "")) return null;
  const items = [];
  let j = i;
  while (j < lines.length) {
    const term = lines[j]?.trim();
    const defLine = lines[j + 1];
    if (!term || !/^\s*:\s+/.test(defLine || "")) break;
    const defs = [defLine.replace(/^\s*:\s+/, "")];
    j += 2;
    while (j < lines.length && /^\s*:\s+/.test(lines[j])) {
      defs.push(lines[j].replace(/^\s*:\s+/, ""));
      j += 1;
    }
    items.push({ term, defs });
    // skip blank between pairs
    if (j < lines.length && !lines[j].trim()) j += 1;
  }
  if (!items.length) return null;
  const html = `<dl class="doc-dl">${items
    .map(
      (it) =>
        `<dt>${inlineFn(it.term)}</dt>${it.defs.map((d) => `<dd>${inlineFn(d)}</dd>`).join("")}`
    )
    .join("")}</dl>`;
  return { html, nextIndex: j };
}
