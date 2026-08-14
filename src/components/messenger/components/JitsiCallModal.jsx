/**
 * Custom professional call UI — Jitsi External API only (chrome fully stripped).
 * - No prejoin / no name prompt
 * - Single stable conference instance (no reload loop)
 * - Full overlay OR draggable mini window so chat stays usable
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Avatar,
  Chip,
  Tooltip,
  CircularProgress,
  Fade,
  Paper,
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
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PictureInPictureAltIcon from "@mui/icons-material/PictureInPictureAlt";

const JITSI_SCRIPT_CDN =
  "https://cdn.jsdelivr.net/npm/@jitsi/external-api@2.0.1/index.min.js";

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

/** Force-hide almost all native Jitsi UI + skip prejoin entirely */
const STRIP_CONFIG = {
  prejoinPageEnabled: false,
  prejoinConfig: { enabled: false },
  disableDeepLinking: true,
  disableInviteFunctions: true,
  disableThirdPartyRequests: true,
  enableClosePage: false,
  enableWelcomePage: false,
  enableInsecureRoomNameWarning: false,
  hideConferenceSubject: true,
  hideConferenceTimer: true,
  hideParticipantsStats: true,
  requireDisplayName: false,
  notifications: [],
  disabledNotifications: [
    "connection.CONNFAIL",
    "dialog.cameraNotFoundError",
    "dialog.micNotFoundError",
    "dialog.password",
    "notify.disconnected",
  ],
  toolbarButtons: [],
  buttonsWithNotifyClick: [],
  filmstrip: { disableResizable: true, disableStageFilmstrip: true },
  disableProfile: true,
  disableRemoteMute: true,
  remoteVideoMenu: { disableKick: true, disableGrantModerator: true },
  subject: " ",
  defaultLocalDisplayName: "You",
  defaultRemoteDisplayName: "Participant",
  startSilent: false,
  disableModeratorIndicator: true,
  readOnlyName: true,
};

const STRIP_INTERFACE = {
  SHOW_JITSI_WATERMARK: false,
  SHOW_WATERMARK_FOR_GUESTS: false,
  SHOW_BRAND_WATERMARK: false,
  SHOW_POWERED_BY: false,
  SHOW_CHROME_EXTENSION_BANNER: false,
  TOOLBAR_ALWAYS_VISIBLE: false,
  TOOLBAR_BUTTONS: [],
  DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
  DISABLE_FOCUS_INDICATOR: true,
  DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
  FILM_STRIP_MAX_HEIGHT: 0,
  VERTICAL_FILMSTRIP: false,
  INITIAL_TOOLBAR_TIMEOUT: 1,
  TOOLBAR_TIMEOUT: 1,
  HIDE_INVITE_MORE_HEADER: true,
  MOBILE_APP_PROMO: false,
  VIDEO_LAYOUT_FIT: "both",
  TILE_VIEW_MAX_COLUMNS: 2,
  APP_NAME: "Call",
  NATIVE_APP_NAME: "Call",
  PROVIDER_NAME: "Call",
  DISPLAY_WELCOME_PAGE_CONTENT: false,
  DISPLAY_WELCOME_FOOTER: false,
};

const MINI_W = 320;
const MINI_H = 200;

export default function JitsiCallModal({
  callConfig,
  onClose,
  title = "Call",
  peerAvatar,
}) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const rootRef = useRef(null);
  const dragRef = useRef({ active: false, ox: 0, oy: 0 });
  const onCloseRef = useRef(onClose);
  const startingRef = useRef(false);

  // Keep latest onClose without re-running the conference effect
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [mode, setMode] = useState("full"); // 'full' | 'mini'
  const [miniPos, setMiniPos] = useState(() => {
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: Math.max(16, window.innerWidth - MINI_W - 24),
      y: Math.max(16, window.innerHeight - MINI_H - 100),
    };
  });

  // Stable conference identity — only restart when room/domain change
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
    if (h > 0)
      return `${h}:${String(m % 60).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // ── Boot conference ONCE per room ─────────────────────────────────
  useEffect(() => {
    if (!callConfig || !roomKey) return undefined;

    let disposed = false;
    let api = null;
    let joinFallbackTimer = null;

    const boot = async () => {
      // Wait until container is in the DOM
      let tries = 0;
      while (!containerRef.current && tries < 40) {
        await new Promise((r) => setTimeout(r, 50));
        tries += 1;
      }
      if (disposed || !containerRef.current) return;
      if (startingRef.current || apiRef.current) return;
      startingRef.current = true;

      try {
        setLoading(true);
        setError(null);

        const JitsiMeetExternalAPI = await loadJitsiScript(callConfig.domain);
        if (disposed || !containerRef.current) {
          startingRef.current = false;
          return;
        }

        // Clear any leftover iframe from a previous instance
        try {
          containerRef.current.innerHTML = "";
        } catch { /* */ }

        const displayName =
          callConfig.display_name ||
          callConfig.displayName ||
          "User";

        const opts = {
          roomName: callConfig.room,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName,
          },
          configOverwrite: {
            ...STRIP_CONFIG,
            ...(callConfig.config || {}),
            // Force again so server defaults cannot re-enable chrome
            prejoinPageEnabled: false,
            prejoinConfig: { enabled: false },
            requireDisplayName: false,
            toolbarButtons: [],
            notifications: [],
            disableDeepLinking: true,
            enableWelcomePage: false,
            startWithAudioMuted:
              callConfig.config?.startWithAudioMuted ?? false,
            startWithVideoMuted:
              callConfig.config?.startWithVideoMuted ?? false,
          },
          interfaceConfigOverwrite: {
            ...STRIP_INTERFACE,
            ...(callConfig.interface_config || {}),
            TOOLBAR_BUTTONS: [],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
          },
          onload: () => {
            // Extra safety: if prejoin somehow still appears, try to dismiss
            try {
              api?.executeCommand?.("displayName", displayName);
            } catch { /* */ }
          },
        };

        api = new JitsiMeetExternalAPI(callConfig.domain, opts);
        apiRef.current = api;

        const markJoined = () => {
          if (!disposed) setLoading(false);
        };

        api.addListener("videoConferenceJoined", () => {
          markJoined();
          try {
            setParticipantCount(api.getNumberOfParticipants());
          } catch { /* */ }
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
          if (!disposed) onCloseRef.current?.();
        });
        api.addListener("videoConferenceLeft", () => {
          if (!disposed) onCloseRef.current?.();
        });

        // Fallback if join event is slow / muted
        joinFallbackTimer = setTimeout(markJoined, 8000);
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
      if (joinFallbackTimer) clearTimeout(joinFallbackTimer);
      startingRef.current = false;
      try {
        api?.dispose?.();
      } catch { /* */ }
      try {
        apiRef.current?.dispose?.();
      } catch { /* */ }
      apiRef.current = null;
      // Do NOT clear container innerHTML here while React may still own the node;
      // dispose() already removes the iframe.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey]);

  // Soft resize hint when switching full ↔ mini (does not recreate API)
  useEffect(() => {
    try {
      window.dispatchEvent(new Event("resize"));
    } catch { /* */ }
  }, [mode]);

  // If you are alone in the room for too long (nobody answered / everyone left) → end call
  useEffect(() => {
    if (loading || error) return undefined;
    if (participantCount > 1) return undefined;
    const aloneMs = 45000; // 45s alone after connect
    const t = setTimeout(() => {
      try {
        apiRef.current?.executeCommand("hangup");
      } catch { /* */ }
      onCloseRef.current?.();
    }, aloneMs);
    return () => clearTimeout(t);
  }, [loading, error, participantCount]);

  const toggleAudio = useCallback(() => {
    try {
      apiRef.current?.executeCommand("toggleAudio");
    } catch { /* */ }
  }, []);
  const toggleVideo = useCallback(() => {
    try {
      apiRef.current?.executeCommand("toggleVideo");
    } catch { /* */ }
  }, []);
  const toggleShare = useCallback(() => {
    try {
      apiRef.current?.executeCommand("toggleShareScreen");
    } catch { /* */ }
  }, []);
  const hangup = useCallback(() => {
    try {
      apiRef.current?.executeCommand("hangup");
    } catch { /* */ }
    onCloseRef.current?.();
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el
        .requestFullscreen?.()
        .then(() => {
          setFullscreen(true);
          setMode("full");
        })
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setFullscreen(false))
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const onDragStart = useCallback(
    (e) => {
      if (mode !== "mini") return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      dragRef.current = {
        active: true,
        ox: clientX - miniPos.x,
        oy: clientY - miniPos.y,
      };
    },
    [mode, miniPos]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current.active) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = Math.min(
        Math.max(8, clientX - dragRef.current.ox),
        window.innerWidth - MINI_W - 8
      );
      const y = Math.min(
        Math.max(8, clientY - dragRef.current.oy),
        window.innerHeight - MINI_H - 90
      );
      setMiniPos({ x, y });
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
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
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setMode("mini");
    setFullscreen(false);
  }, []);

  const goFull = useCallback(() => {
    setMode("full");
  }, []);

  if (!callConfig) return null;

  const isMini = mode === "mini";

  const controlBtn = (active, danger, size = 44) => ({
    bgcolor: danger
      ? "error.main"
      : active
        ? "primary.main"
        : "rgba(255,255,255,0.12)",
    color: "#fff",
    width: size,
    height: size,
    "&:hover": {
      bgcolor: danger
        ? "error.dark"
        : active
          ? "primary.dark"
          : "rgba(255,255,255,0.22)",
    },
  });

  const Controls = ({ compact = false }) => {
    const sz = compact ? 36 : 48;
    return (
      <Stack
        direction="row"
        spacing={compact ? 0.75 : 1.25}
        alignItems="center"
        justifyContent="center"
        sx={{ width: "100%" }}
      >
        <Tooltip title={audioMuted ? "Unmute" : "Mute"}>
          <IconButton onClick={toggleAudio} sx={controlBtn(false, audioMuted, sz)}>
            {audioMuted ? (
              <MicOffIcon fontSize={compact ? "small" : "medium"} />
            ) : (
              <MicIcon fontSize={compact ? "small" : "medium"} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={videoMuted ? "Start video" : "Stop video"}>
          <IconButton onClick={toggleVideo} sx={controlBtn(false, videoMuted, sz)}>
            {videoMuted ? (
              <VideocamOffIcon fontSize={compact ? "small" : "medium"} />
            ) : (
              <VideocamIcon fontSize={compact ? "small" : "medium"} />
            )}
          </IconButton>
        </Tooltip>
        {!compact && (
          <Tooltip title={sharing ? "Stop sharing" : "Share screen"}>
            <IconButton onClick={toggleShare} sx={controlBtn(sharing, false, sz)}>
              {sharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </IconButton>
          </Tooltip>
        )}
        {compact ? (
          <Tooltip title="Expand">
            <IconButton onClick={goFull} sx={controlBtn(false, false, sz)}>
              <OpenInFullIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : (
          <>
            <Tooltip title="Minimize (keep chatting)">
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
        <Tooltip title="Hang up">
          <IconButton
            onClick={hangup}
            sx={{
              ...controlBtn(false, true, compact ? 40 : 56),
              borderRadius: compact ? 2 : 3,
              ml: compact ? 0.5 : 1,
            }}
          >
            <CallEndIcon fontSize={compact ? "small" : "medium"} />
          </IconButton>
        </Tooltip>
      </Stack>
    );
  };

  return (
    <Box
      ref={rootRef}
      sx={
        isMini
          ? {
              position: "fixed",
              left: miniPos.x,
              top: miniPos.y,
              width: MINI_W,
              zIndex: 1450,
              borderRadius: 3,
              overflow: "hidden",
              bgcolor: "#0b0e11",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
              display: "flex",
              flexDirection: "column",
              userSelect: "none",
            }
          : {
              position: "fixed",
              inset: 0,
              zIndex: 1400,
              bgcolor: "#0b0e11",
              display: "flex",
              flexDirection: "column",
              color: "#fff",
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
          px: isMini ? 1 : 2,
          py: isMini ? 0.6 : 1.2,
          bgcolor: "rgba(0,0,0,0.55)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(10px)",
          cursor: isMini ? "grab" : "default",
          "&:active": isMini ? { cursor: "grabbing" } : undefined,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={isMini ? 1 : 1.5}
          sx={{ minWidth: 0, flex: 1 }}
        >
          {isMini && (
            <DragIndicatorIcon sx={{ fontSize: 16, opacity: 0.5, flexShrink: 0 }} />
          )}
          {peerAvatar ? (
            <Avatar
              src={peerAvatar}
              sx={{
                width: isMini ? 22 : 36,
                height: isMini ? 22 : 36,
                flexShrink: 0,
              }}
            />
          ) : (
            <Avatar
              sx={{
                width: isMini ? 22 : 36,
                height: isMini ? 22 : 36,
                bgcolor: "primary.main",
                fontSize: isMini ? 11 : 16,
                flexShrink: 0,
              }}
            >
              {(title || "C")[0]}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={isMini ? "caption" : "subtitle1"}
              fontWeight={600}
              lineHeight={1.2}
              noWrap
            >
              {title}
            </Typography>
            {!isMini && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  size="small"
                  icon={<PeopleIcon sx={{ fontSize: 14 }} />}
                  label={participantCount}
                  sx={{
                    height: 20,
                    fontSize: 11,
                    bgcolor: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    "& .MuiChip-icon": { color: "#fff" },
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}
                >
                  {formatElapsed(elapsed)}
                </Typography>
              </Stack>
            )}
          </Box>
          {isMini && (
            <Typography
              variant="caption"
              sx={{
                opacity: 0.7,
                fontVariantNumeric: "tabular-nums",
                ml: "auto",
                mr: 0.5,
                flexShrink: 0,
              }}
            >
              {formatElapsed(elapsed)}
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
          {isMini ? (
            <IconButton
              size="small"
              onClick={goFull}
              sx={{ color: "rgba(255,255,255,0.75)", p: 0.4 }}
            >
              <OpenInFullIcon sx={{ fontSize: 16 }} />
            </IconButton>
          ) : (
            <Tooltip title="Minimize — keep chatting">
              <IconButton
                onClick={goMini}
                size="small"
                sx={{ color: "rgba(255,255,255,0.8)" }}
              >
                <CloseFullscreenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            onClick={hangup}
            size="small"
            sx={{ color: "rgba(255,255,255,0.7)", p: isMini ? 0.4 : undefined }}
          >
            <CloseIcon sx={{ fontSize: isMini ? 16 : 20 }} />
          </IconButton>
        </Stack>
      </Stack>

      {/* Video stage — persistent node; never unmounted across mode switches */}
      <Box
        sx={{
          position: "relative",
          flex: isMini ? "none" : 1,
          width: "100%",
          height: isMini ? MINI_H : "auto",
          minHeight: isMini ? MINI_H : 0,
          bgcolor: "#000",
        }}
      >
        <Box
          ref={containerRef}
          sx={{
            position: "absolute",
            inset: 0,
            "& iframe": { border: "none !important" },
          }}
        />
        {loading && (
          <Fade in>
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={isMini ? 1 : 2}
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(0,0,0,0.72)",
                zIndex: 2,
              }}
            >
              <CircularProgress size={isMini ? 28 : 40} color="inherit" />
              {!isMini && (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Connecting…
                </Typography>
              )}
            </Stack>
          </Fade>
        )}
        {error && (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1}
            sx={{ position: "absolute", inset: 0, p: 1, zIndex: 2 }}
          >
            <Typography
              color="error"
              variant={isMini ? "caption" : "body2"}
              textAlign="center"
            >
              {error}
            </Typography>
            <IconButton onClick={hangup} color="error" size="small">
              <CallEndIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          display: "flex",
          justifyContent: "center",
          py: isMini ? 0.75 : 1.5,
          px: isMini ? 1 : 2,
          bgcolor: "rgba(0,0,0,0.72)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Controls compact={isMini} />
      </Paper>
    </Box>
  );
}
