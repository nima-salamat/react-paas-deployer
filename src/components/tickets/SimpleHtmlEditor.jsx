import React, { useCallback, useRef } from "react";
import { Box, ButtonGroup, IconButton, Paper, Tooltip } from "@mui/material";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import CodeIcon from "@mui/icons-material/Code";
import LinkIcon from "@mui/icons-material/Link";

/**
 * Lightweight contentEditable HTML editor (no extra deps).
 * value/onChange use HTML strings.
 */
export default function SimpleHtmlEditor({
  value = "",
  onChange,
  placeholder = "Write a message…",
  minHeight = 120,
  disabled = false,
}) {
  const ref = useRef(null);
  const lastHtml = useRef(value);

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

  return (
    <Paper variant="outlined" sx={{ opacity: disabled ? 0.6 : 1 }}>
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
      <Box
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        sx={{
          minHeight,
          maxHeight: 280,
          overflow: "auto",
          px: 1.5,
          py: 1,
          outline: "none",
          fontSize: 14,
          lineHeight: 1.5,
          "&:empty:before": {
            content: "attr(data-placeholder)",
            color: "text.disabled",
          },
          "& p": { m: 0 },
          "& pre": { bgcolor: "action.hover", p: 1, borderRadius: 1, overflow: "auto" },
          "& a": { color: "primary.main" },
        }}
      />
    </Paper>
  );
}

export function htmlToPlain(html) {
  if (!html) return "";
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || d.innerText || "").trim();
}
