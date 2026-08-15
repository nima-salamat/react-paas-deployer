import React from "react";
import { Box } from "@mui/material";
import { guessLangFromName } from "../modules/fileHelpers";

/** Syntax-highlighted plain-text / code file preview. */
export default function PreviewTextBody({ text, filename }) {
  const [html, setHtml] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = text || "";
      const lang = guessLangFromName(filename);
      try {
        const mod = await import("highlight.js");
        try { await import("highlight.js/styles/github-dark.css"); } catch { /* */ }
        const hljs = mod.default || mod;
        let out;
        if (lang && hljs.getLanguage(lang)) {
          out = hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value;
        } else {
          out = hljs.highlightAuto(raw).value;
        }
        if (!cancelled) setHtml(out);
      } catch {
        if (!cancelled) setHtml(null);
      }
    })();
    return () => { cancelled = true; };
  }, [text, filename]);

  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: { xs: 1, sm: 2 },
        width: "100%",
        maxHeight: "70vh",
        overflow: "auto",
        bgcolor: "#0d1117",
        borderRadius: 1,
        fontSize: { xs: 12, sm: 13 },
        lineHeight: 1.55,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        color: "#e6edf3",
        whiteSpace: "pre",
        wordBreak: "normal",
        "& .hljs-comment": { color: "#8b949e", fontStyle: "italic" },
        "& .hljs-keyword": { color: "#ff7b72" },
        "& .hljs-string": { color: "#a5d6ff" },
        "& .hljs-number": { color: "#79c0ff" },
        "& .hljs-title": { color: "#d2a8ff" },
        "& .hljs-built_in": { color: "#ffa657" },
      }}
      {...(html
        ? { dangerouslySetInnerHTML: { __html: html } }
        : { children: text })}
    />
  );
}
