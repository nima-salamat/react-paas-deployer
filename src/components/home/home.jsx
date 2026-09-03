import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  motion,
  useScroll,
  useTransform,
} from "framer-motion";

import { useNavigate } from "react-router-dom";

import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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

const dockerHighlights = [
  {
    icon: AppsRoundedIcon,
    title: "Containerized builds",
    description:
      "Every service builds into a clean image.",
  },
  {
    icon: SecurityRoundedIcon,
    title: "Isolated runs",
    description:
      "Workloads stay separate — no shared state.",
  },
  {
    icon: CloudDoneRoundedIcon,
    title: "Predictable rollouts",
    description:
      "The same image from build to production.",
  },
];

const workflow = [
  {
    id: "01",
    title: "Choose the resources you need",
    description:
      "Pick CPU, memory and storage that fit your workload.",
    icon: TuneRoundedIcon,
    accent: "#60a5fa",
  },
  {
    id: "02",
    title: "Create a service",
    description:
      "Configure app, runtime and settings — no infrastructure assembly.",
    icon: TerminalRoundedIcon,
    accent: "#818cf8",
  },
  {
    id: "03",
    title: "Deploy faster",
    description:
      "From configured service to a running deployment.",
    icon: RocketLaunchRoundedIcon,
    accent: "#a78bfa",
  },
  {
    id: "04",
    title: "Manage everything in one place",
    description:
      "Monitor, restart and scale services — plus volumes and networks — from one place.",
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
  y = 64,
}) {
  /* Respect users who prefer reduced motion: skip entrance animation. */
  const prefersReducedMotion =
    useMediaQuery(
      "(prefers-reduced-motion: reduce)"
    );

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  /* Cinematic scroll reveal: sections glide up from further away and
     settle with a subtle scale — the "new scene arrives as you scroll"
     feel of modern scroll-driven landing pages (neuralink.com style). */
  return (
    <motion.div
      initial={{
        opacity: 0,
        y,
        scale: 0.965,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      viewport={{
        once: true,
        amount: 0.2,
      }}
      transition={{
        duration: 0.9,
        delay,
        ease: [0.16, 1, 0.3, 1],
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
              iconColor={
                theme.palette
                  .primary.main
              }
              isDark={isDark}
            />

            <ServiceUsage
              label="RAM"
              value={48}
              iconColor={
                theme.palette
                  .secondary.main
              }
              isDark={isDark}
            />
          </Stack>
        </Box>

        {/* Preview note — this card is illustrative, so no fake
            action buttons (they previously looked fully operational). */}

        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            mt: 2.25,
            p: 1.1,
            borderRadius: 2.25,
            border: "1px solid",
            borderColor:
              subtleBorderFor(
                isDark
              ),
            bgcolor: isDark
              ? "rgba(255,255,255,.02)"
              : "rgba(15,23,42,.02)",
          }}
        >
          <InfoOutlinedIcon
            sx={{
              fontSize: 16,
              color: "text.secondary",
              flexShrink: 0,
            }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
          >
            Example service — resources shown for
            illustration. Sign in to manage real
            deployments.
          </Typography>
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

  /* WCAG 2.3.3 — ask the OS before running heavy motion. */
  const prefersReducedMotion =
    useMediaQuery(
      "(prefers-reduced-motion: reduce)"
    );

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

        if (saved !== null) {
          return saved === "true";
        }

        // Respect users who prefer reduced motion by default.
        return !prefersReducedMotion;
      } catch {
        return true;
      }
    });

  const [dockerImageOk, setDockerImageOk] =
    useState(true);

  const { scrollY, scrollYProgress } =
    useScroll();

  /* Cinematic page-progress line — grows across the top edge as the
     user scrolls, the way scroll-driven sites signal depth. */
  const progressBarScale = useTransform(
    scrollYProgress,
    [0, 1],
    [0, 1]
  );

  /* Only the image moves slightly — disabled for reduced motion. */
  const heroImageY = useTransform(
    scrollY,
    [0, 900],
    [0, prefersReducedMotion ? 0 : 42]
  );

  /* Docker scene — the image drifts gently while the section crosses
     the viewport, adding depth to the scroll experience. */
  const dockerSceneRef =
    useRef(null);

  const { scrollYProgress: dockerSceneProgress } =
    useScroll({
      target: dockerSceneRef,
      offset: ["start end", "end start"],
    });

  const dockerImageY = useTransform(
    dockerSceneProgress,
    [0, 1],
    prefersReducedMotion
      ? [0, 0]
      : [38, -38]
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
        ${alpha(theme.palette.primary.main, 0.13)},
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
        ${alpha(theme.palette.secondary.main, 0.09)},
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
        position: "relative",
        minHeight: "100vh",
        color: "text.primary",
        background:
          pageBackground,
        overflow: "clip",
      }}
    >
      {/* SEO — keyword-rich summary kept in the DOM for crawlers,
          visually hidden so it never competes with the UI. */}
      <Typography
        component="p"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          m: -1,
          p: 0,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        PassDeployer is an open-source platform as a service for developers:
        deploy Django, Flask, Node.js and React applications, run PostgreSQL
        and Redis data services, manage networks and persistent volumes, and
        scale CPU, RAM and storage with flexible hourly plans — one focused
        control plane built with Django, React and Docker.
      </Typography>

      {/* Scroll progress line — thin gradient track at the very top
          edge that fills as the page is scrolled. Purely decorative. */}
      <motion.div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 2.5,
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          transformOrigin: "0% 50%",
          scaleX: progressBarScale,
          zIndex: 1300,
          pointerEvents: "none",
        }}
      />

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
            theme.palette
              .primary.main
          }
          opacity={
            isDark ? 0.11 : 0.06
          }
        />

        <Container
          maxWidth={false}
          sx={{
            position: "relative",
            zIndex: 2,
            px: { xs: 2, sm: 3, md: 6, lg: 8, xl: 10 },
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
                    maxWidth: 1100,
                    fontSize: {
                      xs: "2.6rem",
                      sm: "3.7rem",
                      md: "5rem",
                    },
                    lineHeight:
                      1.05,
                    letterSpacing:
                      "-0.045em",
                    fontWeight:
                      950,
                  }}
                >
                  Deploy faster.
                  <br />
                  Scale smarter.
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
                  component="p"
                  sx={{
                    mt: 2.5,
                    maxWidth: 720,
                    fontSize: {
                      xs: "0.98rem",
                      sm: "1.05rem",
                      md: "1.15rem",
                    },
                    lineHeight:
                      1.8,
                    color:
                      "text.secondary",
                    fontWeight: 450,
                  }}
                >
                  A focused platform to <strong>deploy and manage services</strong> —
                  without the infrastructure busywork.
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
                        loggedIn
                          ? "/services"
                          : "/plans"
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
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                      boxShadow: `0 16px 42px ${alpha(
                        theme.palette.primary.main,
                        isDark ? 0.3 : 0.2
                      )}`,
                    }}
                  >
                    {loggedIn
                      ? "Go to services"
                      : "Start deploying"}
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

                  <Button
                    variant="text"
                    size="large"
                    onClick={() =>
                      navigate("/docs")
                    }
                    endIcon={
                      <EastRoundedIcon />
                    }
                    sx={{
                      minWidth: 160,
                      minHeight: 52,
                      px: 2.5,
                      borderRadius: 3,
                      textTransform:
                        "none",
                      fontWeight:
                        750,
                    }}
                  >
                    Read the docs
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
                      background: isDark
                          ? `
                            radial-gradient(
                              ellipse at 50% 45%,
                              ${alpha(theme.palette.primary.main, 0.2)},
                              ${alpha(theme.palette.primary.main, 0.07)} 42%,
                              transparent 72%
                            )
                          `
                          : `
                            radial-gradient(
                              ellipse at 50% 46%,
                              ${alpha(theme.palette.primary.main, 0.11)},
                              ${alpha(theme.palette.secondary.main, 0.045)} 38%,
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
                      theme
                        .palette
                        .primary
                        .main
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
                          aspectRatio: "16 / 9",
                          minHeight: { xs: 0, sm: 0, md: 420 },
                        }}
                      >
                        <Box
                          component="img"
                          src={
                            heroImage
                          }
                          alt="PassDeployer"
                          fetchPriority="high"
                          decoding="async"
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
                              { xs: "contain", md: "cover" },
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
                                  "0.78rem",
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

        {/* Scroll hint — signals there is more below; hidden on small
            screens (hero already fills them) and for reduced motion. */}
        {!prefersReducedMotion && (
          <Stack
            alignItems="center"
            spacing={0.25}
            sx={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 14,
              display: { xs: "none", md: "flex" },
              pointerEvents: "none",
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontSize: "0.66rem",
                fontWeight: 800,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "text.secondary",
                opacity: 0.65,
              }}
            >
              Scroll
            </Typography>

            <motion.div
              animate={{ y: [0, 7, 0], opacity: [0.45, 0.9, 0.45] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <ExpandMoreRoundedIcon
                sx={{
                  fontSize: 20,
                  color: "text.secondary",
                }}
              />
            </motion.div>
          </Stack>
        )}
      </Box>

      {/* ======================================================
          HOW YOUR APP FITS TOGETHER
      ======================================================= */}

      <Box
        id="stack"
        component="section"
        sx={{
          position: "relative",
          py: {
            xs: 8,
            md: 10,
          },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
        }}
      >
        <GlowOrb
          size={340}
          top="16%"
          left="-180px"
          color={
            theme.palette
              .primary.main
          }
          opacity={
            isDark ? 0.08 : 0.045
          }
        />

        <Container maxWidth="xl">
          <SectionReveal>
            <Stack
              alignItems="center"
              textAlign="center"
              spacing={1.5}
            >
              <Typography
                component="p"
                sx={{
                  color:
                    "primary.main",
                  fontWeight: 900,
                  fontSize:
                    "0.78rem",
                  letterSpacing:
                    "0.17em",
                  textTransform:
                    "uppercase",
                }}
              >
                How it works
              </Typography>

              <Typography
                component="h2"
                sx={{
                  maxWidth: 820,
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
                One place to run and grow it.
              </Typography>

              <Typography
                color="text.secondary"
                sx={{
                  maxWidth: 650,
                  lineHeight:
                    1.85,
                }}
              >
                One control plane for deploying, managing and scaling —
                less setup, more building.
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
                            ${alpha(theme.palette.primary.main, 0.2)},
                            ${alpha(theme.palette.secondary.main, 0.2)},
                            transparent
                          )
                        `
                        : `
                          linear-gradient(
                            90deg,
                            transparent,
                            ${alpha(theme.palette.primary.main, 0.12)},
                            ${alpha(theme.palette.secondary.main, 0.12)},
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
                      theme.palette
                        .primary.main,
                    boxShadow: `0 0 14px ${alpha(
                      theme.palette.primary.main,
                      0.5
                    )}`,
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
                      theme.palette
                        .secondary.main,
                    boxShadow: `0 0 14px ${alpha(
                      theme.palette.secondary.main,
                      0.5
                    )}`,
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
                                "primary.main",
                            }}
                          />

                          <Typography
                            sx={{
                              fontSize:
                                "0.78rem",
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
                          and runtimes — no new
                          development model.
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
                                "secondary.main",
                            }}
                          />

                          <Typography
                            sx={{
                              fontSize:
                                "0.78rem",
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
          PAY AS YOU GO
      ======================================================= */}

      <Box
        component="section"
        sx={{
          position: "relative",
          py: { xs: 8, md: 11 },
        }}
      >
        <Container maxWidth="xl">
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: { xs: 4, md: 6 },
              border: "1px solid",
              borderColor: subtleBorder,
              bgcolor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.84),
              backdropFilter: "blur(18px)",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={{ xs: 3, md: 5 }}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ maxWidth: 720 }}>
                <Typography
                  sx={{
                    color: "primary.main",
                    fontSize: "0.78rem",
                    fontWeight: 900,
                    letterSpacing: "0.13em",
                  }}
                >
                  PAY AS YOU GO
                </Typography>
                <Typography
                  component="h2"
                  sx={{
                    mt: 1,
                    fontSize: { xs: "2rem", md: "3rem" },
                    lineHeight: 1.05,
                    letterSpacing: "-0.055em",
                    fontWeight: 950,
                  }}
                >
                  Use what you need. Pay for what you use.
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{ mt: 1.5, lineHeight: 1.85, maxWidth: 690 }}
                >
                  Start with the resources that fit your workload, run a short-lived
                  environment, or keep a small service online — <strong>and change plans
                  whenever the workload changes.</strong>
                </Typography>
              </Box>

              <Button
                variant="contained"
                onClick={() => navigate("/plans")}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{
                  minWidth: 180,
                  minHeight: 50,
                  px: 2.5,
                  borderRadius: 3,
                  textTransform: "none",
                  fontWeight: 850,
                  flexShrink: 0,
                }}
              >
                See plans
              </Button>
            </Stack>
          </Paper>
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
            md: 10,
          },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
        }}
      >
        <GlowOrb
          size={320}
          top="10%"
          right="-160px"
          color={
            theme.palette
              .secondary.main
          }
          opacity={
            isDark ? 0.07 : 0.035
          }
        />

        <Container maxWidth="xl">
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
                      "0.78rem",
                    fontWeight:
                      900,
                    letterSpacing:
                      "0.16em",
                  }}
                >
                  MANAGE YOUR SERVICES
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
                  Status, resources, usage and everyday actions —
                one clear surface per service.
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
                      Status, limits and live usage — visible at a
                      glance, without jumping between tools.
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
                          "0.78rem",
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
        <Container maxWidth="xl">
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
                    "From code to running service with fewer manual steps.",
                },
                {
                  icon:
                    SecurityRoundedIcon,
                  title:
                    "Infrastructure, without the busywork",
                  text:
                    "Volumes, networks and service boundaries — managed from one place.",
                },
                {
                  icon:
                    AutoAwesomeRoundedIcon,
                  title:
                    "Flexible as you grow",
                  text:
                    "Change plans as you grow — no rebuilds.",
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
            md: 10,
          },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
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
        <Container maxWidth="xl">
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
                      "0.78rem",
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
                  A straightforward deployment flow that keeps the setup clear,
                  while giving you the controls you need to run real services.
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
                    ? `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.28)}, ${alpha(theme.palette.secondary.main, 0.28)}, transparent)`
                    : `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, 0.16)}, ${alpha(theme.palette.secondary.main, 0.16)}, transparent)`,
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
          DOCKER — UNDER THE HOOD
          (scene image: /docker-image.jpg from public/; falls back to
          a styled illustration when the file is absent)
      ======================================================= */}

      <Box
        id="docker"
        component="section"
        ref={dockerSceneRef}
        sx={{
          position: "relative",
          py: { xs: 8, md: 10 },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
          overflow: "clip",
        }}
      >
        <GlowOrb
          size={360}
          top="18%"
          left="-170px"
          color={
            theme.palette
              .secondary.main
          }
          opacity={
            isDark ? 0.08 : 0.04
          }
        />

        <Container maxWidth="xl">
          <Stack
            direction={{
              xs: "column-reverse",
              md: "row",
            }}
            spacing={{
              xs: 5,
              md: 8,
            }}
            alignItems="center"
          >
            {/* SCENE IMAGE */}

            <Box
              sx={{
                flex: 1.15,
                minWidth: 0,
                width: "100%",
              }}
            >
              <SectionReveal>
                <motion.div
                  style={{
                    y: dockerImageY,
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      position: "relative",
                      overflow: "hidden",
                      borderRadius: {
                        xs: 3.5,
                        md: 5,
                      },
                      border: "1px solid",
                      borderColor: subtleBorder,
                      background: isDark
                        ? "#08111e"
                        : "#edf4ff",
                      boxShadow: isDark
                        ? "0 30px 90px rgba(0,0,0,.32)"
                        : "0 26px 70px rgba(30,64,175,.09)",
                      transform: "translateZ(0)",
                    }}
                  >
                    {dockerImageOk ? (
                      <Box
                        component="img"
                        src="/docker-image.jpg"
                        alt="PassDeployer — Docker-based deployments"
                        onError={() =>
                          setDockerImageOk(
                            false
                          )
                        }
                        loading="lazy"
                        decoding="async"
                        sx={{
                          display: "block",
                          width: "100%",
                          height: "auto",
                          transform: "translateZ(0)",
                        }}
                      />
                    ) : (
                      /* Fallback illustration — keeps the scene
                         intentional even without the image file. */

                      <Box
                        sx={{
                          position: "relative",
                          aspectRatio: "4 / 3",
                          display: "flex",
                          flexDirection:
                            "column",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          gap: 2.5,
                          background: isDark
                            ? `
                              radial-gradient(
                                circle at 50% 30%,
                                rgba(13,74,156,.38),
                                transparent 60%
                              ),
                              linear-gradient(
                                160deg,
                                #0a1526,
                                #07101b
                              )
                            `
                            : `
                              radial-gradient(
                                circle at 50% 30%,
                                rgba(59,130,246,.16),
                                transparent 60%
                              ),
                              linear-gradient(
                                160deg,
                                #f2f7ff,
                                #e8f1ff
                              )
                            `,
                        }}
                      >
                        <Box
                          aria-hidden
                          sx={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            width: 104,
                            height: 104,
                            borderRadius: 5,
                            border:
                              "1px solid",
                            borderColor: isDark
                              ? "rgba(255,255,255,.12)"
                              : "rgba(15,23,42,.10)",
                            bgcolor: isDark
                              ? "rgba(255,255,255,.04)"
                              : "rgba(255,255,255,.66)",
                            backdropFilter:
                              "blur(14px)",
                          }}
                        >
                          <SiDocker
                            size={58}
                          />
                        </Box>

                        <Stack
                          direction="row"
                          spacing={1}
                        >
                          {[
                            "build",
                            "run",
                            "manage",
                          ].map(
                            (
                              label
                            ) => (
                              <Chip
                                key={
                                  label
                                }
                                label={
                                  label
                                }
                                size="small"
                                sx={{
                                  borderRadius: 999,
                                  fontWeight: 700,
                                  fontSize:
                                    "0.72rem",
                                }}
                              />
                            )
                          )}
                        </Stack>
                      </Box>
                    )}
                  </Paper>
                </motion.div>
              </SectionReveal>
            </Box>

            {/* COPY */}

            <Box
              sx={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <SectionReveal
                delay={0.08}
              >
                <Stack spacing={2.5}>
                  <Box>
                    <Typography
                      component="p"
                      sx={{
                        color:
                          "primary.main",
                        fontWeight: 900,
                        fontSize:
                          "0.78rem",
                        letterSpacing:
                          "0.17em",
                        textTransform:
                          "uppercase",
                      }}
                    >
                      Docker under the hood
                    </Typography>

                    <Typography
                      component="h2"
                      sx={{
                        mt: 1,
                        fontSize: {
                          xs: "2.1rem",
                          md: "3.15rem",
                        },
                        lineHeight: 1.03,
                        letterSpacing:
                          "-0.06em",
                        fontWeight: 950,
                      }}
                    >
                      Every deployment
                      rides on containers.
                    </Typography>

                    <Typography
                      color="text.secondary"
                      sx={{
                        mt: 1.5,
                        lineHeight: 1.85,
                        maxWidth: 560,
                      }}
                    >
                      Services build and run as containers —
                      isolated, reproducible and managed
                      by the platform.
                    </Typography>
                  </Box>

                  <Stack spacing={1.1}>
                    {dockerHighlights.map(
                      (
                        item
                      ) => {
                        const Icon =
                          item.icon;

                        return (
                          <Stack
                            key={
                              item.title
                            }
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            sx={{
                              p: 1.25,
                              borderRadius: 3,
                              border:
                                "1px solid",
                              borderColor:
                                subtleBorder,
                              bgcolor: isDark
                                ? "rgba(255,255,255,.025)"
                                : "rgba(255,255,255,.62)",
                            }}
                          >
                            <Box
                              sx={{
                                width: 40,
                                height: 40,
                                flexShrink: 0,
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                borderRadius: 2.5,
                                color:
                                  "primary.main",
                                bgcolor:
                                  alpha(
                                    theme
                                      .palette
                                      .primary
                                      .main,
                                    isDark
                                      ? 0.09
                                      : 0.07
                                  ),
                              }}
                            >
                              <Icon
                                sx={{
                                  fontSize: 20,
                                }}
                              />
                            </Box>

                            <Box>
                              <Typography
                                sx={{
                                  fontWeight: 800,
                                  fontSize:
                                    "0.92rem",
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
                                  fontSize:
                                    "0.82rem",
                                  lineHeight: 1.6,
                                }}
                              >
                                {
                                  item.description
                                }
                              </Typography>
                            </Box>
                          </Stack>
                        );
                      }
                    )}
                  </Stack>
                </Stack>
              </SectionReveal>
            </Box>
          </Stack>
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
          py: { xs: 9, md: 10 },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
        }}
      >
        <Container maxWidth="lg">
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
                Less repetitive infrastructure work — with the controls
                you need close at hand.
              </Typography>
            </Box>
          </SectionReveal>

          <Stack spacing={1.2}>
            {[
              {
                q: "How does PassDeployer make deployment easier?",
                a: "Service creation, deployment and everyday management in one workflow — less manual setup between your code and a running service.",
              },
              {
                q: "Can I manage networks and persistent volumes?",
                a: "Yes. Networks and persistent volumes live in the same service environment, managed alongside the applications that use them.",
              },
              {
                q: "Can I use PassDeployer for short or changing workloads?",
                a: "Yes. Hourly plans let you size resources for today's workload, run temporary environments, and switch plans as you grow.",
              },
              {
                q: "What can I manage after deployment?",
                a: "Status, usage, lifecycle actions and supporting resources — all from the same control plane.",
              },
            ].map((item, index) => (
              <Accordion
                key={item.q}
                component="article"
                elevation={0}
                disableGutters
                sx={{
                  borderRadius: {
                    xs: 2.5,
                    md: 3,
                  },
                  border: "1px solid",
                  borderColor: subtleBorder,
                  bgcolor: "background.paper",
                  overflow: "hidden",
                  "&:before": {
                    display: "none",
                  },
                  "&.Mui-expanded": {
                    borderColor: (t) =>
                      alpha(
                        t.palette.primary
                          .main,
                        0.3
                      ),
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={
                    <ExpandMoreRoundedIcon />
                  }
                  sx={{
                    px: {
                      xs: 2,
                      md: 2.5,
                    },
                    "&.Mui-expanded": {
                      minHeight: 54,
                    },
                  }}
                >
                  <Typography
                    component="h3"
                    sx={{
                      fontWeight: 900,
                      fontSize:
                        "0.95rem",
                    }}
                  >
                    {item.q}
                  </Typography>
                </AccordionSummary>

                <AccordionDetails
                  sx={{
                    px: {
                      xs: 2,
                      md: 2.5,
                    },
                    pt: 0,
                  }}
                >
                  <Typography
                    color="text.secondary"
                    sx={{
                      lineHeight: 1.8,
                    }}
                  >
                    {item.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
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
            md: 10,
          },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
        }}
      >
        <GlowOrb
          size={350}
          bottom="-140px"
          right="-150px"
          color={
            theme.palette
              .secondary.main
          }
          opacity={
            isDark ? 0.08 : 0.045
          }
        />

        <Container maxWidth="xl">
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
                          "0.78rem",
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
                      Read the backend and frontend code
                      that powers the platform.
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
          py: {
            xs: 9,
            md: 10,
          },
          minHeight: { md: "100vh" },
          display: { md: "flex" },
          alignItems: { md: "center" },
        }}
      >
        <Container maxWidth="lg">
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
                Pick your resources, create a service —
                PassDeployer handles the rest.
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
          (removed internal footer — the global Footer.jsx from the
          Layout renders below this page; two stacked footers with
          different tone felt inconsistent)
      ======================================================= */}
    </Box>
  );
}