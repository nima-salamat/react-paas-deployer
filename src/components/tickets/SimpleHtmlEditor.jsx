import React, { useCallback, useRef, useState } from "react";
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
 * Enter → onSubmit (send). Shift+Enter → new line.
 */
export default function SimpleHtmlEditor({
  value = "",
  onChange,
  onSubmit,
  placeholder = "Message…",
  minHeight = 40,
  maxHeight = 160,
  disabled = false,
  compact = true,
  showToolbarToggle = true,
  expanded: expandedProp,
  onExpandedChange,
}) {
  const ref = useRef(null);
  const lastHtml = useRef(value);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const setExpanded = (v) => {
    setInternalExpanded(v);
    onExpandedChange?.(v);
  };

  React.useEffect(() => {
    if (!ref.current) return;
    if (value !== lastHtml.current && value === "") {
      ref.current.innerHTML = "";
      lastHtml.current = "";
    }
  }, [value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastHtml.current = html;
    onChange?.(html);
  }, [onChange]);

  const cmd = (command, arg = null) => {
    if (disabled) return;
    ref.current?.focus();
    try {
      document.execCommand(command, false, arg);
    } catch { /* */ }
    emit();
  };

  const addLink = () => {
    const url = window.prompt("URL");
    if (url) cmd("createLink", url);
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    // IME composition (e.g. Persian/Chinese) — don't send mid-composition
    if (e.isComposing || e.keyCode === 229) return;

    if (e.shiftKey) {
      // Shift+Enter → allow default new line in contentEditable
      return;
    }

    // Enter alone → send
    if (onSubmit) {
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
          <Box sx={{ px: 0.5, py: 0.25, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
            <ButtonGroup size="small" variant="text">
              <Tooltip title="Bold"><IconButton size="small" onClick={() => cmd("bold")} disabled={disabled}><FormatBoldIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Italic"><IconButton size="small" onClick={() => cmd("italic")} disabled={disabled}><FormatItalicIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Underline"><IconButton size="small" onClick={() => cmd("underline")} disabled={disabled}><FormatUnderlinedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Bullets"><IconButton size="small" onClick={() => cmd("insertUnorderedList")} disabled={disabled}><FormatListBulletedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Numbered"><IconButton size="small" onClick={() => cmd("insertOrderedList")} disabled={disabled}><FormatListNumberedIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Code"><IconButton size="small" onClick={() => cmd("formatBlock", "pre")} disabled={disabled}><CodeIcon fontSize="small" /></IconButton></Tooltip>
              <Tooltip title="Link"><IconButton size="small" onClick={addLink} disabled={disabled}><LinkIcon fontSize="small" /></IconButton></Tooltip>
            </ButtonGroup>
          </Box>
        </Collapse>
      )}
      <Box sx={{ display: "flex", alignItems: "flex-end" }}>
        <Box
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          onKeyDown={onKeyDown}
          data-placeholder={placeholder}
          sx={{
            flex: 1,
            minHeight: expanded ? Math.max(minHeight, 80) : minHeight,
            maxHeight: expanded ? maxHeight + 80 : maxHeight,
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
            "& p": { m: 0 },
            "& pre": { bgcolor: "action.hover", p: 1, borderRadius: 1, overflow: "auto" },
            "& a": { color: "primary.main" },
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
  if (!html) return "";
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || d.innerText || "").trim();
}
