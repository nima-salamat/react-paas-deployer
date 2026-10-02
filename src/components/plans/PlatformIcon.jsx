import React, { memo } from "react";
import { Box } from "@mui/material";
import { TbDatabase } from "react-icons/tb";

/* Simple Icons via react-icons — consistent brand marks across the dashboard */
import {
  SiAngular,
  SiDjango,
  SiDocker,
  SiDotnet,
  SiFlask,
  SiGo,
  SiHtml5,
  SiLaravel,
  SiMariadb,
  SiMongodb,
  SiMysql,
  SiNextdotjs,
  SiNodedotjs,
  SiPhp,
  SiPostgresql,
  SiPython,
  SiReact,
  SiRedis,
  SiVuedotjs,
} from "react-icons/si";

/** Map normalized platform key → Simple Icon component */
const ICON_MAP = {
  php: SiPhp,
  python: SiPython,
  django: SiDjango,
  nextjs: SiNextdotjs,
  next: SiNextdotjs,
  nodejs: SiNodedotjs,
  node: SiNodedotjs,
  flask: SiFlask,
  docker: SiDocker,
  laravel: SiLaravel,
  statichtmlcss: SiHtml5,
  html: SiHtml5,
  html5: SiHtml5,
  vuejs: SiVuedotjs,
  vue: SiVuedotjs,
  angular: SiAngular,
  react: SiReact,
  dotnet: SiDotnet,
  ".net": SiDotnet,
  mysql: SiMysql,
  postgresql: SiPostgresql,
  postgres: SiPostgresql,
  mariadb: SiMariadb,
  mongodb: SiMongodb,
  mongo: SiMongodb,
  redis: SiRedis,
  go: SiGo,
  golang: SiGo,
  // Simple Icons removed Oracle in the version bundled by react-icons 5.7.
  // Keep Oracle covered with a neutral database glyph instead of a missing brand export.
  oracle: TbDatabase,
};

function resolveIcon(key, label) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const k = norm(key);
  const l = norm(label);
  if (ICON_MAP[k]) return ICON_MAP[k];
  if (ICON_MAP[l]) return ICON_MAP[l];
  const hit = Object.keys(ICON_MAP).find((id) => k.includes(id) || l.includes(id));
  return hit ? ICON_MAP[hit] : null;
}

/**
 * Platform brand icon via Simple Icons (`react-icons/si`).
 * Falls back to a letter badge when no matching icon exists.
 */
const PlatformIcon = memo(function PlatformIcon({ platformKey, label, size = 22 }) {
  const Icon = resolveIcon(platformKey, label);
  const pad = Math.max(4, Math.round(size * 0.22));
  const box = size + pad * 2;

  if (Icon) {
    return (
      <Box
        component="span"
        sx={{
          width: box,
          height: box,
          borderRadius: 1.25,
          position: "relative",
          overflow: "hidden",
          bgcolor: (theme) => theme.palette.mode === "dark"
            ? "rgba(226,232,240,.10)"
            : "rgba(255,255,255,.72)",
          backgroundImage: (theme) => theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(255,255,255,.22) 0%, rgba(203,213,225,.13) 34%, rgba(148,163,184,.08) 62%, rgba(255,255,255,.16) 100%)"
            : "linear-gradient(145deg, rgba(255,255,255,.98) 0%, rgba(226,232,240,.96) 34%, rgba(148,163,184,.62) 66%, rgba(255,255,255,.96) 100%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          lineHeight: 0,
          border: "1px solid",
          borderColor: (theme) => theme.palette.mode === "dark"
            ? "rgba(248,250,252,.28)"
            : "rgba(100,116,139,.26)",
          boxShadow: (theme) => theme.palette.mode === "dark"
            ? "inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(15,23,42,.35), 0 2px 8px rgba(0,0,0,.18)"
            : "inset 0 1px 0 rgba(255,255,255,.98), inset 0 -1px 0 rgba(71,85,105,.22), 0 2px 8px rgba(15,23,42,.10)",
          "&::after": {
            content: '\"\"',
            position: "absolute",
            top: "-30%",
            left: "-35%",
            width: "45%",
            height: "170%",
            transform: "rotate(24deg)",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,.48), transparent)",
            opacity: 0.55,
            pointerEvents: "none",
          },
          "& svg": {
            display: "block",
            position: "relative",
            zIndex: 1,
            filter: (theme) => theme.palette.mode === "dark"
              ? "grayscale(1) brightness(1.72) contrast(.68) drop-shadow(0 1px 2px rgba(255,255,255,.18))"
              : "grayscale(1) brightness(.74) contrast(.72) drop-shadow(0 1px 1px rgba(255,255,255,.72))",
            opacity: 0.98,
          },
        }}
        title={label || platformKey}
      >
        <Icon size={size} />
      </Box>
    );
  }

  const letter = String(label || platformKey || "?").slice(0, 2);
  return (
    <Box
      component="span"
      sx={{
        width: box,
        height: box,
        borderRadius: 1.25,
        position: "relative",
        overflow: "hidden",
        bgcolor: (theme) => theme.palette.mode === "dark"
          ? "rgba(226,232,240,.10)"
          : "rgba(255,255,255,.72)",
        backgroundImage: (theme) => theme.palette.mode === "dark"
          ? "linear-gradient(145deg, rgba(255,255,255,.22) 0%, rgba(203,213,225,.13) 34%, rgba(148,163,184,.08) 62%, rgba(255,255,255,.16) 100%)"
          : "linear-gradient(145deg, rgba(255,255,255,.98) 0%, rgba(226,232,240,.96) 34%, rgba(148,163,184,.62) 66%, rgba(255,255,255,.96) 100%)",
        color: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#475569",
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        letterSpacing: -0.3,
        lineHeight: 1,
        border: "1px solid",
        borderColor: (theme) => theme.palette.mode === "dark"
          ? "rgba(248,250,252,.28)"
          : "rgba(100,116,139,.26)",
        boxShadow: (theme) => theme.palette.mode === "dark"
          ? "inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1px 0 rgba(15,23,42,.35), 0 2px 8px rgba(0,0,0,.18)"
          : "inset 0 1px 0 rgba(255,255,255,.98), inset 0 -1px 0 rgba(71,85,105,.22), 0 2px 8px rgba(15,23,42,.10)",
        "&::after": {
          content: '\"\"',
          position: "absolute",
          top: "-30%",
          left: "-35%",
          width: "45%",
          height: "170%",
          transform: "rotate(24deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.48), transparent)",
          opacity: 0.55,
          pointerEvents: "none",
        },
      }}
      title={label || platformKey}
    >
      {letter}
    </Box>
  );
});

export default PlatformIcon;
