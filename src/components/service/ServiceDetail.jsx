import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import apiRequest from "../customHooks/apiRequest";
import axios from "axios";
import "./ServiceDetail.css";

const API_BASE = "http://127.0.0.1:8000";
const DEPLOY_BASE = `${API_BASE}/deploy/`;
const SERVICE_BASE = `${API_BASE}/services/service/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;
const PLANS_BASE = `${API_BASE}/plans/`;

function PortalModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", loading = false, onConfirm, onCancel }) {
  const elRef = useRef(null);
  if (!elRef.current) {
    const el = document.createElement("div");
    el.setAttribute("data-portal", "service-detail-modal");
    elRef.current = el;
  }

  useEffect(() => {
    const el = elRef.current;
    document.body.appendChild(el);
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      if (el.parentNode === document.body) document.body.removeChild(el);
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onCancel && onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onCancel} aria-modal="true" role="dialog">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button className="primary-btn" onClick={onConfirm} disabled={loading}>
            {loading ? "Please wait..." : confirmLabel}
          </button>
          <button className="secondary-btn" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    elRef.current
  );
}

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

  const DOMAIN_SUFFIX = ".local";

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);
  const fetchDeploysLock = useRef(false);

  // refs for file inputs so we can clear them
  const zipInputRef = useRef(null);
  const editZipInputRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!id) return;
    setPageInfo((p) => ({ ...p, page: 1 }));
    fetchService();
    fetchDeploys(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setAction = (deployId, next) => setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), ...next } }));

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
    } catch { return iso; }
  };

  /* ---------------- fetchService ---------------- */
  const fetchService = useCallback(async () => {
    if (!id) return;
    setServiceLoading(true);
    setServiceError(null);
    setService(null);
    setNetworkDetail(null);
    setPlanDetail(null);

    try {
      const resp = await apiRequest({ method: "GET", url: `${SERVICE_BASE}${id}/` });
      console.debug("fetchService: got", resp.data);
      if (!mountedRef.current) return;
      setService(resp.data);

      const plan = resp.data && resp.data.plan;
      if (plan && typeof plan === "object") {
        setPlanDetail(plan);
      } else if (plan) {
        await fetchPlanById(plan);
      }

      const net = resp.data && resp.data.network;
      if (net && typeof net === "object") {
        setNetworkDetail(net);
      } else if (net) {
        await fetchNetworkDetail(net);
      }
    } catch (err) {
      console.error("fetchService error:", err);
      setServiceError("Failed to load service info.");
      setService(null);
    } finally {
      if (mountedRef.current) setServiceLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------------- fetchPlanById ------------- */
  async function fetchPlanById(planId) {
    if (!planId) return;
    setPlansLoading(true);
    setPlanDetail(null);
    try {
      try {
        const resp = await apiRequest({ method: "GET", url: `${PLANS_BASE}${String(planId)}/` });
        console.debug("fetchPlanById direct:", resp.data);
        if (mountedRef.current) setPlanDetail(resp.data);
        return;
      } catch (eDirect) {
        console.warn("fetchPlanById direct failed, falling back to list", eDirect?.message || eDirect);
      }

      const resp2 = await apiRequest({ method: "GET", url: `${PLANS_BASE}` });
      const results = resp2.data && resp2.data.results ? resp2.data.results : resp2.data || [];
      const arr = Array.isArray(results) ? results : (results.plans || results.platforms || []);
      const found = arr.find((p) => String(p.id) === String(planId));
      if (found) {
        if (mountedRef.current) setPlanDetail(found);
      } else {
        if (service && service.plan && typeof service.plan === "object") {
          setPlanDetail(service.plan);
        } else {
          setPlanDetail(null);
        }
      }
    } catch (err) {
      console.error("fetchPlanById error:", err);
      if (service && service.plan && typeof service.plan === "object") setPlanDetail(service.plan);
      else setPlanDetail(null);
    } finally {
      if (mountedRef.current) setPlansLoading(false);
    }
  }

  /* ------------- fetchNetworkDetail ------------- */
  async function fetchNetworkDetail(networkId) {
    if (!networkId) return;
    setNetworkLoading(true);
    setNetworkDetail(null);
    try {
      try {
        const resp = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(networkId)}/detail/` });
        console.debug("fetchNetworkDetail detail:", resp.data);
        if (mountedRef.current) {
          setNetworkDetail(resp.data);
          return;
        }
      } catch (e1) {
        console.warn("network detail failed, trying root:", e1?.message || e1);
      }

      const resp2 = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${String(networkId)}/` });
      console.debug("fetchNetworkDetail root:", resp2.data);
      if (mountedRef.current) setNetworkDetail(resp2.data);
    } catch (err) {
      console.error("fetchNetworkDetail error:", err);
      if (mountedRef.current) setNetworkDetail(null);
    } finally {
      if (mountedRef.current) setNetworkLoading(false);
    }
  }

  /* ---------------- fetchDeploys ---------------- */
  async function fetchDeploys(page = 1) {
    if (!id) return;
    if (fetchDeploysLock.current) return;
    fetchDeploysLock.current = true;
    setLoading(true);
    setError(null);
    const thisFetch = ++fetchIdRef.current;
    try {
      const params = { service_id: id, page };
      const resp = await apiRequest({ method: "GET", url: `${DEPLOY_BASE}`, params });
      if (thisFetch !== fetchIdRef.current) return; // stale
      const data = resp.data;
      const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setDeploys((prev) => (page === 1 ? results : [...prev, ...results]));
      setPageInfo({ next: data.next, previous: data.previous, count: data.count, page });
    } catch (err) {
      console.error("fetchDeploys error:", err);
      setError("Failed to load deploys.");
    } finally {
      fetchDeploysLock.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }

  /* ---------------- name availability ---------------- */
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

  /* ---------------- create/update/start/stop/delete ---------------- */
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
        if (createResp.status === 201) { setSuccessMessage("Deploy created."); fetchDeploys(1); setName(""); setVersion(""); setConfig(""); }
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
          fetchDeploys(1);
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
        if (resp.status === 200) { setSuccessMessage("Deploy updated."); fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update failed.");
      } else {
        const fd = new FormData();
        fd.append("name", editData.name);
        fd.append("service", id);
        if (editData.version) fd.append("version", editData.version);
        if (editData.config) fd.append("config", editData.config);
        fd.append("zip_file", editZipFile);

        const access = localStorage.getItem("access");
        const headers = access ? { Authorization: `Bearer ${access}` } : {};
        const resp = await axios.put(`${DEPLOY_BASE}${deployId}/`, fd, {
          headers,
          onUploadProgress: (ev) => { /* optional progress */ },
        });

        if (resp.status === 200) { setSuccessMessage("Deploy updated."); fetchDeploys(pageInfo.page); handleCancelEdit(); } else setError("Update (multipart) failed.");
      }
    } catch (err) {
      console.error("handleUpdate err:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected update error");
    } finally {
      setAction(deployId, { updating: false });
    }
  };

  const startDeploy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { starting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}start_container/`, data: { deploy_id: deployId } });
      const result = resp?.data?.result;
      if (result === "success" || result === "sucess") { setSuccessMessage("Deploy start requested."); fetchDeploys(pageInfo.page); } else setError(resp?.data ? JSON.stringify(resp.data) : "Failed to start deploy.");
    } catch (err) { console.error("startDeploy err:", err); setError("Error starting deploy: " + (err.response ? JSON.stringify(err.response.data) : err.message)); }
    finally { setAction(deployId, { starting: false }); }
  };

  const stopDeploy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { stopping: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${DEPLOY_BASE}stop_container/`, data: { deploy_id: deployId } });
      const result = resp?.data?.result;
      if (result === "success" || result === "sucess") { setSuccessMessage("Deploy stop requested."); fetchDeploys(pageInfo.page); } else setError(resp?.data ? JSON.stringify(resp.data) : "Failed to stop deploy.");
    } catch (err) { console.error("stopDeploy err:", err); setError("Error stopping deploy: " + (err.response ? JSON.stringify(err.response.data) : err.message)); }
    finally { setAction(deployId, { stopping: false }); }
  };

  const handleDestroy = async (deployId) => {
    setError(null); setSuccessMessage(""); setAction(deployId, { deleting: true });
    try {
      const resp = await apiRequest({ method: "DELETE", url: `${DEPLOY_BASE}${deployId}/` });
      if (resp.status === 200) { setSuccessMessage("Deploy deleted."); fetchDeploys(pageInfo.page); } else setError("Delete failed.");
    } catch (err) { console.error("handleDestroy err:", err); setError(err.response ? JSON.stringify(err.response.data) : "Unexpected delete error"); }
    finally { setAction(deployId, { deleting: false }); }
  };

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

  const handlePrev = () => {
    if (!pageInfo.previous) return;
    try { const u = new URL(pageInfo.previous); fetchDeploys(parseInt(u.searchParams.get("page") || "1", 10)); } catch { fetchDeploys(Math.max(1, pageInfo.page - 1)); }
  };
  const handleNext = () => {
    if (!pageInfo.next) return;
    try { const u = new URL(pageInfo.next); fetchDeploys(parseInt(u.searchParams.get("page") || String(pageInfo.page + 1), 10)); } catch { fetchDeploys(pageInfo.page + 1); }
  };

  const handleFileChange = (e) => setZipFile(e.target.files[0] || null);
  const handleEditFileChange = (e) => setEditZipFile(e.target.files[0] || null);

  const openConfirm = (type, deployId, title, message) => setConfirmModal({ open: true, type, deployId, title, message, loading: false });
  const closeModal = () => setConfirmModal({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const confirmModalAction = async () => {
    const { type, deployId } = confirmModal;
    if (!type || !deployId) { closeModal(); return; }
    setConfirmModal((c) => ({ ...c, loading: true }));
    try { if (type === "delete") await handleDestroy(deployId); else if (type === "stop") await stopDeploy(deployId); else if (type === "start") await startDeploy(deployId); }
    finally { setConfirmModal((c) => ({ ...c, loading: false })); setTimeout(() => closeModal(), 120); }
  };

  const openServiceInNewTab = () => { if (!service || !service.name) return; const host = `${service.name}${DOMAIN_SUFFIX}`; window.open(`http://${host}`, "_blank"); };

  /* Back to services */
  const goBackToServices = () => navigate("/services");

  /* ---------------- render ---------------- */
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
              <button className="secondary-btn" onClick={() => { fetchService(); fetchDeploys(1); }} disabled={serviceLoading}>{serviceLoading ? "Refreshing..." : "Refresh"}</button>
            </div>
          </div>

          <section className="card create-deploy">
            <div className="card-head">
              <h3>{editingDeployId ? "Edit Deploy" : "Create Deploy"}</h3>
              {editingDeployId ? (
                <div className="edit-controls">
                  <button className="danger-ghost" onClick={handleCancelEdit}>Cancel edit</button>
                </div>
              ) : null}
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
                  <button type="button" className="secondary-btn" onClick={handleCancelEdit}>Cancel</button>
                )}
              </div>
            </form>

            {checkingName && <div className="info">Checking name availability...</div>}
            {error && <div className="error">{error}</div>}
            {successMessage && <div className="success">{successMessage}</div>}
          </section>

          <section className="card deploy-list">
            <h3>Existing Deploys</h3>

            {loading ? <div className="info">Loading...</div> : deploys.length === 0 ? <div className="info">No deploys found for this service.</div> : (
              <>
                <div className="deploys-wrapper">
                  {deploys.map((d) => {
                    const key = String(d.id ?? d.pk ?? d.name);
                    return (
                      <div key={key} data-uid={key} className="deploy-item">
                        <div className="deploy-meta">
                          <div className="deploy-name">{d.name} <span className="deploy-id">#{d.id ?? d.pk ?? "-"}</span></div>
                          <div className="deploy-small">version: {d.version || "-"}</div>
                          <div className="deploy-small">running: {String(d.running)}</div>
                          <div className="deploy-small">created: {formatDate(d.created_at)}</div>
                        </div>

                        <div className="deploy-actions">
                          {!d.running ? (
                            <button onClick={() => openConfirm("start", d.id, "Start deploy", `Start deploy "${d.name}" now?`)} disabled={actionState[d.id]?.starting} className="action-btn start-btn">
                              {actionState[d.id]?.starting ? "Starting..." : "Start"}
                            </button>
                          ) : (
                            <button onClick={() => openConfirm("stop", d.id, "Stop deploy", `Stop running deploy "${d.name}"?`)} disabled={actionState[d.id]?.stopping} className="action-btn stop-btn">
                              {actionState[d.id]?.stopping ? "Stopping..." : "Stop"}
                            </button>
                          )}

                          <button onClick={() => handleEditClick(d)} className="action-btn edit-btn">Edit</button>

                          <button onClick={() => openConfirm("delete", d.id, "Delete deploy", `Delete deploy "${d.name}"?`)} disabled={actionState[d.id]?.deleting} className="action-btn delete-btn">
                            {actionState[d.id]?.deleting ? "Deleting..." : "Delete"}
                          </button>

                          <button onClick={() => fetchDeploys(pageInfo.page)} className="action-btn refresh-btn">Refresh</button>
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
                <div style={{ fontSize: 13, fontWeight: 600 }}>{service ? `${service.name}${DOMAIN_SUFFIX}` : "-"}</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>URL</div>
              <div style={{ fontSize: 14 }}>
                {service ? (
                  <a href={`http://${service.name}${DOMAIN_SUFFIX}`} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
                    {service.name}{DOMAIN_SUFFIX}
                  </a>
                ) : <span style={{ color: "#9ca3af" }}>—</span>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button className="primary-btn" onClick={openServiceInNewTab} disabled={!service || !service.name}>Open</button>
              <button className="secondary-btn" onClick={fetchService} disabled={serviceLoading}>{serviceLoading ? "Refreshing..." : "Refresh"}</button>
            </div>

            <hr style={{ margin: "12px 0", borderColor: "#eef2f7" }} />

            <div style={{ fontSize: 13, color: "#334155", marginBottom: 10 }}>
              <div style={{ marginBottom: 8 }}><strong>Plan name:</strong> {planDetail?.name ?? service?.plan?.name ?? "-"}</div>
              <div style={{ marginBottom: 8 }}><strong>Platform:</strong> {planDetail?.platform ?? service?.plan?.platform ?? "-"}</div>

              <div style={{ marginBottom: 6 }}><strong>max_cpu:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu ?? "-"}</div>
              <div style={{ marginBottom: 6 }}><strong>max_ram:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram ?? "-"}</div>
              <div style={{ marginBottom: 6 }}><strong>max_storage:</strong> {planDetail?.max_storage ?? service?.plan?.max_storage ?? "-"}</div>
              <div style={{ marginBottom: 6 }}><strong>storage_type:</strong> {planDetail?.storage_type ?? service?.plan?.storage_type ?? "-"}</div>
              <div style={{ marginBottom: 6 }}><strong>plan_type:</strong> {planDetail?.plan_type ?? service?.plan?.plan_type ?? "-"}</div>

              <div style={{ marginTop: 8 }}><strong>price_per_hour:</strong> {planDetail?.price_per_hour ?? service?.plan?.price_per_hour ?? "-"}</div>
              {planDetail?.price_per_day !== undefined || service?.plan?.price_per_day !== undefined ? (
                <div><strong>price_per_day:</strong> {planDetail?.price_per_day ?? service?.plan?.price_per_day}</div>
              ) : null}
              {planDetail?.price_per_month !== undefined || service?.plan?.price_per_month !== undefined ? (
                <div><strong>price_per_month:</strong> {planDetail?.price_per_month ?? service?.plan?.price_per_month}</div>
              ) : null}
            </div>

            <hr style={{ margin: "12px 0", borderColor: "#eef2f7" }} />

            <div style={{ fontSize: 13, color: "#334155" }}>
              <div style={{ marginBottom: 8 }}><strong>Network name:</strong> {service?.network?.name ?? networkDetail?.network?.name ?? networkDetail?.name ?? "-"}</div>

              {networkLoading ? (
                <div className="info">Loading network...</div>
              ) : networkDetail ? (
                <>
                  <div style={{ marginBottom: 6 }}><strong>cidr:</strong> {networkDetail.network?.cidr ?? networkDetail.cidr ?? "-"}</div>
                  <div style={{ marginBottom: 6 }}><strong>driver:</strong> {networkDetail.network?.driver ?? networkDetail.driver ?? "-"}</div>
                  <div style={{ marginBottom: 8 }}><strong>services_count:</strong> {Array.isArray(networkDetail.services) ? networkDetail.services.length : "-"}</div>
                  {Array.isArray(networkDetail.services) && networkDetail.services.slice(0, 8).map(s => (
                    <div key={s.id} style={{ fontSize: 12, color: "#475569" }}>• {s.name} {s.id ? `(#${s.id})` : ""}</div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 6 }}><strong>created_at:</strong> {service?.network?.created_at ? formatDate(service.network.created_at) : "-"}</div>
                  <div style={{ marginBottom: 6 }}><strong>description:</strong> {service?.network?.description ?? "-"}</div>
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
          confirmLabel={confirmModal.type === "delete" ? "Delete" : confirmModal.type === "stop" ? "Stop" : "Start"}
          cancelLabel="Cancel"
          onConfirm={confirmModalAction}
          onCancel={() => setConfirmModal((c) => ({ ...c, open: false }))}
        />
      </div>
    </div>
  );
}
