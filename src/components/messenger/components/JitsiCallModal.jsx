/**
 * Professional Jitsi Meet call UI (Telegram / Element / Meet style).
 * Uses the official Jitsi Meet External API (iframe) — only Jitsi call system.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box, IconButton, Stack, Typography, Avatar, Chip, Tooltip,
  CircularProgress, Fade, Paper,
} from "@mui/material";
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

const JITSI_SCRIPT_CDN = "https://cdn.jsdelivr.net/npm/@jitsi/external-api@2.0.1/index.min.js";

function scriptForDomain(domain) {
  return `https://${domain}/external_api.js`;
}

function loadJitsiScript(domain) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve(window.JitsiMeetExternalAPI);
      return;
    }
    const tryUrls = [scriptForDomain(domain), JITSI_SCRIPT_CDN];
    let i = 0;
    const tryNext = () => {
      if (i >= tryUrls.length) {
        reject(new Error("Failed to load Jitsi Meet External API"));
        return;
      }
      const s = document.createElement("script");
      s.src = tryUrls[i++];
      s.async = true;
      s.onload = () => {
        if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
        else tryNext();
      };
      s.onerror = () => tryNext();
      document.body.appendChild(s);
    };
    tryNext();
  });
}

export default function JitsiCallModal({
  callConfig,
  onClose,
  title = "Call",
  peerAvatar,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const rootRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [elapsed, setElapsed] = useState(0);

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

  useEffect(() => {
    if (!callConfig || !containerRef.current) return undefined;
    let disposed = false;
    let api = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const JitsiMeetExternalAPI = await loadJitsiScript(callConfig.domain);
        if (disposed) return;

        const opts = {
          roomName: callConfig.room,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName: callConfig.display_name || "User",
          },
          configOverwrite: {
            ...(callConfig.config || {}),
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: callConfig.config?.startWithAudioMuted ?? false,
            startWithVideoMuted: callConfig.config?.startWithVideoMuted ?? false,
          },
          interfaceConfigOverwrite: {
            ...(callConfig.interface_config || {}),
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            TOOLBAR_ALWAYS_VISIBLE: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            TOOLBAR_BUTTONS: [],
          },
        };

        api = new JitsiMeetExternalAPI(callConfig.domain, opts);
        apiRef.current = api;

        api.addListener("videoConferenceJoined", () => {
          if (!disposed) setLoading(false);
        });
        api.addListener("audioMuteStatusChanged", ({ muted }) => {
          if (!disposed) setAudioMuted(!!muted);
        });
        api.addListener("videoMuteStatusChanged", ({ muted }) => {
          if (!disposed) setVideoMuted(!!muted);
        });
        api.addListener("screenSharingStatusChanged", ({ on }) => {
          if (!disposed) setSharing(!!on);
        });
        api.addListener("participantJoined", () => {
          try {
            setParticipantCount(api.getNumberOfParticipants());
          } catch { /* */ }
        });
        api.addListener("participantLeft", () => {
          try {
            setParticipantCount(api.getNumberOfParticipants());
          } catch { /* */ }
        });
        api.addListener("readyToClose", () => {
          if (!disposed) onClose?.();
        });

        setTimeout(() => {
          if (!disposed) setLoading(false);
        }, 4000);
      } catch (e) {
        if (!disposed) {
          setError(e?.message || "Could not start call");
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      try {
        api?.dispose?.();
      } catch { /* */ }
      apiRef.current = null;
    };
  }, [callConfig, onClose]);

  const toggleAudio = useCallback(() => {
    try { apiRef.current?.executeCommand("toggleAudio"); } catch { /* */ }
  }, []);
  const toggleVideo = useCallback(() => {
    try { apiRef.current?.executeCommand("toggleVideo"); } catch { /* */ }
  }, []);
  const toggleShare = useCallback(() => {
    try { apiRef.current?.executeCommand("toggleShareScreen"); } catch { /* */ }
  }, []);
  const hangup = useCallback(() => {
    try { apiRef.current?.executeCommand("hangup"); } catch { /* */ }
    onClose?.();
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (!callConfig) return null;

  return (
    <Box
      ref={rootRef}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        bgcolor: "#0b0e11",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          px: 2, py: 1.2,
          bgcolor: "rgba(0,0,0,0.55)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {peerAvatar ? (
            <Avatar src={peerAvatar} sx={{ width: 36, height: 36 }} />
          ) : (
            <Avatar sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
              {(title || "C")[0]}
            </Avatar>
          )}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} lineHeight={1.2}>
              {title}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                size="small"
                icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                label={participantCount}
                sx={{
                  height: 20, fontSize: 11,
                  bgcolor: "rgba(255,255,255,0.1)", color: "#fff",
                  "& .MuiChip-icon": { color: "#fff" },
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.75 }}>
                {formatElapsed(elapsed)}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <IconButton onClick={hangup} size="small" sx={{ color: "rgba(255,255,255,0.7)" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Box ref={containerRef} sx={{ position: "absolute", inset: 0 }} />
        {loading && (
          <Fade in>
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={2}
              sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.65)" }}
            >
              <CircularProgress color="inherit" />
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Connecting…
              </Typography>
            </Stack>
          </Fade>
        )}
        {error && (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ position: "absolute", inset: 0 }}
          >
            <Typography color="error">{error}</Typography>
            <IconButton onClick={hangup} color="error">
              <CallEndIcon />
            </IconButton>
          </Stack>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          display: "flex",
          justifyContent: "center",
          py: 1.5,
          px: 2,
          bgcolor: "rgba(0,0,0,0.7)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Tooltip title={audioMuted ? "Unmute" : "Mute"}>
            <IconButton
              onClick={toggleAudio}
              sx={{
                bgcolor: audioMuted ? "error.main" : "rgba(255,255,255,0.12)",
                color: "#fff",
                width: 52, height: 52,
                "&:hover": { bgcolor: audioMuted ? "error.dark" : "rgba(255,255,255,0.22)" },
              }}
            >
              {audioMuted ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={videoMuted ? "Start video" : "Stop video"}>
            <IconButton
              onClick={toggleVideo}
              sx={{
                bgcolor: videoMuted ? "error.main" : "rgba(255,255,255,0.12)",
                color: "#fff",
                width: 52, height: 52,
                "&:hover": { bgcolor: videoMuted ? "error.dark" : "rgba(255,255,255,0.22)" },
              }}
            >
              {videoMuted ? <VideocamOffIcon /> : <VideocamIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={sharing ? "Stop sharing" : "Share screen"}>
            <IconButton
              onClick={toggleShare}
              sx={{
                bgcolor: sharing ? "primary.main" : "rgba(255,255,255,0.12)",
                color: "#fff",
                width: 52, height: 52,
                "&:hover": { bgcolor: sharing ? "primary.dark" : "rgba(255,255,255,0.22)" },
              }}
            >
              {sharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <IconButton
              onClick={toggleFullscreen}
              sx={{
                bgcolor: "rgba(255,255,255,0.12)",
                color: "#fff",
                width: 52, height: 52,
                "&:hover": { bgcolor: "rgba(255,255,255,0.22)" },
              }}
            >
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Hang up">
            <IconButton
              onClick={hangup}
              sx={{
                bgcolor: "error.main",
                color: "#fff",
                width: 64, height: 52,
                borderRadius: 3,
                ml: 1,
                "&:hover": { bgcolor: "error.dark" },
              }}
            >
              <CallEndIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Box>
  );
}
