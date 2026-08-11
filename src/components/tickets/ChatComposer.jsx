import React from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import SimpleHtmlEditor, { htmlToPlain } from "./SimpleHtmlEditor";
import PendingFilesBar from "./PendingFilesBar";

/**
 * Messenger-style composer:
 * [attach] [ text input …………… ] [send]
 */
export default function ChatComposer({
  value,
  onChange,
  files = [],
  onFilesChange,
  onSend,
  sending = false,
  disabled = false,
  placeholder = "Message…",
}) {
  const canSend = !sending && !disabled && (htmlToPlain(value) || files.length > 0);

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    onFilesChange?.([...(files || []), ...picked].slice(0, 5));
    e.target.value = "";
  };

  const handleKey = (e) => {
    // Enter to send is hard with contentEditable; skip
  };

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", bgcolor: "background.paper", px: 1, py: 1 }}>
      <PendingFilesBar
        files={files}
        onRemove={(i) => onFilesChange?.((files || []).filter((_, idx) => idx !== i))}
        onClear={() => onFilesChange?.([])}
      />
      <Stack direction="row" alignItems="flex-end" gap={0.5}>
        <Tooltip title="Attach">
          <IconButton component="label" disabled={disabled || sending} size="medium" sx={{ mb: 0.25 }}>
            <AttachFileIcon />
            <input
              hidden
              type="file"
              multiple
              accept="image/*,audio/*,video/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx"
              onChange={onPick}
            />
          </IconButton>
        </Tooltip>

        <SimpleHtmlEditor
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={40}
          maxHeight={120}
          disabled={disabled || sending}
          compact
          showToolbarToggle
        />

        <Tooltip title="Send">
          <span>
            <IconButton
              color="primary"
              disabled={!canSend}
              onClick={onSend}
              size="medium"
              sx={{
                mb: 0.25,
                bgcolor: canSend ? "primary.main" : undefined,
                color: canSend ? "primary.contrastText" : undefined,
                "&:hover": { bgcolor: canSend ? "primary.dark" : undefined },
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
