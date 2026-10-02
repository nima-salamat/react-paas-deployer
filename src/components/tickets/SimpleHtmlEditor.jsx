import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, ButtonGroup, Collapse, IconButton, Paper, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * Compact HTML editor. Toolbar hidden by default; expand with button.
 * Enter → new line (send only via toolbar/send button from parent).
 */
export default function SimpleHtmlEditor({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Message…",
  minHeight = 40,
  maxHeight = 192,
  enterSends = false,
  disabled = false,
  compact = true,
  showToolbarToggle = true,
  expanded: expandedProp,
  onExpandedChange,
}) {
  const ref = useRef(null);
  const lastHtml = useRef(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (v) => {
    setInternalExpanded(v);
    onExpandedChange?.(v);
  };

  useEffect(() => {
    const editor = ref.current;
    if (!editor) return;

    const nextValue =
      typeof value === "string"
        ? value
        : value == null
        ? ""
        : String(value);

    // Keep the contentEditable in sync with external state without
    // rewriting it after every keystroke. Rewriting on each render would
    // destroy the caret/selection and make formatting feel broken.
    if (nextValue !== lastHtml.current && nextValue !== editor.innerHTML) {
      editor.innerHTML = nextValue;
    }
    lastHtml.current = nextValue;
  }, [value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastHtml.current = html;
    onChange?.(html);
  }, [onChange]);

  const cmd = (command, arg = null) => {
    if (disabled || !ref.current) return;
    ref.current.focus();
    try {
      document.execCommand(command, false, arg);
    } catch {
      /* browser command unavailable */
    }
    emit();
  };

  const keepSelection = (event) => {
    // Prevent the toolbar button from stealing focus before execCommand runs.
    event.preventDefault();
  };

  const addLink = () => {
    const url = window.prompt("URL");
    if (url) cmd("createLink", url);
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (e.isComposing || e.keyCode === 229) return;
    // Default: Enter inserts a new line (do not send).
    // Only send on Enter when enterSends=true and Shift is NOT held.
    if (enterSends && !e.shiftKey && onSubmit) {
      e.preventDefault();
      e.stopPropagation();
      if (ref.current) {
        const html = ref.current.innerHTML;
        lastHtml.current = html;
        onChange?.(html);
        onSubmit(html);
      } else {
        onSubmit();
      }
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        opacity: disabled ? 0.6 : 1,
        flex: 1,
        minWidth: 0,
        borderRadius: compact ? 2 : 1,
        overflow: "hidden",
      }}
    >
      {showToolbarToggle && (
        <Collapse in={expanded}>
          <Box sx={{ px: 0.25, py: 0.1, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
            <ButtonGroup size="small" variant="text">
              <Tooltip title="Bold"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("bold")} disabled={disabled}><FormatBoldIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Italic"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("italic")} disabled={disabled}><FormatItalicIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Underline"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("underline")} disabled={disabled}><FormatUnderlinedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Bullets"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("insertUnorderedList")} disabled={disabled}><FormatListBulletedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Numbered"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("insertOrderedList")} disabled={disabled}><FormatListNumberedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Code block"><span><IconButton size="small" onMouseDown={keepSelection} onClick={() => cmd("formatBlock", "pre")} disabled={disabled}><CodeIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Link"><span><IconButton size="small" onMouseDown={keepSelection} onClick={addLink} disabled={disabled}><LinkIcon fontSize="small" /></IconButton></span></Tooltip>
            </ButtonGroup>
          </Box>
        </Collapse>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-end" }}>
        <Box
          ref={ref}
          contentEditable={!disabled}
          dir="auto"
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          data-placeholder={placeholder}
          sx={{
            flex: 1,
            minHeight: expanded ? Math.max(minHeight, 72) : minHeight,
            maxHeight: expanded ? Math.max(maxHeight, 220) : maxHeight,
            overflow: "auto",
            px: 1.5,
            py: compact ? 1 : 1.25,
            outline: "none",
            fontSize: 14,
            lineHeight: 1.45,
            "&:empty:before": {
              content: "attr(data-placeholder)",
              color: "text.disabled",
            },
            "& p": { m: 0, mb: 0.55 },
            "& p:last-child": { mb: 0 },
            "& strong, & b": { fontWeight: 800 },
            "& em, & i": { fontStyle: "italic" },
            "& u": { textDecoration: "underline", textUnderlineOffset: "2px" },
            "& ul, & ol": {
              m: 0,
              my: 0.5,
              pl: 2.5,
            },
            "& li": { mb: 0.2 },
            "& blockquote": {
              m: 0,
              my: 0.75,
              pl: 1.25,
              borderLeft: "3px solid",
              borderColor: "divider",
              color: "text.secondary",
            },
            "& pre": {
              bgcolor: "action.hover",
              p: 1,
              my: 0.6,
              borderRadius: 1,
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12.5,
              whiteSpace: "pre-wrap",
            },
            "& code": {
              bgcolor: "action.hover",
              px: 0.45,
              py: 0.1,
              borderRadius: 0.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.92em",
            },
            "& a": { color: "primary.main", textDecoration: "underline", textUnderlineOffset: "2px" },
          }}
        />
        {showToolbarToggle && (
          <Tooltip title={expanded ? "Hide formatting" : "Formatting"}>
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ mb: 0.5, mr: 0.5 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Paper>
  );
}

export function htmlToPlain(html) {
  if (html == null || html === "") return "";
  // Guard against objects (avoids innerHTML becoming "[object Object]")
  let s = html;
  if (typeof html !== "string") {
    if (typeof html === "object") {
      s =
        (typeof html.html === "string" && html.html) ||
        (typeof html.body === "string" && html.body) ||
        (typeof html.text === "string" && html.text) ||
        (typeof html.content === "string" && html.content) ||
        "";
    } else {
      s = String(html);
    }
  }
  if (!s) return "";
  const d = document.createElement("div");
  d.innerHTML = s;
  return (d.textContent || d.innerText || "").trim();
}
