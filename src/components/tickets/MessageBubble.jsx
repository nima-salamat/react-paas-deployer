import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar, Box, Button, Dialog, DialogActions, DialogContent, Divider,
  IconButton, Menu, MenuItem, Stack, Tooltip, Typography,
} from "@mui/material";
import CodeIcon from "@mui/icons-material/Code";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import DownloadIcon from "@mui/icons-material/Download";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import VideocamIcon from "@mui/icons-material/Videocam";
import AudioFileIcon from "@mui/icons-material/AudioFile";

function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 15, ml: 0.35, verticalAlign: "middle", opacity: 0.95 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 15, ml: 0.35, opacity: 0.7, verticalAlign: "middle" }} />
    </Tooltip>
  );
}

function formatSize(bytes) {
  if (bytes == null || bytes === "") return "";
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function isImage(ct, name = "") {
  if (ct && String(ct).startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name || "");
}
function isAudio(ct, name = "") {
  if (ct && String(ct).startsWith("audio/")) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)$/i.test(name || "");
}
function isVideo(ct, name = "") {
  if (ct && String(ct).startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv)$/i.test(name || "");
}

function apiHost() {
  try {
    const base = import.meta.env?.VITE_API_BASE;
    if (base) {
      return `https://${String(base).replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
    }
  } catch { /* */ }
  return window.location.origin;
}

function mediaSrc(url) {
  if (!url) return "";
  let absolute = url;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("blob:")) {
    absolute = url.startsWith("/") ? `${apiHost()}${url}` : `${apiHost()}/${url}`;
  }
  const token = localStorage.getItem("access");
  if (!token) return absolute;
  try {
    const u = new URL(absolute, window.location.origin);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    const sep = absolute.includes("?") ? "&" : "?";
    return `${absolute}${sep}token=${encodeURIComponent(token)}`;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

async function downloadUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
  } catch {
    window.open(url, "_blank");
  }
}

/* ───────── Telegram-like audio player ───────── */
function TelegramAudioPlayer({ src, name, sizeLabel, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const barRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const onTime = () => {
      setCurrent(el.currentTime);
      setProgress(el.duration ? el.currentTime / el.duration : 0);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [src]);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      try {
        await el.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  const seek = (e) => {
    const el = audioRef.current;
    const bar = barRef.current;
    if (!el || !bar || !el.duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio);
  };

  const accent = mine ? "rgba(255,255,255,0.92)" : undefined;
  const trackBg = mine ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";
  const fillBg = mine ? "rgba(255,255,255,0.85)" : "primary.main";

  return (
    <Box
      sx={{
        mt: 0.75,
        minWidth: 260,
        maxWidth: 360,
        p: 1.25,
        borderRadius: 2,
        bgcolor: mine ? "rgba(0,0,0,0.14)" : "action.hover",
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <Stack direction="row" alignItems="center" gap={1.25}>
        <IconButton
          onClick={toggle}
          sx={{
            width: 48,
            height: 48,
            bgcolor: mine ? "rgba(255,255,255,0.2)" : "primary.main",
            color: mine ? "#fff" : "primary.contrastText",
            "&:hover": { bgcolor: mine ? "rgba(255,255,255,0.3)" : "primary.dark" },
            flexShrink: 0,
          }}
        >
          {playing ? <PauseIcon /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
        </IconButton>
        <Box flex={1} minWidth={0}>
          <Stack direction="row" alignItems="center" gap={0.5} mb={0.5}>
            <AudioFileIcon sx={{ fontSize: 16, opacity: 0.85, color: accent }} />
            <Typography
              variant="body2"
              fontWeight={700}
              noWrap
              title={name}
              sx={{ color: accent, flex: 1 }}
            >
              {name}
            </Typography>
          </Stack>
          {/* progress bar */}
          <Box
            ref={barRef}
            onClick={seek}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: trackBg,
              cursor: "pointer",
              position: "relative",
              mb: 0.5,
            }}
          >
            <Box
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${progress * 100}%`,
                bgcolor: fillBg,
                borderRadius: 3,
              }}
            />
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: `${progress * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 12,
                height: 12,
                borderRadius: "50%",
                bgcolor: mine ? "#fff" : "primary.main",
                boxShadow: 1,
              }}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{ opacity: 0.85, color: accent, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(current)} / {formatTime(duration)}
            </Typography>
            <Stack direction="row" gap={0.25}>
              {sizeLabel && (
                <Typography variant="caption" sx={{ opacity: 0.7, color: accent, mr: 0.5 }}>
                  {sizeLabel}
                </Typography>
              )}
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => downloadUrl(src, name)} sx={{ color: accent, p: 0.35 }}>
                  <DownloadIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

/* ───────── Image with lightbox ───────── */
function TelegramImage({ src, name, sizeLabel, mine }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);

  return (
    <>
      <Box sx={{ mt: 0.75, maxWidth: 340, position: "relative" }}>
        <Box
          onClick={() => setOpen(true)}
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            cursor: "zoom-in",
            lineHeight: 0,
            bgcolor: mine ? "rgba(0,0,0,0.12)" : "action.hover",
            border: "1px solid",
            borderColor: mine ? "rgba(255,255,255,0.12)" : "divider",
          }}
        >
          <img
            src={src}
            alt={name}
            loading="lazy"
            style={{
              width: "100%",
              maxHeight: 360,
              objectFit: "cover",
              display: "block",
              minHeight: 120,
            }}
          />
        </Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mt={0.4}>
          <Typography variant="caption" sx={{ opacity: 0.85, wordBreak: "break-all" }}>
            <ImageIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
            {name}{sizeLabel ? ` · ${sizeLabel}` : ""}
          </Typography>
          <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} sx={{ p: 0.25 }}>
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>
        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} dense>
          <MenuItem onClick={() => { setOpen(true); setMenu(null); }}>
            <OpenInNewIcon fontSize="small" sx={{ mr: 1 }} /> Open
          </MenuItem>
          <MenuItem onClick={() => { downloadUrl(src, name); setMenu(null); }}>
            <DownloadIcon fontSize="small" sx={{ mr: 1 }} /> Download
          </MenuItem>
          <MenuItem
            onClick={async () => {
              try {
                const res = await fetch(src);
                const blob = await res.blob();
                if (navigator.clipboard?.write) {
                  await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
                } else {
                  await copyText(src);
                }
              } catch {
                await copyText(src);
              }
              setMenu(null);
            }}
          >
            <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Copy
          </MenuItem>
        </Menu>
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: "rgba(0,0,0,0.92)",
            backgroundImage: "none",
            boxShadow: "none",
            m: 1,
          },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 1, pt: 1 }}>
          <Typography variant="body2" sx={{ color: "#fff", opacity: 0.85 }} noWrap>
            {name}
          </Typography>
          <Stack direction="row">
            <Tooltip title="Download">
              <IconButton onClick={() => downloadUrl(src, name)} sx={{ color: "#fff" }}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy link">
              <IconButton onClick={() => copyText(src)} sx={{ color: "#fff" }}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setOpen(false)} sx={{ color: "#fff" }}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>
        <DialogContent sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 1 }}>
          <img
            src={src}
            alt={name}
            style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: 8 }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttachmentBlock({ a, mine }) {
  const name = a.original_filename || a.name || "file";
  const ct = a.content_type || "";
  const url = a.download_url || a.url;
  const sizeLabel = formatSize(a.size);
  const kind = isImage(ct, name) ? "image" : isAudio(ct, name) ? "audio" : isVideo(ct, name) ? "video" : "file";
  const src = useMemo(() => mediaSrc(url), [url]);

  if (kind === "image") {
    return <TelegramImage src={src} name={name} sizeLabel={sizeLabel} mine={mine} />;
  }
  if (kind === "audio") {
    return <TelegramAudioPlayer src={src} name={name} sizeLabel={sizeLabel} mine={mine} />;
  }
  if (kind === "video") {
    return (
      <Box sx={{ mt: 0.75, maxWidth: 360 }}>
        <video
          controls
          preload="metadata"
          src={src}
          style={{ width: "100%", maxHeight: 280, borderRadius: 12, background: "#000" }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.4}>
          <Typography variant="caption" sx={{ opacity: 0.85 }}>
            <VideocamIcon sx={{ fontSize: 12, mr: 0.4, verticalAlign: "middle" }} />
            {name}{sizeLabel ? ` · ${sizeLabel}` : ""}
          </Typography>
          <Tooltip title="Download">
            <IconButton size="small" onClick={() => downloadUrl(src, name)}>
              <DownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    );
  }

  return (
    <Button
      size="small"
      onClick={() => downloadUrl(src, name)}
      startIcon={<InsertDriveFileIcon />}
      endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
      variant="outlined"
      sx={{
        mt: 0.75,
        maxWidth: "100%",
        justifyContent: "flex-start",
        textTransform: "none",
        color: mine ? "primary.contrastText" : "text.primary",
        borderColor: mine ? "rgba(255,255,255,0.45)" : "divider",
      }}
    >
      <Box sx={{ textAlign: "left", overflow: "hidden" }}>
        <Typography variant="caption" noWrap display="block" title={name} sx={{ maxWidth: 180 }}>
          {name}
        </Typography>
        {sizeLabel && (
          <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 10 }}>
            {sizeLabel}
          </Typography>
        )}
      </Box>
    </Button>
  );
}

export default function MessageBubble({
  message: m,
  mine = false,
  showHtmlToggle = true,
  showAvatar = true,
}) {
  const [showRaw, setShowRaw] = useState(false);
  const [menu, setMenu] = useState(null);
  const [toast, setToast] = useState("");
  const seen = Boolean(m.seen_at || m.is_seen);
  const name = m.author?.username || (m.is_staff_reply ? "Staff" : "User");
  const time = m.created_at
    ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  const bodyHtml = m.body || "";
  const bodyText = bodyHtml.replace(/<[^>]+>/g, "").trim();
  const hasBody = Boolean(bodyText);
  const attachments = m.attachments || [];

  const plainBody = useMemo(() => {
    const d = document.createElement("div");
    d.innerHTML = bodyHtml;
    return (d.textContent || d.innerText || "").trim();
  }, [bodyHtml]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1500);
  };

  return (
    <Stack
      direction="row"
      justifyContent={mine ? "flex-end" : "flex-start"}
      alignItems="flex-end"
      gap={0.75}
      data-message-id={m.id}
      sx={{ width: "100%", px: 0.5 }}
    >
      {!mine && showAvatar ? (
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 13,
            bgcolor: m.is_staff_reply ? "primary.main" : "grey.500",
          }}
        >
          {name[0]?.toUpperCase()}
        </Avatar>
      ) : (
        showAvatar ? <Box sx={{ width: 32 }} /> : null
      )}

      <Box
        sx={{
          maxWidth: { xs: "88%", sm: "74%" },
          minWidth: 100,
          px: 1.4,
          py: 0.95,
          borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          bgcolor: mine ? "primary.main" : "background.paper",
          color: mine ? "primary.contrastText" : "text.primary",
          boxShadow: mine ? "none" : 1,
          border: mine ? "none" : "1px solid",
          borderColor: "divider",
          position: "relative",
        }}
      >
        {/* header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
          {!mine ? (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: m.is_staff_reply ? "primary.main" : "text.secondary",
              }}
            >
              {name}{m.is_staff_reply ? " · Staff" : ""}
            </Typography>
          ) : (
            <Box />
          )}
          <IconButton
            size="small"
            onClick={(e) => setMenu(e.currentTarget)}
            sx={{
              p: 0.25,
              color: mine ? "rgba(255,255,255,0.75)" : "text.secondary",
              ml: "auto",
            }}
          >
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Stack>

        <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} dense>
          {hasBody && (
            <MenuItem
              onClick={async () => {
                const ok = await copyText(plainBody);
                flash(ok ? "Copied" : "Copy failed");
                setMenu(null);
              }}
            >
              <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Copy text
            </MenuItem>
          )}
          {hasBody && (
            <MenuItem
              onClick={async () => {
                await copyText(bodyHtml);
                flash("HTML copied");
                setMenu(null);
              }}
            >
              <CodeIcon fontSize="small" sx={{ mr: 1 }} /> Copy HTML
            </MenuItem>
          )}
          {attachments.map((a) => (
            <MenuItem
              key={a.id || a.download_url}
              onClick={() => {
                downloadUrl(mediaSrc(a.download_url || a.url), a.original_filename || "file");
                setMenu(null);
              }}
            >
              <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
              Download {a.original_filename || "file"}
            </MenuItem>
          ))}
          {showHtmlToggle && hasBody && (
            <MenuItem
              onClick={() => {
                setShowRaw((v) => !v);
                setMenu(null);
              }}
            >
              <CodeIcon fontSize="small" sx={{ mr: 1 }} />
              {showRaw ? "Show rendered" : "Show HTML source"}
            </MenuItem>
          )}
        </Menu>

        {hasBody && !showRaw && (
          <Box
            sx={{
              fontSize: 14.5,
              lineHeight: 1.55,
              wordBreak: "break-word",
              mt: 0.25,
              "& p": { m: 0, mb: 0.5 },
              "& p:last-child": { mb: 0 },
              "& a": { color: mine ? "inherit" : "primary.main", textDecoration: "underline" },
              "& pre": {
                bgcolor: mine ? "rgba(0,0,0,0.15)" : "action.hover",
                p: 1,
                borderRadius: 1,
                overflow: "auto",
                fontSize: 12,
              },
              "& ul, & ol": { pl: 2.25, my: 0.4 },
              "& img": { maxWidth: "100%", borderRadius: 1 },
              userSelect: "text",
            }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}

        {hasBody && showRaw && (
          <Box
            component="pre"
            sx={{
              m: 0,
              mt: 0.5,
              p: 0.75,
              bgcolor: mine ? "rgba(0,0,0,0.12)" : "action.hover",
              borderRadius: 1,
              fontSize: 11,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {bodyHtml}
          </Box>
        )}

        {attachments.map((a) => (
          <AttachmentBlock key={a.id || a.download_url || a.original_filename} a={a} mine={mine} />
        ))}

        <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={0.35} mt={0.5}>
          {toast && (
            <Typography variant="caption" sx={{ opacity: 0.8, mr: "auto" }}>
              {toast}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontSize: 11,
              opacity: 0.8,
              color: mine ? "rgba(255,255,255,0.85)" : "text.secondary",
            }}
          >
            {time}
          </Typography>
          <Box sx={{ color: mine ? "rgba(255,255,255,0.9)" : undefined, display: "inline-flex" }}>
            <SeenTicks seen={seen} mine={mine} />
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
