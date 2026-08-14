/**
 * JitsiCallModal — embedded call surface (Telegram / Meet style)
 *
 * Layout contract:
 *  - Full / inline mode: fills the chat stage (desktop) or goes true fullscreen
 *    overlay on mobile so the call is the primary surface.
 *  - Mini mode: collapses into a thin bar (like the audio player / WhatsApp /
 *    Telegram ongoing-call strip) under the chat header — NOT a floating card —
 *    so the user can keep chatting. Desktop keeps a compact floating PiP card.
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
  useEffect, useRef, useState, useCallback, useMemo,
} from "react";
import {
  Box, IconButton, Stack, Typography, Avatar, Chip, Tooltip,
  CircularProgress, Paper, Modal, Slide, List, ListItemButton, ListItemText,
  ListItemIcon, Switch, FormControlLabel, Divider, alpha, useMediaQuery,
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

function loadLibJitsi(domain) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") { reject(new Error("No window")); return; }
    if (window.JitsiMeetJS) { resolve(window.JitsiMeetJS); return; }
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

function attachTrack(track, el) {
  if (!el || !track) return;
  try { track.attach(el); return; } catch { /* */ }
  try {
    const stream = new MediaStream([track.getTrack?.() || track.stream?.getTracks?.()?.[0]].filter(Boolean));
    if (stream.getTracks().length) el.srcObject = stream;
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

/* ── Single video tile ─────────────────────────────────────────────── */
function ParticipantTile({
  participant, isLocal, isDominant, compact, onClick, isSelected, showAvatar = true,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const vTrack = participant?.videoTrack;
  const aTrack = participant?.audioTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !vTrack) return undefined;
    attachTrack(vTrack, el);
    return () => detachTrack(vTrack, el);
  }, [vTrack]);

  useEffect(() => {
    if (isLocal) return undefined;
    const el = audioRef.current;
    if (!el || !aTrack) return undefined;
    attachTrack(aTrack, el);
    return () => detachTrack(aTrack, el);
  }, [aTrack, isLocal]);

  const muted = !!participant?.audioMuted;
  const videoMuted = !!participant?.videoMuted || !vTrack;
  const name = participant?.displayName || (isLocal ? "You" : "Participant");
  const isScreen = !!participant?.isScreen;

  return (
    <Box
      onClick={onClick || undefined}
      sx={{
        position: "relative",
        bgcolor: "#0d1117",
        borderRadius: compact ? 1.5 : 2,
        overflow: "hidden",
        border: isSelected ? "2px solid" : "1px solid",
        borderColor: isSelected ? "primary.main"
          : isDominant ? "primary.main"
          : "rgba(255,255,255,0.08)",
        aspectRatio: isScreen && !compact ? "16/9" : (compact ? "16/10" : "16/9"),
        minHeight: compact ? 80 : 120,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.18s ease",
        background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
        touchAction: onClick ? "manipulation" : "auto",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: "100%", height: "100%",
          objectFit: isScreen ? "contain" : "cover",
          display: videoMuted ? "none" : "block",
          transform: (isLocal && !isScreen) ? "scaleX(-1)" : undefined,
          background: "#000",
        }}
      />
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      {videoMuted && showAvatar && (
        <Stack alignItems="center" justifyContent="center" spacing={1}
          sx={{ position: "absolute", inset: 0 }}>
          <Avatar sx={{
            width: compact ? 40 : 64, height: compact ? 40 : 64,
            bgcolor: isLocal ? "primary.dark" : "secondary.dark",
            fontSize: compact ? 18 : 28,
          }}>
            {(name || "?")[0]?.toUpperCase()}
          </Avatar>
          {!compact && (
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
              Camera off
            </Typography>
          )}
        </Stack>
      )}
      <Stack direction="row" spacing={0.75} alignItems="center"
        sx={{
          position: "absolute", left: 6, bottom: 6,
          px: 1, py: 0.4, borderRadius: 1.5,
          bgcolor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)",
          maxWidth: "calc(100% - 12px)",
        }}>
        {muted && <MicOffIcon sx={{ fontSize: 12, color: "error.light" }} />}
        {isScreen && <PresentToAllIcon sx={{ fontSize: 12, color: "info.light" }} />}
        <Typography variant="caption" noWrap sx={{
          color: "#fff", fontSize: 11, fontWeight: 500,
          maxWidth: compact ? 80 : 160,
        }}>
          {name}{isLocal ? " (you)" : ""}{isScreen ? " · screen" : ""}
        </Typography>
      </Stack>
    </Box>
  );
}

/* ── Main component ────────────────────────────────────────────────── */
export default function JitsiCallModal({
  callConfig,
  onClose,
  title = "Call",
  peerAvatar,
  onModeChange,
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

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Keep parent in sync so MessengerApp can show/hide the message list
  // and place the mini bar under the chat header.
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  /* ── State ────────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(!!callConfig?.config?.startWithVideoMuted);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  // Mobile starts fullscreen so the call is the primary surface (Meet / Telegram).
  // Desktop starts inline inside the chat pane.
  const [mode, setMode] = useState(() => (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches ? "full" : "inline")); // "full" | "inline" | "mini"
  const [railOpen, setRailOpen] = useState(!isMobileView);
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

  const roomKey = callConfig
    ? `${callConfig.domain || ""}|${callConfig.room || ""}`
    : "";

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const flash = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

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
        const roomName = callConfig.room;
        const displayName = callConfig.display_name || callConfig.displayName || "User";
        const startAudioMuted = !!callConfig.config?.startWithAudioMuted;
        const startVideoMuted = !!callConfig.config?.startWithVideoMuted;

        const JitsiMeetJS = await loadLibJitsi(domain);
        if (disposed) return;

        JitsiMeetJS.init({ disableAudioLevels: false, disableSimulcast: false });
        JitsiMeetJS.setLogLevel?.(JitsiMeetJS.logLevels?.ERROR || "error");

        const connection = new JitsiMeetJS.JitsiConnection(null, null, {
          hosts: { domain, muc: `muc.${domain}` },
          serviceUrl: `wss://${domain}/xmpp-websocket`,
          clientNode: "http://jitsi.org/jitsimeet",
        });
        connRef.current = connection;

        await new Promise((resolve, reject) => {
          const onOk = () => {
            connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, onOk);
            resolve();
          };
          const onFail = (err) => {
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
          p2p: { enabled: true },
          enableNoAudioDetection: false,
          enableNoisyMicDetection: false,
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
            setStagedScreenId((cur) => cur || pid);
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
          upsertParticipant(id, { displayName: user?.getDisplayName?.() || "Participant" });
        });
        room.on(JitsiMeetJS.events.conference.USER_LEFT, (id) => {
          removeParticipant(id);
          setStagedScreenId((cur) => (cur === id ? null : cur));
        });
        room.on(JitsiMeetJS.events.conference.DISPLAY_NAME_CHANGED, (id, name) => {
          upsertParticipant(id, { displayName: name });
        });
        room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, () => {
          if (!disposed) setLoading(false);
          try { room.setDisplayName(displayName); } catch { /* */ }
        });
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
        } catch {
          tracks = await JitsiMeetJS.createLocalTracks({ devices: ["audio"] });
        }

        if (disposed) { tracks.forEach((tr) => tr.dispose?.()); return; }

        localTracksRef.current = tracks;
        const localPatch = {
          displayName: "You",
          audioMuted: startAudioMuted,
          videoMuted: startVideoMuted,
          avatar: peerAvatar || null,
        };
        for (const track of tracks) {
          if (startAudioMuted && track.getType() === "audio") {
            try { await track.mute(); } catch { /* */ }
          }
          await room.addTrack(track);
          if (track.getType() === "audio") {
            localPatch.audioTrack = track;
            localPatch.audioMuted = track.isMuted();
            try {
              const ms = new MediaStream([track.getTrack?.()]);
              startMicMeter(ms);
            } catch { /* */ }
          } else {
            localPatch.videoTrack = track;
            localPatch.videoMuted = track.isMuted();
          }
        }
        upsertParticipant("local", localPatch);
        setAudioMuted(!!localPatch.audioMuted);
        setVideoMuted(!!localPatch.videoMuted);

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
        setTimeout(() => { if (!disposed) setLoading(false); }, BOOT_FALLBACK_MS);
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

  useEffect(() => {
    if (!callConfig) return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callConfig]);

  const remoteCount = Object.keys(participants).filter((k) => k !== "local").length;
  useEffect(() => {
    if (loading || error) return undefined;
    if (remoteCount > 0) return undefined;
    const t = setTimeout(() => { hangup(); }, ALONE_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, remoteCount]);

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
      upsertParticipant("local", { isScreen: false });
      setStagedScreenId((cur) => (cur === "local" ? null : cur));
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
      upsertParticipant("local", { videoTrack: desk, videoMuted: false, isScreen: true });
      setStagedScreenId("local");
      desk.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, async () => {
        try { await room.removeTrack(desk); } catch { /* */ }
        localTracksRef.current = localTracksRef.current.filter((t) => t !== desk);
        setSharing(false);
        const cam = localTracksRef.current.find((t) => t.getType?.() === "video");
        upsertParticipant("local", {
          videoTrack: cam || null,
          videoMuted: !cam || cam.isMuted(),
          isScreen: false,
        });
        setStagedScreenId((cur) => (cur === "local" ? null : cur));
      });
    } catch {
      flash("Screen share failed or cancelled");
    }
  }, [flash, upsertParticipant]);

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
    // Desktop: floating PiP card. Mobile: thin strip under header (parent layout).
    if (!isMobileView) {
      const w = typeof window !== "undefined" ? window.innerWidth : 1000;
      const h = typeof window !== "undefined" ? window.innerHeight : 800;
      setMiniPos((prev) => ({
        x: clamp(prev.x, 8, Math.max(8, w - MINI_W - 8)),
        y: clamp(prev.y, 8, Math.max(8, h - MINI_H - 90)),
      }));
    }
    setMode("mini");
    setFullscreen(false);
  }, [isMobileView]);
  const goFull = useCallback(() => {
    setMode(isMobileView ? "full" : "inline");
  }, [isMobileView]);

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

  const others = useMemo(() => list.filter((p) => p !== staged), [list, staged]);
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
    const sz = compact ? 36 : (isSmallView ? 42 : 48);
    return (
      <Stack
        direction="row"
        spacing={compact ? 0.6 : (isSmallView ? 0.7 : 1)}
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

            <Tooltip title="Participants">
              <IconButton onClick={() => setRailOpen((v) => !v)} sx={controlBtnSx(railOpen, false, sz)}
                aria-label="Participants">
                <PeopleIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Minimise">
              <IconButton onClick={goMini} sx={controlBtnSx(false, false, sz)}
                aria-label="Minimise">
                <PictureInPictureAltIcon />
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
              ...controlBtnSx(false, true, compact ? 38 : (isSmallView ? 44 : 52)),
              borderRadius: 3, ml: 0.5, px: compact ? 0.5 : 1.5,
            }}
            aria-label="Hang up">
            <CallEndIcon fontSize={compact ? "small" : "medium"} />
          </IconButton>
        </Tooltip>
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
        <Modal open={deviceSheetOpen} onClose={() => setDeviceSheetOpen(false)}
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
      <Modal open={deviceSheetOpen} onClose={() => setDeviceSheetOpen(false)}
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
    if (isMini) return null;
    return (
      <Box sx={{
        width: isMobileView ? "100%" : 260, flexShrink: 0,
        bgcolor: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)",
        borderLeft: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
        position: isMobileView ? "absolute" : "relative",
        right: 0, top: 0, bottom: 0, zIndex: 3,
        maxWidth: isMobileView ? "85%" : "none",
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
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  /**
   * FULL (mobile): true fullscreen overlay — primary call surface.
   * INLINE (desktop): fills parent flex column inside chat pane.
   * MINI (mobile): thin horizontal strip (Telegram/WhatsApp style) that the
   *   parent places under the chat header — NOT a floating card.
   * MINI (desktop): small floating PiP card, clamped to viewport.
   */
  const isFull = mode === "full";
  const isMobileMini = isMini && isMobileView;
  const isDesktopMini = isMini && !isMobileView;

  let rootSx;
  if (isMobileMini) {
    // Thin bar under header — parent owns placement; we just size ourselves.
    rootSx = {
      flexShrink: 0,
      width: "100%",
      bgcolor: "#0f1419",
      color: "#fff",
      borderBottom: "1px solid rgba(255,255,255,0.08)",
      display: "flex",
      flexDirection: "column",
      userSelect: "none",
      zIndex: 6,
    };
  } else if (isDesktopMini) {
    rootSx = {
      position: "fixed",
      left: miniPos.x, top: miniPos.y,
      width: MINI_W,
      zIndex: 1450,
      borderRadius: 2, overflow: "hidden",
      bgcolor: "#0b0e11", color: "#fff",
      border: "1px solid rgba(255,255,255,0.12)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
      display: "flex", flexDirection: "column",
      userSelect: "none",
    };
  } else if (isFull) {
    // Mobile full-screen call surface
    rootSx = {
      position: "fixed",
      inset: 0,
      zIndex: 1400,
      bgcolor: "#0b0e11", color: "#fff",
      display: "flex", flexDirection: "column",
      background: "radial-gradient(ellipse at top, #161b22 0%, #0b0e11 70%)",
      minWidth: 0,
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
      {/* ── Mobile mini: thin ongoing-call strip (Telegram / WhatsApp) ── */}
      {isMobileMini ? (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            px: 1.25,
            py: 0.75,
            minHeight: 52,
            width: "100%",
            bgcolor: "rgba(15, 20, 25, 0.98)",
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
              {loading ? "Connecting…" : formatElapsed(elapsed)}
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
      <>
      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between"
        onMouseDown={isDesktopMini ? onDragStart : undefined}
        onTouchStart={isDesktopMini ? onDragStart : undefined}
        sx={{
          px: isDesktopMini ? 1 : (isSmallView ? 1.25 : 2),
          py: isDesktopMini ? 0.5 : 1,
          bgcolor: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          cursor: isDesktopMini ? "grab" : "default",
          minHeight: 52, flexShrink: 0,
        }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          {isMini && <DragIndicatorIcon sx={{ fontSize: 16, opacity: 0.5 }} />}
          {peerAvatar ? (
            <Avatar src={peerAvatar} sx={{ width: isMini ? 22 : 34, height: isMini ? 22 : 34 }} />
          ) : (
            <Avatar sx={{ width: isMini ? 22 : 34, height: isMini ? 22 : 34, bgcolor: "primary.main", fontSize: isMini ? 11 : 15 }}>
              {(title || "C")[0]}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant={isMini ? "caption" : "subtitle1"} fontWeight={600} noWrap>
              {title}
            </Typography>
            {!isMini && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                <Chip size="small" icon={<PeopleIcon sx={{ fontSize: 14 }} />} label={count}
                  sx={{ height: 20, fontSize: 11, bgcolor: "rgba(255,255,255,0.08)", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }} />
                <Typography variant="caption" sx={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                  {formatElapsed(elapsed)}
                </Typography>
                {staged && (
                  <Chip size="small" icon={<PresentToAllIcon sx={{ fontSize: 12 }} />} label="Screen share"
                    sx={{ height: 20, fontSize: 10, bgcolor: alpha("#3b82f6", 0.18), color: "#93c5fd" }} />
                )}
              </Stack>
            )}
          </Box>
          {isMini && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: "auto" }}>
              {staged && <PresentToAllIcon sx={{ fontSize: 14, color: "#93c5fd" }} />}
              <Typography variant="caption" sx={{ opacity: 0.7, fontVariantNumeric: "tabular-nums" }}>
                {formatElapsed(elapsed)}
              </Typography>
            </Stack>
          )}
        </Stack>
        <Stack direction="row" spacing={0.25}>
          {isMini ? (
            <IconButton size="small" onClick={goFull}
              sx={{ color: "rgba(255,255,255,0.75)", p: 0.4 }}
              aria-label="Expand">
              <OpenInFullIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            <Tooltip title="Minimise — keep chatting">
              <IconButton onClick={goMini} size="small"
                sx={{ color: "rgba(255,255,255,0.8)" }} aria-label="Minimise">
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={hangup} size="small"
            sx={{ color: "rgba(255,255,255,0.7)", p: isMini ? 0.4 : undefined }}
            aria-label="Close">
            <CloseIcon sx={{ fontSize: isMini ? 16 : 20 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Stage + side rail */}
      <Box sx={{
        flex: 1, display: "flex",
        flexDirection: isMini ? "column" : "row",
        minHeight: 0, overflow: "hidden", position: "relative",
      }}>
        {/* Main video stage */}
        <Box sx={{
          position: "relative",
          flex: isMini ? "none" : 1,
          height: isMini ? MINI_H : "auto",
          minHeight: isMini ? MINI_H : 0,
          bgcolor: "#000",
          p: isMini ? 0.5 : (isSmallView ? 1 : 1.5),
          overflow: "auto",
          display: "flex", flexDirection: "column",
        }}>
          {!isMini && (
            <>
              {staged ? (
                <Box sx={{ mb: 1.5, flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <ParticipantTile participant={staged} isLocal={staged.id === "local"}
                    isDominant compact={false} />
                  {screenShares.length > 1 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, overflowX: "auto", pb: 0.5 }}>
                      {screenShares.map((p) => (
                        <Box key={p.id} onClick={() => setStagedScreenId(p.id)}
                          sx={{
                            flex: "0 0 160px", cursor: "pointer",
                            borderRadius: 1.5, overflow: "hidden",
                            border: staged?.id === p.id ? "2px solid" : "1px solid",
                            borderColor: staged?.id === p.id ? "primary.main" : "rgba(255,255,255,0.08)",
                          }}>
                          <ParticipantTile participant={p} isLocal={p.id === "local"} compact showAvatar={false} />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              ) : null}

              <Box sx={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gap: 1,
                flex: staged ? "0 0 auto" : "1 1 auto",
                alignContent: staged ? "start" : "stretch",
              }}>
                {others.map((p) => (
                  <ParticipantTile key={p.id} participant={p} isLocal={p.id === "local"}
                    isDominant={false} compact={false} />
                ))}
                {!staged && list.length === 0 && !loading && (
                  <Stack alignItems="center" justifyContent="center"
                    sx={{ gridColumn: "1 / -1", minHeight: 200 }}>
                    <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.dark", mb: 2, fontSize: 32 }}>
                      {(title || "C")[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ opacity: 0.7, mb: 0.5 }}>Waiting for others…</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.5 }}>
                      The call will end in {Math.floor(ALONE_TIMEOUT_MS / 1000)}s if no one joins
                    </Typography>
                  </Stack>
                )}
              </Box>
            </>
          )}

          {isMini && (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(staged || list[0]) && (
                <ParticipantTile participant={staged || list[0]}
                  isLocal={(staged || list[0])?.id === "local"} compact />
              )}
            </Box>
          )}

          {loading && (
            <Stack alignItems="center" justifyContent="center" spacing={1.5}
              sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.85)",
                zIndex: 2, backdropFilter: "blur(4px)" }}>
              <CircularProgress size={isMini ? 28 : 44} color="primary" />
              {!isMini && <Typography variant="body2" sx={{ opacity: 0.85 }}>Connecting…</Typography>}
            </Stack>
          )}
          {error && (
            <Stack alignItems="center" justifyContent="center" spacing={1}
              sx={{ position: "absolute", inset: 0, zIndex: 2, p: 2 }}>
              <Typography color="error" textAlign="center">{error}</Typography>
              <IconButton onClick={hangup} color="error"><CallEndIcon /></IconButton>
            </Stack>
          )}
        </Box>

        {!isMini && railOpen && renderRail()}
      </Box>

      {/* Controls */}
      <Paper elevation={0} sx={{
        py: isMini ? 0.6 : (isSmallView ? 1 : 1.25),
        px: 1,
        bgcolor: "rgba(0,0,0,0.7)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        {renderControls(isMini)}
      </Paper>

      {/* Device selection sheet */}
      {renderDeviceSheet()}

      {/* Toast */}
      {toast && (
        <Box sx={{
          position: "absolute",
          bottom: 80, left: "50%",
          transform: "translateX(-50%)",
          bgcolor: "rgba(0,0,0,0.85)", color: "#fff",
          px: 2, py: 1, borderRadius: 2, fontSize: 13,
          zIndex: 10, maxWidth: "80%", textAlign: "center",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          {toast}
        </Box>
      )}
      </>
      )}
    </Box>
  );
}
