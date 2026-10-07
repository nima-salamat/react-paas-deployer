import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Link,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate, useParams } from "react-router-dom";
import ReadyAppWizard from "./ReadyAppWizard.jsx";

const API_ROOT =
  "https://" +
  String(import.meta.env.VITE_API_BASE || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";

function AppLogo({ app, size = 84 }) {
  const [failed, setFailed] = useState(false);
  const logo = String(app?.logo || "");

  return (
    <Box
      sx={(theme) => ({
        width: size,
        height: size,
        borderRadius: 4,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(81,129,255,.26), rgba(126,87,255,.14))"
            : "linear-gradient(145deg, rgba(81,129,255,.10), rgba(126,87,255,.07))",
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, 0.18),
        boxShadow: "0 18px 44px rgba(0,0,0,.10)",
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
        <LayersRoundedIcon sx={{ fontSize: size * .42, color: "primary.main" }} />
      )}
    </Box>
  );
}

function Meta({ label, value }) {
  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}
      >
        {label}
      </Typography>
      <Typography sx={{ mt: .2, fontWeight: 850 }}>{value || "—"}</Typography>
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
        setError(
          String(
            err?.response?.data?.detail ||
              err?.response?.data?.error ||
              "Couldn't load this app."
          )
        );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Skeleton variant="rounded" width={120} height={28} />
        <Card variant="outlined" sx={{ mt: 2.5, borderRadius: 5, p: { xs: 2.5, md: 4 } }}>
          <Stack spacing={2}>
            <Skeleton variant="rounded" width={84} height={84} />
            <Skeleton variant="rounded" width="34%" height={40} />
            <Skeleton variant="rounded" width="68%" height={20} />
          </Stack>
        </Card>
      </Container>
    );
  }

  if (error || !app) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon />}
          onClick={() => navigate("/dashboard/ready-apps")}
        >
          App Library
        </Button>
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2.5 }}>
          {error || "Application not found."}
        </Alert>
      </Container>
    );
  }

  const variant =
    app.variants?.find((item) => item.availability === "supported") ||
    app.variants?.[0];
  const components = app.managed_components || [];

  return (
    <>
      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4.5 } }}>
        <Stack spacing={3}>
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => navigate("/dashboard/ready-apps")}
            sx={{ alignSelf: "flex-start", px: 0, fontWeight: 800 }}
          >
            App Library
          </Button>

          <Card
            variant="outlined"
            sx={(theme) => ({
              borderRadius: 5,
              overflow: "hidden",
              borderColor: alpha(theme.palette.divider, .85),
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(145deg, rgba(16,29,53,.98), rgba(10,19,36,.98))"
                  : "linear-gradient(145deg, rgba(255,255,255,1), rgba(247,249,255,1))",
            })}
          >
            <Box sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2.5}
                alignItems={{ xs: "flex-start", md: "center" }}
              >
                <AppLogo app={app} />

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography
                      component="h1"
                      sx={{
                        fontSize: { xs: 31, md: 45 },
                        lineHeight: 1,
                        fontWeight: 950,
                        letterSpacing: "-.05em",
                      }}
                    >
                      {app.name}
                    </Typography>
                    {app.software_version && (
                      <Box
                        sx={{
                          px: 1,
                          py: .45,
                          borderRadius: 1.6,
                          bgcolor: "action.hover",
                          color: "text.secondary",
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        v{app.software_version}
                      </Box>
                    )}
                  </Stack>
                  <Typography color="text.secondary" sx={{ mt: 1.2, maxWidth: 680, lineHeight: 1.65 }}>
                    {app.description || "A curated app, ready to deploy."}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => setWizardOpen(true)}
                  disabled={!variant || variant.availability !== "supported"}
                  sx={{
                    minWidth: 150,
                    borderRadius: 2.4,
                    px: 2.2,
                    py: 1.2,
                    fontWeight: 900,
                    alignSelf: { xs: "stretch", md: "center" },
                  }}
                >
                  Install
                </Button>
              </Stack>
            </Box>
          </Card>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.5fr 1fr" },
              gap: 2,
            }}
          >
            <Card variant="outlined" sx={{ borderRadius: 4, p: { xs: 2.2, md: 2.8 } }}>
              <Stack direction="row" spacing={1.1} alignItems="center">
                <SecurityRoundedIcon sx={{ color: "primary.main" }} />
                <Typography sx={{ fontWeight: 900 }}>Included</Typography>
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))" },
                  gap: 1,
                  mt: 2,
                }}
              >
                {components.map((component) => (
                  <Box
                    key={component.label}
                    sx={{
                      p: 1.4,
                      borderRadius: 2.5,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography sx={{ fontWeight: 850 }}>{component.label}</Typography>
                    {component.role && (
                      <Typography variant="caption" color="text.secondary">
                        {component.role}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {!components.length && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.4 }}>
                  Managed runtime.
                </Typography>
              )}
            </Card>

            <Card variant="outlined" sx={{ borderRadius: 4, p: { xs: 2.2, md: 2.8 } }}>
              <Typography sx={{ fontWeight: 900 }}>At a glance</Typography>
              <Stack direction="row" spacing={4} sx={{ mt: 2.2 }}>
                <Meta label="Category" value={app.category} />
                <Meta label="Version" value={app.software_version ? "v" + app.software_version : null} />
              </Stack>

              {app.links?.documentation && (
                <Link
                  href={app.links.documentation}
                  target="_blank"
                  rel="noreferrer"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: .5,
                    mt: 2.4,
                    fontWeight: 800,
                  }}
                >
                  Documentation
                  <LaunchRoundedIcon sx={{ fontSize: 16 }} />
                </Link>
              )}
            </Card>
          </Box>

          {variant && variant.availability !== "supported" && (
            <Alert severity="warning" sx={{ borderRadius: 2.5 }}>
              {variant.unavailable_reason || "This app isn't available right now."}
            </Alert>
          )}
        </Stack>
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
