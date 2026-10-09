import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  ArrowForwardRounded,
  CheckCircleRounded,
  DnsRounded,
  MonitorHeartRounded,
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

import wordpressReadyAppIcon from "../../assets/home/ready-app-wordpress.svg";
import n8nReadyAppIcon from "../../assets/home/ready-app-n8n.svg";
import mattermostReadyAppIcon from "../../assets/home/ready-app-mattermost.svg";
import synapseReadyAppIcon from "../../assets/home/ready-app-synapse.svg";
import uptimeKumaReadyAppIcon from "../../assets/home/ready-app-uptime-kuma.svg";
import forgejoReadyAppIcon from "../../assets/home/ready-app-forgejo.svg";

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

const ABOUT_READY_APPS = [
  { name: "WordPress", icon: wordpressReadyAppIcon, accent: "#21759B" },
  { name: "n8n", icon: n8nReadyAppIcon, accent: "#EA4B71" },
  { name: "Mattermost", icon: mattermostReadyAppIcon, accent: "#0058CC" },
  { name: "Matrix", icon: synapseReadyAppIcon, accent: "#0DBD8B" },
  { name: "Uptime Kuma", icon: uptimeKumaReadyAppIcon, accent: "#5CDD8B" },
  { name: "Forgejo", icon: forgejoReadyAppIcon, accent: "#FB923C" },
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
        borderRadius: { xs: 2.25, md: 2.75 },
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
  const border = alpha(theme.palette.primary.main, dark ? 0.22 : 0.15);
  const nodes = [
    { name: "Source", detail: "Repository connected", Icon: CodeRounded, state: "CONNECTED" },
    { name: "Build", detail: "Immutable image", Icon: RocketLaunchRounded, state: "READY" },
    { name: "Runtime", detail: "Docker / Swarm", Icon: TerminalRounded, state: "HEALTHY" },
  ];
  const signals = [
    { name: "API", detail: "Reachable", Icon: DnsRounded },
    { name: "Storage", detail: "Attached", Icon: StorageRounded },
    { name: "Routing", detail: "HTTPS ready", Icon: SecurityRounded },
  ];

  return (
    <Surface sx={{ p: 0, minWidth: 0, height: "100%", overflow: "hidden", position: "relative" }}>
      <Box
        sx={{
          px: { xs: 1.7, sm: 2.2 },
          py: 1.45,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1.2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: alpha(theme.palette.primary.main, dark ? 0.045 : 0.025),
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.15} sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={0.45} aria-hidden="true">
            {["#fb7185", "#fbbf24", "#34d399"].map((color) => (
              <Box key={color} sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color }} />
            ))}
          </Stack>
          <Typography
            variant="caption"
            sx={{ minWidth: 0, fontWeight: 900, letterSpacing: ".09em", fontSize: ".64rem" }}
          >
            PAASDEPLOYER / CONTROL PLANE
          </Typography>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.55}
          sx={{
            flexShrink: 0,
            color: dark ? "#86efac" : "#15803d",
            bgcolor: dark ? "rgba(34,197,94,.10)" : "rgba(22,163,74,.08)",
            border: "1px solid",
            borderColor: dark ? "rgba(74,222,128,.18)" : "rgba(22,163,74,.15)",
            borderRadius: 1.5,
            py: 0.5,
            px: 0.8,
          }}
        >
          <CheckCircleRounded sx={{ fontSize: 14 }} />
          <Typography variant="caption" sx={{ fontWeight: 850 }}>Workflow ready</Typography>
        </Stack>
      </Box>

      <Box
        sx={{
          p: { xs: 1.7, sm: 2.2, md: 2.6 },
          backgroundImage: dark
            ? "radial-gradient(circle at 85% 0%, rgba(96,165,250,.13), transparent 36%), linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)"
            : "radial-gradient(circle at 85% 0%, rgba(59,130,246,.10), transparent 36%), linear-gradient(rgba(15,23,42,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,.035) 1px, transparent 1px)",
          backgroundSize: "auto, 24px 24px, 24px 24px",
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1.5 }}>
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "primary.main", fontWeight: 900, letterSpacing: ".14em", fontSize: ".62rem" }}
              >
                PLATFORM WORKFLOW
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: "1.08rem", sm: "1.3rem" }, letterSpacing: "-.035em", lineHeight: 1.2 }}>
                From commit to running service
              </Typography>
            </Box>
            <Box
              sx={{
                flexShrink: 0,
                px: 0.9,
                py: 0.55,
                border: "1px solid",
                borderColor: border,
                borderRadius: 1.3,
                color: "text.secondary",
                fontSize: ".62rem",
                fontWeight: 850,
                letterSpacing: ".08em",
              }}
            >
              PREVIEW
            </Box>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.8, sm: 0.65 }}
            alignItems="stretch"
          >
            {nodes.map(({ name, detail, Icon, state }, index) => (
              <React.Fragment key={name}>
                <Paper
                  elevation={0}
                  sx={{
                    flex: "1 1 0",
                    minWidth: 0,
                    p: { xs: 1.25, sm: 1.1, md: 1.35 },
                    border: "1px solid",
                    borderColor: border,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.paper, dark ? 0.88 : 0.94),
                    boxShadow: dark ? "0 8px 24px rgba(0,0,0,.14)" : "0 8px 24px rgba(15,23,42,.045)",
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        flexShrink: 0,
                        borderRadius: 1.5,
                        display: "grid",
                        placeItems: "center",
                        color: "primary.main",
                        bgcolor: alpha(theme.palette.primary.main, dark ? 0.16 : 0.09),
                      }}
                    >
                      <Icon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: ".86rem", fontWeight: 900 }}>{name}</Typography>
                      <Typography sx={{ fontSize: ".68rem", color: "text.secondary", lineHeight: 1.35 }}>
                        {detail}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.25 }}>
                    <CheckCircleRounded sx={{ color: dark ? "#86efac" : "#16a34a", fontSize: 13 }} />
                    <Typography sx={{ color: "text.secondary", fontSize: ".57rem", fontWeight: 900, letterSpacing: ".07em" }}>
                      {state}
                    </Typography>
                  </Stack>
                </Paper>
                {index < nodes.length - 1 ? (
                  <Box
                    aria-hidden="true"
                    sx={{
                      display: "grid",
                      placeItems: "center",
                      color: "primary.main",
                      flexShrink: 0,
                      py: { xs: 0, sm: 0 },
                    }}
                  >
                    <ArrowForwardRounded sx={{ fontSize: 18, transform: { xs: "rotate(90deg)", sm: "none" }, opacity: 0.8 }} />
                  </Box>
                ) : null}
              </React.Fragment>
            ))}
          </Stack>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.35, sm: 1.6 },
              border: "1px solid",
              borderColor: alpha(theme.palette.divider, dark ? 1 : 0.9),
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, dark ? 0.76 : 0.82),
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.1}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  bgcolor: dark ? "rgba(34,197,94,.12)" : "rgba(22,163,74,.08)",
                  color: dark ? "#86efac" : "#15803d",
                }}
              >
                <MonitorHeartRounded sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: ".87rem", fontWeight: 900 }}>Runtime health</Typography>
                <Typography sx={{ fontSize: ".7rem", color: "text.secondary", lineHeight: 1.45 }}>
                  Keep service signals close to everyday operations
                </Typography>
              </Box>
              <Box
                sx={{
                  flexShrink: 0,
                  display: { xs: "none", sm: "flex" },
                  alignItems: "center",
                  gap: 0.65,
                  color: dark ? "#86efac" : "#15803d",
                  fontSize: ".68rem",
                  fontWeight: 850,
                }}
              >
                <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "success.main" }} />
                Observable
              </Box>
            </Stack>
            <Box
              sx={{
                mt: 1.45,
                pt: 1.25,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 0.9,
              }}
            >
              {signals.map(({ name, detail, Icon }) => (
                <Box key={name} sx={{ minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.55}>
                    <Icon sx={{ color: "primary.main", fontSize: 15, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: ".7rem", fontWeight: 850 }}>{name}</Typography>
                  </Stack>
                  <Typography sx={{ pl: 2.55, mt: 0.3, color: "text.secondary", fontSize: ".63rem", overflowWrap: "anywhere" }}>
                    {detail}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={0.7}
            sx={{ pt: 0.2 }}
          >
            {["CONFIGURE", "DEPLOY", "OPERATE"].map((label, index) => (
              <React.Fragment key={label}>
                <Typography sx={{ color: "text.secondary", fontSize: ".61rem", fontWeight: 900, letterSpacing: ".1em" }}>
                  {label}
                </Typography>
                {index < 2 ? <ArrowForwardRounded sx={{ color: alpha(theme.palette.primary.main, 0.72), fontSize: 14 }} /> : null}
              </React.Fragment>
            ))}
          </Stack>
        </Stack>
      </Box>
    </Surface>
  );
}

export default function AboutUs() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";

  return (
    <Box sx={{ bgcolor: "background.default", overflowX: "clip" }}>
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
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.05fr) minmax(0, .95fr)" },
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
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
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
              gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.05fr) minmax(0, .95fr)" },
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
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))" },
                    gap: 1,
                  }}
                >
                  {ABOUT_READY_APPS.map(({ name, icon, accent }) => (
                    <Box
                      key={name}
                      sx={{
                        minWidth: 0,
                        minHeight: 68,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.9,
                        p: 1.1,
                        borderRadius: 1.8,
                        border: "1px solid",
                        borderColor: alpha(accent, dark ? .25 : .2),
                        bgcolor: alpha(accent, dark ? .075 : .04),
                      }}
                    >
                      <Box
                        component="img"
                        src={icon}
                        alt=""
                        aria-hidden="true"
                        sx={{ width: 26, height: 26, objectFit: "contain", flexShrink: 0 }}
                      />
                      <Typography sx={{ minWidth: 0, fontWeight: 850, fontSize: ".78rem", lineHeight: 1.25, overflowWrap: "anywhere" }}>
                        {name}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    mt: 0.3,
                    pt: 1.6,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 850, letterSpacing: ".1em" }}>
                    APPLICATION FLOW
                  </Typography>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems="stretch"
                    spacing={{ xs: 0.7, sm: 0.6 }}
                    sx={{ mt: 1.1 }}
                  >
                    {[
                      { title: "App", detail: "Ready to deploy", Icon: RocketLaunchRounded },
                      { title: "Data layer", detail: "Database & storage", Icon: StorageRounded },
                      { title: "Public route", detail: "Access & HTTPS", Icon: SecurityRounded },
                    ].map(({ title, detail, Icon }, index, items) => (
                      <React.Fragment key={title}>
                        <Box
                          sx={{
                            minWidth: 0,
                            flex: "1 1 0",
                            display: "flex",
                            alignItems: "center",
                            gap: 0.85,
                            p: 1,
                            border: "1px solid",
                            borderColor: alpha(theme.palette.primary.main, dark ? .2 : .14),
                            borderRadius: 1.6,
                            bgcolor: alpha(theme.palette.primary.main, dark ? .065 : .035),
                          }}
                        >
                          <Icon sx={{ color: "primary.main", fontSize: 19, flexShrink: 0 }} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontSize: ".75rem", fontWeight: 900, lineHeight: 1.25 }}>
                              {title}
                            </Typography>
                            <Typography sx={{ mt: .25, color: "text.secondary", fontSize: ".65rem", lineHeight: 1.35 }}>
                              {detail}
                            </Typography>
                          </Box>
                        </Box>
                        {index < items.length - 1 ? (
                          <Box
                            aria-hidden="true"
                            sx={{ display: "grid", placeItems: "center", color: "primary.main", flexShrink: 0 }}
                          >
                            <ArrowForwardRounded sx={{ fontSize: 16, transform: { xs: "rotate(90deg)", sm: "none" } }} />
                          </Box>
                        ) : null}
                      </React.Fragment>
                    ))}
                  </Stack>
                </Box>
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
