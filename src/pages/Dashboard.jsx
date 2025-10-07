// src/components/ServicesList.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import apiRequest from "../components/customHooks/apiRequest"; // <--- use this

const API_BASE = "http://127.0.0.1:8000";
const PLANS_API = `${API_BASE}/plans/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;

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

  const fetchIdRef = useRef(0);
  const lastKeyRef = useRef(null);

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

  // NOTE: use q_search instead of q to match your Django `list` implementation
  const buildUrl = useCallback((basePath, extra = {}) => {
    try {
      const isAbsolute = String(basePath).startsWith("http://") || String(basePath).startsWith("https://");
      const base = isAbsolute ? basePath : `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
      const url = new URL(base);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));
      if (query) url.searchParams.set("q_search", query); // <-- q_search here
      Object.entries(extra).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
      });
      return url.href;
    } catch {
      const base = `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
      const sep = base.includes("?") ? "&" : "?";
      let qs = `page=${page}&page_size=${pageSize}`;
      if (query) qs += `&q_search=${encodeURIComponent(query)}`; // <-- fallback q_search
      Object.entries(extra).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      });
      return base + sep + qs;
    }
  }, [page, pageSize, query]);

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
        if (page > 1 && lastKeyRef.current) {
          setTimeout(() => {
            const key = lastKeyRef.current;
            lastKeyRef.current = null;
            if (!key) return;
            const el = document.querySelector(`[data-uid="${key}"]`);
            if (el && typeof el.scrollIntoView === "function") {
              el.scrollIntoView({ block: "end", behavior: "auto" });
            }
          }, 50);
        }
      } catch (e) {
        setError(e?.response?.data ? JSON.stringify(e.response.data) : (e?.message || "Failed to load services."));
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

  // cache loaders using apiRequest
  const loadPlan = useCallback(async (planId) => {
    if (!planId) return;
    if (planCache[planId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${PLANS_API}${planId}/` });
      setPlanCache((p) => ({ ...p, [planId]: res.data }));
    } catch (e) {
      console.warn("Failed to load plan", planId, e?.message || e);
    }
  }, [planCache]);

  const loadNetwork = useCallback(async (networkId) => {
    if (!networkId) return;
    if (networkCache[networkId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${networkId}/` });
      setNetworkCache((n) => ({ ...n, [networkId]: res.data }));
    } catch (e) {
      console.warn("Failed to load network", networkId, e?.message || e);
    }
  }, [networkCache]);

  const handleOpen = (svc) => {
    if (typeof onOpen === "function") {
      onOpen(svc);
    } else {
      console.log("Open pressed for service:", svc);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    // fetch will re-run because `query` changed on input
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">My Services</h2>

      {showSearch && (
        <form onSubmit={handleSearchSubmit} className="mb-3">
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

      {loading && <p>Loading services...</p>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && services.length === 0 && <p>No services found.</p>}

      <div className="row g-4">
        {services.map((s) => {
          const key = getKey(s);
          const planIsObj = s.plan && typeof s.plan === "object";
          const netIsObj = s.network && typeof s.network === "object";
          const planId = !planIsObj && s.plan ? s.plan : null;
          const networkId = !netIsObj && s.network ? s.network : null;

          // trigger cache loads (loader checks cache)
          if (planId && !planCache[planId]) loadPlan(planId);
          if (networkId && !networkCache[networkId]) loadNetwork(networkId);

          const planPlatform =
            (planIsObj && (s.plan.platform ?? s.plan.name ?? "—")) ||
            (planId && (planCache[planId]?.platform ?? planCache[planId]?.name)) ||
            "—";

          const networkName =
            (netIsObj && (s.network.name ?? "—")) ||
            (networkId && networkCache[networkId]?.name) ||
            "—";

          const cpu = (planIsObj && s.plan.max_cpu) || (planId && planCache[planId]?.max_cpu) || null;
          const ram = (planIsObj && s.plan.max_ram) || (planId && planCache[planId]?.max_ram) || null;
          const storage = (planIsObj && s.plan.max_storage) || (planId && planCache[planId]?.max_storage) || null;
          const price = (planIsObj && s.plan.price_per_hour) || (planId && planCache[planId]?.price_per_hour) || null;

          return (
            <div key={key} data-uid={key} className="col-12 col-md-6 col-lg-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.15 }}
                className="plan-card p-3 border rounded shadow-sm"
                style={{ background: "white" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <h5 style={{ margin: 0 }}>{s.name ?? "(no name)"}</h5>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{networkName}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      fontSize: 12,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: s.status === "running" ? "#ecfdf5" : s.status === "stopped" ? "#fff1f2" : "#f3f4f6",
                      color: s.status === "running" ? "#065f46" : s.status === "stopped" ? "#9f1239" : "#374151"
                    }}>
                      {s.status ?? "unknown"}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{planPlatform}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontSize: 14, color: "#374151" }}>
                  {cpu !== null && <div>CPU: {cpu} cores</div>}
                  {ram !== null && <div>RAM: {ram} MB</div>}
                  {storage !== null && <div>Storage: {storage} GB</div>}
                  {price !== null && <div>Price/hr: {price} toman</div>}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={(e) => { e.stopPropagation(); handleOpen(s); }}
                  >
                    Open
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center">
        {hasNext && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPage((p) => p + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
