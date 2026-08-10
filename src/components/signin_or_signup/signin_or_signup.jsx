/**
 * Sign-in / Sign-up / Recovery / Forgot-Password component driven by backend LoginSettings.
 * Supports invite links via ?invite=<token> query parameter.
 * Fully configurable: close login with custom message, password recovery via email/phone,
 * confirm password, min length, etc.
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
import LockReset from "@mui/icons-material/LockReset";
import LinkIcon from "@mui/icons-material/Link";
import Block from "@mui/icons-material/Block";

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
  allow_password_recovery: true,
  password_recovery_via_email: true,
  password_recovery_via_phone: true,
  require_confirm_password: true,
  min_password_length: 6,
  allow_login: true,
  custom_login_closed_title: "Login temporarily unavailable",
  custom_login_closed_message: "",
};

export default function SigninOrSignup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));

  const inviteFromUrl = (searchParams.get("invite") || "").trim();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [step, setStep] = useState("credentials");
  const [method, setMethod] = useState("email");
  const [form, setForm] = useState({
    username: "", email: "", phone: "", code: "", password: "", password_confirm: "",
  });
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [accountCreated, setAccountCreated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${BASE_URL}/settings/`);
        if (res.data?.settings) setSettings({ ...DEFAULT_SETTINGS, ...res.data.settings });
      } catch { /* keep defaults */ }
      finally { setSettingsLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!inviteFromUrl) return;
    setInviteToken(inviteFromUrl);
    (async () => {
      try {
        const res = await axios.get(`${BASE_URL}/invite/validate/`, { params: { token: inviteFromUrl } });
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
  const loginClosed = settingsLoaded && settings.allow_login === false;
  const minPassLen = settings.min_password_length || 6;
  const needConfirm = settings.require_confirm_password !== false;

  const handleCredentials = async (e) => {
    e.preventDefault();
    setError("");
    if (settings.allow_username && !form.username.trim()) return showError("Username is required");
    if (method === "email" && !form.email.trim()) return showError("Email is required");
    if (method === "phone" && !form.phone.trim()) return showError("Phone is required");
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/authentication/`, getPayload());
      if (res.data.created) setAccountCreated(true);
      let next = res.data.next_step || "otp";
      if (res.data.created && (next === "password" || res.data.must_set_password)) next = "set_password";
      if (next === "done" && res.data.access) completeLogin(res.data.access, res.data.refresh);
      else setStep(next);
    } catch (err) {
      showError(err.response?.data?.message || err.message || "Failed");
    } finally { setLoading(false); }
  };

  const handleOtp = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return showError("Verification code is required");
    setLoading(true);
    try {
      const res = await axios.post(`${BASE_URL}/login/validate/`, { ...getPayload(), code: form.code.trim() });
      let next = res.data.next_step;
      if (next === "set_password" || res.data.must_set_password || (accountCreated && (next === "password" || res.data.twofactor))) {
        setStep("set_password");
      } else if (next === "password" || res.data.twofactor) {
        setStep("password");
      } else if (res.data.access) {
        completeLogin(res.data.access, res.data.refresh);
      } else {
        setStep(next || "done");
      }
    } catch (err) {
      showError(err.response?.data?.message || "Invalid code");
    } finally { setLoading(false); }
  };

  const handlePassword = async (e) => {
    if (e) e.preventDefault();
    if (!form.password.trim()) return showError("Password is required");
    if (form.password.length < minPassLen) return showError(`Password must be at least ${minPassLen} characters`);
    const isSetPassword = step === "set_password" || accountCreated;
    if (isSetPassword && needConfirm) {
      if (!form.password_confirm.trim()) return showError("Please confirm your password");
      if (form.password !== form.password_confirm) return showError("Passwords do not match");
    }
    setLoading(true);
    try {
      const endpoint = (step === "set_password" || accountCreated) ? "/set-password/" : "/login/token/";
      const body = { ...getPayload(), code: form.code.trim(), password: form.password };
      if (isSetPassword && needConfirm) body.password_confirm = form.password_confirm;
      const res = await axios.post(`${BASE_URL}${endpoint}`, body);
      if (res.data.access) completeLogin(res.data.access, res.data.refresh);
      else if (res.data.next_step === "otp") setStep("otp");
      else showError(res.data.message || "Unexpected response");
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors || err.message || "Login failed";
      showError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally { setLoading(false); }
  };

  const handleRecoveryRequest = async (e) => {
    e.preventDefault();
    if (method === "email" && !form.email.trim()) return showError("Email required");
    if (method === "phone" && !form.phone.trim()) return showError("Phone required");
    setLoading(true);
    try {
      const payload = method === "email" ? { email: form.email.trim() } : { phone_number: form.phone.trim() };
      await axios.post(`${BASE_URL}/recovery/request/`, payload);
      setStep("recovery_otp");
    } catch (err) {
      showError(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
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
    } finally { setLoading(false); }
  };

  const handlePasswordRecoveryRequest = async (e) => {
    e.preventDefault();
    if (method === "email" && !form.email.trim()) return showError("Email required");
    if (method === "phone" && !form.phone.trim()) return showError("Phone required");
    setLoading(true);
    try {
      const payload = method === "email" ? { email: form.email.trim() } : { phone_number: form.phone.trim() };
      await axios.post(`${BASE_URL}/password-recovery/request/`, payload);
      setStep("password_recovery_otp");
    } catch (err) {
      showError(err.response?.data?.message || "Failed");
    } finally { setLoading(false); }
  };

  const handlePasswordRecoveryConfirm = async (e) => {
    e.preventDefault();
    if (!form.code.trim()) return showError("Code required");
    if (!form.password.trim()) return showError("New password is required");
    if (form.password.length < minPassLen) return showError(`Password must be at least ${minPassLen} characters`);
    if (needConfirm) {
      if (!form.password_confirm.trim()) return showError("Please confirm your password");
      if (form.password !== form.password_confirm) return showError("Passwords do not match");
    }
    setLoading(true);
    try {
      const payload = {
        code: form.code.trim(),
        password: form.password,
        ...(method === "email" ? { email: form.email.trim() } : { phone_number: form.phone.trim() }),
      };
      if (needConfirm) payload.password_confirm = form.password_confirm;
      const res = await axios.post(`${BASE_URL}/password-recovery/confirm/`, payload);
      if (res.data.access) completeLogin(res.data.access, res.data.refresh);
      else showError(res.data.message || "Unexpected response");
    } catch (err) {
      showError(err.response?.data?.message || "Invalid code or failed to reset");
    } finally { setLoading(false); }
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
  const recoveryEmailOk = step.startsWith("password_recovery") ? settings.password_recovery_via_email : settings.recovery_via_email;
  const recoveryPhoneOk = step.startsWith("password_recovery") ? settings.password_recovery_via_phone : settings.recovery_via_phone;
  const showRecoveryMethodToggle = recoveryEmailOk && recoveryPhoneOk;
  const isSetPasswordStep = step === "set_password" || (step === "password" && accountCreated);

  const stepTitle = {
    credentials: "Welcome",
    otp: "Verification",
    password: isSetPasswordStep ? "Set Password" : "Password",
    set_password: "Set Password",
    recovery: "Recover Username",
    recovery_otp: "Enter Code",
    recovery_result: "Username Found",
    password_recovery: "Forgot Password",
    password_recovery_otp: "Reset Password",
  };

  const stepSubtitle = {
    credentials: "Sign in or sign up with a verification code.",
    otp: "Enter the verification code we sent you.",
    password: isSetPasswordStep ? "Choose a secure password for your new account." : "This account requires a password.",
    set_password: "Choose a secure password for your new account.",
    recovery: "Enter your email or phone to recover your username.",
    recovery_otp: "Enter the code we sent you.",
    recovery_result: "Your username is ready. You can copy it.",
    password_recovery: "Enter your email or phone to receive a reset code.",
    password_recovery_otp: "Enter the code and choose a new password.",
  };

  if (loginClosed) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, background: bgGradient }}>
        <MotionPaper initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.45 }} elevation={12}
          sx={{ p: isSm ? 3 : 5, maxWidth: 480, width: "100%", borderRadius: 3, textAlign: "center",
            backdropFilter: "blur(8px)",
            background: theme.palette.mode === "dark" ? "rgba(17,24,39,0.6)" : "rgba(255,255,255,0.85)" }}>
          <Block sx={{ fontSize: 56, color: "error.main", mb: 2 }} />
          <Typography variant={isSm ? "h5" : "h4"} sx={{ fontWeight: 700, mb: 2 }}>
            {settings.custom_login_closed_title || "Login temporarily unavailable"}
          </Typography>
          {settings.custom_login_closed_message ? (
            <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
              {settings.custom_login_closed_message}
            </Typography>
          ) : (
            <Typography variant="body1" color="text.secondary">
              Authentication is currently disabled. Please try again later or contact support.
            </Typography>
          )}
        </MotionPaper>
      </Box>
    );
  }

  const renderPasswordFields = ({ isSetPassword, autoFocus = true }) => (
    <>
      <TextField fullWidth label={isSetPassword ? "New Password" : "Password"} name="password"
        type={showPassword ? "text" : "password"} value={form.password} onChange={onChange}
        autoFocus={autoFocus} margin="normal"
        helperText={isSetPassword ? `Minimum ${minPassLen} characters` : undefined}
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
      {isSetPassword && needConfirm && (
        <TextField fullWidth label="Confirm Password" name="password_confirm"
          type={showPasswordConfirm ? "text" : "password"} value={form.password_confirm}
          onChange={onChange} margin="normal"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPasswordConfirm((p) => !p)} edge="end">
                  {showPasswordConfirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
            sx: { borderRadius: 3 },
          }}
        />
      )}
    </>
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, background: bgGradient, position: "relative", overflow: "hidden" }}>
      <Backdrop sx={{ color: "#fff", zIndex: (t) => t.zIndex.drawer + 2 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>

      <MotionPaper initial="hidden" animate="visible" variants={fadeUp} transition={{ duration: 0.45 }} elevation={12}
        sx={{ p: isSm ? 3 : 5, maxWidth: 480, width: "100%", borderRadius: 3, backdropFilter: "blur(8px)",
          background: theme.palette.mode === "dark" ? "rgba(17,24,39,0.6)" : "rgba(255,255,255,0.85)",
          boxShadow: "0 10px 40px rgba(2,6,23,0.3)" }}>

        <Typography variant={isSm ? "h5" : "h4"} align="center" sx={{ fontWeight: 700, mb: 1 }}>
          {stepTitle[step] || "Welcome"}
        </Typography>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 2 }}>
          {stepSubtitle[step] || ""}
        </Typography>

        {inviteToken && step === "credentials" && (
          <Box sx={{ mb: 2 }}>
            {inviteInfo?.valid ? (
              <Alert severity="success" icon={<LinkIcon />} variant="outlined">
                Valid invite{inviteInfo.label ? `: ${inviteInfo.label}` : ""}
                {inviteInfo.remaining_uses != null && (
                  <Chip size="small" label={`${inviteInfo.remaining_uses} use(s) left`} sx={{ ml: 1 }} />
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
          <Alert severity="info" sx={{ mb: 2 }} variant="outlined">
            New accounts require an invite link. If you already have an account, just enter your credentials below and continue — login works without an invite.
          </Alert>
        )}

        {step === "credentials" && (
          <Box component="form" onSubmit={handleCredentials} noValidate>
            {settings.allow_username && (
              <TextField fullWidth label="Username" name="username" value={form.username}
                onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}
            {showMethodToggle && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Method</Typography>
                <ToggleButtonGroup value={method} exclusive onChange={(_, v) => v && setMethod(v)} size="small">
                  {settings.allow_email && <ToggleButton value="email"><EmailOutlined sx={{ mr: 0.5 }} /> Email</ToggleButton>}
                  {settings.allow_phone && <ToggleButton value="phone"><PhoneOutlined sx={{ mr: 0.5 }} /> Phone</ToggleButton>}
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
            <Button type="submit" fullWidth variant="contained" disabled={loading} sx={{ mt: 3, py: 1.5, borderRadius: 3 }}>
              {settings.require_otp ? "Send Verification Code" : "Continue"}
            </Button>
            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              {settings.allow_password_recovery && (
                <Button fullWidth startIcon={<LockReset />}
                  onClick={() => { setStep("password_recovery"); setError(""); setForm((p) => ({ ...p, code: "", password: "", password_confirm: "" })); }}>
                  Forgot Password?
                </Button>
              )}
              {settings.allow_username_recovery && (
                <Button fullWidth startIcon={<PersonSearch />}
                  onClick={() => { setStep("recovery"); setError(""); }}>
                  Forgot Username?
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {step === "otp" && (
          <Box component="form" onSubmit={handleOtp}>
            <TextField fullWidth label="Verification Code" name="code" value={form.code}
              onChange={onChange} autoFocus margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("credentials")} sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Verify</Button>
            </Stack>
          </Box>
        )}

        {(step === "password" || step === "set_password") && (() => {
          const isSetPassword = step === "set_password" || accountCreated;
          return (
            <Box component="form" onSubmit={handlePassword}>
              {renderPasswordFields({ isSetPassword })}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {isSetPassword ? "This is a new account. Choose a secure password." : "This account requires a password."}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                <Button fullWidth variant="outlined"
                  onClick={() => setStep(settings.require_otp ? "otp" : "credentials")}
                  sx={{ borderRadius: 3 }}>Back</Button>
                <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>
                  {isSetPassword ? "Save & Login" : "Login"}
                </Button>
              </Stack>
            </Box>
          );
        })()}

        {step === "recovery" && (
          <Box component="form" onSubmit={handleRecoveryRequest}>
            {showRecoveryMethodToggle && (
              <ToggleButtonGroup value={method} exclusive onChange={(_, v) => v && setMethod(v)} size="small" sx={{ mb: 2 }}>
                {recoveryEmailOk && <ToggleButton value="email"><EmailOutlined sx={{ mr: 0.5 }} /> Email</ToggleButton>}
                {recoveryPhoneOk && <ToggleButton value="phone"><PhoneOutlined sx={{ mr: 0.5 }} /> Phone</ToggleButton>}
              </ToggleButtonGroup>
            )}
            {method === "email" && recoveryEmailOk ? (
              <TextField fullWidth label="Email" name="email" value={form.email} onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            ) : (
              <TextField fullWidth label="Phone" name="phone" value={form.phone} onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("credentials")} sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Send Code</Button>
            </Stack>
          </Box>
        )}

        {step === "recovery_otp" && (
          <Box component="form" onSubmit={handleRecoveryConfirm}>
            <TextField fullWidth label="Verification Code" name="code" value={form.code}
              onChange={onChange} autoFocus margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("recovery")} sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Verify</Button>
            </Stack>
          </Box>
        )}

        {step === "recovery_result" && (
          <Box textAlign="center">
            <Typography variant="h6" sx={{ mb: 2 }}>Your username:</Typography>
            <Paper variant="outlined" sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 3, mb: 3 }}>
              <Typography variant="h5" fontFamily="monospace">{recoveredUsername}</Typography>
              <Tooltip title={copied ? "Copied!" : "Copy"}>
                <IconButton onClick={copyUsername} color={copied ? "success" : "primary"}><ContentCopy /></IconButton>
              </Tooltip>
            </Paper>
            <Button fullWidth variant="contained" sx={{ borderRadius: 3 }}
              onClick={() => { setForm((p) => ({ ...p, username: recoveredUsername, code: "" })); setStep("credentials"); }}>
              Back to Login
            </Button>
          </Box>
        )}

        {step === "password_recovery" && (
          <Box component="form" onSubmit={handlePasswordRecoveryRequest}>
            {showRecoveryMethodToggle && (
              <ToggleButtonGroup value={method} exclusive onChange={(_, v) => v && setMethod(v)} size="small" sx={{ mb: 2 }}>
                {recoveryEmailOk && <ToggleButton value="email"><EmailOutlined sx={{ mr: 0.5 }} /> Email</ToggleButton>}
                {recoveryPhoneOk && <ToggleButton value="phone"><PhoneOutlined sx={{ mr: 0.5 }} /> Phone</ToggleButton>}
              </ToggleButtonGroup>
            )}
            {method === "email" && recoveryEmailOk ? (
              <TextField fullWidth label="Email" name="email" type="email" value={form.email} onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            ) : (
              <TextField fullWidth label="Phone" name="phone" type="tel" value={form.phone} onChange={onChange} margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            )}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("credentials")} sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Send Reset Code</Button>
            </Stack>
          </Box>
        )}

        {step === "password_recovery_otp" && (
          <Box component="form" onSubmit={handlePasswordRecoveryConfirm}>
            <TextField fullWidth label="Verification Code" name="code" value={form.code}
              onChange={onChange} autoFocus margin="normal" InputProps={{ sx: { borderRadius: 3 } }} />
            {renderPasswordFields({ isSetPassword: true, autoFocus: false })}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Button fullWidth variant="outlined" onClick={() => setStep("password_recovery")} sx={{ borderRadius: 3 }}>Back</Button>
              <Button type="submit" fullWidth variant="contained" sx={{ borderRadius: 3 }}>Reset & Login</Button>
            </Stack>
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 3 }} variant="filled">{error}</Alert>}
      </MotionPaper>

      <Snackbar open={snackOpen} autoHideDuration={5000} onClose={() => setSnackOpen(false)}>
        <Alert severity="error" onClose={() => setSnackOpen(false)} sx={{ width: "100%" }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
