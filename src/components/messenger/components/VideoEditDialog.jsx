import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, ToggleButton, ToggleButtonGroup, CircularProgress,
  LinearProgress, FormControlLabel, Switch, alpha, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import HighQualityIcon from "@mui/icons-material/HighQuality";
import GifBoxIcon from "@mui/icons-material/GifBox";
import CropIcon from "@mui/icons-material/Crop";

/**
 * Advanced video editor:
 *  - Trim (start / end)
 *  - Free crop with edge handles
 *  - Aspect presets
 *  - Compression quality
 *  - Send as GIF when trim length < 60s
 *  - Done stores settings (deferred process on send); restores initialEdits
 */

const QUALITY = [
  { id: "p360", label: "360p · small" },
  { id: "p480", label: "480p" },
  { id: "p720", label: "720p" },
  { id: "p1080", label: "1080p" },
  { id: "original", label: "Original" },
];

const ASPECTS = [
  { id: "free", label: "Free", value: null },
  { id: "1:1", label: "1:1", value: 1 },
  { id: "16:9", label: "16:9", value: 16 / 9 },
  { id: "9:16", label: "9:16", value: 9 / 16 },
  { id: "4:3", label: "4:3", value: 4 / 3 },
];

const MIN_CROP = 40;
const HIT = 22;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function fitContain(nw, nh, sw, sh) {
  const scale = Math.min(sw / nw, sh / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  return { scale, x: (sw - dw) / 2, y: (sh - dh) / 2, w: dw, h: dh };
}

function applyAspect(rect, aspect, bounds) {
  if (!aspect) return rect;
  let { x, y, w, h } = rect;
  const cx = x + w / 2;
  const cy = y + h / 2;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, bounds.w);
  h = Math.min(h, bounds.h);
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  x = clamp(cx - w / 2, bounds.x, bounds.x + bounds.w - w);
  y = clamp(cy - h / 2, bounds.y, bounds.y + bounds.h - h);
  return { x, y, w, h };
}

export default function VideoEditDialog({
  open,
  file,
  onClose,
  onConfirm,
  confirmLabel = "Done",
  initialEdits = null,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const fileUrlRef = useRef(null);
  const dragRef = useRef(null);

  const [src, setSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [quality, setQuality] = useState("p720");
  const [aspectId, setAspectId] = useState("free");
  const [crop, setCrop] = useState(null); // stage coords
  const [layout, setLayout] = useState(null); // video fit in stage
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [asGif, setAsGif] = useState(false);
  const [gifFps, setGifFps] = useState(8);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const aspect = ASPECTS.find((a) => a.id === aspectId)?.value ?? null;
  const trimLen = Math.max(0, trimEnd - trimStart);
  const canGif = trimLen > 0 && trimLen <= 60;

  // Load
  useEffect(() => {
    if (!open || !file) {
      setSrc("");
      return undefined;
    }
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setSrc(url);
    setError("");
    setBusy(false);
    setIsPlaying(false);

    const r = initialEdits || {};
    setQuality(r.quality || "p720");
    setAspectId(r.aspectId || "free");
    setAsGif(Boolean(r.asGif));
    setGifFps(r.gifFps || 8);
    // trim restored after metadata
    return () => {
      try {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          videoRef.current.load();
        }
      } catch { /* */ }
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = null;
      }
    };
  }, [open, file, initialEdits]);

  const measureLayout = useCallback(() => {
    const stage = stageRef.current;
    const v = videoRef.current;
    if (!stage || !v || !v.videoWidth) return;
    const sw = stage.clientWidth || 360;
    const sh = stage.clientHeight || 240;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    setVideoSize({ w: vw, h: vh });
    const fit = fitContain(vw, vh, sw, sh);
    setLayout(fit);

    const restore = initialEdits?.crop;
    if (restore && restore.w > 0) {
      setCrop({
        x: fit.x + restore.x * fit.scale,
        y: fit.y + restore.y * fit.scale,
        w: restore.w * fit.scale,
        h: restore.h * fit.scale,
      });
    } else {
      setCrop({ x: fit.x, y: fit.y, w: fit.w, h: fit.h });
    }
  }, [initialEdits]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    const r = initialEdits || {};
    const ts = r.trimStart != null ? clamp(r.trimStart, 0, d) : 0;
    const te = r.trimEnd != null ? clamp(r.trimEnd, ts + 0.05, d) : d;
    setTrimStart(ts);
    setTrimEnd(te);
    setCurrentTime(ts);
    v.currentTime = ts;
    requestAnimationFrame(measureLayout);
  };

  useEffect(() => {
    if (!open) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const ro = new ResizeObserver(() => measureLayout());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [open, measureLayout]);

  useEffect(() => {
    if (!crop || !layout || !aspect) return;
    setCrop((c) => applyAspect(c, aspect, layout));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId]);

  useEffect(() => {
    if (!canGif && asGif) setAsGif(false);
  }, [canGif, asGif]);

  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd - 0.04) {
      v.pause();
      setIsPlaying(false);
      v.currentTime = trimStart;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd - 0.05) v.currentTime = trimStart;
      v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (t) => {
    const v = videoRef.current;
    if (!v) return;
    const next = clamp(t, trimStart, Math.max(trimStart, trimEnd - 0.05));
    v.currentTime = next;
    setCurrentTime(next);
  };

  const getStagePoint = (e) => {
    const rect = stageRef.current.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const onPointerDownCrop = (e, handle) => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    const p = getStagePoint(e);
    dragRef.current = { type: handle || "move", ox: p.x, oy: p.y, start: { ...crop } };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || !layout) return;
    const p = getStagePoint(e);
    const dx = p.x - d.ox;
    const dy = p.y - d.oy;
    const b = layout;
    let { x: cx, y: cy, w, h } = d.start;
    if (d.type === "move") {
      cx = clamp(d.start.x + dx, b.x, b.x + b.w - w);
      cy = clamp(d.start.y + dy, b.y, b.y + b.h - h);
      setCrop({ x: cx, y: cy, w, h });
      return;
    }
    const t = d.type;
    if (t.includes("w")) {
      const nx = clamp(d.start.x + dx, b.x, d.start.x + d.start.w - MIN_CROP);
      w = d.start.w + (d.start.x - nx);
      cx = nx;
    }
    if (t.includes("e")) {
      w = clamp(d.start.w + dx, MIN_CROP, b.x + b.w - d.start.x);
      cx = d.start.x;
    }
    if (t.includes("n")) {
      const ny = clamp(d.start.y + dy, b.y, d.start.y + d.start.h - MIN_CROP);
      h = d.start.h + (d.start.y - ny);
      cy = ny;
    }
    if (t.includes("s")) {
      h = clamp(d.start.h + dy, MIN_CROP, b.y + b.h - d.start.y);
      cy = d.start.y;
    }
    let next = { x: cx, y: cy, w, h };
    if (aspect) next = applyAspect(next, aspect, b);
    next.w = clamp(next.w, MIN_CROP, b.w);
    next.h = clamp(next.h, MIN_CROP, b.h);
    next.x = clamp(next.x, b.x, b.x + b.w - next.w);
    next.y = clamp(next.y, b.y, b.y + b.h - next.h);
    setCrop(next);
  };

  const onPointerUp = () => { dragRef.current = null; };

  const naturalCrop = () => {
    if (!crop || !layout) return null;
    return {
      x: (crop.x - layout.x) / layout.scale,
      y: (crop.y - layout.y) / layout.scale,
      w: crop.w / layout.scale,
      h: crop.h / layout.scale,
    };
  };

  /** Done: save settings + poster frame preview (process on send). */
  const handleConfirm = async () => {
    const v = videoRef.current;
    if (!v || !duration) return;
    setBusy(true);
    setError("");
    try {
      const cropNat = naturalCrop();
      const edits = {
        pending: true,
        trimStart,
        trimEnd,
        quality,
        aspectId,
        aspect: aspect || null,
        crop: cropNat,
        asGif: Boolean(asGif && canGif),
        gifFps,
        videoWidth: videoSize.w,
        videoHeight: videoSize.h,
      };

      // Poster frame for composer thumbnail
      const c = document.createElement("canvas");
      const maxEdge = 640;
      let pw = videoSize.w || 640;
      let ph = videoSize.h || 360;
      if (cropNat) {
        pw = Math.max(1, Math.round(cropNat.w));
        ph = Math.max(1, Math.round(cropNat.h));
      }
      const scale = Math.min(1, maxEdge / Math.max(pw, ph));
      c.width = Math.max(2, Math.round(pw * scale));
      c.height = Math.max(2, Math.round(ph * scale));
      const ctx = c.getContext("2d");
      v.pause();
      const seekT = clamp(trimStart, 0, Math.max(0, duration - 0.05));
      v.currentTime = seekT;
      await new Promise((r) => {
        const done = () => { v.removeEventListener("seeked", done); r(); };
        v.addEventListener("seeked", done);
        setTimeout(r, 400);
      });
      if (cropNat) {
        ctx.drawImage(
          v,
          cropNat.x, cropNat.y, cropNat.w, cropNat.h,
          0, 0, c.width, c.height,
        );
      } else {
        ctx.drawImage(v, 0, 0, c.width, c.height);
      }

      const blob = await new Promise((resolve, reject) => {
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("poster failed"))), "image/jpeg", 0.85);
      });

      // Use a video-typed placeholder name so composer still treats as video unless GIF
      const base = (file?.name || "video").replace(/\.[^.]+$/, "");
      // Store poster as jpeg but keep type hint via edits; composer checks file.type
      // Better: keep original file type on a tiny webm is hard — use File with video type
      // and attach poster URL is not available. Use original file as carrier with edits only?
      // Simpler approach: return a lightweight File copy of original with edits attached
      // AND a separate poster - messenger only supports one file. So attach edits to a
      // copy of the original bytes so preview can still play video in composer.

      // Read original into new File so composer plays full video until send
      const buf = await file.arrayBuffer();
      const carrier = new File([buf], `${base}_pending.mp4`, { type: file.type || "video/mp4" });
      onConfirm?.(carrier, carrier.name, edits, blob);
    } catch (e) {
      setError(e?.message || "Could not save video settings");
    } finally {
      setBusy(false);
    }
  };

  const previewH = isMobile
    ? Math.min(320, typeof window !== "undefined" ? window.innerHeight * 0.36 : 260)
    : 360;

  const handleDefs = [
    { id: "nw", cursor: "nwse-resize", left: -HIT / 2, top: -HIT / 2 },
    { id: "n", cursor: "ns-resize", left: "50%", top: -HIT / 2, ml: -HIT / 2 },
    { id: "ne", cursor: "nesw-resize", right: -HIT / 2, top: -HIT / 2 },
    { id: "e", cursor: "ew-resize", right: -HIT / 2, top: "50%", mt: -HIT / 2 },
    { id: "se", cursor: "nwse-resize", right: -HIT / 2, bottom: -HIT / 2 },
    { id: "s", cursor: "ns-resize", left: "50%", bottom: -HIT / 2, ml: -HIT / 2 },
    { id: "sw", cursor: "nesw-resize", left: -HIT / 2, bottom: -HIT / 2 },
    { id: "w", cursor: "ew-resize", left: -HIT / 2, top: "50%", mt: -HIT / 2 },
  ];

  return (
    <Dialog
      open={Boolean(open)}
      onClose={busy ? undefined : onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? "100%" : "94vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ py: 1.25, px: 1.5, display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <ContentCutIcon fontSize="small" color="primary" />
        <Typography component="span" variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>Edit video</Typography>
        <IconButton edge="end" onClick={onClose} disabled={busy}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {/* Stage */}
        <Box
          ref={stageRef}
          sx={{
            position: "relative",
            width: "100%",
            height: previewH,
            bgcolor: "#000",
            touchAction: "none",
            userSelect: "none",
            overflow: "hidden",
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            <Box
              component="video"
              ref={videoRef}
              src={src}
              playsInline
              muted={false}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onClick={togglePlay}
              sx={{
                position: "absolute",
                left: layout?.x ?? 0,
                top: layout?.y ?? 0,
                width: layout?.w ?? "100%",
                height: layout?.h ?? "100%",
                objectFit: "fill",
                display: "block",
              }}
            />
          )}

          {/* Crop overlay */}
          {crop && layout && (
            <>
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: alpha("#000", 0.45),
                  clipPath: `polygon(
                    0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                    ${crop.x}px ${crop.y}px,
                    ${crop.x}px ${crop.y + crop.h}px,
                    ${crop.x + crop.w}px ${crop.y + crop.h}px,
                    ${crop.x + crop.w}px ${crop.y}px,
                    ${crop.x}px ${crop.y}px
                  )`,
                }}
              />
              <Box
                onPointerDown={(e) => onPointerDownCrop(e, "move")}
                sx={{
                  position: "absolute",
                  left: crop.x,
                  top: crop.y,
                  width: crop.w,
                  height: crop.h,
                  border: "1.5px solid rgba(255,255,255,0.95)",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
                  cursor: "move",
                  boxSizing: "border-box",
                }}
              >
                {handleDefs.map((h) => (
                  <Box
                    key={h.id}
                    onPointerDown={(e) => onPointerDownCrop(e, h.id)}
                    sx={{
                      position: "absolute",
                      width: HIT,
                      height: HIT,
                      left: h.left,
                      right: h.right,
                      top: h.top,
                      bottom: h.bottom,
                      ml: h.ml,
                      mt: h.mt,
                      cursor: h.cursor,
                      touchAction: "none",
                      zIndex: 3,
                      ...(h.id.length === 2 ? {
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          width: 12,
                          height: 12,
                          borderStyle: "solid",
                          borderColor: "#fff",
                          borderWidth: 0,
                          ...(h.id === "nw" ? { left: 4, top: 4, borderTopWidth: 2, borderLeftWidth: 2 } : {}),
                          ...(h.id === "ne" ? { right: 4, top: 4, borderTopWidth: 2, borderRightWidth: 2 } : {}),
                          ...(h.id === "se" ? { right: 4, bottom: 4, borderBottomWidth: 2, borderRightWidth: 2 } : {}),
                          ...(h.id === "sw" ? { left: 4, bottom: 4, borderBottomWidth: 2, borderLeftWidth: 2 } : {}),
                        },
                      } : {
                        "&::after": {
                          content: '""',
                          position: "absolute",
                          bgcolor: "#fff",
                          ...(h.id === "n" || h.id === "s"
                            ? { width: 18, height: 2, left: "50%", top: "50%", ml: "-9px", mt: "-1px" }
                            : { width: 2, height: 18, left: "50%", top: "50%", ml: "-1px", mt: "-9px" }),
                        },
                      }),
                    }}
                  />
                ))}
              </Box>
            </>
          )}

          <IconButton
            onClick={togglePlay}
            sx={{
              position: "absolute",
              bottom: 10,
              left: 10,
              bgcolor: alpha("#000", 0.55),
              color: "#fff",
              width: 44,
              height: 44,
              "&:hover": { bgcolor: alpha("#000", 0.75) },
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <Typography
            variant="caption"
            sx={{
              position: "absolute",
              bottom: 16,
              right: 12,
              color: "#fff",
              bgcolor: alpha("#000", 0.5),
              px: 1,
              py: 0.25,
              borderRadius: 1,
              fontWeight: 600,
            }}
          >
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </Typography>
        </Box>

        {/* Controls */}
        <Box sx={{ px: 2, py: 1.5, overflow: "auto", flex: 1 }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
            <ContentCutIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.4}>
              TRIM
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {fmtTime(trimLen)}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
            <Typography variant="caption" fontWeight={600}>{fmtTime(trimStart)}</Typography>
            <Typography variant="caption" fontWeight={600}>{fmtTime(trimEnd)}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">Start</Typography>
          <Slider
            value={trimStart}
            min={0}
            max={duration || 0}
            step={0.05}
            onChange={(_, v) => {
              const next = clamp(v, 0, Math.max(0, trimEnd - 0.1));
              setTrimStart(next);
              seekTo(next);
            }}
            disabled={!duration || busy}
            size={isMobile ? "medium" : "small"}
            sx={{ mb: 0.5 }}
          />
          <Typography variant="caption" color="text.secondary">End</Typography>
          <Slider
            value={trimEnd}
            min={0}
            max={duration || 0}
            step={0.05}
            onChange={(_, v) => {
              setTrimEnd(clamp(v, Math.min(duration, trimStart + 0.1), duration || 0));
            }}
            disabled={!duration || busy}
            size={isMobile ? "medium" : "small"}
            sx={{ mb: 1.5 }}
          />

          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
            <CropIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.4}>
              FRAME
            </Typography>
          </Stack>
          <Box sx={{ overflowX: "auto", mb: 1.5, WebkitOverflowScrolling: "touch" }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={aspectId}
              onChange={(_, v) => v && setAspectId(v)}
              sx={{ "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: 12.5, px: 1.25 } }}
            >
              {ASPECTS.map((a) => (
                <ToggleButton key={a.id} value={a.id}>{a.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
            <HighQualityIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="caption" fontWeight={700} color="text.secondary" letterSpacing={0.4}>
              COMPRESSION
            </Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={quality}
            onChange={(_, v) => v && setQuality(v)}
            sx={{
              mb: 1.5,
              flexWrap: "wrap",
              "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, fontSize: 11.5, py: 0.7 },
            }}
          >
            {QUALITY.map((q) => (
              <ToggleButton key={q.id} value={q.id}>{q.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* GIF — only when trim < 60s */}
          {canGif && (
            <Box
              sx={{
                mb: 1,
                p: 1.25,
                borderRadius: 2,
                border: "1px solid",
                borderColor: asGif ? "primary.main" : "divider",
                bgcolor: (t) => asGif ? alpha(t.palette.primary.main, 0.08) : "transparent",
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={asGif}
                    onChange={(_, c) => setAsGif(c)}
                    color="primary"
                  />
                }
                label={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <GifBoxIcon fontSize="small" color={asGif ? "primary" : "inherit"} />
                    <Box>
                      <Typography variant="body2" fontWeight={700}>Send as GIF</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Clip is {fmtTime(trimLen)} (under 1 min)
                      </Typography>
                    </Box>
                  </Stack>
                }
                sx={{ m: 0, width: "100%", alignItems: "flex-start" }}
              />
              {asGif && (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, pl: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36 }}>FPS</Typography>
                  <Slider
                    value={gifFps}
                    min={4}
                    max={12}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    onChange={(_, v) => setGifFps(v)}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                </Stack>
              )}
            </Box>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Settings are saved on Done · video / GIF is processed when you send
          </Typography>
          {error && (
            <Typography color="error" variant="caption" sx={{ display: "block", mt: 0.75 }}>{error}</Typography>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider", gap: 1 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={busy || !duration}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ textTransform: "none", fontWeight: 700, minWidth: 110 }}
        >
          {busy ? "Saving…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
