/**
 * JitsiCallModal — embedded call surface (Telegram / Meet style)
 *
 * Layout contract:
 *  - Full / inline mode: fills the chat stage (desktop) or goes true fullscreen
 *    overlay on mobile so the call is the primary surface.
 *  - Mini mode: thin top bar (WhatsApp / Telegram style) on BOTH mobile and
 *    desktop — never a floating card. Resize-safe; stays fixed to the viewport.
 *
 * OS / platform handling:
 *  - Reads `navigator.userAgent` + `navigator.platform` + `maxTouchPoints`
 *    to classify iOS / Android / desktop-on-touch / pure-desktop.
 *  - iOS Safari: hides speaker picker (no setSinkId), disables Picture-in-
 *    Picture API call if unsupported.
 *  - Android Chrome: shows everything.
 *  - Desktop: shows everything including speaker picker when supported.
 *
 * Every action button is a no-op-safe: it prechecks its preconditions and
 * flashes a clear toast instead of silently doing nothing.
 */

import React, {
  useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo,
} from "react";
import {
  Box, IconButton, Stack, Typography, Avatar, Chip, Tooltip,
  CircularProgress, Paper, Modal, Slide, List, ListItemButton, ListItemText,
  ListItemIcon, Switch, FormControlLabel, Divider, alpha, useMediaQuery,
  Menu, MenuItem, TextField, Drawer,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import VideocamIcon from "@mui/icons-material/Videocam";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import ScreenShareIcon from "@mui/icons-material/ScreenShare";
import StopScreenShareIcon from "@mui/icons-material/StopScreenShare";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import PeopleIcon from "@mui/icons-material/People";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";
import SettingsIcon from "@mui/icons-material/Settings";
import CameraswitchIcon from "@mui/icons-material/Cameraswitch";
import PresentToAllIcon from "@mui/icons-material/PresentToAll";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import SpeakerIcon from "@mui/icons-material/Speaker";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { parseFormattedBody } from "../messengerUtils";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import ChatIcon from "@mui/icons-material/Chat";
import SendIcon from "@mui/icons-material/Send";

/* ── Constants (IEC 61508: explicit limits) ─────────────────────────── */
const MINI_W = 320;
const MINI_H = 200;
const MEDIA_KEY = "messenger.mediaDevices";
const ALONE_TIMEOUT_MS = 45000;
const BOOT_FALLBACK_MS = 8000;

/* ── Platform detection (deterministic, cached) ────────────────────── */
function detectPlatform() {
  if (typeof navigator === "undefined") {
    return { isIOS: false, isAndroid: false, isMobile: false, isDesktop: true,
      hasSetSinkId: false, hasWebkitFs: false, hasStandardFs: false };
  }
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouch = navigator.maxTouchPoints || 0;

  const isIOS = /iPhone|iPad|iPod/i.test(ua)
    || (platform === "MacIntel" && maxTouch > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobileUA = isIOS || isAndroid
    || /webOS|BlackBerry|IEMobile|Opera Mini|Mobile|Windows Phone/i.test(ua);

  // Touch-primary, no fine pointer, no hover → treat as mobile
  let touchMobile = false;
  try {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const canHover = window.matchMedia("(hover: hover)").matches;
    if (coarse && !fine && !canHover && maxTouch > 0) touchMobile = true;
  } catch { /* */ }

  const isMobile = isMobileUA || touchMobile;
  const isDesktop = !isMobile;

  // setSinkId only exists on Chrome/Edge
  const hasSetSinkId = typeof document !== "undefined"
    && typeof document.createElement("audio").setSinkId === "function";

  const hasStandardFs = typeof document !== "undefined"
    && typeof document.documentElement.requestFullscreen === "function";
  const hasWebkitFs = typeof document !== "undefined"
    && typeof document.documentElement.webkitRequestFullscreen === "function";

  return { isIOS, isAndroid, isMobile, isDesktop,
    hasSetSinkId, hasWebkitFs, hasStandardFs };
}

/* ── Pure helpers ──────────────────────────────────────────────────── */

function readSavedDevices() {
  try {
    const raw = localStorage.getItem(MEDIA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeSavedDevices(patch) {
  try {
    const cur = readSavedDevices();
    const next = { ...cur, ...patch };
    localStorage.setItem(MEDIA_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("messenger:media-devices-changed", { detail: next }));
  } catch { /* */ }
}

/**
 * Load the deployment's config.js (script tag — no CORS issue).
 * This is the ONLY reliable way to get the correct hosts.muc / websocket
 * for a self-hosted Jitsi; guessing conference. vs muc. puts callers in
 * different XMPP rooms so they never see each other.
 */
function loadJitsiDeployConfig(domain) {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve({}); return; }
    const cacheKey = `__jitsiConfig_${domain}`;
    if (window[cacheKey]) { resolve(window[cacheKey]); return; }

    // config.js assigns `var config = {...}` globally
    const prev = window.config;
    const s = document.createElement("script");
    s.src = `https://${domain}/config.js`;
    s.async = true;
    const done = (cfg) => {
      window[cacheKey] = cfg || {};
      resolve(window[cacheKey]);
    };
    s.onload = () => {
      const cfg = window.config && typeof window.config === "object" ? { ...window.config } : {};
      // restore any previous global if we overwrote something unrelated
      if (prev !== undefined) window.config = prev;
      done(cfg);
    };
    s.onerror = () => done({});
    document.head.appendChild(s);
    // safety timeout
    setTimeout(() => done(window[cacheKey] || {}), 8000);
  });
}

function loadLibJitsi(domain) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("No window")); return; }
    if (window.JitsiMeetJS) { resolve(window.JitsiMeetJS); return; }
    // Prefer the SAME server's lib so protocol matches Prosody/Jicofo versions.
    const urls = [
      `https://${domain}/libs/lib-jitsi-meet.min.js`,
      `https://${domain}/lib-jitsi-meet.min.js`,
      "https://cdn.jsdelivr.net/npm/lib-jitsi-meet-dist@latest/lib-jitsi-meet.min.js",
    ];
    let i = 0;
    const next = () => {
      if (i >= urls.length) { reject(new Error("Could not load media engine")); return; }
      const s = document.createElement("script");
      s.src = urls[i++];
      s.async = true;
      s.onload = () => { if (window.JitsiMeetJS) resolve(window.JitsiMeetJS); else next(); };
      s.onerror = () => next();
      document.body.appendChild(s);
    };
    next();
  });
}

/** Normalize room id: strip muc JID suffix, lowercase, safe chars. */
function normalizeRoomName(raw) {
  let r = String(raw || "").trim();
  if (!r) return r;
  // room@conference.domain → room
  if (r.includes("@")) r = r.split("@")[0];
  r = r.toLowerCase();
  // Jitsi room names are typically alphanumeric + -_
  return r;
}

function attachTrack(track, el) {
  if (!el || !track) return;
  try {
    track.attach(el);
  } catch {
    try {
      const media = track.getTrack?.() || track.stream?.getTracks?.()?.[0];
      const stream = new MediaStream([media].filter(Boolean));
      if (stream.getTracks().length) el.srcObject = stream;
    } catch { /* */ }
  }
  // Autoplay policy: attempt play after attach (user gesture from accepting call helps).
  try {
    const p = el.play?.();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* */ }
}

function detachTrack(track, el) {
  if (!track) return;
  try { if (el) track.detach(el); else track.detach(); } catch { /* */ }
}

function formatElapsed(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Clamp a number to a range. */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Outgoing ringback (phone-style double ring) while waiting for peer. */
function startRingback() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { stop() {} };
  let ctx;
  try { ctx = new Ctx(); } catch { return { stop() {} }; }
  let stopped = false;
  let timer = null;

  const beep = (freq, when, dur) => {
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.12, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(when);
      o.stop(when + dur + 0.02);
    } catch { /* */ }
  };

  const cycle = () => {
    if (stopped) return;
    try {
      const t0 = ctx.currentTime + 0.02;
      // Classic ringback: two short tones, pause, repeat
      beep(440, t0, 0.4);
      beep(480, t0, 0.4);
      beep(440, t0 + 0.55, 0.4);
      beep(480, t0 + 0.55, 0.4);
    } catch { /* */ }
    timer = setTimeout(cycle, 2800);
  };

  try { ctx.resume?.(); } catch { /* */ }
  cycle();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      try { ctx.close(); } catch { /* */ }
    },
  };
}


/* ── Avatar with device chips + speaking ring ──────────────────────── */
function ParticipantAvatar({ p, isLocal, size = 44, speaking = false }) {
  const name = p?.displayName || (isLocal ? "You" : "User");
  const initial = (name || "?")[0]?.toUpperCase();
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <Avatar
        src={p?.avatar || undefined}
        sx={{
          width: size, height: size, fontSize: size * 0.4,
          bgcolor: isLocal ? "primary.dark" : "secondary.dark",
          border: speaking ? "2px solid" : "2px solid transparent",
          borderColor: speaking ? "success.main" : "transparent",
          transition: "border-color 0.18s ease",
        }}
      >
        {initial}
      </Avatar>
      <Box
        sx={{
          position: "absolute", bottom: -2, right: -2,
          display: "flex", gap: 0.25,
          bgcolor: "rgba(0,0,0,0.85)",
          borderRadius: 2, px: 0.3, py: 0.1,
          border: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {p?.audioMuted ? (
          <MicOffIcon sx={{ fontSize: 10, color: "error.light" }} />
        ) : (
          <MicIcon sx={{ fontSize: 10, color: "success.light" }} />
        )}
        {p?.videoMuted ? (
          <VideocamOffIcon sx={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }} />
        ) : (
          <VideocamIcon sx={{ fontSize: 10, color: "info.light" }} />
        )}
      </Box>
    </Box>
  );
}

/* ── Camera / avatar tile (no zoom) ───────────────────────────────── */
function ParticipantTile({
  participant, isLocal, isDominant, compact, onClick, isSelected, showAvatar = true, speaking = false,
}) {
  const videoRef = useRef(null);
  const vTrack = participant?.videoTrack;
  const isScreen = !!participant?.isScreen;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !vTrack) return undefined;
    attachTrack(vTrack, el);
    return () => detachTrack(vTrack, el);
  }, [vTrack]);

  const muted = !!participant?.audioMuted;
  const videoMuted = !!participant?.videoMuted || !vTrack;
  const name = participant?.displayName || (isLocal ? "You" : "Participant");

  return (
    <Box
      onClick={onClick || undefined}
      sx={{
        position: "relative",
        bgcolor: "#0d1117",
        borderRadius: compact ? 1.5 : 2,
        overflow: "hidden",
        border: speaking ? "2px solid" : (isSelected ? "2px solid" : "1px solid"),
        borderColor: speaking ? "#22c55e"
          : isSelected ? "primary.main"
          : isDominant ? "primary.main"
          : "rgba(255,255,255,0.08)",
        boxShadow: speaking
          ? "0 0 0 3px rgba(34,197,94,0.35), 0 0 18px rgba(34,197,94,0.45)"
          : "none",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        aspectRatio: compact ? "16/10" : undefined,
        width: "100%",
        height: "100%",
        minHeight: 0,
        cursor: onClick ? "pointer" : "default",
        background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
        touchAction: onClick ? "manipulation" : "auto",
        "@keyframes speakPulse": {
          "0%, 100%": { boxShadow: "0 0 0 2px rgba(34,197,94,0.35), 0 0 12px rgba(34,197,94,0.3)" },
          "50%": { boxShadow: "0 0 0 5px rgba(34,197,94,0.2), 0 0 22px rgba(34,197,94,0.55)" },
        },
        animation: speaking ? "speakPulse 1.1s ease-in-out infinite" : "none",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: "100%",
          height: "100%",
          objectFit: isScreen ? "contain" : "cover",
          display: videoMuted ? "none" : "block",
          transform: (isLocal && !isScreen) ? "scaleX(-1)" : undefined,
          background: "#000",
        }}
      />
      {videoMuted && showAvatar && (
        <Stack alignItems="center" justifyContent="center" spacing={1}
          sx={{ position: "absolute", inset: 0 }}>
          <Avatar
            src={participant?.avatar || undefined}
            sx={{
              width: compact ? 40 : (isDominant ? 96 : 72),
              height: compact ? 40 : (isDominant ? 96 : 72),
              bgcolor: isLocal ? "primary.dark" : "secondary.dark",
              fontSize: compact ? 16 : (isDominant ? 36 : 28),
              border: "2px solid rgba(255,255,255,0.12)",
            }}
          >
            {(name || "?")[0]?.toUpperCase()}
          </Avatar>
          {!compact && (
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
              {name}{isLocal ? " (you)" : ""}
            </Typography>
          )}
        </Stack>
      )}
      <Stack direction="row" spacing={0.5} alignItems="center"
        sx={{
          position: "absolute", left: 6, bottom: 6,
          px: 0.85, py: 0.3, borderRadius: 1.25,
          bgcolor: "rgba(0,0,0,0.7)", maxWidth: "calc(100% - 12px)",
        }}>
        {muted && <MicOffIcon sx={{ fontSize: 12, color: "error.light" }} />}
        {isScreen && <PresentToAllIcon sx={{ fontSize: 12, color: "info.light" }} />}
        <Typography variant="caption" noWrap sx={{ color: "#fff", fontSize: 11, fontWeight: 500 }}>
          {name}{isLocal ? " (you)" : ""}{isScreen ? " · screen" : ""}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Dedicated screen-share viewer: stable <video>, zoom, pan, element fullscreen.
 * Does NOT remount the video when entering fullscreen (avoids the "page jump").
 */
function ScreenShareViewer({ participant, isLocal }) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const vTrack = participant?.videoTrack;

  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fs, setFs] = useState(false);
  const drag = useRef({ on: false, sx: 0, sy: 0, px: 0, py: 0 });

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !vTrack) return undefined;
    attachTrack(vTrack, el);
    return () => detachTrack(vTrack, el);
  }, [vTrack]);

  useEffect(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [vTrack]);

  const applyTransform = (z, p) => {
    zoomRef.current = z;
    panRef.current = p;
    setZoom(z);
    setPan(p);
  };

  const zoomBy = (delta) => {
    const next = Math.min(4, Math.max(1, +(zoomRef.current + delta).toFixed(2)));
    const p = next <= 1 ? { x: 0, y: 0 } : panRef.current;
    applyTransform(next, p);
  };

  // Wheel zoom
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.15 : -0.15);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const onFs = () => {
      const el = wrapRef.current;
      setFs(!!(document.fullscreenElement === el || document.webkitFullscreenElement === el));
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  const toggleFs = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.());
      }
    } catch { /* */ }
  };

  const onPointerDown = (e) => {
    if (zoomRef.current <= 1) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
    drag.current = {
      on: true,
      sx: e.clientX,
      sy: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
    };
  };
  const onPointerMove = (e) => {
    if (!drag.current.on) return;
    const nx = drag.current.px + (e.clientX - drag.current.sx);
    const ny = drag.current.py + (e.clientY - drag.current.sy);
    applyTransform(zoomRef.current, { x: nx, y: ny });
  };
  const onPointerUp = () => { drag.current.on = false; };

  const name = participant?.displayName || (isLocal ? "Your screen" : "Screen");

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        height: "100%",
        bgcolor: "#000",
        borderRadius: fs ? 0 : 2,
        overflow: "hidden",
        border: fs ? "none" : "1px solid rgba(255,255,255,0.1)",
        touchAction: "none",
        cursor: zoom > 1 ? "grab" : "default",
        "&:active": { cursor: zoom > 1 ? "grabbing" : "default" },
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={!!isLocal}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: drag.current.on ? "none" : "transform 0.12s ease-out",
            pointerEvents: "none",
            background: "#000",
          }}
        />
      </Box>

      {/* Controls overlay */}
      <Stack
        direction="row"
        spacing={0.5}
        alignItems="center"
        sx={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 5,
          bgcolor: "rgba(0,0,0,0.65)",
          borderRadius: 2,
          px: 0.5,
          py: 0.35,
          backdropFilter: "blur(8px)",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconButton size="small" onClick={() => zoomBy(-0.25)} sx={{ color: "#fff" }} aria-label="Zoom out">
          <ZoomOutIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Typography variant="caption" sx={{ color: "#fff", minWidth: 40, textAlign: "center", fontWeight: 600 }}>
          {Math.round(zoom * 100)}%
        </Typography>
        <IconButton size="small" onClick={() => zoomBy(0.25)} sx={{ color: "#fff" }} aria-label="Zoom in">
          <ZoomInIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <IconButton size="small" onClick={() => applyTransform(1, { x: 0, y: 0 })} sx={{ color: "#fff" }} aria-label="Reset zoom">
          <Typography sx={{ fontSize: 11, fontWeight: 700, px: 0.5 }}>1:1</Typography>
        </IconButton>
        <IconButton size="small" onClick={toggleFs} sx={{ color: "#fff" }} aria-label="Fullscreen">
          {fs ? <FullscreenExitIcon sx={{ fontSize: 20 }} /> : <FullscreenIcon sx={{ fontSize: 20 }} />}
        </IconButton>
      </Stack>

      <Chip
        size="small"
        icon={<PresentToAllIcon sx={{ fontSize: 14 }} />}
        label={name}
        sx={{
          position: "absolute",
          left: 10,
          bottom: 10,
          bgcolor: "rgba(0,0,0,0.65)",
          color: "#fff",
          "& .MuiChip-icon": { color: "#93c5fd" },
        }}
      />
    </Box>
  );
}

/**
 * Always-mounted remote audio players. Independent of video tiles so audio
 * keeps playing in mobile mini-bar mode (where tiles are not rendered).
 */
function RemoteAudioSink({ participants }) {
  const entries = Object.entries(participants || {}).filter(([id, p]) => id !== "local" && p?.audioTrack);
  return (
    <Box
      aria-hidden
      sx={{
        position: "fixed",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
        opacity: 0,
        zIndex: -1,
      }}
    >
      {entries.map(([id, p]) => (
        <RemoteAudioKey key={`${id}-${p.audioTrack?.getId?.() || id}`} track={p.audioTrack} />
      ))}
    </Box>
  );
}

function RemoteAudioKey({ track }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return undefined;
    attachTrack(track, el);
    // Retry play a few times — mobile browsers often block the first attempt
    let tries = 0;
    const id = setInterval(() => {
      tries += 1;
      try {
        const p = el.play?.();
        if (p && typeof p.then === "function") {
          p.then(() => clearInterval(id)).catch(() => {});
        }
      } catch { /* */ }
      if (tries >= 8) clearInterval(id);
    }, 400);
    return () => {
      clearInterval(id);
      detachTrack(track, el);
    };
  }, [track]);
  return <audio ref={ref} autoPlay playsInline />;
}


function CallChatSpoiler({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <Box
      component="span"
      onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      sx={{
        display: "inline",
        cursor: "pointer",
        borderRadius: 0.75,
        px: 0.45,
        bgcolor: open ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.28)",
        color: open ? "inherit" : "transparent",
        filter: open ? "none" : "blur(5px)",
        userSelect: open ? "text" : "none",
        transition: "filter 0.15s",
      }}
    >
      {children}
    </Box>
  );
}

function formatCallSystemLabel(bodyStr) {
  if (!bodyStr || typeof bodyStr !== "string") return null;
  if (!bodyStr.startsWith("__call__:")) return null;
  try {
    const callInfo = JSON.parse(bodyStr.slice(9));
    if (!callInfo || !callInfo.v) return bodyStr;
    const isVideo = !!callInfo.is_video;
    const dur = Number(callInfo.duration || 0);
    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${String(sec).padStart(2, "0")}`;
    };
    const who = callInfo.initiator_username || "Someone";
    if (callInfo.event === "started") {
      return isVideo ? `📹 ${who} started a video call` : `📞 ${who} started a voice call`;
    }
    const st = callInfo.status || "ended";
    if (st === "missed" || st === "no_answer") {
      return isVideo ? "📹 Missed video call" : "📞 Missed voice call";
    }
    if (st === "declined") {
      return isVideo ? "📹 Declined video call" : "📞 Declined voice call";
    }
    if (st === "ringing") {
      return isVideo ? `📹 ${who} is calling…` : `📞 ${who} is calling…`;
    }
    if (dur > 0) {
      return isVideo ? `📹 Video call · ${fmt(dur)}` : `📞 Voice call · ${fmt(dur)}`;
    }
    return isVideo ? "📹 Video call ended" : "📞 Voice call ended";
  } catch {
    return bodyStr;
  }
}

function renderCallChatSegments(bodyStr) {
  const segments = parseFormattedBody(bodyStr || "");
  if (!segments.length) {
    return (
      <Typography component="span" variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {bodyStr}
      </Typography>
    );
  }
  return segments.map((seg, i) => {
    if (seg.type === "text") {
      return (
        <Typography key={i} component="span" variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {seg.value}
        </Typography>
      );
    }
    if (seg.type === "mention") {
      return (
        <Box
          key={i}
          component="span"
          sx={{ color: "#7dd3fc", fontWeight: 700, cursor: "default" }}
        >
          @{seg.value}
        </Box>
      );
    }
    if (seg.type === "spoiler") {
      return <CallChatSpoiler key={i}>{seg.value}</CallChatSpoiler>;
    }
    if (seg.type === "code") {
      return (
        <Box
          key={i}
          component="code"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.88em",
            px: 0.55,
            py: 0.1,
            borderRadius: 0.75,
            bgcolor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {seg.value}
        </Box>
      );
    }
    if (seg.type === "codeblock") {
      return (
        <Box
          key={i}
          component="pre"
          sx={{
            display: "block",
            my: 0.75,
            p: 1,
            borderRadius: 1.25,
            bgcolor: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.12)",
            overflowX: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: "pre",
            color: "#e2e8f0",
          }}
        >
          {seg.lang ? (
            <Typography variant="caption" sx={{ display: "block", color: "rgba(255,255,255,0.4)", mb: 0.5 }}>
              {seg.lang}
            </Typography>
          ) : null}
          {seg.value}
        </Box>
      );
    }
    if (seg.type === "quote") {
      return (
        <Box
          key={i}
          sx={{
            display: "block",
            my: 0.5,
            pl: 1.1,
            borderLeft: "3px solid rgba(255,255,255,0.35)",
            opacity: 0.9,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
          }}
        >
          {seg.value}
        </Box>
      );
    }
    return (
      <Typography key={i} component="span" variant="body2">
        {seg.value}
      </Typography>
    );
  });
}

/* ── Main component ────────────────────────────────────────────────── */
export default function JitsiCallModal({
  callConfig,
  onClose,
  title = "Call",
  peerAvatar,
  onModeChange,
  isGroup = false,
  memberDirectory = [], // [{ id, username, avatar }]
  messages = [],
  meId = null,
  onSendChat,
  onLoadOlder,
  loadingMore = false,
  hasMoreMessages = false,
}) {
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down("md"));
  const isSmallView = useMediaQuery(theme.breakpoints.down("sm"));

  // Platform detection (cached for the session)
  const platform = useMemo(() => detectPlatform(), []);
  const { isIOS } = platform;

  /* ── Refs ─────────────────────────────────────────────────────────── */
  const rootRef = useRef(null);
  const connRef = useRef(null);
  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });
  const startingRef = useRef(false);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const savedDevicesRef = useRef(readSavedDevices());
  const chatScrollRef = useRef(null);
  const chatScrollVelRef = useRef({ lastTop: 0, lastTs: 0, velocity: 0 });

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  /* ── State ────────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(!!callConfig?.config?.startWithVideoMuted);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Always start expanded (full). Desktop fills the chat stage; mobile is a
  // true viewport overlay. Mini is only after the user explicitly minimises.
  const [mode, setMode] = useState("full"); // "full" | "inline" | "mini"
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [railOpen, setRailOpen] = useState(false);

  // Scroll behavior for in-call chat
  const chatNearBottomRef = useRef(true);
  const chatPrevLenRef = useRef(0);
  const chatLoadingOlderRef = useRef(false);
  const chatPinAfterLoadRef = useRef(null); // { height, top }

  useEffect(() => {
    if (!chatOpen) return;
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    chatNearBottomRef.current = true;
    chatPrevLenRef.current = (messages || []).length;
  }, [chatOpen]);

  useLayoutEffect(() => {
    if (!chatOpen) return;
    const el = chatScrollRef.current;
    if (!el) return;
    const len = (messages || []).length;
    const prevLen = chatPrevLenRef.current;
    chatPrevLenRef.current = len;

    if (chatPinAfterLoadRef.current) {
      const snap = chatPinAfterLoadRef.current;
      chatPinAfterLoadRef.current = null;
      chatLoadingOlderRef.current = false;
      const apply = () => {
        const diff = el.scrollHeight - snap.height;
        if (diff > 0) el.scrollTop = snap.top + diff;
      };
      apply();
      requestAnimationFrame(apply);
      return;
    }

    if (len > prevLen && chatNearBottomRef.current && !chatLoadingOlderRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chatOpen, messages]);
  const [deviceSheetOpen, setDeviceSheetOpen] = useState(false);
  const [devices, setDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedMic, setSelectedMic] = useState(savedDevicesRef.current.micId || "");
  const [selectedCam, setSelectedCam] = useState(savedDevicesRef.current.cameraId || "");
  const [selectedSpeaker, setSelectedSpeaker] = useState(savedDevicesRef.current.speakerId || "");
  const [micLevel, setMicLevel] = useState(0);
  const [speakingId, setSpeakingId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [stagedScreenId, setStagedScreenId] = useState(null);
  const [miniPos, setMiniPos] = useState(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: Math.max(16, window.innerWidth - MINI_W - 24),
      y: Math.max(16, window.innerHeight - MINI_H - 100),
    };
  });

  // Keep parent in sync so MessengerApp can show/hide the message list
  // and place the mini bar under the chat header. Must run AFTER mode state exists.
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  // Resize policy:
  //  - "inline" legacy → "full"
  //  - User can mini/full freely on any width; mini is always the thin top bar
  //    so desktop↔mobile transitions stay consistent without losing the call UI.
  useEffect(() => {
    setMode((prev) => (prev === "inline" ? "full" : prev));
  }, [isMobileView]);

  const roomKey = callConfig
    ? `${callConfig.domain || ""}|${callConfig.room || ""}`
    : "";

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const resolveAvatar = useCallback((displayName, explicit) => {
    if (explicit) return explicit;
    const dir = memberDirectory || [];
    const n = String(displayName || "").trim().toLowerCase();
    if (!n) return peerAvatar || null;
    const hit = dir.find((m) =>
      String(m.username || "").toLowerCase() === n
      || String(m.display_name || "").toLowerCase() === n
      || String(m.id) === n
    );
    if (hit?.avatar) return hit.avatar;
    // 1:1 fallback
    if (!isGroup) return peerAvatar || null;
    return null;
  }, [memberDirectory, peerAvatar, isGroup]);

  const upsertParticipant = useCallback((id, patch) => {
    if (!id) return;
    setParticipants((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { id }), ...patch },
    }));
  }, []);

  const removeParticipant = useCallback((id) => {
    if (!id) return;
    setParticipants((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /* ── Mic level meter ──────────────────────────────────────────────── */
  const stopMicMeter = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  }, []);

  const startMicMeter = useCallback((stream) => {
    if (!stream) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      stopMicMeter();
      const ctx = new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const level = Math.min(1, Math.pow(rms * 4.0, 0.7));
        setMicLevel(level);
        if (level > 0.18) setSpeakingId("local");
        else if (speakingId === "local" && level < 0.08) setSpeakingId(null);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* */ }
  }, [stopMicMeter, speakingId]);

  /* ── Boot conference ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!callConfig || !roomKey) return undefined;
    let disposed = false;

    const cleanup = async () => {
      stopMicMeter();
      try {
        for (const t of localTracksRef.current) {
          try { await t.dispose?.(); } catch { /* */ }
        }
        localTracksRef.current = [];
        if (roomRef.current) {
          try { await roomRef.current.leave(); } catch { /* */ }
          roomRef.current = null;
        }
        if (connRef.current) {
          try { connRef.current.disconnect(); } catch { /* */ }
          connRef.current = null;
        }
      } catch { /* */ }
    };

    const boot = async () => {
      if (startingRef.current) return;
      startingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const domain = callConfig.domain;
        const roomName = normalizeRoomName(callConfig.room);
        const displayName = callConfig.display_name || callConfig.displayName || "User";
        const startAudioMuted = !!callConfig.config?.startWithAudioMuted;
        const startVideoMuted = !!callConfig.config?.startWithVideoMuted;
        const jwt = callConfig.jwt || callConfig.token || callConfig.config?.jwt || null;

        // Load the REAL deployment config so both peers use identical hosts.muc.
        // Without this, guessing conference. vs muc. puts them in different rooms.
        const deployCfg = await loadJitsiDeployConfig(domain);
        if (disposed) return;

        const hosts = deployCfg.hosts || {};
        const xmppDomain = hosts.domain || domain;
        const muc = callConfig.muc
          || callConfig.config?.muc
          || hosts.muc
          || `conference.${xmppDomain}`;
        const focus = hosts.focus || `focus.${xmppDomain}`;
        // websocket may be relative "//host/xmpp-websocket" or absolute
        let wsUrl = callConfig.websocket || callConfig.serviceUrl
          || callConfig.config?.websocket
          || deployCfg.websocket
          || deployCfg.bosh
          || `wss://${domain}/xmpp-websocket`;
        if (typeof wsUrl === "string") {
          if (wsUrl.startsWith("//")) wsUrl = `wss:${wsUrl}`;
          // bosh http-bind is not a websocket — prefer xmpp-websocket path
          if (/http-bind|bosh/i.test(wsUrl) && !/xmpp-websocket/i.test(wsUrl)) {
            wsUrl = `wss://${domain}/xmpp-websocket`;
          }
        }

        const JitsiMeetJS = await loadLibJitsi(domain);
        if (disposed) return;

        JitsiMeetJS.init({
          disableAudioLevels: false,
          disableSimulcast: false,
          enableAnalyticsLogging: false,
        });
        try {
          JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels?.ERROR || "error");
        } catch { /* */ }

        console.info("[call] connecting", {
          domain: xmppDomain, roomName, muc, focus, wsUrl, hasJwt: !!jwt,
          fromDeployConfig: !!(deployCfg && deployCfg.hosts),
        });

        const connection = new JitsiMeetJS.JitsiConnection(null, jwt, {
          hosts: {
            domain: xmppDomain,
            muc,
            focus,
            ...(hosts.anonymousdomain ? { anonymousdomain: hosts.anonymousdomain } : {}),
          },
          serviceUrl: wsUrl,
          clientNode: "http://jitsi.org/jitsimeet",
          websocket: wsUrl,
        });
        connRef.current = connection;

        await new Promise((resolve, reject) => {
          const onOk = () => {
            connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onOk);
            connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, onFail);
            resolve();
          };
          const onFail = (err) => {
            connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onOk);
            connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, onFail);
            reject(err || new Error("Connection failed"));
          };
          connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onOk);
          connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, onFail);
          connection.connect();
        });

        if (disposed) { connection.disconnect(); return; }

        const room = connection.initJitsiConference(roomName, {
          startAudioMuted: false,
          startVideoMuted: false,
          enableNoAudioDetection: false,
          enableNoisyMicDetection: false,
          openBridgeChannel: "websocket",
          channelLastN: -1,
          p2p: {
            enabled: true,
            stunServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          },
        });
        roomRef.current = room;

        room.on(JitsiMeetJS.events.conference.TRACK_ADDED, (track) => {
          if (track.isLocal()) return;
          const pid = track.getParticipantId();
          const isVideo = track.getType() === "video";
          const isScreen = isVideo && track.videoType === "desktop";
          if (isVideo) {
            upsertParticipant(pid, {
              videoTrack: track, videoMuted: track.isMuted(), isScreen: !!isScreen,
            });
            if (isScreen) {
              setStagedScreenId(pid);
              setRailOpen(false);
            } else {
              setStagedScreenId((cur) => cur || null);
            }
          } else {
            upsertParticipant(pid, { audioTrack: track, audioMuted: track.isMuted() });
          }
          track.addEventListener(JitsiMeetJS.events.track.TRACK_MUTE_CHANGED, () => {
            if (track.getType() === "video") upsertParticipant(pid, { videoMuted: track.isMuted() });
            else upsertParticipant(pid, { audioMuted: track.isMuted() });
          });
          track.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, () => {
            if (track.getType() === "video") upsertParticipant(pid, { videoTrack: null, videoMuted: true, isScreen: false });
            else upsertParticipant(pid, { audioTrack: null });
          });
        });

        room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track) => {
          if (track.isLocal()) return;
          const pid = track.getParticipantId();
          if (track.getType() === "video") {
            upsertParticipant(pid, { videoTrack: null, videoMuted: true, isScreen: false });
            setStagedScreenId((cur) => (cur === pid ? null : cur));
          } else {
            upsertParticipant(pid, { audioTrack: null });
          }
        });

        room.on(JitsiMeetJS.events.conference.USER_JOINED, (id, user) => {
          const dn = user?.getDisplayName?.() || "Participant";
          upsertParticipant(id, {
            displayName: dn,
            avatar: resolveAvatar(dn),
          });
        });
        room.on(JitsiMeetJS.events.conference.USER_LEFT, (id) => {
          removeParticipant(id);
          setStagedScreenId((cur) => (cur === id ? null : cur));
        });
        room.on(JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, (id, name) => {
          upsertParticipant(id, {
            displayName: name,
            avatar: resolveAvatar(name),
          });
        });
        // Speaking indicator for remote participants
        try {
          room.on(JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED, (participantId, level) => {
            if (!participantId || participantId === room.myUserId?.()) return;
            if (level > 0.18) setSpeakingId(String(participantId));
            else setSpeakingId((cur) => (cur === String(participantId) ? null : cur));
          });
        } catch { /* older lib may lack event */ }
        // CONFERENCE_JOINED is bound later (after local tracks are ready) so we
        // can publish tracks on join. Only LEFT is bound here.
        room.on(JitsiMeetJS.events.conference.CONFERENCE_LEFT, () => {
          if (!disposed) onCloseRef.current?.();
        });

        const saved = readSavedDevices();
        const buildAudioOpts = () => saved.micId
          ? { devices: ["audio"], micDeviceId: saved.micId }
          : { devices: ["audio"] };
        const buildVideoOpts = () => saved.cameraId
          ? { devices: ["video"], cameraDeviceId: saved.cameraId }
          : { devices: ["video"] };

        // Create local tracks BEFORE join so permission prompt happens early
        let tracks = [];
        try {
          if (startVideoMuted) {
            tracks = await JitsiMeetJS.createLocalTracks(buildAudioOpts());
          } else {
            const audioTracks = await JitsiMeetJS.createLocalTracks(buildAudioOpts());
            let videoTracks = [];
            try { videoTracks = await JitsiMeetJS.createLocalTracks(buildVideoOpts()); }
            catch (ve) { console.warn("Camera unavailable:", ve?.message); }
            tracks = [...audioTracks, ...videoTracks];
          }
        } catch (err) {
          console.warn("createLocalTracks failed, retry audio only", err);
          tracks = await JitsiMeetJS.createLocalTracks({ devices: ["audio"] });
        }

        if (disposed) { tracks.forEach((tr) => tr.dispose?.()); return; }

        localTracksRef.current = tracks;
        const localPatch = {
          displayName: "You",
          audioMuted: startAudioMuted,
          videoMuted: startVideoMuted,
          avatar: resolveAvatar("You") || (memberDirectory.find((m) => String(m.id) === String(callConfig?.user_id))?.avatar) || peerAvatar || null,
        };
        for (const track of tracks) {
          if (startAudioMuted && track.getType() === "audio") {
            try { await track.mute(); } catch { /* */ }
          }
          if (track.getType() === "audio") {
            localPatch.audioTrack = track;
            localPatch.audioMuted = track.isMuted();
            try {
              const mediaTrack = track.getTrack?.();
              if (mediaTrack) startMicMeter(new MediaStream([mediaTrack]));
            } catch { /* */ }
          } else {
            localPatch.videoTrack = track;
            localPatch.videoMuted = track.isMuted();
          }
        }
        upsertParticipant("local", localPatch);
        setAudioMuted(!!localPatch.audioMuted);
        setVideoMuted(!!localPatch.videoMuted);

        let published = false;
        const publishLocalTracks = async () => {
          for (const track of tracks) {
            try {
              // Skip if already added
              await room.addTrack(track);
            } catch (e) {
              // "Track already added" is fine
              console.warn("addTrack", track.getType?.(), e?.message || e);
            }
          }
        };

        const syncExistingParticipants = () => {
          try {
            const existing = room.getParticipants?.() || [];
            existing.forEach((user) => {
              const id = user.getId?.() || user._id;
              if (!id) return;
              upsertParticipant(id, {
                displayName: user.getDisplayName?.() || "Participant",
              });
              // Attach already-present tracks (join race)
              try {
                (user.getTracks?.() || []).forEach((track) => {
                  if (track.isLocal?.()) return;
                  const isVideo = track.getType() === "video";
                  if (isVideo) {
                    upsertParticipant(id, {
                      videoTrack: track,
                      videoMuted: track.isMuted(),
                      isScreen: track.videoType === "desktop",
                    });
                  } else {
                    upsertParticipant(id, {
                      audioTrack: track,
                      audioMuted: track.isMuted(),
                    });
                  }
                });
              } catch { /* */ }
            });
          } catch { /* */ }
        };

        const onJoined = () => {
          if (disposed || published) return;
          published = true;
          setLoading(false);
          try { room.setDisplayName(displayName); } catch { /* */ }
          publishLocalTracks();
          // Peer may already be in the room (callee joined first)
          syncExistingParticipants();
        };
        room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, onJoined);

        room.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, (err) => {
          console.error("[call] CONFERENCE_FAILED", err);
          if (!disposed) setError(String(err || "Conference failed"));
        });

        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          if (disposed) return;
          const uniq = (arr) => {
            const seen = new Set();
            return arr.filter((d) => {
              const id = d.deviceId || "";
              if (!id || seen.has(id)) return false;
              seen.add(id);
              return true;
            });
          };
          setDevices({
            audioInputs: uniq(list.filter((d) => d.kind === "audioinput")),
            videoInputs: uniq(list.filter((d) => d.kind === "videoinput")),
            audioOutputs: uniq(list.filter((d) => d.kind === "audiooutput")),
          });
          if (!selectedMic) {
            const aTrack = tracks.find((t) => t.getType() === "audio");
            const devId = aTrack?.getDeviceId?.() || aTrack?.device?.id;
            if (devId) setSelectedMic(devId);
          }
          if (!selectedCam) {
            const vTrack = tracks.find((t) => t.getType() === "video" && t.videoType !== "desktop");
            const devId = vTrack?.getDeviceId?.() || vTrack?.device?.id;
            if (devId) setSelectedCam(devId);
          }
        } catch { /* */ }

        const onDeviceChange = async () => {
          try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const uniq = (arr) => {
              const seen = new Set();
              return arr.filter((d) => {
                const id = d.deviceId || "";
                if (!id || seen.has(id)) return false;
                seen.add(id);
                return true;
              });
            };
            setDevices({
              audioInputs: uniq(list.filter((d) => d.kind === "audioinput")),
              videoInputs: uniq(list.filter((d) => d.kind === "videoinput")),
              audioOutputs: uniq(list.filter((d) => d.kind === "audiooutput")),
            });
          } catch { /* */ }
        };
        navigator.mediaDevices.addEventListener?.("devicechange", onDeviceChange);

        room.join();
        // Fallback: if CONFERENCE_JOINED is slow/missed, still try publish + stop spinner
        setTimeout(() => {
          if (disposed) return;
          setLoading(false);
          if (!published) {
            published = true;
            publishLocalTracks();
          }
        }, BOOT_FALLBACK_MS);
      } catch (e) {
        if (!disposed) {
          setError(e?.message || "Could not start call");
          setLoading(false);
        }
      } finally {
        startingRef.current = false;
      }
    };

    boot();

    return () => {
      disposed = true;
      startingRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  useEffect(() => () => stopMicMeter(), [stopMicMeter]);

  const remoteCount = Object.keys(participants).filter((k) => k !== "local").length;
  const hasPeer = remoteCount > 0;

  // Call timer only ticks once at least one remote participant is present
  // (phone-style: ringing phase has no elapsed time).
  useEffect(() => {
    if (!callConfig || !hasPeer) return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callConfig, hasPeer]);

  // Direct (1:1): ringback only for initiator while waiting.
  // Group (Meet-style): no ringback — you just join the room; others get
  // the normal incoming-call notification from the messenger backend.
  const isInitiator = !!(callConfig?.is_initiator ?? callConfig?.initiator_is_me ?? callConfig?.isInitiator);
  const groupCall = !!(isGroup || callConfig?.is_group || callConfig?.call_type === "group");
  useEffect(() => {
    if (!callConfig || loading || error || hasPeer || !isInitiator || groupCall) return undefined;
    const ring = startRingback();
    return () => ring.stop();
  }, [callConfig, loading, error, hasPeer, isInitiator, groupCall]);

  // Track whether anyone ever joined (group call: end when last person leaves)
  const hadPeerRef = useRef(false);
  useEffect(() => {
    if (hasPeer) hadPeerRef.current = true;
  }, [hasPeer]);

  // Auto hangup:
  //  1) Nobody ever joined → after ALONE_TIMEOUT_MS (ringing timeout)
  //  2) Someone was here and everyone left → end quickly and announce
  useEffect(() => {
    if (loading || error) return undefined;
    if (hasPeer) return undefined;
    const grace = hadPeerRef.current ? 2500 : ALONE_TIMEOUT_MS;
    const t = setTimeout(() => {
      if (hadPeerRef.current) {
        flash("Call ended — no one left in the call");
      }
      hangup();
    }, grace);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, hasPeer]);

  /* ── Action handlers (every action is precondition-checked) ──────── */

  const hangup = useCallback(() => {
    (async () => {
      try {
        stopMicMeter();
        for (const t of localTracksRef.current) {
          try { await t.dispose?.(); } catch { /* */ }
        }
        localTracksRef.current = [];
        try { await roomRef.current?.leave(); } catch { /* */ }
        try { connRef.current?.disconnect(); } catch { /* */ }
      } finally {
        onCloseRef.current?.();
      }
    })();
  }, [stopMicMeter]);

  const toggleAudio = useCallback(async () => {
    const track = localTracksRef.current.find((t) => t.getType?.() === "audio");
    if (!track) { flash("No microphone available"); return; }
    try {
      if (track.isMuted()) await track.unmute();
      else await track.mute();
      setAudioMuted(track.isMuted());
      upsertParticipant("local", { audioMuted: track.isMuted() });
    } catch {
      flash("Could not toggle microphone");
    }
  }, [flash, upsertParticipant]);

  const toggleVideo = useCallback(async () => {
    let track = localTracksRef.current.find((t) => t.getType?.() === "video" && t.videoType !== "desktop");
    const JitsiMeetJS = window.JitsiMeetJS;
    const room = roomRef.current;
    if (!track && JitsiMeetJS && room) {
      try {
        const opts = selectedCam
          ? { devices: ["video"], cameraDeviceId: selectedCam }
          : { devices: ["video"] };
        const created = await JitsiMeetJS.createLocalTracks(opts);
        track = created.find((t) => t.getType() === "video");
        if (track) {
          localTracksRef.current.push(track);
          await room.addTrack(track);
          upsertParticipant("local", { videoTrack: track, videoMuted: false });
          setVideoMuted(false);
        } else {
          flash("No camera detected");
        }
      } catch {
        flash("Could not start camera");
      }
      return;
    }
    if (!track) { flash("No camera available"); return; }
    try {
      if (track.isMuted()) await track.unmute();
      else await track.mute();
      setVideoMuted(track.isMuted());
      upsertParticipant("local", { videoMuted: track.isMuted(), videoTrack: track });
    } catch {
      flash("Could not toggle camera");
    }
  }, [flash, selectedCam, upsertParticipant]);

  const toggleShare = useCallback(async () => {
    const JitsiMeetJS = window.JitsiMeetJS;
    const room = roomRef.current;
    if (!JitsiMeetJS || !room) { flash("Call not ready"); return; }
    const existing = localTracksRef.current.find((t) => t.videoType === "desktop");
    if (existing) {
      try {
        await room.removeTrack(existing);
        existing.dispose?.();
      } catch { /* */ }
      localTracksRef.current = localTracksRef.current.filter((t) => t !== existing);
      setSharing(false);
      removeParticipant("local-screen");
      setStagedScreenId((cur) => (cur === "local-screen" || cur === "local" ? null : cur));
      return;
    }
    try {
      const tracks = await JitsiMeetJS.createLocalTracks({
        devices: ["desktop"],
        desktopSharingConstraints: {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { frameRate: { ideal: 15, max: 30 } },
        },
      });
      const desk = tracks.find((t) => t.getType() === "video");
      if (!desk) { flash("Screen share cancelled"); return; }
      localTracksRef.current.push(desk);
      await room.addTrack(desk);
      setSharing(true);
      // Stage screen as dominant view; do not hide the rail-fighting layout —
      // close the participants rail so the share fills the stage.
      setRailOpen(false);
      // Keep a dedicated screen participant so camera tile can stay separate
      upsertParticipant("local-screen", {
        displayName: "Your screen",
        videoTrack: desk,
        videoMuted: false,
        isScreen: true,
        audioMuted: true,
      });
      setStagedScreenId("local-screen");
      desk.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, async () => {
        try { await room.removeTrack(desk); } catch { /* */ }
        localTracksRef.current = localTracksRef.current.filter((t) => t !== desk);
        setSharing(false);
        removeParticipant("local-screen");
        setStagedScreenId((cur) => (cur === "local-screen" || cur === "local" ? null : cur));
      });
    } catch {
      flash("Screen share failed or cancelled");
    }
  }, [flash, upsertParticipant, removeParticipant]);

  const toggleFullscreen = useCallback(() => {
    // Fullscreen on the root element. We use webkit fallbacks for iOS Safari
    // (though iOS Safari rarely supports element fullscreen — we'll flash a
    // toast if neither API is available).
    const el = rootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const req = el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
        if (req && req.then) {
          req.then(() => { setFullscreen(true); }).catch(() => flash("Fullscreen not available on this device"));
        } else if (!req) {
          flash("Fullscreen not supported on this browser");
        }
      } else {
        const exit = document.exitFullscreen?.() || document.webkitExitFullscreen?.();
        if (exit && exit.then) exit.then(() => setFullscreen(false)).catch(() => {});
      }
    } catch {
      flash("Fullscreen failed");
    }
  }, [flash]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  /* ── Mini-mode drag (clamped to viewport on every move + on resize) ─ */
  const onDragStart = useCallback((e) => {
    if (mode !== "mini") return;
    if (e.cancelable) e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { active: true, ox: clientX - miniPos.x, oy: clientY - miniPos.y };
  }, [mode, miniPos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const w = typeof window !== "undefined" ? window.innerWidth : 1000;
      const h = typeof window !== "undefined" ? window.innerHeight : 800;
      setMiniPos({
        x: clamp(clientX - dragRef.current.ox, 8, Math.max(8, w - MINI_W - 8)),
        y: clamp(clientY - dragRef.current.oy, 8, Math.max(8, h - MINI_H - 90)),
      });
      if (e.cancelable && e.touches) e.preventDefault();
    };
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  // Re-clamp mini position on window resize so it NEVER escapes the viewport.
  useEffect(() => {
    if (mode !== "mini") return undefined;
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setMiniPos((prev) => ({
        x: clamp(prev.x, 8, Math.max(8, w - MINI_W - 8)),
        y: clamp(prev.y, 8, Math.max(8, h - MINI_H - 90)),
      }));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [mode]);

  const goMini = useCallback(() => {
    if (document.fullscreenElement) {
      try { document.exitFullscreen?.(); } catch { /* */ }
    }
    // Always thin top strip (desktop + mobile) — no floating card.
    setMode("mini");
    setFullscreen(false);
  }, []);
  const goFull = useCallback(() => {
    setMode("full");
  }, []);

  /* ── Derived participant list ─────────────────────────────────────── */
  const list = useMemo(
    () => Object.entries(participants).map(([id, p]) => ({ id, ...p })),
    [participants],
  );
  const screenShares = useMemo(
    () => list.filter((p) => p.isScreen && p.videoTrack),
    [list],
  );
  const staged = useMemo(() => {
    if (screenShares.length === 0) return null;
    if (stagedScreenId) {
      const found = screenShares.find((p) => p.id === stagedScreenId);
      if (found) return found;
    }
    const local = screenShares.find((p) => p.id === "local");
    return local || screenShares[0];
  }, [screenShares, stagedScreenId]);

  const others = useMemo(() => {
    if (!staged) return list;
    return list.filter((p) => p.id !== staged.id);
  }, [list, staged]);
  const count = list.length;
  const gridCols = others.length <= 1 ? 1 : others.length === 2 ? 2 : others.length <= 4 ? 2 : 3;

  /* ── Device selection ─────────────────────────────────────────────── */
  const applyMic = useCallback(async (deviceId) => {
    setSelectedMic(deviceId);
    const track = localTracksRef.current.find((t) => t.getType?.() === "audio");
    if (track && deviceId) {
      try { await track.setDevice?.(deviceId); } catch { /* */ }
    }
    writeSavedDevices({ micId: deviceId });
    try {
      const ms = new MediaStream([track.getTrack?.()]);
      stopMicMeter();
      startMicMeter(ms);
    } catch { /* */ }
  }, [startMicMeter, stopMicMeter]);

  const applyCam = useCallback(async (deviceId) => {
    setSelectedCam(deviceId);
    const track = localTracksRef.current.find((t) => t.getType?.() === "video" && t.videoType !== "desktop");
    if (track && deviceId) {
      try { await track.setDevice?.(deviceId); } catch { /* */ }
    }
    writeSavedDevices({ cameraId: deviceId });
  }, []);

  const applySpeaker = useCallback(async (deviceId) => {
    setSelectedSpeaker(deviceId);
    writeSavedDevices({ speakerId: deviceId });
    if (platform.hasSetSinkId) {
      document.querySelectorAll("audio").forEach((el) => {
        if (typeof el.setSinkId === "function") {
          try { el.setSinkId(deviceId || ""); } catch { /* */ }
        }
      });
    } else {
      flash("Speaker selection not supported on this browser");
    }
  }, [flash, platform]);

  /* ── EARLY RETURN AFTER ALL HOOKS ─────────────────────────────────── */
  if (!callConfig) return null;
  const isMini = mode === "mini";

  /* ── Style helpers ────────────────────────────────────────────────── */
  const controlBtnSx = (active, danger, size = 44) => ({
    bgcolor: danger ? "error.main" : active ? "primary.main" : "rgba(255,255,255,0.10)",
    color: "#fff",
    width: size, height: size,
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.08)",
    "&:hover": {
      bgcolor: danger ? "error.dark" : active ? "primary.dark" : "rgba(255,255,255,0.20)",
    },
    "&:active": { transform: "scale(0.94)" },
    transition: "background-color 0.15s ease, transform 0.08s ease",
    touchAction: "manipulation",
  });

  const micLevelRingSx = {
    position: "absolute", inset: -4, borderRadius: "50%", pointerEvents: "none",
    boxShadow: `0 0 ${4 + micLevel * 18}px ${2 + micLevel * 10}px ${alpha("#22c55e", 0.4 + micLevel * 0.4)}`,
    opacity: audioMuted ? 0 : (0.3 + micLevel * 0.7),
    transition: "opacity 0.08s linear",
  };

  /* ── Controls bar (inline render — NO nested component) ───────────── */
  const renderControls = (compact = false) => {
    const mobile = isMobileView || isSmallView;
    const sz = compact ? 36 : (mobile ? 44 : 48);
    // Mobile full: mic, cam, more, mini, hangup — rest in "more" menu
    return (
      <Stack
        direction="row"
        spacing={compact ? 0.6 : (mobile ? 0.75 : 1)}
        alignItems="center"
        justifyContent="center"
        sx={{ width: "100%", flexWrap: "wrap", rowGap: 0.5 }}
      >
        <Tooltip title={audioMuted ? "Unmute mic" : "Mute mic"}>
          <IconButton onClick={toggleAudio} sx={controlBtnSx(false, audioMuted, sz)}
            aria-label={audioMuted ? "Unmute mic" : "Mute mic"}>
            {audioMuted ? <MicOffIcon fontSize={compact ? "small" : "medium"} /> : <MicIcon fontSize={compact ? "small" : "medium"} />}
          </IconButton>
        </Tooltip>

        <Tooltip title={videoMuted ? "Start video" : "Stop video"}>
          <IconButton onClick={toggleVideo} sx={controlBtnSx(false, videoMuted, sz)}
            aria-label={videoMuted ? "Start video" : "Stop video"}>
            {videoMuted ? <VideocamOffIcon fontSize={compact ? "small" : "medium"} /> : <VideocamIcon fontSize={compact ? "small" : "medium"} />}
          </IconButton>
        </Tooltip>

        {!compact && (
          <>
            {/* Always-visible core actions */}
            <Tooltip title="In-call chat">
              <IconButton onClick={() => setChatOpen((v) => !v)} sx={controlBtnSx(chatOpen, false, sz)}
                aria-label="In-call chat">
                <ChatIcon fontSize={mobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Participants">
              <IconButton onClick={() => setRailOpen((v) => !v)} sx={controlBtnSx(railOpen, false, sz)}
                aria-label="Participants">
                <PeopleIcon fontSize={mobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
            {!mobile && (
              <>
                <Tooltip title={sharing ? "Stop screen share" : "Share screen"}>
                  <IconButton onClick={toggleShare} sx={controlBtnSx(sharing, false, sz)}
                    aria-label={sharing ? "Stop screen share" : "Share screen"}>
                    {sharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Microphone & camera">
                  <IconButton onClick={() => setDeviceSheetOpen(true)} sx={controlBtnSx(false, false, sz)}
                    aria-label="Microphone & camera">
                    <SettingsIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                  <IconButton onClick={toggleFullscreen} sx={controlBtnSx(false, false, sz)}
                    aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
                    {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                  </IconButton>
                </Tooltip>
              </>
            )}
            {mobile && (
              <Tooltip title="More">
                <IconButton
                  onClick={(e) => setMoreAnchor(e.currentTarget)}
                  sx={controlBtnSx(Boolean(moreAnchor), false, sz)}
                  aria-label="More"
                >
                  <MoreHorizIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Minimise">
              <IconButton onClick={goMini} sx={controlBtnSx(false, false, sz)}
                aria-label="Minimise">
                <PictureInPictureAltIcon fontSize={mobile ? "small" : "medium"} />
              </IconButton>
            </Tooltip>
          </>
        )}

        {compact && (
          <Tooltip title="Expand">
            <IconButton onClick={goFull} sx={controlBtnSx(false, false, sz)}
              aria-label="Expand">
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Hang up">
          <IconButton onClick={hangup}
            sx={{
              ...controlBtnSx(false, true, compact ? 38 : (mobile ? 46 : 52)),
              borderRadius: 3, ml: 0.5, px: compact ? 0.5 : 1.5,
            }}
            aria-label="Hang up">
            <CallEndIcon fontSize={compact ? "small" : "medium"} />
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={moreAnchor}
          open={Boolean(moreAnchor)}
          onClose={() => setMoreAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          transformOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{ zIndex: 1800 }}
          MenuListProps={{ dense: true }}
        >
          <MenuItem onClick={() => { setMoreAnchor(null); toggleShare(); }}>
            <ListItemIcon>{sharing ? <StopScreenShareIcon fontSize="small" /> : <ScreenShareIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{sharing ? "Stop sharing" : "Share screen"}</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); setDeviceSheetOpen(true); }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Audio &amp; video</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); setRailOpen(true); }}>
            <ListItemIcon><PeopleIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Participants</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); setChatOpen(true); }}>
            <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Chat</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setMoreAnchor(null); toggleFullscreen(); }}>
            <ListItemIcon>{fullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</ListItemText>
          </MenuItem>
        </Menu>
      </Stack>
    );
  };

  /* ── Device sheet content ─────────────────────────────────────────── */
  const renderDeviceSheet = () => {
    const content = (
      <Box sx={{
        width: isMobileView ? "100%" : 380,
        maxHeight: isMobileView ? "85vh" : "80vh",
        overflowY: "auto", bgcolor: "#12151a", color: "#fff", p: 2,
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Audio &amp; Video</Typography>
          <IconButton size="small" onClick={() => setDeviceSheetOpen(false)}
            sx={{ color: "rgba(255,255,255,0.7)" }} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Typography variant="caption" sx={{ opacity: 0.7, mb: 0.75, display: "block", fontWeight: 700 }}>
          MICROPHONE
        </Typography>
        <Paper sx={{ bgcolor: "rgba(255,255,255,0.04)", mb: 1 }} elevation={0}>
          <List dense disablePadding>
            {devices.audioInputs.length === 0 && (
              <Typography variant="caption" sx={{ p: 1.5, display: "block", opacity: 0.5 }}>
                No microphones detected
              </Typography>
            )}
            {devices.audioInputs.map((d, idx) => (
              <ListItemButton key={d.deviceId || idx}
                selected={selectedMic === d.deviceId}
                onClick={() => applyMic(d.deviceId)}
                sx={{
                  "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.18) },
                  "&.Mui-selected:hover": { bgcolor: alpha("#3b82f6", 0.25) },
                }}>
                <ListItemIcon sx={{ minWidth: 36, color: selectedMic === d.deviceId ? "primary.main" : "rgba(255,255,255,0.5)" }}>
                  <MicIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={d.label || `Microphone ${idx + 1}`}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {!audioMuted && (
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{
              width: "100%", height: 8, bgcolor: "rgba(255,255,255,0.06)",
              borderRadius: 4, overflow: "hidden", position: "relative",
            }}>
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                bgcolor: micLevel > 0.85 ? "error.main" : micLevel > 0.55 ? "warning.main" : "success.main",
                transition: "width 0.04s linear",
              }} />
            </Box>
            <Typography variant="caption" sx={{ opacity: 0.55, mt: 0.5, display: "block" }}>
              {micLevel < 0.05 ? "Speak to test your mic" : micLevel > 0.85 ? "Very loud" : "Mic is working"}
            </Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 2 }} />

        <Typography variant="caption" sx={{ opacity: 0.7, mb: 0.75, display: "block", fontWeight: 700 }}>
          CAMERA
        </Typography>
        <Paper sx={{ bgcolor: "rgba(255,255,255,0.04)", mb: 1 }} elevation={0}>
          <List dense disablePadding>
            {devices.videoInputs.length === 0 && (
              <Typography variant="caption" sx={{ p: 1.5, display: "block", opacity: 0.5 }}>
                No cameras detected
              </Typography>
            )}
            {devices.videoInputs.map((d, idx) => (
              <ListItemButton key={d.deviceId || idx}
                selected={selectedCam === d.deviceId}
                onClick={() => applyCam(d.deviceId)}
                sx={{
                  "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.18) },
                  "&.Mui-selected:hover": { bgcolor: alpha("#3b82f6", 0.25) },
                }}>
                <ListItemIcon sx={{ minWidth: 36, color: selectedCam === d.deviceId ? "primary.main" : "rgba(255,255,255,0.5)" }}>
                  <VideocamIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={d.label || `Camera ${idx + 1}`}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        {/* Speaker section — only show on Chrome/Edge where setSinkId works.
            On iOS Safari / Firefox this is hidden (not just disabled) so the
            sheet doesn't show a "broken" button. */}
        {platform.hasSetSinkId && devices.audioOutputs.length > 0 && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mt: 2, mb: 2 }} />
            <Typography variant="caption" sx={{ opacity: 0.7, mb: 0.75, display: "block", fontWeight: 700 }}>
              SPEAKER (OUTPUT)
            </Typography>
            <Paper sx={{ bgcolor: "rgba(255,255,255,0.04)" }} elevation={0}>
              <List dense disablePadding>
                <ListItemButton selected={!selectedSpeaker} onClick={() => applySpeaker("")}
                  sx={{ "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.18) } }}>
                  <ListItemIcon sx={{ minWidth: 36, color: !selectedSpeaker ? "primary.main" : "rgba(255,255,255,0.5)" }}>
                    <SpeakerIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary="System default" primaryTypographyProps={{ fontSize: 13 }} />
                </ListItemButton>
                {devices.audioOutputs.map((d, idx) => (
                  <ListItemButton key={d.deviceId || idx}
                    selected={selectedSpeaker === d.deviceId}
                    onClick={() => applySpeaker(d.deviceId)}
                    sx={{ "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.18) } }}>
                    <ListItemIcon sx={{ minWidth: 36, color: selectedSpeaker === d.deviceId ? "primary.main" : "rgba(255,255,255,0.5)" }}>
                      <SpeakerIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={d.label || `Speaker ${idx + 1}`}
                      primaryTypographyProps={{ fontSize: 13, noWrap: true }} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </>
        )}

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mt: 2, mb: 1.5 }} />

        <Stack spacing={1}>
          <FormControlLabel
            control={<Switch checked={!audioMuted} onChange={toggleAudio} color="primary" />}
            label="Microphone on"
          />
          <FormControlLabel
            control={<Switch checked={!videoMuted} onChange={toggleVideo} color="primary" />}
            label="Camera on"
          />
          <FormControlLabel
            control={<Switch checked={sharing} onChange={toggleShare} color="primary" />}
            label="Screen share"
          />
        </Stack>

        <Typography variant="caption" sx={{ display: "block", mt: 2, opacity: 0.5 }}>
          Device choices are saved and reused next time. {isIOS ? "iOS uses the system default speaker." : ""}
        </Typography>
      </Box>
    );

    if (isMobileView) {
      return (
        <Modal open={deviceSheetOpen} onClose={() => setDeviceSheetOpen(false)} closeAfterTransition sx={{ zIndex: 1800 }}
          aria-labelledby="device-sheet-title">
          <Slide direction="up" in={deviceSheetOpen} mountOnEnter unmountOnExit>
            <Box sx={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
            }}>
              {content}
            </Box>
          </Slide>
        </Modal>
      );
    }
    return (
      <Modal open={deviceSheetOpen} onClose={() => setDeviceSheetOpen(false)} closeAfterTransition sx={{ zIndex: 1800 }}
        aria-labelledby="device-sheet-title">
        <Box sx={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          bgcolor: "#12151a", borderRadius: 2, overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
          width: 380, maxWidth: "90vw",
        }}>
          {content}
        </Box>
      </Modal>
    );
  };

  /* ── Participants rail ────────────────────────────────────────────── */
  const renderRail = () => {
    if (isMini || !railOpen) return null;
    const body = (
      <Box sx={{
        width: isMobileView ? "100%" : 260,
        height: "100%",
        flexShrink: 0,
        bgcolor: "rgba(12,16,22,0.98)",
        backdropFilter: "blur(10px)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        display: "flex",
        flexDirection: "column",
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 1.5, py: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            {isMobileView && (
              <IconButton size="small" onClick={() => setRailOpen(false)}
                sx={{ color: "rgba(255,255,255,0.7)" }}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <PeopleIcon sx={{ fontSize: 16, opacity: 0.7 }} />
            <Typography variant="subtitle2" fontWeight={600}>
              Participants ({count})
            </Typography>
          </Stack>
          {!isMobileView && (
            <IconButton size="small" onClick={() => setRailOpen(false)}
              sx={{ color: "rgba(255,255,255,0.7)" }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
        <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
          {list.map((p) => {
            const isMe = p.id === "local";
            const isSpk = speakingId === p.id;
            return (
              <Stack key={p.id} direction="row" spacing={1.25} alignItems="center"
                sx={{ px: 1.5, py: 1, "&:hover": { bgcolor: "rgba(255,255,255,0.04)" } }}>
                <Box sx={{ position: "relative" }}>
                  <ParticipantAvatar p={p} isLocal={isMe} size={36} speaking={isSpk} />
                  {isMe && !audioMuted && <Box sx={micLevelRingSx} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap fontWeight={500}>
                    {p.displayName || (isMe ? "You" : "User")}
                    {isMe && (
                      <Typography component="span" variant="caption" sx={{ ml: 0.5, opacity: 0.6 }}>
                        (you)
                      </Typography>
                    )}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                    {p.isScreen && (
                      <Chip size="small" label="screen"
                        sx={{ height: 16, fontSize: 9, bgcolor: alpha("#3b82f6", 0.18), color: "#93c5fd" }} />
                    )}
                    {p.audioMuted ? (
                      <MicOffIcon sx={{ fontSize: 12, color: "error.light" }} />
                    ) : isSpk ? (
                      <GraphicEqIcon sx={{ fontSize: 12, color: "success.light" }} />
                    ) : null}
                  </Stack>
                </Box>
                {p.isScreen && (
                  <Tooltip title="Bring to stage">
                    <IconButton size="small" onClick={() => setStagedScreenId(p.id)}
                      sx={{
                        color: staged?.id === p.id ? "primary.main" : "rgba(255,255,255,0.6)",
                        bgcolor: staged?.id === p.id ? alpha("#3b82f6", 0.15) : "transparent",
                      }}>
                      <PresentToAllIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            );
          })}
          {list.length === 0 && (
            <Typography variant="caption" sx={{ display: "block", p: 2, textAlign: "center", opacity: 0.5 }}>
              No one in the call yet
            </Typography>
          )}
        </Box>
      </Box>
    );

    if (isMobileView) {
      return (
        <Drawer
          anchor="right"
          open={railOpen}
          onClose={() => setRailOpen(false)}
          transitionDuration={280}
          ModalProps={{ keepMounted: true }}
          sx={{ zIndex: 1800 }}
          PaperProps={{
            sx: {
              width: "min(320px, 90vw)",
              bgcolor: "rgba(12,16,22,0.98)",
              color: "#fff",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
            },
          }}
        >
          {body}
        </Drawer>
      );
    }
    return body;
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  /**
   * FULL (mobile): true fullscreen overlay — primary call surface.
   * INLINE (desktop): fills parent flex column inside chat pane.
   * MINI (mobile): thin horizontal strip (Telegram/WhatsApp style) that the
   *   parent places under the chat header — NOT a floating card.
   * MINI (desktop): small floating PiP card, clamped to viewport.
   */

  const submitChat = () => {
    const body = chatDraft.trim();
    if (!body || !onSendChat) return;
    onSendChat(body);
    setChatDraft("");
  };

  const renderCallChat = () => {
    const formatMsgBody = (m) => {
      if (!m) return "";
      if (typeof m.body === "string" && m.body.trim()) return m.body;
      if (m.event_type || m.type) {
        const t = m.event_type || m.type;
        if (String(t).includes("call")) return m.body || "📞 Call event";
        return m.body || String(t);
      }
      if ((m.attachments || []).length) {
        const kinds = (m.attachments || []).map((a) => a.content_type || a.type || "file");
        return "📎 " + (kinds[0] || "Attachment");
      }
      if (m.system_message || m.is_system) return m.body || m.system_message || "System";
      return m.body || "";
    };

    const onChatScroll = (e) => {
      const el = e.currentTarget;
      const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      chatNearBottomRef.current = distBottom < 80;

      const now = performance.now();
      const sv = chatScrollVelRef.current;
      const dt = Math.max(1, now - (sv.lastTs || now));
      const dy = el.scrollTop - (sv.lastTop || el.scrollTop);
      const inst = dy / dt;
      sv.velocity = sv.lastTs ? (sv.velocity * 0.65 + inst * 0.35) : inst;
      sv.lastTop = el.scrollTop;
      sv.lastTs = now;
      const speedUp = sv.velocity < 0 ? -sv.velocity : 0;

      let threshold = Math.max(220, el.clientHeight * 0.55);
      if (speedUp > 0.35) threshold = Math.max(threshold, el.clientHeight * 1.1);
      if (speedUp > 0.8) threshold = Math.max(threshold, el.clientHeight * 1.7);
      if (speedUp > 1.4) threshold = Math.max(threshold, el.clientHeight * 2.4);

      if (el.scrollTop < threshold && hasMoreMessages && !loadingMore && onLoadOlder && !chatLoadingOlderRef.current) {
        chatLoadingOlderRef.current = true;
        chatPinAfterLoadRef.current = {
          height: el.scrollHeight,
          top: el.scrollTop,
        };
        onLoadOlder();
        setTimeout(() => {
          if (chatLoadingOlderRef.current && chatPinAfterLoadRef.current) {
            chatLoadingOlderRef.current = false;
            chatPinAfterLoadRef.current = null;
          }
        }, 2500);
      }
    };

    const panel = (
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bgcolor: "#000",
        color: "#f1f5f9",
        borderRight: isMobileView ? "none" : "1px solid rgba(255,255,255,0.1)",
      }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 1.5, py: 1, borderBottom: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, bgcolor: "#0a0a0a" }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: "#fff" }}>
            Chat
          </Typography>
          <IconButton size="small" onClick={() => setChatOpen(false)} sx={{ color: "rgba(255,255,255,0.7)" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Box
          ref={chatScrollRef}
          onScroll={onChatScroll}
          sx={{ flex: 1, overflowY: "auto", px: 1.25, py: 1.25, minHeight: 0, bgcolor: "#000" }}
        >
          {loadingMore && (
            <Stack alignItems="center" sx={{ py: 1 }}>
              <CircularProgress size={18} sx={{ color: "rgba(255,255,255,0.5)" }} />
            </Stack>
          )}
          {hasMoreMessages && !loadingMore && (
            <Typography
              variant="caption"
              onClick={() => {
                const el = chatScrollRef.current;
                if (el) {
                  chatLoadingOlderRef.current = true;
                  chatPinAfterLoadRef.current = { height: el.scrollHeight, top: el.scrollTop };
                }
                onLoadOlder?.();
              }}
              sx={{ display: "block", textAlign: "center", color: "rgba(255,255,255,0.45)", cursor: "pointer", mb: 1 }}
            >
              Load older messages
            </Typography>
          )}
          {(messages || []).length === 0 && (
            <Typography variant="caption" sx={{ opacity: 0.45, display: "block", textAlign: "center", mt: 4 }}>
              No messages yet
            </Typography>
          )}
          {(messages || []).map((m) => {
            if (m?.type === "day") {
              return (
                <Typography key={m.id || m.label} variant="caption" sx={{ display: "block", textAlign: "center", color: "rgba(255,255,255,0.35)", my: 1 }}>
                  {m.label}
                </Typography>
              );
            }
            const bodyStr = typeof m?.body === "string" ? m.body : String(m?.body || "");
            const callLabel = formatCallSystemLabel(bodyStr);
            const isCallOrSystem = !!(
              callLabel
              || m?.is_system
              || m?.system_message
              || (bodyStr.startsWith("__call__"))
            );
            if (isCallOrSystem) {
              const label = callLabel || m?.system_message || bodyStr;
              return (
                <Box key={m.id} sx={{ textAlign: "center", my: 1.1 }}>
                  <Chip
                    size="small"
                    label={label}
                    sx={{
                      bgcolor: "rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 12,
                      fontWeight: 500,
                      border: "1px solid rgba(255,255,255,0.12)",
                      maxWidth: "95%",
                      height: "auto",
                      py: 0.5,
                      "& .MuiChip-label": { whiteSpace: "normal" },
                    }}
                  />
                </Box>
              );
            }
            const mine = String(m?.sender?.id) === String(meId);
            const hasAtt = (m.attachments || []).length > 0;
            if (!bodyStr.trim() && hasAtt) {
              return (
                <Box key={m.id} sx={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", mb: 0.85 }}>
                  <Box sx={{ maxWidth: "88%", px: 1.25, py: 0.75, borderRadius: 2, bgcolor: mine ? "#1a1a1a" : "#111", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {!mine && (
                      <Typography variant="caption" sx={{ color: "#93c5fd", fontWeight: 700, display: "block", mb: 0.4, fontSize: 12 }}>
                        {m.sender?.username || "User"}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)" }}>📎 Attachment</Typography>
                  </Box>
                </Box>
              );
            }
            if (!bodyStr.trim()) return null;
            return (
              <Box
                key={m.id}
                sx={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  mb: 0.9,
                }}
              >
                <Box sx={{
                  maxWidth: "88%",
                  px: 1.25,
                  py: 0.8,
                  borderRadius: 2,
                  bgcolor: mine ? "#1a1a1a" : "#111",
                  border: "1px solid",
                  borderColor: mine ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
                }}>
                  {!mine && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#7dd3fc",
                        fontWeight: 700,
                        display: "block",
                        mb: 0.45,
                        fontSize: 12.5,
                        letterSpacing: 0.2,
                      }}
                    >
                      {m.sender?.username || m.sender?.display_name || "User"}
                    </Typography>
                  )}
                  <Box sx={{ color: "#f8fafc", lineHeight: 1.45, fontSize: 14 }}>
                    {renderCallChatSegments(bodyStr)}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        <Stack direction="row" spacing={0.75} alignItems="flex-end"
          sx={{ px: 1, py: 1, borderTop: "1px solid rgba(255,255,255,0.1)", flexShrink: 0, bgcolor: "#0a0a0a" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Message…"
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitChat();
              }
            }}
            multiline
            maxRows={3}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "#111",
                color: "#f1f5f9",
                borderRadius: 2,
                "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
                "&:hover fieldset": { borderColor: "rgba(255,255,255,0.25)" },
                "&.Mui-focused fieldset": { borderColor: "rgba(255,255,255,0.35)" },
              },
            }}
          />
          <IconButton
            onClick={submitChat}
            disabled={!chatDraft.trim()}
            sx={{
              bgcolor: "#fff",
              color: "#000",
              width: 40, height: 40,
              "&:hover": { bgcolor: "#e5e5e5" },
              "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.25)" },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    );

    if (isMobileView) {
      return (
        <Drawer
          anchor="left"
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          transitionDuration={280}
          ModalProps={{ keepMounted: true }}
          sx={{ zIndex: 1800 }}
          PaperProps={{
            sx: {
              width: "min(360px, 92vw)",
              height: "100%",
              bgcolor: "#000",
              color: "#fff",
              boxShadow: "8px 0 32px rgba(0,0,0,0.5)",
            },
          }}
        >
          {panel}
        </Drawer>
      );
    }
    if (!chatOpen) return null;
    return (
      <Box sx={{
        width: 320,
        flexShrink: 0,
        height: "100%",
        minHeight: 0,
        order: -1,
      }}>
        {panel}
      </Box>
    );
  };

  const isFull = mode === "full";
  // Mini is ALWAYS the thin top strip (mobile + desktop) — never a floating card.
  const isMiniBar = isMini;

  let rootSx;
  if (isMiniBar) {
    // Flow layout — parent (MessengerApp) places this under the settings /
    // chat header. NOT position:fixed so it never covers menus or headers.
    rootSx = {
      position: "relative",
      width: "100%",
      flexShrink: 0,
      bgcolor: "#1b2836",
      color: "#fff",
      borderBottom: "1px solid",
      borderColor: "divider",
      display: "flex",
      flexDirection: "column",
      userSelect: "none",
      zIndex: 8,
      boxShadow: "0 1px 0 rgba(0,0,0,0.12)",
    };
  } else if (isFull) {
    rootSx = {
      position: "fixed",
      inset: 0,
      zIndex: 1400,
      bgcolor: "#0b0e11",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      overflow: "hidden",
    };
  } else {
    // Desktop inline
    rootSx = {
      flex: 1, minHeight: 0, height: "100%",
      bgcolor: "#0b0e11", color: "#fff",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at top, #161b22 0%, #0b0e11 70%)",
      minWidth: 0,
    };
  }

  return (
    <Box
      ref={rootRef}
      sx={rootSx}
    >
      {/* Remote audio always mounted so minimize doesn't kill the other person's voice */}
      <RemoteAudioSink participants={participants} />

      {/* ── Mini strip (desktop + mobile): thin ongoing-call bar ── */}
      {isMiniBar ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 1.5,
            py: 0.85,
            minHeight: 48,
            width: "100%",
            bgcolor: "transparent",
          }}
        >
          {peerAvatar ? (
            <Avatar src={peerAvatar} sx={{ width: 32, height: 32 }} />
          ) : (
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14 }}>
              {(title || "C")[0]}
            </Avatar>
          )}
          <Box
            sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
            onClick={goFull}
          >
            <Typography variant="body2" fontWeight={600} noWrap>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "Connecting…" : (hasPeer ? formatElapsed(elapsed) : "Ringing…")}
              {audioMuted ? " · muted" : ""}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={toggleAudio}
            sx={{
              color: "#fff",
              bgcolor: audioMuted ? "error.main" : "rgba(255,255,255,0.12)",
              width: 36, height: 36,
              "&:hover": { bgcolor: audioMuted ? "error.dark" : "rgba(255,255,255,0.2)" },
            }}
            aria-label={audioMuted ? "Unmute" : "Mute"}
          >
            {audioMuted ? <MicOffIcon fontSize="small" /> : <MicIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={goFull}
            sx={{
              color: "#fff",
              bgcolor: "rgba(255,255,255,0.12)",
              width: 36, height: 36,
              "&:hover": { bgcolor: "rgba(255,255,255,0.2)" },
            }}
            aria-label="Expand call"
          >
            <OpenInFullIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={hangup}
            sx={{
              color: "#fff",
              bgcolor: "error.main",
              width: 36, height: 36,
              borderRadius: 2,
              "&:hover": { bgcolor: "error.dark" },
            }}
            aria-label="Hang up"
          >
            <CallEndIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : (
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}>
        {/* ── Header ── */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: isSmallView ? 1.25 : 2,
            py: 1,
            flexShrink: 0,
            bgcolor: "rgba(0,0,0,0.45)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            minHeight: 52,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
            {peerAvatar ? (
              <Avatar src={peerAvatar} sx={{ width: 34, height: 34 }} />
            ) : (
              <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 15 }}>
                {(title || "C")[0]}
              </Avatar>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {title}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" sx={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                  {loading ? "Connecting…" : (hasPeer ? formatElapsed(elapsed) : "Ringing…")}
                </Typography>
                <Chip
                  size="small"
                  icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                  label={count}
                  sx={{
                    height: 20, fontSize: 11,
                    bgcolor: "rgba(255,255,255,0.08)", color: "#fff",
                    "& .MuiChip-icon": { color: "#fff" },
                  }}
                />
                {staged && (
                  <Chip
                    size="small"
                    icon={<PresentToAllIcon sx={{ fontSize: 12 }} />}
                    label="Screen"
                    sx={{ height: 20, fontSize: 10, bgcolor: alpha("#3b82f6", 0.2), color: "#93c5fd" }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.25}>
            <Tooltip title="Minimise">
              <IconButton onClick={goMini} size="small" sx={{ color: "rgba(255,255,255,0.85)" }} aria-label="Minimise">
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* ── Stage + optional in-call chat ── */}
        <Box sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}>
        <Box sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          position: "relative",
          bgcolor: "#0a0c10",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {loading && (
            <Stack alignItems="center" justifyContent="center" spacing={1.5}
              sx={{ position: "absolute", inset: 0, zIndex: 5, bgcolor: "rgba(0,0,0,0.8)" }}>
              <CircularProgress size={44} color="primary" />
              <Typography variant="body2" sx={{ opacity: 0.85 }}>Connecting…</Typography>
            </Stack>
          )}
          {error && (
            <Stack alignItems="center" justifyContent="center" spacing={1}
              sx={{ position: "absolute", inset: 0, zIndex: 5, p: 2 }}>
              <Typography color="error" textAlign="center">{error}</Typography>
              <IconButton onClick={hangup} color="error"><CallEndIcon /></IconButton>
            </Stack>
          )}

          {/* Screen-share layout: big viewer + picker + filmstrip */}
          {staged ? (
            <Box sx={{
              flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
              p: isSmallView ? 0.75 : 1.25, gap: 1,
            }}>
              {screenShares.length > 1 && (
                <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0, overflowX: "auto", pb: 0.25 }}>
                  {screenShares.map((p) => (
                    <Chip
                      key={`pick-${p.id}`}
                      clickable
                      onClick={() => setStagedScreenId(p.id)}
                      icon={<PresentToAllIcon sx={{ fontSize: 16 }} />}
                      label={p.displayName || (p.id === "local-screen" || p.id === "local" ? "Your screen" : "Screen")}
                      sx={{
                        bgcolor: staged.id === p.id ? "primary.main" : "rgba(255,255,255,0.1)",
                        color: "#fff",
                        fontWeight: staged.id === p.id ? 700 : 500,
                        border: "1px solid",
                        borderColor: staged.id === p.id ? "primary.light" : "rgba(255,255,255,0.15)",
                        "& .MuiChip-icon": { color: "#fff" },
                      }}
                    />
                  ))}
                </Stack>
              )}
              <Box sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
                <ScreenShareViewer
                  participant={staged}
                  isLocal={staged.id === "local" || staged.id === "local-screen"}
                />
              </Box>
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  flexShrink: 0,
                  height: isSmallView ? 80 : 92,
                  overflowX: "auto",
                  overflowY: "hidden",
                  pb: 0.25,
                }}
              >
                {screenShares.map((p) => (
                  <Box
                    key={`ss-${p.id}`}
                    onClick={() => setStagedScreenId(p.id)}
                    sx={{
                      width: isSmallView ? 120 : 140,
                      height: isSmallView ? 72 : 84,
                      flex: "0 0 auto",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      cursor: "pointer",
                      border: "2px solid",
                      borderColor: staged.id === p.id ? "primary.main" : "rgba(255,255,255,0.12)",
                    }}
                  >
                    <ParticipantTile
                      participant={p}
                      isLocal={p.id === "local" || p.id === "local-screen"}
                      compact
                      showAvatar={false}
                    />
                  </Box>
                ))}
                {others.filter((p) => !p.isScreen).map((p) => (
                  <Box
                    key={p.id}
                    sx={{
                      width: isSmallView ? 120 : 140,
                      height: isSmallView ? 72 : 84,
                      flex: "0 0 auto",
                      borderRadius: 1.5,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <ParticipantTile
                      participant={p}
                      isLocal={p.id === "local"}
                      compact
                      speaking={speakingId === p.id || (p.id === "local" && speakingId === "local")}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>
          ) : (
            /* Normal participant grid */
            <Box sx={{
              flex: 1,
              minHeight: 0,
              p: isSmallView ? 1 : 1.5,
              display: "grid",
              gridTemplateColumns: count <= 1 ? "1fr" : count === 2 ? "1fr 1fr" : count <= 4 ? "1fr 1fr" : "1fr 1fr 1fr",
              gridTemplateRows: count <= 2 ? "1fr" : count <= 4 ? "1fr 1fr" : "1fr 1fr 1fr",
              gap: isSmallView ? 1 : 1.25,
              alignContent: "stretch",
            }}>
              {list.length === 0 && !loading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ gridColumn: "1 / -1" }}>
                  <Avatar sx={{ width: 88, height: 88, bgcolor: "primary.dark", mb: 2, fontSize: 36 }}>
                    {(title || "C")[0]?.toUpperCase()}
                  </Avatar>
                  <Typography sx={{ opacity: 0.75, mb: 0.5 }}>Ringing… waiting for others</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.5 }}>
                    Ends in {Math.floor(ALONE_TIMEOUT_MS / 1000)}s if no one joins
                  </Typography>
                </Stack>
              ) : (
                list.filter((p) => !p.isScreen || p.id === "local").map((p) => (
                  <Box key={p.id} sx={{ minHeight: 0, minWidth: 0, height: "100%" }}>
                    <ParticipantTile
                      participant={p}
                      isLocal={p.id === "local"}
                      isDominant={count === 1}
                      compact={false}
                      speaking={speakingId === p.id || (p.id === "local" && speakingId === "local")}
                    />
                  </Box>
                ))
              )}
            </Box>
          )}
        </Box>

        {railOpen && renderRail()}
        {renderCallChat()}
        </Box>

        {/* ── Controls ── */}
        <Paper elevation={0} sx={{
          py: isSmallView ? 1 : 1.25,
          px: 1,
          bgcolor: "rgba(0,0,0,0.75)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          {renderControls(false)}
        </Paper>

        {renderDeviceSheet()}

        {toast && (
          <Box sx={{
            position: "absolute",
            bottom: 88,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "rgba(0,0,0,0.88)",
            color: "#fff",
            px: 2, py: 1,
            borderRadius: 2,
            fontSize: 13,
            zIndex: 20,
            maxWidth: "80%",
            textAlign: "center",
          }}>
            {toast}
          </Box>
        )}
      </Box>
      )}
    </Box>
  );
}
