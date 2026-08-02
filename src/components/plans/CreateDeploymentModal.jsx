import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import apiRequest from "../customHooks/apiRequest";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
  alpha,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import StorageIcon from "@mui/icons-material/Storage";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const DEFAULT_NETWORKS = `${API_BASE}/api/networks/`;
const DEFAULT_VOLUMES = `${API_BASE}/api/volumes/`;
const DEFAULT_SERVICES = `${API_BASE}/services/service/`;

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

function extractList(data) {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

const optionValue = (o) => String(o?.id ?? o?.pk ?? o?.uuid ?? o?.name ?? o ?? "");

export default function CreateServiceWizard({
  open = false,
  onCancel,
  onCreate,
  apiUrl = DEFAULT_SERVICES,
  networksUrl = DEFAULT_NETWORKS,
  volumesUrl = DEFAULT_VOLUMES,
  initialData = {},
  notifyOnSuccess = false,
  resetKey = 0,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const steps = ["Service", "Network", "Volumes", "Confirm"];

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState(initialData.name ?? "");
  const [network, setNetwork] = useState(initialData.network ?? "");
  const [plan, setPlan] = useState(initialData.id ?? initialData.plan_id ?? null);

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [creatingNetwork, setCreatingNetwork] = useState(false);
  const [createNetworkError, setCreateNetworkError] = useState(null);
  const [createNetworkSuccess, setCreateNetworkSuccess] = useState(null);

  const [volumes, setVolumes] = useState([]);
  const [volumesLoading, setVolumesLoading] = useState(false);
  const [selectedVolumeIds, setSelectedVolumeIds] = useState([]);
  const [newVolume, setNewVolume] = useState({
    name: "",
    size_mb: "1024",
    default_bind: "/data",
    default_mode: "rw",
  });
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [volumeMsg, setVolumeMsg] = useState(null);

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
    setPlan(initialData.id ?? initialData.plan_id ?? null);
    setSelectedVolumeIds([]);
    setError(null);
    setSubmissionResult(null);
    setCreateNetworkError(null);
    setCreateNetworkSuccess(null);
    setNewNetworkName("");
    setVolumeMsg(null);
    setNewVolume({ name: "", size_mb: "1024", default_bind: "/data", default_mode: "rw" });
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
      if (mountedRef.current) setNetworks(extractList(res.data));
    } catch (err) {
      const msg = parseErrors(
        err?.response?.data?.error ?? err?.response?.data ?? err?.message ?? "Failed to load networks"
      ).join("\n");
      if (mountedRef.current) setError(msg);
    } finally {
      if (mountedRef.current) setNetworksLoading(false);
    }
  }, [networksUrl]);

  const fetchVolumes = useCallback(async () => {
    setVolumesLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: volumesUrl });
      if (mountedRef.current) setVolumes(extractList(res.data));
    } catch {
      if (mountedRef.current) setVolumes([]);
    } finally {
      if (mountedRef.current) setVolumesLoading(false);
    }
  }, [volumesUrl]);

  useEffect(() => {
    if (activeStep === 1 && open) fetchNetworks();
    if (activeStep === 2 && open) fetchVolumes();
  }, [activeStep, open, fetchNetworks, fetchVolumes]);

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
      const val = res.data?.id ?? res.data?.pk ?? res.data?.uuid ?? "";
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

  const toggleVolume = (id) => {
    const sid = String(id);
    setSelectedVolumeIds((prev) =>
      prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]
    );
  };

  const handleCreateVolume = async () => {
    setVolumeMsg(null);
    const n = newVolume.name.trim();
    const bind = newVolume.default_bind.trim();
    const size = Number(newVolume.size_mb);
    if (!n) {
      setVolumeMsg({ type: "error", text: "Volume name is required." });
      return;
    }
    if (!bind.startsWith("/")) {
      setVolumeMsg({ type: "error", text: "Bind must be absolute path, e.g. /data" });
      return;
    }
    if (!size || size < 1) {
      setVolumeMsg({ type: "error", text: "Valid size (MB) required." });
      return;
    }
    setCreatingVolume(true);
    try {
      const res = await apiRequest({
        method: "POST",
        url: volumesUrl,
        data: {
          name: n,
          size_mb: size,
          default_bind: bind,
          default_mode: newVolume.default_mode || "rw",
        },
      });
      const id = String(res.data?.id ?? res.data?.pk ?? "");
      await fetchVolumes();
      if (id) setSelectedVolumeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setNewVolume({ name: "", size_mb: "1024", default_bind: "/data", default_mode: "rw" });
      setVolumeMsg({ type: "success", text: "Volume created and selected." });
    } catch (err) {
      setVolumeMsg({
        type: "error",
        text: parseErrors(err?.response?.data ?? err?.message).join("\n") || "Failed to create volume",
      });
    } finally {
      setCreatingVolume(false);
    }
  };

  const attachVolumesToService = async (serviceId) => {
    if (!selectedVolumeIds.length || !serviceId) return;
    for (const vid of selectedVolumeIds) {
      try {
        await apiRequest({
          method: "POST",
          url: `${volumesUrl}${vid}/attach/`,
          data: { service_id: serviceId },
        });
      } catch {
        // try alternate payload
        try {
          await apiRequest({
            method: "POST",
            url: `${volumesUrl}${vid}/attach/`,
            data: { service: serviceId },
          });
        } catch {
          /* best-effort */
        }
      }
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
    }, 20000);

    try {
      const res = await apiRequest({
        method: "POST",
        url: apiUrl,
        data: {
          name: name.trim(),
          network,
          plan,
        },
      });
      clearTimeout(t);
      const ok = res?.status === 201 || res?.status === 200;
      const serviceId = res?.data?.id ?? res?.data?.pk ?? res?.data?.service?.id;

      if (ok && serviceId && selectedVolumeIds.length) {
        await attachVolumesToService(serviceId);
      }

      if (!timedOut && mountedRef.current) {
        setSubmissionResult({
          ok,
          message: ok
            ? selectedVolumeIds.length
              ? "Service created and volumes attached."
              : "Service created successfully."
            : `Unexpected status ${res?.status}`,
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
  const selectedVols = volumes.filter((v) =>
    selectedVolumeIds.includes(String(v.id ?? v.pk))
  );

  return (
    <Dialog
      open={Boolean(open)}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 2.5,
          border: isMobile ? "none" : "1px solid",
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
          px: { xs: 2, sm: 3 }, 
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Create service
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {initialData.plan_name
              ? `Plan: ${initialData.plan_name}${initialData.platform ? ` · ${initialData.platform}` : ""}`
              : "Wizard"}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" edge="end">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: { xs: 1, sm: 2 }, pb: 1.5 }}>
        <Stepper activeStep={activeStep} alternativeLabel={!isMobile}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 3 } }}>
        {submitting && <LinearProgress sx={{ mb: 2 }} />}

        {!isValidUser ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <LockOutlinedIcon sx={{ fontSize: 40, color: "text.secondary", mb: 1 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Not authenticated
            </Typography>
            <Alert severity="warning" sx={{ mt: 1.5, textAlign: "left", borderRadius: 1.5 }}>
              Log in to continue.
            </Alert>
            <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
              <Button
                variant="contained"
                size="small"
                onClick={() => (window.location.href = "/signin_or_signup")}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
              >
                Login
              </Button>
              <Button size="small" variant="outlined" onClick={handleClose} sx={{ borderRadius: 1.5, textTransform: "none" }}>
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
              <Button
                variant="contained"
                size="large"
                onClick={handleClose}
                fullWidth={isMobile}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, mt: 2 }}
              >
                Close & Return
              </Button>
            ) : (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="center" mt={2}>
                <Button
                  variant="contained"
                  color="warning"
                  size="small"
                  fullWidth={isMobile}
                  startIcon={<ReplayIcon />}
                  onClick={() => {
                    setSubmissionResult(null);
                    if (submissionResult.timeout) handleSubmit();
                  }}
                  sx={{ borderRadius: 1.5, textTransform: "none" }}
                >
                  {submissionResult.timeout ? "Retry" : "Edit"}
                </Button>
                <Button size="small" fullWidth={isMobile} variant="outlined" onClick={handleClose} sx={{ borderRadius: 1.5, textTransform: "none" }}>
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
                placeholder="e.g. my-api"
                fullWidth
                autoFocus
                disabled={submitting}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    next();
                  }
                }}
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
                  <Alert severity="info" sx={{ borderRadius: 1.5 }}>
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
                            py: 0.5,
                            mb: 0.5,
                            border: "1px solid",
                            borderColor: selected ? "primary.main" : "divider",
                            borderRadius: 1.5,
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
                  Or create network
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    size="small"
                    placeholder="Network name"
                    value={newNetworkName}
                    onChange={(e) => setNewNetworkName(e.target.value)}
                    fullWidth
                    disabled={creatingNetwork}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleCreateNetwork}
                    disabled={creatingNetwork}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
                  >
                    {creatingNetwork ? "…" : "Create"}
                  </Button>
                </Stack>
                {createNetworkError && (
                  <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                    {createNetworkError}
                  </Alert>
                )}
                {createNetworkSuccess && (
                  <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                    {createNetworkSuccess}
                  </Alert>
                )}
              </Box>
            )}

            {activeStep === 2 && (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StorageIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Attach volumes (optional)
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Select existing volumes or create a new one. They attach after the service is created.
                </Typography>

                {volumesLoading ? (
                  <CircularProgress size={22} />
                ) : volumes.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    No volumes yet. Create one below.
                  </Alert>
                ) : (
                  <Box>
                    {volumes.map((v) => {
                      const id = String(v.id ?? v.pk);
                      const checked = selectedVolumeIds.includes(id);
                      return (
                        <FormControlLabel
                          key={id}
                          control={
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={() => toggleVolume(id)}
                            />
                          }
                          label={
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" fontWeight={600}>
                                {v.name}
                              </Typography>
                              <Chip
                                size="small"
                                label={v.default_bind || v.bind || "—"}
                                sx={{ height: 20, fontSize: 11, fontFamily: "monospace" }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {v.size_mb != null ? `${v.size_mb} MB` : ""}
                              </Typography>
                            </Stack>
                          }
                          sx={{
                            display: "flex",
                            mx: 0,
                            mb: 0.5,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1.5,
                            border: "1px solid",
                            borderColor: checked ? "primary.main" : "divider",
                          }}
                        />
                      );
                    })}
                  </Box>
                )}

                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Create volume
                </Typography>
                <Stack spacing={1}>
                  <TextField
                    size="small"
                    label="Name"
                    value={newVolume.name}
                    onChange={(e) => setNewVolume((p) => ({ ...p, name: e.target.value }))}
                    fullWidth
                  />
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField
                      size="small"
                      label="Bind path"
                      value={newVolume.default_bind}
                      onChange={(e) =>
                        setNewVolume((p) => ({ ...p, default_bind: e.target.value }))
                      }
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Size MB"
                      type="number"
                      value={newVolume.size_mb}
                      onChange={(e) => setNewVolume((p) => ({ ...p, size_mb: e.target.value }))}
                      sx={{ width: { xs: "100%", sm: 120 } }}
                    />
                  </Stack>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleCreateVolume}
                    disabled={creatingVolume}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, alignSelf: "flex-start" }}
                  >
                    {creatingVolume ? "Creating…" : "Create & select"}
                  </Button>
                  {volumeMsg && (
                    <Alert severity={volumeMsg.type} sx={{ borderRadius: 1.5 }}>
                      {volumeMsg.text}
                    </Alert>
                  )}
                </Stack>
              </Box>
            )}

            {activeStep === 3 && (
              <Box sx={{ display: "grid", gap: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Confirm
                </Typography>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
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
                    {
                      label: "Volumes",
                      value:
                        selectedVols.length > 0
                          ? selectedVols.map((v) => v.name).join(", ")
                          : "None",
                      step: 2,
                    },
                    {
                      label: "Plan",
                      value: initialData.plan_name || plan || "—",
                      step: null,
                    },
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
                          <Button
                            size="small"
                            onClick={() => goToStep(row.step)}
                            sx={{ borderRadius: 1.5, textTransform: "none" }}
                          >
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
              <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                {error}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      {isValidUser && !submissionResult && (
        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1 }}>
          <Button
            onClick={handleClose}
            color="inherit"
            disabled={submitting}
            size="small"
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && (
            <Button onClick={back} disabled={submitting} size="small" sx={{ textTransform: "none" }}>
              Back
            </Button>
          )}
          {activeStep < steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={next}
              disabled={submitting}
              size="small"
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
            >
              Next
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={handleSubmit}
              disabled={submitting}
              size="small"
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}

CreateServiceWizard.propTypes = {
  open: PropTypes.bool,
  onCancel: PropTypes.func,
  onCreate: PropTypes.func,
  apiUrl: PropTypes.string,
  networksUrl: PropTypes.string,
  volumesUrl: PropTypes.string,
  initialData: PropTypes.object,
  notifyOnSuccess: PropTypes.bool,
  resetKey: PropTypes.any,
};