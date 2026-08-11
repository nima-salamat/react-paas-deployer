import React from "react";
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
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import {
  attachmentKind, formatTime, formatDuration, withTokenQuery, REACTIONS,
  parseMentions, isVoiceAttachment, isVideoMessageAttachment,
} from "../messengerUtils";

/**
 * Single message bubble with attachments, reactions, read-receipt ticks,
 * @mention parsing, voice/video message rendering, and clickable reply preview.
 *
 * Props:
 *  - m: message object (already shaped by serializer)
 *  - meId: current user id (raw)
 *  - activeConv: the active conversation (for group/peer detection)
 *  - onContextOpen: (event, message) => void
 *  - onReact: (msgId, emoji) => void
 *  - onReactAnchor: (event, message) => void  (open emoji picker)
 *  - onReply: (message) => void
 *  - onEdit: (message) => void
 *  - onDelete: (message) => void
 *  - onForward: (message) => void
 *  - onOpenPreview: (attachment) => void
 *  - onShowReaders: (message) => void
 *  - onCopyText: (text) => void
 *  - onLoadUserProfile: (userId) => void
 *  - onJumpToMessage: (msgId) => void   — scroll to replied message
 *  - onPlayAudio: (attachment) => void  — hand off to top player bar
 *  - onMentionClick: (username) => void — open that user's profile
 */
export default function MessageBubble({
  m, meId, activeConv,
  onContextOpen, onReact, onReactAnchor, onReply,
  onOpenPreview, onShowReaders, onLoadUserProfile,
  onJumpToMessage, onPlayAudio, onMentionClick,
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

  // Parse @mentions in body
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
            src={m.sender?.avatar || undefined}
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
          return (
            <Box key={a.id} sx={{ mt: 0.6, minWidth: (k === "audio" || voice) ? 220 : undefined }}>
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
                /* Circular video message (Telegram-style) */
                <Box
                  component="video"
                  src={url}
                  controls
                  sx={{
                    width: 220, height: 220, borderRadius: "50%",
                    objectFit: "cover", display: "block",
                    border: `3px solid ${mine ? "rgba(255,255,255,0.3)" : alpha(theme.palette.primary.main, 0.3)}`,
                  }}
                />
              ) : k === "video" ? (
                <Box component="video" src={url} controls
                  sx={{ maxWidth: "100%", borderRadius: 1.5, maxHeight: 320, display: "block" }} />
              ) : voice ? (
                /* Voice message — custom UI delegates playback to the top audio bar */
                <Box
                  onClick={(e) => { e.stopPropagation(); onPlayAudio?.(a); }}
                  sx={{
                    bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
                    borderRadius: 3, px: 1.5, py: 1, minWidth: 200, maxWidth: 280,
                    display: "flex", alignItems: "center", gap: 1, cursor: "pointer",
                    "&:hover": { bgcolor: mine ? "rgba(0,0,0,0.22)" : "action.selected" },
                  }}
                >
                  <PlayArrowIcon fontSize="small" />
                  <GraphicEqIcon fontSize="small" sx={{ opacity: 0.7 }} />
                  <Typography variant="caption" noWrap sx={{ flex: 1 }}>
                    {a.duration ? formatDuration(a.duration) : "Voice message"}
                  </Typography>
                </Box>
              ) : k === "audio" ? (
                /* Regular audio file — also delegate to top player bar */
                <Box
                  onClick={(e) => { e.stopPropagation(); onPlayAudio?.(a); }}
                  sx={{
                    bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
                    borderRadius: 2, px: 1.25, py: 1, minWidth: 220, maxWidth: 300,
                    display: "flex", alignItems: "center", gap: 1, cursor: "pointer",
                    "&:hover": { bgcolor: mine ? "rgba(0,0,0,0.22)" : "action.selected" },
                  }}
                >
                  <PlayArrowIcon fontSize="small" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" display="block" noWrap sx={{ opacity: 0.9 }}>
                      {a.original_filename || "Audio"}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {a.duration ? formatDuration(a.duration) : "Tap to play"}
                    </Typography>
                  </Box>
                </Box>
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
