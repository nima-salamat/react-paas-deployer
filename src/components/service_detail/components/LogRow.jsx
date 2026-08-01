import React, { memo, useState, useMemo } from "react";
import { Box, Typography, Chip, Button, IconButton, useTheme } from "@mui/material";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { inferLogLevel, formatLogTime } from "../utils";
import { LOG_COLLAPSE_CHARS, LOG_COLLAPSE_LINES } from "../constants";

export default memo(function LogRow({ entry }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const level = entry?.level || inferLogLevel(entry?.text);
  const timeLabel = formatLogTime(entry?.timestamp);
  const fullText = String(entry?.text || "");

  const lineCount = useMemo(
    () => (fullText ? fullText.split(/\r?\n/).length : 0),
    [fullText]
  );

  const isLong =
    fullText.length > LOG_COLLAPSE_CHARS || lineCount > LOG_COLLAPSE_LINES;

  const borderColor =
    level === "error"
      ? theme.palette.error.main
      : level === "warning"
      ? theme.palette.warning.main
      : level === "debug"
      ? theme.palette.text.disabled
      : theme.palette.primary.main;

  const bg =
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.03)"
      : "rgba(0,0,0,0.02)";

  return (
    <Box
      sx={{
        borderLeft: 3,
        borderColor,
        bgcolor: bg,
        borderRadius: 1,
        px: 1,
        py: 0.75,
        display: "flex",
        gap: 1,
        alignItems: "flex-start",
      }}
    >
      {timeLabel ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            flexShrink: 0,
            mt: 0.2,
            minWidth: 58,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 11,
          }}
        >
          {timeLabel}
        </Typography>
      ) : null}
      <Chip
        label={level.toUpperCase()}
        size="small"
        variant="outlined"
        sx={{
          height: 22,
          fontSize: 11,
          fontWeight: 700,
          mt: 0.1,
          flexShrink: 0,
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          component="pre"
          sx={{
            m: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 12,
            lineHeight: 1.55,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            ...(isLong && !expanded
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: LOG_COLLAPSE_LINES,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }
              : null),
          }}
        >
          {fullText}
        </Box>

        {isLong ? (
          <Box sx={{ mt: 0.5, display: "flex", justifyContent: "flex-end" }}>
            {expanded ? (
              <Button
                size="small"
                variant="text"
                onClick={() => setExpanded(false)}
                startIcon={<UnfoldLessIcon sx={{ fontSize: 16 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.15,
                  fontSize: 11,
                  textTransform: "none",
                  color: "text.secondary",
                }}
              >
                Collapse
              </Button>
            ) : (
              <IconButton
                size="small"
                onClick={() => setExpanded(true)}
                aria-label="Expand log"
                title="Expand"
                sx={{
                  p: 0.35,
                  color: "text.secondary",
                  borderRadius: 1,
                  "&:hover": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(0,0,0,0.06)",
                  },
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});