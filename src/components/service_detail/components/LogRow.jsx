import React, { memo, useState, useMemo } from "react";
import { Box, Typography, Chip, Button, IconButton, useTheme, useMediaQuery } from "@mui/material";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { inferLogLevel, formatLogTime } from "../utils";
import { LOG_COLLAPSE_CHARS, LOG_COLLAPSE_LINES } from "../constants";

export default memo(function LogRow({ entry }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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

  const levelColor =
    level === "error"
      ? "error"
      : level === "warning"
      ? "warning"
      : level === "debug"
      ? "default"
      : "primary";

  const mono = {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  };

  return (
    <Box
      sx={{
        borderLeft: 3,
        borderColor,
        bgcolor: bg,
        borderRadius: 1.5,
        px: { xs: 1, sm: 1.25 },
        py: { xs: 0.75, sm: 0.85 },
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 0.5 : 1.25,
        alignItems: isMobile ? "stretch" : "flex-start",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Meta row: time + level — full width on mobile, side column on desktop */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          flexShrink: 0,
          flexWrap: "wrap",
          ...(isMobile
            ? { width: "100%" }
            : { flexDirection: "column", alignItems: "flex-start", minWidth: 72 }),
        }}
      >
        {timeLabel ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              ...mono,
              fontSize: 11,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {timeLabel}
          </Typography>
        ) : null}
        <Chip
          label={level.toUpperCase()}
          size="small"
          color={levelColor}
          variant="outlined"
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        />
        {entry?.stage ? (
          <Chip
            label={entry.stage}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 10, maxWidth: 140 }}
          />
        ) : null}
        {entry?.progress != null && entry.progress !== "" ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
            {entry.progress}%
          </Typography>
        ) : null}
      </Box>

      {/* Message — takes remaining width, wraps properly on mobile */}
      <Box sx={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : "auto" }}>
        <Box
          component="pre"
          sx={{
            m: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            fontSize: { xs: 12, sm: 12.5 },
            lineHeight: 1.55,
            ...mono,
            width: "100%",
            maxWidth: "100%",
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
