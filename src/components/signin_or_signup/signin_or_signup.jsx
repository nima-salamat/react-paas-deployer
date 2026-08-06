/**
 * Sign-in / Sign-up / Recovery component driven by backend LoginSettings.
 * Supports invite links via ?invite=<token> query parameter.
 */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Box, Paper, Typography, TextField, Button, ToggleButtonGroup, ToggleButton,
  Alert, Backdrop, CircularProgress, IconButton, InputAdornment, Stack,
  useTheme, useMediaQuery, Tooltip, Snackbar, Divider, Chip,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import EmailOutlined from "@mui/icons-material/EmailOutlined";
import PhoneOutlined from "@mui/icons-material/PhoneOutlined";
import ContentCopy from "@mui/icons-material/ContentCopy";
import PersonSearch from "@mui/icons-material/PersonSearch";
import LinkIcon from "@mui/icons-material/Link";

const BASE_URL = `https://${import.meta.env.VITE_API_BASE}/auth/api`;
const MotionPaper = motion(Paper);
const fadeUp = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0 } };

const DEFAULT_SETTINGS = {
  allow_username: true,
  allow_email: true,
  allow_phone: true,
  require_password: true,
  require_otp: true,
  password_as_second_factor: true,
  allow_auto_signup: true,
  require_password_on_signup: true,
  require_invite_for_signup: false,
  allow_username_recovery: true,
  recovery_via_email: true,
  recovery_via_phone: true,
};

export default function SigninOrSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const inviteFromUrl = (searchParams.get("invite") || "").trim();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [step, setStep] = useState("credentials");
  const [method, setMethod] = useState("email");
  const [form, setForm] = useState({
    username: "", email: "", phone: "", code: "", password: "",
  });
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [inviteInfo, setInviteInfo] = useState(null); // { valid, label, remaining_uses, ... }
  const [inviteError, setInviteError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [recoveredUsername, setRecoveredUsername] = useState("");
  const [copied, setCopied] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const showError = (msg) => { setError(msg); setSnackOpen(true); };

  const getPayload = () => {
    const base = {};
    if (settings.allow_username && form.username.trim()) base.username = form.username.trim();
    if (method === "email" && form.email.trim()) base.email = form.email.trim();
    if (method === "phone" && form.phone.trim()) base.phone_number = form.phone.trim();
    if (inviteToken) base.invite = inviteToken;
    return base;
  };

  const getReturnPath = () => {
    const from = location.state?.from;
    if (!from) return null;
    return typeof from === "string" ? from : from.pathname || null;
  };

  const completeLogin = (access, refresh) => {
    if (access) localStorage.setItem("access", access);
    if (refresh) localStorage.setItem("refresh", refresh);
    window.dispatchEvent(new Event("auth-changed"));
    const returnPath = getReturnPath();
    if (returnPath) navigate(returnPath, { replace: true });
    else navigate("/", { replace: true });
  };

  // Load settings
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${BASE_URL}/settings/`);
        if (res.data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...res.data.settings });
      } catch { /* keep defaults */ }
    })();
  }, []);

  // Validate invite token from URL
  useEffect(() => {
    if (!inviteFromUrl) return;
    setInviteToken(inviteFromUrl);
    (async () => {
      try {
        const res = await axios.get(`${BASE_URL}/invite/validate/`, {
          params: { token: inviteFromUrl },
        });
        setInviteInfo(res.data);
        setInviteError("");
      } catch (err) {
        setInviteInfo(null);
        setInviteError(err.response?.data?.message || "Invalid or expired invite link");
      }
    })();
  }, [inviteFromUrl]);

  useEffect(() => {
    if (settings.allow_email) setMethod("email");
    else if (settings.allow_phone) setMethod("phone");
  }, [settings.allow_email, settings.allow_phone]);

  // Auto-redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;
    (async () => {
      try {
        await axios.get(`${BASE_URL}/validateToken/`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 4000,
        });
        completeLogin(token, localStorage.getItem("refresh"));
      } catch { /* stay */ }
    })();
  }, []);

  const signupClosed = !settings.allow_auto_signup || settings.require_invite_for_signup;
  const needsValidInvite = signupClosed && !inviteInfo?.valid;

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    if (settings.allow_username && !form.username.trim()) {
      return showError("Username is required");
    }
    if (method === "email" && !form.email.trim()) return showError("Email is required");
    if (method === "phone" && !form.phone.trim()) return showError("Phone is required");

    if (needsValidInvite) {
      return showError("A valid invite link is required to create a new account");
    }

    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/authentication/`, getPayload());
      const next = res.data.next_step || "otp";
      if (next === "done" && res.data.access) {
        completeLogin(res.data.access, res.data.refresh);
      } else {
        setStep(next);
      }
    } catch (err) {
      showError(err.response?.data?.message || err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return showError("Verification code is required");
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/login/validate/`, {
        ...getPayload(),
        code: form.code.trim(),
      });
      if (res.data.next_step === "set_password") {
        setStep("set_password");
      } else if (res.data.next_step === "password" || res.data.twofactor) {
        setStep("password");
      } else if (res.data.access) {
        completeLogin(res.data.access, res.data.refresh);
      } else {
        setStep(res.data.next_step || "done");
      }
    } catch (err) {
      showError(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handlePassword = async (e) => {
    if (e) e.preventDefault();
    if (!form.password.trim()) return showError("Password is required");
    setLoading(true);
    try {
      const endpoint = step === "set_password" ? "/set-password/" : "/login/token/";
      const res = await axios.post(`${BASE_URL}${endpoint}`, {
        ...getPayload(),
        code: form.code.trim(),
        password: form.password,
      });
      if (res.data.access) {
        completeLogin(res.data.access, res.data.refresh);
      } else if (res.data.next_step === "otp") {
        setStep("otp");
      } else {
        showError(res.data.message || "Unexpected response");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors ||
        err.message ||
        "Login failed";
      showError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryRequest = async (e) => {
    e.preventDefault();
    if (method === "email" && !form.email.trim()) return showError("Email required");
    if (method === "phone" && !form.phone.trim()) return showError("Phone required");
    setLoading(true);
    try {
      const payload = method === "email"
        ? { email: form.email.trim() }
        : { phone_number: form.phone.trim() };
      await axios.post(`${BASE_URL}/recovery/request/`, payload);
      setStep("recovery_otp");
    } catch (err) {
      showError(err.response?.data?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryConfirm = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return showError("Code required");
    setLoading(true);
    try {
      const payload = {
        code: form.code.trim(),
        ...(method === "email" ? { email: form.email.trim() } : { phone_number: form.phone.trim() }),
      };
      const res = await axios.post(`${BASE_URL}/recovery/confirm/`, payload);
      setRecoveredUsername(res.data.username || "");
      setStep("recovery_result");
    } catch (err) {
      showError(err.response?.data?.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const copyUsername = () => {
    navigator.clipboard.writeText(recoveredUsername);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bgGradient =
    theme.palette.mode === "dark"
      ? `linear-gradient(135deg, rgba(10,25,47,0.9) 0%, rgba(22,32,54,0.85) 50%, rgba(7,16,32,0.95) 100%)`
      : `linear-gradient(135deg, ${theme.palette.primary.light} 0%, rgba(255,255,255,0.85) 30%, ${theme.palette.secondary.light} 100%)`;

  const showMethodToggle = settings.allow_email && settings.allow_phone;

  const stepTitle = {
    credentials: "Welcome",
    otp: "Verification",
    password: "Password",
    set_password: "Set Password",
    recovery: "Recover Username",
    recovery_otp: "Enter Code",
    recovery_result: "Username Found",
  };

  const stepSubtitle = {
    credentials: "Sign in or sign up with a verification code.",
    otp: "Enter the verification code we sent you.",
    password: "This account requires a password.",
    set_password: "Choose a secure password for your new account.",
    recovery: "Enter your email or phone to recover your username.",
    recovery_otp: "Enter the code we sent you.",
    recovery_result: "Your username is ready. You can copy it.",
  };

  return (
    <Box sx={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      p: 2, background: bgGradient, position: "relative", overflow: "hidden",
    }}>
      <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 2 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <MotionPaper
        initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.45 }}
        elevation={12}
        sx={{
          p: isSm ? 3 : 5, maxWidth: 480, width: "100%", borderRadius: 3,
          backdropFilter: "blur(8px)",
          background: theme.palette.mode === "dark" ? "rgba(17,24,39,0.6)" : "rgba(255,255,255,0.85)",
          boxShadow: "0 10px 40px rgba(2,6,23,0.3)",
        }}
      >
        <Typography variant={isSm ? "h5" : "h4"} align="center" sx={{ fontWeight: 700, mb: 1 }}>
          {stepTitle[step] || "Welcome"}
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
          {stepSubtitle[step] || ""}
        </Typography>

        {/* Invite status banner */}
        {inviteToken && step === "credentials" && (
          <Box sx={{ mb: 2 }}>
            {inviteInfo?.valid ? (
              <Alert severity="success" icon={<LinkIcon />} variant="outlined">
                Valid invite{inviteInfo.label ? `: ${inviteInfo.label}` : ""}
                {inviteInfo.remaining_uses != null && (
                  <Chip
                    size="small"
                    label={`${inviteInfo.remaining_uses} use(s) left`}
                    sx={{ ml: 1 }}
                  />
                )}
              </Alert>
            ) : inviteError ? (
              <Alert severity="error" variant="outlined">{inviteError}</Alert>
            ) : (
              <Alert severity="info" variant="outlined">Checking invite…</Alert>
            )}
          </Box>
        )}

        {signupClosed && !inviteToken && step === "credentials" && (
          <Alert severity="warning" sx={{ mb: 2 }} variant="outlined">
            Public signup is closed. You need a valid invite link to create an account.
            Existing users can still sign in.
          </Alert>
        )}

        {/* ===== CREDENTIALS ===== */}
        {step === "credentials" && (
          <Box component="form" onSubmit={handleCredentials} noValidate>
            {settings.allow_username && (
              <TextField fullWidth label="Username" name="username" value={form.username}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}

            {showMethodToggle && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Method</Typography>
                <ToggleButtonGroup value={method} exclusive
                  onChange={(_, v) => v && setMethod(v)} size="small">
                  {settings.allow_email && (
                    <ToggleButton value="email"><EmailOutlined sx={{ mr: 0.5 }} /> Email</ToggleButton>
                  )}
                  {settings.allow_phone && (
                    <ToggleButton value="phone"><PhoneOutlined sx={{ mr: 0.5 }} /> Phone</ToggleButton>
                  )}
                </ToggleButtonGroup>
              </Stack>
            )}

            {method === "email" && settings.allow_email && (
              <TextField fullWidth label="Email" name="email" type="email" value={form.email}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}
            {method === "phone" && settings.allow_phone && (
              <TextField fullWidth label="Phone" name="phone" type="tel" value={form.phone}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}

            <Button type="submit" fullWidth variant="contained" disabled={loading || (needsValidInvite)}
              sx={{ mt: 3, py: 1.5, borderRadius: 3 }}>
              {settings.require_otp ? "Send Verification Code" : "Continue"}
            </Button>

            {settings.allow_username_recovery && (
              <>
                <Divider sx={{ my: 2 }} />
                <Button fullWidth startIcon={<PersonSearch />}
                  onClick={() => { setStep("recovery"); setError(""); }}>
                  Forgot Username?
                </Button>
              </>
            )}
          </Box>
        )}

        {/* ===== OTP ===== */}
        {step === "otp" && (
          <Box component="form" onSubmit={handleOtp}>
            <TextField fullWidth label="Verification Code" name="code" value={form.code}
              onChange={onChange} autoFocus margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("credentials")}
                sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Verify</Button>
            </Stack>
          </Box>
        )}

        {/* ===== PASSWORD / SET PASSWORD ===== */}
        {(step === "password" || step === "set_password") && (
          <Box component="form" onSubmit={handlePassword}>
            <TextField fullWidth
              label={step === "set_password" ? "Set Password" : "Password"}
              name="password" type={showPassword ? "text" : "password"}
              value={form.password} onChange={onChange} autoFocus margin="normal"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword((p) => !p)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                sx: { borderRadius: 3 },
              }}
            />
            {step === "set_password" && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                This is a new account. Choose a secure password.
              </Typography>
            )}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined"
                onClick={() => setStep(settings.require_otp ? "otp" : "credentials")}
                sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>
                {step === "set_password" ? "Save & Login" : "Login"}
              </Button>
            </Stack>
          </Box>
        )}

        {/* ===== RECOVERY REQUEST ===== */}
        {step === "recovery" && (
          <Box component="form" onSubmit={handleRecoveryRequest}>
            {showMethodToggle && (
              <ToggleButtonGroup value={method} exclusive
                onChange={(_, v) => v && setMethod(v)} size="small" sx={{ mb: 2 }}>
                {settings.recovery_via_email && (
                  <ToggleButton value="email"><EmailOutlined sx={{ mr: 0.5 }} /> Email</ToggleButton>
                )}
                {settings.recovery_via_phone && (
                  <ToggleButton value="phone"><PhoneOutlined sx={{ mr: 0.5 }} /> Phone</ToggleButton>
                )}
              </ToggleButtonGroup>
            )}
            {method === "email" ? (
              <TextField fullWidth label="Email" name="email" value={form.email}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            ) : (
              <TextField fullWidth label="Phone" name="phone" value={form.phone}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("credentials")}
                sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>
                Send Code
              </Button>
            </Stack>
          </Box>
        )}

        {/* ===== RECOVERY OTP ===== */}
        {step === "recovery_otp" && (
          <Box component="form" onSubmit={handleRecoveryConfirm}>
            <TextField fullWidth label="Verification Code" name="code" value={form.code}
              onChange={onChange} autoFocus margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("recovery")}
                sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Verify</Button>
            </Stack>
          </Box>
        )}

        {/* ===== RECOVERY RESULT ===== */}
        {step === "recovery_result" && (
          <Box textAlign="center">
            <Typography variant="h6" sx={{ mb: 2 }}>Your username:</Typography>
            <Paper variant="outlined" sx={{
              p: 2, display: "flex", alignItems: "center", justifyContent: "space-between",
              borderRadius: 3, mb: 3,
            }}>
              <Typography variant="h5" fontFamily="monospace">{recoveredUsername}</Typography>
              <Tooltip title={copied ? "Copied!" : "Copy"}>
                <IconButton onClick={copyUsername} color={copied ? "success" : "primary"}>
                  <ContentCopy />
                </IconButton>
              </Tooltip>
            </Paper>
            <Button fullWidth variant="contained" sx={{ borderRadius: 3 }}
              onClick={() => {
                setForm((p) => ({ ...p, username: recoveredUsername, code: "" }));
                setStep("credentials");
              }}>
              Back to Login
            </Button>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 3 }} variant="filled">{error}</Alert>
        )}
      </MotionPaper>

      <Snackbar open={snackOpen} autoHideDuration={5000} onClose={() => setSnackOpen(false)}>
        <Alert severity="error" onClose={() => setSnackOpen(false)} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
