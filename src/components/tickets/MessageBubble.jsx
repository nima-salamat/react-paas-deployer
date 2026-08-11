import React, { useState } from "react";
import {
  Avatar, Box, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";

function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 16, ml: 0.5, color: "primary.main" }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 16, ml: 0.5, color: "text.disabled" }} />
    </Tooltip>
  );
}

export default function MessageBubble({
  message: m,
  mine = false,
  showHtmlToggle = true,
}) {
  const [showRaw, setShowRaw] = useState(false);
  const seen = Boolean(m.seen_at || m.is_seen);

  return (
    <Paper
      elevation={0}
      variant="outlined"
      data-message-id={m.id}
      sx={{
        p: 1.5,
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "92%",
        bgcolor: mine
          ? "action.selected"
          : m.is_staff_reply
            ? "action.hover"
            : "background.paper",
        borderColor: mine ? "primary.light" : "divider",
      }}
    >
      <Stack direction="row" gap={1.25} alignItems="flex-start">
        <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
          {(m.author?.username || "?")[0]?.toUpperCase()}
        </Avatar>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} flexWrap="wrap">
            <Typography variant="body2" fontWeight={600}>
              {m.author?.username || "User"}
              {m.is_staff_reply ? (
                <Chip size="small" label="Staff" sx={{ ml: 0.75, height: 18 }} color="primary" variant="outlined" />
              ) : null}
            </Typography>
            <Stack direction="row" alignItems="center">
              <Typography variant="caption" color="text.secondary">
                {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
              </Typography>
              <SeenTicks seen={seen} mine={mine} />
              {showHtmlToggle && (
                <Tooltip title={showRaw ? "Rendered view" : "View HTML source"}>
                  <IconButton size="small" onClick={() => setShowRaw((v) => !v)} sx={{ ml: 0.25 }}>
                    <CodeIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {!showRaw ? (
            <Box
              sx={{
                mt: 0.75,
                fontSize: 14,
                lineHeight: 1.55,
                wordBreak: "break-word",
                "& p": { m: 0, mb: 0.75 },
                "& p:last-child": { mb: 0 },
                "& pre": { bgcolor: "action.selected", p: 1, borderRadius: 1, overflow: "auto", fontSize: 12 },
                "& ul, & ol": { pl: 2.5, my: 0.5 },
                "& a": { color: "primary.main" },
                "& img": { maxWidth: "100%" },
              }}
              dangerouslySetInnerHTML={{ __html: m.body || "" }}
            />
          ) : (
            <Box
              component="pre"
              sx={{
                mt: 0.75,
                m: 0,
                p: 1,
                bgcolor: "action.hover",
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
                <Button key={a.id} size="small" href={a.download_url} target="_blank" rel="noopener">
                  {a.original_filename}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
