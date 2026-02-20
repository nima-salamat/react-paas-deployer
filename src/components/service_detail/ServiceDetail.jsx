// ServiceDetail.jsx
import React, { useEffect, useState, useRef, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
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
  Menu,
  MenuItem,
  List,
  ListItem,
  Chip,
  Divider,
  Stack,
  useTheme,
  Tooltip,
  Snackbar,
  Drawer,
  Tabs,
  Tab,
  useMediaQuery,
  Avatar,
  Alert,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import LinkIcon from "@mui/icons-material/Launch";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MenuIcon from "@mui/icons-material/Menu";
import InfoIcon from "@mui/icons-material/Info";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import apiRequest from "../customHooks/apiRequest"; // your existing wrapper

const API_BASE = "http://127.0.0.1:8000";
const DEPLOY_BASE = `${API_BASE}/deploy/`;
const SERVICE_BASE = `${API_BASE}/services/service/`;
const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;
const PLANS_BASE = `${API_BASE}/plans/`;

/* ---------- helpers ---------- */
function shallowEqualObj(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (let k of aKeys) if (a[k] !== b[k]) return false;
  return true;
}

/* ---------- deploy item (memoized) ---------- */
const DeployListItem = memo(function DeployListItem({
  d,
  isSelected,
  cannotSelect,
  actionState,
  onEdit,
  onSelectOpenConfirm,
  onDeleteOpenConfirm,
}) {
  return (
    <motion.div initial={false} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
      <ListItem sx={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 1, mb: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.light" }}>{(d.name || "?").charAt(0).toUpperCase()}</Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {d.name} {isSelected && <Chip label="Selected" size="small" color="success" sx={{ ml: 1 }} />}
              </Typography>
              <Typography variant="caption" color="text.secondary">version: {d.version || "-"}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>created: {d.created_at ? new Date(d.created_at).toLocaleString() : "-"}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1 }}>
            {isSelected ? (
              <Button size="small" variant="outlined" color="warning" disabled={actionState?.selecting || cannotSelect} onClick={() => onSelectOpenConfirm("unselect", d.id, "Unselect deploy", `Unselect deploy \"${d.name}\" from service?`)}>
                {actionState?.selecting ? "Working..." : "Unselect"}
              </Button>
            ) : (
              <Button size="small" variant="contained" color="primary" disabled={actionState?.selecting || cannotSelect} onClick={() => onSelectOpenConfirm("select", d.id, "Select deploy", `Select deploy \"${d.name}\" for service?`)}>
                {actionState?.selecting ? "Working..." : "Select"}
              </Button>
            )}

            <IconButton size="small" onClick={() => onEdit(d)} aria-label={`Edit ${d.name}`}><EditIcon /></IconButton>
            <IconButton size="small" color="error" onClick={() => onDeleteOpenConfirm("delete", d.id, "Delete deploy", `Delete deploy \"${d.name}\"?`)} disabled={actionState?.deleting} aria-label={`Delete ${d.name}`}><DeleteIcon /></IconButton>
          </Box>
        </Box>
      </ListItem>
    </motion.div>
  );
}, (prev, next) => {
  if (prev.d !== next.d) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.cannotSelect !== next.cannotSelect) return false;
  return shallowEqualObj(prev.actionState || {}, next.actionState || {});
});

/* ---------- main component ---------- */
export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("md")); // mobile when md and below

  // main states
  const [service, setService] = useState(null);
  const [planDetail, setPlanDetail] = useState(null);
  const [networkDetail, setNetworkDetail] = useState(null);

  const [deploys, setDeploys] = useState([]);
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0, page: 1 });

  const [loading, setLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState(null);

  // form states
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [config, setConfig] = useState("");
  const [zipFile, setZipFile] = useState(null);

  const [checkingName, setCheckingName] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // per-deploy action states
  const [actionState, setActionState] = useState({});
  const setAction = (deployId, patch) => setActionState(prev => ({ ...prev, [deployId]: { ...(prev[deployId] ?? {}), ...patch } }));

  // edit flow
  const [editingDeployId, setEditingDeployId] = useState(null);
  const [editData, setEditData] = useState({ name: "", version: "", config: "" });
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editZipFile, setEditZipFile] = useState(null);

  // progress
  const [uploadProgress, setUploadProgress] = useState({});

  // confirm dialog
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  // service status
  const [serviceRunning, setServiceRunning] = useState(null);
  const [serviceCpu, setServiceCpu] = useState(null);
  const [serviceRam, setServiceRam] = useState(null);
  const [serviceStatusLoadingManual, setServiceStatusLoadingManual] = useState(false);
  const serviceStatusSilentRef = useRef(false);

  // auto-refresh
  const REFRESH_CHOICES = [0, 1, 2, 5, 10, 20, 30, 60];
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(2);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [anchorIntervalEl, setAnchorIntervalEl] = useState(null);
  const autoRefreshTimerRef = useRef(null);
  const autoRefreshRunningRef = useRef(false);

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const fetchDeploysLock = useRef(false);

  const zipInputRef = useRef(null);
  const editZipInputRef = useRef(null);

  // mobile drawer / right-handle + drag state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);

  const HANDLE_KEY = "serviceDetail_handle_top";
  const [handleTop, setHandleTop] = useState(null); // px
  const [armedForDrag, setArmedForDrag] = useState(false);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startTopRef = useRef(0);
  const longPressTimeoutRef = useRef(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // initialize handleTop from localStorage or default
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(HANDLE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    const defaultTop = Math.round(window.innerHeight * 0.5);
    const initial = !Number.isNaN(parsed) ? parsed : defaultTop;
    // clamp
    const minTop = 72;
    const maxTop = Math.max(120, window.innerHeight - 80);
    const clamped = Math.min(Math.max(initial, minTop), maxTop);
    setHandleTop(clamped);
  }, []);

  // keep handleTop within bounds on resize
  useEffect(() => {
    const onResize = () => {
      if (handleTop == null) return;
      const minTop = 72; // keep below header / menu
      const maxTop = Math.max(120, window.innerHeight - 80);
      if (handleTop < minTop) setHandleTop(minTop);
      if (handleTop > maxTop) setHandleTop(maxTop);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [handleTop]);

  /* ---------- merge utilities (same as original) ---------- */
  function mergeObjects(prev = {}, incoming = {}) {
    if (!incoming) return prev;
    if (!prev) return { ...incoming };
    if (typeof incoming !== "object" || Array.isArray(incoming)) return incoming;
    const out = { ...prev };
    for (const key of Object.keys(incoming)) {
      const val = incoming[key];
      if (val === undefined) continue;
      if (val === null) { out[key] = null; continue; }
      if (typeof val === "object" && !Array.isArray(val)) out[key] = mergeObjects(out[key] ?? {}, val);
      else out[key] = val;
    }
    return out;
  }

  const mergeDeploysSmart = (existing = [], incoming = []) => {
    try {
      if (!Array.isArray(incoming)) return existing;
      if (!Array.isArray(existing) || existing.length === 0) return incoming;

      const existingMap = new Map(existing.map((e) => [String(e.id ?? e.pk ?? ""), e]));
      let changed = false;
      const out = incoming.map((inc) => {
        const idKey = String(inc.id ?? inc.pk ?? "");
        const ex = existingMap.get(idKey);
        if (!ex) { changed = true; return inc; }
        const merged = mergeObjects(ex, inc);
        if (JSON.stringify(merged) === JSON.stringify(ex)) return ex;
        changed = true;
        return merged;
      });

      if (!changed) {
        if (existing.length === out.length) {
          let sameOrder = true;
          for (let i = 0; i < out.length; i++) {
            if (existing[i] !== out[i]) { sameOrder = false; break; }
          }
          if (sameOrder) return existing;
        }
      }

      return out;
    } catch (e) {
      console.debug("mergeDeploysSmart err", e);
      return incoming;
    }
  };

  /* ---------- fetch service & details ---------- */
  const fetchService = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) { setServiceLoading(true); setError(null); }
    try {
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/` });
      if (!mountedRef.current) return;
      setService(prev => {
        const merged = mergeObjects(prev ?? {}, resp.data ?? {});
        if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
        return merged;
      });

      const plan = resp.data?.plan;
      if (plan && typeof plan === "object") {
        setPlanDetail(prev => { const merged = mergeObjects(prev ?? {}, plan); if (JSON.stringify(prev) === JSON.stringify(merged)) return prev; return merged; });
      } else if (plan) {
        try { const p = await apiRequest({ method: "GET", url: `${PLANS_BASE}?id=${String(plan)}` }); if (mountedRef.current) setPlanDetail(p.data); } catch (e) {}
      }

      const net = resp.data?.network;
      if (net && typeof net === "object") {
        setNetworkDetail(prev => { const merged = mergeObjects(prev ?? {}, net); if (JSON.stringify(prev) === JSON.stringify(merged)) return prev; return merged; });
      } else if (net) {
        try { const n = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(net)}/` }); if (mountedRef.current) setNetworkDetail(n.data); } catch (e) {}
      }
    } catch (err) {
      console.error("fetchService error:", err);
      if (!silent) setError("Failed to load service info.");
    } finally {
      if (mountedRef.current && !silent) setServiceLoading(false);
    }
  }, [id]);

  /* ---------- fetch deploys ---------- */
  const fetchDeploys = useCallback(async (page = 1, silent = false) => {
    if (!id) return;
    if (fetchDeploysLock.current && !silent) return;
    if (!silent) { fetchDeploysLock.current = true; setLoading(true); setError(null); }
    const thisFetch = ++fetchIdRef.current;
    try {
      const params = { service_id: id, page };
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}`, params });
      if (thisFetch !== fetchIdRef.current) return;
      const data = resp.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setDeploys(prev => mergeDeploysSmart(prev, results));
      if (!silent) setPageInfo({ next: data.next, previous: data.previous, count: data.count, page });
    } catch (err) {
      console.error("fetchDeploys error:", err);
      if (!silent) setError("Failed to load deploys.");
    } finally {
      if (!silent) { fetchDeploysLock.current = false; if (mountedRef.current) setLoading(false); }
    }
  }, [id]);

  /* ---------- name availability ---------- */
  const nameCheckTimeout = useRef(null);
  const checkNameAvailable = async (candidate) => {
    if (!candidate) return false;
    if (editingDeployId && candidate === editOriginalName) return true;
    setCheckingName(true);
    try {
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}name_is_available/`, params: { name: candidate } });
      return resp.data?.result === true;
    } catch (err) {
      console.error("checkNameAvailable:", err);
      return false;
    } finally { if (mountedRef.current) setCheckingName(false); }
  };

  const debouncedCheck = useCallback((value) => {
    if (nameCheckTimeout.current) clearTimeout(nameCheckTimeout.current);
    nameCheckTimeout.current = setTimeout(async () => {
      if (!value) return;
      await checkNameAvailable(value);
    }, 450);
  }, [editingDeployId, editOriginalName]);

  useEffect(() => { if (!editingDeployId) debouncedCheck(name); }, [name, debouncedCheck, editingDeployId]);

  /* ---------- create / update / delete deploy ---------- */
  const handleCreate = async (e) => {
    e?.preventDefault();
    setError(null); setSnackbar(null);
    if (!name || name.length < 4) { setError("Name must be at least 4 characters."); return; }
    setSubmitting(true);
    try {
      const available = await checkNameAvailable(name);
      if (!available) { setError("The name is already taken or not available."); setSubmitting(false); return; }

      if (!zipFile) {
        const payload = { name, service: id, version, config };
        const createResp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}`, data: payload });
        if (createResp.status === 201) {
          setSnackbar({ severity: "success", message: "Deploy created." });
          await fetchDeploys(1);
          setName(""); setVersion(""); setConfig("");
        } else setError("Create request failed.");
      } else {
        const fd = new FormData();
        fd.append("name", name); fd.append("service", id);
        if (version) fd.append("version", version);
        if (config) fd.append("config", config);
        fd.append("zip_file", zipFile);

        const key = "create";
        setUploadProgress(p => ({ ...p, [key]: 0 }));
        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.post(`${DEPLOY_BASE}`, fd, {
          headers,
          onUploadProgress: (ev) => { if (ev.total) setUploadProgress((p) => ({ ...p, [key]: Math.round((ev.loaded * 100) / ev.total) })); },
        });

        if (resp.status === 201) {
          setSnackbar({ severity: "success", message: "Deploy created." });
          await fetchDeploys(1);
          setName(""); setVersion(""); setConfig(""); setZipFile(null);
          if (zipInputRef.current) zipInputRef.current.value = "";
        } else setError("Create (multipart) request failed.");
        setUploadProgress((p) => ({ ...p, [key]: undefined }));
      }
    } catch (err) {
      console.error("handleCreate err:", err);
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Unexpected error creating deploy.");
    } finally { if (mountedRef.current) setSubmitting(false); }
  };

  const handleUpdate = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { updating: true });
    try {
      if (!editData.name || editData.name.length < 4) { setError("Name must be at least 4 characters."); setAction(deployId, { updating: false }); return; }
      const available = await checkNameAvailable(editData.name);
      if (!available) { setError("The name is already taken or not available."); setAction(deployId, { updating: false }); return; }

      if (!editZipFile) {
        const payload = { name: editData.name, version: editData.version, config: editData.config };
        const resp = await apiRequest({ method: "PUT", url: `${DEPLOY_BASE}${deployId}/`, data: payload });
        if (resp.status === 200) { setSnackbar({ severity: "success", message: "Deploy updated." }); await fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update failed.");
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
        if (resp.status === 200) { setSnackbar({ severity: "success", message: "Deploy updated." }); await fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update (multipart) failed.");
      }
    } catch (err) {
      console.error("handleUpdate err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected update error");
    } finally { setAction(deployId, { updating: false }); }
  };

  const handleDestroy = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { deleting: true });
    try {
      const resp = await apiRequest({ method: "DELETE", url: `${DEPLOY_BASE}${deployId}/` });
      if (resp.status >= 200 && resp.status < 300) {
        setSnackbar({ severity: "success", message: "Deploy deleted." });
        await fetchDeploys(pageInfo.page);
      } else setError("Delete failed.");
    } catch (err) {
      console.error("handleDestroy err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected delete error");
    } finally { setAction(deployId, { deleting: false }); }
  };

  /* ---------- select/unselect ---------- */
  const setDeploy = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { selecting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}set_deploy/`, data: { deploy_id: deployId, service_id: id } });
      if (resp.status >= 200 && resp.status < 300) {
        setSnackbar({ severity: "success", message: "Deploy selected for service." });
        await fetchService();
        await fetchDeploys(pageInfo.page || 1);
      } else setError("Failed to select deploy.");
    } catch (err) {
      console.error("setDeploy err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error selecting deploy");
    } finally { setAction(deployId, { selecting: false }); }
  };

  const unsetDeploy = async (deployId) => {
    setError(null); setSnackbar(null); setAction(deployId, { selecting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}unset_deploy/`, data: { deploy_id: deployId, service_id: id } });
      if (resp.status >= 200 && resp.status < 300) {
        setSnackbar({ severity: "success", message: "Deploy unselected." });
        await fetchService();
        await fetchDeploys(pageInfo.page || 1);
      } else setError("Failed to unselect deploy.");
    } catch (err) {
      console.error("unsetDeploy err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error unselecting deploy");
    } finally { setAction(deployId, { selecting: false }); }
  };

  /* ---------- start/stop & status ---------- */
  const startService = async () => {
    if (!id) return;
    setError(null); setSnackbar(null); setServiceLoading(true);
    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}start_service/`, data: { service_id: id } });
      if (resp.status === 202) { setSnackbar({ severity: "success", message: "Service start requested." }); await fetchService(); } else setError("Failed to start service.");
    } catch (err) {
      console.error("startService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error starting service");
    } finally { if (mountedRef.current) setServiceLoading(false); }
  };

  const stopService = async () => {
    if (!id) return;
    setError(null); setSnackbar(null); setServiceLoading(true);
    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}stop_service/`, data: { service_id: id } });
      if (resp.status === 202) { setSnackbar({ severity: "success", message: "Service stop requested." }); await fetchService(); } else setError("Failed to stop service.");
    } catch (err) {
      console.error("stopService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error stopping service");
    } finally { if (mountedRef.current) setServiceLoading(false); }
  };

  const colorForPercent = (p) => {
    const pct = Number(p) || 0;
    if (pct >= 90) return theme.palette.error.main;
    if (pct >= 70) return theme.palette.warning.main;
    if (pct >= 40) return theme.palette.success.main;
    return theme.palette.primary.main;
  };

  const checkServiceRunning = useCallback(async (silent = false) => {
    if (!id) return;
    if (silent) {
      if (serviceStatusSilentRef.current) return;
      serviceStatusSilentRef.current = true;
    } else {
      if (serviceStatusLoadingManual) return;
      setServiceStatusLoadingManual(true);
    }
    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}service_status/`, data: { service_id: id } });
      if (resp.status === 200 && resp.data) {
        const running = !!resp.data.running;
        const cpu = typeof resp.data.cpu === "number" ? resp.data.cpu : Number(resp.data.cpu) || 0;
        const ram = typeof resp.data.ram === "number" ? resp.data.ram : Number(resp.data.ram) || 0;
        setServiceRunning(prev => (prev === running ? prev : running));
        setServiceCpu(prev => (typeof prev === "number" && Math.round(prev * 100) / 100 === Math.round(cpu * 100) / 100 ? prev : Math.round(cpu * 100) / 100));
        setServiceRam(prev => (typeof prev === "number" && Math.round(prev * 100) / 100 === Math.round(ram * 100) / 100 ? prev : Math.round(ram * 100) / 100));
      } else { setServiceRunning(false); setServiceCpu(0); setServiceRam(0); }
    } catch (err) {
      console.error("checkServiceRunning err:", err);
      setServiceRunning(false); setServiceCpu(0); setServiceRam(0);
    } finally { if (silent) serviceStatusSilentRef.current = false; else setServiceStatusLoadingManual(false); }
  }, [id, serviceStatusLoadingManual]);

  /* ---------- edit helpers ---------- */
  const handleEditClick = useCallback((d) => {
    setEditingDeployId(d.id);
    setEditData({ name: d.name || "", version: d.version || "", config: d.config || "" });
    setEditOriginalName(d.name || "");
    setEditZipFile(null);
    setError(null); setSnackbar(null);
    document.querySelector(".create-deploy")?.scrollIntoView({ behavior: "smooth" });
  }, []);
  const handleCancelEdit = useCallback(() => {
    setEditingDeployId(null); setEditData({ name: "", version: "", config: "" }); setEditOriginalName(""); setEditZipFile(null);
    if (editZipInputRef.current) editZipInputRef.current.value = "";
  }, []);

  /* ---------- file handlers ---------- */
  const handleFileChange = (e) => setZipFile(e.target.files[0] || null);
  const handleEditFileChange = (e) => setEditZipFile(e.target.files[0] || null);

  /* ---------- confirm dialog ---------- */
  const openConfirm = (type, deployId, title, message) => setConfirmDialog({ open: true, type, deployId, title, message, loading: false });
  const closeConfirm = () => setConfirmDialog({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const confirmDialogAction = async () => {
    const { type, deployId } = confirmDialog;
    if (!type) { closeConfirm(); return; }
    setConfirmDialog(c => ({ ...c, loading: true }));
    try {
      if (type === "delete") await handleDestroy(deployId);
      else if (type === "select") await setDeploy(deployId);
      else if (type === "unselect") await unsetDeploy(deployId);
    } finally {
      setConfirmDialog(c => ({ ...c, loading: false }));
      setTimeout(() => closeConfirm(), 120);
    }
  };

  /* ---------- pagination ---------- */
  const handlePrev = () => { if (!pageInfo.previous) return; try { const u = new URL(pageInfo.previous); fetchDeploys(parseInt(u.searchParams.get("page") || "1", 10)); } catch { fetchDeploys(Math.max(1, pageInfo.page - 1)); } };
  const handleNext = () => { if (!pageInfo.next) return; try { const u = new URL(pageInfo.next); fetchDeploys(parseInt(u.searchParams.get("page") || String(pageInfo.page + 1), 10)); } catch { fetchDeploys(pageInfo.page + 1); } };

  const openServiceInNewTab = () => { if (!service || !service.service_name) return; const host = `${service.service_name}.local`; window.open(`http://${host}`, "_blank", "noopener,noreferrer"); };
  const goBackToServices = () => navigate("/services");

  /* ---------- auto-refresh loop ---------- */
  useEffect(() => {
    if (autoRefreshTimerRef.current) { clearTimeout(autoRefreshTimerRef.current); autoRefreshTimerRef.current = null; }
    if (!autoRefreshEnabled || !refreshIntervalSec || refreshIntervalSec <= 0) return;

    let cancelled = false;

    const loop = async () => {
      if (cancelled) return;
      if (autoRefreshRunningRef.current) {
        autoRefreshTimerRef.current = setTimeout(loop, refreshIntervalSec * 1000);
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        autoRefreshTimerRef.current = setTimeout(loop, refreshIntervalSec * 1000);
        return;
      }
      try {
        autoRefreshRunningRef.current = true;
        await Promise.all([fetchService(true), fetchDeploys(pageInfo.page || 1, true), checkServiceRunning(true)]);
      } catch (e) {
        console.debug("autoRefresh loop error:", e);
      } finally {
        autoRefreshRunningRef.current = false;
        if (cancelled) return;
        autoRefreshTimerRef.current = setTimeout(loop, refreshIntervalSec * 1000);
      }
    };

    autoRefreshTimerRef.current = setTimeout(loop, refreshIntervalSec * 1000);
    return () => { cancelled = true; if (autoRefreshTimerRef.current) { clearTimeout(autoRefreshTimerRef.current); autoRefreshTimerRef.current = null; } autoRefreshRunningRef.current = false; };
  }, [autoRefreshEnabled, refreshIntervalSec, pageInfo.page, fetchService, fetchDeploys, checkServiceRunning]);

  /* ---------- initial mount ---------- */
  useEffect(() => {
    if (!id) return;
    fetchService();
    fetchDeploys(1);
    checkServiceRunning(true);
  }, [id, fetchService, fetchDeploys, checkServiceRunning]);

  /* ---------- created callbacks to avoid inline functions ---------- */
  const onEdit = useCallback((d) => handleEditClick(d), [handleEditClick]);
  const onSelectOpenConfirm = useCallback((type, deployId, title, message) => openConfirm(type, deployId, title, message), []);
  const onDeleteOpenConfirm = useCallback((type, deployId, title, message) => openConfirm(type, deployId, title, message), []);

  const panelSx = {
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    backgroundColor: theme.palette.mode === 'dark' ? 'linear-gradient(180deg,#0b0f12, #111827)' : 'linear-gradient(180deg,#ffffff,#f7fbff)',
    borderRadius: 2,
    boxShadow: 6,
  };

  /* ---------- Drawer content (Info/Network tabs) ---------- */
  function DrawerContent() {
    return (
      <Box sx={{ width: 360, p: 2 }}>
        {/* START/STOP buttons moved above tabs and styled */}
        <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={startService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))} sx={{ bgcolor: theme.palette.success.main, '&:hover': { bgcolor: theme.palette.success.dark } }} startIcon={<PlayArrowIcon />}>Start</Button>
          <Button variant="contained" onClick={stopService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))} sx={{ bgcolor: theme.palette.error.main, '&:hover': { bgcolor: theme.palette.error.dark } }} startIcon={<StopIcon />}>Stop</Button>
        </Box>

        <Tabs value={drawerTab} onChange={(e, v) => setDrawerTab(v)}>
          <Tab label="Info" icon={<InfoIcon />} iconPosition="start" />
          <Tab label="Network" icon={<SettingsEthernetIcon />} iconPosition="start" />
        </Tabs>

        <Box role="tabpanel" hidden={drawerTab !== 0} sx={{ mt: 1 }}>
          <Typography variant="h6">Service</Typography>
          <Typography variant="body2" color="text.secondary">{service?.name ?? "—"}</Typography>
          <Divider sx={{ my: 1 }} />

          <Typography variant="caption">URL</Typography>
          <Box sx={{ mb: 1 }}>
            {service ? (
              <Button size="small" startIcon={<LinkIcon />} onClick={openServiceInNewTab} sx={{ textTransform: "none" }}>{service.service_name}.local</Button>
            ) : <Typography color="text.secondary">—</Typography>}
          </Box>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button variant="outlined" onClick={() => checkServiceRunning(false)} disabled={!service || serviceStatusLoadingManual}>{serviceStatusLoadingManual ? "Checking..." : "Check running"}</Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 1 }}><strong>Status:</strong> {service?.status ?? "-"}</Typography>

          {serviceRunning !== null && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{serviceRunning ? "Service appears to be running." : "Service is not running."}</Typography>

              <Typography variant="caption">CPU {serviceCpu !== null ? `${serviceCpu}%` : "-"}</Typography>
              <LinearProgress variant="determinate" value={Math.min(Math.max(serviceCpu || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, mb: 1, bgcolor: "grey.200", "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceCpu) } }} />

              <Typography variant="caption">RAM {serviceRam !== null ? `${serviceRam}%` : "-"}</Typography>
              <LinearProgress variant="determinate" value={Math.min(Math.max(serviceRam || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceRam) } }} />
            </Box>
          )}

          <Divider sx={{ my: 2 }} />
          <Box sx={{ fontSize: 13, color: "text.secondary" }}>
            {(planDetail?.name ?? service?.plan?.name) && <Box sx={{ mb: 1 }}><strong>Plan name:</strong> {planDetail?.name ?? service?.plan?.name}</Box>}
            {(planDetail?.platform ?? service?.plan?.platform) && <Box sx={{ mb: 1 }}><strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform}</Box>}
            {(planDetail?.max_cpu ?? service?.plan?.max_cpu) && <Box sx={{ mb: 0.5 }}><strong>max_cpu:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu}</Box>}
            {(planDetail?.max_ram ?? service?.plan?.max_ram) && <Box sx={{ mb: 0.5 }}><strong>max_ram:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram}</Box>}
            {(planDetail?.max_storage ?? service?.plan?.max_storage) && <Box sx={{ mb: 0.5 }}><strong>max_storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage}</Box>}
            {(planDetail?.price_per_hour ?? service?.plan?.price_per_hour) && <Box sx={{ mt: 1 }}><strong>price_per_hour:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour}</Box>}
          </Box>
        </Box>

        <Box role="tabpanel" hidden={drawerTab !== 1} sx={{ mt: 1 }}>
          <Typography variant="h6">Network</Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ fontSize: 13, color: "text.secondary" }}>
            {(service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name) && <Box sx={{ mb: 1 }}><strong>Network name:</strong> {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name}</Box>}
            {networkDetail ? (
              <>
                {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && <Box sx={{ mb: 0.5 }}><strong>cidr:</strong> {networkDetail?.network?.cidr ?? networkDetail?.cidr}</Box>}
                {(networkDetail?.network?.driver ?? networkDetail?.driver) && <Box sx={{ mb: 0.5 }}><strong>driver:</strong> {networkDetail?.network?.driver ?? networkDetail?.driver}</Box>}
                {Array.isArray(networkDetail?.services) && <Box sx={{ mt: 1 }}><strong>services_count:</strong> {networkDetail.services.length}</Box>}
              </>
            ) : (
              <>
                {service?.network?.created_at && <Box sx={{ mb: 0.5 }}><strong>created_at:</strong> {new Date(service.network.created_at).toLocaleString()}</Box>}
                {service?.network?.description && <Box sx={{ mb: 0.5 }}><strong>description:</strong> {service.network.description}</Box>}
              </>
            )}
          </Box>
        </Box>
      </Box>
    );
  }

  /* ---------- robust handle (single-click open, long-press to drag) ---------- */

  // start actual dragging (attach move/up). This function is created so it can be used both from longpress and from doubleClick arm.
  const startActualDrag = (initialClientY) => {
    draggingRef.current = true;
    setArmedForDrag(true);
    startYRef.current = initialClientY;
    startTopRef.current = handleTop ?? Math.round(window.innerHeight * 0.5);

    const onPointerMove = (ev) => {
      if (!draggingRef.current) return;
      const clientY = ev.clientY ?? (ev.touches && ev.touches[0] && ev.touches[0].clientY) ?? 0;
      const dy = clientY - startYRef.current;
      const newTop = Math.round(startTopRef.current + dy);
      const minTop = 72;
      const maxTop = Math.max(120, window.innerHeight - 80);
      const clamped = Math.min(Math.max(newTop, minTop), maxTop);
      setHandleTop(clamped);
    };

    const onPointerUp = () => {
      draggingRef.current = false;
      setArmedForDrag(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try { localStorage.setItem(HANDLE_KEY, String(handleTop ?? startTopRef.current)); } catch (e) {}
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // pointer down: start a short long-press timer. If user releases before threshold -> treat as click (toggle drawer).
  const onHandlePointerDown = (e) => {
    // record initial clientY
    const initialClientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? 0;
    // clear any existing
    if (longPressTimeoutRef.current) { clearTimeout(longPressTimeoutRef.current); longPressTimeoutRef.current = null; }

    // start long-press timer (300ms). If fires -> begin drag immediately.
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTimeoutRef.current = null;
      // start dragging
      startActualDrag(initialClientY);
      // auto-cancel armed state after some time if needed
      setTimeout(() => setArmedForDrag(false), 8000);
    }, 300);

    // add a short-lived pointermove listener to detect movement before long-press completes -> if moved significantly, cancel long-press and start drag immed.
    const onEarlyMove = (ev) => {
      const clientY = ev.clientY ?? (ev.touches && ev.touches[0] && ev.touches[0].clientY) ?? 0;
      if (Math.abs(clientY - initialClientY) > 12) {
        // user started dragging before longpress threshold -> start actual drag
        if (longPressTimeoutRef.current) { clearTimeout(longPressTimeoutRef.current); longPressTimeoutRef.current = null; }
        startActualDrag(initialClientY);
        window.removeEventListener("pointermove", onEarlyMove);
        window.removeEventListener("pointerup", onEarlyUp);
      }
    };

    const onEarlyUp = (ev) => {
      // if long-press has not fired, this is a normal click/tap -> toggle drawer
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
        // Treat as a click/tap -> toggle drawer open/close
        setDrawerOpen(prev => !prev);
      } else {
        // long-press fired and drag may have been started; allow pointerup to be handled by drag cleanup
      }
      window.removeEventListener("pointermove", onEarlyMove);
      window.removeEventListener("pointerup", onEarlyUp);
    };

    window.addEventListener("pointermove", onEarlyMove);
    window.addEventListener("pointerup", onEarlyUp);
  };

  // also support double-click to arm for drag (desktop). Double-click will *arm* drag but actual movement requires pressing and dragging.
  const onHandleDoubleClick = (e) => {
    const initialClientY = e.clientY ?? (e.touches && e.touches[0] && e.touches[0].clientY) ?? 0;
    // set armed and immediately start drag so user can move without extra press
    startActualDrag(initialClientY);
    // auto-cancel after some seconds
    setTimeout(() => setArmedForDrag(false), 8000);
  };

  /* ---------- render ---------- */
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Grid container spacing={2} justifyContent={isSm ? "center" : "flex-start"}>
        <Grid item xs={12} md={8} sx={{ display: "flex", justifyContent: "center" }}>
          {/* main column centered on small screens */}
          <Box sx={{ width: isSm ? "100%" : "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <Button variant="outlined" onClick={goBackToServices}>← Back to services</Button>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">Service Detail</Typography>
                <Typography variant="caption" color="text.secondary">Service ID: {id}</Typography>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Refresh service & deploys">
                  <IconButton onClick={() => { fetchService(); fetchDeploys(1); }} disabled={serviceLoading}><RefreshIcon /></IconButton>
                </Tooltip>

                <Button
                  variant={autoRefreshEnabled ? "contained" : "outlined"}
                  size="small"
                  onClick={(e) => setAnchorIntervalEl(e.currentTarget)}
                  aria-haspopup="true"
                  aria-expanded={Boolean(anchorIntervalEl)}
                >
                  {autoRefreshEnabled ? `${refreshIntervalSec}s` : "Auto: off"} ▾
                </Button>

                <Menu anchorEl={anchorIntervalEl} open={Boolean(anchorIntervalEl)} onClose={() => setAnchorIntervalEl(null)}>
                  <MenuItem>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input aria-label="Enable auto-refresh" type="checkbox" checked={autoRefreshEnabled} onChange={(e) => setAutoRefreshEnabled(e.target.checked)} />
                      Enable auto-refresh
                    </label>
                  </MenuItem>
                  <Divider />
                  {REFRESH_CHOICES.map(s => (
                    <MenuItem key={s} selected={s === refreshIntervalSec} onClick={() => { setRefreshIntervalSec(s); setAnchorIntervalEl(null); if (s === 0) setAutoRefreshEnabled(false); else setAutoRefreshEnabled(true); }}>
                      {s === 0 ? "Off" : `${s} second${s > 1 ? "s" : ""}`}
                    </MenuItem>
                  ))}
                </Menu>
              </Stack>
            </Box>

            {/* Create / Edit deploy card */}
            <Paper elevation={1} sx={{ p: 2, mb: 2, ...panelSx }}>
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Typography variant="subtitle1">{editingDeployId ? "Edit Deploy" : "Create Deploy"}</Typography>
                  {checkingName && <Typography variant="caption">Checking name...</Typography>}
                </Box>

                <Box component="form" onSubmit={(e) => { e.preventDefault(); if (editingDeployId) handleUpdate(editingDeployId); else handleCreate(e); }} className="create-deploy">
                  <TextField fullWidth label="Name (>=4 chars)" size="small" value={editingDeployId ? editData.name : name} onChange={(e) => editingDeployId ? setEditData(d => ({ ...d, name: e.target.value })) : setName(e.target.value)} sx={{ mb: 1 }} />
                  <TextField fullWidth label="Version (optional)" size="small" value={editingDeployId ? editData.version : version} onChange={(e) => editingDeployId ? setEditData(d => ({ ...d, version: e.target.value })) : setVersion(e.target.value)} sx={{ mb: 1 }} />
                  <TextField fullWidth label="Config (optional)" size="small" multiline rows={4} value={editingDeployId ? editData.config : config} onChange={(e) => editingDeployId ? setEditData(d => ({ ...d, config: e.target.value })) : setConfig(e.target.value)} sx={{ mb: 1 }} />

                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                    {!editingDeployId ? (
                      <>
                        <Button variant="outlined" component="label" size="small">Choose .zip<input type="file" hidden accept=".zip" ref={zipInputRef} onChange={handleFileChange} /></Button>
                        <Typography variant="body2" color="text.secondary">{zipFile ? `${zipFile.name} (${Math.round(zipFile.size/1024)} KB)` : "No file selected"}</Typography>
                      </>
                    ) : (
                      <>
                        <Button variant="outlined" component="label" size="small">Replace .zip<input type="file" hidden accept=".zip" ref={editZipInputRef} onChange={handleEditFileChange} /></Button>
                        <Typography variant="body2" color="text.secondary">{editZipFile ? `${editZipFile.name}` : "No file selected"}</Typography>
                      </>
                    )}
                  </Box>

                  {uploadProgress["create"] >= 0 && uploadProgress["create"] !== undefined && (
                    <Box sx={{ mb: 1 }}>
                      <LinearProgress variant="determinate" value={uploadProgress["create"]} />
                      <Typography variant="caption">{uploadProgress["create"]}%</Typography>
                    </Box>
                  )}

                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    {!editingDeployId ? (
                      <>
                        <Button variant="contained" type="submit" disabled={submitting || checkingName}>{submitting ? "Submitting..." : "Create Deploy"}</Button>
                        <Button variant="outlined" onClick={() => { setName(""); setVersion(""); setConfig(""); setZipFile(null); if (zipInputRef.current) zipInputRef.current.value = ""; }}>Reset</Button>
                      </>
                    ) : (
                      <>
                        <Button variant="contained" onClick={() => handleUpdate(editingDeployId)} disabled={actionState[editingDeployId]?.updating}>{actionState[editingDeployId]?.updating ? "Updating..." : "Update Deploy"}</Button>
                        <Button variant="contained" color="error" onClick={handleCancelEdit}>Cancel edit</Button>
                      </>
                    )}
                  </Box>

                  {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
                </Box>
              </motion.div>
            </Paper>

            {/* Deploy list */}
            <Paper elevation={1} sx={{ p: 2, ...panelSx }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Typography variant="subtitle1">Existing Deploys</Typography>
                <Typography variant="caption" color="text.secondary">{loading ? "Loading..." : `${pageInfo.count ?? 0} total`}</Typography>
              </Box>

              {loading ? (
                <Box>
                  <Typography>Loading...</Typography>
                </Box>
              ) : (!loading && deploys.length === 0) ? (
                <Typography color="text.secondary">No deploys found for this service.</Typography>
              ) : (
                <List>
                  <AnimatePresence initial={false}>
                    {deploys.map((d) => {
                      const selectedId = service?.selected_deploy ? (service.selected_deploy.id ?? service.selected_deploy) : null;
                      const isSelected = selectedId !== null && String(selectedId) === String(d.id);
                      const cannotSelect = service && ["queued","deploying","stopping"].includes(String(service.status));
                      return (
                        <DeployListItem
                          key={d.id ?? d.pk}
                          d={d}
                          isSelected={isSelected}
                          cannotSelect={cannotSelect}
                          actionState={actionState[d.id] ?? {}}
                          onEdit={onEdit}
                          onSelectOpenConfirm={onSelectOpenConfirm}
                          onDeleteOpenConfirm={onDeleteOpenConfirm}
                        />
                      );
                    })}
                  </AnimatePresence>
                </List>
              )}

              <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mt: 1 }}>
                <Button onClick={handlePrev} disabled={!pageInfo.previous}>Prev</Button>
                <Typography variant="body2" sx={{ alignSelf: "center" }}>Page {pageInfo.page} — {pageInfo.count} total</Typography>
                <Button onClick={handleNext} disabled={!pageInfo.next}>Next</Button>
              </Box>
            </Paper>
          </Box>
        </Grid>

        {/* desktop right panel (kept intact) */}
        {!isSm && (
          <Grid item xs={12} md={4}>
            <Paper elevation={1} sx={{ p: 2, ...panelSx }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Service</Typography>
                  <Typography variant="h6">{service?.name ?? "—"}</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="caption" color="text.secondary">Domain</Typography>
                  <Typography variant="body2">{service ? `${service.service_name || "-"} .local` : "-"}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 1 }}>
                <Typography variant="caption">URL</Typography>
                <Box>
                  {service ? (
                    <Button size="small" startIcon={<LinkIcon />} onClick={openServiceInNewTab} sx={{ textTransform: "none" }}>{service.service_name}.local</Button>
                  ) : <Typography color="text.secondary">—</Typography>}
                </Box>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button variant="contained" onClick={openServiceInNewTab} disabled={!service || !service.name}>Open</Button>
              </Stack>

              <Box sx={{ mb: 1 }}>
                <Typography variant="body2"><strong>Status:</strong> {service?.status ?? "-"}</Typography>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={startService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))}>Start Service</Button>
                <Button variant="outlined" startIcon={<StopIcon />} onClick={stopService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))}>Stop Service</Button>
              </Stack>

              <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
                <Button variant="outlined" onClick={() => checkServiceRunning(false)} disabled={!service || serviceStatusLoadingManual}>
                  {serviceStatusLoadingManual ? "Checking..." : "Check running"}
                </Button>
              </Box>

              {serviceRunning !== null && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{serviceRunning ? "Service appears to be running." : "Service is not running."}</Typography>

                  <Typography variant="caption">CPU {serviceCpu !== null ? `${serviceCpu}%` : "-"}</Typography>
                  <LinearProgress variant="determinate" value={Math.min(Math.max(serviceCpu || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, mb: 1, bgcolor: "grey.200", "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceCpu) } }} />

                  <Typography variant="caption">RAM {serviceRam !== null ? `${serviceRam}%` : "-"}</Typography>
                  <LinearProgress variant="determinate" value={Math.min(Math.max(serviceRam || 0, 0), 100)} sx={{ height: 10, borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceRam) } }} />
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              <Box sx={{ fontSize: 13, color: "text.secondary" }}>
                { (planDetail?.name ?? service?.plan?.name) && <Box sx={{ mb: 1 }}><strong>Plan name:</strong> {planDetail?.name ?? service?.plan?.name}</Box> }
                { (planDetail?.platform ?? service?.plan?.platform) && <Box sx={{ mb: 1 }}><strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform}</Box> }
                { (planDetail?.max_cpu ?? service?.plan?.max_cpu) && <Box sx={{ mb: 0.5 }}><strong>max_cpu:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu}</Box> }
                { (planDetail?.max_ram ?? service?.plan?.max_ram) && <Box sx={{ mb: 0.5 }}><strong>max_ram:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram}</Box> }
                { (planDetail?.max_storage ?? service?.plan?.max_storage) && <Box sx={{ mb: 0.5 }}><strong>max_storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage}</Box> }
                { (planDetail?.price_per_hour ?? service?.plan?.price_per_hour) && <Box sx={{ mt: 1 }}><strong>price_per_hour:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour}</Box> }
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ fontSize: 13, color: "text.secondary" }}>
                { (service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name) && <Box sx={{ mb: 1 }}><strong>Network name:</strong> {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name}</Box> }
                { networkDetail ? (
                  <>
                    { (networkDetail?.network?.cidr ?? networkDetail?.cidr) && <Box sx={{ mb: 0.5 }}><strong>cidr:</strong> {networkDetail?.network?.cidr ?? networkDetail?.cidr}</Box> }
                    { (networkDetail?.network?.driver ?? networkDetail?.driver) && <Box sx={{ mb: 0.5 }}><strong>driver:</strong> {networkDetail?.network?.driver ?? networkDetail?.driver}</Box> }
                    { Array.isArray(networkDetail?.services) && <Box sx={{ mt: 1 }}><strong>services_count:</strong> {networkDetail.services.length}</Box> }
                  </>
                ) : (
                  <>
                    { service?.network?.created_at && <Box sx={{ mb: 0.5 }}><strong>created_at:</strong> {new Date(service.network.created_at).toLocaleString()}</Box> }
                    { service?.network?.description && <Box sx={{ mb: 0.5 }}><strong>description:</strong> {service.network.description}</Box> }
                  </>
                ) }
              </Box>

              {error && <Typography color="error" sx={{ mt: 1 }}>{error}</Typography>}
            </Paper>
          </Grid>
        )}

        {/* Mobile floating handle (hidden while drawer open) */}
        {isSm && handleTop != null && (
          <motion.div
            style={{ position: "fixed", right: 0, zIndex: drawerOpen ? 1100 : 1200, top: handleTop }}
            animate={{ top: drawerOpen ? -200 : handleTop }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <Box
              role="button"
              onPointerDown={onHandlePointerDown}
              onDoubleClick={onHandleDoubleClick}
              sx={{
                position: "absolute",
                right: 0,
                transform: "translateX(0)",
                background: theme.palette.background.paper,
                borderRadius: "8px 0 0 8px",
                boxShadow: 4,
                display: drawerOpen ? "none" : "flex",
                alignItems: "center",
                pl: 1,
                pr: 1,
                py: 1,
                cursor: armedForDrag ? "grabbing" : "grab",
                minWidth: 48,
                userSelect: "none",
              }}
              aria-label="Open details (hold to drag, tap to open)"
            >
              <MenuIcon />
              <Typography variant="caption" sx={{ ml: 0.5, writingMode: "vertical-rl", textOrientation: "mixed", fontWeight: 600 }}>Details</Typography>
            </Box>

            {/* small hint when armed for drag */}
            {armedForDrag && (
              <Box sx={{ position: "absolute", right: 56, background: "rgba(0,0,0,0.7)", color: "#fff", px: 1, py: 0.5, borderRadius: 1, top: (handleTop || 0) - 16 }}>
                <Typography variant="caption">Drag now</Typography>
              </Box>
            )}
          </motion.div>
        )}
      </Grid>

      {/* Drawer (mobile) - higher zIndex so it overlays the handle */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: isSm ? 360 : 420, zIndex: 1400 } }}
        ModalProps={{ keepMounted: true }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1.5 }}>
          <Typography variant="h6">Details</Typography>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="Close details"><CloseIcon /></IconButton>
        </Box>
        <Divider />
        <DrawerContent />
      </Drawer>

      {/* Confirm dialog */}
      <Dialog open={confirmDialog.open} onClose={() => { if (!confirmDialog.loading) closeConfirm(); }}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { if (!confirmDialog.loading) closeConfirm(); }} disabled={confirmDialog.loading}>Cancel</Button>
          <Button color={confirmDialog.type === "delete" ? "error" : "primary"} onClick={confirmDialogAction} disabled={confirmDialog.loading}>
            {confirmDialog.loading ? "Working..." : (confirmDialog.type === "delete" ? "Delete" : (confirmDialog.type === "unselect" ? "Unselect" : "Select"))}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={Boolean(snackbar)} autoHideDuration={3000} onClose={() => setSnackbar(null)}>
        {snackbar && <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: "100%" }}>{snackbar.message}</Alert>}
      </Snackbar>
    </Box>
  );
}