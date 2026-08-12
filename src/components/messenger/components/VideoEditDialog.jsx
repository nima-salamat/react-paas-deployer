import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, CircularProgress, alpha,
  ToggleButton, ToggleButtonGroup, Paper, Tabs, Tab, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CropIcon from "@mui/icons-material/Crop";
import CheckIcon from "@mui/icons-material/Check";
import VideocamIcon from "@mui/icons-material/Videocam";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

/**
 * Video trim + free rectangle crop dialog.
 *
 * Trim: dual handles with 0.01s precision, format M:SS.cc
 * Crop: draggable/resizable rectangle overlay on the video (like image crop)
 * Output: re-encodes selected range+crop to WebM via canvas + MediaRecorder
 */

const QUALITY_PRESETS = {
  p480: { label: "480p", maxHeight: 480, bitrate: 1_200_000 },
  p720: { label: "720p", maxHeight: 720, bitrate: 2_500_000 },
  p1080: { label: "1080p", maxHeight: 1080, bitrate: 4_500_000 },
  original: { label: "Original", maxHeight: 0, bitrate: 6_000_000 },
};

const MIN_CROP = 40;
const ASPECTS = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

/** Format seconds as M:SS.cc (centiseconds) */
function formatPrecise(t) {
  if (!isFinite(t) || t < 0) return "0:00.00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t % 1) * 100);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function VideoEditDialog({ open, file, onClose, onConfirm, confirmLabel = "Done" }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [tab, setTab] = useState("trim"); // trim | crop | quality
  const videoRef = useRef(null);
  const stageRef = useRef(null); // container for video + crop overlay
  const canvasRef = useRef(null);
  const fileUrlRef = useRef(null);
  const cropDragRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(null);

  const [src, setSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [quality, setQuality] = useState("p720");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [aspect, setAspect] = useState("free");

  // Crop rect in STAGE pixel coords (relative to stageRef)
  // {x, y, w, h} — null means full frame
  const [cropEnabled, setCropEnabled] = useState(false);
  const [crop, setCrop] = useState({ x: 40, y: 40, w: 200, h: 200 });
  const [stageSize, setStageSize] = useState({ w: 640, h: 360 });

  // ---- Load file ----
  useEffect(() => {
    if (!open || !file) {
      setSrc("");
      return undefined;
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setSrc(url);
    setTrimStart(0);
    setTrimEnd(0);
    setCurrentTime(0);
    setDuration(0);
    setError("");
    setProcessing(false);
    setProgress(0);
    setCropEnabled(false);
    setAspect("free");
    return () => {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = null;
      }
    };
  }, [open, file]);

  const measureStage = useCallback(() => {
    const stage = stageRef.current;
    const v = videoRef.current;
    if (!stage || !v) return;
    const rect = stage.getBoundingClientRect();
    setStageSize({ w: rect.width, h: rect.height });
  }, []);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
    // After layout, measure and set a centered default crop
    requestAnimationFrame(() => {
      measureStage();
      const stage = stageRef.current;
      if (!stage) return;
      const { width: sw, height: sh } = stage.getBoundingClientRect();
      const cw = Math.min(sw * 0.7, sw - 20);
      const ch = Math.min(sh * 0.7, sh - 20);
      setCrop({
        x: (sw - cw) / 2,
        y: (sh - ch) / 2,
        w: cw,
        h: ch,
      });
      setStageSize({ w: sw, h: sh });
    });
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd - 0.02) {
        v.currentTime = trimStart;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [trimStart, trimEnd]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd && !v.paused) {
      v.pause();
      v.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
  };

  // ---- Crop interactions ----
  const startCropDrag = (e, handle) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropEnabled) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    cropDragRef.current = {
      handle,
      startX: clientX,
      startY: clientY,
      orig: { ...crop },
    };

    const onMove = (ev) => {
      const drag = cropDragRef.current;
      if (!drag) return;
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = cx - drag.startX;
      const dy = cy - drag.startY;
      let { x, y, w, h } = drag.orig;
      const sw = stageSize.w;
      const sh = stageSize.h;
      const ratio = ASPECTS[aspect];

      if (drag.handle === "move") {
        x = clamp(drag.orig.x + dx, 0, sw - w);
        y = clamp(drag.orig.y + dy, 0, sh - h);
      } else {
        if (drag.handle.includes("e")) w = clamp(drag.orig.w + dx, MIN_CROP, sw - drag.orig.x);
        if (drag.handle.includes("s")) h = clamp(drag.orig.h + dy, MIN_CROP, sh - drag.orig.y);
        if (drag.handle.includes("w")) {
          const nw = clamp(drag.orig.w - dx, MIN_CROP, drag.orig.x + drag.orig.w);
          x = drag.orig.x + (drag.orig.w - nw);
          w = nw;
        }
        if (drag.handle.includes("n")) {
          const nh = clamp(drag.orig.h - dy, MIN_CROP, drag.orig.y + drag.orig.h);
          y = drag.orig.y + (drag.orig.h - nh);
          h = nh;
        }
        if (ratio) {
          // Lock aspect from width
          h = clamp(w / ratio, MIN_CROP, sh - y);
          w = h * ratio;
          if (x + w > sw) {
            w = sw - x;
            h = w / ratio;
          }
        }
      }
      setCrop({ x, y, w, h });
    };

    const onUp = () => {
      cropDragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  // When aspect changes, reshape crop around center
  useEffect(() => {
    if (!cropEnabled) return;
    const ratio = ASPECTS[aspect];
    if (!ratio) return;
    setCrop((prev) => {
      const cx = prev.x + prev.w / 2;
      const cy = prev.y + prev.h / 2;
      let w = prev.w;
      let h = w / ratio;
      if (h > stageSize.h - 8) {
        h = stageSize.h - 8;
        w = h * ratio;
      }
      if (w > stageSize.w - 8) {
        w = stageSize.w - 8;
        h = w / ratio;
      }
      return {
        x: clamp(cx - w / 2, 0, stageSize.w - w),
        y: clamp(cy - h / 2, 0, stageSize.h - h),
        w,
        h,
      };
    });
  }, [aspect, cropEnabled, stageSize.w, stageSize.h]);

  // ---- Map stage crop → source video pixel coords ----
  const cropToSource = useCallback(() => {
    const v = videoRef.current;
    const stage = stageRef.current;
    if (!v || !stage || !cropEnabled) {
      return { sx: 0, sy: 0, sw: v?.videoWidth || 0, sh: v?.videoHeight || 0 };
    }
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const stageRect = stage.getBoundingClientRect();
    // object-fit: contain mapping
    const scale = Math.min(stageRect.width / vw, stageRect.height / vh);
    const dispW = vw * scale;
    const dispH = vh * scale;
    const offX = (stageRect.width - dispW) / 2;
    const offY = (stageRect.height - dispH) / 2;

    const sx = clamp((crop.x - offX) / scale, 0, vw);
    const sy = clamp((crop.y - offY) / scale, 0, vh);
    const sw = clamp(crop.w / scale, 1, vw - sx);
    const sh = clamp(crop.h / scale, 1, vh - sy);
    return { sx, sy, sw, sh };
  }, [crop, cropEnabled]);

  const drawFrame = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    const { sx, sy, sw, sh } = cropToSource();
    let outW = Math.max(2, Math.round(sw));
    let outH = Math.max(2, Math.round(sh));

    const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.p720;
    if (preset.maxHeight && outH > preset.maxHeight) {
      const r = preset.maxHeight / outH;
      outW = Math.max(2, Math.round(outW * r));
      outH = Math.max(2, Math.round(outH * r));
    }
    // Even dimensions help some encoders
    outW -= outW % 2;
    outH -= outH % 2;

    c.width = outW;
    c.height = outH;
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, outW, outH);
  }, [cropToSource, quality]);

  // ---- Process ----
  const handleConfirm = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    setProcessing(true);
    setProgress(0);
    setError("");
    chunksRef.current = [];

    try {
      v.pause();
      drawFrame();
      const c = canvasRef.current;
      if (!c) throw new Error("Canvas not ready");

      const canvasStream = c.captureStream(30);
      // Try to include audio
      try {
        const audioStream = v.captureStream?.() || v.mozCaptureStream?.();
        if (audioStream) {
          audioStream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
        }
      } catch { /* audio optional */ }

      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      let mimeType = "";
      for (const ct of candidates) {
        if (MediaRecorder.isTypeSupported(ct)) { mimeType = ct; break; }
      }
      if (!mimeType) throw new Error("Browser does not support WebM recording");

      const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.p720;
      const mr = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: preset.bitrate,
      });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      const done = new Promise((resolve, reject) => {
        mr.onstop = () => resolve();
        mr.onerror = (e) => reject(e.error || new Error("Recording failed"));
      });

      mr.start(100);
      v.currentTime = trimStart;

      await new Promise((r) => {
        const onSeeked = () => { v.removeEventListener("seeked", onSeeked); r(); };
        v.addEventListener("seeked", onSeeked);
        setTimeout(r, 400);
      });

      const totalDuration = Math.max(0.05, trimEnd - trimStart);
      const tick = () => {
        drawFrame();
        const elapsed = Math.max(0, v.currentTime - trimStart);
        setProgress(Math.min(99, (elapsed / totalDuration) * 100));
        if (v.currentTime >= trimEnd - 0.02 || v.ended || v.paused) {
          try { v.pause(); } catch { /* */ }
          if (mr.state !== "inactive") mr.stop();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };

      await v.play();
      rafRef.current = requestAnimationFrame(tick);
      // Safety stop
      const safety = setTimeout(() => {
        try { v.pause(); } catch { /* */ }
        if (mr.state !== "inactive") mr.stop();
      }, (totalDuration + 2) * 1000);

      await done;
      clearTimeout(safety);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const blob = new Blob(chunksRef.current, { type: mimeType.split(";")[0] });
      if (!blob.size) throw new Error("Empty output — try a longer trim");
      const name = (file?.name || "video").replace(/\.[^.]+$/, "") + "_edit.webm";
      setProgress(100);
      onConfirm?.(blob, name);
    } catch (e) {
      setError(e?.message || "Processing failed");
    } finally {
      setProcessing(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        videoRef.current?.pause();
      } catch { /* */ }
    }
  }, [drawFrame, duration, file, onConfirm, quality, trimEnd, trimStart]);

  // Trim change helpers
  const setTrimRange = (s, e) => {
    const d = duration || 0;
    let start = clamp(s, 0, d);
    let end = clamp(e, 0, d);
    if (end - start < 0.05) {
      if (s !== trimStart) start = Math.max(0, end - 0.05);
      else end = Math.min(d, start + 0.05);
    }
    setTrimStart(start);
    setTrimEnd(end);
    const v = videoRef.current;
    if (v) {
      if (v.currentTime < start || v.currentTime > end) {
        v.currentTime = start;
        setCurrentTime(start);
      }
    }
  };

  const seekPreview = (t) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = clamp(t, trimStart, trimEnd);
    v.currentTime = clamped;
    setCurrentTime(clamped);
  };

  // Timeline click / drag for playhead
  const onTimelinePointer = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const d = duration || 1;
    const clientX = e.touches ? e.touches[0]?.clientX : e.clientX;
    if (clientX == null) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    seekPreview(ratio * d);
  };

  if (!open) return null;

  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  return (
    <Dialog
      open={open}
      onClose={processing ? undefined : onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{ sx: isMobile ? { m: 0, borderRadius: 0, height: "100%" } : { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, px: 1.5 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Edit video</Typography>
        <IconButton size="small" onClick={onClose} disabled={processing}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ p: isMobile ? 1 : 2, display: "flex", flexDirection: "column" }}>
        <Stack spacing={1.5} sx={{ flex: 1 }}>
          {/* Stage */}
          <Box
            ref={stageRef}
            sx={{
              position: "relative",
              bgcolor: "#000",
              borderRadius: 2,
              overflow: "hidden",
              minHeight: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <video
              ref={videoRef}
              src={src}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              style={{ display: "block", width: "100%", maxHeight: isMobile ? "42vh" : 380, objectFit: "contain" }}
              playsInline
              controls={false}
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Dimmed overlay + crop rect */}
            {cropEnabled && (
              <>
                {/* dark mask using box-shadow trick on the crop rect */}
                <Box
                  onPointerDown={(e) => startCropDrag(e, "move")}
                  sx={{
                    position: "absolute",
                    left: crop.x,
                    top: crop.y,
                    width: crop.w,
                    height: crop.h,
                    border: "2px solid #fff",
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                    cursor: "move",
                    zIndex: 2,
                    touchAction: "none",
                  }}
                >
                  {handles.map((h) => {
                    const style = {
                      position: "absolute",
                      width: 12,
                      height: 12,
                      bgcolor: "#fff",
                      borderRadius: "2px",
                      border: "1px solid rgba(0,0,0,0.35)",
                      zIndex: 3,
                      touchAction: "none",
                    };
                    if (h.includes("n")) style.top = -6;
                    if (h.includes("s")) style.bottom = -6;
                    if (h.includes("w")) style.left = -6;
                    if (h.includes("e")) style.right = -6;
                    if (h === "n" || h === "s") {
                      style.left = "50%";
                      style.marginLeft = "-6px";
                      style.cursor = "ns-resize";
                    } else if (h === "e" || h === "w") {
                      style.top = "50%";
                      style.marginTop = "-6px";
                      style.cursor = "ew-resize";
                    } else if (h === "nw" || h === "se") style.cursor = "nwse-resize";
                    else style.cursor = "nesw-resize";
                    return (
                      <Box
                        key={h}
                        onPointerDown={(e) => startCropDrag(e, h)}
                        sx={style}
                      />
                    );
                  })}
                </Box>
              </>
            )}

            {/* Play button */}
            <IconButton
              onClick={togglePlay}
              sx={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                bgcolor: "rgba(0,0,0,0.65)",
                color: "#fff",
                zIndex: 4,
                opacity: isPlaying ? 0 : 1,
                transition: "opacity 0.2s",
                "&:hover": { bgcolor: "rgba(0,0,0,0.8)", opacity: 1 },
                width: 56, height: 56,
              }}
            >
              {isPlaying ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayArrowIcon sx={{ fontSize: 32 }} />}
            </IconButton>
          </Box>

          {/* Playhead / current time */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton size="small" onClick={togglePlay}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 110 }}>
              {formatPrecise(currentTime)} / {formatPrecise(duration)}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              Selection {formatPrecise(trimEnd - trimStart)}
            </Typography>
          </Stack>

          {/* TRIM */}
          {(tab === "trim" || !isMobile) && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <ContentCutIcon fontSize="small" /> Trim
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1, fontVariantNumeric: "tabular-nums" }}>
                {formatPrecise(trimStart)} → {formatPrecise(trimEnd)}
              </Typography>
            </Typography>

            {/* Clickable timeline */}
            <Box
              onClick={onTimelinePointer}
              sx={{
                position: "relative",
                height: 28,
                mb: 1,
                borderRadius: 1,
                bgcolor: "action.hover",
                cursor: "pointer",
                overflow: "hidden",
              }}
            >
              {/* selected range */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${duration ? (trimStart / duration) * 100 : 0}%`,
                  width: `${duration ? ((trimEnd - trimStart) / duration) * 100 : 100}%`,
                  top: 0, bottom: 0,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.35),
                }}
              />
              {/* playhead */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  top: 0, bottom: 0,
                  width: 2,
                  bgcolor: "error.main",
                }}
              />
            </Box>

            <Slider
              value={[trimStart, trimEnd]}
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.01}
              onChange={(_, v) => {
                const [s, e] = v;
                setTrimRange(s, e);
              }}
              valueLabelDisplay="auto"
              valueLabelFormat={formatPrecise}
              disableSwap
              sx={{
                "& .MuiSlider-thumb": { width: 16, height: 16 },
                "& .MuiSlider-valueLabel": {
                  fontSize: 11,
                  fontVariantNumeric: "tabular-nums",
                },
              }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Button size="small" onClick={() => seekPreview(trimStart)}>Jump start</Button>
              <Button size="small" onClick={() => seekPreview(Math.max(trimStart, trimEnd - 0.3))}>Jump end</Button>
              <Button
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={() => setTrimRange(0, duration)}
              >
                Reset trim
              </Button>
            </Stack>
          </Box>
          )}

          {/* CROP */}
          {(tab === "crop" || !isMobile) && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <CropIcon fontSize="small" /> Crop
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={cropEnabled ? "on" : "off"}
                onChange={(_, v) => {
                  if (v === "on") {
                    setCropEnabled(true);
                    measureStage();
                  } else if (v === "off") {
                    setCropEnabled(false);
                  }
                }}
              >
                <ToggleButton value="off">Full frame</ToggleButton>
                <ToggleButton value="on">Rectangle</ToggleButton>
              </ToggleButtonGroup>

              {cropEnabled && (
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={aspect}
                  onChange={(_, v) => v && setAspect(v)}
                >
                  {Object.keys(ASPECTS).map((k) => (
                    <ToggleButton key={k} value={k}>{k === "free" ? "Free" : k}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
              {cropEnabled
                ? "Drag the white rectangle to move it. Pull the corner/edge handles to resize — same as image crop."
                : "Turn on Rectangle to crop like photos. Output is re-encoded as WebM; audio is kept when the browser allows."}
            </Typography>
          </Box>
          )}

          {/* Quality */}
          {(tab === "quality" || !isMobile) && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <VideocamIcon fontSize="small" /> Quality
            </Typography>
            <ToggleButtonGroup
              value={quality}
              exclusive
              onChange={(_, v) => v && setQuality(v)}
              size="small"
            >
              {Object.entries(QUALITY_PRESETS).map(([value, preset]) => (
                <ToggleButton key={value} value={value}>{preset.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
          )}

          {error && (
            <Paper variant="outlined" sx={{ p: 1.5, borderColor: "error.main", bgcolor: alpha("#f44336", 0.08) }}>
              <Typography variant="body2" color="error.main">{error}</Typography>
            </Paper>
          )}

          {processing && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="body2">Processing video… {Math.round(progress)}%</Typography>
              </Stack>
              <Box sx={{ width: "100%", height: 6, bgcolor: "action.hover", borderRadius: 3, overflow: "hidden" }}>
                <Box sx={{ width: `${progress}%`, height: "100%", bgcolor: "primary.main", transition: "width 0.1s" }} />
              </Box>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
        <Tabs
          value={tab}
          onChange={(_, v) => v && setTab(v)}
          variant="fullWidth"
          sx={{ minHeight: 48, "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 600 } }}
        >
          <Tab value="trim" icon={<ContentCutIcon />} iconPosition="start" label="Trim" />
          <Tab value="crop" icon={<CropIcon />} iconPosition="start" label="Crop" />
          <Tab value="quality" icon={<VideocamIcon />} iconPosition="start" label="Quality" />
        </Tabs>
      </Box>
      <DialogActions sx={{ px: 2, py: 1.25, gap: 1 }}>
        <Button onClick={onClose} disabled={processing} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={processing || !duration}
          startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, minWidth: 96 }}
        >
          {processing ? "Processing…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
