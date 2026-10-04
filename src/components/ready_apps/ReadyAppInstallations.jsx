import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT =
  "https://" +
  String(import.meta.env.VITE_API_BASE || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
const ROOT = API_ROOT + "/api/application-catalog";

const TERMINAL = new Set(["running", "failed", "cancelled"]);

function listFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

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

function StatusSummary({ installation }) {
  const status = String(installation?.status || "").toLowerCase();
  const services = installation?.services || [];
  const failed = services.filter((item) => ["failed", "rolled_back"].includes(String(item.status || "").toLowerCase())).length;
  const succeeded = services.filter((item) => String(item.status || "").toLowerCase() === "succeeded").length;
  const running = services.filter((item) => ["running", "pending"].includes(String(item.status || "").toLowerCase())).length;

  if (status === "running") {
    return (
      <Stack direction="row" spacing={0.6} alignItems="center">
        <CheckCircleRoundedIcon sx={{ fontSize: 17, color: "success.main" }} />
        <Typography variant="caption" color="text.secondary">
          {services.length} managed service{services.length === 1 ? "" : "s"} ready
        </Typography>
      </Stack>
    );
  }
  if (failed) {
    return (
      <Stack direction="row" spacing={0.6} alignItems="center">
        <ErrorOutlineRoundedIcon sx={{ fontSize: 17, color: "error.main" }} />
        <Typography variant="caption" color="text.secondary">
          {failed} service{failed === 1 ? "" : "s"} failed
        </Typography>
      </Stack>
    );
  }
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <AccessTimeRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
      <Typography variant="caption" color="text.secondary">
        {succeeded ? succeeded + " completed" : running + " pending"} · status refreshes automatically
      </Typography>
    </Stack>
  );
}

function InstallationCard({ installation, onOpen }) {
  const status = String(installation?.status || "pending").toLowerCase();
  const services = installation?.services || [];
  const url = installation?.application_url || "";

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderRadius: 3,
        transition: "transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 4,
          borderColor: "primary.main",
        },
      }}
    >
      <CardActionArea
        component={RouterLink}
        to={"/dashboard/ready-apps/installations/" + encodeURIComponent(installation.id)}
      >
        <CardContent sx={{ p: 2.25 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1.5}>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                color="primary.main"
                sx={{ fontWeight: 900, letterSpacing: "0.06em" }}
              >
                {installation.catalog_id || "Ready App"}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, mt: -0.3 }} noWrap>
                {installation.name}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={pretty(status)}
              color={statusColor(status)}
              sx={{ fontWeight: 800, flexShrink: 0 }}
            />
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
            v{installation.software_version || installation.definition_version || "unknown"} · {services.length} managed service{services.length === 1 ? "" : "s"}
          </Typography>

          <Box sx={{ mt: 1.5 }}>
            <StatusSummary installation={installation} />
          </Box>

          {url && status === "running" && (
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ mt: 1.3, minWidth: 0 }}>
              <LaunchRoundedIcon sx={{ fontSize: 16, color: "primary.main" }} />
              <Typography
                variant="caption"
                color="primary.main"
                sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {url.replace(/^https?:\/\//, "")}
              </Typography>
            </Stack>
          )}
        </CardContent>
      </CardActionArea>

      <Box sx={{ px: 2.25, pb: 2 }}>
        <Button
          fullWidth
          component={RouterLink}
          to={"/dashboard/ready-apps/installations/" + encodeURIComponent(installation.id)}
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{ borderRadius: 1.7, fontWeight: 800 }}
        >
          Manage application
        </Button>
      </Box>
    </Card>
  );
}

export default function ReadyAppInstallations() {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        method: "GET",
        url: ROOT + "/installations/",
      });
      setInstallations(listFrom(response.data));
    } catch (err) {
      setError(
        String(
          err?.response?.data?.detail ||
            err?.response?.data?.error ||
            "Ready App installations could not be loaded."
        )
      );
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeInstallations = useMemo(
    () => installations.filter((item) => !TERMINAL.has(String(item?.status || "").toLowerCase())),
    [installations]
  );

  useEffect(() => {
    if (!activeInstallations.length) return undefined;
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [activeInstallations.length, load]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.1} alignItems="center">
            <AppsOutlinedIcon color="primary" />
            <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>
              My Ready Apps
            </Typography>
          </Stack>
          <Typography color="text.secondary" sx={{ mt: 0.55, maxWidth: 760 }}>
            Manage your curated application installations, their managed services, deployment state, and platform resources from one place.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button
            component={RouterLink}
            to="/dashboard/ready-apps"
            variant="outlined"
            sx={{ borderRadius: 1.8, fontWeight: 800 }}
          >
            Browse catalog
          </Button>
          <Button
            component={RouterLink}
            to="/dashboard/ready-apps"
            variant="contained"
            startIcon={<AddRoundedIcon />}
            sx={{ borderRadius: 1.8, fontWeight: 850 }}
          >
            Deploy Ready App
          </Button>
        </Stack>
      </Stack>

      {refreshing && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.2 }}>
          Updating installation status…
        </Typography>
      )}

      {loading ? (
        <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert
          severity="error"
          sx={{ borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => load()}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : installations.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ py: 8, textAlign: "center" }}>
            <AppsOutlinedIcon sx={{ fontSize: 42, color: "text.disabled" }} />
            <Typography variant="h6" sx={{ fontWeight: 850, mt: 1 }}>
              No Ready Apps yet
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.7 }}>
              Deploy a curated application and it will appear here as a managed installation.
            </Typography>
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps"
              variant="contained"
              sx={{ mt: 2, borderRadius: 1.8, fontWeight: 850 }}
            >
              Browse Ready Apps
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {installations.map((installation) => (
            <Grid item key={installation.id} xs={12} sm={6} lg={4}>
              <InstallationCard installation={installation} onOpen={navigate} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
