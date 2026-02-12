// src/components/PlatformPlans.jsx
import React, { useEffect, useRef, useState, Suspense } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import "./plans.css";

const PLATFORMS_API = "http://127.0.0.1:8000/plans/platforms/";
const PLANS_API = "http://127.0.0.1:8000/plans/";

// lazy import the separate modal module
const CreateDeploymentModal = React.lazy(() => import("./CreateDeploymentModal"));

export default function PlatformPlans() {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [platformErrors, setPlatformErrors] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  const fetchIdRef = useRef(0);
  const lastKeyRef = useRef(null);

  const getKey = (p) => {
    if (!p) return "null";
    if (p.id !== undefined && p.id !== null) return String(p.id);
    const name = typeof p.name === "string" ? p.name : JSON.stringify(p.name ?? "");
    const platform = p.platform ?? "";
    const cpu = p.max_cpu ?? "";
    const ram = p.max_ram ?? "";
    const price = p.price_per_hour ?? "";
    return `${platform}|${name}|${cpu}|${ram}|${price}`;
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

  useEffect(() => {
    const fetchPlatforms = async () => {
      setLoadingPlatforms(true);
      setError(null);
      try {
        const res = await axios.get(PLATFORMS_API);
        setPlatforms(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError("Failed to load platforms.");
      } finally {
        setLoadingPlatforms(false);
      }
    };
    fetchPlatforms();
  }, []);

  useEffect(() => {
    const fetchPlans = async () => {
      const thisFetchId = ++fetchIdRef.current;
      setLoadingPlans(true);
      setError(null);
      setPlatformErrors([]);

      const isFiltered = selectedPlatforms.length > 0;

      try {
        if (!isFiltered) {
          if (page > 1 && plans.length > 0) {
            lastKeyRef.current = getKey(plans[plans.length - 1]);
          } else {
            lastKeyRef.current = null;
          }

          const res = await axios.get(`${PLANS_API}?page=${page}`);
          if (fetchIdRef.current !== thisFetchId) return; // stale
          const results = Array.isArray(res.data.results)
            ? res.data.results
            : Array.isArray(res.data)
            ? res.data
            : [];

          setPlans((prev) => {
            if (page === 1) {
              return uniqueBy(results, getKey);
            } else {
              const existingKeys = new Set(prev.map((p) => getKey(p)));
              const newItems = results.filter((r) => !existingKeys.has(getKey(r)));
              if (newItems.length === 0) return prev;
              return [...prev, ...newItems];
            }
          });

          setHasNext(Boolean(res.data.next));

          if (page > 1 && lastKeyRef.current) {
            setTimeout(() => {
              const key = lastKeyRef.current;
              lastKeyRef.current = null;
              if (!key) return;
              const el = document.querySelector(`[data-uid="${key}"]`);
              if (el && typeof el.scrollIntoView === "function") {
                el.scrollIntoView({ block: "end", behavior: "smooth" });
              }
            }, 80);
          }
        } else {
          const promises = selectedPlatforms.map((platformKey) =>
            axios.post(PLATFORMS_API, { platform: platformKey })
          );

          const settled = await Promise.allSettled(promises);
          if (fetchIdRef.current !== thisFetchId) return; // stale

          const merged = [];
          const errors = [];

          settled.forEach((r, idx) => {
            const platformKey = selectedPlatforms[idx];
            if (r.status === "fulfilled") {
              const data = r.value.data;
              if (Array.isArray(data)) merged.push(...data);
              else if (Array.isArray(data?.results)) merged.push(...data.results);
              else if (data) merged.push(data);
            } else {
              const status = r.reason?.response?.status || null;
              errors.push({ platform: platformKey, status, message: r.reason?.message });
            }
          });

          const unique = uniqueBy(merged, getKey);
          setPlans(unique);
          setHasNext(false);
          setPlatformErrors(errors);
          if (errors.length === selectedPlatforms.length && unique.length === 0) {
            setError("No plans found for selected platforms.");
          }
        }
      } catch (e) {
        setPlans([]);
        setError(e.response?.data?.error || "Failed to load plans.");
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatforms, page]);

  const togglePlatform = (code) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      setPage(1);
      setPlatformErrors([]);
      setError(null);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPlatforms((prev) => {
      const all = platforms.map((p) => p[0]);
      const next = prev.length === platforms.length ? [] : all;
      setPage(1);
      setPlatformErrors([]);
      setError(null);
      return next;
    });
  };

  const openCreate = (plan) => {
    setModalInitial(plan ? { name: plan.platform, type: plan.name, id: plan.id } : {});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalInitial(null);
  };

  const handleCreated = (result) => {
    console.log("Deployment creation result:", result);
    if (result?.ok) {
      closeModal();
    } else {
      console.warn("Service creation failed:", result?.error);
    }
  };

  return (
    <div className="pp-container">
      <h2 className="pp-heading">Select Platforms</h2>

      {loadingPlatforms && <p className="pp-muted">Loading platforms...</p>}

      {!loadingPlatforms && platforms.length > 0 && (
        <>
          <div className="pp-actions-row">
            <button type="button" onClick={toggleSelectAll} className="btn btn-sm btn-secondary">
              {selectedPlatforms.length === platforms.length ? "Deselect All" : "Select All"}
            </button>
            <div className="pp-spacer" />
          </div>

          <div className="pp-chips">
            {platforms.map(([key, display]) => {
              const isSelected = selectedPlatforms.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  className={`platform-chip ${isSelected ? "selected" : ""}`}
                  aria-pressed={isSelected}
                >
                  {display}
                </button>
              );
            })}
          </div>
        </>
      )}

      <hr className="pp-sep" />

      {error && <div className="pp-alert">{error}</div>}

      <h3 className="pp-subheading">Plans {selectedPlatforms.length > 0 ? "(filtered)" : "(all)"}</h3>

      {loadingPlans && <p className="pp-muted">Loading plans...</p>}
      {!loadingPlans && !error && plans.length === 0 && <p className="pp-muted">No plans found.</p>}

      {!loadingPlans && plans.length > 0 && (
        <div className="plans-grid">
          {plans.map((plan, idx) => {
            const key = getKey(plan);
            const isFeatured = plan.featured || false;
            return (
              <motion.article
                key={key}
                data-uid={key}
                className={`plan-card ${isFeatured ? "featured" : ""}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.4), duration: 0.28 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => openCreate(plan)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openCreate(plan); }}
                aria-label={`Create deployment for ${plan.name} on ${plan.platform}`}
              >
                <div className="plan-card-top">
                  <div>
                    <h4 className="plan-title">{plan.name}</h4>
                    <div className="plan-desc small">{plan.plan_type ? `${plan.plan_type} • ${plan.storage_type || ""}` : plan.platform}</div>
                  </div>
                  <div className="plan-badge">
                    <div className="plan-price">{plan.price_per_hour} <span className="plan-price-sub">/ hr</span></div>
                  </div>
                </div>

                <div className="plan-body">
                  <div className="plan-spec"><strong>{plan.max_cpu}</strong> CPU</div>
                  <div className="plan-spec"><strong>{plan.max_ram}</strong> MB RAM</div>
                  <div className="plan-spec"><strong>{plan.max_storage}</strong> GB</div>
                </div>

                <div className="plan-footer">
                  <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); openCreate(plan); }}>
                    Create
                  </button>
                  <div className="plan-meta small">{plan.description ?? ""}</div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      {hasNext && selectedPlatforms.length === 0 && (
        <div className="pp-loadmore">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loadingPlans}
          >
            {loadingPlans ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {/* Modal overlay */}
      {modalOpen && (
        <div className="modal-backdrop-pp" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="modal-card-pp" onClick={(e) => e.stopPropagation()}>
            <Suspense fallback={<div className="pp-muted">Loading deployment form...</div>}>
              <CreateDeploymentModal initialData={modalInitial} onCancel={closeModal} onCreate={handleCreated} />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
