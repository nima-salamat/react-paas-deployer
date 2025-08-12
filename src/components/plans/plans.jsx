import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const PLATFORMS_API = "http://127.0.0.1:8000/plans/platforms/";
const PLANS_API = "http://127.0.0.1:8000/plans/";

export default function PlatformPlans() {
  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [platformErrors, setPlatformErrors] = useState([]); // [{platform: 'django', status: 404}, ...]
  const fetchIdRef = useRef(0);

  const uniqueBy = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter((item) => {
      const k = keyFn(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  useEffect(() => {
    const fetchPlatforms = async () => {
      setLoadingPlatforms(true);
      setError(null);
      try {
        const res = await axios.get(PLATFORMS_API);
        setPlatforms(res.data);
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

      try {
        if (selectedPlatforms.length === 0) {
          const res = await axios.get(`${PLANS_API}?page=${page}`);
          if (fetchIdRef.current !== thisFetchId) return; // stale
          const results = Array.isArray(res.data.results) ? res.data.results : [];
          setPlans((prev) => (page === 1 ? results : [...prev, ...results]));
          setHasNext(Boolean(res.data.next));
        } else {
          const promises = selectedPlatforms.map((platformKey) =>
            axios.post(PLATFORMS_API, { platform: platformKey })
          );

          const settled = await Promise.allSettled(promises);

          if (fetchIdRef.current !== thisFetchId) return; // stale

          const merged = [];
          const errors = [];

          settled.forEach((res, idx) => {
            const platformKey = selectedPlatforms[idx];
            if (res.status === "fulfilled") {
              const data = res.value.data;
              if (Array.isArray(data)) merged.push(...data);
              else if (Array.isArray(data?.results)) merged.push(...data.results);
              else if (data) merged.push(data);
            } else {
              const status = res.reason?.response?.status || null;
              errors.push({ platform: platformKey, status, message: res.reason?.message });
            }
          });

          const unique = uniqueBy(merged, (p) => `${p.platform || p.platform}_${p.name || JSON.stringify(p)}`);

          setPlans((prev) => (page === 1 ? unique : [...prev, ...unique]));
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
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      return [...prev, code];
    });
    setPage(1);
    setPlatformErrors([]);
    setError(null);
  };

  const toggleSelectAll = () => {
    if (selectedPlatforms.length === platforms.length) {
      setSelectedPlatforms([]);
    } else {
      setSelectedPlatforms(platforms.map((p) => p[0]));
    }
    setPage(1);
    setPlatformErrors([]);
    setError(null);
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Select Platforms</h2>

      {loadingPlatforms && <p>Loading platforms...</p>}

      {!loadingPlatforms && platforms.length > 0 && (
        <>
          <button onClick={toggleSelectAll} className="btn btn-sm mb-2">
            {selectedPlatforms.length === platforms.length ? "Deselect All" : "Select All"}
          </button>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {platforms.map(([key, display]) => {
              const isSelected = selectedPlatforms.includes(key);
              return (
                <button
                  key={key}
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
          {plans.map((plan, idx) => (
            <div key={idx} className="col-12 col-md-6 col-lg-4">
              <div className="plan-card p-3 border rounded shadow-sm">
                <h5>{plan.name}</h5>
                <p>Platform: {plan.platform}</p>
                <p>CPU: {plan.max_cpu} cores</p>
                <p>RAM: {plan.max_ram} MB</p>
                <p>
                  Storage: {plan.max_storage} GB ({plan.storage_type})
                </p>
                <p>Price per hour: {plan.price_per_hour} Toman</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasNext && selectedPlatforms.length === 0 && (
        <div className="mt-3 text-center">
          <button
            className="btn btn-primary"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={loadingPlans}
          >
            {loadingPlans ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
