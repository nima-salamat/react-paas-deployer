import React, { useEffect, useMemo, useState } from "react";
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
import { Link as RouterLink } from "react-router-dom";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function AppLogo({ app, size = 52 }) {
  const logo = String(app?.logo || "");
  if (/^https?:\/\//i.test(logo) || /^\//.test(logo)) {
    return (
      <Box
        component="img"
        src={logo}
        alt=""
        sx={{ width: size, height: size, objectFit: "contain", borderRadius: 2.5 }}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    );
  }
  const initial = String(app?.name || "?").trim().charAt(0).toUpperCase();
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2.5,
        display: "grid",
        placeItems: "center",
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "divider",
        color: "primary.main",
        fontSize: Math.round(size * 0.42),
        fontWeight: 900,
      }}
    >
      {initial || <AppsOutlinedIcon />}
    </Box>
  );
}

export default function ReadyApps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiRequest({ method: "GET", url: CATALOG_ROOT + "/apps/" });
        if (!mounted) return;
        setApps(normalizeList(response.data));
      } catch (err) {
        if (!mounted) return;
        setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Ready Apps could not be loaded."));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const visibleApps = useMemo(
    () =>
      [...apps].sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      }),
    [apps]
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
      <Stack spacing={0.7} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.1} alignItems="center">
          <AppsOutlinedIcon color="primary" />
          <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>
            Ready Apps
          </Typography>
        </Stack>
        <Typography color="text.secondary" sx={{ maxWidth: 760 }}>
          Deploy curated applications with platform-managed services, storage, networking, and health checks.
        </Typography>
      </Stack>

      {loading ? (
        <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      ) : visibleApps.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              No Ready Apps are available
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              The platform catalog currently has no applications published for deployment.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {visibleApps.map((app) => (
            <Grid item key={app.id} xs={12} sm={6} lg={4}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: 4,
                    borderColor: "primary.main",
                  },
                }}
              >
                <CardActionArea
                  component={RouterLink}
                  to={"/dashboard/ready-apps/" + encodeURIComponent(app.id)}
                  sx={{ height: "auto" }}
                >
                  <CardContent sx={{ p: 2.25, display: "flex", flexDirection: "column" }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <AppLogo app={app} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap">
                          <Typography component="h2" variant="subtitle1" sx={{ fontWeight: 900 }}>
                            {app.name}
                          </Typography>
                          {app.featured && <Chip size="small" color="primary" label="Featured" />}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {app.category} · {app.software_version}
                        </Typography>
                      </Box>
                    </Stack>

                    <Typography color="text.secondary" sx={{ mt: 1.7, lineHeight: 1.55 }}>
                      {app.description}
                    </Typography>

                    <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                      {(app.features || []).slice(0, 3).map((feature) => (
                        <Chip key={feature} size="small" variant="outlined" label={feature} />
                      ))}
                    </Stack>

                    <Box sx={{ flex: 1 }} />
                  </CardContent>
                </CardActionArea>
                <Box sx={{ px: 2.25, pb: 2.25 }}>
                  <Button
                    fullWidth
                    component={RouterLink}
                    to={"/dashboard/ready-apps/" + encodeURIComponent(app.id)}
                    sx={{ borderRadius: 1.7, fontWeight: 800 }}
                    endIcon={<ArrowForwardRoundedIcon />}
                  >
                    Deploy
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && !error && visibleApps.length > 0 && (
        <Box sx={{ mt: 3, p: 2, borderRadius: 2.5, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "flex-start", sm: "center" }}>
            <RocketLaunchOutlinedIcon color="primary" />
            <Typography variant="body2" color="text.secondary">
              Ready Apps are curated by the platform. Arbitrary Docker Compose files are not exposed through this workflow.
            </Typography>
          </Stack>
        </Box>
      )}
    </Container>
  );
}
