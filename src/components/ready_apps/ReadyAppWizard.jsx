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
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";
const PLANS_ROOT = API_ROOT + "/plans";

const STEPS = ["Configure", "Resources", "Review", "Deploy"];

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
  const raw = String(value || "pending").replace(/_/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Pending";
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
  if (!fieldVisible(field, config)) return null;
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
    return (
      <TextField
        select
        fullWidth
        label={label}
        value={value ?? ""}
        onChange={(event) => onChange(id, event.target.value)}
        required={required}
      >
        {(field.options || []).map((option) => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
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
        type === "secret"
          ? "Stored securely and never shown in deployment review."
          : field.type === "domain"
            ? "The platform will use its managed hostname."
            : undefined
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
    setError("");
  };

  const validateConfigure = () => {
    if (!name.trim()) return "Choose an application name.";
    if (name.trim().length > 50) return "Application name must be 50 characters or fewer.";
    for (const field of variant?.fields || []) {
      if (!fieldVisible(field, config) || !field.required) continue;
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
        const terminal = ["running", "failed", "cancelled"].includes(String(next?.status || "").toLowerCase());
        if (terminal) setPolling(false);
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
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, minHeight: { md: 620 } } }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Deploy {app?.name || "application"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Configure only what you need. The platform resolves the managed topology and resources.
            </Typography>
          </Box>
          <IconButton onClick={onClose} disabled={installing}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <Box sx={{ px: { xs: 1.5, sm: 3 }, pb: 1 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
      </Box>

      {installing && <LinearProgress />}

      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
        {activeStep === 0 && (
          <Stack spacing={2}>
            <TextField
              label="Application name"
              value={name}
              onChange={(event) => updateField("__name", event.target.value) || setName(event.target.value)}
              autoFocus
              fullWidth
              helperText="This name becomes part of the platform-managed hostname."
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
                    if (Object.prototype.hasOwnProperty.call(field, "default")) defaults[field.id] = field.default;
                  });
                  setVariantId(event.target.value);
                  setConfig(defaults);
                  setResolved(null);
                }}
                fullWidth
              >
                {variants.map((item) => (
                  <MenuItem
                    key={item.id}
                    value={item.id}
                    disabled={item.availability !== "supported"}
                  >
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {(variant?.fields || []).filter((field) => fieldVisible(field, config)).map((field) => (
              <DynamicField
                key={field.id}
                field={field}
                value={config[field.id]}
                config={config}
                onChange={updateField}
              />
            ))}

            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PublicRoundedIcon color="primary" />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Platform hostname</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Your app gets a managed HTTPS hostname. Custom domains are not part of this workflow yet.
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Stack>
        )}

        {activeStep === 1 && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Choose a resource plan</Typography>
              <Typography variant="body2" color="text.secondary">
                This selection is validated against every managed application and database service.
              </Typography>
            </Box>

            {plansLoading ? (
              <Box sx={{ minHeight: 150, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
            ) : plansError ? (
              <Alert severity="error" sx={{ borderRadius: 2 }}>{plansError}</Alert>
            ) : plans.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No Docker application plans are currently available.
              </Alert>
            ) : (
              <RadioGroup value={String(planId)} onChange={(event) => setPlanId(event.target.value)}>
                <Stack spacing={1}>
                  {plans.map((plan) => {
                    const id = String(plan.id ?? plan.pk ?? plan.uuid);
                    const selected = id === String(planId);
                    return (
                      <Box
                        key={id}
                        sx={{
                          p: 1.6,
                          borderRadius: 2.2,
                          border: "1px solid",
                          borderColor: selected ? "primary.main" : "divider",
                          bgcolor: selected ? "action.hover" : "transparent",
                        }}
                      >
                        <FormControlLabel
                          value={id}
                          control={<Radio />}
                          sx={{ m: 0, width: "100%", alignItems: "flex-start" }}
                          label={
                            <Box sx={{ width: "100%" }}>
                              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                                <Box>
                                  <Typography sx={{ fontWeight: 850 }}>{plan.name || plan.title || "Plan"}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {plan.storage_type || "Storage"} · {plan.plan_type || "APP"}
                                  </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                  {plan.price_per_hour != null ? plan.price_per_hour + "/hr" : ""}
                                </Typography>
                              </Stack>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1 }}>
                                <ResourceRow icon={<ComputerRoundedIcon sx={{ fontSize: 18 }} />} label="CPU" value={plan.max_cpu} />
                                <ResourceRow icon={<MemoryRoundedIcon sx={{ fontSize: 18 }} />} label="RAM" value={plan.max_ram + " MB"} />
                                <ResourceRow icon={<StorageRoundedIcon sx={{ fontSize: 18 }} />} label="Storage" value={plan.max_storage + " GB"} />
                              </Stack>
                            </Box>
                          }
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </RadioGroup>
            )}
          </Stack>
        )}

        {activeStep === 2 && (
          <Stack spacing={2}>
            {resolveLoading ? (
              <Box sx={{ minHeight: 150, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
            ) : !resolved ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>Review is not available yet.</Alert>
            ) : (
              <>
                <Stack direction="row" spacing={1} alignItems="center">
                  <CheckCircleRoundedIcon color="success" />
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>Configuration validated</Typography>
                    <Typography variant="caption" color="text.secondary">
                      The following values come from the backend planner.
                    </Typography>
                  </Box>
                </Stack>

                {resolved.public_endpoints?.length > 0 && (
                  <Box sx={{ p: 1.7, borderRadius: 2.2, border: "1px solid", borderColor: "primary.main", bgcolor: "action.hover" }}>
                    <Typography variant="caption" color="text.secondary">Application address</Typography>
                    {resolved.public_endpoints.map((endpoint) => (
                      <Typography key={endpoint.name} sx={{ fontWeight: 850, wordBreak: "break-all" }}>
                        {endpoint.url}
                      </Typography>
                    ))}
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>Managed components</Typography>
                  <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                    {(resolved.managed_components || []).map((component) => (
                      <Chip key={component.label} label={component.label} variant="outlined" />
                    ))}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>Resource allocation</Typography>
                  <Stack spacing={0.9}>
                    <ResourceRow icon={<ComputerRoundedIcon sx={{ fontSize: 18 }} />} label="CPU allocation" value={resolved.resource_summary.cpu_vcpu + " vCPU"} />
                    <ResourceRow icon={<MemoryRoundedIcon sx={{ fontSize: 18 }} />} label="RAM allocation" value={resolved.resource_summary.ram_mb + " MB"} />
                    <ResourceRow icon={<StorageRoundedIcon sx={{ fontSize: 18 }} />} label="Persistent storage" value={resolved.resource_summary.storage_mb + " MB"} />
                    <Typography variant="caption" color="text.secondary">
                      Allocation reflects plan limits for the managed child services; it is not a live consumption meter.
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>Sensitive values</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Database credentials are generated and stored by the platform. They are never included in this review.
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
        )}

        {activeStep === 3 && (
          <Stack spacing={2}>
            <Box sx={{ textAlign: "center", py: 1 }}>
              {installation?.status === "running" ? (
                <CheckCircleRoundedIcon color="success" sx={{ fontSize: 52 }} />
              ) : installation?.status === "failed" ? (
                <Typography variant="h3" color="error.main">×</Typography>
              ) : installation?.status === "cancelled" ? (
                <Typography variant="h3" color="warning.main">—</Typography>
              ) : (
                <CircularProgress size={46} />
              )}
              <Typography variant="h6" sx={{ fontWeight: 900, mt: 1 }}>
                {isSuccessful ? "Application is ready" : installation?.status === "failed" ? "Deployment failed" : installation?.status === "cancelled" ? "Deployment cancelled" : "Deploying application"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {prettyStage(installation?.stage || "pending")}
              </Typography>
            </Box>

            {installation?.application_url && (
              <Button
                variant="outlined"
                startIcon={<OpenInNewRoundedIcon />}
                href={installation.application_url}
                target="_blank"
                rel="noreferrer"
                sx={{ alignSelf: "center", borderRadius: 1.7 }}
              >
                Open application
              </Button>
            )}

            {installation?.services?.map((service) => (
              <Box key={service.service_id} sx={{ p: 1.4, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Stack direction="row" justifyContent="space-between" spacing={1}>
                  <Typography sx={{ fontWeight: 800 }}>
                    {String(service.key || "Managed service").replace(/[-_]/g, " ")}
                  </Typography>
                  <Chip
                    size="small"
                    color={String(service.status).toLowerCase() === "failed" ? "error" : String(service.status).toLowerCase() === "running" ? "success" : "default"}
                    label={prettyStage(service.status)}
                  />
                </Stack>
                {service.status_message && (
                  <Typography variant="caption" color="text.secondary">{service.status_message}</Typography>
                )}
              </Box>
            ))}

            {installation?.error_message && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>{installation.error_message}</Alert>
            )}

            {!isTerminal && (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                The deployment continues through the normal application deployment engine. You can close this window and return to the installation workspace.
              </Alert>
            )}

            {existingInstallationId && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                An existing installation was found.
              </Alert>
            )}
          </Stack>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
            {error}
            {existingInstallationId && (
              <Button
                size="small"
                sx={{ mt: 1, display: "block" }}
                onClick={() => onOpenInstallation(existingInstallationId)}
              >
                Open existing installation
              </Button>
            )}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.7, gap: 1 }}>
        <Button onClick={onClose} disabled={installing} color="inherit">Close</Button>
        <Box sx={{ flex: 1 }} />

        {activeStep === 0 && (
          <Button
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            disabled={!canAdvanceFromConfigure}
            onClick={() => {
              const validation = validateConfigure();
              if (validation) {
                setError(validation);
                return;
              }
              setError("");
              setActiveStep(1);
            }}
          >
            Resources
          </Button>
        )}

        {activeStep === 1 && (
          <>
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => setActiveStep(0)} disabled={resolveLoading}>
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              disabled={!canAdvanceFromResources}
              onClick={async () => {
                if (await resolvePlan()) setActiveStep(2);
              }}
            >
              Review
            </Button>
          </>
        )}

        {activeStep === 2 && (
          <>
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => setActiveStep(1)} disabled={installing}>
              Back
            </Button>
            <Button
              variant="contained"
              onClick={createInstallation}
              disabled={installing || !resolved}
              startIcon={installing ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {installing ? "Starting…" : "Deploy application"}
            </Button>
          </>
        )}

        {activeStep === 3 && isTerminal && installation?.id && (
          <Button
            variant="contained"
            onClick={() => onOpenInstallation(String(installation.id))}
            disabled={installing}
          >
            Open workspace
          </Button>
        )}

        {activeStep === 3 && !isTerminal && installation?.id && (
          <Button color="warning" variant="outlined" onClick={cancelInstallation}>
            Cancel deployment
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
