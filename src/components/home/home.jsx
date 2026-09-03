import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
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

const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";

const faqs = [
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

const stackGroups = [
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

const lifecycleSteps = [
  { title: "Connect source", body: "Point a service at your repository and let the platform own the rest of the path." },
  { title: "Build image", body: "Consistent Docker builds turn application code into a deployable runtime unit." },
  { title: "Ship release", body: "Promote a release into the environment with clear status, logs and health signals." },
  { title: "Observe & scale", body: "Keep networking, storage and resource controls close to the service itself." },
];

/** Bidirectional, GPU-cheap enter/leave (transform + opacity only). */
/**
 * Cards: expand from a single point, collapse back into the same point
 * when leaving the viewport (works both scroll directions).
 */
/** Different motions for different roles — not one animation for everything. */
const textVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0 },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.14 },
  show: { opacity: 1, scale: 1 },
};

const slideVariants = {
  hidden: { opacity: 0, x: -28 },
  show: { opacity: 1, x: 0 },
};

function Reveal({ children, delay = 0, className, variant = "text", origin = "50% 55%" }) {
  const variants =
    variant === "card" ? cardVariants : variant === "slide" ? slideVariants : textVariants;
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: false, amount: 0.32, margin: "0px 0px -6% 0px" }}
      transition={{ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] }}
      style={
        variant === "card"
          ? { transformOrigin: origin, willChange: "transform, opacity" }
          : { willChange: "transform, opacity" }
      }
    >
      {children}
    </motion.div>
  );
}

/** SVG curtain panel — progress 0→1 opens then can close; reverse scroll closes. */
function CurtainPanel({ side, progress, dark }) {
  const uid = `${side}-${dark ? "d" : "l"}`;
  // 0 = closed (covering), mid = open (aside), 1 = closed again
  const tx = useTransform(
    progress,
    [0, 0.18, 0.35, 0.65, 0.82, 1],
    side === "left"
      ? ["0%", "0%", "-102%", "-102%", "0%", "0%"]
      : ["0%", "0%", "102%", "102%", "0%", "0%"]
  );
  const c0 = dark ? (side === "left" ? "#070f1c" : "#120a1c") : (side === "left" ? "#e8eef8" : "#efe8f8");
  const c1 = dark ? (side === "left" ? "#0f1c32" : "#1c1430") : (side === "left" ? "#d0dceb" : "#ddd0f0");
  const fold = dark ? "#7dd3fc" : "#3b82f6";

  return (
    <Box
      component={motion.div}
      aria-hidden
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
      <svg width="100%" height="100%" viewBox="0 0 400 900" preserveAspectRatio="none">
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
 * page  → full-viewport + snap (only for selected sections)
 * curtain → dual SVG curtains (open on enter, close on leave / scroll back)
 */
function ScrollScene({ children, sx = {}, page = false, curtain = false, stack = false, stackZ = 2, ...props }) {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // mild motion — stack pages use less fade so the cover feels solid
  const opacity = useTransform(
    scrollYProgress,
    page && !stack ? [0, 0.15, 0.85, 1] : [0, 1],
    page && !stack ? [0.4, 1, 1, 0.4] : [1, 1]
  );
  const y = useTransform(
    scrollYProgress,
    page && !stack ? [0, 0.15, 0.85, 1] : [0, 1],
    page && !stack ? [24, 0, 0, -24] : [0, 0]
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
        py: page || stack ? { xs: 7, md: 4 } : { xs: 8, md: 12 },
        scrollSnapAlign: page || stack ? { md: "start" } : undefined,
        scrollSnapStop: page || stack ? { md: "always" } : undefined,
        overflow: curtain ? "hidden" : "visible",
        // solid surface so the lower page can cover the upper one cleanly
        bgcolor: stack
          ? dark
            ? "#030712"
            : "#ffffff"
          : "transparent",
        ...sx,
      }}
      {...props}
    >
      {curtain && (
        <>
          <CurtainPanel side="left" progress={scrollYProgress} dark={dark} />
          <CurtainPanel side="right" progress={scrollYProgress} dark={dark} />
        </>
      )}
      <motion.div style={{ opacity, y, width: "100%", position: "relative", zIndex: 2 }}>
        {children}
      </motion.div>
    </Box>
  );
}

function ParallaxVisual({ src, alt, depth = 1, className, objectFit = "contain" }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [12 * depth, -12 * depth]);

  return (
    <Box ref={ref} className={className} sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ y, width: "100%", height: "100%", objectFit }}
      />
    </Box>
  );
}

function ServiceControlButtons({ size = "small" }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
      <Button
        size={size}
        variant="contained"
        color="success"
        startIcon={<PlayArrowIcon sx={{ fontSize: 18 }} />}
        sx={{
          borderRadius: 1.5,
          fontWeight: 700,
          textTransform: "none",
          py: 0.75,
          px: 1.5,
          boxShadow: "none",
          minWidth: 0,
        }}
      >
        Start
      </Button>
      <Button
        size={size}
        variant="outlined"
        color="error"
        startIcon={<StopIcon sx={{ fontSize: 18 }} />}
        sx={{
          borderRadius: 1.5,
          fontWeight: 600,
          textTransform: "none",
          py: 0.75,
          px: 1.5,
          minWidth: 0,
        }}
      >
        Stop
      </Button>
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
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: dark ? "0 16px 48px rgba(0,0,0,.22)" : "0 16px 48px rgba(15,23,42,.07)",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

function Metric({ value, label, accent }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: "1.45rem", md: "1.9rem" },
          letterSpacing: "-.045em",
          background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 0.55)})`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
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
        p: { xs: 2.2, md: 3 },
        borderRadius: { xs: 2, md: 2.5 },
        position: "relative",
        overflow: "hidden",
        transition: "transform .2s ease, border-color .2s ease, box-shadow .2s ease",
        "&:hover": {
          transform: "translateY(-8px)",
          borderColor: alpha(theme.palette.primary.main, 0.32),
          boxShadow: `0 34px 80px ${alpha(theme.palette.primary.main, 0.14)}`,
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
        >
          <Icon />
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: ".12em" }}>
          {number}
        </Typography>
      </Stack>
      <Typography sx={{ mt: 3, fontWeight: 900, fontSize: "1.05rem" }}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1.1, lineHeight: 1.75 }}>
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
        px: 1.4,
        py: 0.9,
        borderRadius: 99,
        border: "1px solid",
        borderColor: dark ? "rgba(255,255,255,.1)" : "rgba(15,23,42,.08)",
        bgcolor: dark ? "rgba(255,255,255,.04)" : "rgba(15,23,42,.03)",
        backdropFilter: "blur(16px)",
        fontSize: ".72rem",
        fontWeight: 850,
        letterSpacing: ".02em",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export default function Home() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dark = theme.palette.mode === "dark";
  const [loggedIn, setLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(window.localStorage.getItem("access"));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        setLoggedIn(Boolean(window.localStorage.getItem("access")));
      } catch {
        setLoggedIn(false);
      }
    };
    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Smooth scrolling on <html> + page snap on desktop
  useEffect(() => {
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    const prevSnap = root.style.scrollSnapType;
    root.style.scrollBehavior = "smooth";

    const mq = window.matchMedia("(min-width: 900px)");
    const apply = () => {
      root.style.scrollSnapType = mq.matches ? "y proximity" : "";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => {
      mq.removeEventListener("change", apply);
      root.style.scrollBehavior = prevBehavior;
      root.style.scrollSnapType = prevSnap;
    };
  }, []);


  // Top progress: window scroll (works even if layout wrappers are odd)
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const { scrollYProgress } = useScroll();
  const heroTitleY = useTransform(scrollYProgress, [0, 0.4], [0, -12]);

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

  return (
    <Box
      component="main"
      sx={{
        position: "relative",
        background: dark
          ? "linear-gradient(180deg,#030712 0%,#06101b 34%,#050b14 70%,#03060c 100%)"
          : "linear-gradient(180deg,#ffffff 0%,#f3f7ff 34%,#eef4fc 70%,#ffffff 100%)",
      }}
    >
      {/* Top reading progress — track + fill (scaleX grows with scroll) */}
      <Box
        aria-hidden
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          right: 0,
          height: 3,
          zIndex: 1400,
          bgcolor: dark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.08)",
          pointerEvents: "none",
        }}
      >
        <Box
          sx={{
            height: "100%",
            width: `${scrollProgress * 100}%`,
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || theme.palette.info.main})`,
            transition: "width 60ms linear",
          }}
        />
      </Box>

      {/* SEO content remains in the DOM without cluttering the visual UI. */}
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
        />

        <Container maxWidth="xl" sx={{ position: "relative", zIndex: 2, py: { xs: 7, sm: 9, md: 12 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(0, .92fr) minmax(420px, 1.08fr)" },
              alignItems: "center",
              gap: { xs: 5, md: 3 },
            }}
          >
            <motion.div style={{ y: heroTitleY }}>
              <Chip
                label="Open-source PaaS · Docker-native"
                sx={{
                  mb: 2.5,
                  fontWeight: 850,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.primary.main, 0.17),
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                }}
              />
              <Typography
                sx={{
                  fontWeight: 950,
                  fontSize: { xs: "3.2rem", sm: "4.5rem", md: "5.8rem", lg: "6.7rem" },
                  lineHeight: 0.92,
                  letterSpacing: "-.065em",
                  maxWidth: 820,
                }}
              >
                {headline}
              </Typography>
              <Typography
                sx={{ mt: 3, maxWidth: 650, fontSize: { xs: "1rem", sm: "1.12rem", md: "1.22rem" }, lineHeight: 1.8 }}
                color="text.secondary"
              >
                Build, ship and operate modern applications without assembling infrastructure by hand. One focused
                control plane for code, services, networks, storage and deployments.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 3.2 }}>
                <Button
                  onClick={() => navigate(loggedIn ? "/services" : "/signin_or_signup")}
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    minHeight: 54,
                    px: 2.8,
                    borderRadius: 999,
                    fontWeight: 900,
                    boxShadow: `0 15px 40px ${alpha(theme.palette.primary.main, 0.24)}`,
                  }}
                >
                  {loggedIn ? "Open dashboard" : "Start deploying"}
                </Button>
                <Button
                  onClick={() => navigate("/docs")}
                  size="large"
                  variant="outlined"
                  endIcon={<ArrowDownwardRoundedIcon />}
                  sx={{ minHeight: 54, px: 2.6, borderRadius: 999, fontWeight: 850 }}
                >
                  Explore docs
                </Button>
              </Stack>
              <Stack direction="row" spacing={2.2} flexWrap="wrap" useFlexGap sx={{ mt: 3.2, color: "text.secondary" }}>
                {["React", "Node.js", "Django", "Flask", "Docker"].map((item) => (
                  <Typography key={item} variant="caption" sx={{ fontWeight: 800, letterSpacing: ".04em" }}>
                    {item}
                  </Typography>
                ))}
              </Stack>
            </motion.div>

            <Box
              sx={{
                position: "relative",
                minHeight: { xs: 360, sm: 500, md: 650 },
                mt: { xs: 1, md: 0 },
                overflow: "visible",
              }}
            >
              {/* Hero SVG — no scroll-linked parallax so it stays on screen longer */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: "2% -6% 2% -6%" }}
              >
                <Box
                  component="img"
                  src={heroNetwork}
                  alt="Abstract PaaS deployment network illustration"
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    opacity: dark ? 0.95 : 0.88,
                    display: "block",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                />
              </motion.div>

              <FloatingBadge sx={{ position: "absolute", top: { xs: 12, md: 42 }, right: { xs: 3, md: 0 }, zIndex: 3 }}>
                deploy → observe → scale
              </FloatingBadge>

              {/* Start/Stop card — bottom-left on the first SVG */}
              <motion.div
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  left: 8,
                  bottom: 8,
                  zIndex: 4,
                  transformOrigin: "0% 100%",
                  width: "min(300px, 92%)",
                }}
              >
                <GlassPanel sx={{ p: 1.75, borderRadius: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontWeight: 900, fontSize: ".88rem" }}>deployment / production</Typography>
                    <Chip size="small" label="Healthy" color="success" sx={{ fontWeight: 800, borderRadius: 1 }} />
                  </Stack>
                  <Divider sx={{ my: 1.1 }} />
                  <Stack spacing={0.8}>
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
                  <ServiceControlButtons />
                </GlassPanel>
              </motion.div>
            </Box>
          </Box>

          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mt: { xs: 3, md: 4 }, pt: 2.2, borderTop: "1px solid", borderColor: border }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              Built for teams that want the platform under their control.
            </Typography>
            <Stack direction="row" spacing={2.5} sx={{ display: { xs: "none", sm: "flex" } }}>
              {stackGroups
                .flatMap((g) => g.items)
                .slice(0, 5)
                .map(([name, Icon]) => (
                  <Stack key={name} direction="row" spacing={0.6} alignItems="center">
                    <Icon size="1rem" />
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
      <Container maxWidth="xl" sx={{ pb: { xs: 8, md: 12 } }}>
        <GlassPanel sx={{ borderRadius: { xs: 4, md: 5 }, p: { xs: 2.2, md: 3 }, mt: -1 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: { xs: 2.5, md: 0 },
            }}
          >
            <Metric value="1 control plane" label="services + infrastructure" accent={theme.palette.primary.main} />
            <Metric value="Docker-native" label="consistent runtime layer" accent={theme.palette.info.main} />
            <Metric
              value="Hourly-ready"
              label="flexible service economics"
              accent={theme.palette.secondary?.main || theme.palette.warning.main}
            />
            <Metric value="Self-hosted" label="your infrastructure, your rules" accent={theme.palette.success.main} />
          </Box>
        </GlassPanel>
      </Container>

      {/* ───────────────── FEATURES (page) ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="lg">
          <Reveal>
            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "primary.main" }}>
              A calmer way to operate
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontWeight: 950,
                fontSize: { xs: "2.4rem", md: "4rem" },
                letterSpacing: "-.055em",
                lineHeight: 0.98,
                maxWidth: 850,
              }}
            >
              Less infrastructure assembly. More time shipping.
            </Typography>
            <Typography sx={{ mt: 2, maxWidth: 720, lineHeight: 1.8 }} color="text.secondary">
              PassDeployer keeps the operational surface area small: one place to create services, ship releases, read
              logs and manage the runtime boundary around your workloads.
            </Typography>
          </Reveal>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2, mt: 5 }}>
            <Reveal delay={0.04} variant="card">
              <FeatureCard
                number="01"
                icon={RocketLaunchRoundedIcon}
                title="Ship from one workflow"
                body="Create a service, connect code, deploy, inspect logs and manage the runtime without jumping between disconnected tools."
              />
            </Reveal>
            <Reveal delay={0.1} variant="card">
              <FeatureCard
                number="02"
                icon={SecurityRoundedIcon}
                title="Keep workloads isolated"
                body="Docker-backed services provide a predictable boundary for applications, data services and supporting workloads."
              />
            </Reveal>
            <Reveal delay={0.16} variant="card">
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

{/* ───────────────── DEPLOYMENT FLOW (page + curtain) ───────────────── */}
      <ScrollScene page curtain>
        <Container maxWidth="xl">
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "0.85fr 1.15fr" },
              gap: { xs: 5, md: 7 },
              alignItems: "center",
            }}
          >
            <Reveal>
              <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "secondary.main" }}>
                Deployment flow
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "2.55rem", md: "4rem" },
                  letterSpacing: "-.055em",
                  lineHeight: 0.98,
                }}
              >
                Code moves forward. The platform does the heavy lifting.
              </Typography>
              <Typography sx={{ mt: 2.4, lineHeight: 1.8, maxWidth: 650 }} color="text.secondary">
                A deployment should feel like a path, not a maze. Each step stays visible so you always know where the
                release is and what happens next.
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 3 }}>
                {lifecycleSteps.map((step, i) => (
                  <Reveal key={step.title} delay={i * 0.06} variant="slide">
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
                          mt: 0.2,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 750 }}>{step.title}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3, lineHeight: 1.65 }}>
                          {step.body}
                        </Typography>
                      </Box>
                    </Stack>
                  </Reveal>
                ))}
              </Stack>
            </Reveal>

            <Reveal delay={0.08}>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 360, sm: 480, md: 560 },
                  borderRadius: { xs: 4, md: 6 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(4,10,18,.7)" : "rgba(255,255,255,.68)",
                }}
              >
                <ParallaxVisual src={deployFlow} alt="Abstract deployment lifecycle visual" depth={0.6} />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 40%)`,
                  }}
                />
                <GlassPanel
                  sx={{
                    position: "absolute",
                    right: { xs: 12, md: 22 },
                    top: { xs: 12, md: 22 },
                    width: { xs: 180, md: 240 },
                    p: 1.5,
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
                  <Typography sx={{ mt: 0.8, fontSize: ".78rem", color: "text.secondary" }}>main → production</Typography>
                  <Box
                    sx={{
                      mt: 1.1,
                      height: 5,
                      borderRadius: 99,
                      bgcolor: dark ? "rgba(255,255,255,.07)" : "rgba(15,23,42,.06)",
                      overflow: "hidden",
                    }}
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



      {/* ───────────────── HOW IT WORKS (page) ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="xl">
          <Reveal>
            <Box sx={{ textAlign: { xs: "left", md: "center" }, maxWidth: 820, mx: "auto", mb: 6 }}>
              <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "primary.main" }}>
                How it works
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "2.4rem", md: "3.8rem" },
                  letterSpacing: "-.05em",
                  lineHeight: 1,
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
              gap: { xs: 4, md: 5 },
              alignItems: "stretch",
            }}
          >
            <Reveal>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 280, md: 420 },
                  borderRadius: { xs: 4, md: 5 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(5,11,20,.75)" : "rgba(255,255,255,.7)",
                }}
              >
                <ParallaxVisual src={deployPipeline} alt="Deployment pipeline illustration" depth={0.5} />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(180deg, transparent 40%, ${dark ? "rgba(3,7,14,.85)" : "rgba(255,255,255,.75)"} 100%)`,
                  }}
                />
                <FloatingBadge sx={{ position: "absolute", left: 16, bottom: 16, zIndex: 2 }}>
                  pipeline · build · release
                </FloatingBadge>
              </Box>
            </Reveal>

            <Stack spacing={1.5}>
              {lifecycleSteps.map((step, i) => (
                <Reveal key={step.title} delay={i * 0.05}>
                  <GlassPanel
                    sx={{
                      p: { xs: 2, md: 2.4 },
                      borderRadius: 4,
                      transition: "border-color .25s ease, transform .25s ease",
                      "&:hover": {
                        borderColor: alpha(theme.palette.primary.main, 0.28),
                        transform: "translateX(4px)",
                      },
                    }}
                  >
                    <Stack direction="row" spacing={1.6} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2.2,
                          display: "grid",
                          placeItems: "center",
                          flex: "0 0 auto",
                          fontWeight: 900,
                          fontSize: ".85rem",
                          color: "primary.main",
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          border: "1px solid",
                          borderColor: alpha(theme.palette.primary.main, 0.16),
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>{step.title}</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.7, fontSize: ".95rem" }}>
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
              gap: { xs: 5, md: 6 },
              alignItems: "center",
            }}
          >
            <Reveal>
              <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "primary.main" }}>
                Bring your stack
              </Typography>
              <Typography
                component="h2"
                sx={{
                  mt: 1,
                  fontWeight: 950,
                  fontSize: { xs: "2.5rem", md: "4rem" },
                  letterSpacing: "-.055em",
                  lineHeight: 0.98,
                }}
              >
                Your applications. Your runtime. Your infrastructure.
              </Typography>
              <Typography sx={{ mt: 2.3, lineHeight: 1.8 }} color="text.secondary">
                PassDeployer is intentionally broad enough to support the application layer and focused enough to keep
                the operations experience understandable.
              </Typography>
              <Stack spacing={1.2} sx={{ mt: 3 }}>
                {[
                  ["Frontend", "React and static web workloads"],
                  ["Backend", "Django, Flask, Node.js and Docker services"],
                  ["Data", "PostgreSQL, Redis and persistent storage"],
                ].map(([title, body]) => (
                  <Stack key={title} direction="row" spacing={1.2} alignItems="flex-start">
                    <CheckRoundedIcon sx={{ color: "success.main", mt: 0.15 }} />
                    <Box>
                      <Typography sx={{ fontWeight: 850 }}>{title}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {body}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Reveal>

            <Reveal delay={0.08}>
              <Box
                sx={{
                  position: "relative",
                  minHeight: { xs: 360, sm: 470, md: 590 },
                  borderRadius: { xs: 4, md: 6 },
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: border,
                  background: dark ? "rgba(5,11,20,.7)" : "rgba(255,255,255,.68)",
                }}
              >
                <ParallaxVisual
                  src={productionNetwork}
                  alt="Three services on a shared network connected to the internet"
                  depth={0.55}
                />
              </Box>
            </Reveal>
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── PLATFORM CAPABILITIES (stack layer 1) ───────────────── */}
      <ScrollScene page stack stackZ={1}>
        <Container maxWidth="lg">
          <Reveal>
            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "secondary.main" }}>
              Control plane
            </Typography>
            <Typography
              component="h2"
              sx={{ mt: 1, fontWeight: 950, fontSize: { xs: "2.4rem", md: "3.8rem" }, letterSpacing: "-.05em" }}
            >
              The boring parts should stay boring.
            </Typography>
            <Typography sx={{ mt: 1.5, maxWidth: 640, lineHeight: 1.75 }} color="text.secondary">
              Everything you need to run day-to-day operations lives in one place — so you spend less time wiring tools
              and more time shipping product.
            </Typography>
          </Reveal>
          <Box sx={{ mt: 5, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" }, gap: 2 }}>
            {[
              ["Services", TerminalRoundedIcon, "Create and manage runtime services from a single place."],
              ["Deployments", RocketLaunchRoundedIcon, "Track releases, build state, logs and rollout health."],
              ["Storage", StorageRoundedIcon, "Persistent volumes remain first-class resources in the platform."],
              ["Resource controls", MemoryRoundedIcon, "Keep CPU, memory and storage close to the service definition."],
              ["Security", SecurityRoundedIcon, "Use isolated containers and clear service boundaries as the execution model."],
              ["Automation", AutoAwesomeRoundedIcon, "Reduce repeated operational work by keeping the lifecycle in one control plane."],
            ].map(([title, Icon, body], i) => (
              <Reveal key={title} delay={i * 0.045}>
                <GlassPanel sx={{ p: { xs: 2.1, md: 2.7 }, borderRadius: 4.5, height: "100%" }}>
                  <Stack direction="row" spacing={1.5}>
                    <Box
                      sx={{
                        width: 46,
                        height: 46,
                        borderRadius: 2.5,
                        display: "grid",
                        placeItems: "center",
                        color: "primary.main",
                        bgcolor: alpha(theme.palette.primary.main, 0.07),
                        flex: "0 0 auto",
                      }}
                    >
                      <Icon />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
                      <Typography sx={{ mt: 0.5, lineHeight: 1.7 }} color="text.secondary">
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

      {/* ───────────────── REPOSITORIES (stack layer 2 — covers control plane) ───────────────── */}
      <ScrollScene page stack stackZ={2}>
        <Container maxWidth="lg">
        <Reveal>
          <GlassPanel sx={{ borderRadius: { xs: 5, md: 6 }, p: { xs: 2.5, md: 5 }, position: "relative", overflow: "hidden" }}>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: `radial-gradient(circle at 100% 0%, ${alpha(theme.palette.secondary?.main || theme.palette.info.main, dark ? 0.12 : 0.07)}, transparent 30%)`,
              }}
            />
            <Box
              sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1.2fr .8fr" },
                gap: 4,
                alignItems: "center",
              }}
            >
              <Box>
                <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "primary.main" }}>
                  Built in public
                </Typography>
                <Typography
                  component="h2"
                  sx={{
                    mt: 1,
                    fontWeight: 950,
                    fontSize: { xs: "2.35rem", md: "3.6rem" },
                    letterSpacing: "-.05em",
                    lineHeight: 1,
                  }}
                >
                  Inspect it. Adapt it. Run it yourself.
                </Typography>
                <Typography sx={{ mt: 2, lineHeight: 1.8 }} color="text.secondary">
                  The UI and API are separate so you can understand the pieces and evolve the control plane around your
                  own infrastructure.
                </Typography>
              </Box>
              <Stack spacing={1.2}>
                <Button
                  variant="contained"
                  href={GITHUB_FRONTEND}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<GitHubIcon />}
                  endIcon={<LaunchRoundedIcon />}
                  sx={{ minHeight: 54, borderRadius: 999, fontWeight: 850 }}
                >
                  Frontend repository
                </Button>
                <Button
                  variant="outlined"
                  href={GITHUB_API}
                  target="_blank"
                  rel="noreferrer"
                  startIcon={<GitHubIcon />}
                  endIcon={<LaunchRoundedIcon />}
                  sx={{ minHeight: 54, borderRadius: 999, fontWeight: 850 }}
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
            <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: ".18em", color: "primary.main" }}>
              FAQ
            </Typography>
            <Typography
              component="h2"
              sx={{
                mt: 1,
                fontWeight: 950,
                fontSize: { xs: "2.3rem", md: "3.8rem" },
                letterSpacing: "-.05em",
                lineHeight: 1,
              }}
            >
              Questions before you deploy.
            </Typography>
          </Reveal>
          <Box sx={{ mt: 4 }}>
            {faqs.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 0.04}>
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{
                    background: "transparent",
                    borderTop: "1px solid",
                    borderColor: border,
                    "&:last-of-type": { borderBottom: "1px solid", borderColor: border },
                    "&::before": { display: "none" },
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ px: 0, py: 1.1 }}>
                    <Typography sx={{ fontWeight: 850 }}>{faq.q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0, pb: 2.8 }}>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.8, maxWidth: 750 }}>
                      {faq.a}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              </Reveal>
            ))}
          </Box>
        </Container>
      </ScrollScene>

      {/* ───────────────── FINAL CTA (page) ───────────────── */}
      <ScrollScene page>
        <Container maxWidth="lg">
          <Reveal>
            <Box
              sx={{
                position: "relative",
                overflow: "hidden",
                borderRadius: { xs: 5, md: 7 },
                border: "1px solid",
                borderColor: alpha(theme.palette.primary.main, 0.16),
                p: { xs: 3, sm: 5, md: 8 },
                textAlign: "center",
                background: dark
                  ? "linear-gradient(145deg, rgba(16,27,44,.95), rgba(7,12,21,.97))"
                  : "linear-gradient(145deg, #ffffff, #eef5ff)",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  width: 420,
                  height: 420,
                  borderRadius: "50%",
                  right: -180,
                  top: -240,
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.18)}, transparent 68%)`,
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 340,
                  height: 340,
                  borderRadius: "50%",
                  left: -160,
                  bottom: -220,
                  background: `radial-gradient(circle, ${alpha(theme.palette.secondary?.main || theme.palette.info.main, 0.14)}, transparent 68%)`,
                }}
              />
              <Box sx={{ position: "relative" }}>
                <Typography
                  sx={{
                    fontWeight: 950,
                    fontSize: { xs: "2.4rem", md: "4.3rem" },
                    letterSpacing: "-.06em",
                    lineHeight: 0.98,
                  }}
                >
                  Ready to move the next deployment?
                </Typography>
                <Typography sx={{ mt: 2, maxWidth: 680, mx: "auto", lineHeight: 1.8 }} color="text.secondary">
                  Start with the control plane, then make the infrastructure as custom as your workload demands.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="center" spacing={1.2} sx={{ mt: 3.1 }}>
                  <Button
                    size="large"
                    variant="contained"
                    onClick={() => navigate(loggedIn ? "/services" : "/signin_or_signup")}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ minHeight: 56, px: 3, borderRadius: 999, fontWeight: 900 }}
                  >
                    Start deploying
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    onClick={() => navigate("/docs")}
                    sx={{ minHeight: 56, px: 3, borderRadius: 999, fontWeight: 850 }}
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
