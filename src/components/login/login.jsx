import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  InputAdornment,
  Stack,
  useTheme,
  useMediaQuery,
  Tooltip,
  Slide,
  Snackbar,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";

const BASE_URL = "http://127.0.0.1:8000/auth/api";

// Motion-enabled Paper for subtle appear/hover animations
const MotionPaper = motion(Paper);

const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const [mode, setMode] = useState(() => localStorage.getItem("auth_mode") || "login");
  const [step, setStep] = useState("credentials");
  const [method, setMethod] = useState("email");
  const [form, setForm] = useState({ username: "", email: "", phone: "", code: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);

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
        await axios.get("http://localhost:8000/users/api/profile/list/", {
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
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (validationError) {
      setError(validationError);
      setSnackOpen(true);
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${BASE_URL}/authentication/`, getPayload());
      setStep("code");
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.errors || err.message || "Failed to send verification code");
      setSnackOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCode = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (await tryExistingTokenBeforeAction()) return;
    } catch {}
    if (!form.code.trim()) {
      setError("Verification code is required");
      setSnackOpen(true);
      return;
    }
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
      setSnackOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFinal = async (e) => {
    if (e) e.preventDefault();
    setError("");
    try {
      if (await tryExistingTokenBeforeAction()) return;
    } catch {}
    if (!form.password.trim()) {
      setError("Password is required");
      setSnackOpen(true);
      return;
    }
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
      setSnackOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordClose = () => {
    setShowPasswordPopup(false);
    setForm((prev) => ({ ...prev, password: "" }));
    setError("");
  };

  const handleMethodChange = (event, newMethod) => {
    if (newMethod !== null) {
      setMethod(newMethod);
    }
  };

  // Background gradients based on theme mode
  const bgGradient = theme.palette.mode === "dark"
    ? `linear-gradient(135deg, rgba(10,25,47,0.9) 0%, rgba(22,32,54,0.85) 50%, rgba(7,16,32,0.95) 100%)`
    : `linear-gradient(135deg, ${theme.palette.primary.light} 0%, rgba(255,255,255,0.85) 30%, ${theme.palette.secondary.light} 100%)`;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        background: bgGradient,
        transition: "background 400ms ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative floating circles for subtle motion */}
      <motion.div
        style={{
          position: "absolute",
          top: -60,
          left: -80,
          width: 220,
          height: 220,
          borderRadius: "50%",
          filter: "blur(30px)",
          opacity: 0.12,
          background: theme.palette.mode === "dark" ? theme.palette.primary.main : theme.palette.secondary.main,
        }}
        animate={{ x: [0, 18, 0], y: [0, -8, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        style={{
          position: "absolute",
          bottom: -60,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: "50%",
          filter: "blur(36px)",
          opacity: 0.09,
          background: theme.palette.mode === "dark" ? theme.palette.secondary.main : theme.palette.primary.main,
        }}
        animate={{ x: [0, -22, 0], y: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 2 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <MotionPaper
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        transition={{ duration: 0.45 }}
        elevation={12}
        sx={{
          p: isSm ? 3 : 5,
          maxWidth: 500,
          width: "100%",
          borderRadius: 3,
          backdropFilter: "blur(8px)",
          background: theme.palette.mode === "dark" ? "rgba(17,24,39,0.6)" : "rgba(255,255,255,0.85)",
          boxShadow: "0 10px 40px rgba(2,6,23,0.3)",
        }}
        whileHover={{ scale: 1.007 }}
      >
        <Typography
          variant={isSm ? "h5" : "h4"}
          align="center"
          gutterBottom
          color="text.primary"
          sx={{ fontWeight: 700, mb: 2 }}
        >
          Welcome
        </Typography>

        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
          Login or sign up with a verification code. We keep it simple and secure.
        </Typography>

        {/* Step: Credentials */}
        {step === "credentials" && (
          <Box component="form" onSubmit={handleCredentials} noValidate>
            <TextField
              fullWidth
              label="Username"
              name="username"
              value={form.username}
              onChange={onChange}
              required
              disabled={loading}
              margin="normal"
              InputProps={{ sx: { borderRadius: 3 } }}
            />

            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Method
              </Typography>
              <ToggleButtonGroup value={method} exclusive onChange={handleMethodChange} disabled={loading} sx={{ ml: 1 }}>
                <ToggleButton value="email" aria-label="email">
                  <EmailOutlined sx={{ mr: 1 }} /> Email
                </ToggleButton>
                <ToggleButton value="phone" aria-label="phone">
                  <PhoneOutlined sx={{ mr: 1 }} /> Phone
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            {method === "email" ? (
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                required
                disabled={loading}
                margin="normal"
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            ) : (
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={onChange}
                required
                disabled={loading}
                margin="normal"
                InputProps={{ sx: { borderRadius: 3 } }}
              />
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ mt: 3, py: 1.5, borderRadius: 3, fontSize: "1rem" }}
            >
              Send Verification Code
            </Button>
          </Box>
        )}

        {/* Step: Code */}
        {step === "code" && (
          <Box component="form" onSubmit={handleCode}>
            <TextField
              fullWidth
              label="Verification Code"
              name="code"
              value={form.code}
              onChange={onChange}
              required
              disabled={loading}
              autoFocus
              margin="normal"
              InputProps={{ sx: { borderRadius: 3 } }}
            />

            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button
                type="button"
                fullWidth
                variant="outlined"
                onClick={() => {
                  setStep("credentials");
                  setForm((prev) => ({ ...prev, code: "" }));
                  setError("");
                }}
                disabled={loading}
                sx={{ borderRadius: 3, py: 1.2 }}
              >
                Back
              </Button>
              <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ borderRadius: 3, py: 1.2 }}>
                Verify Code
              </Button>
            </Stack>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }} variant="filled">
            {error}
          </Alert>
        )}
      </MotionPaper>

      {/* Password Popup (2FA) */}
      <Dialog open={showPasswordPopup} onClose={handlePasswordClose} maxWidth="xs" fullWidth TransitionComponent={Slide}>
        <DialogTitle>Enter Password</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={onChange}
            required
            disabled={loading}
            margin="normal"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: 3 },
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This account requires a password as a second factor.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handlePasswordClose} disabled={loading}>
            Cancel
          </Button>
          <Tooltip title="Complete login" arrow>
            <span>
              <Button onClick={handleFinal} variant="contained" disabled={loading}>
                Login
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackOpen} autoHideDuration={6000} onClose={() => setSnackOpen(false)}>
        <Alert onClose={() => setSnackOpen(false)} severity="error" sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
