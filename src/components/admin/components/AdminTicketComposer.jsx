import React from "react";
import { Box, Chip, IconButton, Stack, Tooltip } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import SimpleHtmlEditor, { htmlToPlain } from "../../tickets/SimpleHtmlEditor";

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
  const canSend =
    !disabled &&
    !sending &&
    (Boolean(htmlToPlain(value)) || files.length > 0);

  const handleAttach = (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;
    onFilesChange?.([...(files || []), ...picked].slice(0, 5));
    event.target.value = "";
  };

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", bgcolor: "background.paper", p: { xs: 1, sm: 1.25 } }}>
      {(files || []).length > 0 && (
        <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {files.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              size="small"
              label={file.name}
              onDelete={() => onFilesChange?.((files || []).filter((_, idx) => idx !== index))}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              sx={{ borderRadius: 1, maxWidth: 240 }}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" alignItems="flex-end" gap={0.5}>
        <Tooltip title="Attach files">
          <span>
            <IconButton size="medium" aria-label="Attach files" component="label" disabled={disabled || sending} sx={{ mb: 0.25 }}>
              <AttachFileIcon />
              <input hidden type="file" multiple onChange={handleAttach} />
            </IconButton>
          </span>
        </Tooltip>

        <SimpleHtmlEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={48}
          maxHeight={180}
          compact
          showToolbarToggle
          disabled={disabled || sending}
        />

        <Tooltip title="Send reply">
          <span>
            <IconButton
              color="primary"
              aria-label="Send reply"
              disabled={!canSend}
              onClick={() => onSend?.(value)}
              size="medium"
              sx={{ mb: 0.25, bgcolor: canSend ? "primary.main" : undefined, color: canSend ? "primary.contrastText" : undefined, "&:hover": { bgcolor: canSend ? "primary.dark" : undefined } }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
