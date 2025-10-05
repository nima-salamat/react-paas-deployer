// components/PlatformPlans.jsx
import React, { useEffect, useRef, useState, Suspense } from "react";
import axios from "axios";

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
    const key = `${platform}|${name}|${cpu}|${ram}|${price}`;
    return key || JSON.stringify(p);
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
          console.log(res.data)
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
                el.scrollIntoView({ block: "end", behavior: "auto" });
              }
            }, 50);
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
    setModalInitial(plan ? { name: plan.platform, type: plan.name , id: plan.id} : {});
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
    <div className="container py-4">
      <h2 className="mb-3">Select Platforms</h2>

      {loadingPlatforms && <p>Loading platforms...</p>}

      {!loadingPlatforms && platforms.length > 0 && (
        <>
          <button type="button" onClick={toggleSelectAll} className="btn btn-sm mb-2">
            {selectedPlatforms.length === platforms.length ? "Deselect All" : "Select All"}
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {platforms.map(([key, display]) => {
              const isSelected = selectedPlatforms.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  style={{
                    padding: "8px 15px",
                    borderRadius: "20px",
                    border: isSelected ? "2px solid #0d6efd" : "1px solid #ccc",
                    backgroundColor: isSelected ? "#0d6efd" : "white",
                    color: isSelected ? "white" : "black",
                    fontWeight: isSelected ? "600" : "400",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                  }}
                >
                  {display}
                </button>
              );
            })}
          </div>
        </>
      )}

      <hr />

      {error && <div className="alert alert-danger">{error}</div>}

      <h3>Plans {selectedPlatforms.length > 0 ? "(filtered)" : "(all)"}</h3>

      {loadingPlans && <p>Loading plans...</p>}
      {!loadingPlans && !error && plans.length === 0 && <p>No plans found.</p>}

      {!loadingPlans && plans.length > 0 && (
        <div className="row g-4">
          {plans.map((plan) => (
            <div key={getKey(plan)} data-uid={getKey(plan)} className="col-12 col-md-6 col-lg-4">
              <div className="plan-card p-3 border rounded shadow-sm">
                <h5>{plan.name}</h5>
                <p>Platform: {plan.platform}</p>
                <p>CPU: {plan.max_cpu} cores</p>
                <p>RAM: {plan.max_ram} MB</p>
                <p>
                  Storage: {plan.max_storage} GB ({plan.storage_type})
                </p>
                <p>Price per hour: {plan.price_per_hour} Toman</p>

                <div className="d-flex justify-content-end mt-2">
                  <button className="btn btn-sm btn-primary" onClick={() => openCreate(plan)}>
                    Create
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNext && selectedPlatforms.length === 0 && (
        <div className="mt-3 text-center">
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

      {/* Modal overlay + dialog centered relative to viewport (fixed & translate centering).
          Overlay won't close modal on click; modal always stays centered in user's viewport. */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 9999,
            // don't use flex centering here; use fixed + translate on inner dialog for pixel-perfect center
          }}
        >
          <div
            // dialog positioned exactly at the center of the viewport
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "white",
              borderRadius: 8,
              padding: 20,
              width: "min(95%, 720px)",
              boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
              maxHeight: "calc(100vh - 80px)",
              overflowY: "auto",
            }}
          >
            <Suspense fallback={<div>Loading deployment form...</div>}>
              <CreateDeploymentModal
                initialData={modalInitial}
                onCancel={closeModal}
                onCreate={handleCreated}
              />
            </Suspense>
          </div>
        </div>
      )}
    </div>
  );
}
