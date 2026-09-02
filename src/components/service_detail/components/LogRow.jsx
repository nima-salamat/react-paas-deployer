import React, { memo, useState, useMemo } from "react";
import { Box, Typography, Chip, Button, useTheme, useMediaQuery } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { inferLogLevel, formatLogTime } from "../utils";
import { LOG_COLLAPSE_CHARS, LOG_COLLAPSE_LINES } from "../constants";

export default memo(function LogRow({ entry }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [expanded, setExpanded] = useState(false);
  const level = entry?.level || inferLogLevel(entry?.text || entry?.message);
  const timeLabel = formatLogTime(entry?.timestamp || entry?.ts);
  const fullText = String(entry?.text || entry?.message || "");

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
        py: { xs: 0.65, sm: 0.75 },
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 0.35 : 1,
        alignItems: isMobile ? "stretch" : "flex-start",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          flexShrink: 0,
          flexWrap: "wrap",
          ...(isMobile
            ? { width: "100%" }
            : { flexDirection: "column", alignItems: "flex-start", minWidth: 68 }),
        }}
      >
        {timeLabel ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              ...mono,
              fontSize: 10.5,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
            }}
          >
            {timeLabel}
          </Typography>
        ) : null}
        <Chip
          label={String(level || "info").toUpperCase()}
          size="small"
          color={levelColor}
          variant="outlined"
          sx={{
            height: 18,
            fontSize: 9.5,
            fontWeight: 700,
            flexShrink: 0,
            "& .MuiChip-label": { px: 0.75 },
          }}
        />
        {entry?.stage ? (
          <Chip
            label={entry.stage}
            size="small"
            variant="outlined"
            sx={{
              height: 18,
              fontSize: 9.5,
              maxWidth: isMobile ? 120 : 140,
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
        ) : null}
        {entry?.progress != null && entry.progress !== "" ? (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
            {entry.progress}%
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : "auto" }}>
        <Box
          component="pre"
          sx={{
            m: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            fontSize: { xs: 11.5, sm: 12.5 },
            lineHeight: 1.5,
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
          <Box sx={{ mt: 0.35, display: "flex", justifyContent: "flex-start" }}>
            <Button
              size="small"
              variant="text"
              onClick={() => setExpanded((v) => !v)}
              startIcon={
                expanded ? (
                  <ExpandLessIcon sx={{ fontSize: 16 }} />
                ) : (
                  <ExpandMoreIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{
                minWidth: 0,
                px: 0.75,
                py: 0.1,
                fontSize: 11,
                textTransform: "none",
                color: "text.secondary",
                fontWeight: 600,
              }}
            >
              {expanded ? "Show less" : "Show more"}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});
