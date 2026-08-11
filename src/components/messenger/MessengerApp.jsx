/**
 * Full-screen messenger — Telegram-like
 * URL hash: #c/<conversationId> | #u/<username>  (survives reload)
 * Esc → leave chat to list (clears hash)
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Stack, Typography, IconButton, TextField, InputAdornment, Avatar,
  List, ListItemButton, ListItemAvatar, ListItemText, Divider, CircularProgress,
  MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Chip, Tooltip, Badge, Drawer, ListItemIcon, Switch, FormControlLabel,
  Tabs, Tab, Fade, Paper, Popover, Select, FormControl,
  useMediaQuery, alpha, Menu,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
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
import MenuIcon from "@mui/icons-material/Menu";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ForwardIcon from "@mui/icons-material/Forward";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ContactsIcon from "@mui/icons-material/Contacts";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import DoneIcon from "@mui/icons-material/Done";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import apiRequest from "../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData, unwrapList } from "./api";

const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉", "🤔", "👎"];
const PAGE_SIZE = 30;

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
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function convTitle(c, meId) {
  if (!c) return "";
  if (c.type === "group") return c.title || "Group";
  if (c.peer) return c.peer.username || "User";
  const other = (c.participants || []).find((p) => p.user?.id !== meId);
  return other?.user?.username || "Chat";
}

function convAvatar(c, meId) {
  if (!c) return undefined;
  if (c.type === "group") return c.avatar || undefined;
  if (c.peer?.avatar) return c.peer.avatar;
  const other = (c.participants || []).find((p) => p.user?.id !== meId);
  return other?.user?.avatar;
}

function peerUser(c, meId) {
  if (!c || c.type === "group") return null;
  if (c.peer) return c.peer;
  const other = (c.participants || []).find((p) => p.user?.id !== meId);
  return other?.user || null;
}

function myRole(c, meId) {
  const p = (c?.participants || []).find((x) => String(x.user?.id) === String(meId));
  return p?.role || "member";
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t || "");
    return true;
  } catch {
    return false;
  }
}

function parseHash() {
  const h = (window.location.hash || "").replace(/^#/, "");
  if (h.startsWith("c/")) return { type: "c", value: h.slice(2) };
  if (h.startsWith("u/")) return { type: "u", value: decodeURIComponent(h.slice(2)) };
  return null;
}

function setHash(type, value) {
  if (!type || value == null || value === "") {
    const { pathname, search } = window.location;
    window.history.replaceState(null, "", pathname + search);
    return;
  }
  const hash = type === "u" ? `#u/${encodeURIComponent(value)}` : `#c/${value}`;
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", pathname + search + hash);
}

function attachmentKind(a) {
  const kind = (a?.kind || "").toLowerCase();
  const ct = (a?.content_type || "").toLowerCase();
  const name = (a?.original_filename || "").toLowerCase();
  if (kind === "image" || kind === "gif" || ct.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/.test(name)) return "image";
  if (kind === "video" || ct.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/.test(name)) return "video";
  if (kind === "audio" || kind === "voice" || ct.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|opus)$/.test(name)) return "audio";
  if (ct === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (ct.startsWith("text/") || /\.(txt|md|csv|log|json)$/.test(name)) return "text";
  return "file";
}

/* ================================================================== */

export default function MessengerApp() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const meId = useAuthUserId();

  const [drawerOpen, setDrawerOpen] = useState(!isMobile);
  const [rightPanel, setRightPanel] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeDetail, setActiveDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);

  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [listTab, setListTab] = useState(0);

  // custom context menu: { x, y, message }
  const [ctx, setCtx] = useState(null);
  const [reactAnchor, setReactAnchor] = useState(null);
  const [headerMenu, setHeaderMenu] = useState(null);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPublic, setGroupPublic] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [privacyScope, setPrivacyScope] = useState("everyone");
  const [contacts, setContacts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [inviteLinks, setInviteLinks] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null); // { att, textContent? }
  const [confirmDelete, setConfirmDelete] = useState(null); // 'chat' | 'group'
  const [hashReady, setHashReady] = useState(false);

  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const wsRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);
  const activeIdRef = useRef(null);
  const bootstrapped = useRef(false);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(true);
  }, [isMobile]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  /* -------------------- loaders -------------------- */

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/conversations/?page_size=50` });
      const data = unwrapData(res);
      setConversations(data?.results || []);
      return data?.results || [];
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load chats");
      return [];
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadConversationDetail = useCallback(async (cid) => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/conversations/${cid}/` });
      const data = unwrapData(res);
      setActiveDetail(data);
      setInviteLinks(data?.invite_links || []);
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadMessages = useCallback(async (cid, { silent = false, reset = true } = {}) => {
    if (!cid) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${cid}/messages/?limit=${PAGE_SIZE}`,
      });
      const data = unwrapData(res);
      const items = data?.results || [];
      setMessages(items);
      setHasMoreMsgs(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || (items.length ? items[0].id : null));
      try {
        wsRef.current?.send(JSON.stringify({ type: "subscribe", conversation_id: Number(cid) }));
      } catch { /* */ }
      apiRequest({ method: "POST", url: `${MSG_API}/conversations/${cid}/read/` }).catch(() => {});
      if (!silent) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 30);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load messages");
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const loadOlder = useCallback(async () => {
    if (!activeIdRef.current || !hasMoreMsgs || loadingMore || !nextBefore) return;
    setLoadingMore(true);
    const el = listRef.current;
    const prevH = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${activeIdRef.current}/messages/?limit=${PAGE_SIZE}&before_id=${nextBefore}`,
      });
      const data = unwrapData(res);
      const older = data?.results || [];
      if (!older.length) {
        setHasMoreMsgs(false);
        setNextBefore(null);
        return;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const merged = [...older.filter((m) => !ids.has(m.id)), ...prev];
        return merged;
      });
      setHasMoreMsgs(Boolean(data?.has_more));
      setNextBefore(data?.next_before_id || older[0]?.id || null);
      requestAnimationFrame(() => {
        if (el) {
          const diff = el.scrollHeight - prevH;
          el.scrollTop = prevTop + diff;
        }
      });
    } catch { /* */ } finally {
      setLoadingMore(false);
    }
  }, [hasMoreMsgs, loadingMore, nextBefore]);

  const closeChat = useCallback(() => {
    setActiveId(null);
    setActiveDetail(null);
    setMessages([]);
    setMobileShowChat(false);
    setReplyTo(null);
    setEditingMsg(null);
    setText("");
    setRightPanel(null);
    setHashReady(true);
    setHash(null);
    if (isMobile) setDrawerOpen(true);
  }, [isMobile]);

  const openChat = useCallback(async (c, { hashUser } = {}) => {
    if (!c?.id) return;
    setActiveId(c.id);
    setMobileShowChat(true);
    setReplyTo(null);
    setEditingMsg(null);
    setText("");
    setCtx(null);
    if (isMobile) setDrawerOpen(false);
    if (hashUser) setHash("u", hashUser);
    else if (c.type === "private" && c.peer?.username) setHash("u", c.peer.username);
    else setHash("c", c.id);
    await Promise.all([
      loadMessages(c.id),
      loadConversationDetail(c.id),
    ]);
  }, [isMobile, loadMessages, loadConversationDetail]);

  /* bootstrap + hash restore */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadConversations();
      if (cancelled || bootstrapped.current) return;
      bootstrapped.current = true;
      const h = parseHash();
      if (!h) {
        setHashReady(true);
        return;
      }
      if (h.type === "c") {
        const found = list.find((x) => String(x.id) === String(h.value));
        if (found) await openChat(found);
        else {
          try {
            const res = await apiRequest({ method: "GET", url: `${MSG_API}/conversations/${h.value}/` });
            const data = unwrapData(res);
            if (data) {
              setConversations((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]));
              await openChat(data);
            }
          } catch { /* */ }
        }
      } else if (h.type === "u" && h.value) {
        const byPeer = list.find(
          (x) => x.type === "private" && (x.peer?.username || "").toLowerCase() === h.value.toLowerCase()
        );
        if (byPeer) {
          await openChat(byPeer, { hashUser: h.value });
        } else {
          try {
            const res = await apiRequest({
              method: "GET",
              url: `${MSG_API}/users/search/?q=${encodeURIComponent(h.value)}`,
            });
            const users = unwrapList(res);
            const user = users.find((u) => u.username?.toLowerCase() === h.value.toLowerCase()) || users[0];
            if (user) {
              const cr = await apiRequest({
                method: "POST",
                url: `${MSG_API}/conversations/`,
                data: { type: "private", user_id: user.id },
              });
              const conv = unwrapData(cr);
              await loadConversations();
              if (conv) await openChat(conv, { hashUser: user.username });
            }
          } catch { /* */ }
        }
      }
      setHashReady(true);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* WebSocket */
  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return undefined;
    const host = API_HOST.replace(/^https/, "wss").replace(/^http/, "ws");
    const ws = new WebSocket(`${host}/ws/messenger/?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.type === "message.new" || data.type === "message.edited" || data.type === "message.reaction") {
        if (String(data.conversation_id) === String(activeIdRef.current)) {
          loadMessages(activeIdRef.current, { silent: true });
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
  }, [loadConversations, loadMessages]);

  /* Esc global */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (preview) { setPreview(null); return; }
      if (ctx) { setCtx(null); return; }
      if (reactAnchor) { setReactAnchor(null); return; }
      if (editingMsg) { setEditingMsg(null); setText(""); return; }
      if (replyTo) { setReplyTo(null); return; }
      if (rightPanel) { setRightPanel(null); return; }
      if (activeId) { closeChat(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, ctx, reactAnchor, editingMsg, replyTo, rightPanel, activeId, closeChat]);

  /* search users */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim()) {
      setSearchResults([]);
      return undefined;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/users/search/?q=${encodeURIComponent(searchQ.trim())}&page_size=30`,
        });
        setSearchResults(unwrapList(res));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ]);

  /* -------------------- actions -------------------- */

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
      if (conv) await openChat(conv, { hashUser: user.username });
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
      setGroupPublic(false);
      await loadConversations();
      if (conv) await openChat(conv);
    } catch (e) {
      setError(e?.response?.data?.message || "Create group failed");
    }
  };

  const sendOrEdit = async () => {
    if (!activeId) return;
    const body = text.trim();
    if (editingMsg) {
      if (!body) return;
      try {
        const res = await apiRequest({
          method: "PATCH",
          url: `${MSG_API}/messages/${editingMsg.id}/edit/`,
          data: { body },
        });
        const updated = unwrapData(res);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditingMsg(null);
        setText("");
        flash("Edited");
      } catch (e) {
        setError(e?.response?.data?.message || "Edit failed");
      }
      return;
    }
    if (!body && !files.length) return;
    const form = new FormData();
    form.append("body", body);
    if (replyTo) form.append("reply_to", replyTo.id);
    files.forEach((f) => form.append("files", f));
    setText("");
    setFiles([]);
    const rep = replyTo;
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
      if (rep) setReplyTo(rep);
      setError(e?.response?.data?.message || "Send failed");
    }
  };

  const startEdit = (m) => {
    setEditingMsg(m);
    setReplyTo(null);
    setText(typeof m.body === "string" ? m.body : String(m.body || ""));
    setCtx(null);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const onComposerKeyDown = (e) => {
    if (e.key === "ArrowUp" && !text.trim() && !editingMsg) {
      const lastMine = [...messages].reverse().find((m) => String(m.sender?.id) === String(meId) && !m.is_deleted);
      if (lastMine) {
        e.preventDefault();
        startEdit(lastMine);
      }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendOrEdit();
    }
  };

  const react = async (msgId, emoji) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msgId}/react/`, data: { emoji } });
      loadMessages(activeId, { silent: true });
    } catch { /* */ }
    setReactAnchor(null);
    setCtx(null);
  };

  const deleteMsg = async (m) => {
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/messages/${m.id}/` });
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      flash("Deleted");
    } catch (e) {
      setError(e?.response?.data?.message || "Delete failed");
    }
    setCtx(null);
  };

  const forwardTo = async (convId) => {
    if (!forwardOpen) return;
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/messages/${forwardOpen.id}/forward/`,
        data: { conversation_id: convId },
      });
      flash("Forwarded");
      setForwardOpen(null);
      if (String(convId) === String(activeId)) loadMessages(activeId, { silent: true });
      loadConversations();
    } catch (e) {
      setError(e?.response?.data?.message || "Forward failed");
    }
  };

  const addContact = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/contacts/`, data: { user_id: userId } });
      flash("Added to contacts");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed");
    }
  };

  const removeContact = async (userId) => {
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/contacts/${userId}/` });
      flash("Removed");
      setContacts((prev) => prev.filter((c) => c.contact?.id !== userId));
    } catch { /* */ }
  };

  const blockUser = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/blocks/`, data: { user_id: userId } });
      flash("Blocked");
      setHeaderMenu(null);
      loadConversations();
    } catch (e) {
      setError(e?.response?.data?.message || "Block failed");
    }
  };

  const unblockUser = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/blocks/${userId}/unblock/` });
      flash("Unblocked");
      setBlocks((prev) => prev.filter((u) => u.id !== userId));
    } catch { /* */ }
  };

  const leaveChat = async () => {
    if (!activeId) return;
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/conversations/${activeId}/leave/` });
      setHeaderMenu(null);
      closeChat();
      loadConversations();
      flash("Left chat");
    } catch (e) {
      setError(e?.response?.data?.message || "Leave failed");
    }
  };

  const deleteConversation = async () => {
    if (!activeId) return;
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/conversations/${activeId}/delete/` });
      setConfirmDelete(null);
      setHeaderMenu(null);
      closeChat();
      loadConversations();
      flash(confirmDelete === "group" ? "Group deleted" : "Chat deleted");
    } catch (e) {
      setError(e?.response?.data?.message || "Delete failed");
      setConfirmDelete(null);
    }
  };

  const patchGroup = async (patch) => {
    if (!activeId) return;
    try {
      const res = await apiRequest({
        method: "PATCH",
        url: `${MSG_API}/conversations/${activeId}/`,
        data: patch,
      });
      const data = unwrapData(res);
      setActiveDetail(data);
      setConversations((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
      flash("Updated");
    } catch (e) {
      setError(e?.response?.data?.message || "Update failed");
    }
  };

  const createInvite = async () => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/conversations/${activeId}/invite-links/`, data: {} });
      flash("Invite created");
      loadConversationDetail(activeId);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed");
    }
  };

  const revokeInvite = async (linkId) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${activeId}/invite-links/${linkId}/revoke/`,
      });
      loadConversationDetail(activeId);
      flash("Revoked");
    } catch { /* */ }
  };

  const joinByCode = async () => {
    if (!joinCode.trim()) return;
    try {
      const code = joinCode.trim().split("/").pop();
      const res = await apiRequest({ method: "POST", url: `${MSG_API}/join/${code}/` });
      const conv = unwrapData(res);
      setJoinOpen(false);
      setJoinCode("");
      await loadConversations();
      if (conv) await openChat(conv);
    } catch (e) {
      setError(e?.response?.data?.message || "Invalid invite");
    }
  };

  const savePrivacy = async (scope) => {
    try {
      await apiRequest({ method: "PATCH", url: `${MSG_API}/me/photo-privacy/`, data: { scope } });
      setPrivacyScope(scope);
      flash("Privacy saved");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed");
    }
  };

  const loadContacts = async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/contacts/` });
      setContacts(unwrapData(res) || []);
    } catch { setContacts([]); }
  };

  const loadBlocks = async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/blocks/` });
      setBlocks(unwrapData(res) || []);
    } catch { setBlocks([]); }
  };

  const loadMyPrivacy = async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/photos/` });
      const data = unwrapData(res);
      setPrivacyScope(data?.privacy?.scope || "everyone");
      setProfileData((p) => ({ ...(p || { id: meId }), photos: data?.photos || [], privacy: data?.privacy }));
    } catch { /* */ }
  };

  const loadUserProfile = async (userId) => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/users/${userId}/profile/` });
      setProfileData(unwrapData(res));
      setRightPanel("profile");
    } catch (e) {
      flash(e?.response?.data?.message || "Could not load profile");
    }
  };

  const searchPublicGroups = async (q) => {
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/groups/search/?q=${encodeURIComponent(q || "")}`,
      });
      setPublicGroups(unwrapData(res) || []);
    } catch {
      setPublicGroups([]);
    }
  };

  const openPreview = async (att) => {
    const k = attachmentKind(att);
    if (k === "text") {
      try {
        const token = localStorage.getItem("access");
        const r = await fetch(att.url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const textContent = await r.text();
        setPreview({ att, kind: k, textContent: textContent.slice(0, 200000) });
      } catch {
        setPreview({ att, kind: k, textContent: "(Could not load text)" });
      }
      return;
    }
    setPreview({ att, kind: k });
  };

  const activeConv = activeDetail || conversations.find((c) => c.id === activeId);
  const peer = peerUser(activeConv, meId);
  const role = myRole(activeConv, meId);

  const onScrollMsgs = (e) => {
    if (e.target.scrollTop < 100 && hasMoreMsgs && !loadingMore) {
      loadOlder();
    }
  };

  const messagesWithDays = useMemo(() => {
    const out = [];
    let lastDay = "";
    for (const m of messages) {
      const day = formatDay(m.created_at);
      if (day !== lastDay) {
        out.push({ type: "day", id: `day-${day}-${m.id}`, label: day });
        lastDay = day;
      }
      out.push({ type: "msg", ...m });
    }
    return out;
  }, [messages]);

  const openCtx = (e, message) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, message });
  };

  /* -------------------- sidebar -------------------- */

  const sidebarContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "background.paper" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ p: 1.25 }}>
        <Tooltip title="Menu">
          <IconButton size="small" onClick={() => setRightPanel((p) => (p === "settings" ? null : "settings"))}>
            <MenuIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>Messenger</Typography>
        <Tooltip title="New group">
          <IconButton size="small" onClick={() => setCreateGroupOpen(true)}><GroupAddIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Join invite">
          <IconButton size="small" onClick={() => setJoinOpen(true)}><LinkIcon fontSize="small" /></IconButton>
        </Tooltip>
        <Tooltip title="Back to Deployer">
          <IconButton size="small" color="primary" onClick={() => navigate("/")}>
            <HomeOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ px: 1.25, pb: 1 }}>
        <TextField
          fullWidth size="small" placeholder="Search users…"
          value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {searching ? <CircularProgress size={14} /> : <SearchIcon fontSize="small" />}
              </InputAdornment>
            ),
            endAdornment: searchQ ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQ("")}><CloseIcon fontSize="small" /></IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {!searchQ.trim() && (
        <Tabs value={listTab} onChange={(_, v) => { setListTab(v); if (v === 1) searchPublicGroups(""); }}
          variant="fullWidth" sx={{ minHeight: 36, "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: 13 } }}>
          <Tab label="Chats" />
          <Tab label="Public groups" />
        </Tabs>
      )}

      {searchQ.trim() ? (
        <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
          {searchResults.map((u) => (
            <ListItemButton key={u.id} onClick={() => startDm(u)}>
              <ListItemAvatar>
                <Avatar src={u.avatar || undefined}>{u.username?.[0]?.toUpperCase()}</Avatar>
              </ListItemAvatar>
              <ListItemText primary={u.username} secondary={u.is_contact ? "Contact" : "User"} />
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); addContact(u.id); }}>
                <PersonAddIcon fontSize="small" />
              </IconButton>
            </ListItemButton>
          ))}
          {!searching && !searchResults.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No users found</Typography>
          )}
        </List>
      ) : listTab === 1 ? (
        <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
          <Box sx={{ px: 1.25, py: 1 }}>
            <TextField fullWidth size="small" placeholder="Search public groups…"
              onChange={(e) => searchPublicGroups(e.target.value)} />
          </Box>
          {publicGroups.map((g) => (
            <ListItemButton key={g.id} onClick={() => openChat(g)}>
              <ListItemAvatar><Avatar src={g.avatar || undefined}><PublicIcon /></Avatar></ListItemAvatar>
              <ListItemText primary={g.title} secondary={g.description || "Public group"} />
            </ListItemButton>
          ))}
        </List>
      ) : (
        <List dense sx={{ overflow: "auto", flex: 1, py: 0 }}>
          {loadingConvs && <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={22} /></Box>}
          {!loadingConvs && !conversations.length && (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              No chats yet. Search a username to start.
            </Typography>
          )}
          {conversations.map((c) => (
            <ListItemButton
              key={c.id}
              selected={c.id === activeId}
              onClick={() => openChat(c)}
              sx={{ py: 1.1, "&.Mui-selected": { bgcolor: (t) => alpha(t.palette.primary.main, 0.12) } }}
            >
              <ListItemAvatar>
                <Badge badgeContent={c.unread_count || 0} color="primary" max={99} overlap="circular">
                  <Avatar src={convAvatar(c, meId)} sx={{ width: 48, height: 48 }}>
                    {convTitle(c, meId)[0]?.toUpperCase()}
                  </Avatar>
                </Badge>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography noWrap fontWeight={c.unread_count ? 700 : 600} fontSize={14.5}>
                      {convTitle(c, meId)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                      {formatTime(c.last_message_at)}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Typography noWrap variant="body2" color="text.secondary" fontSize={13}>
                    {c.last_message?.body || (c.last_message?.has_attachments ? "📎 Attachment" : "No messages yet")}
                  </Typography>
                }
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );

  /* -------------------- message row -------------------- */

  const renderMessage = (m) => {
    if (m.type === "day") {
      return (
        <Box key={m.id} sx={{ textAlign: "center", my: 1.5 }}>
          <Chip label={m.label} size="small" sx={{ bgcolor: alpha(theme.palette.background.paper, 0.9), fontSize: 11 }} />
        </Box>
      );
    }
    const mine = String(m.sender?.id) === String(meId);
    const bodyStr = typeof m.body === "string" ? m.body : String(m.body || "");
    return (
      <Box
        key={m.id}
        sx={{
          display: "flex",
          justifyContent: mine ? "flex-end" : "flex-start",
          mb: 0.6,
          px: 0.5,
          "&:hover .msg-actions": { opacity: 1 },
        }}
        onContextMenu={(e) => openCtx(e, m)}
      >
        {!mine && (
          <Avatar
            src={m.sender?.avatar || undefined}
            sx={{ width: 28, height: 28, mr: 0.75, mt: 0.5, cursor: "pointer" }}
            onClick={() => m.sender?.id && loadUserProfile(m.sender.id)}
          >
            {m.sender?.username?.[0]?.toUpperCase()}
          </Avatar>
        )}
        <Box
          sx={{
            maxWidth: { xs: "82%", sm: "70%" },
            px: 1.35,
            py: 0.85,
            borderRadius: mine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
            bgcolor: mine
              ? (theme.palette.mode === "dark" ? "#2b5278" : theme.palette.primary.main)
              : "background.paper",
            color: mine ? "#fff" : "text.primary",
            boxShadow: theme.palette.mode === "dark" ? "none" : 1,
          }}
        >
          {!mine && activeConv?.type === "group" && (
            <Typography variant="caption" fontWeight={700} sx={{ color: "primary.light", cursor: "pointer", display: "block" }}
              onClick={() => m.sender?.id && loadUserProfile(m.sender.id)}>
              {m.sender?.username}
            </Typography>
          )}
          {m.reply_to_preview && (
            <Box sx={{
              borderLeft: "3px solid", borderColor: mine ? "rgba(255,255,255,0.55)" : "primary.main",
              pl: 1, mb: 0.5, fontSize: 12,
              bgcolor: mine ? "rgba(0,0,0,0.12)" : alpha(theme.palette.primary.main, 0.06),
              borderRadius: "0 6px 6px 0", py: 0.35, pr: 0.5,
            }}>
              <Typography variant="caption" fontWeight={700} display="block">
                {m.reply_to_preview.sender?.username || "…"}
              </Typography>
              <Typography variant="caption" noWrap display="block">{m.reply_to_preview.body}</Typography>
            </Box>
          )}
          {m.forwarded_from_user && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ opacity: 0.85, mb: 0.25 }}>
              <ForwardIcon sx={{ fontSize: 12 }} />
              <Typography variant="caption">Forwarded from {m.forwarded_from_user.username}</Typography>
            </Stack>
          )}
          {bodyStr && (
            <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14.5, lineHeight: 1.45 }}>
              {bodyStr}
            </Typography>
          )}
          {(m.attachments || []).map((a) => {
            const k = attachmentKind(a);
            return (
              <Box key={a.id} sx={{ mt: 0.6 }}>
                {k === "image" ? (
                  <Box component="img" src={a.url} alt={a.original_filename}
                    onClick={() => openPreview(a)}
                    sx={{ maxWidth: "100%", borderRadius: 1.5, maxHeight: 320, display: "block", cursor: "pointer" }} />
                ) : k === "video" ? (
                  <Box component="video" src={a.url} controls
                    sx={{ maxWidth: "100%", borderRadius: 1.5, maxHeight: 320, display: "block" }} />
                ) : (
                  <Chip
                    icon={k === "audio" ? undefined : <VisibilityIcon />}
                    label={a.original_filename || "file"}
                    size="small"
                    onClick={() => openPreview(a)}
                    onDelete={() => window.open(a.url, "_blank")}
                    deleteIcon={<DownloadIcon />}
                    sx={{ maxWidth: "100%", cursor: "pointer" }}
                  />
                )}
              </Box>
            );
          })}
          {(m.reactions || []).length > 0 && (
            <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {[...new Set((m.reactions || []).map((r) => r.emoji))].map((em) => {
                const count = (m.reactions || []).filter((r) => r.emoji === em).length;
                const mineReact = (m.reactions || []).some((r) => r.emoji === em && String(r.user?.id) === String(meId));
                return (
                  <Chip key={em} size="small" label={`${em} ${count}`} onClick={() => react(m.id, em)}
                    sx={{
                      height: 22, fontSize: 11,
                      bgcolor: mineReact
                        ? alpha(theme.palette.primary.main, mine ? 0.35 : 0.15)
                        : (mine ? "rgba(255,255,255,0.12)" : "action.hover"),
                      color: mine ? "#fff" : "text.primary",
                    }}
                  />
                );
              })}
            </Stack>
          )}
          <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.4} mt={0.35}>
            <IconButton className="msg-actions" size="small"
              sx={{ p: 0.2, opacity: { xs: 0.65, md: 0 }, color: mine ? "rgba(255,255,255,0.75)" : "text.secondary" }}
              onClick={(e) => setReactAnchor({ anchorEl: e.currentTarget, message: m })}>
              <EmojiEmotionsIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton className="msg-actions" size="small"
              sx={{ p: 0.2, opacity: { xs: 0.65, md: 0 }, color: mine ? "rgba(255,255,255,0.75)" : "text.secondary" }}
              onClick={() => { setReplyTo(m); setEditingMsg(null); inputRef.current?.focus(); }}>
              <ReplyIcon sx={{ fontSize: 15 }} />
            </IconButton>
            {m.is_edited && <Typography variant="caption" sx={{ opacity: 0.7, fontSize: 10 }}>edited</Typography>}
            <Typography variant="caption" sx={{ opacity: 0.75, fontSize: 11 }}>{formatTime(m.created_at)}</Typography>
            {mine && <DoneAllIcon sx={{ fontSize: 14, opacity: 0.75 }} />}
          </Stack>
        </Box>
      </Box>
    );
  };

  /* -------------------- chat pane -------------------- */

  const chatPane = (
    <Box
      sx={{
        flex: 1, height: "100%",
        display: (!activeId && isMobile) || (isMobile && !mobileShowChat) ? "none" : "flex",
        flexDirection: "column",
        bgcolor: theme.palette.mode === "dark" ? "#0e1621" : "#e7ebf0",
        minWidth: 0,
      }}
      onContextMenu={(e) => {
        // block browser menu on empty chat area
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      {!activeId ? (
        <Box sx={{ flex: 1, display: { xs: "none", md: "flex" }, alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1 }}>
          <Typography color="text.secondary" variant="h6" fontWeight={500}>Messenger</Typography>
          <Typography color="text.secondary" variant="body2">Select a chat or search for a user</Typography>
          <Typography color="text.secondary" variant="caption">Tip: Esc closes a chat · ArrowUp edits your last message</Typography>
          <Button startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>Back to Deployer</Button>
        </Box>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{ px: 1, py: 0.85, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", minHeight: 56 }}>
            {isMobile && (
              <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>
            )}
            {!isMobile && (
              <IconButton onClick={() => setDrawerOpen((v) => !v)} size="small"><MenuIcon /></IconButton>
            )}
            <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 40, height: 40, cursor: "pointer" }}
              onClick={() => (peer?.id ? loadUserProfile(peer.id) : setRightPanel("info"))}>
              {convTitle(activeConv, meId)[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
              onClick={() => (peer?.id ? loadUserProfile(peer.id) : setRightPanel("info"))}>
              <Typography fontWeight={600} noWrap fontSize={15}>{convTitle(activeConv, meId)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {activeConv?.type === "group"
                  ? `${(activeConv?.participants || []).length} members`
                  : peer?.username ? `@${peer.username}` : "tap for info"}
              </Typography>
            </Box>
            <IconButton onClick={() => setRightPanel((p) => (p === "info" ? null : "info"))}><InfoOutlinedIcon /></IconButton>
            <IconButton onClick={(e) => setHeaderMenu(e.currentTarget)}><MoreVertIcon /></IconButton>
            <Menu anchorEl={headerMenu} open={Boolean(headerMenu)} onClose={() => setHeaderMenu(null)}>
              {peer && (
                <MenuItem onClick={() => { loadUserProfile(peer.id); setHeaderMenu(null); }}>
                  <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon> View profile
                </MenuItem>
              )}
              {peer && (
                <MenuItem onClick={() => { addContact(peer.id); setHeaderMenu(null); }}>
                  <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon> Add contact
                </MenuItem>
              )}
              {peer && (
                <MenuItem onClick={() => blockUser(peer.id)}>
                  <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Block
                </MenuItem>
              )}
              {activeConv?.type === "private" && (
                <MenuItem onClick={() => { setConfirmDelete("chat"); setHeaderMenu(null); }} sx={{ color: "error.main" }}>
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete chat
                </MenuItem>
              )}
              {activeConv?.type === "group" && (role === "owner" || role === "admin") && (
                <MenuItem onClick={() => { setConfirmDelete("group"); setHeaderMenu(null); }} sx={{ color: "error.main" }}>
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete group
                </MenuItem>
              )}
              <MenuItem onClick={leaveChat}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon> Leave
              </MenuItem>
            </Menu>
          </Stack>

          <Box ref={listRef} onScroll={onScrollMsgs} sx={{ flex: 1, overflow: "auto", px: { xs: 0.75, sm: 1.5 }, py: 1 }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {hasMoreMsgs && (
              <Box sx={{ textAlign: "center", py: 1 }}>
                {loadingMore ? <CircularProgress size={18} /> : (
                  <Button size="small" onClick={loadOlder}>Load older messages</Button>
                )}
              </Box>
            )}
            {loadingMsgs && !messages.length && (
              <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>
            )}
            {messagesWithDays.map((m) => renderMessage(m))}
            <div ref={bottomRef} />
          </Box>

          {(replyTo || editingMsg) && (
            <Stack direction="row" alignItems="center"
              sx={{ px: 1.5, py: 0.7, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
              {editingMsg ? <EditIcon fontSize="small" sx={{ mr: 1, color: "warning.main" }} /> : <ReplyIcon fontSize="small" sx={{ mr: 1 }} />}
              <Box sx={{ flex: 1, minWidth: 0, borderLeft: "3px solid", borderColor: editingMsg ? "warning.main" : "primary.main", pl: 1 }}>
                <Typography variant="caption" fontWeight={700}>
                  {editingMsg ? "Edit message" : `Reply to ${replyTo?.sender?.username || ""}`}
                </Typography>
                <Typography variant="caption" display="block" noWrap color="text.secondary">
                  {editingMsg ? editingMsg.body : replyTo?.body}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => { setReplyTo(null); setEditingMsg(null); setText(""); }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}

          <Stack direction="row" alignItems="flex-end" spacing={0.5}
            sx={{ p: 1, bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
            <input ref={fileRef} type="file" multiple hidden
              accept="image/*,video/*,audio/*,.gif,.pdf,.txt,.zip,.doc,.docx,.md,.csv"
              onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {!editingMsg && (
              <IconButton onClick={() => fileRef.current?.click()}><AttachFileIcon /></IconButton>
            )}
            {editingMsg && (
              <IconButton onClick={() => { setEditingMsg(null); setText(""); }}>
                <KeyboardArrowUpIcon color="warning" />
              </IconButton>
            )}
            <TextField
              inputRef={inputRef} fullWidth multiline maxRows={6} size="small"
              placeholder={editingMsg ? "Edit message…" : "Message"}
              value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onComposerKeyDown}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 3, bgcolor: "action.hover" } }}
            />
            <IconButton color="primary" onClick={sendOrEdit}
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
            <Stack direction="row" spacing={0.5} sx={{ px: 1, pb: 1, bgcolor: "background.paper", flexWrap: "wrap", gap: 0.5 }}>
              {files.map((f, i) => (
                <Chip key={i} size="small" label={f.name} onDelete={() => setFiles((prev) => prev.filter((_, j) => j !== i))} />
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  );

  /* -------------------- right panel -------------------- */

  const rightPanelWidth = 320;
  const renderRightPanel = () => {
    if (!rightPanel) return null;

    if (rightPanel === "settings") {
      return (
        <Box sx={{ width: isMobile ? "100%" : rightPanelWidth, height: "100%", borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
            <Typography fontWeight={700} sx={{ flex: 1 }}>Menu</Typography>
            <IconButton size="small" onClick={() => setRightPanel(null)}><CloseIcon /></IconButton>
          </Stack>
          <Divider />
          <List>
            <ListItemButton onClick={() => { loadMyPrivacy(); setProfileData((p) => ({ ...p, id: meId, username: "me" })); setRightPanel("profile"); }}>
              <ListItemIcon><AccountCircleIcon /></ListItemIcon>
              <ListItemText primary="My profile & photo privacy" />
            </ListItemButton>
            <ListItemButton onClick={() => { loadContacts(); setRightPanel("contacts"); }}>
              <ListItemIcon><ContactsIcon /></ListItemIcon>
              <ListItemText primary="Contacts" />
            </ListItemButton>
            <ListItemButton onClick={() => { loadBlocks(); setRightPanel("blocks"); }}>
              <ListItemIcon><BlockIcon /></ListItemIcon>
              <ListItemText primary="Blocked users" />
            </ListItemButton>
            <ListItemButton onClick={() => setCreateGroupOpen(true)}>
              <ListItemIcon><GroupAddIcon /></ListItemIcon>
              <ListItemText primary="New group" />
            </ListItemButton>
            <ListItemButton onClick={() => setJoinOpen(true)}>
              <ListItemIcon><LinkIcon /></ListItemIcon>
              <ListItemText primary="Join with invite" />
            </ListItemButton>
            <Divider sx={{ my: 1 }} />
            <ListItemButton onClick={() => navigate("/")}>
              <ListItemIcon><HomeOutlinedIcon /></ListItemIcon>
              <ListItemText primary="Back to Deployer" />
            </ListItemButton>
          </List>
        </Box>
      );
    }

    if (rightPanel === "contacts") {
      return (
        <Box sx={{ width: isMobile ? "100%" : rightPanelWidth, height: "100%", borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
          <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
            <Typography fontWeight={700} sx={{ flex: 1 }}>Contacts</Typography>
            <IconButton size="small" onClick={() => setRightPanel(null)}><CloseIcon /></IconButton>
          </Stack>
          <Divider />
          <List dense sx={{ overflow: "auto", flex: 1 }}>
            {contacts.map((c) => (
              <ListItemButton key={c.id} onClick={() => c.contact && startDm(c.contact)}>
                <ListItemAvatar><Avatar src={c.contact?.avatar || undefined}>{c.contact?.username?.[0]}</Avatar></ListItemAvatar>
                <ListItemText primary={c.nickname || c.contact?.username} secondary={c.contact?.username} />
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeContact(c.contact?.id); }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItemButton>
            ))}
            {!contacts.length && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No contacts</Typography>}
          </List>
        </Box>
      );
    }

    if (rightPanel === "blocks") {
      return (
        <Box sx={{ width: isMobile ? "100%" : rightPanelWidth, height: "100%", borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper", display: "flex", flexDirection: "column" }}>
          <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
            <Typography fontWeight={700} sx={{ flex: 1 }}>Blocked</Typography>
            <IconButton size="small" onClick={() => setRightPanel(null)}><CloseIcon /></IconButton>
          </Stack>
          <Divider />
          <List dense sx={{ overflow: "auto", flex: 1 }}>
            {blocks.map((u) => (
              <ListItemButton key={u.id}>
                <ListItemAvatar><Avatar src={u.avatar || undefined}>{u.username?.[0]}</Avatar></ListItemAvatar>
                <ListItemText primary={u.username} />
                <Button size="small" onClick={() => unblockUser(u.id)}>Unblock</Button>
              </ListItemButton>
            ))}
            {!blocks.length && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>None</Typography>}
          </List>
        </Box>
      );
    }

    if (rightPanel === "profile") {
      const isMe = profileData && (String(profileData.id) === String(meId) || profileData.username === "me");
      return (
        <Box sx={{ width: isMobile ? "100%" : rightPanelWidth, height: "100%", borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "auto" }}>
          <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
            <Typography fontWeight={700} sx={{ flex: 1 }}>{isMe ? "My profile" : "Profile"}</Typography>
            <IconButton size="small" onClick={() => setRightPanel(null)}><CloseIcon /></IconButton>
          </Stack>
          <Divider />
          <Box sx={{ p: 2, textAlign: "center" }}>
            <Avatar src={profileData?.avatar || profileData?.photos?.[0]?.url} sx={{ width: 96, height: 96, mx: "auto", mb: 1, fontSize: 36 }}>
              {profileData?.username?.[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="h6">{isMe ? "You" : profileData?.username}</Typography>
          </Box>
          {(profileData?.photos || []).length > 0 && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>Photos</Typography>
              <Stack direction="row" spacing={1} sx={{ overflowX: "auto" }}>
                {profileData.photos.map((ph) => (
                  <Box key={ph.id} component="img" src={ph.url} alt=""
                    onClick={() => openPreview({ url: ph.url, original_filename: "photo", kind: "image", content_type: "image/jpeg" })}
                    sx={{ width: 72, height: 72, borderRadius: 1, objectFit: "cover", flexShrink: 0, cursor: "pointer" }} />
                ))}
              </Stack>
            </Box>
          )}
          {isMe && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <LockOutlinedIcon fontSize="small" /> Who can see my photos
              </Typography>
              <FormControl fullWidth size="small">
                <Select value={privacyScope} onChange={(e) => savePrivacy(e.target.value)}>
                  <MenuItem value="everyone">Everyone</MenuItem>
                  <MenuItem value="contacts">Contacts only</MenuItem>
                  <MenuItem value="nobody">Nobody</MenuItem>
                  <MenuItem value="specific">Specific users</MenuItem>
                </Select>
              </FormControl>
              <Button fullWidth variant="outlined" sx={{ mt: 1.5 }} onClick={() => navigate("/profile")}>
                Edit profile photos
              </Button>
            </Box>
          )}
          {!isMe && profileData?.id && (
            <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
              <Button variant="contained" onClick={() => startDm(profileData)}>Message</Button>
              <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => addContact(profileData.id)}>Add contact</Button>
              <Button color="error" variant="outlined" startIcon={<BlockIcon />} onClick={() => blockUser(profileData.id)}>Block</Button>
            </Stack>
          )}
        </Box>
      );
    }

    // info
    const parts = activeConv?.participants || [];
    return (
      <Box sx={{ width: isMobile ? "100%" : rightPanelWidth, height: "100%", borderLeft: "1px solid", borderColor: "divider", bgcolor: "background.paper", overflow: "auto" }}>
        <Stack direction="row" alignItems="center" sx={{ p: 1.5 }}>
          <Typography fontWeight={700} sx={{ flex: 1 }}>
            {activeConv?.type === "group" ? "Group info" : "Chat info"}
          </Typography>
          <IconButton size="small" onClick={() => setRightPanel(null)}><CloseIcon /></IconButton>
        </Stack>
        <Divider />
        <Box sx={{ p: 2, textAlign: "center" }}>
          <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 80, height: 80, mx: "auto", mb: 1 }}>
            {convTitle(activeConv, meId)[0]?.toUpperCase()}
          </Avatar>
          <Typography variant="h6">{convTitle(activeConv, meId)}</Typography>
          {peer && <Typography variant="body2" color="text.secondary">@{peer.username}</Typography>}
        </Box>

        {activeConv?.type === "group" && (
          <Box sx={{ px: 2, pb: 2 }}>
            {(role === "owner" || role === "admin") && (
              <>
                <TextField fullWidth size="small" label="Group title" defaultValue={activeConv.title || ""}
                  onBlur={(e) => {
                    if (e.target.value.trim() && e.target.value !== activeConv.title) patchGroup({ title: e.target.value.trim() });
                  }} sx={{ mb: 1.5 }} />
                <TextField fullWidth size="small" label="Description" multiline minRows={2}
                  defaultValue={activeConv.description || ""}
                  onBlur={(e) => {
                    if (e.target.value !== (activeConv.description || "")) patchGroup({ description: e.target.value });
                  }} sx={{ mb: 1.5 }} />
                <FormControlLabel
                  control={<Switch checked={Boolean(activeConv.is_public)} onChange={(e) => patchGroup({ is_public: e.target.checked })} />}
                  label="Public (searchable)"
                />
                <FormControlLabel
                  control={<Switch checked={Boolean(activeConv.is_closed)} onChange={(e) => patchGroup({ is_closed: e.target.checked })} />}
                  label="Closed"
                />
                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Invite links</Typography>
                <Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={createInvite} sx={{ mb: 1 }}>Create link</Button>
                {(inviteLinks || []).map((l) => (
                  <Paper key={l.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
                    <Typography variant="caption" sx={{ wordBreak: "break-all" }}>{l.url || l.code}</Typography>
                    <Stack direction="row" spacing={1} mt={0.5}>
                      <Button size="small" onClick={() => { copyText(l.url || l.code); flash("Copied"); }}>Copy</Button>
                      <Button size="small" color="error" onClick={() => revokeInvite(l.id)}>Revoke</Button>
                    </Stack>
                  </Paper>
                ))}
              </>
            )}

            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Members ({parts.length})
            </Typography>
            <List dense>
              {parts.map((p) => (
                <ListItemButton key={p.id || p.user?.id} onClick={() => p.user?.id && loadUserProfile(p.user.id)}>
                  <ListItemAvatar>
                    <Avatar src={p.user?.avatar || undefined} sx={{ width: 36, height: 36 }}>{p.user?.username?.[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={p.user?.username} secondary={p.role} />
                </ListItemButton>
              ))}
              {!parts.length && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>No members loaded</Typography>
              )}
            </List>

            {(role === "owner" || role === "admin") && (
              <Button fullWidth color="error" variant="outlined" sx={{ mt: 2 }}
                onClick={() => setConfirmDelete("group")}>
                Delete group
              </Button>
            )}
          </Box>
        )}

        {activeConv?.type === "private" && peer && (
          <Stack spacing={1} sx={{ px: 2, pb: 2 }}>
            <Button variant="outlined" onClick={() => loadUserProfile(peer.id)}>View profile</Button>
            <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => addContact(peer.id)}>Add contact</Button>
            <Button color="error" variant="outlined" startIcon={<BlockIcon />} onClick={() => blockUser(peer.id)}>Block</Button>
            <Button color="error" variant="contained" startIcon={<DeleteOutlineIcon />}
              onClick={() => setConfirmDelete("chat")}>
              Delete chat
            </Button>
          </Stack>
        )}
      </Box>
    );
  };

  /* -------------------- custom context menu -------------------- */

  const ctxMsg = ctx?.message;
  const ctxAtts = ctxMsg?.attachments || [];
  const ctxMine = ctxMsg && String(ctxMsg.sender?.id) === String(meId);

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", bgcolor: "background.default" }}
      onClick={() => { if (ctx) setCtx(null); }}
    >
      {isMobile ? (
        <Drawer open={drawerOpen && !mobileShowChat} onClose={() => setDrawerOpen(false)} variant="temporary"
          ModalProps={{ keepMounted: true }}
          sx={{ "& .MuiDrawer-paper": { width: "100%", maxWidth: 420 } }}>
          {sidebarContent}
        </Drawer>
      ) : (
        <Box sx={{
          width: drawerOpen ? 360 : 0, transition: "width 0.2s", overflow: "hidden", height: "100%",
          borderRight: drawerOpen ? "1px solid" : "none", borderColor: "divider", flexShrink: 0,
        }}>
          <Box sx={{ width: 360, height: "100%" }}>{sidebarContent}</Box>
        </Box>
      )}

      {chatPane}

      {!isMobile && rightPanel && renderRightPanel()}
      {isMobile && (
        <Drawer anchor="right" open={Boolean(rightPanel)} onClose={() => setRightPanel(null)}
          sx={{ "& .MuiDrawer-paper": { width: "100%", maxWidth: 360 } }}>
          {renderRightPanel()}
        </Drawer>
      )}

      {/* Custom right-click menu */}
      {ctx && (
        <Paper
          elevation={8}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          sx={{
            position: "fixed",
            top: Math.min(ctx.y, window.innerHeight - 320),
            left: Math.min(ctx.x, window.innerWidth - 220),
            zIndex: 2000,
            minWidth: 200,
            py: 0.5,
            borderRadius: 2,
          }}
        >
          <MenuItem onClick={() => { setReplyTo(ctxMsg); setEditingMsg(null); setCtx(null); inputRef.current?.focus(); }}>
            <ListItemIcon><ReplyIcon fontSize="small" /></ListItemIcon> Reply
          </MenuItem>
          <MenuItem onClick={(e) => {
            setReactAnchor({ anchorEl: e.currentTarget, message: ctxMsg });
            setCtx(null);
          }}>
            <ListItemIcon><EmojiEmotionsIcon fontSize="small" /></ListItemIcon> React
          </MenuItem>
          <MenuItem onClick={() => { setForwardOpen(ctxMsg); setCtx(null); }}>
            <ListItemIcon><ForwardIcon fontSize="small" /></ListItemIcon> Forward
          </MenuItem>
          <MenuItem onClick={async () => {
            await copyText(typeof ctxMsg?.body === "string" ? ctxMsg.body : "");
            flash("Copied");
            setCtx(null);
          }}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon> Copy text
          </MenuItem>
          {ctxAtts.map((a) => (
            <MenuItem key={a.id} onClick={() => { openPreview(a); setCtx(null); }}>
              <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
              Preview {a.original_filename || "file"}
            </MenuItem>
          ))}
          {ctxAtts.map((a) => (
            <MenuItem key={`dl-${a.id}`} onClick={() => { window.open(a.url, "_blank"); setCtx(null); }}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
              Download {a.original_filename || "file"}
            </MenuItem>
          ))}
          {ctxMine && (
            <MenuItem onClick={() => startEdit(ctxMsg)}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon> Edit
            </MenuItem>
          )}
          {ctxMine && (
            <MenuItem onClick={() => deleteMsg(ctxMsg)} sx={{ color: "error.main" }}>
              <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete
            </MenuItem>
          )}
        </Paper>
      )}

      <Popover
        open={Boolean(reactAnchor)}
        anchorEl={reactAnchor?.anchorEl}
        onClose={() => setReactAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Stack direction="row" spacing={0.25} sx={{ p: 0.75, flexWrap: "wrap", maxWidth: 280 }}>
          {REACTIONS.map((em) => (
            <IconButton key={em} size="small" onClick={() => react(reactAnchor.message.id, em)} sx={{ fontSize: 22 }}>
              {em}
            </IconButton>
          ))}
        </Stack>
      </Popover>

      {/* Media / file preview popup */}
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: "background.default" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography noWrap sx={{ flex: 1 }} fontWeight={600}>
            {preview?.att?.original_filename || "Preview"}
          </Typography>
          {preview?.att?.url && (
            <IconButton onClick={() => window.open(preview.att.url, "_blank")}><DownloadIcon /></IconButton>
          )}
          <IconButton onClick={() => setPreview(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 240, display: "flex", justifyContent: "center", alignItems: "center" }}>
          {preview?.kind === "image" && (
            <Box component="img" src={preview.att.url} alt="" sx={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 1 }} />
          )}
          {preview?.kind === "video" && (
            <Box component="video" src={preview.att.url} controls autoPlay sx={{ maxWidth: "100%", maxHeight: "70vh" }} />
          )}
          {preview?.kind === "audio" && (
            <Box sx={{ width: "100%", p: 2 }}>
              <Typography gutterBottom>{preview.att.original_filename}</Typography>
              <audio src={preview.att.url} controls style={{ width: "100%" }} />
            </Box>
          )}
          {preview?.kind === "pdf" && (
            <Box component="iframe" src={preview.att.url} title="pdf"
              sx={{ width: "100%", height: "70vh", border: 0, borderRadius: 1 }} />
          )}
          {preview?.kind === "text" && (
            <Box component="pre" sx={{
              m: 0, p: 2, width: "100%", maxHeight: "70vh", overflow: "auto",
              bgcolor: "action.hover", borderRadius: 1, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {preview.textContent}
            </Box>
          )}
          {preview?.kind === "file" && (
            <Stack alignItems="center" spacing={2}>
              <Typography>No inline preview for this file type.</Typography>
              <Button variant="contained" startIcon={<DownloadIcon />}
                onClick={() => window.open(preview.att.url, "_blank")}>
                Download
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(forwardOpen)} onClose={() => setForwardOpen(null)} fullWidth maxWidth="xs">
        <DialogTitle>Forward to…</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 360 }}>
          <List dense>
            {conversations.map((c) => (
              <ListItemButton key={c.id} onClick={() => forwardTo(c.id)}>
                <ListItemAvatar>
                  <Avatar src={convAvatar(c, meId)}>{convTitle(c, meId)[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText primary={convTitle(c, meId)} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions><Button onClick={() => setForwardOpen(null)}>Cancel</Button></DialogActions>
      </Dialog>

      <Dialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Group title" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} sx={{ mt: 1 }} />
          <FormControlLabel sx={{ mt: 1.5 }}
            control={<Switch checked={groupPublic} onChange={(e) => setGroupPublic(e.target.checked)} />}
            label="Public (appears in search)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGroup} disabled={!groupTitle.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join with invite code</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={joinByCode} disabled={!joinCode.trim()}>Join</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>{confirmDelete === "group" ? "Delete group?" : "Delete chat?"}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirmDelete === "group"
              ? "This permanently deletes the group and all messages for everyone."
              : "This deletes the conversation for both sides."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={deleteConversation}>Delete</Button>
        </DialogActions>
      </Dialog>

      {toast && (
        <Fade in>
          <Chip label={toast} color="success"
            sx={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1400 }} />
        </Fade>
      )}
      {error && (
        <Fade in>
          <Chip label={error} color="error" onDelete={() => setError("")}
            sx={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 1400 }} />
        </Fade>
      )}
      {!hashReady && (
        <Box sx={{ position: "fixed", inset: 0, bgcolor: "background.default", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
