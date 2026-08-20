/**
 * Shared syntax highlighting for compose editor + chat message code blocks.
 * Singleton load of highlight.js so every bubble does not re-import the package.
 */

const HLJS_ID_MAP = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  yml: "yaml",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  kt: "kotlin",
  md: "markdown",
  ps1: "powershell",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  plaintext: "plaintext",
  text: "plaintext",
  txt: "plaintext",
};

export const LANG_LABELS = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  java: "Java",
  kotlin: "Kotlin",
  csharp: "C#",
  cpp: "C++",
  c: "C",
  php: "PHP",
  swift: "Swift",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  scss: "SCSS",
  json: "JSON",
  yaml: "YAML",
  xml: "XML",
  bash: "Bash",
  shell: "Shell",
  powershell: "PowerShell",
  dockerfile: "Dockerfile",
  markdown: "Markdown",
  jsx: "JSX",
  tsx: "TSX",
  plaintext: "Text",
  text: "Text",
};

/** MUI sx token colors (GitHub-dark inspired) — works without external CSS. */
export const HLJS_TOKEN_SX = {
  "& .hljs-comment, & .hljs-quote": { color: "#8b949e", fontStyle: "italic" },
  "& .hljs-keyword, & .hljs-selector-tag, & .hljs-doctag": { color: "#ff7b72" },
  "& .hljs-string, & .hljs-attr, & .hljs-attribute, & .hljs-template-tag": { color: "#a5d6ff" },
  "& .hljs-number, & .hljs-literal, & .hljs-symbol": { color: "#79c0ff" },
  "& .hljs-title, & .hljs-section, & .hljs-title.function_": { color: "#d2a8ff" },
  "& .hljs-built_in, & .hljs-type, & .hljs-class .hljs-title": { color: "#ffa657" },
  "& .hljs-meta, & .hljs-meta .hljs-keyword": { color: "#79c0ff" },
  "& .hljs-variable, & .hljs-template-variable, & .hljs-params": { color: "#ffa198" },
  "& .hljs-regexp, & .hljs-link": { color: "#7ee787" },
  "& .hljs-subst": { color: "#e6edf3" },
  "& .hljs-name, & .hljs-tag": { color: "#7ee787" },
  "& .hljs-bullet, & .hljs-selector-id, & .hljs-selector-class": { color: "#d2a8ff" },
  "& .hljs-addition": { color: "#aff5b4", background: "rgba(46,160,67,0.15)" },
  "& .hljs-deletion": { color: "#ffdcd7", background: "rgba(248,81,73,0.15)" },
  "& .hljs-emphasis": { fontStyle: "italic" },
  "& .hljs-strong": { fontWeight: 700 },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Map user/lang alias → highlight.js language id. */
export function resolveHljsLang(lang) {
  const raw = String(lang || "").toLowerCase().trim().replace(/^\./, "");
  if (!raw) return "";
  return HLJS_ID_MAP[raw] || raw;
}

export function langLabel(lang) {
  const id = resolveHljsLang(lang) || String(lang || "").toLowerCase();
  if (LANG_LABELS[id]) return LANG_LABELS[id];
  if (LANG_LABELS[lang]) return LANG_LABELS[lang];
  if (!id) return "Code";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

let _hljsPromise = null;
let _hljs = null;

/**
 * Load highlight.js once. Resolves to the hljs API or null on failure.
 */
export function loadHljs() {
  if (_hljs) return Promise.resolve(_hljs);
  if (_hljsPromise) return _hljsPromise;
  _hljsPromise = (async () => {
    try {
      const mod = await import("highlight.js");
      const hljs = mod.default || mod;
      if (!hljs || typeof hljs.highlight !== "function") {
        _hljs = null;
        return null;
      }
      _hljs = hljs;
      return hljs;
    } catch (e) {
      console.warn("[codeHighlight] highlight.js failed to load", e);
      _hljs = null;
      return null;
    }
  })();
  return _hljsPromise;
}

/**
 * @returns {{ html: string, language: string, label: string, raw: string }}
 */
export function highlightCode(code, lang) {
  const raw = String(code ?? "").replace(/\n$/, "");
  const requested = resolveHljsLang(lang);
  const escapeOnly = () => ({
    html: escapeHtml(raw),
    language: requested || "",
    label: langLabel(requested || lang),
    raw,
  });

  const hljs = _hljs;
  if (!hljs) return escapeOnly();

  try {
    if (requested && hljs.getLanguage(requested)) {
      const result = hljs.highlight(raw, { language: requested, ignoreIllegals: true });
      return {
        html: result.value || escapeHtml(raw),
        language: requested,
        label: langLabel(requested),
        raw,
      };
    }
    // Try original token if different from resolved
    const orig = String(lang || "").toLowerCase().trim();
    if (orig && orig !== requested && hljs.getLanguage(orig)) {
      const result = hljs.highlight(raw, { language: orig, ignoreIllegals: true });
      return {
        html: result.value || escapeHtml(raw),
        language: orig,
        label: langLabel(orig),
        raw,
      };
    }
    if (raw.trim()) {
      const auto = hljs.highlightAuto(raw);
      const detected = auto.language || requested || "";
      return {
        html: auto.value || escapeHtml(raw),
        language: detected,
        label: langLabel(detected || lang),
        raw,
      };
    }
  } catch {
    /* fall through */
  }
  return escapeOnly();
}

/**
 * Parse fence header: "javascript", "js:app.jsx", "python"
 */
export function parseFenceHeader(header) {
  const h = String(header || "").trim();
  if (!h) return { lang: "", name: "" };
  const colon = h.indexOf(":");
  if (colon > 0) {
    return {
      lang: h.slice(0, colon).trim().toLowerCase(),
      name: h.slice(colon + 1).trim(),
    };
  }
  return { lang: h.toLowerCase(), name: "" };
}
