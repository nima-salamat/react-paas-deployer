// Login.jsx
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

  const [step, setStep] = useState("credentials"); // 'credentials', 'code', 'password'
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

  useEffect(() => {
    setStep("credentials");
    setForm({ username: "", email: "", phone: "", code: "", password: "" });
    setError("");
    setShowPasswordPopup(false);
  }, []);

  useEffect(() => {
    if (method === "email") setForm((prev) => ({ ...prev, phone: "" }));
    else setForm((prev) => ({ ...prev, email: "" }));
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
      await axios.post(`${BASE_URL}/authentication/`, data);
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
    const data = {
      ...getPayload(),
      code: form.code.trim(),
      password: form.password,
    };

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
        <h2 className="text-center text-primary mb-4">Login / Sign Up</h2>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} noValidate>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input
                name="username"
                className="form-control"
                value={form.username}
                onChange={onChange}
                required
                disabled={loading}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Use:</label>{" "}
              <button
                type="button"
                className={`btn btn-outline-secondary btn-sm me-2 ${
                  method === "email" ? "active" : ""
                }`}
                onClick={() => setMethod("email")}
                disabled={loading}
              >
                Email
              </button>
              <button
                type="button"
                className={`btn btn-outline-secondary btn-sm ${
                  method === "phone" ? "active" : ""
                }`}
                onClick={() => setMethod("phone")}
                disabled={loading}
              >
                Phone
              </button>
            </div>

            {method === "email" ? (
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  name="email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={onChange}
                  required
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="mb-3">
                <label className="form-label">Phone</label>
                <input
                  name="phone"
                  type="tel"
                  className="form-control"
                  value={form.phone}
                  onChange={onChange}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              Send Verification Code
            </button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleCode}>
            <div className="mb-3">
              <label className="form-label">Verification Code</label>
              <input
                name="code"
                className="form-control"
                value={form.code}
                onChange={onChange}
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              Verify Code
            </button>
          </form>
        )}

        {error && (
          <div className="alert alert-danger mt-3" role="alert">
            {error}
          </div>
        )}
      </div>

      {showPasswordPopup && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h3>Enter Password</h3>
            <form onSubmit={handleFinal}>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  name="password"
                  type="password"
                  className="form-control"
                  value={form.password}
                  onChange={onChange}
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary me-2"
                disabled={loading}
              >
                Login
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPasswordPopup(false)}
              >
                Cancel
              </button>
            </form>
            {error && (
              <div className="alert alert-danger mt-3" role="alert">
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
