// CreateServiceWizardMui.jsx
import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import apiRequest from "../customHooks/apiRequest";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  Typography,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Stack,
  CircularProgress,
  useTheme,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddNetworkIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";

/* ErrorBoundary (same as before) */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info);
  }
  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }
  render() {
    if (this.state.hasError) {
      const e = this.state.error;
      let message = "Unexpected error.";
      if (e) {
        if (e.response?.data?.error) {
          const parsed = parseErrors(e.response.data.error);
          message = parsed.join("\n");
        } else if (e.message) {
          message = e.message;
        } else {
          message = JSON.stringify(e);
        }
      }
      return (
        <Box sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="h6" color="error" gutterBottom>
            ⚠ An unexpected error occurred
          </Typography>
          <Box
            component="pre"
            sx={{ whiteSpace: "pre-wrap", textAlign: "left", display: "inline-block", maxWidth: 560 }}
          >
            {String(message)}
          </Box>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
            <Button
              variant="contained"
              color="warning"
              onClick={() => this.setState({ hasError: false, error: null })}
              startIcon={<ReplayIcon />}
            >
              Retry
            </Button>
            <Button variant="outlined" onClick={() => this.props.onClose?.()}>
              Close
            </Button>
          </Stack>
        </Box>
      );
    }
    return this.props.children;
  }
}

/* parseErrors helper */
function parseErrors(errData) {
  const messages = [];
  function recurse(obj, prefix = "") {
    if (!obj && obj !== 0) return;
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

/* Main component */
export default function CreateServiceWizard({
  open = true,
  onCancel,
  onCreate,
  apiUrl = "http://127.0.0.1:8000/services/service/",
  networksUrl = "http://127.0.0.1:8000/services/networks/",
  initialData = {},
  notifyOnSuccess = false,
  resetKey = 0,
}) {
  const theme = useTheme();

  const [activeStep, setActiveStep] = useState(0);
  const steps = ["Service", "Network", "Confirm"];

  const [name, setName] = useState(initialData.name ?? "");
  const [network, setNetwork] = useState(initialData.network ?? "");
  const [plan] = useState(initialData.id ?? initialData.plan_id ?? null);

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
    return () => (mountedRef.current = false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
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
    check();
    return () => (cancelled = true);
  }, [networksUrl]);

  useEffect(() => {
    if (activeStep === 1) fetchNetworks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  async function fetchNetworks() {
    const thisFetch = ++fetchIdRef.current;
    if (!mountedRef.current) return;
    setNetworksLoading(true);
    setError(null);
    try {
      const res = await apiRequest({ method: "GET", url: networksUrl });
      if (fetchIdRef.current !== thisFetch) return;
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      if (mountedRef.current) setNetworks(data);
    } catch (err) {
      const parsed = parseErrors(err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Failed to load networks");
      if (mountedRef.current) setError(parsed.join("\n"));
    } finally {
      if (mountedRef.current) setNetworksLoading(false);
    }
  }

  const validateStep = (stepIndex = activeStep) => {
    if (stepIndex === 0 && !name.trim()) return "Service name is required.";
    if (stepIndex === 1 && !network) return "Please select or create a network.";
    return null;
  };

  const goToStep = (i) => {
    setError(null);
    setActiveStep(Math.max(0, Math.min(i, steps.length - 1)));
  };

  const next = () => {
    const e = validateStep(activeStep);
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
    const trimmed = (newNetworkName || "").trim();
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
      const parsed = parseErrors(err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Failed to create network");
      setCreateNetworkError(parsed.join("\n"));
    } finally {
      if (mountedRef.current) setCreatingNetwork(false);
    }
  };

  /* handleSubmit (explicit — only called by Create button) */
  const handleSubmit = async () => {
    const v = validateStep(0) || validateStep(1);
    if (v) {
      setError(v);
      if (v.includes("Service name")) goToStep(0);
      else if (v.includes("network")) goToStep(1);
      return;
    }

    setError(null);
    setSubmitting(true);
    setSubmissionResult(null);

    let timeoutReached = false;
    const timeout = setTimeout(() => {
      timeoutReached = true;
      if (mountedRef.current) {
        setSubmitting(false);
        setSubmissionResult({ ok: false, timeout: true, message: "Request timed out. Try again." });
      }
    }, 10000);

    try {
      const payload = { name: name.trim(), network, plan };
      const res = await apiRequest({ method: "POST", url: apiUrl, data: payload });
      clearTimeout(timeout);
      const success = res?.status === 201 || res?.status === 200;
      if (!timeoutReached && mountedRef.current) {
        setSubmissionResult({ ok: success, message: success ? "Service created successfully!" : `Unexpected response (status ${res?.status})`, data: res?.data ?? null });
        if (success && notifyOnSuccess) onCreate?.({ ok: true, data: res.data });
      }
    } catch (err) {
      clearTimeout(timeout);
      if (!timeoutReached && mountedRef.current) {
        const parsed = parseErrors(err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Unknown error");
        setSubmissionResult({ ok: false, message: parsed.join("\n") });
        if (notifyOnSuccess) onCreate?.({ ok: false, error: parsed.join("\n") });
      }
    } finally {
      if (!timeoutReached && mountedRef.current) setSubmitting(false);
    }
  };

  const handleClose = () => onCancel?.();

  const optionValue = (obj) => String(obj?.id ?? obj?.pk ?? obj?.uuid ?? obj?.name ?? obj ?? "");
  const selectedNetworkObj = networks.find((n) => optionValue(n) === String(network));

  // KEYBOARD: Enter behavior on name field -> go next (not submit)
  const onNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeStep < steps.length - 1) next();
      else handleSubmit();
    }
  };

  // KEYBOARD: Enter in new-network-input should trigger createNetwork
  const onNewNetworkKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!creatingNetwork) handleCreateNetwork();
    }
  };

  return (
    <ErrorBoundary resetKey={resetKey} onClose={handleClose}>
      <Dialog
        open={Boolean(open)}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="create-service-wizard"
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 0,
            bgcolor: theme.palette.mode === "dark" ? "rgba(6,10,12,0.6)" : "rgba(255,255,255,0.86)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(13,110,253,0.06)",
          },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">Create Service</Typography>
            <Typography variant="caption" color="text.secondary">A quick wizard to create a service</Typography>
          </Box>
          <IconButton onClick={handleClose}><CloseIcon /></IconButton>
        </DialogTitle>

        <Box sx={{ px: 3, pt: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent dividers>
          {submitting && <LinearProgress sx={{ mb: 2 }} />}

          {!isValidUser ? (
            <Box sx={{ textAlign: "center", p: 2 }}>
              <Typography variant="h6">🔒 Not authenticated</Typography>
              <Alert severity="warning" sx={{ mt: 1 }}>You need to log in to continue.</Alert>
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
                <Button variant="contained" onClick={() => (window.location.href = "/login")}>Go to Login</Button>
                <Button variant="outlined" onClick={handleClose}>Close</Button>
              </Stack>
            </Box>
          ) : submissionResult ? (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Box>
                {submissionResult.ok ? (
                  <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
                ) : submissionResult.timeout ? (
                  <Typography variant="h4" color="warning.main">⏱</Typography>
                ) : (
                  <Typography variant="h4" color="error.main">✖</Typography>
                )}
              </Box>

              <Typography variant="h6" sx={{ mt: 1, mb: 2 }} color={submissionResult.ok ? "success.main" : submissionResult.timeout ? "warning.main" : "error.main"}>
                {String(submissionResult.message)}
              </Typography>

              {submissionResult.ok ? (
                <Button variant="contained" onClick={handleClose}>Close</Button>
              ) : submissionResult.timeout ? (
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button variant="contained" color="warning" startIcon={<ReplayIcon />} onClick={() => { setSubmissionResult(null); handleSubmit(); }}>
                    Retry
                  </Button>
                  <Button variant="outlined" onClick={handleClose}>Close</Button>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button variant="outlined" color="warning" onClick={() => setSubmissionResult(null)}>Edit</Button>
                  <Button variant="outlined" onClick={handleClose}>Close</Button>
                </Stack>
              )}
            </Box>
          ) : (
            /* NOTE: not using <form> to avoid implicit submits. Buttons call next() or handleSubmit() explicitly. */
            <Box sx={{ display: "grid", gap: 2 }}>
              {activeStep === 0 && (
                <Box sx={{ display: "grid", gap: 2 }}>
                  <TextField
                    label="Service name"
                    variant="outlined"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. my-service"
                    fullWidth
                    disabled={submitting}
                    autoFocus
                    helperText="A short identifier for your service"
                    onKeyDown={onNameKeyDown}
                  />
                </Box>
              )}

              {activeStep === 1 && (
                <Box sx={{ display: "grid", gap: 2 }}>
                  <Typography variant="subtitle2">Select network</Typography>

                  {networksLoading ? (
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                      <CircularProgress size={20} />
                      <Typography color="text.secondary">Loading networks...</Typography>
                    </Box>
                  ) : networks.length === 0 ? (
                    <Alert severity="info">No networks found.</Alert>
                  ) : (
                    <RadioGroup value={String(network)} onChange={(e) => setNetwork(e.target.value)}>
                      {networks.map((n) => {
                        const val = optionValue(n);
                        return <FormControlLabel key={val} value={val} control={<Radio />} label={n.name ?? val} />;
                      })}
                    </RadioGroup>
                  )}

                  <Box sx={{ borderTop: 1, borderColor: "divider", pt: 2 }}>
                    <Typography variant="subtitle2">Or create a new network</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="center" sx={{ mt: 1 }}>
                      <TextField
                        placeholder="New network name"
                        value={newNetworkName}
                        onChange={(e) => setNewNetworkName(e.target.value)}
                        fullWidth
                        disabled={creatingNetwork}
                        onKeyDown={onNewNetworkKeyDown}
                      />
                      <Button
                        variant="outlined"
                        startIcon={<AddNetworkIcon />}
                        onClick={handleCreateNetwork}
                        disabled={creatingNetwork}
                      >
                        {creatingNetwork ? "Creating..." : "Create"}
                      </Button>
                    </Stack>

                    {createNetworkError && <Alert severity="error" sx={{ mt: 1 }}>{createNetworkError}</Alert>}
                    {createNetworkSuccess && <Alert severity="success" sx={{ mt: 1 }}>{createNetworkSuccess}</Alert>}
                  </Box>
                </Box>
              )}

              {activeStep === 2 && (
                <Box sx={{ display: "grid", gap: 2 }}>
                  <Typography variant="h6">Confirm details</Typography>
                  <Typography variant="body2" color="text.secondary">Please review the details below before creating the service.</Typography>

                  <Box sx={{ mt: 1, p: 2, borderRadius: 1, bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2">Service name</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{name || "—"}</Typography>
                      </Box>
                      <Button size="small" onClick={() => goToStep(0)}>Edit</Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2">Network</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>
                          {selectedNetworkObj ? (selectedNetworkObj.name ?? optionValue(selectedNetworkObj)) : (network ? network : "—")}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => goToStep(1)}>Edit</Button>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Box>
                        <Typography variant="subtitle2">Plan</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 700 }}>{plan ?? "default"}</Typography>
                      </Box>
                      <Box />
                    </Box>
                  </Box>
                </Box>
              )}

              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

              <DialogActions sx={{ pt: 2 }}>
                <Button onClick={handleClose} color="inherit" disabled={submitting}>Cancel</Button>

                <Box sx={{ flex: "1 1 auto" }} />

                {activeStep > 0 && <Button onClick={back} disabled={submitting}>← Back</Button>}

                {activeStep < steps.length - 1 ? (
                  <Button type="button" variant="contained" onClick={next} disabled={submitting}>Next →</Button>
                ) : (
                  <Button type="button" variant="contained" color="success" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Creating..." : "Create Service"}
                  </Button>
                )}
              </DialogActions>
            </Box>
          )}
        </DialogContent>
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
