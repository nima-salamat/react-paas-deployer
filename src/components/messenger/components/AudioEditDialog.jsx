import React, { useEffect, useRef, useState } from "react";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Slider, Stack, Typography, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import ContentCutIcon from "@mui/icons-material/ContentCut";

function fmtTime(value) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function encodeWav(buffer, start, end) {
  const channels = Math.min(2, buffer.numberOfChannels || 1);
  const sampleRate = buffer.sampleRate;
  const first = Math.max(0, Math.floor(start * sampleRate));
  const last = Math.min(buffer.length, Math.ceil(end * sampleRate));
  const frames = Math.max(0, last - first);
  const blockAlign = channels * 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = frames * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const sourceIndex = first + i;
    for (let ch = 0; ch < channels; ch++) {
      let sample = buffer.getChannelData(ch)[sourceIndex] || 0;
      sample = Math.max(-1, Math.min(1, sample));
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, pcm, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: "audio/wav" });
}

export default function AudioEditDialog({
  open,
  file,
  onClose,
  onConfirm,
  confirmLabel = "Done",
  initialEdits = null,
}) {
  const audioRef = useRef(null);
  const urlRef = useRef(null);
  const [src, setSrc] = useState("");
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !file) {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      setSrc("");
      setDuration(0);
      setPlaying(false);
      return undefined;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setSrc(url);
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
    setBusy(false);
    setError("");
    return () => {
      if (urlRef.current === url) {
        URL.revokeObjectURL(url);
        urlRef.current = null;
      }
    };
  }, [open, file]);

  useEffect(() => {
    if (!open || !audioRef.current || !src) return;
    const audio = audioRef.current;
    const onLoaded = () => {
      const d = Number(audio.duration) || 0;
      setDuration(d);
      const max = d;
      const initial = initialEdits || {};
      const start = Math.max(0, Math.min(max, Number(initial.start) || 0));
      const end = Math.max(start, Math.min(max, Number(initial.end) || max));
      setTrimStart(start);
      setTrimEnd(end || max);
    };
    const onTime = () => setCurrentTime(Number(audio.currentTime) || 0);
    const onEnded = () => setPlaying(false);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
    };
  }, [open, src, initialEdits]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || busy) return;
    if (audio.paused) {
      if (audio.currentTime < trimStart || audio.currentTime >= trimEnd) {
        audio.currentTime = trimStart;
      }
      await audio.play().catch(() => {});
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const onSeek = (_event, value) => {
    const next = Number(value);
    setCurrentTime(next);
    if (audioRef.current) audioRef.current.currentTime = next;
  };

  const onTrimChange = (_event, value, activeThumb) => {
    if (!Array.isArray(value)) return;
    let start = Number(value[0]);
    let end = Number(value[1]);
    if (end - start < 0.1) {
      if (activeThumb === 0) start = Math.max(0, end - 0.1);
      else end = Math.min(duration, start + 0.1);
    }
    setTrimStart(start);
    setTrimEnd(end);
  };

  const apply = async () => {
    if (!file || !duration || trimEnd <= trimStart) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("Audio editing is not supported in this browser.");
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const blob = encodeWav(decoded, trimStart, trimEnd);
      try { await ctx.close(); } catch { /* */ }

      const base = (file.name || "audio").replace(/\.[^.]+$/, "");
      const next = new File([blob], `${base}_edited.wav`, { type: "audio/wav" });
      next._messengerAudioEdits = { start: trimStart, end: trimEnd };
      onConfirm?.(next, next.name, { start: trimStart, end: trimEnd });
    } catch (e) {
      setError(e?.message || "Could not edit this audio file.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pr: 6 }}>
        Edit audio
        <IconButton
          onClick={onClose}
          disabled={busy}
          sx={{ position: "absolute", right: 8, top: 8 }}
          aria-label="Close audio editor"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <audio ref={audioRef} src={src} preload="metadata" />
        {error && (
          <Box sx={{ mb: 1.25, p: 1, borderRadius: 1.5, bgcolor: "error.main", color: "error.contrastText" }}>
            <Typography variant="body2">{error}</Typography>
          </Box>
        )}
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton onClick={togglePlay} disabled={!duration || busy} color="primary">
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={700}>Audio</Typography>
              <Typography variant="caption" color="text.secondary">
                {fmtTime(currentTime)} / {fmtTime(duration)}
              </Typography>
            </Box>
            <ContentCutIcon color="action" />
          </Stack>
          <Slider
            value={currentTime}
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.01}
            onChange={onSeek}
            disabled={!duration || busy}
            aria-label="Audio position"
          />
          <Typography variant="caption" color="text.secondary">
            Drag the two handles below to choose the section to keep.
          </Typography>
          <Slider
            value={[trimStart, trimEnd]}
            min={0}
            max={Math.max(duration, 0.1)}
            step={0.01}
            onChange={onTrimChange}
            disabled={!duration || busy}
            disableSwap
            valueLabelDisplay="auto"
            valueLabelFormat={fmtTime}
            aria-label="Audio trim range"
          />
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption">{fmtTime(trimStart)}</Typography>
            <Typography variant="caption">{fmtTime(trimEnd)}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button
          variant="contained"
          onClick={apply}
          disabled={busy || !duration || trimEnd <= trimStart}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <ContentCutIcon />}
        >
          {busy ? "Processing…" : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
