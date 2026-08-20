import apiRequest from "../../customHooks/apiRequest";
import { parseCallSystemBody, formatCallSystemLabel, callSystemIcon, isCallSystemBody } from "../modules/callSystemMessage";
import { MSG_API } from "../api";
import React, { useMemo, useState, useEffect, useRef } from "react";
import Lottie from "lottie-react";
import CheckIcon from "@mui/icons-material/Check";
import {
  Box, Typography, Stack, Avatar, Chip, IconButton, ListItemIcon, MenuItem, Dialog, CircularProgress, alpha, Slider, Tooltip, Button, LinearProgress
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReplyIcon from "@mui/icons-material/Reply";
import ForwardIcon from "@mui/icons-material/Forward";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import DoneIcon from "@mui/icons-material/Done";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import CallIcon from "@mui/icons-material/Call";
import VideocamIcon from "@mui/icons-material/Videocam";
import PhoneMissedIcon from "@mui/icons-material/PhoneMissed";
import {
  attachmentKind, formatTime, formatDuration, withTokenQuery, REACTIONS,
  parseFormattedBody, isVoiceAttachment, isVideoMessageAttachment,
  emojiOnlyCount, isGifAttachment,
  downloadAttachmentToCache, getCachedAttachment,
} from "../messengerUtils";
import { loadHljs, highlightCode, HLJS_TOKEN_SX, langLabel } from "../modules/codeHighlight";

/**
 * Deterministic pseudo-waveform — given an id, produce N peaks in [0..1].
 * Looks like a real waveform but is cheap to compute (no audio decode).
 */
function pseudoWaveform(seedStr, bars = 36) {
  // Simple seeded PRNG (mulberry32)
  let seed = 0;
  for (let i = 0; i < (seedStr || "").length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
  }
  seed = Math.abs(seed) || 1;
  const out = [];
  for (let i = 0; i < bars; i++) {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // Bias toward middle, with a soft envelope so it looks like speech
    const envelope = Math.sin((i / bars) * Math.PI) * 0.5 + 0.55;
    out.push(0.25 + rand * 0.75 * envelope);
  }
  return out;
}

/**
 * Inline voice / audio player rendered inside the message bubble.
 * Shows: play/pause button, waveform (deterministic), progress fill,
 * current time / duration. Clicking anywhere on the waveform seeks.
 *
 * Props:
 *  - att: attachment
 *  - mine: boolean — bubble direction
 *  - active: boolean — this attachment is the one currently loaded in the player
 *  - isPlaying: boolean — global player is currently playing
 *  - currentTime, duration: from global player state (only meaningful if `active`)
 *  - onPlay: (att) => void   — load + play this attachment in the global player
 *  - onToggle: (att) => void — toggle play/pause for this attachment
 *  - onSeek: (att, ratio) => void — seek the global player to ratio (0..1)
 */
function InlineAudioPlayer({
  att, mine, active, isPlaying, currentTime, duration, onPlay, onToggle, onSeek,
  variant = "voice",
}) {
  const theme = useTheme();
  const peaks = useMemo(
    () => pseudoWaveform(`${att.id || att.original_filename || ""}`, 32),
    [att.id, att.original_filename]
  );

  // If this is the active message use the global player's duration, else use the attachment's reported duration
  const dur = active ? duration : (att.duration || 0);
  const cur = active ? currentTime : 0;
  const progress = dur > 0 ? Math.min(1, cur / dur) : 0;
  const playing = active && isPlaying;

  // Seek helpers — work while playing OR paused (and when first loading)
  const ratioFromEvent = (e, el) => {
    const rect = el.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    if (clientX == null || rect.width <= 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const applySeek = (ratio) => {
    if (active) {
      onSeek?.(att, ratio);
      return;
    }
    // Not loaded yet: load this track, then seek (leave paused if user only scrubbed
    // — AudioPlayerBar autoPlay from onPlay will start; ratio is applied after load)
    onPlay?.(att);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("messenger:audio-seek", { detail: { ratio } }));
    }, 180);
  };

  const onWavePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    const ratio = ratioFromEvent(e, el);
    applySeek(ratio);
    const move = (ev) => {
      ev.preventDefault?.();
      applySeek(ratioFromEvent(ev, el));
    };
    const up = (ev) => {
      try { applySeek(ratioFromEvent(ev, el)); } catch { /* */ }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
      window.removeEventListener("touchcancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
    window.addEventListener("touchcancel", up);
  };

  const accent = mine ? "#ffffff" : theme.palette.primary.main;
  const trackBg = mine ? "rgba(255,255,255,0.25)" : alpha(theme.palette.primary.main, 0.18);
  const playedBg = mine ? "rgba(255,255,255,0.95)" : theme.palette.primary.main;

  const isVoice = variant === "voice";

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={(e) => { e.stopPropagation(); }}
      sx={{
        bgcolor: mine
          ? (playing ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.16)")
          : (playing ? "action.selected" : "action.hover"),
        borderRadius: 3.5,
        px: 1, py: 0.85,
        minWidth: isVoice ? 230 : 250,
        maxWidth: 320,
        border: "1px solid",
        borderColor: mine ? "rgba(255,255,255,0.08)" : "divider",
        transition: "background-color 0.2s",
        "&:hover": {
          bgcolor: mine ? "rgba(0,0,0,0.28)" : "action.selected",
        },
      }}
    >
      {/* Play / Pause */}
      <IconButton
        size="small"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (active) onToggle?.(att);
          else onPlay?.(att);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        sx={{
          bgcolor: accent,
          color: mine ? theme.palette.primary.main : "#fff",
          width: 38, height: 38,
          flexShrink: 0,
          boxShadow: playing ? `0 0 0 3px ${alpha(accent, 0.35)}` : "none",
          "&:hover": { bgcolor: accent, opacity: 0.9 },
          zIndex: 2,
        }}
      >
        {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
      </IconButton>

      {/* Waveform — scrubbable while paused or playing */}
      <Box
        onPointerDown={onWavePointerDown}
        sx={{
          flex: 1,
          minWidth: 90,
          height: 30,
          position: "relative",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "1.5px",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        {peaks.map((p, i) => {
          const filled = (i / peaks.length) <= progress;
          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: `${Math.max(18, Math.min(100, p * 100))}%`,
                bgcolor: filled ? playedBg : trackBg,
                borderRadius: 1,
                transition: "background-color 0.12s",
                opacity: filled ? 1 : 0.75,
              }}
            />
          );
        })}
      </Box>

      {/* Time + type hint */}
      <Stack alignItems="flex-end" spacing={0} sx={{ flexShrink: 0, minWidth: 40 }}>
        <Typography
          variant="caption"
          sx={{
            fontVariantNumeric: "tabular-nums",
            fontSize: 11,
            fontWeight: 600,
            opacity: 0.9,
            color: mine ? "inherit" : "text.secondary",
            lineHeight: 1.2,
          }}
        >
          {active && cur > 0 ? formatDuration(cur) : (dur ? formatDuration(dur) : "0:00")}
        </Typography>
        {isVoice ? (
          <GraphicEqIcon sx={{ fontSize: 12, opacity: 0.55, color: mine ? "inherit" : "text.secondary" }} />
        ) : (
          <MusicNoteIcon sx={{ fontSize: 12, opacity: 0.55, color: mine ? "inherit" : "text.secondary" }} />
        )}
      </Stack>
    </Stack>
  );
}

/**
 * Single message bubble with attachments, reactions, read-receipt ticks,
 * @mention parsing, voice/video message rendering, and clickable reply preview.
 */



/**
 * In-bubble video:
 *  - circular video messages: small circle + local play; click opens fullscreen gallery via onOpen
 *  - rectangular: thumbnail with play overlay; click opens fullscreen gallery (Telegram-style)
 */

function SpoilerText({ children, mine }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Box
      component="span"
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      title={open ? "Hide spoiler" : "Reveal spoiler"}
      sx={{
        display: "inline",
        cursor: "pointer",
        borderRadius: 1,
        px: 0.5,
        py: 0.15,
        mx: 0.15,
        bgcolor: open
          ? (mine ? "rgba(255,255,255,0.14)" : "action.selected")
          : (mine ? "rgba(255,255,255,0.28)" : "rgba(30,30,30,0.85)"),
        color: open ? "inherit" : "transparent",
        filter: open ? "none" : "blur(5px)",
        userSelect: open ? "text" : "none",
        transition: "filter 0.2s, background-color 0.15s, color 0.15s",
        "&:hover": {
          filter: open ? "none" : "blur(3px)",
          bgcolor: open
            ? (mine ? "rgba(255,255,255,0.2)" : "action.hover")
            : (mine ? "rgba(255,255,255,0.35)" : "rgba(50,50,50,0.9)"),
        },
      }}
    >
      {children}
    </Box>
  );
}

const LANG_ALIASES = {
  js: "JavaScript", javascript: "JavaScript", ts: "TypeScript", typescript: "TypeScript",
  py: "Python", python: "Python", rb: "Ruby", go: "Go", rs: "Rust", rust: "Rust",
  java: "Java", kt: "Kotlin", kotlin: "Kotlin", cs: "C#", csharp: "C#",
  cpp: "C++", "c++": "C++", c: "C", php: "PHP", swift: "Swift",
  sql: "SQL", html: "HTML", css: "CSS", scss: "SCSS", json: "JSON",
  yaml: "YAML", yml: "YAML", xml: "XML", bash: "Bash", sh: "Shell",
  shell: "Shell", zsh: "Shell", powershell: "PowerShell", ps1: "PowerShell",
  dockerfile: "Dockerfile", docker: "Dockerfile", md: "Markdown", markdown: "Markdown",
  jsx: "JSX", tsx: "TSX", vue: "Vue", react: "JavaScript", plaintext: "Text", text: "Text",
};

function CodeBlock({ code, lang, mine, onEditCode }) {
  const [copied, setCopied] = React.useState(false);
  const [hlReady, setHlReady] = React.useState(Boolean(false));
  React.useEffect(() => {
    let cancelled = false;
    loadHljs().then(() => {
      if (!cancelled) setHlReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  const detected = React.useMemo(() => {
    // Recompute when hljs finishes loading
    void hlReady;
    return highlightCode(code, lang);
  }, [code, lang, hlReady]);

  const onCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(detected.raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = detected.raw;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      } catch { /* */ }
    }
  };

  return (
    <Box
      data-no-msg-menu="1"
      sx={{
        display: "block",
        my: 0.6,
        borderRadius: "6px",
        overflow: "hidden",
        border: "1px solid",
        borderColor: mine ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
        bgcolor: "#0d1117",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 1,
          py: 0.5,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          bgcolor: "rgba(255,255,255,0.03)",
        }}
      >
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.3,
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          }}
        >
          {detected.label}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            component="button"
            type="button"
            onClick={onCopy}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.4,
              border: "none",
              cursor: "pointer",
              bgcolor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.75)",
              borderRadius: "4px",
              px: 1,
              py: 0.35,
              fontSize: 11.5,
              fontWeight: 600,
              fontFamily: "inherit",
              "&:hover": { bgcolor: "rgba(255,255,255,0.12)", color: "#fff" },
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Box>
          {typeof onEditCode === "function" && (
            <Box
              component="button"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const fence = "```" + (lang || detected.language || "") + "\n" + (code || "") + "\n```";
                onEditCode(fence, { code, lang: lang || detected.language });
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.4,
                border: "none",
                cursor: "pointer",
                bgcolor: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.75)",
                borderRadius: "4px",
                px: 1,
                py: 0.35,
                fontSize: 11.5,
                fontWeight: 600,
                fontFamily: "inherit",
                "&:hover": { bgcolor: "rgba(255,255,255,0.12)", color: "#fff" },
              }}
            >
              Edit
            </Box>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          overflowX: "auto",
          maxWidth: "100%",
        }}
      >
        <Box
          aria-hidden
          component="pre"
          sx={{
            m: 0,
            py: 1,
            pl: 0.5,
            pr: 0.75,
            flexShrink: 0,
            userSelect: "none",
            textAlign: "right",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "rgba(255,255,255,0.28)",
            bgcolor: "rgba(255,255,255,0.03)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            minWidth: 28,
          }}
        >
          {detected.raw.split("\n").map((_, i) => (
            <Box key={i} component="span" sx={{ display: "block" }}>
              {i + 1}
            </Box>
          ))}
        </Box>
        <Box
          component="pre"
          sx={{
            m: 0,
            py: 1,
            px: { xs: 0.75, sm: 1.25 },
            flex: 1,
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12.5,
            lineHeight: 1.55,
            color: "#e6edf3",
            whiteSpace: "pre",
            tabSize: 2,
            minWidth: 0,
            "& code": {
              fontFamily: "inherit",
              background: "none",
              p: 0,
              whiteSpace: "pre",
              display: "block",
              minWidth: "max-content",
            },
            ...HLJS_TOKEN_SX,
          }}
        >
          <code dangerouslySetInnerHTML={{ __html: detected.html }} />
        </Box>
      </Box>
    </Box>
  );
}


function ChatVideo({ src, filename, contentType, circular = false, attachment, onOpen, conversationId }) {
  const videoRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [error, setError] = React.useState("");
  const [progress, setProgress] = React.useState(0);
  const safeSrc = React.useMemo(() => withTokenQuery(src), [src]);
  const pipKey = React.useMemo(
    () => `vn:${attachment?.id || safeSrc || filename || Math.random()}`,
    [attachment?.id, safeSrc, filename]
  );

  const applySpeakerSink = React.useCallback(async (forceId) => {
    const el = videoRef.current;
    if (!el || typeof el.setSinkId !== "function") return;
    let next = forceId;
    if (next == null) {
      try {
        next = JSON.parse(localStorage.getItem("messenger.mediaDevices") || "{}").speakerId || "";
      } catch { next = ""; }
    }
    try {
      await el.setSinkId(next || "");
    } catch {
      try { await el.setSinkId(""); } catch { /* */ }
    }
  }, []);

  React.useEffect(() => {
    setError("");
    setPlaying(false);
    setProgress(0);
  }, [safeSrc]);

  React.useEffect(() => {
    applySpeakerSink();
    const onDevices = (e) => applySpeakerSink(e?.detail?.speakerId != null ? e.detail.speakerId : undefined);
    const onStorage = (ev) => { if (ev.key === "messenger.mediaDevices") applySpeakerSink(); };
    window.addEventListener("messenger:media-devices-changed", onDevices);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("messenger:media-devices-changed", onDevices);
      window.removeEventListener("storage", onStorage);
    };
  }, [applySpeakerSink, safeSrc]);

  const publishPip = React.useCallback((payload) => {
    try {
      window.dispatchEvent(new CustomEvent("messenger:video-note-pip", { detail: payload }));
    } catch { /* */ }
  }, []);

  React.useEffect(() => () => {
    const v = videoRef.current;
    if (v && !v.paused && !v.ended && circular) {
      publishPip({
        key: pipKey,
        src: safeSrc,
        currentTime: v.currentTime || 0,
        conversationId: conversationId ?? null,
        filename,
        contentType,
        playing: true,
      });
    }
  }, [circular, pipKey, safeSrc, conversationId, filename, contentType, publishPip]);

  const openFull = (e) => {
    e?.stopPropagation?.();
    if (onOpen && attachment) {
      onOpen(attachment);
      return;
    }
    if (onOpen && src) {
      onOpen({ url: src, original_filename: filename, kind: "video", content_type: contentType });
    }
  };

  const toggleLocal = (e) => {
    e?.stopPropagation?.();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      applySpeakerSink().finally(() => {
        const p = v.play();
        if (p && typeof p.catch === "function") p.catch(() => setError("Playback blocked"));
      });
    } else {
      v.pause();
    }
  };

  if (!safeSrc) {
    return (
      <Box sx={{
        width: circular ? 220 : "100%", height: circular ? 220 : 180, maxWidth: 360,
        bgcolor: "action.hover", borderRadius: circular ? "50%" : 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        mx: circular ? "auto" : undefined,
      }}>
        <Typography variant="caption" color="text.secondary">No video</Typography>
      </Box>
    );
  }

  if (circular) {
    return (
      <Box
        sx={{
          width: 220, height: 220, position: "relative", display: "block",
          borderRadius: "50%", overflow: "hidden", bgcolor: "#000", cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35), 0 0 0 3px rgba(0,0,0,0.45)",
          mx: "auto",
          isolation: "isolate",
          "& video": {
            borderRadius: "50%",
            objectFit: "cover",
            objectPosition: "center",
          },
        }}
        onClick={toggleLocal}
      >
        <video
          ref={videoRef}
          src={safeSrc}
          playsInline
          preload="metadata"
          muted={false}
          onPlay={() => {
            setPlaying(true);
            publishPip(null);
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setProgress(0);
            publishPip(null);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration) setProgress(el.currentTime / el.duration);
          }}
          onError={() => setError("Could not load video")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            display: "block",
            background: "#000",
            borderRadius: "50%",
          }}
        />
        {playing && (
          <Box
            component="svg"
            viewBox="0 0 100 100"
            sx={{
              position: "absolute", inset: 0, pointerEvents: "none",
              transform: "rotate(-90deg)",
            }}
          >
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={`${2 * Math.PI * 48 * (1 - progress)}`}
              strokeLinecap="round"
            />
          </Box>
        )}
        {!playing && (
          <Box
            sx={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", bgcolor: "rgba(0,0,0,0.28)",
              pointerEvents: "none",
            }}
          >
            <Box sx={{
              width: 56, height: 56, borderRadius: "50%", bgcolor: "rgba(0,0,0,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              border: "2px solid rgba(255,255,255,0.35)",
            }}>
              <PlayArrowIcon sx={{ fontSize: 32, ml: 0.4 }} />
            </Box>
          </Box>
        )}
        {error && (
          <Typography variant="caption" sx={{
            position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff",
            textAlign: "center", fontSize: 11, bgcolor: "rgba(180,30,30,0.85)", borderRadius: 1, px: 0.5,
          }}>
            {error}
          </Typography>
        )}
      </Box>
    );
  }

  // Rectangular — preview tile; click opens full-screen gallery
  return (
    <Box
      onClick={openFull}
      sx={{
        position: "relative",
        maxWidth: 360,
        width: "100%",
        borderRadius: 2,
        overflow: "hidden",
        bgcolor: "#000",
        cursor: "pointer",
        aspectRatio: "16 / 10",
        maxHeight: 280,
        "&:hover .playOverlay": { bgcolor: "rgba(0,0,0,0.4)" },
      }}
    >
      <video
        ref={videoRef}
        src={safeSrc}
        playsInline
        preload="metadata"
        muted
        onError={() => setError("Could not load video")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          background: "#000",
          pointerEvents: "none",
        }}
      />
      <Box
        className="playOverlay"
        sx={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.25)",
          transition: "background-color 0.2s",
        }}
      >
        <Box sx={{
          width: 56, height: 56, borderRadius: "50%",
          bgcolor: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff",
          border: "2px solid rgba(255,255,255,0.4)",
        }}>
          <PlayArrowIcon sx={{ fontSize: 32, ml: 0.5 }} />
        </Box>
      </Box>
      {error && (
        <Typography variant="caption" sx={{
          position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff",
          textAlign: "center", bgcolor: "rgba(180,30,30,0.85)", borderRadius: 1, px: 0.5, py: 0.5,
        }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}


/**
 * Telegram-style file row: circular progress while downloading into blob cache,
 * then open from local blob (avoids X-Frame-Options iframe blocks on API host).
 */
function FileAttachmentCard({ att, url, mine, onOpen, authHeaders }) {
  const key = String(att?.id || att?.url || url || "");
  const cached0 = getCachedAttachment(key);
  const [status, setStatus] = React.useState(cached0?.status || "idle"); // idle|downloading|ready|error
  const [progress, setProgress] = React.useState(cached0?.progress || 0);
  const [error, setError] = React.useState(cached0?.error || "");

  React.useEffect(() => {
    const c = getCachedAttachment(key);
    if (c?.status === "ready") {
      setStatus("ready");
      setProgress(1);
    }
  }, [key]);

  const startDownload = async () => {
    if (status === "downloading") return;
    setStatus("downloading");
    setError("");
    try {
      const entry = await downloadAttachmentToCache(
        { ...att, url: url || att?.url },
        authHeaders || {},
        (p, st) => {
          setProgress(p);
          if (st === "ready") setStatus("ready");
          if (st === "error") setStatus("error");
        }
      );
      setStatus("ready");
      setProgress(1);
      return entry;
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Download failed");
      return null;
    }
  };

  const open = async () => {
    let entry = getCachedAttachment(key);
    if (!entry || entry.status !== "ready") {
      entry = await startDownload();
    }
    if (!entry?.blobUrl) return;
    onOpen?.({
      ...att,
      url: entry.blobUrl,
      _blobUrl: entry.blobUrl,
      _fromCache: true,
      content_type: entry.contentType || att.content_type,
      original_filename: att.original_filename || entry.filename,
    });
  };

  const name = att.original_filename || "file";
  const sizeLabel = att.size
    ? (att.size < 1024 * 1024
        ? `${Math.max(1, Math.round(att.size / 1024))} KB`
        : `${(att.size / (1024 * 1024)).toFixed(1)} MB`)
    : "";

  const isPdf = (att.content_type || "").includes("pdf") || /\.pdf$/i.test(name);

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        if (status === "ready") open();
        else if (status !== "downloading") startDownload().then((entry) => {
          // auto-open after first successful download
          if (entry?.blobUrl) {
            onOpen?.({
              ...att,
              url: entry.blobUrl,
              _blobUrl: entry.blobUrl,
              _fromCache: true,
              content_type: entry.contentType || att.content_type,
              original_filename: name,
            });
          }
        });
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        maxWidth: 280,
        px: 1,
        py: 0.85,
        borderRadius: 2,
        cursor: "pointer",
        bgcolor: mine ? "rgba(255,255,255,0.12)" : "action.hover",
        border: "1px solid",
        borderColor: mine ? "rgba(255,255,255,0.1)" : "divider",
        "&:hover": { bgcolor: mine ? "rgba(255,255,255,0.18)" : "action.selected" },
      }}
    >
      <Box sx={{ position: "relative", width: 42, height: 42, flexShrink: 0 }}>
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            bgcolor: isPdf ? "rgba(244,67,54,0.18)" : (mine ? "rgba(255,255,255,0.15)" : "primary.main"),
            color: isPdf ? "#ef5350" : (mine ? "#fff" : "#fff"),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: status === "downloading" ? 0.45 : 1,
          }}
        >
          {status === "ready" ? (
            <VisibilityIcon sx={{ fontSize: 20 }} />
          ) : (
            <DownloadIcon sx={{ fontSize: 20 }} />
          )}
        </Box>
        {status === "downloading" && (
          <CircularProgress
            variant="determinate"
            value={Math.max(4, Math.round(progress * 100))}
            size={42}
            thickness={3.2}
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              color: mine ? "#fff" : "primary.main",
            }}
          />
        )}
        {status === "ready" && (
          <Box
            sx={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 16,
              height: 16,
              borderRadius: "50%",
              bgcolor: "success.main",
              border: "2px solid",
              borderColor: mine ? "primary.dark" : "background.paper",
            }}
          />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography noWrap fontWeight={600} fontSize={13.5}>
          {name}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.75 }} noWrap>
          {status === "downloading"
            ? `Downloading ${Math.round(progress * 100)}%`
            : status === "ready"
              ? (sizeLabel ? `${sizeLabel} · Tap to open` : "Tap to open")
              : status === "error"
                ? (error || "Failed · tap to retry")
                : (sizeLabel ? `${sizeLabel} · Tap to download` : "Tap to download")}
        </Typography>
      </Box>
    </Box>
  );
}


/**
 * Image attachment with spoiler blur + view-once handling.
 */
function ProtectedImageAttachment({ att, url, message, mine, onOpenPreview, onReply }) {
  const VIEW_SECS = 15;
  const [spoilerOpen, setSpoilerOpen] = React.useState(false);
  const [viewOnceState, setViewOnceState] = React.useState(() => {
    if (att.is_purged || att.view_once_state === "purged") return "purged";
    if (!att.is_view_once) return att.view_once_state || "none";
    // Cache may send view_once_state:"none" — treat as pending for recipients
    const s = att.view_once_state;
    if (s === "opened" || s === "own" || s === "pending" || s === "purged") return s;
    return "pending";
  });
  const [opening, setOpening] = React.useState(false);
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const [viewerUrl, setViewerUrl] = React.useState(null);
  const [remaining, setRemaining] = React.useState(VIEW_SECS);
  const timerRef = React.useRef(null);
  const tickRef = React.useRef(null);
  const isSpoiler = Boolean(att.is_spoiler);
  const isViewOnce = Boolean(att.is_view_once);
  const showBlur = isSpoiler && !spoilerOpen && !mine;

  const closeViewer = React.useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setViewerOpen(false);
    setViewerUrl(null);
    setRemaining(VIEW_SECS);
  }, []);

  React.useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  React.useEffect(() => {
    if (!att?.is_view_once) return;
    if (att.is_purged || att.view_once_state === "purged") setViewOnceState("purged");
    else if (att.view_once_state === "opened") setViewOnceState("opened");
    else if (att.view_once_state === "own") setViewOnceState("own");
    else if (att.view_once_state === "pending") setViewOnceState("pending");
  }, [att?.id, att?.view_once_state, att?.is_purged, att?.is_view_once]);

  const startViewer = (absUrl, secs, { consume = true } = {}) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setViewerUrl(absUrl);
    setViewerOpen(true);
    if (consume && secs != null && secs > 0) {
      setRemaining(secs);
      tickRef.current = setInterval(() => {
        setRemaining((r) => (r > 0 ? r - 1 : 0));
      }, 1000);
      timerRef.current = setTimeout(() => {
        closeViewer();
      }, secs * 1000);
    } else {
      setRemaining(null);
    }
  };

  const openViewOnce = async () => {
    if (opening || viewOnceState === "purged") return;
    // Recipient already used their one view
    if (!mine && (viewOnceState === "opened")) return;
    setOpening(true);
    try {
      // Sender: open own media without consuming a view-once token window
      if (mine) {
        const raw = att.url || url || `/api/messenger/attachments/${att.id}/download/`;
        startViewer(withTokenQuery(raw), null, { consume: false });
        return;
      }
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/attachments/${att.id}/view-once/`,
      });
      // support {data:{url}} and flat {url}
      const data = res?.data?.data ?? res?.data ?? res ?? {};
      const raw = data.url || data.download_url;
      const secs = Number(data.expires_in) > 0 ? Number(data.expires_in) : VIEW_SECS;
      if (raw) {
        setViewOnceState("opened");
        // withTokenQuery must keep ?once= token
        startViewer(withTokenQuery(raw), secs, { consume: true });
      } else {
        console.warn("view-once open: no url in response", data);
        setViewOnceState("opened");
      }
    } catch (e) {
      const st = e?.response?.status;
      console.warn("view-once open failed", st, e?.response?.data || e?.message);
      if (st === 410) setViewOnceState(att.is_purged ? "purged" : "opened");
    } finally {
      setOpening(false);
    }
  };

  // View-once: NEVER show the image inside the message bubble
  if (isViewOnce) {
    const label = (() => {
      if (viewOnceState === "purged") return "Photo deleted";
      if (!mine && viewOnceState === "opened") return "Opened";
      if (mine) return "View once · sent";
      return opening ? "Opening…" : "View once photo";
    })();
    // Recipient: only while pending. Sender: can re-open their own copy anytime (until purged).
    const canOpen = viewOnceState !== "purged" && (
      mine || viewOnceState === "pending" || viewOnceState === "own"
    );
    return (
      <>
        <Box
          onClick={(e) => {
            e.stopPropagation();
            if (canOpen) openViewOnce();
          }}
          sx={{
            position: "relative", width: 220, height: 120, borderRadius: 1.5,
            bgcolor: "action.hover", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: canOpen ? "pointer" : "default",
            userSelect: "none", border: "1px dashed", borderColor: "divider",
          }}
        >
          <Stack alignItems="center" spacing={0.5} sx={{ px: 1, textAlign: "center" }}>
            <Typography variant="caption" fontWeight={700}>{label}</Typography>
            {canOpen && !mine && (
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                Tap · visible {VIEW_SECS}s · then gone
              </Typography>
            )}
            {mine && viewOnceState !== "purged" && (
              <Typography variant="caption" sx={{ opacity: 0.65 }}>
                Tap to preview · peers see it {VIEW_SECS}s once
              </Typography>
            )}
          </Stack>
        </Box>
        <Dialog
          open={viewerOpen}
          onClose={closeViewer}
          fullScreen
          PaperProps={{ sx: { bgcolor: "#000" } }}
        >
          <Box sx={{
            position: "relative", width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            {/* Top bar: progress + close */}
            <Box sx={{
              position: "absolute", top: 0, left: 0, right: 0, zIndex: 2,
              display: "flex", alignItems: "center", gap: 1, p: 1.5,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)",
            }}>
              <Box sx={{ flex: 1 }}>
                {remaining != null && (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, Math.max(0, ((VIEW_SECS - remaining) / VIEW_SECS) * 100))}
                      sx={{
                        height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.2)",
                        "& .MuiLinearProgress-bar": { bgcolor: "#4fc3f7", transition: "transform 0.2s linear" },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: "#fff", mt: 0.75, display: "block", fontWeight: 600 }}>
                      {remaining}s
                    </Typography>
                  </>
                )}
                {remaining == null && (
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.85)" }}>
                    View once preview
                  </Typography>
                )}
              </Box>
              <IconButton
                onClick={(e) => { e.stopPropagation(); closeViewer(); }}
                aria-label="Close"
                sx={{
                  color: "#fff",
                  bgcolor: "rgba(255,255,255,0.15)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.3)" },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {viewerUrl ? (
              <Box
                component="img"
                src={viewerUrl}
                alt=""
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                  p: 1,
                }}
              />
            ) : (
              <CircularProgress sx={{ color: "#fff" }} />
            )}
          </Box>
        </Dialog>
      </>
    );
  }

  // Normal / spoiler image
  return (
    <Box sx={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      {url ? (
        <Box
          component="img"
          src={url}
          alt={att.original_filename}
          onClick={(e) => {
            e.stopPropagation();
            if (showBlur) {
              setSpoilerOpen(true);
              return;
            }
            onOpenPreview?.({ ...att, url, message });
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onReply?.({
              ...message,
              body: message.body || "",
              _replyAttachment: att,
              reply_to_preview: {
                id: message.id,
                body: isGifAttachment(att) ? "GIF" : (att.original_filename || "Photo"),
                sender: message.sender,
              },
            });
          }}
          onError={(e) => {
            if (!e.currentTarget.dataset.fallback && att.url) {
              e.currentTarget.dataset.fallback = "1";
              e.currentTarget.src = att.url;
            } else {
              e.currentTarget.style.display = "none";
            }
          }}
          sx={{
            maxWidth: "100%", borderRadius: 1.5, maxHeight: isGifAttachment(att) ? 360 : 320,
            display: "block", cursor: "pointer",
            filter: showBlur ? "blur(28px)" : "none",
            transition: "filter 0.2s ease",
          }}
        />
      ) : null}
      {showBlur && (
        <Box
          onClick={(e) => { e.stopPropagation(); setSpoilerOpen(true); }}
          sx={{
            position: "absolute", inset: 0, borderRadius: 1.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            bgcolor: "rgba(0,0,0,0.25)", cursor: "pointer",
          }}
        >
          <Chip label="Spoiler · Tap to reveal" size="small"
            sx={{ bgcolor: "rgba(0,0,0,0.65)", color: "#fff", fontWeight: 700 }} />
        </Box>
      )}
      {isGifAttachment(att) && (
        <Chip
          label="GIF"
          size="small"
          sx={{
            position: "absolute", left: 8, bottom: 8,
            height: 22, fontWeight: 800, fontSize: 11,
            bgcolor: "rgba(0,0,0,0.55)", color: "#fff",
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
      )}
    </Box>
  );
}


/** In-memory cache for Noto Animated Emoji Lottie JSON */
const _emojiLottieCache = new Map();

/** Convert an emoji grapheme to Noto codepoint path segments (e.g. "1f602", "2764_fe0f"). */
function emojiToNotoKeys(emoji) {
  const s = String(emoji || "").trim();
  if (!s) return [];
  const cps = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    // skip pure text
    cps.push(cp.toString(16).toLowerCase());
  }
  if (!cps.length) return [];
  const full = cps.join("_");
  // also try without VS16 (fe0f) — some assets omit it
  const noVs = cps.filter((c) => c !== "fe0f").join("_");
  const keys = [full];
  if (noVs && noVs !== full) keys.push(noVs);
  return keys;
}

function notoLottieUrl(key) {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${key}/lottie.json`;
}

/** Static Noto Color Emoji (same family as the Lottie) — correct “pose” / meaning. */
function notoStaticSvgUrl(key) {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${key}/emoji.svg`;
}
function notoStaticPngUrl(key, size = 128) {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${key}/${size}.png`;
}

async function loadEmojiLottie(emoji) {
  const keys = emojiToNotoKeys(emoji);
  for (const key of keys) {
    if (_emojiLottieCache.has(key)) {
      const hit = _emojiLottieCache.get(key);
      if (hit) return hit;
      continue;
    }
    try {
      const res = await fetch(notoLottieUrl(key));
      if (!res.ok) {
        _emojiLottieCache.set(key, null);
        continue;
      }
      const data = await res.json();
      _emojiLottieCache.set(key, data);
      return data;
    } catch {
      _emojiLottieCache.set(key, null);
    }
  }
  return null;
}

/** Resolve first Noto key that has a static asset (for <img> src). */
function resolveNotoStaticUrls(emoji) {
  const keys = emojiToNotoKeys(emoji);
  return keys.map((key) => ({
    key,
    svg: notoStaticSvgUrl(key),
    png: notoStaticPngUrl(key, 128),
  }));
}

/** Session: which single-emoji message ids already auto-played (unseen → seen). */
const _emojiSeenPlayed = new Set();
try {
  const raw = sessionStorage.getItem("messenger.emojiSeenPlayed");
  if (raw) JSON.parse(raw).forEach((id) => _emojiSeenPlayed.add(String(id)));
} catch { /* */ }
function markEmojiSeenPlayed(id) {
  if (id == null) return;
  const k = String(id);
  if (_emojiSeenPlayed.has(k)) return;
  _emojiSeenPlayed.add(k);
  try {
    sessionStorage.setItem(
      "messenger.emojiSeenPlayed",
      JSON.stringify(Array.from(_emojiSeenPlayed).slice(-400))
    );
  } catch { /* */ }
}

/**
 * Single-emoji message display:
 *  - Idle: static Noto Color Emoji SVG (correct expression / meaning)
 *  - Playing: same-family Noto Animated Lottie on top (then back to static)
 * First frame of Lottie is often a neutral/mid pose — never use it as the idle glyph.
 */
function SingleEmojiLottie({ emoji, size = 72, playing = false, onPlayDone, onClick }) {
  const [lottieData, setLottieData] = useState(null);
  const [staticSrc, setStaticSrc] = useState(null);
  const [staticFailed, setStaticFailed] = useState(false);
  const lottieRef = useRef(null);
  const onPlayDoneRef = useRef(onPlayDone);
  onPlayDoneRef.current = onPlayDone;
  const wasPlayingRef = useRef(false);

  // Resolve static Noto asset (SVG preferred, PNG fallback chain)
  useEffect(() => {
    if (!emoji) return undefined;
    setStaticFailed(false);
    const candidates = resolveNotoStaticUrls(emoji);
    if (!candidates.length) {
      setStaticFailed(true);
      return undefined;
    }
    // Prefer SVG; browsers load via <img>. On error we try next key / png.
    setStaticSrc(candidates[0].svg);
    return undefined;
  }, [emoji]);

  // Prefetch Lottie so click/auto-play is instant
  useEffect(() => {
    if (!emoji) return undefined;
    let cancelled = false;
    loadEmojiLottie(emoji).then((json) => {
      if (!cancelled && json) setLottieData(json);
    });
    return () => { cancelled = true; };
  }, [emoji]);

  // Drive play / stop
  useEffect(() => {
    if (!playing) {
      wasPlayingRef.current = false;
      return;
    }
    wasPlayingRef.current = true;
    const api = lottieRef.current;
    if (api && lottieData) {
      try {
        api.goToAndPlay?.(0, true);
      } catch {
        try { api.play?.(); } catch { /* */ }
      }
    } else if (!lottieData) {
      // No animation asset — still notify done so UI doesn't stick in "playing"
      loadEmojiLottie(emoji).then((json) => {
        if (json) setLottieData(json);
        else {
          wasPlayingRef.current = false;
          onPlayDoneRef.current?.();
        }
      });
    }
  }, [playing, lottieData, emoji]);

  const box = Math.max(40, Number(size) || 72);

  const onStaticError = () => {
    const candidates = resolveNotoStaticUrls(emoji);
    const cur = staticSrc;
    // Try PNG for same key, then next keys
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (cur === c.svg) {
        setStaticSrc(c.png);
        return;
      }
      if (cur === c.png && i + 1 < candidates.length) {
        setStaticSrc(candidates[i + 1].svg);
        return;
      }
    }
    setStaticFailed(true);
  };

  const showAnim = Boolean(playing && lottieData);

  return (
    <Box
      component="span"
      onClick={onClick}
      sx={{
        position: "relative",
        display: "inline-flex",
        width: box,
        height: box,
        lineHeight: 0,
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        verticalAlign: "middle",
        alignItems: "center",
        justifyContent: "center",
        "&:active": onClick ? { transform: "scale(0.96)" } : undefined,
        transition: "transform 0.12s ease",
      }}
    >
      {/* Idle glyph: static Noto (meaningful pose) */}
      {!staticFailed && staticSrc ? (
        <Box
          component="img"
          src={staticSrc}
          alt={emoji}
          draggable={false}
          onError={onStaticError}
          sx={{
            width: box,
            height: box,
            objectFit: "contain",
            // Hide under Lottie while playing so frames don't double
            opacity: showAnim ? 0 : 1,
            transition: "opacity 0.08s ease",
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
          }}
        />
      ) : (
        <Box
          component="span"
          sx={{
            fontSize: box * 0.88,
            lineHeight: 1,
            opacity: showAnim ? 0 : 1,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {emoji}
        </Box>
      )}

      {/* Animation overlay — same Noto family, only while playing */}
      {showAnim && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            width: box,
            height: box,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          <Lottie
            lottieRef={lottieRef}
            animationData={lottieData}
            loop={false}
            autoplay
            style={{ width: "100%", height: "100%" }}
            onComplete={() => {
              if (!wasPlayingRef.current) return;
              wasPlayingRef.current = false;
              onPlayDoneRef.current?.();
            }}
          />
        </Box>
      )}
    </Box>
  );
}


export default function MessageBubble({
  m, meId, activeConv,
  onContextOpen, onReact, onReactAnchor, onReply, onEditCode,
  onOpenPreview, onShowReaders, onLoadUserProfile,
  onJumpToMessage, onPlayAudio, onToggleAudio, onSeekAudio,
  onMentionClick,
  onDayClick,
  onCancelSchedule,
  // Global audio player state — used to render inline progress on the active message
  activeAudioId, audioIsPlaying, audioCurrentTime, audioDuration,
  selectionMode = false,
  selected = false,
  isUnread = false,
  onToggleSelect,
  isPinnedMessage = false,
  isFirstInSenderGroup = true,
  isLastInSenderGroup = true,
  remoteEmojiPlay = 0,
  onEmojiPlay,
  showOwnAvatar = true,
  showOthersAvatar = true,
  bubbleStyle = "modern", // modern | overlap | irc
}) {
  const theme = useTheme();
  const isIrc = bubbleStyle === "irc";
  const isOverlap = bubbleStyle === "overlap";
  const bubbleMineBg = theme.customColors?.bubbleMine
    || (theme.palette.mode === "dark" ? "#2b5278" : theme.palette.primary.main);
  // Hooks must run unconditionally (before any early return) — Rules of Hooks.
  const [emojiPlaying, setEmojiPlaying] = useState(false);
  const emojiRootRef = useRef(null);
  const emojiAutoPlayedRef = useRef(
    m?.id != null ? _emojiSeenPlayed.has(String(m.id)) : false
  );
  const longPressTimer = useRef(null);
  const longPressMoved = useRef(false);
  const longPressFired = useRef(false);
  const longPressPos = useRef({ x: 0, y: 0 });

  // Auto-play only for *unseen* messages when they enter the viewport (while marking seen).
  // Never on every chat open for already-seen messages.
  useEffect(() => {
    if (m?.type === "day" || m?.is_system) return undefined;
    if (!isUnread) return undefined;
    if (emojiAutoPlayedRef.current) return undefined;
    if (String(m?.sender?.id) === String(meId)) return undefined; // only when I receive/see
    const body = typeof m?.body === "string" ? m.body : String(m?.body || "");
    if (emojiOnlyCount(body) !== 1) return undefined;

    const el = emojiRootRef.current;
    // Prefer the message row as root for IO — fall back after paint
    const target = el?.closest?.("[data-msg-id]") || el;
    if (!target || typeof IntersectionObserver === "undefined") {
      // Fallback: if already marked unread and mounted, play once shortly
      const t = setTimeout(() => {
        if (emojiAutoPlayedRef.current || !isUnread) return;
        emojiAutoPlayedRef.current = true;
        markEmojiSeenPlayed(m?.id);
        setEmojiPlaying(true);
      }, 280);
      return () => clearTimeout(t);
    }

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.35);
        if (!hit) return;
        if (emojiAutoPlayedRef.current) return;
        emojiAutoPlayedRef.current = true;
        markEmojiSeenPlayed(m?.id);
        setEmojiPlaying(true);
        try { io.disconnect(); } catch { /* */ }
      },
      { threshold: [0.35, 0.6, 1], root: null }
    );
    io.observe(target);
    return () => {
      try { io.disconnect(); } catch { /* */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, isUnread, meId]);

  // Remote peer clicked the emoji → play here too
  useEffect(() => {
    if (!remoteEmojiPlay || m?.type === "day") return;
    const body = typeof m?.body === "string" ? m.body : String(m?.body || "");
    if (emojiOnlyCount(body) !== 1) return;
    setEmojiPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteEmojiPlay]);

  if (m.type === "day") {
    const dayActive = Boolean(m._dayHighlight);
    return (
      <Box
        data-day-id={m.id}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          my: 1.75,
          px: 1,
        }}
      >
        <Box
          sx={{
            flex: 1,
            height: 0,
            borderTop: "1px solid",
            borderColor: dayActive ? "warning.main" : "divider",
            opacity: dayActive ? 0.85 : 0.7,
          }}
        />
        <Chip
          label={m.label}
          size="small"
          onClick={(e) => { e.stopPropagation(); onDayClick?.(m); }}
          sx={{
            fontSize: 11,
            fontWeight: dayActive ? 800 : 600,
            cursor: onDayClick ? "pointer" : "default",
            flexShrink: 0,
            bgcolor: dayActive
              ? (t) => t.palette.mode === "dark" ? "rgba(255,193,7,0.35)" : "rgba(255,193,7,0.55)"
              : alpha(theme.palette.background.paper, 0.92),
            color: dayActive ? "warning.contrastText" : "text.secondary",
            boxShadow: dayActive ? "0 0 0 3px rgba(255,193,7,0.45)" : "none",
            transition: "background-color 0.25s, box-shadow 0.25s, transform 0.25s",
            transform: dayActive ? "scale(1.06)" : "none",
            animation: dayActive ? "dayChipFlash 2.2s ease-out" : "none",
            "@keyframes dayChipFlash": {
              "0%": { boxShadow: "0 0 0 6px rgba(255,193,7,0.55)", transform: "scale(1.08)" },
              "40%": { boxShadow: "0 0 0 3px rgba(255,193,7,0.4)", transform: "scale(1.05)" },
              "100%": { boxShadow: "0 0 0 0 rgba(255,193,7,0)", transform: "scale(1)" },
            },
            "&:hover": onDayClick ? { bgcolor: dayActive ? undefined : "action.selected" } : undefined,
          }}
        />
        <Box
          sx={{
            flex: 1,
            height: 0,
            borderTop: "1px solid",
            borderColor: dayActive ? "warning.main" : "divider",
            opacity: dayActive ? 0.85 : 0.7,
          }}
        />
      </Box>
    );
  }
  const mine = String(m.sender?.id) === String(meId);
  const allowAvatar = mine ? showOwnAvatar : showOthersAvatar;
  const showSideAvatar = allowAvatar && bubbleStyle === "modern";
  const showOverlapAvatar = allowAvatar && isOverlap;
  const showIrcAvatar = allowAvatar && isIrc;
  const bodyStr = typeof m.body === "string" ? m.body : String(m.body || "");

  // Call / system messages — never show raw __call__:{…} JSON; never throw (Opera-safe)
  let looksLikeCall = false;
  let callInfo = null;
  try {
    looksLikeCall = Boolean(m._call_label) || isCallSystemBody(bodyStr) || isCallSystemBody(m.body);
    if (looksLikeCall) {
      callInfo = parseCallSystemBody(bodyStr) || parseCallSystemBody(m.body);
    }
  } catch {
    looksLikeCall = typeof bodyStr === "string" && bodyStr.indexOf("__call__:") >= 0;
  }
  if (looksLikeCall || m.is_system) {
    let label = "System";
    try {
      label =
        m._call_label
        || formatCallSystemLabel(callInfo || bodyStr)
        || (looksLikeCall ? "Call" : null)
        || (typeof bodyStr === "string" && bodyStr.indexOf("__call__:") < 0 ? bodyStr : "System")
        || "System";
    } catch {
      label = looksLikeCall ? "Call" : "System";
    }
    const kind = (m._call_icon || callSystemIcon(callInfo || bodyStr) || "phone");
    const st = String((callInfo && callInfo.status) || "");
    const isMissed = st === "missed" || st === "no_answer";
    const IconCmp = kind === "cam"
      ? VideocamIcon
      : (isMissed ? PhoneMissedIcon : CallIcon);
    if (looksLikeCall || callInfo) {
      return (
        <Box sx={{ textAlign: "center", my: 1.25, width: "100%" }}>
          <Chip
            label={label}
            size="small"
            icon={<IconCmp sx={{ fontSize: "16px !important" }} />}
            sx={{
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"),
              fontSize: 12,
              fontWeight: 500,
              border: "1px solid",
              borderColor: "divider",
              maxWidth: "92%",
              color: isMissed ? "error.main" : "text.secondary",
              "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" },
              "& .MuiChip-icon": { ml: 0.75, color: isMissed ? "error.main" : "text.secondary" },
            }}
          />
        </Box>
      );
    }
    return (
      <Box sx={{ textAlign: "center", my: 1, width: "100%" }}>
        <Chip
          label={label}
          size="small"
          sx={{
            bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"),
            fontSize: 12,
            maxWidth: "92%",
          }}
        />
      </Box>
    );
  }

  // Read-receipt ticks (only for own messages)
  const readState = m.read_state || (mine ? "sent" : "read");
  const isPending = Boolean(m._pending) || readState === "pending" || readState === "sending";
  const tickEl = mine && (
    <Box
      sx={{ display: "inline-flex", alignItems: "center", cursor: isPending ? "default" : "pointer" }}
      onClick={(e) => {
        if (isPending) return;
        e.stopPropagation();
        onShowReaders(m);
      }}
      title={isPending ? "Sending…" : "Seen by"}
    >
      {isPending
        ? <AccessTimeIcon sx={{ fontSize: 13, opacity: 0.7 }} />
        : readState === "read"
          ? <DoneAllIcon sx={{ fontSize: 14, color: theme.palette.info.light }} />
          : <DoneIcon sx={{ fontSize: 14, opacity: 0.75 }} />}
    </Box>
  );

  const bodySegments = parseFormattedBody(bodyStr);
  const hasAttachments = (m.attachments || []).length > 0;
  const isCircularVideoMsg = hasAttachments
    && (m.attachments || []).every((a) => isVideoMessageAttachment(a))
    && !(bodyStr || "").trim()
    && !m.reply_to_preview
    && !m.forwarded_from_user;
  const emojiCount = (!hasAttachments && !m.reply_to_preview && !m.forwarded_from_user)
    ? emojiOnlyCount(bodyStr)
    : null;
  const isBigEmoji = emojiCount != null && emojiCount >= 1 && emojiCount <= 3;
  const emojiFontSize = emojiCount === 1 ? 72 : emojiCount === 2 ? 56 : emojiCount === 3 ? 44 : 14.5;
  const isSingleEmoji = emojiCount === 1;
  let singleEmojiChar = "";
  if (isSingleEmoji) {
    try {
      const mEmoji = String(bodyStr || "").match(/\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*/u);
      singleEmojiChar = (mEmoji && mEmoji[0]) || String(bodyStr || "").trim();
    } catch {
      singleEmojiChar = String(bodyStr || "").trim();
    }
  }
  const playEmojiBurst = (em, { notify = false } = {}) => {
    if (!em) return;
    if (emojiPlaying) return;
    setEmojiPlaying(true);
    if (notify) onEmojiPlay?.(m);
  };


  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  /**
   * Interactive targets must keep their own behavior (play emoji / voice / code
   * select / open media). Context menu is only for the message chrome: bubble
   * padding, side gutter, text body — same idea as Telegram / WhatsApp.
   */
  const isInteractiveMsgTarget = (target) => {
    if (!target || typeof target.closest !== "function") return false;
    return Boolean(
      target.closest("[data-no-msg-menu]")
      || target.closest("a, button, input, textarea, select, [role='button'], [role='link']")
      || target.closest("audio, video")
      || target.closest("pre")
      || target.closest("code")
    );
  };

  // Menu opens on finger *release* after long-press so the lift cannot
  // activate a MenuItem that appeared under the finger.
  const onPointerDownMsg = (e) => {
    // Desktop mouse uses onContextMenu (right-click). Long-press is for touch/pen.
    if (e.button != null && e.button !== 0) return;
    if (e.pointerType === "mouse") return;
    if (selectionMode) return;
    if (isInteractiveMsgTarget(e.target)) return;

    longPressMoved.current = false;
    longPressFired.current = false;
    longPressPos.current = { x: e.clientX, y: e.clientY };
    clearLongPress();

    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (longPressMoved.current) return;
      longPressFired.current = true;
      try {
        if (navigator.vibrate) navigator.vibrate(12);
      } catch { /* optional */ }
      // Do NOT open the menu here — wait for pointerup (finger lift).
    }, 450);
  };

  const onPointerMoveMsg = (e) => {
    if (
      (longPressTimer.current || longPressFired.current)
      && (
        Math.abs(e.movementX || 0) > 12
        || Math.abs(e.movementY || 0) > 12
      )
    ) {
      longPressMoved.current = true;
      longPressFired.current = false;
      clearLongPress();
    }
  };

  const onPointerUpMsg = () => {
    clearLongPress();
    // Open menu only after the finger is lifted so nothing under the finger is "pressed".
    if (longPressFired.current && !longPressMoved.current) {
      const { x, y } = longPressPos.current;
      longPressFired.current = false;
      onContextOpen?.(
        {
          preventDefault() {},
          stopPropagation() {},
          clientX: x,
          clientY: y,
        },
        m,
      );
    } else {
      longPressFired.current = false;
    }
  };

  return (
    <Box
      data-msg-id={m.id}
      data-msg-mine={mine ? "1" : "0"}
      data-msg-unread={isUnread ? "1" : "0"}
      data-msg-system={m.is_system ? "1" : "0"}
      sx={{
        display: "flex",
        justifyContent: isIrc ? "flex-start" : (mine ? "flex-end" : "flex-start"),
        mb: isLastInSenderGroup ? 0.7 : 0.15,
        // Overlap avatars stick above the bubble — reserve space so they don't cover previous msg
        mt: showOverlapAvatar ? 1.25 : 0,
        px: 0.5,
        py: 0.1,
        overflow: "visible",
        // Full row is the hit-target (side gutter counts as the message zone)
        width: "100%",
        alignItems: "flex-end",
        bgcolor: selected ? (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.18)" : "rgba(25,118,210,0.1)" : "transparent",
        borderRadius: 2,
        transition: "background-color 0.15s",
        "&:hover .msg-actions": { opacity: 1 },
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectionMode) return;
        // Right-click on interactive media keeps native/control behavior only
        // when explicitly marked; still open msg menu on bubble chrome.
        if (isInteractiveMsgTarget(e.target) && e.target?.closest?.("[data-no-msg-menu]")) {
          return;
        }
        onContextOpen?.(e, m);
      }}
      onPointerDown={onPointerDownMsg}
      onPointerMove={onPointerMoveMsg}
      onPointerUp={onPointerUpMsg}
      onPointerCancel={onPointerUpMsg}
      onClick={(e) => {
        if (!selectionMode) return;

        e.preventDefault();
        e.stopPropagation();

        // Shift-click = select a contiguous range.
        // Ctrl/Cmd-click = toggle one item without leaving selection mode.
        onToggleSelect?.(m, false, e);
      }}
    >
      {(selectionMode || selected) && (
        <Box
          sx={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0, mr: 0.75,
            border: "2px solid",
            borderColor: selected ? "primary.main" : "text.disabled",
            bgcolor: selected ? "primary.main" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 12, fontWeight: 700,
          }}
        >
          {selected ? "✓" : ""}
        </Box>
      )}
      {/* Modern: side avatar (others left). IRC: always left for everyone. */}
      {((showSideAvatar && !mine) || showIrcAvatar) && (
        (isIrc || isLastInSenderGroup) ? (
          <Box sx={{ position: "relative", mr: 0.75, mt: 0.15, flexShrink: 0, alignSelf: isIrc ? "flex-start" : "flex-end", mb: 0.15 }}>
            <Avatar
              src={withTokenQuery(m.sender?.avatar) || undefined}
              sx={{ width: isIrc ? 24 : 28, height: isIrc ? 24 : 28, cursor: "pointer" }}
              onClick={() => m.sender?.id && onLoadUserProfile(m.sender.id)}
            >
              {m.sender?.username?.[0]?.toUpperCase()}
            </Avatar>
            {!isIrc && m.sender?.is_online && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#4caf50",
                  border: "1.5px solid",
                  borderColor: "background.default",
                }}
              />
            )}
          </Box>
        ) : (
          <Box sx={{ width: 28, mr: 0.75, flexShrink: 0 }} />
        )
      )}
      <Box
        data-msg-bubble="1"
        sx={{
          maxWidth: isCircularVideoMsg
            ? 320
            : (bodySegments.some((s) => s.type === "codeblock") ? { xs: "96%", sm: "85%" } : { xs: "82%", sm: "70%" }),
          minWidth: 0,
          position: "relative",
          // visible for big-emoji Lottie overlay / overlap avatar; hidden otherwise to clip
          overflow: (isBigEmoji || isOverlap) ? "visible" : "hidden",
          px: isBigEmoji || isCircularVideoMsg ? 0.5 : 1.35,
          py: isBigEmoji || isCircularVideoMsg ? 0.35 : 0.85,
          borderRadius: isBigEmoji || isCircularVideoMsg || isIrc
            ? (isIrc ? 1 : 2)
            : (mine
              ? (isLastInSenderGroup ? "14px 14px 4px 14px" : "14px 14px 14px 14px")
              : (isLastInSenderGroup ? "14px 14px 14px 4px" : "14px 14px 14px 14px")),
          bgcolor: isBigEmoji || isCircularVideoMsg
            ? "transparent"
            : (isIrc
              ? "transparent"
              : (mine ? bubbleMineBg : "background.paper")),
          color: isBigEmoji || isCircularVideoMsg || isIrc
            ? "text.primary"
            : (mine ? "#fff" : "text.primary"),
          boxShadow: isBigEmoji || isCircularVideoMsg || isIrc
            ? "none"
            : (theme.palette.mode === "dark" ? "none" : 1),
          display: isCircularVideoMsg ? "flex" : undefined,
          flexDirection: isCircularVideoMsg ? "column" : undefined,
          alignItems: isCircularVideoMsg ? "center" : undefined,
          // Overlap: lift content so avatar can sit on the top corner
          pt: showOverlapAvatar && !isBigEmoji && !isCircularVideoMsg ? 2.1 : undefined,
          pl: isIrc ? 0.25 : undefined,
          pr: isIrc ? 0.5 : undefined,
          border: isIrc ? "none" : undefined,
        }}
      >
        {/* Overlap avatar — top-left (others) / top-right (mine) */}
        {showOverlapAvatar && !isBigEmoji && !isCircularVideoMsg && (
          <Avatar
            src={withTokenQuery(m.sender?.avatar) || undefined}
            sx={{
              width: 28,
              height: 28,
              cursor: "pointer",
              position: "absolute",
              top: -14,
              ...(mine ? { right: 8 } : { left: 8 }),
              border: "2.5px solid",
              borderColor: mine ? bubbleMineBg : "background.paper",
              boxShadow: (t) => t.palette.mode === "dark"
                ? "0 2px 8px rgba(0,0,0,0.45)"
                : "0 2px 8px rgba(0,0,0,0.18)",
              zIndex: 5,
              bgcolor: "background.paper",
            }}
            onClick={() => m.sender?.id && onLoadUserProfile(m.sender.id)}
          >
            {m.sender?.username?.[0]?.toUpperCase()}
          </Avatar>
        )}
        {/* Username: groups (modern/overlap) or always in IRC */}
        {((!mine && activeConv?.type === "group" && !isIrc) || isIrc) && (
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{
              color: isIrc
                ? (mine ? "primary.main" : "primary.light")
                : "primary.light",
              cursor: "pointer",
              display: "block",
              mb: isIrc ? 0.15 : 0,
            }}
            onClick={() => m.sender?.id && onLoadUserProfile(m.sender.id)}
          >
            {isIrc
              ? `${m.sender?.username || "user"}`
              : m.sender?.username}
          </Typography>
        )}
        {m.reply_to_preview && (
          <Box
            onClick={() => onJumpToMessage?.(m.reply_to_preview.id)}
            sx={{
              borderLeft: "3px solid",
              borderColor: mine ? "rgba(255,255,255,0.55)" : "primary.main",
              pl: 1, mb: 0.5, fontSize: 12,
              bgcolor: mine ? "rgba(0,0,0,0.12)" : alpha(theme.palette.primary.main, 0.06),
              borderRadius: "0 6px 6px 0", py: 0.35, pr: 0.5,
              cursor: "pointer",
              transition: "background-color 0.15s",
              "&:hover": {
                bgcolor: mine ? "rgba(0,0,0,0.22)" : alpha(theme.palette.primary.main, 0.14),
              },
            }}
          >
            <Typography variant="caption" fontWeight={700} display="block">
              {m.reply_to_preview.sender?.username || "…"}
            </Typography>
            <Typography variant="caption" noWrap display="block">{m.reply_to_preview.body}</Typography>
          </Box>
        )}
        {m.forwarded_from_user && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ opacity: 0.85, mb: 0.25 }}>
            <ForwardIcon sx={{ fontSize: 12 }} />
            <Typography variant="caption">Forwarded from {m.forwarded_from_user.username}</Typography>
          </Stack>
        )}
        {(m.attachments || []).length > 1 && (
          <Button
            size="small"
            variant="text"
            startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
            onClick={(e) => {
              e.stopPropagation();
              (m.attachments || []).forEach((att) => {
                const u = withTokenQuery(att.url);
                if (u) window.open(u, "_blank");
              });
            }}
            sx={{
              alignSelf: "flex-start",
              textTransform: "none",
              fontSize: 12,
              minWidth: 0,
              px: 0.5,
              color: mine ? "rgba(255,255,255,0.85)" : "primary.main",
              mb: 0.25,
            }}
          >
            Download all ({(m.attachments || []).length})
          </Button>
        )}
        {m.is_scheduled && mine && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              Scheduled{m.scheduled_for ? ` · ${new Date(m.scheduled_for).toLocaleString()}` : ""}
            </Typography>
            {onCancelSchedule && (
              <Typography
                variant="caption"
                color="error"
                sx={{ cursor: "pointer", fontWeight: 700 }}
                onClick={(e) => { e.stopPropagation(); onCancelSchedule(m); }}
              >
                Cancel
              </Typography>
            )}
          </Stack>
        )}
        {(m.attachments || []).map((a) => {
          const k = attachmentKind(a);
          const url = withTokenQuery(a.url);
          const voice = isVoiceAttachment(a);
          const videoMsg = isVideoMessageAttachment(a);
          const isActiveAudio = activeAudioId != null && String(activeAudioId) === String(a.id);
          return (
            <Box key={a.id} data-no-msg-menu="1" sx={{ mt: 0.6, minWidth: (k === "audio" || voice) ? 240 : undefined }}>
              {k === "image" ? (
                <ProtectedImageAttachment
                  att={a}
                  url={url}
                  message={m}
                  mine={mine}
                  onOpenPreview={onOpenPreview}
                  onReply={onReply}
                />
              ) : videoMsg || k === "video" ? (
                <ChatVideo
                  src={a.url}
                  filename={a.original_filename}
                  contentType={a.content_type}
                  circular={!!videoMsg}
                  attachment={a}
                  onOpen={onOpenPreview}
                  conversationId={m.conversation_id || activeConv?.id}
                />
              ) : voice || k === "audio" ? (
                /* Single Telegram-style player for voice + music.
                   Inline bubble controls drive the global top AudioPlayerBar.
                   Native <audio controls> removed — it caused dual players. */
                <Stack direction="column" spacing={0.5} sx={{ mt: 0.25 }}>
                  {!voice && (
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <MusicNoteIcon fontSize="small" sx={{ opacity: 0.85 }} />
                      <Typography variant="caption" noWrap sx={{ opacity: 0.9, maxWidth: 220 }}>
                        {a.original_filename || "Audio"}
                      </Typography>
                    </Stack>
                  )}
                  <InlineAudioPlayer
                    att={a}
                    mine={mine}
                    active={isActiveAudio}
                    isPlaying={audioIsPlaying}
                    currentTime={audioCurrentTime}
                    duration={audioDuration}
                    onPlay={onPlayAudio}
                    onToggle={onToggleAudio}
                    onSeek={onSeekAudio}
                    variant={voice ? "voice" : "audio"}
                  />
                </Stack>
              ) : (
                <FileAttachmentCard
                  att={a}
                  url={url}
                  mine={mine}
                  onOpen={(payload) => onOpenPreview(payload)}
                />
              )}
            </Box>
          );
        })}
        {bodyStr && isSingleEmoji ? (
          <Box
            ref={emojiRootRef}
            data-no-msg-menu="1"
            sx={{
              mt: hasAttachments ? 0.75 : 0,
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
              py: 0.25,
            }}
          >
            <SingleEmojiLottie
              emoji={singleEmojiChar || bodyStr.trim()}
              size={Math.round((emojiFontSize || 72) * 1.15)}
              playing={emojiPlaying}
              onPlayDone={() => setEmojiPlaying(false)}
              onClick={(e) => {
                e?.stopPropagation?.();
                playEmojiBurst(singleEmojiChar || bodyStr.trim(), { notify: true });
              }}
            />
          </Box>
        ) : bodyStr ? (
          <Typography
            component="div"
            dir="auto"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: isBigEmoji ? emojiFontSize : 14.5,
              lineHeight: isBigEmoji ? 1.15 : 1.45,
              mt: hasAttachments ? 0.75 : 0,
              textAlign: isBigEmoji ? "center" : "inherit",
              letterSpacing: isBigEmoji ? "0.04em" : undefined,
              userSelect: "text",
              WebkitUserSelect: "text",
              unicodeBidi: "plaintext",
              position: "relative",
            }}
          >
            {bodySegments.map((seg, i) => {
              if (seg.type === "mention") {
                return (
                  <Box
                    key={i}
                    component="span"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMentionClick?.(seg.value);
                    }}
                    sx={{
                      color: mine ? "#cce8ff" : theme.palette.primary.main,
                      fontWeight: 600,
                      cursor: "pointer",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    @{seg.value}
                  </Box>
                );
              }
              if (seg.type === "spoiler") {
                return <SpoilerText key={i} mine={mine}>{seg.value}</SpoilerText>;
              }
              if (seg.type === "code") {
                return (
                  <Box
                    key={i}
                    component="code"
                    sx={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "0.9em",
                      px: 0.6, py: 0.15, borderRadius: 0.75,
                      bgcolor: mine ? "rgba(0,0,0,0.25)" : "action.hover",
                      border: "1px solid",
                      borderColor: mine ? "rgba(255,255,255,0.12)" : "divider",
                    }}
                  >
                    {seg.value}
                  </Box>
                );
              }
              if (seg.type === "codeblock") {
                return <CodeBlock key={i} code={seg.value} lang={seg.lang || ""} mine={mine} onEditCode={onEditCode} />;
              }
              if (seg.type === "quote") {
                return (
                  <Box
                    key={i}
                    sx={{
                      display: "block",
                      my: 0.5,
                      pl: 1.25,
                      borderLeft: "3px solid",
                      borderColor: mine ? "rgba(255,255,255,0.45)" : "primary.main",
                      opacity: 0.92,
                      fontStyle: "italic",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {seg.value}
                  </Box>
                );
              }
              return <React.Fragment key={i}>{seg.value}</React.Fragment>;
            })}
          </Typography>
        ) : null}
        {(m.reactions || []).length > 0 && (
          <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {(m.reactions || []).map((r) => {
              // Support both aggregated {emoji, count, mine} and legacy full list
              const em = r.emoji;
              const count = r.count != null
                ? r.count
                : (m.reactions || []).filter((x) => x.emoji === em).length;
              const mineReact = r.mine != null
                ? !!r.mine
                : (m.reactions || []).some(
                    (x) => x.emoji === em && String(x.user?.id) === String(meId)
                  );
              // Deduplicate if legacy format still present
              if (r.count == null && (m.reactions || []).findIndex((x) => x.emoji === em) !== (m.reactions || []).indexOf(r)) {
                return null;
              }
              const tip = `${em} ${count}`;
              return (
                <Tooltip key={em} title={tip} arrow placement="top">
                  <Chip
                    size="small"
                    label={`${em} ${count}`}
                    onClick={(e) => { e.stopPropagation(); onReact(m.id, em); }}
                    sx={{
                      height: 24, fontSize: 12,
                      bgcolor: mineReact
                        ? alpha(theme.palette.primary.main, mine ? 0.35 : 0.15)
                        : (mine ? "rgba(255,255,255,0.12)" : "action.hover"),
                      color: mine ? "#fff" : "text.primary",
                    }}
                  />
                </Tooltip>
              );
            })}
          </Stack>
        )}
        <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.4} mt={0.35}>
          <IconButton className="msg-actions" size="small"
            sx={{ p: 0.2, opacity: { xs: 0.65, md: 0 }, color: mine ? "rgba(255,255,255,0.75)" : "text.secondary" }}
            onClick={(e) => onReactAnchor(e, m)}>
            <EmojiEmotionsIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton className="msg-actions" size="small"
            sx={{ p: 0.2, opacity: { xs: 0.65, md: 0 }, color: mine ? "rgba(255,255,255,0.75)" : "text.secondary" }}
            onClick={() => onReply(m)}>
            <ReplyIcon sx={{ fontSize: 15 }} />
          </IconButton>
          {m.is_edited && <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 10, color: isBigEmoji ? "text.secondary" : "inherit" }}>edited</Typography>}
          {isPinnedMessage && <PushPinIcon sx={{ fontSize: 10, color: "primary.main", transform: "rotate(-30deg)", opacity: 0.7 }} />}
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11, color: isBigEmoji ? "text.secondary" : "inherit" }}>{formatTime(m.created_at)}</Typography>
          {tickEl}
        </Stack>
      </Box>
      {showSideAvatar && mine && (
        isLastInSenderGroup ? (
          <Box sx={{ position: "relative", ml: 0.75, mt: 0.15, flexShrink: 0, alignSelf: "flex-end", mb: 0.15 }}>
            <Avatar
              src={withTokenQuery(m.sender?.avatar) || undefined}
              sx={{ width: 28, height: 28, cursor: "pointer" }}
              onClick={() => m.sender?.id && onLoadUserProfile(m.sender.id)}
            >
              {m.sender?.username?.[0]?.toUpperCase()}
            </Avatar>
            {m.sender?.is_online && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#4caf50",
                  border: "1.5px solid",
                  borderColor: "background.default",
                }}
              />
            )}
          </Box>
        ) : (
          <Box sx={{ width: 28, ml: 0.75, flexShrink: 0 }} />
        )
      )}
    </Box>
  );
}

/** Reusable message-context menu items (used by the parent's right-click menu). */
export function MessageContextMenuItems({
  ctxMsg, isMine, onReply, onReact, onForward, onCopy, onPreview, onDownload,
  onEdit, onDelete, onShowReaders, onSelect, onPinMessage, isPinned,
}) {
  const ctxAtts = ctxMsg?.attachments || [];
  const hasText = Boolean(typeof ctxMsg?.body === "string" ? ctxMsg.body.trim() : ctxMsg?.body);
  return (
    <>
      {onSelect && ctxMsg?.id && !ctxMsg?.is_system && (
        <MenuItem onClick={() => onSelect(ctxMsg)}>
          <ListItemIcon><DoneAllIcon fontSize="small" /></ListItemIcon> Select
        </MenuItem>
      )}
      <MenuItem onClick={() => onReply(ctxMsg)}>
        <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon> Reply
      </MenuItem>
      <MenuItem onClick={(e) => onReact(e, ctxMsg)}>
        <ListItemIcon><EmojiEmotionsIcon fontSize="small" /></ListItemIcon> React
      </MenuItem>
      <MenuItem onClick={() => onForward(ctxMsg)}>
        <ListItemIcon><ForwardIcon fontSize="small" /></ListItemIcon> Forward
      </MenuItem>
      {onPinMessage && (
        <MenuItem onClick={() => onPinMessage(ctxMsg)}>
          <ListItemIcon>
            {isPinned
              ? <PushPinOutlinedIcon fontSize="small" />
              : <PushPinIcon fontSize="small" />}
          </ListItemIcon>
          {isPinned ? "Unpin message" : "Pin message"}
        </MenuItem>
      )}
      <MenuItem onClick={async () => { await onCopy(ctxMsg); }}>
        <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon> Copy text
      </MenuItem>
      {isMine && (
        <MenuItem onClick={() => onShowReaders(ctxMsg)}>
          <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon> Seen by
        </MenuItem>
      )}
      {ctxAtts.map((a) => (
        <MenuItem key={a.id} onClick={() => onPreview(a)}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          Preview {a.original_filename || "file"}
        </MenuItem>
      ))}
      {ctxAtts.length > 1 && (
        <MenuItem onClick={() => ctxAtts.forEach((a) => onDownload?.(a))}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Download all ({ctxAtts.length})
        </MenuItem>
      )}
      {ctxAtts.map((a) => (
        <MenuItem key={`dl-${a.id}`} onClick={() => onDownload(a)}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Download {a.original_filename || "file"}
        </MenuItem>
      ))}
      {isMine && (
        <MenuItem onClick={() => onEdit(ctxMsg)}>
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon> Edit
        </MenuItem>
      )}
      {isMine && (
        <MenuItem onClick={() => onDelete(ctxMsg)} sx={{ color: "error.main" }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete
        </MenuItem>
      )}
    </>
  );
}

export { REACTIONS };
