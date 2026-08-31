import React from "react";
import { GlobalStyles, useTheme, alpha } from "@mui/material";

/**
 * Modern Docs-as-Code styles:
 * - Hard edges (near-zero radius)
 * - Subtle edge lighting / inset highlights
 * - Polished code blocks with language chip + copy
 * - Full article typography + callouts + tables + media
 * - Safe live-HTML blocks (.doc-html)
 */
export default function DocsStyles() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const surface = isDark ? "#0b0f17" : "#f8fafc";
  const surfaceRaised = isDark ? "#111827" : "#ffffff";
  const codeBg = isDark ? "#070b12" : "#0f172a";
  const codeFg = isDark ? "#e2e8f0" : "#e2e8f0";
  const border = isDark ? "rgba(148,163,184,0.16)" : "rgba(15,23,42,0.12)";
  const edgeLight = isDark
    ? "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.03)"
    : "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 0 0 1px rgba(15,23,42,0.04)";
  const glow = isDark
    ? `0 0 0 1px ${border}, 0 12px 40px rgba(0,0,0,0.45)`
    : `0 0 0 1px ${border}, 0 10px 28px rgba(15,23,42,0.08)`;
  const accent = theme.palette.primary.main;
  const muted = isDark ? "rgba(226,232,240,0.55)" : "rgba(15,23,42,0.55)";
  const text = theme.palette.text.primary;
  const textSec = theme.palette.text.secondary;

  return (
    <GlobalStyles
      styles={{
        /* ── Root preview surface ─────────────────────────────── */
        ".docs-markdown-preview, .docs-article, .docs-preview-surface": {
          color: text,
          fontSize: "1.02rem",
          lineHeight: 1.75,
          letterSpacing: "-0.011em",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          wordBreak: "break-word",
        },

        /* ── Typography ───────────────────────────────────────── */
        ".docs-markdown-preview h1, .docs-article h1": {
          fontSize: "clamp(1.85rem, 2.6vw, 2.35rem)",
          fontWeight: 850,
          letterSpacing: "-0.035em",
          lineHeight: 1.15,
          margin: "2.1em 0 0.55em",
          paddingBottom: "0.35em",
          borderBottom: `1px solid ${border}`,
          position: "relative",
        },
        ".docs-markdown-preview h2, .docs-article h2": {
          fontSize: "clamp(1.4rem, 2vw, 1.7rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.2,
          margin: "1.85em 0 0.5em",
          paddingBottom: "0.3em",
          borderBottom: `1px solid ${border}`,
        },
        ".docs-markdown-preview h3, .docs-article h3": {
          fontSize: "1.25rem",
          fontWeight: 750,
          letterSpacing: "-0.02em",
          margin: "1.55em 0 0.4em",
        },
        ".docs-markdown-preview h4, .docs-article h4": {
          fontSize: "1.08rem",
          fontWeight: 700,
          margin: "1.35em 0 0.35em",
        },
        ".docs-markdown-preview h5, .docs-markdown-preview h6, .docs-article h5, .docs-article h6": {
          fontSize: "0.98rem",
          fontWeight: 700,
          margin: "1.2em 0 0.3em",
          color: textSec,
        },
        ".docs-markdown-preview p, .docs-article p": {
          margin: "0 0 1.05em",
          color: text,
        },
        ".docs-markdown-preview strong, .docs-article strong": {
          fontWeight: 750,
        },
        ".docs-markdown-preview a, .docs-article a": {
          color: accent,
          textDecoration: "none",
          borderBottom: `1px solid ${alpha(accent, 0.35)}`,
          transition: "border-color 120ms ease, color 120ms ease",
          "&:hover": {
            borderBottomColor: accent,
          },
        },
        ".docs-markdown-preview a.doc-anchor-link": {
          borderBottomStyle: "dashed",
        },
        ".docs-markdown-preview .doc-heading-anchor": {
          position: "absolute",
          left: "-1.1em",
          top: "0.15em",
          opacity: 0,
          color: muted,
          textDecoration: "none",
          border: "none",
          fontSize: "0.85em",
          transition: "opacity 120ms ease",
          "&::before": { content: '"#"', border: "none" },
        },
        ".docs-markdown-preview h1:hover .doc-heading-anchor, .docs-markdown-preview h2:hover .doc-heading-anchor, .docs-markdown-preview h3:hover .doc-heading-anchor":
          {
            opacity: 0.7,
          },
        ".docs-markdown-preview h1, .docs-markdown-preview h2, .docs-markdown-preview h3": {
          position: "relative",
        },

        /* ── Inline code ──────────────────────────────────────── */
        ".docs-markdown-preview code:not(.hljs), .docs-article code:not(.hljs)": {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: "0.875em",
          fontWeight: 550,
          padding: "0.12em 0.38em",
          borderRadius: 2,
          background: isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)",
          border: `1px solid ${border}`,
          boxShadow: edgeLight,
          color: isDark ? "#f0abfc" : "#a21caf",
        },

        /* ── Code blocks (hard edges + edge light) ────────────── */
        ".docs-markdown-preview .doc-code, .docs-article .doc-code": {
          position: "relative",
          margin: "1.35em 0 1.6em",
          borderRadius: 2,
          overflow: "hidden",
          background: codeBg,
          color: codeFg,
          border: `1px solid ${isDark ? "rgba(148,163,184,0.14)" : "rgba(15,23,42,0.55)"}`,
          boxShadow: `${glow}, ${edgeLight}`,
        },
        ".docs-markdown-preview .doc-code-head, .docs-article .doc-code-head": {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "8px 12px",
          background: isDark
            ? "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 100%)",
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        },
        ".docs-markdown-preview .doc-code-meta, .docs-article .doc-code-meta": {
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
        },
        ".docs-markdown-preview .doc-code-lang, .docs-article .doc-code-lang": {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: isDark ? "#94a3b8" : "#94a3b8",
          padding: "2px 8px",
          borderRadius: 2,
          background: "rgba(148,163,184,0.12)",
          border: "1px solid rgba(148,163,184,0.18)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        },
        ".docs-markdown-preview .doc-code-lines, .docs-article .doc-code-lines": {
          fontSize: 11,
          color: "rgba(148,163,184,0.65)",
          fontVariantNumeric: "tabular-nums",
        },
        ".docs-markdown-preview .doc-copy-btn, .docs-article .doc-copy-btn": {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          margin: 0,
          padding: "4px 10px",
          borderRadius: 2,
          border: "1px solid rgba(148,163,184,0.22)",
          background: "rgba(148,163,184,0.08)",
          color: "#cbd5e1",
          fontSize: 12,
          fontWeight: 650,
          cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
          "&:hover": {
            background: "rgba(148,163,184,0.16)",
            borderColor: "rgba(148,163,184,0.35)",
            color: "#f1f5f9",
          },
          "&.is-copied": {
            borderColor: alpha(theme.palette.success.main, 0.45),
            color: theme.palette.success.light,
            background: alpha(theme.palette.success.main, 0.12),
          },
          "&.is-copy-error": {
            borderColor: alpha(theme.palette.error.main, 0.45),
            color: theme.palette.error.light,
          },
          "&:disabled": { opacity: 0.7, cursor: "default" },
        },
        ".docs-markdown-preview .doc-copy-icon, .docs-article .doc-copy-icon": {
          display: "inline-flex",
          lineHeight: 0,
        },
        ".docs-markdown-preview .doc-code pre, .docs-article .doc-code pre": {
          margin: 0,
          padding: "14px 16px 16px",
          overflow: "auto",
          fontSize: 13.25,
          lineHeight: 1.7,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          background: "transparent",
          border: "none",
          boxShadow: "none",
        },
        ".docs-markdown-preview .doc-code code.hljs, .docs-article .doc-code code.hljs": {
          display: "block",
          padding: 0,
          background: "transparent",
          border: "none",
          boxShadow: "none",
          borderRadius: 0,
          color: codeFg,
          fontSize: "inherit",
          fontWeight: 400,
        },

        /* highlight.js token colors (neutral dark theme) */
        ".docs-markdown-preview .hljs-comment, .docs-markdown-preview .hljs-quote": {
          color: "#64748b",
          fontStyle: "italic",
        },
        ".docs-markdown-preview .hljs-keyword, .docs-markdown-preview .hljs-selector-tag, .docs-markdown-preview .hljs-literal":
          { color: "#c084fc" },
        ".docs-markdown-preview .hljs-string, .docs-markdown-preview .hljs-doctag, .docs-markdown-preview .hljs-template-variable":
          { color: "#86efac" },
        ".docs-markdown-preview .hljs-number, .docs-markdown-preview .hljs-regexp, .docs-markdown-preview .hljs-bullet":
          { color: "#fbbf24" },
        ".docs-markdown-preview .hljs-built_in, .docs-markdown-preview .hljs-type, .docs-markdown-preview .hljs-title.class_":
          { color: "#38bdf8" },
        ".docs-markdown-preview .hljs-function, .docs-markdown-preview .hljs-title.function_, .docs-markdown-preview .hljs-title":
          { color: "#60a5fa" },
        ".docs-markdown-preview .hljs-attr, .docs-markdown-preview .hljs-attribute, .docs-markdown-preview .hljs-variable":
          { color: "#f472b6" },
        ".docs-markdown-preview .hljs-meta, .docs-markdown-preview .hljs-meta .hljs-keyword": {
          color: "#94a3b8",
        },
        ".docs-markdown-preview .hljs-tag, .docs-markdown-preview .hljs-name": {
          color: "#f87171",
        },
        ".docs-markdown-preview .hljs-params, .docs-markdown-preview .hljs-property": {
          color: "#e2e8f0",
        },
        ".docs-markdown-preview .hljs-addition": { color: "#86efac" },
        ".docs-markdown-preview .hljs-deletion": { color: "#fca5a5" },

        /* ── Live HTML blocks ─────────────────────────────────── */
        ".docs-markdown-preview .doc-html, .docs-article .doc-html": {
          margin: "1.35em 0 1.6em",
          borderRadius: 2,
          overflow: "hidden",
          background: surfaceRaised,
          border: `1px solid ${border}`,
          boxShadow: `${glow}, ${edgeLight}`,
        },
        ".docs-markdown-preview .doc-html-head, .docs-article .doc-html-head": {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "7px 12px",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: muted,
          background: isDark
            ? "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)"
            : surface,
          borderBottom: `1px solid ${border}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        },
        ".docs-markdown-preview .doc-html-body, .docs-article .doc-html-body": {
          padding: "14px 16px",
          fontSize: "0.95rem",
          lineHeight: 1.65,
          "& > *:first-child": { marginTop: 0 },
          "& > *:last-child": { marginBottom: 0 },
        },

        /* ── Tables ───────────────────────────────────────────── */
        ".docs-markdown-preview .doc-table-wrap, .docs-article .doc-table-wrap": {
          margin: "1.25em 0 1.5em",
          overflowX: "auto",
          borderRadius: 2,
          border: `1px solid ${border}`,
          boxShadow: edgeLight,
          background: surfaceRaised,
        },
        ".docs-markdown-preview table, .docs-article table": {
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.94rem",
        },
        ".docs-markdown-preview th, .docs-article th": {
          textAlign: "left",
          fontWeight: 750,
          padding: "10px 14px",
          background: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)",
          borderBottom: `1px solid ${border}`,
          color: text,
        },
        ".docs-markdown-preview td, .docs-article td": {
          padding: "10px 14px",
          borderBottom: `1px solid ${border}`,
          color: textSec,
          verticalAlign: "top",
        },
        ".docs-markdown-preview tr:last-child td, .docs-article tr:last-child td": {
          borderBottom: "none",
        },

        /* ── Callouts ─────────────────────────────────────────── */
        ".docs-markdown-preview .doc-callout, .docs-article .doc-callout": {
          margin: "1.25em 0",
          padding: "12px 14px 12px 16px",
          borderRadius: 2,
          border: `1px solid ${border}`,
          borderLeftWidth: 3,
          boxShadow: edgeLight,
          background: surface,
          "& > strong": {
            display: "block",
            marginBottom: 6,
            fontSize: 12,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          },
          "& p": { marginBottom: "0.55em" },
          "& p:last-child": { marginBottom: 0 },
        },
        ".docs-markdown-preview .doc-callout-note": {
          borderLeftColor: theme.palette.info.main,
          background: alpha(theme.palette.info.main, isDark ? 0.08 : 0.06),
          "& > strong": { color: theme.palette.info.main },
        },
        ".docs-markdown-preview .doc-callout-tip": {
          borderLeftColor: theme.palette.success.main,
          background: alpha(theme.palette.success.main, isDark ? 0.08 : 0.06),
          "& > strong": { color: theme.palette.success.main },
        },
        ".docs-markdown-preview .doc-callout-warning": {
          borderLeftColor: theme.palette.warning.main,
          background: alpha(theme.palette.warning.main, isDark ? 0.1 : 0.08),
          "& > strong": { color: theme.palette.warning.main },
        },
        ".docs-markdown-preview .doc-callout-important": {
          borderLeftColor: theme.palette.info.main,
          background: alpha(theme.palette.info.main, isDark ? 0.14 : 0.1),
          "& > strong": { color: theme.palette.info.main },
        },
        ".docs-markdown-preview .doc-callout-danger": {
          borderLeftColor: theme.palette.error.main,
          background: alpha(theme.palette.error.main, isDark ? 0.1 : 0.07),
          "& > strong": { color: theme.palette.error.main },
        },

        /* ── Lists / quotes / hr ──────────────────────────────── */
        ".docs-markdown-preview ul, .docs-markdown-preview ol, .docs-article ul, .docs-article ol":
          {
            margin: "0 0 1.1em",
            paddingInlineStart: "1.45em",
          },
        ".docs-markdown-preview li, .docs-article li": {
          marginBottom: "0.35em",
          color: text,
        },
        ".docs-markdown-preview .doc-task": {
          marginRight: 8,
          verticalAlign: "middle",
        },
        ".docs-markdown-preview blockquote, .docs-article blockquote": {
          margin: "1.2em 0",
          padding: "4px 0 4px 14px",
          borderLeft: `3px solid ${accent}`,
          color: textSec,
          fontStyle: "italic",
          boxShadow: "inset 3px 0 0 transparent",
        },
        ".docs-markdown-preview hr, .docs-article hr": {
          border: "none",
          height: 1,
          margin: "2em 0",
          background: border,
          boxShadow: "0 1px 0 rgba(255,255,255,0.04)",
        },

        /* ── Media / files ────────────────────────────────────── */
        ".docs-markdown-preview .doc-image, .docs-markdown-preview .doc-media": {
          margin: "1.25em 0",
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${border}`,
          boxShadow: `${glow}, ${edgeLight}`,
          background: surface,
        },
        ".docs-markdown-preview .doc-image img, .docs-markdown-preview .doc-media video": {
          display: "block",
          width: "100%",
          maxHeight: 560,
          objectFit: "contain",
          background: isDark ? "#020617" : "#0f172a",
        },
        ".docs-markdown-preview .doc-media audio": {
          display: "block",
          width: "100%",
          padding: 8,
        },
        ".docs-markdown-preview figcaption": {
          padding: "8px 12px",
          fontSize: 12.5,
          color: muted,
          borderTop: `1px solid ${border}`,
          background: isDark ? "rgba(0,0,0,0.2)" : "rgba(15,23,42,0.03)",
        },
        ".docs-markdown-preview .doc-file-link": {
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 10px 4px 4px",
          borderRadius: 2,
          border: `1px solid ${border}`,
          background: surface,
          boxShadow: edgeLight,
          textDecoration: "none",
          color: text,
          fontSize: 13,
          fontWeight: 600,
          borderBottom: `1px solid ${border}`,
          "&:hover": {
            borderColor: alpha(accent, 0.45),
            color: accent,
          },
        },
        ".docs-markdown-preview .doc-file-badge": {
          display: "inline-grid",
          placeItems: "center",
          minWidth: 36,
          height: 22,
          padding: "0 6px",
          borderRadius: 2,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.04em",
          background: alpha(accent, 0.12),
          color: accent,
          border: `1px solid ${alpha(accent, 0.25)}`,
        },

        /* ── Preview surface (editor split) ───────────────────── */
                /* Extended components */
        ".docs-markdown-preview .doc-tabs": { margin: "1.25em 0 1.5em", borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, overflow: "hidden", background: surfaceRaised },
        ".docs-markdown-preview .doc-tabs-list": { display: "flex", flexWrap: "wrap", gap: 0, borderBottom: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.02)" : surface },
        ".docs-markdown-preview .doc-tab": { margin: 0, padding: "10px 14px", border: "none", borderBottom: "2px solid transparent", background: "transparent", color: muted, fontSize: 13, fontWeight: 650, cursor: "pointer", borderRadius: 0 },
        ".docs-markdown-preview .doc-tab.is-active": { color: accent, borderBottomColor: accent },
        ".docs-markdown-preview .doc-tab-panel": { display: "none", padding: "14px 16px" },
        ".docs-markdown-preview .doc-tab-panel.is-active": { display: "block" },
        ".docs-markdown-preview .doc-details, .docs-markdown-preview .doc-spoiler": { margin: "1.1em 0", borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, background: surface },
        ".docs-markdown-preview .doc-details-summary, .docs-markdown-preview .doc-spoiler-summary": { padding: "10px 14px", fontWeight: 700, cursor: "pointer", listStyle: "none" },
        ".docs-markdown-preview .doc-details-body, .docs-markdown-preview .doc-spoiler-body": { padding: "0 14px 14px", borderTop: `1px solid ${border}` },
        ".docs-markdown-preview .doc-steps": { listStyle: "none", margin: "1.25em 0", padding: 0 },
        ".docs-markdown-preview .doc-step": { display: "flex", gap: 14, marginBottom: 16, alignItems: "flex-start" },
        ".docs-markdown-preview .doc-step-num": { flexShrink: 0, width: 28, height: 28, borderRadius: 2, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 13, background: alpha(accent, 0.12), color: accent, border: `1px solid ${alpha(accent, 0.3)}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-step-title": { fontWeight: 750, marginBottom: 4 },
        ".docs-markdown-preview .doc-cards": { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, margin: "1.25em 0" },
        ".docs-markdown-preview .doc-card": { display: "block", padding: 14, borderRadius: 2, border: `1px solid ${border}`, background: surfaceRaised, boxShadow: edgeLight, textDecoration: "none", color: "inherit" },
        ".docs-markdown-preview a.doc-card:hover": { borderColor: alpha(accent, 0.5) },
        ".docs-markdown-preview .doc-card-title": { fontWeight: 800, marginBottom: 6 },
        ".docs-markdown-preview .doc-compare": { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, margin: "1.25em 0" },
        ".docs-markdown-preview .doc-compare-col": { borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, overflow: "hidden", background: surfaceRaised },
        ".docs-markdown-preview .doc-compare-label": { padding: "8px 12px", fontWeight: 800, fontSize: 13, borderBottom: `1px solid ${border}`, background: isDark ? "rgba(255,255,255,0.03)" : surface },
        ".docs-markdown-preview .doc-compare-body": { padding: "12px 14px" },
        ".docs-markdown-preview .doc-api": { margin: "1.25em 0", borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, overflow: "hidden", background: surfaceRaised },
        ".docs-markdown-preview .doc-api-head": { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: isDark ? "#070b12" : "#0f172a", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" },
        ".docs-markdown-preview .doc-api-method": { fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", padding: "3px 8px", borderRadius: 2, color: "#fff" },
        ".docs-markdown-preview .doc-api-method-get": { background: "#2563eb" },
        ".docs-markdown-preview .doc-api-method-post": { background: "#16a34a" },
        ".docs-markdown-preview .doc-api-method-put": { background: "#ca8a04" },
        ".docs-markdown-preview .doc-api-method-patch": { background: "#d97706" },
        ".docs-markdown-preview .doc-api-method-delete": { background: "#dc2626" },
        ".docs-markdown-preview .doc-api-path": { fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#e2e8f0", background: "transparent", border: "none", padding: 0 },
        ".docs-markdown-preview .doc-api-body": { padding: "12px 14px" },
        ".docs-markdown-preview .doc-tree": { margin: "1.1em 0", padding: "12px 14px", borderRadius: 2, border: `1px solid ${border}`, background: codeBg, color: codeFg, fontFamily: "ui-monospace, monospace", fontSize: 13, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-tree-row": { paddingLeft: "calc(var(--depth, 0) * 1.1em)", lineHeight: 1.7 },
        ".docs-markdown-preview .doc-terminal-pre": { margin: 0, padding: "14px 16px", fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.65, color: codeFg },
        ".docs-markdown-preview .doc-term-prompt": { color: "#4ade80", marginRight: 6 },
        ".docs-markdown-preview .doc-term-out": { color: "#94a3b8" },
        ".docs-markdown-preview .doc-output": { margin: "1.1em 0", borderRadius: 2, border: `1px solid ${border}`, overflow: "hidden", boxShadow: edgeLight },
        ".docs-markdown-preview .doc-output-head": { padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: muted, borderBottom: `1px solid ${border}`, background: surface },
        ".docs-markdown-preview .doc-output-body": { margin: 0, padding: "12px 14px", background: codeBg, color: codeFg, fontSize: 13, fontFamily: "ui-monospace, monospace" },
        ".docs-markdown-preview .doc-badge": { display: "inline-block", padding: "1px 8px", borderRadius: 2, fontSize: 11, fontWeight: 750, border: `1px solid ${border}`, boxShadow: edgeLight, verticalAlign: "middle" },
        ".docs-markdown-preview .doc-badge-success": { background: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.main, borderColor: alpha(theme.palette.success.main, 0.35) },
        ".docs-markdown-preview .doc-badge-warning": { background: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.main, borderColor: alpha(theme.palette.warning.main, 0.35) },
        ".docs-markdown-preview .doc-badge-danger": { background: alpha(theme.palette.error.main, 0.12), color: theme.palette.error.main, borderColor: alpha(theme.palette.error.main, 0.35) },
        ".docs-markdown-preview .doc-badge-info": { background: alpha(theme.palette.info.main, 0.12), color: theme.palette.info.main, borderColor: alpha(theme.palette.info.main, 0.35) },
        ".docs-markdown-preview .doc-badge-neutral": { background: isDark ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)", color: textSec },
        ".docs-markdown-preview .doc-kbd": { display: "inline-block", padding: "1px 6px", borderRadius: 2, fontSize: "0.85em", fontFamily: "ui-monospace, monospace", border: `1px solid ${border}`, background: surface, boxShadow: `0 1px 0 ${border}, ${edgeLight}` },
        ".docs-markdown-preview .doc-kbd-plus": { margin: "0 2px", opacity: 0.5 },
        ".docs-markdown-preview .doc-inline-copy": { display: "inline-flex", alignItems: "center", gap: 6, padding: "1px 6px", borderRadius: 2, border: `1px solid ${border}`, background: surface, cursor: "pointer", fontSize: 12, verticalAlign: "middle", boxShadow: edgeLight },
        ".docs-markdown-preview .doc-inline-copy code": { border: "none !important", background: "transparent !important", boxShadow: "none !important", padding: "0 !important" },
        ".docs-markdown-preview .doc-term": { borderBottom: `1px dashed ${alpha(accent, 0.5)}`, cursor: "help", textDecoration: "none" },
        ".docs-markdown-preview .doc-toc, .docs-markdown-preview .doc-anchors": { margin: "1.25em 0", padding: "12px 14px", borderRadius: 2, border: `1px solid ${border}`, background: surface, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-toc-title, .docs-markdown-preview .doc-anchors-title": { fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", color: muted, marginBottom: 8 },
        ".docs-markdown-preview .doc-toc-list, .docs-markdown-preview .doc-anchors-list": { display: "flex", flexDirection: "column", gap: 4 },
        ".docs-markdown-preview .doc-toc-item": { fontSize: 13, borderBottom: "none !important" },
        ".docs-markdown-preview .doc-toc-h3": { paddingLeft: 12, opacity: 0.85 },
        ".docs-markdown-preview .doc-breadcrumb": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontSize: 13, color: muted, marginBottom: 12 },
        ".docs-markdown-preview .doc-bc-sep": { opacity: 0.4 },
        ".docs-markdown-preview .doc-page-nav": { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "2em 0 1em" },
        ".docs-markdown-preview .doc-page-nav-prev, .docs-markdown-preview .doc-page-nav-next": { padding: 12, borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, textDecoration: "none", color: "inherit" },
        ".docs-markdown-preview .doc-page-nav-next": { textAlign: "right" },
        ".docs-markdown-preview .doc-page-nav-dir": { display: "block", fontSize: 11, color: muted, marginBottom: 4 },
        ".docs-markdown-preview .doc-page-nav-title": { fontWeight: 750 },
        ".docs-markdown-preview .doc-timeline": { listStyle: "none", margin: "1.25em 0", padding: "0 0 0 8px", borderLeft: `2px solid ${border}` },
        ".docs-markdown-preview .doc-timeline-item": { position: "relative", padding: "0 0 18px 18px" },
        ".docs-markdown-preview .doc-timeline-dot": { position: "absolute", left: -7, top: 4, width: 12, height: 12, borderRadius: 2, background: accent, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-timeline-title": { fontWeight: 750 },
        ".docs-markdown-preview .doc-timeline-item time": { display: "block", fontSize: 12, color: muted, marginBottom: 2 },
        ".docs-markdown-preview .doc-callout-deprecated": { borderLeftColor: theme.palette.warning.dark, background: alpha(theme.palette.warning.main, isDark ? 0.1 : 0.08) },
        ".docs-markdown-preview .doc-callout-security": { borderLeftColor: theme.palette.error.main, background: alpha(theme.palette.error.main, isDark ? 0.12 : 0.08) },
        ".docs-markdown-preview .doc-callout-best": { borderLeftColor: "#8b5cf6", background: alpha("#8b5cf6", isDark ? 0.12 : 0.08) },
        ".docs-markdown-preview .doc-callout-example": { borderLeftColor: theme.palette.success.main, background: alpha(theme.palette.success.main, isDark ? 0.08 : 0.06) },
        ".docs-markdown-preview .doc-callout-anti": { borderLeftColor: theme.palette.error.light, background: alpha(theme.palette.error.main, isDark ? 0.08 : 0.05) },
        ".docs-markdown-preview .doc-callout-draft": { borderLeftColor: muted, background: isDark ? "rgba(148,163,184,0.08)" : "rgba(15,23,42,0.04)" },
        ".docs-markdown-preview .doc-callout-meta": { fontSize: 12.5, color: muted, marginBottom: 6 },
        ".docs-markdown-preview .doc-changelog": { margin: "1.2em 0", borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, overflow: "hidden" },
        ".docs-markdown-preview .doc-changelog-head": { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: `1px solid ${border}`, background: surface },
        ".docs-markdown-preview .doc-changelog-body": { padding: "12px 14px" },
        ".docs-markdown-preview .doc-meta-bar": { display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 13, color: muted, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${border}` },
        ".docs-markdown-preview .doc-reading-time": { fontSize: 13, color: muted, margin: "0 0 1em" },
        ".docs-markdown-preview .doc-author": { display: "flex", gap: 12, alignItems: "center", margin: "1.2em 0", padding: 12, borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-author-avatar": { width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", fontWeight: 800, background: alpha(accent, 0.15), color: accent },
        ".docs-markdown-preview .doc-author-name": { fontWeight: 750 },
        ".docs-markdown-preview .doc-progress": { margin: "1.1em 0" },
        ".docs-markdown-preview .doc-progress-label": { fontSize: 12, color: muted, marginBottom: 6 },
        ".docs-markdown-preview .doc-progress-track": { height: 8, borderRadius: 2, background: isDark ? "rgba(148,163,184,0.15)" : "rgba(15,23,42,0.08)", overflow: "hidden", border: `1px solid ${border}` },
        ".docs-markdown-preview .doc-progress-bar": { height: "100%", background: accent, borderRadius: 2 },
        ".docs-markdown-preview .doc-feedback": { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, margin: "1.5em 0", padding: 12, borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-feedback-btn": { borderRadius: 2, border: `1px solid ${border}`, padding: "4px 12px", background: surface, cursor: "pointer", fontWeight: 650, fontSize: 13 },
        ".docs-markdown-preview .doc-related": { margin: "1.5em 0", padding: 14, borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-related-title": { fontWeight: 800, marginBottom: 8, fontSize: 13 },
        ".docs-markdown-preview .doc-related ul": { margin: 0, paddingLeft: 18 },
        ".docs-markdown-preview .doc-related-desc": { marginLeft: 8, color: muted, fontSize: 13 },
        ".docs-markdown-preview .doc-dl dt": { fontWeight: 750, marginTop: 10 },
        ".docs-markdown-preview .doc-dl dd": { marginLeft: 16, color: textSec },
        ".docs-markdown-preview .doc-date": { display: "inline-block", padding: "2px 8px", borderRadius: 2, border: `1px solid ${border}`, fontSize: 13, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-i18n": { margin: "1em 0", padding: "8px 12px", borderRadius: 2, border: `1px solid ${border}`, fontSize: 13, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-embed": { position: "relative", paddingBottom: "56.25%", height: 0, margin: "1.25em 0", borderRadius: 2, overflow: "hidden", border: `1px solid ${border}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-embed iframe": { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" },
        ".docs-markdown-preview .doc-download": { display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 2, border: `1px solid ${border}`, background: surface, boxShadow: edgeLight, textDecoration: "none", color: text, fontWeight: 700, fontSize: 13 },
        ".docs-markdown-preview .doc-qr": { display: "inline-block", margin: "1em 0", padding: 10, borderRadius: 2, border: `1px solid ${border}`, boxShadow: edgeLight, textAlign: "center" },
        ".docs-markdown-preview .doc-figure": { margin: "1.25em 0", borderRadius: 2, overflow: "hidden", border: `1px solid ${border}`, boxShadow: edgeLight },
        ".docs-markdown-preview .doc-figure img": { display: "block", width: "100%", maxHeight: 560, objectFit: "contain" },
        ".docs-markdown-preview .doc-matrix-yes": { color: theme.palette.success.main, fontWeight: 700 },
        ".docs-markdown-preview .doc-matrix-no": { color: muted },
        ".docs-markdown-preview .doc-mermaid": { margin: "1.25em 0", borderRadius: 2, border: `1px solid ${border}`, overflow: "hidden", boxShadow: edgeLight, background: surfaceRaised },
        ".docs-markdown-preview .doc-mermaid-head": { padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: muted, borderBottom: `1px solid ${border}` },
        ".docs-markdown-preview .doc-mermaid-source": { margin: 0, padding: 12, fontSize: 12, overflow: "auto" },
        ".docs-markdown-preview .doc-mermaid-render": { padding: 12, textAlign: "center" },
        ".docs-markdown-preview .doc-math-block": { margin: "1em 0", padding: 12, borderRadius: 2, border: `1px solid ${border}`, background: surface, textAlign: "center", fontFamily: "ui-monospace, monospace", boxShadow: edgeLight },


        ".docs-preview-surface": {
          minHeight: 280,
          padding: "16px 18px",
          borderRadius: 2,
          border: `1px solid ${border}`,
          background: surfaceRaised,
          boxShadow: edgeLight,
          overflow: "auto",
        },
      }}
    />
  );
}
