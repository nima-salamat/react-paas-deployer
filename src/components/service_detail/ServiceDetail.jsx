// ServiceDetail.jsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
  memo,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import apiRequest from "../customHooks/apiRequest";

import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Divider,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  useTheme,
  Snackbar,
  Avatar,
  Alert,
  CircularProgress,
  Chip,
  Tabs,
  Tab,
  useMediaQuery,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import LinkIcon from "@mui/icons-material/Launch";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArticleIcon from "@mui/icons-material/Article";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import DownloadIcon from "@mui/icons-material/Download";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import PauseIcon from "@mui/icons-material/Pause";
import PlayCircleIcon from "@mui/icons-material/PlayCircle";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SubjectIcon from "@mui/icons-material/Subject";
import SettingsIcon from "@mui/icons-material/Settings";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const DEPLOY_BASE = `${API_BASE}/deploy/`;
const SERVICE_BASE = `${API_BASE}/services/service/`;
const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
const NETWORK_API_ROOT = `${API_BASE}/api/networks/`;
const VOLUME_API_ROOT = `${API_BASE}/api/volumes/`;
const PLANS_BASE = `${API_BASE}/plans/`;
const SERVICE_LOG_MAX_LINES = 5000;
const DEPLOY_LOG_PAGE_SIZE = 10;
const DEPLOY_LOG_POLL_INTERVAL = 4000;
const DEFAULT_REFRESH_INTERVAL_MS = 2000;
const REFRESH_INTERVAL_OPTIONS = [
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
];

const TABS = [
  { value: "overview", label: "Overview", icon: <Inventory2Icon fontSize="small" /> },
  { value: "create", label: "Create deploy", icon: <AddCircleOutlineIcon fontSize="small" /> },
  { value: "logs", label: "Logs", icon: <SubjectIcon fontSize="small" /> },
  { value: "settings", label: "Settings", icon: <SettingsIcon fontSize="small" /> },
];

function shallowEqualObj(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) if (a[key] !== b[key]) return false;
  return true;
}

function mergeObjects(prev = {}, incoming = {}) {
  if (!incoming) return prev;
  if (!prev) return { ...incoming };
  if (typeof incoming !== "object" || Array.isArray(incoming)) return incoming;

  const out = { ...prev };
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val === undefined) continue;
    if (val === null) {
      out[key] = null;
      continue;
    }
    if (typeof val === "object" && !Array.isArray(val)) {
      out[key] = mergeObjects(out[key] ?? {}, val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function inferLogLevel(line) {
  const lower = String(line || "").toLowerCase();
  if (
    lower.includes("fatal") ||
    lower.includes("panic") ||
    lower.includes("traceback") ||
    lower.includes("error") ||
    lower.includes("exception")
  ) {
    return "error";
  }
  if (lower.includes("warn") || lower.includes("deprecated")) return "warning";
  if (lower.includes("debug")) return "debug";
  return "info";
}

function normalizeTextEntries(input) {
  if (input == null) return [];

  const toEntry = (text, index, raw, extra = {}) => {
    const clean = String(text ?? "").replace(/\r$/, "").trim();
    if (!clean) return null;
    return {
      key: extra.key || `${index}-${clean.slice(0, 40)}`,
      text: clean,
      level: extra.level || inferLogLevel(clean),
      timestamp: extra.timestamp || null,
      raw,
    };
  };

  const normalizeOne = (item, index) => {
    if (item == null) return null;

    if (typeof item === "string") {
      const lines = item.split(/\r?\n/).filter(Boolean);
      if (!lines.length) return null;
      if (lines.length === 1) return toEntry(lines[0], index, item);
      return lines.map((line, subIndex) => toEntry(line, `${index}-${subIndex}`, item)).filter(Boolean);
    }

    if (typeof item !== "object") {
      return toEntry(String(item), index, item);
    }

    const timestamp = item.created_at || item.timestamp || item.time || item.datetime || null;
    const level = String(item.level || item.severity || item.type || "").toLowerCase();

    let payload =
      item.message ??
      item.log ??
      item.text ??
      item.line ??
      item.detail ??
      item.content ??
      null;

    if (payload == null) {
      const copy = { ...item };
      delete copy.id;
      delete copy.pk;
      delete copy.created_at;
      delete copy.timestamp;
      delete copy.time;
      delete copy.datetime;
      delete copy.level;
      delete copy.severity;
      delete copy.type;
      delete copy.message;
      delete copy.log;
      delete copy.text;
      delete copy.line;
      delete copy.detail;
      delete copy.content;
      payload = Object.keys(copy).length ? JSON.stringify(copy, null, 2) : JSON.stringify(item, null, 2);
    }

    if (typeof payload === "object") {
      payload = JSON.stringify(payload, null, 2);
    }

    const tsPrefix = timestamp ? `[${formatDate(timestamp)}] ` : "";
    const lvlPrefix = level ? `${level.toUpperCase()} ` : "";
    const text = `${tsPrefix}${lvlPrefix}${String(payload).trim()}`.trim();

    return toEntry(text, index, item, {
      level: level || inferLogLevel(text),
      timestamp,
      key: String(item.id ?? item.pk ?? `${timestamp || ""}-${index}-${text.slice(0, 36)}`),
    });
  };

  const items = Array.isArray(input) ? input : [input];
  return items
    .flatMap((item, index) => normalizeOne(item, index) || [])
    .filter(Boolean);
}

function mergeEntries(prev = [], incoming = []) {
  if (!Array.isArray(incoming)) return prev;
  if (!Array.isArray(prev) || prev.length === 0) return incoming;

  const seen = new Set(prev.map((x) => x.key));
  const out = [...prev];

  for (const item of incoming) {
    if (!item?.key) continue;
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

function mergeEntriesPrepend(prev = [], incoming = []) {
  if (!Array.isArray(incoming)) return prev;
  if (!Array.isArray(prev) || prev.length === 0) return incoming;

  const seen = new Set(prev.map((x) => x.key));
  const out = [];

  for (const item of incoming) {
    if (!item?.key) continue;
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }

  return [...out, ...prev];
}

function downloadTextFile(filename, lines) {
  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDeployEntryText(entry) {
  if (!entry) return "";
  if (typeof entry.text === "string") return entry.text;
  if (typeof entry === "string") return entry;
  return String(entry);
}

const DeployCard = memo(function DeployCard({
  deploy,
  isSelected,
  cannotSelect,
  actionState,
  onEdit,
  onSelect,
  onUnselect,
  onDelete,
}) {
  const theme = useTheme();
  const busy =
    Boolean(actionState?.selecting) ||
    Boolean(actionState?.updating) ||
    Boolean(actionState?.deleting);

  const statusText = String(deploy?.status ?? deploy?.stage ?? "").trim();
  const snippet =
    typeof deploy?.config === "string"
      ? deploy.config
      : deploy?.config
      ? JSON.stringify(deploy.config, null, 2)
      : "";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 1.75 },
        borderRadius: 1.5,
        height: "100%",
        maxWidth: "100%",
        bgcolor:
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.9)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
      }}
    >
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.25} justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontSize: 15,
              }}
            >
              {(deploy?.name || "?").charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}
                >
                  {deploy?.name || "Unnamed deploy"}
                </Typography>
                {isSelected ? <Chip label="Selected" size="small" color="success" /> : null}
                {statusText ? <Chip label={statusText} size="small" variant="outlined" /> : null}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                v{deploy?.version || "—"} · {formatDate(deploy?.created_at)}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ minHeight: 40, flex: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12.5,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {snippet ? snippet.slice(0, 160) : "No configuration text."}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant={isSelected ? "outlined" : "contained"}
            disabled={busy || cannotSelect}
            onClick={() => (isSelected ? onUnselect(deploy) : onSelect(deploy))}
            sx={{ flex: "1 1 auto", minWidth: 72 }}
          >
            {busy ? "..." : isSelected ? "Unselect" : "Select"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onEdit(deploy)}
            disabled={busy}
            sx={{ flex: "1 1 auto", minWidth: 56 }}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onDelete(deploy)}
            disabled={busy}
            sx={{ flex: "1 1 auto", minWidth: 56 }}
          >
            Delete
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}, (prev, next) => {
  if (prev.deploy !== next.deploy) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.cannotSelect !== next.cannotSelect) return false;
  return shallowEqualObj(prev.actionState || {}, next.actionState || {});
});

function formatLogTime(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return null;
  }
}

const LOG_COLLAPSE_CHARS = 180;
const LOG_COLLAPSE_LINES = 3;

const LogRow = memo(function LogRow({ entry }) {
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

function isNearBottom(el, threshold = 100) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function scrollToBottom(el) {
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

function LogPanel({
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

  return (
    <Paper
      elevation={1}
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2,
        backgroundImage:
          theme.palette.mode === "dark"
            ? "linear-gradient(180deg, rgba(11,15,18,0.98), rgba(17,24,39,0.98))"
            : "linear-gradient(180deg, #ffffff, #f7fbff)",
        boxShadow: 3,
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

        <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end" useFlexGap>
          {showConnectionChip ? (
            <Chip
              icon={connected ? <WifiIcon /> : <WifiOffIcon />}
              label={connected ? "Live" : "Offline"}
              color={connected ? "success" : "default"}
              size="small"
            />
          ) : null}
          <Chip label={`${visibleEntries.length}/${entries.length}`} size="small" />
          {paused ? <Chip label="Paused" color="warning" size="small" /> : null}
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
          mb: 1.5,
        }}
      >
        <Button variant="contained" onClick={onRefresh} startIcon={<RefreshIcon />} size={isMobile ? "small" : "medium"}>
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={handleDownload}
          startIcon={<DownloadIcon />}
          disabled={!visibleEntries.length}
          size={isMobile ? "small" : "medium"}
        >
          Download
        </Button>
        <Button
          variant="outlined"
          onClick={handleCopy}
          startIcon={<FileCopyIcon />}
          disabled={!visibleEntries.length}
          size={isMobile ? "small" : "medium"}
        >
          Copy
        </Button>
        <Button
          variant="outlined"
          onClick={handleClear}
          startIcon={<ClearAllIcon />}
          disabled={!entries.length}
          size={isMobile ? "small" : "medium"}
        >
          Clear
        </Button>
        {onTogglePaused ? (
          <Button
            variant="outlined"
            onClick={onTogglePaused}
            startIcon={paused ? <PlayCircleIcon /> : <PauseIcon />}
            size={isMobile ? "small" : "medium"}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
        ) : null}
        {onJumpToLatest ? (
          <Button variant="outlined" onClick={handleJump} size={isMobile ? "small" : "medium"}>
            Jump to latest
          </Button>
        ) : null}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 1.5 }}>
        <TextField
          fullWidth
          label="Search logs"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          size="small"
        />
        <FormControl fullWidth size="small" sx={{ maxWidth: { sm: 180 } }}>
          <InputLabel>Level</InputLabel>
          <Select
            label="Level"
            value={level}
            onChange={(e) => onLevelChange(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="info">Info</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="debug">Debug</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 1.5 }}>
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
          borderRadius: 1.5,
          bgcolor:
            theme.palette.mode === "dark"
              ? "rgba(0,0,0,0.18)"
              : "rgba(255,255,255,0.75)",
        }}
      >
        {loading && !entries.length ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
            <CircularProgress />
          </Box>
        ) : visibleEntries.length ? (
          <Stack spacing={1}>
            {onLoadOlder && hasMoreOlder ? (
              <Button
                variant="text"
                onClick={onLoadOlder}
                disabled={loadingOlder}
                sx={{ alignSelf: "center", mb: 0.25 }}
              >
                {loadingOlder ? "Loading older..." : "Load older logs"}
              </Button>
            ) : null}
            {loadingOlder ? <LinearProgress /> : null}

            {visibleEntries.map((entry, index) => (
              <LogRow key={entry.key || `${index}-${entry.text.slice(0, 18)}`} entry={entry} />
            ))}
          </Stack>
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <ArticleIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
            <Typography color="text.secondary">{emptyText}</Typography>
          </Box>
        )}
      </Paper>
    </Paper>
  );
}

function TabSidebar({ activeTab, setActiveTab, service, selectedDeploy, deployCount, volumeCount, networkName, serviceRunning }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={1}
      sx={{
        position: "sticky",
        top: 16,
        borderRadius: 2,
        boxShadow: 3,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        backgroundImage:
          theme.palette.mode === "dark"
            ? "linear-gradient(180deg, #0b0f12, #111827)"
            : "linear-gradient(180deg, #ffffff, #f7fbff)",
      }}
    >
      <Box sx={{ p: 1.25 }}>
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 0,
            "& .MuiTab-root": {
              alignItems: "flex-start",
              textAlign: "left",
              py: 1.2,
              px: 1.5,
              minHeight: 54,
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                alignItems: "flex-start",
              }}
            />
          ))}
        </Tabs>

        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={1}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              {service?.name || "Service"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {service?.service_name ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}` : "—"}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
              <Chip
                label={
                  serviceRunning === true
                    ? "running"
                    : service?.status || "unknown"
                }
                size="small"
                color={
                  serviceRunning === true || ["running", "success"].includes(String(service?.status || ""))
                    ? "success"
                    : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
                    ? "warning"
                    : "default"
                }
              />
              {selectedDeploy ? <Chip label={`Deploy: ${selectedDeploy.name || selectedDeploy.id}`} size="small" variant="outlined" /> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Deploys
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {deployCount}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Network
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
              {networkName || "—"}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Volumes
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {volumeCount}
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Paper>
  );
}

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const [activeTab, setActiveTab] = useState("overview");

  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [intervalMenuAnchor, setIntervalMenuAnchor] = useState(null);

  const [service, setService] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [networkDetail, setNetworkDetail] = useState(null);
  const [attachedVolumes, setAttachedVolumes] = useState([]);
  const [availableNetworks, setAvailableNetworks] = useState([]);
  const [availableVolumes, setAvailableVolumes] = useState([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState("");
  const [selectedVolumeId, setSelectedVolumeId] = useState("");
  const [volumeFiles, setVolumeFiles] = useState([]);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [volumeActionLoading, setVolumeActionLoading] = useState(false);
  const [networkActionLoading, setNetworkActionLoading] = useState(false);

  const [deploys, setDeploys] = useState([]);
  const [pageInfo, setPageInfo] = useState({
    next: null,
    previous: null,
    count: 0,
    page: 1,
  });
  const [deploysLoading, setDeploysLoading] = useState(false);

  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [config, setConfig] = useState("");
  const [zipFile, setZipFile] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [actionState, setActionState] = useState({});

  const [editingDeployId, setEditingDeployId] = useState(null);
  const [editData, setEditData] = useState({ name: "", version: "", config: "" });
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editZipFile, setEditZipFile] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    type: null,
    deployId: null,
    title: "",
    message: "",
    loading: false,
  });
  const [serviceLoading, setServiceLoading] = useState(false);

  const [serviceRunning, setServiceRunning] = useState(null);
  const [serviceCpu, setServiceCpu] = useState(null);
  const [serviceRam, setServiceRam] = useState(null);
  const [serviceStatusLoadingManual, setServiceStatusLoadingManual] = useState(false);

  const [serviceLogsEntries, setServiceLogsEntries] = useState([]);
  const [serviceLogsConnected, setServiceLogsConnected] = useState(false);
  const [serviceLogsError, setServiceLogsError] = useState(null);
  const [serviceLogsPaused, setServiceLogsPaused] = useState(false);
  const [serviceLogsFilter, setServiceLogsFilter] = useState("");
  const [serviceLogsLevel, setServiceLogsLevel] = useState("all");
  const [serviceLogsLoading, setServiceLogsLoading] = useState(false);

  const [deployLogEntries, setDeployLogEntries] = useState([]);
  const [deployLogError, setDeployLogError] = useState(null);
  const [deployLogLoading, setDeployLogLoading] = useState(false);
  const [deployLogLoadingOlder, setDeployLogLoadingOlder] = useState(false);
  const [deployLogFilter, setDeployLogFilter] = useState("");
  const [deployLogLevel, setDeployLogLevel] = useState("all");
  const [deployLogDeployId, setDeployLogDeployId] = useState("");

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const fetchDeploysLock = useRef(false);
  const refreshIntervalRef = useRef(null);
  const pageInfoRef = useRef(pageInfo);
  const autoRefreshBusyRef = useRef(false);

  const zipInputRef = useRef(null);
  const editZipInputRef = useRef(null);

  const serviceLogPausedRef = useRef(false);
  const serviceLogSocketRef = useRef(null);
  const serviceLogReconnectTimerRef = useRef(null);
  const serviceLogReconnectAttemptRef = useRef(0);
  const serviceLogShouldReconnectRef = useRef(true);
  const serviceLogScrollRef = useRef(null);

  const deployLogScrollRef = useRef(null);
  const deployLogPollTimerRef = useRef(null);
  const deployLogPollLockRef = useRef(false);
  const deployLogManualSelectRef = useRef(false);
  const deployLogOldestCursorRef = useRef(null);
  const deployLogNewestCursorRef = useRef(null);
  const deployLogHasMoreOlderRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    serviceLogPausedRef.current = serviceLogsPaused;
  }, [serviceLogsPaused]);

  const safeSetSnackbar = useCallback((severity, message) => {
    setSnackbar({ severity, message });
  }, []);

  const colorForPercent = useCallback(
    (p) => {
      const pct = Number(p) || 0;
      if (pct >= 90) return theme.palette.error.main;
      if (pct >= 70) return theme.palette.warning.main;
      if (pct >= 40) return theme.palette.success.main;
      return theme.palette.primary.main;
    },
    [theme]
  );

  const stopServiceLogConnection = useCallback(() => {
    serviceLogShouldReconnectRef.current = false;
    serviceLogReconnectAttemptRef.current = 0;

    if (serviceLogReconnectTimerRef.current) {
      clearTimeout(serviceLogReconnectTimerRef.current);
      serviceLogReconnectTimerRef.current = null;
    }

    if (serviceLogSocketRef.current) {
      try {
        serviceLogSocketRef.current.close();
      } catch {
        // ignore
      }
      serviceLogSocketRef.current = null;
    }

    setServiceLogsConnected(false);
  }, []);

  const appendServiceLogEntries = useCallback((incoming) => {
    const next = normalizeTextEntries(incoming);
    if (!next.length) return;

    setServiceLogsEntries((prev) => {
      const out = [...prev, ...next];
      if (out.length > SERVICE_LOG_MAX_LINES) {
        return out.slice(out.length - SERVICE_LOG_MAX_LINES);
      }
      return out;
    });
  }, []);

  const checkDeployNameAvailable = useCallback(
    async (candidate) => {
      if (!candidate) return false;
      if (editingDeployId && candidate === editOriginalName) return true;

      try {
        const resp = await apiRequest({
          method: "GET",
          url: `${DEPLOY_BASE}name_is_available/`,
          params: { name: candidate },
        });
        return resp.data?.result === true;
      } catch (err) {
        console.error("checkDeployNameAvailable:", err);
        return false;
      }
    },
    [editingDeployId, editOriginalName]
  );

  const fetchService = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setError(null);
    }

    try {
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/` });
      if (!mountedRef.current) return;

      setService((prev) => {
        const merged = mergeObjects(prev ?? {}, resp.data ?? {});
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
        return merged;
      });

      const plan = resp.data?.plan;
      if (plan && typeof plan === "object") {
        setPlanDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, plan);
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          return merged;
        });
      } else if (plan) {
        try {
          const p = await apiRequest({
            method: "GET",
            url: `${PLANS_BASE}?id=${String(plan)}`,
          });
          if (mountedRef.current) setPlanDetail(p.data);
        } catch {
          // ignore
        }
      }

      const net = resp.data?.network;
      if (net && typeof net === "object") {
        setNetworkDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, net);
          if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
          return merged;
        });
      } else if (net) {
        try {
          const n = await apiRequest({
            method: "GET",
            url: `${NETWORK_API_ROOT}${String(net)}/`,
          });
          if (mountedRef.current) setNetworkDetail(n.data);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("fetchService error:", err);
      if (!silent) setError("Failed to load service info.");
    }
  }, [id]);

  const fetchDeploys = useCallback(async (page = 1, silent = false) => {
    if (!id) return;
    if (fetchDeploysLock.current && !silent) return;

    if (!silent) {
      fetchDeploysLock.current = true;
      setDeploysLoading(true);
      setError(null);
    }

    const thisFetch = ++fetchIdRef.current;

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}`,
        params: { service_id: id, page },
      });

      if (thisFetch !== fetchIdRef.current) return;

      const data = resp.data;
      const results = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
        ? data
        : [];

      setDeploys((prev) => {
        if (
          Array.isArray(prev) &&
          prev.length === results.length &&
          JSON.stringify(prev) === JSON.stringify(results)
        ) {
          return prev;
        }
        return results;
      });
      if (!silent) {
        setPageInfo((prev) => {
          const next = {
            next: data.next,
            previous: data.previous,
            count: data.count,
            page,
          };
          if (
            prev.next === next.next &&
            prev.previous === next.previous &&
            prev.count === next.count &&
            prev.page === next.page
          ) {
            return prev;
          }
          return next;
        });
      } else if (data.count != null) {
        setPageInfo((prev) =>
          prev.count === data.count && prev.page === page
            ? prev
            : { ...prev, count: data.count, page }
        );
      }
    } catch (err) {
      console.error("fetchDeploys error:", err);
      if (!silent) setError("Failed to load deploys.");
    } finally {
      if (!silent) {
        fetchDeploysLock.current = false;
        if (mountedRef.current) setDeploysLoading(false);
      }
    }
  }, [id]);

  const fetchAvailableNetworks = useCallback(async () => {
    try {
      const resp = await apiRequest({
        method: "GET",
        url: NETWORK_API_ROOT,
        params: { page_size: 100 },
      });
      const data = resp.data;
      setAvailableNetworks(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("fetchAvailableNetworks error:", err);
    }
  }, []);

  const fetchAvailableVolumes = useCallback(async () => {
    try {
      const resp = await apiRequest({
        method: "GET",
        url: VOLUME_API_ROOT,
        params: { unused: true, page_size: 100 },
      });
      const data = resp.data;
      setAvailableVolumes(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error("fetchAvailableVolumes error:", err);
    }
  }, []);

  const fetchAttachedVolumes = useCallback(async () => {
    if (!id) return;
    try {
      const resp = await apiRequest({
        method: "GET",
        url: VOLUME_API_ROOT,
        params: { service: id, page_size: 100 },
      });
      const data = resp.data;
      const next = Array.isArray(data) ? data : data.results || [];
      setAttachedVolumes((prev) =>
        Array.isArray(prev) && JSON.stringify(prev) === JSON.stringify(next)
          ? prev
          : next
      );
    } catch (err) {
      console.error("fetchAttachedVolumes error:", err);
    }
  }, [id]);

  const normalizePercent = useCallback((raw) => {
    let n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    // Backend (container_manager) returns 0..100 already.
    // Do NOT scale values <= 1 — real idle CPU can be 0.3%.
    return Math.round(Math.min(n, 100) * 100) / 100;
  }, []);

  const checkServiceRunning = useCallback(
    async (silent = false) => {
      if (!id) return;

      if (!silent && serviceStatusLoadingManual) return;
      if (!silent) setServiceStatusLoadingManual(true);

      try {
        const resp = await apiRequest({
          method: "POST",
          url: `${SERVICE_ACTION_ROOT}service_status/`,
          data: { service_id: id },
        });

        if (resp.status === 200 && resp.data) {
          const running = Boolean(resp.data.running);
          const cpu = normalizePercent(resp.data.cpu);
          const ram = normalizePercent(resp.data.ram);

          setServiceRunning((prev) => (prev === running ? prev : running));
          setServiceCpu((prev) =>
            typeof prev === "number" &&
            Math.round(prev * 100) / 100 === Math.round(cpu * 100) / 100
              ? prev
              : cpu
          );
          setServiceRam((prev) =>
            typeof prev === "number" &&
            Math.round(prev * 100) / 100 === Math.round(ram * 100) / 100
              ? prev
              : ram
          );
        } else if (!silent) {
          setServiceRunning(false);
          setServiceCpu(0);
          setServiceRam(0);
        }
      } catch (err) {
        console.error("checkServiceRunning err:", err);
        // Don't force Stopped on transient errors during silent auto-refresh
        if (!silent) {
          setServiceRunning(false);
          setServiceCpu(0);
          setServiceRam(0);
        }
      } finally {
        if (!silent) setServiceStatusLoadingManual(false);
      }
    },
    [id, serviceStatusLoadingManual, normalizePercent]
  );

  const fetchServiceLogs = useCallback(async () => {
    if (!id) return;
    setServiceLogsLoading(true);
    setServiceLogsError(null);

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${SERVICE_BASE}${id}/logs/`,
      });
      if (!mountedRef.current) return;
      setServiceLogsEntries(normalizeTextEntries(resp.data?.logs));
    } catch (err) {
      console.error("fetchServiceLogs error:", err);
      if (!mountedRef.current) return;
      setServiceLogsError(err.response?.data?.detail || "Unable to load service logs.");
    } finally {
      if (mountedRef.current) setServiceLogsLoading(false);
    }
  }, [id]);

  const connectServiceLogStream = useCallback(() => {
    if (!id) return;

    serviceLogShouldReconnectRef.current = true;

    if (serviceLogSocketRef.current) {
      try {
        serviceLogSocketRef.current.close();
      } catch {
        // ignore
      }
      serviceLogSocketRef.current = null;
    }

    if (serviceLogReconnectTimerRef.current) {
      clearTimeout(serviceLogReconnectTimerRef.current);
      serviceLogReconnectTimerRef.current = null;
    }

    const token = localStorage.getItem("access");
    if (!token) {
      setServiceLogsError("Authentication is required for live logs.");
      setServiceLogsConnected(false);
      return;
    }

    setServiceLogsError(null);

    const backendUrl = new URL(API_BASE);
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${backendUrl.host}/ws/services/logs/${id}/?token=${encodeURIComponent(
      token
    )}`;

    const socket = new WebSocket(socketUrl);
    serviceLogSocketRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      serviceLogReconnectAttemptRef.current = 0;
      setServiceLogsConnected(true);
      setServiceLogsError(null);
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current) return;
      if (serviceLogPausedRef.current) return;

      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = { type: "log.raw", message: String(event.data) };
      }

      if (payload.type === "log.line") {
        appendServiceLogEntries(payload.line ?? "");
      } else if (payload.type === "error") {
        setServiceLogsError(payload.message || "Live log stream error.");
      } else if (payload.type === "deployment.event") {
        appendServiceLogEntries(
          typeof payload.event === "string"
            ? payload.event
            : JSON.stringify(payload.event ?? {}, null, 2)
        );
      } else {
        appendServiceLogEntries(String(payload.message ?? event.data));
      }
    };

    socket.onerror = () => {
      if (!mountedRef.current) return;
      setServiceLogsConnected(false);
      setServiceLogsError("Live log connection error.");
    };

    socket.onclose = (evt) => {
      if (!mountedRef.current) return;
      setServiceLogsConnected(false);

      if (!serviceLogShouldReconnectRef.current) return;
      if (evt.wasClean) return;

      serviceLogReconnectAttemptRef.current += 1;
      const attempt = serviceLogReconnectAttemptRef.current;
      const delay = Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));

      serviceLogReconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !serviceLogShouldReconnectRef.current) return;
        connectServiceLogStream();
      }, delay);

      setServiceLogsError(
        `Live log stream disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`
      );
    };
  }, [id, appendServiceLogEntries]);

  const refreshServiceLogs = useCallback(async () => {
    stopServiceLogConnection();
    await fetchServiceLogs();
    connectServiceLogStream();
  }, [stopServiceLogConnection, fetchServiceLogs, connectServiceLogStream]);

  const fetchDeployLogsInitial = useCallback(async (deployId) => {
    if (!deployId) return;

    setDeployLogLoading(true);
    setDeployLogError(null);
    setDeployLogEntries([]);
    deployLogOldestCursorRef.current = null;
    deployLogNewestCursorRef.current = null;
    deployLogHasMoreOlderRef.current = false;

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${deployId}/logs/`,
        params: { limit: DEPLOY_LOG_PAGE_SIZE },
      });

      const normalized = normalizeTextEntries(resp.data?.logs);

      setDeployLogEntries(normalized);
      deployLogOldestCursorRef.current = resp.data?.next_before || null;
      deployLogNewestCursorRef.current = resp.data?.latest_after || null;
      deployLogHasMoreOlderRef.current = Boolean(resp.data?.has_more_older);
    } catch (err) {
      console.error("fetchDeployLogsInitial error:", err);
      if (!mountedRef.current) return;
      setDeployLogError(err.response?.data?.detail || "Unable to load deploy history.");
    } finally {
      if (mountedRef.current) setDeployLogLoading(false);
    }
  }, []);

  const loadOlderDeployLogs = useCallback(async () => {
    if (
      !deployLogDeployId ||
      !deployLogHasMoreOlderRef.current ||
      !deployLogOldestCursorRef.current ||
      deployLogLoadingOlder
    ) {
      return;
    }

    const scroller = deployLogScrollRef.current;
    const prevHeight = scroller?.scrollHeight || 0;
    const prevTop = scroller?.scrollTop || 0;

    setDeployLogLoadingOlder(true);
    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${deployLogDeployId}/logs/`,
        params: {
          limit: DEPLOY_LOG_PAGE_SIZE,
          before: deployLogOldestCursorRef.current,
        },
      });

      const older = normalizeTextEntries(resp.data?.logs);

      if (older.length) {
        setDeployLogEntries((prev) => mergeEntriesPrepend(prev, older));
      }

      deployLogOldestCursorRef.current = resp.data?.next_before || deployLogOldestCursorRef.current;
      deployLogNewestCursorRef.current = resp.data?.latest_after || deployLogNewestCursorRef.current;
      deployLogHasMoreOlderRef.current = Boolean(resp.data?.has_more_older);

      requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop = scroller.scrollHeight - prevHeight + prevTop;
        }
      });
    } catch (err) {
      console.error("loadOlderDeployLogs error:", err);
      if (mountedRef.current) {
        setDeployLogError(err.response?.data?.detail || "Unable to load older deploy logs.");
      }
    } finally {
      if (mountedRef.current) setDeployLogLoadingOlder(false);
    }
  }, [deployLogDeployId, deployLogLoadingOlder]);

  const pollNewDeployLogs = useCallback(async () => {
    if (!deployLogDeployId || !deployLogNewestCursorRef.current) return;
    if (deployLogPollLockRef.current) return;

    deployLogPollLockRef.current = true;
    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${deployLogDeployId}/logs/`,
        params: {
          limit: 100,
          after: deployLogNewestCursorRef.current,
        },
      });

      const fresh = normalizeTextEntries(resp.data?.logs);
      if (fresh.length) {
        setDeployLogEntries((prev) => mergeEntries(prev, fresh));
        deployLogNewestCursorRef.current = resp.data?.next_after || resp.data?.latest_after || deployLogNewestCursorRef.current;
      }
    } catch (err) {
      console.error("pollNewDeployLogs error:", err);
    } finally {
      deployLogPollLockRef.current = false;
    }
  }, [deployLogDeployId]);

  const selectedDeployId = service?.selected_deploy
    ? String(service.selected_deploy.id ?? service.selected_deploy)
    : "";

  const selectedDeploy = useMemo(() => {
    if (!selectedDeployId) return null;
    return deploys.find((d) => String(d.id ?? d.pk ?? "") === selectedDeployId) || null;
  }, [deploys, selectedDeployId]);

  const currentDeployForLogs = useMemo(() => {
    if (!deployLogDeployId) return null;
    return deploys.find((d) => String(d.id ?? d.pk ?? "") === String(deployLogDeployId)) || null;
  }, [deployLogDeployId, deploys]);

  const networkName = useMemo(() => {
    return (
      service?.network?.name ||
      networkDetail?.network?.name ||
      networkDetail?.name ||
      "—"
    );
  }, [service, networkDetail]);

  const deployCount = deploys.length;
  const volumeCount = attachedVolumes.length;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const boot = async () => {
      await Promise.allSettled([
        fetchService(),
        fetchDeploys(1),
        checkServiceRunning(true),
        fetchAvailableNetworks(),
        fetchAvailableVolumes(),
        fetchAttachedVolumes(),
      ]);
    };

    boot();
  }, [
    id,
    fetchService,
    fetchDeploys,
    checkServiceRunning,
    fetchAvailableNetworks,
    fetchAvailableVolumes,
    fetchAttachedVolumes,
  ]);

  useEffect(() => {
    if (!service?.network?.id) {
      setSelectedNetworkId("");
    } else {
      setSelectedNetworkId(String(service.network.id));
    }
  }, [service?.network?.id]);

  useEffect(() => {
    if (deploys.length === 0) return;

    if (!deployLogManualSelectRef.current) {
      const nextId = selectedDeployId || String(deploys[0].id ?? deploys[0].pk ?? "");
      if (nextId && nextId !== deployLogDeployId) {
        setDeployLogDeployId(nextId);
      }
    }
  }, [deploys, selectedDeployId, deployLogDeployId]);

  useEffect(() => {
    if (!deployLogDeployId) return;
    if (activeTab !== "logs") return;
    fetchDeployLogsInitial(deployLogDeployId);
  }, [deployLogDeployId, activeTab, fetchDeployLogsInitial]);

  useEffect(() => {
    if (activeTab !== "logs") {
      stopServiceLogConnection();
      if (deployLogPollTimerRef.current) {
        clearInterval(deployLogPollTimerRef.current);
        deployLogPollTimerRef.current = null;
      }
      return;
    }

    fetchServiceLogs();
    connectServiceLogStream();

    return () => {
      stopServiceLogConnection();
    };
  }, [activeTab, fetchServiceLogs, connectServiceLogStream, stopServiceLogConnection]);

  useEffect(() => {
    if (activeTab !== "logs" || !deployLogDeployId || !deployLogNewestCursorRef.current) {
      if (deployLogPollTimerRef.current) {
        clearInterval(deployLogPollTimerRef.current);
        deployLogPollTimerRef.current = null;
      }
      return;
    }

    const active = ["queued", "deploying", "running", "stopping"].includes(
      String(service?.status)
    );

    if (!active) {
      if (deployLogPollTimerRef.current) {
        clearInterval(deployLogPollTimerRef.current);
        deployLogPollTimerRef.current = null;
      }
      return;
    }

    if (deployLogPollTimerRef.current) {
      clearInterval(deployLogPollTimerRef.current);
      deployLogPollTimerRef.current = null;
    }

    deployLogPollTimerRef.current = setInterval(() => {
      if (!document.hidden) {
        pollNewDeployLogs();
      }
    }, DEPLOY_LOG_POLL_INTERVAL);

    return () => {
      if (deployLogPollTimerRef.current) {
        clearInterval(deployLogPollTimerRef.current);
        deployLogPollTimerRef.current = null;
      }
    };
  }, [activeTab, deployLogDeployId, deployLogNewestCursorRef.current, service?.status, pollNewDeployLogs]);

  useEffect(() => {
    if (!isDesktop) setActiveTab((current) => current || "overview");
  }, [isDesktop]);

  useEffect(() => {
    pageInfoRef.current = pageInfo;
  }, [pageInfo]);

  const setAction = useCallback((deployId, patch) => {
    setActionState((prev) => ({
      ...prev,
      [deployId]: { ...(prev[deployId] ?? {}), ...patch },
    }));
  }, []);

  const silentRefresh = useCallback(async () => {
    if (!id || !mountedRef.current) return;
    if (autoRefreshBusyRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    autoRefreshBusyRef.current = true;
    try {
      await Promise.allSettled([
        fetchService(true),
        fetchDeploys(pageInfoRef.current?.page || 1, true),
        checkServiceRunning(true),
        fetchAttachedVolumes(),
      ]);
    } catch (err) {
      console.error("silentRefresh error:", err);
    } finally {
      autoRefreshBusyRef.current = false;
    }
  }, [id, fetchService, fetchDeploys, checkServiceRunning, fetchAttachedVolumes]);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      fetchService(true),
      fetchDeploys(pageInfoRef.current?.page || 1, true),
      checkServiceRunning(true),
      fetchAttachedVolumes(),
      fetchAvailableNetworks(),
      fetchAvailableVolumes(),
      activeTab === "logs" ? refreshServiceLogs() : Promise.resolve(),
      activeTab === "logs" && deployLogDeployId
        ? fetchDeployLogsInitial(deployLogDeployId)
        : Promise.resolve(),
    ]);
  }, [
    fetchService,
    fetchDeploys,
    checkServiceRunning,
    fetchAttachedVolumes,
    fetchAvailableNetworks,
    fetchAvailableVolumes,
    activeTab,
    refreshServiceLogs,
    deployLogDeployId,
    fetchDeployLogsInitial,
  ]);

  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (!id || !refreshIntervalMs || refreshIntervalMs < 1000) return undefined;

    refreshIntervalRef.current = setInterval(() => {
      silentRefresh();
    }, refreshIntervalMs);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [id, refreshIntervalMs, silentRefresh]);

  const openConfirm = (type, deployId, title, message) => {
    setConfirmDialog({
      open: true,
      type,
      deployId,
      title,
      message,
      loading: false,
    });
  };

  const closeConfirm = () => {
    setConfirmDialog({
      open: false,
      type: null,
      deployId: null,
      title: "",
      message: "",
      loading: false,
    });
  };

  const handleEditClick = useCallback((deploy) => {
    setEditingDeployId(deploy.id);
    setEditData({
      name: deploy.name || "",
      version: deploy.version || "",
      config: deploy.config || "",
    });
    setEditOriginalName(deploy.name || "");
    setEditZipFile(null);
    setError(null);
    setActiveTab("create");
    document.querySelector(".create-deploy-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingDeployId(null);
    setEditData({ name: "", version: "", config: "" });
    setEditOriginalName("");
    setEditZipFile(null);
    if (editZipInputRef.current) editZipInputRef.current.value = "";
  }, []);

  const handleCreate = async (e) => {
    e?.preventDefault();
    setError(null);
    setSnackbar(null);

    if (!name || name.length < 4) {
      setError("Name must be at least 4 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const available = await checkDeployNameAvailable(name);
      if (!available) {
        setError("That name is already taken or not available.");
        setSubmitting(false);
        return;
      }

      if (!zipFile) {
        const payload = { name, service: id, version, config };
        const createResp = await apiRequest({
          method: "POST",
          url: `${DEPLOY_BASE}`,
          data: payload,
        });

        if (createResp.status === 201) {
          safeSetSnackbar("success", "Deploy created.");
          await fetchDeploys(1);
          setName("");
          setVersion("");
          setConfig("");
        } else {
          setError("Create request failed.");
        }
      } else {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("service", id);
        if (version) fd.append("version", version);
        if (config) fd.append("config", config);
        fd.append("zip_file", zipFile);

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};

        const resp = await axios.post(`${DEPLOY_BASE}`, fd, { headers });

        if (resp.status === 201) {
          safeSetSnackbar("success", "Deploy created.");
          await fetchDeploys(1);
          setName("");
          setVersion("");
          setConfig("");
          setZipFile(null);
          if (zipInputRef.current) zipInputRef.current.value = "";
        } else {
          setError("Create upload failed.");
        }
      }
    } catch (err) {
      console.error("handleCreate error:", err);
      setError(
        err.response?.data
          ? JSON.stringify(err.response.data)
          : "Unexpected error creating deploy."
      );
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleUpdateDeploy = async (deployId) => {
    setError(null);
    setSnackbar(null);
    setAction(deployId, { updating: true });

    try {
      if (!editData.name || editData.name.length < 4) {
        setError("Name must be at least 4 characters.");
        setAction(deployId, { updating: false });
        return;
      }

      const available = await checkDeployNameAvailable(editData.name);
      if (!available) {
        setError("That name is already taken or not available.");
        setAction(deployId, { updating: false });
        return;
      }

      if (!editZipFile) {
        const payload = {
          name: editData.name,
          version: editData.version,
          config: editData.config,
        };
        const resp = await apiRequest({
          method: "PUT",
          url: `${DEPLOY_BASE}${deployId}/`,
          data: payload,
        });

        if (resp.status === 200) {
          safeSetSnackbar("success", "Deploy updated.");
          await fetchDeploys(pageInfo.page);
          handleCancelEdit();
        } else {
          setError("Update failed.");
        }
      } else {
        const fd = new FormData();
        fd.append("name", editData.name);
        fd.append("service", id);
        if (editData.version) fd.append("version", editData.version);
        if (editData.config) fd.append("config", editData.config);
        fd.append("zip_file", editZipFile);

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.put(`${DEPLOY_BASE}${deployId}/`, fd, { headers });

        if (resp.status === 200) {
          safeSetSnackbar("success", "Deploy updated.");
          await fetchDeploys(pageInfo.page);
          handleCancelEdit();
        } else {
          setError("Update file upload failed.");
        }
      }
    } catch (err) {
      console.error("handleUpdateDeploy error:", err);
      setError(
        err.response ? JSON.stringify(err.response.data) : "Unexpected update error"
      );
    } finally {
      setAction(deployId, { updating: false });
    }
  };

  const handleDeleteDeploy = async (deployId) => {
    setError(null);
    setSnackbar(null);
    setAction(deployId, { deleting: true });

    try {
      const resp = await apiRequest({
        method: "DELETE",
        url: `${DEPLOY_BASE}${deployId}/`,
      });

      if (resp.status >= 200 && resp.status < 300) {
        safeSetSnackbar("success", "Deploy deleted.");
        await fetchDeploys(pageInfo.page);
      } else {
        setError("Delete failed.");
      }
    } catch (err) {
      console.error("handleDeleteDeploy error:", err);
      setError(
        err.response ? JSON.stringify(err.response.data) : "Unexpected delete error"
      );
    } finally {
      setAction(deployId, { deleting: false });
    }
  };

  const handleSelectDeploy = useCallback(
    async (deployOrId) => {
      const deployId =
        typeof deployOrId === "object" && deployOrId != null
          ? deployOrId.id ?? deployOrId.pk
          : deployOrId;

      if (!deployId || !id) return;

      setActionState((s) => ({
        ...s,
        [deployId]: { ...(s[deployId] || {}), selecting: true },
      }));

      try {
        const resp = await apiRequest({
          method: "POST",
          url: `${DEPLOY_BASE}set_deploy/`,
          data: {
            deploy_id: String(deployId),   // فقط UUID
            service_id: String(id),        // فقط UUID
          },
        });

        if (resp.data?.result === "success") {
          safeSetSnackbar("success", resp.data.detail || "Deploy selected.");
          await fetchService(true);
          await fetchDeploys(pageInfo.page);
        } else {
          safeSetSnackbar("error", resp.data?.detail || "Select failed.");
        }
      } catch (err) {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to select deploy.";
        safeSetSnackbar("error", String(msg));
      } finally {
        setActionState((s) => ({
          ...s,
          [deployId]: { ...(s[deployId] || {}), selecting: false },
        }));
      }
    },
    [id, pageInfo.page, safeSetSnackbar]
  );

  const handleUnselectDeploy = useCallback(
    async (deployOrId) => {
      const deployId =
        typeof deployOrId === "object" && deployOrId != null
          ? deployOrId.id ?? deployOrId.pk
          : deployOrId;

      if (!deployId || !id) return;

      setActionState((s) => ({
        ...s,
        [deployId]: { ...(s[deployId] || {}), selecting: true },
      }));

      try {
        const resp = await apiRequest({
          method: "POST",
          url: `${DEPLOY_BASE}unset_deploy/`,
          data: {
            deploy_id: String(deployId),
            service_id: String(id),
          },
        });

        if (resp.data?.result === "success") {
          safeSetSnackbar("success", resp.data.detail || "Deploy unselected.");
          await fetchService(true);
          await fetchDeploys(pageInfo.page);
        } else {
          safeSetSnackbar("error", resp.data?.detail || "Unselect failed.");
        }
      } catch (err) {
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.error ||
          "Failed to unselect deploy.";
        safeSetSnackbar("error", String(msg));
      } finally {
        setActionState((s) => ({
          ...s,
          [deployId]: { ...(s[deployId] || {}), selecting: false },
        }));
      }
    },
    [id, pageInfo.page, safeSetSnackbar]
  );

  const startService = async () => {
    if (!id) return;
    setError(null);
    setSnackbar(null);

    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}start_service/`,
        data: { service_id: id },
      });

      if (resp.status === 202) {
        safeSetSnackbar("success", "Service start requested.");
        await fetchService();
        // Live status updates after deploy task progresses
        setTimeout(() => {
          if (mountedRef.current) checkServiceRunning(true);
        }, 1500);
        setTimeout(() => {
          if (mountedRef.current) {
            fetchService(true);
            checkServiceRunning(true);
          }
        }, 4000);
      } else {
        setError("Failed to start service.");
      }
    } catch (err) {
      console.error("startService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error starting service");
    }
  };

  const stopService = async () => {
    if (!id) return;
    setError(null);
    setSnackbar(null);

    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}stop_service/`,
        data: { service_id: id },
      });

      if (resp.status === 202) {
        safeSetSnackbar("success", "Service stop requested.");
        await fetchService();
        setTimeout(() => {
          if (mountedRef.current) checkServiceRunning(true);
        }, 1500);
        setTimeout(() => {
          if (mountedRef.current) {
            fetchService(true);
            checkServiceRunning(true);
          }
        }, 4000);
      } else {
        setError("Failed to stop service.");
      }
    } catch (err) {
      console.error("stopService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error stopping service");
    }
  };

  const handleAttachNetwork = async () => {
    if (!selectedNetworkId || !id) return;
    setNetworkActionLoading(true);
    setError(null);

    try {
      await apiRequest({
        method: "PATCH",
        url: `${SERVICE_BASE}${id}/`,
        data: { network: selectedNetworkId },
      });
      safeSetSnackbar("success", "Network attached successfully.");
      await fetchService();
      await fetchAvailableNetworks();
    } catch (err) {
      console.error("handleAttachNetwork error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Unable to attach network."
      );
    } finally {
      if (mountedRef.current) setNetworkActionLoading(false);
    }
  };

  const handleDetachNetwork = async () => {
    if (!id) return;
    setNetworkActionLoading(true);
    setError(null);

    try {
      await apiRequest({
        method: "PATCH",
        url: `${SERVICE_BASE}${id}/`,
        data: { network: null },
      });
      setSelectedNetworkId("");
      safeSetSnackbar("success", "Network detached successfully.");
      await fetchService();
      await fetchAvailableNetworks();
    } catch (err) {
      console.error("handleDetachNetwork error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Unable to detach network."
      );
    } finally {
      if (mountedRef.current) setNetworkActionLoading(false);
    }
  };

  const handleAttachVolume = async () => {
    if (!selectedVolumeId || !id) return;
    setVolumeActionLoading(true);
    setError(null);

    try {
      await apiRequest({
        method: "PATCH",
        url: `${VOLUME_API_ROOT}${selectedVolumeId}/`,
        data: { service: id },
      });
      safeSetSnackbar("success", "Volume attached successfully.");
      await fetchAttachedVolumes();
      await fetchAvailableVolumes();
    } catch (err) {
      console.error("handleAttachVolume error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Unable to attach volume."
      );
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  };

  const handleDetachVolume = async (volumeId) => {
    if (!volumeId) return;
    setVolumeActionLoading(true);
    setError(null);

    try {
      await apiRequest({
        method: "PATCH",
        url: `${VOLUME_API_ROOT}${volumeId}/`,
        data: { service: null },
      });
      safeSetSnackbar("success", "Volume detached successfully.");
      await fetchAttachedVolumes();
      await fetchAvailableVolumes();
    } catch (err) {
      console.error("handleDetachVolume error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Unable to detach volume."
      );
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  };

  const handleShowVolumeFiles = async (volumeId) => {
    if (!volumeId) return;
    setVolumeActionLoading(true);
    setError(null);

    try {
      const resp = await apiRequest({
        method: "GET",
        url: `${VOLUME_API_ROOT}${volumeId}/files/`,
      });
      setVolumeFiles(Array.isArray(resp.data?.files) ? resp.data.files : []);
      setFilesDialogOpen(true);
    } catch (err) {
      console.error("handleShowVolumeFiles error:", err);
      setError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Unable to load volume files."
      );
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  };

  const handleDownloadEntries = useCallback((filename, entries) => {
    const lines = (entries || []).map((entry) => getDeployEntryText(entry));
    if (!lines.length) {
      safeSetSnackbar("info", "No entries to download.");
      return;
    }
    downloadTextFile(filename, lines);
    safeSetSnackbar("success", "Download started.");
  }, [safeSetSnackbar]);

  const handleCopyEntries = useCallback(async (entries) => {
    const lines = (entries || []).map((entry) => getDeployEntryText(entry));
    if (!lines.length) {
      safeSetSnackbar("info", "No entries to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      safeSetSnackbar("success", "Copied.");
    } catch {
      safeSetSnackbar("error", "Copy failed.");
    }
  }, [safeSetSnackbar]);

  const clearServiceLogs = () => setServiceLogsEntries([]);
  const clearDeployLogs = () => setDeployLogEntries([]);

  const handlePrev = () => {
    if (!pageInfo.previous) return;
    try {
      const u = new URL(pageInfo.previous);
      fetchDeploys(parseInt(u.searchParams.get("page") || "1", 10));
    } catch {
      fetchDeploys(Math.max(1, pageInfo.page - 1));
    }
  };

  const handleNext = () => {
    if (!pageInfo.next) return;
    try {
      const u = new URL(pageInfo.next);
      fetchDeploys(parseInt(u.searchParams.get("page") || String(pageInfo.page + 1), 10));
    } catch {
      fetchDeploys(pageInfo.page + 1);
    }
  };

  const openServiceInNewTab = () => {
    if (!service?.service_name) return;
    const host = `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`;
    window.open(`http://${host}`, "_blank", "noopener,noreferrer");
  };

  const goBackToServices = () => navigate("/services");

  const deploysGrid = useMemo(() => {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
          },
          gap: { xs: 1.25, sm: 1.75 },
          maxWidth: 960,
        }}
      >
        {deploys.map((deploy) => {
          const isSelected =
            selectedDeployId !== "" && String(selectedDeployId) === String(deploy.id);
          const cannotSelect =
            service &&
            ["queued", "deploying", "stopping"].includes(String(service.status));

          return (
            <DeployCard
              key={deploy.id ?? deploy.pk}
              deploy={deploy}
              isSelected={isSelected}
              cannotSelect={cannotSelect}
              actionState={actionState[deploy.id] ?? {}}
              onEdit={handleEditClick}
              onSelect={handleSelectDeploy}
              onUnselect={handleUnselectDeploy}
              onDelete={(d) =>
                openConfirm("delete", d.id, "Delete deploy", `Delete deploy "${d.name}"?`)
              }
            />
          );
        })}
      </Box>
    );
  }, [deploys, selectedDeployId, service, actionState, handleEditClick]);

  const createDeployPanel = (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mb: 1.5,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {editingDeployId ? "Edit deploy" : "Create deploy"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Keep the form simple, clear, and fast.
            </Typography>
          </Box>
          <Chip
            label={editingDeployId ? "Editing mode" : "New deploy"}
            color={editingDeployId ? "warning" : "primary"}
            size="small"
          />
        </Box>

        <Box
          component="form"
          className="create-deploy-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (editingDeployId) handleUpdateDeploy(editingDeployId);
            else handleCreate(e);
          }}
        >
          <TextField
            fullWidth
            label="Name"
            size="small"
            value={editingDeployId ? editData.name : name}
            onChange={(e) =>
              editingDeployId
                ? setEditData((d) => ({ ...d, name: e.target.value }))
                : setName(e.target.value)
            }
            helperText="At least 4 characters."
            sx={{ mb: 1.25 }}
          />

          <TextField
            fullWidth
            label="Version"
            size="small"
            value={editingDeployId ? editData.version : version}
            onChange={(e) =>
              editingDeployId
                ? setEditData((d) => ({ ...d, version: e.target.value }))
                : setVersion(e.target.value)
            }
            sx={{ mb: 1.25 }}
          />

          <TextField
            fullWidth
            label="Config"
            size="small"
            multiline
            rows={4}
            value={editingDeployId ? editData.config : config}
            onChange={(e) =>
              editingDeployId
                ? setEditData((d) => ({ ...d, config: e.target.value }))
                : setConfig(e.target.value)
            }
            sx={{ mb: 1.25 }}
          />

          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1.25, flexWrap: "wrap" }}>
            {!editingDeployId ? (
              <>
                <Button variant="outlined" component="label" size="small">
                  Choose .zip
                  <input
                    type="file"
                    hidden
                    accept=".zip"
                    ref={zipInputRef}
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {zipFile ? `${zipFile.name} (${Math.round(zipFile.size / 1024)} KB)` : "No file selected"}
                </Typography>
              </>
            ) : (
              <>
                <Button variant="outlined" component="label" size="small">
                  Replace .zip
                  <input
                    type="file"
                    hidden
                    accept=".zip"
                    ref={editZipInputRef}
                    onChange={(e) => setEditZipFile(e.target.files?.[0] || null)}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {editZipFile ? editZipFile.name : "No file selected"}
                </Typography>
              </>
            )}
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
            {!editingDeployId ? (
              <>
                <Button variant="contained" type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Create deploy"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setName("");
                    setVersion("");
                    setConfig("");
                    setZipFile(null);
                    if (zipInputRef.current) zipInputRef.current.value = "";
                  }}
                >
                  Reset
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  onClick={() => handleUpdateDeploy(editingDeployId)}
                  disabled={actionState[editingDeployId]?.updating}
                >
                  {actionState[editingDeployId]?.updating ? "Updating..." : "Update"}
                </Button>
                <Button variant="outlined" color="error" onClick={handleCancelEdit}>
                  Cancel edit
                </Button>
              </>
            )}
          </Stack>

          {error ? (
            <Alert severity="error" sx={{ mt: 1.5 }}>
              {error}
            </Alert>
          ) : null}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            mb: 1.5,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Deploys
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest deploys first.
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {deploysLoading ? "Loading..." : `${pageInfo.count ?? 0} total`}
          </Typography>
        </Box>

        {deploysLoading ? (
          <Box sx={{ py: 4 }}>
            <Typography>Loading...</Typography>
          </Box>
        ) : deploys.length === 0 ? (
          <Typography color="text.secondary">No deploys found for this service.</Typography>
        ) : (
          deploysGrid
        )}

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 1,
            mt: 2,
            flexWrap: "wrap",
          }}
        >
          <Button onClick={handlePrev} disabled={!pageInfo.previous}>
            Prev
          </Button>
          <Typography variant="body2" sx={{ alignSelf: "center" }}>
            Page {pageInfo.page} — {pageInfo.count} total
          </Typography>
          <Button onClick={handleNext} disabled={!pageInfo.next}>
            Next
          </Button>
        </Box>
      </Paper>
    </Stack>
  );

  const logsPanel = (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <LogPanel
        title="Service logs"
        subtitle="Latest logs stay at the bottom. Scroll up for older lines."
        entries={serviceLogsEntries}
        loading={serviceLogsLoading}
        error={serviceLogsError}
        connected={serviceLogsConnected}
        paused={serviceLogsPaused}
        filter={serviceLogsFilter}
        level={serviceLogsLevel}
        onFilterChange={setServiceLogsFilter}
        onLevelChange={setServiceLogsLevel}
        onTogglePaused={() => setServiceLogsPaused((v) => !v)}
        onRefresh={refreshServiceLogs}
        onClear={clearServiceLogs}
        onDownload={(entries) => handleDownloadEntries(`service-${id}-logs.txt`, entries)}
        onCopy={(entries) => handleCopyEntries(entries)}
        onJumpToLatest={() => {
          const el = serviceLogScrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }}
        scrollRef={serviceLogScrollRef}
        emptyText="No service logs yet."
      />

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 1.5 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Deploy history
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest at the bottom. Scroll up to load older logs.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" alignItems={{ xs: "stretch", sm: "center" }}>
            <FormControl size="small" sx={{ minWidth: { xs: 0, sm: 200 }, width: { xs: "100%", sm: "auto" } }}>
              <InputLabel>Deploy</InputLabel>
              <Select
                label="Deploy"
                value={deployLogDeployId}
                onChange={(e) => {
                  deployLogManualSelectRef.current = true;
                  setDeployLogDeployId(String(e.target.value));
                }}
              >
                {deploys.length ? (
                  deploys.map((deploy) => {
                    const label = `${deploy.name || "Deploy"}${deploy.version ? ` • ${deploy.version}` : ""}`;
                    return (
                      <MenuItem key={deploy.id ?? deploy.pk} value={String(deploy.id ?? deploy.pk ?? "")}>
                        {label}
                      </MenuItem>
                    );
                  })
                ) : (
                  <MenuItem value="" disabled>
                    No deploys yet
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            <Button
              size="small"
              variant="outlined"
              onClick={() => fetchDeployLogsInitial(deployLogDeployId)}
              startIcon={<RefreshIcon />}
              fullWidth={!isDesktop}
            >
              Refresh history
            </Button>
          </Stack>
        </Stack>

        <LogPanel
          title={currentDeployForLogs ? `Deploy: ${currentDeployForLogs.name || currentDeployForLogs.id}` : "Deploy history"}
          subtitle="Newest at the bottom. Scroll up for older records."
          entries={deployLogEntries}
          loading={deployLogLoading}
          loadingOlder={deployLogLoadingOlder}
          error={deployLogError}
          connected={false}
          showConnectionChip={false}
          filter={deployLogFilter}
          level={deployLogLevel}
          onFilterChange={setDeployLogFilter}
          onLevelChange={setDeployLogLevel}
          onRefresh={() => fetchDeployLogsInitial(deployLogDeployId)}
          onClear={clearDeployLogs}
          onDownload={(entries) => handleDownloadEntries(`deploy-${deployLogDeployId || id}-logs.txt`, entries)}
          onCopy={(entries) => handleCopyEntries(entries)}
          onJumpToLatest={() => {
            const el = deployLogScrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          onLoadOlder={loadOlderDeployLogs}
          hasMoreOlder={deployLogHasMoreOlderRef.current}
          scrollRef={deployLogScrollRef}
          emptyText="No deploy history available."
        />
      </Paper>
    </Stack>
  );

  const globalServiceControls = (
    <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
          flexWrap: "wrap",
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {service?.name || "Service"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {service?.service_name ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}` : "—"}
          </Typography>
        </Box>
        <Chip
          label={
            serviceRunning === true
              ? "Running"
              : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
              ? String(service.status)
              : serviceRunning === false
              ? "Stopped"
              : service?.status || "Unknown"
          }
          color={
            serviceRunning === true || ["running", "success"].includes(String(service?.status || ""))
              ? "success"
              : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
              ? "warning"
              : "default"
          }
          size="small"
        />
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={startService}
          disabled={
            !service ||
            serviceLoading ||
            ["queued", "deploying", "stopping"].includes(String(service?.status))
          }
          fullWidth
          size="small"
        >
          Start
        </Button>
        <Button
          variant="outlined"
          startIcon={<StopIcon />}
          onClick={stopService}
          disabled={
            !service ||
            serviceLoading ||
            ["queued", "deploying", "stopping"].includes(String(service?.status))
          }
          fullWidth
          size="small"
        >
          Stop
        </Button>
        <Button
          variant="outlined"
          onClick={() => checkServiceRunning(false)}
          disabled={!service || serviceStatusLoadingManual}
          fullWidth
          size="small"
        >
          {serviceStatusLoadingManual ? "Checking..." : "Check status"}
        </Button>
        <Button
          variant="outlined"
          onClick={openServiceInNewTab}
          disabled={!service?.service_name}
          startIcon={<LinkIcon />}
          fullWidth
          size="small"
        >
          Open
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }} flexWrap="wrap" useFlexGap>
        <Chip label={`Status: ${service?.status || "—"}`} size="small" variant="outlined" />
        <Chip label={`Deploys: ${deployCount}`} size="small" variant="outlined" />
        <Chip label={`Volumes: ${volumeCount}`} size="small" variant="outlined" />
        <Chip label={`Network: ${networkName}`} size="small" variant="outlined" />
        {selectedDeploy ? (
          <Chip
            label={`Selected: ${selectedDeploy.name || selectedDeploy.id}`}
            size="small"
            color="success"
          />
        ) : null}
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="caption">
          CPU {serviceCpu !== null ? `${serviceCpu}%` : "—"}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(serviceCpu || 0, 0), 100)}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceCpu) },
          }}
        />
        <Typography variant="caption">
          RAM {serviceRam !== null ? `${serviceRam}%` : "—"}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(serviceRam || 0, 0), 100)}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceRam) },
          }}
        />
      </Stack>
    </Paper>
  );

  const overviewPanel = (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Service details
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {service?.name || "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Host:</strong>{" "}
            {service?.service_name
              ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`
              : "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Status:</strong> {service?.status || "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Running:</strong>{" "}
            {serviceRunning === null ? "—" : serviceRunning ? "Yes" : "No"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Selected deploy:</strong>{" "}
            {selectedDeploy
              ? `${selectedDeploy.name || selectedDeploy.id}${
                  selectedDeploy.version ? ` (v${selectedDeploy.version})` : ""
                }`
              : "None"}
          </Box>
          {service?.created_at ? (
            <Box sx={{ mb: 0.75 }}>
              <strong>Created:</strong> {formatDate(service.created_at)}
            </Box>
          ) : null}
          {service?.updated_at ? (
            <Box sx={{ mb: 0.75 }}>
              <strong>Updated:</strong> {formatDate(service.updated_at)}
            </Box>
          ) : null}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Plan
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {planDetail?.name ?? service?.plan?.name ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Platform:</strong>{" "}
            {planDetail?.platform ?? service?.plan?.platform ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>CPU:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>RAM:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Storage:</strong>{" "}
            {planDetail?.max_storage ?? service?.plan?.max_storage ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Price:</strong>{" "}
            {planDetail?.price_per_hour ?? service?.plan?.price_per_hour ?? "—"}
          </Box>
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Network
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {networkName}
          </Box>
          {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && (
            <Box sx={{ mb: 0.75 }}>
              <strong>CIDR:</strong>{" "}
              {networkDetail?.network?.cidr ?? networkDetail?.cidr}
            </Box>
          )}
          {(networkDetail?.network?.driver ?? networkDetail?.driver) && (
            <Box sx={{ mb: 0.75 }}>
              <strong>Driver:</strong>{" "}
              {networkDetail?.network?.driver ?? networkDetail?.driver}
            </Box>
          )}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Volumes ({volumeCount})
        </Typography>
        {attachedVolumes.length ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 1.25,
            }}
          >
            {attachedVolumes.map((volume) => (
              <Paper key={volume.id} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {volume.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bind: {volume.bind || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Mode: {volume.mode || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Size: {volume.size_mb != null ? `${volume.size_mb} MB` : "—"}
                </Typography>
              </Paper>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">No volumes attached.</Typography>
        )}
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Deploys ({deployCount})
        </Typography>
        {deploys.length ? (
          <Stack spacing={1}>
            {deploys.slice(0, 8).map((deploy) => {
              const isSelected =
                selectedDeployId !== "" &&
                String(selectedDeployId) === String(deploy.id);
              return (
                <Paper
                  key={deploy.id ?? deploy.pk}
                  variant="outlined"
                  sx={{ p: 1.25, borderRadius: 1.5 }}
                >
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                    flexWrap="wrap"
                    useFlexGap
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {deploy.name || "Unnamed"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        v{deploy.version || "—"} · {formatDate(deploy.created_at)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {isSelected ? (
                        <Chip label="Selected" size="small" color="success" />
                      ) : null}
                      {deploy.status || deploy.stage ? (
                        <Chip
                          label={deploy.status || deploy.stage}
                          size="small"
                          variant="outlined"
                        />
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              );
            })}
            {deploys.length > 8 ? (
              <Typography variant="caption" color="text.secondary">
                Showing 8 of {deploys.length}. Open Create deploy for the full list.
              </Typography>
            ) : null}
          </Stack>
        ) : (
          <Typography color="text.secondary">No deploys for this service.</Typography>
        )}
      </Paper>
    </Stack>
  );

  const settingsPanel = (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Plan
        </Typography>

        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          {(planDetail?.name ?? service?.plan?.name) && (
            <Box sx={{ mb: 1 }}>
              <strong>Name:</strong> {planDetail?.name ?? service?.plan?.name}
            </Box>
          )}
          {(planDetail?.platform ?? service?.plan?.platform) && (
            <Box sx={{ mb: 1 }}>
              <strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform}
            </Box>
          )}
          {(planDetail?.max_cpu ?? service?.plan?.max_cpu) && (
            <Box sx={{ mb: 0.5 }}>
              <strong>CPU:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu}
            </Box>
          )}
          {(planDetail?.max_ram ?? service?.plan?.max_ram) && (
            <Box sx={{ mb: 0.5 }}>
              <strong>RAM:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram}
            </Box>
          )}
          {(planDetail?.max_storage ?? service?.plan?.max_storage) && (
            <Box sx={{ mb: 0.5 }}>
              <strong>Storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage}
            </Box>
          )}
          {(planDetail?.price_per_hour ?? service?.plan?.price_per_hour) && (
            <Box sx={{ mt: 1 }}>
              <strong>Price:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour}
            </Box>
          )}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Network
        </Typography>

        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          {(service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name) && (
            <Box sx={{ mb: 1 }}>
              <strong>Name:</strong>{" "}
              {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name}
            </Box>
          )}

          {networkDetail ? (
            <>
              {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && (
                <Box sx={{ mb: 0.5 }}>
                  <strong>CIDR:</strong> {networkDetail?.network?.cidr ?? networkDetail?.cidr}
                </Box>
              )}
              {(networkDetail?.network?.driver ?? networkDetail?.driver) && (
                <Box sx={{ mb: 0.5 }}>
                  <strong>Driver:</strong> {networkDetail?.network?.driver ?? networkDetail?.driver}
                </Box>
              )}
              {Array.isArray(networkDetail?.services) && (
                <Box sx={{ mt: 1 }}>
                  <strong>Services:</strong> {networkDetail.services.length}
                </Box>
              )}
            </>
          ) : (
            <>
              {service?.network?.created_at && (
                <Box sx={{ mb: 0.5 }}>
                  <strong>Created:</strong> {new Date(service.network.created_at).toLocaleString()}
                </Box>
              )}
              {service?.network?.description && (
                <Box sx={{ mb: 0.5 }}>
                  <strong>Description:</strong> {service.network.description}
                </Box>
              )}
            </>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1.5}>
          <FormControl fullWidth size="small">
            <InputLabel>Network</InputLabel>
            <Select
              label="Network"
              value={selectedNetworkId || ""}
              onChange={(e) => setSelectedNetworkId(e.target.value)}
            >
              <MenuItem value="">Select a network</MenuItem>
              {availableNetworks.map((network) => (
                <MenuItem key={network.id} value={String(network.id)}>
                  {network.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button
              variant="contained"
              onClick={handleAttachNetwork}
              disabled={!selectedNetworkId || networkActionLoading}
              fullWidth
            >
              {service?.network ? "Change network" : "Attach network"}
            </Button>
            {service?.network ? (
              <Button
                variant="outlined"
                color="error"
                onClick={handleDetachNetwork}
                disabled={networkActionLoading}
                fullWidth
              >
                Detach
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Volumes
        </Typography>

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Unused volume</InputLabel>
          <Select
            label="Unused volume"
            value={selectedVolumeId}
            onChange={(e) => setSelectedVolumeId(e.target.value)}
          >
            <MenuItem value="">Select a volume to attach</MenuItem>
            {availableVolumes.map((volume) => (
              <MenuItem key={volume.id} value={String(volume.id)}>
                {volume.name} ({volume.size_mb} MB)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            onClick={handleAttachVolume}
            disabled={!selectedVolumeId || volumeActionLoading}
            fullWidth
          >
            Attach volume
          </Button>
          <Button variant="outlined" onClick={fetchAvailableVolumes} fullWidth>
            Refresh list
          </Button>
        </Stack>

        {attachedVolumes.length ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Attached volumes
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 1.25,
              }}
            >
              {attachedVolumes.map((volume) => (
                <Paper key={volume.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {volume.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Bind: {volume.bind}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Mode: {volume.mode}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Size: {volume.size_mb} MB
                      </Typography>
                    </Box>

                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => handleShowVolumeFiles(volume.id)}>
                        Files
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => handleDetachVolume(volume.id)}
                        disabled={volumeActionLoading}
                      >
                        Detach
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography color="text.secondary">No volumes are currently attached.</Typography>
        )}
      </Paper>
    </Stack>
  );

  return (
    <Box sx={{ p: { xs: 1.25, sm: 2, md: 3 }, maxWidth: 1280, mx: "auto", width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          mb: { xs: 1.5, md: 2 },
          flexWrap: "wrap",
        }}
      >
        <Button variant="outlined" size={isDesktop ? "medium" : "small"} onClick={goBackToServices}>
          ← Back
        </Button>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant={isDesktop ? "h5" : "h6"} sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            Service detail
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            ID: {id}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Button
            variant="outlined"
            size={isDesktop ? "medium" : "small"}
            startIcon={<RefreshIcon />}
            onClick={refreshAll}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            size={isDesktop ? "medium" : "small"}
            startIcon={<AccessTimeIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setIntervalMenuAnchor(e.currentTarget)}
            aria-haspopup="true"
            aria-expanded={Boolean(intervalMenuAnchor) ? "true" : undefined}
          >
            {REFRESH_INTERVAL_OPTIONS.find((o) => o.value === refreshIntervalMs)?.label || "2s"}
          </Button>
          <Menu
            anchorEl={intervalMenuAnchor}
            open={Boolean(intervalMenuAnchor)}
            onClose={() => setIntervalMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {REFRESH_INTERVAL_OPTIONS.map((opt) => (
              <MenuItem
                key={opt.value}
                selected={opt.value === refreshIntervalMs}
                onClick={() => {
                  setRefreshIntervalMs(opt.value);
                  setIntervalMenuAnchor(null);
                }}
              >
                {opt.label}
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "minmax(0, 1fr) 280px" : "1fr",
          gap: { xs: 1.5, md: 2 },
          alignItems: "start",
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {globalServiceControls}

          {!isDesktop ? (
            <Paper
              elevation={1}
              sx={{
                borderRadius: 2,
                boxShadow: 3,
                mb: 2,
                position: "sticky",
                top: 8,
                zIndex: 5,
                overflow: "hidden",
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(e, v) => setActiveTab(v)}
                variant="fullWidth"
                sx={{
                  "& .MuiTab-root": {
                    py: 1.25,
                    minHeight: 56,
                    fontWeight: 700,
                  },
                }}
              >
                {TABS.map((tab) => (
                  <Tab key={tab.value} value={tab.value} icon={tab.icon} iconPosition="start" label={tab.label} />
                ))}
              </Tabs>
            </Paper>
          ) : null}

          <Box>
            {activeTab === "overview" ? overviewPanel : null}
            {activeTab === "create" ? createDeployPanel : null}
            {activeTab === "logs" ? logsPanel : null}
            {activeTab === "settings" ? settingsPanel : null}
          </Box>
        </Box>

        {isDesktop ? (
          <TabSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            service={service}
            selectedDeploy={selectedDeploy}
            deployCount={deployCount}
            volumeCount={volumeCount}
            networkName={networkName}
            serviceRunning={serviceRunning}
          />
        ) : null}
      </Box>

      <Dialog
        open={confirmDialog.open}
        onClose={() => {
          if (!confirmDialog.loading) closeConfirm();
        }}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (!confirmDialog.loading) closeConfirm();
            }}
            disabled={confirmDialog.loading}
          >
            Cancel
          </Button>
          <Button
            color={confirmDialog.type === "delete" ? "error" : "primary"}
            onClick={async () => {
              const { type, deployId } = confirmDialog;
              if (!type) {
                closeConfirm();
                return;
              }

              setConfirmDialog((c) => ({ ...c, loading: true }));
              try {
                if (type === "delete") await handleDeleteDeploy(deployId);
                else if (type === "select") await handleSelectDeploy(deployId);
                else if (type === "unselect") await handleUnselectDeploy(deployId);
              } finally {
                setConfirmDialog((c) => ({ ...c, loading: false }));
                setTimeout(() => closeConfirm(), 120);
              }
            }}
            disabled={confirmDialog.loading}
          >
            {confirmDialog.loading
              ? "Working..."
              : confirmDialog.type === "delete"
              ? "Delete"
              : confirmDialog.type === "unselect"
              ? "Unselect"
              : "Select"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={filesDialogOpen}
        onClose={() => setFilesDialogOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Volume files</DialogTitle>
        <DialogContent>
          {volumeFiles.length === 0 ? (
            <Typography color="text.secondary">No files available for this volume.</Typography>
          ) : (
            <Box sx={{ maxHeight: 360, overflowY: "auto" }}>
              {volumeFiles.map((item, index) => (
                <Box key={`${item.path}-${index}`} sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.path || "./"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.type || "file"} • {item.size != null ? `${item.size} bytes` : "-"}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFilesDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3000}
        onClose={() => setSnackbar(null)}
      >
        {snackbar ? (
          <Alert
            onClose={() => setSnackbar(null)}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}