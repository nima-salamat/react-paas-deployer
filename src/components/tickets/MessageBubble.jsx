import React, { useState } from "react";
import {
  Avatar, Box, Button, IconButton, Stack, Tooltip, Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";

function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 15, ml: 0.35, color: "primary.main", verticalAlign: "middle" }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 15, ml: 0.35, color: "text.disabled", verticalAlign: "middle" }} />
    </Tooltip>
  );
}

/**
 * Messenger-style chat bubble (Telegram/WhatsApp-like).
 * `mine` = current viewer authored this message → right side.
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
          maxWidth: { xs: "82%", sm: "70%" },
          minWidth: 80,
          px: 1.35,
          py: 0.85,
          borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          bgcolor: mine ? "primary.main" : "background.paper",
          color: mine ? "primary.contrastText" : "text.primary",
          boxShadow: mine ? "none" : 1,
          border: mine ? "none" : "1px solid",
          borderColor: "divider",
          position: "relative",
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

        {!showRaw ? (
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
        ) : (
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

        {(m.attachments || []).length > 0 && (
          <Stack direction="row" gap={0.5} flexWrap="wrap" mt={0.75}>
            {m.attachments.map((a) => (
              <Button
                key={a.id}
                size="small"
                href={a.download_url}
                target="_blank"
                rel="noopener"
                sx={{
                  color: mine ? "primary.contrastText" : "primary.main",
                  borderColor: mine ? "rgba(255,255,255,0.5)" : undefined,
                }}
                variant="outlined"
              >
                {a.original_filename}
              </Button>
            ))}
          </Stack>
        )}

        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.25} mt={0.4}>
          {showHtmlToggle && (
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
