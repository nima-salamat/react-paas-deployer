import React, { useRef, useMemo, useCallback, useEffect, useState } from "react";
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
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
  useMediaQuery,
  Fab,
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
import MoreVertIcon from "@mui/icons-material/MoreVert";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SyncIcon from "@mui/icons-material/Sync";
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
  historyQInput,
  onHistoryQChange,
  searchMode = "local",
  onSearchModeChange,
  searching = false,
  gap = null,
  onDismissGap,
  reconnecting = false,
  usage = null,
  policy = null,
  onServerDownload,
  exporting = false,
  onRetryConnection,
  supportServerSearch = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const stickRef = useRef(true);
  const [nearBottom, setNearBottom] = useState(true);
  const internalScrollRef = useRef(null);
  const prevLenRef = useRef(0);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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
    const useLocalFilter = searchMode !== "server" || !supportServerSearch;

    return (entries || []).filter((entry) => {
      const lineLevel = entry?.level || inferLogLevel(entry?.text || entry?.message);
      if (level !== "all" && lineLevel !== level) return false;
      if (!useLocalFilter || !normalizedFilter) return true;
      return String(entry?.text || entry?.message || "")
        .toLowerCase()
        .includes(normalizedFilter);
    });
  }, [entries, filter, level, searchMode, supportServerSearch]);

  useEffect(() => {
    if (!stickToBottom || paused) return;
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
  }, [visibleEntries, stickToBottom, paused]);

  const handleScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      const near = isNearBottom(el, 120);
      stickRef.current = near;
      setNearBottom(near);

      if (!onLoadOlder || !hasMoreOlder || loadingOlder) return;
      if (el.scrollTop <= 40) {
        onLoadOlder();
      }
    },
    [onLoadOlder, hasMoreOlder, loadingOlder]
  );

  const handleDownload = () => {
    if (onServerDownload) onServerDownload();
    else onDownload?.(visibleEntries);
  };
  const handleCopy = () => {
    onCopy?.(visibleEntries);
    setMenuAnchor(null);
  };
  const handleClearConfirm = () => {
    onClear?.();
    setClearConfirmOpen(false);
    setMenuAnchor(null);
  };
  const handleJump = () => {
    stickRef.current = true;
    setNearBottom(true);
    const el = internalScrollRef.current;
    scrollToBottom(el);
    onJumpToLatest?.();
  };

  const btnSx = {
    borderRadius: 1.5,
    textTransform: "none",
    fontWeight: 600,
  };

  const searchValue =
    supportServerSearch && searchMode === "server" ? historyQInput || "" : filter || "";

  const handleSearchChange = (value) => {
    if (supportServerSearch && searchMode === "server") {
      onHistoryQChange?.(value);
    } else {
      onFilterChange?.(value);
    }
  };

  const countLabel = useMemo(() => {
    const shown = visibleEntries.length;
    const loaded = (entries || []).length;
    if (shown === loaded) return `${loaded.toLocaleString()} loaded`;
    return `${shown.toLocaleString()} shown of ${loaded.toLocaleString()}`;
  }, [visibleEntries.length, entries]);

  const connectionLabel = reconnecting
    ? "Reconnecting…"
    : connected
    ? "Live"
    : "Offline";

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2.25 },
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
        position: "relative",
      }}
    >
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mb: 1.5 }}
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
          alignItems="center"
          useFlexGap
        >
          {showConnectionChip ? (
            <Chip
              icon={
                reconnecting ? (
                  <SyncIcon />
                ) : connected ? (
                  <WifiIcon />
                ) : (
                  <WifiOffIcon />
                )
              }
              label={connectionLabel}
              color={connected ? "success" : reconnecting ? "warning" : "default"}
              size="small"
              sx={{ fontWeight: 600 }}
              onClick={
                !connected && !reconnecting && onRetryConnection
                  ? onRetryConnection
                  : undefined
              }
            />
          ) : null}
          <Chip label={countLabel} size="small" variant="outlined" />
          {paused ? (
            <Chip label="Paused" color="warning" size="small" sx={{ fontWeight: 600 }} />
          ) : null}
          {topActions}
        </Stack>
      </Stack>

      {/* Primary toolbar */}
      <Stack
        direction="row"
        spacing={1}
        flexWrap="wrap"
        useFlexGap
        sx={{ mb: 1.5 }}
        alignItems="center"
      >
        <Button
          variant="contained"
          onClick={onRefresh}
          startIcon={<RefreshIcon />}
          size="small"
          sx={btnSx}
        >
          Refresh
        </Button>
        {onTogglePaused ? (
          <Button
            variant="outlined"
            onClick={onTogglePaused}
            startIcon={paused ? <PlayCircleIcon /> : <PauseIcon />}
            size="small"
            sx={btnSx}
            color={paused ? "warning" : "inherit"}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        ) : null}
        {!isMobile && onJumpToLatest && !nearBottom ? (
          <Button
            variant="outlined"
            onClick={handleJump}
            size="small"
            startIcon={<KeyboardArrowDownIcon />}
            sx={btnSx}
          >
            Jump to latest
          </Button>
        ) : null}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="More actions">
          <IconButton
            size="small"
            onClick={(e) => setMenuAnchor(e.currentTarget)}
            aria-label="More log actions"
          >
            <MoreVertIcon />
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem
            onClick={() => {
              handleDownload();
              setMenuAnchor(null);
            }}
            disabled={exporting || (!onServerDownload && !visibleEntries.length)}
          >
            <ListItemIcon>
              <DownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={onServerDownload ? "Download from server" : "Download view"}
              secondary={
                onServerDownload
                  ? "Exports retained server history"
                  : "Downloads currently shown lines"
              }
            />
          </MenuItem>
          <MenuItem onClick={handleCopy} disabled={!visibleEntries.length}>
            <ListItemIcon>
              <FileCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy view" secondary="Copies currently shown lines" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setClearConfirmOpen(true);
            }}
            disabled={!entries?.length}
          >
            <ListItemIcon>
              <ClearAllIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Clear view"
              secondary="Clears loaded lines only — server logs are not deleted"
            />
          </MenuItem>
          {isMobile && onJumpToLatest ? (
            <MenuItem
              onClick={() => {
                handleJump();
                setMenuAnchor(null);
              }}
            >
              <ListItemIcon>
                <KeyboardArrowDownIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Jump to latest" />
            </MenuItem>
          ) : null}
        </Menu>
      </Stack>

      {/* Search + level */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {supportServerSearch && onSearchModeChange ? (
            <Stack spacing={0.75}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={searchMode}
                onChange={(_, v) => {
                  if (v) onSearchModeChange(v);
                }}
                sx={{ alignSelf: "flex-start" }}
              >
                <ToggleButton value="local" sx={{ textTransform: "none", px: 1.25 }}>
                  Local
                </ToggleButton>
                <ToggleButton value="server" sx={{ textTransform: "none", px: 1.25 }}>
                  Server history
                </ToggleButton>
              </ToggleButtonGroup>
              <TextField
                fullWidth
                size="small"
                label={searchMode === "server" ? "Search server history" : "Filter loaded logs"}
                placeholder={
                  searchMode === "server"
                    ? "Search retained history…"
                    : "Filter currently loaded lines…"
                }
                value={searchValue}
                onChange={(e) => handleSearchChange(e.target.value)}
                helperText={
                  searchMode === "server"
                    ? "Queries backend retained history"
                    : "Filters only lines already loaded in this view"
                }
              />
            </Stack>
          ) : (
            <TextField
              fullWidth
              size="small"
              label="Filter logs"
              value={filter || ""}
              onChange={(e) => onFilterChange?.(e.target.value)}
            />
          )}
        </Box>
        <FormControl fullWidth size="small" sx={{ maxWidth: { sm: 160 } }}>
          <InputLabel>Level</InputLabel>
          <Select label="Level" value={level} onChange={(e) => onLevelChange?.(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="debug">Debug</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error ? (
        <Alert
          severity="error"
          sx={{ mb: 1.5, borderRadius: 1.5 }}
          action={
            onRetryConnection ? (
              <Button color="inherit" size="small" onClick={onRetryConnection}>
                Retry
              </Button>
            ) : null
          }
        >
          {error}
        </Alert>
      ) : null}

      {!connected && !reconnecting && !error && showConnectionChip && onRetryConnection ? (
        <Alert
          severity="warning"
          sx={{ mb: 1.5, borderRadius: 1.5 }}
          action={
            <Button color="inherit" size="small" onClick={onRetryConnection}>
              Retry
            </Button>
          }
        >
          Connection lost
        </Alert>
      ) : null}

      {(usage || policy) && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {policy ? `Retention ${policy.retention_days}d · ` : ""}
          {usage
            ? `Storage ${Math.round((usage.current_storage_bytes || 0) / 1024 / 1024)}MB` +
              (policy?.storage_quota_bytes
                ? ` / ${Math.round(policy.storage_quota_bytes / 1024 / 1024)}MB`
                : "") +
              (usage.entries_dropped ? ` · dropped ${usage.entries_dropped}` : "")
            : ""}
        </Typography>
      )}

      {/* Log viewport */}
      <Paper
        ref={setScrollNode}
        variant="outlined"
        onScroll={handleScroll}
        sx={{
          p: { xs: 1, sm: 1.25 },
          minHeight: { xs: "min(50vh, 320px)", sm: 280 },
          maxHeight: {
            xs: "min(70vh, 520px)",
            sm: 420,
            md: 480,
          },
          overflowY: "auto",
          overflowX: "hidden",
          borderRadius: 2,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          position: "relative",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(0,0,0,0.2)" : "rgba(248,250,252,0.9)",
        }}
      >
        {gap && (
          <Alert severity="warning" onClose={onDismissGap} sx={{ mb: 1 }}>
            {gap}
          </Alert>
        )}
        {reconnecting && (
          <Chip size="small" label="Reconnecting…" color="warning" sx={{ mb: 1 }} />
        )}
        {searching && <LinearProgress sx={{ mb: 1 }} />}

        {hasMoreOlder && (
          <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {loadingOlder ? "Loading older…" : "Load older logs"}
            </Button>
          </Box>
        )}
        {loadingOlder ? <LinearProgress sx={{ mb: 1, borderRadius: 1 }} /> : null}

        {loading && !entries?.length ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : visibleEntries.length ? (
          <Stack spacing={0.75}>
            {visibleEntries.map((entry, i) => (
              <LogRow
                key={entry.id || entry.key || `row-${i}-${(entry.text || "").slice(0, 24)}`}
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

      {/* Mobile floating jump */}
      {isMobile && onJumpToLatest && !nearBottom ? (
        <Fab
          size="small"
          color="primary"
          onClick={handleJump}
          sx={{
            position: "absolute",
            bottom: 20,
            right: 20,
            zIndex: 2,
            boxShadow: 3,
          }}
          aria-label="Jump to latest"
        >
          <KeyboardArrowDownIcon />
        </Fab>
      ) : null}

      <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)}>
        <DialogTitle>Clear view?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This clears logs currently loaded in this view. Server logs are not deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleClearConfirm} color="warning" variant="contained">
            Clear view
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
