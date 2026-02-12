// Login.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import "./Login.css";

const BASE_URL = "http://127.0.0.1:8000/auth/api";

const Spinner = () => (
  <div className="spinner-overlay" aria-label="Loading">
    <div className="spinner" />
  </div>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState(() => localStorage.getItem("auth_mode") || "login");
  const [step, setStep] = useState("credentials");
  const [method, setMethod] = useState("email");
  const [form, setForm] = useState({ username: "", email: "", phone: "", code: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getReturnPath = () => {
    const from = location.state?.from;
    if (!from) return null;
    return typeof from === "string" ? from : from.pathname || null;
  };

  const validateAccessToken = async (accessToken) => {
    if (!accessToken) return false;
    try {
      const res = await axios.get(`${BASE_URL}/validateToken/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });
      return res.status >= 200 && res.status < 300;
    } catch (err) {
      if (err.response && err.response.status === 401) return false;
      throw err;
    }
  };

  const finishLoginFromExistingToken = async () => {
    const accessToken = localStorage.getItem("access");
    if (!accessToken) return false;
    try {
      const ok = await validateAccessToken(accessToken);
      if (!ok) return false;

      try {
        const profileRes = await axios.get("http://localhost:8000/users/api/profile/list/", {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 5000,
        });
      } catch {}

      const returnPath = getReturnPath();
      if (returnPath) navigate(returnPath, { replace: true });
      else {
        try {
          navigate(-1);
        } catch {
          navigate("/", { replace: true });
        }
      }
      return true;
    } catch (err) {
      if (!navigator.onLine) setError("No internet connection. Please check your network.");
      else setError("Server is unreachable. Please try again later.");
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    const tryAutoRedirect = async () => {
      const accessToken = localStorage.getItem("access");
      if (!accessToken) return;
      setLoading(true);
      const done = await finishLoginFromExistingToken();
      if (!done && mounted) setLoading(false);
    };
    tryAutoRedirect();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setStep("credentials");
    setForm({ username: "", email: "", phone: "", code: "", password: "" });
    setError("");
    setShowPasswordPopup(false);
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "auth_mode" && e.newValue) {
        setMode(e.newValue);
        localStorage.removeItem("auth_mode");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (method === "email") setForm((prev) => ({ ...prev, phone: "" }));
    else setForm((prev) => ({ ...prev, email: "" }));
  }, [method]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const getPayload = () => {
    const base = { username: form.username.trim() };
    if (method === "email") base.email = form.email.trim();
    else base.phone_number = form.phone.trim();
    return base;
  };

  const validateCredentials = () => {
    if (!form.username.trim()) return "Username is required";
    if (method === "email") {
      if (!form.email.trim()) return "Email is required";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) return "Invalid email format";
    } else {
      if (!form.phone.trim()) return "Phone number is required";
      const phoneRegex = /^[0-9+\-\s]{7,15}$/;
      if (!phoneRegex.test(form.phone.trim())) return "Invalid phone number format";
    }
    return null;
  };

  const tryExistingTokenBeforeAction = async () => {
    const credentialsEmpty =
      !form.username.trim() &&
      (method === "email" ? !form.email.trim() : !form.phone.trim()) &&
      !form.code.trim() &&
      !form.password.trim();
    if (!credentialsEmpty) return false;
    const accessToken = localStorage.getItem("access");
    if (!accessToken) return false;
    return await finishLoginFromExistingToken();
  };

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const shortcut = await tryExistingTokenBeforeAction();
      if (shortcut) return;
    } catch {}
    const validationError = validateCredentials();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    try {
      await axios.post(`${BASE_URL}/authentication/`, getPayload());
      setStep("code");
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors || err.message || "Failed to send verification code");
    } finally { setLoading(false); }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError("");
    try { if (await tryExistingTokenBeforeAction()) return; } catch {}
    if (!form.code.trim()) { setError("Verification code is required"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/login/validate/`, { ...getPayload(), code: form.code.trim() });
      if (!res.data.twofactor) {
        if (res.data.access) localStorage.setItem("access", res.data.access);
        if (res.data.refresh) localStorage.setItem("refresh", res.data.refresh);
        const returnPath = getReturnPath();
        if (returnPath) navigate(returnPath, { replace: true });
        else navigate("/", { replace: true });
      } else setShowPasswordPopup(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Invalid verification code");
    } finally { setLoading(false); }
  };

  const handleFinal = async (e) => {
    e.preventDefault();
    setError("");
    try { if (await tryExistingTokenBeforeAction()) return; } catch {}
    if (!form.password.trim()) { setError("Password is required"); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/login/token/`, { ...getPayload(), code: form.code.trim(), password: form.password });
      if (res.data.access) localStorage.setItem("access", res.data.access);
      if (res.data.refresh) localStorage.setItem("refresh", res.data.refresh);
      setShowPasswordPopup(false);
      const returnPath = getReturnPath();
      if (returnPath) navigate(returnPath, { replace: true });
      else navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-container">
      {loading && <Spinner />}
      <div className="login-card shadow rounded" aria-busy={loading}>
        <h2 className="text-center text-primary mb-4">Login / Sign Up</h2>
        {step === "credentials" && (
          <form onSubmit={handleCredentials} noValidate>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input name="username" className="form-control" value={form.username} onChange={onChange} required disabled={loading} />
            </div>
            <div className="mb-3">
              <label className="form-label">Use:</label>{" "}
              <button type="button" className={`btn btn-outline-secondary btn-sm me-2 ${method === "email" ? "active" : ""}`} onClick={() => setMethod("email")} disabled={loading}>Email</button>
              <button type="button" className={`btn btn-outline-secondary btn-sm ${method === "phone" ? "active" : ""}`} onClick={() => setMethod("phone")} disabled={loading}>Phone</button>
            </div>
            {method === "email" ? (
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input name="email" type="email" className="form-control" value={form.email} onChange={onChange} required disabled={loading} />
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input name="phone" type="tel" className="form-control" value={form.phone} onChange={onChange} required disabled={loading} />
              </div>
            )}
            <button type="submit" className="btn btn-primary w-100" disabled={loading}>Send Verification Code</button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={handleCode}>
            <div className="mb-3">
              <label className="form-label">Verification Code</label>
              <input name="code" className="form-control" value={form.code} onChange={onChange} required disabled={loading} autoFocus />
            </div>
            <div className="d-flex justify-content-between">
              <button type="button" className="btn btn-outline-secondary" onClick={() => { setStep("credentials"); setForm(prev => ({ ...prev, code: "" })); setError(""); }} disabled={loading}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>Verify Code</button>
            </div>
          </form>
        )}
        {error && <div className="alert alert-danger mt-3" role="alert" aria-live="assertive">{error}</div>}
      </div>
      {showPasswordPopup && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="password-popup-title">
          <div className="modal-content">
            <h3 id="password-popup-title">Enter Password</h3>
            <form onSubmit={handleFinal}>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <div className="input-group">
                  <input name="password" type={showPassword ? "text" : "password"} className="form-control" value={form.password} onChange={onChange} required disabled={loading} autoFocus />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setShowPassword(prev => !prev)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "🙈" : "👁️"}</button>
                </div>
              </div>
              <div>
                <button type="submit" className="btn btn-primary me-2" disabled={loading}>Login</button>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowPasswordPopup(false); setForm(prev => ({ ...prev, password: "" })); setError(""); }}>Cancel</button>
              </div>
            </form>
            {error && <div className="alert alert-danger mt-3" role="alert" aria-live="assertive">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
