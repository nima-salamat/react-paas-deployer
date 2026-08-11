import React, { useState } from "react";
import {
  Avatar, Box, Button, IconButton, Stack, Tooltip, Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon from "@mui/icons-material/Download";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import ImageIcon from "@mui/icons-material/Image";
import VideocamIcon from "@mui/icons-material/Videocam";

function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 15, ml: 0.35, color: mine ? "inherit" : "primary.main", verticalAlign: "middle", opacity: 0.95 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 15, ml: 0.35, opacity: 0.7, verticalAlign: "middle" }} />
    </Tooltip>
  );
}

function formatSize(bytes) {
  if (bytes == null || bytes === "") return "";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(ct, name = "") {
  if (ct && String(ct).startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
}
function isAudio(ct, name = "") {
  if (ct && String(ct).startsWith("audio/")) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(name);
}
function isVideo(ct, name = "") {
  if (ct && String(ct).startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv)$/i.test(name);
}

function AttachmentBlock({ a, mine }) {
  const name = a.original_filename || a.name || "file";
  const ct = a.content_type || "";
  const url = a.download_url || a.url;
  const sizeLabel = formatSize(a.size);

  if (isImage(ct, name) && url) {
    return (
      <Box sx={{ mt: 0.75, maxWidth: 280 }}>
        <Box
          component="a"
          href={url}
          target="_blank"
          rel="noopener"
          sx={{ display: "block", borderRadius: 1.5, overflow: "hidden", lineHeight: 0 }}
        >
          <Box
            component="img"
            src={url}
            alt={name}
            loading="lazy"
            sx={{
              width: "100%",
              maxHeight: 240,
              objectFit: "cover",
              display: "block",
              bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
            }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ display: "block", mt: 0.35, opacity: 0.85 }}>
          <ImageIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
          {name}{sizeLabel ? ` · ${sizeLabel}` : ""}
        </Typography>
      </Box>
    );
  }

  if (isAudio(ct, name) && url) {
    return (
      <Box sx={{ mt: 0.75, minWidth: 200, maxWidth: 300 }}>
        <Stack direction="row" alignItems="center" gap={0.5} mb={0.4}>
          <AudioFileIcon sx={{ fontSize: 16, opacity: 0.9 }} />
          <Typography variant="caption" sx={{ opacity: 0.95 }} noWrap title={name}>
            {name}{sizeLabel ? ` · ${sizeLabel}` : ""}
          </Typography>
        </Stack>
        <Box
          component="audio"
          controls
          preload="metadata"
          src={url}
          sx={{ width: "100%", height: 36, outline: "none" }}
        />
      </Box>
    );
  }

  if (isVideo(ct, name) && url) {
    return (
      <Box sx={{ mt: 0.75, maxWidth: 300 }}>
        <Box
          component="video"
          controls
          preload="metadata"
          src={url}
          sx={{ width: "100%", maxHeight: 220, borderRadius: 1.5, bgcolor: "#000" }}
        />
        <Typography variant="caption" sx={{ display: "block", mt: 0.35, opacity: 0.85 }}>
          <VideocamIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
          {name}{sizeLabel ? ` · ${sizeLabel}` : ""}
        </Typography>
      </Box>
    );
  }

  // Generic file
  return (
    <Button
      size="small"
      href={url}
      target="_blank"
      rel="noopener"
      startIcon={<InsertDriveFileIcon />}
      endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
      variant="outlined"
      sx={{
        mt: 0.75,
        maxWidth: "100%",
        justifyContent: "flex-start",
        textTransform: "none",
        color: mine ? "primary.contrastText" : "text.primary",
        borderColor: mine ? "rgba(255,255,255,0.45)" : "divider",
        "& .MuiButton-startIcon, & .MuiButton-endIcon": {
          color: mine ? "rgba(255,255,255,0.9)" : "text.secondary",
        },
      }}
    >
      <Box sx={{ textAlign: "left", overflow: "hidden" }}>
        <Typography variant="caption" noWrap display="block" title={name} sx={{ maxWidth: 180 }}>
          {name}
        </Typography>
        {sizeLabel && (
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 10 }}>
            {sizeLabel}
          </Typography>
        )}
      </Box>
    </Button>
  );
}

/**
 * Messenger-style chat bubble with rich attachments.
 */
export default function MessageBubble({
  message: m,
  mine = false,
  showHtmlToggle = true,
  showAvatar = true,
}) {
  const [showRaw, setShowRaw] = useState(false);
  const seen = Boolean(m.seen_at || m.is_seen);
  const name = m.author?.username || (m.is_staff_reply ? "Staff" : "User");
  const time = m.created_at
    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const bodyText = (m.body || "").replace(/<[^>]+>/g, "").trim();
  const hasBody = Boolean(bodyText);
  const attachments = m.attachments || [];

  return (
    <Stack
      direction="row"
      justifyContent={mine ? "flex-end" : "flex-start"}
      alignItems="flex-end"
      gap={0.75}
      data-message-id={m.id}
      sx={{ width: "100%", px: 0.5 }}
    >
      {!mine && showAvatar ? (
        <Avatar
          sx={{
            width: 28,
            height: 28,
            fontSize: 12,
            bgcolor: m.is_staff_reply ? "primary.main" : "grey.500",
          }}
        >
          {name[0]?.toUpperCase()}
        </Avatar>
      ) : (
        showAvatar ? <Box sx={{ width: 28 }} /> : null
      )}

      <Box
        sx={{
          maxWidth: { xs: "85%", sm: "72%" },
          minWidth: 80,
          px: 1.35,
          py: 0.85,
          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          bgcolor: mine ? "primary.main" : "background.paper",
          color: mine ? "primary.contrastText" : "text.primary",
          boxShadow: mine ? "none" : 1,
          border: mine ? "none" : "1px solid",
          borderColor: "divider",
        }}
      >
        {!mine && (
          <Typography
            variant="caption"
            sx={{
              display: "block",
              fontWeight: 700,
              mb: 0.25,
              color: m.is_staff_reply ? "primary.main" : "text.secondary",
            }}
          >
            {name}{m.is_staff_reply ? " · Staff" : ""}
          </Typography>
        )}

        {hasBody && !showRaw && (
          <Box
            sx={{
              fontSize: 14,
              lineHeight: 1.5,
              wordBreak: "break-word",
              "& p": { m: 0, mb: 0.5 },
              "& p:last-child": { mb: 0 },
              "& a": { color: mine ? "inherit" : "primary.main", textDecoration: "underline" },
              "& pre": {
                bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
                p: 1,
                borderRadius: 1,
                overflow: "auto",
                fontSize: 12,
              },
              "& ul, & ol": { pl: 2.25, my: 0.4 },
              "& img": { maxWidth: "100%", borderRadius: 1 },
            }}
            dangerouslySetInnerHTML={{ __html: m.body || "" }}
          />
        )}

        {hasBody && showRaw && (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 0.75,
              bgcolor: mine ? "rgba(0,0,0,0.12)" : "action.hover",
              borderRadius: 1,
              fontSize: 11,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {m.body || ""}
          </Box>
        )}

        {attachments.map((a) => (
          <AttachmentBlock key={a.id || a.download_url || a.original_filename} a={a} mine={mine} />
        ))}

        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.25} mt={0.4}>
          {showHtmlToggle && hasBody && (
            <Tooltip title={showRaw ? "Rendered" : "HTML source"}>
              <IconButton
                size="small"
                onClick={() => setShowRaw((v) => !v)}
                sx={{ p: 0.25, color: mine ? "rgba(255,255,255,0.75)" : "text.secondary" }}
              >
                <CodeIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              opacity: 0.8,
              color: mine ? "rgba(255,255,255,0.85)" : "text.secondary",
            }}
          >
            {time}
          </Typography>
          <Box sx={{ color: mine ? "rgba(255,255,255,0.9)" : undefined, display: "inline-flex" }}>
            <SeenTicks seen={seen} mine={mine} />
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
