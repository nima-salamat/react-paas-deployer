import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate, useParams } from "react-router-dom";
import ReadyAppWizard from "./ReadyAppWizard.jsx";

const API_ROOT = "https://" + String(import.meta.env.VITE_API_BASE || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";

function AppLogo({ app, size = 72 }) {
  const logo = String(app?.logo || "");
  if (/^https?:\/\//i.test(logo) || /^\//.test(logo)) {
    return (
      <Box
        component="img"
        src={logo}
        alt=""
        sx={{ width: size, height: size, objectFit: "contain", borderRadius: 2.5 }}
      />
    );
  }
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
        fontSize: 31,
        fontWeight: 900,
      }}
    >
      {String(app?.name || "?").trim().charAt(0).toUpperCase()}
    </Box>
  );
}

export default function ReadyAppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await apiRequest({
          method: "GET",
          url: CATALOG_ROOT + "/apps/" + encodeURIComponent(id) + "/",
        });
        if (!mounted) return;
        setApp(response.data);
      } catch (err) {
        if (!mounted) return;
        setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Application could not be loaded."));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return <Box sx={{ minHeight: "55vh", display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
  }

  if (error || !app) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/dashboard/ready-apps")}>Back</Button>
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error || "Application not found."}</Alert>
      </Container>
    );
  }

  const components = app.managed_components || [];
  const requirements = app.requirements || [];
  const variant = app.variants?.find((item) => item.availability === "supported") || app.variants?.[0];

  return (
    <>
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4 } }}>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate("/dashboard/ready-apps")}
          sx={{ mb: 2 }}
        >
          Ready Apps
        </Button>

        <Paper variant="outlined" sx={{ borderRadius: 3, p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.25} justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <AppLogo app={app} />
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                  <Typography component="h1" variant="h5" sx={{ fontWeight: 900 }}>{app.name}</Typography>
                  <Chip size="small" variant="outlined" label={app.category} />
                  <Chip size="small" label={app.software_version} />
                </Stack>
                <Typography color="text.secondary" sx={{ mt: 0.8, maxWidth: 760 }}>
                  {app.description}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="contained"
              size="large"
              startIcon={<RocketLaunchRoundedIcon />}
              onClick={() => setWizardOpen(true)}
              disabled={!variant || variant.availability !== "supported"}
              sx={{ minWidth: 150, borderRadius: 1.8, fontWeight: 900, alignSelf: { xs: "stretch", md: "center" } }}
            >
              Deploy
            </Button>
          </Stack>

          <Divider sx={{ my: 2.5 }} />

          <Grid container spacing={2}>
            <Grid item xs={12} md={7}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.2 }}>
                What is managed
              </Typography>
              <Grid container spacing={1}>
                {components.map((component) => (
                  <Grid item xs={12} sm={6} key={component.label}>
                    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover", border: "1px solid", borderColor: "divider" }}>
                      <Typography sx={{ fontWeight: 800 }}>{component.label}</Typography>
                      {component.role && (
                        <Typography variant="caption" color="text.secondary">
                          {component.role}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Grid>

            <Grid item xs={12} md={5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.2 }}>
                Requirements
              </Typography>
              <Stack spacing={0.9}>
                {requirements.length > 0 ? requirements.map((requirement) => (
                  <Stack key={requirement} direction="row" spacing={1} alignItems="flex-start">
                    <CheckCircleOutlineRoundedIcon sx={{ fontSize: 19, color: "success.main", mt: 0.1 }} />
                    <Typography variant="body2" color="text.secondary">{requirement}</Typography>
                  </Stack>
                )) : (
                  <Typography variant="body2" color="text.secondary">
                    No additional requirements.
                  </Typography>
                )}
              </Stack>
              {app.links?.documentation && (
                <Link
                  href={app.links.documentation}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ display: "inline-flex", mt: 1.7, alignItems: "center", gap: 0.6, fontWeight: 700 }}
                >
                  Documentation <LaunchRoundedIcon sx={{ fontSize: 16 }} />
                </Link>
              )}
            </Grid>
          </Grid>

          <Divider sx={{ my: 2.5 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            <StorageRoundedIcon color="primary" />
            <Box>
              <Typography sx={{ fontWeight: 800 }}>Resources are validated by the platform</Typography>
              <Typography variant="body2" color="text.secondary">
                Pick a plan in the deployment wizard. The backend calculates managed child-service allocation before deployment.
              </Typography>
            </Box>
          </Stack>

          {app.tags?.length > 0 && (
            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
              {app.tags.map((tag) => <Chip key={tag} size="small" variant="outlined" label={tag} />)}
            </Stack>
          )}

          {variant && variant.availability !== "supported" && (
            <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
              {variant.unavailable_reason || "This application variant is not currently available."}
            </Alert>
          )}
        </Paper>
      </Container>

      <ReadyAppWizard
        open={wizardOpen}
        app={app}
        onClose={() => setWizardOpen(false)}
        onOpenInstallation={(installationId) => {
          setWizardOpen(false);
          navigate("/dashboard/ready-apps/installations/" + installationId);
        }}
      />
    </>
  );
}
