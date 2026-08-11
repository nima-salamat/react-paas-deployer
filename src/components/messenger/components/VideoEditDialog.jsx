import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Slider, IconButton, Tooltip, CircularProgress, alpha,
  ToggleButton, ToggleButtonGroup, Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VideocamIcon from "@mui/icons-material/Videocam";
import CheckIcon from "@mui/icons-material/Check";
import ReplayIcon from "@mui/icons-material/Replay";
import CropFreeIcon from "@mui/icons-material/CropFree";

/**
 * Lightweight video trim/crop dialog.
 *
 * Why no ffmpeg.wasm? ffmpeg.wasm is ~25MB and adds 30+ seconds of init time.
 * For a messenger app, users want fast feedback. So we use the native
 * MediaRecorder + Canvas approach:
 *  - Trim: pick a start/end range. We render the video frame-by-frame onto
 *    a canvas, capture the canvas via canvas.captureStream(), and record it
 *    with MediaRecorder. This produces a new WebM file with only the selected
 *    range.
 *  - Crop: pick a rectangular region. We apply object-fit + transform on
 *    the canvas to draw only that region.
 *
 * Tradeoffs:
 *  - Output is always WebM (MediaRecorder doesn't support MP4 in most browsers)
 *  - Re-encodes the video (some quality loss)
 *  - For videos > 1 min, processing can take ~50% of the video duration
 *  - Audio is preserved via captureStream() audio track
 *
 * Props:
 *  - open: boolean
 *  - file: File | null   (the original video file)
 *  - onClose: () => void
 *  - onConfirm: (blob: Blob, filename: string) => void
 */
export default function VideoEditDialog({ open, file, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const rafRef = useRef(null);
  const playbackStartRef = useRef(0);
  const fileUrlRef = useRef(null);

  const [src, setSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [cropMode, setCropMode] = useState("none"); // "none" | "square" | "4:3" | "16:9"
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  // ---- Load file into <video> ----
  useEffect(() => {
    if (!open || !file) {
      setSrc("");
      return;
    }
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
    }
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
    return () => {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
        fileUrlRef.current = null;
      }
    };
  }, [open, file]);

  // ---- When metadata loads, set trim range to full video ----
  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    setTrimStart(0);
    setTrimEnd(d);
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // If currentTime is outside trim range, reset to trim start
      if (v.currentTime < trimStart || v.currentTime > trimEnd - 0.05) {
        v.currentTime = trimStart;
      }
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [trimStart, trimEnd]);

  // ---- Play loop: pause when reaching trim end ----
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd && !v.paused) {
      v.pause();
      v.currentTime = trimStart;
    }
  };

  // ---- Drawing video frame to canvas (for crop preview + processing) ----
  const drawFrame = useCallback(() => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Determine output canvas size based on crop mode
    let outW = v.videoWidth || 640;
    let outH = v.videoHeight || 480;
    if (cropMode === "square") {
      const s = Math.min(outW, outH);
      // Center crop
      const sx = (outW - s) / 2;
      const sy = (outH - s) / 2;
      c.width = s;
      c.height = s;
      ctx.drawImage(v, sx, sy, s, s, 0, 0, s, s);
    } else if (cropMode === "4:3") {
      // Compute 4:3 region centered on the source
      const targetRatio = 4 / 3;
      const srcRatio = outW / outH;
      let sw, sh, sx, sy;
      if (srcRatio > targetRatio) {
        sh = outH;
        sw = sh * targetRatio;
        sx = (outW - sw) / 2;
        sy = 0;
      } else {
        sw = outW;
        sh = sw / targetRatio;
        sx = 0;
        sy = (outH - sh) / 2;
      }
      c.width = sw;
      c.height = sh;
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    } else if (cropMode === "16:9") {
      const targetRatio = 16 / 9;
      const srcRatio = outW / outH;
      let sw, sh, sx, sy;
      if (srcRatio > targetRatio) {
        sh = outH;
        sw = sh * targetRatio;
        sx = (outW - sw) / 2;
        sy = 0;
      } else {
        sw = outW;
        sh = sw / targetRatio;
        sx = 0;
        sy = (outH - sh) / 2;
      }
      c.width = sw;
      c.height = sh;
      ctx.drawImage(v, sx, sy, sw, sh, 0, 0, sw, sh);
    } else {
      c.width = outW;
      c.height = outH;
      ctx.drawImage(v, 0, 0, outW, outH);
    }
  }, [cropMode]);

  // ---- Render canvas continuously while playing ----
  useEffect(() => {
    if (!isPlaying) return;
    const tick = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, drawFrame]);

  // ---- PROCESS: re-encode the trimmed+cropped video to WebM ----
  const handleConfirm = useCallback(async () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    setProcessing(true);
    setError("");
    setProgress(0);
    try {
      // Set canvas to final size
      drawFrame();
      // Capture canvas + audio from the original video element
      const canvasStream = c.captureStream(30);
      // Audio: capture from the video element via captureStream (Chromium) or
      // fall back to no audio (Firefox doesn't support HTMLMediaElement.captureStream).
      let audioTracks = [];
      try {
        if (v.captureStream) {
          const vStream = v.captureStream();
          audioTracks = vStream.getAudioTracks();
        } else if (v.mozCaptureStream) {
          const vStream = v.mozCaptureStream();
          audioTracks = vStream.getAudioTracks();
        }
      } catch { /* no audio */ }
      audioTracks.forEach((t) => canvasStream.addTrack(t));

      // Pick a supported mimeType
      const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      let mimeType = "";
      for (const ct of candidates) {
        if (MediaRecorder.isTypeSupported(ct)) { mimeType = ct; break; }
      }
      if (!mimeType) {
        throw new Error("Browser does not support WebM recording");
      }

      const mr = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      const done = new Promise((resolve) => { mr.onstop = resolve; });
      mr.start(100);

      // Start playback at trimStart, play until trimEnd
      v.currentTime = trimStart;
      v.muted = false;
      // Wait a tick for seek to complete
      await new Promise((r) => setTimeout(r, 50));
      playbackStartRef.current = performance.now();
      await v.play().catch(() => {});

      // Update progress periodically
      const totalDuration = Math.max(0.1, trimEnd - trimStart);
      const progressInterval = setInterval(() => {
        const elapsed = v.currentTime - trimStart;
        const pct = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        setProgress(pct);
        drawFrame();
      }, 100);

      // Stop when reaching trimEnd
      const stopCheck = setInterval(() => {
        if (v.currentTime >= trimEnd || v.paused) {
          clearInterval(stopCheck);
          clearInterval(progressInterval);
          try { v.pause(); } catch { /* */ }
          try { mr.stop(); } catch { /* */ }
        }
      }, 50);

      await done;
      clearInterval(progressInterval);
      clearInterval(stopCheck);

      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const originalName = file?.name || "video.mp4";
      const baseName = originalName.replace(/\.[^.]+$/, "");
      const filename = `${baseName}_edit.webm`;
      onConfirm(blob, filename);
    } catch (e) {
      setError(e?.message || "Could not process video");
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  }, [drawFrame, file, onConfirm, trimEnd, trimStart]);

  const formatTime = (t) => {
    if (!isFinite(t)) return "0:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 5 }}>
        <ContentCutIcon color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Edit video</Typography>
        <IconButton size="small" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {/* Hidden source video element */}
          <Box sx={{ position: "relative", bgcolor: "#000", borderRadius: 2, overflow: "hidden" }}>
            <video
              ref={videoRef}
              src={src}
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "contain" }}
              playsInline
              controls={false}
            />
            {/* Canvas overlay for crop preview */}
            <canvas
              ref={canvasRef}
              style={{
                position: "absolute",
                top: 0, left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                opacity: cropMode === "none" ? 0 : 1,
                objectFit: "contain",
              }}
            />
            {/* Play overlay */}
            <IconButton
              onClick={togglePlay}
              sx={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                bgcolor: "rgba(0,0,0,0.7)",
                color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.85)" },
                width: 56, height: 56,
              }}
            >
              {isPlaying ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayArrowIcon sx={{ fontSize: 32 }} />}
            </IconButton>
          </Box>

          {/* Trim slider */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <ContentCutIcon fontSize="small" /> Trim
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {formatTime(trimStart)} – {formatTime(trimEnd)} ({formatTime(trimEnd - trimStart)})
              </Typography>
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={[trimStart, trimEnd]}
                min={0}
                max={duration || 1}
                step={0.1}
                onChange={(_, v) => {
                  const [s, e] = v;
                  setTrimStart(s);
                  setTrimEnd(e);
                  if (videoRef.current) {
                    if (videoRef.current.currentTime < s) videoRef.current.currentTime = s;
                    if (videoRef.current.currentTime > e) videoRef.current.currentTime = e;
                  }
                }}
                valueLabelDisplay="auto"
                valueLabelFormat={formatTime}
                disableSwap
              />
            </Box>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Button
                size="small"
                onClick={() => {
                  const v = videoRef.current;
                  if (v) { v.currentTime = trimStart; setCurrentTime(trimStart); }
                }}
              >
                Jump to start
              </Button>
              <Button
                size="small"
                onClick={() => {
                  const v = videoRef.current;
                  if (v) { v.currentTime = Math.max(0, trimEnd - 0.5); setCurrentTime(v.currentTime); }
                }}
              >
                Jump to end
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                onClick={() => {
                  setTrimStart(0);
                  setTrimEnd(duration);
                }}
              >
                Reset trim
              </Button>
            </Stack>
          </Box>

          {/* Crop mode picker */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <CropFreeIcon fontSize="small" /> Crop / aspect ratio
            </Typography>
            <ToggleButtonGroup
              value={cropMode}
              exclusive
              onChange={(_, v) => setCropMode(v || "none")}
              size="small"
            >
              <ToggleButton value="none">Original</ToggleButton>
              <ToggleButton value="square">1:1 Square</ToggleButton>
              <ToggleButton value="4:3">4:3</ToggleButton>
              <ToggleButton value="16:9">16:9</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              Output will be re-encoded as WebM. Audio is preserved.
            </Typography>
          </Box>

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
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={processing || !duration}
          startIcon={processing ? <CircularProgress size={16} /> : <CheckIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
        >
          {processing ? "Processing…" : "Apply & save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
