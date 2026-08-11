import React, { useMemo } from "react";
import {
  Box, Typography, Stack, Avatar, Chip, IconButton, ListItemIcon, MenuItem,
  alpha, Slider,
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
import VideoPlayer from "./VideoPlayer";

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

  // Use the waveform bars as a seekable progress surface
  const onWaveClick = (e) => {
    if (!active || !dur) {
      onPlay?.(att);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek?.(att, ratio);
  };

  const accent = mine ? "#ffffff" : theme.palette.primary.main;
  const trackBg = mine ? "rgba(255,255,255,0.25)" : alpha(theme.palette.primary.main, 0.18);
  const playedBg = mine ? "rgba(255,255,255,0.95)" : theme.palette.primary.main;

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      onClick={(e) => { e.stopPropagation(); }}
      sx={{
        bgcolor: mine ? "rgba(0,0,0,0.18)" : "action.hover",
        borderRadius: 3,
        px: 1, py: 0.75,
        minWidth: variant === "voice" ? 220 : 240,
        maxWidth: 300,
        "&:hover": { bgcolor: mine ? "rgba(0,0,0,0.25)" : "action.selected" },
      }}
    >
      {/* Play / Pause */}
      <IconButton
        size="small"
        onClick={() => (active ? onToggle?.(att) : onPlay?.(att))}
        sx={{
          bgcolor: accent,
          color: mine ? theme.palette.primary.main : "#fff",
          width: 32, height: 32,
          "&:hover": { bgcolor: accent, opacity: 0.85 },
        }}
      >
        {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
      </IconButton>

      {/* Waveform with progress overlay */}
      <Box
        onClick={onWaveClick}
        sx={{
          flex: 1,
          minWidth: 80,
          height: 28,
          position: "relative",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "1px",
        }}
      >
        {peaks.map((p, i) => {
          const filled = (i / peaks.length) <= progress;
          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: `${Math.max(15, Math.min(100, p * 100))}%`,
                bgcolor: filled ? playedBg : trackBg,
                borderRadius: 0.5,
                transition: "background-color 0.15s",
              }}
            />
          );
        })}
      </Box>

      {/* Time / duration */}
      <Typography
        variant="caption"
        sx={{
          fontVariantNumeric: "tabular-nums",
          minWidth: 38,
          fontSize: 11,
          opacity: 0.85,
          color: mine ? "inherit" : "text.secondary",
        }}
      >
        {active && cur > 0 ? formatDuration(cur) : (dur ? formatDuration(dur) : "0:00")}
      </Typography>
    </Stack>
  );
}

/**
 * Single message bubble with attachments, reactions, read-receipt ticks,
 * @mention parsing, voice/video message rendering, and clickable reply preview.
 */
export default function MessageBubble({
  m, meId, activeConv,
  onContextOpen, onReact, onReactAnchor, onReply,
  onOpenPreview, onShowReaders, onLoadUserProfile,
  onJumpToMessage, onPlayAudio, onToggleAudio, onSeekAudio,
  onMentionClick,
  // Global audio player state — used to render inline progress on the active message
  activeAudioId, audioIsPlaying, audioCurrentTime, audioDuration,
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

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: mine ? "flex-end" : "flex-start",
        mb: 0.6,
        px: 0.5,
        "&:hover .msg-actions": { opacity: 1 },
      }}
      onContextMenu={(e) => onContextOpen(e, m)}
    >
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
        {bodyStr && (
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 14.5,
              lineHeight: 1.45,
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
                  onClick={() => onOpenPreview({ ...a, url })}
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
              ) : videoMsg ? (
                /* Circular video message — VideoPlayer handles its own
                   circular styling + theater mode. The black ring around
                   the circle is part of the player's design. */
                <VideoPlayer src={url} filename={a.original_filename} circular />
              ) : k === "video" ? (
                <VideoPlayer src={url} filename={a.original_filename} maxWidth={360} maxHeight={360} />
              ) : voice ? (
                /* Voice message — inline waveform + play button (also opens global player) */
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
                  variant="voice"
                />
              ) : k === "audio" ? (
                /* Regular audio file — inline player (music-style) */
                <Stack direction="column" spacing={0.5} sx={{ mt: 0.25 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <MusicNoteIcon fontSize="small" sx={{ opacity: 0.85 }} />
                    <Typography variant="caption" noWrap sx={{ opacity: 0.9, maxWidth: 220 }}>
                      {a.original_filename || "Audio"}
                    </Typography>
                  </Stack>
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
                    variant="audio"
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
        {(m.reactions || []).length > 0 && (
          <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {[...new Set((m.reactions || []).map((r) => r.emoji))].map((em) => {
              const count = (m.reactions || []).filter((r) => r.emoji === em).length;
              const mineReact = (m.reactions || []).some(
                (r) => r.emoji === em && String(r.user?.id) === String(meId)
              );
              return (
                <Chip key={em} size="small" label={`${em} ${count}`} onClick={() => onReact(m.id, em)}
                  sx={{
                    height: 22, fontSize: 11,
                    bgcolor: mineReact
                      ? alpha(theme.palette.primary.main, mine ? 0.35 : 0.15)
                      : (mine ? "rgba(255,255,255,0.12)" : "action.hover"),
                    color: mine ? "#fff" : "text.primary",
                  }}
                />
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
  onEdit, onDelete, onShowReaders,
}) {
  const ctxAtts = ctxMsg?.attachments || [];
  return (
    <>
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
