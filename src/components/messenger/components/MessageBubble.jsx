import React, { useMemo } from "react";
import {
  Box, Typography, Stack, Avatar, Chip, IconButton, ListItemIcon, MenuItem, Dialog,
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
  parseMentions, isVoiceAttachment, isVideoMessageAttachment,
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
function ChatVideo({ src, filename, contentType, circular = false, attachment, onOpen }) {
  const videoRef = React.useRef(null);
  const [playing, setPlaying] = React.useState(false);
  const [error, setError] = React.useState("");
  const safeSrc = React.useMemo(() => withTokenQuery(src), [src]);

  React.useEffect(() => {
    setError("");
    setPlaying(false);
  }, [safeSrc]);

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
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => setError("Playback blocked"));
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

export default function MessageBubble({
  m, meId, activeConv,
  onContextOpen, onReact, onReactAnchor, onReply,
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

  const bodySegments = parseMentions(bodyStr);

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
      // Enter selection + select this message (Telegram-style)
      onToggleSelect?.(m, true);
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
        alignItems: "center",
        bgcolor: selected ? (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.18)" : "rgba(25,118,210,0.1)" : "transparent",
        borderRadius: 2,
        transition: "background-color 0.15s",
        "&:hover .msg-actions": { opacity: 1 },
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
          maxWidth: { xs: "82%", sm: "70%" },
          px: 1.35,
          py: 0.85,
          borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          bgcolor: mine
            ? (theme.palette.mode === "dark" ? "#2b5278" : theme.palette.primary.main)
            : "background.paper",
          color: mine ? "#fff" : "text.primary",
          boxShadow: theme.palette.mode === "dark" ? "none" : 1,
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
                        body: a.original_filename || "Photo",
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
                    maxWidth: "100%", borderRadius: 1.5, maxHeight: 320,
                    display: "block", cursor: "pointer",
                  }}
                />
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
                <Chip
                  icon={<VisibilityIcon />}
                  label={a.original_filename || "file"}
                  size="small"
                  onClick={() => onOpenPreview({ ...a, url })}
                  onDelete={() => window.open(withTokenQuery(a.url), "_blank")}
                  deleteIcon={<DownloadIcon />}
                  sx={{ maxWidth: "100%", cursor: "pointer" }}
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
              fontSize: 14.5,
              lineHeight: 1.45,
              mt: (m.attachments || []).length ? 0.75 : 0,
            }}
          >
            {bodySegments.map((seg, i) =>
              seg.type === "mention" ? (
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
              ) : (
                <React.Fragment key={i}>{seg.value}</React.Fragment>
              )
            )}
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
          {m.is_edited && <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 10 }}>edited</Typography>}
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11 }}>{formatTime(m.created_at)}</Typography>
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
