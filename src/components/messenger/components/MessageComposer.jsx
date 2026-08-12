import React, { useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import {
  Stack, TextField, IconButton, Box, Chip, Tooltip, Typography,
  Popover, alpha,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SendIcon from "@mui/icons-material/Send";
import DoneIcon from "@mui/icons-material/Done";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ReplyIcon from "@mui/icons-material/Reply";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import MicIcon from "@mui/icons-material/Mic";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import VideocamIcon from "@mui/icons-material/Videocam";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";

const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😂", "😍", "😎", "🤩", "🥳", "😭", "😡", "🤔", "😴", "🤯", "🥺", "😇", "🤗", "🙄", "😏"],
  Gestures: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "🤟", "👌", "🙌", "👋", "✋", "🤙", "👊"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💖", "💘"],
  Objects: ["🔥", "⭐", "✨", "🎉", "🏆", "💎", "🚀", "💡", "🎵", "🎁", "☕", "🍕", "🍺", "📚"],
  Symbols: ["✅", "❌", "❓", "❗", "⚠️", "💯", "🔱", "🔰", "♻️", "🌐", "💤", "💥"],
};

const HOLD_MS = 180; // short press = switch mode; longer = start record
const LOCK_DY = -56; // drag up this many px → lock
const CANCEL_DX = -72; // drag left this many px → cancel

/**
 * Telegram-style composer:
 *  - Hold mic/cam to record, slide up to lock, slide left to cancel
 *  - Tap the secondary media button to swap voice ↔ video
 *  - Send button only when there is text/files/edit; otherwise media button
 *  - Enter still sends (desktop + mobile keyboard)
 */
export default function MessageComposer({
  text, setText, files, setFiles,
  replyTo, editingMsg, onCancelReplyOrEdit,
  onSend, onPickImage, onPickVideo, inputRef, onKeyDown,
}) {
  const fileRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // "voice" | "video" — which mode the primary hold-button uses
  const [mediaMode, setMediaMode] = useState(() => {
    try { return localStorage.getItem("messenger.mediaMode") || "voice"; } catch { return "voice"; }
  });

  // Recording: idle | recording | locked
  const [recPhase, setRecPhase] = useState("idle"); // idle | holding | locked
  const [recKind, setRecKind] = useState("voice"); // voice | video
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [locked, setLocked] = useState(false);
  const [hint, setHint] = useState(""); // "Slide up to lock" / "Release to cancel"
  const [dragUI, setDragUI] = useState({ dx: 0, dy: 0 });

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const micRafRef = useRef(null);
  const [micLevel, setMicLevel] = useState(0);

  const holdTimerRef = useRef(null);
  const pressStartRef = useRef(null); // { x, y, mode, started }
  const pointerIdRef = useRef(null);
  const lockedRef = useRef(false);
  const cancelRef = useRef(false);

  const stopMicMeter = () => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  };

  const startMicMeter = (stream) => {
    stopMicMeter();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      let peakHold = 0;
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        const boosted = Math.min(1, Math.pow(rms * 4.5, 0.65));
        peakHold = Math.max(boosted, peakHold * 0.92);
        setMicLevel(peakHold);
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* */ }
  };

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* */ }
      });
      streamRef.current = null;
    }
    stopMicMeter();
  };

  useEffect(() => () => {
    stopAllTracks();
    stopMicMeter();
    if (timerRef.current) clearInterval(timerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("messenger.mediaMode", mediaMode); } catch { /* */ }
  }, [mediaMode]);

  // Attach live stream to circular preview once the video element mounts
  useEffect(() => {
    if ((recPhase === "holding" || recPhase === "locked") && recKind === "video") {
      const v = videoPreviewRef.current;
      if (v && streamRef.current) {
        v.srcObject = streamRef.current;
        v.play().catch(() => {});
      }
    }
  }, [recPhase, recKind]);

  const getSavedDevices = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("messenger.mediaDevices") || "{}");
      return { cameraId: saved.cameraId || "", micId: saved.micId || "" };
    } catch {
      return { cameraId: "", micId: "" };
    }
  };

  const beginRecording = useCallback(async (mode) => {
    setRecordError("");
    setLocked(false);
    lockedRef.current = false;
    cancelRef.current = false;
    setHint("Slide up to lock · left to cancel");
    setDragUI({ dx: 0, dy: 0 });
    try {
      const { cameraId, micId } = getSavedDevices();
      const audioConstraint = micId ? { deviceId: { exact: micId } } : true;
      const videoConstraint = mode === "video"
        ? {
            width: { ideal: 320 },
            height: { ideal: 320 },
            ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
          }
        : false;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: audioConstraint,
      });
      // User may have cancelled during permission prompt
      if (cancelRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      startMicMeter(stream);

      if (mode === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = mode === "video" ? "video/webm" : "audio/webm";
      const options = MediaRecorder.isTypeSupported(mimeType) ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const wasCancel = cancelRef.current;
        const recordedType = mr.mimeType || mimeType;
        const blob = new Blob(chunksRef.current, { type: recordedType });
        stopAllTracks();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecPhase("idle");
        setLocked(false);
        lockedRef.current = false;
        setHint("");
        setDragUI({ dx: 0, dy: 0 });
        setRecordSeconds(0);

        if (wasCancel || !blob.size) {
          if (!wasCancel && !blob.size) setRecordError("Recording was empty");
          return;
        }
        const ts = Date.now();
        const filename = mode === "video" ? `video_message_${ts}.webm` : `voice_${ts}.webm`;
        const file = new File([blob], filename, { type: recordedType });
        // flushSync so parent onSend sees the new file in state immediately
        flushSync(() => {
          setFiles((prev) => [...prev, file]);
        });
        try { onSend?.(); } catch { /* */ }
      };
      mediaRecorderRef.current = mr;
      mr.start(100);
      setRecKind(mode);
      setRecPhase("holding");
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (mode === "video" && s + 1 >= 60) {
            // auto-stop video at 60s
            setTimeout(() => stopRecording(false), 0);
          }
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      setRecordError(
        e?.name === "NotAllowedError"
          ? "Microphone/camera permission denied"
          : (e?.message || "Recording unavailable")
      );
      stopAllTracks();
      setRecPhase("idle");
    }
  }, [onSend, setFiles]);

  const stopRecording = useCallback((cancel = false) => {
    cancelRef.current = !!cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    } else {
      stopAllTracks();
      setRecPhase("idle");
      setLocked(false);
      lockedRef.current = false;
      setHint("");
      setRecordSeconds(0);
    }
    mediaRecorderRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording(true);
  }, [stopRecording]);

  /* ---------- pointer handlers for hold-to-record ---------- */
  const onMediaPointerDown = (e, mode) => {
    if (recPhase !== "idle") return;
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    pointerIdRef.current = e.pointerId;
    pressStartRef.current = { x: clientX, y: clientY, mode, started: false };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* */ }

    holdTimerRef.current = setTimeout(() => {
      if (!pressStartRef.current) return;
      pressStartRef.current.started = true;
      beginRecording(mode);
    }, HOLD_MS);

    const onMove = (ev) => {
      const start = pressStartRef.current;
      if (!start) return;
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      const y = ev.clientY ?? ev.touches?.[0]?.clientY;
      if (x == null || y == null) return;
      const dx = x - start.x;
      const dy = y - start.y;
      setDragUI({ dx, dy });

      if (!start.started) {
        // moved a lot before hold fired → cancel pending start
        if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current);
            holdTimerRef.current = null;
          }
        }
        return;
      }

      if (lockedRef.current) return;

      if (dy <= LOCK_DY) {
        // Lock
        lockedRef.current = true;
        setLocked(true);
        setRecPhase("locked");
        setHint("Locked · tap send when done");
        setDragUI({ dx: 0, dy: 0 });
        cleanupPointer(onMove, onUp);
        return;
      }
      if (dx <= CANCEL_DX) {
        setHint("Release to cancel");
      } else if (dy < -12) {
        setHint("Slide up to lock");
      } else {
        setHint("Slide up to lock · left to cancel");
      }
    };

    const onUp = () => {
      cleanupPointer(onMove, onUp);
      const start = pressStartRef.current;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      // Short tap without starting → switch mode if this was secondary? handled separately
      if (!start?.started) {
        return;
      }

      if (lockedRef.current) {
        // Already locked — release shouldn't stop
        return;
      }

      // If dragged far left → cancel
      if (dragUI.dx <= CANCEL_DX || (start && false)) {
        // use latest drag from event — check cancel via release position not stored
      }

      // Default: stop & send
      // Cancel if still near cancel zone — read from last dragUI state is stale;
      // rely on cancelRef set during move
      stopRecording(false);
    };

    const cleanupPointer = (m, u) => {
      window.removeEventListener("pointermove", m);
      window.removeEventListener("pointerup", u);
      window.removeEventListener("pointercancel", u);
      window.removeEventListener("touchmove", m);
      window.removeEventListener("touchend", u);
    };

    // Track cancel zone on move with a ref for up handler
    const onMoveWrap = (ev) => {
      onMove(ev);
      const start = pressStartRef.current;
      if (!start?.started || lockedRef.current) return;
      const x = ev.clientX ?? ev.touches?.[0]?.clientX;
      if (x != null && start && (x - start.x) <= CANCEL_DX) {
        cancelRef.current = true; // mark for cancel if released here
      } else if (!lockedRef.current) {
        cancelRef.current = false;
      }
    };

    const onUpWrap = () => {
      cleanupPointer(onMoveWrap, onUpWrap);
      const start = pressStartRef.current;
      const wasStarted = start?.started;
      pressStartRef.current = null;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!wasStarted) return;
      if (lockedRef.current) return;
      stopRecording(!!cancelRef.current);
    };

    window.addEventListener("pointermove", onMoveWrap);
    window.addEventListener("pointerup", onUpWrap);
    window.addEventListener("pointercancel", onUpWrap);
  };

  const switchMode = (mode) => {
    setMediaMode(mode);
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    picked.forEach((f) => {
      if (f.type?.startsWith("image/")) onPickImage(f);
      else if (f.type?.startsWith("video/") && onPickVideo) onPickVideo(f);
      else setFiles((prev) => [...prev, f]);
    });
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  const canSend = Boolean(text.trim() || files.length || editingMsg);
  const primaryMode = mediaMode; // "voice" | "video"
  const secondaryMode = mediaMode === "voice" ? "video" : "voice";

  /* ---------- locked / holding recording UI ---------- */
  if (recPhase === "holding" || recPhase === "locked") {
    const showLock = locked || recPhase === "locked";
    return (
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: "background.paper", p: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          {recKind === "video" && (
            <Box
              component="video"
              ref={videoPreviewRef}
              muted
              playsInline
              sx={{
                width: 52, height: 52, borderRadius: "50%",
                objectFit: "cover", border: "2px solid", borderColor: "error.main", flexShrink: 0,
              }}
            />
          )}

          <IconButton onClick={cancelRecording} title="Cancel">
            <DeleteOutlineIcon color="error" />
          </IconButton>

          <Box sx={{
            flex: 1, minWidth: 0,
            bgcolor: "action.hover", borderRadius: 3, px: 1.5, py: 0.75,
            transform: !showLock ? `translateX(${Math.min(0, dragUI.dx * 0.35)}px)` : "none",
            transition: showLock ? "transform 0.15s" : "none",
          }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{
                width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main", flexShrink: 0,
                animation: "pulse 1.2s infinite",
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.35 },
                  "100%": { opacity: 1 },
                },
              }} />
              <Typography variant="body2" fontWeight={700} noWrap>
                {formatRecTime(recordSeconds)}
              </Typography>
              {showLock ? (
                <LockOutlinedIcon sx={{ fontSize: 16, color: "warning.main" }} />
              ) : (
                <LockOpenOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", opacity: 0.7 }} />
              )}
              <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                {hint}
              </Typography>
            </Stack>
            <Box sx={{
              mt: 0.5, width: "100%", height: 5, borderRadius: 3,
              bgcolor: "action.selected", overflow: "hidden", position: "relative",
            }}>
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                bgcolor: micLevel > 0.85 ? "error.main" : micLevel > 0.55 ? "warning.main" : "success.main",
                transition: "width 0.04s linear",
              }} />
            </Box>
          </Box>

          {/* Lock affordance (visual) while holding */}
          {!showLock && (
            <Box sx={{
              display: "flex", flexDirection: "column", alignItems: "center",
              opacity: 0.55 + Math.min(0.45, Math.max(0, -dragUI.dy) / 56),
              transform: `translateY(${Math.max(LOCK_DY, Math.min(0, dragUI.dy)) * 0.3}px)`,
            }}>
              <KeyboardArrowUpIcon fontSize="small" color="action" />
              <LockOutlinedIcon sx={{ fontSize: 18 }} color="action" />
            </Box>
          )}

          {showLock && (
            <IconButton
              color="primary"
              onClick={() => stopRecording(false)}
              sx={{
                bgcolor: "primary.main", color: "#fff",
                "&:hover": { bgcolor: "primary.dark" },
              }}
              title="Send"
            >
              <SendIcon />
            </IconButton>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <>
      {(replyTo || editingMsg) && (
        <Stack direction="row" alignItems="center"
          sx={{ px: 1.5, py: 0.7, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          {editingMsg
            ? <EditIcon fontSize="small" sx={{ mr: 1, color: "warning.main" }} />
            : <ReplyIcon fontSize="small" sx={{ mr: 1 }} />}
          <Box sx={{ flex: 1, minWidth: 0, borderLeft: "3px solid",
              borderColor: editingMsg ? "warning.main" : "primary.main", pl: 1 }}>
            <Typography variant="caption" fontWeight={700}>
              {editingMsg ? "Edit message" : `Reply to ${replyTo?.sender?.username || ""}`}
            </Typography>
            <Typography variant="caption" display="block" noWrap color="text.secondary">
              {editingMsg ? editingMsg.body : replyTo?.body}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onCancelReplyOrEdit}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      <Stack direction="row" alignItems="flex-end" spacing={0.5}
        sx={{ p: 1, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
        <input
          ref={fileRef} type="file" multiple hidden
          accept="image/*,video/*,audio/*,.gif,.pdf,.txt,.zip,.doc,.docx,.md,.csv"
          onChange={handleFileChange}
        />
        {!editingMsg && (
          <Tooltip title="Attach files">
            <IconButton onClick={() => fileRef.current?.click()}><AttachFileIcon /></IconButton>
          </Tooltip>
        )}
        <Tooltip title="Emoji">
          <IconButton ref={emojiBtnRef} onClick={() => setEmojiOpen(true)}>
            <EmojiEmotionsIcon />
          </IconButton>
        </Tooltip>
        <Popover
          open={emojiOpen}
          anchorEl={emojiBtnRef.current}
          onClose={() => setEmojiOpen(false)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          PaperProps={{ sx: { p: 1.5, maxHeight: 320, overflow: "auto" } }}
        >
          {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
            <Box key={cat} sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                {cat}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, maxWidth: 280 }}>
                {emojis.map((em) => (
                  <IconButton
                    key={em}
                    size="small"
                    onClick={() => {
                      setText((t) => t + em);
                      inputRef?.current?.focus();
                    }}
                    sx={{ fontSize: 22, width: 36, height: 36 }}
                  >
                    {em}
                  </IconButton>
                ))}
              </Box>
            </Box>
          ))}
        </Popover>
        {editingMsg && (
          <IconButton onClick={() => {
            setText("");
            onCancelReplyOrEdit?.();
          }} title="Cancel edit">
            <CloseIcon color="warning" />
          </IconButton>
        )}
        <TextField
          inputRef={inputRef} fullWidth multiline maxRows={6} size="small"
          placeholder={editingMsg ? "Edit message…" : "Message"}
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "action.hover" } }}
        />

        {/* When there is something to send → Send. Otherwise Telegram-style media buttons. */}
        {canSend ? (
          <IconButton
            color="primary"
            onClick={onSend}
            sx={{
              bgcolor: "primary.main", color: "#fff",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            {editingMsg ? <DoneIcon /> : <SendIcon />}
          </IconButton>
        ) : (
          <Stack direction="row" spacing={0} alignItems="center">
            {/* Secondary: tap to switch primary mode */}
            <Tooltip title={secondaryMode === "voice" ? "Switch to voice" : "Switch to video"}>
              <IconButton
                size="small"
                onClick={() => switchMode(secondaryMode)}
                sx={{
                  color: "text.secondary",
                  opacity: 0.75,
                }}
              >
                {secondaryMode === "voice" ? <MicIcon fontSize="small" /> : <VideocamIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Primary: hold to record */}
            <Tooltip title={primaryMode === "voice" ? "Hold to record voice" : "Hold to record video"}>
              <IconButton
                color="primary"
                onPointerDown={(e) => onMediaPointerDown(e, primaryMode)}
                onContextMenu={(e) => e.preventDefault()}
                sx={{
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  touchAction: "none",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              >
                {primaryMode === "voice" ? <MicIcon /> : <VideocamIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {files.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{
          px: 1, pb: 1, bgcolor: "background.paper",
          flexWrap: "wrap", gap: 0.5, alignItems: "center",
        }}>
          {files.map((f, i) => (
            <Chip
              key={i}
              size="small"
              label={f.name}
              onDelete={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
              avatar={f.type?.startsWith("image/")
                ? (
                  <Box
                    component="img"
                    src={URL.createObjectURL(f)}
                    alt=""
                    sx={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }}
                  />
                )
                : f.name?.startsWith("voice_")
                  ? <MicIcon sx={{ fontSize: 18 }} />
                  : f.name?.startsWith("video_message_")
                    ? <VideocamIcon sx={{ fontSize: 18 }} />
                    : undefined}
            />
          ))}
        </Stack>
      )}
      {recordError && (
        <Typography variant="caption" color="error.main" sx={{ px: 1, pb: 0.5, display: "block" }}>
          {recordError}
        </Typography>
      )}
    </>
  );
}
