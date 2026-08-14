/**
 * IncomingCallBanner — modern, mobile-friendly incoming-call overlay
 * with Web-Audio ringtone (max ~30s).
 */
import React, { useEffect, useRef } from "react";
import {
  Box, Avatar, Typography, IconButton, Stack,
} from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";
import VideocamIcon from "@mui/icons-material/Videocam";
import PersonIcon from "@mui/icons-material/Person";
import { alpha } from "@mui/material/styles";

const DEFAULT_RING_MS = 30000;

/** Classic double-ring phone pattern via Web Audio API (no asset needed). */
function startRingtone() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return { stop() {} };
  const ctx = new Ctx();
  let stopped = false;
  let timer = null;

  const beep = (freq, when, dur) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.18, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(when);
    o.stop(when + dur + 0.02);
  };

  const cycle = () => {
    if (stopped) return;
    const t0 = ctx.currentTime + 0.02;
    beep(880, t0, 0.18);
    beep(988, t0 + 0.2, 0.18);
    beep(880, t0 + 0.55, 0.18);
    beep(988, t0 + 0.75, 0.18);
    timer = setTimeout(cycle, 2200);
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

export default function IncomingCallBanner({
  incomingCall,
  onAccept,
  onDecline,
  onTimeout,
}) {
  const ringRef = useRef(null);
  const timeoutRef = useRef(null);

  const callKey = incomingCall?.call_id || incomingCall?.conversation_id;
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (!incomingCall || !callKey) return undefined;
    ringRef.current = startRingtone();
    const already = incomingCall._receivedAt
      ? Math.max(0, Date.now() - incomingCall._receivedAt)
      : 0;
    const totalMs = Number(incomingCall.ring_timeout) > 0
      ? Number(incomingCall.ring_timeout) * 1000
      : DEFAULT_RING_MS;
    const left = Math.max(1500, incomingCall.replay ? totalMs : (DEFAULT_RING_MS - already));
    timeoutRef.current = setTimeout(() => {
      onTimeoutRef.current?.();
    }, left);
    return () => {
      ringRef.current?.stop?.();
      ringRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callKey]);

  if (!incomingCall) return null;

  const isVideo = !!(incomingCall.media?.video || incomingCall.is_video);
  const name = incomingCall.initiator?.username || "Incoming call";
  const initial = (name || "C")[0]?.toUpperCase();

  return (
    <>
      {/* Dimmed backdrop so the user notices the call (no full block — chat stays usable) */}
      <Box
        sx={{
          position: "fixed", inset: 0, zIndex: 1490,
          bgcolor: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)",
          pointerEvents: "auto",
        }}
        onClick={onDecline}
      />

      {/* Floating call card */}
      <Box
        sx={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1500,
          width: { xs: "calc(100vw - 32px)", sm: 380 },
          maxWidth: 380,
          p: 3,
          borderRadius: 4,
          bgcolor: "background.paper",
          boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
          border: "1px solid", borderColor: "divider",
          display: "flex", flexDirection: "column", alignItems: "center",
          textAlign: "center",
          animation: "callPulse 1.6s ease-in-out infinite",
          "@keyframes callPulse": {
            "0%, 100%": { boxShadow: "0 24px 64px rgba(0,0,0,0.45)" },
            "50%": { boxShadow: "0 24px 80px rgba(25,118,210,0.45)" },
          },
        }}
      >
        {/* Avatar with pulsing ring */}
        <Box sx={{ position: "relative", mb: 2 }}>
          <Box
            sx={{
              position: "absolute", inset: -8,
              borderRadius: "50%",
              bgcolor: alpha("#22c55e", 0.18),
              animation: "callRing 1.8s ease-out infinite",
              "@keyframes callRing": {
                "0%": { transform: "scale(0.8)", opacity: 0.7 },
                "100%": { transform: "scale(1.4)", opacity: 0 },
              },
            }}
          />
          <Avatar
            src={incomingCall.initiator?.avatar || undefined}
            sx={{
              width: 96, height: 96, fontSize: 40,
              bgcolor: isVideo ? "primary.main" : "success.main",
              border: "3px solid", borderColor: "background.paper",
              position: "relative",
            }}
          >
            {initial}
          </Avatar>
          {/* small badge: voice/video */}
          <Box
            sx={{
              position: "absolute",
              bottom: 0, right: 0,
              width: 32, height: 32,
              borderRadius: "50%",
              bgcolor: isVideo ? "primary.main" : "success.main",
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid", borderColor: "background.paper",
            }}
          >
            {isVideo ? <VideocamIcon sx={{ fontSize: 16 }} /> : <CallIcon sx={{ fontSize: 16 }} />}
          </Box>
        </Box>

        <Typography variant="h6" fontWeight={700} noWrap sx={{ maxWidth: "100%" }}>
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Incoming {isVideo ? "video" : "voice"} call…
        </Typography>

        {/* Action buttons */}
        <Stack
          direction="row"
          spacing={3}
          justifyContent="center"
          sx={{ mt: 3, width: "100%" }}
        >
          <Stack alignItems="center" spacing={0.75}>
            <IconButton
              onClick={onDecline}
              sx={{
                bgcolor: "error.main",
                color: "#fff",
                width: { xs: 56, sm: 64 },
                height: { xs: 56, sm: 64 },
                "&:hover": { bgcolor: "error.dark", transform: "scale(1.05)" },
                transition: "all 0.15s ease",
              }}
            >
              <CallEndIcon sx={{ fontSize: 28 }} />
            </IconButton>
            <Typography variant="caption" color="text.secondary">Decline</Typography>
          </Stack>

          <Stack alignItems="center" spacing={0.75}>
            <IconButton
              onClick={onAccept}
              sx={{
                bgcolor: "success.main",
                color: "#fff",
                width: { xs: 56, sm: 64 },
                height: { xs: 56, sm: 64 },
                animation: "callBtnPulse 1.2s ease-in-out infinite",
                "&:hover": { bgcolor: "success.dark", transform: "scale(1.05)" },
                transition: "transform 0.15s ease, background-color 0.15s ease",
                "@keyframes callBtnPulse": {
                  "0%, 100%": { boxShadow: "0 0 0 0 rgba(34,197,94,0.5)" },
                  "50%": { boxShadow: "0 0 0 12px rgba(34,197,94,0)" },
                },
              }}
            >
              {isVideo ? <VideocamIcon sx={{ fontSize: 28 }} /> : <CallIcon sx={{ fontSize: 28 }} />}
            </IconButton>
            <Typography variant="caption" color="text.secondary">Accept</Typography>
          </Stack>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, opacity: 0.7, display: "flex", alignItems: "center", gap: 0.5 }}>
          <PersonIcon sx={{ fontSize: 12 }} />
          Tap anywhere outside to decline
        </Typography>
      </Box>
    </>
  );
}
