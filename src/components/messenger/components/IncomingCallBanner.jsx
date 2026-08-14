/**
 * Incoming call banner with Web-Audio ringtone (max ~30s).
 */
import React, { useEffect, useRef } from "react";
import { Paper, Avatar, Box, Typography, IconButton } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CallEndIcon from "@mui/icons-material/CallEnd";

const RING_MS = 30000;

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
    // two short rings
    beep(880, t0, 0.18);
    beep(988, t0 + 0.2, 0.18);
    beep(880, t0 + 0.55, 0.18);
    beep(988, t0 + 0.75, 0.18);
    timer = setTimeout(cycle, 2200);
  };

  try {
    ctx.resume?.();
  } catch { /* */ }
  cycle();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      try {
        ctx.close();
      } catch { /* */ }
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
    const left = Math.max(1000, RING_MS - already);
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

  return (
    <Paper
      elevation={8}
      sx={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1500,
        px: 2.5,
        py: 1.5,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        gap: 2,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        minWidth: 300,
        maxWidth: "92vw",
        animation: "callPulse 1.6s ease-in-out infinite",
        "@keyframes callPulse": {
          "0%, 100%": { boxShadow: "0 8px 28px rgba(0,0,0,0.18)" },
          "50%": { boxShadow: "0 8px 36px rgba(25,118,210,0.35)" },
        },
      }}
    >
      <Avatar sx={{ bgcolor: "primary.main", width: 48, height: 48 }}>
        {(name || "C")[0]?.toUpperCase()}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography fontWeight={700} noWrap>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Incoming {isVideo ? "video" : "voice"} call…
        </Typography>
      </Box>
      <IconButton
        color="success"
        onClick={onAccept}
        sx={{
          bgcolor: "success.main",
          color: "#fff",
          "&:hover": { bgcolor: "success.dark" },
          width: 48,
          height: 48,
        }}
      >
        <CallIcon />
      </IconButton>
      <IconButton
        color="error"
        onClick={onDecline}
        sx={{
          bgcolor: "error.main",
          color: "#fff",
          "&:hover": { bgcolor: "error.dark" },
          width: 48,
          height: 48,
        }}
      >
        <CallEndIcon />
      </IconButton>
    </Paper>
  );
}
