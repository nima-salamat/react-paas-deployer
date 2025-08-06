import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const BASE_URL = "http://127.0.0.1:8000/auth/api";

const Spinner = () => (
  <div className="spinner-overlay" aria-label="Loading">
    <div className="spinner" />
  </div>
);

const Login = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState(() => {
    return localStorage.getItem("auth_mode") || "login";
  }); // 'login' or 'signup'
  const [step, setStep] = useState("credentials"); // 'credentials' or 'code'
  const [method, setMethod] = useState("email"); // 'email' or 'phone'
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    code: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);

  // Reset form and errors when mode changes
  useEffect(() => {
    setStep("credentials");
    setForm({ username: "", email: "", phone: "", code: "", password: "" });
    setError("");
    setShowPasswordPopup(false);
  }, [mode]);

  // Watch localStorage.auth_mode and update mode when it changes
  useEffect(() => {
    const interval = setInterval(() => {
      const storedMode = localStorage.getItem("auth_mode");
      if (storedMode && storedMode !== mode) {
        setMode(storedMode);
        localStorage.removeItem("auth_mode");
      }
    }, 200);
    return () => clearInterval(interval);
  }, [mode]);

  // Clear irrelevant field when method changes
  useEffect(() => {
    if (method === "email") {
      setForm((prev) => ({ ...prev, phone: "" }));
    } else {
      setForm((prev) => ({ ...prev, email: "" }));
    }
  }, [method]);

  const onChange = (e) =>
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

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
      if (!phoneRegex.test(form.phone.trim()))
        return "Invalid phone number format";
    }
    return null;
  };

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    const validationError = validateCredentials();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const data = getPayload();

    try {
      if (mode === "signup") {
        await axios.post(`${BASE_URL}/signin/`, data);
      }
      await axios.post(`${BASE_URL}/login/`, data);
      setStep("code");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.code.trim()) {
      setError("Verification code is required");
      return;
    }

    setLoading(true);
    const data = { ...getPayload(), code: form.code.trim() };

    try {
      const res = await axios.post(`${BASE_URL}/login/validate/`, data);
      if (!res.data.twofactor) {
        localStorage.setItem("access", res.data.access);
        localStorage.setItem("refresh", res.data.refresh);
        navigate("/");
      } else {
        setShowPasswordPopup(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleFinal = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.password.trim()) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    const data = { ...getPayload(), code: form.code.trim(), password: form.password };

    try {
      const res = await axios.post(`${BASE_URL}/login/token/`, data);
      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      setShowPasswordPopup(false);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {loading && <Spinner />}

      <div className="login-card shadow rounded" aria-busy={loading}>
        <h2 className="text-center text-primary mb-4">
          {mode === "login" ? "Login" : "Sign Up"}
        </h2>

        <div className="text-center mb-3">
          <button
            className={`btn btn-link ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            disabled={loading}
          >
            Login
          </button>
          <button
            className={`btn btn-link ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="username"
                className="form-control"
                value={form.username}
                onChange={onChange}
                required
                disabled={loading}
                autoComplete="username"
                aria-required="true"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Use:</label>{" "}
              <button
                type="button"
                className={`btn btn-outline-secondary btn-sm me-2 ${method === "email" ? "active" : ""}`}
                onClick={() => setMethod("email")}
                disabled={loading}
                aria-pressed={method === "email"}
              >
                Email
              </button>
              <button
                type="button"
                className={`btn btn-outline-secondary btn-sm ${method === "phone" ? "active" : ""}`}
                onClick={() => setMethod("phone")}
                disabled={loading}
                aria-pressed={method === "phone"}
              >
                Phone
              </button>
            </div>

            {method === "email" ? (
              <div className="mb-3">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={onChange}
                  required
                  disabled={loading}
                  autoComplete="email"
                  aria-required="true"
                />
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label" htmlFor="phone">
                  Phone Number
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="form-control"
                  value={form.phone}
                  onChange={onChange}
                  required
                  disabled={loading}
                  autoComplete="tel"
                  aria-required="true"
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
              aria-busy={loading}
            >
              {mode === "signup" ? "Sign Up and Send Code" : "Send Code"}
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCode} noValidate>
            <div className="mb-3">
              <label className="form-label" htmlFor="code">
                Verification Code
              </label>
              <input
                id="code"
                name="code"
                className="form-control"
                value={form.code}
                onChange={onChange}
                required
                disabled={loading}
                aria-required="true"
                autoComplete="one-time-code"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
              aria-busy={loading}
            >
              Verify Code
            </button>
          </form>
        )}

        {error && (
          <div className="alert alert-danger mt-3" role="alert" aria-live="assertive">
            {error}
          </div>
        )}
      </div>

      {showPasswordPopup && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="password-popup-title">
          <div className="modal-content">
            <h3 id="password-popup-title">Enter Password</h3>
            <form onSubmit={handleFinal} noValidate>
              <div className="mb-3">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-control"
                  value={form.password}
                  onChange={onChange}
                  required
                  disabled={loading}
                  aria-required="true"
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn btn-primary me-2" disabled={loading} aria-busy={loading}>
                Login
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordPopup(false)} disabled={loading}>
                Cancel
              </button>
            </form>
            {error && (
              <div className="alert alert-danger mt-3" role="alert" aria-live="assertive">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
