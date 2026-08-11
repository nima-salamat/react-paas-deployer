import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Box, IconButton, Slider, Stack, Typography, Menu, MenuItem, Tooltip, alpha,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import Replay10Icon from "@mui/icons-material/Replay10";
import Forward10Icon from "@mui/icons-material/Forward10";
import SpeedIcon from "@mui/icons-material/Speed";
import DownloadIcon from "@mui/icons-material/Download";
import PictureInPictureIcon from "@mui/icons-material/PictureInPicture";

import { formatDuration, withTokenQuery } from "../messengerUtils";

/**
 * Premium video player with custom controls (Telegram-style overlay).
 *
 * Features:
 *  - Play/pause, seek slider, time display
 *  - Skip ±10s
 *  - Volume control + mute
 *  - Playback speed (0.5×–2×) via menu
 *  - Fullscreen toggle
 *  - Picture-in-Picture support
 *  - Download button
 *  - Auto-hide controls after 3s of inactivity
 *  - Click on video to toggle play/pause
 *
 * Props:
 *  - src: string (video URL)
 *  - filename: string (for download)
 *  - poster: string (optional, poster image URL)
 *  - circular: boolean (default false) — Telegram-style circular video message
 *  - maxWidth: number (default 360)
 *  - maxHeight: number (default 360)
 */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({
  src,
  filename = "video.mp4",
  poster,
  circular = false,
  maxWidth = 360,
  maxHeight = 360,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState(null);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const skip = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + delta));
    setCurrentTime(v.currentTime);
  };

  const onSeek = (_, value) => {
    const v = videoRef.current;
    if (!v || !isFinite(value)) return;
    v.currentTime = value;
    setCurrentTime(value);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const onVolumeChange = (_, value) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = value;
    v.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  };

  const changeSpeed = (s) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setSpeedMenuAnchor(null);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try {
        await el.requestFullscreen();
      } catch { /* */ }
    } else {
      try {
        await document.exitFullscreen();
      } catch { /* */ }
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch { /* */ }
  };

  const onDownload = () => {
    const a = document.createElement("a");
    a.href = withTokenQuery(src);
    a.download = filename;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Fullscreen change listener
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Auto-hide controls
  const pokeControls = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  useEffect(() => {
    pokeControls();
  }, [pokeControls, isPlaying, currentTime]);

  // Cleanup
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const containerSx = circular
    ? { width: 220, height: 220, borderRadius: "50%", overflow: "hidden" }
    : { width: "100%", maxWidth, maxHeight, borderRadius: 1.5, overflow: "hidden", aspectRatio: "auto" };

  return (
    <Box
      ref={containerRef}
      onMouseMove={pokeControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      sx={{
        position: "relative",
        bgcolor: "#000",
        ...containerSx,
        cursor: showControls ? "default" : "pointer",
      }}
    >
      <video
        ref={videoRef}
        src={withTokenQuery(src)}
        poster={poster}
        onClick={togglePlay}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
        playsInline
        preload="metadata"
        style={{
          width: "100%",
          height: "100%",
          objectFit: circular ? "cover" : "contain",
          display: "block",
        }}
      />

      {/* Center play button (when paused) */}
      {!isPlaying && (
        <Box
          onClick={togglePlay}
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.25)",
            cursor: "pointer",
          }}
        >
          <Box sx={{
            bgcolor: "rgba(0,0,0,0.6)",
            borderRadius: "50%",
            width: 56, height: 56,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff",
          }}>
            <PlayArrowIcon sx={{ fontSize: 32 }} />
          </Box>
        </Box>
      )}

      {/* Bottom controls overlay */}
      <Box
        sx={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          px: 1, py: 0.5,
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.2s",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        {/* Progress bar with buffered indicator */}
        <Box sx={{ position: "relative", mb: 0.5 }}>
          <Slider
            value={currentTime}
            max={duration || 1}
            min={0}
            step={0.1}
            onChange={onSeek}
            size="small"
            sx={{
              color: "#1976d2",
              height: 4,
              "& .MuiSlider-thumb": { width: 12, height: 12, bgcolor: "#1976d2" },
              "& .MuiSlider-rail": { bgcolor: "rgba(255,255,255,0.3)" },
              "& .MuiSlider-track": { bgcolor: "#1976d2" },
            }}
          />
        </Box>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "#fff" }}>
          <IconButton size="small" onClick={togglePlay} sx={{ color: "#fff" }}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={() => skip(-10)} sx={{ color: "#fff" }}>
            <Replay10Icon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => skip(10)} sx={{ color: "#fff" }}>
            <Forward10Icon fontSize="small" />
          </IconButton>
          <Typography variant="caption" sx={{ fontVariantNumeric: "tabular-nums", minWidth: 80, color: "#fff", fontSize: 11 }}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {/* Volume */}
          <Box sx={{ display: "flex", alignItems: "center", "&:hover .vol-slider": { width: 60 } }}>
            <IconButton size="small" onClick={toggleMute} sx={{ color: "#fff" }}>
              {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
              className="vol-slider"
              size="small"
              min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={onVolumeChange}
              sx={{
                width: 0, transition: "width 0.2s", color: "#fff",
                "& .MuiSlider-thumb": { width: 10, height: 10 },
              }}
            />
          </Box>
          {/* Speed */}
          <Tooltip title="Playback speed">
            <IconButton size="small" onClick={(e) => setSpeedMenuAnchor(e.currentTarget)} sx={{ color: "#fff" }}>
              <SpeedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={speedMenuAnchor}
            open={Boolean(speedMenuAnchor)}
            onClose={() => setSpeedMenuAnchor(null)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
            transformOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            {SPEEDS.map((s) => (
              <MenuItem key={s} onClick={() => changeSpeed(s)} selected={s === speed} dense>
                {s === 1 ? "Normal" : `${s}×`}
              </MenuItem>
            ))}
          </Menu>
          {/* PiP */}
          {"pictureInPictureEnabled" in document && (
            <Tooltip title="Picture in picture">
              <IconButton size="small" onClick={togglePiP} sx={{ color: "#fff" }}>
                <PictureInPictureIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Download */}
          <Tooltip title="Download">
            <IconButton size="small" onClick={onDownload} sx={{ color: "#fff" }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Fullscreen */}
          {!circular && (
            <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <IconButton size="small" onClick={toggleFullscreen} sx={{ color: "#fff" }}>
                {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
