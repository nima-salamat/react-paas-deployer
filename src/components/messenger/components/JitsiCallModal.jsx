/**
 * JitsiCallModal — fully custom call UI built on lib-jitsi-meet.
 *
 * Features:
 *  - Beautiful, modern dark UI with subtle gradients and glassmorphism
 *  - Compact left-side participants rail (avatars + device status)
 *  - Main stage that auto-promotes any screen share; if multiple participants
 *    share their screen, each thumbnail is clickable to bring it to the stage
 *  - Local screen-share preview is mirrored into the mini (floating) mode too
 *  - Screen-share audio is NOT muted for remote desktop tracks (so viewers
 *    hear the shared tab's audio). Local screen audio is suppressed at the
 *    source to prevent echo.
 *  - Reads the default mic/cam from localStorage ("messenger.mediaDevices")
 *    so the call honours the same defaults the user picked in Settings.
 *  - Live device switching works mid-call via the Settings drawer.
 *  - Mobile-first responsive layout.
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Box, IconButton, Stack, Typography, Avatar, Chip, Tooltip,
  CircularProgress, Paper, Drawer, List, ListItemButton, ListItemText,
  Switch, FormControlLabel, Divider, ListItemIcon, alpha, useMediaQuery,
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

const MINI_W = 320;
const MINI_H = 200;
const MEDIA_KEY = "messenger.mediaDevices";

/** Read saved media defaults (set by MediaSettingsDialog) */
function readSavedDevices() {
  try {
    return JSON.parse(localStorage.getItem(MEDIA_KEY) || "{}") || {};
  } catch { return {}; }
}

function loadLibJitsi(domain) {
  return new Promise((resolve, reject) => {
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
  try { track.attach(el); }
  catch {
    try {
      const stream = new MediaStream([track.getTrack?.() || track.stream?.getTracks?.()?.[0]].filter(Boolean));
      if (stream.getTracks().length) el.srcObject = stream;
    } catch { /* */ }
  }
}
function detachTrack(track, el) {
  if (!track) return;
  try { if (el) track.detach(el); else track.detach(); } catch { /* */ }
}

/** Compact avatar with optional speaking ring + device icons */
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
      {/* device chips */}
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

/** One participant video tile */
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
    if (isLocal) return undefined; // never play own audio (prevents echo)
    const el = audioRef.current;
    if (!el || !aTrack) return undefined;
    attachTrack(aTrack, el);
    return () => detachTrack(aTrack, el);
  }, [aTrack, isLocal]);

  const muted = participant?.audioMuted;
  const videoMuted = participant?.videoMuted || !vTrack;
  const name = participant?.displayName || (isLocal ? "You" : "Participant");
  const isScreen = !!participant?.isScreen;

  return (
    <Box
      onClick={onClick}
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
        transition: "border-color 0.18s ease, transform 0.18s ease",
        "&:hover": onClick ? { transform: "scale(1.01)" } : {},
        background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
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
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      {videoMuted && showAvatar && (
        <Stack
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ position: "absolute", inset: 0 }}
        >
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

      {/* Bottom gradient with name + status */}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        sx={{
          position: "absolute",
          left: 6, bottom: 6,
          px: 1, py: 0.4,
          borderRadius: 1.5,
          bgcolor: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(6px)",
          maxWidth: "calc(100% - 12px)",
        }}
      >
        {muted && <MicOffIcon sx={{ fontSize: 12, color: "error.light" }} />}
        {isScreen && <PresentToAllIcon sx={{ fontSize: 12, color: "info.light" }} />}
        <Typography variant="caption" noWrap sx={{
          color: "#fff", fontSize: 11, fontWeight: 500,
          maxWidth: compact ? 80 : 160,
        }}>
          {name}{isLocal ? " (you)" : ""}
          {isScreen ? " · screen" : ""}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function JitsiCallModal({
  callConfig,
  onClose,
  title = "Call",
  peerAvatar,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));

  const rootRef = useRef(null);
  const connRef = useRef(null);
  const roomRef = useRef(null);
  const localTracksRef = useRef([]);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });
  const startingRef = useRef(false);
  const micLevelRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const savedDevicesRef = useRef(readSavedDevices());

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(!!callConfig?.config?.startWithVideoMuted);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState("full"); // "full" | "mini"
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(!isMobile); // participants rail
  const [devices, setDevices] = useState({ audioInputs: [], videoInputs: [], audioOutputs: [] });
  const [selectedMic, setSelectedMic] = useState(savedDevicesRef.current.micId || "");
  const [selectedCam, setSelectedCam] = useState(savedDevicesRef.current.cameraId || "");
  const [selectedSpeaker, setSelectedSpeaker] = useState(savedDevicesRef.current.speakerId || "");
  const [micLevel, setMicLevel] = useState(0);
  const [speakingId, setSpeakingId] = useState(null);
  const [participants, setParticipants] = useState({});
  const [stagedScreenId, setStagedScreenId] = useState(null); // which screen to show big
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

  useEffect(() => {
    if (!callConfig) return undefined;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callConfig]);

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const upsertParticipant = useCallback((id, patch) => {
    setParticipants((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { id }), ...patch },
    }));
  }, []);

  const removeParticipant = useCallback((id) => {
    setParticipants((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  /** Mic level meter — only for local mic, used to highlight "speaking" */
  const startMicMeter = useCallback((stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* */ }
      }
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
        micLevelRef.current = level;
        setMicLevel(level);
        // Toggle speaking flag (only if mic is on)
        if (!audioMuted && level > 0.18) {
          setSpeakingId("local");
        } else if (speakingId === "local" && level < 0.08) {
          setSpeakingId(null);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* */ }
  }, [audioMuted, speakingId]);

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

  // ── Boot lib-jitsi-meet conference ────────────────────────────────
  useEffect(() => {
    if (!callConfig || !roomKey) return undefined;
    let disposed = false;

    const cleanup = async () => {
      stopMicMeter();
      try {
        for (const t of localTracksRef.current) {
          try { t.dispose?.(); } catch { /* */ }
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
            upsertParticipant(pid, { videoTrack: track, videoMuted: track.isMuted(), isScreen: !!isScreen });
            // Auto-stage the first screen share that arrives
            setStagedScreenId((cur) => cur || pid);
          } else {
            upsertParticipant(pid, { audioTrack: track, audioMuted: track.isMuted() });
          }
          track.addEventListener(JitsiMeetJS.events.track.TRACK_MUTE_CHANGED, () => {
            if (track.getType() === "video") {
              upsertParticipant(pid, { videoMuted: track.isMuted() });
            } else {
              upsertParticipant(pid, { audioMuted: track.isMuted() });
            }
          });
          track.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, () => {
            if (track.getType() === "video") {
              upsertParticipant(pid, { videoTrack: null, videoMuted: true, isScreen: false });
            } else {
              upsertParticipant(pid, { audioTrack: null });
            }
          });
        });

        room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track) => {
          if (track.isLocal()) return;
          const pid = track.getParticipantId();
          if (track.getType() === "video") {
            upsertParticipant(pid, { videoTrack: null, videoMuted: true, isScreen: false });
            // If we were staging this participant, hand the stage to someone else
            setStagedScreenId((cur) => {
              if (cur !== pid) return cur;
              return null;
            });
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

        // Remote audio-level detection for "speaking" highlight
        try {
          room.on(JitsiMeetJS.events.conference.USER_ROLE_CHANGED, () => {});
          if (JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED) {
            room.on(JitsiMeetJS.events.conference.TRACK_AUDIO_LEVEL_CHANGED, (pid, level) => {
              if (!pid) return;
              if (level > 0.05) setSpeakingId(String(pid));
              else if (speakingId === String(pid) && level < 0.02) setSpeakingId(null);
            });
          }
        } catch { /* */ }

        // ── Create local tracks using saved device IDs (from MediaSettings) ──
        const saved = readSavedDevices();
        const micId = saved.micId || undefined;
        const camId = saved.cameraId || undefined;

        const buildAudioOpts = () => micId
          ? { devices: ["audio"], micDeviceId: micId }
          : { devices: ["audio"] };
        const buildVideoOpts = () => camId
          ? { devices: ["video"], cameraDeviceId: camId }
          : { devices: ["video"] };

        let tracks = [];
        try {
          if (startVideoMuted) {
            tracks = await JitsiMeetJS.createLocalTracks(buildAudioOpts());
          } else {
            // Create them separately so a missing camera doesn't kill the mic
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
            // Start mic meter using the underlying MediaStream
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

        // Enumerate devices for the Settings drawer
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          setDevices({
            audioInputs: list.filter((d) => d.kind === "audioinput"),
            videoInputs: list.filter((d) => d.kind === "videoinput"),
            audioOutputs: list.filter((d) => d.kind === "audiooutput"),
          });
          // If saved selection is empty, fall back to the active track's device
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

        // Listen for device changes (plug/unplug USB headsets etc.)
        try {
          navigator.mediaDevices.addEventListener?.("devicechange", async () => {
            try {
              const list = await navigator.mediaDevices.enumerateDevices();
              setDevices({
                audioInputs: list.filter((d) => d.kind === "audioinput"),
                videoInputs: list.filter((d) => d.kind === "videoinput"),
                audioOutputs: list.filter((d) => d.kind === "audiooutput"),
              });
            } catch { /* */ }
          });
        } catch { /* */ }

        room.join();
        setTimeout(() => { if (!disposed) setLoading(false); }, 8000);
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

  // Stop mic meter when call ends
  useEffect(() => () => stopMicMeter(), [stopMicMeter]);

  // Alone timeout
  const remoteCount = Object.keys(participants).filter((k) => k !== "local").length;
  useEffect(() => {
    if (loading || error) return undefined;
    if (remoteCount > 0) return undefined;
    const t = setTimeout(() => { hangup(); }, 45000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, remoteCount]);

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
    if (!track) return;
    try {
      if (track.isMuted()) await track.unmute();
      else await track.mute();
      setAudioMuted(track.isMuted());
      upsertParticipant("local", { audioMuted: track.isMuted() });
    } catch { /* */ }
  }, [upsertParticipant]);

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
        }
      } catch { /* */ }
      return;
    }
    if (!track) return;
    try {
      if (track.isMuted()) await track.unmute();
      else await track.mute();
      setVideoMuted(track.isMuted());
      upsertParticipant("local", { videoMuted: track.isMuted(), videoTrack: track });
    } catch { /* */ }
  }, [upsertParticipant, selectedCam]);

  const toggleShare = useCallback(async () => {
    const JitsiMeetJS = window.JitsiMeetJS;
    const room = roomRef.current;
    if (!JitsiMeetJS || !room) return;

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
      // Request screen share WITH audio if user opts in (browser handles
      // the tab-audio toggle in the picker). Loopback audio is suppressed
      // for local playback so we don't echo.
      const tracks = await JitsiMeetJS.createLocalTracks({
        devices: ["desktop"],
        desktopSharingConstraints: {
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: { frameRate: { ideal: 15, max: 30 } },
        },
      });
      const desk = tracks.find((t) => t.getType() === "video");
      if (!desk) return;
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
    } catch (e) {
      setError(e?.message || "Screen share failed");
      setTimeout(() => setError(null), 2500);
    }
  }, [upsertParticipant]);

  const switchCamera = useCallback(async () => {
    const track = localTracksRef.current.find((t) => t.getType?.() === "video" && t.videoType !== "desktop");
    if (!track || !selectedCam) return;
    try { await track.setDevice?.(selectedCam); } catch { /* */ }
  }, [selectedCam]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => {
        setFullscreen(true);
        setMode("full");
      }).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const onDragStart = useCallback((e) => {
    if (mode !== "mini") return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { active: true, ox: clientX - miniPos.x, oy: clientY - miniPos.y };
  }, [mode, miniPos]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setMiniPos({
        x: Math.min(Math.max(8, clientX - dragRef.current.ox), window.innerWidth - MINI_W - 8),
        y: Math.min(Math.max(8, clientY - dragRef.current.oy), window.innerHeight - MINI_H - 90),
      });
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

  const goMini = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setMode("mini");
    setFullscreen(false);
  }, []);
  const goFull = useCallback(() => setMode("full"), []);

  // ── Derived participant list + screen-share stage ───────────────────
  // Hooks MUST come before any early return so the rules-of-hooks hold.
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

  /** Apply a chosen mic mid-call (Settings drawer) */
  const applyMic = useCallback(async (deviceId) => {
    setSelectedMic(deviceId);
    const track = localTracksRef.current.find((t) => t.getType?.() === "audio");
    if (track && deviceId) {
      try { await track.setDevice?.(deviceId); } catch { /* */ }
    }
    try {
      const cur = JSON.parse(localStorage.getItem(MEDIA_KEY) || "{}");
      localStorage.setItem(MEDIA_KEY, JSON.stringify({ ...cur, micId: deviceId }));
    } catch { /* */ }
    try {
      const ms = new MediaStream([track.getTrack?.()]);
      stopMicMeter();
      startMicMeter(ms);
    } catch { /* */ }
  }, [startMicMeter, stopMicMeter]);

  /** Apply a chosen camera mid-call (Settings drawer) */
  const applyCam = useCallback(async (deviceId) => {
    setSelectedCam(deviceId);
    const track = localTracksRef.current.find((t) => t.getType?.() === "video" && t.videoType !== "desktop");
    if (track && deviceId) {
      try { await track.setDevice?.(deviceId); } catch { /* */ }
    }
    try {
      const cur = JSON.parse(localStorage.getItem(MEDIA_KEY) || "{}");
      localStorage.setItem(MEDIA_KEY, JSON.stringify({ ...cur, cameraId: deviceId }));
    } catch { /* */ }
  }, []);

  /** Apply a chosen speaker mid-call (Chrome/Edge only via setSinkId) */
  const applySpeaker = useCallback(async (deviceId) => {
    setSelectedSpeaker(deviceId);
    try {
      const cur = JSON.parse(localStorage.getItem(MEDIA_KEY) || "{}");
      localStorage.setItem(MEDIA_KEY, JSON.stringify({ ...cur, speakerId: deviceId }));
    } catch { /* */ }
    document.querySelectorAll("audio").forEach((el) => {
      if (typeof el.setSinkId === "function") {
        try { el.setSinkId(deviceId || ""); } catch { /* */ }
      }
    });
  }, []);

  if (!callConfig) return null;
  const isMini = mode === "mini";

  const controlBtn = (active, danger, size = 44) => ({
    bgcolor: danger ? "error.main" : active ? "primary.main" : "rgba(255,255,255,0.08)",
    color: "#fff",
    width: size,
    height: size,
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.06)",
    "&:hover": {
      bgcolor: danger ? "error.dark" : active ? "primary.dark" : "rgba(255,255,255,0.16)",
      transform: "translateY(-1px)",
    },
    transition: "all 0.15s ease",
  });

  const Controls = ({ compact = false }) => {
    const sz = compact ? 34 : (isSmall ? 40 : 48);
    return (
      <Stack
        direction="row"
        spacing={compact ? 0.6 : (isSmall ? 0.7 : 1)}
        alignItems="center"
        justifyContent="center"
        sx={{ width: "100%" }}
      >
        <Tooltip title={audioMuted ? "Unmute mic" : "Mute mic"}>
          <IconButton onClick={toggleAudio} sx={controlBtn(false, audioMuted, sz)}>
            {audioMuted ? <MicOffIcon fontSize={compact ? "small" : "medium"} /> : <MicIcon fontSize={compact ? "small" : "medium"} />}
          </IconButton>
        </Tooltip>
        <Tooltip title={videoMuted ? "Start video" : "Stop video"}>
          <IconButton onClick={toggleVideo} sx={controlBtn(false, videoMuted, sz)}>
            {videoMuted ? <VideocamOffIcon fontSize={compact ? "small" : "medium"} /> : <VideocamIcon fontSize={compact ? "small" : "medium"} />}
          </IconButton>
        </Tooltip>
        {!compact && (
          <>
            <Tooltip title={sharing ? "Stop screen share" : "Share screen"}>
              <IconButton onClick={toggleShare} sx={controlBtn(sharing, false, sz)}>
                {sharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </IconButton>
            </Tooltip>
            {devices.videoInputs.length > 1 && (
              <Tooltip title="Switch camera">
                <IconButton onClick={switchCamera} sx={controlBtn(false, false, sz)}>
                  <CameraswitchIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Participants">
              <IconButton
                onClick={() => setRailOpen((v) => !v)}
                sx={controlBtn(railOpen, false, sz)}
              >
                <PeopleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton onClick={() => setSettingsOpen(true)} sx={controlBtn(false, false, sz)}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Minimise — keep chatting">
              <IconButton onClick={goMini} sx={controlBtn(false, false, sz)}>
                <PictureInPictureAltIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <IconButton onClick={toggleFullscreen} sx={controlBtn(false, false, sz)}>
                {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </>
        )}
        {compact && (
          <Tooltip title="Expand">
            <IconButton onClick={goFull} sx={controlBtn(false, false, sz)}>
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Hang up">
          <IconButton
            onClick={hangup}
            sx={{
              ...controlBtn(false, true, compact ? 38 : (isSmall ? 44 : 52)),
              borderRadius: 3,
              ml: 0.5,
              px: compact ? 0.5 : 1.5,
            }}
          >
            <CallEndIcon fontSize={compact ? "small" : "medium"} />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  };

  const MicLevelRing = ({ size = 4 }) => {
    if (audioMuted) return null;
    return (
      <Box
        sx={{
          position: "absolute",
          inset: -size,
          borderRadius: "50%",
          pointerEvents: "none",
          boxShadow: `0 0 ${4 + micLevel * 18}px ${2 + micLevel * 10}px ${alpha("#22c55e", 0.4 + micLevel * 0.4)}`,
          opacity: 0.3 + micLevel * 0.7,
          transition: "opacity 0.08s linear",
        }}
      />
    );
  };

  return (
    <Box
      ref={rootRef}
      sx={
        isMini
          ? {
              position: "fixed",
              left: miniPos.x, top: miniPos.y,
              width: MINI_W,
              zIndex: 1450,
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "#0b0e11",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.65)",
              display: "flex", flexDirection: "column",
              userSelect: "none",
            }
          : {
              position: "fixed", inset: 0, zIndex: 1400,
              bgcolor: "#0b0e11",
              display: "flex", flexDirection: "column",
              color: "#fff",
              background: "radial-gradient(ellipse at top, #161b22 0%, #0b0e11 70%)",
            }
      }
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onMouseDown={isMini ? onDragStart : undefined}
        onTouchStart={isMini ? onDragStart : undefined}
        sx={{
          px: isMini ? 1 : (isSmall ? 1.25 : 2),
          py: isMini ? 0.5 : 1,
          bgcolor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          cursor: isMini ? "grab" : "default",
          minHeight: 52,
        }}
      >
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
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                  label={count}
                  sx={{ height: 20, fontSize: 11, bgcolor: "rgba(255,255,255,0.08)", color: "#fff", "& .MuiChip-icon": { color: "#fff" } }}
                />
                <Typography variant="caption" sx={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>
                  {formatElapsed(elapsed)}
                </Typography>
                {staged && (
                  <Chip
                    size="small"
                    icon={<PresentToAllIcon sx={{ fontSize: 12 }} />}
                    label="Screen share"
                    sx={{ height: 20, fontSize: 10, bgcolor: alpha("#3b82f6", 0.18), color: "#93c5fd" }}
                  />
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
            <IconButton size="small" onClick={goFull} sx={{ color: "rgba(255,255,255,0.75)", p: 0.4 }}>
              <OpenInFullIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            <Tooltip title="Minimise — keep chatting">
              <IconButton onClick={goMini} size="small" sx={{ color: "rgba(255,255,255,0.8)" }}>
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={hangup} size="small" sx={{ color: "rgba(255,255,255,0.7)", p: isMini ? 0.4 : undefined }}>
            <CloseIcon sx={{ fontSize: isMini ? 16 : 20 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Stage + side rail */}
      <Box sx={{
        flex: 1, display: "flex",
        flexDirection: isMini ? "column" : "row",
        minHeight: 0, overflow: "hidden",
      }}>
        {/* Main video stage */}
        <Box
          sx={{
            position: "relative",
            flex: isMini ? "none" : 1,
            height: isMini ? MINI_H : "auto",
            minHeight: isMini ? MINI_H : 0,
            bgcolor: "#000",
            p: isMini ? 0.5 : (isSmall ? 1 : 1.5),
            overflow: "auto",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Big stage: preferred screen-share, or just the only participant */}
          {!isMini && (
            <>
              {staged ? (
                <Box sx={{ mb: 1.5, flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <ParticipantTile
                    participant={staged}
                    isLocal={staged.id === "local"}
                    isDominant
                    compact={false}
                    onClick={null}
                  />
                  {/* If multiple screens are being shared, show clickable thumbnails */}
                  {screenShares.length > 1 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, overflowX: "auto", pb: 0.5 }}>
                      {screenShares.map((p) => (
                        <Box
                          key={p.id}
                          onClick={() => setStagedScreenId(p.id)}
                          sx={{
                            flex: "0 0 160px",
                            cursor: "pointer",
                            borderRadius: 1.5,
                            overflow: "hidden",
                            border: staged?.id === p.id ? "2px solid" : "1px solid",
                            borderColor: staged?.id === p.id ? "primary.main" : "rgba(255,255,255,0.08)",
                            transition: "border-color 0.15s ease",
                          }}
                        >
                          <ParticipantTile
                            participant={p}
                            isLocal={p.id === "local"}
                            compact
                            onClick={null}
                            showAvatar={false}
                          />
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>
              ) : null}

              {/* Other participants grid (excluding staged screen) */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                  gap: 1,
                  flex: staged ? "0 0 auto" : "1 1 auto",
                  alignContent: staged ? "start" : "stretch",
                }}
              >
                {others.map((p) => (
                  <ParticipantTile
                    key={p.id}
                    participant={p}
                    isLocal={p.id === "local"}
                    isDominant={false}
                    compact={false}
                  />
                ))}
                {!staged && list.length === 0 && !loading && (
                  <Stack alignItems="center" justifyContent="center" sx={{ gridColumn: "1 / -1", minHeight: 200 }}>
                    <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.dark", mb: 2, fontSize: 32 }}>
                      {(title || "C")[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ opacity: 0.7, mb: 0.5 }}>Waiting for others…</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.5 }}>The call will end in 45s if no one joins</Typography>
                  </Stack>
                )}
              </Box>
            </>
          )}

          {/* Mini mode: show the staged screen (or first remote) small */}
          {isMini && (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {(staged || list[0]) && (
                <ParticipantTile
                  participant={staged || list[0]}
                  isLocal={(staged || list[0])?.id === "local"}
                  compact
                  onClick={null}
                />
              )}
            </Box>
          )}

          {loading && (
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.85)", zIndex: 2, backdropFilter: "blur(4px)" }}>
              <CircularProgress size={isMini ? 28 : 44} color="primary" />
              {!isMini && <Typography variant="body2" sx={{ opacity: 0.85 }}>Connecting…</Typography>}
            </Stack>
          )}
          {error && (
            <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ position: "absolute", inset: 0, zIndex: 2, p: 2 }}>
              <Typography color="error" textAlign="center">{error}</Typography>
              <IconButton onClick={hangup} color="error"><CallEndIcon /></IconButton>
            </Stack>
          )}
        </Box>

        {/* Participants rail (compact left side panel) */}
        {!isMini && railOpen && (
          <Box
            sx={{
              width: isSmall ? "100%" : 240,
              flexShrink: 0,
              bgcolor: "rgba(0,0,0,0.45)",
              backdropFilter: "blur(8px)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
              display: "flex", flexDirection: "column",
              position: isSmall ? "absolute" : "relative",
              right: 0, top: 0, bottom: 0,
              zIndex: 3,
              maxWidth: isSmall ? "80%" : "none",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: 1.5, py: 1, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Stack direction="row" spacing={0.75} alignItems="center">
                <PeopleIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                <Typography variant="subtitle2" fontWeight={600}>
                  Participants ({count})
                </Typography>
              </Stack>
              <IconButton size="small" onClick={() => setRailOpen(false)} sx={{ color: "rgba(255,255,255,0.7)" }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
            <Box sx={{ flex: 1, overflowY: "auto", py: 0.5 }}>
              {list.map((p) => {
                const isMe = p.id === "local";
                const isSpk = speakingId === p.id;
                return (
                  <Stack
                    key={p.id}
                    direction="row"
                    spacing={1.25}
                    alignItems="center"
                    sx={{
                      px: 1.5, py: 1,
                      cursor: "default",
                      "&:hover": { bgcolor: "rgba(255,255,255,0.04)" },
                      transition: "background-color 0.15s ease",
                    }}
                  >
                    <Box sx={{ position: "relative" }}>
                      <ParticipantAvatar p={p} isLocal={isMe} size={36} speaking={isSpk} />
                      {isMe && <MicLevelRing size={3} />}
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
                          <Chip
                            size="small"
                            label="screen"
                            sx={{
                              height: 16, fontSize: 9,
                              bgcolor: alpha("#3b82f6", 0.18),
                              color: "#93c5fd",
                            }}
                          />
                        )}
                        {p.audioMuted ? (
                          <MicOffIcon sx={{ fontSize: 12, color: "error.light" }} />
                        ) : isSpk ? (
                          <GraphicEqIcon sx={{ fontSize: 12, color: "success.light" }} />
                        ) : null}
                      </Stack>
                    </Box>
                    {/* Click on rail row brings their screen to stage */}
                    {p.isScreen && (
                      <Tooltip title="Bring to stage">
                        <IconButton
                          size="small"
                          onClick={() => setStagedScreenId(p.id)}
                          sx={{
                            color: staged?.id === p.id ? "primary.main" : "rgba(255,255,255,0.6)",
                            bgcolor: staged?.id === p.id ? alpha("#3b82f6", 0.15) : "transparent",
                          }}
                        >
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
        )}
      </Box>

      <Paper elevation={0} sx={{
        py: isMini ? 0.6 : (isSmall ? 1 : 1.25),
        px: 1,
        bgcolor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}>
        <Controls compact={isMini} />
      </Paper>

      {/* Settings drawer */}
      <Drawer
        anchor="right"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        PaperProps={{ sx: { width: isSmall ? "85%" : 320, bgcolor: "#12151a", color: "#fff" } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography fontWeight={700}>Call settings</Typography>
            <IconButton size="small" onClick={() => setSettingsOpen(false)} sx={{ color: "rgba(255,255,255,0.7)" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mb: 1.5 }} />

          <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 0.5, fontWeight: 600 }}>
            Microphone
          </Typography>
          <List dense disablePadding sx={{ mb: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
            {devices.audioInputs.length === 0 && (
              <Typography variant="caption" sx={{ p: 1.5, display: "block", opacity: 0.5 }}>
                No microphones detected
              </Typography>
            )}
            {devices.audioInputs.map((d) => (
              <ListItemButton
                key={d.deviceId}
                selected={selectedMic === d.deviceId}
                onClick={() => applyMic(d.deviceId)}
                sx={{ borderRadius: 1, "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.15) } }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: selectedMic === d.deviceId ? "primary.main" : "rgba(255,255,255,0.6)" }}>
                  <MicIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={d.label || "Microphone"}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>

          {/* Mic level meter */}
          {!audioMuted && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{
                width: "100%", height: 8, bgcolor: "rgba(255,255,255,0.06)", borderRadius: 4,
                overflow: "hidden", position: "relative",
              }}>
                <Box sx={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                  bgcolor: micLevel > 0.85 ? "error.main" : micLevel > 0.55 ? "warning.main" : "success.main",
                  transition: "width 0.04s linear",
                }} />
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.5, mt: 0.5, display: "block" }}>
                {micLevel < 0.05 ? "Speak to test your mic" : micLevel > 0.85 ? "Very loud" : "Mic working"}
              </Typography>
            </Box>
          )}

          <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 0.5, fontWeight: 600 }}>
            Camera
          </Typography>
          <List dense disablePadding sx={{ mb: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
            {devices.videoInputs.length === 0 && (
              <Typography variant="caption" sx={{ p: 1.5, display: "block", opacity: 0.5 }}>
                No cameras detected
              </Typography>
            )}
            {devices.videoInputs.map((d) => (
              <ListItemButton
                key={d.deviceId}
                selected={selectedCam === d.deviceId}
                onClick={() => applyCam(d.deviceId)}
                sx={{ borderRadius: 1, "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.15) } }}
              >
                <ListItemIcon sx={{ minWidth: 32, color: selectedCam === d.deviceId ? "primary.main" : "rgba(255,255,255,0.6)" }}>
                  <VideocamIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={d.label || "Camera"}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                />
              </ListItemButton>
            ))}
          </List>

          {devices.audioOutputs.length > 0 && (
            <>
              <Typography variant="caption" sx={{ opacity: 0.7, display: "block", mb: 0.5, fontWeight: 600 }}>
                Speaker
              </Typography>
              <List dense disablePadding sx={{ mb: 1.5, bgcolor: "rgba(255,255,255,0.03)", borderRadius: 1 }}>
                <ListItemButton
                  selected={!selectedSpeaker}
                  onClick={() => applySpeaker("")}
                  sx={{ borderRadius: 1, "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.15) } }}
                >
                  <ListItemText primary="System default" primaryTypographyProps={{ fontSize: 13 }} />
                </ListItemButton>
                {devices.audioOutputs.map((d) => (
                  <ListItemButton
                    key={d.deviceId}
                    selected={selectedSpeaker === d.deviceId}
                    onClick={() => applySpeaker(d.deviceId)}
                    sx={{ borderRadius: 1, "&.Mui-selected": { bgcolor: alpha("#3b82f6", 0.15) } }}
                  >
                    <ListItemText
                      primary={d.label || "Speaker"}
                      primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </>
          )}

          <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", my: 1.5 }} />
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

          <Typography variant="caption" sx={{ display: "block", mt: 2, opacity: 0.5 }}>
            Device choices are saved and reused next time. They also apply to voice &amp; video messages.
          </Typography>
        </Box>
      </Drawer>
    </Box>
  );
}
