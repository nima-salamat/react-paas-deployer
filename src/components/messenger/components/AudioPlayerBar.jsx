import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, Stack, Typography, IconButton, Menu, MenuItem, ListItemIcon, Switch, alpha,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SkipNextRoundedIcon from "@mui/icons-material/SkipNextRounded";
import SkipPreviousRoundedIcon from "@mui/icons-material/SkipPreviousRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";
import MusicNoteRoundedIcon from "@mui/icons-material/MusicNoteRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ChatRoundedIcon from "@mui/icons-material/ChatRounded";
import QueueMusicRoundedIcon from "@mui/icons-material/QueueMusicRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";

import { formatDuration, withTokenQuery } from "../messengerUtils";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/**
 * Module-level singleton <audio> so the bar can unmount/remount
 * (chat header ↔ mobile list) without stopping playback.
 */
const MEDIA_DEVICES_KEY = "messenger.mediaDevices";

const shared = {
  audio: null,
  listenersBound: false,
  gen: 0,
  sinkApplied: "",
};

function getSharedAudio() {
  if (!shared.audio) {
    const a = new Audio();
    a.preload = "metadata";
    shared.audio = a;
  }
  return shared.audio;
}

function readSavedSpeakerId() {
  try {
    return JSON.parse(localStorage.getItem(MEDIA_DEVICES_KEY) || "{}").speakerId || "";
  } catch { return ""; }
}

async function applyAudioOutput(forceId) {
  const audio = getSharedAudio();
  // Firefox/Safari have no setSinkId — silent no-op (OS default only)
  if (typeof audio.setSinkId !== "function") return false;
  const next = (forceId != null ? forceId : readSavedSpeakerId()) || "";
  if (shared.sinkApplied === next && (audio.sinkId || "") === next) return true;
  try {
    await audio.setSinkId(next);
    shared.sinkApplied = next;
    return true;
  } catch (err) {
    // NotFoundError (unplugged) / NotAllowedError (no user gesture yet)
    try {
      await audio.setSinkId("");
      shared.sinkApplied = "";
    } catch { /* */ }
    if (err && (err.name === "NotFoundError" || /not found|device/i.test(String(err.message || "")))) {
      try {
        const saved = JSON.parse(localStorage.getItem(MEDIA_DEVICES_KEY) || "{}");
        if (saved.speakerId) {
          delete saved.speakerId;
          localStorage.setItem(MEDIA_DEVICES_KEY, JSON.stringify(saved));
        }
      } catch { /* */ }
    }
    return false;
  }
}

/**
 * Thin Telegram-style mini-player.
 * Place ABOVE the chat user header, or ABOVE the list search bar on mobile.
 */
export default function AudioPlayerBar({ player, onChange, onStateChange, onGoToTrack }) {
  const pendingPlayRef = useRef(false);
  const scrubbingRef = useRef(false);
  const continuousRef = useRef(true);
  const playerRef = useRef(player);
  playerRef.current = player;

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [continuous, setContinuous] = useState(true);
  const [loopOne, setLoopOne] = useState(false);

  continuousRef.current = continuous;

  useEffect(() => {
    applyAudioOutput();
    const onDevices = (e) => applyAudioOutput(e?.detail?.speakerId != null ? e.detail.speakerId : undefined);
    const onStorage = (ev) => { if (ev.key === MEDIA_DEVICES_KEY) applyAudioOutput(); };
    window.addEventListener("messenger:media-devices-changed", onDevices);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("messenger:media-devices-changed", onDevices);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Bind singleton audio events once (across remounts)
  useEffect(() => {
    const audio = getSharedAudio();
    if (shared.listenersBound) {
      setIsPlaying(!audio.paused && !audio.ended);
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration && isFinite(audio.duration) ? audio.duration : 0);
      applyAudioOutput();
      return undefined;
    }
    shared.listenersBound = true;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      if (scrubbingRef.current) return;
      setCurrentTime(audio.currentTime || 0);
    };
    const onMeta = () => setDuration(audio.duration && isFinite(audio.duration) ? audio.duration : 0);
    const onDur = () => setDuration(audio.duration && isFinite(audio.duration) ? audio.duration : 0);
    const onWait = () => setLoading(true);
    const onCan = () => setLoading(false);
    const onPlaying = () => { setLoading(false); setIsPlaying(true); };
    const onError = () => {
      setErrorMsg("Could not load");
      setLoading(false);
      setIsPlaying(false);
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("waiting", onWait);
    audio.addEventListener("canplay", onCan);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("error", onError);

    // ended handled below with continuous play (re-bound each mount is fine via separate effect)
  }, []);

  useEffect(() => {
    onStateChange?.({
      isPlaying,
      currentTime,
      duration,
      attId: player?.att?.id ?? null,
    });
  }, [isPlaying, currentTime, duration, player, onStateChange]);

  const attId = player?.att?.id ?? null;
  const attUrl = player?.att?.url ?? null;
  const wantAutoPlay = Boolean(player?.autoPlay);

  // Load source when attachment changes
  useEffect(() => {
    const audio = getSharedAudio();
    if (!attUrl) {
      try { audio.pause(); } catch { /* */ }
      // keep src if just UI remount with same player — only clear when player null handled by parent
      return;
    }

    const nextSrc = withTokenQuery(attUrl);
    if (!nextSrc) {
      setErrorMsg("No audio URL");
      return;
    }

    const gen = ++shared.gen;
    setLoading(true);
    setErrorMsg("");

    const prevId = audio.dataset.attId || "";
    const already = prevId && String(prevId) === String(attId) && audio.src && !audio.error;

    if (!already) {
      setCurrentTime(0);
      setDuration(0);
      audio.dataset.attId = String(attId ?? "");
      audio.src = nextSrc;
      audio.load();
    } else {
      setLoading(false);
      setIsPlaying(!audio.paused && !audio.ended);
      setCurrentTime(audio.currentTime || 0);
      setDuration(audio.duration && isFinite(audio.duration) ? audio.duration : 0);
    }

    if (wantAutoPlay) {
      const tryPlay = () => {
        if (gen !== shared.gen) return;
        if (!audio.paused && !audio.ended) {
          setIsPlaying(true);
          setLoading(false);
          return;
        }
        pendingPlayRef.current = true;
        applyAudioOutput().finally(() => {
          if (gen !== shared.gen) { pendingPlayRef.current = false; return; }
          const p = audio.play();
          if (p && typeof p.then === "function") {
            p.then(() => {
              pendingPlayRef.current = false;
              setIsPlaying(true);
              setLoading(false);
            }).catch((err) => {
              pendingPlayRef.current = false;
              if (err && err.name !== "AbortError") setErrorMsg("Tap play");
              setLoading(false);
            });
          } else {
            pendingPlayRef.current = false;
          }
        });
      };
      const onCanPlay = () => { tryPlay(); audio.removeEventListener("canplay", onCanPlay); };
      audio.addEventListener("canplay", onCanPlay);
      const t = setTimeout(tryPlay, already ? 0 : 40);
      return () => {
        clearTimeout(t);
        audio.removeEventListener("canplay", onCanPlay);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attId, attUrl]);

  useEffect(() => {
    try { getSharedAudio().playbackRate = speed; } catch { /* */ }
  }, [speed]);

  useEffect(() => {
    getSharedAudio().loop = loopOne;
  }, [loopOne]);

  const seekTo = useCallback((t) => {
    const audio = getSharedAudio();
    const d = audio.duration || duration || 0;
    if (!d || !isFinite(d)) return;
    const clamped = Math.max(0, Math.min(d, t));
    try { audio.currentTime = clamped; } catch { /* */ }
    setCurrentTime(clamped);
  }, [duration]);

  const playNext = useCallback(() => {
    const p = playerRef.current;
    if (!p?.queue?.length) return;
    const idx = typeof p.queueIndex === "number" ? p.queueIndex : 0;
    const next = p.queue[idx + 1];
    if (!next) return;
    onChange?.({
      ...next,
      autoPlay: true,
      queue: p.queue,
      queueIndex: idx + 1,
    });
  }, [onChange]);

  const playPrev = useCallback(() => {
    const p = playerRef.current;
    const audio = getSharedAudio();
    if (!p?.queue?.length) {
      seekTo(0);
      return;
    }
    const idx = typeof p.queueIndex === "number" ? p.queueIndex : 0;
    if ((audio.currentTime || 0) > 3) {
      seekTo(0);
      return;
    }
    const prev = p.queue[idx - 1];
    if (!prev) {
      seekTo(0);
      return;
    }
    onChange?.({
      ...prev,
      autoPlay: true,
      queue: p.queue,
      queueIndex: idx - 1,
    });
  }, [onChange, seekTo]);

  useEffect(() => {
    const audio = getSharedAudio();
    const onEnded = () => {
      setIsPlaying(false);
      if (loopOne) return;
      if (continuousRef.current) playNext();
      else {
        try { audio.currentTime = 0; } catch { /* */ }
        setCurrentTime(0);
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [playNext, loopOne]);

  const togglePlay = useCallback(() => {
    const audio = getSharedAudio();
    const p = playerRef.current;
    if (!p) return;
    if (pendingPlayRef.current) return;

    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (!audio.src && p.att?.url) {
      audio.src = withTokenQuery(p.att.url);
      audio.load();
    }
    pendingPlayRef.current = true;
    const start = () => {
      const pr = audio.play();
      if (pr && typeof pr.then === "function") {
        pr.then(() => {
          pendingPlayRef.current = false;
          setIsPlaying(true);
          setErrorMsg("");
        }).catch((err) => {
          pendingPlayRef.current = false;
          setIsPlaying(false);
          if (err && err.name !== "AbortError") setErrorMsg("Tap play");
        });
      } else {
        pendingPlayRef.current = false;
        setIsPlaying(true);
      }
    };
    applyAudioOutput().finally(start);
  }, []);

  useEffect(() => {
    if (!player) return undefined;
    const onToggle = () => togglePlay();
    const onSeekEv = (e) => {
      const ratio = e?.detail?.ratio;
      if (typeof ratio !== "number") return;
      const audio = getSharedAudio();
      const d = audio.duration || duration || 0;
      if (!d) return;
      seekTo(ratio * d);
    };
    window.addEventListener("messenger:audio-toggle", onToggle);
    window.addEventListener("messenger:audio-seek", onSeekEv);
    return () => {
      window.removeEventListener("messenger:audio-toggle", onToggle);
      window.removeEventListener("messenger:audio-seek", onSeekEv);
    };
  }, [player, togglePlay, seekTo, duration]);

  const onClosePlayer = () => {
    const audio = getSharedAudio();
    try { audio.pause(); } catch { /* */ }
    audio.removeAttribute("src");
    try { audio.load(); } catch { /* */ }
    delete audio.dataset.attId;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setErrorMsg("");
    onStateChange?.({ isPlaying: false, currentTime: 0, duration: 0, attId: null });
    onChange?.(null);
  };

  const onDownload = () => {
    if (!player?.att?.url) return;
    const a = document.createElement("a");
    a.href = withTokenQuery(player.att.url);
    a.download = player.att.original_filename || "audio";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const goToMessage = () => {
    setMenuAnchor(null);
    if (!player?.conversationId || !player?.messageId) return;
    onGoToTrack?.({
      conversationId: player.conversationId,
      messageId: player.messageId,
    });
  };

  const seekFromEvent = (e, trackEl) => {
    const rect = trackEl.getBoundingClientRect();
    const audio = getSharedAudio();
    const d = audio.duration || duration || 0;
    if (!d || rect.width <= 0) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    if (clientX == null) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(ratio * d);
  };

  const onSeekStart = (e) => {
    const track = e.currentTarget;
    const audio = getSharedAudio();
    // Prefer live audio.duration; fall back to state duration from metadata
    const d = (audio.duration && isFinite(audio.duration) ? audio.duration : 0) || duration || 0;
    if (!d || !isFinite(d)) return;
    e.preventDefault();
    e.stopPropagation();
    scrubbingRef.current = true;
    try { track.setPointerCapture?.(e.pointerId); } catch { /* */ }
    seekFromEvent(e, track);
    const move = (ev) => {
      ev.preventDefault?.();
      seekFromEvent(ev, track);
    };
    const up = (ev) => {
      scrubbingRef.current = false;
      try { seekFromEvent(ev, track); } catch { /* */ }
      try { track.releasePointerCapture?.(e.pointerId); } catch { /* */ }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
  };

  useEffect(() => {
    const onStop = () => {
      try {
        const audio = getSharedAudio();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      } catch { /* */ }
      pendingPlayRef.current = false;
      onChange?.(null);
      onStateChange?.({ isPlaying: false, currentTime: 0, duration: 0, attId: null });
    };
    window.addEventListener("messenger:audio-stop", onStop);
    return () => window.removeEventListener("messenger:audio-stop", onStop);
  }, [onChange, onStateChange]);

  if (!player) return null;

  const isVoice =
    player?.att?.kind === "voice" ||
    (player?.att?.original_filename || "").toLowerCase().startsWith("voice_");
  const title =
    player.title ||
    player.att?.original_filename ||
    (isVoice ? "Voice message" : "Audio");
  const d = duration || 0;
  const progress = d > 0 ? Math.min(1, currentTime / d) : 0;
  const canSeek = d > 0 && isFinite(d);
  const queueLen = player.queue?.length || 0;
  const queueIdx = typeof player.queueIndex === "number" ? player.queueIndex : 0;

  return (
    <Box
      sx={{
        flexShrink: 0,
        width: "100%",
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        zIndex: 12,
      }}
    >
      {/* Blue scrub bar on top — taller hit area on mobile for reliable seeking */}
      <Box
        onPointerDown={canSeek ? onSeekStart : undefined}
        sx={{
          position: "relative",
          height: 28,
          width: "100%",
          display: "flex",
          alignItems: "center",
          bgcolor: "transparent",
          cursor: canSeek ? "pointer" : "default",
          touchAction: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
          zIndex: 5,
        }}
      >
        <Box
          sx={{
            position: "absolute",
            left: 0, right: 0,
            height: 4,
            top: "50%",
            transform: "translateY(-50%)",
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"),
            borderRadius: 2,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            height: 4,
            width: `${progress * 100}%`,
            bgcolor: "primary.main",
            borderRadius: 2,
            transition: scrubbingRef.current ? "none" : "width 0.08s linear",
            pointerEvents: "none",
          }}
        />
        {canSeek && (
          <Box
            sx={{
              position: "absolute",
              left: `calc(${progress * 100}% - 7px)`,
              top: "50%",
              transform: "translateY(-50%)",
              width: 14,
              height: 14,
              borderRadius: "50%",
              bgcolor: "primary.main",
              boxShadow: 1,
              pointerEvents: "none",
            }}
          />
        )}
      </Box>

      <Stack
        direction="row"
        alignItems="center"
        spacing={0.5}
        sx={{ px: { xs: 0.5, sm: 0.75 }, py: 0.2, minHeight: 34 }}
      >
        <IconButton size="small" onClick={playPrev} sx={{ display: { xs: "none", sm: "inline-flex" }, p: 0.5 }}>
          <SkipPreviousRoundedIcon fontSize="small" />
        </IconButton>

        <IconButton
          onClick={togglePlay}
          size="small"
          sx={{
            width: 28, height: 28,
            bgcolor: "primary.main",
            color: "#fff",
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          {isPlaying
            ? <PauseRoundedIcon sx={{ fontSize: 16 }} />
            : <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
        </IconButton>

        <IconButton
          size="small"
          onClick={playNext}
          disabled={!queueLen || queueIdx >= queueLen - 1}
          sx={{ display: { xs: "none", sm: "inline-flex" }, p: 0.5 }}
        >
          <SkipNextRoundedIcon fontSize="small" />
        </IconButton>

        <Box
          sx={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            display: { xs: "none", sm: "flex" },
            alignItems: "center", justifyContent: "center",
            bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
            color: "primary.main",
          }}
        >
          {isVoice ? <MicRoundedIcon sx={{ fontSize: 12 }} /> : <MusicNoteRoundedIcon sx={{ fontSize: 12 }} />}
        </Box>

        <Box
          sx={{ flex: 1, minWidth: 0, cursor: player.conversationId ? "pointer" : "default" }}
          onClick={goToMessage}
        >
          <Typography noWrap sx={{ fontWeight: 600, fontSize: 12, lineHeight: 1.2 }}>
            {loading ? "Loading…" : (errorMsg || title)}
          </Typography>
          <Typography noWrap sx={{ fontSize: 10, color: "text.secondary", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
            {formatDuration(currentTime)} / {formatDuration(d)}
            {queueLen > 1 ? ` · ${queueIdx + 1}/${queueLen}` : ""}
          </Typography>
        </Box>

        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
          <MoreHorizRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onClosePlayer} sx={{ p: 0.5 }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={goToMessage} disabled={!player.conversationId}>
          <ListItemIcon><ChatRoundedIcon fontSize="small" /></ListItemIcon>
          Show in chat
        </MenuItem>
        <MenuItem onClick={() => { onDownload(); setMenuAnchor(null); }}>
          <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
          Download
        </MenuItem>
        <MenuItem onClick={() => setContinuous((v) => !v)}>
          <ListItemIcon><QueueMusicRoundedIcon fontSize="small" /></ListItemIcon>
          Play all continuously
          <Switch size="small" checked={continuous} sx={{ ml: 1 }} />
        </MenuItem>
        <MenuItem onClick={() => setLoopOne((v) => !v)}>
          <ListItemIcon><RepeatRoundedIcon fontSize="small" /></ListItemIcon>
          Loop track
          <Switch size="small" checked={loopOne} sx={{ ml: 1 }} />
        </MenuItem>
        {SPEEDS.map((s) => (
          <MenuItem key={s} selected={speed === s} onClick={() => { setSpeed(s); setMenuAnchor(null); }}>
            Speed {s}×
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
