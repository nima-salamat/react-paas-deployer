// src/components/ServicesList.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate } from "react-router-dom";
import "./Services.css";

const API_BASE = "http://127.0.0.1:8000";
const PLANS_API = `${API_BASE}/plans/`;
const PLATFORMS_API = `${API_BASE}/plans/platforms/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;

/* ---------------- Modal (portal + center + simple scale animation, no vertical move) ---------------- */
function Modal({ open, onClose, title, children, ariaLabelledBy }) {
  const mountRef = useRef(null);
  const modalRef = useRef(null);
  const lastActiveRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) {
      mountRef.current = document.createElement("div");
      mountRef.current.className = "modal-root";
      document.body.appendChild(mountRef.current);
    }
    return () => {
      if (mountRef.current) {
        try { document.body.removeChild(mountRef.current); } catch {}
        mountRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    lastActiveRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const t = setTimeout(() => {
      const focusable = modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable ?? modalRef.current)?.focus?.();
    }, 10);

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") {
        // focus trap (simple)
        const nodes = modalRef.current?.querySelectorAll(
          'a[href], area[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!nodes || nodes.length === 0) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      try { lastActiveRef.current?.focus?.(); } catch {}
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!mountRef.current) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div
            className="modal-card"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy || (title ? "modal-title" : undefined)}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="modal-header">
              {title && <h3 id={ariaLabelledBy || "modal-title"} className="modal-title">{title}</h3>}
              <button className="btn-icon" aria-label="Close dialog" onClick={onClose}><span aria-hidden>×</span></button>
            </div>

            <div className="modal-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    mountRef.current
  );
}

/* ---------------- Helpers ---------------- */
const getServicePlatform = (service) => {
  if (!service) return null;
  // prefer explicit platform on plan object, else service.platform, else fallback to plan name/string
  if (service.plan && typeof service.plan === "object") return service.plan.platform ?? service.plan.name ?? null;
  if (service.platform) return service.platform;
  // if plan is primitive id/string we can't infer platform — caller should handle
  return null;
};

/* ---------------- ServicesList (main) ---------------- */
export default function ServicesList({
  apiUrl = "/services/service/",
  pageSize = 10,
  showSearch = true,
  extraQueryParams = {},
  onOpen = null,
}) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [query, setQuery] = useState("");

  const [planCache, setPlanCache] = useState({});
  const [networkCache, setNetworkCache] = useState({});

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [editingService, setEditingService] = useState(null); // { service, network, planId, creatingNetwork }
  const [plansForPlatform, setPlansForPlatform] = useState({});

  const [alert, setAlert] = useState(null);

  const fetchIdRef = useRef(0);
  const lastKeyRef = useRef(null);

  const navigate = useNavigate();

  const getKey = (s) => {
    if (!s) return "null";
    if (s.id !== undefined && s.id !== null) return String(s.id);
    if (s.pk !== undefined && s.pk !== null) return String(s.pk);
    const name = typeof s.name === "string" ? s.name : JSON.stringify(s.name ?? "");
    const platform = (s.plan && s.plan.platform) || "";
    return `${name}|${platform}`;
  };

  const uniqueBy = (arr, keyFn) => {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
      const k = keyFn(item);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    }
    return out;
  };

  const buildUrl = useCallback(
    (basePath, extra = {}) => {
      try {
        const isAbsolute = String(basePath).startsWith("http://") || String(basePath).startsWith("https://");
        const base = isAbsolute ? basePath : `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        const url = new URL(base);
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        if (query) url.searchParams.set("q_search", query);
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
        });
        return url.href;
      } catch {
        const base = `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        const sep = base.includes("?") ? "&" : "?";
        let qs = `page=${page}&page_size=${pageSize}`;
        if (query) qs += `&q_search=${encodeURIComponent(query)}`;
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });
        return base + sep + qs;
      }
    },
    [page, pageSize, query]
  );

  /* ---------------- fetch services ---------------- */
  useEffect(() => {
    const fetchServices = async () => {
      const thisFetchId = ++fetchIdRef.current;
      setLoading(page === 1);
      setLoadingMore(page > 1);
      setError(null);

      try {
        if (page === 1) lastKeyRef.current = null;
        else lastKeyRef.current = services.length > 0 ? getKey(services[services.length - 1]) : null;

        const url = buildUrl(apiUrl, extraQueryParams);
        const res = await apiRequest({ method: "GET", url });
        if (fetchIdRef.current !== thisFetchId) return; // stale
        const data = res.data;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

        setServices((prev) => {
          if (page === 1) return uniqueBy(results, getKey);
          const existingKeys = new Set(prev.map((p) => getKey(p)));
          const newItems = results.filter((r) => !existingKeys.has(getKey(r)));
          if (newItems.length === 0) return prev;
          return [...prev, ...newItems];
        });

        setHasNext(Boolean(data?.next));
      } catch (e) {
        setError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to load services.");
        setServices([]);
        setHasNext(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, apiUrl, buildUrl, JSON.stringify(extraQueryParams), query]);

  /* ---------------- networks & plan cache ---------------- */
  const fetchNetworks = useCallback(async () => {
    setNetworksLoading(true);
    try {
      const url = buildUrl(NETWORK_API_ROOT, { page_size: 100 });
      const res = await apiRequest({ method: "GET", url });
      const data = res.data;
      const items = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
      setNetworks(items);
      const cache = {};
      for (const n of items) cache[n.id ?? n.pk] = n;
      setNetworkCache((prev) => ({ ...prev, ...cache }));
    } catch (e) {
      console.warn("Failed to fetch networks", e);
    } finally {
      setNetworksLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchNetworks(); }, [fetchNetworks]);

  const loadPlan = useCallback(async (planId) => {
    if (!planId) return;
    if (planCache[planId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${PLANS_API}?id=${planId}` });
      const planObj = res.data;
      setPlanCache((p) => ({ ...p, [planId]: planObj }));
    } catch (e) { console.warn("Failed to load plan", planId, e?.message || e); }
  }, [planCache]);

  const loadNetwork = useCallback(async (networkId) => {
    if (!networkId) return;
    if (networkCache[networkId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${networkId}/` });
      setNetworkCache((n) => ({ ...n, [networkId]: res.data }));
    } catch (e) { console.warn("Failed to load network", networkId, e?.message || e); }
  }, [networkCache]);

  /* ---------------- CRUD actions (unchanged) ---------------- */
  const getServiceDetailUrl = (id) => {
    const base = `${API_BASE}${apiUrl.startsWith("/") ? apiUrl : "/" + apiUrl}`;
    return base.endsWith("/") ? `${base}${id}/` : `${base}${id}/`;
  };

  const handleOpen = (svc) => {
    if (svc.id || svc.pk) {
      const id = svc.id ?? svc.pk;
      navigate(`/service/${id}`);
    } else if (typeof onOpen === "function") {
      onOpen(svc);
    }
  };

  const updateService = async (serviceId, payload) => {
    setActionLoading(true);
    try {
      const url = getServiceDetailUrl(serviceId);
      await apiRequest({ method: "PATCH", url, data: payload });

      if (payload.plan) {
        try {
          const planRes = await apiRequest({ method: "GET", url: `${PLANS_API}?id=${payload.plan}` });
          const planObj = planRes.data;
          setPlanCache((p) => ({ ...p, [planObj.id ?? planObj.pk]: planObj }));

          setServices((prev) =>
            prev.map((s) => {
              const id = s.id ?? s.pk;
              if (String(id) === String(serviceId)) {
                return { ...s, plan: planObj, network: payload.network === undefined ? s.network : payload.network === null ? null : s.network };
              }
              return s;
            })
          );
        } catch (e2) {
          console.warn("Updated plan but failed to fetch plan details", e2);
          setServices((prev) =>
            prev.map((s) => {
              const id = s.id ?? s.pk;
              if (String(id) === String(serviceId)) {
                return { ...s, plan: payload.plan };
              }
              return s;
            })
          );
        }
      } else {
        setServices((prev) =>
          prev.map((s) => {
            const id = s.id ?? s.pk;
            if (String(id) === String(serviceId)) {
              return { ...s, ...payload };
            }
            return s;
          })
        );
      }

      if (payload.network === null) {
        setServices((prev) =>
          prev.map((s) => {
            const id = s.id ?? s.pk;
            if (String(id) === String(serviceId)) {
              return { ...s, network: null };
            }
            return s;
          })
        );
      }

      setAlert({ type: "success", message: "Saved." });
      setTimeout(() => setAlert(null), 2500);
      return true;
    } catch (e) {
      console.error("Failed to update service", e);
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to update service.";
      setError(msg);
      setAlert({ type: "error", message: msg });
      setTimeout(() => setAlert(null), 3000);
      return false;
    } finally { setActionLoading(false); }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm("Are you sure you want to delete this service? This cannot be undone.")) return false;
    setActionLoading(true);
    try {
      const url = getServiceDetailUrl(serviceId);
      await apiRequest({ method: "DELETE", url });
      setServices((prev) => prev.filter((s) => String(s.id ?? s.pk) !== String(serviceId)));
      setAlert({ type: "success", message: "Service deleted." });
      setTimeout(() => setAlert(null), 2500);
      return true;
    } catch (e) {
      console.error("Failed to delete service", e);
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to delete service.";
      setError(msg);
      setAlert({ type: "error", message: msg });
      setTimeout(() => setAlert(null), 3000);
      return false;
    } finally { setActionLoading(false); }
  };

  /* ---------------- plans for platform (cached) ---------------- */
  const fetchPlansForPlatform = async (platform) => {
    if (!platform) return [];
    if (plansForPlatform[platform]) return plansForPlatform[platform];
    try {
      const res = await apiRequest({ method: "POST", url: PLATFORMS_API, data: { platform } });
      const plans = res.data || [];
      // ensure cached
      setPlansForPlatform((p) => ({ ...p, [platform]: plans }));
      return plans;
    } catch (e) {
      console.error("Failed to fetch plans for platform", e);
      setAlert({ type: "error", message: "Fail to load plans." });
      setTimeout(() => setAlert(null), 2500);
      return [];
    }
  };

  /* ---------------- create / delete network ---------------- */
  const createNetworkInline = async ({ name }) => {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      setAlert({ type: "error", message: "Network name is required." });
      setTimeout(() => setAlert(null), 2000);
      return null;
    }
    try {
      const url = NETWORK_API_ROOT;
      const res = await apiRequest({ method: "POST", url, data: { name: trimmed } });
      const obj = res.data;
      await fetchNetworks();
      setAlert({ type: "success", message: "Network created." });
      setTimeout(() => setAlert(null), 2000);
      return obj;
    } catch (e) {
      console.error("Failed to create network", e);
      setAlert({ type: "error", message: "Failed to create network." });
      setTimeout(() => setAlert(null), 3000);
      return null;
    }
  };

  const deleteNetwork = async (networkId) => {
    if (!window.confirm("Delete this network? This will fail if there are active services using it.")) return false;
    try {
      const url = `${NETWORK_API_ROOT}${networkId}/`;
      await apiRequest({ method: "DELETE", url });
      await fetchNetworks();
      setServices((prev) =>
        prev.map((s) => {
          const nid = s.network && (s.network.id ?? s.network.pk);
          if (String(nid) === String(networkId)) return { ...s, network: null };
          return s;
        })
      );
      setAlert({ type: "success", message: "Network deleted." });
      setTimeout(() => setAlert(null), 2500);
      return true;
    } catch (e) {
      console.error("Failed to delete network", e);
      setAlert({ type: "error", message: "Failed to delete network." });
      setTimeout(() => setAlert(null), 3000);
      return false;
    }
  };

  /* ---------------- render ---------------- */
  return (
    <div className="services-list container py-4">
      <h2 className="mb-3">My Services</h2>

      {showSearch && (
        <form onSubmit={(e) => { e.preventDefault(); setPage(1); }} className="mb-3">
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search service name..."
              style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1px solid #ccc" }}
            />
            <button className="btn btn-sm btn-primary" type="submit">Search</button>
          </div>
        </form>
      )}

      {alert && <div className={`alert ${alert.type === "error" ? "alert-danger" : "alert-success"}`}>{alert.message}</div>}
      {loading && <p>Loading services...</p>}
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-4">
        {services.map((s) => {
          const key = getKey(s);
          const planIsObj = s.plan && typeof s.plan === "object";
          const netIsObj = s.network && typeof s.network === "object";
          const planId = !planIsObj && s.plan ? s.plan : null;
          const networkId = !netIsObj && s.network ? s.network : null;

          if (planId && !planCache[planId]) loadPlan(planId);
          if (networkId && !networkCache[networkId]) loadNetwork(networkId);

          const planPlatform =
            (planIsObj && (s.plan.platform ?? s.plan.name ?? "—")) ||
            (planId && (planCache[planId]?.platform ?? planCache[planId]?.name)) ||
            "—";

          const networkName = (netIsObj && (s.network.name ?? "—")) || (networkId && networkCache[networkId]?.name) || "—";

          const cpu = (planIsObj && s.plan.max_cpu) || (planId && planCache[planId]?.max_cpu) || null;
          const ram = (planIsObj && s.plan.max_ram) || (planId && planCache[planId]?.max_ram) || null;
          const storage = (planIsObj && s.plan.max_storage) || (planId && planCache[planId]?.max_storage) || null;
          const price = (planIsObj && s.plan.price_per_hour) || (planId && planCache[planId]?.price_per_hour) || null;

          return (
            <div key={key} data-uid={key} className="col-12 col-md-6 col-lg-4">
              <motion.div className="plan-card p-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02 }} transition={{ duration: 0.18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div className="plan-title">{s.name ?? "(no name)"}</div>
                    <div className="plan-desc">{networkName}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className={`status-pill ${s.status === "running" ? "status-running" : s.status === "stopped" ? "status-stopped" : "status-unknown"}`}>{s.status ?? "unknown"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{planPlatform}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {cpu !== null && <div>CPU: <strong>{cpu}</strong> cores</div>}
                  {ram !== null && <div>RAM: <strong>{ram}</strong> MB</div>}
                  {storage !== null && <div>Storage: <strong>{storage}</strong> GB</div>}
                  {price !== null && <div className="plan-price">Price/hr: <strong>{price}</strong> toman</div>}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); setEditingService({ service: s, network: (s.network && (s.network.id ?? s.network.pk)) || (s.network ? s.network : null), planId: (s.plan && (s.plan.id ?? s.plan.pk)) || (s.plan ? s.plan : null) }); }}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger" onClick={(e) => { e.stopPropagation(); deleteService(s.id ?? s.pk); }}>Delete</button>
                  <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); handleOpen(s); }}>Open</button>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center">
        {hasNext && <button type="button" className="btn btn-primary" onClick={() => setPage((p) => p + 1)} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load more"}</button>}
      </div>

      {/* ---------------- MODAL (centered + resize-safe) ---------------- */}
      <Modal open={Boolean(editingService)} onClose={() => setEditingService(null)} title={editingService?.service?.name ?? "Edit service"}>
        {editingService && (
          <EditorInside
            editingService={editingService}
            setEditingService={setEditingService}
            networks={networks}
            networksLoading={networksLoading}
            createNetworkInline={createNetworkInline}
            deleteNetwork={deleteNetwork}
            fetchPlansForPlatform={fetchPlansForPlatform}
            updateService={updateService}
            actionLoading={actionLoading}
          />
        )}
      </Modal>
    </div>
  );
}

/* ---------------- EditorInside: modal content (extract for clarity) ---------------- */
function EditorInside({
  editingService,
  setEditingService,
  networks,
  networksLoading,
  createNetworkInline,
  deleteNetwork,
  fetchPlansForPlatform,
  updateService,
  actionLoading,
}) {
  const svc = editingService.service;

  // derived platform (service-level)
  const platform = getServicePlatform(svc);

  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!platform) {
        setAvailablePlans([]);
        return;
      }
      setPlansLoading(true);
      const p = await fetchPlansForPlatform(platform);
      // defensive filter: ensure plan.platform exactly equals platform (if available)
      const filtered = (p || []).filter((pl) => {
        if (!pl) return false;
        if (pl.platform !== undefined && pl.platform !== null) return String(pl.platform) === String(platform);
        // if API didn't include platform property, assume they are already correct
        return true;
      });
      setAvailablePlans(filtered);
      setPlansLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  // plan selection handler: clicking card sets planId in editingService.state
  const onPickPlan = (planId) => {
    setEditingService((es) => ({ ...es, planId }));
  };

  return (
    <div className="overlay-inner-grid">
      <div className="overlay-left">
        <label className="form-label">Network</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <select
              className="form-control custom-select"
              value={editingService.network ?? ""}
              onChange={(e) => setEditingService((es) => ({ ...es, network: e.target.value || null }))}
            >
              <option value="">(no network)</option>
              {networks.map((n) => <option key={n.id ?? n.pk} value={n.id ?? n.pk}>{n.name}</option>)}
            </select>
          </div>

          <button className="btn btn-sm btn-outline-secondary" type="button" onClick={() => setEditingService((es) => ({ ...es, creatingNetwork: { name: "" } }))}>+ create</button>
          <button className="btn btn-sm btn-outline-danger" type="button" onClick={async () => {
            const nid = editingService.network;
            if (!nid) { setAlertLocal("No network selected to delete."); return; }
            await deleteNetwork(nid);
            setEditingService((es) => ({ ...es, network: null }));
          }}>delete</button>
        </div>

        {editingService.creatingNetwork && (
          <div className="create-network-box">
            <label className="form-label">Network name</label>
            <input className="form-control" autoFocus value={editingService.creatingNetwork.name} onChange={(e) => setEditingService((es) => ({ ...es, creatingNetwork: { ...es.creatingNetwork, name: e.target.value } }))} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setEditingService((es) => { const copy = { ...es }; delete copy.creatingNetwork; return copy; })}>Cancel</button>
              <button className="btn btn-sm btn-primary" onClick={async () => {
                const name = editingService.creatingNetwork.name;
                const created = await createNetworkInline({ name });
                if (created) {
                  const nid = created.id ?? created.pk;
                  setEditingService((es) => ({ ...es, network: nid, creatingNetwork: undefined }));
                }
              }}>Create</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <label className="form-label">Plans for platform {platform ? `— ${platform}` : ""}</label>
          {plansLoading ? <div>Loading plans...</div> : (
            <div className="plans-grid">
              {availablePlans.length === 0 && <div className="muted">No plans available for this platform.</div>}
              {availablePlans.map((p) => {
                const pid = p.id ?? p.pk;
                const isSelected = String(editingService.planId ?? "") === String(pid);
                return (
                  <div key={pid} className={`plan-card-small ${isSelected ? "selected" : ""}`} onClick={() => onPickPlan(pid)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPickPlan(pid); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                      <div>
                        <div className="plan-title">{p.name}</div>
                        <div className="plan-desc">{p.plan_type || ""} • {p.storage_type || ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="plan-price">{p.price_per_hour} / hr</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 8 }} className="plan-meta">
                      <div className="plan-desc">{p.max_cpu} CPU · {p.max_ram} MB · {p.max_storage} GB</div>
                      {/* selection marker */}
                      <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                        {isSelected ? <div className="pill-selected">Selected</div> : <div className="muted">Click to select</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button className="btn btn-secondary" onClick={() => setEditingService(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => {
            const payload = {};
            if ((editingService.network ?? null) !== ((svc.network && (svc.network.id ?? svc.network.pk)) ?? svc.network)) payload.network = editingService.network || null;
            if (editingService.planId && String(editingService.planId) !== String((svc.plan && (svc.plan.id ?? svc.plan.pk)) || svc.plan)) payload.plan = editingService.planId;
            if (Object.keys(payload).length === 0) return setEditingService(null);
            const ok = await updateService(svc.id ?? svc.pk, payload);
            if (ok) setEditingService(null);
          }}>{actionLoading ? "Saving..." : "Save"}</button>
        </div>
      </div>

      <aside className="overlay-right">
        <div className="card small">
          <div style={{ fontWeight: 700 }}>Service overview</div>
          <div style={{ marginTop: 8 }}><strong>Status:</strong> {svc.status}</div>
          <div style={{ marginTop: 8 }}><strong>Network:</strong> {svc.network ? (svc.network.name ?? svc.network) : "(none)"}</div>
          <div style={{ marginTop: 8 }}><strong>Plan:</strong> {svc.plan ? (svc.plan.name ?? svc.plan) : "(none)"}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700 }}>Available networks</div>
          {networksLoading ? <div>Loading networks...</div> : (
            networks.length === 0 ? <div>No networks. Create one.</div> : (
              <div style={{ marginTop: 8 }}>
                {networks.map((n) => <div key={n.id ?? n.pk} style={{ padding: "6px 0" }}>{n.name}</div>)}
              </div>
            )
          )}
        </div>
      </aside>
    </div>
  );
}

/* ---------------- small helper: local alert (keeps inside modal) ---------------- */
function setAlertLocal(msg) {
  // simple fallback: browser alert (we avoid messing global state here)
  alert(msg);
}
