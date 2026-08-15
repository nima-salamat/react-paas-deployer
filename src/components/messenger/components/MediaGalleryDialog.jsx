import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Dialog, IconButton, Typography, CircularProgress, Stack, Slider, alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

import apiRequest from "../../customHooks/apiRequest";
import { MSG_API, unwrapData } from "../api";
import { attachmentKind, withTokenQuery, formatDuration } from "../messengerUtils";

/**
 * Telegram-style media viewer:
 *  - full-screen dark backdrop
 *  - large centered image / video
 *  - video: custom controls (play, seek, volume, fullscreen)
 *  - arrow navigation between media in the conversation
 */
export default function MediaGalleryDialog({
  open,
  conversationId,
  startAttachment,
  onClose,
  onShowInChat,
  onReply,
  onForward,
  initialItems = null,
  kinds = null,
}) {
  const [items, setItems] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const pendingAdvanceRef = useRef(false);
  const kindsParam = kinds || "image,video";

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [videoError, setVideoError] = useState("");

  // Reset when dialog opens
  useEffect(() => {
    if (!open) {
      setItems([]);
      setIndex(0);
      setHasMore(false);
      setNextBefore(null);
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setVideoError("");
      return;
    }
  }, [open, startAttachment]);

  // Fetch media list (or use list handed from Shared media)
  useEffect(() => {
    if (!open || !startAttachment) return;
    let cancelled = false;
    (async () => {
      // Prefer the same list the user was browsing in Shared media
      if (Array.isArray(initialItems) && initialItems.length) {
        let list = [...initialItems];
        if (startAttachment?.id && !list.some((a) => String(a.id) === String(startAttachment.id))) {
          list = [startAttachment, ...list];
        }
        setItems(list);
        const foundIdx = list.findIndex((a) => String(a.id) === String(startAttachment.id));
        setIndex(foundIdx >= 0 ? foundIdx : 0);
        setHasMore(true); // allow loading older while paging
        setNextBefore(list[list.length - 1]?.message_id || list[list.length - 1]?.message?.id || null);
        return;
      }
      if (!conversationId) return;
      setLoading(true);
      try {
        const k = attachmentKind(startAttachment);
        const kp = kinds || (k === "video" || k === "image" ? "image,video" : k);
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/conversations/${conversationId}/media/?kind=${encodeURIComponent(kp)}&limit=50`,
        });
        if (cancelled) return;
        const data = unwrapData(res);
        let list = data?.results || [];
        if (startAttachment?.id && !list.some((a) => String(a.id) === String(startAttachment.id))) {
          list = [startAttachment, ...list];
        }
        if (!list.length && startAttachment) list = [startAttachment];
        setItems(list);
        setHasMore(Boolean(data?.has_more));
        setNextBefore(data?.next_before_id || null);
        const foundIdx = list.findIndex((a) => String(a.id) === String(startAttachment.id));
        setIndex(foundIdx >= 0 ? foundIdx : 0);
      } catch {
        if (!cancelled && startAttachment) {
          setItems([startAttachment]);
          setIndex(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, conversationId, startAttachment, initialItems, kinds]);


  const loadMore = useCallback(async () => {
    if (!conversationId || loading) return false;
    const cursor = nextBefore;
    if (!cursor && !hasMore) return false;
    setLoading(true);
    try {
      let url = `${MSG_API}/conversations/${conversationId}/media/?kind=${encodeURIComponent(kindsParam)}&limit=40`;
      if (cursor) url += `&before_id=${cursor}`;
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const older = data?.results || [];
      if (!older.length) {
        setHasMore(false);
        setNextBefore(null);
        return false;
      }
      setItems((prev) => {
        const ids = new Set(prev.map((x) => String(x.id)));
        return [...prev, ...older.filter((x) => x?.id != null && !ids.has(String(x.id)))];
      });
      setHasMore(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || older[older.length - 1]?.message_id || null);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [conversationId, hasMore, loading, nextBefore, kindsParam]);

  // After load-more for "next", advance once new items arrive
  useEffect(() => {
    if (!pendingAdvanceRef.current) return;
    pendingAdvanceRef.current = false;
    setIndex((i) => (i < items.length - 1 ? i + 1 : i));
  }, [items.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i < items.length - 1) return i + 1;
      // At end of loaded list → fetch older media, then advance
      if (conversationId && (hasMore || nextBefore)) {
        pendingAdvanceRef.current = true;
        loadMore();
      }
      return i;
    });
  }, [items.length, conversationId, hasMore, nextBefore, loadMore]);

  // Keyboard
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        const v = videoRef.current;
        if (v) {
          if (v.paused) v.play().catch(() => {});
          else v.pause();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext, onClose]);

  // Reset video state when slide changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setVideoError("");
    setShowControls(true);
  }, [index]);

  // Fullscreen change listener
  useEffect(() => {
    const onFs = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const bumpControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2800);
  };

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  if (!open) return null;
  const current = items[index];
  const kind = current ? attachmentKind(current) : null;
  const src = current?.url ? withTokenQuery(current.url) : null;

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setVideoError("Playback blocked"));
    } else {
      v.pause();
    }
  };

  const toggleFs = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* */ }
  };

  const onDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = current?.original_filename || "media";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: "rgba(0,0,0,0.94)",
          backgroundImage: "none",
          m: 0,
          borderRadius: 0,
        },
      }}
    >
      <Box
        ref={containerRef}
        onMouseMove={bumpControls}
        onClick={bumpControls}
        sx={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          userSelect: "none",
        }}
      >
        {/* Top bar */}
        <Box
          sx={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)",
            opacity: showControls || kind !== "video" ? 1 : 0,
            transition: "opacity 0.25s",
          }}
        >
          <Typography variant="body2" sx={{ color: "#fff", flex: 1, minWidth: 0 }} noWrap>
            {current?.original_filename || (kind === "video" ? "Video" : "Photo")}
            {items.length > 1 ? `  ·  ${index + 1}/${items.length}` : ""}
          </Typography>
          {onShowInChat && current && (
            <IconButton
              onClick={() => { onShowInChat(current); onClose?.(); }}
              sx={{ color: "#fff" }}
              title="Show in chat"
            >
              <Typography variant="caption" sx={{ color: "#fff", px: 0.5 }}>In chat</Typography>
            </IconButton>
          )}
          {onReply && current && (
            <IconButton
              onClick={() => { onReply(current); onClose?.(); }}
              sx={{ color: "#fff" }}
              title="Reply"
            >
              <Typography variant="caption" sx={{ color: "#fff", px: 0.5 }}>Reply</Typography>
            </IconButton>
          )}
          {src && (
            <IconButton onClick={onDownload} sx={{ color: "#fff" }} size="small" title="Download">
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton onClick={onClose} sx={{ color: "#fff" }} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Nav arrows */}
        {items.length > 1 && (
          <>
            <IconButton
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={index === 0 && !hasMore}
              sx={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 5, color: "#fff", bgcolor: "rgba(0,0,0,0.35)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.55)" },
                "&.Mui-disabled": { color: "rgba(255,255,255,0.25)" },
              }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={index >= items.length - 1}
              sx={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 5, color: "#fff", bgcolor: "rgba(0,0,0,0.35)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.55)" },
                "&.Mui-disabled": { color: "rgba(255,255,255,0.25)" },
              }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          </>
        )}

        {/* Content */}
        {loading && !items.length ? (
          <CircularProgress sx={{ color: "#fff" }} />
        ) : !current ? (
          <Typography color="rgba(255,255,255,0.7)">No media found</Typography>
        ) : kind === "image" ? (
          <Box
            component="img"
            src={src}
            alt={current.original_filename || ""}
            sx={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : kind === "video" ? (
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              // click empty area toggles play
              if (e.target === e.currentTarget || e.target.tagName === "VIDEO") {
                togglePlay();
              }
            }}
          >
            <video
              key={String(current.id || src)}
              ref={videoRef}
              src={src || undefined}
              playsInline
              autoPlay
              preload="metadata"
              onPlay={() => { setPlaying(true); bumpControls(); }}
              onPause={() => { setPlaying(false); setShowControls(true); }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                setDuration(d && isFinite(d) ? d : 0);
              }}
              onDurationChange={(e) => {
                const d = e.currentTarget.duration;
                setDuration(d && isFinite(d) ? d : 0);
              }}
              onEnded={() => setPlaying(false)}
              onError={() => setVideoError("Could not load video")}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                width: "auto",
                height: "auto",
                objectFit: "contain",
                background: "#000",
                display: "block",
              }}
            />

            {/* Center play hint when paused */}
            {!playing && !videoError && (
              <Box
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                sx={{
                  position: "absolute",
                  width: 72, height: 72, borderRadius: "50%",
                  bgcolor: "rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.35)",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 42, ml: 0.5 }} />
              </Box>
            )}

            {videoError && (
              <Typography sx={{
                position: "absolute", color: "#fff", bgcolor: "rgba(180,30,30,0.85)",
                px: 2, py: 1, borderRadius: 1,
              }}>
                {videoError}
              </Typography>
            )}

            {/* Bottom controls */}
            <Box
              sx={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                px: { xs: 1.5, sm: 3 },
                pt: 6,
                pb: { xs: 1.5, sm: 2 },
                background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                opacity: showControls ? 1 : 0,
                transition: "opacity 0.25s",
                pointerEvents: showControls ? "auto" : "none",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Slider
                size="small"
                value={Math.min(currentTime, duration || 0)}
                max={duration || 1}
                step={0.05}
                onChange={(_, v) => {
                  const t = Array.isArray(v) ? v[0] : v;
                  setCurrentTime(t);
                  if (videoRef.current) {
                    try { videoRef.current.currentTime = t; } catch { /* */ }
                  }
                }}
                sx={{
                  color: "#fff",
                  height: 4,
                  "& .MuiSlider-thumb": { width: 12, height: 12 },
                  mb: 0.5,
                }}
              />
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton size="small" onClick={togglePlay} sx={{ color: "#fff" }}>
                  {playing ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)", minWidth: 88, fontVariantNumeric: "tabular-nums" }}>
                  {formatDuration(currentTime)} / {formatDuration(duration)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <IconButton
                  size="small"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (videoRef.current) videoRef.current.muted = next;
                  }}
                  sx={{ color: "#fff" }}
                >
                  {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
                </IconButton>
                <Slider
                  size="small"
                  value={muted ? 0 : volume}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, v) => {
                    const val = Array.isArray(v) ? v[0] : v;
                    setVolume(val);
                    setMuted(val === 0);
                    if (videoRef.current) {
                      videoRef.current.volume = val;
                      videoRef.current.muted = val === 0;
                    }
                  }}
                  sx={{ width: 80, color: "#fff", mx: 1 }}
                />
                <IconButton size="small" onClick={toggleFs} sx={{ color: "#fff" }}>
                  {isFs ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Stack>
            </Box>
          </Box>
        ) : (
          <Stack alignItems="center" spacing={2}>
            <Typography sx={{ color: "#fff" }}>{current.original_filename || "File"}</Typography>
            <IconButton onClick={onDownload} sx={{ color: "#fff", bgcolor: alpha("#fff", 0.12) }}>
              <DownloadIcon />
            </IconButton>
          </Stack>
        )}
      </Box>
    </Dialog>
  );
}
