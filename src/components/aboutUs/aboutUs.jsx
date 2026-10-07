import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  ArrowForwardRounded,
  AutoAwesomeRounded,
  CodeRounded,
  GitHub,
  LayersRounded,
  MemoryRounded,
  RocketLaunchRounded,
  SecurityRounded,
  SettingsSuggestRounded,
  StorageRounded,
  TerminalRounded,
} from "@mui/icons-material";
import { Box, Button, Container, Paper, Stack, Typography, alpha, useTheme } from "@mui/material";

const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";

const PRINCIPLES = [
  {
    icon: LayersRounded,
    title: "One control plane",
    body: "Deployment, service lifecycle, networking, storage and runtime operations belong to one consistent workflow.",
  },
  {
    icon: SettingsSuggestRounded,
    title: "Practical by default",
    body: "The interface focuses on the actions operators repeat instead of exposing infrastructure ceremony for its own sake.",
  },
  {
    icon: SecurityRounded,
    title: "Clear boundaries",
    body: "Resources, permissions and runtime actions stay explicit so the platform remains predictable as the system grows.",
  },
  {
    icon: CodeRounded,
    title: "Open architecture",
    body: "The control plane is split into a Django backend and React frontend that can be inspected, changed and self-hosted.",
  },
];

const PLATFORM_AREAS = [
  ["Deploy", "Build and release applications through repeatable deployment workflows.", RocketLaunchRounded],
  ["Operate", "Start, stop, rebuild, inspect and monitor services from the workspace.", TerminalRounded],
  ["Connect", "Treat networks, volumes and supporting infrastructure as first-class resources.", StorageRounded],
  ["Automate", "Use the Agent API for scoped, auditable service and runtime operations.", AutoAwesomeRounded],
];

function SectionHeading({ eyebrow, title, body, align = "left" }) {
  return (
    <Box sx={{ textAlign: align, maxWidth: align === "center" ? 780 : 720 }}>
      <Typography
        variant="overline"
        component="p"
        sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
      >
        {eyebrow}
      </Typography>
      <Typography
        component="h2"
        sx={{
          mt: 1,
          fontWeight: 950,
          letterSpacing: "-.045em",
          lineHeight: 1.04,
          fontSize: { xs: "clamp(1.8rem, 7vw, 2.5rem)", md: "3.65rem" },
        }}
      >
        {title}
      </Typography>
      {body ? (
        <Typography
          sx={{ mt: 1.5, lineHeight: 1.75, fontSize: { xs: ".95rem", md: "1.05rem" } }}
          color="text.secondary"
        >
          {body}
        </Typography>
      ) : null}
    </Box>
  );
}

function Surface({ children, sx = {}, ...props }) {
  return (
    <Paper
      elevation={0}
      {...props}
      sx={(theme) => ({
        border: "1px solid",
        borderColor: alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.82 : 0.9),
        borderRadius: { xs: 3, md: 4 },
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(15,24,39,.9), rgba(6,12,23,.94))"
            : "linear-gradient(145deg, rgba(255,255,255,.96), rgba(247,250,255,.96))",
        ...sx,
      })}
    />
  );
}

function ArchitectureVisual() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const border = alpha(theme.palette.primary.main, dark ? 0.22 : 0.16);
  const nodes = [
    ["Source", CodeRounded, "Repository / config"],
    ["Control plane", SettingsSuggestRounded, "Django API"],
    ["Runtime", RocketLaunchRounded, "Docker + Swarm"],
  ];

  return (
    <Surface sx={{ p: { xs: 2, sm: 2.5, md: 3 }, height: "100%", overflow: "hidden", position: "relative" }}>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          width: 260,
          height: 260,
          borderRadius: "50%",
          right: -120,
          top: -120,
          background: alpha(theme.palette.primary.main, dark ? 0.11 : 0.06),
        }}
      />
      <Stack spacing={1.15} sx={{ position: "relative" }}>
        {nodes.map(([name, Icon, detail], index) => (
          <React.Fragment key={name}>
            <Paper
              elevation={0}
              sx={{
                p: 1.45,
                borderRadius: 2.2,
                border: "1px solid",
                borderColor: border,
                background: alpha(theme.palette.background.paper, dark ? 0.58 : 0.78),
              }}
            >
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: 1.7,
                    display: "grid",
                    placeItems: "center",
                    color: "primary.main",
                    bgcolor: alpha(theme.palette.primary.main, dark ? 0.13 : 0.08),
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 900 }}>{name}</Typography>
                  <Typography variant="caption" color="text.secondary">{detail}</Typography>
                </Box>
              </Stack>
            </Paper>
            {index < nodes.length - 1 ? (
              <Box
                aria-hidden="true"
                sx={{
                  width: 2,
                  height: 22,
                  mx: "auto",
                  borderRadius: 99,
                  background:
                    "linear-gradient(180deg, " +
                    alpha(theme.palette.primary.main, 0.08) +
                    ", " +
                    alpha(theme.palette.primary.main, 0.38) +
                    ", " +
                    alpha(theme.palette.primary.main, 0.08) +
                    ")",
                }}
              />
            ) : null}
          </React.Fragment>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ pt: 1, lineHeight: 1.6 }}>
          A single path from configuration to an observable running workload.
        </Typography>
      </Stack>
    </Surface>
  );
}

export default function AboutUs() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";

  return (
    <Box sx={{ bgcolor: "background.default", overflow: "hidden" }}>
      <Box
        component="section"
        sx={{
          position: "relative",
          pt: { xs: 6, sm: 8, md: 11 },
          pb: { xs: 6, sm: 8, md: 10 },
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 15% 18%, " +
              alpha(theme.palette.primary.main, dark ? 0.14 : 0.09) +
              ", transparent 34%), radial-gradient(circle at 85% 70%, " +
              alpha(theme.palette.secondary.main || theme.palette.info.main, dark ? 0.1 : 0.06) +
              ", transparent 30%)",
            pointerEvents: "none",
          }}
        />
        <Container maxWidth="lg" sx={{ position: "relative" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.05fr .95fr" },
              gap: { xs: 4, md: 7 },
              alignItems: "center",
            }}
          >
            <Box>
              <Typography
                variant="overline"
                component="p"
                sx={{ fontWeight: 900, letterSpacing: ".17em", color: "primary.main" }}
              >
                About PaaSDeployer
              </Typography>
              <Typography
                component="h1"
                sx={{
                  mt: 1.2,
                  fontWeight: 950,
                  fontSize: { xs: "clamp(2.35rem, 10vw, 3.5rem)", sm: "4.25rem", md: "5.35rem" },
                  lineHeight: { xs: .98, md: .94 },
                  letterSpacing: "-.06em",
                  maxWidth: 760,
                }}
              >
                Infrastructure should feel like a product.
              </Typography>
              <Typography
                sx={{ mt: 2.2, maxWidth: 650, fontSize: { xs: "1rem", md: "1.16rem" }, lineHeight: 1.8 }}
                color="text.secondary"
              >
                PaaSDeployer is a self-hosted application deployment platform built around one idea:
                make the path from configured workload to running service easier to understand, operate and automate.
              </Typography>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.15} sx={{ mt: 3.2 }}>
                <Button
                  component={RouterLink}
                  to="/dashboard/ready-apps"
                  variant="contained"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ minHeight: 48, px: 2.3, borderRadius: 2, fontWeight: 900 }}
                >
                  Explore App Library
                </Button>
                <Button
                  component={RouterLink}
                  to="/plans"
                  variant="outlined"
                  sx={{ minHeight: 48, px: 2.3, borderRadius: 2, fontWeight: 850 }}
                >
                  View plans
                </Button>
              </Stack>

              <Stack direction="row" spacing={2.2} flexWrap="wrap" useFlexGap sx={{ mt: 3.1 }}>
                {[
                  ["Django", "API & orchestration"],
                  ["React", "Operator workspace"],
                  ["Docker", "Runtime layer"],
                ].map(([label, detail]) => (
                  <Box key={label}>
                    <Typography sx={{ fontWeight: 900, fontSize: ".95rem" }}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{detail}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>

            <ArchitectureVisual />
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <SectionHeading
            eyebrow="Why it exists"
            title="A control plane built around the work that actually matters."
            body="Instead of treating deployment, services and infrastructure as separate worlds, PaaSDeployer keeps them in one operator experience."
          />
          <Box
            sx={{
              mt: { xs: 3.2, md: 4.5 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
              gap: 1.7,
            }}
          >
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <Surface
                key={title}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  height: "100%",
                  transition: "transform .2s ease, border-color .2s ease, box-shadow .2s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: alpha(theme.palette.primary.main, 0.28),
                    boxShadow: "0 24px 60px " + alpha(theme.palette.primary.main, 0.09),
                  },
                }}
              >
                <Stack direction="row" spacing={1.35} alignItems="flex-start">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.9,
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                      bgcolor: alpha(theme.palette.primary.main, dark ? 0.13 : 0.07),
                      flexShrink: 0,
                    }}
                  >
                    <Icon />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .5, lineHeight: 1.65 }}>
                      {body}
                    </Typography>
                  </Box>
                </Stack>
              </Surface>
            ))}
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.05fr .95fr" },
              gap: { xs: 3, md: 6 },
              alignItems: "center",
            }}
          >
            <Box>
              <SectionHeading
                eyebrow="What the platform connects"
                title="From deployment to daily operations."
                body="PaaSDeployer is not only an image launcher. The same workspace follows the service after it is deployed."
              />
              <Stack spacing={1.3} sx={{ mt: 3.3 }}>
                {PLATFORM_AREAS.map(([title, body, Icon]) => (
                  <Stack key={title} direction="row" spacing={1.1} alignItems="flex-start">
                    <Icon sx={{ mt: .15, fontSize: 20, color: "primary.main" }} />
                    <Box>
                      <Typography sx={{ fontWeight: 850 }}>{title}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: .2, lineHeight: 1.6 }}>
                        {body}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Surface
              sx={{
                p: { xs: 2, sm: 2.5, md: 3 },
                background:
                  dark
                    ? "radial-gradient(circle at 80% 10%, " +
                      alpha(theme.palette.primary.main, 0.15) +
                      ", transparent 34%), linear-gradient(145deg, rgba(12,20,34,.94), rgba(5,10,20,.98))"
                    : "radial-gradient(circle at 80% 10%, " +
                      alpha(theme.palette.primary.main, 0.1) +
                      ", transparent 34%), linear-gradient(145deg, #ffffff, #f6f9ff)",
              }}
            >
              <Stack spacing={1.8}>
                <Box>
                  <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 900, letterSpacing: ".12em" }}>
                    READY APPS
                  </Typography>
                  <Typography sx={{ mt: .7, fontSize: "1.5rem", fontWeight: 900, letterSpacing: "-.025em" }}>
                    Start with software, not infrastructure assembly.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: .8, lineHeight: 1.65 }}>
                    Popular self-hosted applications can arrive with their supporting services, storage and configuration already described by the catalog.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {["WordPress", "n8n", "Mattermost", "Uptime Kuma"].map((name) => (
                    <Box
                      key={name}
                      sx={{
                        px: 1.15,
                        py: .75,
                        borderRadius: 1.7,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        fontWeight: 800,
                        fontSize: ".82rem",
                      }}
                    >
                      {name}
                    </Box>
                  ))}
                </Stack>
                <Button
                  component={RouterLink}
                  to="/dashboard/ready-apps"
                  endIcon={<ArrowForwardRounded />}
                  sx={{ alignSelf: "flex-start", borderRadius: 1.8, fontWeight: 850, px: 1.25 }}
                >
                  Open App Library
                </Button>
              </Stack>
            </Surface>
          </Box>
        </Container>
      </Box>

      <Box component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Surface sx={{ p: { xs: 2.5, sm: 4, md: 5 }, overflow: "hidden", position: "relative" }}>
            <Box
              sx={{
                position: "absolute",
                width: 340,
                height: 340,
                borderRadius: "50%",
                right: -170,
                bottom: -180,
                bgcolor: alpha(theme.palette.secondary.main || theme.palette.info.main, dark ? 0.11 : 0.07),
              }}
            />
            <Box sx={{ position: "relative" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "flex-end" }}
                gap={2.5}
              >
                <Box sx={{ maxWidth: 700 }}>
                  <SectionHeading
                    eyebrow="Open source"
                    title="Inspect it. Change it. Run it your way."
                    body="The frontend and backend are separate projects, so the platform can evolve without hiding the pieces that make the deployment experience work."
                  />
                </Box>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    href={GITHUB_API}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    startIcon={<GitHub />}
                    sx={{ borderRadius: 1.8, fontWeight: 850 }}
                  >
                    Backend
                  </Button>
                  <Button
                    href={GITHUB_FRONTEND}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    startIcon={<GitHub />}
                    sx={{ borderRadius: 1.8, fontWeight: 850 }}
                  >
                    Frontend
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  mt: 3.2,
                  pt: 2.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: { xs: 1.6, sm: 0 },
                }}
              >
                {[
                  [MemoryRounded, "Resource-aware", "CPU, memory and storage stay visible at the service level."],
                  [StorageRounded, "Persistent by design", "Networks and volumes are part of the operating model."],
                  [AutoAwesomeRounded, "Automation-ready", "The Agent API exposes scoped runtime actions without hiding control."],
                ].map(([Icon, title, body]) => (
                  <Box
                    key={title}
                    sx={{
                      px: { sm: 2 },
                      "&:not(:last-child)": {
                        borderRight: { sm: "1px solid" },
                        borderColor: "divider",
                      },
                    }}
                  >
                    <Icon sx={{ color: "primary.main", fontSize: 20 }} />
                    <Typography sx={{ mt: .7, fontWeight: 900 }}>{title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: .35, lineHeight: 1.6 }}>
                      {body}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Surface>
        </Container>
      </Box>

      <Box component="section" sx={{ pt: 2, pb: { xs: 7, md: 11 } }}>
        <Container maxWidth="md">
          <Surface
            sx={{
              p: { xs: 3, sm: 4.5, md: 5.5 },
              textAlign: "center",
              background: dark
                ? "linear-gradient(145deg, rgba(23,42,70,.8), rgba(9,17,30,.95))"
                : "linear-gradient(145deg, #f4f8ff, #ffffff)",
            }}
          >
            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}>
              Build your way
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: .8,
                fontWeight: 950,
                letterSpacing: "-.05em",
                lineHeight: 1.04,
                fontSize: { xs: "clamp(1.8rem, 7vw, 2.5rem)", md: "3.5rem" },
              }}
            >
              Start with a Ready App or build the service yourself.
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.3, lineHeight: 1.7, maxWidth: 620, mx: "auto" }}>
              The platform is designed to support both paths without making either one feel like the wrong choice.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="center" spacing={1.1} sx={{ mt: 2.7 }}>
              <Button
                component={RouterLink}
                to="/dashboard/ready-apps"
                variant="contained"
                endIcon={<ArrowForwardRounded />}
                sx={{ minHeight: 48, px: 2.4, borderRadius: 2, fontWeight: 900 }}
              >
                Explore Ready Apps
              </Button>
              <Button
                component={RouterLink}
                to="/dashboard/services"
                variant="outlined"
                sx={{ minHeight: 48, px: 2.4, borderRadius: 2, fontWeight: 850 }}
              >
                Open Services
              </Button>
            </Stack>
          </Surface>
        </Container>
      </Box>
    </Box>
  );
}
