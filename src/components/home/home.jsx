import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  Paper,
  Avatar,
  Grid,
  Divider,
  useTheme,
  Link,
  alpha,
  keyframes,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import StorageIcon from "@mui/icons-material/Storage";
import GitHubIcon from "@mui/icons-material/GitHub";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

import heroImage from "../../assets/main-image.webp";

const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";
const ORBIT_STORAGE_KEY = "home_orbit_animation";

const orbitSpin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

const iconSpin = keyframes`
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
`;

function OrbitDots({ color, count = 16, active = true }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const size = 5 + (i % 3) * 2;
        const ring = 50 + (i % 4) * 3;
        const duration = 10 + (i % 5) * 3;
        const delay = -(i * 0.4);
        const opacity = 0.65 + (i % 3) * 0.1;
        return { angle, size, ring, duration, delay, opacity };
      }),
    [count]
  );

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "visible",
      }}
    >
      {dots.map((d, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: { xs: `${d.ring * 1.7}%`, sm: `${d.ring}%` },
            height: 0,
            transformOrigin: "left center",
            transform: `rotate(${d.angle}deg)`,
            animation: active
              ? `${orbitSpin} ${d.duration}s linear infinite`
              : "none",
            animationDelay: active ? `${d.delay}s` : "0s",
            animationPlayState: active ? "running" : "paused",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              right: 0,
              top: "50%",
              width: d.size,
              height: d.size,
              marginTop: `${-d.size / 2}px`,
              marginRight: `${-d.size / 2}px`,
              borderRadius: "50%",
              bgcolor: color,
              opacity: active ? d.opacity : d.opacity * 0.45,
              boxShadow: active
                ? `0 0 12px ${alpha(color, 0.9)}, 0 0 4px ${color}`
                : `0 0 4px ${alpha(color, 0.35)}`,
              transition: "opacity 0.3s ease, box-shadow 0.3s ease",
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  const [loggedIn, setLoggedIn] = useState(() =>
    Boolean(window.localStorage.getItem("access"))
  );
  const [orbitActive, setOrbitActive] = useState(() => {
    try {
      const saved = window.localStorage.getItem(ORBIT_STORAGE_KEY);
      if (saved === null) return true;
      return saved === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const syncAuth = () => {
      setLoggedIn(Boolean(window.localStorage.getItem("access")));
    };
    window.addEventListener("auth-changed", syncAuth);
    window.addEventListener("storage", syncAuth);
    return () => {
      window.removeEventListener("auth-changed", syncAuth);
      window.removeEventListener("storage", syncAuth);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(ORBIT_STORAGE_KEY, String(orbitActive));
    } catch {
      /* ignore */
    }
  }, [orbitActive]);

  const toggleOrbit = () => setOrbitActive((v) => !v);

  const isDark = theme.palette.mode === "dark";
  const cardBg = isDark
    ? "linear-gradient(165deg, rgba(15,23,42,0.95) 0%, rgba(8,15,30,0.98) 100%)"
    : "linear-gradient(165deg, #ffffff 0%, #f4f8ff 100%)";
  const subtleBorder = isDark ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.07)";
  const pageBg = isDark
    ? "linear-gradient(180deg, #050b16 0%, #0a1424 45%, #07101c 100%)"
    : "linear-gradient(180deg, #f5f9ff 0%, #eef5ff 50%, #f8fbff 100%)";
  const orbitColor = isDark ? "#ffffff" : "#0f172a";

  const fadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" },
    }),
  };

  const iconHoverSx = {
    "&:hover .spin-icon": {
      animation: `${iconSpin} 0.65s ease-in-out`,
    },
  };

  /*
   * Hero image contains centered wordmark:
   *   PAAS
   *   DEPLOYER
   * On narrow screens, object-fit:cover + tight radial mask cropped the edges
   * of those letters. We:
   *  - keep a wider horizontal focal area on xs
   *  - soften the mask so the wordmark stays inside the opaque region
   *  - use a mobile-friendly aspect that does not over-crop width
   */
  const heroMask = isXs
    ? "radial-gradient(ellipse 92% 78% at 50% 42%, #000 58%, transparent 88%)"
    : isMdDown
    ? "radial-gradient(ellipse 84% 74% at 50% 44%, #000 50%, transparent 82%)"
    : "radial-gradient(ellipse 75% 70% at 50% 45%, #000 42%, transparent 78%)";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: { xs: 3, md: 6 },
        px: { xs: 1.5, md: 3 },
        background: pageBg,
        color: "text.primary",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: { xs: 3, md: 4 },
            flexWrap: "wrap",
            gap: 2,
            position: "relative",
            zIndex: 2,
          }}
        >
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 900,
                letterSpacing: "-0.02em",
                background: isDark
                  ? "linear-gradient(90deg, #e2e8f0, #93c5fd)"
                  : "linear-gradient(90deg, #1e293b, #3730a3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              PaaS Deployer
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Create plans → deploy services → monitor and manage
            </Typography>
          </Box>

          <Button
            startIcon={<RocketLaunchIcon className="spin-icon" />}
            variant="contained"
            onClick={() => navigate("/plans")}
            sx={{
              ...iconHoverSx,
              background: isDark
                ? "linear-gradient(90deg, #1e3a5f, #0f766e)"
                : "linear-gradient(90deg, #4f46e5, #0891b2)",
              color: "#fff",
              px: 2.5,
              py: 1,
              fontWeight: 700,
              borderRadius: 2.5,
              textTransform: "none",
              boxShadow: isDark
                ? "0 8px 24px rgba(2,6,23,0.55)"
                : "0 10px 28px rgba(79,70,229,0.22)",
              "&:hover": {
                filter: "brightness(1.08)",
                boxShadow: isDark
                  ? "0 12px 32px rgba(2,6,23,0.65)"
                  : "0 14px 36px rgba(79,70,229,0.28)",
              },
            }}
          >
            Create / Choose Plan
          </Button>
        </Box>

        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
          <Box
            sx={{
              position: "relative",
              mb: { xs: 5, md: 6 },
              mx: "auto",
              width: "100%",
              pt: { xs: 0.5, md: 3.5 },
              pb: { xs: 0.5, md: 3.5 },
              px: { xs: 0, sm: 2, md: 3 },
              overflow: "visible",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              <OrbitDots color={orbitColor} count={16} active={orbitActive} />
            </Box>

            <Tooltip title={orbitActive ? "Stop orbit animation" : "Play orbit animation"}>
              <IconButton
                onClick={toggleOrbit}
                size="small"
                aria-label={orbitActive ? "Stop animation" : "Play animation"}
                sx={{
                  position: "absolute",
                  top: { xs: 4, md: 8 },
                  right: { xs: 4, md: 8 },
                  zIndex: 4,
                  width: 32,
                  height: 32,
                  border: "1px solid",
                  borderColor: subtleBorder,
                  bgcolor: alpha(theme.palette.background.paper, isDark ? 0.75 : 0.9),
                  color: "text.secondary",
                  backdropFilter: "blur(8px)",
                  "&:hover": {
                    bgcolor: alpha(theme.palette.background.paper, 1),
                    color: "text.primary",
                  },
                }}
              >
                {orbitActive ? (
                  <PauseIcon sx={{ fontSize: 16 }} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>

            <Box
              sx={{
                position: "relative",
                zIndex: 2,
                borderRadius: { xs: 2, sm: 3, md: 4 },
                overflow: "hidden",
                // Mobile: wider frame so PAAS / DEPLOYER wordmark is not side-cropped
                width: "100%",
                maxWidth: "100%",
                // Prefer aspect based on source art (1376x768) but allow taller frame on xs
                aspectRatio: { xs: "4 / 3", sm: "1376 / 768" },
                maxHeight: { xs: "min(72vw, 340px)", sm: 360, md: 420 },
                minHeight: { xs: 260, sm: 0 },
                mx: "auto",
                border: `1px solid ${subtleBorder}`,
                boxShadow: isDark
                  ? "0 24px 64px rgba(0,0,0,0.45)"
                  : "0 24px 64px rgba(37,99,235,0.12)",
                background: isDark ? "#0a1424" : "#dbeafe",
              }}
            >
              <Box
                component="img"
                src={heroImage}
                alt="PaaS Deployer — PAAS DEPLOYER"
                sx={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  // cover still fills the frame, but we anchor to the wordmark center
                  objectFit: "cover",
                  objectPosition: { xs: "center 42%", sm: "center center", md: "center center" },
                  // Slight zoom-out on mobile so left/right of wordmark stay inside frame
                  transform: { xs: "scale(1.02)", sm: "none" },
                  transformOrigin: "center center",
                  WebkitMaskImage: heroMask,
                  maskImage: heroMask,
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  background: isDark
                    ? {
                        xs: "radial-gradient(ellipse 95% 85% at 50% 40%, transparent 45%, rgba(5,11,22,0.45) 100%)",
                        sm: "radial-gradient(ellipse 80% 75% at 50% 40%, transparent 35%, rgba(5,11,22,0.55) 100%)",
                      }
                    : {
                        xs: "radial-gradient(ellipse 95% 85% at 50% 40%, transparent 40%, rgba(37,99,235,0.22) 75%, rgba(30,64,175,0.38) 100%)",
                        sm: "radial-gradient(ellipse 80% 75% at 50% 40%, transparent 30%, rgba(37,99,235,0.28) 70%, rgba(30,64,175,0.42) 100%)",
                      },
                }}
              />

              <Box
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: "auto",
                  minHeight: { xs: "32%", sm: "25%" },
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  px: { xs: 1.5, sm: 2 },
                  pt: { xs: 4, sm: 6 },
                  pb: { xs: 1.75, md: 2 },
                  textAlign: "center",
                  zIndex: 3,
                  background: isDark
                    ? "linear-gradient(180deg, transparent 0%, rgba(5,11,22,0.55) 40%, rgba(5,11,22,0.95) 100%)"
                    : "linear-gradient(180deg, transparent 0%, rgba(37,99,235,0.35) 40%, rgba(30,64,175,0.85) 100%)",
                }}
              >
                <Typography
                  sx={{
                    color: "rgba(255,255,255,0.95)",
                    maxWidth: 520,
                    fontSize: { xs: "0.78rem", sm: "0.95rem" },
                    fontWeight: 500,
                    mb: 1.25,
                    textShadow: "0 2px 12px rgba(0,0,0,0.35)",
                    px: 0.5,
                  }}
                >
                  Deploy, scale and manage your services with a modern control panel
                </Typography>

                <Stack
                  direction="row"
                  spacing={1.25}
                  flexWrap="wrap"
                  useFlexGap
                  justifyContent="center"
                >
                  <Button
                    variant="contained"
                    onClick={() => navigate("/plans")}
                    endIcon={<ArrowForwardIcon className="spin-icon" />}
                    size="small"
                    sx={{
                      ...iconHoverSx,
                      bgcolor: "#fff",
                      color: "#0f172a",
                      fontWeight: 800,
                      textTransform: "none",
                      borderRadius: 2.5,
                      px: 2.25,
                      "&:hover": { bgcolor: "rgba(255,255,255,0.92)" },
                    }}
                  >
                    Get started
                  </Button>

                  {loggedIn && (
                    <Button
                      variant="outlined"
                      onClick={() => navigate("/services")}
                      size="small"
                      sx={{
                        borderColor: "rgba(255,255,255,0.55)",
                        color: "#fff",
                        fontWeight: 700,
                        textTransform: "none",
                        borderRadius: 2.5,
                        px: 2.25,
                        "&:hover": {
                          borderColor: "#fff",
                          bgcolor: "rgba(255,255,255,0.1)",
                        },
                      }}
                    >
                      Go to Services
                    </Button>
                  )}
                </Stack>
              </Box>
            </Box>
          </Box>
        </motion.div>

        <Box sx={{ position: "relative", zIndex: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="center"
            sx={{ mb: { xs: 4, md: 5 } }}
          >
            <Button
              component="a"
              href={GITHUB_API}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<GitHubIcon className="spin-icon" />}
              sx={{
                ...iconHoverSx,
                borderColor: subtleBorder,
                color: "text.primary",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2.5,
                px: 2.5,
                py: 1.1,
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.7),
              }}
            >
              Backend API (Django)
            </Button>
            <Button
              component="a"
              href={GITHUB_FRONTEND}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<GitHubIcon className="spin-icon" />}
              sx={{
                ...iconHoverSx,
                borderColor: subtleBorder,
                color: "text.primary",
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2.5,
                px: 2.5,
                py: 1.1,
                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.7),
              }}
            >
              Frontend (React)
            </Button>
          </Stack>

          {!loggedIn && (
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}>
              <Paper
                elevation={0}
                sx={{
                  p: { xs: 2, md: 2.5 },
                  mb: 4,
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "center" },
                  gap: 2,
                  borderRadius: 3,
                  background: cardBg,
                  border: `1px solid ${subtleBorder}`,
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    sx={{
                      bgcolor: alpha(theme.palette.info.main, 0.18),
                      color: "info.main",
                      width: 56,
                      height: 56,
                      ...iconHoverSx,
                    }}
                  >
                    <AccountTreeIcon className="spin-icon" sx={{ fontSize: 28 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Start with a Plan
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Plans define CPU, RAM, storage & pricing — choose or create a plan to get
                      started.
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="contained"
                  onClick={() => navigate("/plans")}
                  sx={{
                    px: 2.5,
                    py: 1.1,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Choose / Create Plan
                </Button>
              </Paper>
            </motion.div>
          )}

          <Box sx={{ mb: 4 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                mb: 2.5,
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Quickstart
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Get up and running in three easy steps
              </Typography>
            </Box>

            <Grid container spacing={2.5}>
              {[
                {
                  title: "Choose a Plan",
                  desc: "Define resource limits & pricing for your deployments.",
                  icon: <AccountTreeIcon className="spin-icon" />,
                  color: "primary",
                },
                {
                  title: "Create a Service",
                  desc: "Create a service from the plan template and customize resources.",
                  icon: <StorageIcon className="spin-icon" />,
                  color: "success",
                },
                {
                  title: "Deploy & Manage",
                  desc: "Start, stop and monitor your deployments with easy controls.",
                  icon: <RocketLaunchIcon className="spin-icon" />,
                  color: "warning",
                },
              ].map((c, i) => (
                <Grid item xs={12} sm={4} key={c.title}>
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    custom={i + 2}
                    style={{ height: "100%" }}
                    whileHover={{ y: -6 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.75,
                        height: "100%",
                        borderRadius: 3,
                        display: "flex",
                        gap: 2,
                        alignItems: "flex-start",
                        background: cardBg,
                        border: `1px solid ${subtleBorder}`,
                        transition: "box-shadow 200ms ease, border-color 200ms ease",
                        ...iconHoverSx,
                        "&:hover": {
                          borderColor: alpha(theme.palette[c.color].main, 0.35),
                          boxShadow: isDark
                            ? "0 16px 40px rgba(0,0,0,0.4)"
                            : "0 16px 40px rgba(15,23,42,0.08)",
                        },
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: alpha(theme.palette[c.color].main, 0.16),
                          color: `${c.color}.main`,
                          width: 48,
                          height: 48,
                        }}
                      >
                        {c.icon}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{c.title}</Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ lineHeight: 1.55 }}
                        >
                          {c.desc}
                        </Typography>
                      </Box>
                    </Paper>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Divider sx={{ my: 3, borderColor: subtleBorder }} />

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, md: 3.5 },
              borderRadius: 3,
              background: cardBg,
              border: `1px solid ${subtleBorder}`,
            }}
          >
            <Grid container spacing={2.5} alignItems="center">
              <Grid item xs={12} md={7}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.75 }}>
                  Need help?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                  Recommended flow: 1) choose or create a plan, 2) create a service using that plan,
                  3) deploy & monitor. Explore the open-source repositories for API and frontend
                  details.
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                  <Link
                    href={GITHUB_API}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      fontWeight: 600,
                      ...iconHoverSx,
                    }}
                  >
                    <GitHubIcon className="spin-icon" fontSize="small" /> API repo
                  </Link>
                  <Link
                    href={GITHUB_FRONTEND}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      fontWeight: 600,
                      ...iconHoverSx,
                    }}
                  >
                    <GitHubIcon className="spin-icon" fontSize="small" /> Frontend repo
                  </Link>
                </Stack>
              </Grid>

              <Grid
                item
                xs={12}
                md={5}
                sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}
              >
                <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/plans")}
                    sx={{
                      borderColor: subtleBorder,
                      borderRadius: 2.5,
                      textTransform: "none",
                      fontWeight: 700,
                      px: 2.25,
                    }}
                  >
                    Plans
                  </Button>
                  {loggedIn && (
                    <Button
                      variant="contained"
                      onClick={() => navigate("/services")}
                      sx={{
                        background: isDark
                          ? "linear-gradient(90deg, #1e3a5f, #0f766e)"
                          : "linear-gradient(90deg, #4f46e5, #0891b2)",
                        color: "#fff",
                        borderRadius: 2.5,
                        textTransform: "none",
                        fontWeight: 700,
                        px: 2.25,
                      }}
                    >
                      Go to Services
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}
