import React, { useState, useRef } from "react";
import {
  Box,
  Typography,
  Container,
  Button,
  Stack,
  Paper,
  keyframes,
  useTheme,
  alpha,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import Rocket from "../../assets/aboutUs/rocket.svg";

const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";

const float = keyframes`
  0%   { transform: translateY(0) rotate(-1.5deg); }
  50%  { transform: translateY(-14px) rotate(1.5deg); }
  100% { transform: translateY(0) rotate(-1.5deg); }
`;

const launchUp = keyframes`
  0% {
    transform: translateY(0) scale(1) rotate(0deg);
    opacity: 1;
    filter: brightness(1);
  }
  35% {
    transform: translateY(-18vh) scale(1.05) rotate(-4deg);
    opacity: 1;
    filter: brightness(1.15);
  }
  100% {
    transform: translateY(-140vh) scale(0.85) rotate(-8deg);
    opacity: 0;
    filter: brightness(1.4);
  }
`;

const returnFromBottom = keyframes`
  0% {
    transform: translateY(140vh) scale(0.9) rotate(6deg);
    opacity: 0;
  }
  70% {
    transform: translateY(-12px) scale(1.02) rotate(-1deg);
    opacity: 1;
  }
  100% {
    transform: translateY(0) scale(1) rotate(0deg);
    opacity: 1;
  }
`;

const flameFlicker = keyframes`
  0%   { transform: translateX(-50%) scaleY(1) scaleX(1); opacity: 0.95; }
  40%  { transform: translateX(-50%) scaleY(1.35) scaleX(0.88); opacity: 1; }
  70%  { transform: translateX(-50%) scaleY(0.92) scaleX(1.08); opacity: 0.85; }
  100% { transform: translateX(-50%) scaleY(1) scaleX(1); opacity: 0.95; }
`;

const smokeRise = keyframes`
  0% {
    transform: translateY(0) scale(0.6);
    opacity: 0.35;
  }
  100% {
    transform: translateY(-40px) scale(1.4);
    opacity: 0;
  }
`;

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 140, 0, 0.35); }
  50% { box-shadow: 0 0 28px 8px rgba(255, 140, 0, 0.18); }
`;

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const AboutUs = () => {
  const theme = useTheme();
  const [status, setStatus] = useState("idle");
  const busyRef = useRef(false);
  const isDark = theme.palette.mode === "dark";

  const handleClick = () => {
    if (busyRef.current || status !== "idle") return;
    busyRef.current = true;
    setStatus("launching");

    window.setTimeout(() => {
      setStatus("returning");
      window.setTimeout(() => {
        setStatus("idle");
        busyRef.current = false;
      }, 1700);
    }, 1100);
  };

  const rocketAnimation =
    status === "launching"
      ? `${launchUp} 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards`
      : status === "returning"
        ? `${returnFromBottom} 1.7s cubic-bezier(0.22, 1, 0.36, 1) forwards`
        : "none";

  const showFrame = status === "idle";
  const cardBg = isDark
    ? "linear-gradient(160deg, rgba(15,23,42,0.92), rgba(8,15,28,0.96))"
    : "linear-gradient(160deg, #ffffff, #f3f7ff)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)";

  return (
    <Box
      sx={{
        py: { xs: 6, md: 10 },
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: isDark
          ? "radial-gradient(ellipse at 20% 30%, rgba(30,58,95,0.35), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(15,118,110,0.18), transparent 50%), #050b16"
          : "radial-gradient(ellipse at 15% 20%, rgba(99,102,241,0.12), transparent 50%), radial-gradient(ellipse at 85% 75%, rgba(8,145,178,0.1), transparent 45%), #f7faff",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1.1fr" },
            alignItems: "center",
            gap: { xs: 5, md: 8 },
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              animation: `${fadeSlide} 0.7s ease both`,
            }}
          >
            <Box
              onClick={handleClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClick();
              }}
              aria-label="Launch rocket animation"
              sx={{
                position: "relative",
                width: { xs: 160, sm: 200, md: 240 },
                p: 2,
                borderRadius: 3,
                background: showFrame
                  ? alpha(theme.palette.background.paper, isDark ? 0.25 : 0.55)
                  : "transparent",
                border: "1px solid",
                borderColor: showFrame ? border : "transparent",
                boxShadow: showFrame
                  ? isDark
                    ? "0 8px 28px rgba(0,0,0,0.25)"
                    : "0 8px 28px rgba(15,23,42,0.06)"
                  : "none",
                cursor: status === "idle" ? "pointer" : "default",
                outline: "none",
                transition:
                  "border-color 0.35s ease, background 0.35s ease, box-shadow 0.35s ease",
                "&:hover": showFrame
                  ? {
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      background: alpha(
                        theme.palette.background.paper,
                        isDark ? 0.35 : 0.7
                      ),
                    }
                  : {},
                "&:hover .hint": {
                  opacity: status === "idle" ? 1 : 0,
                  transform:
                    status === "idle" ? "translate(-50%, -8px)" : "translate(-50%, 0)",
                },
                "&:focus-visible": {
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.45)}`,
                },
              }}
            >
              <Typography
                className="hint"
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translate(-50%, 0)",
                  opacity: 0,
                  transition: "all 0.35s ease",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  color: "text.secondary",
                  letterSpacing: "0.02em",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              >
                Click to launch
              </Typography>

              <Box
                sx={{
                  position: "relative",
                  width: "100%",
                  animation: rocketAnimation,
                }}
              >
                <Box
                  sx={{
                    animation:
                      status === "idle" ? `${float} 4.5s ease-in-out infinite` : "none",
                    position: "relative",
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      width: "100%",
                      lineHeight: 0,
                      borderRadius: 2,
                      animation:
                        status === "idle"
                          ? `${pulseGlow} 2.8s ease-in-out infinite`
                          : "none",
                    }}
                  >
                    <Box
                      component="img"
                      src={Rocket}
                      alt="Rocket"
                      draggable={false}
                      sx={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                        userSelect: "none",
                        position: "relative",
                        zIndex: 1,
                        borderRadius: 1.5,
                        filter:
                          status === "launching"
                            ? "drop-shadow(0 0 18px rgba(255,160,40,0.55))"
                            : "drop-shadow(0 12px 24px rgba(0,0,0,0.25))",
                        transition: "filter 0.3s ease",
                      }}
                    />

                    <Box
                      sx={{
                        position: "absolute",
                        left: "50%",
                        bottom: "4%",
                        transform: "translateX(-50%)",
                        width: status === "launching" ? "20%" : "15%",
                        height: status === "launching" ? "26%" : "18%",
                        minWidth: 20,
                        minHeight: 32,
                        borderRadius: "45% 45% 50% 50%",
                        background:
                          "radial-gradient(circle at 50% 12%, #fffde7 0%, #ffe082 22%, #ff9800 50%, #ff3d00 75%, transparent 100%)",
                        animation: `${flameFlicker} 0.28s ease-in-out infinite`,
                        filter: "blur(1px)",
                        opacity: status === "returning" ? 0.35 : 1,
                        transition:
                          "width 0.25s ease, height 0.25s ease, opacity 0.3s ease",
                        boxShadow:
                          status === "launching"
                            ? "0 6px 30px 8px rgba(255,120,0,0.55)"
                            : "0 3px 18px 4px rgba(255,120,0,0.4)",
                        pointerEvents: "none",
                        zIndex: 3,
                        transformOrigin: "center top",
                      }}
                    />

                    {(status === "launching" || status === "idle") &&
                      [0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          sx={{
                            position: "absolute",
                            left: `calc(50% + ${(i - 1) * 8}px)`,
                            bottom: `${-2 - i * 5}%`,
                            transform: "translateX(-50%)",
                            width: 12 + i * 3,
                            height: 12 + i * 3,
                            borderRadius: "50%",
                            bgcolor: alpha("#94a3b8", isDark ? 0.28 : 0.4),
                            filter: "blur(4px)",
                            animation: `${smokeRise} ${1.2 + i * 0.25}s ease-out infinite`,
                            animationDelay: `${i * 0.18}s`,
                            opacity: status === "launching" ? 0.75 : 0.3,
                            pointerEvents: "none",
                            zIndex: 2,
                          }}
                        />
                      ))}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ animation: `${fadeSlide} 0.75s ease 0.1s both` }}>
            <Typography
              variant="overline"
              sx={{
                fontWeight: 800,
                letterSpacing: "0.14em",
                color: "primary.main",
                display: "block",
                mb: 1,
              }}
            >
              ABOUT THE PROJECT
            </Typography>

            <Typography
              component="h1"
              variant="h3"
              sx={{
                fontWeight: 900,
                letterSpacing: "-0.03em",
                mb: 2,
                fontSize: { xs: "1.85rem", sm: "2.35rem", md: "2.75rem" },
                background: isDark
                  ? "linear-gradient(90deg, #e2e8f0, #7dd3fc)"
                  : "linear-gradient(90deg, #0f172a, #3730a3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              PaaS Deployer
            </Typography>

            <Typography
              component="h2"
              variant="subtitle1"
              sx={{ fontWeight: 800, mb: 1 }}
            >
              A focused deployment platform
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ lineHeight: 1.75, mb: 2.5, maxWidth: 520 }}
            >
              A focused deployment platform. It takes your services, runs them, and keeps them
              stable — without the noise. Plans, services, networks and volumes in one modern
              control panel.
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.7, mb: 3.5, maxWidth: 520, opacity: 0.9 }}
            >
              Built as an open-source stack: Django API for orchestration and a React frontend for
              a clean operator experience.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 3 }}>
              <Button
                component="a"
                href={GITHUB_API}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                startIcon={<GitHubIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 2.5,
                  py: 1.15,
                  background: isDark
                    ? "linear-gradient(90deg, #1e3a5f, #0f766e)"
                    : "linear-gradient(90deg, #312e81, #0e7490)",
                }}
              >
                Backend API
              </Button>
              <Button
                component="a"
                href={GITHUB_FRONTEND}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                startIcon={<GitHubIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 2.5,
                  py: 1.15,
                  borderColor: border,
                  color: "text.primary",
                }}
              >
                Frontend (React)
              </Button>
            </Stack>

            <Paper
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: 2,
                background: cardBg,
                border: `1px solid ${border}`,
                maxWidth: 520,
              }}
            >
              <Stack spacing={1.25}>
                {[
                  "Plan-based resource limits (CPU, RAM, storage)",
                  "Service lifecycle: create, start, stop, monitor",
                  "Networks & volumes as first-class resources",
                ].map((line) => (
                  <Stack key={line} direction="row" spacing={1.25} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        mt: 0.7,
                        flexShrink: 0,
                        bgcolor: "primary.main",
                        boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.2)}`,
                      }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                      {line}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AboutUs;