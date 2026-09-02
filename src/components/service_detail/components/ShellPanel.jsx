import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileRoundedIcon from "@mui/icons-material/InsertDriveFileRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import MenuOpenRoundedIcon from "@mui/icons-material/MenuOpenRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import apiRequest from "../../customHooks/apiRequest";
import { SERVICE_ACTION_ROOT } from "../constants";
import { langLabel } from "../../messenger/modules/codeHighlight";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";
import ShellXterm from "./ShellXterm";

const HISTORY_LIMIT = 500;
const COMMAND_HISTORY_LIMIT = 100;
const TERMINAL_HEIGHT = { xs: 560, md: 700 };
const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";

const SHELL_SNIPPETS = {
  laravel: [
    { label: "Create admin user (tinker)", command: "php artisan tinker" },
    { label: "Migrate status", command: "php artisan migrate:status" },
    { label: "Run migrations", command: "php artisan migrate" },
    { label: "Clear all caches", command: "php artisan optimize:clear" },
    { label: "Route list", command: "php artisan route:list" },
    { label: "About", command: "php artisan about" },
    { label: "Queue one job", command: "php artisan queue:work --once" },
    { label: "Run scheduler once", command: "php artisan schedule:run" },
  ],
  php: [
    { label: "PHP version", command: "php -v" },
    { label: "PHP modules", command: "php -m" },
  ],
  django: [
    { label: "System check", command: "python manage.py check" },
    { label: "Show migrations", command: "python manage.py showmigrations" },
    { label: "Migrate", command: "python manage.py migrate" },
    { label: "Create superuser", command: "python manage.py createsuperuser" },
  ],
  python: [
    { label: "Python version", command: "python --version" },
  ],
  node: [
    { label: "Node version", command: "node -v" },
    { label: "NPM version", command: "npm -v" },
    { label: "Outdated packages", command: "npm outdated" },
  ],
  generic: [
    { label: "Working directory", command: "pwd" },
    { label: "List files", command: "ls -la" },
    { label: "Disk usage", command: "df -h" },
  ],
};


function normalizePlatform(platform) {
  const raw = String(platform || "generic").toLowerCase();
  if (raw.includes("laravel")) return "laravel";
  if (raw === "php") return "php";
  if (["django", "python", "flask", "fastapi"].includes(raw)) return raw === "django" ? "django" : "python";
  if (["node", "react", "vue", "angular", "nextjs", "nuxt"].includes(raw)) return "node";
  return "generic";
}

function stripAnsi(text) {
  // Remove CSI / OSC / charset / private-mode sequences so PsySH and other
  // TTY programs render as readable plain text in our non-xterm UI.
  return String(text ?? "")
    // OSC sequences: ESC ] ... BEL  or  ESC ] ... ESC \
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "")
    // CSI sequences: ESC [ ... final-byte
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // Charset / single-char escapes: ESC ( B, ESC > etc.
    .replace(/\u001b[()][0-9A-Za-z]/g, "")
    .replace(/\u001b[=><]/g, "")
    // Remaining ESC + one char
    .replace(/\u001b./g, "")
    // C1 controls sometimes emitted as raw bytes
    .replace(/[\u0080-\u009f]/g, "");
}

function cleanOutput(text) {
  return stripAnsi(String(text ?? ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Collapse pure cursor-noise blank runs a bit without destroying real blanks
    .replace(/\n{4,}/g, "\n\n\n");
}

function joinPath(cwd, name) {
  const base = String(cwd || "/").replace(/\/$/, "");
  if (!base) return `/${name}`;
  return `${base}/${name}`;
}



function splitPath(path) {
  const safe = String(path || "/").replace(/\\/g, "/");
  if (safe === "/") return [{ label: "/", path: "/" }];
  const parts = safe.split("/").filter(Boolean);
  const result = [{ label: "/", path: "/" }];
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    result.push({ label: part, path: current });
  }
  return result;
}

function detectLanguage(path) {
  const name = String(path || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  const map = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    json: "json", css: "css", scss: "scss", less: "less", html: "xml", htm: "xml",
    vue: "xml", py: "python", rb: "ruby", php: "php", go: "go", rs: "rust",
    java: "java", kt: "kotlin", cs: "csharp", cpp: "cpp", c: "c", h: "c",
    sh: "bash", bash: "bash", zsh: "bash", yml: "yaml", yaml: "yaml", md: "markdown",
    sql: "sql", xml: "xml", env: "bash", toml: "ini",
  };
  return map[ext] || "";
}

function highlightSource(code, language) {
  const source = String(code ?? "");
  if (!source) return "";
  try {
    if (language && hljs.getLanguage(language)) return hljs.highlight(source, { language, ignoreIllegals: true }).value;
  } catch { /* plain text fallback */ }
  return source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fileIconColor(path) {
  const ext = String(path || "").toLowerCase().split(".").pop();
  if (["js", "jsx", "ts", "tsx"].includes(ext)) return "#f7df1e";
  if (ext === "py") return "#65b7ff";
  if (ext === "php") return "#a78bfa";
  if (["css", "scss", "less"].includes(ext)) return "#60a5fa";
  if (["json", "yaml", "yml", "toml"].includes(ext)) return "#f4b860";
  return "#94a3b8";
}

const TerminalHistory = React.memo(function TerminalHistory({ history }) {
  const rows = [];
  for (const entry of history) {
    if (entry.type === "output") {
      cleanOutput(entry.stdout).split("\n").forEach((text, i) => {
        if (text !== "" || i === 0) rows.push({ key: `${entry.id}-out-${i}`, type: "stdout", text });
      });
      cleanOutput(entry.stderr).split("\n").forEach((text, i) => {
        if (text !== "" || i === 0) rows.push({ key: `${entry.id}-err-${i}`, type: "stderr", text });
      });
      if (entry.exitCode != null && entry.exitCode !== 0) {
        rows.push({ key: `${entry.id}-exit`, type: "stderr", text: `Process exited with code ${entry.exitCode}` });
      }
    } else {
      rows.push({ key: entry.id, type: entry.type, text: entry.text });
    }
  }
  return rows.map((line) => (
    <Box key={line.key} sx={{
      color: line.type === "stderr" || line.type === "error" ? "#ff9b8f" : line.type === "system" ? "#87b4d9" : line.type === "command" ? "#b9d7f4" : "#dce6ef",
      whiteSpace: "pre-wrap", overflowWrap: "anywhere", minHeight: line.text ? 20 : 6,
      userSelect: "text", WebkitUserSelect: "text",
    }}>{line.text || " "}</Box>
  ));
});

export default function ShellPanel({ service, enabled = true, onError }) {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [commandHistoryIndex, setCommandHistoryIndex] = useState(null);
  const [commandCatalog, setCommandCatalog] = useState([]);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tree, setTree] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeMetadataLoading, setTreeMetadataLoading] = useState(false);
  const [cwdWritable, setCwdWritable] = useState(false);
  const [cwdMountWritable, setCwdMountWritable] = useState(false);
  const [tabs, setTabs] = useState([{ id: "shell", type: "shell", title: "Shell" }]);
  const [activeTab, setActiveTab] = useState("shell");
  const [openFiles, setOpenFiles] = useState({});
  const [fileLoading, setFileLoading] = useState(false);
  const [replaceDialog, setReplaceDialog] = useState({ open: false, canReplace: false, activeUser: null, loading: false });
  const [confirmCommand, setConfirmCommand] = useState(null);
  const [contextMenu, setContextMenu] = useState({ mouseX: null, mouseY: null, item: null });
  const [helperRect, setHelperRect] = useState({ left: 12, top: 20 });
  const helperRef = useRef(null);
  const completionActiveRef = useRef(null);
  const [helperMode, setHelperMode] = useState("commands");
  const [editorScroll, setEditorScroll] = useState({ top: 0, left: 0 });
  const [interactiveRunning, setInteractiveRunning] = useState(false);
  const [interactiveInput, setInteractiveInput] = useState("");
  const [interactiveSecret, setInteractiveSecret] = useState(false);
  const [commandRunning, setCommandRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditSearchInput, setAuditSearchInput] = useState("");
  const AUDIT_PAGE_SIZE = 30;
  const [envOpen, setEnvOpen] = useState(false);
  const [envItems, setEnvItems] = useState([]);
  const [health, setHealth] = useState(null);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

  const shellSocketRef = useRef(null);
  // Unified "busy" flag: outer prompt must not appear while a child owns the TTY
  // or while we are waiting for a normal command response.
  const commandBusy = interactiveRunning || commandRunning;

  const terminalRef = useRef(null);
  const terminalInputRef = useRef(null);
  const xtermWriteRef = useRef(null);
  const editorInputRef = useRef(null);

  const serviceId = service?.id ?? service?.pk;
  const platform = normalizePlatform(service?.platform || service?.framework || service?.selected_platform);
  const apiRoot = `${SERVICE_ACTION_ROOT}services/${serviceId}/shell`;
  const currentCwd = session?.cwd || "/";
  const breadcrumbItems = useMemo(() => splitPath(currentCwd), [currentCwd]);
  const parentItem = useMemo(() => {
    if (!session || currentCwd === session.root_path) return null;
    const parent = currentCwd.lastIndexOf("/") <= 0 ? session.root_path : currentCwd.slice(0, currentCwd.lastIndexOf("/")) || "/";
    return { name: "..", path: parent, directory: true, parent: true, writable: false, mountWritable: true, effectiveWritable: null, mode: "rw" };
  }, [currentCwd, session]);
  const explorerEntries = useMemo(() => parentItem ? [parentItem, ...tree] : tree, [parentItem, tree]);
  const activeFile = activeTab.startsWith("file:") ? activeTab.slice(5) : null;

  const appendHistory = useCallback((entry) => {
    setHistory((prev) => [...prev, { ...entry, id: `${Date.now()}-${Math.random()}` }].slice(-HISTORY_LIMIT));
  }, []);

  const focusTerminal = useCallback(() => {
    requestAnimationFrame(() => terminalInputRef.current?.focus());
  }, []);

  const getCaretRect = useCallback(() => {
    const element = terminalInputRef.current;
    if (!element) return null;
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) return null;
    const range = selection.getRangeAt(0).cloneRange();
    range.collapse(true);
    let rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      const elementRect = element.getBoundingClientRect();
      rect = { left: elementRect.left, right: elementRect.left, top: elementRect.top, bottom: elementRect.bottom, width: 0, height: elementRect.height };
    }
    return rect;
  }, []);

  const updateHelperPosition = useCallback(() => {
    const caret = getCaretRect();
    if (!caret) return;
    const gap = 6;
    const viewportPadding = 8;
    const popup = helperRef.current;
    const popupRect = popup?.getBoundingClientRect();
    const popupWidth = popupRect?.width || Math.min(560, Math.max(260, window.innerWidth - 16));
    const popupHeight = popupRect?.height || 240;
    const canFitBelow = caret.bottom + gap + popupHeight <= window.innerHeight - viewportPadding;
    const canFitAbove = caret.top - gap - popupHeight >= viewportPadding;
    const placeAbove = !canFitBelow && canFitAbove;
    const top = placeAbove ? caret.top - gap - popupHeight : Math.min(caret.bottom + gap, window.innerHeight - popupHeight - viewportPadding);
    const left = Math.min(Math.max(viewportPadding, caret.left), Math.max(viewportPadding, window.innerWidth - popupWidth - viewportPadding));
    setHelperRect({ left, top });
  }, [getCaretRect]);

  const showHelper = useCallback((mode = "commands") => {
    setHelperMode(mode);
    setCompletionOpen(true);
    requestAnimationFrame(() => updateHelperPosition());
  }, [updateHelperPosition]);

  const formatShellError = useCallback((err) => {
    const data = err?.response?.data || {};
    const code = data.code || err?.code || "";
    const detail = data.detail || err?.message || "Command failed.";
    const labels = {
      AUTHORIZATION_FAILED: "Permission denied",
      POLICY_REJECTED: "Blocked by security policy",
      CONFIRMATION_REQUIRED: "Confirmation required",
      COMMAND_NOT_FOUND: "Command not found",
      INVALID_WORKDIR: "Invalid working directory",
      RUNTIME_ERROR: "Runtime error",
      TIMEOUT: "Command timed out",
      RESOURCE_LIMIT_EXCEEDED: "Resource limit exceeded",
      COMMAND_BUSY: "Command already running",
      PROCESS_EXITED_NONZERO: "Process exited with an error",
    };
    if (code && labels[code]) {
      return `${labels[code]}: ${detail}`;
    }
    if (code) {
      return `[${code}] ${detail}`;
    }
    return detail;
  }, []);

  const handleError = useCallback((message) => {

    appendHistory({ type: "error", text: String(message || "Unknown shell error.") });
    onError?.(message);
    focusTerminal();
  }, [appendHistory, focusTerminal, onError]);

  const refreshDirectory = useCallback(async () => {
    const token = session?.token;
    const sessionCwd = session?.cwd || "/";
    if (!token) return;
    setTreeLoading(true);
    try {
      // Fast phase: fetch names + Docker mount mode only. Never block the
      // visible tree on per-path permission probes.
      const response = await apiRequest({
        method: "POST",
        url: `${apiRoot}/tree/`,
        data: { token },
      });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Unable to read directory.");
      const resolvedCwd = data.cwd || sessionCwd;
      const fastEntries = Array.isArray(data.entries) ? data.entries.map((item) => ({
        raw: item.name,
        name: item.name,
        directory: Boolean(item.directory),
        writable: item.writable === true || item.managed_writable === true || item.mount_writable !== false,
        mode: item.mode || (item.mount_writable === false ? "ro" : "rw"),
        mountWritable: item.mount_writable !== false,
        effectiveWritable: item.effective_writable === true ? true : null,
        readOnlyReason: item.read_only_reason || (item.mount_writable === false ? "Read-only filesystem/mount" : "Checking permissions…"),
        path: item.path,
      })) : [];
      setSession((prev) => prev && prev.cwd !== resolvedCwd ? { ...prev, cwd: resolvedCwd } : prev);
      setTree(fastEntries);
      setCwdMountWritable(data.cwd_mount_writable === true);
      setCwdWritable(data.cwd_writable === true);
      setTreeLoading(false);

      // Slow phase: one batched permission probe, applied after the tree is
      // already interactive. Ignore stale responses from an older directory.
      const paths = fastEntries.map((item) => item.path).filter(Boolean);
      if (!data.metadata_pending || !paths.length) return;
      setTreeMetadataLoading(true);
      window.setTimeout(async () => {
        try {
          const metaResponse = await apiRequest({
            method: "POST",
            url: `${apiRoot}/tree/meta/`,
            data: { token, paths },
          });
          const meta = metaResponse?.data || {};
          if (meta.result !== "success") return;
          setTree((prev) => {
            const map = new Map((meta.entries || []).map((item) => [item.path, item]));
            return prev.map((item) => {
              const update = map.get(item.path);
              if (!update) return item;
              const effective = update.effective_writable === true;
              const managed = update.managed_writable === true || update.mount_writable === true;
              return { ...item, writable: managed, effectiveWritable: effective, managedWritable: managed, readOnlyReason: managed ? "" : (update.read_only_reason || "Read-only Docker mount") };
            });
          });
          setCwdWritable(meta.cwd_writable === true);
        } catch {
          // The fast tree is already usable; metadata is an enhancement only.
        } finally {
          setTreeMetadataLoading(false);
        }
      }, 0);
    } catch (err) {
      setTreeLoading(false);
      handleError(err?.response?.data?.detail || err?.message || "Unable to read directory.");
    }
  }, [apiRoot, handleError, session?.token]);

  const loadCommandCatalog = useCallback(async () => {
    if (!session?.token) return;
    try {
      const response = await apiRequest({ method: "GET", url: `${apiRoot}/catalog/` });
      const data = response?.data || {};
      if (data.result === "success") setCommandCatalog(Array.isArray(data.commands) ? data.commands : []);
    } catch {
      // Backend remains authoritative; catalog is only a UX helper.
    }
  }, [apiRoot, session?.token]);

  useEffect(() => {
    if (!session?.token) return;
    refreshDirectory();
    loadCommandCatalog();
  }, [loadCommandCatalog, refreshDirectory, session?.token]);

  useEffect(() => {
    const shellToken = session?.token;
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access") : null;
    if (!shellToken || !accessToken || !serviceId) return undefined;

    const base = typeof window !== "undefined" ? window.location : null;
    if (!base) return undefined;
    const configuredApi = String(import.meta.env.VITE_API_BASE || "").trim();
    let backendUrl;
    try {
      const candidate = configuredApi
        ? (configuredApi.startsWith("http://") || configuredApi.startsWith("https://") ? configuredApi : `https://${configuredApi}`)
        : base.origin;
      backendUrl = new URL(candidate, base.origin);
    } catch {
      backendUrl = base;
    }
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${backendUrl.host}/ws/services/shell/${serviceId}/?token=${encodeURIComponent(accessToken)}&shell_token=${encodeURIComponent(shellToken)}`;
    const socket = new WebSocket(socketUrl);
    shellSocketRef.current = socket;

    socket.onopen = () => appendHistory({ type: "system", text: "Interactive PTY connected." });
    socket.onmessage = (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === "ready") {
        setSession((prev) => prev ? { ...prev, cwd: message.cwd || prev.cwd, platform: message.platform || prev.platform } : prev);
        return;
      }
      if (message.type === "process.started") {
        setInteractiveRunning(true);
        setCommandRunning(false);
        setInteractiveInput("");
        setInteractiveSecret(false);
        setCompletionOpen(false);
        return;
      }
      if (message.type === "process.output") {
        const raw = String(message.data ?? "");
        // Prefer real terminal when interactive PTY is active (colors, cursor, tables).
        if (xtermWriteRef.current) {
          xtermWriteRef.current(raw);
        } else {
          const cleaned = cleanOutput(raw);
          if (cleaned) appendHistory({ type: "output", stdout: cleaned, stderr: "", exitCode: null });
        }
        if (/password\s*:/i.test(raw)) setInteractiveSecret(true);
        return;
      }
      if (message.type === "process.exit") {
        setInteractiveRunning(false);
        setCommandRunning(false);
        setInteractiveInput("");
        setInteractiveSecret(false);
        // Keep exitCode only — terminalLines renders the message once from exitCode.
        appendHistory({ type: "output", stdout: "", stderr: "", exitCode: message.exit_code ?? 0 });
        focusTerminal();
        return;
      }
      if (message.type === "confirm_required") {
        setConfirmCommand(message.command || null);
        return;
      }
      if (message.type === "error") {
        const code = message.code || "";
        const labels = {
          AUTHORIZATION_FAILED: "Permission denied",
          POLICY_REJECTED: "Blocked by security policy",
          CONFIRMATION_REQUIRED: "Confirmation required",
          COMMAND_BUSY: "Command already running",
          RUNTIME_ERROR: "Runtime error",
        };
        const prefix = code && labels[code] ? `${labels[code]}: ` : code ? `[${code}] ` : "";
        appendHistory({ type: "error", text: `${prefix}${message.message || "Interactive shell error."}` });
        setCommandRunning(false);
        setInteractiveRunning(false);
      }
    };
    socket.onerror = () => { /* Basic command API remains available when PTY is unavailable. */ };
    socket.onclose = () => {
      shellSocketRef.current = null;
      setInteractiveRunning(false);
      setInteractiveInput("");
      setInteractiveSecret(false);
    };
    return () => {
      try { socket.close(); } catch { /* noop */ }
      if (shellSocketRef.current === socket) shellSocketRef.current = null;
    };
  }, [appendHistory, focusTerminal, serviceId, session?.token]);

  const createSession = useCallback(async () => {
    if (!serviceId || !enabled || sessionLoading || session) return;
    setSessionLoading(true);
    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/session/`, data: {} });
      const data = response?.data || {};
      if (data.result !== "success" || !data.token) throw new Error(data.detail || "Unable to create shell session.");
      setSession(data);
      setHistory([]);
      setCommandHistory([]);
      setCommandHistoryIndex(null);
      setCommand("");
      appendHistory({ type: "system", text: `Connected · ${service?.name || "service"} · ${data.platform || platform}` });
      focusTerminal();
    } catch (err) {
      const status = err?.response?.status;
      const payload = err?.response?.data || {};
      const detail = String(payload?.detail || err?.message || "");
      const isActiveConflict =
        status === 409 && (
          payload.code === "SHELL_SESSION_ACTIVE"
          || /active shell session/i.test(detail)
          || /already has .+ session/i.test(detail)
        );
      if (isActiveConflict) {
        setReplaceDialog({
          open: true,
          canReplace: payload.can_replace !== false,
          activeUser: payload.active_session || null,
          loading: false,
        });
      } else {
        handleError(detail || "Unable to create shell session.");
      }
    } finally {
      setSessionLoading(false);
    }
  }, [apiRoot, appendHistory, enabled, focusTerminal, handleError, platform, service?.name, serviceId, session, sessionLoading]);

  const replaceActiveSession = useCallback(async () => {
    if (!replaceDialog.canReplace || replaceDialog.loading) return;
    setReplaceDialog((prev) => ({ ...prev, loading: true }));
    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/session/replace/`, data: { confirm: true } });
      const data = response?.data || {};
      if (data.result !== "success" || !data.token) throw new Error(data.detail || "Unable to replace active shell session.");
      setSession(data);
      setHistory([]);
      setCommand("");
      setCommandHistoryIndex(null);
      setReplaceDialog({ open: false, canReplace: false, activeUser: null, loading: false });
      appendHistory({ type: "system", text: `Connected · previous shell session terminated.` });
      focusTerminal();
    } catch (err) {
      setReplaceDialog((prev) => ({ ...prev, loading: false }));
      handleError(err?.response?.data?.detail || err?.message || "Unable to replace active shell session.");
    }
  }, [apiRoot, appendHistory, focusTerminal, handleError, replaceDialog.canReplace, replaceDialog.loading]);

  const closeSession = useCallback(async () => {
    const token = session?.token;
    if (!token) return;
    try {
      await apiRequest({ method: "POST", url: `${apiRoot}/close/`, data: { token } });
    } catch {
      // Session state is cleared client-side even when the close request races an expiry.
    }
    setSession(null);
    setCommand("");
    setCompletionOpen(false);
    setHistory((prev) => [...prev, { id: `${Date.now()}-close`, type: "system", text: "Shell disconnected." }].slice(-HISTORY_LIMIT));
  }, [apiRoot, session?.token]);

  const contextualCommands = useMemo(() => {
    const common = [
      { command: "pwd", display: "pwd", label: "command" },
      { command: "ls", display: "ls", label: "command" },
      { command: "ls -la", display: "ls -la", label: "command" },
      { command: "whoami", display: "whoami", label: "command" },
      { command: "php -v", display: "php -v", label: "PHP" },
      { command: "php --ini", display: "php --ini", label: "PHP" },
      { command: "php artisan", display: "php artisan", label: "Laravel" },
    ];
    const php = [
      { command: "php artisan", display: "php artisan", label: "Laravel" },
      { command: "php -v", display: "php -v", label: "PHP" },
      { command: "php --ini", display: "php --ini", label: "PHP" },
      { command: "php -m", display: "php -m", label: "PHP" },
      { command: "php -i", display: "php -i", label: "PHP" },
    ];
    const artisanNames = [
      "about", "list", "help", "route:list", "migrate:status", "route:clear", "view:clear",
      "config:clear", "cache:clear", "optimize", "optimize:clear", "schedule:list", "storage:link",
    ];
    const artisan = artisanNames.map((name) => ({ command: `php artisan ${name}`, display: `php artisan ${name}`, label: "Artisan" }));
    const node = [
      { command: "npm -v", display: "npm -v", label: "Node" },
      { command: "node -v", display: "node -v", label: "Node" },
    ];
    const python = [
      { command: "python --version", display: "python --version", label: "Python" },
      { command: "python manage.py check", display: "python manage.py check", label: "Django" },
      { command: "python manage.py migrate", display: "python manage.py migrate", label: "Django" },
      { command: "python manage.py showmigrations", display: "python manage.py showmigrations", label: "Django" },
    ];
    if (platform === "laravel") return [...common, ...php, ...artisan, ...node];
    if (platform === "php") return [...common, ...php];
    if (platform === "django" || platform === "python") return [...common, ...python];
    if (platform === "node") return [...common, ...node];
    return common;
  }, [platform]);

  const commandContext = useMemo(() => {
    const value = String(command || "");
    const trimmed = value.trimStart();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const lastToken = value.match(/(?:^|\s)([^\s]*)$/)?.[1] || "";
    const commandWord = (parts[0] || "").toLowerCase();
    const secondWord = (parts[1] || "").toLowerCase();
    const base = {
      value,
      trimmed,
      parts,
      commandWord,
      secondWord,
      token: lastToken,
      hasTrailingSpace: /\s$/.test(value),
    };
    return base;
  }, [command]);

  const completionSuggestions = useMemo(() => {
    const { trimmed, token, hasTrailingSpace, commandWord } = commandContext;
    if (helperMode === "paths") {
      if (commandWord === "cd") {
        const prefix = hasTrailingSpace ? "" : token.toLowerCase();
        return tree
          .filter((item) => item.directory && item.name.toLowerCase().startsWith(prefix))
          .map((item) => ({ command: item.name, display: `${item.name}/`, label: "directory", description: `cd into ${item.name}` }));
      }
      if (["nano", "vi", "vim"].includes(commandWord)) {
        const prefix = hasTrailingSpace ? "" : token.toLowerCase();
        return tree
          .filter((item) => !item.directory && item.name.toLowerCase().startsWith(prefix))
          .map((item) => ({ command: item.name, display: item.name, label: "file", description: "open in editor" }));
      }
    }

    const source = [
      ...commandCatalog.map((item) => ({
        command: String(item.command || ""),
        display: item.display || item.command,
        label: item.label || "command",
        dangerous: item.dangerous,
        interactive: item.interactive,
      })),
      ...contextualCommands,
    ].filter((item, index, arr) => item.command && arr.findIndex((other) => other.command === item.command) === index);

    if (!trimmed) return source.slice(0, 40);

    // Completion always filters against the full command prefix before the
    // current token. This makes `php `, `php artisan ` and `python manage.py `
    // behave consistently instead of duplicating the already typed command.
    const fullPrefix = commandContext.value.slice(0, commandContext.value.length).toLowerCase();
    const tokenPrefix = token.toLowerCase();
    const sourceForContext = hasTrailingSpace
      ? source.filter((item) => item.command.toLowerCase().startsWith(fullPrefix))
      : source.filter((item) => item.command.toLowerCase().startsWith(commandContext.value.slice(0, commandContext.value.length - token.length).toLowerCase() + tokenPrefix));
    return sourceForContext.slice(0, 32);
  }, [commandCatalog, commandContext, contextualCommands, helperMode, tree]);

  useEffect(() => {
    if (!completionOpen) return;
    const reposition = () => requestAnimationFrame(updateHelperPosition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const timer = window.setTimeout(updateHelperPosition, 0);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.clearTimeout(timer);
    };
  }, [completionOpen, completionSuggestions.length, updateHelperPosition]);

  useEffect(() => {
    if (!completionOpen || !completionSuggestions.length) return;
    requestAnimationFrame(() => {
      const popup = helperRef.current;
      const active = completionActiveRef.current;
      if (!popup || !active) return;
      const top = active.offsetTop;
      const bottom = top + active.offsetHeight;
      const viewTop = popup.scrollTop + 34;
      const viewBottom = popup.scrollTop + popup.clientHeight - 6;
      if (top < viewTop) popup.scrollTop = Math.max(0, top - 34);
      else if (bottom > viewBottom) popup.scrollTop = bottom - popup.clientHeight + 6;
    });
  }, [completionOpen, completionIndex, completionSuggestions.length]);

  const setCaretOffset = useCallback((element, offset) => {
    const node = element?.firstChild;
    if (!element || !node) return;
    const range = document.createRange();
    range.setStart(node, Math.min(offset, node.textContent.length));
    range.collapse(true);
    const selection = window.getSelection?.();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const applyCompletion = useCallback((index = completionIndex) => {
    if (!completionSuggestions.length || !terminalInputRef.current) return "";
    const selected = completionSuggestions[Math.max(0, Math.min(index, completionSuggestions.length - 1))];
    const element = terminalInputRef.current;
    const current = element.textContent || "";
    const selection = window.getSelection?.();
    let caret = current.length;
    if (selection && selection.rangeCount > 0 && element.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(element);
      pre.setEnd(range.endContainer, range.endOffset);
      caret = pre.toString().length;
    }
    const before = current.slice(0, caret);
    const after = current.slice(caret);
    const match = before.match(/(?:^|\s)([^\s]*)$/);
    const start = match ? before.length - match[1].length : 0;
    // Replace only the current token, keeping the already typed command prefix.
    // `php ` -> `php artisan`, `python m` -> `python manage.py check`, etc.
    const tokenStart = start;
    const prefixBeforeToken = before.slice(0, tokenStart);
    const candidate = String(selected.command || "");
    const lowerPrefix = prefixBeforeToken.toLowerCase();
    const lowerCandidate = candidate.toLowerCase();
    let replacement = candidate;
    if (lowerCandidate.startsWith(lowerPrefix)) {
      replacement = candidate.slice(prefixBeforeToken.length);
    } else if (selected.label === "directory") {
      replacement = candidate;
    }
    if (selected.label === "directory" && !replacement.endsWith("/")) replacement += "/";
    const nextBefore = `${before.slice(0, start)}${replacement}`;
    const next = `${nextBefore}${after}`;
    element.textContent = next;
    setCommand(next);
    setCaretOffset(element, nextBefore.length);
    requestAnimationFrame(() => updateHelperPosition());
    return next;
  }, [completionIndex, completionSuggestions, setCaretOffset, updateHelperPosition]);

  const isInteractiveCommand = useCallback((cmd) => {
    const normalized = String(cmd || "").trim().toLowerCase();
    return commandCatalog.some((item) => item.interactive && String(item.command || "").trim().toLowerCase() === normalized);
  }, [commandCatalog]);

  const sendInteractiveInput = useCallback((data) => {
    const socket = shellSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      handleError("Interactive shell is not connected.");
      return false;
    }
    // TTY processes (tinker/psysh) echo input themselves; do not local-echo
    // or the terminal will show every line twice.
    socket.send(JSON.stringify({ type: "stdin", data }));
    return true;
  }, [handleError]);

  const handleXtermData = useCallback((data) => {
    sendInteractiveInput(data);
  }, [sendInteractiveInput]);

  const handleXtermResize = useCallback((cols, rows) => {
    const socket = shellSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify({ type: "resize", cols, rows }));
    } catch { /* noop */ }
  }, []);

  const parseSingleEditorArgument = useCallback((raw) => {
    const value = String(raw || "").trim();
    if (!value) return null;
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      const quote = value[0];
      let inner = value.slice(1, -1);
      if (quote === "'") inner = inner.replace(/'\\''/g, "'");
      else inner = inner.replace(/\\([\\"$`])/g, "$1");
      return inner;
    }
    if (/\s/.test(value)) return null;
    return value;
  }, []);

  const runCommand = useCallback(async (value, options = {}) => {
    const cmd = String(value ?? command).trim();
    if (!session?.token || runningRef.current || !cmd) return;
    if (cmd === "clear") {
      setHistory([]);
      setCommand("");
      setCommandHistoryIndex(null);
      setCompletionOpen(false);
      if (terminalInputRef.current) terminalInputRef.current.textContent = "";
      focusTerminal();
      return;
    }

    const editorCommand = cmd.match(/^(?:nano|vi|vim)\s+(.+)$/i);
    if (editorCommand) {
      appendHistory({ type: "command", text: cmd, cwd: currentCwd });
      try {
        const editorArg = parseSingleEditorArgument(editorCommand[1]);
        if (!editorArg || /^(?:-|--)/.test(editorArg)) throw new Error("Use a single file path with the built-in editor.");
        const path = editorArg.startsWith("/") ? editorArg : joinPath(currentCwd, editorArg);
        await (async () => {
          const response = await apiRequest({ method: "POST", url: `${apiRoot}/file/`, data: { token: session.token, action: "read", path } });
          const data = response?.data || {};
          if (data.result !== "success") throw new Error(data.detail || "Unable to read file.");
          setActiveTab(`file:${path}`);
          setTabs((prev) => prev.some((tab) => tab.id === `file:${path}`) ? prev : [...prev, { id: `file:${path}`, type: "file", title: path.split("/").pop() || path, path }]);
          setOpenFiles((prev) => ({ ...prev, [path]: { content: String(data.content || ""), dirty: false, writable: data.writable !== false, readOnlyReason: data.read_only_reason || "This file is read-only." } }));
        })();
      } catch (err) {
        handleError(err?.response?.data?.detail || err?.message || "Unable to open file.");
        if (terminalInputRef.current) terminalInputRef.current.textContent = "";
        setCommand("");
        setCompletionOpen(false);
        focusTerminal();
        return false;
      }
      if (terminalInputRef.current) terminalInputRef.current.textContent = "";
      setCommand("");
      setCompletionOpen(false);
      focusTerminal();
      appendHistory({ type: "system", text: `Opened ${path}`, cwd: currentCwd });
      return true;
    }

    if (isInteractiveCommand(cmd)) {
      const socket = shellSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        handleError("Interactive shell connection is not ready. Reconnect the shell session and try again.");
        return false;
      }
      setHistory((prev) => [...prev, { id: `${Date.now()}-cmd`, type: "command", text: cmd, cwd: currentCwd }].slice(-HISTORY_LIMIT));
      setCommandHistory((prev) => [cmd, ...prev.filter((item) => item !== cmd)].slice(0, COMMAND_HISTORY_LIMIT));
      setCommandHistoryIndex(null);
      setCommand("");
      setCompletionOpen(false);
      if (terminalInputRef.current) terminalInputRef.current.textContent = "";
      // Hide outer prompt immediately; process.started will take over with interactiveRunning.
      setCommandRunning(true);
      socket.send(JSON.stringify({ type: "command", command: cmd }));
      focusTerminal();
      return true;
    }

    runningRef.current = true;
    setCommandRunning(true);
    setHistory((prev) => [...prev, { id: `${Date.now()}-cmd`, type: "command", text: cmd, cwd: currentCwd }].slice(-HISTORY_LIMIT));
    setCommandHistory((prev) => [cmd, ...prev.filter((item) => item !== cmd)].slice(0, COMMAND_HISTORY_LIMIT));
    setCommandHistoryIndex(null);
    setCommand("");
    setCompletionOpen(false);
    if (terminalInputRef.current) terminalInputRef.current.textContent = "";

    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/command/`, data: { token: session.token, command: cmd, confirm: Boolean(options.confirm), dry_run: Boolean(options.dryRun ?? dryRun) } });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Command failed.");

      if (data.action === "open_file" && data.path) {
        const path = data.path;
        setActiveTab(`file:${path}`);
        setTabs((prev) => prev.some((tab) => tab.id === `file:${path}`) ? prev : [...prev, { id: `file:${path}`, type: "file", title: path.split("/").pop() || path, path }]);
        setOpenFiles((prev) => ({ ...prev, [path]: { content: String(data.content || ""), dirty: false, writable: data.writable !== false, readOnlyReason: data.read_only_reason || "This file is read-only in the running container." } }));
        setHistory((prev) => [...prev, { id: `${Date.now()}-open`, type: "system", text: `${data.writable === false ? "Opened read-only" : "Opened"} ${path}` }].slice(-HISTORY_LIMIT));
        return;
      }

      const nextCwd = data.cwd || currentCwd;
      setSession((prev) => (prev ? { ...prev, cwd: nextCwd } : prev));
      if (data.dry_run) {
        const planText = Array.isArray(data.plan)
          ? data.plan.map((p, i) => `${i + 1}. ${(p.argv || []).join(" ")}${p.destructive ? "  [destructive]" : ""}`).join("\n")
          : "dry-run";
        setHistory((prev) => [...prev, { id: `${Date.now()}-dry`, type: "system", text: `Dry-run plan:\n${planText}` }].slice(-HISTORY_LIMIT));
      } else {
        setHistory((prev) => [...prev, { id: `${Date.now()}-out`, type: "output", exitCode: data.exit_code ?? 0, stdout: cleanOutput(data.stdout), stderr: cleanOutput(data.stderr) }].slice(-HISTORY_LIMIT));
      }
      if (cmd === "pwd" || cmd.startsWith("cd ") || cmd === "cd" || cmd === "ls" || cmd.startsWith("ls ")) await refreshDirectory();
      else if (cmd.startsWith("rm ") || cmd.startsWith("rmdir ") || cmd.startsWith("mv ") || cmd.startsWith("cp ") || cmd.startsWith("mkdir ") || cmd.startsWith("touch ")) await refreshDirectory();
      return true;
    } catch (err) {
      const data = err?.response?.data || {};
      // Destructive commands return 409 CONFIRMATION_REQUIRED — open confirm dialog.
      if (data.code === "CONFIRMATION_REQUIRED" || (err?.response?.status === 409 && /confirm/i.test(String(data.detail || "")))) {
        setConfirmCommand(cmd);
        setHistory((prev) => [...prev, { id: `${Date.now()}-confirm`, type: "system", text: data.detail || "Confirmation required before running this destructive command." }].slice(-HISTORY_LIMIT));
        return false;
      }
      setHistory((prev) => [...prev, { id: `${Date.now()}-err`, type: "error", text: formatShellError(err) }].slice(-HISTORY_LIMIT));
      return false;
    } finally {
      runningRef.current = false;
      setCommandRunning(false);
      focusTerminal();
    }
  }, [apiRoot, command, currentCwd, dryRun, focusTerminal, formatShellError, handleError, isInteractiveCommand, parseSingleEditorArgument, refreshDirectory, session?.token]);

  const runningRef = useRef(false);

  const openFileTab = useCallback(async (path) => {
    if (!session?.token || !path) return;
    setActiveTab(`file:${path}`);
    setTabs((prev) => prev.some((tab) => tab.id === `file:${path}`) ? prev : [...prev, { id: `file:${path}`, type: "file", title: path.split("/").pop() || path, path }]);
    if (openFiles[path]) return;
    setFileLoading(true);
    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/file/`, data: { token: session.token, action: "read", path } });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Unable to read file.");
      setOpenFiles((prev) => ({ ...prev, [path]: { content: String(data.content || ""), dirty: false, writable: data.writable !== false, readOnlyReason: data.read_only_reason || "This file is read-only in the running container." } }));
    } catch (err) {
      setTabs((prev) => prev.filter((tab) => tab.id !== `file:${path}`));
      setActiveTab("shell");
      handleError(err?.response?.data?.detail || err?.message || "Unable to read file.");
    } finally {
      setFileLoading(false);
    }
  }, [apiRoot, handleError, openFiles, session?.token]);

  const closeTab = useCallback((tabId) => {
    if (tabId === "shell") return;
    const index = tabs.findIndex((tab) => tab.id === tabId);
    const tab = tabs[index];
    if (!tab) return;
    const nextTabs = tabs.filter((item) => item.id !== tabId);
    setTabs(nextTabs);
    if (tab.path) {
      setOpenFiles((prev) => {
        const next = { ...prev };
        delete next[tab.path];
        return next;
      });
    }
    if (activeTab === tabId) setActiveTab(nextTabs[Math.max(0, index - 1)]?.id || "shell");
  }, [activeTab, tabs]);

  const openTreeItem = useCallback((item) => {
    if (!session || !item) return;
    if (item.parent) {
      runCommand("cd ..");
      return;
    }
    if (item.directory) {
      const target = item.path || joinPath(currentCwd, item.name);
      const escaped = target.replace(/"/g, '\\"');
      runCommand(`cd "${escaped}"`);
    } else {
      openFileTab(item.path || joinPath(currentCwd, item.name));
    }
  }, [currentCwd, openFileTab, runCommand, session]);

  const updateFileContent = useCallback((path, content) => {
    setOpenFiles((prev) => ({ ...prev, [path]: { ...(prev[path] || {}), content, dirty: true } }));
  }, []);

  const writeOpenFile = useCallback(async (path) => {
    const file = openFiles[path];
    if (!file || !session?.token) return;
    if (file.writable === false) {
      handleError(file.readOnlyReason || "This file is read-only in the running container.");
      return;
    }
    setFileLoading(true);
    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/file/`, data: { token: session.token, action: "write", path, content: file.content } });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Unable to save file.");
      setOpenFiles((prev) => ({ ...prev, [path]: { ...prev[path], dirty: false, writable: data.writable !== false } }));
    } catch (err) {
      const message = err?.response?.data?.detail || err?.message || "Unable to save file.";
      if (/read-only docker mount|read-only filesystem|mounted read-only/i.test(String(message))) {
        setOpenFiles((prev) => ({ ...prev, [path]: { ...(prev[path] || {}), writable: false, readOnlyReason: message } }));
      }
      handleError(message);
    } finally {
      setFileLoading(false);
    }
  }, [apiRoot, handleError, openFiles, session?.token]);

  const quoteShellArg = useCallback((value) => {
    return `'${String(value ?? "").replace(/'/g, "'\\''")}'`;
  }, []);

  const createNewFile = useCallback(async () => {
    if (!session?.token || !cwdMountWritable) return;
    const name = window.prompt("File name (inside current directory):", "new-file.txt");
    if (!name || /(^\s*$|[\\/\\0])/.test(name) || name === "." || name === "..") return;
    const path = joinPath(currentCwd, name.trim());
    try {
      appendHistory({ type: "command", text: `touch -- ${quoteShellArg(path)}`, cwd: currentCwd });
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/file/`, data: { token: session.token, action: "create", path } });
      const data=response?.data||{};
      if(data.result!=="success") throw new Error(data.detail||"Unable to create file.");
      await openFileTab(path);
      await refreshDirectory();
    } catch(err){ handleError(err?.response?.data?.detail||err?.message||"Unable to create file."); }
  }, [apiRoot, appendHistory, currentCwd, cwdMountWritable, handleError, openFileTab, quoteShellArg, refreshDirectory, session?.token]);

  const createNewFolder = useCallback(async () => {
    if (!session?.token || !cwdMountWritable) return;
    const name = window.prompt("Folder name (inside current directory):", "new-folder");
    if (!name || /(^\s*$|[\\/\0])/.test(name) || name.trim() === "." || name.trim() === "..") return;
    const path = joinPath(currentCwd, name.trim());
    try {
      appendHistory({ type: "command", text: `mkdir -- ${quoteShellArg(path)}`, cwd: currentCwd });
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/file/`, data: { token: session.token, action: "create_folder", path } });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Unable to create folder.");
      await refreshDirectory();
    } catch (err) { handleError(err?.response?.data?.detail || err?.message || "Unable to create folder."); }
  }, [apiRoot, appendHistory, currentCwd, cwdMountWritable, handleError, quoteShellArg, refreshDirectory, session?.token]);

  const deleteActiveFile = useCallback(async () => {
    if (!activeFile || !session?.token) return;
    if (!window.confirm(`Delete ${activeFile}? This cannot be undone.`)) return;
    try {
      const response=await apiRequest({method:"POST",url:`${apiRoot}/file/`,data:{token:session.token,action:"delete",path:activeFile}});
      const data=response?.data||{};
      if(data.result!=="success") throw new Error(data.detail||"Unable to delete file.");
      const tabId=`file:${activeFile}`;
      setTabs(prev=>prev.filter(tab=>tab.id!==tabId));
      setOpenFiles(prev=>{const next={...prev}; delete next[activeFile]; return next;});
      setActiveTab("shell");
      await refreshDirectory();
    } catch(err){ handleError(err?.response?.data?.detail||err?.message||"Unable to delete file."); }
  }, [activeFile, apiRoot, handleError, openFiles, refreshDirectory, session?.token]);

  const closeContextMenu = useCallback(() => setContextMenu({ mouseX: null, mouseY: null, item: null }), []);

  const handleTreeContextMenu = useCallback((event, item) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ mouseX: event.clientX - 2, mouseY: event.clientY - 4, item });
  }, []);

  const contextEdit = useCallback(async () => {
    const item = contextMenu.item;
    closeContextMenu();
    if (!item || item.directory) return;
    const path = item.path || joinPath(currentCwd, item.name);
    await runCommand(`nano ${quoteShellArg(path)}`);
  }, [closeContextMenu, contextMenu.item, currentCwd, quoteShellArg, runCommand]);

  const contextRename = useCallback(async () => {
    const item = contextMenu.item;
    closeContextMenu();
    if (!item || !session?.token) return;
    const oldPath = item.path || joinPath(currentCwd, item.name);
    const nextName = window.prompt("New name:", item.name);
    if (!nextName || nextName.trim() === item.name) return;
    const safeName = nextName.trim();
    if (!/^[^\\/\x00]+$/.test(safeName) || safeName === "." || safeName === "..") { handleError("Invalid file or directory name."); return; }
    const newPath = joinPath(currentCwd, safeName);
    const cmd = `mv -- ${quoteShellArg(oldPath)} ${quoteShellArg(newPath)}`;
    const ok = await runCommand(cmd, { confirm: true });
    if (!ok) return;
    if (openFiles[oldPath]) {
      setOpenFiles((prev) => { const next = { ...prev }; next[newPath] = next[oldPath]; delete next[oldPath]; return next; });
      setTabs((prev) => prev.map((tab) => tab.path === oldPath ? { ...tab, id: `file:${newPath}`, path: newPath, title: safeName } : tab));
      if (activeTab === `file:${oldPath}`) setActiveTab(`file:${newPath}`);
    }
  }, [activeTab, closeContextMenu, contextMenu.item, currentCwd, handleError, openFiles, quoteShellArg, runCommand, session?.token]);

  const contextDelete = useCallback(async () => {
    const item = contextMenu.item;
    closeContextMenu();
    if (!item || !session?.token) return;
    const path = item.path || joinPath(currentCwd, item.name);
    const verb = item.directory ? "rmdir" : "rm";
    if (!window.confirm(`${item.directory ? "Remove empty directory" : "Delete file"} ${path}?`)) return;
    const ok = await runCommand(`${verb} -- ${quoteShellArg(path)}`, { confirm: true });
    if (!ok) return;
    const fileTab = `file:${path}`;
    setTabs((prev) => prev.filter((tab) => tab.id !== fileTab));
    setOpenFiles((prev) => { const next = { ...prev }; delete next[path]; return next; });
    if (activeTab === fileTab) setActiveTab("shell");
  }, [activeTab, closeContextMenu, contextMenu.item, currentCwd, quoteShellArg, runCommand, session?.token]);

  const contextNewFile = useCallback(async () => {
    const item = contextMenu.item;
    closeContextMenu();
    if (!item?.directory || !session?.token) return;
    const targetCwd = item.path || joinPath(currentCwd, item.name);
    const name = window.prompt("File name:", "new-file.txt");
    if (!name) return;
    const safeName = name.trim();
    if (!/^[^\\/\x00]+$/.test(safeName) || safeName === "." || safeName === "..") { handleError("Invalid file name."); return; }
    const path = joinPath(targetCwd, safeName);
    await runCommand(`touch -- ${quoteShellArg(path)}`);
    await refreshDirectory();
  }, [closeContextMenu, contextMenu.item, currentCwd, handleError, quoteShellArg, refreshDirectory, runCommand, session?.token]);

  const activeContent = activeFile ? (openFiles[activeFile]?.content || "") : "";
  const activeContentDeferred = useDeferredValue(activeContent);
  const activeLanguage = activeFile ? detectLanguage(activeFile) : "";
  const highlightedEditorHtml = useMemo(() => highlightSource(activeContentDeferred, activeLanguage) || " ", [activeContentDeferred, activeLanguage]);
  const copyFile = useCallback(async () => {
    if (!activeContent) return;
    try { await navigator.clipboard?.writeText(activeContent); } catch { /* ignore */ }
  }, [activeContent]);

  const terminalLines = useMemo(() => history.flatMap((entry) => {
    if (entry.type === "command") return [{ key: `${entry.id}-command`, type: "command", cwd: entry.cwd || currentCwd, text: entry.text }];
    if (entry.type === "output") {
      const rows = [];
      cleanOutput(entry.stdout).split("\n").forEach((text, i) => { if (text !== "" || i === 0) rows.push({ key: `${entry.id}-out-${i}`, type: "stdout", text }); });
      cleanOutput(entry.stderr).split("\n").forEach((text, i) => { if (text !== "" || i === 0) rows.push({ key: `${entry.id}-err-${i}`, type: "stderr", text }); });
      if (entry.exitCode && entry.exitCode !== 0) rows.push({ key: `${entry.id}-exit`, type: "stderr", text: `Process exited with code ${entry.exitCode}` });
      return rows;
    }
    return [{ key: entry.id, type: entry.type, text: entry.text }];
  }), [history, currentCwd]);


  const loadAudit = useCallback(async (page = 1, action = auditFilter, q = auditSearch) => {
    if (!serviceId) return;
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(Math.max(1, page)),
        page_size: String(AUDIT_PAGE_SIZE),
      });
      if (action) params.set("action", action);
      if (q) params.set("q", q);
      const response = await apiRequest({ method: "GET", url: `${apiRoot}/audit/?${params.toString()}` });
      const data = response?.data || {};
      setAuditEvents(Array.isArray(data.events) ? data.events : []);
      setAuditPage(Number(data.page) || page);
      setAuditTotalPages(Number(data.total_pages) || 1);
      setAuditTotal(Number(data.total) || 0);
    } catch (err) {
      handleError(err?.response?.data?.detail || err?.message || "Failed to load audit log.");
    } finally {
      setAuditLoading(false);
    }
  }, [apiRoot, auditFilter, auditSearch, handleError, serviceId]);

  const downloadAudit = useCallback(async (fmt = "csv") => {
    if (!serviceId) return;
    try {
      const params = new URLSearchParams({ format: fmt });
      if (auditFilter) params.set("action", auditFilter);
      if (auditSearch) params.set("q", auditSearch);
      const response = await apiRequest({
        method: "GET",
        url: `${apiRoot}/audit/export/?${params.toString()}`,
        responseType: "blob",
      });
      const blob = response?.data instanceof Blob
        ? response.data
        : new Blob([typeof response?.data === "string" ? response.data : JSON.stringify(response?.data ?? {})], {
            type: fmt === "json" ? "application/json" : "text/csv",
          });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `shell-audit.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleError(err?.response?.data?.detail || err?.message || "Failed to download audit log.");
    }
  }, [apiRoot, auditFilter, auditSearch, handleError, serviceId]);

  const loadEnv = useCallback(async () => {
    if (!serviceId) return;
    try {
      const response = await apiRequest({ method: "GET", url: `${apiRoot}/env/` });
      const data = response?.data || {};
      setEnvItems(Array.isArray(data.env) ? data.env : []);
      setEnvOpen(true);
    } catch (err) {
      handleError(err?.response?.data?.detail || err?.message || "Failed to load environment.");
    }
  }, [apiRoot, handleError, serviceId]);

  const loadHealth = useCallback(async () => {
    if (!serviceId) return;
    try {
      const response = await apiRequest({ method: "GET", url: `${apiRoot}/health/` });
      setHealth(response?.data || null);
    } catch {
      setHealth(null);
    }
  }, [apiRoot, serviceId]);

  const loadServerHistory = useCallback(async () => {
    if (!serviceId || !session?.token) return;
    try {
      const response = await apiRequest({ method: "GET", url: `${apiRoot}/history/?limit=40` });
      const commands = response?.data?.commands;
      if (Array.isArray(commands) && commands.length) {
        setCommandHistory((prev) => {
          const merged = [...commands.map((c) => c.command), ...prev];
          const seen = new Set();
          return merged.filter((c) => {
            if (!c || seen.has(c)) return false;
            seen.add(c);
            return true;
          }).slice(0, COMMAND_HISTORY_LIMIT);
        });
      }
    } catch { /* optional */ }
  }, [apiRoot, serviceId, session?.token]);


  
  useEffect(() => {
    const el = terminalRef.current;
    if (!el || !session) return undefined;
    const notify = () => {
      const socket = shellSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cols = Math.max(40, Math.floor((el.clientWidth || 800) / 8));
      const rows = Math.max(10, Math.floor((el.clientHeight || 400) / 18));
      try { socket.send(JSON.stringify({ type: "resize", cols, rows })); } catch { /* noop */ }
    };
    const ro = new ResizeObserver(() => notify());
    ro.observe(el);
    notify();
    return () => ro.disconnect();
  }, [session]);

  useEffect(() => {
    if (session) {
      loadHealth();
      loadServerHistory();
    }
  }, [session, loadHealth, loadServerHistory]);


  useEffect(() => {
    if (!auditOpen) return undefined;
    const t = setTimeout(() => {
      const next = String(auditSearchInput || "").trim();
      setAuditSearch(next);
      setAuditPage(1);
      loadAudit(1, auditFilter, next);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditSearchInput, auditOpen]);

  if (!enabled) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 1.25 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <TerminalRoundedIcon color="disabled" />
          <Box><Typography fontWeight={800}>Shell unavailable</Typography><Typography variant="body2" color="text.secondary">You do not have permission to use the restricted service shell.</Typography></Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 1.25, bgcolor: "#0b1016", borderColor: "rgba(148,163,184,.18)" }}>
        <Box sx={{ height: 42, display: "flex", alignItems: "stretch", bgcolor: "#121a22", borderBottom: "1px solid rgba(148,163,184,.16)" }}>
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Box key={tab.id} onClick={() => setActiveTab(tab.id)} sx={{ display: "flex", alignItems: "center", gap: .7, px: 1.35, minWidth: tab.id === "shell" ? 100 : 140, maxWidth: 220, cursor: "pointer", borderRight: "1px solid rgba(148,163,184,.12)", bgcolor: active ? "#0b1016" : "#10171f", borderTop: active ? "2px solid #60a5fa" : "2px solid transparent" }}>
                {tab.type === "shell" ? <TerminalRoundedIcon sx={{ fontSize: 16, color: active ? "#60a5fa" : "#7b8794" }} /> : <InsertDriveFileRoundedIcon sx={{ fontSize: 15, color: fileIconColor(tab.path) }} />}
                <Typography sx={{ fontFamily: tab.type === "shell" ? "inherit" : MONO, fontSize: 12.5, flex: 1, color: active ? "#e7eef6" : "#97a5b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.title}{tab.type === "file" && openFiles[tab.path]?.dirty ? " •" : ""}</Typography>
                {tab.type === "file" ? <IconButton size="small" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} sx={{ color: "#6f7c89", p: .25 }}><CloseRoundedIcon sx={{ fontSize: 15 }} /></IconButton> : null}
              </Box>
            );
          })}
        </Box>

        {activeTab === "shell" ? (
          <Box sx={{ display: "grid", gridTemplateColumns: sidebarOpen ? { xs: "1fr", md: "250px minmax(0,1fr)" } : "1fr", height: TERMINAL_HEIGHT, minHeight: 0 }}>
            {sidebarOpen ? (
              <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: { md: "1px solid rgba(148,163,184,.14)" }, borderBottom: { xs: "1px solid rgba(148,163,184,.14)", md: 0 }, bgcolor: "#0d141c" }}>
                <Box sx={{ px: 1.2, py: .85, display: "flex", alignItems: "center", gap: .6 }}>
                  <Typography sx={{ color: "#6f7d8b", fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", flex: 1 }}>PROJECT</Typography>
                  <Button size="small" variant="outlined" startIcon={<AddRoundedIcon sx={{ fontSize: 15 }} />} onClick={createNewFile} disabled={!session || !cwdMountWritable} sx={{ minWidth: 0, px: .85, py: .25, textTransform: "none", fontSize: 10.5, lineHeight: 1.2, borderColor: "rgba(96,165,250,.28)", color: "#93bce7" }}>New file</Button>
                  <Button size="small" variant="outlined" startIcon={<FolderRoundedIcon sx={{ fontSize: 15 }} />} onClick={createNewFolder} disabled={!session || !cwdMountWritable} sx={{ minWidth: 0, px: .85, py: .25, textTransform: "none", fontSize: 10.5, lineHeight: 1.2, borderColor: "rgba(96,165,250,.28)", color: "#93bce7" }}>New Folder</Button>
                  <Tooltip title="Refresh"><span><IconButton size="small" disabled={!session || treeLoading} onClick={refreshDirectory} sx={{ color: "#7d8a98" }}>{treeLoading ? <CircularProgress size={14} /> : <RefreshRoundedIcon sx={{ fontSize: 16 }} />}</IconButton></span></Tooltip>
                </Box>
                <Divider sx={{ borderColor: "rgba(148,163,184,.1)" }} />
                <Box sx={{ px: 1, py: .65, display: "flex", alignItems: "center", gap: .2, overflowX: "auto" }}>
                  {breadcrumbItems.map((crumb, index) => (
                    <React.Fragment key={crumb.path}>
                      {index > 0 ? <ChevronRightRoundedIcon sx={{ fontSize: 14, color: "#495766" }} /> : null}
                      <Button size="small" onClick={() => crumb.path !== currentCwd && runCommand(`cd "${crumb.path.replace(/"/g, '\\"')}"`)} disabled={!session || crumb.path === currentCwd} sx={{ color: crumb.path === currentCwd ? "#a8b4c0" : "#7f95ab", fontFamily: MONO, fontSize: 10.5, textTransform: "none", minWidth: 0, px: .45, py: .1 }}>{crumb.label}</Button>
                    </React.Fragment>
                  ))}
                </Box>
                <Divider sx={{ borderColor: "rgba(148,163,184,.1)" }} />
                <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", py: .5 }}>
                  {!session ? <Typography sx={{ p: 1.3, color: "#5e6d7c", fontSize: 11.5 }}>Open a shell to browse files.</Typography> : explorerEntries.map((item) => (
                    <Box key={`${item.parent ? "p" : item.directory ? "d" : "f"}-${item.path || item.name}`} onContextMenu={(e) => !item.parent && handleTreeContextMenu(e, item)} onDoubleClick={() => openTreeItem(item)} onClick={() => item.parent || !item.directory ? openTreeItem(item) : null} sx={{ display: "flex", alignItems: "center", gap: .65, px: 1.1, py: .42, cursor: "pointer", color: item.parent ? "#91a9bf" : "#c4ced8", ":hover": { bgcolor: "rgba(96,165,250,.08)" } }}>
                      {item.parent ? <ChevronRightRoundedIcon sx={{ fontSize: 16, color: "#91a9bf", transform: "rotate(180deg)" }} /> : item.directory ? <FolderRoundedIcon sx={{ fontSize: 16, color: "#77a7d8" }} /> : <InsertDriveFileRoundedIcon sx={{ fontSize: 15, color: fileIconColor(item.name) }} />}
                      <Typography sx={{ fontFamily: MONO, fontSize: 11.5, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: item.parent ? 1 : (item.writable === false ? .72 : 1) }}>{item.name}{item.directory && !item.parent ? "/" : ""}</Typography>
                      {!item.parent ? <Typography sx={{ fontFamily: MONO, fontSize: 9, color: item.mode === "ro" ? "#e8a08f" : (item.effectiveWritable === null ? "#9aabbc" : (item.writable === false ? "#d7b26e" : "#73a386")), flexShrink: 0 }}>{item.mode === "ro" ? "RO" : (item.effectiveWritable === null ? "RW · …" : (item.writable === false ? "RW · LOCKED" : "RW"))}</Typography> : null}
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}

            <Box ref={terminalRef} sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", bgcolor: "#0a0f14", color: "#dce6ef" }}>
              <Box sx={{ height: 38, px: 1, display: "flex", alignItems: "center", gap: .6, borderBottom: "1px solid rgba(148,163,184,.1)", bgcolor: "#0e151d" }}>
                <Tooltip title={sidebarOpen ? "Hide project" : "Show project"}><IconButton size="small" onClick={(e) => { e.stopPropagation(); setSidebarOpen((v) => !v); }} sx={{ color: "#8291a0" }}>{sidebarOpen ? <MenuOpenRoundedIcon sx={{ fontSize: 18 }} /> : <MenuRoundedIcon sx={{ fontSize: 18 }} />}</IconButton></Tooltip>
                {session ? <Chip size="small" icon={<CheckCircleRoundedIcon sx={{ fontSize: "13px !important" }} />} label={currentCwd} sx={{ height: 23, color: "#a6b7c8", bgcolor: "rgba(53,211,153,.06)", border: "1px solid rgba(53,211,153,.14)", fontFamily: MONO, maxWidth: 420, ".MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }} /> : <Chip size="small" label="Disconnected" sx={{ height: 23, color: "#7f8b97", bgcolor: "rgba(148,163,184,.06)" }} />}
                <Box sx={{ flex: 1 }} />
                {session ? (
                  <>
                    <Tooltip title={dryRun ? "Dry-run ON (commands are planned only)" : "Dry-run OFF"}>
                      <Chip size="small" onClick={(e) => { e.stopPropagation(); setDryRun((v) => !v); }} label={dryRun ? "dry-run" : "live"} sx={{ height: 22, cursor: "pointer", color: dryRun ? "#e9bd69" : "#8fa0b0", bgcolor: dryRun ? "rgba(246,199,108,.1)" : "rgba(148,163,184,.06)" }} />
                    </Tooltip>
                    <Tooltip title="Snippets"><Button size="small" onClick={(e) => { e.stopPropagation(); setSnippetsOpen(true); }} sx={{ minWidth: 0, px: .7, color: "#9ab0c4", textTransform: "none", fontSize: 11 }}>Snippets</Button></Tooltip>
                    <Tooltip title="Environment (masked)"><Button size="small" onClick={(e) => { e.stopPropagation(); loadEnv(); }} sx={{ minWidth: 0, px: .7, color: "#9ab0c4", textTransform: "none", fontSize: 11 }}>Env</Button></Tooltip>
                    <Tooltip title="Activity / audit log"><Button size="small" onClick={(e) => { e.stopPropagation(); setAuditOpen(true); setAuditPage(1); loadAudit(1, auditFilter); }} sx={{ minWidth: 0, px: .7, color: "#9ab0c4", textTransform: "none", fontSize: 11 }}>Audit</Button></Tooltip>
                    {health?.container?.running ? <Chip size="small" label="healthy" sx={{ height: 22, color: "#73c9a0", bgcolor: "rgba(53,211,153,.08)" }} /> : session ? <Chip size="small" label="check" onClick={(e) => { e.stopPropagation(); loadHealth(); }} sx={{ height: 22, cursor: "pointer", color: "#9ab0c4" }} /> : null}
                    <Tooltip title="Close session"><IconButton size="small" onClick={(e) => { e.stopPropagation(); closeSession(); }} sx={{ color: "#cc7f7f" }}><StopCircleOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                  </>
                ) : <Button size="small" variant="outlined" startIcon={sessionLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />} onClick={(e) => { e.stopPropagation(); createSession(); }} disabled={sessionLoading} sx={{ borderColor: "rgba(96,165,250,.3)", color: "#9ac2ed", textTransform: "none", fontSize: 11.5 }}>Open Shell</Button>}
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: { xs: 1.2, md: 1.6 }, py: 1.25, fontFamily: MONO, fontSize: 13, lineHeight: 1.58, userSelect: "text", WebkitUserSelect: "text" }} onScroll={() => completionOpen && requestAnimationFrame(updateHelperPosition)}>
                {terminalLines.map((line) => (
                  line.type === "command" ? (
                    <Box key={line.key} sx={{ minHeight: 20, whiteSpace: "pre-wrap", overflowWrap: "anywhere", userSelect: "text", WebkitUserSelect: "text" }}>
                      <Box component="span" sx={{ color: "#78b6e7", userSelect: "text" }}>{line.cwd} $ </Box>
                      <Box component="span" sx={{ color: "#b9d7f4", userSelect: "text" }}>{line.text}</Box>
                    </Box>
                  ) : (
                    <Box key={line.key} sx={{ color: line.type === "stderr" || line.type === "error" ? "#ff9b8f" : line.type === "system" ? "#87b4d9" : "#dce6ef", whiteSpace: "pre-wrap", overflowWrap: "anywhere", minHeight: line.text ? 20 : 6, userSelect: "text", WebkitUserSelect: "text" }}>{line.text || " "}</Box>
                  )
                ))}
                                {interactiveRunning ? (
                  <Box sx={{ my: 1 }}>
                    <ShellXterm
                      active={interactiveRunning}
                      onData={handleXtermData}
                      onResize={handleXtermResize}
                      writeRef={xtermWriteRef}
                      height={Math.max(280, (typeof window !== "undefined" ? Math.floor(window.innerHeight * 0.35) : 320))}
                    />
                    <Typography sx={{ mt: 0.5, fontSize: 11, color: "#5e6d7c" }}>
                      Interactive session · Ctrl+C interrupt · Ctrl+D exit · typed keys go to the process
                    </Typography>
                  </Box>
                ) : null}
                {session && !interactiveRunning ? (
                  <Box sx={{ display: "flex", alignItems: "flex-start", minHeight: 22, opacity: commandRunning && !interactiveRunning ? 0.55 : 1 }}>
                    {/* Outer shell prompt only when idle. During interactive PTY (tinker, etc.)
                        the child process owns the prompt (e.g. PsySH "> "); do not interfere. */}
                    {!interactiveRunning && !commandBusy ? (
                      <Typography component="span" sx={{ color: "#78b6e7", fontFamily: MONO, fontSize: 13, mr: .7, flexShrink: 0 }}>{currentCwd} $</Typography>
                    ) : interactiveRunning ? (
                      <Typography component="span" sx={{ color: "#5a6a7a", fontFamily: MONO, fontSize: 13, mr: .7, flexShrink: 0, userSelect: "none" }}>…</Typography>
                    ) : null}
                    <Box
                      ref={terminalInputRef}
                      contentEditable={!commandRunning || interactiveRunning}
                      suppressContentEditableWarning
                      spellCheck={false}
                      role="textbox"
                      aria-label={interactiveRunning ? "Interactive process input" : "Shell command line"}
                      onInput={(e) => {
                        const text = e.currentTarget.textContent || "";
                        if (interactiveRunning) setInteractiveInput(text);
                        else setCommand(text);
                        setCommandHistoryIndex(null);
                      }}
                      data-placeholder={interactiveRunning ? (interactiveSecret ? "password…" : "") : (commandRunning ? "running…" : "type a command…")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (interactiveRunning) {
                            const text = e.currentTarget.textContent || "";
                            sendInteractiveInput(`${text}\n`);
                            e.currentTarget.textContent = "";
                            setInteractiveInput("");
                            return;
                          }
                          // Outer shell is waiting for a previous command — ignore.
                          if (commandBusy) return;
                          if (completionOpen && completionSuggestions.length) {
                            const nextCommand = applyCompletion(completionIndex);
                            setCompletionOpen(false);
                            if (nextCommand) runCommand(nextCommand);
                            return;
                          }
                          runCommand(e.currentTarget.textContent || "");
                          return;
                        }
                        if (interactiveRunning && e.ctrlKey && e.key.toLowerCase() === "c") {
                          const selection = window.getSelection?.();
                          const hasSelectedTerminalText = Boolean(selection && !selection.isCollapsed && selection.toString());
                          if (hasSelectedTerminalText) return;
                          e.preventDefault();
                          const socket = shellSocketRef.current;
                          if (socket?.readyState === WebSocket.OPEN) {
                            socket.send(JSON.stringify({ type: "signal", name: "ctrl-c" }));
                            appendHistory({ type: "system", text: "^C" });
                            setInteractiveSecret(false);
                            if (terminalInputRef.current) terminalInputRef.current.textContent = "";
                            setInteractiveInput("");
                          }
                          return;
                        }
                        if (!interactiveRunning && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
                          const selection = window.getSelection?.();
                          if (selection && !selection.isCollapsed && selection.toString()) {
                            // Let the browser perform its native copy operation.
                            return;
                          }
                        }
                        if (interactiveRunning && e.ctrlKey && e.key.toLowerCase() === "d") {
                          e.preventDefault();
                          sendInteractiveInput("\x04");
                          appendHistory({ type: "system", text: "^D" });
                          return;
                        }
                        if (interactiveRunning && e.key === "Tab") {
                          e.preventDefault();
                          sendInteractiveInput("\t");
                          return;
                        }
                        if (e.key === "Tab") {
                          e.preventDefault();
                          if (!completionOpen) {
                            setCompletionIndex(0);
                            showHelper(commandContext.commandWord === "cd" || commandContext.commandWord === "nano" || commandContext.commandWord === "vi" || commandContext.commandWord === "vim" ? "paths" : "commands");
                            return;
                          }
                          if (completionSuggestions.length) {
                            setCompletionIndex((prev) => (prev + 1) % completionSuggestions.length);
                            requestAnimationFrame(() => updateHelperPosition());
                          }
                          return;
                        }
                        if (e.ctrlKey && e.code === "Space") {
                          e.preventDefault();
                          setCompletionIndex(0);
                          showHelper(commandContext.commandWord === "cd" || commandContext.commandWord === "nano" || commandContext.commandWord === "vi" || commandContext.commandWord === "vim" ? "paths" : "commands");
                          return;
                        }
                        if (e.key === "ArrowUp") {
                          if (completionOpen && completionSuggestions.length) { e.preventDefault(); setCompletionIndex((prev) => prev <= 0 ? completionSuggestions.length - 1 : prev - 1); return; }
                          e.preventDefault();
                          const next = Math.min((commandHistoryIndex ?? -1) + 1, commandHistory.length - 1);
                          if (commandHistory[next] !== undefined) { setCommandHistoryIndex(next); e.currentTarget.textContent = commandHistory[next]; setCommand(commandHistory[next]); setCaretOffset(e.currentTarget, e.currentTarget.textContent.length); }
                          return;
                        }
                        if (e.key === "ArrowDown") {
                          if (completionOpen && completionSuggestions.length) { e.preventDefault(); setCompletionIndex((prev) => (prev + 1) % completionSuggestions.length); return; }
                          e.preventDefault();
                          const next = (commandHistoryIndex ?? -1) - 1;
                          if (next < 0) { setCommandHistoryIndex(null); e.currentTarget.textContent = ""; setCommand(""); }
                          else { setCommandHistoryIndex(next); e.currentTarget.textContent = commandHistory[next] || ""; setCommand(commandHistory[next] || ""); }
                          return;
                        }
                        if (e.key === "Escape") { setCompletionOpen(false); return; }
                        if (e.ctrlKey && e.key.toLowerCase() === "l") { e.preventDefault(); setHistory([]); setCompletionOpen(false); return; }
                      }}
                      onPaste={(e) => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); }}
                      sx={{ flex: 1, outline: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: interactiveSecret ? "transparent" : "#e7eef6", caretColor: "#f8fafc", minHeight: 22, '&:empty:before': { content: "attr(data-placeholder)", color: "#475565" } }}
                    />
                  </Box>
                ) : null}
              </Box>

              {completionOpen && completionSuggestions.length > 0 ? (
                <Box ref={helperRef} sx={{ position: "fixed", left: helperRect.left, top: helperRect.top, width: { xs: "calc(100vw - 16px)", md: 560 }, maxWidth: "calc(100vw - 16px)", maxHeight: "min(46vh, 420px)", overflowY: "auto", bgcolor: "#111922", border: "1px solid rgba(128,151,174,.3)", boxShadow: "0 16px 40px rgba(0,0,0,.45)", borderRadius: .8, zIndex: 1600 }}>
                  <Box sx={{ px: 1.1, py: .65, display: "flex", alignItems: "center", gap: .7, borderBottom: "1px solid rgba(148,163,184,.1)" }}>
                    <Typography sx={{ color: "#93a6ba", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", flex: 1 }}>{helperMode === "paths" ? "PATH COMPLETION" : "COMMAND COMPLETION"}</Typography>
                    <Typography sx={{ color: "#617285", fontSize: 9.5 }}>Tab ↹ · ↑↓ · Enter · Esc</Typography>
                  </Box>
                  {completionSuggestions.map((item, index) => (
                    <Box key={`${item.command}-${index}`} ref={index === completionIndex ? completionActiveRef : null} onMouseDown={(event) => { event.preventDefault(); setCompletionIndex(index); applyCompletion(index); }} sx={{ px: 1.1, py: .65, display: "flex", alignItems: "center", gap: .8, bgcolor: index === completionIndex ? "rgba(96,165,250,.14)" : "transparent", cursor: "pointer" }}>
                      <Typography sx={{ flex: 1, color: index === completionIndex ? "#e9f2fb" : "#c0ccd8", fontFamily: MONO, fontSize: 11.7 }}>{item.display || item.command}</Typography>
                      <Typography sx={{ color: "#627589", fontSize: 9.5 }}>{item.label || (item.dangerous ? "confirm" : "command")}</Typography>
                    </Box>
                  ))}
                </Box>
              ) : null}
            </Box>
          </Box>
        ) : (
          <Box sx={{ height: TERMINAL_HEIGHT, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ height: 38, px: 1.2, display: "flex", alignItems: "center", gap: .7, bgcolor: "#0e151d", borderBottom: "1px solid rgba(148,163,184,.12)" }}>
              <Typography sx={{ flex: 1, color: "#cbd6e0", fontFamily: MONO, fontSize: 11.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeFile}</Typography>
              <Chip size="small" label={langLabel(activeLanguage || "text")} sx={{ height: 21, bgcolor: "rgba(96,165,250,.08)", color: "#91aac2" }} />
              {openFiles[activeFile]?.writable === false ? <Chip size="small" icon={<WarningAmberRoundedIcon sx={{ fontSize: "14px !important" }} />} label="read-only" sx={{ height: 21, color: "#ffb19f", bgcolor: "rgba(255,143,143,.07)" }} /> : null}
              {openFiles[activeFile]?.dirty ? <Chip size="small" label="modified" sx={{ height: 21, color: "#e9bd69", bgcolor: "rgba(246,199,108,.07)" }} /> : null}
              <Tooltip title="New file"><span><IconButton size="small" onClick={createNewFile} disabled={!session} sx={{ color: "#7e8e9f" }}><AddRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
              <Tooltip title="Delete file"><span><IconButton size="small" onClick={deleteActiveFile} disabled={!activeFile || fileLoading} sx={{ color: "#c77f7f" }}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></span></Tooltip>
              <Tooltip title="Copy"><span><IconButton size="small" onClick={copyFile} disabled={!activeContent} sx={{ color: "#7e8e9f" }}><ContentCopyRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Button size="small" variant="contained" startIcon={<SaveRoundedIcon sx={{ fontSize: 15 }} />} onClick={() => writeOpenFile(activeFile)} disabled={fileLoading || !openFiles[activeFile]?.dirty || openFiles[activeFile]?.writable === false} sx={{ textTransform: "none", fontSize: 11 }}>Save</Button>
            </Box>
            <Box sx={{ position: "relative", flex: 1, minHeight: 0, bgcolor: "#0b1016", display: "flex", overflow: "hidden" }}>
              <Box sx={{ width: 52, flexShrink: 0, bgcolor: "#0e141b", borderRight: "1px solid rgba(148,163,184,.10)", overflow: "hidden", position: "relative" }}>
                <Box sx={{ position: "absolute", top: 14 - editorScroll.top, left: 0, width: "100%", textAlign: "right", pr: 1, color: "#475566", fontFamily: MONO, fontSize: 13, lineHeight: "20px", whiteSpace: "pre" }}>
                  {Array.from({ length: Math.max(1, activeContent.split("\n").length) }, (_, i) => <Box key={i} sx={{ height: 20 }}>{i + 1}</Box>)}
                </Box>
              </Box>
              <Box sx={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, overflow: "hidden" }}>
                <Box component="pre" className={`shell-editor-code hljs language-${activeLanguage || "plaintext"}`} aria-hidden="true" sx={{ position: "absolute", top: 0, left: 0, m: 0, p: "14px 16px", transform: `translate(${-editorScroll.left}px, ${-editorScroll.top}px)`, transformOrigin: "top left", minWidth: "100%", width: "max-content", minHeight: "100%", boxSizing: "border-box", pointerEvents: "none", fontFamily: MONO, fontSize: 13, lineHeight: "20px", whiteSpace: "pre", overflow: "visible", color: "#e6edf3", tabSize: 2, bgcolor: "transparent", "& .hljs": { background: "transparent" } }}
                  dangerouslySetInnerHTML={{ __html: highlightedEditorHtml }}
                />
              <Box component="textarea"
                ref={editorInputRef}
                value={activeContent}
                onScroll={(e) => setEditorScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
                onChange={(e) => updateFileContent(activeFile, e.target.value)}
                spellCheck={false}
                readOnly={fileLoading || openFiles[activeFile]?.writable === false}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    if (openFiles[activeFile]?.writable !== false) writeOpenFile(activeFile);
                    return;
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const target=e.currentTarget; const start=target.selectionStart; const endPos=target.selectionEnd;
                    if (openFiles[activeFile]?.writable === false) return;
                    const next=`${target.value.slice(0,start)}\t${target.value.slice(endPos)}`;
                    updateFileContent(activeFile,next);
                    requestAnimationFrame(()=>{ target.selectionStart=start+1; target.selectionEnd=start+1; });
                  }
                }}
                sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", resize: "none", boxSizing: "border-box", border: 0, outline: 0, p: "14px 16px", bgcolor: "transparent", color: "transparent", WebkitTextFillColor: "transparent", caretColor: "#f8fafc", "&::selection": { backgroundColor: "rgba(96,165,250,.28)" }, fontFamily: MONO, fontSize: 13, lineHeight: "20px", whiteSpace: "pre", overflow: "auto", tabSize: 2, WebkitFontSmoothing: "antialiased" }}
              />
              </Box>
              {openFiles[activeFile]?.writable === false ? <Box sx={{ position: "absolute", right: 12, bottom: 10, px: .8, py: .35, borderRadius: .5, bgcolor: "rgba(20,10,10,.75)", color: "#ffab96", fontFamily: MONO, fontSize: 10 }}>READ ONLY · {openFiles[activeFile]?.readOnlyReason}</Box> : null}
            </Box>
          </Box>
        )}
      </Paper>

      <Menu
        open={contextMenu.mouseY !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu.mouseY !== null && contextMenu.mouseX !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
        slotProps={{ paper: { sx: { minWidth: 190 } } }}
      >
        {contextMenu.item?.directory && !contextMenu.item?.parent ? (
          <MenuItem onClick={contextNewFile}><AddRoundedIcon sx={{ mr: 1, fontSize: 18 }} />New file here</MenuItem>
        ) : null}
        {!contextMenu.item?.directory ? (
          <MenuItem onClick={contextEdit}><EditRoundedIcon sx={{ mr: 1, fontSize: 18 }} />Edit</MenuItem>
        ) : (
          <MenuItem onClick={() => { const item = contextMenu.item; closeContextMenu(); if (item) runCommand(item.parent ? "cd .." : `cd ${quoteShellArg(item.path || joinPath(currentCwd, item.name))}`); }}><FolderRoundedIcon sx={{ mr: 1, fontSize: 18 }} />Open directory</MenuItem>
        )}
        {contextMenu.item?.parent ? null : <MenuItem onClick={contextRename}><DriveFileRenameOutlineRoundedIcon sx={{ mr: 1, fontSize: 18 }} />Rename</MenuItem>}
        <MenuItem onClick={async () => { await navigator.clipboard?.writeText(contextMenu.item?.path || ""); closeContextMenu(); }}><ContentCopyRoundedIcon sx={{ mr: 1, fontSize: 18 }} />Copy path</MenuItem>
        {contextMenu.item?.parent ? null : <MenuItem onClick={contextDelete} sx={{ color: "#f18b82" }}><DeleteOutlineRoundedIcon sx={{ mr: 1, fontSize: 18 }} />Delete</MenuItem>}
      </Menu>

      <Dialog open={replaceDialog.open} onClose={() => !replaceDialog.loading && setReplaceDialog((prev) => ({ ...prev, open: false }))} maxWidth="xs" fullWidth>
        <DialogTitle>Active shell session</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This service already has an active shell session{replaceDialog.activeUser?.username ? ` by ${replaceDialog.activeUser.username}` : ""}.
            {replaceDialog.canReplace ? " Do you want to terminate it and open a new shell session for yourself?" : " You do not have permission to terminate another user's session."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReplaceDialog((prev) => ({ ...prev, open: false }))} disabled={replaceDialog.loading}>Cancel</Button>
          {replaceDialog.canReplace ? <Button color="error" variant="contained" onClick={replaceActiveSession} disabled={replaceDialog.loading}>{replaceDialog.loading ? <CircularProgress size={16} color="inherit" /> : "Terminate & open new shell"}</Button> : null}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmCommand)} onClose={() => setConfirmCommand(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm command</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This command changes application state. Run it anyway?
          </DialogContentText>
          <Box sx={{ mt: 1.2, p: 1, bgcolor: "#0b1016", borderRadius: .6, fontFamily: MONO, fontSize: 12, color: "#cbd6e0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {confirmCommand || ""}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCommand(null)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={() => { const cmd = confirmCommand; setConfirmCommand(null); if (cmd) runCommand(cmd, { confirm: true }); }}>Run</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <span>Shell activity log</span>
          <Typography component="span" sx={{ fontSize: 12, color: "text.secondary", fontWeight: 400 }}>
            {auditTotal} event{auditTotal === 1 ? "" : "s"}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Box
            component="input"
            value={auditSearchInput}
            onChange={(e) => setAuditSearchInput(e.target.value)}
            placeholder="Search command, path, user, detail…"
            sx={{
              width: "100%",
              mb: 1.5,
              px: 1.25,
              py: 0.9,
              borderRadius: 1,
              border: "1px solid rgba(148,163,184,.25)",
              bgcolor: "rgba(15,23,32,.9)",
              color: "#e7eef6",
              fontFamily: MONO,
              fontSize: 13,
              outline: "none",
            }}
          />
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: "wrap" }}>
            {[
              { key: "", label: "All" },
              { key: "command", label: "Commands" },
              { key: "file_write", label: "File writes" },
              { key: "file_delete", label: "Deletes" },
              { key: "interactive_start", label: "Interactive" },
              { key: "session_open", label: "Sessions" },
            ].map((f) => (
              <Chip
                key={f.key || "all"}
                size="small"
                label={f.label}
                onClick={() => {
                  setAuditFilter(f.key);
                  setAuditPage(1);
                  loadAudit(1, f.key, auditSearch);
                }}
                sx={{
                  height: 24,
                  cursor: "pointer",
                  color: auditFilter === f.key ? "#e7eef6" : "#8fa0b0",
                  bgcolor: auditFilter === f.key ? "rgba(96,165,250,.2)" : "rgba(148,163,184,.08)",
                }}
              />
            ))}
          </Stack>
          {auditLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={22} /></Box>
          ) : (
            <Box sx={{ fontFamily: MONO, fontSize: 12, maxHeight: 420, overflow: "auto" }}>
              {auditEvents.length === 0 ? (
                <Typography color="text.secondary">No events on this page.</Typography>
              ) : auditEvents.map((ev) => (
                <Box key={ev.id} sx={{ py: .7, borderBottom: "1px solid rgba(148,163,184,.12)" }}>
                  <Typography sx={{ fontSize: 11, color: "#8fa0b0" }}>
                    {ev.created_at} · {ev.action} · {ev.user_email || ev.user_id || "—"}
                    {ev.exit_code != null ? ` · exit=${ev.exit_code}` : ""}
                    {ev.success === false ? " · failed" : ""}
                  </Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: 12.5, color: ev.success ? "#dce6ef" : "#ff9b8f", whiteSpace: "pre-wrap" }}>
                    {ev.command || ev.path || ev.detail || "—"}
                  </Typography>
                  {ev.output_preview ? (
                    <Typography sx={{ fontFamily: MONO, fontSize: 11, color: "#7f8b97", whiteSpace: "pre-wrap" }}>
                      {String(ev.output_preview).slice(0, 400)}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              disabled={auditLoading || auditPage <= 1}
              onClick={() => { const p = auditPage - 1; setAuditPage(p); loadAudit(p, auditFilter, auditSearch); }}
            >
              Previous
            </Button>
            <Typography sx={{ fontSize: 12, color: "text.secondary", minWidth: 90, textAlign: "center" }}>
              Page {auditPage} / {auditTotalPages}
            </Typography>
            <Button
              size="small"
              disabled={auditLoading || auditPage >= auditTotalPages}
              onClick={() => { const p = auditPage + 1; setAuditPage(p); loadAudit(p, auditFilter, auditSearch); }}
            >
              Next
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button size="small" onClick={() => downloadAudit("csv")}>Download CSV</Button>
            <Button size="small" onClick={() => downloadAudit("json")}>Download JSON</Button>
            <Button onClick={() => loadAudit(auditPage, auditFilter, auditSearch)}>Refresh</Button>
            <Button onClick={() => setAuditOpen(false)}>Close</Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog open={envOpen} onClose={() => setEnvOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Container environment (secrets masked)</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ fontFamily: MONO, fontSize: 12, maxHeight: 480, overflow: "auto" }}>
            {envItems.map((item) => (
              <Box key={item.key} sx={{ display: "flex", gap: 1, py: .35 }}>
                <Typography sx={{ fontFamily: MONO, fontSize: 12, color: "#9ac2ed", minWidth: 160 }}>{item.key}</Typography>
                <Typography sx={{ fontFamily: MONO, fontSize: 12, color: item.masked ? "#e9bd69" : "#dce6ef", wordBreak: "break-all" }}>{item.value}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setEnvOpen(false)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={snippetsOpen} onClose={() => setSnippetsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Command snippets</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={.5}>
            {(SHELL_SNIPPETS[platform] || SHELL_SNIPPETS.generic || []).map((s) => (
              <Button key={s.command} fullWidth sx={{ justifyContent: "flex-start", textTransform: "none", fontFamily: MONO, fontSize: 12 }} onClick={() => { setSnippetsOpen(false); runCommand(s.command); }}>
                {s.label}
              </Button>
            ))}
            {(SHELL_SNIPPETS.generic || []).filter((s) => !(SHELL_SNIPPETS[platform] || []).some((x) => x.command === s.command)).map((s) => (
              <Button key={`g-${s.command}`} fullWidth sx={{ justifyContent: "flex-start", textTransform: "none", fontFamily: MONO, fontSize: 12, color: "#8fa0b0" }} onClick={() => { setSnippetsOpen(false); runCommand(s.command); }}>
                {s.label}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setSnippetsOpen(false)}>Close</Button></DialogActions>
      </Dialog>

    </>
  );
}