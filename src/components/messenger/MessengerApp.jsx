/**
 * Full-screen Telegram-like Messenger UI.
 * Hides site navbar/footer when mounted via dedicated route.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Stack, Typography, IconButton, TextField, InputAdornment,
  Avatar, List, ListItemButton, ListItemAvatar, ListItemText, Divider,
  CircularProgress, Menu, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Button, Chip, Tooltip, Badge, Fade,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import ReplyIcon from "@mui/icons-material/Reply";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import LinkIcon from "@mui/icons-material/Link";
import apiRequest from "../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData, unwrapList } from "./api";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function useAuthUserId() {
  try {
    const t = localStorage.getItem("access");
    if (!t) return null;
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.user_id ?? payload.user ?? null;
  } catch {
    return null;
  }
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function convTitle(c, meId) {
  if (c.type === "group") return c.title || "Group";
  if (c.peer) return c.peer.username || "User";
  const other = (c.participants || []).find((p) => p.user?.id !== meId);
  return other?.user?.username || "Chat";
}

function convAvatar(c, meId) {
  if (c.type === "group") return c.avatar || undefined;
  if (c.peer?.avatar) return c.peer.avatar;
  const other = (c.participants || []).find((p) => p.user?.id !== meId);
  return other?.user?.avatar;
}

export default function MessengerApp() {
  const meId = useAuthUserId();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPublic, setGroupPublic] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const wsRef = useRef(null);
  const fileRef = useRef(null);
  const searchTimer = useRef(null);

  // Hide body overflow for full-screen feel
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/conversations/` });
      const data = unwrapData(res);
      setConversations(data?.results || []);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load chats");
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // WebSocket
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;
    const host = API_HOST.replace(/^https/, "wss").replace(/^http/, "ws");
    const ws = new WebSocket(`${host}/ws/messenger/?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.type === "message.new") {
        if (String(data.conversation_id) === String(activeId)) {
          // reload messages or append — simple reload for correctness
          loadMessages(activeId, true);
        }
        loadConversations();
      }
    };
    const ping = setInterval(() => {
      try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
    }, 25000);
    return () => {
      clearInterval(ping);
      try { ws.close(); } catch { /* */ }
    };
  }, [activeId]);

  const subscribeConv = (cid) => {
    try {
      wsRef.current?.send(JSON.stringify({ type: "subscribe", conversation_id: cid }));
    } catch { /* */ }
  };

  const loadMessages = async (cid, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${cid}/messages/?limit=40`,
      });
      const data = unwrapData(res);
      setMessages(data?.results || []);
      setHasMoreMsgs(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || null);
      subscribeConv(cid);
      // mark read
      apiRequest({ method: "POST", url: `${MSG_API}/conversations/${cid}/read/` }).catch(() => {});
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load messages");
    } finally {
      setLoadingMsgs(false);
    }
  };

  const loadOlder = async () => {
    if (!activeId || !hasMoreMsgs || loadingMore || !nextBefore) return;
    setLoadingMore(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${activeId}/messages/?limit=40&before_id=${nextBefore}`,
      });
      const data = unwrapData(res);
      const older = data?.results || [];
      setMessages((prev) => [...older, ...prev]);
      setHasMoreMsgs(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || null);
    } catch { /* */ } finally {
      setLoadingMore(false);
    }
  };

  const openChat = (c) => {
    setActiveId(c.id);
    setMobileShowChat(true);
    setReplyTo(null);
    loadMessages(c.id);
  };

  const sendMessage = async () => {
    if (!activeId) return;
    const body = text.trim();
    if (!body && !files.length) return;
    const form = new FormData();
    form.append("body", body);
    if (replyTo) form.append("reply_to", replyTo.id);
    files.forEach((f) => form.append("files", f));
    setText("");
    setFiles([]);
    setReplyTo(null);
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${activeId}/messages/`,
        data: form,
      });
      const created = unwrapData(res);
      if (created) {
        setMessages((prev) => [...prev, created]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        loadConversations();
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Send failed");
    }
  };

  // User search with debounce + infinite feel
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/users/search/?q=${encodeURIComponent(searchQ.trim())}`,
        });
        setSearchResults(unwrapList(res));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ]);

  const startDm = async (user) => {
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/`,
        data: { type: "private", user_id: user.id },
      });
      const conv = unwrapData(res);
      setSearchQ("");
      setSearchResults([]);
      await loadConversations();
      if (conv) openChat(conv);
    } catch (e) {
      setError(e?.response?.data?.message || "Could not open chat");
    }
  };

  const createGroup = async () => {
    if (!groupTitle.trim()) return;
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/`,
        data: { type: "group", title: groupTitle.trim(), is_public: groupPublic },
      });
      const conv = unwrapData(res);
      setCreateGroupOpen(false);
      setGroupTitle("");
      await loadConversations();
      if (conv) openChat(conv);
    } catch (e) {
      setError(e?.response?.data?.message || "Create group failed");
    }
  };

  const addContact = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/contacts/`, data: { user_id: userId } });
    } catch { /* */ }
  };

  const blockUser = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/blocks/`, data: { user_id: userId } });
      setMenuAnchor(null);
      loadConversations();
    } catch { /* */ }
  };

  const react = async (msgId, emoji) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msgId}/react/`, data: { emoji } });
      loadMessages(activeId, true);
    } catch { /* */ }
  };

  const activeConv = conversations.find((c) => c.id === activeId);

  const onScrollMsgs = (e) => {
    if (e.target.scrollTop < 80 && hasMoreMsgs && !loadingMore) {
      loadOlder();
    }
  };

  // ---- UI ----
  const sidebar = (
    <Box
      sx={{
        width: { xs: "100%", md: 360 },
        height: "100%",
        display: mobileShowChat ? { xs: "none", md: "flex" } : "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, pb: 1 }}>
        <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
          Messenger
        </Typography>
        <Tooltip title="New group">
          <IconButton size="small" onClick={() => setCreateGroupOpen(true)}>
            <GroupAddIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search users…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
              </InputAdornment>
            ),
          }}
        />
      </Box>
      {searchQ.trim() ? (
        <List dense sx={{ overflow: "auto", flex: 1 }}>
          {searchResults.map((u) => (
            <ListItemButton key={u.id} onClick={() => startDm(u)}>
              <ListItemAvatar>
                <Avatar src={u.avatar || undefined}>{u.username?.[0]?.toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={u.username}
                secondary={
                  <Stack direction="row" spacing={0.5}>
                    {u.is_contact && <Chip size="small" label="Contact" />}
                    {u.is_blocked && <Chip size="small" color="error" label="Blocked" />}
                  </Stack>
                }
              />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); addContact(u.id); }}>
                <PersonAddIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
          {!searching && searchResults.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              No users found
            </Typography>
          )}
        </List>
      ) : (
        <List dense sx={{ overflow: "auto", flex: 1 }}>
          {loadingConvs && <Box sx={{ p: 2, textAlign: "center" }}><CircularProgress size={24} /></Box>}
          {conversations.map((c) => (
            <ListItemButton
              key={c.id}
              selected={c.id === activeId}
              onClick={() => openChat(c)}
            >
              <ListItemAvatar>
                <Badge badgeContent={c.unread_count || 0} color="primary" max={99}>
                  <Avatar src={convAvatar(c, meId)}>
                    {convTitle(c, meId)[0]?.toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between">
                    <Typography noWrap fontWeight={c.unread_count ? 700 : 500}>
                      {convTitle(c, meId)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatTime(c.last_message_at)}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Typography noWrap variant="body2" color="text.secondary">
                    {c.last_message?.body || (c.last_message?.has_attachments ? "📎 Attachment" : "No messages")}
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );

  const chatPane = (
    <Box
      sx={{
        flex: 1,
        height: "100%",
        display: (!activeId || (!mobileShowChat && false)) ? { xs: "none", md: "flex" } : "flex",
        flexDirection: "column",
        bgcolor: (t) => (t.palette.mode === "dark" ? "#0e1621" : "#e6ebf0"),
        minWidth: 0,
      }}
    >
      {!activeId ? (
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">Select a chat or search a user</Typography>
        </Box>
      ) : (
        <>
          {/* Header */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              px: 1.5, py: 1,
              bgcolor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <IconButton sx={{ display: { md: "none" } }} onClick={() => setMobileShowChat(false)}>
              <ArrowBackIcon />
            </IconButton>
            <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 40, height: 40 }}>
              {convTitle(activeConv, meId)[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={600} noWrap>{convTitle(activeConv, meId)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {activeConv?.type === "group" ? `${(activeConv.participants || []).length} members` : "private chat"}
              </Typography>
            </Box>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {activeConv?.peer && (
                <MenuItem onClick={() => { addContact(activeConv.peer.id); setMenuAnchor(null); }}>
                  <PersonAddIcon fontSize="small" sx={{ mr: 1 }} /> Add to contacts
                </MenuItem>
              )}
              {activeConv?.peer && (
                <MenuItem onClick={() => blockUser(activeConv.peer.id)}>
                  <BlockIcon fontSize="small" sx={{ mr: 1 }} /> Block
                </MenuItem>
              )}
              {activeConv?.type === "group" && (
                <MenuItem onClick={() => setMenuAnchor(null)}>
                  <LinkIcon fontSize="small" sx={{ mr: 1 }} /> Invite links
                </MenuItem>
              )}
            </Menu>
          </Stack>

          {/* Messages */}
          <Box
            ref={listRef}
            onScroll={onScrollMsgs}
            sx={{ flex: 1, overflow: "auto", px: 1.5, py: 1 }}
          >
            {loadingMore && (
              <Box sx={{ textAlign: "center", py: 1 }}><CircularProgress size={20} /></Box>
            )}
            {loadingMsgs && !messages.length && (
              <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
            )}
            {messages.map((m) => {
              const mine = String(m.sender?.id) === String(meId);
              return (
                <Box
                  key={m.id}
                  sx={{
                    display: "flex",
                    justifyContent: mine ? "flex-end" : "flex-start",
                    mb: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: "75%",
                      px: 1.4,
                      py: 0.9,
                      borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      bgcolor: mine ? "primary.main" : "background.paper",
                      color: mine ? "primary.contrastText" : "text.primary",
                      boxShadow: 1,
                    }}
                  >
                    {!mine && (
                      <Typography variant="caption" fontWeight={700} color="primary.light">
                        {m.sender?.username}
                      </Typography>
                    )}
                    {m.reply_to_preview && (
                      <Box
                        sx={{
                          borderLeft: "3px solid",
                          borderColor: mine ? "rgba(255,255,255,0.5)" : "primary.main",
                          pl: 1, mb: 0.5, opacity: 0.9,
                          fontSize: 12,
                        }}
                      >
                        <Typography variant="caption" fontWeight={600}>
                          {m.reply_to_preview.sender?.username || "…"}
                        </Typography>
                        <Typography variant="caption" display="block" noWrap>
                          {m.reply_to_preview.body}
                        </Typography>
                      </Box>
                    )}
                    {m.forwarded_from_user && (
                      <Typography variant="caption" sx={{ opacity: 0.8 }} display="block">
                        Forwarded from {m.forwarded_from_user.username}
                      </Typography>
                    )}
                    <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14.5 }}>
                      {typeof m.body === "string" ? m.body : String(m.body || "")}
                    </Typography>
                    {(m.attachments || []).map((a) => (
                      <Box key={a.id} sx={{ mt: 0.5 }}>
                        {a.kind === "image" || a.kind === "gif" ? (
                          <Box
                            component="img"
                            src={a.url}
                            alt={a.original_filename}
                            sx={{ maxWidth: "100%", borderRadius: 1, maxHeight: 280 }}
                          />
                        ) : a.kind === "video" ? (
                          <Box component="video" src={a.url} controls sx={{ maxWidth: "100%", borderRadius: 1, maxHeight: 280 }} />
                        ) : (
                          <Chip
                            component="a"
                            href={a.url}
                            target="_blank"
                            clickable
                            label={a.original_filename || "file"}
                            size="small"
                          />
                        )}
                      </Box>
                    ))}
                    <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5} mt={0.3}>
                      {(m.reactions || []).length > 0 && (
                        <Stack direction="row" spacing={0.25} sx={{ mr: "auto" }}>
                          {[...new Set((m.reactions || []).map((r) => r.emoji))].map((em) => (
                            <Chip
                              key={em}
                              size="small"
                              label={`${em} ${(m.reactions || []).filter((r) => r.emoji === em).length}`}
                              onClick={() => react(m.id, em)}
                              sx={{ height: 22, fontSize: 11 }}
                            />
                          ))}
                        </Stack>
                      )}
                      <IconButton size="small" sx={{ p: 0.25, color: mine ? "rgba(255,255,255,0.7)" : "text.secondary" }} onClick={() => setReplyTo(m)}>
                        <ReplyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        sx={{ p: 0.25, color: mine ? "rgba(255,255,255,0.7)" : "text.secondary" }}
                        onClick={(e) => {
                          // simple reaction picker: first reaction
                          react(m.id, "👍");
                        }}
                      >
                        <EmojiEmotionsIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11 }}>
                        {formatTime(m.created_at)}
                      </Typography>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
            <div ref={bottomRef} />
          </Box>

          {/* Reply bar */}
          {replyTo && (
            <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 0.5, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
              <ReplyIcon fontSize="small" sx={{ mr: 1 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" fontWeight={600}>{replyTo.sender?.username}</Typography>
                <Typography variant="caption" display="block" noWrap>{replyTo.body}</Typography>
              </Box>
              <IconButton size="small" onClick={() => setReplyTo(null)}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
          )}

          {/* Composer */}
          <Stack
            direction="row"
            alignItems="flex-end"
            spacing={0.5}
            sx={{ p: 1, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/*,video/*,audio/*,.gif,.pdf,.zip"
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            <IconButton onClick={() => fileRef.current?.click()}>
              <AttachFileIcon />
            </IconButton>
            <TextField
              fullWidth
              multiline
              maxRows={5}
              size="small"
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <IconButton color="primary" onClick={sendMessage} disabled={!text.trim() && !files.length}>
              <SendIcon />
            </IconButton>
          </Stack>
          {files.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ px: 1, pb: 1, bgcolor: "background.paper", flexWrap: "wrap" }}>
              {files.map((f, i) => (
                <Chip key={i} size="small" label={f.name} onDelete={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        display: "flex",
        bgcolor: "background.default",
      }}
    >
      {sidebar}
      {chatPane}

      <Dialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Group title"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            sx={{ mt: 1 }}
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
            <PublicIcon fontSize="small" />
            <Typography variant="body2" sx={{ flex: 1 }}>Public (searchable)</Typography>
            <Button size="small" variant={groupPublic ? "contained" : "outlined"} onClick={() => setGroupPublic((v) => !v)}>
              {groupPublic ? "Yes" : "No"}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGroup} disabled={!groupTitle.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Fade in>
          <Chip
            label={error}
            color="error"
            onDelete={() => setError("")}
            sx={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 1400 }}
          />
        </Fade>
      )}
    </Box>
  );
}

// needed for WS host
const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
