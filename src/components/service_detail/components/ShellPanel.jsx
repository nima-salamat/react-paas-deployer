import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import apiRequest from "../../customHooks/apiRequest";
import { SERVICE_ACTION_ROOT } from "../constants";
import { loadHljs, highlightCode, HLJS_TOKEN_SX, langLabel } from "../../messenger/modules/codeHighlight";

const HISTORY_LIMIT = 500;
const COMMAND_HISTORY_LIMIT = 100;
const TERMINAL_HEIGHT = { xs: 560, md: 700 };
const MONO = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";

function normalizePlatform(platform) {
  const raw = String(platform || "generic").toLowerCase();
  if (raw.includes("laravel")) return "laravel";
  if (raw === "php") return "php";
  if (["django", "python", "flask", "fastapi"].includes(raw)) return raw === "django" ? "django" : "python";
  if (["node", "react", "vue", "angular", "nextjs", "nuxt"].includes(raw)) return "node";
  return "generic";
}

function cleanOutput(text) {
  return String(text ?? "").replace(/\r/g, "");
}

function joinPath(cwd, name) {
  const base = String(cwd || "/").replace(/\/$/, "");
  if (!base) return `/${name}`;
  return `${base}/${name}`;
}

function normalizeLsLine(line) {
  const value = String(line || "").trim();
  if (!value) return null;
  return {
    raw: value,
    name: value.endsWith("/") ? value.slice(0, -1) : value,
    directory: value.endsWith("/"),
  };
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

function fileIconColor(path) {
  const ext = String(path || "").toLowerCase().split(".").pop();
  if (["js", "jsx", "ts", "tsx"].includes(ext)) return "#f7df1e";
  if (ext === "py") return "#65b7ff";
  if (ext === "php") return "#a78bfa";
  if (["css", "scss", "less"].includes(ext)) return "#60a5fa";
  if (["json", "yaml", "yml", "toml"].includes(ext)) return "#f4b860";
  return "#94a3b8";
}

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
  const [tabs, setTabs] = useState([{ id: "shell", type: "shell", title: "Shell" }]);
  const [activeTab, setActiveTab] = useState("shell");
  const [openFiles, setOpenFiles] = useState({});
  const [fileLoading, setFileLoading] = useState(false);
  const [hljsReady, setHljsReady] = useState(false);
  const [replaceDialog, setReplaceDialog] = useState({ open: false, canReplace: false, activeUser: null, loading: false });
  const [helperRect, setHelperRect] = useState({ left: 12, top: 20 });
  const [helperMode, setHelperMode] = useState("commands");

  const terminalRef = useRef(null);
  const terminalInputRef = useRef(null);
  const editorInputRef = useRef(null);
  const editorHighlightRef = useRef(null);

  const serviceId = service?.id ?? service?.pk;
  const platform = normalizePlatform(service?.platform || service?.framework || service?.selected_platform);
  const apiRoot = `${SERVICE_ACTION_ROOT}services/${serviceId}/shell`;
  const currentCwd = session?.cwd || "/";
  const activeFile = activeTab.startsWith("file:") ? activeTab.slice(5) : null;

  useEffect(() => {
    let alive = true;
    loadHljs().then((api) => { if (alive && api) setHljsReady(true); });
    return () => { alive = false; };
  }, []);

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
    const rect = range.getBoundingClientRect();
    const containerRect = terminalRef.current?.getBoundingClientRect();
    if (!containerRect) return null;
    const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 340));
    const top = Math.max(8, rect.bottom - containerRect.top + 4);
    return { left, top };
  }, []);

  const showHelper = useCallback((mode = "commands") => {
    setHelperMode(mode);
    const rect = getCaretRect();
    if (rect) setHelperRect(rect);
    setCompletionOpen(true);
  }, [getCaretRect]);

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
      const response = await apiRequest({
        method: "POST",
        url: `${apiRoot}/command/`,
        data: { token, command: "ls -1Ap" },
      });
      const data = response?.data || {};
      if (data.result !== "success") throw new Error(data.detail || "Unable to read directory.");
      const resolvedCwd = data.cwd || sessionCwd;
      setSession((prev) => {
        if (!prev) return prev;
        return prev.cwd === resolvedCwd ? prev : { ...prev, cwd: resolvedCwd };
      });
      setTree(cleanOutput(data.stdout).split("\n").map(normalizeLsLine).filter(Boolean));
    } catch (err) {
      handleError(err?.response?.data?.detail || err?.message || "Unable to read directory.");
    } finally {
      setTreeLoading(false);
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
      if (status === 409 && payload.code === "SHELL_SESSION_ACTIVE") {
        setReplaceDialog({ open: true, canReplace: Boolean(payload.can_replace), activeUser: payload.active_session || null, loading: false });
      } else {
        handleError(payload?.detail || err?.message || "Unable to create shell session.");
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

  const commandContext = useMemo(() => {
    const value = String(command || "");
    const trimmed = value.trimStart();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    return {
      value,
      trimmed,
      commandWord: (parts[0] || "").toLowerCase(),
      token: value.match(/(?:^|\s)([^\s]*)$/)?.[1] || "",
    };
  }, [command]);

  const completionSuggestions = useMemo(() => {
    const { trimmed, commandWord, token } = commandContext;
    if (helperMode === "commands" && !trimmed) return commandCatalog.slice(0, 16);

    if (commandWord === "cd") {
      const prefix = token.toLowerCase();
      return tree
        .filter((item) => item.directory && item.name.toLowerCase().startsWith(prefix))
        .map((item) => ({ command: item.name, display: `${item.name}/`, label: "directory", description: `cd into ${item.name}` }));
    }

    if (commandWord === "nano" || commandWord === "vi" || commandWord === "vim") {
      const prefix = token.toLowerCase();
      return tree
        .filter((item) => !item.directory && item.name.toLowerCase().startsWith(prefix))
        .map((item) => ({ command: item.name, display: item.name, label: "file", description: "open in editor" }));
    }

    const prefix = token.toLowerCase();
    if (!prefix) return commandCatalog.slice(0, 16);
    return commandCatalog.filter((item) => String(item.command || "").toLowerCase().startsWith(prefix)).slice(0, 16);
  }, [commandCatalog, commandContext, helperMode, tree]);

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
    if (!completionSuggestions.length || !terminalInputRef.current) return;
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
    const nextBefore = `${before.slice(0, start)}${selected.command}`;
    const next = `${nextBefore}${after}`;
    element.textContent = next;
    setCommand(next);
    setCaretOffset(element, nextBefore.length);
    setCompletionOpen(true);
  }, [completionIndex, completionSuggestions, setCaretOffset]);

  const runCommand = useCallback(async (value) => {
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

    runningRef.current = true;
    setHistory((prev) => [...prev, { id: `${Date.now()}-cmd`, type: "command", text: cmd, cwd: currentCwd }].slice(-HISTORY_LIMIT));
    setCommandHistory((prev) => [cmd, ...prev.filter((item) => item !== cmd)].slice(0, COMMAND_HISTORY_LIMIT));
    setCommandHistoryIndex(null);
    setCommand("");
    setCompletionOpen(false);
    if (terminalInputRef.current) terminalInputRef.current.textContent = "";

    try {
      const response = await apiRequest({ method: "POST", url: `${apiRoot}/command/`, data: { token: session.token, command: cmd } });
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
      setHistory((prev) => [...prev, { id: `${Date.now()}-out`, type: "output", exitCode: data.exit_code ?? 0, stdout: cleanOutput(data.stdout), stderr: cleanOutput(data.stderr) }].slice(-HISTORY_LIMIT));
      if (cmd === "pwd" || cmd.startsWith("cd ") || cmd === "cd" || cmd === "ls" || cmd.startsWith("ls ")) await refreshDirectory();
      else if (cmd.startsWith("rm ") || cmd.startsWith("mv ") || cmd.startsWith("cp ") || cmd.startsWith("mkdir ") || cmd.startsWith("touch ")) await refreshDirectory();
    } catch (err) {
      setHistory((prev) => [...prev, { id: `${Date.now()}-err`, type: "error", text: err?.response?.data?.detail || err?.message || "Command failed." }].slice(-HISTORY_LIMIT));
    } finally {
      runningRef.current = false;
      focusTerminal();
    }
  }, [apiRoot, command, currentCwd, focusTerminal, refreshDirectory, session?.token]);

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
    if (!session) return;
    if (item.directory) {
      const escaped = joinPath(currentCwd, item.name).replace(/"/g, '\\"');
      runCommand(`cd "${escaped}"`);
    } else {
      openFileTab(joinPath(currentCwd, item.name));
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
      if (/read-only|not writable/i.test(String(message))) setOpenFiles((prev) => ({ ...prev, [path]: { ...(prev[path] || {}), writable: false, readOnlyReason: message } }));
      handleError(message);
    } finally {
      setFileLoading(false);
    }
  }, [apiRoot, handleError, openFiles, session?.token]);

  const activeContent = activeFile ? (openFiles[activeFile]?.content || "") : "";
  const activeLanguage = activeFile ? detectLanguage(activeFile) : "";
  const highlighted = useMemo(() => activeFile ? highlightCode(activeContent, activeLanguage).html : "", [activeContent, activeFile, activeLanguage, hljsReady]);
  const breadcrumbItems = useMemo(() => splitPath(currentCwd), [currentCwd]);

  const syncEditorScroll = useCallback(() => {
    if (!editorInputRef.current || !editorHighlightRef.current) return;
    editorHighlightRef.current.scrollTop = editorInputRef.current.scrollTop;
    editorHighlightRef.current.scrollLeft = editorInputRef.current.scrollLeft;
  }, []);

  const copyFile = useCallback(async () => {
    if (!activeContent) return;
    try { await navigator.clipboard?.writeText(activeContent); } catch { /* ignore */ }
  }, [activeContent]);

  const terminalLines = history.flatMap((entry) => {
    if (entry.type === "command") return [{ key: `${entry.id}-command`, type: "command", text: `${entry.cwd || currentCwd} $ ${entry.text}` }];
    if (entry.type === "output") {
      const rows = [];
      cleanOutput(entry.stdout).split("\n").forEach((text, i) => { if (text !== "" || i === 0) rows.push({ key: `${entry.id}-out-${i}`, type: "stdout", text }); });
      cleanOutput(entry.stderr).split("\n").forEach((text, i) => { if (text !== "" || i === 0) rows.push({ key: `${entry.id}-err-${i}`, type: "stderr", text }); });
      if (entry.exitCode && entry.exitCode !== 0) rows.push({ key: `${entry.id}-exit`, type: "stderr", text: `Process exited with code ${entry.exitCode}` });
      return rows;
    }
    return [{ key: entry.id, type: entry.type, text: entry.text }];
  });

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
                  {!session ? <Typography sx={{ p: 1.3, color: "#5e6d7c", fontSize: 11.5 }}>Open a shell to browse files.</Typography> : tree.map((item) => (
                    <Box key={`${item.directory ? "d" : "f"}-${item.name}`} onDoubleClick={() => openTreeItem(item)} onClick={() => !item.directory && openTreeItem(item)} sx={{ display: "flex", alignItems: "center", gap: .65, px: 1.1, py: .42, cursor: "pointer", color: "#c4ced8", ":hover": { bgcolor: "rgba(96,165,250,.08)" } }}>
                      {item.directory ? <FolderRoundedIcon sx={{ fontSize: 16, color: "#77a7d8" }} /> : <InsertDriveFileRoundedIcon sx={{ fontSize: 15, color: fileIconColor(item.name) }} />}
                      <Typography sx={{ fontFamily: MONO, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}{item.directory ? "/" : ""}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            ) : null}

            <Box ref={terminalRef} onClick={focusTerminal} sx={{ minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", bgcolor: "#0a0f14", color: "#dce6ef" }}>
              <Box sx={{ height: 38, px: 1, display: "flex", alignItems: "center", gap: .6, borderBottom: "1px solid rgba(148,163,184,.1)", bgcolor: "#0e151d" }}>
                <Tooltip title={sidebarOpen ? "Hide project" : "Show project"}><IconButton size="small" onClick={(e) => { e.stopPropagation(); setSidebarOpen((v) => !v); }} sx={{ color: "#8291a0" }}>{sidebarOpen ? <MenuOpenRoundedIcon sx={{ fontSize: 18 }} /> : <MenuRoundedIcon sx={{ fontSize: 18 }} />}</IconButton></Tooltip>
                {session ? <Chip size="small" icon={<CheckCircleRoundedIcon sx={{ fontSize: "13px !important" }} />} label={currentCwd} sx={{ height: 23, color: "#a6b7c8", bgcolor: "rgba(53,211,153,.06)", border: "1px solid rgba(53,211,153,.14)", fontFamily: MONO, maxWidth: 420, ".MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis" } }} /> : <Chip size="small" label="Disconnected" sx={{ height: 23, color: "#7f8b97", bgcolor: "rgba(148,163,184,.06)" }} />}
                <Box sx={{ flex: 1 }} />
                {session ? <Tooltip title="Close session"><IconButton size="small" onClick={(e) => { e.stopPropagation(); closeSession(); }} sx={{ color: "#cc7f7f" }}><StopCircleOutlinedIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip> : <Button size="small" variant="outlined" startIcon={sessionLoading ? <CircularProgress size={14} color="inherit" /> : <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />} onClick={(e) => { e.stopPropagation(); createSession(); }} disabled={sessionLoading} sx={{ borderColor: "rgba(96,165,250,.3)", color: "#9ac2ed", textTransform: "none", fontSize: 11.5 }}>Open Shell</Button>}
              </Box>

              <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: { xs: 1.2, md: 1.6 }, py: 1.25, fontFamily: MONO, fontSize: 13, lineHeight: 1.58 }} onScroll={() => completionOpen && setCompletionOpen(false)}>
                {terminalLines.map((line) => (
                  <Box key={line.key} sx={{ color: line.type === "stderr" || line.type === "error" ? "#ff9b8f" : line.type === "system" ? "#87b4d9" : line.type === "command" ? "#b9d7f4" : "#dce6ef", whiteSpace: "pre-wrap", overflowWrap: "anywhere", minHeight: line.text ? 20 : 6 }}>{line.text || " "}</Box>
                ))}
                {session ? (
                  <Box sx={{ display: "flex", alignItems: "flex-start", minHeight: 22 }}>
                    <Typography component="span" sx={{ color: "#78b6e7", fontFamily: MONO, fontSize: 13, mr: .7, flexShrink: 0 }}>{currentCwd} $</Typography>
                    <Box
                      ref={terminalInputRef}
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck={false}
                      role="textbox"
                      aria-label="Shell command line"
                      data-placeholder="type a command…"
                      onInput={(e) => { setCommand(e.currentTarget.textContent || ""); setCommandHistoryIndex(null); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (completionOpen && completionSuggestions.length) { applyCompletion(completionIndex); return; }
                          runCommand(e.currentTarget.textContent || "");
                          return;
                        }
                        if (e.key === "Tab") {
                          e.preventDefault();
                          if (!completionOpen) {
                            setCompletionIndex(0);
                            showHelper(commandContext.commandWord === "cd" || commandContext.commandWord === "nano" ? "paths" : "commands");
                            return;
                          }
                          if (completionSuggestions.length) {
                            const next = (completionIndex + 1) % completionSuggestions.length;
                            setCompletionIndex(next);
                            applyCompletion(next);
                          }
                          return;
                        }
                        if (e.ctrlKey && e.code === "Space") {
                          e.preventDefault();
                          setCompletionIndex(0);
                          showHelper(commandContext.commandWord === "cd" || commandContext.commandWord === "nano" ? "paths" : "commands");
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
                      sx={{ flex: 1, outline: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "#e7eef6", caretColor: "#f8fafc", minHeight: 22, '&:empty:before': { content: "attr(data-placeholder)", color: "#475565" } }}
                    />
                  </Box>
                ) : null}
              </Box>

              {completionOpen && completionSuggestions.length > 0 ? (
                <Box sx={{ position: "absolute", left: helperRect.left, top: helperRect.top, width: { xs: "calc(100% - 16px)", md: 560 }, maxWidth: "calc(100% - 16px)", bgcolor: "#111922", border: "1px solid rgba(128,151,174,.3)", boxShadow: "0 16px 40px rgba(0,0,0,.45)", borderRadius: .8, overflow: "hidden", zIndex: 20 }}>
                  <Box sx={{ px: 1.1, py: .65, display: "flex", alignItems: "center", gap: .7, borderBottom: "1px solid rgba(148,163,184,.1)" }}>
                    <Typography sx={{ color: "#93a6ba", fontSize: 10.5, fontWeight: 800, letterSpacing: ".05em", flex: 1 }}>{helperMode === "paths" ? "PATH COMPLETION" : "COMMAND COMPLETION"}</Typography>
                    <Typography sx={{ color: "#617285", fontSize: 9.5 }}>Tab ↹ · ↑↓ · Enter · Esc</Typography>
                  </Box>
                  {completionSuggestions.map((item, index) => (
                    <Box key={`${item.command}-${index}`} onMouseDown={(event) => { event.preventDefault(); setCompletionIndex(index); applyCompletion(index); }} sx={{ px: 1.1, py: .65, display: "flex", alignItems: "center", gap: .8, bgcolor: index === completionIndex ? "rgba(96,165,250,.14)" : "transparent", cursor: "pointer" }}>
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
              <Tooltip title="Copy"><span><IconButton size="small" onClick={copyFile} disabled={!activeContent} sx={{ color: "#7e8e9f" }}><ContentCopyRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Button size="small" variant="contained" startIcon={<SaveRoundedIcon sx={{ fontSize: 15 }} />} onClick={() => writeOpenFile(activeFile)} disabled={fileLoading || !openFiles[activeFile]?.dirty || openFiles[activeFile]?.writable === false} sx={{ textTransform: "none", fontSize: 11 }}>Save</Button>
            </Box>
            <Box sx={{ position: "relative", flex: 1, minHeight: 0, bgcolor: "#0b1016" }}>
              <Box ref={editorHighlightRef} component="pre" aria-hidden="true" sx={{ position: "absolute", inset: 0, m: 0, p: 1.5, overflow: "hidden", pointerEvents: "none", fontFamily: MONO, fontSize: 13, lineHeight: "20px", whiteSpace: "pre", color: "#e6edf3", ...HLJS_TOKEN_SX }} dangerouslySetInnerHTML={{ __html: highlighted + (activeContent.endsWith("\n") ? "\n" : "") }} />
              <Box ref={editorInputRef} component="textarea" value={activeContent} onChange={(e) => updateFileContent(activeFile, e.target.value)} onScroll={syncEditorScroll} spellCheck={false} readOnly={fileLoading || openFiles[activeFile]?.writable === false} sx={{ position: "relative", zIndex: 1, width: "100%", height: "100%", resize: "none", border: 0, outline: 0, p: 1.5, m: 0, boxSizing: "border-box", bgcolor: "transparent", color: "transparent", caretColor: "#f8fafc", fontFamily: MONO, fontSize: 13, lineHeight: "20px", whiteSpace: "pre", overflow: "auto" }} />
              {openFiles[activeFile]?.writable === false ? <Box sx={{ position: "absolute", right: 12, bottom: 10, color: "#ffab96", fontFamily: MONO, fontSize: 10 }}>{openFiles[activeFile]?.readOnlyReason}</Box> : null}
            </Box>
          </Box>
        )}
      </Paper>

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
    </>
  );
}
