import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Typography, Stack, IconButton, Tooltip, Menu, MenuItem, ListItemIcon,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Chip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FormatIndentIncreaseIcon from "@mui/icons-material/FormatIndentIncrease";
import FormatIndentDecreaseIcon from "@mui/icons-material/FormatIndentDecrease";
import WrapTextIcon from "@mui/icons-material/WrapText";

const LANG_PRESETS = [
  "javascript", "typescript", "python", "java", "c", "cpp", "go", "rust",
  "sql", "html", "css", "json", "bash", "text", "tsx", "jsx", "yaml", "markdown",
];

const LANG_EXT = {
  javascript: "js", typescript: "ts", python: "py", java: "java", c: "c", cpp: "cpp",
  go: "go", rust: "rs", sql: "sql", html: "html", css: "css", json: "json",
  bash: "sh", text: "txt", tsx: "tsx", jsx: "jsx", yaml: "yml", markdown: "md",
};

const COMMENT_STYLE = {
  python: "#", bash: "#", yaml: "#", text: "#",
  html: null, // special
  default: "//",
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function lineStartAt(value, pos) {
  return value.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
}

function lineEndAt(value, pos) {
  const i = value.indexOf("\n", pos);
  return i === -1 ? value.length : i;
}

function currentLineRange(value, pos) {
  const start = lineStartAt(value, pos);
  const end = lineEndAt(value, pos);
  return { start, end, line: value.slice(start, end) };
}

function indentUnit(lang) {
  if (lang === "python" || lang === "yaml") return "    ";
  return "  ";
}

function leadingWs(line) {
  const m = line.match(/^[ \t]*/);
  return m ? m[0] : "";
}

function shouldIncreaseIndent(line, lang) {
  const t = line.replace(/\s+$/, "");
  if (!t) return false;
  if (/[{([]$/.test(t)) return true;
  if (lang === "python" && /:\s*$/.test(t)) return true;
  return false;
}

function shouldDecreaseOnLine(line) {
  const t = line.trimStart();
  return /^[}\])]/.test(t);
}

/** Serialize workspace files → markdown fences (```lang:name). */
export function filesToMarkdown(files) {
  const list = files || [];
  // Only attach :filename when there are multiple files (needed to tell them apart).
  // A single code block in the message body must stay as ```lang — never ```lang:main.js.
  const multi = list.length > 1;
  return list
    .map((f) => {
      const lang = String(f.lang || "text").replace(/[^\w+-]/g, "") || "text";
      const name = String(f.name || "").replace(/[:\n`]/g, "").trim();
      const head = multi && name ? `${lang}:${name}` : lang;
      return "```" + head + "\n" + (f.code || "") + "\n```";
    })
    .join("\n\n");
}

/** Parse ```lang or ```lang:filename fences into file entries. */
export function markdownToFiles(raw) {
  const s = raw || "";
  const files = [];
  const re = /```([\w+-]*)(?::([^\n`]*))?\n?([\s\S]*?)```/g;
  let m;
  let idx = 0;
  while ((m = re.exec(s)) !== null) {
    const lang = (m[1] || "text").trim() || "text";
    const name = (m[2] || "").trim() || defaultFileName(lang, idx);
    files.push({
      id: `f-${idx}-${m.index}`,
      lang,
      name,
      code: m[3].replace(/^\n/, "").replace(/\n$/, ""),
    });
    idx += 1;
  }
  return files;
}

function defaultFileName(lang, i) {
  const ext = LANG_EXT[lang] || "txt";
  return i === 0 ? `main.${ext}` : `file${i + 1}.${ext}`;
}

/**
 * Multi-file compose code workspace with VS Code-like shortcuts,
 * auto-indent, custom context menu, preview, and send-as-file.
 */
export default function ComposeCodeWorkspace({
  files: filesProp,
  onChangeFiles,
  onAttachFile,
  onRemoveAll,
}) {
  const [files, setFiles] = useState(() => (filesProp?.length ? filesProp : [{
    id: "f-0",
    lang: "javascript",
    name: "main.js",
    code: "",
  }]));
  const [activeId, setActiveId] = useState(() => files[0]?.id);
  const [hljsMod, setHljsMod] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const taRef = useRef(null);
  const preRef = useRef(null);
  const syncingRef = useRef(false);

  // Sync from parent when external text changes (and we're not the source)
  useEffect(() => {
    if (syncingRef.current) {
      syncingRef.current = false;
      return;
    }
    if (!filesProp) return;
    const same =
      filesProp.length === files.length &&
      filesProp.every((f, i) => f.lang === files[i]?.lang && f.name === files[i]?.name && f.code === files[i]?.code);
    if (!same && filesProp.length) {
      setFiles(filesProp.map((f, i) => ({
        id: f.id || `f-${i}`,
        lang: f.lang || "text",
        name: f.name || defaultFileName(f.lang || "text", i),
        code: f.code || "",
      })));
      if (!filesProp.find((f) => f.id === activeId)) {
        setActiveId(filesProp[0]?.id || `f-0`);
      }
    }
  }, [filesProp]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = useCallback((next) => {
    setFiles(next);
    syncingRef.current = true;
    onChangeFiles?.(next);
  }, [onChangeFiles]);

  const active = files.find((f) => f.id === activeId) || files[0];
  const lang = active?.lang || "text";
  const code = active?.code || "";
  const unit = indentUnit(lang);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("highlight.js");
        try { await import("highlight.js/styles/github-dark.css"); } catch { /* */ }
        if (!cancelled) setHljsMod(mod.default || mod);
      } catch {
        if (!cancelled) setHljsMod(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const highlighted = useMemo(() => {
    const raw = code || "";
    const hljs = hljsMod && hljsMod !== false ? hljsMod : null;
    try {
      if (hljs) {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value;
        }
        const auto = hljs.highlightAuto(raw);
        return auto.value;
      }
    } catch { /* */ }
    return escapeHtml(raw);
  }, [code, lang, hljsMod]);

  const updateActive = useCallback((patch) => {
    emit(files.map((f) => (f.id === active.id ? { ...f, ...patch } : f)));
  }, [files, active, emit]);

  const setCode = useCallback((nextCode) => {
    updateActive({ code: nextCode });
  }, [updateActive]);

  const getSel = () => {
    const ta = taRef.current;
    if (!ta) return { start: 0, end: 0 };
    return {
      start: ta.selectionStart ?? 0,
      end: ta.selectionEnd ?? 0,
    };
  };

  const setSel = (start, end = start) => {
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      try { ta.setSelectionRange(start, end); } catch { /* */ }
    });
  };

  const applyEdit = (next, selStart, selEnd) => {
    setCode(next);
    setSel(selStart, selEnd);
  };

  const copyText = async (str) => {
    try {
      await navigator.clipboard.writeText(str);
    } catch {
      const t = document.createElement("textarea");
      t.value = str;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      document.body.removeChild(t);
    }
  };

  const readClipboard = async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return "";
    }
  };

  /** Prefer clipboardData from paste event (works without extra permission). */
  const insertAtCursor = (text) => {
    if (!text) return;
    const { start, end } = getSel();
    const next = code.slice(0, start) + text + code.slice(end);
    applyEdit(next, start + text.length, start + text.length);
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData("text/plain");
    if (text == null) return; // let browser try if somehow unavailable
    e.preventDefault();
    e.stopPropagation();
    insertAtCursor(text);
  };

  const indentSelection = (outdent = false) => {
    const { start, end } = getSel();
    const value = code;
    const from = lineStartAt(value, start);
    const to = end > start && value[end - 1] === "\n" ? end - 1 : lineEndAt(value, end);
    const block = value.slice(from, to);
    const lines = block.split("\n");
    const nextLines = lines.map((line) => {
      if (outdent) {
        if (line.startsWith(unit)) return line.slice(unit.length);
        if (line.startsWith("\t")) return line.slice(1);
        if (line.startsWith("  ")) return line.slice(2);
        if (line.startsWith(" ")) return line.slice(1);
        return line;
      }
      return line.length ? unit + line : line;
    });
    const nextBlock = nextLines.join("\n");
    const next = value.slice(0, from) + nextBlock + value.slice(to);
    applyEdit(next, from, from + nextBlock.length);
  };

  const duplicateLine = () => {
    const { start, end } = getSel();
    const value = code;
    if (start !== end) {
      const selected = value.slice(start, end);
      const next = value.slice(0, end) + selected + value.slice(end);
      applyEdit(next, end, end + selected.length);
      return;
    }
    const { start: ls, end: le, line } = currentLineRange(value, start);
    const next = value.slice(0, le) + "\n" + line + value.slice(le);
    applyEdit(next, start + 1 + line.length, start + 1 + line.length);
  };

  const toggleComment = () => {
    const style = COMMENT_STYLE[lang] ?? COMMENT_STYLE.default;
    if (style == null) return;
    const { start, end } = getSel();
    const value = code;
    const from = lineStartAt(value, start);
    const to = end > start && value[end - 1] === "\n" ? end - 1 : lineEndAt(value, end);
    const block = value.slice(from, to);
    const lines = block.split("\n");
    const allCommented = lines.every((l) => !l.trim() || l.trimStart().startsWith(style));
    const nextLines = lines.map((line) => {
      if (!line.trim()) return line;
      const ws = leadingWs(line);
      const rest = line.slice(ws.length);
      if (allCommented) {
        if (rest.startsWith(style + " ")) return ws + rest.slice(style.length + 1);
        if (rest.startsWith(style)) return ws + rest.slice(style.length);
        return line;
      }
      return ws + style + " " + rest;
    });
    const nextBlock = nextLines.join("\n");
    applyEdit(value.slice(0, from) + nextBlock + value.slice(to), from, from + nextBlock.length);
  };

  const copyLineOrSelection = async () => {
    const { start, end } = getSel();
    if (start !== end) {
      await copyText(code.slice(start, end));
      return;
    }
    const { line } = currentLineRange(code, start);
    await copyText(line + "\n");
  };

  const cutLineOrSelection = async () => {
    const { start, end } = getSel();
    const value = code;
    if (start !== end) {
      await copyText(value.slice(start, end));
      applyEdit(value.slice(0, start) + value.slice(end), start, start);
      return;
    }
    const { start: ls, end: le, line } = currentLineRange(value, start);
    let cutEnd = le;
    let cutStart = ls;
    // include trailing newline if present
    if (value[le] === "\n") cutEnd = le + 1;
    else if (ls > 0 && value[ls - 1] === "\n") cutStart = ls - 1;
    await copyText(line + "\n");
    applyEdit(value.slice(0, cutStart) + value.slice(cutEnd), cutStart, cutStart);
  };

  const pasteAtCursor = async () => {
    // Used by context menu / toolbar. Clipboard API may need permission;
    // keyboard paste goes through onPaste which is more reliable.
    const clip = await readClipboard();
    insertAtCursor(clip);
  };

  const handleKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;

    // Tab / Shift+Tab
    if (key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      const { start, end } = getSel();
      if (start !== end || e.shiftKey) {
        indentSelection(e.shiftKey);
        return;
      }
      const value = code;
      const next = value.slice(0, start) + unit + value.slice(end);
      applyEdit(next, start + unit.length, start + unit.length);
      return;
    }

    // Enter with auto-indent
    if (key === "Enter" && !mod) {
      e.preventDefault();
      e.stopPropagation();
      const { start, end } = getSel();
      const value = code;
      const { line } = currentLineRange(value, start);
      let ws = leadingWs(line);
      if (shouldIncreaseIndent(line.slice(0, start - lineStartAt(value, start)), lang)) {
        // use full line before cursor for brace check
      }
      const before = value.slice(lineStartAt(value, start), start);
      if (shouldIncreaseIndent(before, lang)) {
        ws += unit;
      }
      // If next char is closing brace, place it on its own line
      const afterChar = value[end];
      let insert = "\n" + ws;
      let cursor = start + insert.length;
      if (afterChar && /[}\])]/.test(afterChar) && shouldIncreaseIndent(before, lang)) {
        const closerIndent = leadingWs(line);
        insert = "\n" + ws + "\n" + closerIndent;
        cursor = start + 1 + ws.length;
      }
      const next = value.slice(0, start) + insert + value.slice(end);
      applyEdit(next, cursor, cursor);
      return;
    }

    if (mod && !e.altKey) {
      const k = key.toLowerCase();
      if (k === "c") {
        e.preventDefault();
        e.stopPropagation();
        copyLineOrSelection();
        return;
      }
      if (k === "x") {
        e.preventDefault();
        e.stopPropagation();
        cutLineOrSelection();
        return;
      }
      if (k === "v") {
        // Do NOT preventDefault — let the native paste event fire.
        // handlePaste reads e.clipboardData (works for external clipboard
        // without Clipboard API permission). Context-menu paste still uses
        // pasteAtCursor() which goes through navigator.clipboard.
        return;
      }
      if (k === "d") {
        e.preventDefault();
        e.stopPropagation();
        duplicateLine();
        return;
      }
      if (k === "/" || (k === "slash")) {
        e.preventDefault();
        e.stopPropagation();
        toggleComment();
        return;
      }
      if (key === "]" || key === "}") {
        e.preventDefault();
        indentSelection(false);
        return;
      }
      if (key === "[" || key === "{") {
        e.preventDefault();
        indentSelection(true);
        return;
      }
    }
  };

  const onContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ mouseX: e.clientX, mouseY: e.clientY });
  };

  const syncScroll = () => {
    const ta = taRef.current;
    const pre = preRef.current;
    if (ta && pre) {
      pre.scrollTop = ta.scrollTop;
      pre.scrollLeft = ta.scrollLeft;
    }
  };

  const addFile = () => {
    const i = files.length;
    const id = `f-${Date.now()}`;
    const next = [...files, { id, lang: "javascript", name: defaultFileName("javascript", i), code: "" }];
    emit(next);
    setActiveId(id);
  };

  const closeFile = (id) => {
    if (files.length <= 1) {
      onRemoveAll?.();
      return;
    }
    const next = files.filter((f) => f.id !== id);
    emit(next);
    if (activeId === id) setActiveId(next[0].id);
  };

  const sendAsFile = () => {
    if (!active || !onAttachFile) return;
    const ext = LANG_EXT[active.lang] || "txt";
    const name = active.name || defaultFileName(active.lang, 0);
    const finalName = name.includes(".") ? name : `${name}.${ext}`;
    const blob = new Blob([active.code || ""], { type: "text/plain;charset=utf-8" });
    const file = new File([blob], finalName, { type: "text/plain" });
    onAttachFile(file);
  };

  const lineCount = Math.max(1, (code || "").split("\n").length);

  return (
    <Box
      sx={{
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#0d1117",
        boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
      }}
    >
      {/* File tabs */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.25,
          px: 0.75,
          pt: 0.6,
          bgcolor: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          overflowX: "auto",
        }}
      >
        {files.map((f) => {
          const selected = f.id === active?.id;
          return (
            <Box
              key={f.id}
              onClick={() => setActiveId(f.id)}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                px: 1,
                py: 0.55,
                borderRadius: "6px 6px 0 0",
                cursor: "pointer",
                bgcolor: selected ? "rgba(255,255,255,0.08)" : "transparent",
                border: "1px solid",
                borderColor: selected ? "rgba(255,255,255,0.12)" : "transparent",
                borderBottom: selected ? "1px solid #0d1117" : "1px solid transparent",
                mb: selected ? "-1px" : 0,
                maxWidth: 140,
              }}
            >
              <Typography noWrap sx={{ fontSize: 11.5, color: selected ? "#e6edf3" : "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                {f.name}
              </Typography>
              <Box
                component="span"
                onClick={(e) => { e.stopPropagation(); closeFile(f.id); }}
                sx={{
                  fontSize: 14,
                  lineHeight: 1,
                  color: "rgba(255,255,255,0.35)",
                  "&:hover": { color: "#ff7b72" },
                }}
              >
                ×
              </Box>
            </Box>
          );
        })}
        <Tooltip title="New file">
          <IconButton size="small" onClick={addFile} sx={{ color: "rgba(255,255,255,0.55)", ml: 0.25 }}>
            <AddIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Preview">
          <IconButton size="small" onClick={() => setPreviewOpen(true)} sx={{ color: "rgba(255,255,255,0.55)" }}>
            <VisibilityIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Send as file">
          <IconButton size="small" onClick={sendAsFile} sx={{ color: "rgba(255,255,255,0.55)" }}>
            <AttachFileIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        {onRemoveAll && (
          <Tooltip title="Close editor">
            <IconButton size="small" onClick={onRemoveAll} sx={{ color: "rgba(255,255,255,0.45)" }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Toolbar: language + filename */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1,
          py: 0.6,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexWrap: "wrap",
        }}
      >
        <Box
          component="input"
          value={active?.name || ""}
          onChange={(e) => updateActive({ name: e.target.value.replace(/[:\n`]/g, "") })}
          placeholder="filename"
          sx={{
            width: 130,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "4px",
            bgcolor: "rgba(0,0,0,0.35)",
            color: "#e6edf3",
            fontSize: 12,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            px: 0.85,
            py: 0.4,
            outline: "none",
          }}
        />
        <Box
          component="input"
          value={lang}
          onChange={(e) => {
            const l = e.target.value.replace(/[^\w+-]/g, "").slice(0, 24);
            const ext = LANG_EXT[l];
            const patch = { lang: l };
            if (ext && active?.name?.includes(".")) {
              patch.name = active.name.replace(/\.[^.]+$/, `.${ext}`);
            }
            updateActive(patch);
          }}
          placeholder="language"
          sx={{
            width: 100,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "4px",
            bgcolor: "rgba(0,0,0,0.35)",
            color: "#e6edf3",
            fontSize: 12,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            px: 0.85,
            py: 0.4,
            outline: "none",
          }}
        />
        <Stack direction="row" spacing={0.4} sx={{ flexWrap: "wrap" }}>
          {LANG_PRESETS.slice(0, 10).map((l) => (
            <Chip
              key={l}
              label={l}
              size="small"
              onClick={() => {
                const ext = LANG_EXT[l];
                const patch = { lang: l };
                if (ext) patch.name = (active?.name || "main").replace(/\.[^.]+$/, "") + `.${ext}`;
                updateActive(patch);
              }}
              sx={{
                height: 22,
                fontSize: 10.5,
                bgcolor: lang === l ? "rgba(88,166,255,0.25)" : "rgba(255,255,255,0.06)",
                color: lang === l ? "#79c0ff" : "rgba(255,255,255,0.55)",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Editor surface */}
      <Box sx={{ display: "flex", minHeight: 180, maxHeight: 360 }} onContextMenu={onContextMenu}>
        <Box
          aria-hidden
          sx={{
            py: 1.25,
            pl: 1,
            pr: 1,
            textAlign: "right",
            userSelect: "none",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.28)",
            bgcolor: "rgba(255,255,255,0.03)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            minWidth: 36,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <Box key={i} component="div">{i + 1}</Box>
          ))}
        </Box>

        <Box sx={{ position: "relative", flex: 1, minWidth: 0 }}>
          <Box
            ref={preRef}
            component="pre"
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              m: 0,
              p: 1.25,
              overflow: "auto",
              pointerEvents: "none",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: "pre",
              tabSize: 2,
              color: "#e6edf3",
              "& code": { fontFamily: "inherit", background: "none", p: 0 },
              "& .hljs-comment, & .hljs-quote": { color: "#8b949e", fontStyle: "italic" },
              "& .hljs-keyword, & .hljs-selector-tag": { color: "#ff7b72" },
              "& .hljs-string, & .hljs-attr": { color: "#a5d6ff" },
              "& .hljs-number, & .hljs-literal": { color: "#79c0ff" },
              "& .hljs-title, & .hljs-section": { color: "#d2a8ff" },
              "& .hljs-built_in, & .hljs-type": { color: "#ffa657" },
            }}
            dangerouslySetInnerHTML={{ __html: highlighted + ((code || "").endsWith("\n") ? "\n" : "") }}
          />
          <Box
            component="textarea"
            ref={taRef}
            value={code}
            spellCheck={false}
            onScroll={syncScroll}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={"// Tab indent · Ctrl+C/X line · Ctrl+D duplicate · Ctrl+/ comment\n"}
            sx={{
              position: "relative",
              zIndex: 1,
              display: "block",
              width: "100%",
              height: "100%",
              minHeight: 180,
              maxHeight: 360,
              m: 0,
              p: 1.25,
              border: "none",
              outline: "none",
              resize: "vertical",
              overflow: "auto",
              bgcolor: "transparent",
              color: "transparent",
              caretColor: "#e6edf3",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 12.5,
              lineHeight: 1.55,
              whiteSpace: "pre",
              tabSize: 2,
              boxSizing: "border-box",
            }}
          />
        </Box>
      </Box>

      {/* Hint bar */}
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 1.25,
          py: 0.45,
          color: "rgba(255,255,255,0.35)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10.5,
        }}
      >
        Tab indent · Ctrl+C/X line · Ctrl+D duplicate · Ctrl+/ comment · Ctrl+[/] indent · right-click menu · Preview / Send as file
      </Typography>

      {/* Custom context menu */}
      <Menu
        open={Boolean(ctxMenu)}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.mouseY, left: ctxMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { minWidth: 200, bgcolor: "#161b22", color: "#e6edf3" } } }}
      >
        <MenuItem onClick={() => { cutLineOrSelection(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><ContentCutIcon fontSize="small" /></ListItemIcon>
          Cut line / selection
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.5 }}>Ctrl+X</Typography>
        </MenuItem>
        <MenuItem onClick={() => { copyLineOrSelection(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><ContentCopyIcon fontSize="small" /></ListItemIcon>
          Copy line / selection
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.5 }}>Ctrl+C</Typography>
        </MenuItem>
        <MenuItem onClick={() => { pasteAtCursor(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><ContentPasteIcon fontSize="small" /></ListItemIcon>
          Paste
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.5 }}>Ctrl+V</Typography>
        </MenuItem>
        <MenuItem onClick={() => { duplicateLine(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><WrapTextIcon fontSize="small" /></ListItemIcon>
          Duplicate line
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.5 }}>Ctrl+D</Typography>
        </MenuItem>
        <MenuItem onClick={() => { toggleComment(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><Typography sx={{ fontSize: 14, width: 20, textAlign: "center" }}>/</Typography></ListItemIcon>
          Toggle comment
          <Typography variant="caption" sx={{ ml: "auto", pl: 2, opacity: 0.5 }}>Ctrl+/</Typography>
        </MenuItem>
        <MenuItem onClick={() => { indentSelection(false); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><FormatIndentIncreaseIcon fontSize="small" /></ListItemIcon>
          Indent
        </MenuItem>
        <MenuItem onClick={() => { indentSelection(true); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><FormatIndentDecreaseIcon fontSize="small" /></ListItemIcon>
          Outdent
        </MenuItem>
        <MenuItem onClick={() => { setPreviewOpen(true); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><VisibilityIcon fontSize="small" /></ListItemIcon>
          Preview
        </MenuItem>
        <MenuItem onClick={() => { sendAsFile(); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><AttachFileIcon fontSize="small" /></ListItemIcon>
          Send as file
        </MenuItem>
        <MenuItem onClick={() => { closeFile(active?.id); setCtxMenu(null); }}>
          <ListItemIcon sx={{ color: "inherit" }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          Close file
        </MenuItem>
      </Menu>

      {/* Full preview dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          Preview — {active?.name || "code"}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setPreviewOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: "#0d1117", p: 0 }}>
          <Stack direction="row" spacing={0.5} sx={{ px: 1, pt: 1, overflowX: "auto" }}>
            {files.map((f) => (
              <Chip
                key={f.id}
                label={f.name}
                size="small"
                onClick={() => setActiveId(f.id)}
                sx={{
                  bgcolor: f.id === active?.id ? "primary.main" : "rgba(255,255,255,0.08)",
                  color: f.id === active?.id ? "#fff" : "rgba(255,255,255,0.7)",
                }}
              />
            ))}
          </Stack>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              overflow: "auto",
              maxHeight: "60vh",
              fontFamily: "ui-monospace, Menlo, Consolas, monospace",
              fontSize: 13,
              lineHeight: 1.55,
              color: "#e6edf3",
              whiteSpace: "pre",
              "& .hljs-comment": { color: "#8b949e" },
              "& .hljs-keyword": { color: "#ff7b72" },
              "& .hljs-string": { color: "#a5d6ff" },
              "& .hljs-number": { color: "#79c0ff" },
              "& .hljs-title": { color: "#d2a8ff" },
            }}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={sendAsFile} startIcon={<AttachFileIcon />}>Send as file</Button>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/** Quote editor kept simple but larger. */
export function ComposeQuoteEditor({ text: quoteText, onChange, onRemove }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"),
      }}
    >
      <Box sx={{ width: 4, bgcolor: "primary.main", flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0, p: 1.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>Quote</Typography>
          {onRemove && (
            <Box
              component="button"
              type="button"
              onClick={onRemove}
              sx={{ border: "none", bgcolor: "transparent", cursor: "pointer", color: "text.secondary", fontSize: 16, "&:hover": { color: "error.main" } }}
            >
              ×
            </Box>
          )}
        </Box>
        <Box
          component="textarea"
          value={quoteText}
          onChange={(e) => onChange?.(e.target.value)}
          rows={Math.min(10, Math.max(4, (quoteText || "").split("\n").length + 1))}
          placeholder="Quote text…"
          sx={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "vertical",
            bgcolor: "transparent",
            fontStyle: "italic",
            fontSize: 14,
            lineHeight: 1.5,
            color: "text.secondary",
            fontFamily: "inherit",
            p: 0,
            minHeight: 88,
          }}
        />
      </Box>
    </Box>
  );
}
