import React, { useEffect, useMemo, useState } from "react";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import ImageIcon from "@mui/icons-material/Image";

function formatSize(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shows selected files before send: name, size, image thumb, remove.
 */
export default function PendingFilesBar({ files = [], onRemove, onClear }) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    const next = files.map((f) =>
      f.type && f.type.startsWith("image/") ? URL.createObjectURL(f) : null
    );
    setUrls(next);
    return () => next.forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  if (!files.length) return null;

  return (
    <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 1, mb: 0.5 }}>
      {files.map((f, i) => {
        const isImg = f.type?.startsWith("image/");
        const isAud = f.type?.startsWith("audio/");
        return (
          <Box
            key={`${f.name}-${f.size}-${i}`}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
              px: 0.75,
              py: 0.5,
              maxWidth: 240,
              bgcolor: "background.paper",
            }}
          >
            {isImg && urls[i] ? (
              <Box
                component="img"
                src={urls[i]}
                alt={f.name}
                sx={{ width: 40, height: 40, objectFit: "cover", borderRadius: 1 }}
              />
            ) : isAud ? (
              <AudioFileIcon color="action" />
            ) : isImg ? (
              <ImageIcon color="action" />
            ) : (
              <InsertDriveFileIcon color="action" />
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" noWrap title={f.name} display="block" fontWeight={600}>
                {f.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSize(f.size)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => onRemove?.(i)} aria-label="remove file">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
      {files.length > 1 && onClear && (
        <Chip size="small" label="Clear all" onClick={onClear} variant="outlined" />
      )}
    </Stack>
  );
}
