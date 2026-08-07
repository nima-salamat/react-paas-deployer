import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import apiRequest from "../customHooks/apiRequest";

import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  useTheme,
  Snackbar,
  Alert,
  CircularProgress,
  useMediaQuery,
  Paper,
} from "@mui/material";

import TabSidebar from "./components/TabSidebar";
import GlobalServiceControls from "./components/GlobalServiceControls";
import OverviewPanel from "./components/OverviewPanel";
import CreateDeployPanel from "./components/CreateDeployPanel";
import LogsPanel from "./components/LogsPanel";
import ServiceToolbar from "./components/ServiceToolbar";
import SettingsPanel from "./components/SettingsPanel";
import MobileNavFab from "./components/MobileNavFab";
import MobileServiceHeader from "./components/MobileServiceHeader";

import {
  API_BASE,
  DEPLOY_BASE,
  DEPLOY_DOWNLOAD_BASE,
  SERVICE_BASE,
  SERVICE_ACTION_ROOT,
  NETWORK_API_ROOT,
  VOLUME_API_ROOT,
  PLANS_BASE,
  SERVICE_LOG_MAX_LINES,
  DEPLOY_LOG_PAGE_SIZE,
  DEPLOY_LOG_POLL_INTERVAL,
  DEFAULT_REFRESH_INTERVAL_MS,
  MUTABLE_DB_CONFIG_KEYS,
} from "./constants";

import {
  getDeployPlatform,
  isDbPlatform,
  buildConfigPayload,
  parseDeployConfig,
  normalizeTextEntries,
  mergeEntries,
  mergeEntriesPrepend,
  mergeObjects,
  downloadTextFile,
  getDeployEntryText,
} from "./utils";

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

  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planActionLoading, setPlanActionLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(null);

  const [deploys, setDeploys] = useState([]);
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0, page: 1 });
  const [deploysLoading, setDeploysLoading] = useState(false);

  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [config, setConfig] = useState("");
  const [zipFile, setZipFile] = useState(null);
  const [createPlatform, setCreatePlatform] = useState("docker");
  const [createDbFields, setCreateDbFields] = useState({ root_password: "", password: "", username: "", database: "", port: "", env: "" });

  const [submitting, setSubmitting] = useState(false);
  const [actionState, setActionState] = useState({});
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [dbConfigSaving, setDbConfigSaving] = useState(false);
  const [dbConfigFields, setDbConfigFields] = useState({ root_password: "", password: "", username: "", database: "", port: "", env: "" });

  const [editingDeployId, setEditingDeployId] = useState(null);
  const [editData, setEditData] = useState({ name: "", version: "", config: "", platform: "docker" });
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editZipFile, setEditZipFile] = useState(null);
  const [editDbFields, setEditDbFields] = useState({ root_password: "", password: "", username: "", database: "", port: "", env: "" });

  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, deployId: null, title: "", message: "", loading: false });
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
  const [deployLogLiveConnected, setDeployLogLiveConnected] = useState(false);

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
  const deployWsRef = useRef(null);
  const deployWsReconnectTimerRef = useRef(null);
  const deployWsReconnectAttemptRef = useRef(0);
  const deployWsShouldReconnectRef = useRef(true);
  const deployLogDeployIdRef = useRef("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    serviceLogPausedRef.current = serviceLogsPaused;
  }, [serviceLogsPaused]);

  useEffect(() => {
    deployLogDeployIdRef.current = deployLogDeployId;
  }, [deployLogDeployId]);

  const safeSetSnackbar = useCallback((severity, message) => {
    setSnackbar({ severity, message });
  }, []);

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

  const stopDeployLogWs = useCallback(() => {
    deployWsShouldReconnectRef.current = false;
    deployWsReconnectAttemptRef.current = 0;
    if (deployWsReconnectTimerRef.current) {
      clearTimeout(deployWsReconnectTimerRef.current);
      deployWsReconnectTimerRef.current = null;
    }
    if (deployWsRef.current) {
      try {
        deployWsRef.current.close();
      } catch {
        /* ignore */
      }
      deployWsRef.current = null;
    }
    setDeployLogLiveConnected(false);
  }, []);

  const appendDeployLiveEvent = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;
    const stage = payload.stage || "";
    const message = payload.message || "";
    const level = String(payload.level || "info").toLowerCase();
    const progress = payload.progress;
    const ts = payload.timestamp || new Date().toISOString();
    const parts = [];
    if (stage) parts.push(`[${stage}]`);
    if (progress != null && progress !== "") parts.push(`(${progress}%)`);
    if (message) parts.push(message);
    const text = parts.join(" ").trim() || JSON.stringify(payload);
    const key = `live-${payload.deploy_id || ""}-${stage}-${ts}-${text.slice(0, 48)}`;
    const entry = {
      key,
      text,
      level: level === "warn" ? "warning" : level,
      timestamp: ts,
      stage: stage || undefined,
      progress: progress != null ? progress : undefined,
      raw: payload,
    };
    setDeployLogEntries((prev) => {
      if (prev.some((e) => e.key === key)) return prev;
      const out = [...prev, entry];
      if (out.length > SERVICE_LOG_MAX_LINES) {
        return out.slice(out.length - SERVICE_LOG_MAX_LINES);
      }
      return out;
    });
  }, []);

  const connectDeployLogStream = useCallback((deployId) => {
    if (!deployId) return;
    deployWsShouldReconnectRef.current = true;

    if (deployWsRef.current) {
      try {
        deployWsRef.current.close();
      } catch {
        /* ignore */
      }
      deployWsRef.current = null;
    }
    if (deployWsReconnectTimerRef.current) {
      clearTimeout(deployWsReconnectTimerRef.current);
      deployWsReconnectTimerRef.current = null;
    }

    const token = localStorage.getItem("access");
    if (!token) {
      setDeployLogError((prev) => prev || "Authentication required for live deploy events.");
      setDeployLogLiveConnected(false);
      return;
    }

    let backendUrl;
    try {
      backendUrl = new URL(API_BASE);
    } catch {
      setDeployLogError("Invalid API base URL for WebSocket.");
      return;
    }
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    const socketUrl = `${protocol}//${backendUrl.host}/ws/deployments/${deployId}/?token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(socketUrl);
    deployWsRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      if (deployLogDeployIdRef.current !== String(deployId)) {
        try {
          socket.close();
        } catch {
          /* ignore */
        }
        return;
      }
      deployWsReconnectAttemptRef.current = 0;
      setDeployLogLiveConnected(true);
      setDeployLogError(null);
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current) return;
      if (deployLogDeployIdRef.current !== String(deployId)) return;
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (payload?.type === "deployment.connected") {
        setDeployLogLiveConnected(true);
        return;
      }
      if (payload?.type === "deployment.event") {
        appendDeployLiveEvent(payload.event || payload);
        return;
      }
      // Some sinks may send the event object directly
      if (payload?.stage || payload?.message) {
        appendDeployLiveEvent(payload);
      }
    };

    socket.onerror = () => {
      if (!mountedRef.current) return;
      setDeployLogLiveConnected(false);
    };

    socket.onclose = (evt) => {
      if (!mountedRef.current) return;
      setDeployLogLiveConnected(false);
      if (!deployWsShouldReconnectRef.current || evt.wasClean) return;
      if (deployLogDeployIdRef.current !== String(deployId)) return;

      deployWsReconnectAttemptRef.current += 1;
      const attempt = deployWsReconnectAttemptRef.current;
      const delay = Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));
      deployWsReconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !deployWsShouldReconnectRef.current) return;
        if (deployLogDeployIdRef.current !== String(deployId)) return;
        connectDeployLogStream(deployId);
      }, delay);
    };
  }, [appendDeployLiveEvent]);




  const handleDownloadZip = useCallback(async (deploy) => {
    const deployId = deploy?.id ?? deploy?.pk;
    if (!deployId) return;

    if (!deploy?.zip_file) {
      safeSetSnackbar("info", "This deploy has no ZIP file.");
      return;
    }

    try {
      const token = localStorage.getItem("access");
      const url = `${DEPLOY_DOWNLOAD_BASE}${deployId}/download/`;

      const resp = await axios.get(url, {
        responseType: "blob",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const disposition = resp.headers["content-disposition"] || "";
      let filename = `${deploy.name || "deploy"}-${deploy.version || "file"}.zip`;
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) filename = match[1];

      const blobUrl = URL.createObjectURL(
        new Blob([resp.data], { type: "application/zip" })
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      safeSetSnackbar("success", "Download started.");
    } catch (err) {
      const status = err?.response?.status;
      const msg =
        status === 404
          ? "File not found."
          : status === 401 || status === 403
          ? "You do not have permission to download this file."
          : err?.response?.data?.detail || "Download failed.";
      safeSetSnackbar("error", typeof msg === "string" ? msg : "Download failed.");
    }
  }, [safeSetSnackbar]);

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
      const name = String(candidate || "").trim();
      if (!name) return { ok: false, detail: "Name is required." };
      if (name.length < 4) return { ok: false, detail: "Name must be at least 4 characters." };
      if (editingDeployId && name === editOriginalName) return { ok: true, detail: "Unchanged." };

      try {
        const resp = await apiRequest({
          method: "GET",
          url: `${DEPLOY_BASE}name_is_available/`,
          params: { name, ...(editingDeployId ? { exclude_id: String(editingDeployId) } : {}) },
        });
        const data = resp?.data ?? resp;
        const ok = data?.result === true || data?.result === "true";
        return { ok, detail: data?.detail || (ok ? "The name is free." : "That name has already been taken.") };
      } catch (err) {
        return { ok: false, detail: err?.response?.data?.detail || "Could not verify name availability." };
      }
    },
    [editingDeployId, editOriginalName]
  );

  const fetchService = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setError(null);

    try {
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/` });
      if (!mountedRef.current) return;

      setService((prev) => {
        const merged = mergeObjects(prev ?? {}, resp.data ?? {});
        return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
      });

      const plan = resp.data?.plan;
      if (plan && typeof plan === "object") {
        setPlanDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, plan);
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      } else if (plan) {
        try {
          const p = await apiRequest({ method: "GET", url: `${PLANS_BASE}?id=${String(plan)}` });
          if (mountedRef.current) setPlanDetail(p.data);
        } catch {}
      }

      const net = resp.data?.network;
      if (net && typeof net === "object") {
        setNetworkDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, net);
          return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
        });
      } else if (net) {
        try {
          const n = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(net)}/` });
          if (mountedRef.current) setNetworkDetail(n.data);
        } catch {}
      }
    } catch (err) {
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
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}`, params: { service_id: id, page } });
      if (thisFetch !== fetchIdRef.current) return;

      const data = resp.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

      setDeploys((prev) => (Array.isArray(prev) && prev.length === results.length && JSON.stringify(prev) === JSON.stringify(results) ? prev : results));
      
      if (!silent) {
        setPageInfo((prev) => {
          const next = { next: data.next, previous: data.previous, count: data.count, page };
          return (prev.next === next.next && prev.previous === next.previous && prev.count === next.count && prev.page === next.page) ? prev : next;
        });
      } else if (data.count != null) {
        setPageInfo((prev) => (prev.count === data.count && prev.page === page ? prev : { ...prev, count: data.count, page }));
      }
    } catch (err) {
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
      const resp = await apiRequest({ method: "GET", url: NETWORK_API_ROOT, params: { page_size: 100 } });
      setAvailableNetworks(Array.isArray(resp.data) ? resp.data : resp.data.results || []);
    } catch (err) {}
  }, []);

  const fetchAvailableVolumes = useCallback(async () => {
    try {
      const resp = await apiRequest({ method: "GET", url: VOLUME_API_ROOT, params: { unused: true, page_size: 100 } });
      setAvailableVolumes(Array.isArray(resp.data) ? resp.data : resp.data.results || []);
    } catch (err) {}
  }, []);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const resp = await apiRequest({ method: "GET", url: PLANS_BASE, params: { page_size: 100 } });
      const data = resp.data;
      const list = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setAvailablePlans(list);
    } catch (err) {
      setAvailablePlans([]);
    } finally {
      if (mountedRef.current) setPlansLoading(false);
    }
  }, []);

  const fetchAttachedVolumes = useCallback(async () => {
    if (!id) return;
    try {
      const resp = await apiRequest({ method: "GET", url: VOLUME_API_ROOT, params: { service: id, page_size: 100 } });
      const next = Array.isArray(resp.data) ? resp.data : resp.data.results || [];
      setAttachedVolumes((prev) => (Array.isArray(prev) && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (err) {}
  }, [id]);

  const normalizePercent = useCallback((raw) => {
    let n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(Math.min(n, 100) * 100) / 100;
  }, []);

  const checkServiceRunning = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent && serviceStatusLoadingManual) return;
      if (!silent) setServiceStatusLoadingManual(true);

      try {
        const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}service_status/`, data: { service_id: id } });
        if (resp.status === 200 && resp.data) {
          const running = Boolean(resp.data.running);
          const cpu = normalizePercent(resp.data.cpu);
          const ram = normalizePercent(resp.data.ram);
          setServiceRunning((prev) => (prev === running ? prev : running));
          setServiceCpu((prev) => (typeof prev === "number" && Math.round(prev * 100) / 100 === Math.round(cpu * 100) / 100 ? prev : cpu));
          setServiceRam((prev) => (typeof prev === "number" && Math.round(prev * 100) / 100 === Math.round(ram * 100) / 100 ? prev : ram));
        } else if (!silent) {
          setServiceRunning(false); setServiceCpu(0); setServiceRam(0);
        }
      } catch (err) {
        if (!silent) { setServiceRunning(false); setServiceCpu(0); setServiceRam(0); }
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
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/logs/` });
      if (!mountedRef.current) return;
      setServiceLogsEntries(normalizeTextEntries(resp.data?.logs));
    } catch (err) {
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
      try { serviceLogSocketRef.current.close(); } catch {}
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
    const socketUrl = `${protocol}//${backendUrl.host}/ws/services/logs/${id}/?token=${encodeURIComponent(token)}`;
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
      try { payload = JSON.parse(event.data); } catch { payload = { type: "log.raw", message: String(event.data) }; }

      if (payload.type === "log.line") appendServiceLogEntries(payload.line ?? "");
      else if (payload.type === "error") setServiceLogsError(payload.message || "Live log stream error.");
      else if (payload.type === "deployment.event") appendServiceLogEntries(typeof payload.event === "string" ? payload.event : JSON.stringify(payload.event ?? {}, null, 2));
      else appendServiceLogEntries(String(payload.message ?? event.data));
    };

    socket.onerror = () => {
      if (!mountedRef.current) return;
      setServiceLogsConnected(false);
      setServiceLogsError("Live log connection error.");
    };

    socket.onclose = (evt) => {
      if (!mountedRef.current) return;
      setServiceLogsConnected(false);
      if (!serviceLogShouldReconnectRef.current || evt.wasClean) return;

      serviceLogReconnectAttemptRef.current += 1;
      const attempt = serviceLogReconnectAttemptRef.current;
      const delay = Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));

      serviceLogReconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current || !serviceLogShouldReconnectRef.current) return;
        connectServiceLogStream();
      }, delay);

      setServiceLogsError(`Live log stream disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`);
    };
  }, [id, appendServiceLogEntries]);

  const refreshServiceLogs = useCallback(async () => {
    stopServiceLogConnection();
    await fetchServiceLogs();
    connectServiceLogStream();
  }, [stopServiceLogConnection, fetchServiceLogs, connectServiceLogStream]);

  const fetchDeployLogsInitial = useCallback(async (deployId) => {
    if (!deployId) return;
    setDeployLogLoading(true); setDeployLogError(null); setDeployLogEntries([]);
    deployLogOldestCursorRef.current = null; deployLogNewestCursorRef.current = null; deployLogHasMoreOlderRef.current = false;

    try {
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}${deployId}/logs/`, params: { limit: DEPLOY_LOG_PAGE_SIZE } });
      setDeployLogEntries(normalizeTextEntries(resp.data?.logs));
      deployLogOldestCursorRef.current = resp.data?.next_before || null;
      deployLogNewestCursorRef.current = resp.data?.latest_after || null;
      deployLogHasMoreOlderRef.current = Boolean(resp.data?.has_more_older);
    } catch (err) {
      if (!mountedRef.current) return;
      setDeployLogError(err.response?.data?.detail || "Unable to load deploy history.");
    } finally {
      if (mountedRef.current) setDeployLogLoading(false);
    }
  }, []);

  const loadOlderDeployLogs = useCallback(async () => {
    if (!deployLogDeployId || !deployLogHasMoreOlderRef.current || !deployLogOldestCursorRef.current || deployLogLoadingOlder) return;

    const scroller = deployLogScrollRef.current;
    const prevHeight = scroller?.scrollHeight || 0;
    const prevTop = scroller?.scrollTop || 0;

    setDeployLogLoadingOlder(true);
    try {
      const resp = await apiRequest({
        method: "GET", url: `${DEPLOY_BASE}${deployLogDeployId}/logs/`,
        params: { limit: DEPLOY_LOG_PAGE_SIZE, before: deployLogOldestCursorRef.current },
      });
      const older = normalizeTextEntries(resp.data?.logs);
      if (older.length) setDeployLogEntries((prev) => mergeEntriesPrepend(prev, older));

      deployLogOldestCursorRef.current = resp.data?.next_before || deployLogOldestCursorRef.current;
      deployLogNewestCursorRef.current = resp.data?.latest_after || deployLogNewestCursorRef.current;
      deployLogHasMoreOlderRef.current = Boolean(resp.data?.has_more_older);

      requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = scroller.scrollHeight - prevHeight + prevTop;
      });
    } catch (err) {
      if (mountedRef.current) setDeployLogError(err.response?.data?.detail || "Unable to load older deploy logs.");
    } finally {
      if (mountedRef.current) setDeployLogLoadingOlder(false);
    }
  }, [deployLogDeployId, deployLogLoadingOlder]);

  const pollNewDeployLogs = useCallback(async () => {
    if (!deployLogDeployId || deployLogPollLockRef.current) return;

    deployLogPollLockRef.current = true;
    try {
      const params = { limit: 100 };
      if (deployLogNewestCursorRef.current) {
        params.after = deployLogNewestCursorRef.current;
      }
      const resp = await apiRequest({
        method: "GET",
        url: `${DEPLOY_BASE}${deployLogDeployId}/logs/`,
        params,
      });
      const fresh = normalizeTextEntries(resp.data?.logs);
      if (fresh.length) {
        setDeployLogEntries((prev) => mergeEntries(prev, fresh));
        deployLogNewestCursorRef.current =
          resp.data?.next_after ||
          resp.data?.latest_after ||
          deployLogNewestCursorRef.current;
      } else if (!deployLogNewestCursorRef.current) {
        deployLogNewestCursorRef.current =
          resp.data?.latest_after || resp.data?.next_after || null;
      }
    } catch (err) {
      /* silent poll failure */
    } finally {
      deployLogPollLockRef.current = false;
    }
  }, [deployLogDeployId]);

  const selectedDeployId = service?.selected_deploy ? String(service.selected_deploy.id ?? service.selected_deploy) : "";
  const selectedDeploy = useMemo(() => {
    if (!selectedDeployId) return null;
    return deploys.find((d) => String(d.id ?? d.pk ?? "") === selectedDeployId) || null;
  }, [deploys, selectedDeployId]);

  const selectedPlatform = useMemo(() => (selectedDeploy ? getDeployPlatform(selectedDeploy) : ""), [selectedDeploy]);
  const selectedIsDb = useMemo(() => (selectedDeploy ? isDbPlatform(selectedDeploy) : false), [selectedDeploy]);

  const planPlatform = useMemo(() => {
    const raw = planDetail?.platform ?? service?.plan?.platform ?? service?.plan_detail?.platform ?? "";
    return String(raw || "").toLowerCase().trim();
  }, [planDetail, service]);

  useEffect(() => {
    if (!planPlatform) return;
    setCreatePlatform(planPlatform);
    if (!editingDeployId) setEditData((d) => ({ ...d, platform: planPlatform }));
  }, [planPlatform, editingDeployId]);

  const serviceBusy = useMemo(() => Boolean(service && ["queued", "deploying", "stopping"].includes(String(service.status || "").toLowerCase())), [service]);

  useEffect(() => {
    if (!selectedDeploy || !selectedIsDb) {
      setDbConfigFields({ root_password: "", password: "", username: "", database: "", port: "", env: "" });
      return;
    }
    const cfg = parseDeployConfig(selectedDeploy.config);
    setDbConfigFields({
      root_password: cfg.root_password != null ? String(cfg.root_password) : "",
      password: cfg.password != null ? String(cfg.password) : "",
      username: cfg.username != null ? String(cfg.username) : "",
      database: cfg.database != null ? String(cfg.database) : "",
      port: cfg.port != null ? String(cfg.port) : "",
      env: cfg.env != null ? (typeof cfg.env === "string" ? cfg.env : JSON.stringify(cfg.env, null, 2)) : "",
    });
  }, [selectedDeploy, selectedIsDb]);

  const currentDeployForLogs = useMemo(() => {
    if (!deployLogDeployId) return null;
    return deploys.find((d) => String(d.id ?? d.pk ?? "") === String(deployLogDeployId)) || null;
  }, [deployLogDeployId, deploys]);

  const networkName = useMemo(() => (service?.network?.name || networkDetail?.network?.name || networkDetail?.name || "—"), [service, networkDetail]);
  const deployCount = deploys.length;
  const volumeCount = attachedVolumes.length;

  useEffect(() => {
    if (!id) return;
    const boot = async () => {
      await Promise.allSettled([fetchService(), fetchDeploys(1), checkServiceRunning(true), fetchAvailableNetworks(), fetchAvailableVolumes(), fetchAttachedVolumes(), fetchPlans()]);
    };
    boot();
  }, [id, fetchService, fetchDeploys, checkServiceRunning, fetchAvailableNetworks, fetchAvailableVolumes, fetchAttachedVolumes, fetchPlans]);

  useEffect(() => {
    if (!service?.network?.id) setSelectedNetworkId("");
    else setSelectedNetworkId(String(service.network.id));
  }, [service?.network?.id]);

  useEffect(() => {
    if (deploys.length === 0) return;
    if (!deployLogManualSelectRef.current) {
      const nextId = selectedDeployId || String(deploys[0].id ?? deploys[0].pk ?? "");
      if (nextId && nextId !== deployLogDeployId) setDeployLogDeployId(nextId);
    }
  }, [deploys, selectedDeployId, deployLogDeployId]);

  useEffect(() => {
    if (!deployLogDeployId || activeTab !== "logs") return;
    fetchDeployLogsInitial(deployLogDeployId);
  }, [deployLogDeployId, activeTab, fetchDeployLogsInitial]);

  // Live deploy events via DeploymentConsumer WebSocket
  useEffect(() => {
    if (activeTab !== "logs" || !deployLogDeployId) {
      stopDeployLogWs();
      return undefined;
    }
    connectDeployLogStream(deployLogDeployId);
    return () => stopDeployLogWs();
  }, [activeTab, deployLogDeployId, connectDeployLogStream, stopDeployLogWs]);

  useEffect(() => {
    if (activeTab !== "logs") {
      stopServiceLogConnection();
      if (deployLogPollTimerRef.current) { clearInterval(deployLogPollTimerRef.current); deployLogPollTimerRef.current = null; }
      return;
    }
    fetchServiceLogs();
    connectServiceLogStream();
    return () => stopServiceLogConnection();
  }, [activeTab, fetchServiceLogs, connectServiceLogStream, stopServiceLogConnection]);

  useEffect(() => {
    if (activeTab !== "logs" || !deployLogDeployId) {
      if (deployLogPollTimerRef.current) { clearInterval(deployLogPollTimerRef.current); deployLogPollTimerRef.current = null; }
      return;
    }
    // Poll as fallback even without cursor; live WS is primary while connected
    const active = ["queued", "deploying", "running", "stopping", "pending"].includes(
      String(service?.status || "").toLowerCase()
    );
    const deployActive = ["pending", "running", "rolling_back"].includes(
      String(
        (deploys.find((d) => String(d.id ?? d.pk) === String(deployLogDeployId)) || {})
          .status || ""
      ).toLowerCase()
    );
    if (!active && !deployActive) {
      if (deployLogPollTimerRef.current) { clearInterval(deployLogPollTimerRef.current); deployLogPollTimerRef.current = null; }
      return;
    }
    if (deployLogPollTimerRef.current) { clearInterval(deployLogPollTimerRef.current); deployLogPollTimerRef.current = null; }
    deployLogPollTimerRef.current = setInterval(() => {
      if (!document.hidden) pollNewDeployLogs();
    }, DEPLOY_LOG_POLL_INTERVAL);
    return () => {
      if (deployLogPollTimerRef.current) {
        clearInterval(deployLogPollTimerRef.current);
        deployLogPollTimerRef.current = null;
      }
    };
  }, [activeTab, deployLogDeployId, service?.status, deploys, pollNewDeployLogs]);

  useEffect(() => {
    if (!isDesktop) setActiveTab((current) => current || "overview");
  }, [isDesktop]);

  useEffect(() => {
    pageInfoRef.current = pageInfo;
  }, [pageInfo]);

  const setAction = useCallback((deployId, patch) => {
    setActionState((prev) => ({ ...prev, [deployId]: { ...(prev[deployId] ?? {}), ...patch } }));
  }, []);

  const silentRefresh = useCallback(async () => {
    if (!id || !mountedRef.current || autoRefreshBusyRef.current || (typeof document !== "undefined" && document.hidden)) return;
    autoRefreshBusyRef.current = true;
    try {
      await Promise.allSettled([fetchService(true), fetchDeploys(pageInfoRef.current?.page || 1, true), checkServiceRunning(true), fetchAttachedVolumes()]);
    } catch (err) {} finally { autoRefreshBusyRef.current = false; }
  }, [id, fetchService, fetchDeploys, checkServiceRunning, fetchAttachedVolumes]);

  useEffect(() => {
    if (refreshIntervalRef.current) { clearInterval(refreshIntervalRef.current); refreshIntervalRef.current = null; }
    if (!id || !refreshIntervalMs || refreshIntervalMs < 1000) return undefined;
    refreshIntervalRef.current = setInterval(() => { silentRefresh(); }, refreshIntervalMs);
    return () => { if (refreshIntervalRef.current) { clearInterval(refreshIntervalRef.current); refreshIntervalRef.current = null; } };
  }, [id, refreshIntervalMs, silentRefresh]);

  const openConfirm = (type, deployId, title, message) => setConfirmDialog({ open: true, type, deployId, title, message, loading: false });
  const closeConfirm = () => setConfirmDialog({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const handleEditClick = useCallback((deploy) => {
    const platform = getDeployPlatform(deploy);
    const cfg = parseDeployConfig(deploy.config);
    setEditingDeployId(deploy.id);
    setEditData({ name: deploy.name || "", version: deploy.version || "", config: typeof deploy.config === "string" ? deploy.config : deploy.config ? JSON.stringify(deploy.config, null, 2) : "", platform });
    setEditDbFields({
      root_password: cfg.root_password != null ? String(cfg.root_password) : "",
      password: cfg.password != null ? String(cfg.password) : "",
      username: cfg.username != null ? String(cfg.username) : "",
      database: cfg.database != null ? String(cfg.database) : "",
      port: cfg.port != null ? String(cfg.port) : "",
      env: cfg.env != null ? (typeof cfg.env === "string" ? cfg.env : JSON.stringify(cfg.env, null, 2)) : "",
    });
    setEditOriginalName(deploy.name || "");
    setEditZipFile(null);
    setError(null);
    setActiveTab("create");
    document.querySelector(".create-deploy-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingDeployId(null);
    setEditData({ name: "", version: "", config: "", platform: "docker" });
    setEditDbFields({ root_password: "", password: "", username: "", database: "", port: "", env: "" });
    setEditOriginalName("");
    setEditZipFile(null);
    if (editZipInputRef.current) editZipInputRef.current.value = "";
  }, []);

  const handleCreate = async (e) => {
    e?.preventDefault();
    setError(null); setSnackbar(null);

    if (!name || name.length < 4) { setError("Name must be at least 4 characters."); return; }

    const effectivePlatform = planPlatform || createPlatform || "docker";
    const effectiveIsDb = isDbPlatform(effectivePlatform);
    let configPayload;
    try {
      configPayload = buildConfigPayload(effectivePlatform, { configText: config, dbFields: createDbFields, isDb: effectiveIsDb });
    } catch (cfgErr) {
      setError(cfgErr?.message || "Invalid config JSON.");
      setSubmitting(false);
      return;
    }

    if (effectiveIsDb) {
      const cfg = typeof configPayload === "object" && configPayload ? configPayload : {};
      const p = String(effectivePlatform || "").toLowerCase();
      if ((p === "mysql" || p === "mariadb") && !String(cfg.root_password || cfg.password || "").trim()) { setError("MySQL/MariaDB requires root_password (or password)."); return; }
      if (p === "postgresql" && !String(cfg.password || "").trim()) { setError("PostgreSQL requires password."); return; }
      if (p === "mongodb" && (!String(cfg.username || "").trim() || !String(cfg.password || "").trim())) { setError("MongoDB requires username and password."); return; }
      if (p === "oracle" && !String(cfg.password || "").trim()) { setError("Oracle requires password."); return; }
    }

    if (!effectiveIsDb && !zipFile) { setError("App deploys require a .zip source package."); return; }

    setSubmitting(true);
    try {
      const nameCheck = await checkDeployNameAvailable(name);
      if (!nameCheck.ok) { setError(nameCheck.detail || "Name is not available."); setSubmitting(false); return; }

      if (effectiveIsDb || !zipFile) {
        const payload = { name, service: id, version, config: configPayload };
        const createResp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}`, data: payload });
        if (createResp.status === 201) {
          safeSetSnackbar("success", effectiveIsDb ? "DB deploy created." : "Deploy created.");
          await fetchDeploys(1);
          setName(""); setVersion(""); setConfig("");
          setCreateDbFields({ root_password: "", password: "", username: "", database: "", port: "", env: "" });
        } else { setError("Create request failed."); }
      } else {
        const fd = new FormData();
        fd.append("name", name); fd.append("service", id);
        if (version) fd.append("version", version);
        if (configPayload) fd.append("config", typeof configPayload === "string" ? configPayload : JSON.stringify(configPayload ?? {}));
        fd.append("zip_file", zipFile);

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.post(`${DEPLOY_BASE}`, fd, { headers });

        if (resp.status === 201) {
          safeSetSnackbar("success", "App deploy created.");
          await fetchDeploys(1);
          setName(""); setVersion(""); setConfig(""); setZipFile(null);
          if (zipInputRef.current) zipInputRef.current.value = "";
        } else { setError("Create upload failed."); }
      }
    } catch (err) {
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Unexpected error creating deploy.");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleUpdateDeploy = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { updating: true });

    try {
      if (!editData.name || editData.name.length < 4) { setError("Name must be at least 4 characters."); setAction(deployId, { updating: false }); return; }

      const nameCheck = await checkDeployNameAvailable(editData.name);
      if (!nameCheck.ok) { setError(nameCheck.detail || "Name is not available."); setAction(deployId, { updating: false }); return; }

      const effectivePlatform = editData.platform || planPlatform || createPlatform || "docker";
      const effectiveIsDb = isDbPlatform(effectivePlatform);
      let configPayload;
      try {
        configPayload = buildConfigPayload(effectivePlatform, { configText: editData.config, dbFields: editDbFields, isDb: effectiveIsDb });
      } catch (cfgErr) {
        setError(cfgErr?.message || "Invalid config JSON.");
        setSubmitting(false);
        return;
      }

      if (effectiveIsDb || !editZipFile) {
        const payload = { name: editData.name, version: editData.version, config: configPayload };
        const resp = await apiRequest({ method: "PUT", url: `${DEPLOY_BASE}${deployId}/`, data: payload });
        if (resp.status === 200) { safeSetSnackbar("success", "Deploy updated."); await fetchDeploys(pageInfo.page); handleCancelEdit(); }
        else setError("Update failed.");
      } else {
        const fd = new FormData();
        fd.append("name", editData.name); fd.append("service", id);
        if (editData.version) fd.append("version", editData.version);
        if (configPayload) fd.append("config", typeof configPayload === "string" ? configPayload : JSON.stringify(configPayload ?? {}));
        fd.append("zip_file", editZipFile);

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.put(`${DEPLOY_BASE}${deployId}/`, fd, { headers });

        if (resp.status === 200) { safeSetSnackbar("success", "Deploy updated."); await fetchDeploys(pageInfo.page); handleCancelEdit(); }
        else setError("Update file upload failed.");
      }
    } catch (err) {
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected update error");
    } finally {
      setAction(deployId, { updating: false });
    }
  };

  const handleDeleteDeploy = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { deleting: true });
    try {
      const resp = await apiRequest({ method: "DELETE", url: `${DEPLOY_BASE}${deployId}/` });
      if (resp.status >= 200 && resp.status < 300) { safeSetSnackbar("success", "Deploy deleted."); await fetchDeploys(pageInfo.page); }
      else setError("Delete failed.");
    } catch (err) {
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected delete error");
    } finally {
      setAction(deployId, { deleting: false });
    }
  };

  const handleSelectDeploy = useCallback(async (deployOrId) => {
    const deployId = typeof deployOrId === "object" && deployOrId != null ? deployOrId.id ?? deployOrId.pk : deployOrId;
    if (!deployId || !id) return;
    setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), selecting: true } }));

    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}set_deploy/`, data: { deploy_id: String(deployId), service_id: String(id) } });
      if (resp.data?.result === "success") { safeSetSnackbar("success", resp.data.detail || "Deploy selected."); await fetchService(true); await fetchDeploys(pageInfo.page); }
      else safeSetSnackbar("error", resp.data?.detail || "Select failed.");
    } catch (err) {
      safeSetSnackbar("error", String(err?.response?.data?.detail || err?.response?.data?.error || "Failed to select deploy."));
    } finally {
      setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), selecting: false } }));
    }
  }, [id, pageInfo.page, safeSetSnackbar, fetchService, fetchDeploys]);

  const handleUnselectDeploy = useCallback(async (deployOrId) => {
    const deployId = typeof deployOrId === "object" && deployOrId != null ? deployOrId.id ?? deployOrId.pk : deployOrId;
    if (!deployId || !id) return;
    setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), selecting: true } }));

    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}unset_deploy/`, data: { deploy_id: String(deployId), service_id: String(id) } });
      if (resp.data?.result === "success") { safeSetSnackbar("success", resp.data.detail || "Deploy unselected."); await fetchService(true); await fetchDeploys(pageInfo.page); }
      else safeSetSnackbar("error", resp.data?.detail || "Unselect failed.");
    } catch (err) {
      safeSetSnackbar("error", String(err?.response?.data?.detail || err?.response?.data?.error || "Failed to unselect deploy."));
    } finally {
      setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), selecting: false } }));
    }
  }, [id, pageInfo.page, safeSetSnackbar, fetchService, fetchDeploys]);

  const startService = async ({ forceRebuild = false } = {}) => {
    if (!id) return;
    setError(null); setSnackbar(null);
    if (forceRebuild) setRebuildLoading(true);

    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}start_service/`, data: { service_id: id, ...(forceRebuild ? { force_rebuild: true } : {}) } });
      if (resp.status === 202) {
        safeSetSnackbar("success", resp.data?.detail || (forceRebuild ? "Rebuild queued." : "Service start requested."));
        await fetchService();
        setTimeout(() => { if (mountedRef.current) checkServiceRunning(true); }, 1500);
        setTimeout(() => { if (mountedRef.current) { fetchService(true); checkServiceRunning(true); } }, 4000);
      } else { setError(forceRebuild ? "Failed to rebuild service." : "Failed to start service."); }
    } catch (err) {
      setError(err.response?.data?.detail || (err.response ? JSON.stringify(err.response.data) : "Error starting service"));
    } finally {
      if (forceRebuild && mountedRef.current) setRebuildLoading(false);
    }
  };

  const rebuildService = async () => {
    if (!id) return;
    setError(null); setSnackbar(null); setRebuildLoading(true);
    const deployId = selectedDeployId || selectedDeploy?.id || selectedDeploy?.pk;

    try {
      if (deployId) {
        try {
          const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}${deployId}/rebuild/` });
          if (resp.status === 202 || resp.data?.result === "success") {
            safeSetSnackbar("success", resp.data?.detail || (selectedIsDb ? "DB rebuild queued (volumes preserved)." : "App rebuild queued (image rebuilt from zip)."));
            await fetchService();
            setTimeout(() => { if (mountedRef.current) checkServiceRunning(true); }, 1500);
            setTimeout(() => { if (mountedRef.current) { fetchService(true); checkServiceRunning(true); } }, 4000);
            return;
          }
        } catch (rebuildErr) { }
      }
      await startService({ forceRebuild: true });
    } catch (err) {
      setError(err.response?.data?.detail || (err.response ? JSON.stringify(err.response.data) : "Error rebuilding service"));
    } finally {
      if (mountedRef.current) setRebuildLoading(false);
    }
  };

  const handleUpdateDbConfig = async () => {
    const deployId = selectedDeployId || selectedDeploy?.id || selectedDeploy?.pk;
    if (!deployId || !selectedIsDb) { setError("Select a DB deploy first."); return; }
    setDbConfigSaving(true); setError(null);
    try {
      const body = {};
      for (const key of MUTABLE_DB_CONFIG_KEYS) {
        const v = dbConfigFields[key];
        if (v === undefined || v === null || String(v).trim() === "") continue;
        if (key === "port") { const n = Number(v); body.port = Number.isNaN(n) ? v : n; }
        else if (key === "env") { try { body.env = JSON.parse(v); } catch { body.env = v; } }
        else body[key] = v;
      }
      if (!Object.keys(body).length) { setError("Provide at least one credential field to update."); return; }

      const resp = await apiRequest({ method: "PATCH", url: `${DEPLOY_BASE}${deployId}/update_db_config/`, data: body });
      if (resp.status === 200 || resp.data?.result === "success") {
        safeSetSnackbar("success", resp.data?.detail || "DB config updated. Use Rebuild to apply credentials.");
        await fetchDeploys(pageInfo.page); await fetchService(true);
      } else setError(resp.data?.detail || "Failed to update DB config.");
    } catch (err) {
      setError(err.response?.data?.detail || (err.response ? JSON.stringify(err.response.data) : "Error updating DB config"));
    } finally {
      if (mountedRef.current) setDbConfigSaving(false);
    }
  };

  const stopService = async () => {
    if (!id) return;
    setError(null); setSnackbar(null);
    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}stop_service/`, data: { service_id: id } });
      if (resp.status === 202) {
        safeSetSnackbar("success", "Service stop requested.");
        await fetchService();
        setTimeout(() => { if (mountedRef.current) checkServiceRunning(true); }, 1500);
        setTimeout(() => { if (mountedRef.current) { fetchService(true); checkServiceRunning(true); } }, 4000);
      } else setError("Failed to stop service.");
    } catch (err) {
      setError(err.response ? JSON.stringify(err.response.data) : "Error stopping service");
    }
  };

  const handleAttachNetwork = async (networkIdArg) => {
    const netId = networkIdArg != null && networkIdArg !== "" ? String(networkIdArg) : selectedNetworkId;
    if (!netId || !id) return;
    setNetworkActionLoading(true); setError(null); setSettingsSuccess(null);
    try {
      await apiRequest({ method: "PATCH", url: `${SERVICE_BASE}${id}/`, data: { network: netId } });
      setSelectedNetworkId(netId);
      safeSetSnackbar("success", "Network attached successfully.");
      setSettingsSuccess("Network attached successfully.");
      await fetchService(); await fetchAvailableNetworks();
    } catch (err) { setError(err.response?.data?.detail || err.response?.data?.error || "Unable to attach network."); }
    finally { if (mountedRef.current) setNetworkActionLoading(false); }
  };

  const handleDetachNetwork = async () => {
    if (!id) return;
    setNetworkActionLoading(true); setError(null);
    try {
      await apiRequest({ method: "PATCH", url: `${SERVICE_BASE}${id}/`, data: { network: null } });
      setSelectedNetworkId("");
      safeSetSnackbar("success", "Network detached successfully.");
      await fetchService(); await fetchAvailableNetworks();
    } catch (err) { setError(err.response?.data?.detail || err.response?.data?.error || "Unable to detach network."); }
    finally { if (mountedRef.current) setNetworkActionLoading(false); }
  };

  const handleAttachVolume = async (volumeIdArg) => {
    const volId = volumeIdArg != null && volumeIdArg !== "" ? String(volumeIdArg) : selectedVolumeId;
    if (!volId || !id) return;
    setVolumeActionLoading(true); setError(null); setSettingsSuccess(null);
    try {
      await apiRequest({ method: "PATCH", url: `${VOLUME_API_ROOT}${volId}/`, data: { service: id } });
      setSelectedVolumeId("");
      safeSetSnackbar("success", "Volume attached successfully.");
      setSettingsSuccess("Volume attached successfully.");
      await fetchAttachedVolumes(); await fetchAvailableVolumes();
    } catch (err) { setError(err.response?.data?.detail || err.response?.data?.error || "Unable to attach volume."); }
    finally { if (mountedRef.current) setVolumeActionLoading(false); }
  };

  const handleDetachVolume = async (volumeId) => {
    if (!volumeId) return;
    setVolumeActionLoading(true); setError(null);
    try {
      await apiRequest({ method: "PATCH", url: `${VOLUME_API_ROOT}${volumeId}/`, data: { service: null } });
      safeSetSnackbar("success", "Volume detached successfully.");
      await fetchAttachedVolumes(); await fetchAvailableVolumes();
    } catch (err) { setError(err.response?.data?.detail || err.response?.data?.error || "Unable to detach volume."); }
    finally { if (mountedRef.current) setVolumeActionLoading(false); }
  };

  const handleCreateNetwork = async ({ name, description }) => {
    setNetworkActionLoading(true);
    setError(null);
    setSettingsSuccess(null);
    try {
      await apiRequest({
        method: "POST",
        url: NETWORK_API_ROOT,
        data: { name, description: description || "" },
      });
      safeSetSnackbar("success", "Network created.");
      setSettingsSuccess("Network created successfully.");
      await fetchAvailableNetworks();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || err.response?.data?.errors || "Unable to create network.";
      setError(typeof msg === "object" ? JSON.stringify(msg) : msg);
      throw err;
    } finally {
      if (mountedRef.current) setNetworkActionLoading(false);
    }
  };

  const handleCreateVolume = async ({ name, size_mb, default_bind, default_mode, service: serviceId }) => {
    setVolumeActionLoading(true);
    setError(null);
    setSettingsSuccess(null);
    try {
      await apiRequest({
        method: "POST",
        url: VOLUME_API_ROOT,
        data: {
          name,
          size_mb,
          ...(default_bind ? { default_bind } : {}),
          ...(default_mode ? { default_mode } : {}),
          // Attach exclusively to this service so plan quota is enforced
          ...(serviceId || id ? { service: serviceId || id } : {}),
        },
      });
      safeSetSnackbar("success", "Volume created and attached to this service.");
      setSettingsSuccess("Volume created successfully.");
      await fetchAttachedVolumes();
      await fetchAvailableVolumes();
      await fetchService(true); // refresh storage quota on service
    } catch (err) {
      const msg =
        err.response?.data?.errors?.size_mb ||
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.response?.data?.errors ||
        "Unable to create volume.";
      setError(typeof msg === "object" ? JSON.stringify(msg) : msg);
      throw err;
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  };

  const handleApplyPlan = async (planId, applyImmediately = false) => {
    if (!planId || !id) return;
    setPlanActionLoading(true);
    setError(null);
    setSettingsSuccess(null);
    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${PLANS_BASE}plans/${planId}/apply/`,
        data: {
          target_type: "service",
          target_id: id,
          applyImmediately: Boolean(applyImmediately),
        },
      });
      const detail = resp.data?.detail || "Plan applied.";
      safeSetSnackbar("success", detail);
      setSettingsSuccess(detail);

      // Instant UI feedback: mark the applied plan as current and clear selection
      const applied = (availablePlans || []).find(
        (p) => String(p.id ?? p.pk ?? "") === String(planId)
      );
      if (applied) {
        setPlanDetail(applied);
        setService((prev) =>
          prev
            ? {
                ...prev,
                plan: typeof prev.plan === "object" && prev.plan
                  ? { ...prev.plan, ...applied }
                  : applied,
              }
            : prev
        );
      }
      setSelectedPlanId("");

      await fetchService(true);
      await fetchPlans();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.response?.data?.result ||
        "Unable to apply plan.";
      setError(typeof msg === "object" ? JSON.stringify(msg) : msg);
    } finally {
      if (mountedRef.current) setPlanActionLoading(false);
    }
  };

  const handleDownloadEntries = useCallback((filename, entries) => {
    const lines = (entries || []).map((entry) => getDeployEntryText(entry));
    if (!lines.length) { safeSetSnackbar("info", "No entries to download."); return; }
    downloadTextFile(filename, lines);
    safeSetSnackbar("success", "Download started.");
  }, [safeSetSnackbar]);

  const handleCopyEntries = useCallback(async (entries) => {
    const lines = (entries || []).map((entry) => getDeployEntryText(entry));
    if (!lines.length) { safeSetSnackbar("info", "No entries to copy."); return; }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      safeSetSnackbar("success", "Copied.");
    } catch { safeSetSnackbar("error", "Copy failed."); }
  }, [safeSetSnackbar]);

  const clearServiceLogs = () => setServiceLogsEntries([]);
  const clearDeployLogs = () => setDeployLogEntries([]);

  const handlePrev = () => {
    if (!pageInfo.previous) return;
    try { fetchDeploys(parseInt(new URL(pageInfo.previous).searchParams.get("page") || "1", 10)); }
    catch { fetchDeploys(Math.max(1, pageInfo.page - 1)); }
  };

  const handleNext = () => {
    if (!pageInfo.next) return;
    try { fetchDeploys(parseInt(new URL(pageInfo.next).searchParams.get("page") || String(pageInfo.page + 1), 10)); }
    catch { fetchDeploys(pageInfo.page + 1); }
  };

  const openServiceInNewTab = () => {
    if (!service?.service_name) return;
    const host = `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`;
    window.open(`http://${host}`, "_blank", "noopener,noreferrer");
  };

  const tabLabelMap = {
    overview: "Overview",
    create: "Deploys",
    logs: "Logs",
    settings: "Settings",
  };

  return (
    <Box
      sx={{
        p: { xs: 1, sm: 1.5, md: 2 },
        pb: { xs: 10, md: 2 },
      }}
    >
      <ServiceToolbar
          refreshIntervalMs={refreshIntervalMs}
          setRefreshIntervalMs={setRefreshIntervalMs}
          intervalMenuAnchor={intervalMenuAnchor}
          setIntervalMenuAnchor={setIntervalMenuAnchor}
          onRefresh={silentRefresh}
          navigate={navigate}
        />

      {/* Mobile: single sticky identity header (no duplicate stats elsewhere) */}
      {!isDesktop ? (
        <MobileServiceHeader
          service={service}
          serviceRunning={serviceRunning}
          selectedDeploy={selectedDeploy}
          selectedPlatform={selectedPlatform}
          selectedIsDb={selectedIsDb}
          deployCount={deployCount}
          volumeCount={volumeCount}
          networkName={networkName}
          activeTabLabel={tabLabelMap[activeTab] || activeTab}
        />
      ) : null}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {/* Desktop only sidebar */}
        {isDesktop ? (
          <Box sx={{ width: 240, flexShrink: 0 }}>
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
          </Box>
        ) : null}

        <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
          <GlobalServiceControls
            service={service}
            serviceRunning={serviceRunning}
            serviceCpu={serviceCpu}
            serviceRam={serviceRam}
            serviceLoading={serviceLoading}
            serviceBusy={serviceBusy}
            serviceStatusLoadingManual={serviceStatusLoadingManual}
            selectedDeploy={selectedDeploy}
            selectedDeployId={selectedDeployId}
            selectedIsDb={selectedIsDb}
            selectedPlatform={selectedPlatform}
            deployCount={deployCount}
            volumeCount={volumeCount}
            networkName={networkName}
            rebuildLoading={rebuildLoading}
            compact={!isDesktop}
            actions={{ startService, stopService, rebuildService, checkServiceRunning, openServiceInNewTab }}
          />

          {activeTab === "overview" && (
            <OverviewPanel
              service={service}
              serviceRunning={serviceRunning}
              selectedDeploy={selectedDeploy}
              planDetail={planDetail}
              networkName={networkName}
              networkDetail={networkDetail}
              hideServiceIdentity={!isDesktop}
            />
          )}

          {activeTab === "create" && (
            <CreateDeployPanel
              formState={{ name, version, config, zipFile, createPlatform, createDbFields, submitting, zipInputRef }}
              formActions={{ setName, setVersion, setConfig, setZipFile, setCreatePlatform, setCreateDbFields, handleCreate }}
              editState={{ editingDeployId, editData, editDbFields, editOriginalName, editZipFile, editZipInputRef }}
              editActions={{ setEditData, setEditDbFields, setEditZipFile, handleUpdateDeploy, handleCancelEdit }}
              deployState={{ deploys, deploysLoading, pageInfo, selectedDeployId, actionState }}
              deployActions={{ handleSelectDeploy, handleUnselectDeploy, handleEditClick, openConfirm, handlePrev, handleNext, handleDownloadZip }}
              planPlatform={planPlatform}
              service={service}
              error={error}
            />
          )}

          {activeTab === "logs" && (
            <LogsPanel
              serviceLogs={{ entries: serviceLogsEntries, loading: serviceLogsLoading, error: serviceLogsError, connected: serviceLogsConnected, paused: serviceLogsPaused, filter: serviceLogsFilter, level: serviceLogsLevel }}
              serviceLogActions={{ setFilter: setServiceLogsFilter, setLevel: setServiceLogsLevel, onTogglePaused: () => setServiceLogsPaused((v) => !v), refresh: refreshServiceLogs, clear: clearServiceLogs, scrollRef: serviceLogScrollRef }}
              deployLogs={{ entries: deployLogEntries, loading: deployLogLoading, loadingOlder: deployLogLoadingOlder, error: deployLogError, filter: deployLogFilter, level: deployLogLevel, deployId: deployLogDeployId, hasMoreOlder: deployLogHasMoreOlderRef.current, connected: deployLogLiveConnected }}
              deployLogActions={{ setFilter: setDeployLogFilter, setLevel: setDeployLogLevel, setDeployId: (val) => { deployLogManualSelectRef.current = true; setDeployLogDeployId(String(val)); }, refresh: fetchDeployLogsInitial, clear: clearDeployLogs, loadOlder: loadOlderDeployLogs, scrollRef: deployLogScrollRef }}
              deploys={deploys}
              currentDeployForLogs={currentDeployForLogs}
              id={id}
              isDesktop={isDesktop}
              handleDownloadEntries={handleDownloadEntries}
              handleCopyEntries={handleCopyEntries}
            />
          )}

          {activeTab === "settings" && (
            <SettingsPanel
              service={service}
              planDetail={planDetail}
              networkName={networkName}
              networkDetail={networkDetail}
              selectedNetworkId={selectedNetworkId}
              setSelectedNetworkId={setSelectedNetworkId}
              availableNetworks={availableNetworks}
              networkActionLoading={networkActionLoading}
              onAttachNetwork={handleAttachNetwork}
              onDetachNetwork={handleDetachNetwork}
              onCreateNetwork={handleCreateNetwork}
              attachedVolumes={attachedVolumes}
              availableVolumes={availableVolumes}
              selectedVolumeId={selectedVolumeId}
              setSelectedVolumeId={setSelectedVolumeId}
              volumeActionLoading={volumeActionLoading}
              onAttachVolume={handleAttachVolume}
              onDetachVolume={handleDetachVolume}
              onCreateVolume={handleCreateVolume}
              availablePlans={availablePlans}
              plansLoading={plansLoading}
              selectedPlanId={selectedPlanId}
              setSelectedPlanId={setSelectedPlanId}
              planActionLoading={planActionLoading}
              onApplyPlan={handleApplyPlan}
              error={error}
              successMessage={settingsSuccess}
            />
          )}
        </Box>

        {/* Mobile edge nav FAB + bottom sheet */}
        {!isDesktop ? (
          <MobileNavFab
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

        <Snackbar
          open={!!snackbar}
          autoHideDuration={6000}
          onClose={() => setSnackbar(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert onClose={() => setSnackbar(null)} severity={snackbar?.severity || "info"} sx={{ width: '100%' }}>
            {snackbar?.message}
          </Alert>
        </Snackbar>

        <Dialog open={filesDialogOpen} onClose={() => setFilesDialogOpen(false)}>
          <DialogTitle>Volume Files</DialogTitle>
          <DialogContent>
            {volumeActionLoading ? <CircularProgress size={24} /> : (
              volumeFiles.length ? (
                volumeFiles.map((f, i) => <Typography key={i}>{f}</Typography>)
              ) : <Typography>No files.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFilesDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={confirmDialog.open} onClose={closeConfirm}>
          <DialogTitle>{confirmDialog.title}</DialogTitle>
          <DialogContent>
            <Typography>{confirmDialog.message}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirm} disabled={confirmDialog.loading}>Cancel</Button>
            <Button
              color="error"
              disabled={confirmDialog.loading}
              onClick={async () => {
                setConfirmDialog(p => ({ ...p, loading: true }));
                if (confirmDialog.type === "delete") {
                  await handleDeleteDeploy(confirmDialog.deployId);
                }
                closeConfirm();
              }}
            >
              {confirmDialog.loading ? "Confirming..." : "Confirm"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}