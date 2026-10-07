import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import MiscellaneousServicesRoundedIcon from "@mui/icons-material/MiscellaneousServicesRounded";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate, useParams } from "react-router-dom";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const ROOT = API_ROOT + "/api/application-catalog";

function pretty(value) {
  const key = String(value || "pending").toLowerCase().trim();
  const labels = {
    pending: "Waiting to start",
    dependency_resolution: "Preparing",
    dispatching_services: "Starting services",
    preparing: "Preparing",
    build: "Building",
    building: "Building",
    database: "Setting up the database",
    runtime: "Starting the app",
    health: "Checking the app",
    readiness: "Checking the app",
    finished: "Finishing up",
    application_ready: "Ready",
    cancellation_requested: "Stopping safely",
    cancellation_cleanup: "Cleaning up",
    cancelled: "Cancelled",
    failed: "Failed",
    running: "Running",
    succeeded: "Ready",
  };
  if (labels[key]) return labels[key];
  const raw = key.replace(/_/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Waiting to start";
}

function statusColor(status) {
  const value = String(status || "").toLowerCase();
  if (value === "running") return "success";
  if (value === "failed") return "error";
  if (value === "cancelled") return "warning";
  return "default";
}

export default function ReadyAppInstallation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [installation, setInstallation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [polling, setPolling] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cleanupDeletePending, setCleanupDeletePending] = useState(false);
  const [actionDialog, setActionDialog] = useState(null);
  const [serviceMetrics, setServiceMetrics] = useState({});
  const [copiedHost, setCopiedHost] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: ROOT + "/installations/" + encodeURIComponent(id) + "/",
        });
        if (!mounted) return;
        setInstallation(response.data);
        const nextStatus = String(response.data?.status || "").toLowerCase();
        const nextStage = String(response.data?.stage || "").toLowerCase();
        const cleanupPending =
          nextStage === "deletion_pending" ||
          response.data?.error_code === "APPLICATION_DELETION_PENDING" ||
          (nextStatus === "cancelled" &&
            Array.isArray(response.data?.services) &&
            response.data.services.length > 0);
        setCleanupDeletePending(cleanupPending);
        setPolling(
          !cleanupPending &&
          (!["running", "failed"].includes(nextStatus) &&
            !(nextStatus === "cancelled" && !cleanupPending))
        );
      } catch (err) {
        if (!mounted) return;
        setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Installation could not be loaded."));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!cleanupDeletePending || !id) return undefined;
    let active = true;

    const refreshDeleteStatus = async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: ROOT + "/installations/" + encodeURIComponent(id) + "/",
        });
        if (!active) return;

        const current = response.data;
        setInstallation(current);

        // Deletion is a durable backend intent. Do not issue another DELETE
        // request on every poll; that used to refresh updated_at continuously
        // and could prevent the backend reconciliation fallback from detecting
        // a genuinely stuck deletion.
        const stage = String(current?.stage || "").toLowerCase();
        const deletionPending =
          stage === "deletion_pending" ||
          current?.error_code === "APPLICATION_DELETION_PENDING";

        if (!deletionPending) {
          const status = String(current?.status || "").toLowerCase();
          const services = Array.isArray(current?.services) ? current.services : [];
          if (status === "cancelled" && services.length === 0) {
            setCleanupDeletePending(false);
            navigate("/dashboard/ready-apps/installations");
          }
        }
      } catch (err) {
        if (!active) return;
        const statusCode = err?.response?.status;
        if (statusCode === 404) {
          setCleanupDeletePending(false);
          navigate("/dashboard/ready-apps/installations");
          return;
        }
        setError(
          String(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              "Cleanup status could not be refreshed."
          )
        );
      }
    };

    refreshDeleteStatus();
    const timer = window.setInterval(refreshDeleteStatus, 2000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [cleanupDeletePending, id, navigate]);


  useEffect(() => {
    if (!polling || !id) return undefined;
    let mounted = true;
    const refresh = async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: ROOT + "/installations/" + encodeURIComponent(id) + "/",
        });
        if (!mounted) return;
        setInstallation(response.data);
        const nextStatus = String(response.data?.status || "").toLowerCase();
        const nextStage = String(response.data?.stage || "").toLowerCase();
        const deletionPending =
          nextStage === "deletion_pending" ||
          response.data?.error_code === "APPLICATION_DELETION_PENDING";
        const cleanupPending =
          deletionPending ||
          (nextStatus === "cancelled" &&
            Array.isArray(response.data?.services) &&
            response.data.services.length > 0);
        setCleanupDeletePending(cleanupPending);
        if (cleanupPending || ["running", "failed"].includes(nextStatus)) {
          setPolling(false);
        }
      } catch (err) {
        if (mounted) setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Status refresh failed."));
      }
    };
    const timer = window.setInterval(refresh, 2500);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [id, polling]);

  const cancel = async () => {
    setCancelling(true);
    setError("");
    setActionDialog(null);
    try {
      const response = await apiRequest({
        method: "POST",
        url: ROOT + "/installations/" + encodeURIComponent(id) + "/cancel/",
        data: {},
      });
      setInstallation(response.data);
      setPolling(true);
    } catch (err) {
      setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Cancellation failed."));
    } finally {
      setCancelling(false);
    }
  };

  const deleteInstallation = async () => {
    setDeleting(true);
    setError("");
    setActionDialog(null);
    try {
      const response = await apiRequest({
        method: "DELETE",
        url: ROOT + "/installations/" + encodeURIComponent(id) + "/",
      });
      if (response.status === 202 || response.data?.code === "application_cleanup_pending") {
        setCleanupDeletePending(true);
        setDeleting(false);
        setError("");
        return;
      }
      navigate("/dashboard/ready-apps/installations");
    } catch (err) {
      if (err?.response?.status === 404) {
        navigate("/dashboard/ready-apps/installations");
        return;
      }
      setError(String(err?.response?.data?.detail || err?.response?.data?.error || "The App could not be deleted."));
    } finally {
      setDeleting(false);
    }
  };

  const stage = String(installation?.stage || "").toLowerCase();
  const deletionPending =
    cleanupDeletePending ||
    stage === "deletion_pending" ||
    installation?.error_code === "APPLICATION_DELETION_PENDING";
  const status = String(installation?.status || "pending").toLowerCase();
  const publicHost = String(
    installation?.application_host ||
      installation?.application_url?.replace(/^https?:\/\//i, "").replace(/\/.*$/, "") ||
      ""
  ).trim();
  const resources = installation?.resource_summary || {};
  const serviceRows = installation?.services || [];
  const serviceMetricsKey = serviceRows.map((item) => String(item?.service_id || "")).filter(Boolean).join(",");

  const refreshServiceMetrics = useCallback(async (rows) => {
    const validRows = Array.isArray(rows) ? rows.filter((item) => item?.service_id) : [];
    if (!validRows.length) return;
    const results = await Promise.allSettled(
      validRows.map(async (item) => {
        const response = await apiRequest({
          method: "POST",
          url: API_ROOT + "/api/services/service_status/",
          data: { service_id: item.service_id },
        });
        return {
          id: String(item.service_id),
          ...(response?.data || {}),
        };
      })
    );
    setServiceMetrics((previous) => {
      const next = { ...previous };
      for (const result of results) {
        if (result.status === "fulfilled") next[result.value.id] = result.value;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!serviceRows.length) return undefined;
    refreshServiceMetrics(serviceRows);
    if (status !== "running" || deletionPending) return undefined;
    const timer = window.setInterval(() => refreshServiceMetrics(serviceRows), 3000);
    return () => window.clearInterval(timer);
  }, [serviceMetricsKey, status, deletionPending, refreshServiceMetrics]);

  const copyPublicHost = async () => {
    if (!publicHost) return;
    try {
      await navigator.clipboard.writeText(publicHost);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 1600);
    } catch {
      setCopiedHost(false);
    }
  };

  if (loading) {
    return <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  }

  if (!installation) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/dashboard/ready-apps")}>Apps</Button>
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error || "Installation not found."}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate("/dashboard/ready-apps/installations")}
        sx={{ mb: 2 }}
      >
        Deployed Apps
      </Button>

      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900 }}>
                App
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {installation.name}
              </Typography>
              <Stack direction="row" spacing={0.8} flexWrap="wrap" sx={{ mt: 1 }}>
                <Chip size="small" label={pretty(installation.status)} color={statusColor(installation.status)} />
                {installation.stage && <Chip size="small" variant="outlined" label={pretty(installation.stage)} />}
                <Chip size="small" variant="outlined" label={"v" + installation.software_version} />
              </Stack>
            </Box>

            {status === "running" && !deletionPending && publicHost && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.2,
                  minWidth: { md: 360 },
                  borderRadius: 2,
                  bgcolor: "action.hover",
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35 }}>
                  Application domain
                </Typography>
                <Stack direction="row" spacing={0.6} alignItems="center">
                  <Typography
                    variant="body2"
                    sx={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontWeight: 700,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {publicHost}
                  </Typography>
                  <Button
                    size="small"
                    onClick={copyPublicHost}
                    startIcon={<ContentCopyRoundedIcon />}
                    sx={{ minWidth: 0, flexShrink: 0 }}
                  >
                    {copiedHost ? "Copied" : "Copy"}
                  </Button>
                </Stack>
              </Paper>
            )}

            {installation.application_url && status === "running" && !deletionPending && (
              <Button
                variant="contained"
                startIcon={<OpenInNewRoundedIcon />}
                href={installation.application_url}
                target="_blank"
                rel="noreferrer"
                sx={{ borderRadius: 1.7, alignSelf: { xs: "stretch", md: "center" } }}
              >
                Open application
              </Button>
            )}
          </Stack>

          {!deletionPending && !["running", "failed", "cancelled"].includes(status) && (
            <Box sx={{ mt: 2 }}>
              <LinearDeploymentState stage={installation.stage} />
            </Box>
          )}

          {deletionPending ? (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              This installation is being cleaned up and will disappear from Deployed Apps when all managed resources are safely removed.
            </Alert>
          ) : null}

          {installation.error_message && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{installation.error_message}</Alert>
          )}
          {error && <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>}
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <SecurityRoundedIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>About this app</Typography>
                </Stack>
                <Alert
                  severity="info"
                  icon={<SecurityRoundedIcon />}
                  sx={{ mb: 1.8, borderRadius: 2 }}
                >
                  This app is managed as one deployment. Changes to its services are handled here so nothing gets out of sync.
                </Alert>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <MiscellaneousServicesRoundedIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Included services</Typography>
                </Stack>
                <Stack spacing={1}>
                  {(installation.services || []).map((service) => (
                    <Box key={service.service_id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography sx={{ fontWeight: 850 }}>
                            {service.service_name || String(service.key || "Managed service").replace(/[-_]/g, " ")}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {service.service_name}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Chip size="small" color={statusColor(service.status)} label={pretty(service.status)} />
                          <Button
                            size="small"
                            onClick={() => navigate("/dashboard/services/" + service.service_id)}
                            sx={{ borderRadius: 1.4 }}
                          >
                            View details
                          </Button>
                        </Stack>
                      </Stack>
                      {service.service_host ? (
                        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}
                          >
                            {service.service_host}
                          </Typography>
                          {service.public_endpoints?.[0]?.url ? (
                            <Button
                              size="small"
                              href={service.public_endpoints[0].url}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 15 }} />}
                              sx={{ minWidth: 0, px: 0.6 }}
                            >
                              Open
                            </Button>
                          ) : null}
                        </Stack>
                      ) : null}
                      {(() => {
                        const metrics = serviceMetrics[String(service.service_id)] || {};
                        const limits = service.resource_limits || {};
                        const liveCpu = metrics.cpu == null ? null : Number(metrics.cpu);
                        const liveRam = metrics.ram == null ? null : Number(metrics.ram);
                        return (
                          <Box sx={{ mt: 1.1 }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                              <Metric
                                icon={<ComputerRoundedIcon sx={{ fontSize: 17 }} />}
                                label="Limit"
                                value={limits.cpu_vcpu == null ? "—" : limits.cpu_vcpu + " vCPU"}
                              />
                              <Metric
                                icon={<MemoryRoundedIcon sx={{ fontSize: 17 }} />}
                                label="RAM limit"
                                value={limits.ram_mb == null ? "—" : limits.ram_mb + " MB"}
                              />
                              <Metric
                                icon={<StorageRoundedIcon sx={{ fontSize: 17 }} />}
                                label="Storage"
                                value={limits.storage_mb == null ? "—" : limits.storage_mb + " MB"}
                              />
                            </Stack>
                            {metrics.metrics_available !== false && (liveCpu != null || liveRam != null) ? (
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 0.9 }}>
                                {liveCpu != null ? <LiveUsage label="CPU" value={liveCpu} /> : null}
                                {liveRam != null ? <LiveUsage label="RAM" value={liveRam} /> : null}
                              </Stack>
                            ) : status === "running" ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.8 }}>
                                Live resource metrics are temporarily unavailable.
                              </Typography>
                            ) : null}
                          </Box>
                        );
                      })()}
                      {service.status_message && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6 }}>
                          {service.status_message}
                        </Typography>
                      )}
                      {service.error_message && (
                        <Typography variant="caption" color="error.main" sx={{ display: "block", mt: 0.6 }}>
                          {service.error_message}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Resources</Typography>
                <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                  <Metric icon={<ComputerRoundedIcon />} label="CPU" value={(resources.cpu_vcpu ?? "—") + " vCPU"} />
                  <Metric icon={<MemoryRoundedIcon />} label="RAM" value={(resources.ram_mb ?? "—") + " MB"} />
                  <Metric icon={<StorageRoundedIcon />} label="Storage" value={(resources.storage_mb ?? "—") + " MB"} />
                </Stack>
                <Divider sx={{ my: 1.7 }} />
                <Typography variant="caption" color="text.secondary">
                  Plan allocation for this app.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {status === "running" && (
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            Deployment completed successfully. The application URL is ready to use.
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.1} alignItems={{ xs: "stretch", sm: "center" }}>
          {!["running", "failed", "cancelled"].includes(status) && (
            <Button
              color="warning"
              variant="outlined"
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setActionDialog("cancel")}
              disabled={cancelling || deleting}
              sx={{ alignSelf: "flex-start", borderRadius: 1.7 }}
            >
              {cancelling ? "Cancelling…" : "Cancel deployment"}
            </Button>
          )}

          {["running", "failed", "cancelled"].includes(status) && (
            <Button
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={() => setActionDialog("delete")}
              disabled={deleting || cancelling || cleanupDeletePending}
              sx={{ alignSelf: "flex-start", borderRadius: 1.7 }}
            >
              {deleting ? "Deleting…" : cleanupDeletePending ? "Cleaning up…" : "Delete installation"}
            </Button>
          )}
          {cleanupDeletePending && (
            <Typography variant="caption" color="text.secondary">
              Cleaning up the cancelled app. It will be removed automatically when its resources are safe to delete.
            </Typography>
          )}
        </Stack>

        <Dialog
          open={actionDialog === "cancel"}
          onClose={() => !cancelling && setActionDialog(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 900 }}>Cancel this App?</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              The deployment will stop as safely as possible. Any app resources created for this installation are cleaned up by the platform, and the installation remains here as history until you delete it.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setActionDialog(null)} disabled={cancelling}>Keep deployment</Button>
            <Button color="warning" variant="contained" onClick={cancel} disabled={cancelling}>
              Cancel and clean up
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={actionDialog === "delete"}
          onClose={() => !deleting && setActionDialog(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 900 }}>Delete this App installation?</DialogTitle>
          <DialogContent>
            <Typography color="text.secondary">
              This removes the installation record and any remaining managed resources. This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setActionDialog(null)} disabled={deleting}>Keep installation</Button>
            <Button color="error" variant="contained" onClick={deleteInstallation} disabled={deleting}>
              Delete installation
            </Button>
          </DialogActions>
        </Dialog>
      </Stack>
    </Container>
  );
}

function LiveUsage({ label, value }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <Box sx={{ minWidth: { sm: 180 }, flex: 1 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.35 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          Live {label}
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 800 }}>
          {percent.toFixed(1)}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{ height: 6, borderRadius: 3 }}
      />
    </Box>
  );
}

function Metric({ icon, label, value }) {
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

function LinearDeploymentState({ stage }) {
  const states = ["queued", "preparing", "database", "application", "health", "ready"];
  const current = String(stage || "queued").toLowerCase();
  const index = current.includes("health") ? 4 : states.findIndex((item) => current.includes(item));
  const percent = Math.max(8, Math.min(95, ((index < 0 ? 0 : index + 1) / states.length) * 100));
  return (
    <Stack spacing={0.6}>
      <LinearProgress variant="determinate" value={percent} />
      <Typography variant="caption" color="text.secondary">
        {pretty(stage || "queued")} · status refreshes automatically
      </Typography>
    </Stack>
  );
}
