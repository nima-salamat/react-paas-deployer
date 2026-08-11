import React, { useEffect, useRef, useState } from "react";
import {
  Stack, TextField, IconButton, Box, Chip, Tooltip, Typography, CircularProgress,
  Popover, Paper,
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

/** Common emoji set for the picker — grouped by category. */
const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😂", "😍", "😎", "🤩", "🥳", "😭", "😡", "🤔", "😴", "🤯", "🥺", "😇", "🤗", "🙄", "😏"],
  Gestures: ["👍", "👎", "👏", "🙏", "💪", "✌️", "🤞", "🤟", "👌", "🙌", "👋", "✋", "🤙", "👊"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "❣️", "💕", "💞", "💖", "💘"],
  Objects: ["🔥", "⭐", "✨", "🎉", "🏆", "💎", "🚀", "💡", "🎵", "🎁", "☕", "🍕", "🍺", "📚"],
  Symbols: ["✅", "❌", "❓", "❗", "⚠️", "💯", "🔱", "🔰", "♻️", "🌐", "💤", "💥"],
};

/**
 * Message composer with:
 *  - text input + file picker + reply/edit banner
 *  - image preview chips (clickable to re-open crop dialog)
 *  - voice message recording (MediaRecorder, audio/webm)
 *  - circular video message recording (MediaRecorder, video/webm, capped at 60s)
 *
 * Props:
 *  - text, setText
 *  - files, setFiles                  // array of File (already cropped for images)
 *  - replyTo, editingMsg
 *  - onCancelReplyOrEdit
 *  - onSend
 *  - onPickImage                      // (file: File) => void  — opens crop dialog
 *  - inputRef
 *  - onKeyDown                        // composer keydown (Enter to send, ArrowUp to edit)
 */
export default function MessageComposer({
  text, setText, files, setFiles,
  replyTo, editingMsg, onCancelReplyOrEdit,
  onSend, onPickImage, onPickVideo, inputRef, onKeyDown,
}) {
  const fileRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const [emojiOpen, setEmojiOpen] = useState(false);

  // Recording state — one of: "idle" | "voice" | "video"
  const [recording, setRecording] = useState("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => () => {
    // Cleanup on unmount: stop tracks, clear timer
    stopAllTracks();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const stopAllTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch { /* */ }
      });
      streamRef.current = null;
    }
  };

  const handleFileChange = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    // Images go through crop dialog; videos go through video edit dialog
    // (if onPickVideo is provided); other files are added directly.
    picked.forEach((f) => {
      if (f.type?.startsWith("image/")) {
        onPickImage(f);
      } else if (f.type?.startsWith("video/") && onPickVideo) {
        onPickVideo(f);
      } else {
        setFiles((prev) => [...prev, f]);
      }
    });
  };

  /* -------------------- voice / video recording -------------------- */

  // Read saved device IDs from MediaSettingsDialog (camera + mic pickers).
  // We resolve the saved selection at recording time so the user can change
  // devices in settings without having to reload the page.
  const getSavedDevices = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("messenger.mediaDevices") || "{}");
      return {
        cameraId: saved.cameraId || "",
        micId: saved.micId || "",
      };
    } catch {
      return { cameraId: "", micId: "" };
    }
  };

  const startRecording = async (mode) => {
    setRecordError("");
    try {
      const { cameraId, micId } = getSavedDevices();
      // Build constraints using saved device IDs (if any).
      // Use `exact` so the browser picks the user-selected device; fall back
      // to a generic constraint if no selection was made.
      const audioConstraint = micId
        ? { deviceId: { exact: micId } }
        : true;
      const videoConstraint = mode === "video"
        ? {
            width: { ideal: 320 },
            height: { ideal: 320 },
            ...(cameraId ? { deviceId: { exact: cameraId } } : {}),
          }
        : false;
      const constraints = { video: videoConstraint, audio: audioConstraint };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // For video mode, attach live preview to <video>
      if (mode === "video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = mode === "video" ? "video/webm" : "audio/webm";
      // Some browsers don't support video/webm — fall back gracefully
      let options = {};
      if (MediaRecorder.isTypeSupported(mimeType)) {
        options.mimeType = mimeType;
      }
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ts = Date.now();
        const filename = mode === "video"
          ? `video_message_${ts}.webm`
          : `voice_${ts}.webm`;
        const file = new File([blob], filename, { type: mimeType });
        setFiles((prev) => [...prev, file]);
        stopAllTracks();
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setRecording("idle");
        setRecordSeconds(0);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(mode);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          // Auto-stop at 60s for video, 5min for voice
          const max = mode === "video" ? 60 : 300;
          if (s + 1 >= max) {
            stopRecording();
            return s + 1;
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
      setRecording("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* */ }
    }
    mediaRecorderRef.current = null;
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch { /* */ }
    }
    mediaRecorderRef.current = null;
    stopAllTracks();
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    chunksRef.current = [];
    setRecording("idle");
    setRecordSeconds(0);
  };

  const formatRecTime = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  /* -------------------- recording UI (replaces input row when active) -------------------- */

  if (recording !== "idle") {
    return (
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          p: 1,
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        {recording === "video" && (
          <Box
            component="video"
            ref={videoPreviewRef}
            muted
            playsInline
            sx={{
              width: 56, height: 56, borderRadius: "50%",
              objectFit: "cover", border: "2px solid", borderColor: "error.main",
            }}
          />
        )}
        <IconButton onClick={cancelRecording} title="Cancel">
          <DeleteOutlineIcon color="error" />
        </IconButton>
        <Box sx={{
          flex: 1, display: "flex", alignItems: "center", gap: 1,
          bgcolor: "action.hover", borderRadius: 3, px: 1.5, py: 0.75,
        }}>
          <Box sx={{
            width: 10, height: 10, borderRadius: "50%", bgcolor: "error.main",
            animation: "pulse 1.2s infinite",
            "@keyframes pulse": {
              "0%": { opacity: 1 },
              "50%": { opacity: 0.3 },
              "100%": { opacity: 1 },
            },
          }} />
          <Typography variant="body2" fontWeight={600}>
            {recording === "video" ? "Recording video" : "Recording voice"} · {formatRecTime(recordSeconds)}
          </Typography>
        </Box>
        <Tooltip title="Stop & send">
          <IconButton
            color="primary"
            onClick={stopRecording}
            sx={{
              bgcolor: "primary.main", color: "#fff",
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            <StopCircleIcon />
          </IconButton>
        </Tooltip>
        {recordError && (
          <Typography variant="caption" color="error.main">{recordError}</Typography>
        )}
      </Stack>
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
          <IconButton onClick={onCancelReplyOrEdit}>
            <KeyboardArrowUpIcon color="warning" />
          </IconButton>
        )}
        <TextField
          inputRef={inputRef} fullWidth multiline maxRows={6} size="small"
          placeholder={editingMsg ? "Edit message…" : "Message"}
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "action.hover" } }}
        />
        <Tooltip title="Record voice message">
          <IconButton onClick={() => startRecording("voice")} color="primary">
            <MicIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Record video message">
          <IconButton onClick={() => startRecording("video")} color="primary">
            <VideocamIcon />
          </IconButton>
        </Tooltip>
        <IconButton color="primary" onClick={onSend}
          disabled={!text.trim() && !files.length && !editingMsg}
          sx={{
            bgcolor: "primary.main", color: "#fff",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
          }}>
          {editingMsg ? <DoneIcon /> : <SendIcon />}
        </IconButton>
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
