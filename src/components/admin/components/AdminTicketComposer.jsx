import React, { useCallback, useRef, useState } from "react";
import {
  Box, Button, Chip, Collapse, Divider, IconButton, Stack, TextField, Tooltip, Typography, alpha,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import CodeIcon from "@mui/icons-material/Code";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import LinkIcon from "@mui/icons-material/Link";
import TitleIcon from "@mui/icons-material/Title";

function wrapSelection(textarea, before, after = before, placeholder = "text") {
  if (!textarea) return null;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const value = textarea.value || "";
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + selected + after + value.slice(end);
  const cursorStart = start + before.length;
  const cursorEnd = cursorStart + selected.length;
  return { next, cursorStart, cursorEnd };
}

/**
 * AdminTicketComposer — formatter collapsed by default (toggle button).
 */
export default function AdminTicketComposer({
  value,
  onChange,
  files = [],
  onFilesChange,
  onSend,
  sending = false,
  disabled = false,
  placeholder = "Write a staff reply…",
}) {
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const [fmtOpen, setFmtOpen] = useState(false);

  const applyWrap = useCallback(
    (before, after, placeholderText) => {
      const el = inputRef.current;
      const textarea =
        el?.querySelector?.("textarea") ||
        (el?.tagName === "TEXTAREA" ? el : null);
      if (!textarea) {
        onChange?.((value || "") + before + (placeholderText || "text") + (after || before));
        return;
      }
      const result = wrapSelection(textarea, before, after ?? before, placeholderText);
      if (!result) return;
      onChange?.(result.next);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.cursorStart, result.cursorEnd);
      });
    },
    [onChange, value]
  );

  const handleAttach = (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    onFilesChange?.([...(files || []), ...list]);
    e.target.value = "";
  };

  const removeFile = (idx) => {
    const next = [...(files || [])];
    next.splice(idx, 1);
    onFilesChange?.(next);
  };

  const canSend =
    !disabled &&
    !sending &&
    ((value && value.trim().length > 0) || (files && files.length > 0));

  const tools = [
    { title: "Bold", icon: <FormatBoldIcon fontSize="small" />, action: () => applyWrap("<b>", "</b>", "bold") },
    { title: "Italic", icon: <FormatItalicIcon fontSize="small" />, action: () => applyWrap("<i>", "</i>", "italic") },
    { title: "Underline", icon: <FormatUnderlinedIcon fontSize="small" />, action: () => applyWrap("<u>", "</u>", "underline") },
    { title: "Inline code", icon: <CodeIcon fontSize="small" />, action: () => applyWrap("<code>", "</code>", "code") },
    { title: "Bullet list", icon: <FormatListBulletedIcon fontSize="small" />, action: () => applyWrap("<ul>\n  <li>", "</li>\n</ul>", "item") },
    { title: "Numbered list", icon: <FormatListNumberedIcon fontSize="small" />, action: () => applyWrap("<ol>\n  <li>", "</li>\n</ol>", "item") },
    { title: "Quote", icon: <FormatQuoteIcon fontSize="small" />, action: () => applyWrap("<blockquote>", "</blockquote>", "quote") },
    { title: "Link", icon: <LinkIcon fontSize="small" />, action: () => applyWrap('<a href="https://">', "</a>", "link text") },
  ];

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
      }}
    >
      {/* Collapsible formatting toolbar */}
      <Collapse in={fmtOpen} timeout={180}>
        <Stack
          direction="row"
          alignItems="center"
          gap={0.25}
          flexWrap="wrap"
          useFlexGap
          sx={{
            mb: 1,
            p: 0.5,
            borderRadius: 1.25,
            bgcolor: (t) => alpha(t.palette.action.hover, 0.4),
            border: 1,
            borderColor: "divider",
          }}
        >
          {tools.map((t) => (
            <Tooltip key={t.title} title={t.title}>
              <span>
                <IconButton
                  size="small"
                  onClick={t.action}
                  disabled={disabled || sending}
                  sx={{ borderRadius: 1 }}
                >
                  {t.icon}
                </IconButton>
              </span>
            </Tooltip>
          ))}
          <Typography variant="caption" color="text.disabled" sx={{ ml: 0.5, px: 0.5 }}>
            HTML
          </Typography>
        </Stack>
      </Collapse>

      {(files || []).length > 0 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {files.map((f, idx) => (
            <Chip
              key={`${f.name}-${idx}`}
              size="small"
              label={f.name}
              onDelete={() => removeFile(idx)}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              sx={{ borderRadius: 1, maxWidth: 240 }}
            />
          ))}
        </Stack>
      )}

      <TextField
        inputRef={inputRef}
        multiline
        minRows={3}
        maxRows={14}
        fullWidth
        size="small"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || sending}
        sx={{
          mb: 1,
          "& .MuiOutlinedInput-root": {
            borderRadius: 1.5,
            bgcolor: (t) => alpha(t.palette.action.hover, 0.2),
            fontSize: 14.5,
            lineHeight: 1.6,
          },
        }}
      />

      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" gap={0.25}>
          <Tooltip title={fmtOpen ? "Hide formatting" : "Show formatting"}>
            <IconButton
              size="small"
              onClick={() => setFmtOpen((v) => !v)}
              disabled={disabled || sending}
              color={fmtOpen ? "primary" : "default"}
              sx={{
                borderRadius: 1,
                border: 1,
                borderColor: fmtOpen ? "primary.main" : "divider",
              }}
            >
              <TitleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Attach files">
            <IconButton
              size="small"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || sending}
              sx={{ borderRadius: 1 }}
            >
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <input ref={fileRef} type="file" multiple hidden onChange={handleAttach} />
        </Stack>

        <Button
          variant="contained"
          size="medium"
          endIcon={<SendIcon />}
          disabled={!canSend}
          onClick={() => onSend?.(value)}
          sx={{
            borderRadius: 1.25,
            textTransform: "none",
            fontWeight: 700,
            px: 2.5,
          }}
        >
          {sending ? "Sending…" : "Send reply"}
        </Button>
      </Stack>
    </Box>
  );
}
