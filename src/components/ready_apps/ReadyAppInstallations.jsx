import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Container,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { Link as RouterLink } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT =
  "https://" +
  String(import.meta.env.VITE_API_BASE || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
const ROOT = API_ROOT + "/api/application-catalog";
const TERMINAL = new Set(["running", "failed", "cancelled"]);

function isDeletionPending(installation) {
  return (
    String(installation?.stage || "").toLowerCase() === "deletion_pending" ||
    installation?.error_code === "APPLICATION_DELETION_PENDING"
  );
}

function listFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  return [];
}

function statusLabel(status, deletionPending) {
  if (deletionPending) return "Cleaning up";
  const value = String(status || "pending").toLowerCase();
  if (value === "running") return "Running";
  if (value === "failed") return "Failed";
  if (value === "cancelled") return "Cancelled";
  return "Deploying";
}

function statusTone(status, deletionPending) {
  if (deletionPending) return "warning";
  const value = String(status || "").toLowerCase();
  if (value === "running") return "success";
  if (value === "failed") return "error";
  return "primary";
}

function StatusIcon({ status, deleting }) {
  if (deleting) return <HourglassTopRoundedIcon sx={{ fontSize: 15 }} />;
  if (status === "running") return <CheckCircleRoundedIcon sx={{ fontSize: 15 }} />;
  if (status === "failed") return <ErrorOutlineRoundedIcon sx={{ fontSize: 15 }} />;
  return <HourglassTopRoundedIcon sx={{ fontSize: 15 }} />;
}

function AppMark({ app }) {
  const [failed, setFailed] = useState(false);
  const logo = String(app?.logo || "");
  return (
    <Box
      sx={(theme) => ({
        width: 54,
        height: 54,
        borderRadius: 2.2,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        flexShrink: 0,
        color: "primary.main",
        bgcolor:
          theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(81,129,255,.2), rgba(126,87,255,.11))"
            : "linear-gradient(145deg, rgba(81,129,255,.08), rgba(126,87,255,.05))",
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, .18),
        boxShadow: "0 8px 24px rgba(0,0,0,.07)",
      })}
    >
      {!failed && (/^https?:\/\//i.test(logo) || /^\//.test(logo)) ? (
        <Box
          component="img"
          src={logo}
          alt=""
          onError={() => setFailed(true)}
          sx={{ width: "68%", height: "68%", objectFit: "contain" }}
        />
      ) : (
        <AppsRoundedIcon sx={{ fontSize: 25 }} />
      )}
    </Box>
  );
}

function InstallationCard({ installation, app }) {
  const status = String(installation?.status || "pending").toLowerCase();
  const deleting =
    String(installation?.stage || "").toLowerCase() === "deletion_pending" ||
    installation?.error_code === "APPLICATION_DELETION_PENDING";
  const host =
    installation?.application_url
      ?.replace(/^https?:\/\//i, "")
      .replace(/\/$/, "") || "";

  const tone = statusTone(status, deleting);

  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 2.5,
        overflow: "hidden",
        borderColor: alpha(theme.palette.divider, .86),
        transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-3px)",
          borderColor: alpha(theme.palette.primary.main, .35),
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 18px 50px rgba(0,0,0,.22)"
              : "0 18px 50px rgba(26,39,73,.09)",
        },
      })}
    >
      <CardActionArea
        component={RouterLink}
        to={"/dashboard/ready-apps/installations/" + encodeURIComponent(installation.id)}
      >
        <Box sx={{ p: { xs: 2.1, md: 2.4 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <AppMark app={app} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}
              >
                {installation.catalog_id || "App"}
              </Typography>
              <Typography sx={{ mt: .25, fontWeight: 900, fontSize: 18 }} noWrap>
                {installation.name}
              </Typography>
            </Box>

            <Box
              sx={(theme) => ({
                display: "inline-flex",
                alignItems: "center",
                gap: .45,
                px: 1,
                py: .55,
                borderRadius: 999,
                color: theme.palette[tone]?.main || theme.palette.primary.main,
                bgcolor: alpha(theme.palette[tone]?.main || theme.palette.primary.main, .1),
                fontSize: 11,
                fontWeight: 850,
                flexShrink: 0,
              })}
            >
              <StatusIcon status={status} deleting={deleting} />
              {statusLabel(status, deleting)}
            </Box>
          </Stack>

          {host && status === "running" && !deleting ? (
            <Stack direction="row" spacing={.6} alignItems="center" sx={{ mt: 2, minWidth: 0 }}>
              <OpenInNewRoundedIcon sx={{ fontSize: 16, color: "primary.main", flexShrink: 0 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {host}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {installation.software_version ? `v${installation.software_version}` : "Managed app"}
            </Typography>
          )}
        </Box>
      </CardActionArea>

      <Box sx={{ px: 2.1, pb: 1.8 }}>
        <Button
          component={RouterLink}
          to={"/dashboard/ready-apps/installations/" + encodeURIComponent(installation.id)}
          endIcon={<ArrowForwardRoundedIcon />}
          sx={{ fontWeight: 850, borderRadius: 2, px: .7 }}
        >
          Open
        </Button>
      </Box>
    </Card>
  );
}

export default function ReadyAppInstallations() {
  const [installations, setInstallations] = useState([]);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [installationResponse, appResponse] = await Promise.all([
        apiRequest({ method: "GET", url: ROOT + "/installations/" }),
        apiRequest({ method: "GET", url: ROOT + "/apps/" }),
      ]);
      if (!mountedRef.current) return;
      setInstallations(listFrom(installationResponse.data));
      setApps(listFrom(appResponse.data));
    } catch (err) {
      if (mountedRef.current) {
        setError(
          String(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              "Couldn't load deployed apps."
          )
        );
      }
    } finally {
      if (mountedRef.current) {
        if (background) setRefreshing(false);
        else setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(
    () =>
      installations.some((item) => {
        const status = String(item?.status || "").toLowerCase();
        return !TERMINAL.has(status) || String(item?.stage || "").toLowerCase() === "deletion_pending";
      }),
    [installations]
  );

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  useEffect(() => {
    if (!error || loading || refreshing) return undefined;
    const timer = window.setTimeout(() => load(true), 12000);
    return () => window.clearTimeout(timer);
  }, [error, loading, refreshing, load]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4.5 } }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "flex-end" }}
          spacing={2}
        >
          <Box>
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps"
              startIcon={<ArrowBackRoundedIcon />}
              sx={{ px: 0, mb: 1, fontWeight: 800 }}
            >
              App Library
            </Button>
            <Typography
              component="h1"
              sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 950, lineHeight: 1.05, letterSpacing: "-.045em" }}
            >
              Deployed Apps
            </Typography>
            {refreshing && (
              <Typography variant="caption" color="text.secondary">
                Updating…
              </Typography>
            )}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => load(true)}
              disabled={loading || refreshing}
              sx={{ borderRadius: 2, px: 1.5, py: 1, fontWeight: 800 }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              sx={{ borderRadius: 2, px: 1.7, py: 1, fontWeight: 850 }}
            >
              Install app
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert
            severity="error"
            sx={{ borderRadius: 2.2 }}
            action={<Button color="inherit" size="small" onClick={() => load(true)} disabled={loading || refreshing}>Retry</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" },
              gap: 2,
            }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} variant="outlined" sx={{ borderRadius: 2.5, p: 2.4 }}>
                <Stack spacing={1.5}>
                  <Skeleton variant="rounded" width={54} height={54} />
                  <Skeleton variant="rounded" width="60%" height={26} />
                  <Skeleton variant="rounded" width="72%" height={18} />
                </Stack>
              </Card>
            ))}
          </Box>
        ) : installations.length === 0 && error ? (
          <Card variant="outlined" sx={{ borderRadius: 2.5, p: { xs: 3.5, md: 5.5 }, textAlign: "center" }}>
            <AppsRoundedIcon sx={{ fontSize: 42, color: "text.disabled" }} />
            <Typography sx={{ mt: 1.4, fontWeight: 900 }}>Deployed apps unavailable</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>We couldn’t retrieve your installations.</Typography>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => load(true)} disabled={refreshing} sx={{ mt: 2, borderRadius: 2 }}>Try again</Button>
          </Card>
        ) : installations.length === 0 ? (
          <Card
            variant="outlined"
            sx={{ borderRadius: 2.5, p: { xs: 4, md: 6 }, textAlign: "center" }}
          >
            <AppsRoundedIcon sx={{ fontSize: 44, color: "text.disabled" }} />
            <Typography sx={{ mt: 1.5, fontWeight: 900, fontSize: 19 }}>
              Nothing deployed yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
              Choose an app from the library to get started.
            </Typography>
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps"
              variant="contained"
              sx={{ mt: 2, borderRadius: 2, fontWeight: 850 }}
            >
              Browse apps
            </Button>
          </Card>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" },
              gap: 2,
            }}
          >
            {installations.map((installation) => (
              <InstallationCard
                key={installation.id}
                installation={installation}
                app={apps.find((item) => String(item?.id) === String(installation?.catalog_id))}
              />
            ))}
          </Box>
        )}
      </Stack>
    </Container>
  );
}
