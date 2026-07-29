import React, { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import apiRequest from "../customHooks/apiRequest";
import {
  alpha,
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info);
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      const e = this.state.error;
      let message = "Unexpected error.";
      if (e?.response?.data?.error) message = parseErrors(e.response.data.error).join("\n");
      else if (e?.message) message = e.message;
      else if (e) message = JSON.stringify(e);

      return (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="subtitle1" color="error" sx={{ fontWeight: 700, mb: 1 }}>
            An error occurred
          </Typography>
          <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 13, textAlign: "left", maxWidth: 480, mx: "auto" }}>
            {String(message)}
          </Box>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="warning"
              size="small"
              startIcon={<ReplayIcon />}
              onClick={() => this.setState({ hasError: false, error: null })}
              sx={{ borderRadius: 0.5 }}
            >
              Retry
            </Button>
            <Button size="small" variant="outlined" onClick={() => this.props.onClose?.()} sx={{ borderRadius: 0.5 }}>
              Close
            </Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}

function parseErrors(errData) {
  const messages = [];
  const walk = (obj, prefix = "") => {
    if (obj == null) return;
    if (typeof obj === "string") messages.push(prefix + obj);
    else if (Array.isArray(obj)) obj.forEach((i) => walk(i, prefix));
    else if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) walk(v, prefix + (k ? `${k}: ` : ""));
    } else messages.push(String(obj));
  };
  walk(errData);
  return messages;
}

const optionValue = (o) => String(o?.id ?? o?.pk ?? o?.uuid ?? o?.name ?? o ?? "");

export default function CreateServiceWizard({
  open = false,
  onCancel,
  onCreate,
  apiUrl = `https://${import.meta.env.VITE_API_BASE}/services/service/`,
  networksUrl = `https://${import.meta.env.VITE_API_BASE}/services/networks/`,
  initialData = {},
  notifyOnSuccess = false,
  resetKey = 0,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const steps = ["Service", "Network", "Confirm"];

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState(initialData.name ?? "");
  const [network, setNetwork] = useState(initialData.network ?? "");
  
  // FIX: Added setPlan to update the state when initialData changes
  const [plan, setPlan] = useState(initialData.id ?? initialData.plan_id ?? null);

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [creatingNetwork, setCreatingNetwork] = useState(false);
  const [createNetworkError, setCreateNetworkError] = useState(null);
  const [createNetworkSuccess, setCreateNetworkSuccess] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [error, setError] = useState(null);
  const [isValidUser, setIsValidUser] = useState(true);

  const mountedRef = useRef(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveStep(0);
    setName(initialData.name ?? "");
    setNetwork(initialData.network ?? "");
    
    // FIX: Update plan state when the modal opens with new initialData
    setPlan(initialData.id ?? initialData.plan_id ?? null);
    
    setError(null);
    setSubmissionResult(null);
    setCreateNetworkError(null);
    setCreateNetworkSuccess(null);
    setNewNetworkName("");
  }, [open, initialData, resetKey]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!localStorage.getItem("access")) {
        if (!cancelled) setIsValidUser(false);
        return;
      }
      try {
        await apiRequest({ method: "GET", url: networksUrl, params: { page: 1 } });
        if (!cancelled) setIsValidUser(true);
      } catch {
        if (!cancelled) setIsValidUser(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networksUrl, open]);

  const fetchNetworks = useCallback(async () => {
    const id = ++fetchIdRef.current;
    setNetworksLoading(true);
    setError(null);
    try {
      const res = await apiRequest({ method: "GET", url: networksUrl });
      if (fetchIdRef.current !== id) return;
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      if (mountedRef.current) setNetworks(data);
    } catch (err) {
      const msg = parseErrors(
        err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Failed to load networks"
      ).join("\n");
      if (mountedRef.current) setError(msg);
    } finally {
      if (mountedRef.current) setNetworksLoading(false);
    }
  }, [networksUrl]);

  useEffect(() => {
    if (activeStep === 1 && open) fetchNetworks();
  }, [activeStep, open, fetchNetworks]);

  const validateStep = (i = activeStep) => {
    if (i === 0 && !name.trim()) return "Service name is required.";
    if (i === 1 && !network) return "Please select or create a network.";
    return null;
  };

  const goToStep = (i) => {
    setError(null);
    setActiveStep(Math.max(0, Math.min(i, steps.length - 1)));
  };

  const next = () => {
    const e = validateStep();
    if (e) {
      setError(e);
      return;
    }
    setError(null);
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => {
    setError(null);
    setActiveStep((s) => Math.max(s - 1, 0));
  };

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
      const res = await apiRequest({ method: "POST", url: networksUrl, data: { name: trimmed } });
      const val = res.data?.id ?? res.data?.uuid ?? res.data?.name ?? "";
      setNetwork(String(val));
      setCreateNetworkSuccess("Network created and selected.");
      setNewNetworkName("");
      await fetchNetworks();
    } catch (err) {
      setCreateNetworkError(
        parseErrors(
          err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Failed to create network"
        ).join("\n")
      );
    } finally {
      if (mountedRef.current) setCreatingNetwork(false);
    }
  };

  const handleSubmit = async () => {
    const v = validateStep(0) || validateStep(1);
    if (v) {
      setError(v);
      if (v.includes("Service name")) goToStep(0);
      else goToStep(1);
      return;
    }

    setError(null);
    setSubmitting(true);
    setSubmissionResult(null);

    let timedOut = false;
    const t = setTimeout(() => {
      timedOut = true;
      if (mountedRef.current) {
        setSubmitting(false);
        setSubmissionResult({ ok: false, timeout: true, message: "Request timed out." });
      }
    }, 10000);

    try {
      const res = await apiRequest({
        method: "POST",
        url: apiUrl,
        data: { name: name.trim(), network, plan },
      });
      clearTimeout(t);
      const ok = res?.status === 201 || res?.status === 200;
      if (!timedOut && mountedRef.current) {
        setSubmissionResult({
          ok,
          message: ok ? "Service created successfully." : `Unexpected status ${res?.status}`,
          data: res?.data ?? null,
        });
        if (ok && notifyOnSuccess) onCreate?.({ ok: true, data: res.data });
      }
    } catch (err) {
      clearTimeout(t);
      if (!timedOut && mountedRef.current) {
        const msg = parseErrors(
          err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Unknown error"
        ).join("\n");
        setSubmissionResult({ ok: false, message: msg });
        if (notifyOnSuccess) onCreate?.({ ok: false, error: msg });
      }
    } finally {
      if (!timedOut && mountedRef.current) setSubmitting(false);
    }
  };

  const handleClose = () => onCancel?.();
  const selectedNet = networks.find((n) => optionValue(n) === String(network));

  return (
    <ErrorBoundary resetKey={resetKey} onClose={handleClose}>
      <Dialog
        open={Boolean(open)}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            borderRadius: isMobile ? 0 : 1,
            border: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
            px: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              Create Service
            </Typography>
            <Typography variant="caption" color="text.secondary">
              3-step wizard
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" edge="end">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <Box sx={{ px: 2, pb: 1.5 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent dividers sx={{ px: 2, py: 2 }}>
          {submitting && <LinearProgress sx={{ mb: 2 }} />}

          {!isValidUser ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <LockOutlinedIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Not authenticated
              </Typography>
              <Alert severity="warning" sx={{ mt: 1.5, textAlign: "left", borderRadius: 0.5 }}>
                Log in to continue.
              </Alert>
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => (window.location.href = "/signin_or_signup")}
                  sx={{ borderRadius: 0.5 }}
                >
                  Login
                </Button>
                <Button size="small" variant="outlined" onClick={handleClose} sx={{ borderRadius: 0.5 }}>
                  Close
                </Button>
              </Stack>
            </Box>
          ) : submissionResult ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              {submissionResult.ok ? (
                <CheckCircleIcon color="success" sx={{ fontSize: 44 }} />
              ) : (
                <Typography variant="h4" color={submissionResult.timeout ? "warning.main" : "error.main"}>
                  {submissionResult.timeout ? "⏱" : "✖"}
                </Typography>
              )}
              <Typography
                variant="subtitle1"
                sx={{ mt: 1, mb: 2, fontWeight: 700 }}
                color={
                  submissionResult.ok
                    ? "success.main"
                    : submissionResult.timeout
                      ? "warning.main"
                      : "error.main"
                }
              >
                {submissionResult.message}
              </Typography>
              {submissionResult.ok ? (
                <Button variant="contained" size="small" onClick={handleClose} sx={{ borderRadius: 0.5 }}>
                  Close
                </Button>
              ) : (
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button
                    variant="contained"
                    color="warning"
                    size="small"
                    startIcon={<ReplayIcon />}
                    onClick={() => {
                      setSubmissionResult(null);
                      if (submissionResult.timeout) handleSubmit();
                    }}
                    sx={{ borderRadius: 0.5 }}
                  >
                    {submissionResult.timeout ? "Retry" : "Edit"}
                  </Button>
                  <Button size="small" variant="outlined" onClick={handleClose} sx={{ borderRadius: 0.5 }}>
                    Close
                  </Button>
                </Stack>
              )}
            </Box>
          ) : (
            <Box sx={{ display: "grid", gap: 2 }}>
              {activeStep === 0 && (
                <TextField
                  label="Service name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. my-service"
                  fullWidth
                  autoFocus
                  disabled={submitting}
                  helperText="Short identifier"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      next();
                    }
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
                />
              )}

              {activeStep === 1 && (
                <Box sx={{ display: "grid", gap: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Select network
                  </Typography>

                  {networksLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={18} />
                      <Typography variant="body2" color="text.secondary">
                        Loading…
                      </Typography>
                    </Stack>
                  ) : networks.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 0.5 }}>
                      No networks. Create one below.
                    </Alert>
                  ) : (
                    <RadioGroup value={String(network)} onChange={(e) => setNetwork(e.target.value)}>
                      {networks.map((n) => {
                        const val = optionValue(n);
                        const selected = String(network) === val;
                        return (
                          <FormControlLabel
                            key={val}
                            value={val}
                            control={<Radio size="small" />}
                            label={n.name ?? val}
                            sx={{
                              mx: 0,
                              px: 1,
                              py: 0.4,
                              mb: 0.5,
                              border: "1px solid",
                              borderColor: selected ? "primary.main" : "divider",
                              borderRadius: 0.5,
                              bgcolor: selected
                                ? alpha(theme.palette.primary.main, 0.06)
                                : "transparent",
                            }}
                          />
                        );
                      })}
                    </RadioGroup>
                  )}

                  <Divider />

                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Create new network
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      placeholder="Network name"
                      value={newNetworkName}
                      onChange={(e) => setNewNetworkName(e.target.value)}
                      fullWidth
                      disabled={creatingNetwork}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateNetwork();
                        }
                      }}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0.5 } }}
                    />
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={handleCreateNetwork}
                      disabled={creatingNetwork}
                      sx={{ borderRadius: 0.5, flexShrink: 0 }}
                    >
                      {creatingNetwork ? "…" : "Create"}
                    </Button>
                  </Stack>
                  {createNetworkError && (
                    <Alert severity="error" sx={{ borderRadius: 0.5 }}>{createNetworkError}</Alert>
                  )}
                  {createNetworkSuccess && (
                    <Alert severity="success" sx={{ borderRadius: 0.5 }}>{createNetworkSuccess}</Alert>
                  )}
                </Box>
              )}

              {activeStep === 2 && (
                <Box sx={{ display: "grid", gap: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                    Confirm
                  </Typography>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 0.5,
                      p: 1.5,
                    }}
                  >
                    {[
                      { label: "Service name", value: name || "—", step: 0 },
                      {
                        label: "Network",
                        value: selectedNet?.name ?? network ?? "—",
                        step: 1,
                      },
                      { label: "Plan", value: plan ?? "default", step: null },
                    ].map((row, i) => (
                      <React.Fragment key={row.label}>
                        {i > 0 && <Divider sx={{ my: 1 }} />}
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {row.label}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {row.value}
                            </Typography>
                          </Box>
                          {row.step != null && (
                            <Button size="small" onClick={() => goToStep(row.step)} sx={{ borderRadius: 0.5 }}>
                              Edit
                            </Button>
                          )}
                        </Stack>
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ borderRadius: 0.5 }}>
                  {error}
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>

        {isValidUser && !submissionResult && (
          <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
            <Button onClick={handleClose} color="inherit" disabled={submitting} size="small" sx={{ borderRadius: 0.5 }}>
              Cancel
            </Button>
            <Box sx={{ flex: 1 }} />
            {activeStep > 0 && (
              <Button onClick={back} disabled={submitting} size="small" sx={{ borderRadius: 0.5 }}>
                Back
              </Button>
            )}
            {activeStep < steps.length - 1 ? (
              <Button variant="contained" onClick={next} disabled={submitting} size="small" sx={{ borderRadius: 0.5 }}>
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={handleSubmit}
                disabled={submitting}
                size="small"
                sx={{ borderRadius: 0.5 }}
              >
                {submitting ? "Creating…" : "Create"}
              </Button>
            )}
          </DialogActions>
        )}
      </Dialog>
    </ErrorBoundary>
  );
}

CreateServiceWizard.propTypes = {
  open: PropTypes.bool,
  onCancel: PropTypes.func,
  onCreate: PropTypes.func,
  apiUrl: PropTypes.string,
  networksUrl: PropTypes.string,
  initialData: PropTypes.object,
  notifyOnSuccess: PropTypes.bool,
  resetKey: PropTypes.any,
};