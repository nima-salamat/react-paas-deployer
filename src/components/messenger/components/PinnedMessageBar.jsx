/**
 * PinnedMessageBar — A floating island that shows the currently-viewed pinned message
 * in a conversation, with up/down arrows to cycle through all pinned messages.
 *
 * Position: Below the chat header, below the AudioPlayerBar, below the
 * multi-select (forward/reply/cancel) panel. Rendered as a centered floating
 * island with height = half of header height (~28px).
 *
 * Behavior:
 * - Shows the most-recently pinned message by default.
 * - Pressing the up arrow (↑) cycles to the next older pinned message (looping).
 * - Pressing the down arrow (↓) cycles to the next newer pinned message (looping).
 * - Clicking the bar scrolls to the pinned message (centers it in the chat).
 * - If the pinned message is not loaded, onJumpToMessage is called which
 *   triggers the auto-load-older logic in MessengerApp.
 *
 * Props:
 *   pinnedMessages  — array of { id, message, pinned_at } (newest-pinned-first)
 *   currentIndex    — which pinned message index is currently displayed
 *   onCycleUp       — fn() → go to older pinned message
 *   onCycleDown     — fn() → go to newer pinned message
 *   onJumpToMessage — fn(messageId) → scroll to and load the message
 *   headerHeight    — number, the header's height in px (for sizing)
 */
import React, { useCallback, useMemo } from "react";
import {
  Box, Typography, IconButton, Tooltip, Chip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import PushPinIcon from "@mui/icons-material/PushPin";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

export default function PinnedMessageBar({
  pinnedMessages = [],
  currentIndex = 0,
  onCycleUp,
  onCycleDown,
  onJumpToMessage,
  headerHeight = 56,
}) {
  const theme = useTheme();

  const pin = pinnedMessages[currentIndex];
  const total = pinnedMessages.length;
  const msg = pin?.message;
  const bodyPreview = typeof msg?.body === "string"
    ? (msg.body.length > 60 ? msg.body.slice(0, 60) + "…" : msg.body)
    : "Pinned message";
  const senderName = msg?.sender?.username || "";
  const barHeight = Math.max(28, Math.round(headerHeight / 2));

  // Hooks must run unconditionally (before any early return).
  const handleClick = useCallback(() => {
    if (msg?.id && onJumpToMessage) {
      onJumpToMessage(msg.id);
    }
  }, [msg?.id, onJumpToMessage]);

  // Nothing to show
  if (!total || !pin) return null;

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        px: 1.5,
        height: barHeight,
        minHeight: barHeight,
        maxHeight: barHeight,
        bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.16 : 0.1),
        borderBottom: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        userSelect: "none",
        position: "relative",
        zIndex: 10,
        transition: "background-color 0.2s ease",
        "&:hover": {
          bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.24 : 0.16),
        },
      }}
    >
      {/* Pin icon */}
      <PushPinIcon
        sx={{
          fontSize: 14,
          color: "primary.main",
          transform: "rotate(-30deg)",
          flexShrink: 0,
        }}
      />

      {/* Sender name */}
      {senderName && (
        <Typography
          variant="caption"
          fontWeight={600}
          color="primary.main"
          noWrap
          sx={{ flexShrink: 0, maxWidth: 80 }}
        >
          {senderName}
        </Typography>
      )}

      {/* Message preview */}
      <Typography
        variant="caption"
        color="text.secondary"
        noWrap
        sx={{ flex: 1, minWidth: 0, textAlign: "center" }}
      >
        {bodyPreview}
      </Typography>

      {/* Counter chip */}
      {total > 1 && (
        <Chip
          label={`${currentIndex + 1}/${total}`}
          size="small"
          sx={{
            height: 18,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.06)",
            flexShrink: 0,
          }}
        />
      )}

      {/* Cycle arrows — only show when there are multiple pins */}
      {total > 1 && (
        <>
          <Tooltip title="Previous pinned" placement="top">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onCycleUp?.(); }}
              sx={{
                p: 0.15,
                width: 20,
                height: 20,
                flexShrink: 0,
                "& .MuiSvgIcon-root": { fontSize: 14 },
              }}
            >
              <KeyboardArrowUpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Next pinned" placement="top">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onCycleDown?.(); }}
              sx={{
                p: 0.15,
                width: 20,
                height: 20,
                flexShrink: 0,
                "& .MuiSvgIcon-root": { fontSize: 14 },
              }}
            >
              <KeyboardArrowDownIcon />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Box>
  );
}
