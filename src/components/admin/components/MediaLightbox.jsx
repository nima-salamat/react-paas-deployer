import React, { useEffect, useCallback } from "react";
import {
  Box, Dialog, DialogContent, IconButton, Stack, Tooltip, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { authMediaSrc } from "../adminUtils";

async function downloadUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename || "image";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
  } catch {
    window.open(url, "_blank");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* */
  }
}

/**
 * MediaLightbox — reusable full-screen image viewer (messenger-style).
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   items: string[] | { url|src|image, name? }[]
 *   index: number
 *   onIndexChange?: (i) => void
 *   title?: string
 */
export default function MediaLightbox({
  open,
  onClose,
  items = [],
  index = 0,
  onIndexChange,
  title,
}) {
  const list = (items || [])
    .map((it) => {
      if (!it) return null;
      if (typeof it === "string") return { url: authMediaSrc(it), name: title || "image" };
      const raw = it.url || it.src || it.image || "";
      return {
        url: authMediaSrc(raw),
        name: it.name || it.filename || it.original_filename || title || "image",
      };
    })
    .filter((x) => x && x.url);

  const safeIndex = Math.min(Math.max(0, index), Math.max(0, list.length - 1));
  const current = list[safeIndex];

  const goPrev = useCallback(() => {
    if (list.length < 2) return;
    const next = (safeIndex - 1 + list.length) % list.length;
    onIndexChange?.(next);
  }, [list.length, safeIndex, onIndexChange]);

  const goNext = useCallback(() => {
    if (list.length < 2) return;
    const next = (safeIndex + 1) % list.length;
    onIndexChange?.(next);
  }, [list.length, safeIndex, onIndexChange]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, goPrev, goNext]);

  if (!current) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Typography color="text.secondary">No media</Typography>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "rgba(0,0,0,0.92)",
          backgroundImage: "none",
          boxShadow: "none",
          m: 1,
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          px: 1,
          pt: 1,
        }}
      >
        <Typography variant="body2" sx={{ color: "#fff", opacity: 0.85 }} noWrap>
          {current.name}
          {list.length > 1 ? `  (${safeIndex + 1}/${list.length})` : ""}
        </Typography>
        <Stack direction="row">
          <Tooltip title="Download">
            <IconButton
              onClick={() => downloadUrl(current.url, current.name)}
              sx={{ color: "#fff" }}
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Copy link">
            <IconButton onClick={() => copyText(current.url)} sx={{ color: "#fff" }}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>
          <IconButton onClick={onClose} sx={{ color: "#fff" }}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          p: 1,
          position: "relative",
          minHeight: 280,
        }}
      >
        {list.length > 1 && (
          <IconButton
            onClick={goPrev}
            sx={{
              position: "absolute",
              left: 8,
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
            }}
          >
            <ChevronLeftIcon />
          </IconButton>
        )}

        <img
          src={current.url}
          alt={current.name}
          style={{
            maxWidth: "100%",
            maxHeight: "80vh",
            objectFit: "contain",
            borderRadius: 8,
          }}
        />

        {list.length > 1 && (
          <IconButton
            onClick={goNext}
            sx={{
              position: "absolute",
              right: 8,
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
            }}
          >
            <ChevronRightIcon />
          </IconButton>
        )}
      </DialogContent>
    </Dialog>
  );
}
