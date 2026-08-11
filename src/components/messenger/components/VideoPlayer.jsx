import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Box, IconButton, Typography, Menu, MenuItem, Tooltip,
  Dialog, Backdrop, Fade, CircularProgress,
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
import CloseIcon from "@mui/icons-material/Close";
import ExpandIcon from "@mui/icons-material/Expand";
import VideocamIcon from "@mui/icons-material/Videocam";

import videojs from "video.js";
import "video.js/dist/video-js.css";
import { withTokenQuery, formatDuration } from "../messengerUtils";

/**
 * Professional video player built on top of video.js (industry-standard,
 * battle-tested HTML5 player from Netflix/Mux/etc.). Supports:
 *  - Smooth seeking (HTML5 RangeRequest)
 *  - Playback rate (0.25×–2×)
 *  - Volume + mute
 *  - Fullscreen + Picture-in-Picture
 *  - Skip ±10s (keyboard arrows or buttons)
 *  - Buffered indicator on the progress bar
 *  - Auto-hide controls after 3s of inactivity
 *  - Click video to toggle play/pause
 *  - Theater mode for circular video messages (Telegram-style)
 *
 * Two render modes:
 *  1. Inline (default) — rectangular video with custom Telegram-style overlay
 *  2. Circular (video message) — small 220×220 circle in chat; click opens
 *     a Theater modal with centered circular video on darkened backdrop
 *
 * Why video.js? The previous hand-rolled player had several broken behaviors:
 *  - Audio "dragging" (scrubbing the seek bar) caused 1-3s lag spikes because
 *    the underlying HTML5 audio element was being controlled imperatively
 *    from a React slider with `step={0.1}` — causing thousands of
 *    currentTime writes per drag.
 *  - The `onSeek` callback set `v.currentTime` directly without buffering
 *    the user's drag intent, fighting the timeupdate event.
 * video.js handles this with its own seekBar component that batches the
 * writes and shows a "scrubbing" state.
 */
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export default function VideoPlayer({
  src,
  filename = "video.mp4",
  contentType,
  poster,
  circular = false,
  maxWidth = 360,
  maxHeight = 360,
  autoPlay = false,
  muted: mutedProp = false,
}) {
  const videoRef = useRef(null);        // <video> element
  const playerRef = useRef(null);        // video.js Player instance
  const containerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(mutedProp);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState(null);
  const [theaterOpen, setTheaterOpen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ---- Initialise video.js player once ----
  useEffect(() => {
    if (!videoRef.current) return;
    // video.js needs a <video> with class video-js.
    videoRef.current.classList.add("video-js", "vjs-big-play-centered");
    const player = videojs(videoRef.current, {
      controls: false,           // we render our own controls overlay
      autoplay: autoPlay,
      muted: mutedProp,
      preload: "metadata",
      fluid: false,              // we manage sizing via the container
      poster: poster || undefined,
      playbackRates: SPEEDS,
      html5: {
        vhs: { overrideNative: true },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      sources: [{
        src: withTokenQuery(src),
        type: guessVideoType(src, contentType),
      }],
      // Suppress video.js' own error display — we surface errors in our UI
      errorDisplay: false,
    });
    playerRef.current = player;

    player.on("play", () => setIsPlaying(true));
    player.on("pause", () => setIsPlaying(false));
    player.on("ended", () => setIsPlaying(false));
    player.on("timeupdate", () => setCurrentTime(player.currentTime() || 0));
    player.on("durationchange", () => setDuration(player.duration() || 0));
    player.on("loadedmetadata", () => setDuration(player.duration() || 0));
    player.on("volumechange", () => {
      setVolume(player.volume());
      setMuted(player.muted());
    });
    player.on("ratechange", () => setSpeed(player.playbackRate()));
    player.on("progress", () => {
      const b = player.buffered();
      if (b && b.length) {
        try { setBuffered(b.end(b.length - 1)); } catch { /* */ }
      }
    });
    player.on("waiting", () => setLoading(true));
    player.on("playing", () => setLoading(false));
    player.on("canplay", () => setLoading(false));
    player.on("error", () => {
      const err = player.error();
      setErrorMsg(err ? `Playback error (${err.code})` : "Playback error");
      setLoading(false);
      setIsPlaying(false);
    });

    return () => {
      try { player.dispose(); } catch { /* */ }
      playerRef.current = null;
    };
    // We deliberately do NOT include `src` in deps — changing src is handled
    // by the separate effect below. We want video.js to initialise ONCE.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Update src when prop changes (e.g. theater opens, parent swaps video) ----
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const nextSrc = withTokenQuery(src);
    const currentSrc = player.src();
    if (currentSrc !== nextSrc) {
      setErrorMsg("");
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      player.src({ src: nextSrc, type: guessVideoType(src, contentType) });
      if (poster) player.poster(poster);
      else player.poster("");
      if (autoPlay) {
        const p = player.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    }
  }, [src, poster, autoPlay, contentType]);

  // ---- Cleanup on unmount ----
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // ---- Fullscreen listener ----
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.paused()) {
      const pr = p.play();
      if (pr && typeof pr.catch === "function") pr.catch(() => {});
    } else {
      p.pause();
    }
  }, []);

  const skip = useCallback((delta) => {
    const p = playerRef.current;
    if (!p) return;
    const d = p.duration() || 0;
    p.currentTime(Math.max(0, Math.min(d, (p.currentTime() || 0) + delta)));
  }, []);

  const onSeek = (_, value) => {
    const p = playerRef.current;
    if (!p || !isFinite(value)) return;
    p.currentTime(value);
    setCurrentTime(value);
  };

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.muted(!p.muted());
  }, []);

  const onVolumeChange = (_, value) => {
    const p = playerRef.current;
    if (!p) return;
    p.volume(value);
    p.muted(value === 0);
  };

  const changeSpeed = (s) => {
    const p = playerRef.current;
    if (!p) return;
    p.playbackRate(s);
    setSpeed(s);
    setSpeedMenuAnchor(null);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      try { await el.requestFullscreen(); } catch { /* */ }
    } else {
      try { await document.exitFullscreen(); } catch { /* */ }
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
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ---- ROBUST AUTO-HIDE ----
  // Decouple "user activity" from timeupdate ticks so controls actually hide.
  const armHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      const p = playerRef.current;
      if (p && !p.paused() && !speedMenuAnchor) {
        setShowControls(false);
      }
    }, 2800);
  }, [speedMenuAnchor]);

  useEffect(() => {
    armHideTimer();
  }, [armHideTimer, isPlaying, theaterOpen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = () => armHideTimer();
    const onKey = (e) => {
      if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") skip(-10);
      else if (e.key === "ArrowRight") skip(10);
      else if (e.key === "m") toggleMute();
      else if (e.key === "f") toggleFullscreen();
      armHideTimer();
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("touchstart", onMove, { passive: true });
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchstart", onMove);
      el.removeEventListener("keydown", onKey);
    };
  }, [armHideTimer, togglePlay, skip, toggleMute, toggleFullscreen]);

  // When theater opens, try to autoplay
  useEffect(() => {
    if (theaterOpen && playerRef.current) {
      const p = playerRef.current;
      const pr = p.play();
      if (pr && typeof pr.catch === "function") pr.catch(() => {});
    }
  }, [theaterOpen]);

  const openTheater = () => setTheaterOpen(true);
  const closeTheater = () => {
    if (playerRef.current) {
      try { playerRef.current.pause(); } catch { /* */ }
    }
    setTheaterOpen(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // ---- RENDER: shared controls bar (Telegram-style overlay) ----
  const renderControls = () => {
    const accentColor = "#fff";
    return (
      <Box
        sx={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, transparent 100%)",
          px: 1.25, py: 0.75,
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        {/* Seek bar with buffered indicator */}
        <Box sx={{ position: "relative", mb: 0.5, px: 0.5 }}>
          <Box sx={{ position: "relative", height: 14, display: "flex", alignItems: "center" }}>
            <Box sx={{
              position: "absolute", left: 0, right: 0, height: 4,
              bgcolor: "rgba(255,255,255,0.25)",
              borderRadius: 2,
              overflow: "hidden",
            }}>
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${bufferedPct}%`,
                bgcolor: "rgba(255,255,255,0.4)",
                transition: "width 0.2s linear",
              }} />
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress}%`,
                bgcolor: "#1976d2",
                transition: "width 0.05s linear",
              }} />
            </Box>
            {/* Custom seek slider overlay (transparent so video.js' seek bar doesn't conflict) */}
            <Box
              sx={{
                position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
                zIndex: 2,
                "& input[type=range]": {
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  WebkitAppearance: "none", appearance: "none",
                  background: "transparent", cursor: "pointer",
                  margin: 0, padding: 0,
                },
                "& input[type=range]::-webkit-slider-thumb": {
                  WebkitAppearance: "none", appearance: "none",
                  width: 14, height: 14, borderRadius: "50%",
                  bgcolor: "#fff", border: "2px solid #1976d2",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                  cursor: "pointer",
                },
                "& input[type=range]::-moz-range-thumb": {
                  width: 14, height: 14, borderRadius: "50%",
                  bgcolor: "#fff", border: "2px solid #1976d2",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                  cursor: "pointer",
                },
              }}
            >
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={Math.min(currentTime, duration || 1)}
                onChange={(e) => onSeek(null, parseFloat(e.target.value))}
              />
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "row", gap: 0.5, alignItems: "center", color: accentColor }}>
          <IconButton size="small" onClick={togglePlay} sx={{ color: accentColor }}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={() => skip(-10)} sx={{ color: accentColor }}>
            <Replay10Icon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={() => skip(10)} sx={{ color: accentColor }}>
            <Forward10Icon fontSize="small" />
          </IconButton>
          <Typography
            variant="caption"
            sx={{
              fontVariantNumeric: "tabular-nums",
              minWidth: 76, color: accentColor, fontSize: 11,
              fontWeight: 500, ml: 0.5,
            }}
          >
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {/* Volume */}
          <Box sx={{ display: "flex", alignItems: "center", maxWidth: 110 }}>
            <IconButton size="small" onClick={toggleMute} sx={{ color: accentColor }}>
              {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Box
              sx={{
                width: 60, ml: 0.5,
                "& input[type=range]": {
                  width: "100%", height: 4, WebkitAppearance: "none", appearance: "none",
                  bgcolor: "rgba(255,255,255,0.3)", borderRadius: 2,
                  outline: "none",
                },
                "& input[type=range]::-webkit-slider-thumb": {
                  WebkitAppearance: "none", appearance: "none",
                  width: 10, height: 10, borderRadius: "50%", bgcolor: "#fff", cursor: "pointer",
                },
                "& input[type=range]::-moz-range-thumb": {
                  width: 10, height: 10, borderRadius: "50%", bgcolor: "#fff", border: "none", cursor: "pointer",
                },
              }}
            >
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(null, parseFloat(e.target.value))}
              />
            </Box>
          </Box>
          {/* Speed */}
          <Tooltip title="Playback speed">
            <IconButton size="small" onClick={(e) => setSpeedMenuAnchor(e.currentTarget)} sx={{ color: accentColor }}>
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
              <IconButton size="small" onClick={togglePiP} sx={{ color: accentColor }}>
                <PictureInPictureIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {/* Download */}
          <Tooltip title="Download">
            <IconButton size="small" onClick={onDownload} sx={{ color: accentColor }}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {/* Fullscreen — hidden in circular inline mode */}
          {!circular && (
            <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <IconButton size="small" onClick={toggleFullscreen} sx={{ color: accentColor }}>
                {fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  };

  // ---- RENDER: center play button when paused ----
  const renderCenterPlay = () => (
    <Fade in={!isPlaying && !loading} timeout={200}>
      <Box
        onClick={togglePlay}
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.35)",
          cursor: "pointer",
          transition: "background-color 0.2s",
          "&:hover": { bgcolor: "rgba(0,0,0,0.45)" },
        }}
      >
        <Box sx={{
          bgcolor: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(8px)",
          borderRadius: "50%",
          width: 64, height: 64,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          border: "2px solid rgba(255,255,255,0.25)",
        }}>
          <PlayArrowIcon sx={{ fontSize: 36, ml: 0.5 }} />
        </Box>
      </Box>
    </Fade>
  );

  // ---- RENDER: loading spinner ----
  const renderLoading = () => (
    <Fade in={loading} timeout={200}>
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.25)",
          pointerEvents: "none",
        }}
      >
        <CircularProgress size={48} sx={{ color: "#fff" }} />
      </Box>
    </Fade>
  );

  // ---- RENDER: error message ----
  const renderError = () => errorMsg && (
    <Box
      sx={{
        position: "absolute",
        left: 8, right: 8, bottom: 60,
        bgcolor: "rgba(180,30,30,0.85)",
        color: "#fff", fontSize: 12,
        px: 1.5, py: 0.75, borderRadius: 1,
        pointerEvents: "none",
        textAlign: "center",
      }}
    >
      {errorMsg}
    </Box>
  );

  // ---- RENDER: shared video element (video.js mounts onto it) ----
  const renderVideo = (extraStyle = {}) => (
    <video
      ref={videoRef}
      playsInline
      preload="metadata"
      style={{
        width: "100%",
        height: "100%",
        objectFit: circular ? "cover" : "contain",
        display: "block",
        borderRadius: circular ? "50%" : 0,
        ...extraStyle,
      }}
    />
  );

  // ---- RENDER: circular inline (in-chat video message) ----
  if (circular) {
    return (
      <>
        <Box
          sx={{
            width: 220, height: 220,
            position: "relative",
            display: "inline-block",
            borderRadius: "50%",
            cursor: "pointer",
            background: "#000",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 0 4px rgba(0,0,0,0.6)",
          }}
          onClick={openTheater}
        >
          <Box sx={{
            width: "100%", height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            position: "relative",
            bgcolor: "#000",
          }}>
            {renderVideo()}
            {/* Always-visible play indicator (small) */}
            <Box
              onClick={(e) => { e.stopPropagation(); openTheater(); }}
              sx={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(0,0,0,0.25)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.4)" },
                transition: "background-color 0.2s",
              }}
            >
              <Box sx={{
                bgcolor: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(6px)",
                borderRadius: "50%",
                width: 52, height: 52,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
                border: "2px solid rgba(255,255,255,0.3)",
              }}>
                {isPlaying
                  ? <PauseIcon sx={{ fontSize: 28 }} />
                  : <PlayArrowIcon sx={{ fontSize: 28, ml: 0.5 }} />}
              </Box>
            </Box>
            <Box
              onClick={(e) => { e.stopPropagation(); openTheater(); }}
              sx={{
                position: "absolute",
                top: 8, right: 8,
                bgcolor: "rgba(0,0,0,0.6)",
                borderRadius: "50%",
                width: 26, height: 26,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              <ExpandIcon sx={{ fontSize: 16 }} />
            </Box>
            {!src && (
              <Box sx={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.5)",
              }}>
                <VideocamIcon sx={{ fontSize: 40 }} />
              </Box>
            )}
          </Box>
        </Box>

        {/* THEATER MODAL — full-screen dark backdrop + centered circle */}
        <Dialog
          open={theaterOpen}
          onClose={closeTheater}
          fullScreen
          PaperProps={{
            sx: {
              bgcolor: "transparent",
              boxShadow: "none",
              overflow: "hidden",
            },
          }}
          BackdropComponent={(props) => (
            <Backdrop
              {...props}
              sx={{
                bgcolor: "rgba(0,0,0,0.92)",
                backdropFilter: "blur(4px)",
              }}
            />
          )}
          TransitionComponent={Fade}
          transitionDuration={250}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
            }}
          >
            <IconButton
              onClick={closeTheater}
              sx={{
                position: "absolute",
                top: 16, right: 16,
                color: "#fff",
                bgcolor: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(8px)",
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
                width: 40, height: 40,
              }}
            >
              <CloseIcon />
            </IconButton>

            <Box
              ref={containerRef}
              onMouseMove={() => armHideTimer()}
              onMouseLeave={() => {
                if (isPlaying) setShowControls(false);
              }}
              sx={{
                position: "relative",
                width: { xs: 280, sm: 340, md: 400 },
                height: { xs: 280, sm: 340, md: 400 },
                borderRadius: "50%",
                bgcolor: "#000",
                boxShadow: "0 0 0 8px rgba(0,0,0,0.5), 0 0 80px rgba(0,0,0,0.9), 0 0 120px rgba(25, 118, 210, 0.2)",
                overflow: "hidden",
                cursor: showControls ? "default" : "pointer",
              }}
            >
              {renderVideo()}
              {renderLoading()}
              {renderError()}
              {!isPlaying && !loading && (
                <Box
                  onClick={togglePlay}
                  sx={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bgcolor: "rgba(0,0,0,0.4)",
                    cursor: "pointer",
                  }}
                >
                  <Box sx={{
                    bgcolor: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    borderRadius: "50%",
                    width: 80, height: 80,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff",
                    border: "2px solid rgba(255,255,255,0.3)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  }}>
                    <PlayArrowIcon sx={{ fontSize: 44, ml: 0.5 }} />
                  </Box>
                </Box>
              )}
              {renderControls()}
            </Box>

            <Typography
              variant="caption"
              sx={{
                mt: 3,
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                maxWidth: 400,
                textAlign: "center",
              }}
            >
              {filename}
            </Typography>
          </Box>
        </Dialog>
      </>
    );
  }

  // ---- RENDER: rectangular inline player ----
  return (
    <Box
      ref={containerRef}
      onMouseMove={() => armHideTimer()}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      sx={{
        position: "relative",
        bgcolor: "#000",
        width: "100%",
        maxWidth,
        maxHeight,
        borderRadius: 2,
        overflow: "hidden",
        cursor: showControls ? "default" : "pointer",
      }}
    >
      {renderVideo()}
      {renderLoading()}
      {renderError()}
      {renderCenterPlay()}
      {renderControls()}
    </Box>
  );
}

/** Guess the video MIME type from the URL — falls back to video/mp4. */
function guessVideoType(url, contentType) {
  const ct = (contentType || "").toLowerCase().split(";")[0].trim();
  if (ct.startsWith("video/") || ct === "application/x-mpegurl" || ct === "application/dash+xml") {
    return ct;
  }
  if (!url) return "video/mp4";
  const u = url.toLowerCase().split("?")[0];
  if (u.endsWith(".webm")) return "video/webm";
  if (u.endsWith(".mov")) return "video/quicktime";
  if (u.endsWith(".ogg") || u.endsWith(".ogv")) return "video/ogg";
  if (u.endsWith(".m3u8")) return "application/x-mpegURL";
  if (u.endsWith(".mpd")) return "application/dash+xml";
  return "video/mp4";
}
