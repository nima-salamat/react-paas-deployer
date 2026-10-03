import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import MiscellaneousServicesRoundedIcon from "@mui/icons-material/MiscellaneousServicesRounded";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate, useParams } from "react-router-dom";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const ROOT = API_ROOT + "/api/application-catalog";

function pretty(value) {
  const raw = String(value || "pending").replace(/_/g, " ").trim();
  return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Pending";
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
        const terminal = ["running", "failed", "cancelled"].includes(
          String(response.data?.status || "").toLowerCase()
        );
        setPolling(!terminal);
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
        const terminal = ["running", "failed", "cancelled"].includes(
          String(response.data?.status || "").toLowerCase()
        );
        if (terminal) setPolling(false);
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

  if (loading) {
    return <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  }

  if (!installation) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/dashboard/ready-apps")}>Ready Apps</Button>
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error || "Installation not found."}</Alert>
      </Container>
    );
  }

  const status = String(installation.status || "pending").toLowerCase();
  const resources = installation.resource_summary || {};

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={() => navigate("/dashboard/ready-apps")}
        sx={{ mb: 2 }}
      >
        Ready Apps
      </Button>

      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" sx={{ fontWeight: 900 }}>
                Application installation
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

            {installation.application_url && status === "running" && (
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

          {!["running", "failed", "cancelled"].includes(status) && (
            <Box sx={{ mt: 2 }}>
              <LinearDeploymentState stage={installation.stage} />
            </Box>
          )}

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
                  <MiscellaneousServicesRoundedIcon color="primary" />
                  <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Managed services</Typography>
                </Stack>
                <Stack spacing={1}>
                  {(installation.services || []).map((service) => (
                    <Box key={service.service_id} sx={{ p: 1.5, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                        <Box>
                          <Typography sx={{ fontWeight: 850 }}>
                            {String(service.key || "Managed service").replace(/[-_]/g, " ")}
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
                            Open service
                          </Button>
                        </Stack>
                      </Stack>
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

          <Grid item xs={12} md={5}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>Resource allocation</Typography>
                <Stack spacing={1.2} sx={{ mt: 1.5 }}>
                  <Metric icon={<ComputerRoundedIcon />} label="CPU" value={(resources.cpu_vcpu ?? "—") + " vCPU"} />
                  <Metric icon={<MemoryRoundedIcon />} label="RAM" value={(resources.ram_mb ?? "—") + " MB"} />
                  <Metric icon={<StorageRoundedIcon />} label="Storage" value={(resources.storage_mb ?? "—") + " MB"} />
                </Stack>
                <Divider sx={{ my: 1.7 }} />
                <Typography variant="caption" color="text.secondary">
                  These figures describe the selected plan allocation, not current runtime usage.
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

        {!["running", "failed", "cancelled"].includes(status) && (
          <Button
            color="warning"
            variant="outlined"
            startIcon={<CancelOutlinedIcon />}
            onClick={cancel}
            disabled={cancelling}
            sx={{ alignSelf: "flex-start", borderRadius: 1.7 }}
          >
            {cancelling ? "Cancelling…" : "Cancel deployment"}
          </Button>
        )}
      </Stack>
    </Container>
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
