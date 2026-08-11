/**
 * Messenger — Telegram-like full-screen UI
 *
 * URL hash: #c/<conversationId> | #u/<username>  (survives reload)
 * Esc → leave chat to list (clears hash)
 *
 * Multi-module structure:
 *   MessengerApp            — main shell + state orchestration
 *   Sidebar                 — chat list + right-click menu + pin + 999+ unread
 *   MessageBubble           — single message + attachments + read ticks + @mentions
 *   MessageComposer         — text input + attach + reply/edit + voice/video record
 *   ImageCropDialog         — preview + crop before sending images
 *   ReadReceiptsDialog      — "Seen by" / unread list
 *   RightPanel              — settings / contacts / blocks / info / profile
 *   ProfileView             — read-only other-user profile (with photo gallery)
 *   MessengerProfileEditor  — own profile photos + drag reorder + privacy
 *   ConfirmDialog           — generic confirmation popup
 *   ContextMenu             — reusable right-click menu (closes on outside click)
 *   AudioPlayerBar          — top audio player bar (Telegram-style, cross-chat)
 *   MediaGalleryDialog      — in-chat image gallery with < > navigation
 */
import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, IconButton, CircularProgress, Menu, MenuItem, ListItemIcon,
  Stack, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControlLabel, Switch, List, ListItemButton, ListItemAvatar,
  ListItemText, Divider, Fade, Chip, Popover, useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MenuIcon from "@mui/icons-material/Menu";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LinkIcon from "@mui/icons-material/Link";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import CloseIcon from "@mui/icons-material/Close";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

import apiRequest from "../customHooks/apiRequest.jsx";
import { MSG_API, WS_URL, unwrapData, unwrapList, authHeaders } from "./api";
import {
  useAuthUserId, formatDay, convTitle, convAvatar, peerUser, myRole,
  copyText, parseHash, setHash, attachmentKind, withTokenQuery, REACTIONS, PAGE_SIZE,
} from "./messengerUtils";
import Sidebar from "./components/Sidebar";
import MessageBubble, { MessageContextMenuItems } from "./components/MessageBubble";
import MessageComposer from "./components/MessageComposer";
import ImageCropDialog from "./components/ImageCropDialog";
import ReadReceiptsDialog from "./components/ReadReceiptsDialog";
import RightPanel from "./components/RightPanel";
import MessengerProfileEditor from "./MessengerProfileEditor";
import ConfirmDialog from "./components/ConfirmDialog";
import ContextMenu from "./components/ContextMenu";
import AudioPlayerBar from "./components/AudioPlayerBar";
import MediaGalleryDialog from "./components/MediaGalleryDialog";

export default function MessengerApp() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const meId = useAuthUserId();

  // Layout
  const [drawerOpen, setDrawerOpen] = useState(true);
  // Panel history stack — supports back-button navigation inside the modal
  // Each entry: "settings" | "contacts" | "blocks" | "info" | "profile" | "my-profile"
  const [panelHistory, setPanelHistory] = useState([]);
  const rightPanel = panelHistory.length ? panelHistory[panelHistory.length - 1] : null;
  const [mobileShowChat, setMobileShowChat] = useState(false);

  // Conversations & messages
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeDetail, setActiveDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Composer state
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);

  // Search
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [listTab, setListTab] = useState(0);

  // Context menus + popovers
  const [ctx, setCtx] = useState(null);            // message right-click { x, y, message }
  const [reactAnchor, setReactAnchor] = useState(null);
  const [headerMenu, setHeaderMenu] = useState(null);

  // Dialogs
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupPublic, setGroupPublic] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberSelected, setAddMemberSelected] = useState([]);

  // Image crop
  const [cropFile, setCropFile] = useState(null);

  // Read receipts
  const [readersMessage, setReadersMessage] = useState(null);

  // Profile / contacts / blocks / invites
  const [profileData, setProfileData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [inviteLinks, setInviteLinks] = useState([]);
  const [publicGroups, setPublicGroups] = useState([]);
  // Join requests (Telegram-style — for public groups that require approval)
  const [myJoinRequests, setMyJoinRequests] = useState([]);   // requests the current user has sent
  const [convJoinRequests, setConvJoinRequests] = useState([]); // requests pending on the active group (admin view)
  const [myRequestsBadge, setMyRequestsBadge] = useState(0);  // count of pending outgoing requests

  // Misc
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'chat' | 'group', conv }
  const [confirmBlock, setConfirmBlock] = useState(null);   // { user }
  const [confirmLeave, setConfirmLeave] = useState(null);   // { conv }
  const [confirmCleanup, setConfirmCleanup] = useState(null); // { conv }
  const [hashReady, setHashReady] = useState(false);

  // Audio player bar — persists across chat switches
  const [audioPlayer, setAudioPlayer] = useState(null); // { att, title }

  // Media gallery dialog
  const [galleryState, setGalleryState] = useState(null); // { startAttachment }

  // Online presence — set of user IDs currently online (updated via WebSocket)
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  // Reply-jump highlight
  const [jumpHighlightId, setJumpHighlightId] = useState(null);

  // Refs
  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimer = useRef(null);
  const activeIdRef = useRef(null);
  const bootstrapped = useRef(false);
  // Mirror state into refs so the WebSocket handler (which is bound once on mount)
  // can read the latest values without re-binding every render.
  const panelHistoryRef = useRef([]);
  const profileDataRef = useRef(null);
  useEffect(() => { panelHistoryRef.current = panelHistory; }, [panelHistory]);
  useEffect(() => { profileDataRef.current = profileData; }, [profileData]);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  // Auto-load join requests when the active group requires approval and the
  // current user is an admin (so the "Join requests (N)" badge is up-to-date).
  useEffect(() => {
    if (!activeDetail || activeDetail.type !== "group") {
      setConvJoinRequests([]);
      return;
    }
    if (!activeDetail.requires_approval) {
      setConvJoinRequests([]);
      return;
    }
    const role = myRole(activeDetail, meId);
    if (role !== "owner" && role !== "admin") return;
    loadConvJoinRequests(activeDetail.id);
  }, [activeDetail?.id, activeDetail?.requires_approval, meId]); // eslint-disable-line react-hooks/exhaustive-deps
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

  /* -------------------- panel navigation -------------------- */

  const pushPanel = useCallback((kind) => {
    setPanelHistory((prev) => [...prev, kind]);
  }, []);
  const popPanel = useCallback(() => {
    setPanelHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : []));
  }, []);
  const closePanel = useCallback(() => setPanelHistory([]), []);

  /* -------------------- loaders -------------------- */

  const loadConversations = useCallback(async ({ silent = false } = {}) => {
    // Only show the spinner on the very first load — background refreshes
    // (WebSocket-driven) must NOT toggle loadingConvs, otherwise the chat
    // list flickers with a spinner every few seconds.
    if (!silent) setLoadingConvs(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/?page_size=50${localStorage.getItem("access") ? `&token=${encodeURIComponent(localStorage.getItem("access"))}` : ""}`,
      });
      const data = unwrapData(res);
      setConversations(data?.results || []);
      return data?.results || [];
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load chats");
      return [];
    } finally {
      if (!silent) setLoadingConvs(false);
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

  const loadMessages = useCallback(async (cid, { silent = false } = {}) => {
    if (!cid) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?limit=${PAGE_SIZE}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
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
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${activeIdRef.current}/messages/?limit=${PAGE_SIZE}&before_id=${nextBefore}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
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
    closePanel();
    setHashReady(true);
    setHash(null);
    if (isMobile) setDrawerOpen(true);
  }, [isMobile, closePanel]);

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
    await Promise.all([loadMessages(c.id), loadConversationDetail(c.id)]);
  }, [isMobile, loadMessages, loadConversationDetail]);

  /* bootstrap + hash restore */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadConversations();
      if (cancelled || bootstrapped.current) return;
      bootstrapped.current = true;
      const h = parseHash();
      if (!h) { setHashReady(true); return; }
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
          // For #u/<username> with no existing chat, OPEN THE PROFILE (no DM creation)
          // — matches "clicking search result opens profile, not DM"
          try {
            const res = await apiRequest({
              method: "GET",
              url: `${MSG_API}/users/by-username/?username=${encodeURIComponent(h.value)}`,
            });
            const data = unwrapData(res);
            if (data) {
              setProfileData(data);
              pushPanel("profile");
            }
          } catch {
            // User not found — silently ignore
          }
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
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (["message.new", "message.edited", "message.reaction", "message.read"].includes(data.type)) {
        // IMPORTANT: the backend only sends the event to participants of the
        // conversation — so non-members never receive this. The reload here
        // is safe and only refreshes this user's own chat list (no spinner
        // because we pass silent:true).
        if (String(data.conversation_id) === String(activeIdRef.current)) {
          loadMessages(activeIdRef.current, { silent: true });
        }
        loadConversations({ silent: true });
      }
      // Presence updates — toggle user's online status
      if (data.type === "presence.update" && data.user_id != null) {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(Number(data.user_id));
          else next.delete(Number(data.user_id));
          return next;
        });
        // Reload conversations so the chat list updates the online dot — silent
        loadConversations({ silent: true });
      }
      // Member changes — reload conversation detail + messages
      if ([
        "member.left", "member.removed", "member.role_changed",
        "ownership.transferred", "conversation.deleted", "member.joined",
      ].includes(data.type)) {
        // If the current user was removed from the group, redirect them out
        if (
          (data.type === "member.removed" || data.type === "conversation.deleted")
          && String(data.user_id) === String(meId)
        ) {
          flash(data.type === "conversation.deleted"
            ? "The group was deleted"
            : "You were removed from the group");
          closeChat();
          loadConversations({ silent: false });
          return;
        }
        // If user left (themselves) — they were the leaver; close chat
        if (
          data.type === "member.left"
          && String(data.user_id) === String(meId)
        ) {
          flash("You left the group");
          closeChat();
          loadConversations({ silent: false });
          return;
        }
        if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
          loadConversationDetail(data.conversation_id);
          loadMessages(data.conversation_id, { silent: true });
          // If admin is viewing this group's join requests panel, refresh those too
          if (panelHistoryRef.current.includes("join-requests")) {
            loadConvJoinRequests(data.conversation_id);
          }
        }
        loadConversations({ silent: true });
      }
      // Profile update — another user's avatar/bio/username changed.
      // Reload everything so the new avatar propagates to chat list, chat header,
      // member list, etc.
      if (data.type === "profile.update") {
        loadConversations({ silent: true });
        if (activeIdRef.current) {
          loadConversationDetail(activeIdRef.current);
          loadMessages(activeIdRef.current, { silent: true });
        }
        // If the profile panel is showing this user, refresh it too
        if (profileDataRef.current?.id && String(profileDataRef.current.id) === String(data.user_id)) {
          refreshProfileData(profileDataRef.current.id);
        }
      }
      // Join request events (Telegram-style — public groups requiring approval)
      if ([
        "join_request.new", "join_request.approved",
        "join_request.rejected", "join_request.cancelled",
      ].includes(data.type)) {
        // If admin is viewing this group's join requests panel, refresh
        if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
          loadConvJoinRequests(data.conversation_id);
        }
        // Refresh the user's own outgoing requests list
        if (panelHistoryRef.current.includes("my-requests")) {
          loadMyJoinRequests();
        }
        // If approved — open the chat
        if (data.type === "join_request.approved" && String(data.user_id) === String(meId)) {
          flash("Your join request was approved!");
          loadConversations({ silent: false }).then((list) => {
            const conv = list.find((c) => String(c.id) === String(data.conversation_id));
            if (conv) openChat(conv);
          });
        }
        if (data.type === "join_request.rejected" && String(data.user_id) === String(meId)) {
          flash("Your join request was rejected");
          loadMyJoinRequests();
        }
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

  /* Esc global — closes dialogs/panels in priority order */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (preview) { setPreview(null); return; }
      if (galleryState) { setGalleryState(null); return; }
      if (readersMessage) { setReadersMessage(null); return; }
      if (cropFile) { setCropFile(null); return; }
      if (ctx) { setCtx(null); return; }
      if (reactAnchor) { setReactAnchor(null); return; }
      if (editingMsg) { setEditingMsg(null); setText(""); return; }
      if (replyTo) { setReplyTo(null); return; }
      if (panelHistory.length) { popPanel(); return; }
      if (activeId) { closeChat(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, galleryState, readersMessage, cropFile, ctx, reactAnchor, editingMsg, replyTo, panelHistory, activeId, closeChat, popPanel]);

  /* search users */
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQ.trim()) { setSearchResults([]); return undefined; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/users/search/?q=${encodeURIComponent(searchQ.trim())}&page_size=30`,
        });
        setSearchResults(unwrapList(res));
      } catch { setSearchResults([]); } finally { setSearching(false); }
    }, 280);
    return () => clearTimeout(searchTimer.current);
  }, [searchQ]);

  /* -------------------- actions -------------------- */

  // startDm is only called when the user explicitly picks "Message" — NOT on search-result click
  const startDm = async (user) => {
    try {
      const res = await apiRequest({
        method: "POST", url: `${MSG_API}/conversations/`,
        data: { type: "private", user_id: user.id },
      });
      const conv = unwrapData(res);
      setSearchQ(""); setSearchResults([]);
      closePanel();
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
        method: "POST", url: `${MSG_API}/conversations/`,
        data: { type: "group", title: groupTitle.trim(), is_public: groupPublic },
      });
      const conv = unwrapData(res);
      setCreateGroupOpen(false); setGroupTitle(""); setGroupPublic(false);
      closePanel();
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
          method: "PATCH", url: `${MSG_API}/messages/${editingMsg.id}/edit/`,
          data: { body },
        });
        const updated = unwrapData(res);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditingMsg(null); setText("");
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
    setText(""); setFiles([]);
    const rep = replyTo; setReplyTo(null);
    try {
      const res = await apiRequest({
        method: "POST", url: `${MSG_API}/conversations/${activeId}/messages/`,
        data: form,
      });
      const created = unwrapData(res);
      if (created) {
        setMessages((prev) => [...prev, created]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
        loadConversations({ silent: true });
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
      const lastMine = [...messages].reverse().find(
        (m) => String(m.sender?.id) === String(meId) && !m.is_deleted
      );
      if (lastMine) { e.preventDefault(); startEdit(lastMine); }
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendOrEdit(); }
  };

  const react = async (msgId, emoji) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msgId}/react/`, data: { emoji } });
      loadMessages(activeId, { silent: true });
    } catch { /* */ }
    setReactAnchor(null); setCtx(null);
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
        method: "POST", url: `${MSG_API}/messages/${forwardOpen.id}/forward/`,
        data: { conversation_id: convId },
      });
      flash("Forwarded");
      setForwardOpen(null);
      if (String(convId) === String(activeId)) loadMessages(activeId, { silent: true });
      loadConversations({ silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Forward failed");
    }
  };

  const addContact = async (userId) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/contacts/`, data: { user_id: userId } });
      flash("Added to contacts");
      // If profile panel is showing, refresh its is_contact flag
      if (profileData?.id === userId) {
        setProfileData((p) => ({ ...p, is_contact: true }));
      }
      // Update peer.is_contact in the active conversation detail (so the
      // "Add to contacts" banner disappears immediately after adding).
      if (activeDetail?.type === "private" && activeDetail.peer?.id === userId) {
        setActiveDetail((d) => ({ ...d, peer: { ...d.peer, is_contact: true } }));
      }
      // Also update the conversation in the sidebar list
      setConversations((prev) => prev.map((c) => (
        c.type === "private" && c.peer?.id === userId
          ? { ...c, peer: { ...c.peer, is_contact: true } }
          : c
      )));
      if (contacts.length || panelHistory.includes("contacts")) {
        const res = await apiRequest({ method: "GET", url: `${MSG_API}/contacts/` });
        setContacts(unwrapData(res) || []);
      }
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
      setConfirmBlock(null);
      if (profileData?.id === userId) {
        setProfileData((p) => ({ ...p, is_blocked: true, is_contact: false }));
      }
      loadConversations({ silent: true });
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
      setConfirmLeave(null);
      closeChat();
      loadConversations({ silent: false });
      flash("Left chat");
    } catch (e) {
      setError(e?.response?.data?.message || "Leave failed");
    }
  };

  const deleteConversation = async () => {
    const conv = confirmDelete?.conv;
    if (!conv) return;
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/conversations/${conv.id}/delete/` });
      setConfirmDelete(null);
      setHeaderMenu(null);
      if (String(conv.id) === String(activeId)) closeChat();
      loadConversations({ silent: false });
      flash(conv.type === "group" ? "Group deleted" : "Chat deleted");
    } catch (e) {
      setError(e?.response?.data?.message || "Delete failed");
      setConfirmDelete(null);
    }
  };

  const cleanupConversation = async () => {
    const conv = confirmCleanup?.conv;
    if (!conv) return;
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/conversations/${conv.id}/cleanup/` });
      setConfirmCleanup(null);
      if (String(conv.id) === String(activeId)) {
        setMessages([]);
        loadConversationDetail(conv.id);
      }
      loadConversations({ silent: true });
      flash("Messages cleared");
    } catch (e) {
      setError(e?.response?.data?.message || "Cleanup failed");
      setConfirmCleanup(null);
    }
  };

  const togglePin = async (conv) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/conversations/${conv.id}/pin/` });
      loadConversations({ silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Pin failed");
    }
  };

  const markChatRead = async (conv) => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/conversations/${conv.id}/read/` });
      loadConversations({ silent: true });
    } catch { /* */ }
  };

  const patchGroup = async (patch) => {
    if (!activeId) return;
    try {
      const res = await apiRequest({
        method: "PATCH", url: `${MSG_API}/conversations/${activeId}/`,
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

  // Upload / clear a group avatar — owner/admin only.
  // The file is sent to /conversations/<pk>/avatar/ as multipart/form-data.
  const uploadGroupAvatar = async (convId, file) => {
    if (!convId || !file) return;
    try {
      const form = new FormData();
      form.append("avatar", file);
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${convId}/avatar/`,
        data: form,
      });
      const data = unwrapData(res);
      setActiveDetail(data);
      setConversations((prev) => prev.map((c) => (c.id === data.id ? { ...c, ...data } : c)));
      flash("Group photo updated");
    } catch (e) {
      setError(e?.response?.data?.message || "Avatar upload failed");
    }
  };

  const clearGroupAvatar = async (convId) => {
    if (!convId) return;
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/conversations/${convId}/avatar/` });
      // Reload conversation detail
      await loadConversationDetail(convId);
      setConversations((prev) => prev.map((c) => (
        c.id === convId ? { ...c, avatar: null, avatar_url: null } : c
      )));
      flash("Group photo removed");
    } catch (e) {
      setError(e?.response?.data?.message || "Avatar removal failed");
    }
  };

  // Save current user's bio (Telegram-style 'about' field)
  const saveMyBio = async (text) => {
    try {
      await apiRequest({ method: "PATCH", url: `${MSG_API}/me/bio/`, data: { text } });
      flash("Bio saved");
    } catch (e) {
      setError(e?.response?.data?.message || "Bio save failed");
    }
  };

  // Load current user's bio (for editing in profile editor)
  const loadMyBio = async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/bio/` });
      return unwrapData(res)?.text || "";
    } catch {
      return "";
    }
  };

  // Notify all conversations the current user is part of that their profile
  // (avatar / bio / username) has changed. The backend fans out a
  // `profile.update` WebSocket event so every chat the user is in refreshes
  // its avatar copy. Called after the user uploads/clears a profile photo
  // or updates their bio.
  const broadcastProfileUpdate = async () => {
    try {
      await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
    } catch { /* */ }
  };

  // ─── Join Requests (Telegram-style — public groups requiring approval) ───

  // Join (or request to join) a public group directly from the search results.
  // If the group has `requires_approval=true`, this creates a pending request.
  // Otherwise the user is added as a member immediately and the chat opens.
  const joinPublicGroup = async (group) => {
    if (!group?.id) return;
    try {
      const res = await apiRequest({
        method: "POST", url: `${MSG_API}/groups/${group.id}/join/`,
      });
      const data = unwrapData(res);
      if (data?.pending) {
        flash("Join request sent — waiting for admin approval");
        // Refresh search results so the button shows "Pending"
        searchPublicGroups(publicSearchQRef.current || "");
        loadMyJoinRequests();
      } else if (data?.joined && data?.conversation) {
        flash("Joined group");
        await loadConversations({ silent: false });
        openChat(data.conversation);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Join failed");
    }
  };

  // Cancel (delete) the current user's own pending join request.
  const cancelJoinRequest = async (reqId) => {
    if (!reqId) return;
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/join-requests/${reqId}/` });
      flash("Request cancelled");
      // Update local state immediately
      setMyJoinRequests((prev) => prev.filter((r) => r.id !== reqId));
      setMyRequestsBadge((n) => Math.max(0, n - 1));
      // Refresh search results so the button no longer shows "Pending"
      searchPublicGroups(publicSearchQRef.current || "");
    } catch (e) {
      setError(e?.response?.data?.message || "Cancel failed");
    }
  };

  // Load the current user's outgoing join requests (any status).
  const loadMyJoinRequests = async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/join-requests/` });
      const list = unwrapData(res) || [];
      setMyJoinRequests(list);
      setMyRequestsBadge(list.filter((r) => r.status === "pending").length);
      return list;
    } catch {
      return [];
    }
  };

  // Load pending join requests for a specific group (admin view).
  const loadConvJoinRequests = async (convId) => {
    if (!convId) return;
    try {
      const res = await apiRequest({
        method: "GET", url: `${MSG_API}/conversations/${convId}/join-requests/`,
      });
      setConvJoinRequests(unwrapData(res) || []);
    } catch {
      setConvJoinRequests([]);
    }
  };

  // Approve or reject a join request (admin only).
  const actOnJoinRequest = async (convId, reqId, action) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${convId}/join-requests/${reqId}/action/`,
        data: { action },
      });
      flash(action === "approve" ? "Request approved — user added" : "Request rejected");
      loadConvJoinRequests(convId);
      // Also refresh the conversation detail (member count changed on approve)
      if (action === "approve") {
        loadConversationDetail(convId);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Action failed");
    }
  };

  // Refresh the profile panel data (used after a profile.update WS event
  // so the avatar/bio shown in the panel reflects the latest server state).
  const refreshProfileData = async (userId) => {
    if (!userId) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/users/${userId}/profile/` });
      const data = unwrapData(res);
      if (data) setProfileData(data);
    } catch { /* */ }
  };

  // Ref mirror for the public-group search query (used inside WS callbacks
  // to refresh search results after a join/cancel without needing to lift
  // the search input state to the parent).
  const publicSearchQRef = useRef("");

  // Group management — remove member, promote/demote admin, transfer ownership
  const removeMember = async (convId, userId) => {
    try {
      await apiRequest({ method: "DELETE", url: `${MSG_API}/conversations/${convId}/members/${userId}/` });
      flash("Member removed");
      await loadConversationDetail(convId);
      loadMessages(convId, { silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Remove failed");
    }
  };

  const changeMemberRole = async (convId, userId, role) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${convId}/members/${userId}/role/`,
        data: { role },
      });
      flash(role === "admin" ? "Promoted to admin" : "Demoted to member");
      await loadConversationDetail(convId);
    } catch (e) {
      setError(e?.response?.data?.message || "Role change failed");
    }
  };

  const transferOwnership = async (convId, userId) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${convId}/transfer-ownership/`,
        data: { user_id: userId },
      });
      flash("Ownership transferred");
      await loadConversationDetail(convId);
    } catch (e) {
      setError(e?.response?.data?.message || "Transfer failed");
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
        method: "POST", url: `${MSG_API}/conversations/${activeId}/invite-links/${linkId}/revoke/`,
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
      setJoinOpen(false); setJoinCode("");
      closePanel();
      await loadConversations({ silent: false });
      if (conv) await openChat(conv);
    } catch (e) {
      setError(e?.response?.data?.message || "Invalid invite");
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

  const loadUserProfile = async (userId) => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/users/${userId}/profile/` });
      setProfileData(unwrapData(res));
      pushPanel("profile");
    } catch (e) {
      flash(e?.response?.data?.message || "Could not load profile");
    }
  };

  // Used by @mention clicks — fetch by username, open profile (no DM, no contact add)
  const loadUserProfileByUsername = async (username) => {
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/users/by-username/?username=${encodeURIComponent(username)}`,
      });
      const data = unwrapData(res);
      if (data) {
        setProfileData(data);
        pushPanel("profile");
      } else {
        flash(`@${username} not found`);
      }
    } catch (e) {
      flash(e?.response?.data?.message || `@${username} not found`);
    }
  };

  const searchPublicGroups = async (q) => {
    // Track the latest query so we can refresh results after a join/cancel
    publicSearchQRef.current = q || "";
    try {
      const res = await apiRequest({
        method: "GET", url: `${MSG_API}/groups/search/?q=${encodeURIComponent(q || "")}`,
      });
      setPublicGroups(unwrapData(res) || []);
    } catch { setPublicGroups([]); }
  };

  const addMembersToGroup = async () => {
    if (!activeId || !addMemberSelected.length) return;
    try {
      const res = await apiRequest({
        method: "POST", url: `${MSG_API}/conversations/${activeId}/members/`,
        data: { user_ids: addMemberSelected },
      });
      const data = unwrapData(res);
      flash(data?.added?.length ? `Added ${data.added.map((u) => u.username).join(", ")}` : "No new members");
      setAddMemberOpen(false); setAddMemberSelected([]);
      loadConversationDetail(activeId);
      loadMessages(activeId, { silent: true });
      loadConversations({ silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Add members failed");
    }
  };

  const openPreview = async (att) => {
    const k = attachmentKind(att);
    // Images & videos open the in-chat gallery dialog (with < > navigation)
    if (k === "image" || k === "video") {
      setGalleryState({ startAttachment: att });
      return;
    }
    if (k === "audio") {
      // Hand off to top player bar
      setAudioPlayer({ att, title: att.original_filename || "Audio" });
      return;
    }
    if (k === "text") {
      try {
        const r = await fetch(att.url, { headers: authHeaders() });
        const textContent = await r.text();
        setPreview({ att, kind: k, textContent: textContent.slice(0, 200000) });
      } catch {
        setPreview({ att, kind: k, textContent: "(Could not load text)" });
      }
      return;
    }
    setPreview({ att, kind: k });
  };

  // Reply-jump: scroll the replied message into view + flash highlight
  const onJumpToMessage = useCallback((msgId) => {
    if (!msgId) return;
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpHighlightId(msgId);
      setTimeout(() => setJumpHighlightId((cur) => (cur === msgId ? null : cur)), 2000);
    } else {
      flash("Message not loaded — try scrolling up");
    }
  }, []);

  /* -------------------- derived -------------------- */

  const activeConv = activeDetail || conversations.find((c) => c.id === activeId);
  const peer = peerUser(activeConv, meId);
  const role = myRole(activeConv, meId);

  const onScrollMsgs = (e) => {
    if (e.target.scrollTop < 100 && hasMoreMsgs && !loadingMore) loadOlder();
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

  /* -------------------- chat pane -------------------- */

  const chatPane = (
    <Box
      sx={{
        flex: 1, height: "100%",
        display: "flex", flexDirection: "column",
        bgcolor: theme.palette.mode === "dark" ? "#0e1621" : "#e7ebf0",
        minWidth: 0, width: "100%",
        position: "relative",
      }}
      onContextMenu={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
    >
      {!activeId ? (
        <Box sx={{
          flex: 1, display: { xs: "none", md: "flex" },
          alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 1,
        }}>
          <Typography color="text.secondary" variant="h6" fontWeight={500}>Messenger</Typography>
          <Typography color="text.secondary" variant="body2">Select a chat or search for a user</Typography>
          <Typography color="text.secondary" variant="caption">
            Tip: Esc closes a chat · ArrowUp edits your last message · Right-click for more
          </Typography>
          <Button startIcon={<HomeOutlinedIcon />} onClick={() => navigate("/")} sx={{ mt: 2 }}>
            Back to Deployer
          </Button>
        </Box>
      ) : (
        <>
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{
              px: 1, py: 0.85, bgcolor: "background.paper",
              borderBottom: "1px solid", borderColor: "divider", minHeight: 56,
              position: "relative", zIndex: 11,
            }}>
            {isMobile && <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>}
            {!isMobile && (
              <IconButton onClick={() => setDrawerOpen((v) => !v)} size="small"><MenuIcon /></IconButton>
            )}
            <Box sx={{ position: "relative" }}>
              <Avatar src={convAvatar(activeConv, meId)} sx={{ width: 40, height: 40, cursor: "pointer" }}
                onClick={() => (peer?.id ? loadUserProfile(peer.id) : pushPanel("info"))}>
                {convTitle(activeConv, meId)[0]?.toUpperCase()}
              </Avatar>
              {peer?.id && onlineUsers.has(Number(peer.id)) && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    bgcolor: "#4caf50",
                    border: "2px solid",
                    borderColor: "background.paper",
                  }}
                />
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
              onClick={() => (peer?.id ? loadUserProfile(peer.id) : pushPanel("info"))}>
              <Typography fontWeight={600} noWrap fontSize={15}>{convTitle(activeConv, meId)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {activeConv?.type === "group"
                  ? `${(activeConv?.participants || []).length} members`
                  : peer?.id && onlineUsers.has(Number(peer.id))
                    ? "online"
                    : peer?.username ? `@${peer.username}` : "tap for info"}
              </Typography>
            </Box>
            <IconButton onClick={() => pushPanel("info")}>
              <InfoOutlinedIcon />
            </IconButton>
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
              <MenuItem onClick={() => { setConfirmCleanup({ conv: activeConv }); setHeaderMenu(null); }}>
                <ListItemIcon><CleaningServicesIcon fontSize="small" /></ListItemIcon> Clear messages
              </MenuItem>
              {peer && (
                <MenuItem onClick={() => { setConfirmBlock({ user: peer }); setHeaderMenu(null); }}>
                  <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Block
                </MenuItem>
              )}
              {activeConv?.type === "private" && (
                <MenuItem
                  onClick={() => { setConfirmDelete({ type: "chat", conv: activeConv }); setHeaderMenu(null); }}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete chat
                </MenuItem>
              )}
              {activeConv?.type === "group" && (role === "owner" || role === "admin") && (
                <MenuItem
                  onClick={() => { setConfirmDelete({ type: "group", conv: activeConv }); setHeaderMenu(null); }}
                  sx={{ color: "error.main" }}
                >
                  <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon> Delete group
                </MenuItem>
              )}
              <MenuItem onClick={() => { setConfirmLeave({ conv: activeConv }); setHeaderMenu(null); }}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon> Leave
              </MenuItem>
            </Menu>
          </Stack>

          {/* "Add to contacts?" banner — Telegram-style.
              Shows when the active chat is private AND the peer is NOT in the
              current user's contacts. The user can dismiss (X) or accept (Add). */}
          {activeConv?.type === "private" && peer && peer.is_contact === false && !peer.is_blocked && (
            <AddToContactsBanner
              username={peer.username}
              onAdd={() => addContact(peer.id)}
            />
          )}

          {/* Top audio player bar (Telegram-style) */}
          <AudioPlayerBar player={audioPlayer} onChange={setAudioPlayer} />

          <Box
            ref={listRef} onScroll={onScrollMsgs}
            sx={{ flex: 1, overflow: "auto", px: { xs: 0.75, sm: 1.5 }, py: 1 }}
            onContextMenu={(e) => e.preventDefault()}
          >
            {hasMoreMsgs && (
              <Box sx={{ textAlign: "center", py: 1 }}>
                {loadingMore
                  ? <CircularProgress size={18} />
                  : <Button size="small" onClick={loadOlder}>Load older messages</Button>}
              </Box>
            )}
            {loadingMsgs && !messages.length && (
              <Box sx={{ textAlign: "center", py: 6 }}><CircularProgress /></Box>
            )}
            {messagesWithDays.map((m) => (
              <Box
                key={m.id}
                id={m.type === "msg" ? `msg-${m.id}` : undefined}
                sx={
                  m.type === "msg" && jumpHighlightId === m.id
                    ? {
                        animation: "msgFlash 1.6s ease-out",
                        borderRadius: 2,
                        "@keyframes msgFlash": {
                          "0%": { bgcolor: (t) => t.palette.warning.main, boxShadow: "0 0 0 4px rgba(255,193,7,0.4)" },
                          "70%": { bgcolor: "transparent", boxShadow: "0 0 0 0 rgba(255,193,7,0)" },
                          "100%": { bgcolor: "transparent", boxShadow: "none" },
                        },
                      }
                    : undefined
                }
              >
                <MessageBubble
                  m={m} meId={meId} activeConv={activeConv}
                  onContextOpen={openCtx}
                  onReact={react}
                  onReactAnchor={(e, message) => setReactAnchor({ anchorPosition: { top: e.clientY, left: e.clientX }, message })}
                  onReply={(message) => { setReplyTo(message); setEditingMsg(null); inputRef.current?.focus(); }}
                  onEdit={startEdit}
                  onDelete={deleteMsg}
                  onForward={(message) => setForwardOpen(message)}
                  onOpenPreview={openPreview}
                  onShowReaders={(message) => setReadersMessage(message)}
                  onCopyText={async (msg) => {
                    await copyText(typeof msg?.body === "string" ? msg.body : "");
                    flash("Copied");
                    setCtx(null);
                  }}
                  onLoadUserProfile={loadUserProfile}
                  onJumpToMessage={onJumpToMessage}
                  onPlayAudio={(att) => setAudioPlayer({ att, title: att.original_filename || "Audio" })}
                  onMentionClick={loadUserProfileByUsername}
                />
              </Box>
            ))}
            <div ref={bottomRef} />
          </Box>

          {/* Channel mode: if only_admins_send is on and the current user is not
              an admin, show a notice instead of the composer. */}
          {activeConv?.type === "group"
            && Boolean(activeConv.only_admins_send)
            && role !== "owner" && role !== "admin" ? (
            <Box sx={{
              px: 2, py: 1.5, bgcolor: "action.hover",
              borderTop: "1px solid", borderColor: "divider",
              display: "flex", alignItems: "center", gap: 1,
            }}>
              <LockOutlinedIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                Only admins can send messages in this group.
              </Typography>
            </Box>
          ) : (
            <MessageComposer
              text={text} setText={setText}
              files={files} setFiles={setFiles}
              replyTo={replyTo} editingMsg={editingMsg}
              onCancelReplyOrEdit={() => { setReplyTo(null); setEditingMsg(null); setText(""); }}
              onSend={sendOrEdit}
              onPickImage={(f) => setCropFile(f)}
              inputRef={inputRef}
              onKeyDown={onComposerKeyDown}
            />
          )}
        </>
      )}
    </Box>
  );

  /* -------------------- sidebar (rendered for both desktop & mobile) -------------------- */

  const sidebarEl = (
    <Sidebar
      meId={meId} conversations={conversations} loadingConvs={loadingConvs}
      activeId={activeId} openChat={openChat}
      searchQ={searchQ} setSearchQ={setSearchQ}
      searchResults={searchResults} searching={searching}
      onViewUserProfile={loadUserProfile}
      startDm={startDm} addContact={addContact}
      listTab={listTab} setListTab={setListTab}
      publicGroups={publicGroups} searchPublicGroups={searchPublicGroups}
      onJoinPublicGroup={joinPublicGroup}
      onTogglePin={togglePin}
      onMarkRead={markChatRead}
      onCleanupChat={(conv) => setConfirmCleanup({ conv })}
      onLeaveChat={(conv) => setConfirmLeave({ conv })}
      onDeleteChat={(conv) => setConfirmDelete({ type: conv.type, conv })}
      onBlockPeer={(peer) => setConfirmBlock({ user: peer })}
      onOpenCreateGroup={() => setCreateGroupOpen(true)}
      onOpenJoin={() => setJoinOpen(true)}
      onOpenSettings={() => pushPanel("settings")}
      onOpenMyRequests={() => { loadMyJoinRequests(); pushPanel("my-requests"); }}
      onNavigateHome={() => navigate("/")}
      onlineUsers={onlineUsers}
    />
  );

  /* -------------------- render -------------------- */

  const ctxMsg = ctx?.message;
  const ctxMine = ctxMsg && String(ctxMsg.sender?.id) === String(meId);

  // Right panel content (rendered inside the centered modal Dialog below)
  const panelIsOpen = Boolean(rightPanel) && rightPanel !== "my-profile";

  return (
    <Box
      sx={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", bgcolor: "background.default" }}
      onClick={() => { if (ctx) setCtx(null); }}
    >
      {/* Mobile sidebar */}
      {isMobile && (!activeId || !mobileShowChat) && (
        <Box sx={{ width: "100%", height: "100%", position: "absolute", inset: 0, zIndex: 2, bgcolor: "background.paper" }}>
          {sidebarEl}
        </Box>
      )}
      {/* Desktop sidebar */}
      {!isMobile && (
        <Box sx={{
          width: drawerOpen ? 360 : 0, transition: "width 0.2s", overflow: "hidden", height: "100%",
          borderRight: drawerOpen ? "1px solid" : "none", borderColor: "divider", flexShrink: 0,
        }}>
          <Box sx={{ width: 360, height: "100%" }}>{sidebarEl}</Box>
        </Box>
      )}

      {/* Chat pane */}
      <Box sx={{
        flex: 1, height: "100%", minWidth: 0, display: "flex",
        visibility: isMobile && (!activeId || !mobileShowChat) ? "hidden" : "visible",
        position: isMobile && (!activeId || !mobileShowChat) ? "absolute" : "relative",
        width: isMobile && (!activeId || !mobileShowChat) ? 0 : "auto",
        overflow: "hidden",
      }}>
        {chatPane}
      </Box>

      {/* Centered settings / panel modal (with back-button navigation) */}
      <Dialog
        open={panelIsOpen}
        onClose={closePanel}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, maxHeight: "90vh", height: "auto", minHeight: 320 } }}
      >
        {panelIsOpen && (
          <RightPanel
            kind={rightPanel} meId={meId} activeConv={activeConv}
            profileData={profileData} contacts={contacts} blocks={blocks}
            inviteLinks={inviteLinks}
            onlineUsers={onlineUsers}
            myJoinRequests={myJoinRequests}
            convJoinRequests={convJoinRequests}
            canGoBack={panelHistory.length > 1}
            onBack={popPanel}
            onClose={closePanel}
            onOpenMyProfile={() => pushPanel("my-profile")}
            onOpenContacts={() => { loadContacts(); pushPanel("contacts"); }}
            onOpenBlocks={() => { loadBlocks(); pushPanel("blocks"); }}
            onOpenMyRequests={() => { loadMyJoinRequests(); pushPanel("my-requests"); }}
            onOpenConvJoinRequests={() => { loadConvJoinRequests(activeConv?.id); pushPanel("conv-requests"); }}
            onOpenCreateGroup={() => setCreateGroupOpen(true)}
            onOpenJoin={() => setJoinOpen(true)}
            onNavigateHome={() => navigate("/")}
            onStartDm={startDm}
            onRemoveContact={removeContact}
            onUnblock={unblockUser}
            onPatchGroup={patchGroup}
            onCreateInvite={createInvite}
            onRevokeInvite={revokeInvite}
            onOpenAddMembers={async () => { await loadContacts(); setAddMemberSelected([]); setAddMemberOpen(true); }}
            onAddContact={addContact}
            onBlockUser={(uid) => setConfirmBlock({ user: { id: uid } })}
            onMessage={(u) => startDm(u)}
            onOpenPhoto={(url) => openPreview({ url, original_filename: "photo", kind: "image", content_type: "image/jpeg" })}
            onDeleteChat={() => setConfirmDelete({ type: "chat", conv: activeConv })}
            onDeleteGroup={() => setConfirmDelete({ type: "group", conv: activeConv })}
            onCleanupChat={() => setConfirmCleanup({ conv: activeConv })}
            onRemoveMember={removeMember}
            onChangeMemberRole={changeMemberRole}
            onTransferOwnership={transferOwnership}
            onUploadGroupAvatar={uploadGroupAvatar}
            onClearGroupAvatar={clearGroupAvatar}
            onCancelJoinRequest={cancelJoinRequest}
            onActOnJoinRequest={actOnJoinRequest}
          />
        )}
      </Dialog>

      {/* My-profile editor dialog */}
      <Dialog open={rightPanel === "my-profile"} onClose={popPanel} fullWidth maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogContent dividers sx={{ p: 0 }}>
          <MessengerProfileEditor onClose={popPanel} />
        </DialogContent>
      </Dialog>

      {/* Message right-click context menu */}
      <ContextMenu ctx={ctx} onClose={() => setCtx(null)}>
        <MessageContextMenuItems
          ctxMsg={ctxMsg} isMine={ctxMine}
          onReply={(m) => { setReplyTo(m); setEditingMsg(null); setCtx(null); inputRef.current?.focus(); }}
          onReact={(e, m) => { setReactAnchor({ anchorPosition: { top: e.clientY, left: e.clientX }, message: m }); setCtx(null); }}
          onForward={(m) => { setForwardOpen(m); setCtx(null); }}
          onCopy={async (m) => { await copyText(typeof m?.body === "string" ? m.body : ""); flash("Copied"); setCtx(null); }}
          onPreview={(a) => { openPreview(a); setCtx(null); }}
          onDownload={(a) => { window.open(withTokenQuery(a.url), "_blank"); setCtx(null); }}
          onEdit={(m) => startEdit(m)}
          onDelete={(m) => deleteMsg(m)}
          onShowReaders={(m) => { setReadersMessage(m); setCtx(null); }}
        />
      </ContextMenu>

      {/* Emoji react popover — uses anchorPosition to avoid losing the anchor
          element when the context menu closes (which caused the popover to
          jump to the top-left corner). */}
      <Popover
        open={Boolean(reactAnchor)}
        anchorReference="anchorPosition"
        anchorPosition={reactAnchor?.anchorPosition || { top: 100, left: 100 }}
        onClose={() => setReactAnchor(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Stack direction="row" spacing={0.25} sx={{ p: 0.75, flexWrap: "wrap", maxWidth: 280 }}>
          {REACTIONS.map((em) => (
            <IconButton key={em} size="small"
              onClick={() => react(reactAnchor.message.id, em)} sx={{ fontSize: 22 }}>
              {em}
            </IconButton>
          ))}
        </Stack>
      </Popover>

      {/* Image crop dialog */}
      <ImageCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={(blob, filename) => {
          const cropped = new File([blob], filename, { type: "image/jpeg" });
          setFiles((prev) => [...prev, cropped]);
          setCropFile(null);
        }}
      />

      {/* Read receipts ("Seen by") dialog */}
      <ReadReceiptsDialog
        message={readersMessage}
        onClose={() => setReadersMessage(null)}
      />

      {/* In-chat media gallery dialog (image / video, with < > navigation) */}
      <MediaGalleryDialog
        open={Boolean(galleryState)}
        conversationId={activeId}
        startAttachment={galleryState?.startAttachment}
        onClose={() => setGalleryState(null)}
      />

      {/* Text / file preview dialog (non-media) */}
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: "background.default" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography noWrap sx={{ flex: 1 }} fontWeight={600}>
            {preview?.att?.original_filename || "Preview"}
          </Typography>
          {preview?.att?.url && (
            <IconButton onClick={() => window.open(withTokenQuery(preview.att.url), "_blank")}>
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton onClick={() => setPreview(null)}><ArrowBackIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 240, display: "flex", justifyContent: "center", alignItems: "center" }}>
          {preview?.kind === "pdf" && (
            <Box component="iframe" src={withTokenQuery(preview.att.url)} title="pdf"
              sx={{ width: "100%", height: "70vh", border: 0, borderRadius: 1 }} />
          )}
          {preview?.kind === "text" && (
            <Box component="pre" sx={{
              m: 0, p: 2, width: "100%", maxHeight: "70vh", overflow: "auto",
              bgcolor: "action.hover", borderRadius: 1, fontSize: 13,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {preview.textContent}
            </Box>
          )}
          {preview?.kind === "file" && (
            <Stack alignItems="center" spacing={2}>
              <Typography>No inline preview for this file type.</Typography>
              <Button variant="contained" startIcon={<DownloadIcon />}
                onClick={() => window.open(withTokenQuery(preview.att.url), "_blank")}>
                Download
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* Forward dialog */}
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

      {/* Create group dialog */}
      <Dialog open={createGroupOpen} onClose={() => setCreateGroupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New group</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Group title" value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)} sx={{ mt: 1 }} />
          <FormControlLabel sx={{ mt: 1.5 }}
            control={<Switch checked={groupPublic} onChange={(e) => setGroupPublic(e.target.checked)} />}
            label="Public (appears in search)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createGroup} disabled={!groupTitle.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      {/* Join invite dialog */}
      <Dialog open={joinOpen} onClose={() => setJoinOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Join with invite code</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Invite code" value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={joinByCode} disabled={!joinCode.trim()}>Join</Button>
        </DialogActions>
      </Dialog>

      {/* Add members dialog */}
      <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add members from contacts</DialogTitle>
        <DialogContent dividers sx={{ maxHeight: 360 }}>
          <List dense>
            {contacts.map((c) => {
              const u = c.contact;
              if (!u) return null;
              const checked = addMemberSelected.includes(u.id);
              const already = (activeConv?.participants || []).some((p) => String(p.user?.id) === String(u.id));
              return (
                <ListItemButton
                  key={u.id} disabled={already}
                  onClick={() => {
                    setAddMemberSelected((prev) =>
                      checked ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                    );
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={u.avatar || undefined}>{u.username?.[0]}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={u.username}
                    secondary={already ? "Already in group" : (checked ? "Selected" : "")}
                  />
                </ListItemButton>
              );
            })}
            {!contacts.length && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No contacts. Add contacts from search first.
              </Typography>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddMemberOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!addMemberSelected.length} onClick={addMembersToGroup}>
            Add ({addMemberSelected.length})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sensitive-operation confirmation dialogs */}
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={confirmDelete?.type === "group" ? "Delete group?" : "Delete chat?"}
        message={confirmDelete?.type === "group"
          ? "This permanently deletes the group and all messages for everyone. This cannot be undone."
          : "This deletes the conversation for both sides. This cannot be undone."}
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={deleteConversation}
        onClose={() => setConfirmDelete(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmCleanup)}
        title="Clear messages?"
        message="This clears all messages in this conversation for you. Other participants will still see their copies. This cannot be undone."
        confirmLabel="Clear"
        confirmColor="warning"
        onConfirm={cleanupConversation}
        onClose={() => setConfirmCleanup(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmBlock)}
        title="Block user?"
        message={confirmBlock?.user?.username
          ? `@${confirmBlock.user.username} will no longer be able to message you. They'll be removed from your contacts.`
          : "This user will no longer be able to message you. They'll be removed from your contacts."}
        confirmLabel="Block"
        confirmColor="error"
        onConfirm={() => confirmBlock?.user?.id && blockUser(confirmBlock.user.id)}
        onClose={() => setConfirmBlock(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmLeave)}
        title="Leave chat?"
        message="You will no longer receive messages from this chat. Other members will see that you left."
        confirmLabel="Leave"
        confirmColor="warning"
        onConfirm={leaveChat}
        onClose={() => setConfirmLeave(null)}
      />

      {/* Toasts */}
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
        <Box sx={{
          position: "fixed", inset: 0, bgcolor: "background.default",
          zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}

/**
 * Telegram-style "Add to contacts?" banner shown at the top of a private chat
 * when the peer is not yet in the user's contacts.
 *
 * Behaviour:
 *  - Clicking "Add" calls onAdd() and the parent calls the contacts API
 *  - Clicking X dismisses the banner for the current session (per-peer)
 */
function AddToContactsBanner({ username, onAdd }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: (t) => t.palette.mode === "dark" ? "rgba(33,150,243,0.12)" : "rgba(33,150,243,0.08)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <PersonAddIcon fontSize="small" color="primary" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        <strong>@{username || "this user"}</strong> is not in your contacts. Add them?
      </Typography>
      <Button
        size="small"
        variant="contained"
        color="primary"
        startIcon={<PersonAddIcon />}
        onClick={() => { onAdd(); setDismissed(true); }}
      >
        Add
      </Button>
      <IconButton size="small" onClick={() => setDismissed(true)}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
