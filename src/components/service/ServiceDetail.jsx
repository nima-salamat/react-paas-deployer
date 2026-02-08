import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import apiRequest from "../customHooks/apiRequest";
import axios from "axios";
import "./ServiceDetail.css";

function PortalModal({ open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", loading = false, onConfirm, onCancel }) {
  const elRef = useRef(null);

  useEffect(() => {
    if (!elRef.current) {
      elRef.current = document.createElement("div");
      // mark for debugging
      elRef.current.setAttribute("data-portal", "service-detail-modal");
    }
    const el = elRef.current;
    document.body.appendChild(el);

    // lock body scroll
    const prevOverflow = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";

    return () => {
      // restore overflow and cleanup
      document.body.style.overflow = prevOverflow;
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

  const backdropStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2147483647,
    padding: "16px",
    boxSizing: "border-box",
  };

  const modalStyle = {
    width: "100%",
    maxWidth: "520px",
    background: "#fff",
    color: "#0f172a",
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 12px 40px rgba(2,6,23,0.35)",
    zIndex: 2147483648,
  };

  const titleStyle = { margin: 0, marginBottom: 8, fontSize: 18, fontWeight: 700 };
  const messageStyle = { margin: 0, marginBottom: 16, color: "#334155", whiteSpace: "pre-wrap" };

  const actionsStyle = { display: "flex", gap: 10, justifyContent: "flex-end" };
  const primaryBtnStyle = {
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "9px 14px",
    borderRadius: 8,
    fontWeight: 600,
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.7 : 1,
  };
  const secondaryBtnStyle = {
    background: "transparent",
    border: "1px solid #e5e7eb",
    padding: "9px 12px",
    borderRadius: 8,
    cursor: loading ? "not-allowed" : "pointer",
  };

  return createPortal(
    <div style={backdropStyle} onClick={onCancel} aria-modal="true" role="dialog">
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={titleStyle}>{title}</h3>
        <p style={messageStyle}>{message}</p>
        <div style={actionsStyle}>
          <button style={primaryBtnStyle} onClick={onConfirm} disabled={loading}>
            {loading ? "Please wait..." : confirmLabel}
          </button>
          <button style={secondaryBtnStyle} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    elRef.current
  );
}

/* ---------- Main Component ---------- */
export default function ServiceDetail() {
  const { id } = useParams();

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

  const [uploadProgress, setUploadProgress] = useState({}); // { key: percent }
  // modal state: { open, type, deployId, title, message, loading }
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const BASE = "http://127.0.0.1:8000/deploy/";

  useEffect(() => {
    fetchDeploys(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setAction = (deployId, next) =>
    setActionState((s) => ({ ...s, [deployId]: { ...(s[deployId] || {}), ...next } }));

  const getPageFromUrl = (url) => {
    try {
      const u = new URL(url);
      const p = u.searchParams.get("page");
      return p ? parseInt(p, 10) : null;
    } catch {
      return null;
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso;
    }
  };

  async function fetchDeploys(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const params = { service_id: id, page };
      const resp = await apiRequest({ url: BASE, params });
      const data = resp.data;
      setDeploys(data.results || []);
      setPageInfo({ next: data.next, previous: data.previous, count: data.count, page });
    } catch (err) {
      console.error("fetchDeploys:", err);
      setError("Failed to load deploys.");
    } finally {
      setLoading(false);
    }
  }

  const handlePrev = () => {
    if (!pageInfo.previous) return;
    const prev = getPageFromUrl(pageInfo.previous) || Math.max(1, pageInfo.page - 1);
    fetchDeploys(prev);
  };
  const handleNext = () => {
    if (!pageInfo.next) return;
    const next = getPageFromUrl(pageInfo.next) || pageInfo.page + 1;
    fetchDeploys(next);
  };

  const handleFileChange = (e) => setZipFile(e.target.files[0] || null);
  const handleEditFileChange = (e) => setEditZipFile(e.target.files[0] || null);

  const checkNameAvailable = async (candidate) => {
    if (!candidate) return false;
    if (editingDeployId && candidate === editOriginalName) return true;
    setCheckingName(true);
    try {
      const resp = await apiRequest({ url: `${BASE}name_is_available/`, params: { name: candidate } });
      return resp.data && resp.data.result === true;
    } catch (err) {
      console.error("checkNameAvailable:", err);
      return false;
    } finally {
      setCheckingName(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage("");
    if (!name || name.length < 4) {
      setError("Name must be at least 4 characters.");
      return;
    }
    setSubmitting(true);

    try {
      const available = await checkNameAvailable(name);
      if (!available) {
        setError("The name is already taken or not available.");
        setSubmitting(false);
        return;
      }

      if (!zipFile) {
        const payload = { name, service: id, version, config };
        const createResp = await apiRequest({ method: "POST", url: BASE, data: payload });
        if (createResp.status === 201) {
          setSuccessMessage("Deploy created.");
          fetchDeploys(1);
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
        const headers = {};
        if (access) headers["Authorization"] = `Bearer ${access}`;

        const key = "create";
        setUploadProgress((p) => ({ ...p, [key]: 0 }));

        const createResp = await axios.post(BASE, fd, {
          headers,
          onUploadProgress: (ev) => {
            if (!ev.total) return;
            const percent = Math.round((ev.loaded * 100) / ev.total);
            setUploadProgress((p) => ({ ...p, [key]: percent }));
          },
        });

        if (createResp.status === 201) {
          setSuccessMessage("Deploy created.");
          fetchDeploys(1);
          setName("");
          setVersion("");
          setConfig("");
          setZipFile(null);
          const fileInput = document.querySelector("#zipFileInput");
          if (fileInput) fileInput.value = "";
        } else {
          setError("Create (multipart) request failed.");
        }
        setUploadProgress((p) => ({ ...p, [key]: undefined }));
      }
    } catch (err) {
      console.error("handleCreate:", err);
      if (err.response && err.response.data) {
        setError(typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data));
      } else {
        setError("Unexpected error creating deploy.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startDeploy = async (deployId) => {
    setError(null);
    setSuccessMessage("");
    setAction(deployId, { starting: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${BASE}start_container/`, data: { deploy_id: deployId } });
      const result = resp && resp.data && resp.data.result;
      if (result === "success" || result === "sucess") {
        setSuccessMessage("Deploy start requested.");
        fetchDeploys(pageInfo.page);
      } else {
        setError(resp && resp.data ? JSON.stringify(resp.data) : "Failed to start deploy.");
      }
    } catch (err) {
      console.error("startDeploy:", err);
      setError("Error starting deploy: " + (err.response ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setAction(deployId, { starting: false });
    }
  };

  const stopDeploy = async (deployId) => {
    setError(null);
    setSuccessMessage("");
    setAction(deployId, { stopping: true });
    try {
      const resp = await apiRequest({ method: "POST", url: `${BASE}stop_container/`, data: { deploy_id: deployId } });
      const result = resp && resp.data && resp.data.result;
      if (result === "success" || result === "sucess") {
        setSuccessMessage("Deploy stop requested.");
        fetchDeploys(pageInfo.page);
      } else {
        setError(resp && resp.data ? JSON.stringify(resp.data) : "Failed to stop deploy.");
      }
    } catch (err) {
      console.error("stopDeploy:", err);
      setError("Error stopping deploy: " + (err.response ? JSON.stringify(err.response.data) : err.message));
    } finally {
      setAction(deployId, { stopping: false });
    }
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
  };

  const handleUpdate = async (deployId) => {
    setError(null);
    setSuccessMessage("");
    setAction(deployId, { updating: true });
    try {
      if (!editData.name || editData.name.length < 4) {
        setError("Name must be at least 4 characters.");
        setAction(deployId, { updating: false });
        return;
      }
      const available = await checkNameAvailable(editData.name);
      if (!available) {
        setError("The name is already taken or not available.");
        setAction(deployId, { updating: false });
        return;
      }

      if (!editZipFile) {
        const payload = { name: editData.name, version: editData.version, config: editData.config };
        const resp = await apiRequest({ method: "PUT", url: `${BASE}${deployId}/`, data: payload });
        if (resp.status === 200) {
          setSuccessMessage("Deploy updated.");
          fetchDeploys(pageInfo.page);
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
        const headers = {};
        if (access) headers["Authorization"] = `Bearer ${access}`;

        const key = `update-${deployId}`;
        setUploadProgress((p) => ({ ...p, [key]: 0 }));

        const resp = await axios({
          method: "put",
          url: `${BASE}${deployId}/`,
          data: fd,
          headers,
          onUploadProgress: (ev) => {
            if (!ev.total) return;
            const percent = Math.round((ev.loaded * 100) / ev.total);
            setUploadProgress((p) => ({ ...p, [key]: percent }));
          },
        });

        if (resp.status === 200) {
          setSuccessMessage("Deploy updated.");
          fetchDeploys(pageInfo.page);
          handleCancelEdit();
        } else {
          setError("Update (multipart) failed.");
        }

        setUploadProgress((p) => ({ ...p, [key]: undefined }));
      }
    } catch (err) {
      console.error("handleUpdate:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected update error");
    } finally {
      setAction(deployId, { updating: false });
    }
  };

  const handleDestroy = async (deployId) => {
    setError(null);
    setSuccessMessage("");
    setAction(deployId, { deleting: true });
    try {
      const resp = await apiRequest({ method: "DELETE", url: `${BASE}${deployId}/` });
      if (resp.status === 200) {
        setSuccessMessage("Deploy deleted.");
        fetchDeploys(pageInfo.page);
      } else {
        setError("Delete failed.");
      }
    } catch (err) {
      console.error("handleDestroy:", err);
      setError(err.response ? JSON.stringify(err.response.data) : "Unexpected delete error");
    } finally {
      setAction(deployId, { deleting: false });
      // close modal handled by confirm flow
    }
  };

  // modal helpers
  const openConfirm = (type, deployId, title, message) => setConfirmModal({ open: true, type, deployId, title, message, loading: false });
  const closeModal = () => setConfirmModal({ open: false, type: null, deployId: null, title: "", message: "", loading: false });

  const confirmModalAction = async () => {
    const { type, deployId } = confirmModal;
    if (!type || !deployId) {
      closeModal();
      return;
    }
    setConfirmModal((c) => ({ ...c, loading: true }));
    try {
      if (type === "delete") {
        await handleDestroy(deployId);
      } else if (type === "stop") {
        await stopDeploy(deployId);
      } else if (type === "start") {
        await startDeploy(deployId);
      }
    } finally {
      setConfirmModal((c) => ({ ...c, loading: false }));
      // slight delay to ensure state updates, then close
      setTimeout(() => closeModal(), 120);
    }
  };

  return (
    <div className="service-detail-container">
      <h2 className="sd-title">Service Detail</h2>
      <p className="sd-sub">Service ID: {id}</p>

      <section className="card create-deploy">
        <h3>{editingDeployId ? "Edit Deploy" : "Create Deploy"}</h3>

        <form
          onSubmit={(e) => {
            if (editingDeployId) {
              e.preventDefault();
              handleUpdate(editingDeployId);
            } else {
              handleCreate(e);
            }
          }}
          className="sd-form"
        >
          <input
            className="sd-input"
            value={editingDeployId ? editData.name : name}
            onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, name: e.target.value })) : setName(e.target.value))}
            placeholder="Name (>=4 chars)"
          />

          <input
            className="sd-input"
            value={editingDeployId ? editData.version : version}
            onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, version: e.target.value })) : setVersion(e.target.value))}
            placeholder="Version (optional)"
          />

          <textarea
            className="sd-textarea"
            value={editingDeployId ? editData.config : config}
            onChange={(e) => (editingDeployId ? setEditData((d) => ({ ...d, config: e.target.value })) : setConfig(e.target.value))}
            placeholder="Config (JSON or plain text) (optional)"
          />

          <div>
            {!editingDeployId ? (
              <>
                <input id="zipFileInput" type="file" accept=".zip" onChange={handleFileChange} className="sd-file" />
                {zipFile && <div className="file-info">Selected file: <strong>{zipFile.name}</strong> ({Math.round(zipFile.size/1024)} KB)</div>}
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
                <input type="file" accept=".zip" onChange={handleEditFileChange} className="sd-file" />
                <button type="button" className="clear-file-btn" onClick={() => { setEditZipFile(null); const fi = document.querySelector(".edit-file-block input[type=file]"); if (fi) fi.value = ""; }}>Clear</button>
                {editZipFile && <div className="file-info">Selected file: <strong>{editZipFile.name}</strong> ({Math.round(editZipFile.size/1024)} KB)</div>}
                {uploadProgress[`update-${editingDeployId}`] >= 0 && uploadProgress[`update-${editingDeployId}`] !== undefined && (
                  <div className="progress-row">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${uploadProgress[`update-${editingDeployId}`]}%` }} /></div>
                    <div className="progress-label">{uploadProgress[`update-${editingDeployId}`]}%</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sd-form-actions">
            <button type="submit" className="primary-btn" disabled={submitting || checkingName || (editingDeployId ? actionState[editingDeployId]?.updating : false)}>
              {editingDeployId ? (actionState[editingDeployId]?.updating ? "Updating..." : "Update Deploy") : (submitting ? "Submitting..." : "Create Deploy")}
            </button>

            {editingDeployId ? (
              <button type="button" className="secondary-btn" onClick={handleCancelEdit}>Cancel</button>
            ) : (
              <button type="button" className="secondary-btn" onClick={() => { setName(""); setVersion(""); setConfig(""); setZipFile(null); const fi = document.querySelector("#zipFileInput"); if (fi) fi.value = ""; }}>Reset</button>
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
              {deploys.map((d) => (
                <div key={d.id} className="deploy-item">
                  <div className="deploy-meta">
                    <div className="deploy-name">{d.name} <span className="deploy-id">#{d.id}</span></div>
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
              ))}
            </div>

            <div className="pagination">
              <button onClick={handlePrev} disabled={!pageInfo.previous} className="page-btn">Prev</button>
              <div className="page-info">Page {pageInfo.page} — {pageInfo.count} total</div>
              <button onClick={handleNext} disabled={!pageInfo.next} className="page-btn">Next</button>
            </div>
          </>
        )}
      </section>

      <PortalModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={confirmModal.loading}
        confirmLabel={confirmModal.type === "delete" ? "Delete" : confirmModal.type === "stop" ? "Stop" : "Start"}
        cancelLabel="Cancel"
        onConfirm={confirmModalAction}
        onCancel={closeModal}
      />
    </div>
  );
}
