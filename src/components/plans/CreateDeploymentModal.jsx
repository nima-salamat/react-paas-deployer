// CreateServiceWizard.jsx
import React, { useEffect, useRef, useState } from "react";
import apiRequest from "../customHooks/apiRequest";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      const error = this.state.error;
      let message = "Unexpected error.";
      if (error) {
        if (error.response?.data?.error) {
          const parsed = parseErrors(error.response.data.error);
          message = parsed.join("\n");
        } else if (error.message) {
          message = error.message;
        } else {
          message = JSON.stringify(error);
        }
      }

      return (
        <div className="p-4 text-center">
          <h5 className="text-danger mb-2">⚠ An unexpected error occurred</h5>
          <pre className="mb-3 small text-muted text-start d-inline-block text-break">
            {String(message)}
          </pre>
          <div className="d-flex justify-content-center gap-2">
            <button
              className="btn btn-warning"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => this.props.onClose?.()}
            >
              Close
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function parseErrors(errData) {
  const messages = [];

  function recurse(obj, prefix = "") {
    if (!obj) return;

    if (typeof obj === "string") {
      messages.push(prefix + obj);
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => recurse(item, prefix));
    } else if (typeof obj === "object") {
      for (const [key, value] of Object.entries(obj)) {
        const newPrefix = key ? key + ": " : "";
        recurse(value, prefix + newPrefix);
      }
    } else {
      messages.push(String(obj));
    }
  }

  recurse(errData);
  return messages;
}

export default function CreateServiceWizard({
  apiUrl = "http://127.0.0.1:8000/services/service/",
  networksUrl = "http://127.0.0.1:8000/services/networks/",
  initialData = {},
  onCreate,
  onCancel,
  notifyOnSuccess = false,
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialData.name ?? "");
  const [network, setNetwork] = useState(initialData.network ?? "");
  const [plan] = useState(initialData.id ?? initialData.plan_id ?? null);

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isValidUser, setIsValidUser] = useState(true);

  const [newNetworkName, setNewNetworkName] = useState("");
  const [creatingNetwork, setCreatingNetwork] = useState(false);
  const [createNetworkError, setCreateNetworkError] = useState(null);
  const [createNetworkSuccess, setCreateNetworkSuccess] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const [resetKey, setResetKey] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => (mountedRef.current = false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      const token = localStorage.getItem("access");
      if (!token) {
        if (!cancelled) setIsValidUser(false);
        return;
      }
      try {
        await apiRequest({ method: "GET", url: networksUrl, params: { page: 1 } });
        if (!cancelled) setIsValidUser(true);
      } catch {
        if (!cancelled) setIsValidUser(false);
      }
    };
    checkAuth();
    return () => (cancelled = true);
  }, [networksUrl]);

  const optionValue = (obj) =>
    String(obj?.id ?? obj?.pk ?? obj?.uuid ?? obj?.name ?? obj ?? "");

  const fetchNetworks = async () => {
    if (!mountedRef.current) return;
    setNetworksLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: networksUrl });
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      if (mountedRef.current) setNetworks(data);
    } catch (err) {
      if (mountedRef.current) setError("Failed to load networks: " + parseErrors(err.response?.data?.error).join("\n"));
    } finally {
      if (mountedRef.current) setNetworksLoading(false);
    }
  };

  useEffect(() => {
    if (step === 1) fetchNetworks();
  }, [step]);

  const validateStep = () => {
    if (step === 0 && !name.trim()) return "Service name is required.";
    if (step === 1 && !network) return "Please select or create a network.";
    return null;
  };

  const goNext = () => {
    const err = validateStep();
    if (err) setError(err);
    else {
      setError(null);
      setStep((p) => Math.min(p + 1, 1));
    }
  };

  const goBack = () => setStep((p) => Math.max(p - 1, 0));

  const handleCreateNetwork = async () => {
    setCreateNetworkError(null);
    setCreateNetworkSuccess(null);
    const trimmed = newNetworkName.trim();
    if (!trimmed) {
      setCreateNetworkError("Network name is required.");
      return;
    }
    setCreatingNetwork(true);
    try {
      const res = await apiRequest({
        method: "POST",
        url: networksUrl,
        data: { name: trimmed },
      });
      const val = res.data?.id ?? res.data?.uuid ?? res.data?.name ?? "";
      setNetwork(val);
      setCreateNetworkSuccess("Network created and selected.");
      setNewNetworkName("");
      await fetchNetworks();
    } catch (err) {
      const parsed = parseErrors(err.response?.data?.error);
      setCreateNetworkError(parsed.join("\n"));
    } finally {
      if (mountedRef.current) setCreatingNetwork(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const err = validateStep();
    if (err) return setError(err);

    setSubmitting(true);
    setSubmissionResult(null);
    setError(null);

    let timeoutReached = false;
    const timeout = setTimeout(() => {
      timeoutReached = true;
      if (mountedRef.current) {
        setSubmitting(false);
        setSubmissionResult({
          ok: false,
          timeout: true,
          message: "Request timed out. Try again.",
        });
      }
    }, 10000);

    try {
      const payload = { name: name.trim(), network, plan };
      const res = await apiRequest({ method: "POST", url: apiUrl, data: payload });
      clearTimeout(timeout);

      const success = res?.status === 201 || res?.status === 200;
      if (!timeoutReached && mountedRef.current) {
        setSubmissionResult({
          ok: success,
          message: success
            ? "Service created successfully!"
            : `Unexpected response (status ${res?.status}).`,
          data: res?.data ?? null,
        });
        if (success && notifyOnSuccess) onCreate?.({ ok: true, data: res.data });
      }
    } catch (err) {
      clearTimeout(timeout);
      if (!timeoutReached && mountedRef.current) {
        const parsed = parseErrors(err.response?.data?.error);
        const msg = parsed.length > 0 ? parsed.join("\n") : err.message ?? "Unknown error.";
        setSubmissionResult({ ok: false, message: msg });
        if (notifyOnSuccess) onCreate?.({ ok: false, error: msg });
      }
    } finally {
      if (!timeoutReached && mountedRef.current) setSubmitting(false);
    }
  };

  const handleClose = () => onCancel?.();

  const renderContent = () => {
    if (!isValidUser) {
      return (
        <div className="p-4 text-center">
          <h5 className="mb-3">🔒 Not authenticated</h5>
          <div className="alert alert-warning">You need to log in to continue.</div>
          <div className="d-flex justify-content-center gap-2 mt-3">
            <button
              className="btn btn-outline-primary"
              onClick={() => (window.location.href = "/login")}
            >
              Go to Login
            </button>
            <button className="btn btn-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      );
    }

    if (submitting) {
      return (
        <div className="p-5 text-center">
          <div className="spinner-border text-primary" />
          <p className="mt-3 fw-semibold">Creating service...</p>
        </div>
      );
    }

    if (submissionResult) {
      return (
        <div className="p-4 text-center">
          <h5
            className={`mb-3 ${
              submissionResult.ok
                ? "text-success"
                : submissionResult.timeout
                ? "text-warning"
                : "text-danger"
            }`}
          >
            {String(submissionResult.message)}
          </h5>

          {submissionResult.ok ? (
            <button className="btn btn-primary" onClick={handleClose}>
              Close
            </button>
          ) : submissionResult.timeout ? (
            <div className="d-flex justify-content-center gap-2">
              <button
                className="btn btn-warning"
                onClick={() => {
                  setError(null);
                  setResetKey((k) => k + 1);
                  handleSubmit();
                }}
              >
                Retry
              </button>
              <button className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          ) : (
            <div className="d-flex justify-content-center gap-2">
              <button
                className="btn btn-outline-warning"
                onClick={() => setSubmissionResult(null)}
              >
                Edit
              </button>
              <button className="btn btn-secondary" onClick={handleClose}>
                Close
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="p-3 animate__animated animate__fadeIn">
        <h4 className="mb-3">🧩 Create Service</h4>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <small>Step {step + 1} of 2</small>
            <div className="progress" style={{ height: 6 }}>
              <div
                className="progress-bar bg-success"
                style={{ width: `${Math.min(((step + 1) / 2) * 100, 100)}%` }}
              />
            </div>
          </div>

          {step === 0 && (
            <>
              <label className="form-label">Service Name</label>
              <input
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. my-service"
              />
              <div className="mt-3 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={goNext}>
                  Next →
                </button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <label className="form-label">Select Network</label>
              {networksLoading ? (
                <div>Loading networks...</div>
              ) : networks.length === 0 ? (
                <div className="alert alert-info">No networks found.</div>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {networks.map((n) => {
                    const val = optionValue(n);
                    return (
                      <div key={val} className="form-check">
                        <input
                          type="radio"
                          className="form-check-input"
                          name="network"
                          id={`net-${val}`}
                          checked={String(network) === String(val)}
                          onChange={() => setNetwork(val)}
                        />
                        <label htmlFor={`net-${val}`} className="form-check-label">
                          {n.name ?? val}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3 border-top pt-3">
                <label className="form-label">Or create a new network</label>
                <div className="d-flex gap-2">
                  <input
                    className="form-control"
                    value={newNetworkName}
                    onChange={(e) => setNewNetworkName(e.target.value)}
                    placeholder="New network name"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={handleCreateNetwork}
                    disabled={creatingNetwork}
                  >
                    {creatingNetwork ? "Creating..." : "Create"}
                  </button>
                </div>
                {createNetworkError && (
                  <div className="text-danger mt-2 small">{createNetworkError}</div>
                )}
                {createNetworkSuccess && (
                  <div className="text-success mt-2 small">{createNetworkSuccess}</div>
                )}
              </div>

              <div className="mt-4 d-flex justify-content-between">
                <button type="button" className="btn btn-outline-secondary" onClick={goBack}>
                  ← Back
                </button>
                <div>
                  <button type="button" className="btn btn-secondary me-2" onClick={handleClose}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success">
                    Create Service
                  </button>
                </div>
              </div>
            </>
          )}
        </form>

        {error && <div className="mt-3 alert alert-danger">{error}</div>}
      </div>
    );
  };

  return (
    <ErrorBoundary key={resetKey} onClose={handleClose}>
      {renderContent()}
    </ErrorBoundary>
  );
}
