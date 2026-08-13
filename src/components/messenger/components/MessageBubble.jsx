import React, { useMemo } from "react";
import CheckIcon from "@mui/icons-material/Check";
import {
  Box, Typography, Stack, Avatar, Chip, IconButton, ListItemIcon, MenuItem, Dialog, CircularProgress,
  alpha, Slider, Tooltip, Button,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReplyIcon from "@mui/icons-material/Reply";
import ForwardIcon from "@mui/icons-material/Forward";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import DoneIcon from "@mui/icons-material/Done";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import {
  attachmentKind, formatTime, formatDuration, withTokenQuery, REACTIONS,
  parseFormattedBody, isVoiceAttachment, isVideoMessageAttachment,
  emojiOnlyCount, isGifAttachment,
  downloadAttachmentToCache, getCachedAttachment,
} from "../messengerUtils";

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
  const [hljsMod, setHljsMod] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("highlight.js");
        try { await import("highlight.js/styles/github-dark.css"); } catch { /* style optional */ }
        if (!cancelled) setHljsMod(mod.default || mod);
      } catch {
        if (!cancelled) setHljsMod(false); // not installed — plain text fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const detected = React.useMemo(() => {
    const raw = (code || "").replace(/\n$/, "");
    let language = (lang || "").toLowerCase().trim();
    let html = "";
    const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    try {
      const hljs = hljsMod && hljsMod !== false ? hljsMod : null;
      if (hljs) {
        if (language && hljs.getLanguage(language)) {
          html = hljs.highlight(raw, { language, ignoreIllegals: true }).value;
        } else {
          const auto = hljs.highlightAuto(raw);
          language = auto.language || language || "";
          html = auto.value;
        }
      } else {
        html = escape(raw);
      }
    } catch {
      html = escape(raw);
    }
    const label = LANG_ALIASES[language] || (language ? language.toUpperCase() : "Code");
    return { html, label, language, raw };
  }, [code, lang, hljsMod]);

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
      sx={{
        display: "block",
        my: 0.6,
        // slight corner only — not a big pill
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
      onClick={(e) => e.stopPropagation()}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 0.5,
          px: { xs: 0.75, sm: 1.25 },
          py: 0.5,
          bgcolor: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Typography
          component="span"
          sx={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: 0.04,
            color: "rgba(255,255,255,0.55)",
            textTransform: "none",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          {detected.label}
        </Typography>
        <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        <Box
          component="button"
          type="button"
          onClick={onCopy}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            border: "none",
            cursor: "pointer",
            bgcolor: copied ? "rgba(46,160,67,0.2)" : "rgba(255,255,255,0.06)",
            color: copied ? "#3fb950" : "rgba(255,255,255,0.7)",
            borderRadius: "4px",
            px: 1,
            py: 0.35,
            fontSize: 11.5,
            fontWeight: 600,
            fontFamily: "inherit",
            transition: "background 0.15s, color 0.15s",
            "&:hover": {
              bgcolor: copied ? "rgba(46,160,67,0.28)" : "rgba(255,255,255,0.12)",
              color: copied ? "#3fb950" : "#fff",
            },
          }}
        >
          {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
          {copied ? "Copied" : "Copy"}
        </Box>
        {typeof onEditCode === "function" && (
          <Box
            component="button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const fence = "```" + (lang || "") + "\n" + (code || "") + "\n```";
              onEditCode(fence, { code, lang });
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
              ml: 0.5,
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
        {/* Line numbers */}
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
            "& .hljs-comment, & .hljs-quote": { color: "#8b949e", fontStyle: "italic" },
            "& .hljs-keyword, & .hljs-selector-tag": { color: "#ff7b72" },
            "& .hljs-string, & .hljs-attr": { color: "#a5d6ff" },
            "& .hljs-number, & .hljs-literal": { color: "#79c0ff" },
            "& .hljs-title, & .hljs-section": { color: "#d2a8ff" },
            "& .hljs-built_in, & .hljs-type": { color: "#ffa657" },
            "& .hljs-meta": { color: "#79c0ff" },
            "& .hljs-variable, & .hljs-template-variable": { color: "#ffa198" },
          }}
        >
          <code dangerouslySetInnerHTML={{ __html: detected.html }} />
        </Box>
      </Box>
    </Box>
  );
}



function ChatVideo({ src, filename, contentType, circular = false, attachment, onOpen }) {
  const videoRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [error, setError] = React.useState("");
  const safeSrc = React.useMemo(() => withTokenQuery(src), [src]);

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
      }}>
        <Typography variant="caption" color="text.secondary">No video</Typography>
      </Box>
    );
  }

  if (circular) {
    return (
      <Box
        sx={{
          width: 220, height: 220, position: "relative", display: "inline-block",
          borderRadius: "50%", overflow: "hidden", bgcolor: "#000", cursor: "pointer",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4), 0 0 0 4px rgba(0,0,0,0.55)",
        }}
        onClick={openFull}
      >
        <video
          ref={videoRef}
          src={safeSrc}
          playsInline
          preload="metadata"
          muted={false}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setError("Could not load video")}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
        />
        <Box
          onClick={(e) => { e.stopPropagation(); openFull(e); }}
          sx={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", bgcolor: "rgba(0,0,0,0.22)",
            "&:hover": { bgcolor: "rgba(0,0,0,0.38)" },
          }}
        >
          <Box sx={{
            width: 52, height: 52, borderRadius: "50%", bgcolor: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
            border: "2px solid rgba(255,255,255,0.35)",
          }}>
            <PlayArrowIcon sx={{ fontSize: 28, ml: 0.5 }} />
          </Box>
        </Box>
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

export default function MessageBubble({
  m, meId, activeConv,
  onContextOpen, onReact, onReactAnchor, onReply, onEditCode,
  onOpenPreview, onShowReaders, onLoadUserProfile,
  onJumpToMessage, onPlayAudio, onToggleAudio, onSeekAudio,
  onMentionClick,
  // Global audio player state — used to render inline progress on the active message
  activeAudioId, audioIsPlaying, audioCurrentTime, audioDuration,
  selectionMode = false,
  selected = false,
  isUnread = false,
  onToggleSelect,
}) {
  const theme = useTheme();
  if (m.type === "day") {
    return (
      <Box sx={{ textAlign: "center", my: 1.5 }}>
        <Chip label={m.label} size="small"
          sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9), fontSize: 11 }} />
      </Box>
    );
  }
  const mine = String(m.sender?.id) === String(meId);
  const bodyStr = typeof m.body === "string" ? m.body : String(m.body || "");

  if (m.is_system) {
    return (
      <Box sx={{ textAlign: "center", my: 1 }}>
        <Chip label={bodyStr} size="small"
          sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9), fontSize: 12 }} />
      </Box>
    );
  }

  // Read-receipt ticks (only for own messages)
  const readState = m.read_state || (mine ? "sent" : "read");
  const tickEl = mine && (
    <Box
      sx={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
      onClick={(e) => { e.stopPropagation(); onShowReaders(m); }}
      title="Seen by"
    >
      {readState === "read"
        ? <DoneAllIcon sx={{ fontSize: 14, color: theme.palette.info.light }} />
        : <DoneIcon sx={{ fontSize: 14, opacity: 0.75 }} />}
    </Box>
  );

  const bodySegments = parseFormattedBody(bodyStr);
  const hasAttachments = (m.attachments || []).length > 0;
  const emojiCount = (!hasAttachments && !m.reply_to_preview && !m.forwarded_from_user)
    ? emojiOnlyCount(bodyStr)
    : null;
  const isBigEmoji = emojiCount != null && emojiCount >= 1 && emojiCount <= 3;
  const emojiFontSize = emojiCount === 1 ? 72 : emojiCount === 2 ? 56 : emojiCount === 3 ? 44 : 14.5;

  const longPressTimer = React.useRef(null);
  const longPressMoved = React.useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDownMsg = (e) => {
    if (e.button != null && e.button !== 0) return;
    // Already selecting: toggle this message (do NOT force single-select)
    if (selectionMode) {
      // parent list handles range-drag after movement; here just note anchor via toggle without force
      return;
    }
    longPressMoved.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      // Mobile long-press → context menu (right-click equivalent), not selection
      try {
        if (navigator.vibrate) navigator.vibrate(12);
      } catch { /* */ }
      onContextOpen?.(
        {
          preventDefault() {},
          stopPropagation() {},
          clientX: e.clientX || (e.touches?.[0]?.clientX) || window.innerWidth / 2,
          clientY: e.clientY || (e.touches?.[0]?.clientY) || window.innerHeight / 2,
        },
        m,
      );
    }, 420);
  };
  const onPointerMoveMsg = (e) => {
    // Allow slight movement during long-press; only cancel on clear drag
    if (longPressTimer.current && (Math.abs(e.movementX || 0) > 14 || Math.abs(e.movementY || 0) > 14)) {
      longPressMoved.current = true;
      clearLongPress();
    }
  };
  const onPointerUpMsg = () => clearLongPress();

  return (
    <Box
      data-msg-id={m.id}
      data-msg-mine={mine ? "1" : "0"}
      data-msg-unread={isUnread ? "1" : "0"}
      data-msg-system={m.is_system ? "1" : "0"}
      sx={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        mb: 0.6,
        px: 0.5,
        py: 0.15,
        // Full row is the hit-target (side gutter counts as the message zone)
        width: "100%",
        alignItems: "center",
        bgcolor: selected ? (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.18)" : "rgba(25,118,210,0.1)" : "transparent",
        borderRadius: 2,
        transition: "background-color 0.15s",
        "&:hover .msg-actions": { opacity: 1 },
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (selectionMode) {
          onToggleSelect?.(m);
          return;
        }
        onContextOpen(e, m);
      }}
      onPointerDown={onPointerDownMsg}
      onPointerMove={onPointerMoveMsg}
      onPointerUp={onPointerUpMsg}
      onPointerCancel={onPointerUpMsg}
      onClick={(e) => {
        if (selectionMode) {
          e.stopPropagation();
          onToggleSelect?.(m);
        }
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
      {!mine && (
        <Box sx={{ position: "relative", mr: 0.75, mt: 0.5, flexShrink: 0 }}>
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
      )}
      <Box
        sx={{
          maxWidth: bodySegments.some((s) => s.type === "codeblock") ? { xs: "96%", sm: "85%" } : { xs: "82%", sm: "70%" },
          px: isBigEmoji ? 0.5 : 1.35,
          py: isBigEmoji ? 0.35 : 0.85,
          borderRadius: isBigEmoji ? 2 : (mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px"),
          bgcolor: isBigEmoji
            ? "transparent"
            : (mine
              ? (theme.palette.mode === "dark" ? "#2b5278" : theme.palette.primary.main)
              : "background.paper"),
          color: isBigEmoji ? "text.primary" : (mine ? "#fff" : "text.primary"),
          boxShadow: isBigEmoji ? "none" : (theme.palette.mode === "dark" ? "none" : 1),
        }}
      >
        {!mine && activeConv?.type === "group" && (
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: "primary.light", cursor: "pointer", display: "block" }}
            onClick={() => m.sender?.id && onLoadUserProfile(m.sender.id)}
          >
            {m.sender?.username}
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
        {(m.attachments || []).map((a) => {
          const k = attachmentKind(a);
          const url = withTokenQuery(a.url);
          const voice = isVoiceAttachment(a);
          const videoMsg = isVideoMessageAttachment(a);
          const isActiveAudio = activeAudioId != null && String(activeAudioId) === String(a.id);
          return (
            <Box key={a.id} sx={{ mt: 0.6, minWidth: (k === "audio" || voice) ? 240 : undefined }}>
              {k === "image" ? (
                <Box sx={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
                  <Box
                    component="img"
                    src={url}
                    alt={a.original_filename}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPreview({ ...a, url, message: m });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onReply?.({
                        ...m,
                        body: m.body || "",
                        _replyAttachment: a,
                        reply_to_preview: {
                          id: m.id,
                          body: isGifAttachment(a) ? "GIF" : (a.original_filename || "Photo"),
                          sender: m.sender,
                        },
                      });
                    }}
                    onError={(e) => {
                      if (!e.currentTarget.dataset.fallback) {
                        e.currentTarget.dataset.fallback = "1";
                        e.currentTarget.src = a.url;
                      } else {
                        e.currentTarget.style.display = "none";
                      }
                    }}
                    sx={{
                      maxWidth: "100%", borderRadius: 1.5, maxHeight: isGifAttachment(a) ? 360 : 320,
                      display: "block", cursor: "pointer",
                    }}
                  />
                  {isGifAttachment(a) && (
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
              ) : videoMsg || k === "video" ? (
                <ChatVideo
                  src={a.url}
                  filename={a.original_filename}
                  contentType={a.content_type}
                  circular={!!videoMsg}
                  attachment={a}
                  onOpen={onOpenPreview}
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
        {bodyStr && (
          <Typography
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
        )}
        {(m.reactions || []).length > 0 && (
          <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {[...new Set((m.reactions || []).map((r) => r.emoji))].map((em) => {
              const reactors = (m.reactions || []).filter((r) => r.emoji === em);
              const count = reactors.length;
              const mineReact = reactors.some((r) => String(r.user?.id) === String(meId));
              const names = reactors
                .map((r) => r.user?.username || r.user?.full_name || "User")
                .filter(Boolean);
              const tip = names.length ? `${em} ${names.join(", ")}` : `${em} ${count}`;
              return (
                <Tooltip key={em} title={tip} arrow placement="top">
                  <Chip
                    size="small"
                    label={`${em} ${count}`}
                    onClick={(e) => { e.stopPropagation(); onReact(m.id, em); }}
                    avatar={
                      reactors[0]?.user?.avatar ? (
                        <Avatar
                          src={withTokenQuery(reactors[0].user.avatar)}
                          sx={{ width: 16, height: 16 }}
                        />
                      ) : undefined
                    }
                    sx={{
                      height: 24, fontSize: 12,
                      bgcolor: mineReact
                        ? alpha(theme.palette.primary.main, mine ? 0.35 : 0.15)
                        : (mine ? "rgba(255,255,255,0.12)" : "action.hover"),
                      color: mine ? "#fff" : "text.primary",
                      "& .MuiChip-avatar": { width: 16, height: 16, ml: 0.5 },
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
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11, color: isBigEmoji ? "text.secondary" : "inherit" }}>{formatTime(m.created_at)}</Typography>
          {tickEl}
        </Stack>
      </Box>
    </Box>
  );
}

/** Reusable message-context menu items (used by the parent's right-click menu). */
export function MessageContextMenuItems({
  ctxMsg, isMine, onReply, onReact, onForward, onCopy, onPreview, onDownload,
  onEdit, onDelete, onShowReaders, onSelect,
}) {
  const ctxAtts = ctxMsg?.attachments || [];
  const hasText = Boolean(typeof ctxMsg?.body === "string" ? ctxMsg.body.trim() : ctxMsg?.body);
  return (
    <>
      {onSelect && hasText && (
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
