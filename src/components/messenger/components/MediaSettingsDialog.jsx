import React, { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Paper, IconButton, Tooltip, alpha, Slider, Switch, FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VideocamIcon from "@mui/icons-material/Videocam";
import MicIcon from "@mui/icons-material/Mic";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";

const STORAGE_KEY = "messenger.mediaDevices";

/**
 * Persistent media device picker — lets the user choose which camera and
 * microphone to use for voice/video messages in the messenger.
 *
 * Uses navigator.mediaDevices.enumerateDevices() + getUserMedia() for the
 * preview. Persists the selected device IDs to localStorage so the choice
 * survives reloads.
 *
 * Why this exists:
 *  - The previous MessageComposer called getUserMedia() with bare constraints
 *    `{ audio: true }` / `{ video: { width: { ideal: 320 } } }` — so on
 *    systems with multiple mics (e.g. laptop with USB headset + builtin),
 *    the browser picked whatever was the OS default. Users had no way to
 *    pick a specific device.
 *  - Now MessageComposer reads the saved deviceId from localStorage and
 *    passes it as `audio: { deviceId: { exact: <savedId> } }`.
 *
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSaved: (devices) => void  // optional callback when selection saved
 */
export default function MediaSettingsDialog({ open, onClose, onSaved }) {
  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedMic, setSelectedMic] = useState("");
  const [selectedSpeaker, setSelectedSpeaker] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const [testingMic, setTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const videoPreviewRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // ---- Load saved selection from localStorage on mount ----
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (saved.cameraId) setSelectedCamera(saved.cameraId);
      if (saved.micId) setSelectedMic(saved.micId);
      if (saved.speakerId) setSelectedSpeaker(saved.speakerId);
    } catch { /* */ }
  }, []);

  // ---- Enumerate devices (requires permission to see labels) ----
  const enumerateDevices = async () => {
    setLoadingDevices(true);
    setPermissionError("");
    try {
      // Ask for permission first so device labels become visible
      // (without permission, labels are blank).
      let permStream = null;
      try {
        permStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (e) {
        // If permission denied, we still get device IDs but no labels
        if (e?.name === "NotAllowedError") {
          setPermissionError("Permission denied. Allow camera & microphone access in your browser to see device names.");
        }
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      const mics = devices.filter((d) => d.kind === "audioinput");
      const spkrs = devices.filter((d) => d.kind === "audiooutput");
      setCameras(cams);
      setMics(mics);
      setSpeakers(spkrs);
      // If no selection yet, pick the first one
      setSelectedCamera((cur) => cur || cams[0]?.deviceId || "");
      setSelectedMic((cur) => cur || mics[0]?.deviceId || "");
      setSelectedSpeaker((cur) => cur || spkrs[0]?.deviceId || "");
      if (permStream) {
        permStream.getTracks().forEach((t) => t.stop());
      }
    } catch (e) {
      setPermissionError(e?.message || "Could not list devices");
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (open) enumerateDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ---- Live preview of the selected camera + mic level meter ----
  useEffect(() => {
    if (!open) return;
    if (!selectedCamera && !selectedMic) return;

    let cancelled = false;
    const startPreview = async () => {
      // Stop any existing preview
      stopPreview();
      const constraints = {
        video: selectedCamera ? { deviceId: { exact: selectedCamera } } : false,
        audio: selectedMic ? { deviceId: { exact: selectedMic } } : false,
      };
      if (!constraints.video && !constraints.audio) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPreviewStream(stream);
        // Attach to <video>
        if (videoPreviewRef.current && constraints.video) {
          videoPreviewRef.current.srcObject = stream;
          videoPreviewRef.current.play().catch(() => {});
        }
        // Mic level meter
        if (constraints.audio) {
          startMicMeter(stream);
        }
      } catch (e) {
        // Could not start preview — likely permission denied or device gone
        if (e?.name === "NotAllowedError") {
          setPermissionError("Camera/microphone permission denied.");
        } else if (e?.name === "NotFoundError") {
          setPermissionError("Selected device not found.");
        } else {
          setPermissionError(e?.message || "Could not start preview");
        }
      }
    };
    startPreview();

    return () => {
      cancelled = true;
      stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCamera, selectedMic]);

  const stopPreview = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      try { videoPreviewRef.current.srcObject = null; } catch { /* */ }
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* */ }
      audioContextRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMicLevel(0);
    setPreviewStream(null);
  };

  const startMicMeter = (stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      audioContextRef.current = ctx;
      // Browsers often start AudioContext suspended until a user gesture
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      // Time-domain RMS is far more sensitive to speech volume than averaging
      // the full frequency spectrum (which dilutes energy across empty bins).
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      // Peak-hold so short loud spikes remain visible briefly
      let peakHold = 0;
      const tick = () => {
        if (!analyserRef.current) return;
        analyser.getByteTimeDomainData(data);
        // RMS of centered samples (128 = silence)
        let sumSq = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1..1
          sumSq += v * v;
        }
        const rms = Math.sqrt(sumSq / data.length);
        // Boost sensitivity: quiet speech ~0.02–0.08, loud ~0.2–0.5
        // Map with a power curve so normal talking fills ~40–70% of the bar
        const boosted = Math.min(1, Math.pow(rms * 4.5, 0.65));
        peakHold = Math.max(boosted, peakHold * 0.92);
        setMicLevel(peakHold);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTestingMic(true);
    } catch { /* */ }
  };

  // ---- Save selection to localStorage ----
  const handleSave = () => {
    const data = {
      cameraId: selectedCamera,
      micId: selectedMic,
      speakerId: selectedSpeaker,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    try {
      window.dispatchEvent(new CustomEvent("messenger:media-devices-changed", { detail: data }));
    } catch { /* */ }
    onSaved?.(data);
    onClose();
  };

  const applySpeakerToElement = async (el, sinkId) => {
    if (!el || typeof el.setSinkId !== "function") return;
    try { await el.setSinkId(sinkId || ""); } catch { /* */ }
  };

  // Live-switch output when user picks a speaker (preview + AudioPlayerBar)
  useEffect(() => {
    if (!open) return;
    applySpeakerToElement(videoPreviewRef.current, selectedSpeaker);
    try {
      window.dispatchEvent(new CustomEvent("messenger:media-devices-changed", {
        detail: { speakerId: selectedSpeaker },
      }));
    } catch { /* */ }
  }, [selectedSpeaker, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 5 }}>
        <VideocamIcon color="primary" />
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>Media settings</Typography>
        <Tooltip title="Refresh devices">
          <IconButton size="small" onClick={enumerateDevices} disabled={loadingDevices}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <IconButton size="small" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {permissionError && (
          <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: alpha("#f44336", 0.08), borderColor: "error.main" }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <ErrorIcon color="error" fontSize="small" sx={{ mt: 0.25 }} />
              <Typography variant="body2" color="error.main">{permissionError}</Typography>
            </Stack>
          </Paper>
        )}

        <Stack spacing={2.5}>
          {/* Camera preview */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <VideocamIcon fontSize="small" /> Camera preview
            </Typography>
            <Box
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "4 / 3",
                bgcolor: "#000",
                borderRadius: 2,
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              <video
                ref={videoPreviewRef}
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {!previewStream && (
                <Box sx={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.5)",
                }}>
                  {loadingDevices ? <CircularProgress size={32} /> : <VideocamIcon sx={{ fontSize: 48 }} />}
                </Box>
              )}
            </Box>
          </Box>

          {/* Camera picker */}
          <FormControl fullWidth size="small" disabled={!cameras.length}>
            <InputLabel>
              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                <VideocamIcon fontSize="small" /> Camera
              </Box>
            </InputLabel>
            <Select
              label="Camera"
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              renderValue={(v) => {
                const cam = cameras.find((c) => c.deviceId === v);
                return cam?.label || (v ? "Selected camera" : "Default");
              }}
            >
              {cameras.map((c, i) => (
                <MenuItem key={c.deviceId || i} value={c.deviceId}>
                  {c.label || `Camera ${i + 1}`}
                </MenuItem>
              ))}
              {!cameras.length && (
                <MenuItem disabled>No cameras found</MenuItem>
              )}
            </Select>
          </FormControl>

          {/* Microphone picker + level meter */}
          <Box>
            <FormControl fullWidth size="small" disabled={!mics.length} sx={{ mb: 1 }}>
              <InputLabel>
                <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <MicIcon fontSize="small" /> Microphone
                </Box>
              </InputLabel>
              <Select
                label="Microphone"
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                renderValue={(v) => {
                  const mic = mics.find((m) => m.deviceId === v);
                  return mic?.label || (v ? "Selected mic" : "Default");
                }}
              >
                {mics.map((m, i) => (
                  <MenuItem key={m.deviceId || i} value={m.deviceId}>
                    {m.label || `Microphone ${i + 1}`}
                  </MenuItem>
                ))}
                {!mics.length && (
                  <MenuItem disabled>No microphones found</MenuItem>
                )}
              </Select>
            </FormControl>
            {/* Mic level meter — micLevel is already 0..1 after sensitivity boost */}
            <Box sx={{
              width: "100%", height: 12, bgcolor: "action.hover", borderRadius: 4,
              overflow: "hidden", position: "relative",
            }}>
              <Box sx={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                bgcolor: micLevel > 0.85
                  ? "error.main"
                  : micLevel > 0.55
                    ? "warning.main"
                    : "success.main",
                transition: "width 0.04s linear",
              }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {testingMic
                ? (micLevel < 0.05
                    ? "Speak into your mic — bar should move with your voice"
                    : micLevel > 0.85
                      ? "Very loud — good, mic is picking you up"
                      : "Mic is working")
                : "Mic preview will start when a mic is selected"}
            </Typography>
          </Box>

          {/* Speaker picker (Chrome/Edge only) */}
          {speakers.length > 0 && (
            <FormControl fullWidth size="small">
              <InputLabel>Speaker (output)</InputLabel>
              <Select
                label="Speaker (output)"
                value={selectedSpeaker}
                onChange={(e) => setSelectedSpeaker(e.target.value)}
                renderValue={(v) => {
                  const spk = speakers.find((s) => s.deviceId === v);
                  return spk?.label || (v ? "Selected speaker" : "Default");
                }}
              >
                {speakers.map((s, i) => (
                  <MenuItem key={s.deviceId || i} value={s.deviceId}>
                    {s.label || `Speaker ${i + 1}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<CheckCircleIcon />}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
