import React, { useCallback, useEffect, useRef } from "react";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import SimpleHtmlEditor, { htmlToPlain } from "./SimpleHtmlEditor";
import PendingFilesBar from "./PendingFilesBar";

/**
 * Messenger-style composer:
 * [attach] [ text input …………… ] [send]
 * Enter = new line · send via button only
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
  const valueRef = useRef(value);
  const filesRef = useRef(files);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const canSend = !sending && !disabled && (htmlToPlain(value) || files.length > 0);

  const onPick = (e) => {
    const picked = Array.from(e.target.files || []);
    onFilesChange?.([...(files || []), ...picked].slice(0, 5));
    e.target.value = "";
  };

  const handleSend = useCallback((htmlArg) => {
    if (sending || disabled) return;
    // onClick passes a React synthetic event — only treat real strings as HTML body
    const html = typeof htmlArg === "string" ? htmlArg : valueRef.current;
    const fl = filesRef.current || [];
    if (!htmlToPlain(html) && !fl.length) return;
    onSend?.(html);
  }, [sending, disabled, onSend]);

  const handleSubmitFromEditor = useCallback((html) => {
    if (sending || disabled) return;
    if (html != null) {
      valueRef.current = html;
      onChange?.(html);
    }
    const body = html ?? valueRef.current;
    const fl = filesRef.current || [];
    if (!htmlToPlain(body) && !fl.length) return;
    onSend?.(body);
  }, [sending, disabled, onChange, onSend]);

  return (
    <Box sx={{ borderTop: 1, borderColor: "divider", bgcolor: "background.paper", px: 0.75, py: 0.6 }}>
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
          enterSends={false}
          value={value}
          onChange={(html) => {
            valueRef.current = html;
            onChange?.(html);
          }}
          onSubmit={handleSubmitFromEditor}
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
              onClick={handleSend}
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
