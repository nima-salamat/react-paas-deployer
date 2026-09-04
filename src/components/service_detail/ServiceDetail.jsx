import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import ShellPanel from "./components/ShellPanel";
import MobileNavFab from "./components/MobileNavFab";
import MobileServiceHeader from "./components/MobileServiceHeader";
import DashboardNavbar from "../dashboard/DashboardNavbar.jsx";
import useServiceLogs from "./hooks/useServiceLogs";
import useDeployLogs from "./hooks/useDeployLogs";

import {
  API_BASE,
  DEPLOY_BASE,
  DEPLOY_DOWNLOAD_BASE,
  SERVICE_BASE,
  SERVICE_ACTION_ROOT,
  NETWORK_API_ROOT,
  VOLUME_API_ROOT,
  PLANS_BASE,
  DEFAULT_REFRESH_INTERVAL_MS,
  MUTABLE_DB_CONFIG_KEYS,
} from "./constants";

import {
  getDeployPlatform,
  isDbPlatform,
  buildConfigPayload,
  parseDeployConfig,
  mergeObjects,
  downloadTextFile,
  getDeployEntryText,
} from "./utils";

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // Seed from list navigation so the page paints immediately without waiting for network.
  const serviceSeed = useMemo(() => {
    const seed = location.state?.serviceSeed;
    if (!seed) return null;
    const seedId = seed.id ?? seed.pk;
    if (seedId == null || String(seedId) !== String(id)) return null;
    return seed;
  }, [location.state, id]);

  const [activeTab, setActiveTab] = useState("overview");
  const [shareAccess, setShareAccess] = useState({ loading: true, is_owner: true, permissions: null });
  const meId = useMemo(() => {
    try {
      const raw = localStorage.getItem("user") || localStorage.getItem("me");
      if (raw) {
        const u = JSON.parse(raw);
        return u?.id ?? u?.pk ?? null;
      }
    } catch { /* */ }
    return null;
  }, []);


  const [refreshIntervalMs, setRefreshIntervalMs] = useState(DEFAULT_REFRESH_INTERVAL_MS);
  const [intervalMenuAnchor, setIntervalMenuAnchor] = useState(null);

  const [service, setService] = useState(serviceSeed);
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
  const [forceCancelLoading, setForceCancelLoading] = useState(false);
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

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const fetchDeploysLock = useRef(false);
  const refreshIntervalRef = useRef(null);
  const pageInfoRef = useRef(pageInfo);
  const autoRefreshBusyRef = useRef(false);
  const zipInputRef = useRef(null);
  const editZipInputRef = useRef(null);

  // runtime service logs: useServiceLogs hook (single source of truth)
  const serviceLogs = useServiceLogs({
    serviceId: id,
    enabled: Boolean(id) && activeTab === "logs",
  });

  // deploy logs: dedicated hook (WS + poll fallback)
  const [deployLogDeployId, setDeployLogDeployId] = useState("");
  const deployLogManualSelectRef = useRef(false);
  const deployLogDeployIdRef = useRef("");
  useEffect(() => {
    deployLogDeployIdRef.current = deployLogDeployId;
  }, [deployLogDeployId]);

  const currentDeployStatus = (() => {
    if (!deployLogDeployId) return "";
    const d = deploys.find((x) => String(x.id ?? x.pk ?? "") === String(deployLogDeployId));
    return d?.status || "";
  })();

  const deployLogsHook = useDeployLogs({
    deployId: deployLogDeployId,
    enabled: Boolean(deployLogDeployId) && activeTab === "logs",
    serviceStatus: service?.status,
    deployStatus: currentDeployStatus,
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${SERVICE_ACTION_ROOT}services/${id}/access/`,
        });
        if (cancelled) return;
        const data = res?.data || {};
        setShareAccess({
          loading: false,
          is_owner: Boolean(data.is_owner),
          permissions: data.permissions || {},
          share_id: data.share_id || null,
        });
      } catch {
        if (!cancelled) {
          // Fail closed — do not treat as owner on error
          setShareAccess({ loading: false, is_owner: false, permissions: {} });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const allowedTabs = useMemo(() => {
    if (shareAccess.loading) return ["overview"];
    if (shareAccess.is_owner) {
      return ["overview", "create", "logs", "settings", "shell"];
    }
    const p = shareAccess.permissions || {};
    const tabs = ["overview"];
    // Create deploy tab only when explicitly allowed to add deploys
    if (p.can_deploy_add) tabs.push("create");
    if (p.can_view_logs || p.can_view_deploy_logs) tabs.push("logs");
    if (p.can_change_config || p.can_network_change || p.can_volume_attach || p.can_volume_add) tabs.push("settings");
    if (p.can_shell) tabs.push("shell");
    return tabs;
  }, [shareAccess]);

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] || "overview");
    }
  }, [allowedTabs, activeTab]);



  useEffect(() => {
    deployLogDeployIdRef.current = deployLogDeployId;
  }, [deployLogDeployId]);

  const safeSetSnackbar = useCallback((severity, message) => {
    setSnackbar({ severity, message });
  }, []);

  const handleDownloadZip = useCallback(async (deploy) => {
    const deployId = deploy?.id ?? deploy?.pk;
    if (!deployId) return;

    if (!deploy?.zip_file) {
      safeSetSnackbar("info", "This deploy has no ZIP file.");
      return;
    }

    try {
      const token = localStorage.getItem("access");
      const url = `${DEPLOY_BASE}${deployId}/download/`;

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

  const appendServiceLogEntries = useCallback(() => { /* migrated to useServiceLogs */ }, []);

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
    let cancelled = false;
    const boot = async () => {
      // Critical path first so the header/overview can paint with real data ASAP.
      await fetchService(Boolean(serviceSeed));
      if (cancelled || !mountedRef.current) return;
      // Secondary data in parallel — does not block first paint.
      await Promise.allSettled([
        fetchDeploys(1),
        checkServiceRunning(true),
        fetchAvailableNetworks(),
        fetchAvailableVolumes(),
        fetchAttachedVolumes(),
        fetchPlans(),
      ]);
    };
    boot();
    return () => {
      cancelled = true;
    };
    // serviceSeed is only used as a one-shot hint for silent first fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // The Shell is stateful (terminal history, cwd, open files, editor buffers).
    // Do not let the page-level service poll churn its parent state while the
    // user is actively working in the shell. ShellPanel owns its own refreshes.
    if (!id || activeTab === "shell" || !refreshIntervalMs || refreshIntervalMs < 1000) {
      return undefined;
    }

    refreshIntervalRef.current = setInterval(() => {
      if (document.hidden) return;
      silentRefresh();
    }, refreshIntervalMs);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [id, activeTab, refreshIntervalMs, silentRefresh]);

  const openConfirm = (type, deployId, title, message) => setConfirmDialog({ open: true, type, deployId, title, message, loading: false });
  const closeConfirm = () => setConfirmDialog({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const handleEditClick = useCallback((deploy) => {
    const platform = getDeployPlatform(deploy);
    const cfg = parseDeployConfig(deploy.config);
    setEditingDeployId(deploy.id);
    setEditData({ name: deploy.name || "", version: deploy.version || "", config: typeof deploy.config === "string" ? deploy.config : deploy.config ? JSON.stringify(deploy.config, null, 2) : "", platform });
    // Pre-fill DB fields from the deploy config.  NOTE: for DB platforms,
    // the regular API masks password/root_password/username via
    // MaskedDBConfigField, so cfg won't have them.  We do a follow-up
    // fetch via /deploy/<id>/reveal_db_credentials/ below to get the
    // real values so the user sees them in the edit form and doesn't
    // accidentally overwrite them with "" by saving without typing.
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

    // For DB-platform deploys, fetch the real (unmasked) credentials so
    // the edit form shows them and the user doesn't lose them by saving
    // with empty password fields.  This is owner-only; non-owners get
    // a 403 and we just leave the masked (empty) values in place.
    if (isDbPlatform(platform)) {
      const deployId = deploy.id || deploy.pk;
      (async () => {
        try {
          const access = localStorage.getItem("access");
          const headers = access ? { Authorization: `Bearer ${access}` } : {};
          const resp = await fetch(`${DEPLOY_BASE}${deployId}/reveal_db_credentials/`, { headers });
          if (!resp.ok) return; // silently fail — form still works, just empty
          const data = await resp.json();
          if (data.result === "success" && data.config) {
            const c = data.config;
            setEditDbFields((prev) => ({
              ...prev,
              root_password: c.root_password != null ? String(c.root_password) : prev.root_password,
              password:      c.password      != null ? String(c.password)      : prev.password,
              username:      c.username      != null ? String(c.username)      : prev.username,
              database:      c.database      != null ? String(c.database)      : prev.database,
              port:          c.port          != null ? String(c.port)          : prev.port,
              env:           c.env           != null
                              ? (typeof c.env === "string" ? c.env : JSON.stringify(c.env, null, 2))
                              : prev.env,
            }));
          }
        } catch {
          // Network error — leave the pre-filled (masked) values in place.
        }
      })();
    }
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

  const rebuildService = async ({ forceReinit = false } = {}) => {
    if (!id) return;
    setError(null); setSnackbar(null); setRebuildLoading(true);
    const deployId = selectedDeployId || selectedDeploy?.id || selectedDeploy?.pk;

    try {
      if (deployId) {
        try {
          // ---------------------------------------------------------------
          // Build the rebuild URL. For DB platforms, append ?force_reinit=true
          // when the operator armed the "Force re-initialize" checkbox in
          // GlobalServiceControls. The backend (deploy/apis.py rebuild
          // endpoint) parses this query param leniently (1/true/yes/on) and
          // forwards it as a kwarg to run_db_deploy, which in turn passes it
          // to DBDeployer().deploy(force_reinit=True). When True, the
          // deployer wipes every named Docker volume bound to the container
          // BEFORE starting it, so the database reinitialises from scratch.
          //
          // Host-bind paths (starting with "/") are NEVER wiped — only named
          // Docker volumes managed by the platform. (Enforced in db_deployer.py.)
          // ---------------------------------------------------------------
          const rebuildUrl = forceReinit && selectedIsDb
            ? `${DEPLOY_BASE}${deployId}/rebuild/?force_reinit=true`
            : `${DEPLOY_BASE}${deployId}/rebuild/`;

          const resp = await apiRequest({ method: "POST", url: rebuildUrl });
          if (resp.status === 202 || resp.data?.result === "success") {
            let defaultMsg;
            if (forceReinit && selectedIsDb) {
              defaultMsg = "DB rebuild queued (force_reinit=true — volumes will be wiped, ALL DATA LOST).";
            } else if (selectedIsDb) {
              defaultMsg = "DB rebuild queued (volumes preserved).";
            } else {
              defaultMsg = "App rebuild queued (image rebuilt from zip).";
            }
            safeSetSnackbar("success", resp.data?.detail || defaultMsg);
            await fetchService();
            setTimeout(() => { if (mountedRef.current) checkServiceRunning(true); }, 1500);
            setTimeout(() => { if (mountedRef.current) { fetchService(true); checkServiceRunning(true); } }, 4000);
            return;
          }
        } catch (rebuildErr) { }
      }
      // Fallback: start_service does NOT support force_reinit (it's a
      // deploy-level option, not a service-level one), so we ignore
      // forceReinit here on purpose. The operator should select a deploy
      // first if they want force_reinit semantics.
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


  const forceCancelDeploy = async () => {
    if (!id) return;
    setError(null); setSnackbar(null); setForceCancelLoading(true);
    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}force_cancel_deploy/`,
        data: { service_id: id },
      });
      const detail =
        resp?.data?.detail ||
        "Deployment cancelled and runtime cleaned up.";
      safeSetSnackbar(
        resp?.data?.result === "success" ? "success" : "warning",
        detail
      );
      await fetchService();
      await fetchDeploys(pageInfo.page);
      setTimeout(() => { if (mountedRef.current) checkServiceRunning(true); }, 1000);
      setTimeout(() => {
        if (mountedRef.current) {
          fetchService(true);
          checkServiceRunning(true);
        }
      }, 3000);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        (err.response ? JSON.stringify(err.response.data) : "Force cancel failed.");
      setError(typeof msg === "string" ? msg : "Force cancel failed.");
    } finally {
      if (mountedRef.current) setForceCancelLoading(false);
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



  const handlePurgeRuntime = useCallback(async () => {
    if (!id) return;
    setVolumeActionLoading(true);
    setError(null);
    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}purge_service_runtime/`,
        data: { service_id: id },
      });
      const detail = resp?.data?.detail || "Container & image removed.";
      safeSetSnackbar?.(resp?.data?.result === "success" ? "success" : "warning", detail);
      await fetchService?.(true);
      await checkServiceRunning?.(true);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to remove container/image.";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      throw err;
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  }, [id, safeSetSnackbar, fetchService, checkServiceRunning]);

  const handleUpdateVolume = useCallback(async (volume, fields) => {
    const volId = volume?.id ?? volume?.pk;
    if (!volId) return;
    setVolumeActionLoading(true);
    setError(null);
    try {
      await apiRequest({
        method: "PATCH",
        url: `${VOLUME_API_ROOT}${volId}/`,
        data: fields,
      });
      safeSetSnackbar("success", "Volume updated.");
      setSettingsSuccess?.("Volume updated.");
      await fetchAttachedVolumes();
      await fetchAvailableVolumes();
      await fetchService?.(true);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.errors ||
        "Unable to update volume.";
      setError(typeof msg === "object" ? JSON.stringify(msg) : msg);
      throw err;
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  }, [safeSetSnackbar, fetchAttachedVolumes, fetchAvailableVolumes, fetchService]);

  const handleDeleteVolume = useCallback(async (volume) => {
    const volId = volume?.id ?? volume?.pk;
    if (!volId) return;
    setVolumeActionLoading(true);
    setError(null);
    try {
      await apiRequest({ method: "DELETE", url: `${VOLUME_API_ROOT}${volId}/` });
      safeSetSnackbar("success", "Volume deleted.");
      await fetchAttachedVolumes();
      await fetchAvailableVolumes();
      await fetchService(true);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.errors ||
        "Unable to delete volume.";
      setError(typeof msg === "object" ? JSON.stringify(msg) : msg);
      throw err;
    } finally {
      if (mountedRef.current) setVolumeActionLoading(false);
    }
  }, [safeSetSnackbar, fetchAttachedVolumes, fetchAvailableVolumes, fetchService]);

  const handleViewVolumeFiles = useCallback(async (volume) => {
    const volId = volume?.id ?? volume?.pk;
    if (!volId) return [];
    const resp = await apiRequest({
      method: "GET",
      url: `${VOLUME_API_ROOT}${volId}/files/`,
    });
    const files = resp?.data?.files;
    if (Array.isArray(files)) return files;
    if (Array.isArray(resp?.data)) return resp.data;
    return [];
  }, []);

  const handleDownloadVolume = useCallback(async (volume) => {
    const volId = volume?.id ?? volume?.pk;
    if (!volId) return;
    try {
      const token = localStorage.getItem("access");
      const url = `${VOLUME_API_ROOT}${volId}/download/`;
      const resp = await axios.get(url, {
        responseType: "blob",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // If server returned JSON error as blob, surface it
      const ct = String(resp.headers["content-type"] || "");
      if (ct.includes("application/json")) {
        const text = await resp.data.text?.() || "";
        let detail = "Download failed.";
        try {
          detail = JSON.parse(text)?.detail || detail;
        } catch { /* ignore */ }
        safeSetSnackbar("error", detail);
        return;
      }
      const disposition = resp.headers["content-disposition"] || "";
      let filename = `${volume?.name || "volume"}.tar.gz`;
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) filename = match[1];
      const blobUrl = URL.createObjectURL(new Blob([resp.data], { type: "application/gzip" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      safeSetSnackbar("success", "Volume download started.");
    } catch (err) {
      const status = err?.response?.status;
      let msg = "Unable to download volume.";
      if (err?.response?.data instanceof Blob) {
        try {
          const t = await err.response.data.text();
          const j = JSON.parse(t);
          msg = j.detail || j.error || msg;
        } catch { /* ignore */ }
      } else {
        msg = err?.response?.data?.detail || err?.response?.data?.error || msg;
      }
      if (status === 404) msg = msg || "Docker volume not found. Rebuild the service first.";
      safeSetSnackbar("error", typeof msg === "string" ? msg : "Download failed.");
    }
  }, [safeSetSnackbar]);

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
    const host = service?.service_host || (service?.service_name
      ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`
      : "");
    if (!host) return;
    const url = /^https?:\/\//i.test(host) ? host : `https://${host}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const tabLabelMap = {
    overview: "Overview",
    create: "Deploys",
    logs: "Logs",
    settings: "Settings",
    shell: "Shell",
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        pb: { xs: 9, md: 2 },
      }}
    >
      <DashboardNavbar serviceDetail serviceName={service?.name || "Service"} />
      <Box sx={{ p: { xs: 1, sm: 1.5, md: 2 }, pt: { xs: 1, md: 2 } }}>
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
              allowedTabs={allowedTabs}
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
            actions={{ startService, stopService, rebuildService, forceCancelDeploy, checkServiceRunning, openServiceInNewTab }}
            forceCancelLoading={forceCancelLoading}
          />

          {activeTab === "overview" && (
            <OverviewPanel
              deployPermissions={shareAccess.is_owner ? null : (shareAccess.permissions || {})}
              isServiceOwner={shareAccess.is_owner}
              meId={meId}
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
              deployPermissions={shareAccess.is_owner ? null : (shareAccess.permissions || {})}
              isServiceOwner={Boolean(shareAccess.is_owner)}
              meId={meId}
              planPlatform={planPlatform}
              planCpu={planDetail?.max_cpu ?? service?.plan?.max_cpu}
              planRam={planDetail?.max_ram ?? service?.plan?.max_ram}
              service={service}
              error={error}
            />
          )}

          {activeTab === "logs" && (
            <LogsPanel
              serviceLogs={{
                entries: serviceLogs.entries,
                loading: serviceLogs.loading || serviceLogs.searching,
                error: serviceLogs.error,
                connected: serviceLogs.connected,
                reconnecting: serviceLogs.reconnecting,
                paused: serviceLogs.paused,
                filter: serviceLogs.filter,
                level: serviceLogs.level,
                searchMode: serviceLogs.searchMode,
                historyQInput: serviceLogs.historyQInput,
                gap: serviceLogs.gap,
                usage: serviceLogs.usage,
                policy: serviceLogs.policy,
                hasMoreOlder: serviceLogs.hasMoreOlder,
                loadingOlder: serviceLogs.loadingOlder,
                exporting: serviceLogs.exporting,
                searching: serviceLogs.searching,
              }}
              serviceLogActions={{
                setFilter: serviceLogs.setFilter,
                setLevel: serviceLogs.setLevel,
                setSearchMode: serviceLogs.setSearchMode,
                setHistoryQInput: serviceLogs.setHistoryQInput,
                onTogglePaused: () => serviceLogs.setPaused((p) => !p),
                refresh: serviceLogs.refresh,
                clear: serviceLogs.clear,
                scrollRef: serviceLogs.scrollRef,
                loadOlder: serviceLogs.loadOlder,
                jumpToLatest: serviceLogs.jumpToLatest,
                download: serviceLogs.download,
                setGap: serviceLogs.setGap,
                retryConnection: serviceLogs.retryConnection,
              }}
              deployLogs={{
                entries: deployLogsHook.entries,
                loading: deployLogsHook.loading,
                loadingOlder: deployLogsHook.loadingOlder,
                error: deployLogsHook.error,
                filter: deployLogsHook.filter,
                level: deployLogsHook.level,
                deployId: deployLogDeployId,
                hasMoreOlder: deployLogsHook.hasMoreOlder,
                connected: deployLogsHook.connected,
                reconnecting: deployLogsHook.reconnecting,
                exporting: deployLogsHook.exporting,
              }}
              deployLogActions={{
                download: deployLogsHook.download,
                setFilter: deployLogsHook.setFilter,
                setLevel: deployLogsHook.setLevel,
                setDeployId: (val) => {
                  deployLogManualSelectRef.current = true;
                  setDeployLogDeployId(String(val));
                },
                refresh: deployLogsHook.refresh,
                clear: deployLogsHook.clear,
                loadOlder: deployLogsHook.loadOlder,
                scrollRef: deployLogsHook.scrollRef,
                retryConnection: deployLogsHook.retryConnection,
              }}
              deploys={deploys}
              currentDeployForLogs={currentDeployForLogs}
              id={id}
              isDesktop={isDesktop}
              handleDownloadEntries={handleDownloadEntries}
              handleCopyEntries={handleCopyEntries}
            />
          )}

          <Box sx={{ display: activeTab === "shell" ? "block" : "none", minWidth: 0 }}>
            <ShellPanel
              service={service}
              enabled={Boolean(shareAccess.is_owner || shareAccess.permissions?.can_shell)}
            />
          </Box>

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
              onUpdateVolume={handleUpdateVolume}
              onDeleteVolume={handleDeleteVolume}
              onViewVolumeFiles={handleViewVolumeFiles}
              onDownloadVolume={handleDownloadVolume}
              canMutateVolumes={
                !["running", "queued", "deploying", "stopping"].includes(
                  String(service?.status || "").toLowerCase()
                ) && !serviceRunning
              }
              volumeMutateReason={
                serviceRunning || String(service?.status || "").toLowerCase() === "running"
                  ? "Service is running. Stop it, then remove the container before changing volumes."
                  : ["queued", "deploying", "stopping"].includes(
                      String(service?.status || "").toLowerCase()
                    )
                  ? `Service is ${service.status}. Wait until it is stopped.`
                  : "If attach/detach fails, remove the container first (image alone does not block volumes)."
              }
              onPurgeRuntime={handlePurgeRuntime}
              purgeRuntimeLoading={volumeActionLoading}
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
            allowedTabs={allowedTabs}
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
    </Box>
  );
}