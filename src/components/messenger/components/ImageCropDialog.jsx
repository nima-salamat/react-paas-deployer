import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress,
} from "@mui/material";
import CropIcon from "@mui/icons-material/Crop";
import CloseIcon from "@mui/icons-material/Close";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import SendIcon from "@mui/icons-material/Send";

import ReactAvatarEditor from "react-avatar-editor";

/**
 * Image preview + crop dialog shown when user picks an image file.
 * Returns a cropped+resized Blob via onConfirm.
 *
 * Uses react-avatar-editor (same lib as the main Profile page) for a smooth
 * drag-to-position + zoom + rotate experience with a circular crop overlay.
 *
 * Props:
 *  - open: boolean
 *  - file: File | null  (the picked image)
 *  - onClose: () => void
 *  - onConfirm: (blob: Blob, filename: string) => void
 *  - circular: boolean (default true) — when true, shows a circular crop overlay
 *  - outputSize: number (default 512) — output image size in px
 *  - title: string (default "Crop image")
 */
export default function ImageCropDialog({
  open, file, onClose, onConfirm,
  circular = true,
  outputSize = 512,
  title = "Crop image",
}) {
  const editorRef = useRef(null);
  const [imgSrc, setImgSrc] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [borderRadius, setBorderRadius] = useState(circular ? 200 : 8);
  const [sending, setSending] = useState(false);
  const [aspect, setAspect] = useState(circular ? 1 : null);

  // Load the file as an object URL whenever it changes
  useEffect(() => {
    if (!file) {
      setImgSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    setZoom(1);
    setRotation(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Update border radius when circular changes
  useEffect(() => {
    setBorderRadius(circular ? 200 : 8);
    setAspect(circular ? 1 : null);
  }, [circular]);

  const produceCroppedBlob = useCallback(async () => {
    if (!editorRef.current) return null;
    const editor = editorRef.current;
    // Canvas at the crop rect, scaled to outputSize
    const canvas = editor.getImageScaledToCanvas({
      width: outputSize,
      height: aspect === 1 ? outputSize : undefined,
    });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [outputSize, aspect]);

  const onConfirmClick = async () => {
    setSending(true);
    try {
      const blob = await produceCroppedBlob();
      if (!blob) {
        setSending(false);
        return;
      }
      const baseName = (file?.name || "image").replace(/\.[^.]+$/, "");
      const filename = `${baseName}_crop.jpg`;
      onConfirm(blob, filename);
    } finally {
      setSending(false);
    }
  };

  const rotate = () => {
    setRotation((r) => (r + 90) % 360);
  };

  const EDITOR_SIZE = 300;

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
        <CropIcon sx={{ mr: 1 }} />
        <Typography fontWeight={700} sx={{ flex: 1 }}>{title}</Typography>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            bgcolor: "action.hover",
            borderRadius: 2,
            overflow: "hidden",
            minHeight: EDITOR_SIZE + 20,
            position: "relative",
            cursor: "move",
          }}
        >
          {imgSrc && (
            <ReactAvatarEditor
              ref={editorRef}
              image={imgSrc}
              width={EDITOR_SIZE}
              height={EDITOR_SIZE}
              border={30}
              borderRadius={borderRadius}
              color={[0, 0, 0, 0.6]} // RGBA — dark overlay outside crop
              scale={zoom}
              rotate={rotation}
              crossOrigin="anonymous"
            />
          )}
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Drag the image to position it. Use the slider to zoom.
          </Typography>
          <Slider
            size="small"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(_, v) => setZoom(v)}
            sx={{ mt: 0.5 }}
          />
        </Box>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          {!circular && (
            <ToggleButtonGroup
              size="small" exclusive value={aspect === null ? "free" : String(aspect)}
              onChange={(_, v) => {
                if (!v) return;
                if (v === "free") setAspect(null);
                else setAspect(parseFloat(v));
              }}
            >
              <ToggleButton value="free">Free</ToggleButton>
              <ToggleButton value="1">1:1</ToggleButton>
              <ToggleButton value="1.3333333333333333">4:3</ToggleButton>
              <ToggleButton value="1.7777777777777777">16:9</ToggleButton>
            </ToggleButtonGroup>
          )}
          <IconButton onClick={rotate} size="small" title="Rotate 90°">
            <RotateRightIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" color="primary"
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
          onClick={onConfirmClick}
          disabled={sending}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
}
