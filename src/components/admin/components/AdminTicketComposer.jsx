import React, { useEffect, useRef } from "react";
import {
  Box, Button, Chip, IconButton, Stack, Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloseIcon from "@mui/icons-material/Close";
import SimpleHtmlEditor, { htmlToPlain } from "../../tickets/SimpleHtmlEditor";

const EMPTY_FILES = [];

export default function AdminTicketComposer({
  value = "",
  onChange,
  files = EMPTY_FILES,
  onFilesChange,
  onSend,
  sending = false,
  disabled = false,
  placeholder = "Write a staff reply…",
}) {
  const fileRef = useRef(null);
  const valueRef = useRef(value);
  const filesRef = useRef(files);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const handleAttach = (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;
    onFilesChange?.([...(files || []), ...picked]);
    event.target.value = "";
  };

  const removeFile = (index) => {
    onFilesChange?.((files || []).filter((_, idx) => idx !== index));
  };

  const handleSend = (htmlArg) => {
    if (disabled || sending) return;
    const html = typeof htmlArg === "string" ? htmlArg : valueRef.current || "";
    const attached = filesRef.current || [];
    if (!htmlToPlain(html) && !attached.length) return;
    onSend?.(html);
  };

  const canSend =
    !disabled &&
    !sending &&
    (Boolean(htmlToPlain(value)) || Boolean(files?.length));

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        p: 1.5,
      }}
    >
      {(files || []).length > 0 && (
        <Stack
          direction="row"
          gap={0.75}
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 1 }}
        >
          {files.map((file, index) => (
            <Chip
              key={`${file.name}-${index}`}
              size="small"
              label={file.name}
              onDelete={() => removeFile(index)}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              sx={{
                borderRadius: 1,
                maxWidth: 280,
                "& .MuiChip-label": {
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                },
              }}
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" alignItems="flex-end" gap={0.75}>
        <Tooltip title="Attach files">
          <span>
            <IconButton
              size="medium"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || sending}
              sx={{
                mb: 0.35,
                borderRadius: 1.25,
                border: 1,
                borderColor: "divider",
                flexShrink: 0,
              }}
            >
              <AttachFileIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          accept="image/*,audio/*,video/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx"
          onChange={handleAttach}
        />

        <SimpleHtmlEditor
          value={value}
          onChange={(html) => {
            valueRef.current = html;
            onChange?.(html);
          }}
          onSubmit={handleSend}
          placeholder={placeholder}
          minHeight={92}
          maxHeight={280}
          disabled={disabled || sending}
          compact={false}
          showToolbarToggle
        />

        <Button
          variant="contained"
          size="medium"
          endIcon={<SendIcon />}
          disabled={!canSend}
          onClick={() => handleSend(valueRef.current)}
          sx={{
            minHeight: 42,
            borderRadius: 1.25,
            textTransform: "none",
            fontWeight: 700,
            px: 2.2,
            flexShrink: 0,
          }}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </Stack>
    </Box>
  );
}
