import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Stack, Typography, IconButton, MenuItem, Select, FormControl, Tooltip, alpha,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CloseIcon from "@mui/icons-material/Close";
import StopIcon from "@mui/icons-material/Stop";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import Replay10Icon from "@mui/icons-material/Replay10";
import Forward10Icon from "@mui/icons-material/Forward10";
import LoopIcon from "@mui/icons-material/Loop";
import DownloadIcon from "@mui/icons-material/Download";

import WaveSurfer from "wavesurfer.js";
import { formatDuration, withTokenQuery } from "../messengerUtils";

/**
 * Premium audio player bar (Telegram-style). Renders a fixed bar at the top
 * of the chat pane when `player` is non-null.
 *
 * Built on top of wavesurfer.js — the de-facto standard for waveform audio
 * players in the web (used by Spotify web, SoundCloud, BBC, etc.).
 *
 * Why wavesurfer.js? The previous hand-rolled version had broken behaviors:
 *  - "Moving the music" (dragging the seek/waveform) didn't work because the
 *    custom canvas seek handler was racing with the <audio> element's
 *    timeupdate event, causing it to snap back to the old position.
 *  - The waveform was computed client-side via AudioContext.decodeAudioData
 *    which fails on cross-origin blobs (CORS) and produces no fallback.
 *  - The play() promise race was tracked with a ref but the seek slider
 *    still fought with the audio element.
 * wavesurfer.js handles all of this internally:
 *  - Drag the waveform to seek (with a smooth scrubbing preview)
 *  - Built-in peak fetching with CORS fallback
 *  - Proper play() promise handling
 *  - Speed / volume / loop all built-in
 *
 * Props:
 *  - player: { att, title } | null  — the currently-loaded audio attachment
 *  - onChange: (player) => void     — update parent state (e.g. to clear)
 *  - onStateChange: ({ isPlaying, currentTime, duration, attId }) => void
 */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayerBar({ player, onChange, onStateChange }) {
  const containerRef = useRef(null);       // div that wavesurfer mounts into
  const wsRef = useRef(null);              // WaveSurfer instance
  const pendingPlayRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [loadingWave, setLoadingWave] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Push state up to parent whenever it changes
  useEffect(() => {
    onStateChange?.({
      isPlaying,
      currentTime,
      duration,
      attId: player?.att?.id ?? null,
    });
  }, [isPlaying, currentTime, duration, player, onStateChange]);

  // ---- Initialise WaveSurfer once ----
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#bdbdbd",
      progressColor: "#1976d2",
      cursorColor: "#1976d2",
      cursorWidth: 2,
      barWidth: 2,
      barRadius: 2,
      barGap: 2,
      height: 32,
      normalize: true,
      interact: true,           // click to seek
      hideScrollbar: true,
      fillParent: true,
      minPxPerSec: 50,
      // mediaControls: false — we use our own controls
      backend: "MediaElement",  // use <audio> element so we can use crossOrigin
    });
    wsRef.current = ws;

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      if (!loop) {
        try { ws.seekTo(0); } catch { /* */ }
        setCurrentTime(0);
      }
    });
    ws.on("timeupdate", (t) => setCurrentTime(t || 0));
    ws.on("ready", (dur) => {
      // wavesurfer v7 ready event passes the duration
      setDuration(dur || ws.getDuration() || 0);
      setLoadingWave(false);
    });
    ws.on("loading", () => setLoadingWave(true));
    ws.on("error", () => {
      setErrorMsg("Could not load audio");
      setLoadingWave(false);
      setIsPlaying(false);
    });
    ws.on("decode", (dur) => setDuration(dur || ws.getDuration() || 0));

    return () => {
      try { ws.destroy(); } catch { /* */ }
      wsRef.current = null;
    };
  }, []);

  // ---- Load new source when `player` changes ----
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    if (!player) {
      try { ws.pause(); } catch { /* */ }
      try { ws.setTime(0); } catch { /* */ }
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setErrorMsg("");
      // Clear the waveform
      try { ws.empty(); } catch { /* */ }
      return;
    }
    const nextSrc = withTokenQuery(player.att.url);
    setLoadingWave(true);
    setErrorMsg("");
    setCurrentTime(0);
    setDuration(0);
    //wavesurfer v7 — load() accepts a URL or HTMLMediaElement
    try {
      ws.load(nextSrc);
      if (player.autoPlay) {
        const playWhenReady = () => {
          const p = ws.play();
          if (p && typeof p.catch === "function") {
            p.catch((err) => {
              if (err && err.name !== "AbortError") {
                setErrorMsg("Playback blocked. Click again to retry.");
              }
            });
          }
        };
        ws.once("ready", playWhenReady);
      }
    } catch (e) {
      setErrorMsg("Could not load audio");
      setLoadingWave(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  // Sync speed / volume / loop
  useEffect(() => {
    try { wsRef.current?.setPlaybackRate(speed); } catch { /* */ }
  }, [speed]);

  useEffect(() => {
    try {
      if (wsRef.current) {
        wsRef.current.setVolume(muted ? 0 : volume);
      }
    } catch { /* */ }
  }, [volume, muted]);

  // ---- Toggle play/pause ----
  const togglePlay = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !player) return;
    if (pendingPlayRef.current) return;
    if (ws.isPlaying()) {
      try { ws.pause(); } catch { /* */ }
      setIsPlaying(false);
    } else {
      pendingPlayRef.current = true;
      const p = ws.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          pendingPlayRef.current = false;
          setIsPlaying(true);
        }).catch((err) => {
          pendingPlayRef.current = false;
          setIsPlaying(false);
          if (err && err.name !== "AbortError") {
            setErrorMsg("Playback blocked. Click again to retry.");
          }
        });
      } else {
        pendingPlayRef.current = false;
        setIsPlaying(true);
      }
    }
  }, [player]);

  // ---- Listen for external toggle / seek requests (from inline bubble play button) ----
  useEffect(() => {
    if (!player) return;
    const onToggle = () => togglePlay();
    const onSeekEv = (e) => {
      const ws = wsRef.current;
      const ratio = e?.detail?.ratio;
      if (!ws || typeof ratio !== "number") return;
      const d = ws.getDuration() || 0;
      if (!d) return;
      try { ws.seekTo(Math.max(0, Math.min(1, ratio))); } catch { /* */ }
      setCurrentTime(Math.max(0, Math.min(1, ratio)) * d);
    };
    window.addEventListener("messenger:audio-toggle", onToggle);
    window.addEventListener("messenger:audio-seek", onSeekEv);
    return () => {
      window.removeEventListener("messenger:audio-toggle", onToggle);
      window.removeEventListener("messenger:audio-seek", onSeekEv);
    };
  }, [player, togglePlay]);

  // ---- Stop button — reset to 0 and pause ----
  const stopAll = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try { ws.pause(); } catch { /* */ }
    try { ws.seekTo(0); } catch { /* */ }
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const skip = (delta) => {
    const ws = wsRef.current;
    if (!ws) return;
    const d = ws.getDuration() || 0;
    const t = Math.max(0, Math.min(d, (ws.getCurrentTime() || 0) + delta));
    try { ws.setTime(t); } catch { /* */ }
    setCurrentTime(t);
  };

  const onClosePlayer = () => {
    const ws = wsRef.current;
    if (ws) {
      try { ws.pause(); } catch { /* */ }
      try { ws.empty(); } catch { /* */ }
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMsg("");
    onChange(null);
  };

  const onDownload = () => {
    if (!player?.att?.url) return;
    const a = document.createElement("a");
    a.href = withTokenQuery(player.att.url);
    a.download = player.att.original_filename || "audio.mp3";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isVoice = player?.att?.kind === "voice" || (player?.att?.original_filename || "").startsWith("voice_");

  if (!player) return null;
  const title = player.title || player.att?.original_filename || "Audio";

  return (
    <Box
      sx={{
        position: "absolute",
        top: 56,
        left: 0,
        right: 0,
        zIndex: 10,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        px: 1.5,
        py: 0.75,
        boxShadow: 1,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={0.75}>
        {/* Skip back */}
        <Tooltip title="Back 10s">
          <span>
            <IconButton size="small" onClick={() => skip(-10)} disabled={!duration}>
              <Replay10Icon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Play/pause — prominent */}
        <Tooltip title={isPlaying ? "Pause" : "Play"}>
          <IconButton
            onClick={togglePlay}
            color="primary"
            size="small"
            sx={{
              bgcolor: alpha("#1976d2", 0.15),
              width: 36, height: 36,
              "&:hover": { bgcolor: alpha("#1976d2", 0.28) },
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>

        {/* Stop — reset to 0 */}
        <Tooltip title="Stop">
          <span>
            <IconButton size="small" onClick={stopAll} disabled={!duration && !isPlaying}>
              <StopIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Skip forward */}
        <Tooltip title="Forward 10s">
          <span>
            <IconButton size="small" onClick={() => skip(10)} disabled={!duration}>
              <Forward10Icon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Icon + title */}
        {isVoice
          ? <GraphicEqIcon color="action" fontSize="small" />
          : <MusicNoteIcon color="action" fontSize="small" />}
        <Typography variant="caption" noWrap sx={{ maxWidth: 140, fontWeight: 600 }}>
          {title}
        </Typography>

        {/* Waveform — wavesurfer mounts into this div */}
        <Box
          sx={{
            flex: 1,
            minWidth: 80,
            display: "flex",
            alignItems: "center",
            minHeight: 32,
            position: "relative",
            cursor: "pointer",
            // Tame the wavesurfer canvas so it fits our bar height
            "& div": { width: "100% !important" },
          }}
        >
          <div ref={containerRef} style={{ width: "100%" }} />
          {loadingWave && (
            <Typography variant="caption" color="text.secondary" sx={{ position: "absolute", left: 8 }}>
              Loading…
            </Typography>
          )}
        </Box>

        {/* Time */}
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 80, textAlign: "right" }}>
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </Typography>

        {/* Speed */}
        <FormControl size="small" sx={{ minWidth: 56 }}>
          <Select
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            sx={{ height: 28, "& .MuiSelect-select": { py: 0.3, px: 1, fontSize: 12 } }}
            renderValue={(v) => `${v}×`}
          >
            {SPEEDS.map((s) => (
              <MenuItem key={s} value={s} dense>{`${s}× speed`}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Volume */}
        <Box sx={{ display: "flex", alignItems: "center", maxWidth: 100 }}>
          <IconButton size="small" onClick={() => setMuted((m) => !m)}>
            {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
          <Box
            sx={{
              width: 50, ml: 0.5,
              "& input[type=range]": {
                width: "100%", height: 4, WebkitAppearance: "none", appearance: "none",
                bgcolor: "action.hover", borderRadius: 2, outline: "none",
              },
              "& input[type=range]::-webkit-slider-thumb": {
                WebkitAppearance: "none", appearance: "none",
                width: 10, height: 10, borderRadius: "50%", bgcolor: "primary.main", cursor: "pointer",
              },
              "& input[type=range]::-moz-range-thumb": {
                width: 10, height: 10, borderRadius: "50%", bgcolor: "primary.main", border: "none", cursor: "pointer",
              },
            }}
          >
            <input
              type="range"
              min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                setMuted(v === 0);
              }}
            />
          </Box>
        </Box>

        {/* Loop */}
        <Tooltip title={loop ? "Loop on" : "Loop off"}>
          <IconButton size="small" onClick={() => setLoop((l) => !l)} color={loop ? "primary" : "default"}>
            <LoopIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Download */}
        <Tooltip title="Download">
          <IconButton size="small" onClick={onDownload}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Close */}
        <IconButton onClick={onClosePlayer} size="small" title="Stop & close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {errorMsg && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25, pl: 1 }}>
          {errorMsg}
        </Typography>
      )}
    </Box>
  );
}
