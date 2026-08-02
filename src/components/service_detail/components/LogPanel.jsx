import React, { useRef, useMemo, useCallback, useEffect } from "react";
import {
  Paper,
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  LinearProgress,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DownloadIcon from "@mui/icons-material/Download";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import PauseIcon from "@mui/icons-material/Pause";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import ArticleIcon from "@mui/icons-material/Article";
import LogRow from "./LogRow";
import { inferLogLevel, isNearBottom, scrollToBottom } from "../utils";

export default function LogPanel({
  title,
  subtitle,
  entries,
  loading,
  error,
  connected = false,
  showConnectionChip = true,
  paused = false,
  filter,
  level,
  onFilterChange,
  onLevelChange,
  onTogglePaused,
  onRefresh,
  onClear,
  onDownload,
  onCopy,
  onJumpToLatest,
  onLoadOlder,
  hasMoreOlder = false,
  loadingOlder = false,
  scrollRef,
  topActions,
  emptyText = "No log entries available.",
  stickToBottom = true,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const stickRef = useRef(true);
  const internalScrollRef = useRef(null);
  const prevLenRef = useRef(0);

  const setScrollNode = useCallback(
    (node) => {
      internalScrollRef.current = node;
      if (!scrollRef) return;
      if (typeof scrollRef === "function") scrollRef(node);
      else scrollRef.current = node;
    },
    [scrollRef]
  );

  const visibleEntries = useMemo(() => {
    const normalizedFilter = String(filter || "").trim().toLowerCase();

    return (entries || []).filter((entry) => {
      const lineLevel = entry?.level || inferLogLevel(entry?.text);
      if (level !== "all" && lineLevel !== level) return false;
      if (!normalizedFilter) return true;
      return String(entry?.text || "").toLowerCase().includes(normalizedFilter);
    });
  }, [entries, filter, level]);

  useEffect(() => {
    if (!stickToBottom) return;
    const el = internalScrollRef.current;
    if (!el) return;

    const len = visibleEntries.length;
    const prev = prevLenRef.current;
    const grew = len > prev;
    const reset = len < prev || (prev === 0 && len > 0);
    prevLenRef.current = len;

    if (reset || (grew && stickRef.current)) {
      requestAnimationFrame(() => scrollToBottom(el));
    }
  }, [visibleEntries, stickToBottom]);

  const handleDownload = () => onDownload?.(visibleEntries);
  const handleCopy = () => onCopy?.(visibleEntries);
  const handleClear = () => onClear?.();
  const handleJump = () => {
    stickRef.current = true;
    const el = internalScrollRef.current;
    scrollToBottom(el);
    onJumpToLatest?.();
  };

  const btnSx = {
    borderRadius: 1.5,
    textTransform: "none",
    fontWeight: 600,
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2.25 },
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(30,41,59,0.7))"
            : "linear-gradient(180deg, #ffffff, #f8fafc)",
        overflow: "hidden",
        height: "100%",
        maxWidth: "100%",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.75 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>

        <Stack
          direction="row"
          spacing={0.75}
          flexWrap="wrap"
          justifyContent="flex-end"
          useFlexGap
        >
          {showConnectionChip ? (
            <Chip
              icon={connected ? <WifiIcon /> : <WifiOffIcon />}
              label={connected ? "Live" : "Offline"}
              color={connected ? "success" : "default"}
              size="small"
              sx={{ fontWeight: 600 }}
            />
          ) : null}
          <Chip
            label={`${visibleEntries.length}/${entries.length}`}
            size="small"
            variant="outlined"
          />
          {paused ? (
            <Chip label="Paused" color="warning" size="small" sx={{ fontWeight: 600 }} />
          ) : null}
          {topActions}
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: onTogglePaused || onJumpToLatest ? "repeat(3, 1fr)" : "repeat(4, 1fr)",
            md: "repeat(auto-fit, minmax(110px, 1fr))",
          },
          gap: 1,
          mb: 1.75,
        }}
      >
        <Button
          variant="contained"
          onClick={onRefresh}
          startIcon={<RefreshIcon />}
          size={isMobile ? "small" : "medium"}
          sx={btnSx}
        >
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownload}
          startIcon={<DownloadIcon />}
          disabled={!visibleEntries.length}
          size={isMobile ? "small" : "medium"}
          sx={btnSx}
        >
          Download
        </Button>
        <Button
          variant="outlined"
          onClick={handleCopy}
          startIcon={<FileCopyIcon />}
          disabled={!visibleEntries.length}
          size={isMobile ? "small" : "medium"}
          sx={btnSx}
        >
          Copy
        </Button>
        <Button
          variant="outlined"
          onClick={handleClear}
          startIcon={<ClearAllIcon />}
          disabled={!entries.length}
          size={isMobile ? "small" : "medium"}
          sx={btnSx}
        >
          Clear
        </Button>
        {onTogglePaused ? (
          <Button
            variant="outlined"
            onClick={onTogglePaused}
            startIcon={paused ? <PlayCircleIcon /> : <PauseIcon />}
            size={isMobile ? "small" : "medium"}
            sx={btnSx}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        ) : null}
        {onJumpToLatest ? (
          <Button
            variant="outlined"
            onClick={handleJump}
            size={isMobile ? "small" : "medium"}
            sx={btnSx}
          >
            Jump to latest
          </Button>
        ) : null}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 1.75 }}>
        <TextField
          fullWidth
          label="Search logs"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          size="small"
        />
        <FormControl fullWidth size="small" sx={{ maxWidth: { sm: 180 } }}>
          <InputLabel>Level</InputLabel>
          <Select label="Level" value={level} onChange={(e) => onLevelChange(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="debug">Debug</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 1.75, borderRadius: 1.5 }}>
          {error}
        </Alert>
      ) : null}

      <Paper
        ref={setScrollNode}
        variant="outlined"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = isNearBottom(el, 120);
          if (!onLoadOlder || !hasMoreOlder || loadingOlder) return;
          if (el.scrollTop <= 28) {
            onLoadOlder();
          }
        }}
        sx={{
          p: 1.25,
          minHeight: { xs: 240, sm: 280 },
          maxHeight: { xs: 360, sm: 420, md: 480 },
          overflowY: "auto",
          borderRadius: 2,
          bgcolor: (t) =>
            t.palette.mode === "dark"
              ? "rgba(0,0,0,0.2)"
              : "rgba(248,250,252,0.9)",
        }}
      >
        {loading && !entries.length ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : visibleEntries.length ? (
          <Stack spacing={1}>
            {onLoadOlder && hasMoreOlder ? (
              <Button
                variant="text"
                onClick={onLoadOlder}
                disabled={loadingOlder}
                sx={{ alignSelf: "center", mb: 0.25, textTransform: "none", fontWeight: 600 }}
              >
                {loadingOlder ? "Loading older..." : "Load older logs"}
              </Button>
            ) : null}
            {loadingOlder ? <LinearProgress sx={{ borderRadius: 1 }} /> : null}

            {visibleEntries.map((entry, index) => (
              <LogRow
                key={entry.key || `${index}-${entry.text.slice(0, 18)}`}
                entry={entry}
              />
            ))}
          </Stack>
        ) : (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <ArticleIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
            <Typography color="text.secondary">{emptyText}</Typography>
          </Box>
        )}
      </Paper>
    </Paper>
  );
}
