import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";

import { useNavigate } from "react-router-dom";

import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  alpha,
} from "@mui/material";

import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import GitHubIcon from "@mui/icons-material/GitHub";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import EastRoundedIcon from "@mui/icons-material/EastRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import CloudDoneRoundedIcon from "@mui/icons-material/CloudDoneRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import AttachMoneyRoundedIcon from "@mui/icons-material/AttachMoneyRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import MoreHorizRoundedIcon from "@mui/icons-material/MoreHorizRounded";

import {
  SiReact,
  SiDjango,
  SiNodedotjs,
  SiFlask,
  SiPostgresql,
  SiRedis,
  SiDocker,
} from "react-icons/si";

import heroImage from "../../assets/main-image.webp";

const GITHUB_API =
  "https://github.com/nima-salamat/django-paas-deployer";

const GITHUB_FRONTEND =
  "https://github.com/nima-salamat/react-paas-deployer";

const DEFAULT_ICON = "/icon.svg";

const ORBIT_STORAGE_KEY =
  "home_orbit_animation";

/* ============================================================
   DATA
============================================================ */

const applicationStack = [
  {
    name: "React",
    role: "Frontend",
    icon: SiReact,
  },
  {
    name: "Django",
    role: "Backend",
    icon: SiDjango,
  },
  {
    name: "Node.js",
    role: "Runtime",
    icon: SiNodedotjs,
  },
  {
    name: "Flask",
    role: "Python API",
    icon: SiFlask,
  },
];

const dataStack = [
  {
    name: "PostgreSQL",
    role: "Database",
    icon: SiPostgresql,
  },
  {
    name: "Redis",
    role: "Cache & queues",
    icon: SiRedis,
  },
];

const workflow = [
  {
    id: "01",
    title: "Choose the resources you need",
    description:
      "Pick CPU, memory and storage that fit your workload, then change plans whenever your needs change.",
    icon: TuneRoundedIcon,
    accent: "#60a5fa",
  },
  {
    id: "02",
    title: "Create a service",
    description:
      "Set up your application, configuration and runtime without assembling deployment infrastructure by hand.",
    icon: TerminalRoundedIcon,
    accent: "#818cf8",
  },
  {
    id: "03",
    title: "Deploy faster",
    description:
      "Move from configured service to a running deployment with a repeatable workflow and less manual work.",
    icon: RocketLaunchRoundedIcon,
    accent: "#a78bfa",
  },
  {
    id: "04",
    title: "Manage everything in one place",
    description:
      "Monitor services, manage networks and persistent volumes, restart workloads and adjust resources from one control surface.",
    icon: CloudDoneRoundedIcon,
    accent: "#38bdf8",
  },
];

/* ============================================================
   SECTION REVEAL
============================================================ */

function SectionReveal({
  children,
  delay = 0,
  y = 30,
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.15,
      }}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

/* ============================================================
   GLOW ORB
============================================================ */

function GlowOrb({
  size = 300,
  top,
  left,
  right,
  bottom,
  color,
  opacity = 0.12,
}) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        width: size,
        height: size,
        top,
        left,
        right,
        bottom,
        borderRadius: "50%",
        background: color,
        opacity,
        filter: "blur(80px)",
        pointerEvents: "none",
      }}
    />
  );
}

/* ============================================================
   ORBIT DOTS
============================================================ */

function OrbitDots({
  color,
  count = 18,
  active = true,
}) {
  const dots = useMemo(
    () =>
      Array.from(
        { length: count },
        (_, index) => ({
          index,
          size:
            4 + (index % 3) * 2,
          radius:
            46 + (index % 4) * 4,
          duration:
            12 + (index % 5) * 2.5,
          delay:
            -(index * 0.45),
          opacity:
            0.35 +
            (index % 4) * 0.12,
        })
      ),
    [count]
  );

  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        opacity: active ? 1 : 0.25,
        transition:
          "opacity 350ms ease",
      }}
    >
      {dots.map((dot) => (
        <Box
          key={dot.index}
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: {
              xs: `${dot.radius * 1.28}%`,
              md: `${dot.radius}%`,
            },
            height: 0,
            transformOrigin:
              "left center",
          }}
        >
          <motion.div
            animate={
              active
                ? { rotate: 360 }
                : { rotate: 0 }
            }
            transition={{
              duration:
                dot.duration,
              delay: dot.delay,
              repeat: active
                ? Infinity
                : 0,
              ease: "linear",
            }}
            style={{
              position:
                "absolute",
              inset: 0,
              transformOrigin:
                "left center",
            }}
          >
            <Box
              sx={{
                position:
                  "absolute",
                right: 0,
                top: "50%",
                width: dot.size,
                height: dot.size,
                transform:
                  "translate(50%, -50%)",
                borderRadius: "50%",
                bgcolor: color,
                opacity: active
                  ? dot.opacity
                  : dot.opacity * 0.4,
                boxShadow: active
                  ? `0 0 18px ${alpha(
                      color,
                      0.72
                    )}`
                  : `0 0 8px ${alpha(
                      color,
                      0.25
                    )}`,
              }}
            />
          </motion.div>
        </Box>
      ))}
    </Box>
  );
}

/* ============================================================
   STACK ITEM
============================================================ */

function StackItem({
  item,
  theme,
  isDark,
  direction = "left",
}) {
  const Icon = item.icon;

  return (
    <motion.div
      initial={{
        opacity: 0,
        x:
          direction === "left"
            ? -18
            : 18,
      }}
      whileInView={{
        opacity: 1,
        x: 0,
      }}
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.5,
      }}
      whileHover={{
        y: -3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1.35,
          borderRadius: 3,
          border: "1px solid",
          borderColor: isDark
            ? "rgba(255,255,255,0.07)"
            : "rgba(15,23,42,0.07)",
          bgcolor: isDark
            ? "rgba(255,255,255,0.025)"
            : "rgba(255,255,255,0.62)",
          transition:
            "all 180ms ease",
          "&:hover": {
            borderColor: alpha(
              theme.palette.primary.main,
              0.24
            ),
            bgcolor: alpha(
              theme.palette.primary.main,
              isDark ? 0.045 : 0.03
            ),
          },
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 46,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: isDark
              ? "rgba(255,255,255,0.07)"
              : "rgba(15,23,42,0.06)",
            bgcolor: isDark
              ? "rgba(255,255,255,0.045)"
              : "rgba(255,255,255,0.8)",
          }}
        >
          <Icon size="1.85rem" />
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.92rem",
              fontWeight: 850,
              lineHeight: 1.2,
            }}
          >
            {item.name}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
          >
            {item.role}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function subtleBorderFor(isDark) {
  return isDark
    ? "rgba(255,255,255,0.07)"
    : "rgba(15,23,42,0.07)";
}

/* ============================================================
   SERVICE PREVIEW
============================================================ */

function ServicePreview({
  theme,
  isDark,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: {
          xs: 4,
          md: 5,
        },
        border: "1px solid",
        borderColor: isDark
          ? "rgba(255,255,255,0.075)"
          : "rgba(15,23,42,0.075)",
        background: isDark
          ? `
            radial-gradient(
              circle at 85% 0%,
              rgba(59,130,246,.11),
              transparent 27%
            ),
            linear-gradient(
              145deg,
              rgba(14,24,40,.98),
              rgba(7,14,25,.99)
            )
          `
          : `
            radial-gradient(
              circle at 85% 0%,
              rgba(59,130,246,.065),
              transparent 27%
            ),
            linear-gradient(
              145deg,
              #ffffff,
              #f7faff
            )
          `,
        boxShadow: isDark
          ? "0 30px 90px rgba(0,0,0,.26)"
          : "0 30px 90px rgba(15,23,42,.08)",
      }}
    >
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          width: 240,
          height: 240,
          top: -150,
          right: -90,
          borderRadius: "50%",
          background: alpha(
            theme.palette.primary.main,
            isDark ? 0.09 : 0.05
          ),
          filter: "blur(55px)",
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          p: {
            xs: 2,
            sm: 2.5,
            md: 3,
          },
        }}
      >
        {/* Header */}

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
          spacing={2}
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                bgcolor: isDark
                  ? "rgba(99,102,241,.15)"
                  : "rgba(99,102,241,.09)",
                color:
                  "primary.main",
                border: "1px solid",
                borderColor: isDark
                  ? "rgba(255,255,255,.06)"
                  : "rgba(15,23,42,.055)",
              }}
            >
              <AppsRoundedIcon />
            </Box>

            <Box
              sx={{
                minWidth: 0,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: "1rem",
                  lineHeight: 1.25,
                  wordBreak:
                    "break-word",
                }}
              >
                api-service
              </Typography>

              <Stack
                direction="row"
                spacing={0.7}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{
                  mt: 0.5,
                }}
              >
                <Chip
                  size="small"
                  icon={
                    <AppsRoundedIcon
                      sx={{
                        fontSize: 13,
                      }}
                    />
                  }
                  label="App · django"
                  sx={{
                    height: 22,
                    fontSize:
                      "10.5px",
                    fontWeight: 800,
                  }}
                />

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  production
                </Typography>
              </Stack>
            </Box>
          </Stack>

          <Chip
            label="Running"
            color="success"
            size="small"
            sx={{
              height: 24,
              fontWeight: 850,
              flexShrink: 0,
            }}
          />
        </Stack>

        <Divider
          sx={{
            my: 2.25,
            borderColor:
              isDark
                ? "rgba(255,255,255,.07)"
                : "rgba(15,23,42,.07)",
          }}
        />

        {/* Network */}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            color:
              "text.secondary",
          }}
        >
          <HubRoundedIcon
            sx={{
              fontSize: 16,
            }}
          />

          <Typography
            variant="body2"
            fontWeight={700}
          >
            production-network
          </Typography>

          <Box
            sx={{
              width: 4,
              height: 4,
              borderRadius:
                "50%",
              bgcolor:
                "text.disabled",
            }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
          >
            healthy
          </Typography>
        </Stack>

        {/* Resources */}

        <Box
          sx={{
            mt: 2,
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr 1fr",
              sm: "repeat(4, 1fr)",
            },
            gap: 1,
          }}
        >
          {[
            [
              "CPU",
              "1 CPU",
              ComputerRoundedIcon,
            ],
            [
              "RAM",
              "512 MB",
              MemoryRoundedIcon,
            ],
            [
              "Storage",
              "10 GB",
              StorageRoundedIcon,
            ],
            [
              "Price",
              "$0.018/hr",
              AttachMoneyRoundedIcon,
            ],
          ].map(
            ([label, value, Icon]) => (
              <Box
                key={label}
                sx={{
                  p: 1.35,
                  borderRadius: 2.5,
                  border: "1px solid",
                  borderColor:
                    subtleBorderFor(
                      isDark
                    ),
                  bgcolor: isDark
                    ? "rgba(255,255,255,.025)"
                    : "rgba(15,23,42,.02)",
                }}
              >
                <Stack
                  direction="row"
                  spacing={0.7}
                  alignItems="center"
                >
                  <Icon
                    sx={{
                      fontSize: 15,
                      color:
                        "text.secondary",
                    }}
                  />

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    {label}
                  </Typography>
                </Stack>

                <Typography
                  sx={{
                    mt: 0.7,
                    fontWeight: 850,
                    fontSize:
                      "0.82rem",
                  }}
                >
                  {value}
                </Typography>
              </Box>
            )
          )}
        </Box>

        {/* Usage */}

        <Box
          sx={{
            mt: 2.2,
          }}
        >
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={{
              xs: 1.4,
              sm: 2,
            }}
          >
            <ServiceUsage
              label="CPU"
              value={32}
              iconColor="#60a5fa"
              isDark={isDark}
            />

            <ServiceUsage
              label="RAM"
              value={48}
              iconColor="#a78bfa"
              isDark={isDark}
            />
          </Stack>
        </Box>

        {/* Actions */}

        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          spacing={1}
          sx={{
            mt: 2.25,
          }}
        >
          <Button
            variant="contained"
            color="error"
            startIcon={
              <StopRoundedIcon />
            }
            sx={{
              flex: 1,
              borderRadius: 2.25,
              textTransform:
                "none",
              fontWeight: 800,
            }}
          >
            Stop
          </Button>

          <Button
            variant="contained"
            startIcon={
              <LaunchRoundedIcon />
            }
            sx={{
              flex: 1,
              borderRadius: 2.25,
              textTransform:
                "none",
              fontWeight: 800,
            }}
          >
            Open
          </Button>

          <Button
            variant="outlined"
            startIcon={
              <EditRoundedIcon />
            }
            sx={{
              flex: 1,
              borderRadius: 2.25,
              textTransform:
                "none",
              fontWeight: 750,
              borderColor:
                subtleBorderFor(isDark),
            }}
          >
            Edit
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

function ServiceUsage({
  label,
  value,
  iconColor,
  isDark,
}) {
  return (
    <Box sx={{ flex: 1 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{
          mb: 0.7,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
        >
          {label}
        </Typography>

        <Typography
          variant="caption"
          sx={{
            fontWeight: 850,
          }}
        >
          {value}%
        </Typography>
      </Stack>

      <Box
        sx={{
          height: 6,
          borderRadius: 999,
          bgcolor: isDark
            ? "rgba(255,255,255,.07)"
            : "rgba(15,23,42,.07)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{
            width: 0,
          }}
          whileInView={{
            width: `${value}%`,
          }}
          viewport={{
            once: true,
          }}
          transition={{
            duration: 0.8,
            ease: [
              0.22,
              1,
              0.36,
              1,
            ],
          }}
          style={{
            height: "100%",
            borderRadius: 999,
            background:
              `linear-gradient(90deg, ${iconColor}, ${iconColor}cc)`,
          }}
        />
      </Box>
    </Box>
  );
}

/* ============================================================
   HOME
============================================================ */

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();

  const isXs = useMediaQuery(
    theme.breakpoints.down("sm")
  );

  const isMdDown = useMediaQuery(
    theme.breakpoints.down("md")
  );

  const isDark =
    theme.palette.mode === "dark";

  const [loggedIn, setLoggedIn] =
    useState(() => {
      if (typeof window === "undefined") {
        return false;
      }

      try {
        return Boolean(
          window.localStorage.getItem("access")
        );
      } catch {
        return false;
      }
    });

  const [orbitActive, setOrbitActive] =
    useState(() => {
      if (typeof window === "undefined") {
        return true;
      }

      try {
        const saved =
          window.localStorage.getItem(
            ORBIT_STORAGE_KEY
          );

        return saved === null
          ? true
          : saved === "true";
      } catch {
        return true;
      }
    });

  const { scrollY } = useScroll();

  /* Only the image moves slightly. */
  const heroImageY = useTransform(
    scrollY,
    [0, 900],
    [0, 42]
  );

  /* ==========================================================
     AUTH
  ========================================================== */

  useEffect(() => {
    const syncAuth = () => {
      setLoggedIn(
        Boolean(
          window.localStorage.getItem(
            "access"
          )
        )
      );
    };

    window.addEventListener(
      "auth-changed",
      syncAuth
    );

    window.addEventListener(
      "storage",
      syncAuth
    );

    return () => {
      window.removeEventListener(
        "auth-changed",
        syncAuth
      );

      window.removeEventListener(
        "storage",
        syncAuth
      );
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ORBIT_STORAGE_KEY,
        String(orbitActive)
      );
    } catch {
      // Ignore storage errors.
    }
  }, [orbitActive]);

  /* ==========================================================
     COLORS
  ========================================================== */

  const subtleBorder = isDark
    ? "rgba(255,255,255,0.075)"
    : "rgba(15,23,42,0.075)";

  const pageBackground = isDark
    ? `
      radial-gradient(
        circle at 50% -8%,
        rgba(37,99,235,0.13),
        transparent 30%
      ),
      linear-gradient(
        180deg,
        #040811 0%,
        #07101c 30%,
        #06101a 67%,
        #040911 100%
      )
    `
    : `
      radial-gradient(
        circle at 50% -8%,
        rgba(79,70,229,0.09),
        transparent 30%
      ),
      linear-gradient(
        180deg,
        #fbfdff 0%,
        #f3f7ff 30%,
        #eef5ff 67%,
        #f8fbff 100%
      )
    `;

  const heroMask = isDark
    ? isXs
      ? "radial-gradient(ellipse 98% 94% at 50% 48%, #000 68%, transparent 96%)"
      : isMdDown
      ? "radial-gradient(ellipse 94% 88% at 50% 48%, #000 72%, transparent 95%)"
      : "radial-gradient(ellipse 92% 86% at 50% 48%, #000 75%, transparent 94%)"
    : "none";

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        color: "text.primary",
        background:
          pageBackground,
        overflow: "clip",
      }}
    >
      {/* ======================================================
          HERO
      ======================================================= */}

      <Box
        component="section"
        sx={{
          position: "relative",
          minHeight: {
            xs: "auto",
            md: "92vh",
          },
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <GlowOrb
          size={420}
          top="-160px"
          left="50%"
          color={
            isDark
              ? "#2563eb"
              : "#4f46e5"
          }
          opacity={
            isDark ? 0.11 : 0.06
          }
        />

        <Container
          maxWidth="lg"
          sx={{
            position: "relative",
            zIndex: 2,
          }}
        >
          <Box>
            <Stack
              alignItems="center"
              textAlign="center"
              sx={{
                pt: {
                  xs: 7,
                  md: 9,
                },
                pb: {
                  xs: 6,
                  md: 4,
                },
              }}
            >
              {/* BRAND */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: -10,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.55,
                }}
              >
                <Box
                  sx={{
                    display:
                      "inline-flex",
                    alignItems:
                      "center",
                    gap: 1,
                    px: 1.2,
                    py: 0.65,
                    borderRadius: 999,
                    border: "1px solid",
                    borderColor:
                      alpha(
                        theme.palette
                          .primary.main,
                        isDark
                          ? 0.2
                          : 0.13
                      ),
                    bgcolor:
                      alpha(
                        theme.palette
                          .primary.main,
                        isDark
                          ? 0.065
                          : 0.045
                      ),
                    backdropFilter:
                      "blur(16px)",
                  }}
                >
                  <Box
                    component="img"
                    src={DEFAULT_ICON}
                    alt=""
                    sx={{
                      width: 22,
                      height: 22,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize:
                        "0.78rem",
                      fontWeight:
                        850,
                      color:
                        "primary.main",
                    }}
                  >
                    PassDeployer
                  </Typography>

                  <Box
                    sx={{
                      width: 5,
                      height: 5,
                      borderRadius:
                        "50%",
                      bgcolor:
                        "success.main",
                      boxShadow:
                        "0 0 10px rgba(34,197,94,.65)",
                    }}
                  />
                </Box>
              </motion.div>

              {/* TITLE */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 22,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.7,
                  delay: 0.08,
                }}
              >
                <Typography
                  component="h1"
                  sx={{
                    mt: 3.2,
                    maxWidth: 980,
                    fontSize: {
                      xs: "2.7rem",
                      sm: "3.8rem",
                      md: "5.25rem",
                    },
                    lineHeight:
                      0.94,
                    letterSpacing:
                      "-0.075em",
                    fontWeight:
                      950,
                  }}
                >
                  Deploy faster.
                  <br />
                  Manage more. Worry less.
                </Typography>
              </motion.div>

              {/* SUBTITLE */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 18,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.65,
                  delay: 0.18,
                }}
              >
                <Typography
                  sx={{
                    mt: 2.5,
                    maxWidth: 670,
                    fontSize: {
                      xs: "0.98rem",
                      sm: "1.05rem",
                      md: "1.12rem",
                    },
                    lineHeight:
                      1.8,
                    color:
                      "text.secondary",
                  }}
                >
                  <strong>Deploy and manage applications</strong> without the usual infrastructure busywork.
                  Create services quickly, choose the resources you need, connect networks,
                  keep persistent volumes, and change plans whenever your workload grows.
                </Typography>
              </motion.div>

              {/* ACTIONS */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: 16,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.65,
                  delay: 0.28,
                }}
              >
                <Stack
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  spacing={1.25}
                  sx={{
                    mt: 3.2,
                  }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() =>
                      navigate(
                        "/plans"
                      )
                    }
                    endIcon={
                      <ArrowForwardRoundedIcon />
                    }
                    sx={{
                      minWidth: 188,
                      minHeight: 52,
                      px: 3,
                      borderRadius: 3,
                      textTransform:
                        "none",
                      fontWeight:
                        850,
                      background:
                        isDark
                          ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                          : "linear-gradient(135deg,#4f46e5,#2563eb)",
                      boxShadow:
                        isDark
                          ? "0 16px 42px rgba(37,99,235,.28)"
                          : "0 16px 42px rgba(79,70,229,.18)",
                    }}
                  >
                    Start deploying
                  </Button>

                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() =>
                      document
                        .getElementById(
                          "stack"
                        )
                        ?.scrollIntoView({
                          behavior:
                            "smooth",
                        })
                    }
                    endIcon={
                      <EastRoundedIcon />
                    }
                    sx={{
                      minWidth: 188,
                      minHeight: 52,
                      px: 3,
                      borderRadius: 3,
                      textTransform:
                        "none",
                      fontWeight:
                        750,
                      borderColor:
                        subtleBorder,
                      bgcolor:
                        alpha(
                          theme.palette
                            .background
                            .paper,
                          isDark
                            ? 0.24
                            : 0.58
                        ),
                      backdropFilter:
                        "blur(14px)",
                    }}
                  >
                    Explore platform
                  </Button>
                </Stack>
              </motion.div>

              {/* HERO IMAGE */}

              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.975,
                  y: 24,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.9,
                  delay: 0.38,
                  ease: [
                    0.22,
                    1,
                    0.36,
                    1,
                  ],
                }}
                style={{
                  width: "100%",
                }}
              >
                <Box
                  sx={{
                    position:
                      "relative",
                    width: {
                      xs: "100%",
                      md: "89%",
                      lg: "82%",
                    },
                    maxWidth: 1120,
                    mx: "auto",
                    mt: {
                      xs: 4,
                      md: 5.5,
                    },
                  }}
                >
                  {/* HALO */}

                  <Box
                    aria-hidden
                    sx={{
                      position:
                        "absolute",
                      inset: {
                        xs: -14,
                        md: -28,
                      },
                      borderRadius: {
                        xs: 5,
                        md: 7,
                      },
                      background:
                        isDark
                          ? `
                            radial-gradient(
                              ellipse at 50% 45%,
                              rgba(37,99,235,0.20),
                              rgba(37,99,235,0.07) 42%,
                              transparent 72%
                            )
                          `
                          : `
                            radial-gradient(
                              ellipse at 50% 46%,
                              rgba(37,99,235,0.11),
                              rgba(99,102,241,0.045) 38%,
                              transparent 72%
                            )
                          `,
                      filter: {
                        xs: "blur(22px)",
                        md: "blur(34px)",
                      },
                      opacity:
                        isDark
                          ? 0.9
                          : 0.8,
                      pointerEvents:
                        "none",
                    }}
                  />

                  <OrbitDots
                    color={
                      isDark
                        ? "#60a5fa"
                        : "#2563eb"
                    }
                    active={
                      orbitActive
                    }
                  />

                  {/* IMAGE PARALLAX */}

                  <motion.div
                    style={{
                      y: heroImageY,
                      position:
                        "relative",
                      zIndex: 2,
                    }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        position:
                          "relative",
                        overflow:
                          "hidden",
                        borderRadius: {
                          xs: 3.5,
                          md: 5.5,
                        },
                        border: "1px solid",
                        borderColor:
                          isDark
                            ? "rgba(255,255,255,0.075)"
                            : "rgba(15,23,42,0.07)",
                        background:
                          isDark
                            ? "#08111e"
                            : "#edf4ff",
                        boxShadow:
                          isDark
                            ? "0 35px 100px rgba(0,0,0,0.36)"
                            : "0 30px 80px rgba(30,64,175,0.10)",
                        transform:
                          "translateZ(0)",
                      }}
                    >
                      <Box
                        sx={{
                          position:
                            "relative",
                          aspectRatio: {
                            xs: "4 / 3",
                            sm: "16 / 9",
                          },
                          minHeight: {
                            xs: 300,
                            sm: 350,
                            md: 470,
                          },
                        }}
                      >
                        <Box
                          component="img"
                          src={
                            heroImage
                          }
                          alt="PassDeployer"
                          sx={{
                            position:
                              "absolute",
                            inset: 0,
                            width:
                              "100%",
                            height:
                              "100%",
                            display:
                              "block",
                            objectFit:
                              "cover",
                            objectPosition:
                              {
                                xs: "center 43%",
                                sm: "center center",
                                md: "center center",
                              },
                            WebkitMaskImage:
                              heroMask,
                            maskImage:
                              heroMask,
                            transform:
                              "translateZ(0)",
                          }}
                        />

                        {/* OVERLAY */}

                        <Box
                          sx={{
                            position:
                              "absolute",
                            inset: 0,
                            pointerEvents:
                              "none",
                            background:
                              isDark
                                ? `
                                  linear-gradient(
                                    180deg,
                                    rgba(3,8,16,0.00) 0%,
                                    rgba(3,8,16,0.02) 42%,
                                    rgba(3,8,16,0.72) 100%
                                  )
                                `
                                : `
                                  linear-gradient(
                                    180deg,
                                    rgba(255,255,255,0.00) 0%,
                                    rgba(255,255,255,0.00) 72%,
                                    rgba(235,243,255,0.16) 100%
                                  )
                                `,
                          }}
                        />

                        {/* LIGHT INNER GLOW */}

                        {!isDark && (
                          <Box
                            aria-hidden
                            sx={{
                              position:
                                "absolute",
                              inset: 0,
                              pointerEvents:
                                "none",
                              background:
                                `
                                  radial-gradient(
                                    ellipse at center,
                                    transparent 50%,
                                    rgba(255,255,255,0.05) 82%,
                                    rgba(255,255,255,0.09) 100%
                                  )
                                `,
                              opacity: 0.55,
                            }}
                          />
                        )}

                        {/* DARK BOTTOM */}

                        {isDark && (
                          <Box
                            aria-hidden
                            sx={{
                              position:
                                "absolute",
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: {
                                xs: 80,
                                md: 120,
                              },
                              background:
                                "linear-gradient(180deg, transparent, rgba(3,8,15,0.55))",
                              pointerEvents:
                                "none",
                            }}
                          />
                        )}

                        {/* STATUS */}

                        <Paper
                          elevation={0}
                          sx={{
                            position:
                              "absolute",
                            left: {
                              xs: 12,
                              md: 22,
                            },
                            bottom: {
                              xs: 12,
                              md: 22,
                            },
                            px: 1.35,
                            py: 1,
                            borderRadius:
                              2.5,
                            border:
                              "1px solid",
                            borderColor:
                              isDark
                                ? "rgba(255,255,255,.13)"
                                : "rgba(15,23,42,.10)",
                            bgcolor:
                              isDark
                                ? "rgba(5,12,24,.62)"
                                : "rgba(255,255,255,.78)",
                            color:
                              isDark
                                ? "#fff"
                                : "#0f172a",
                            backdropFilter:
                              "blur(18px)",
                            zIndex: 4,
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius:
                                  "50%",
                                bgcolor:
                                  "#22c55e",
                                boxShadow:
                                  "0 0 12px rgba(34,197,94,.7)",
                              }}
                            />

                            <Typography
                              sx={{
                                fontSize:
                                  "0.72rem",
                                fontWeight:
                                  800,
                              }}
                            >
                              deployment
                              ready
                            </Typography>
                          </Stack>
                        </Paper>
                      </Box>
                    </Paper>
                  </motion.div>

                  {/* PLAY / PAUSE */}

                  <Tooltip
                    title={
                      orbitActive
                        ? "Pause animation"
                        : "Play animation"
                    }
                  >
                    <IconButton
                      aria-label={
                        orbitActive
                          ? "Pause animation"
                          : "Play animation"
                      }
                      onClick={() =>
                        setOrbitActive(
                          (value) =>
                            !value
                        )
                      }
                      sx={{
                        position:
                          "absolute",
                        right: {
                          xs: 10,
                          md: 18,
                        },
                        top: {
                          xs: 10,
                          md: 18,
                        },
                        zIndex: 6,
                        width: 36,
                        height: 36,
                        bgcolor:
                          isDark
                            ? "rgba(5,12,24,.78)"
                            : "rgba(255,255,255,.88)",
                        border:
                          "1px solid",
                        borderColor:
                          subtleBorder,
                        backdropFilter:
                          "blur(14px)",
                      }}
                    >
                      {orbitActive ? (
                        <PauseRoundedIcon
                          sx={{
                            fontSize:
                              17,
                          }}
                        />
                      ) : (
                        <PlayArrowRoundedIcon
                          sx={{
                            fontSize:
                              19,
                          }}
                        />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>
              </motion.div>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ======================================================
          STACK ARCHITECTURE
      ======================================================= */}

      <Box
        id="stack"
        component="section"
        sx={{
          position: "relative",
          py: {
            xs: 8,
            md: 15,
          },
        }}
      >
        <GlowOrb
          size={340}
          top="16%"
          left="-180px"
          color="#2563eb"
          opacity={
            isDark ? 0.08 : 0.045
          }
        />

        <Container maxWidth="lg">
          <SectionReveal>
            <Stack
              alignItems="center"
              textAlign="center"
              spacing={1.5}
            >
              <Typography
                sx={{
                  color:
                    "primary.main",
                  fontWeight: 900,
                  fontSize:
                    "0.72rem",
                  letterSpacing:
                    "0.17em",
                  textTransform:
                    "uppercase",
                }}
              >
                THE PLATFORM
              </Typography>

              <Typography
                component="h2"
                sx={{
                  maxWidth: 750,
                  fontSize: {
                    xs: "2.15rem",
                    md: "3.35rem",
                  },
                  lineHeight:
                    1.02,
                  letterSpacing:
                    "-0.06em",
                  fontWeight: 950,
                }}
              >
                Your application.
                <br />
                One place for deployment and infrastructure.
              </Typography>

              <Typography
                color="text.secondary"
                sx={{
                  maxWidth: 650,
                  lineHeight:
                    1.85,
                }}
              >
                PassDeployer brings deployment and day-to-day service management
                into one control plane, so you spend less time wiring infrastructure
                together and more time shipping your application.
              </Typography>
            </Stack>
          </SectionReveal>

          <SectionReveal delay={0.08}>
            <Box
              sx={{
                position:
                  "relative",
                mt: {
                  xs: 5,
                  md: 7,
                },
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  position:
                    "relative",
                  overflow:
                    "hidden",
                  borderRadius: {
                    xs: 4,
                    md: 6,
                  },
                  border: "1px solid",
                  borderColor:
                    subtleBorder,
                  background:
                    isDark
                      ? `
                        radial-gradient(
                          circle at 50% 50%,
                          rgba(37,99,235,.08),
                          transparent 38%
                        ),
                        linear-gradient(
                          145deg,
                          rgba(11,20,35,.98),
                          rgba(5,12,22,.98)
                        )
                      `
                      : `
                        radial-gradient(
                          circle at 50% 50%,
                          rgba(37,99,235,.045),
                          transparent 38%
                        ),
                        linear-gradient(
                          145deg,
                          #ffffff,
                          #f4f8ff
                        )
                      `,
                  boxShadow:
                    isDark
                      ? "0 38px 100px rgba(0,0,0,.24)"
                      : "0 38px 100px rgba(15,23,42,.07)",
                }}
              >
                {/* CONNECTION LINE */}

                <Box
                  aria-hidden
                  sx={{
                    display: {
                      xs: "none",
                      md: "block",
                    },
                    position:
                      "absolute",
                    top: "50%",
                    left: "17%",
                    right: "17%",
                    height: 1,
                    transform:
                      "translateY(-50%)",
                    background:
                      isDark
                        ? `
                          linear-gradient(
                            90deg,
                            transparent,
                            rgba(96,165,250,.20),
                            rgba(167,139,250,.20),
                            transparent
                          )
                        `
                        : `
                          linear-gradient(
                            90deg,
                            transparent,
                            rgba(37,99,235,.12),
                            rgba(99,102,241,.12),
                            transparent
                          )
                        `,
                    pointerEvents:
                      "none",
                  }}
                />

                {/* NODES */}

                <Box
                  aria-hidden
                  sx={{
                    display: {
                      xs: "none",
                      md: "block",
                    },
                    position:
                      "absolute",
                    top: "50%",
                    left: "31%",
                    width: 6,
                    height: 6,
                    transform:
                      "translate(-50%, -50%)",
                    borderRadius:
                      "50%",
                    bgcolor:
                      isDark
                        ? "#60a5fa"
                        : "#3b82f6",
                    boxShadow:
                      "0 0 14px rgba(96,165,250,.5)",
                  }}
                />

                <Box
                  aria-hidden
                  sx={{
                    display: {
                      xs: "none",
                      md: "block",
                    },
                    position:
                      "absolute",
                    top: "50%",
                    right: "31%",
                    width: 6,
                    height: 6,
                    transform:
                      "translate(50%, -50%)",
                    borderRadius:
                      "50%",
                    bgcolor:
                      isDark
                        ? "#a78bfa"
                        : "#6366f1",
                    boxShadow:
                      "0 0 14px rgba(167,139,250,.5)",
                  }}
                />

                <Box
                  sx={{
                    position:
                      "relative",
                    zIndex: 1,
                    p: {
                      xs: 2.5,
                      sm: 3.5,
                      md: 4.5,
                    },
                  }}
                >
                  <Box
                    sx={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        {
                          xs: "1fr",
                          md: "1fr 220px 1fr",
                        },
                      gap: {
                        xs: 2.5,
                        md: 3,
                      },
                      alignItems:
                        "center",
                    }}
                  >
                    {/* APPLICATION */}

                    <Box>
                      <Stack
                        spacing={1.5}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius:
                                "50%",
                              bgcolor:
                                "#60a5fa",
                            }}
                          />

                          <Typography
                            sx={{
                              fontSize:
                                "0.72rem",
                              fontWeight:
                                900,
                              letterSpacing:
                                "0.13em",
                              textTransform:
                                "uppercase",
                              color:
                                "text.secondary",
                            }}
                          >
                            Application
                          </Typography>
                        </Stack>

                        <Typography
                          sx={{
                            fontSize: {
                              xs: "1.35rem",
                              md: "1.5rem",
                            },
                            fontWeight:
                              900,
                            letterSpacing:
                              "-0.04em",
                          }}
                        >
                          Build with what
                          you know.
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 400,
                            lineHeight:
                              1.75,
                          }}
                        >
                          Familiar frameworks
                          and runtimes, without
                          forcing a new development
                          model.
                        </Typography>

                        <Box
                          sx={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              {
                                xs:
                                  "1fr 1fr",
                                sm:
                                  "1fr 1fr",
                              },
                            gap: 1,
                            mt: 0.7,
                          }}
                        >
                          {applicationStack.map(
                            (item) => (
                              <StackItem
                                key={
                                  item.name
                                }
                                item={
                                  item
                                }
                                theme={
                                  theme
                                }
                                isDark={
                                  isDark
                                }
                                direction="left"
                              />
                            )
                          )}
                        </Box>
                      </Stack>
                    </Box>

                    {/* DEPLOYMENT */}

                    <Box
                      sx={{
                        display:
                          "flex",
                        justifyContent:
                          "center",
                        alignItems:
                          "center",
                        py: {
                          xs: 2,
                          md: 0,
                        },
                      }}
                    >
                      <motion.div
                        initial={{
                          opacity: 0,
                          scale: 0.88,
                        }}
                        whileInView={{
                          opacity: 1,
                          scale: 1,
                        }}
                        viewport={{
                          once: true,
                          amount: 0.3,
                        }}
                        transition={{
                          duration: 0.55,
                        }}
                      >
                        <Stack
                          alignItems="center"
                          spacing={1.4}
                        >
                          <Box
                            sx={{
                              position:
                                "relative",
                            }}
                          >
                            <Box
                              sx={{
                                position:
                                  "absolute",
                                inset: -28,
                                borderRadius:
                                  "50%",
                                bgcolor:
                                  alpha(
                                    theme
                                      .palette
                                      .primary
                                      .main,
                                    isDark
                                      ? 0.11
                                      : 0.055
                                  ),
                                filter:
                                  "blur(28px)",
                              }}
                            />

                            <Box
                              sx={{
                                position:
                                  "relative",
                                width: {
                                  xs: 92,
                                  md: 104,
                                },
                                height: {
                                  xs: 92,
                                  md: 104,
                                },
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                borderRadius:
                                  "30px",
                                border:
                                  "1px solid",
                                borderColor:
                                  alpha(
                                    theme
                                      .palette
                                      .primary
                                      .main,
                                    0.2
                                  ),
                                bgcolor:
                                  isDark
                                    ? "#091523"
                                    : "#ffffff",
                              }}
                            >
                              <SiDocker
                                size="3.15rem"
                              />
                            </Box>

                            <Box
                              sx={{
                                position:
                                  "absolute",
                                right: -4,
                                bottom: -4,
                                width: 18,
                                height: 18,
                                borderRadius:
                                  "50%",
                                bgcolor:
                                  isDark
                                    ? "#0a1524"
                                    : "#ffffff",
                                border:
                                  "1px solid",
                                borderColor:
                                  subtleBorder,
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                              }}
                            >
                              <Box
                                sx={{
                                  width: 7,
                                  height: 7,
                                  borderRadius:
                                    "50%",
                                  bgcolor:
                                    "#22c55e",
                                  boxShadow:
                                    "0 0 10px rgba(34,197,94,.7)",
                                }}
                              />
                            </Box>
                          </Box>

                          <Typography
                            sx={{
                              fontWeight:
                                900,
                              fontSize:
                                "0.98rem",
                            }}
                          >
                            Deploy
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            textAlign="center"
                            sx={{
                              maxWidth: 170,
                              lineHeight:
                                1.65,
                            }}
                          >
                            Docker-powered
                            deployment
                          </Typography>

                          <Chip
                            size="small"
                            label="DOCKER"
                            sx={{
                              height: 22,
                              borderRadius:
                                999,
                              fontSize:
                                "0.6rem",
                              fontWeight:
                                900,
                              letterSpacing:
                                "0.1em",
                              bgcolor:
                                alpha(
                                  theme
                                    .palette
                                    .primary
                                    .main,
                                  0.08
                                ),
                              color:
                                "primary.main",
                            }}
                          />
                        </Stack>
                      </motion.div>
                    </Box>

                    {/* DATA */}

                    <Box>
                      <Stack
                        spacing={1.5}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius:
                                "50%",
                              bgcolor:
                                "#a78bfa",
                            }}
                          />

                          <Typography
                            sx={{
                              fontSize:
                                "0.72rem",
                              fontWeight:
                                900,
                              letterSpacing:
                                "0.13em",
                              textTransform:
                                "uppercase",
                              color:
                                "text.secondary",
                            }}
                          >
                            Data layer
                          </Typography>
                        </Stack>

                        <Typography
                          sx={{
                            fontSize: {
                              xs: "1.35rem",
                              md: "1.5rem",
                            },
                            fontWeight:
                              900,
                            letterSpacing:
                              "-0.04em",
                          }}
                        >
                          Keep your data close.
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 400,
                            lineHeight:
                              1.75,
                          }}
                        >
                          Reliable storage and fast
                          service infrastructure for
                          real applications.
                        </Typography>

                        <Stack
                          spacing={1}
                          sx={{
                            mt: 0.7,
                          }}
                        >
                          {dataStack.map(
                            (item) => (
                              <StackItem
                                key={
                                  item.name
                                }
                                item={
                                  item
                                }
                                theme={
                                  theme
                                }
                                isDark={
                                  isDark
                                }
                                direction="right"
                              />
                            )
                          )}
                        </Stack>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            mt: 0.4,
                          }}
                        >
                          Designed to grow with
                          your service architecture.
                        </Typography>
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </SectionReveal>
        </Container>
      </Box>

      {/* ======================================================
          SERVICE PREVIEW
      ======================================================= */}

      <Box
        id="service-preview"
        component="section"
        sx={{
          position: "relative",
          py: {
            xs: 8,
            md: 14,
          },
        }}
      >
        <GlowOrb
          size={320}
          top="10%"
          right="-160px"
          color="#6366f1"
          opacity={
            isDark ? 0.07 : 0.035
          }
        />

        <Container maxWidth="lg">
          <SectionReveal>
            <Stack
              direction={{
                xs: "column",
                md: "row",
              }}
              justifyContent="space-between"
              alignItems={{
                xs: "flex-start",
                md: "flex-end",
              }}
              spacing={3}
            >
              <Box
                sx={{
                  maxWidth: 680,
                }}
              >
                <Typography
                  sx={{
                    color:
                      "primary.main",
                    fontSize:
                      "0.72rem",
                    fontWeight:
                      900,
                    letterSpacing:
                      "0.16em",
                  }}
                >
                  SERVICE CONTROL
                </Typography>

                <Typography
                  component="h2"
                  sx={{
                    mt: 1,
                    fontSize: {
                      xs: "2.15rem",
                      md: "3.35rem",
                    },
                    lineHeight:
                      1,
                    letterSpacing:
                      "-0.06em",
                    fontWeight:
                      950,
                  }}
                >
                  See your services.
                  <br />
                  Manage them instantly.
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    mt: 1.6,
                    lineHeight:
                      1.8,
                    maxWidth: 620,
                  }}
                >
                  Every service gets a clear control surface for status, resources, usage and
                everyday actions, so routine operations stay simple after deployment.
                </Typography>
              </Box>

              <Chip
                icon={
                  <CloudDoneRoundedIcon
                    sx={{
                      fontSize:
                        17,
                    }}
                  />
                }
                label="Live service management"
                sx={{
                  height: 34,
                  borderRadius: 999,
                  px: 0.8,
                  fontWeight: 800,
                  bgcolor: alpha(
                    theme.palette.success.main,
                    isDark ? 0.08 : 0.055
                  ),
                  color:
                    "success.main",
                }}
              />
            </Stack>
          </SectionReveal>

          <Box
            sx={{
              mt: {
                xs: 4,
                md: 6,
              },
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                md: "1.38fr 0.62fr",
              },
              gap: 2,
              alignItems: "stretch",
            }}
          >
            <SectionReveal delay={0.05}>
              <ServicePreview
                theme={theme}
                isDark={isDark}
              />
            </SectionReveal>

            <Stack spacing={2}>
              <SectionReveal delay={0.1}>
                <Paper
                  elevation={0}
                  sx={{
                    height: "100%",
                    p: {
                      xs: 2.5,
                      md: 3,
                    },
                    borderRadius: {
                      xs: 4,
                      md: 5,
                    },
                    border:
                      "1px solid",
                    borderColor:
                      subtleBorder,
                    background:
                      isDark
                        ? `
                          linear-gradient(
                            145deg,
                            rgba(15,25,42,.9),
                            rgba(7,14,25,.96)
                          )
                        `
                        : `
                          linear-gradient(
                            145deg,
                            #ffffff,
                            #f7faff
                          )
                        `,
                  }}
                >
                  <Stack
                    spacing={1.5}
                  >
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius:
                          2.5,
                        display: "grid",
                        placeItems:
                          "center",
                        bgcolor:
                          alpha(
                            theme
                              .palette
                              .success
                              .main,
                            isDark
                              ? 0.11
                              : 0.07
                          ),
                        color:
                          "success.main",
                      }}
                    >
                      <CloudDoneRoundedIcon />
                    </Box>

                    <Typography
                      sx={{
                        fontWeight:
                          900,
                        fontSize:
                          "1.05rem",
                      }}
                    >
                      Always know what
                      is running.
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        lineHeight:
                          1.75,
                      }}
                    >
                      Status, resource limits and live usage stay visible from the same service surface,
                      so you can understand what is running without jumping between tools.
                    </Typography>
                  </Stack>
                </Paper>
              </SectionReveal>

              <SectionReveal delay={0.15}>
                <Paper
                  elevation={0}
                  sx={{
                    p: {
                      xs: 2.5,
                      md: 3,
                    },
                    borderRadius: {
                      xs: 4,
                      md: 5,
                    },
                    border:
                      "1px solid",
                    borderColor:
                      subtleBorder,
                    background:
                      isDark
                        ? "rgba(255,255,255,.02)"
                        : "rgba(255,255,255,.72)",
                  }}
                >
                  <Stack
                    spacing={1.2}
                  >
                    <Typography
                      sx={{
                        fontSize:
                          "0.72rem",
                        fontWeight:
                          900,
                        letterSpacing:
                          "0.12em",
                        color:
                          "primary.main",
                      }}
                    >
                      COMMON ACTIONS
                    </Typography>

                    <Typography
                      sx={{
                        fontWeight:
                          850,
                      }}
                    >
                      Start, stop, restart and change resources.
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        lineHeight:
                          1.7,
                      }}
                    >
                      Keep the actions you use most
                      just one click away.
                    </Typography>

                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{
                        pt: 0.5,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.6}
                      >
                        {[
                          StopRoundedIcon,
                          LaunchRoundedIcon,
                          EditRoundedIcon,
                          MoreHorizRoundedIcon,
                        ].map(
                          (
                            Icon,
                            index
                          ) => (
                            <Box
                              key={index}
                              sx={{
                                width: 31,
                                height: 31,
                                display:
                                  "grid",
                                placeItems:
                                  "center",
                                borderRadius:
                                  1.8,
                                border:
                                  "1px solid",
                                borderColor:
                                  subtleBorder,
                                bgcolor:
                                  isDark
                                    ? "rgba(255,255,255,.025)"
                                    : "rgba(15,23,42,.025)",
                              }}
                            >
                              <Icon
                                sx={{
                                  fontSize:
                                    16,
                                }}
                              />
                            </Box>
                          )
                        )}
                      </Stack>

                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        one surface
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>
              </SectionReveal>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ======================================================
          VALUE STRIP
      ======================================================= */}

      <Box
        component="section"
        sx={{
          pb: {
            xs: 9,
            md: 15,
          },
        }}
      >
        <Container maxWidth="lg">
          <SectionReveal>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3, 1fr)",
                },
                borderTop:
                  "1px solid",
                borderBottom:
                  "1px solid",
                borderColor:
                  subtleBorder,
              }}
            >
              {[
                {
                  icon:
                    SpeedRoundedIcon,
                  title:
                    "Faster deployment",
                  text:
                    "Reduce repetitive setup and get from application to running service with fewer manual steps.",
                },
                {
                  icon:
                    SecurityRoundedIcon,
                  title:
                    "Infrastructure, without the busywork",
                  text:
                    "Manage resources, networks, persistent volumes and service boundaries from one place.",
                },
                {
                  icon:
                    AutoAwesomeRoundedIcon,
                  title:
                    "Flexible as you grow",
                  text:
                    "Change plans when your workload changes instead of rebuilding your deployment setup.",
                },
              ].map(
                (
                  item,
                  index
                ) => {
                  const Icon =
                    item.icon;

                  return (
                    <Box
                      key={
                        item.title
                      }
                      sx={{
                        p: {
                          xs: 2.5,
                          md: 3.5,
                        },
                        borderRight: {
                          xs: "none",
                          md:
                            index <
                            2
                              ? "1px solid"
                              : "none",
                        },
                        borderBottom:
                          {
                            xs:
                              index <
                              2
                                ? "1px solid"
                                : "none",
                            md: "none",
                          },
                        borderColor:
                          subtleBorder,
                      }}
                    >
                      <Icon
                        sx={{
                          fontSize:
                            21,
                          color:
                            "primary.main",
                        }}
                      />

                      <Typography
                        sx={{
                          mt: 1.4,
                          fontWeight:
                            850,
                        }}
                      >
                        {
                          item.title
                        }
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.5,
                          lineHeight:
                            1.7,
                        }}
                      >
                        {item.text}
                      </Typography>
                    </Box>
                  );
                }
              )}
            </Box>
          </SectionReveal>
        </Container>
      </Box>

      {/* ======================================================
          WORKFLOW
      ======================================================= */}

      <Box
        id="quickstart"
        component="section"
        sx={{
          position:
            "relative",
          py: {
            xs: 9,
            md: 15,
          },
          bgcolor:
            isDark
              ? "rgba(255,255,255,.012)"
              : "rgba(37,99,235,.018)",
          borderTop:
            "1px solid",
          borderBottom:
            "1px solid",
          borderColor:
            subtleBorder,
        }}
      >
        <Container maxWidth="lg">
          <SectionReveal>
            <Stack
              direction={{
                xs: "column",
                md: "row",
              }}
              spacing={4}
              justifyContent="space-between"
              alignItems={{
                xs: "flex-start",
                md: "flex-end",
              }}
            >
              <Box
                sx={{
                  maxWidth: 650,
                }}
              >
                <Typography
                  sx={{
                    color:
                      "primary.main",
                    fontSize:
                      "0.72rem",
                    fontWeight:
                      900,
                    letterSpacing:
                      "0.16em",
                  }}
                >
                  QUICKSTART
                </Typography>

                <Typography
                  component="h2"
                  sx={{
                    mt: 1,
                    fontSize: {
                      xs: "2.2rem",
                      md: "3.35rem",
                    },
                    lineHeight:
                      1,
                    letterSpacing:
                      "-0.06em",
                    fontWeight:
                      950,
                  }}
                >
                  From plan to running
                  service.
                </Typography>

                <Typography
                  color="text.secondary"
                  sx={{
                    mt: 1.7,
                    lineHeight:
                      1.8,
                    maxWidth: 620,
                  }}
                >
                  A straightforward deployment flow that removes repetitive infrastructure work
                  while keeping the controls you need to run and manage real services.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                endIcon={
                  <ArrowForwardRoundedIcon />
                }
                onClick={() =>
                  navigate(
                    "/plans"
                  )
                }
                sx={{
                  minWidth: 160,
                  height: 48,
                  borderRadius:
                    2.75,
                  textTransform:
                    "none",
                  fontWeight:
                    800,
                  borderColor:
                    subtleBorder,
                }}
              >
                View plans
              </Button>
            </Stack>
          </SectionReveal>

          <Box
            sx={{
              position:
                "relative",
              mt: {
                xs: 5,
                md: 7,
              },
            }}
          >
            <Box
              sx={{
                display: {
                  xs: "none",
                  md: "block",
                },
                position:
                  "absolute",
                top: 34,
                left: "9%",
                right: "9%",
                height: 1,
                background:
                  isDark
                    ? "linear-gradient(90deg, transparent, rgba(96,165,250,.28), rgba(167,139,250,.28), transparent)"
                    : "linear-gradient(90deg, transparent, rgba(37,99,235,.16), rgba(99,102,241,.16), transparent)",
              }}
            />

            <Box
              sx={{
                display:
                  "grid",
                gridTemplateColumns:
                  {
                    xs: "1fr",
                    md: "repeat(4, 1fr)",
                  },
                gap: {
                  xs: 2,
                  md: 2.5,
                },
              }}
            >
              {workflow.map(
                (item, index) => {
                  const Icon =
                    item.icon;

                  return (
                    <SectionReveal
                      key={
                        item.id
                      }
                      delay={
                        index *
                        0.06
                      }
                    >
                      <Box
                        sx={{
                          position:
                            "relative",
                          height:
                            "100%",
                        }}
                      >
                        <Stack
                          alignItems={{
                            xs: "flex-start",
                            md: "center",
                          }}
                          textAlign={{
                            xs: "left",
                            md: "center",
                          }}
                          spacing={1.5}
                        >
                          <Box
                            sx={{
                              position:
                                "relative",
                              zIndex: 2,
                              width: 68,
                              height: 68,
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              borderRadius:
                                "24px",
                              bgcolor:
                                isDark
                                  ? "#0a1422"
                                  : "#ffffff",
                              border:
                                "1px solid",
                              borderColor:
                                alpha(
                                  item.accent,
                                  isDark
                                    ? 0.28
                                    : 0.18
                                ),
                              boxShadow:
                                isDark
                                  ? `0 18px 40px ${alpha(
                                      item.accent,
                                      0.08
                                    )}`
                                  : `0 18px 40px ${alpha(
                                      item.accent,
                                      0.06
                                    )}`,
                            }}
                          >
                            <Icon
                              sx={{
                                fontSize:
                                  26,
                                color:
                                  item.accent,
                              }}
                            />

                            <Box
                              sx={{
                                position:
                                  "absolute",
                                top: -8,
                                right: -7,
                                minWidth: 24,
                                height: 24,
                                px: 0.5,
                                borderRadius:
                                  999,
                                bgcolor:
                                  isDark
                                    ? "#0d1726"
                                    : "#ffffff",
                                border:
                                  "1px solid",
                                borderColor:
                                  subtleBorder,
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                              }}
                            >
                              <Typography
                                sx={{
                                  fontSize:
                                    "0.62rem",
                                  fontWeight:
                                    900,
                                  color:
                                    "text.secondary",
                                }}
                              >
                                {item.id}
                              </Typography>
                            </Box>
                          </Box>

                          <Typography
                            sx={{
                              fontSize:
                                "1rem",
                              fontWeight:
                                900,
                              letterSpacing:
                                "-0.02em",
                            }}
                          >
                            {
                              item.title
                            }
                          </Typography>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth:
                                220,
                              lineHeight:
                                1.72,
                            }}
                          >
                            {
                              item.description
                            }
                          </Typography>
                        </Stack>
                      </Box>
                    </SectionReveal>
                  );
                }
              )}
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ======================================================
          FAQ / SEARCH-INTENT CONTENT
      ======================================================= */}

      <Box
        component="section"
        aria-labelledby="deployment-faq-heading"
        sx={{
          position: "relative",
          py: { xs: 9, md: 14 },
        }}
      >
        <Container maxWidth="md">
          <SectionReveal>
            <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
              <Typography
                component="h2"
                id="deployment-faq-heading"
                sx={{
                  fontSize: { xs: "2.1rem", md: "3.15rem" },
                  lineHeight: 1.05,
                  letterSpacing: "-0.055em",
                  fontWeight: 950,
                }}
              >
                A simpler way to deploy and manage services.
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ mt: 1.6, lineHeight: 1.8, maxWidth: 690, mx: "auto" }}
              >
                The platform is designed to remove repetitive infrastructure work while keeping
                the resource and operational controls you need close at hand.
              </Typography>
            </Box>
          </SectionReveal>

          <Stack spacing={1.5}>
            {[
              {
                q: "How does PassDeployer make deployment easier?",
                a: "PassDeployer puts service creation, deployment and everyday management into one workflow, reducing the amount of manual infrastructure setup between your code and a running service.",
              },
              {
                q: "Can I manage networks and persistent volumes?",
                a: "Yes. Networks and persistent volumes are part of the service environment, so they can be managed alongside the applications that use them instead of being treated as disconnected infrastructure.",
              },
              {
                q: "Can I change my plan later?",
                a: "Yes. You can move to a different resource plan when your workload changes, rather than rebuilding your deployment workflow from scratch.",
              },
              {
                q: "What can I manage after deployment?",
                a: "You can monitor service status and resource usage, perform common lifecycle actions, and manage the resources and supporting infrastructure around your services from the same control plane.",
              },
            ].map((item) => (
              <Paper
                key={item.q}
                component="article"
                elevation={0}
                sx={{
                  p: { xs: 2.5, md: 3 },
                  borderRadius: { xs: 3, md: 4 },
                  border: "1px solid",
                  borderColor: subtleBorder,
                  bgcolor: "background.paper",
                }}
              >
                <Typography component="h3" sx={{ fontWeight: 900, mb: 0.8 }}>
                  {item.q}
                </Typography>
                <Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {item.a}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ======================================================
          OPEN SOURCE
      ======================================================= */}

      <Box
        component="section"
        sx={{
          position:
            "relative",
          py: {
            xs: 9,
            md: 15,
          },
        }}
      >
        <GlowOrb
          size={350}
          bottom="-140px"
          right="-150px"
          color="#4f46e5"
          opacity={
            isDark ? 0.08 : 0.045
          }
        />

        <Container maxWidth="lg">
          <Paper
            elevation={0}
            sx={{
              position:
                "relative",
              overflow:
                "hidden",
              borderRadius: {
                xs: 4,
                md: 6,
              },
              border:
                "1px solid",
              borderColor:
                subtleBorder,
              background:
                isDark
                  ? `
                    radial-gradient(
                      circle at 85% 20%,
                      rgba(79,70,229,.12),
                      transparent 28%
                    ),
                    linear-gradient(
                      145deg,
                      #0b1524,
                      #07101b
                    )
                  `
                  : `
                    radial-gradient(
                      circle at 85% 20%,
                      rgba(79,70,229,.075),
                      transparent 28%
                    ),
                    linear-gradient(
                      145deg,
                      #ffffff,
                      #eff5ff
                    )
                  `,
              boxShadow:
                isDark
                  ? "0 35px 100px rgba(0,0,0,.24)"
                  : "0 35px 100px rgba(15,23,42,.07)",
            }}
          >
            <Box
              sx={{
                p: {
                  xs: 3,
                  sm: 4,
                  md: 6,
                },
              }}
            >
              <Stack
                direction={{
                  xs: "column",
                  md: "row",
                }}
                spacing={{
                  xs: 4,
                  md: 7,
                }}
                alignItems="center"
              >
                <Box
                  sx={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <SectionReveal>
                    <Typography
                      sx={{
                        color:
                          "primary.main",
                        fontSize:
                          "0.72rem",
                        fontWeight:
                          900,
                        letterSpacing:
                          "0.16em",
                      }}
                    >
                      OPEN SOURCE
                    </Typography>

                    <Typography
                      component="h2"
                      sx={{
                        mt: 1,
                        fontSize: {
                          xs: "2.1rem",
                          md: "3.15rem",
                        },
                        lineHeight:
                          1.03,
                        letterSpacing:
                          "-0.06em",
                        fontWeight:
                          950,
                      }}
                    >
                      Built in the open.
                      <br />
                      Ready to inspect.
                    </Typography>

                    <Typography
                      color="text.secondary"
                      sx={{
                        mt: 1.6,
                        lineHeight:
                          1.8,
                        maxWidth:
                          570,
                      }}
                    >
                      Explore the backend and frontend code
                      that power PassDeployer and see how
                      the platform is put together.
                    </Typography>

                    <Stack
                      direction={{
                        xs: "column",
                        sm: "row",
                      }}
                      spacing={1.2}
                      sx={{
                        mt: 2.5,
                      }}
                    >
                      <Button
                        component="a"
                        href={
                          GITHUB_API
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="contained"
                        startIcon={
                          <GitHubIcon />
                        }
                        sx={{
                          minHeight: 46,
                          px: 2.2,
                          borderRadius:
                            2.5,
                          textTransform:
                            "none",
                          fontWeight:
                            800,
                        }}
                      >
                        Django backend
                      </Button>

                      <Button
                        component="a"
                        href={
                          GITHUB_FRONTEND
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outlined"
                        startIcon={
                          <GitHubIcon />
                        }
                        sx={{
                          minHeight: 46,
                          px: 2.2,
                          borderRadius:
                            2.5,
                          textTransform:
                            "none",
                          fontWeight:
                            750,
                          borderColor:
                            subtleBorder,
                        }}
                      >
                        React frontend
                      </Button>
                    </Stack>
                  </SectionReveal>
                </Box>

                <Box
                  sx={{
                    width: {
                      xs: "100%",
                      md: 350,
                    },
                    flexShrink: 0,
                  }}
                >
                  <SectionReveal
                    delay={0.08}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius:
                          4,
                        border:
                          "1px solid",
                        borderColor:
                          subtleBorder,
                        bgcolor:
                          isDark
                            ? "rgba(255,255,255,.025)"
                            : "rgba(255,255,255,.62)",
                        backdropFilter:
                          "blur(18px)",
                      }}
                    >
                      <Stack
                        spacing={1}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{
                            pb: 1,
                          }}
                        >
                          <Box
                            component="img"
                            src={
                              DEFAULT_ICON
                            }
                            alt=""
                            sx={{
                              width: 30,
                              height: 30,
                            }}
                          />

                          <Box>
                            <Typography
                              sx={{
                                fontWeight:
                                  850,
                                fontSize:
                                  "0.88rem",
                              }}
                            >
                              PassDeployer
                            </Typography>

                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Platform stack
                            </Typography>
                          </Box>
                        </Stack>

                        {[
                          [
                            "React",
                            SiReact,
                          ],
                          [
                            "Django",
                            SiDjango,
                          ],
                          [
                            "PostgreSQL",
                            SiPostgresql,
                          ],
                          [
                            "Redis",
                            SiRedis,
                          ],
                          [
                            "Docker",
                            SiDocker,
                          ],
                        ].map(
                          ([
                            name,
                            Icon,
                          ]) => (
                            <Box
                              key={
                                name
                              }
                              sx={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "space-between",
                                px: 1.3,
                                py: 1.05,
                                borderRadius:
                                  2.5,
                                bgcolor:
                                  isDark
                                    ? "rgba(255,255,255,.025)"
                                    : "rgba(15,23,42,.025)",
                              }}
                            >
                              <Stack
                                direction="row"
                                spacing={1}
                                alignItems="center"
                              >
                                <Icon
                                  size="1.2rem"
                                />

                                <Typography
                                  sx={{
                                    fontSize:
                                      "0.8rem",
                                    fontWeight:
                                      750,
                                  }}
                                >
                                  {
                                    name
                                  }
                                </Typography>
                              </Stack>

                              <CheckRoundedIcon
                                sx={{
                                  fontSize:
                                    15,
                                  color:
                                    "success.main",
                                }}
                              />
                            </Box>
                          )
                        )}
                      </Stack>
                    </Paper>
                  </SectionReveal>
                </Box>
              </Stack>
            </Box>
          </Paper>
        </Container>
      </Box>

      {/* ======================================================
          FINAL CTA
      ======================================================= */}

      <Box
        component="section"
        sx={{
          position:
            "relative",
          pb: {
            xs: 9,
            md: 13,
          },
        }}
      >
        <Container maxWidth="md">
          <SectionReveal>
            <Box
              sx={{
                textAlign:
                  "center",
              }}
            >
              <Box
                component="img"
                src={DEFAULT_ICON}
                alt="PassDeployer"
                sx={{
                  width: 48,
                  height: 48,
                  mx: "auto",
                  mb: 2,
                  display:
                    "block",
                }}
              />

              <Typography
                component="h2"
                sx={{
                  fontSize: {
                    xs: "2.15rem",
                    md: "3.55rem",
                  },
                  lineHeight:
                    1,
                  letterSpacing:
                    "-0.065em",
                  fontWeight:
                    950,
                }}
              >
                Ready to ship?
              </Typography>

              <Typography
                color="text.secondary"
                sx={{
                  maxWidth: 590,
                  mx: "auto",
                  mt: 1.5,
                  lineHeight:
                    1.8,
                }}
              >
                Choose your resources, create a service and let
                PassDeployer handle the deployment workflow.
              </Typography>

              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={1.2}
                justifyContent="center"
                sx={{
                  mt: 2.8,
                }}
              >
                <Button
                  variant="contained"
                  size="large"
                  onClick={() =>
                    navigate(
                      "/plans"
                    )
                  }
                  endIcon={
                    <ArrowForwardRoundedIcon />
                  }
                  sx={{
                    minWidth: 175,
                    minHeight: 50,
                    borderRadius: 3,
                    textTransform:
                      "none",
                    fontWeight:
                      850,
                  }}
                >
                  View plans
                </Button>

                {!loggedIn ? (
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() =>
                      navigate(
                        "/signin_or_signup"
                      )
                    }
                    sx={{
                      minWidth: 175,
                      minHeight: 50,
                      borderRadius:
                        3,
                      textTransform:
                        "none",
                      fontWeight:
                        750,
                      borderColor:
                        subtleBorder,
                    }}
                  >
                    Create account
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() =>
                      navigate(
                        "/services"
                      )
                    }
                    sx={{
                      minWidth: 175,
                      minHeight: 50,
                      borderRadius:
                        3,
                      textTransform:
                        "none",
                      fontWeight:
                        750,
                      borderColor:
                        subtleBorder,
                    }}
                  >
                    My services
                  </Button>
                )}
              </Stack>
            </Box>
          </SectionReveal>
        </Container>
      </Box>

      {/* ======================================================
          FOOTER
      ======================================================= */}

      <Box
        sx={{
          pb: 3,
        }}
      >
        <Container maxWidth="lg">
          <Divider
            sx={{
              borderColor:
                subtleBorder,
            }}
          />

          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{
              pt: 2.5,
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <Box
                component="img"
                src={DEFAULT_ICON}
                alt=""
                sx={{
                  width: 22,
                  height: 22,
                }}
              />

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontWeight:
                    700,
                }}
              >
                PassDeployer
              </Typography>
            </Stack>

            <Typography
              variant="caption"
              color="text.secondary"
            >
              Deploy faster. Manage everything in one place. Scale when you need to.
            </Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}