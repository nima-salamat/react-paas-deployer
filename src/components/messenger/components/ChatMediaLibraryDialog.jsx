import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, IconButton, Box, Tabs, Tab,
  Typography, Stack, CircularProgress, Menu, MenuItem, ListItemIcon,
  alpha, Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ReplyIcon from "@mui/icons-material/Reply";
import ForwardIcon from "@mui/icons-material/Forward";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ChatIcon from "@mui/icons-material/Chat";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import AudiotrackIcon from "@mui/icons-material/Audiotrack";
import MoreVertIcon from "@mui/icons-material/MoreVert";

import apiRequest from "../../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "../api";
import { withTokenQuery, attachmentKind } from "../messengerUtils";

const TABS = [
  { key: "image", label: "Photos", kinds: "image", icon: <ImageOutlinedIcon fontSize="small" /> },
  { key: "video", label: "Videos", kinds: "video", icon: <VideocamOutlinedIcon fontSize="small" /> },
  { key: "music", label: "Music", kinds: "audio,voice", icon: <AudiotrackIcon fontSize="small" /> },
];

/**
 * Chat-info media browser: Photos / Videos / Music tabs.
 * Newest first; scroll down loads older pages.
 */
export default function ChatMediaLibraryDialog({
  open,
  onClose,
  conversationId,
  onShowInChat,
  onView,
  onDownload,
  onReply,
  onForward,
  embedded = false,
}) {
  const [tab, setTab] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [menu, setMenu] = useState(null); // { anchor, item }

  const scrollRef = useRef(null);
  const loadGen = useRef(0);

  const kinds = TABS[tab]?.kinds || "image";

  const fetchPage = useCallback(async ({ reset } = {}) => {
    if (!open || !conversationId) return;
    const gen = ++loadGen.current;
    if (reset) {
      setLoading(true);
      setItems([]);
      setNextBefore(null);
      setHasMore(false);
    } else {
      if (!hasMore || loadingMore) return;
      setLoadingMore(true);
    }
    try {
      let url = `${MSG_API}/conversations/${conversationId}/media/?kind=${encodeURIComponent(kinds)}&limit=36`;
      if (!reset && nextBefore) url += `&before_id=${nextBefore}`;
      const res = await apiRequest({ method: "GET", url });
      if (gen !== loadGen.current) return;
      const data = unwrapData(res);
      const batch = data?.results || [];
      setItems((prev) => {
        if (reset) return batch;
        const ids = new Set(prev.map((x) => String(x.id)));
        return [...prev, ...batch.filter((x) => x?.id != null && !ids.has(String(x.id)))];
      });
      setHasMore(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || null);
    } catch {
      if (gen === loadGen.current && reset) setItems([]);
    } finally {
      if (gen === loadGen.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [open, conversationId, kinds, hasMore, loadingMore, nextBefore]);

  useEffect(() => {
    if (!open) return;
    fetchPage({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, tab]);

  useEffect(() => {
    if (!open) {
      setTab(0);
      setItems([]);
      setMenu(null);
    }
  }, [open]);

  const onScroll = (e) => {
    const el = e.currentTarget;
    if (!el || loadingMore || !hasMore) return;
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distBottom < 240) fetchPage({ reset: false });
  };

  const closeMenu = () => setMenu(null);

  const run = (fn) => {
    const item = menu?.item;
    closeMenu();
    if (item && fn) fn(item);
  };

  const mediaUrl = (att) => withTokenQuery(att?.file_url || att?.url || att?.file || "");

  const body = (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1.25, px: embedded ? 0 : 2, pr: 1 }}>
        <Box sx={{ flex: 1, fontWeight: 700 }}>Shared media</Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ borderBottom: 1, borderColor: "divider", minHeight: 44 }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.key}
            icon={t.icon}
            iconPosition="start"
            label={t.label}
            sx={{ minHeight: 44, textTransform: "none", fontWeight: 600 }}
          />
        ))}
      </Tabs>

      <DialogContent
        ref={scrollRef}
        onScroll={onScroll}
        dividers
        sx={{
          p: 1,
          flex: 1,
          overflow: "auto",
          bgcolor: (t) => t.palette.mode === "dark" ? "rgba(0,0,0,0.2)" : "grey.50",
        }}
      >
        {loading && !items.length ? (
          <Box sx={{ py: 8, textAlign: "center" }}><CircularProgress size={28} /></Box>
        ) : !items.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
            No {TABS[tab]?.label?.toLowerCase() || "media"} yet
          </Typography>
        ) : tab === 2 ? (
          /* Music / voice list */
          <Stack spacing={0.75}>
            {items.map((att) => (
              <Box
                key={att.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  p: 1,
                  borderRadius: 1.5,
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <AudiotrackIcon color="primary" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap fontWeight={600}>
                    {att.original_filename || att.name || "Audio"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {att.sender?.username || ""}
                    {att.message_created_at
                      ? ` · ${new Date(att.message_created_at).toLocaleString()}`
                      : ""}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, item: att })}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        ) : (
          /* Photo / video grid */
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0.75,
            }}
          >
            {items.map((att) => {
              const kind = attachmentKind(att) || att.kind;
              const url = mediaUrl(att);
              return (
                <Box
                  key={att.id}
                  onClick={() => onView?.(att, { items, kinds })}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ anchor: e.currentTarget, item: att, mouseX: e.clientX, mouseY: e.clientY });
                  }}
                  sx={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: 1.25,
                    overflow: "hidden",
                    cursor: "pointer",
                    bgcolor: "action.hover",
                    "&:hover .media-veil": { opacity: 1 },
                  }}
                >
                  {kind === "video" ? (
                    <Box
                      component="video"
                      src={url}
                      muted
                      preload="metadata"
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Box
                      component="img"
                      src={url}
                      alt=""
                      loading="lazy"
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  {kind === "video" && (
                    <Box
                      sx={{
                        position: "absolute", inset: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        bgcolor: "rgba(0,0,0,0.25)",
                        pointerEvents: "none",
                      }}
                    >
                      <VideocamOutlinedIcon sx={{ color: "#fff", fontSize: 28 }} />
                    </Box>
                  )}
                  <Box
                    className="media-veil"
                    sx={{
                      position: "absolute", top: 4, right: 4, opacity: 0,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenu({ anchor: e.currentTarget, item: att });
                      }}
                      sx={{ bgcolor: alpha("#000", 0.45), color: "#fff", "&:hover": { bgcolor: alpha("#000", 0.65) } }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {loadingMore && (
          <Box sx={{ py: 2, textAlign: "center" }}><CircularProgress size={22} /></Box>
        )}
        {!loading && !loadingMore && hasMore && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", py: 1 }}>
            Scroll for older media
          </Typography>
        )}
      </DialogContent>

      <Menu
        open={Boolean(menu)}
        onClose={closeMenu}
        anchorEl={menu?.anchor}
        anchorReference={menu?.mouseX != null ? "anchorPosition" : "anchorEl"}
        anchorPosition={
          menu?.mouseX != null
            ? { top: menu.mouseY, left: menu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => run((att) => onView?.(att, { items, kinds }))}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          View
        </MenuItem>
        <MenuItem onClick={() => run((att) => onShowInChat?.(att))}>
          <ListItemIcon><ChatIcon fontSize="small" /></ListItemIcon>
          Show in chat
        </MenuItem>
        <MenuItem onClick={() => run((att) => onDownload?.(att))}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Download
        </MenuItem>
        <MenuItem onClick={() => run((att) => onReply?.(att))}>
          <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon>
          Reply
        </MenuItem>
        <MenuItem onClick={() => run((att) => onForward?.(att))}>
          <ListItemIcon><ForwardIcon fontSize="small" /></ListItemIcon>
          Forward
        </MenuItem>
      </Menu>
    </>
  );

  if (embedded) {
    if (!open) return null;
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: 420, height: "100%" }}>
        {body}
      </Box>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 2,
          height: { xs: "85vh", sm: 560 },
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      {body}
    </Dialog>
  );
}
