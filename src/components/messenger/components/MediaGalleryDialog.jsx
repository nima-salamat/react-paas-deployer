import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog, IconButton, Box, Typography, CircularProgress, Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DownloadIcon from "@mui/icons-material/Download";

import apiRequest from "../../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "../api";
import { attachmentKind, withTokenQuery } from "../messengerUtils";

/**
 * Full-screen media gallery with < > navigation across all media attachments
 * in a conversation. Fetches paginated media from the backend so the user can
 * browse images that haven't been loaded into the visible message list.
 *
 * Props:
 *  - open: boolean
 *  - conversationId: number | null
 *  - startAttachment: { id, url, kind, ... } | null  — the media the user clicked
 *  - onClose: () => void
 */
export default function MediaGalleryDialog({ open, conversationId, startAttachment, onClose }) {
  const [items, setItems] = useState([]);          // all media attachments (newest-first)
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [kinds, setKinds] = useState(["image"]);

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setIndex(0);
    setHasMore(false);
    setNextBefore(null);
    if (startAttachment) {
      const k = attachmentKind(startAttachment);
      setKinds(k === "video" ? ["image", "video"] : [k]);
    }
  }, [open, startAttachment]);

  // Initial load when conversationId is available
  useEffect(() => {
    if (!open || !conversationId || !startAttachment) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const k = attachmentKind(startAttachment);
        const kindsParam = k === "video" ? "image,video" : k;
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/conversations/${conversationId}/media/?kind=${kindsParam}&limit=50`,
        });
        if (cancelled) return;
        const data = unwrapData(res);
        const list = data?.results || [];
        setItems(list);
        setHasMore(Boolean(data?.has_more));
        setNextBefore(data?.next_before_id || null);
        // Find the clicked attachment in the list
        const foundIdx = list.findIndex((a) => String(a.id) === String(startAttachment.id));
        setIndex(foundIdx >= 0 ? foundIdx : 0);
      } catch { /* */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, conversationId, startAttachment]);

  // Load more (older media) when user hits the left arrow on the oldest loaded item
  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || loading || !nextBefore) return;
    setLoading(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${conversationId}/media/?kind=${kinds.join(",")}&before_id=${nextBefore}&limit=50`,
      });
      const data = unwrapData(res);
      const older = data?.results || [];
      setItems((prev) => [...prev, ...older]);
      setHasMore(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || null);
    } catch { /* */ } finally { setLoading(false); }
  }, [conversationId, hasMore, loading, nextBefore, kinds]);

  const goPrev = useCallback(() => {
    setIndex((i) => {
      if (i > 0) return i - 1;
      // Wrap to last OR load more
      if (hasMore) loadMore();
      return i;
    });
  }, [hasMore, loadMore]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < items.length - 1 ? i + 1 : i));
  }, [items.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext, onClose]);

  if (!open) return null;
  const current = items[index];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { bgcolor: "background.default", position: "relative", minHeight: "60vh" } }}
    >
      <IconButton
        onClick={onClose}
        sx={{ position: "absolute", top: 8, right: 8, zIndex: 3, bgcolor: "rgba(0,0,0,0.4)", color: "#fff" }}
      >
        <CloseIcon />
      </IconButton>
      {current?.url && (
        <IconButton
          onClick={() => window.open(withTokenQuery(current.url), "_blank")}
          sx={{ position: "absolute", top: 8, right: 56, zIndex: 3, bgcolor: "rgba(0,0,0,0.4)", color: "#fff" }}
          title="Download"
        >
          <DownloadIcon />
        </IconButton>
      )}
      {items.length > 1 && (
        <>
          <IconButton
            onClick={goPrev}
            disabled={index === 0 && !hasMore}
            sx={{
              position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
              zIndex: 3, bgcolor: "rgba(0,0,0,0.4)", color: "#fff",
              "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              "&.Mui-disabled": { bgcolor: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.3)" },
            }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
          <IconButton
            onClick={goNext}
            disabled={index >= items.length - 1}
            sx={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              zIndex: 3, bgcolor: "rgba(0,0,0,0.4)", color: "#fff",
              "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              "&.Mui-disabled": { bgcolor: "rgba(0,0,0,0.2)", color: "rgba(255,255,255,0.3)" },
            }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        </>
      )}
      <Box sx={{
        position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
        zIndex: 3, bgcolor: "rgba(0,0,0,0.5)", color: "#fff",
        px: 1.5, py: 0.3, borderRadius: 2, fontSize: 12,
      }}>
        {items.length ? `${index + 1} / ${items.length}` : "—"}
      </Box>
      <Box sx={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "60vh", maxHeight: "85vh", p: 2,
      }}>
        {loading && !items.length ? (
          <CircularProgress />
        ) : !current ? (
          <Typography color="text.secondary">No media found</Typography>
        ) : attachmentKind(current) === "image" ? (
          <Box
            component="img"
            src={withTokenQuery(current.url)}
            alt={current.original_filename || ""}
            sx={{ maxWidth: "100%", maxHeight: "80vh", display: "block", borderRadius: 1 }}
          />
        ) : attachmentKind(current) === "video" ? (
          <Box
            component="video"
            controls
            autoPlay
            sx={{ maxWidth: "100%", maxHeight: "80vh" }}
          >
            <source src={withTokenQuery(current.url)} type={current.content_type || "video/mp4"} />
          </Box>
        ) : (
          <Stack alignItems="center" spacing={2}>
            <Typography>{current.original_filename || "File"}</Typography>
            <IconButton onClick={() => window.open(withTokenQuery(current.url), "_blank")}>
              <DownloadIcon />
            </IconButton>
          </Stack>
        )}
      </Box>
      {current && (
        <Box sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          bgcolor: "rgba(0,0,0,0.5)", color: "#fff", px: 2, py: 0.75,
          fontSize: 12,
        }}>
          {current.sender?.username && <span>@{current.sender.username} · </span>}
          {current.original_filename || "Media"}
          {current.message_id && <span> · msg #{current.message_id}</span>}
        </Box>
      )}
    </Dialog>
  );
}
