import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Box, Stack, Typography, IconButton, Slider, MenuItem, Select, FormControl, Tooltip, alpha,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import Replay10Icon from "@mui/icons-material/Replay10";
import Forward10Icon from "@mui/icons-material/Forward10";
import LoopIcon from "@mui/icons-material/Loop";
import DownloadIcon from "@mui/icons-material/Download";

import { formatDuration, withTokenQuery } from "../messengerUtils";

/**
 * Premium audio player bar (Telegram-style). Renders a fixed bar at the top
 * of the chat pane when audioPlayer state is non-null.
 *
 * Features:
 *  - Play/pause, seek slider, current time / duration display
 *  - Waveform-style visualization (canvas, computed from the audio buffer)
 *  - Playback speed control (0.5×–2×)
 *  - Volume control with mute toggle
 *  - Skip ±10 seconds
 *  - Loop toggle
 *  - Download button
 *  - Persists across chat switches (lives in MessengerApp, not MessageBubble)
 *
 * Props:
 *  - player: { att, title } | null  — the currently-loaded audio attachment
 *  - onChange: (player) => void     — update parent state (e.g. to clear)
 */
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const WAVE_BARS = 60;

export default function AudioPlayerBar({ player, onChange }) {
  const audioRef = useRef(null);
  const waveCanvasRef = useRef(null);
  const waveDataRef = useRef(null);          // Float32Array of peak values
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [loadingWave, setLoadingWave] = useState(false);

  // Load new source when `player` changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!player) {
      a.pause();
      a.removeAttribute("src");
      waveDataRef.current = null;
      return;
    }
    const nextSrc = withTokenQuery(player.att.url);
    if (a.src !== nextSrc) {
      a.src = nextSrc;
      a.currentTime = 0;
      setCurrentTime(0);
      a.playbackRate = speed;
      a.volume = muted ? 0 : volume;
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      // Fetch the audio buffer to compute waveform
      loadWaveform(nextSrc);
    }
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch + decode audio buffer for waveform
  const loadWaveform = async (url) => {
    setLoadingWave(true);
    waveDataRef.current = null;
    try {
      const token = localStorage.getItem("access");
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("fetch failed");
      const buf = await res.arrayBuffer();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("no AudioContext");
      const ctx = new Ctx();
      const audioBuf = await ctx.decodeAudioData(buf);
      ctx.close();
      // Downsample to WAVE_BARS peaks
      const channel = audioBuf.getChannelData(0);
      const block = Math.floor(channel.length / WAVE_BARS);
      const peaks = new Float32Array(WAVE_BARS);
      for (let i = 0; i < WAVE_BARS; i++) {
        let max = 0;
        for (let j = 0; j < block; j++) {
          const v = Math.abs(channel[i * block + j] || 0);
          if (v > max) max = v;
        }
        peaks[i] = max;
      }
      waveDataRef.current = peaks;
      drawWaveform(currentTime);
    } catch (e) {
      // Silent fail — waveform is a nice-to-have, not critical
    } finally {
      setLoadingWave(false);
    }
  };

  // Draw waveform on canvas
  const drawWaveform = useCallback((t) => {
    const canvas = waveCanvasRef.current;
    const peaks = waveDataRef.current;
    if (!canvas || !peaks) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const barW = W / peaks.length;
    const progress = duration > 0 ? t / duration : 0;
    for (let i = 0; i < peaks.length; i++) {
      const barH = Math.max(2, peaks[i] * H * 0.9);
      const x = i * barW;
      const y = (H - barH) / 2;
      if (i / peaks.length <= progress) {
        ctx.fillStyle = "#1976d2";  // played — primary
      } else {
        ctx.fillStyle = "#bdbdbd";  // unplayed — grey
      }
      ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
    }
  }, [duration]);

  // Redraw waveform on time update
  useEffect(() => {
    drawWaveform(currentTime);
  }, [currentTime, drawWaveform]);

  // Apply playback rate
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  // Apply volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      a.pause();
      setIsPlaying(false);
    }
  }, []);

  const onSeek = (_, value) => {
    const a = audioRef.current;
    if (!a || !isFinite(value)) return;
    a.currentTime = value;
    setCurrentTime(value);
  };

  // Click on waveform to seek
  const onWaveClick = (e) => {
    const a = audioRef.current;
    const canvas = waveCanvasRef.current;
    if (!a || !canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    a.currentTime = ratio * duration;
    setCurrentTime(a.currentTime);
  };

  const skip = (delta) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
    setCurrentTime(a.currentTime);
  };

  const onClosePlayer = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.removeAttribute("src"); }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    waveDataRef.current = null;
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

  // Canvas dimensions (responsive-ish)
  const waveW = 200;
  const waveH = 32;

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
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => {
          if (!loop) setIsPlaying(false);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        loop={loop}
        preload="metadata"
      />
      <Stack direction="row" alignItems="center" spacing={0.75}>
        {/* Play/pause + skip */}
        <Tooltip title="Back 10s">
          <IconButton size="small" onClick={() => skip(-10)} disabled={!duration}>
            <Replay10Icon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton onClick={togglePlay} color="primary" size="small" sx={{ bgcolor: alpha("#1976d2", 0.1) }}>
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <Tooltip title="Forward 10s">
          <IconButton size="small" onClick={() => skip(10)} disabled={!duration}>
            <Forward10Icon fontSize="small" />
          </IconButton>
        </Tooltip>

        {/* Icon + title */}
        {isVoice
          ? <GraphicEqIcon color="action" fontSize="small" />
          : <MusicNoteIcon color="action" fontSize="small" />}
        <Typography variant="caption" noWrap sx={{ maxWidth: 140, fontWeight: 600 }}>
          {title}
        </Typography>

        {/* Waveform / slider */}
        <Box sx={{ flex: 1, minWidth: 80, display: "flex", alignItems: "center" }}>
          {waveDataRef.current ? (
            <canvas
              ref={waveCanvasRef}
              width={waveW}
              height={waveH}
              onClick={onWaveClick}
              style={{
                width: "100%",
                maxWidth: waveW,
                height: waveH,
                cursor: "pointer",
              }}
            />
          ) : (
            <Slider
              value={currentTime}
              max={duration || 1}
              min={0}
              step={0.1}
              onChange={onSeek}
              size="small"
              sx={{ flex: 1 }}
            />
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
          <Slider
            size="small"
            min={0} max={1} step={0.05}
            value={muted ? 0 : volume}
            onChange={(_, v) => { setVolume(v); setMuted(v === 0); }}
            sx={{ width: 50, ml: 0.5 }}
          />
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
    </Box>
  );
}
