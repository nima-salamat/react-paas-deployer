import React, { useEffect, useMemo, useState } from "react";
import TranslatedTextTree from "../../i18n/TranslatedTextTree.jsx";
import { useLocale } from "../../i18n/LocaleProvider.jsx";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
  Paper,
  Radio,
  RadioGroup,
  Stack,
  useMediaQuery,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
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
import ReadyAppBrandMark from "./ReadyAppBrandMark.jsx";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";
const PLANS_ROOT = API_ROOT + "/plans";

const STEPS = ["Configure", "Service plans", "Installation overview", "Install"];

function listFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.items)) return data.items;
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

function isOptionalAdvancedField(field) {
  return !field.required && (
    field.ui?.advanced === true ||
    (
      field.ui?.advanced !== false &&
      Object.prototype.hasOwnProperty.call(field, "default")
    )
  );
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
  return (    <TranslatedTextTree>

    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ color: "primary.main", display: "grid", placeItems: "center" }}>{icon}</Box>
      <Typography variant="body2">
        <Box component="span" color="text.secondary">{label}</Box>{" "}
        <Box component="strong">{value}</Box>
      </Typography>
    </Stack>
    </TranslatedTextTree>
  );
}

function DynamicField({ field, value, onChange, config }) {
  const { t } = useLocale();
  const [showSecret, setShowSecret] = useState(false);
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
            {optionLabels[String(option)] ? t(optionLabels[String(option)]) : option}
          </MenuItem>
        ))}
      </TextField>
    );
  }

  const inputType = type === "secret" ? (showSecret ? "text" : "password") : type === "integer" ? "number" : "text";
  return (    <TranslatedTextTree>

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
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              edge="end"
              aria-label={showSecret ? "Hide password" : "Show password"}
              onClick={() => setShowSecret((visible) => !visible)}
              onMouseDown={(event) => event.preventDefault()}
            >
              {showSecret ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      } : undefined}
      helperText={
        field.ui?.helper_text ||
        (field.type === "domain" ? "Platform-managed" : undefined)
      }
    />
    </TranslatedTextTree>
  );
}

export default function ReadyAppWizard({ open, app, onClose, onOpenInstallation }) {
  const { t } = useLocale();
  const variants = app?.variants || [];
  const defaultVariant = variants.find((item) => item.availability === "supported") || variants[0];
  const [variantId, setVariantId] = useState(defaultVariant?.id || "");
  const [name, setName] = useState("");
  const [config, setConfig] = useState({});
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [plans, setPlans] = useState([]);
  const [servicePlanIds, setServicePlanIds] = useState({});
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const variant = useMemo(
    () => variants.find((item) => item.id === variantId) || defaultVariant,
    [variants, variantId, defaultVariant]
  );

  const serviceSpecs = useMemo(() => {
    const source = Array.isArray(variant?.services) ? variant.services : [];
    if (source.length) return source;
    return [{
      key: "app",
      label: app?.name || "Application",
      role: "application",
      platform: "docker",
      plan_type: "APP",
      required: true,
      replicas: 1,
    }];
  }, [variant, app]);

  const planOptionsByKey = useMemo(() => {
    const result = {};
    for (const spec of serviceSpecs) {
      const platform = String(spec.platform || "docker").toLowerCase();
      const planType = String(spec.plan_type || "APP").toUpperCase();
      result[String(spec.key)] = plans.filter((plan) => {
        const matchesPlatform = String(plan?.platform || "").toLowerCase() === platform;
        const candidateType = String(plan?.plan_type || "").toUpperCase();
        const matchesType = ["APP", "READY"].includes(planType)
          ? ["APP", "READY"].includes(candidateType)
          : candidateType === planType;
        return matchesPlatform && matchesType;
      });
    }
    return result;
  }, [serviceSpecs, plans]);

  const servicePlansComplete = serviceSpecs.length > 0 && serviceSpecs.every((spec) => {
    const key = String(spec.key);
    const selected = String(servicePlanIds[key] || "");
    return selected && (planOptionsByKey[key] || []).some(
      (plan) => String(plan.id ?? plan.pk ?? plan.uuid) === selected
    );
  });

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
    setShowAdvancedFields(false);
    setPlans([]);
    setServicePlanIds({});
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
        setPlans(listFrom(response.data));
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

  useEffect(() => {
    if (!open || !serviceSpecs.length || !plans.length) return;
    setServicePlanIds((current) => {
      const next = {};
      for (const spec of serviceSpecs) {
        const key = String(spec.key);
        const options = planOptionsByKey[key] || [];
        const existing = String(current[key] || "");
        const stillAvailable = options.some(
          (plan) => String(plan.id ?? plan.pk ?? plan.uuid) === existing
        );
        const first = options[0];
        next[key] = stillAvailable
          ? existing
          : first
            ? String(first.id ?? first.pk ?? first.uuid)
            : "";
      }
      return next;
    });
    setResolved(null);
  }, [open, serviceSpecs, planOptionsByKey, plans.length]);

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
    const missingService = serviceSpecs.find((spec) => {
      const key = String(spec.key);
      return !(servicePlanIds[key] && (planOptionsByKey[key] || []).some(
        (plan) => String(plan.id ?? plan.pk ?? plan.uuid) === String(servicePlanIds[key])
      ));
    });
    if (missingService) {
      setError("Choose a resource plan for " + (missingService.label || missingService.key) + ".");
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
          service_plan_ids: servicePlanIds,
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
          service_plan_ids: servicePlanIds,
          config,
        },
      });
      const data = response.data || {};
      setInstallation(data);
      setActiveStep(3);
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
        if (
          ["running", "degraded", "stopped", "failed"].includes(nextStatus)
          || (nextStatus === "cancelled" && !cleanupPending)
        ) {
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

  const installationStatus = String(installation?.status || "").toLowerCase();
  const isTerminal = ["running", "degraded", "stopped", "failed"].includes(installationStatus)
    || (installationStatus === "cancelled" && !(installation?.services || []).length);
  const isSuccessful = String(installation?.status || "").toLowerCase() === "running";

  const canAdvanceFromConfigure = !resolveLoading;
  const canAdvanceFromResources = !resolveLoading && servicePlansComplete;
  const visibleFields = useMemo(
    () => (variant?.fields || []).filter(
      (field) => fieldVisible(field, config) && field?.user_editable !== false
    ),
    [variant, config]
  );
  const primaryFields = visibleFields.filter((field) => !isOptionalAdvancedField(field));
  const optionalFields = visibleFields.filter(isOptionalAdvancedField);
  const renderFields = (fields) => (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
        gap: 1.5,
      }}
    >
      {fields.map((field) => (
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
  );

  return (    <TranslatedTextTree>

    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === "backdropClick" || reason === "escapeKeyDown") return;
        if (!installing) onClose?.();
      }}
      disableEscapeKeyDown
      fullScreen={isMobile}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: { xs: 0, sm: 2.5 },
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
            <ReadyAppBrandMark app={app} size={27} />
          </Box>

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 900, letterSpacing: "-.02em" }}>
              Install {app?.name || "app"}
            </Typography>
            {isMobile ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: .35, display: "block" }}>
                {t("Step")} {activeStep + 1} {t("of")} {STEPS.length} · <Box component="span" sx={{ color: "primary.main", fontWeight: 850 }}>{t(STEPS[activeStep])}</Box>
              </Typography>
            ) : (
              <Stack direction="row" spacing={1} sx={{ mt: .35 }} alignItems="center">
                {STEPS.map((label, index) => (
                  <React.Fragment key={label}>
                    {index > 0 && <Box sx={{ width: 16, height: 1, bgcolor: "divider" }} />}
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: index === activeStep ? 850 : 650,
                        color: index === activeStep ? "primary.main" : "text.secondary",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {index + 1} {t(label)}
                    </Typography>
                  </React.Fragment>
                ))}
              </Stack>
            )}
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
                  setServicePlanIds({});
                  setShowAdvancedFields(false);
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

            <Stack spacing={1.25}>
              {renderFields(primaryFields)}
              {optionalFields.length > 0 && (
                <Box>
                  <Divider sx={{ mb: 1.1, mt: 0.3 }} />
                  <Button
                    type="button"
                    size="small"
                    onClick={() => setShowAdvancedFields((shown) => !shown)}
                    aria-expanded={showAdvancedFields}
                    endIcon={showAdvancedFields ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                    sx={{
                      px: 0.5,
                      borderRadius: 1.5,
                      textTransform: "none",
                      fontWeight: 750,
                    }}
                  >
                    {showAdvancedFields
                      ? "Hide optional settings"
                      : `Show optional settings (${optionalFields.length})`}
                  </Button>
                  <Collapse in={showAdvancedFields} unmountOnExit>
                    <Box sx={{ pt: 1 }}>
                      {renderFields(optionalFields)}
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Stack>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.03em" }}>
                Choose a plan for each service
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                Each component has its own resource needs. Select its plan separately.
              </Typography>
            </Box>

            {plansLoading ? (
              <Box sx={{ py: 6, display: "grid", placeItems: "center" }}>
                <CircularProgress />
              </Box>
            ) : plansError ? (
              <Alert severity="error" sx={{ borderRadius: 2.5 }}>{plansError}</Alert>
            ) : (
              <Stack spacing={1.5}>
                {serviceSpecs.map((spec) => {
                  const key = String(spec.key);
                  const options = planOptionsByKey[key] || [];
                  const selectedId = String(servicePlanIds[key] || "");
                  const selectedPlan = options.find(
                    (plan) => String(plan.id ?? plan.pk ?? plan.uuid) === selectedId
                  );
                  return (
                    <Paper key={key} variant="outlined" sx={{ p: { xs: 1.6, sm: 2 }, borderRadius: 2.5 }}>
                      <Stack spacing={1.25}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 850 }}>
                              {spec.label || String(key).replace(/[-_]/g, " ")}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {String(spec.role || "application").toLowerCase() === "database" ? "Database" : "Application"} · {String(spec.platform || "docker").toUpperCase()} · {String(spec.plan_type || "APP").toUpperCase()}
                              {Number(spec.replicas || 1) > 1 ? " · " + spec.replicas + " replicas" : ""}
                            </Typography>
                          </Box>
                          <Chip size="small" variant="outlined" label={options.length + " available plans"} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
                        </Stack>

                        {options.length ? (
                          <TextField
                            select
                            fullWidth
                            label="Resource plan"
                            value={selectedId}
                            onChange={(event) => {
                              setServicePlanIds((current) => ({ ...current, [key]: event.target.value }));
                              setResolved(null);
                              setError("");
                            }}
                          >
                            {options.map((plan) => {
                              const id = String(plan.id ?? plan.pk ?? plan.uuid);
                              return (
                                <MenuItem key={id} value={id}>
                                  <Box sx={{ py: .25 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                      {plan.name || plan.title || "Plan"}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {plan.max_cpu} vCPU · {plan.max_ram} MB RAM · {plan.max_storage} GB storage
                                      {plan.price_per_hour != null ? " · " + plan.price_per_hour + "/hr" : ""}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              );
                            })}
                          </TextField>
                        ) : (
                          <Alert severity="warning" sx={{ borderRadius: 2 }}>
                            No {String(spec.platform || "").toUpperCase()} {String(spec.plan_type || "").toUpperCase()} plans are available for this service.
                          </Alert>
                        )}

                        {selectedPlan ? (
                          <Box sx={(theme) => ({
                            p: 1.1,
                            borderRadius: 1.8,
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .09 : .045),
                          })}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} justifyContent="space-between">
                              <Typography variant="caption" color="text.secondary">
                                Selected: <Box component="strong" sx={{ color: "text.primary" }}>{selectedPlan.name || selectedPlan.title || "Plan"}</Box>
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {selectedPlan.max_cpu} vCPU · {selectedPlan.max_ram} MB RAM · {selectedPlan.max_storage} GB storage
                              </Typography>
                            </Stack>
                          </Box>
                        ) : null}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 22, letterSpacing: "-.03em" }}>
                Review your installation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                Check the services and resource plans below. Nothing is created until you confirm.
              </Typography>
            </Box>

            {resolved ? (
              <>
                <Paper variant="outlined" sx={{ p: { xs: 1.6, sm: 2 }, borderRadius: 2.5 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Box>
                      <Typography variant="overline" color="text.secondary">Application</Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{name}</Typography>
                    </Box>
                    <Chip color="success" variant="outlined" label={variant?.label || variantId} sx={{ alignSelf: { xs: "flex-start", sm: "center" } }} />
                  </Stack>
                </Paper>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))" }, gap: 1 }}>
                  {[
                    ["CPU", (resolved.resource_summary?.cpu_vcpu ?? "—") + " vCPU"],
                    ["RAM", (resolved.resource_summary?.ram_mb ?? "—") + " MB"],
                    ["Storage", (resolved.resource_summary?.storage_mb ?? "—") + " MB"],
                    ["Hourly estimate", resolved.resource_summary?.hourly_price == null ? "—" : resolved.resource_summary.hourly_price + "/hr"],
                  ].map(([label, value]) => (
                    <Paper key={label} variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography sx={{ fontWeight: 850, overflowWrap: "anywhere" }}>{value}</Typography>
                    </Paper>
                  ))}
                </Box>

                <Typography sx={{ fontWeight: 850 }}>Service breakdown</Typography>
                <Stack spacing={1}>
                  {(resolved.resource_summary?.services || []).map((service) => (
                    <Paper key={service.key || service.name} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontWeight: 850 }}>{service.name || service.key}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {service.role || "application"} · {service.platform} · {service.plan?.plan_type || ""}
                          </Typography>
                        </Box>
                        <Chip size="small" color="primary" variant="outlined" label={service.plan?.name || "Selected plan"} sx={{ alignSelf: { xs: "flex-start", sm: "center" }, maxWidth: "100%" }} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .8 }}>
                        {service.cpu_vcpu ?? "—"} vCPU · {service.ram_mb ?? "—"} MB RAM · {service.storage_mb ?? "—"} MB storage
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </>
            ) : (
              <Alert severity="warning">Review details are not available yet. Go back and validate the selected plans.</Alert>
            )}
          </Stack>
        )}

        {activeStep === 3 && (
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
              ) : installation?.status === "degraded" || installation?.status === "stopped" ? (
                <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: "warning.main" }} />
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
                    : installation?.status === "degraded"
                      ? "App needs attention"
                      : installation?.status === "stopped"
                        ? "App is stopped"
                        : installation?.status === "cancelled"
                          ? "Install cancelled"
                          : "Installing…"}
              </Typography>

              {!isSuccessful && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: .45 }}>
                  {t(prettyStage(installation?.stage || "pending"))}
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
                        {t(prettyStage(service.status))}
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
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        {activeStep < 3 && (
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
                if (await resolvePlan()) setActiveStep(2);
              }}
              disabled={!canAdvanceFromResources}
              sx={{ borderRadius: 2.2, px: 2, fontWeight: 900 }}
            >
              {resolveLoading ? "Checking…" : "Review installation"}
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
              Back to plans
            </Button>
            <Button
              variant="contained"
              color="primary"
              onClick={createInstallation}
              disabled={installing || !resolved}
              sx={{ borderRadius: 2.2, px: 2.2, fontWeight: 900 }}
              startIcon={installing ? <CircularProgress size={16} color="inherit" /> : <CheckCircleRoundedIcon />}
            >
              {installing ? "Starting…" : "Confirm & install"}
            </Button>
          </>
        )}

        {activeStep === 3 && installation?.id && !isTerminal && (
          <Button
            color="warning"
            variant="outlined"
            onClick={cancelInstallation}
            sx={{ borderRadius: 2.2, fontWeight: 800 }}
          >
            Cancel
          </Button>
        )}

        {activeStep === 3 && installation?.id && isTerminal && (
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
    </TranslatedTextTree>
  );

}
