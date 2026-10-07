import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputAdornment,
  IconButton,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";
const PLANS_ROOT = API_ROOT + "/plans";

const STEPS = ["Configure", "Plan", "Launch"];

function listFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function errorText(error, fallback) {
  const data = error?.response?.data;
  if (data?.detail) return String(data.detail);
  if (data?.error) return String(data.error);
  if (typeof data === "string" && data.trim()) return data;
  return error?.message || fallback;
}

function fieldVisible(field, config) {
  const condition = field?.visible_when;
  if (!condition || !condition.field) return true;
  const current = config?.[condition.field];
  if (Object.prototype.hasOwnProperty.call(condition, "equals")) {
    return String(current ?? "") === String(condition.equals ?? "");
  }
  if (Object.prototype.hasOwnProperty.call(condition, "not_equals")) {
    return String(current ?? "") !== String(condition.not_equals ?? "");
  }
  return true;
}

function prettyStage(value) {
  const key = String(value || "pending").toLowerCase().trim();
  const labels = {
    pending: "Waiting to start",
    dependency_resolution: "Preparing",
    dispatching_services: "Starting services",
    preparing: "Preparing",
    build: "Building the app",
    building: "Building the app",
    database: "Setting up the database",
    runtime: "Starting the app",
    health: "Checking the app",
    readiness: "Checking the app",
    finished: "Finishing up",
    application_ready: "Ready",
    cancellation_requested: "Stopping safely",
    cancellation_cleanup: "Cleaning up",
    cancelled: "Cancelled",
    failed: "Deployment failed",
  };
  if (labels[key]) return labels[key];
  const raw = key.replace(/_/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Waiting to start";
}

function ResourceRow({ icon, label, value }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: "primary.main", display: "grid", placeItems: "center" }}>{icon}</Box>
      <Typography variant="body2">
        <Box component="span" color="text.secondary">{label}</Box>{" "}
        <Box component="strong">{value}</Box>
      </Typography>
    </Stack>
  );
}

function DynamicField({ field, value, onChange, config }) {
  if (!fieldVisible(field, config) || field?.user_editable === false) return null;
  const id = String(field.id);
  const type = String(field.type || "string");
  const label = String(field.label || id);
  const required = Boolean(field.required);

  if (type === "boolean") {
    return (
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(value)}
            onChange={(event) => onChange(id, event.target.checked)}
          />
        }
        label={label}
      />
    );
  }

  if (type === "choice") {
    const optionLabels = field.option_labels || {};
    return (
      <TextField
        select
        fullWidth
        label={label}
        value={value ?? ""}
        onChange={(event) => onChange(id, event.target.value)}
        required={required}
        helperText={field.ui?.helper_text || undefined}
      >
        {(field.options || []).map((option) => (
          <MenuItem key={option} value={option}>
            {optionLabels[String(option)] || option}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const inputType = type === "secret" ? "password" : type === "integer" ? "number" : "text";
  return (
    <TextField
      fullWidth
      type={inputType}
      label={label}
      value={value ?? ""}
      onChange={(event) => onChange(id, event.target.value)}
      required={required}
      placeholder={field.ui?.placeholder || ""}
      InputProps={type === "secret" ? {
        startAdornment: (
          <InputAdornment position="start">
            <LockRoundedIcon sx={{ fontSize: 18 }} />
          </InputAdornment>
        ),
      } : undefined}
      helperText={
        field.ui?.helper_text ||
        (field.type === "domain" ? "Platform-managed" : undefined)
      }
    />
  );
}

export default function ReadyAppWizard({ open, app, onClose, onOpenInstallation }) {
  const variants = app?.variants || [];
  const defaultVariant = variants.find((item) => item.availability === "supported") || variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id || "");
  const [name, setName] = useState("");
  const [config, setConfig] = useState({});
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState("");
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [resolveLoading, setResolveLoading] = useState(false);
  const [resolved, setResolved] = useState(null);
  const [error, setError] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installation, setInstallation] = useState(null);
  const [existingInstallationId, setExistingInstallationId] = useState("");
  const [polling, setPolling] = useState(false);

  const variant = useMemo(
    () => variants.find((item) => item.id === variantId) || defaultVariant,
    [variants, variantId, defaultVariant]
  );

  useEffect(() => {
    if (!open || !app) return;
    const nextVariant = variants.find((item) => item.availability === "supported") || variants[0];
    const defaults = {};
    (nextVariant?.fields || []).forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(field, "default")) {
        defaults[field.id] = field.default;
      }
    });
    setVariantId(nextVariant?.id || "");
    setName("");
    setConfig(defaults);
    setPlans([]);
    setPlanId("");
    setActiveStep(0);
    setResolved(null);
    setError("");
    setExistingInstallationId("");
    setInstallation(null);
    setPolling(false);
  }, [open, app]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setPlansLoading(true);
    setPlansError("");
    (async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: PLANS_ROOT + "/?page_size=100",
        });
        if (!mounted) return;
        const items = listFrom(response.data).filter((plan) => {
          const platform = String(plan?.platform || "").toLowerCase();
          const type = String(plan?.plan_type || "").toUpperCase();
          return platform === "docker" && (type === "APP" || type === "READY");
        });
        setPlans(items);
        if (items.length) setPlanId((current) => current || String(items[0].id ?? items[0].pk ?? items[0].uuid));
      } catch (err) {
        if (!mounted) return;
        setPlansError(errorText(err, "Resource plans could not be loaded."));
      } finally {
        if (mounted) setPlansLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  const updateField = (id, value) => {
    setConfig((current) => ({ ...current, [id]: value }));
    setResolved(null);
    setError("");
  };

  const validateConfigure = () => {
    if (!name.trim()) return "Choose an application name.";
    if (name.trim().length > 50) return "Application name must be 50 characters or fewer.";
    for (const field of variant?.fields || []) {
      if (field?.user_editable === false || !fieldVisible(field, config) || !field.required) continue;
      const value = config[field.id];
      if (value === undefined || value === null || String(value).trim() === "") {
        return field.label + " is required.";
      }
    }
    return "";
  };

  const resolvePlan = async () => {
    const validation = validateConfigure();
    if (validation) {
      setError(validation);
      setActiveStep(0);
      return false;
    }
    if (!planId) {
      setError("Select a resource plan.");
      return false;
    }
    setResolveLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        method: "POST",
        url: CATALOG_ROOT + "/apps/" + encodeURIComponent(app.id) + "/resolve/",
        data: {
          name: name.trim(),
          plan_id: planId,
          variant: variantId,
          config,
        },
      });
      setResolved(response.data);
      return true;
    } catch (err) {
      setError(errorText(err, "The configuration could not be validated."));
      return false;
    } finally {
      setResolveLoading(false);
    }
  };

  const createInstallation = async () => {
    setInstalling(true);
    setError("");
    setExistingInstallationId("");
    try {
      const response = await apiRequest({
        method: "POST",
        url: CATALOG_ROOT + "/installations/",
        data: {
          catalog_id: app.id,
          variant: variantId,
          name: name.trim(),
          plan_id: planId,
          config,
        },
      });
      const data = response.data || {};
      setInstallation(data);
      setActiveStep(2);
      setPolling(true);
    } catch (err) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.existing_installation_id) {
        setExistingInstallationId(String(data.existing_installation_id));
        setError("An application with this name already exists. You can open the existing installation.");
      } else {
        setError(errorText(err, "The installation could not be started."));
      }
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    const installationId = installation?.id;
    if (!installationId || !polling) return undefined;
    let active = true;

    const fetchStatus = async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: CATALOG_ROOT + "/installations/" + installationId + "/",
        });
        if (!active) return;
        const next = response.data;
        setInstallation(next);
        const nextStatus = String(next?.status || "").toLowerCase();
        const cleanupPending =
          nextStatus === "cancelled" &&
          Array.isArray(next?.services) &&
          next.services.length > 0;
        if (["running", "failed"].includes(nextStatus) || (nextStatus === "cancelled" && !cleanupPending)) {
          setPolling(false);
        }
      } catch (err) {
        if (active) setError(errorText(err, "Deployment status could not be refreshed."));
      }
    };

    fetchStatus();
    const timer = window.setInterval(fetchStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [installation?.id, polling]);

  const cancelInstallation = async () => {
    if (!installation?.id) return;
    setError("");
    try {
      const response = await apiRequest({
        method: "POST",
        url: CATALOG_ROOT + "/installations/" + installation.id + "/cancel/",
        data: {},
      });
      setInstallation(response.data);
      setPolling(true);
    } catch (err) {
      setError(errorText(err, "Cancellation could not be requested."));
    }
  };

  const isTerminal = ["running", "failed", "cancelled"].includes(
    String(installation?.status || "").toLowerCase()
  );
  const isSuccessful = String(installation?.status || "").toLowerCase() === "running";

  const canAdvanceFromConfigure = !resolveLoading;
  const canAdvanceFromResources = !resolveLoading && Boolean(planId);

  return (
    <Dialog
      open={open}
      onClose={installing ? undefined : onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 4 },
          overflow: "hidden",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Stack direction="row" spacing={1.3} alignItems="center">
          <Box
            sx={(theme) => ({
              width: 42,
              height: 42,
              borderRadius: 2.4,
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(theme.palette.primary.main, .1),
              color: "primary.main",
              flexShrink: 0,
            })}
          >
            {app?.logo ? (
              <Box
                component="img"
                src={app.logo}
                alt=""
                sx={{ width: 27, height: 27, objectFit: "contain" }}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <ComputerRoundedIcon sx={{ fontSize: 22 }} />
            )}
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em" }}>
              Install {app?.name || "app"}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: .35 }} alignItems="center">
              {STEPS.map((label, index) => (
                <React.Fragment key={label}>
                  {index > 0 && (
                    <Box
                      sx={{
                        width: 16,
                        height: 1,
                        bgcolor: "divider",
                      }}
                    />
                  )}
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: index === activeStep ? 850 : 650,
                      color: index === activeStep ? "primary.main" : "text.secondary",
                    }}
                  >
                    {index + 1} {label}
                  </Typography>
                </React.Fragment>
              ))}
            </Stack>
          </Box>

          <IconButton onClick={onClose} disabled={installing} size="small">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      {installing && <LinearProgress sx={{ height: 2 }} />}

      <DialogContent
        dividers
        sx={{
          px: { xs: 2, sm: 3 },
          py: { xs: 2, sm: 2.5 },
          "&.MuiDialogContent-dividers": { borderColor: "divider" },
        }}
      >
        {activeStep === 0 && (
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.03em" }}>
                Configure
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                Set the name and app-specific options.
              </Typography>
            </Box>

            <TextField
              label="App name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setResolved(null);
                setError("");
              }}
              autoFocus
              fullWidth
            />

            {variants.length > 1 && (
              <TextField
                select
                label="Variant"
                value={variantId}
                onChange={(event) => {
                  const next = variants.find((item) => item.id === event.target.value);
                  const defaults = {};
                  (next?.fields || []).forEach((field) => {
                    if (Object.prototype.hasOwnProperty.call(field, "default")) {
                      defaults[field.id] = field.default;
                    }
                  });
                  setVariantId(event.target.value);
                  setConfig(defaults);
                  setResolved(null);
                }}
                fullWidth
              >
                {variants.map((item) => (
                  <MenuItem key={item.id} value={item.id} disabled={item.availability !== "supported"}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
                gap: 1.5,
              }}
            >
              {(variant?.fields || [])
                .filter((field) => fieldVisible(field, config))
                .map((field) => (
                  <Box
                    key={field.id}
                    sx={{ gridColumn: { xs: "span 1", sm: field.ui?.full_width ? "span 2" : "span 1" } }}
                  >
                    <DynamicField
                      field={field}
                      value={config[field.id]}
                      config={config}
                      onChange={updateField}
                    />
                  </Box>
                ))}
            </Box>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.03em" }}>
                Choose a plan
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                Your app will use this plan for its managed runtime.
              </Typography>
            </Box>

            {plansLoading ? (
              <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
                <CircularProgress />
              </Box>
            ) : plansError ? (
              <Alert severity="error" sx={{ borderRadius: 2.5 }}>{plansError}</Alert>
            ) : plans.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2.5 }}>No plans are available.</Alert>
            ) : (
              <Stack spacing={1}>
                {plans.map((plan) => {
                  const id = String(plan.id ?? plan.pk ?? plan.uuid);
                  const selected = id === String(planId);
                  return (
                    <Box
                      key={id}
                      onClick={() => {
                        setPlanId(id);
                        setResolved(null);
                      }}
                      sx={(theme) => ({
                        p: 1.7,
                        border: "1px solid",
                        borderColor: selected ? "primary.main" : "divider",
                        bgcolor: selected
                          ? alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .11 : .055)
                          : "background.paper",
                        borderRadius: 2.8,
                        cursor: "pointer",
                        transition: "border-color 150ms ease, background-color 150ms ease",
                      })}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Radio checked={selected} onChange={() => {
                          setPlanId(id);
                          setResolved(null);
                        }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography sx={{ fontWeight: 850 }}>
                            {plan.name || plan.title || "Plan"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {plan.max_cpu} vCPU · {plan.max_ram} MB RAM · {plan.max_storage} GB
                          </Typography>
                        </Box>
                        {plan.price_per_hour != null && Number(plan.price_per_hour) > 0 && (
                          <Typography variant="body2" sx={{ fontWeight: 850, whiteSpace: "nowrap" }}>
                            {plan.price_per_hour}/hr
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}

            {resolved && (
              <Box
                sx={(theme) => ({
                  p: 1.8,
                  borderRadius: 2.8,
                  bgcolor: alpha(theme.palette.success.main, .07),
                  border: "1px solid",
                  borderColor: alpha(theme.palette.success.main, .18),
                })}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleRoundedIcon sx={{ color: "success.main" }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 850 }}>Plan ready</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {resolved.resource_summary?.cpu_vcpu ?? "—"} vCPU · {resolved.resource_summary?.ram_mb ?? "—"} MB RAM · {resolved.resource_summary?.storage_mb ?? "—"} MB storage
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <Box
              sx={{
                py: 2,
                textAlign: "center",
              }}
            >
              {isSuccessful ? (
                <CheckCircleRoundedIcon sx={{ fontSize: 56, color: "success.main" }} />
              ) : installation?.status === "failed" ? (
                <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: "error.main" }} />
              ) : installation?.status === "cancelled" ? (
                <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: "warning.main" }} />
              ) : (
                <CircularProgress size={48} thickness={4} />
              )}

              <Typography sx={{ mt: 1.2, fontSize: 22, fontWeight: 900, letterSpacing: "-.03em" }}>
                {isSuccessful
                  ? "You're live"
                  : installation?.status === "failed"
                    ? "Install failed"
                    : installation?.status === "cancelled"
                      ? "Install cancelled"
                      : "Installing…"}
              </Typography>

              {!isSuccessful && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                  {prettyStage(installation?.stage || "pending")}
                </Typography>
              )}
            </Box>

            {installation?.application_url && isSuccessful && (
              <Button
                fullWidth
                variant="contained"
                href={installation.application_url}
                target="_blank"
                rel="noreferrer"
                endIcon={<OpenInNewRoundedIcon />}
                sx={{ borderRadius: 2.3, py: 1.15, fontWeight: 900 }}
              >
                Open app
              </Button>
            )}

            {installation?.services?.length > 0 && (
              <Stack spacing={.8}>
                {installation.services.map((service) => (
                  <Box
                    key={service.service_id}
                    sx={{
                      px: 1.4,
                      py: 1.15,
                      borderRadius: 2.2,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                        {service.service_name || String(service.key || "Service").replace(/[-_]/g, " ")}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          color:
                            String(service.status).toLowerCase() === "failed"
                              ? "error.main"
                              : String(service.status).toLowerCase() === "running"
                                ? "success.main"
                                : "text.secondary",
                        }}
                      >
                        {prettyStage(service.status)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}

            {installation?.error_message && (
              <Alert severity="error" sx={{ borderRadius: 2.5 }}>
                {installation.error_message}
              </Alert>
            )}

            {existingInstallationId && (
              <Button
                variant="outlined"
                onClick={() => onOpenInstallation(existingInstallationId)}
                sx={{ borderRadius: 2.2, fontWeight: 850 }}
              >
                Open existing app
              </Button>
            )}
          </Stack>
        )}

        {error && !installation?.error_message && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2.5 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        {activeStep < 2 && (
          <Button onClick={onClose} disabled={installing} color="inherit">
            Close
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        {activeStep === 0 && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            onClick={() => {
              const validation = validateConfigure();
              if (validation) {
                setError(validation);
                return;
              }
              setError("");
              setActiveStep(1);
            }}
            disabled={resolveLoading}
            sx={{ borderRadius: 2.2, px: 2, fontWeight: 900 }}
          >
            Continue
          </Button>
        )}

        {activeStep === 1 && (
          <>
            <Button
              onClick={() => {
                setResolved(null);
                setActiveStep(0);
              }}
              disabled={resolveLoading || installing}
              sx={{ borderRadius: 2.2, fontWeight: 800 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={async () => {
                if (resolved || await resolvePlan()) setActiveStep(2);
              }}
              disabled={!planId || resolveLoading}
              sx={{ borderRadius: 2.2, px: 2, fontWeight: 900 }}
            >
              {resolveLoading ? "Checking…" : resolved ? "Continue" : "Review"}
            </Button>
          </>
        )}

        {activeStep === 2 && !installation?.id && (
          <>
            <Button
              onClick={() => setActiveStep(1)}
              disabled={installing}
              sx={{ borderRadius: 2.2, fontWeight: 800 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={createInstallation}
              disabled={installing || !resolved}
              sx={{ borderRadius: 2.2, px: 2.2, fontWeight: 900 }}
              startIcon={installing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {installing ? "Launching…" : "Install"}
            </Button>
          </>
        )}

        {activeStep === 2 && installation?.id && !isTerminal && (
          <Button
            color="warning"
            variant="outlined"
            onClick={cancelInstallation}
            sx={{ borderRadius: 2.2, fontWeight: 800 }}
          >
            Cancel
          </Button>
        )}

        {activeStep === 2 && installation?.id && isTerminal && (
          <Button
            variant="contained"
            onClick={() => onOpenInstallation(String(installation.id))}
            disabled={installing}
            sx={{ borderRadius: 2.2, fontWeight: 900 }}
          >
            Open workspace
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

}
