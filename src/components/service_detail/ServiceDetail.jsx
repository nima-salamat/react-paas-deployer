// ServiceDetail.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import apiRequest from "../customHooks/apiRequest";
import axios from "axios";
import "./ServiceDetail.css";

const API_BASE = "http://127.0.0.1:8000";
const DEPLOY_BASE = `${API_BASE}/deploy/`;
const SERVICE_BASE = `${API_BASE}/services/service/`;
const SERVICE_ACTION_ROOT = `${API_BASE}/services/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;
const PLANS_BASE = `${API_BASE}/plans/`;

function PortalModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", loading = false, onConfirm, onCancel }) {
  const rootId = "sd-modal-root";
  const containerRef = useRef(null);

  useEffect(() => {
    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement("div");
      root.id = rootId;
      root.style.position = "relative";
      root.style.zIndex = "0";
      document.body.appendChild(root);
    }
    containerRef.current = document.createElement("div");
    containerRef.current.className = "sd-modal-portal-wrapper";
    root.appendChild(containerRef.current);
    return () => {
      if (containerRef.current && containerRef.current.parentNode) containerRef.current.parentNode.removeChild(containerRef.current);
    };
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onCancel && onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  if (!containerRef.current) return null;

  return createPortal(
    <div className="sd-modal-backdrop" onClick={() => { if (!loading) onCancel && onCancel(); }} role="presentation">
      <div className="sd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="sd-modal-title">{title}</h3>
        <div className="sd-modal-message">{message}</div>
        <div className="sd-modal-actions">
          <button className="primary-btn" onClick={onConfirm} disabled={loading}>{loading ? "Please wait..." : confirmLabel}</button>
          <button className="secondary-btn" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
        </div>
      </div>
    </div>,
    containerRef.current
  );
}

/* ---------- helpers ---------- */
const shallowEqual = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return a === b; }
};

function mergeObjects(prev = {}, incoming = {}) {
  if (!incoming) return prev;
  if (!prev) return { ...incoming };
  if (typeof incoming !== "object" || Array.isArray(incoming)) {
    return incoming;
  }
  const out = { ...prev };
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val === undefined) continue;

    // Explicitly handle null values – set them to null (this was the bug!)
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

const mergeDeploys = (existing = [], incoming = []) => {
  try {
    if (existing.length === incoming.length) {
      let same = true;
      for (let i = 0; i < incoming.length; i++) {
        if (!shallowEqual(existing[i], incoming[i])) { same = false; break; }
      }
      if (same) return existing;
    }
  } catch {}
  return incoming;
};

export default function ServiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [deploys, setDeploys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({ next: null, previous: null, count: 0, page: 1 });
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");

  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [config, setConfig] = useState("");
  const [zipFile, setZipFile] = useState(null);
  const [checkingName, setCheckingName] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [actionState, setActionState] = useState({});
  const [editingDeployId, setEditingDeployId] = useState(null);
  const [editData, setEditData] = useState({ name: "", version: "", config: "" });
  const [editOriginalName, setEditOriginalName] = useState("");
  const [editZipFile, setEditZipFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const [service, setService] = useState(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const [networkDetail, setNetworkDetail] = useState(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [planDetail, setPlanDetail] = useState(null);
  const [plansLoading, setPlansLoading] = useState(false);

  const [serviceRunning, setServiceRunning] = useState(null);

  const DOMAIN_SUFFIX = ".local";

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const fetchDeploysLock = useRef(false);

  const zipInputRef = useRef(null);
  const editZipInputRef = useRef(null);

  /* ---------- auto-refresh settings ---------- */
  const REFRESH_CHOICES = [0, 1, 2, 5, 10, 20, 30, 60];
  const [refreshIntervalSec, setRefreshIntervalSec] = useState(2);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [showIntervalMenu, setShowIntervalMenu] = useState(false);
  const intervalTimerRef = useRef(null);

  // helper to mutate actionState safely
  const setAction = (deployId, patch) => {
    setActionState((prev) => {
      const cur = prev[deployId] ?? {};
      const merged = { ...cur, ...patch };
      return { ...prev, [deployId]: merged };
    });
  };

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  /* ------------------ fetchService (merge, silent option) ------------------ */
  const fetchService = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) {
      setServiceLoading(true);
      setServiceError(null);
    }
    try {
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/` });
      if (!mountedRef.current) return;

      setService((prev) => {
        const merged = mergeObjects(prev ?? {}, resp.data ?? {});
        if (shallowEqual(prev, merged)) return prev;
        return merged;
      });

      const plan = resp.data && resp.data.plan;
      if (plan && typeof plan === "object") {
        setPlanDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, plan);
          if (shallowEqual(prev, merged)) return prev;
          return merged;
        });
      } else if (plan) {
        await fetchPlanById(plan);
      }

      const net = resp.data && resp.data.network;
      if (net && typeof net === "object") {
        setNetworkDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, net);
          if (shallowEqual(prev, merged)) return prev;
          return merged;
        });
      } else if (net) {
        await fetchNetworkDetail(net);
      }
    } catch (err) {
      console.error("fetchService error:", err);
      if (!silent) {
        setServiceError("Failed to load service info.");
      }
    } finally {
      if (mountedRef.current && !silent) setServiceLoading(false);
    }
  }, [id]);

  async function fetchPlanById(planId) {
    if (!planId) return;
    setPlansLoading(true);
    try {
      const resp = await apiRequest({ method: "GET", url: `${PLANS_BASE}?id=${String(planId)}` });
      if (!mountedRef.current) return;
      setPlanDetail((prev) => {
        const merged = mergeObjects(prev ?? {}, resp.data ?? {});
        if (shallowEqual(prev, merged)) return prev;
        return merged;
      });
      return;
    } catch (eDirect) {
      console.warn("fetchPlanById direct failed, falling back to list", eDirect?.message || eDirect);
    }
    try {
      const resp2 = await apiRequest({ method: "GET", url: `${PLANS_BASE}` });
      if (!mountedRef.current) return;
      const results = resp2.data && resp2.data.results ? resp2.data.results : resp2.data || [];
      const arr = Array.isArray(results) ? results : (results.plans || results.platforms || []);
      const found = arr.find((p) => String(p.id) === String(planId));
      if (found) {
        setPlanDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, found ?? {});
          if (shallowEqual(prev, merged)) return prev;
          return merged;
        });
      }
    } catch (err) {
      console.error("fetchPlanById error:", err);
    } finally { if (mountedRef.current) setPlansLoading(false); }
  }

  async function fetchNetworkDetail(networkId) {
    if (!networkId) return;
    setNetworkLoading(true);
    try {
      try {
        const resp = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(networkId)}/` });
        if (!mountedRef.current) return;
        setNetworkDetail((prev) => {
          const merged = mergeObjects(prev ?? {}, resp.data ?? {});
          if (shallowEqual(prev, merged)) return prev;
          return merged;
        });
        return;
      } catch (e1) { console.warn("network detail failed, trying root:", e1?.message || e1); }

      const resp2 = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(networkId)}/` });
      if (!mountedRef.current) return;
      setNetworkDetail((prev) => {
        const merged = mergeObjects(prev ?? {}, resp2.data ?? {});
        if (shallowEqual(prev, merged)) return prev;
        return merged;
      });
    } catch (err) {
      console.error("fetchNetworkDetail error:", err);
    } finally { if (mountedRef.current) setNetworkLoading(false); }
  }

  /* ---------------- fetchDeploys (silent option + merge) ---------------- */
  async function fetchDeploys(page = 1, silent = false) {
    if (!id) return;
    if (fetchDeploysLock.current && !silent) return;
    if (!silent) {
      fetchDeploysLock.current = true;
      setLoading(true);
      setError(null);
    }
    const thisFetch = ++fetchIdRef.current;
    try {
      const params = { service_id: id, page };
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}`, params });
      if (thisFetch !== fetchIdRef.current) return; // stale
      const data = resp.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setDeploys((prev) => mergeDeploys(prev, results));
      if (!silent) setPageInfo({ next: data.next, previous: data.previous, count: data.count, page });
    } catch (err) {
      console.error("fetchDeploys error:", err);
      if (!silent) setError("Failed to load deploys.");
    } finally {
      if (!silent) {
        fetchDeploysLock.current = false;
        if (mountedRef.current) setLoading(false);
      }
    }
  }

  /* ---------------- name availability + create/update/delete ---------------- */
  const checkNameAvailable = async (candidate) => {
    if (!candidate) return false;
    if (editingDeployId && candidate === editOriginalName) return true;
    setCheckingName(true);
    try {
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}name_is_available/`, params: { name: candidate } });
      return resp.data && resp.data.result === true;
    } catch (err) {
      console.error("checkNameAvailable:", err);
      return false;
    } finally {
      if (mountedRef.current) setCheckingName(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null); setSuccessMessage("");
    if (!name || name.length < 4) { setError("Name must be at least 4 characters."); return; }
    setSubmitting(true);
    try {
      const available = await checkNameAvailable(name);
      if (!available) { setError("The name is already taken or not available."); setSubmitting(false); return; }

      if (!zipFile) {
        const payload = { name, service: id, version, config };
        const createResp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}`, data: payload });
        if (createResp.status === 201) { setSuccessMessage("Deploy created."); await fetchDeploys(1); setName(""); setVersion(""); setConfig(""); }
        else setError("Create request failed.");
      } else {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("service", id);
        if (version) fd.append("version", version);
        if (config) fd.append("config", config);
        fd.append("zip_file", zipFile);

        const key = "create";
        setUploadProgress((p) => ({ ...p, [key]: 0 }));

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.post(`${DEPLOY_BASE}`, fd, {
          headers,
          onUploadProgress: (ev) => { if (ev.total) setUploadProgress((p) => ({ ...p, [key]: Math.round((ev.loaded * 100) / ev.total) })); },
        });

        if (resp.status === 201) {
          setSuccessMessage("Deploy created.");
          await fetchDeploys(1);
          setName(""); setVersion(""); setConfig(""); setZipFile(null);
          if (zipInputRef.current) zipInputRef.current.value = "";
        } else setError("Create (multipart) request failed.");
        setUploadProgress((p) => ({ ...p, [key]: undefined }));
      }
    } catch (err) {
      console.error("handleCreate err:", err);
      setError(err.response?.data ? JSON.stringify(err.response.data) : "Unexpected error creating deploy.");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  const handleUpdate = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { updating: true });
    try {
      if (!editData.name || editData.name.length < 4) { setError("Name must be at least 4 characters."); setAction(deployId, { updating: false }); return; }
      const available = await checkNameAvailable(editData.name);
      if (!available) { setError("The name is already taken or not available."); setAction(deployId, { updating: false }); return; }

      if (!editZipFile) {
        const payload = { name: editData.name, version: editData.version, config: editData.config };
        const resp = await apiRequest({ method: "PUT", url: `${DEPLOY_BASE}${deployId}/`, data: payload });
        if (resp.status === 200) { setSuccessMessage("Deploy updated."); await fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update failed.");
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

        if (resp.status === 200) { setSuccessMessage("Deploy updated."); await fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update (multipart) failed.");
      }
    } catch (err) {
      console.error("handleUpdate err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected update error");
    } finally {
      setAction(deployId, { updating: false });
    }
  };

  const handleDestroy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { deleting: true });
    try {
      const resp = await apiRequest({ method: "DELETE", url: `${DEPLOY_BASE}${deployId}/` });
      if (resp.status >= 200 && resp.status < 300) { setSuccessMessage("Deploy deleted."); await fetchDeploys(pageInfo.page); } else setError("Delete failed.");
    } catch (err) { console.error("handleDestroy err:", err); setError(err.response ? JSON.stringify(err.response.data) : "Unexpected delete error"); }
    finally { setAction(deployId, { deleting: false }); }
  };

  /* ---------------- select / unselect deploy for service ---------------- */
  const setDeploy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { selecting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}set_deploy/`, data: { deploy_id: deployId, service_id: id } });
      if (resp.status >= 200 && resp.status < 300) {
        setSuccessMessage("Deploy selected for service.");
        await fetchService();
        await fetchDeploys(pageInfo.page || 1);
      } else {
        setError(resp.data ? JSON.stringify(resp.data) : "Failed to select deploy.");
      }
    } catch (err) {
      console.error("setDeploy err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error selecting deploy");
    } finally {
      setAction(deployId, { selecting: false });
    }
  };

  const unsetDeploy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { selecting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}unset_deploy/`, data: { deploy_id: deployId, service_id: id } });
      if (resp.status >= 200 && resp.status < 300) {
        setSuccessMessage("Deploy unselected.");
        await fetchService();           // اینجا مهم است: selected_deploy به null می‌شود و با mergeObjects اصلاح‌شده، state آپدیت می‌شود
        await fetchDeploys(pageInfo.page || 1);
      } else {
        setError(resp.data ? JSON.stringify(resp.data) : "Failed to unselect deploy.");
      }
    } catch (err) {
      console.error("unsetDeploy err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error unselecting deploy");
    } finally {
      setAction(deployId, { selecting: false });
    }
  };

  /* ---------------- start / stop service ---------------- */
  const startService = async () => {
    if (!id) return;
    setError(null); setSuccessMessage(""); setServiceLoading(true);
    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}start_service/`,
        data: { service_id: id }
      });
      if (resp.status === 202) {
        setSuccessMessage("Service start requested.");
        await fetchService();
      } else setError(resp.data ? JSON.stringify(resp.data) : "Failed to start service.");
    } catch (err) {
      console.error("startService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error starting service");
    } finally {
      if (mountedRef.current) setServiceLoading(false);
    }
  };

  const stopService = async () => {
    if (!id) return;
    setError(null); setSuccessMessage(""); setServiceLoading(true);
    try {
      const resp = await apiRequest({
        method: "POST",
        url: `${SERVICE_ACTION_ROOT}stop_service/`,
        data: { service_id: id }
      });
      if (resp.status === 202) {
        setSuccessMessage("Service stop requested.");
        await fetchService();
      } else setError(resp.data ? JSON.stringify(resp.data) : "Failed to stop service.");
    } catch (err) {
      console.error("stopService err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Error stopping service");
    } finally {
      if (mountedRef.current) setServiceLoading(false);
    }
  };

  const checkServiceRunning = async () => {
    if (!id) return;
    try {
      const resp = await apiRequest({ method: "POST", url: `${SERVICE_ACTION_ROOT}service_status/`, data: { service_id: id } });
      if (resp.status === 200 && resp.data) setServiceRunning(!!resp.data.running);
      else setServiceRunning(false);
    } catch (err) { console.error("checkServiceRunning err:", err); setServiceRunning(false); }
  };

  /* ---------------- edit helpers & pagination ---------------- */
  const handleEditClick = (d) => {
    setEditingDeployId(d.id);
    setEditData({ name: d.name || "", version: d.version || "", config: d.config || "" });
    setEditOriginalName(d.name || "");
    setEditZipFile(null);
    setSuccessMessage("");
    setError(null);
    const formEl = document.querySelector(".create-deploy");
    if (formEl) formEl.scrollIntoView({ behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingDeployId(null);
    setEditData({ name: "", version: "", config: "" });
    setEditOriginalName("");
    setEditZipFile(null);
    if (editZipInputRef.current) editZipInputRef.current.value = "";
  };

  const handlePrev = () => { if (!pageInfo.previous) return; try { const u = new URL(pageInfo.previous); fetchDeploys(parseInt(u.searchParams.get("page") || "1", 10)); } catch { fetchDeploys(Math.max(1, pageInfo.page - 1)); } };
  const handleNext = () => { if (!pageInfo.next) return; try { const u = new URL(pageInfo.next); fetchDeploys(parseInt(u.searchParams.get("page") || String(pageInfo.page + 1), 10)); } catch { fetchDeploys(pageInfo.page + 1); } };

  const handleFileChange = (e) => setZipFile(e.target.files[0] || null);
  const handleEditFileChange = (e) => setEditZipFile(e.target.files[0] || null);

  const openConfirm = (type, deployId, title, message) => setConfirmModal({ open: true, type, deployId, title, message, loading: false });
  const closeModal = () => setConfirmModal({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const confirmModalAction = async () => {
    const { type, deployId } = confirmModal;
    if (!type) { closeModal(); return; }
    setConfirmModal((c) => ({ ...c, loading: true }));
    try {
      if (type === "delete") await handleDestroy(deployId);
      else if (type === "select") await setDeploy(deployId);
      else if (type === "unselect") await unsetDeploy(deployId);
    } finally {
      setConfirmModal((c) => ({ ...c, loading: false }));
      setTimeout(() => closeModal(), 120);
    }
  };

  const openServiceInNewTab = () => { if (!service || !service.name) return; const host = `${service.service_name}${DOMAIN_SUFFIX}`; window.open(`http://${host}`, "_blank"); };
  const goBackToServices = () => navigate("/services");

  /* ---------------- auto-refresh effect ---------------- */
  useEffect(() => {
    if (intervalTimerRef.current) {
      clearInterval(intervalTimerRef.current);
      intervalTimerRef.current = null;
    }
    if (!autoRefreshEnabled) return;
    if (!refreshIntervalSec || refreshIntervalSec <= 0) return;
    intervalTimerRef.current = setInterval(() => {
      fetchService(true);
      fetchDeploys(pageInfo.page || 1, true);
    }, refreshIntervalSec * 1000);
    return () => {
      if (intervalTimerRef.current) {
        clearInterval(intervalTimerRef.current);
        intervalTimerRef.current = null;
      }
    };
  }, [autoRefreshEnabled, refreshIntervalSec, pageInfo.page, fetchService]);

  /* ---------------- mount initial ---------------- */
  useEffect(() => {
    if (!id) return;
    fetchService();
    fetchDeploys(1);
  }, [id]);

  /* ---------------- UI render ---------------- */
  return (
    <div className="service-detail-root">
      <div className="service-detail-container">
        <div className="main-col">
          <div className="top-row">
            <div className="left-actions">
              <button className="back-btn" onClick={goBackToServices} aria-label="Back to services">← Back to services</button>
            </div>
            <div className="page-title">
              <h2 className="sd-title">Service Detail</h2>
              <p className="sd-sub">Service ID: {id}</p>
            </div>
            <div className="right-actions">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="secondary-btn"
                  onClick={() => { fetchService(); fetchDeploys(1); }}
                  disabled={serviceLoading}
                >
                  {serviceLoading ? "Refreshing..." : "Refresh"}
                </button>

                <div className="refresh-controls" style={{ position: "relative" }}>
                  <button
                    className={`refresh-select-button ${autoRefreshEnabled ? "active" : "muted"}`}
                    onClick={() => setShowIntervalMenu((s) => !s)}
                    title="Auto-refresh interval"
                    aria-haspopup="true"
                    aria-expanded={showIntervalMenu}
                  >
                    {autoRefreshEnabled ? `${refreshIntervalSec}s` : "Auto: off"}
                    <span style={{ marginLeft: 8, opacity: 0.8 }}>▾</span>
                  </button>

                  {showIntervalMenu && (
                    <div className="refresh-menu" onMouseLeave={() => setShowIntervalMenu(false)}>
                      <div className="refresh-menu-row">
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={autoRefreshEnabled} onChange={(e) => setAutoRefreshEnabled(e.target.checked)} />
                          <span style={{ marginLeft: 6 }}>Enable auto-refresh</span>
                        </label>
                      </div>
                      <div className="refresh-options" role="menu">
                        {REFRESH_CHOICES.map((s) => (
                          <button
                            key={String(s)}
                            className={`refresh-option ${s === refreshIntervalSec ? "selected" : ""}`}
                            onClick={() => { setRefreshIntervalSec(s); setShowIntervalMenu(false); if (s === 0) setAutoRefreshEnabled(false); else setAutoRefreshEnabled(true); }}
                          >
                            {s === 0 ? "Off" : `${s} second${s > 1 ? "s" : ""}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* create-deploy card */}
          <section className="card create-deploy">
            <div className="card-head">
              <h3>{editingDeployId ? "Edit Deploy" : "Create Deploy"}</h3>
            </div>

            <form onSubmit={(e) => { if (editingDeployId) { e.preventDefault(); handleUpdate(editingDeployId); } else { handleCreate(e); } }} className="sd-form create-deploy">
              <input className="sd-input" value={editingDeployId ? editData.name : name} onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, name: e.target.value })) : setName(e.target.value))} placeholder="Name (>=4 chars)" />
              <input className="sd-input" value={editingDeployId ? editData.version : version} onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, version: e.target.value })) : setVersion(e.target.value))} placeholder="Version (optional)" />
              <textarea className="sd-textarea" value={editingDeployId ? editData.config : config} onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, config: e.target.value })) : setConfig(e.target.value))} placeholder="Config (optional)" />

              <div className="file-block">
                {!editingDeployId ? (
                  <>
                    <input id="zipFileInput" ref={zipInputRef} type="file" accept=".zip" onChange={handleFileChange} className="sd-file" />
                    {zipFile && <div className="file-info">Selected file: <strong>{zipFile.name}</strong> ({Math.round(zipFile.size / 1024)} KB)</div>}
                    {uploadProgress["create"] >= 0 && uploadProgress["create"] !== undefined && (
                      <div className="progress-row">
                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress["create"]}%` }} /></div>
                        <div className="progress-label">{uploadProgress["create"]}%</div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="edit-file-block">
                    <label className="sd-file-label">Replace zip file (optional)</label>
                    <input type="file" accept=".zip" ref={editZipInputRef} onChange={handleEditFileChange} className="sd-file" />
                    {editZipFile && <div className="file-info">Selected file: <strong>{editZipFile.name}</strong></div>}
                  </div>
                )}
              </div>

              <div className="sd-form-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="primary-btn" disabled={submitting || checkingName || (editingDeployId ? actionState[editingDeployId]?.updating : false)}>
                  {editingDeployId ? (actionState[editingDeployId]?.updating ? "Updating..." : "Update Deploy") : (submitting ? "Submitting..." : "Create Deploy")}
                </button>

                {!editingDeployId ? (
                  <button type="button" className="secondary-btn" onClick={() => { setName(""); setVersion(""); setConfig(""); setZipFile(null); if (zipInputRef.current) zipInputRef.current.value = ""; }}>Reset</button>
                ) : (
                  <button type="button" className="cancel-edit-btn" onClick={handleCancelEdit}>Cancel edit</button>
                )}
              </div>
            </form>

            {checkingName && <div className="info">Checking name availability...</div>}
            {error && <div className="error">{error}</div>}
            {successMessage && <div className="success">{successMessage}</div>}
          </section>

          {/* deploy list */}
          <section className="card deploy-list">
            <h3>Existing Deploys</h3>

            {loading ? <div className="info">Loading...</div> : deploys.length === 0 ? <div className="info">No deploys found for this service.</div> : (
              <>
                <div className="deploys-wrapper">
                  {deploys.map((d) => {
                    const key = String(d.id ?? d.pk ?? d.name);
                    const selectedId = service && service.selected_deploy ? (service.selected_deploy.id ?? service.selected_deploy) : null;
                    const isSelected = selectedId !== null && String(selectedId) === String(d.id);
                    const cannotSelect = service && ["queued","deploying","stopping"].includes(String(service.status));

                    return (
                      <div key={key} data-uid={key} className={`deploy-item ${isSelected ? 'selected' : ''}`}>
                        <div className="deploy-meta">
                          <div className="deploy-name">
                            {d.name}
                            {isSelected ? <span className="selected-badge"> (Selected)</span> : null}
                            <span className="deploy-id">#{d.id ?? d.pk ?? "-"}</span>
                          </div>
                          <div className="deploy-small">version: {d.version || "-"}</div>
                          <div className="deploy-small">created: {d.created_at ? new Date(d.created_at).toLocaleString() : "-"}</div>
                        </div>

                        <div className="deploy-actions">
                          {isSelected ? (
                            <button
                              onClick={() => openConfirm('unselect', d.id, 'Unselect deploy', `Unselect deploy "${d.name}" from service?`)}
                              disabled={actionState[d.id]?.selecting || cannotSelect}
                              className={`action-btn unselect-btn ${actionState[d.id]?.selecting ? 'working' : ''}`}
                            >
                              {actionState[d.id]?.selecting ? 'Working...' : 'Unselect'}
                            </button>
                          ) : (
                            <button
                              onClick={() => openConfirm('select', d.id, 'Select deploy', `Select deploy "${d.name}" for service?`)}
                              disabled={actionState[d.id]?.selecting || cannotSelect}
                              className={`action-btn select-btn ${actionState[d.id]?.selecting ? 'working' : ''}`}
                            >
                              {actionState[d.id]?.selecting ? 'Working...' : 'Select'}
                            </button>
                          )}

                          <button onClick={() => handleEditClick(d)} className="action-btn edit-btn">Edit</button>

                          <button onClick={() => openConfirm('delete', d.id, 'Delete deploy', `Delete deploy "${d.name}"?`)} disabled={actionState[d.id]?.deleting} className="action-btn delete-btn">
                            {actionState[d.id]?.deleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pagination">
                  <button onClick={handlePrev} disabled={!pageInfo.previous} className="page-btn">Prev</button>
                  <div className="page-info">Page {pageInfo.page} — {pageInfo.count} total</div>
                  <button onClick={handleNext} disabled={!pageInfo.next} className="page-btn">Next</button>
                </div>
              </>
            )}
          </section>
        </div>

        <aside className="aside-col">
          <div className="card aside-card">
            <div className="aside-top">
              <div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Service</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{service ? service.name : <span style={{ color: "#9ca3af" }}>—</span>}</div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Domain</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{service ? `${service.service_name}${DOMAIN_SUFFIX}` : "-"}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>URL</div>
              <div style={{ fontSize: 14 }}>
                {service ? (
                  <a href={`http://${service.service_name}${DOMAIN_SUFFIX}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                    {service.service_name}{DOMAIN_SUFFIX}
                  </a>
                ) : <span style={{ color: "#9ca3af" }}>—</span>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="primary-btn" onClick={openServiceInNewTab} disabled={!service || !service.name}>Open</button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <strong>Status:</strong> {service ? service.status : "-"}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="primary-btn" onClick={startService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))}>{serviceLoading ? "Working..." : "Start Service"}</button>
              <button className="secondary-btn" onClick={stopService} disabled={!service || serviceLoading || (service && ["queued","deploying","stopping"].includes(String(service.status)))}>{serviceLoading ? "Working..." : "Stop Service"}</button>
              <button className="secondary-btn" onClick={checkServiceRunning}>Check running</button>
            </div>

            {serviceRunning !== null && (
              <div className="info" style={{ marginBottom: 8 }}>{serviceRunning ? "Service appears to be running." : "Service is not running."}</div>
            )}

            <hr style={{ margin: "12px 0", borderColor: "#eef2f7" }} />

            <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
              { (planDetail?.name ?? service?.plan?.name) ? <div style={{ marginBottom: 8 }}><strong>Plan name:</strong> {planDetail?.name ?? service?.plan?.name}</div> : null }
              { (planDetail?.platform ?? service?.plan?.platform) ? <div style={{ marginBottom: 8 }}><strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform}</div> : null }

              { (planDetail?.max_cpu ?? service?.plan?.max_cpu) ? <div style={{ marginBottom: 6 }}><strong>max_cpu:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu}</div> : null }
              { (planDetail?.max_ram ?? service?.plan?.max_ram) ? <div style={{ marginBottom: 6 }}><strong>max_ram:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram}</div> : null }
              { (planDetail?.max_storage ?? service?.plan?.max_storage) ? <div style={{ marginBottom: 6 }}><strong>max_storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage}</div> : null }
              { (planDetail?.storage_type ?? service?.plan?.storage_type) ? <div style={{ marginBottom: 6 }}><strong>storage_type:</strong> {planDetail?.storage_type ?? service?.plan?.storage_type}</div> : null }
              { (planDetail?.plan_type ?? service?.plan?.plan_type) ? <div style={{ marginBottom: 6 }}><strong>plan_type:</strong> {planDetail?.plan_type ?? service?.plan?.plan_type}</div> : null }

              { (planDetail?.price_per_hour ?? service?.plan?.price_per_hour) ? <div style={{ marginTop: 8 }}><strong>price_per_hour:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour}</div> : null }
              { (planDetail?.price_per_day ?? service?.plan?.price_per_day) != null ? <div><strong>price_per_day:</strong> {planDetail?.price_per_day ?? service?.plan?.price_per_day}</div> : null }
              { (planDetail?.price_per_month ?? service?.plan?.price_per_month) != null ? <div><strong>price_per_month:</strong> {planDetail?.price_per_month ?? service?.plan?.price_per_month}</div> : null }
            </div>

            <hr style={{ margin: "12px 0", borderColor: "#eef2f7" }} />

            <div style={{ fontSize: 13, color: "#334155" }}>
              { (service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name) ? (
                <div style={{ marginBottom: 8 }}><strong>Network name:</strong> {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name}</div>
              ) : null }

              { networkLoading ? (
                <div className="info"></div>
              ) : networkDetail ? (
                <>
                  { (networkDetail?.network?.cidr ?? networkDetail?.cidr) ? <div style={{ marginBottom: 6 }}><strong>cidr:</strong> {networkDetail?.network?.cidr ?? networkDetail?.cidr}</div> : null }
                  { (networkDetail?.network?.driver ?? networkDetail?.driver) ? <div style={{ marginBottom: 6 }}><strong>driver:</strong> {networkDetail?.network?.driver ?? networkDetail?.driver}</div> : null }
                  { Array.isArray(networkDetail?.services) ? <div style={{ marginBottom: 8 }}><strong>services_count:</strong> {networkDetail.services.length}</div> : null }
                  { Array.isArray(networkDetail?.services) && networkDetail.services.slice(0, 8).map(s => (
                      <div key={s.id} style={{ fontSize: 12, color: "#475569" }}>• {s.name} {s.id ? `(#${s.id})` : ""}</div>
                    ))
                  }
                </>
              ) : (
                <>
                  { service?.network?.created_at ? <div style={{ marginBottom: 6 }}><strong>created_at:</strong> {new Date(service.network.created_at).toLocaleString()}</div> : null }
                  { service?.network?.description ? <div style={{ marginBottom: 6 }}><strong>description:</strong> {service.network.description}</div> : null }
                </>
              )}
            </div>

            {serviceError && <div className="error" style={{ marginTop: 10 }}>{serviceError}</div>}
          </div>
        </aside>

        <PortalModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          loading={confirmModal.loading}
          confirmLabel={confirmModal.type === "delete" ? "Delete" : confirmModal.type === "unselect" ? "Unselect" : "Select"}
          cancelLabel="Cancel"
          onConfirm={confirmModalAction}
          onCancel={() => setConfirmModal((c) => ({ ...c, open: false }))}
        />
      </div>
    </div>
  );
}