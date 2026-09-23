import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
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
  Paper,
  Stack,
  Typography,
  alpha,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import RocketLaunchRoundedIcon from "@mui/icons-material/RocketLaunchRounded";
import SecurityRoundedIcon from "@mui/icons-material/SecurityRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import SpeedRoundedIcon from "@mui/icons-material/SpeedRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import GitHubIcon from "@mui/icons-material/GitHub";
import { SiDjango, SiDocker, SiFlask, SiNodedotjs, SiPostgresql, SiReact, SiRedis } from "react-icons/si";

import heroNetwork from "../../assets/home/hero-network.svg";
import deployFlow from "../../assets/home/deploy-flow.svg";
import deployPipeline from "../../assets/home/deploy-pipeline.svg";
import productionNetwork from "../../assets/home/production-network.svg";
import PlansPreview from "./PlansPreview.jsx";

/* ───────────────── Constants ───────────────── */
const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";

const FAQ_ITEMS = [
  {
    q: "What can I deploy?",
    a: "PassDeployer is designed for modern web workloads, including React frontends, Node.js services, Django and Flask applications, databases, caches, and Docker-based workloads.",
  },
  {
    q: "Do I need to manage Docker manually?",
    a: "No. Docker is the execution layer underneath the platform. The control plane handles service creation, builds, deployments, networking, logs, and the day-to-day workflow.",
  },
  {
    q: "Can resources be changed later?",
    a: "Yes. The platform is structured around service-level resources, so CPU, memory, storage, and runtime configuration can be managed without rebuilding the entire application workflow.",
  },
  {
    q: "Is the platform open source?",
    a: "The frontend and backend are maintained as separate repositories, making the control plane easier to inspect, adapt, and self-host.",
  },
];

const STACK_GROUPS = [
  {
    title: "Application runtime",
    items: [
      ["React", SiReact],
      ["Node.js", SiNodedotjs],
      ["Django", SiDjango],
      ["Flask", SiFlask],
    ],
  },
  {
    title: "Data & infrastructure",
    items: [
      ["PostgreSQL", SiPostgresql],
      ["Redis", SiRedis],
      ["Docker", SiDocker],
    ],
  },
];

const LIFECYCLE_STEPS = [
  { title: "Connect source", body: "Point a service at your repository and let the platform own the rest of the path." },
  { title: "Build image", body: "Consistent Docker builds turn application code into a deployable runtime unit." },
  { title: "Ship release", body: "Promote a release into the environment with clear status, logs and health signals." },
  { title: "Observe & scale", body: "Keep networking, storage and resource controls close to the service itself." },
];

const CAPABILITIES = [
  ["Services", TerminalRoundedIcon, "Create and manage runtime services from a single place."],
  ["Deployments", RocketLaunchRoundedIcon, "Track releases, build state, logs and rollout health."],
  ["Storage", StorageRoundedIcon, "Persistent volumes remain first-class resources in the platform."],
  ["Resource controls", MemoryRoundedIcon, "Keep CPU, memory and storage close to the service definition."],
  ["Security", SecurityRoundedIcon, "Use isolated containers and clear service boundaries as the execution model."],
  ["Automation", AutoAwesomeRoundedIcon, "Reduce repeated operational work by keeping the lifecycle in one control plane."],
];

const STACK_HIGHLIGHTS = [
  ["Frontend", "React and static web workloads"],
  ["Backend", "Django, Flask, Node.js and Docker services"],
  ["Data", "PostgreSQL, Redis and persistent storage"],
];

const TECH_LABELS = ["React", "Node.js", "Django", "Flask", "Docker"];

/* Animation timing constants */
const ANIM = {
  duration: 0.48,
  ease: [0.22, 1, 0.36, 1],
  stagger: 0.05,
  cardScale: 0.14,
};

/* Motion variants — transform + opacity only */
const textVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1 },
};

const slideVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0 },
};

const reducedVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

/* ───────────────── Helpers ───────────────── */

function useIsBrowser() {
  const [isBrowser, setIsBrowser] = useState(false);
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  return isBrowser;
}

function useSafeLocalStorage(key) {
  const isBrowser = useIsBrowser();
  const [value, setValue] = useState(null);

  useEffect(() => {
    if (!isBrowser) return;
    try {
      setValue(window.localStorage.getItem(key));
    } catch {
      setValue(null);
    }
  }, [isBrowser, key]);

  useEffect(() => {
    if (!isBrowser) return;

    const sync = () => {
      try {
        setValue(window.localStorage.getItem(key));
      } catch {
        setValue(null);
      }
    };

    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [isBrowser, key]);

  return Boolean(value);
}

/**
 * Reveal — respects reduced motion, uses once:true by default for performance.
 * variant="card" keeps a slightly stronger entrance for feature cards.
 */
function Reveal({
  children,
  delay = 0,
  className,
  variant = "text",
  origin = "50% 55%",
  once = true,
}) {
  const reduceMotion = useReducedMotion();
  const variants = reduceMotion
    ? reducedVariants
    : variant === "card"
      ? cardVariants
      : variant === "slide"
        ? slideVariants
        : textVariants;

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.18, margin: "0px 0px -8% 0px" }}
      transition={{
        duration: reduceMotion ? 0.2 : ANIM.duration,
        delay: reduceMotion ? 0 : delay,
        ease: ANIM.ease,
      }}
      style={
        variant === "card" && !reduceMotion
          ? { transformOrigin: origin, willChange: "transform, opacity" }
          : { willChange: "opacity" }
      }
    >
      {children}
    </motion.div>
  );
}

/** SVG curtain — only on desktop + when motion is allowed */
function CurtainPanel({ side, progress, dark, enabled }) {
  if (!enabled) return null;

  const uid = `${side}-${dark ? "d" : "l"}`;
  const tx = useTransform(
    progress,
    [0, 0.18, 0.35, 0.65, 0.82, 1],
    side === "left"
      ? ["0%", "0%", "-102%", "-102%", "0%", "0%"]
      : ["0%", "0%", "102%", "102%", "0%", "0%"]
  );
  const c0 = dark ? (side === "left" ? "#070f1c" : "#120a1c") : side === "left" ? "#e8eef8" : "#efe8f8";
  const c1 = dark ? (side === "left" ? "#0f1c32" : "#1c1430") : side === "left" ? "#d0dceb" : "#ddd0f0";
  const fold = dark ? "#7dd3fc" : "#3b82f6";

  return (
    <Box
      component={motion.div}
      aria-hidden="true"
      style={{ x: tx }}
      sx={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: "50%",
        zIndex: 8,
        pointerEvents: "none",
        display: { xs: "none", md: "block" },
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`cg-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c0} stopOpacity="0.98" />
            <stop offset="100%" stopColor={c1} stopOpacity="0.94" />
          </linearGradient>
        </defs>
        <rect width="400" height="900" fill={`url(#cg-${uid})`} />
        <path
          d="M50 0v900M100 0v900M150 0v900M200 0v900M250 0v900M300 0v900M350 0v900"
          stroke={fold}
          strokeOpacity="0.12"
          strokeWidth="1.5"
        />
      </svg>
    </Box>
  );
}

/**
 * ScrollScene — page / curtain / stack behaviour.
 * Curtain and heavy motion only when motion is allowed and on md+.
 */
function ScrollScene({
  children,
  sx = {},
  page = false,
  curtain = false,
  stack = false,
  stackZ = 2,
  ...props
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const reduceMotion = useReducedMotion();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const enableCurtain = curtain && !reduceMotion && isMdUp;
  const enablePageMotion = page && !stack && !reduceMotion && isMdUp;

  const opacity = useTransform(
    scrollYProgress,
    enablePageMotion ? [0, 0.15, 0.85, 1] : [0, 1],
    enablePageMotion ? [0.55, 1, 1, 0.55] : [1, 1]
  );
  const y = useTransform(
    scrollYProgress,
    enablePageMotion ? [0, 0.15, 0.85, 1] : [0, 1],
    enablePageMotion ? [16, 0, 0, -16] : [0, 0]
  );

  return (
    <Box
      ref={ref}
      component="section"
      sx={{
        position: stack ? { xs: "relative", md: "sticky" } : "relative",
        top: stack ? { md: 0 } : undefined,
        zIndex: stack ? stackZ : "auto",
        minHeight: page || stack ? { xs: "auto", md: "100vh" } : "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: page || stack ? "center" : "flex-start",
        py: page || stack ? { xs: 4, sm: 5.5, md: 4 } : { xs: 4.5, sm: 6, md: 10 },
        scrollSnapAlign: page || stack ? { md: "start" } : undefined,
        scrollSnapStop: page || stack ? { md: "always" } : undefined,
        overflow: enableCurtain ? "hidden" : "visible",
        bgcolor: stack ? (dark ? "#030712" : "#ffffff") : "transparent",
        ...sx,
      }}
      {...props}
    >
      {enableCurtain && (
        <>
          <CurtainPanel side="left" progress={scrollYProgress} dark={dark} enabled={enableCurtain} />
          <CurtainPanel side="right" progress={scrollYProgress} dark={dark} enabled={enableCurtain} />
        </>
      )}
      <motion.div style={{ opacity, y, width: "100%", position: "relative", zIndex: 2 }}>
        {children}
      </motion.div>
    </Box>
  );
}

/** Parallax only on desktop + when motion is allowed */
function ParallaxVisual({ src, alt, depth = 1, className, objectFit = "contain" }) {
  const reduceMotion = useReducedMotion();
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const ref = useRef(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const enable = !reduceMotion && isMdUp;
  const y = useTransform(scrollYProgress, [0, 1], enable ? [10 * depth, -10 * depth] : [0, 0]);

  return (
    <Box ref={ref} className={className} sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ y, width: "100%", height: "100%", objectFit }}
        aria-hidden={alt === "" ? true : undefined}
      />
    </Box>
  );
}

function ServiceControlButtons({ size = "small" }) {
  // These controls are intentionally a playful visual demo on the public Home page.
  // They do not mutate a real service; the animation demonstrates the interaction.
  const reduceMotion = useReducedMotion();
  const [running, setRunning] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  const trigger = (next) => {
    setRunning(next);
    setPulseKey((key) => key + 1);
  };

  const orbitTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 2.4, repeat: Infinity, ease: "linear" };

  return (
    <Stack spacing={1} sx={{ mt: 1.25 }}>
      <Stack direction="row" spacing={1}>
        <motion.div
          key={`start-${pulseKey}`}
          animate={
            !reduceMotion && running
              ? {
                  scale: [1, 1.035, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(34,197,94,0)",
                    "0 0 0 7px rgba(34,197,94,.16)",
                    "0 0 0 14px rgba(34,197,94,0)",
                  ],
                }
              : { scale: 1, boxShadow: "0 0 0 0 rgba(34,197,94,0)" }
          }
          transition={{ duration: 1.25, repeat: running && !reduceMotion ? Infinity : 0, ease: "easeOut" }}
          style={{ borderRadius: 12 }}
        >
          <Button
            size={size}
            variant="contained"
            color="success"
            onClick={() => trigger(true)}
            startIcon={
              <motion.span
                animate={!reduceMotion && running ? { rotate: 360 } : { rotate: 0 }}
                transition={orbitTransition}
                style={{ display: "inline-flex" }}
              >
                <PlayArrowIcon sx={{ fontSize: 18 }} />
              </motion.span>
            }
            sx={{
              borderRadius: 1.5,
              fontWeight: 800,
              textTransform: "none",
              py: 0.9,
              px: 1.6,
              minHeight: 40,
              boxShadow: "none",
              minWidth: 0,
              position: "relative",
              overflow: "hidden",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 0,
                background: "linear-gradient(110deg, transparent 28%, rgba(255,255,255,.28) 48%, transparent 66%)",
                transform: running ? "translateX(120%)" : "translateX(-120%)",
                transition: running ? "transform 900ms ease" : "none",
                pointerEvents: "none",
              },
            }}
          >
            Start
          </Button>
        </motion.div>

        <motion.div
          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
          animate={
            !reduceMotion && !running
              ? {
                  boxShadow: [
                    "0 0 0 0 rgba(239,68,68,0)",
                    "0 0 0 6px rgba(239,68,68,.10)",
                    "0 0 0 0 rgba(239,68,68,0)",
                  ],
                }
              : { boxShadow: "0 0 0 0 rgba(239,68,68,0)" }
          }
          transition={{ duration: 1.9, repeat: !running && !reduceMotion ? Infinity : 0 }}
          style={{ borderRadius: 12 }}
        >
          <Button
            size={size}
            variant="outlined"
            color="error"
            onClick={() => trigger(false)}
            startIcon={<StopIcon sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: 1.5,
              fontWeight: 700,
              textTransform: "none",
              py: 0.9,
              px: 1.6,
              minHeight: 40,
              minWidth: 0,
              bgcolor: !running ? "rgba(239,68,68,.04)" : "transparent",
            }}
          >
            Stop
          </Button>
        </motion.div>
      </Stack>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 0.25 }}>
        <motion.span
          animate={
            !reduceMotion && running
              ? { scale: [1, 1.35, 1], opacity: [0.75, 1, 0.75] }
              : { scale: 1, opacity: 0.5 }
          }
          transition={{ duration: 1.15, repeat: running && !reduceMotion ? Infinity : 0 }}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            display: "inline-block",
            background: running ? "#22c55e" : "#94a3b8",
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>
          {running ? "Service is warming up…" : "Demo control • click Start"}
        </Typography>
      </Stack>
    </Stack>
  );
}

function GlassPanel({ children, sx = {}, ...props }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Paper
      elevation={0}
      {...props}
      sx={{
        border: "1px solid",
        borderColor: dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.08)",
        background: dark
          ? "linear-gradient(145deg, rgba(15,24,39,.82), rgba(7,14,25,.76))"
          : "linear-gradient(145deg, rgba(255,255,255,.9), rgba(246,249,255,.88))",
        backdropFilter: { xs: "blur(6px)", md: "blur(10px)" },
        WebkitBackdropFilter: { xs: "blur(6px)", md: "blur(10px)" },
        boxShadow: dark
          ? { xs: "0 8px 24px rgba(0,0,0,.18)", md: "0 16px 48px rgba(0,0,0,.22)" }
          : { xs: "0 8px 24px rgba(15,23,42,.06)", md: "0 16px 48px rgba(15,23,42,.07)" },
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function Metric({ value, label, accent }) {
  return (
    <Box sx={{ minWidth: 0, pr: { xs: 0.5, md: 1 } }}>
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: "1.05rem", sm: "1.35rem", md: "1.9rem" },
          letterSpacing: "-.04em",
          lineHeight: 1.15,
          background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 0.55)})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {value}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 700, display: "block", mt: 0.35, lineHeight: 1.35, fontSize: { xs: "0.68rem", sm: "0.75rem" } }}
      >
        {label}
      </Typography>
    </Box>
  );
}

function FeatureCard({ icon: Icon, number, title, body }) {
  const theme = useTheme();
  return (
    <GlassPanel
      sx={{
        height: "100%",
        p: { xs: 2, sm: 2.2, md: 3 },
        borderRadius: { xs: 2, md: 2.5 },
        position: "relative",
        overflow: "hidden",
        transition: "transform .2s ease, border-color .2s ease, box-shadow .2s ease",
        "@media (hover: hover) and (pointer: fine)": {
          "&:hover": {
            transform: "translateY(-6px)",
            borderColor: alpha(theme.palette.primary.main, 0.32),
            boxShadow: `0 28px 64px ${alpha(theme.palette.primary.main, 0.12)}`,
          },
        },
        "&:focus-within": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
        "&::after": {
          content: "''",
          position: "absolute",
          width: 180,
          height: 180,
          borderRadius: "50%",
          right: -90,
          top: -90,
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.12)}, transparent 70%)`,
          pointerEvents: "none",
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            display: "grid",
            placeItems: "center",
            color: "primary.main",
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.17),
            background: alpha(theme.palette.primary.main, 0.07),
          }}
          aria-hidden="true"
        >
          <Icon />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: ".12em" }}>
          {number}
        </Typography>
      </Stack>
      <Typography component="h3" sx={{ mt: 2.5, fontWeight: 900, fontSize: "1.05rem" }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, lineHeight: 1.7, fontSize: { xs: "0.9rem", md: "1rem" } }}>
        {body}
      </Typography>
    </GlassPanel>
  );
}

function FloatingBadge({ children, sx = {} }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  return (
    <Box
      sx={{
        px: 1.3,
        py: 0.75,
        borderRadius: 99,
        border: "1px solid",
        borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(15,23,42,.08)",
        bgcolor: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.03)",
        backdropFilter: "blur(16px)",
        fontSize: { xs: "0.65rem", sm: ".72rem" },
        fontWeight: 850,
        letterSpacing: ".02em",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/* ───────────────── Main Page ───────────────── */

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dark = theme.palette.mode === "dark";
  const reduceMotion = useReducedMotion();
  const isMdUp = useMediaQuery(theme.breakpoints.up("md"));
  const isBrowser = useIsBrowser();
  const loggedIn = useSafeLocalStorage("access");

  /* Smooth scroll + snap — only on client, cleaned up properly */
  useEffect(() => {
    if (!isBrowser) return;

    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    const prevSnap = root.style.scrollSnapType;

    root.style.scrollBehavior = "smooth";

    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => {
      root.style.scrollSnapType = mq.matches ? "y proximity" : "";
    };
    apply();

    // Modern browsers support addEventListener on MediaQueryList
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
    } else {
      mq.addListener(apply);
    }

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", apply);
      } else {
        mq.removeListener(apply);
      }
      root.style.scrollBehavior = prevBehavior;
      root.style.scrollSnapType = prevSnap;
    };
  }, [isBrowser]);

  /* Scroll progress — keep it on the compositor; avoid React state per scroll frame */
  const { scrollYProgress } = useScroll();
  const progressWidth = useTransform(scrollYProgress, (v) => `${Math.round(v * 1000) / 10}%`);
  // Tiny title parallax only on desktop; mobile stays still for calmer scroll
  const heroTitleY = useTransform(
    scrollYProgress,
    [0, 0.35],
    reduceMotion || !isMdUp ? [0, 0] : [0, -10]
  );

  const surface = dark ? "rgba(255,255,255,.035)" : "rgba(15,23,42,.025)";
  const border = dark ? "rgba(255,255,255,.075)" : "rgba(15,23,42,.075)";

  const headline = useMemo(
    () => (
      <>
        <span>From commit</span>
        <Box
          component="span"
          sx={{
            display: "block",
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || theme.palette.info.main})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          to production.
        </Box>
      </>
    ),
    [theme.palette.primary.main, theme.palette.secondary?.main, theme.palette.info.main]
  );

  const goPrimary = useCallback(() => {
    navigate(loggedIn ? "/dashboard/services" : "/signin_or_signup");
  }, [navigate, loggedIn]);

  const goDocs = useCallback(() => {
    navigate("/docs");
  }, [navigate]);

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        overflowX: "hidden",
        width: "100%",
        background: dark
          ? "linear-gradient(180deg,#030712 0%,#06101b 34%,#050b14 70%,#03060c 100%)"
          : "linear-gradient(180deg,#ffffff 0%,#f3f7ff 34%,#eef4fc 70%,#ffffff 100%)",
      }}
    >
      {/* Reading progress — driven by motion value, minimal re-render */}
      <Box
        aria-hidden="true"
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          right: 0,
          height: { xs: 2.5, md: 3 },
          zIndex: 1400,
          bgcolor: dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.08)",
          pointerEvents: "none",
        }}
      >
        <Box
          component={motion.div}
          style={{ width: progressWidth }}
          sx={{
            height: "100%",
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || theme.palette.info.main})`,
          }}
        />
      </Box>

      {/* SEO / screen-reader summary */}
      <Typography
        component="p"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        PassDeployer is a self-hosted platform as a service for deploying React, Node.js, Django and Flask applications
        with Docker, PostgreSQL, Redis, networking, persistent storage, logs and service management in one control plane.
      </Typography>

      {/* ───────────────── HERO ───────────────── */}
      <Box
        component="section"
        sx={{
          position: "relative",
          minHeight: { xs: "auto", md: "100vh" },
          display: "flex",
          alignItems: "center",
          overflow: "visible",
          scrollSnapAlign: { md: "start" },
          scrollSnapStop: { md: "always" },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 68% 32%, ${alpha(theme.palette.primary.main, dark ? 0.14 : 0.09)}, transparent 28%), radial-gradient(circle at 18% 66%, ${alpha(theme.palette.secondary?.main || theme.palette.info.main, dark ? 0.1 : 0.06)}, transparent 25%)`,
          }}
          aria-hidden="true"
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            opacity: dark ? 0.28 : 0.12,
            backgroundImage:
              "linear-gradient(rgba(120,160,220,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,220,.08) 1px, transparent 1px)",
            backgroundSize: { xs: "44px 44px", md: "76px 76px" },
            maskImage: "linear-gradient(to bottom, black 0%, transparent 92%)",
          }}
          aria-hidden="true"
        />

        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2, py: { xs: 3.5, sm: 6, md: 10 }, px: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, .92fr) minmax(380px, 1.08fr)" },
              alignItems: "center",
              gap: { xs: 2.5, md: 3 },
            }}
          >
            <motion.div style={{ y: heroTitleY }}>
              <Chip
                label="Open-source PaaS · Docker-native"
                sx={{
                  mb: 2,
                  fontWeight: 850,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.primary.main, 0.17),
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                }}
              />
              <Typography
                component="h1"
                sx={{
                  fontWeight: 950,
                  fontSize: {
                    xs: "clamp(2.1rem, 9vw, 3.1rem)",
                    sm: "clamp(2.8rem, 7vw, 4.2rem)",
                    md: "clamp(3.8rem, 5.5vw, 5.6rem)",
                    lg: "6.2rem",
                  },
                  lineHeight: { xs: 1.02, md: 0.94 },
                  letterSpacing: { xs: "-.04em", md: "-.06em" },
                  maxWidth: 820,
                }}
              >
                {headline}
              </Typography>
              <Typography
                sx={{
                  mt: 2.5,
                  maxWidth: 620,
                  fontSize: { xs: "0.95rem", sm: "1.05rem", md: "1.18rem" },
                  lineHeight: 1.75,
                }}
                color="text.secondary"
              >
                Build, ship and operate modern applications without assembling infrastructure by hand. One focused
                control plane for code, services, networks, storage and deployments.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: { xs: 2.5, sm: 3 } }}>
                <Button
                  onClick={goPrimary}
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    minHeight: 48,
                    px: 2.6,
                    borderRadius: 999,
                    fontWeight: 900,
                    width: { xs: "100%", sm: "auto" },
                    boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.22)}`,
                  }}
                >
                  {loggedIn ? "Open dashboard" : "Start deploying"}
                </Button>
                <Button
                  onClick={goDocs}
                  size="large"
                  variant="outlined"
                  endIcon={<ArrowDownwardRoundedIcon />}
                  sx={{ minHeight: 48, px: 2.4, borderRadius: 999, fontWeight: 850, width: { xs: "100%", sm: "auto" } }}
                >
                  Explore docs
                </Button>
              </Stack>
              <Stack
                direction="row"
                spacing={0.75}
                flexWrap="wrap"
                useFlexGap
                sx={{ mt: { xs: 2.25, sm: 2.8 } }}
              >
                {TECH_LABELS.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    size="small"
                    sx={{
                      height: 26,
                      fontWeight: 800,
                      fontSize: "0.7rem",
                      border: "1px solid",
                      borderColor: border,
                      bgcolor: surface,
                    }}
                  />
                ))}
              </Stack>
            </motion.div>

            <Box
              sx={{
                position: "relative",
                minHeight: { xs: 220, sm: 340, md: 560 },
                mt: { xs: 0, md: 0 },
                overflow: { xs: "hidden", md: "visible" },
                borderRadius: { xs: 2, md: 0 },
              }}
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.65, ease: ANIM.ease }}
                style={{ position: "absolute", inset: 0 }}
              >
                <Box
                  component="img"
                  src={heroNetwork}
                  alt="Abstract illustration of a PaaS deployment network connecting services"
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: dark ? 0.95 : 0.88,
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none",
                    p: { xs: 1, md: 0 },
                    boxSizing: "border-box",
                  }}
                />
              </motion.div>

              <FloatingBadge
                sx={{
                  position: "absolute",
                  top: { xs: 8, md: 36 },
                  right: { xs: 4, md: 0 },
                  zIndex: 3,
                  display: { xs: "none", sm: "block" },
                }}
              >
                deploy → observe → scale
              </FloatingBadge>

              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: reduceMotion ? 0.15 : 0.45, delay: reduceMotion ? 0 : 0.2, ease: ANIM.ease }}
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 8,
                  zIndex: 4,
                  transformOrigin: "0% 100%",
                  width: "auto",
                  maxWidth: 280,
                }}
              >
                <GlassPanel sx={{ p: { xs: 1.15, sm: 1.5 }, borderRadius: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Typography sx={{ fontWeight: 900, fontSize: { xs: ".75rem", sm: ".85rem" }, minWidth: 0 }} noWrap>
                      deployment / production
                    </Typography>
                    <Chip size="small" label="Healthy" color="success" sx={{ fontWeight: 800, borderRadius: 1, height: 22 }} />
                  </Stack>
                  <Divider sx={{ my: { xs: 0.75, sm: 1 } }} />
                  <Stack spacing={0.55}>
                    {[
                      ["Build", "Complete"],
                      ["Container", "Running"],
                      ["Network", "Healthy"],
                    ].map(([a, b]) => (
                      <Stack key={a} direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">
                          {a}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 850 }}>
                          {b}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Box sx={{ display: { xs: "none", sm: "block" } }}>
                    <ServiceControlButtons />
                  </Box>
                </GlassPanel>
              </motion.div>
            </Box>
          </Box>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: { xs: 2.5, md: 3.5 }, pt: 2, borderTop: "1px solid", borderColor: border }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, maxWidth: { xs: "100%", sm: "55%" } }}>
              Built for teams that want the platform under their control.
            </Typography>
            <Stack direction="row" spacing={2.2} sx={{ display: { xs: "none", sm: "flex" } }}>
              {STACK_GROUPS.flatMap((g) => g.items)
                .slice(0, 5)
                .map(([name, Icon]) => (
                  <Stack key={name} direction="row" spacing={0.55} alignItems="center">
                    <Icon size="0.95rem" aria-hidden="true" />
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {name}
                    </Typography>
                  </Stack>
                ))}
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ───────────────── METRICS ───────────────── */}
      <Container maxWidth="xl" sx={{ pb: { xs: 3.5, md: 9 }, px: { xs: 2, sm: 3 } }}>
        <GlassPanel sx={{ borderRadius: { xs: 2.5, md: 5 }, p: { xs: 1.75, sm: 2, md: 3 }, mt: { xs: 0, md: -1 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: { xs: 1.75, sm: 2, md: 0 },
              columnGap: { md: 0 },
              rowGap: { xs: 2, md: 0 },
            }}
          >
            {[
              ["1 control plane", "services + infrastructure", theme.palette.primary.main],
              ["Docker-native", "consistent runtime layer", theme.palette.info.main],
              ["Hourly-ready", "flexible service economics", theme.palette.secondary?.main || theme.palette.warning.main],
              ["Self-hosted", "your infrastructure, your rules", theme.palette.success.main],
            ].map(([value, label, accent], i) => (
              <Box
                key={value}
                sx={{
                  px: { md: 2 },
                  py: { xs: 0.25, md: 0 },
                  borderRight: {
                    xs: i % 2 === 0 ? "1px solid" : "none",
                    md: i < 3 ? "1px solid" : "none",
                  },
                  borderBottom: {
                    xs: i < 2 ? "1px solid" : "none",
                    md: "none",
                  },
                  borderColor: border,
                }}
              >
                <Metric value={value} label={label} accent={accent} />
              </Box>
            ))}
          </Box>
        </GlassPanel>
      </Container>

      {/* ───────────────── PLANS ───────────────── */}
      <PlansPreview />

      {/* ───────────────── FEATURES ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="lg">
          <Reveal>
            <Typography
              variant="overline"
              component="p"
              sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
            >
              A calmer way to operate
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontWeight: 950,
                fontSize: { xs: "clamp(1.7rem, 6vw, 2.4rem)", md: "3.6rem" },
                letterSpacing: "-.05em",
                lineHeight: 1.02,
                maxWidth: 820,
              }}
            >
              Less infrastructure assembly. More time shipping.
            </Typography>
            <Typography
              sx={{ mt: 1.75, maxWidth: 700, lineHeight: 1.75, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
              color="text.secondary"
            >
              PassDeployer keeps the operational surface area small: one place to create services, ship releases, read
              logs and manage the runtime boundary around your workloads.
            </Typography>
          </Reveal>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" },
              gap: 2,
              mt: { xs: 3.5, md: 5 },
            }}
          >
            <Reveal delay={0.03} variant="card">
              <FeatureCard
                number="01"
                icon={RocketLaunchRoundedIcon}
                title="Ship from one workflow"
                body="Create a service, connect code, deploy, inspect logs and manage the runtime without jumping between disconnected tools."
              />
            </Reveal>
            <Reveal delay={0.07} variant="card">
              <FeatureCard
                number="02"
                icon={SecurityRoundedIcon}
                title="Keep workloads isolated"
                body="Docker-backed services provide a predictable boundary for applications, data services and supporting workloads."
              />
            </Reveal>
            <Reveal delay={0.11} variant="card">
              <FeatureCard
                number="03"
                icon={SpeedRoundedIcon}
                title="Operate with less friction"
                body="See resource usage, service health, networking and persistent data from one focused control plane."
              />
            </Reveal>
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── DEPLOYMENT FLOW ───────────────── */}
      <ScrollScene page curtain>
        <Container maxWidth="xl">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "0.85fr 1.15fr" },
              gap: { xs: 4, md: 6 },
              alignItems: "center",
            }}
          >
            <Reveal>
              <Typography
                variant="overline"
                component="p"
                sx={{ fontWeight: 900, letterSpacing: ".16em", color: "secondary.main" }}
              >
                Deployment flow
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "clamp(1.75rem, 6vw, 2.5rem)", md: "3.6rem" },
                  letterSpacing: "-.05em",
                  lineHeight: 1.02,
                }}
              >
                Code moves forward. The platform does the heavy lifting.
              </Typography>
              <Typography
                sx={{ mt: 2, lineHeight: 1.75, maxWidth: 620, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
                color="text.secondary"
              >
                A deployment should feel like a path, not a maze. Each step stays visible so you always know where the
                release is and what happens next.
              </Typography>
              {/* Same steps appear as cards in "How it works" — hide list on small screens to cut length */}
              <Stack spacing={1.2} sx={{ mt: 2.75, display: { xs: "none", md: "flex" } }}>
                {LIFECYCLE_STEPS.map((step, i) => (
                  <Reveal key={step.title} delay={i * ANIM.stagger} variant="slide" once>
                    <Stack direction="row" spacing={1.1} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          display: "grid",
                          placeItems: "center",
                          border: "1px solid",
                          borderColor: alpha(theme.palette.primary.main, 0.2),
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          color: "primary.main",
                          fontSize: ".72rem",
                          fontWeight: 900,
                          flex: "0 0 auto",
                          mt: 0.15,
                        }}
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </Box>
                      <Box>
                        <Typography component="h3" sx={{ fontWeight: 750, fontSize: "1rem" }}>
                          {step.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.6 }}>
                          {step.body}
                        </Typography>
                      </Box>
                    </Stack>
                  </Reveal>
                ))}
              </Stack>
            </Reveal>

            <Reveal delay={0.06}>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 200, sm: 320, md: 500 },
                  borderRadius: { xs: 2.5, md: 5 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(4,10,18,.7)" : "rgba(255,255,255,.68)",
                }}
              >
                <ParallaxVisual src={deployFlow} alt="Abstract visual of the deployment lifecycle stages" depth={0.5} />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 40%)`,
                  }}
                  aria-hidden="true"
                />
                <GlassPanel
                  sx={{
                    position: "absolute",
                    right: { xs: 10, md: 20 },
                    top: { xs: 10, md: 20 },
                    width: { xs: 160, md: 220 },
                    p: 1.4,
                    borderRadius: 1.5,
                  }}
                >
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" sx={{ fontWeight: 900 }}>
                      release
                    </Typography>
                    <Typography variant="caption" color="success.main">
                      ready
                    </Typography>
                  </Stack>
                  <Typography sx={{ mt: 0.6, fontSize: ".75rem", color: "text.secondary" }}>main → production</Typography>
                  <Box
                    sx={{
                      mt: 1,
                      height: 5,
                      borderRadius: 99,
                      bgcolor: dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.06)",
                      overflow: "hidden",
                    }}
                    role="progressbar"
                    aria-valuenow={86}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Release progress"
                  >
                    <Box
                      sx={{
                        width: "86%",
                        height: "100%",
                        background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || theme.palette.info.main})`,
                      }}
                    />
                  </Box>
                </GlassPanel>
              </Box>
            </Reveal>
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── HOW IT WORKS ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="xl">
          <Reveal>
            <Box sx={{ textAlign: { xs: "left", md: "center" }, maxWidth: 780, mx: "auto", mb: { xs: 4, md: 5.5 } }}>
              <Typography
                variant="overline"
                component="p"
                sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
              >
                How it works
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "clamp(1.7rem, 6vw, 2.4rem)", md: "3.4rem" },
                  letterSpacing: "-.05em",
                  lineHeight: 1.05,
                }}
              >
                A clear path from repository to running service.
              </Typography>
            </Box>
          </Reveal>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.15fr" },
              gap: { xs: 3.5, md: 4.5 },
              alignItems: "stretch",
            }}
          >
            <Reveal>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 180, md: 380 },
                  borderRadius: { xs: 2.5, md: 4.5 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(5,11,20,.75)" : "rgba(255,255,255,.7)",
                }}
              >
                <ParallaxVisual src={deployPipeline} alt="Illustration of a continuous deployment pipeline" depth={0.4} />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(180deg, transparent 40%, ${dark ? "rgba(3,7,14,.85)" : "rgba(255,255,255,.75)"} 100%)`,
                  }}
                  aria-hidden="true"
                />
                <FloatingBadge sx={{ position: "absolute", left: 14, bottom: 14, zIndex: 2 }}>
                  pipeline · build · release
                </FloatingBadge>
              </Box>
            </Reveal>

            <Stack spacing={1.35}>
              {LIFECYCLE_STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * ANIM.stagger}>
                  <GlassPanel
                    sx={{
                      p: { xs: 1.8, md: 2.2 },
                      borderRadius: 3.5,
                      transition: "border-color .22s ease, transform .22s ease",
                      "&:hover": {
                        borderColor: alpha(theme.palette.primary.main, 0.28),
                        transform: isMdUp ? "translateX(3px)" : "none",
                      },
                      "&:focus-within": {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.4} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 auto",
                          fontWeight: 900,
                          fontSize: ".82rem",
                          color: "primary.main",
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.primary.main, 0.16),
                        }}
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </Box>
                      <Box>
                        <Typography component="h3" sx={{ fontWeight: 900 }}>
                          {step.title}
                        </Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.35, lineHeight: 1.65, fontSize: ".92rem" }}>
                          {step.body}
                        </Typography>
                      </Box>
                    </Stack>
                  </GlassPanel>
                </Reveal>
              ))}
            </Stack>
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── STACK ───────────────── */}
      <ScrollScene>
        <Container maxWidth="xl">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1.2fr" },
              gap: { xs: 4, md: 5.5 },
              alignItems: "center",
            }}
          >
            <Reveal>
              <Typography
                variant="overline"
                component="p"
                sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
              >
                Bring your stack
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "clamp(1.75rem, 6vw, 2.5rem)", md: "3.6rem" },
                  letterSpacing: "-.05em",
                  lineHeight: 1.02,
                }}
              >
                Your applications. Your runtime. Your infrastructure.
              </Typography>
              <Typography
                sx={{ mt: 2, lineHeight: 1.75, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
                color="text.secondary"
              >
                PassDeployer is intentionally broad enough to support the application layer and focused enough to keep
                the operations experience understandable.
              </Typography>
              <Stack spacing={1.15} sx={{ mt: 2.75 }}>
                {STACK_HIGHLIGHTS.map(([title, body]) => (
                  <Stack key={title} direction="row" spacing={1.15} alignItems="flex-start">
                    <CheckRoundedIcon sx={{ color: "success.main", mt: 0.1, fontSize: 20 }} aria-hidden="true" />
                    <Box>
                      <Typography component="h3" sx={{ fontWeight: 850 }}>
                        {title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {body}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Reveal>

            <Reveal delay={0.06}>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 200, sm: 320, md: 520 },
                  borderRadius: { xs: 2.5, md: 5 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(5,11,20,.7)" : "rgba(255,255,255,.68)",
                }}
              >
                <ParallaxVisual
                  src={productionNetwork}
                  alt="Three application services on a shared network connected to the internet"
                  depth={0.45}
                />
              </Box>
            </Reveal>
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── PLATFORM CAPABILITIES ───────────────── */}
      <ScrollScene page stack stackZ={1}>
        <Container maxWidth="lg">
          <Reveal>
            <Typography
              variant="overline"
              component="p"
              sx={{ fontWeight: 900, letterSpacing: ".16em", color: "secondary.main" }}
            >
              Control plane
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontWeight: 950,
                fontSize: { xs: "clamp(1.7rem, 6vw, 2.4rem)", md: "3.4rem" },
                letterSpacing: "-.05em",
              }}
            >
              The boring parts should stay boring.
            </Typography>
            <Typography
              sx={{ mt: 1.4, maxWidth: 620, lineHeight: 1.7, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
              color="text.secondary"
            >
              Everything you need to run day-to-day operations lives in one place — so you spend less time wiring tools
              and more time shipping product.
            </Typography>
          </Reveal>
          <Box
            sx={{
              mt: { xs: 3.5, md: 4.5 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 1.75,
            }}
          >
            {CAPABILITIES.map(([title, Icon, body], i) => (
              <Reveal key={title} delay={i * 0.04}>
                <GlassPanel
                  sx={{
                    p: { xs: 1.9, md: 2.4 },
                    borderRadius: 3.5,
                    height: "100%",
                    "&:focus-within": {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.4}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2.2,
                        display: "grid",
                        placeItems: "center",
                        color: "primary.main",
                        bgcolor: alpha(theme.palette.primary.main, 0.07),
                        flex: "0 0 auto",
                      }}
                      aria-hidden="true"
                    >
                      <Icon />
                    </Box>
                    <Box>
                      <Typography component="h3" sx={{ fontWeight: 900 }}>
                        {title}
                      </Typography>
                      <Typography sx={{ mt: 0.4, lineHeight: 1.65, fontSize: ".92rem" }} color="text.secondary">
                        {body}
                      </Typography>
                    </Box>
                  </Stack>
                </GlassPanel>
              </Reveal>
            ))}
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── REPOSITORIES ───────────────── */}
      <ScrollScene page stack stackZ={2}>
        <Container maxWidth="lg">
          <Reveal>
            <GlassPanel
              sx={{
                borderRadius: { xs: 4, md: 5.5 },
                p: { xs: 2.25, sm: 3.5, md: 4.5 },
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at 100% 0%, ${alpha(
                    theme.palette.secondary?.main || theme.palette.info.main,
                    dark ? 0.12 : 0.07
                  )}, transparent 30%)`,
                }}
                aria-hidden="true"
              />
              <Box
                sx={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1.2fr .8fr" },
                  gap: { xs: 3, md: 3.5 },
                  alignItems: "center",
                }}
              >
                <Box>
                  <Typography
                    variant="overline"
                    component="p"
                    sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
                  >
                    Built in public
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{
                      mt: 1,
                      fontWeight: 950,
                      fontSize: { xs: "clamp(1.65rem, 5.5vw, 2.3rem)", md: "3.2rem" },
                      letterSpacing: "-.05em",
                      lineHeight: 1.05,
                    }}
                  >
                    Inspect it. Adapt it. Run it yourself.
                  </Typography>
                  <Typography
                    sx={{ mt: 1.75, lineHeight: 1.75, fontSize: { xs: "0.95rem", md: "1.05rem" } }}
                    color="text.secondary"
                  >
                    The UI and API are separate so you can understand the pieces and evolve the control plane around your
                    own infrastructure.
                  </Typography>
                </Box>
                <Stack spacing={1.15}>
                  <Button
                    variant="contained"
                    href={GITHUB_FRONTEND}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<GitHubIcon />}
                    endIcon={<LaunchRoundedIcon />}
                    sx={{ minHeight: 50, borderRadius: 999, fontWeight: 850 }}
                  >
                    Frontend repository
                  </Button>
                  <Button
                    variant="outlined"
                    href={GITHUB_API}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<GitHubIcon />}
                    endIcon={<LaunchRoundedIcon />}
                    sx={{ minHeight: 50, borderRadius: 999, fontWeight: 850 }}
                  >
                    Backend repository
                  </Button>
                </Stack>
              </Box>
            </GlassPanel>
          </Reveal>
        </Container>
      </ScrollScene>

      {/* ───────────────── FAQ ───────────────── */}
      <ScrollScene>
        <Container maxWidth="md">
          <Reveal>
            <Typography
              variant="overline"
              component="p"
              sx={{ fontWeight: 900, letterSpacing: ".16em", color: "primary.main" }}
            >
              FAQ
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontWeight: 950,
                fontSize: { xs: "clamp(1.65rem, 5.5vw, 2.3rem)", md: "3.4rem" },
                letterSpacing: "-.05em",
                lineHeight: 1.05,
              }}
            >
              Questions before you deploy.
            </Typography>
          </Reveal>
          <Box sx={{ mt: 3.5 }}>
            {FAQ_ITEMS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.03}>
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    background: "transparent",
                    borderTop: "1px solid",
                    borderColor: border,
                    "&:last-of-type": { borderBottom: "1px solid", borderColor: border },
                    "&::before": { display: "none" },
                    "& .MuiAccordionSummary-root:focus-visible": {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreRoundedIcon />}
                    sx={{ px: 0, py: { xs: 1.35, md: 1.15 }, minHeight: { xs: 56, md: 52 } }}
                    aria-controls={`faq-panel-${i}-content`}
                    id={`faq-panel-${i}-header`}
                  >
                    <Typography component="h3" sx={{ fontWeight: 850 }}>
                      {faq.q}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 2.5 }} id={`faq-panel-${i}-content`}>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.75, maxWidth: 720, fontSize: "0.95rem" }}>
                      {faq.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Reveal>
            ))}
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── FINAL CTA ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="lg">
          <Reveal>
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: { xs: 4, md: 6 },
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.16),
                p: { xs: 2.75, sm: 4, md: 6.5 },
                textAlign: "center",
                background: dark
                  ? "linear-gradient(145deg, rgba(16,27,44,.95), rgba(7,12,21,.97))"
                  : "linear-gradient(145deg, #ffffff, #eef5ff)",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: { xs: 220, md: 380 },
                  height: { xs: 220, md: 380 },
                  borderRadius: "50%",
                  right: { xs: -100, md: -160 },
                  top: { xs: -120, md: -210 },
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.16)}, transparent 68%)`,
                }}
                aria-hidden="true"
              />
              <Box
                sx={{
                  position: "absolute",
                  width: { xs: 180, md: 300 },
                  height: { xs: 180, md: 300 },
                  borderRadius: "50%",
                  left: { xs: -80, md: -140 },
                  bottom: { xs: -100, md: -190 },
                  background: `radial-gradient(circle, ${alpha(
                    theme.palette.secondary?.main || theme.palette.info.main,
                    0.12
                  )}, transparent 68%)`,
                }}
                aria-hidden="true"
              />
              <Box sx={{ position: "relative" }}>
                <Typography
                  component="h2"
                  sx={{
                    fontWeight: 950,
                    fontSize: { xs: "clamp(1.7rem, 6vw, 2.5rem)", md: "3.8rem" },
                    letterSpacing: "-.055em",
                    lineHeight: 1.02,
                  }}
                >
                  Ready to move the next deployment?
                </Typography>
                <Typography
                  sx={{
                    mt: 1.75,
                    maxWidth: 640,
                    mx: "auto",
                    lineHeight: 1.75,
                    fontSize: { xs: "0.95rem", md: "1.05rem" },
                  }}
                  color="text.secondary"
                >
                  Start with the control plane, then make the infrastructure as custom as your workload demands.
                </Typography>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="center"
                  spacing={1.2}
                  sx={{ mt: 2.75 }}
                >
                  <Button
                    size="large"
                    variant="contained"
                    onClick={goPrimary}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ minHeight: 52, px: 2.8, borderRadius: 999, fontWeight: 900, width: { xs: "100%", sm: "auto" } }}
                  >
                    Start deploying
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    onClick={goDocs}
                    sx={{ minHeight: 52, px: 2.8, borderRadius: 999, fontWeight: 850, width: { xs: "100%", sm: "auto" } }}
                  >
                    Read the docs
                  </Button>
                </Stack>
              </Box>
            </Box>
          </Reveal>
        </Container>
      </ScrollScene>
    </Box>
  );
}