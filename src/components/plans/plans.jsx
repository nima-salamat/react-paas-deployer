import React, { useEffect, useRef, useState, Suspense } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import "./plans.css";

const PLATFORMS_API = "http://127.0.0.1:8000/plans/platforms/";
const PLANS_API = "http://127.0.0.1:8000/plans/";
const CreateDeploymentModal = React.lazy(() => import("./CreateDeploymentModal"));

export default function PlatformPlans() {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

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

  const fetchPlatforms = async () => {
    setLoadingPlatforms(true);
    setFetchError(null);
    try {
      const res = await axios.get(PLATFORMS_API);
      setPlatforms(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setPlatforms([]);
      setFetchError("Failed to load platforms or plans.");
    } finally {
      setLoadingPlatforms(false);
    }
  };

  const fetchPlans = async () => {
    const thisFetchId = ++fetchIdRef.current;
    setLoadingPlans(true);
    setFetchError(null);

    const isFiltered = selectedPlatforms.length > 0;

    try {
      if (!isFiltered) {
        const res = await axios.get(`${PLANS_API}?page=${page}`);
        if (fetchIdRef.current !== thisFetchId) return;
        const results = Array.isArray(res.data.results)
          ? res.data.results
          : Array.isArray(res.data)
          ? res.data
          : [];
        setPlans((prev) => page === 1 ? uniqueBy(results, getKey) : [...prev, ...results]);
        setHasNext(Boolean(res.data.next));
      } else {
        const promises = selectedPlatforms.map((platformKey) =>
          axios.post(PLATFORMS_API, { platform: platformKey })
        );
        const settled = await Promise.allSettled(promises);
        if (fetchIdRef.current !== thisFetchId) return;

        const merged = [];
        settled.forEach((r) => {
          if (r.status === "fulfilled") {
            const data = r.value.data;
            if (Array.isArray(data)) merged.push(...data);
            else if (Array.isArray(data?.results)) merged.push(...data.results);
            else if (data) merged.push(data);
          }
        });
        setPlans(uniqueBy(merged, getKey));
        setHasNext(false);
      }
    } catch (e) {
      setPlans([]);
      setFetchError("Failed to load platforms or plans.");
    } finally {
      setLoadingPlans(false);
    }
  };

  useEffect(() => {
    fetchPlatforms();
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [selectedPlatforms, page]);

  const togglePlatform = (code) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      setPage(1);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPlatforms((prev) => {
      const all = platforms.map((p) => p[0]);
      const next = prev.length === platforms.length ? [] : all;
      setPage(1);
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
    if (result?.ok) closeModal();
  };

  const retryAll = () => {
    fetchPlatforms();
    fetchPlans();
  };

  return (
    <div className="pp-container">
      <h2 className="pp-heading">Select Platforms</h2>

      {(fetchError || (!platforms.length && !loadingPlatforms)) && (
        <div className="pp-alert">
          <div>{fetchError}</div>
          <button
            type="button"
            onClick={retryAll}
            className="btn btn-lg btn-primary w-100"
            style={{ marginTop: 12 }}
          >
            Retry
          </button>
        </div>
      )}

      {!fetchError && platforms.length > 0 && (
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

      <h3 className="pp-subheading">Plans {selectedPlatforms.length > 0 ? "(filtered)" : "(all)"}</h3>

      {loadingPlans && <p className="pp-muted">Loading plans...</p>}
      {!loadingPlans && !fetchError && plans.length === 0 && <p className="pp-muted">No plans found.</p>}

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
