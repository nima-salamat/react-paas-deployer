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
  ListItemText, Divider, Fade, Chip, Popover, Tooltip, useMediaQuery, LinearProgress,
  Snackbar,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
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

import apiRequest, { refreshAccessToken } from "../customHooks/apiRequest.jsx";
import { MSG_API, WS_URL, unwrapData, unwrapList, authHeaders } from "./api";
import {
  useAuthUserId, formatDay, convTitle, convAvatar, peerUser, myRole,
  copyText, parseHash, setHash, attachmentKind, isVoiceAttachment, withTokenQuery, REACTIONS, PAGE_SIZE,
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
import MediaSettingsDialog from "./components/MediaSettingsDialog";
import VideoEditDialog from "./components/VideoEditDialog";

/** Keep the pre-edit source so re-opening the editor never stacks crops. */
function attachMessengerOriginal(file, source) {
  if (!file) return file;
  try {
    const orig = source?.__messengerOriginal || source || file;
    Object.defineProperty(file, "__messengerOriginal", {
      value: orig,
      writable: true,
      configurable: true,
    });
  } catch {
    file.__messengerOriginal = source?.__messengerOriginal || source || file;
  }
  return file;
}
function messengerOriginalOf(file) {
  return file?.__messengerOriginal || file;
}

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
  const loadingMoreRef = useRef(false);
  // Per-conversation message cache — switching chats restores instantly, no flicker
  const messagesCacheRef = useRef(new Map()); // cid -> { messages, hasMore, nextBefore, detail, scroll }
  const pendingScrollRestoreRef = useRef(null);
  const messagesConvIdRef = useRef(null); // which conversation current messages state belongs to
  const hasMoreMsgsRef = useRef(false);
  const nextBeforeRef = useRef(null);
  const pendingJumpRef = useRef(null); // messageId to scroll to after load
  const nearBottomRef = useRef(true);
  const pendingNewIdsRef = useRef([]); // ids arrived while scrolled up
  const [newBelowCount, setNewBelowCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [chatFileDrag, setChatFileDrag] = useState(false);
  const chatDragDepthRef = useRef(0);
  // typingUsers: { [userId]: { username, until } } for active chat
  const [typingUsers, setTypingUsers] = useState({});
  const seenQueuedRef = useRef(new Set());
  const [seenMsgIds, setSeenMsgIds] = useState(() => new Set());
  const seenFlushTimerRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const typingSentRef = useRef(false);
  const selectionAutoScrollRef = useRef(null);

  // Composer state
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [sendFilesTogether, setSendFilesTogether] = useState(() => {
    try { return localStorage.getItem("messenger.sendFilesTogether") !== "false"; } catch { return true; }
  });
  const [pendingUploads, setPendingUploads] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  useEffect(() => {
    try { localStorage.setItem("messenger.sendFilesTogether", String(sendFilesTogether)); } catch { /* */ }
  }, [sendFilesTogether]);

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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());

  const [joinCode, setJoinCode] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberSelected, setAddMemberSelected] = useState([]);

  // Image crop
  const [cropFile, setCropFile] = useState(null);
  const [cropEditIndex, setCropEditIndex] = useState(null); // replace files[index] when set
  const [videoEditIndex, setVideoEditIndex] = useState(null);
  const [meAvatar, setMeAvatar] = useState(null);

  const refreshMeAvatar = useCallback(async () => {
    try {
      const API = `https://${import.meta.env.VITE_API_BASE}/users/`.replace(/([^:]\/)\/+?/g, "$1");
      const res = await apiRequest({ method: "GET", url: `${API}profile/list/` });
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw
        : Array.isArray(raw?.results) ? raw.results
        : Array.isArray(raw?.profiles) ? raw.profiles
        : Array.isArray(raw?.data) ? raw.data : [];
      const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const first = sorted[0];
      if (!first) { setMeAvatar(null); return; }
      const url = first.image_url || first.imageUrl || first.avatar_url
        || (typeof first.image === "string" ? first.image : first.image?.url);
      setMeAvatar(url ? withTokenQuery(url) : null);
    } catch { /* optional */ }
  }, []);

  useEffect(() => {
    refreshMeAvatar();
  }, [meId, refreshMeAvatar]);


  // Media settings dialog (camera / microphone picker for voice & video msgs)
  const [mediaSettingsOpen, setMediaSettingsOpen] = useState(false);

  // Video edit dialog (trim + crop before sending)
  const [videoEditFile, setVideoEditFile] = useState(null);

  // "Join this public group?" confirmation dialog — shown when the user clicks
  // a non-member public group row in the search results (Telegram shows a
  // preview + Join button instead of silently doing nothing).
  const [joinConfirm, setJoinConfirm] = useState(null); // { group }

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
  // Group description banners the user has dismissed (per conversation id)
  const [dismissedGroupDesc, setDismissedGroupDesc] = useState(() => new Set());
  // Lifted audio player state — shared with MessageBubble so the active voice/audio
  // bubble can render inline progress + play/pause.
  const [audioState, setAudioState] = useState({
    isPlaying: false, currentTime: 0, duration: 0, attId: null,
  });
  // Stable callback so AudioPlayerBar's useEffect doesn't loop
  const onAudioStateChange = useCallback((s) => {
    setAudioState((prev) => {
      // Avoid spamming re-renders if nothing meaningful changed
      if (
        prev.isPlaying === s.isPlaying
        && Math.abs((prev.currentTime || 0) - (s.currentTime || 0)) < 0.05
        && Math.abs((prev.duration || 0) - (s.duration || 0)) < 0.05
        && prev.attId === s.attId
      ) return prev;
      return s;
    });
  }, []);

  // Toggle play/pause for the currently-loaded audio attachment
  const onToggleAudio = useCallback(() => {
    // The AudioPlayerBar exposes toggle via a custom event hack — but the cleanest
    // way is to use a ref. We don't have one, so we just no-op here: the inline
    // play/pause on the bubble should toggle the global player. We implement that
    // by setting the audioPlayer to itself (forcing re-eval) and flipping a flag.
    // Simpler: dispatch a CustomEvent that AudioPlayerBar listens for.
    window.dispatchEvent(new CustomEvent("messenger:audio-toggle"));
  }, []);

  // Seek the global player to a ratio (0..1) of the current duration
  const onSeekAudio = useCallback((_att, ratio) => {
    window.dispatchEvent(new CustomEvent("messenger:audio-seek", { detail: { ratio } }));
  }, []);

  /** Build playable queue of voice/music from current messages (chronological). */
  const buildAudioQueue = useCallback((fromAttId) => {
    const list = [];
    for (const m of messages || []) {
      if (m?.type === "day" || m?.is_deleted) continue;
      for (const a of m.attachments || []) {
        const k = attachmentKind(a);
        const voice = isVoiceAttachment(a);
        if (k === "audio" || voice) {
          list.push({
            att: a,
            title: a.original_filename || (voice ? "Voice message" : "Audio"),
            conversationId: activeId,
            messageId: m.id,
          });
        }
      }
    }
    let queueIndex = list.findIndex((x) => String(x.att?.id) === String(fromAttId));
    if (queueIndex < 0) queueIndex = 0;
    return { queue: list, queueIndex };
  }, [messages, activeId]);

  const playAudioFromMessage = useCallback((att, message) => {
    setAudioPlayer((prev) => {
      if (prev && String(prev.att?.id) === String(att?.id)) {
        window.dispatchEvent(new CustomEvent("messenger:audio-toggle"));
        return prev;
      }
      const { queue, queueIndex } = buildAudioQueue(att?.id);
      const item = queue[queueIndex] || {
        att,
        title: att.original_filename || "Audio",
        conversationId: activeId,
        messageId: message?.id,
      };
      return {
        ...item,
        autoPlay: true,
        queue: queue.length ? queue : [item],
        queueIndex: queue.length ? queueIndex : 0,
      };
    });
  }, [buildAudioQueue, activeId]);

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

  // "Not authenticated" popup — shown when the messenger is opened without
  // a valid access token (or when the token expired and refresh failed).
  // The popup prompts the user to go to the sign-in / sign-up page instead
  // of leaving them looking at a blank black screen.
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  useEffect(() => {
    if (!meId) setShowAuthPopup(true);
  }, [meId]);
  // Listen for explicit auth-failed events (e.g. apiRequest redirect)
  useEffect(() => {
    const onAuthFailed = () => setShowAuthPopup(true);
    window.addEventListener("messenger:auth-failed", onAuthFailed);
    return () => window.removeEventListener("messenger:auth-failed", onAuthFailed);
  }, []);
  // Mirror state into refs so the WebSocket handler (which is bound once on mount)
  // can read the latest values without re-binding every render.
  const panelHistoryRef = useRef([]);
  const profileDataRef = useRef(null);
  useEffect(() => { panelHistoryRef.current = panelHistory; }, [panelHistory]);
  useEffect(() => { profileDataRef.current = profileData; }, [profileData]);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  // Keep cache warm whenever live messages change for the active chat
  useEffect(() => {
    if (!activeId) return;
    if (String(messagesConvIdRef.current) !== String(activeId)) return;
    if (!messages?.length) return;
    const prev = messagesCacheRef.current.get(String(activeId)) || {};
    const el = listRef.current;
    let scrollPatch = {};
    if (el) {
      const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      scrollPatch = {
        scrollTop: el.scrollTop,
        distanceBottom: distBottom,
        nearBottom: distBottom < 140,
      };
    }
    messagesCacheRef.current.set(String(activeId), {
      ...prev,
      ...scrollPatch,
      messages,
      hasMore: hasMoreMsgs,
      nextBefore,
      detail: activeDetail || prev.detail || null,
    });
  }, [activeId, messages, hasMoreMsgs, nextBefore, activeDetail]);

  // Restore cached scroll position after messages paint (once per switch)
  useEffect(() => {
    const restore = pendingScrollRestoreRef.current;
    if (!restore || !activeId || !messages?.length) return;
    if (!listRef.current) return;
    const apply = (clear) => {
      const box = listRef.current;
      if (!box) return;
      const r = pendingScrollRestoreRef.current || restore;
      if (!r) return;
      if (r.nearBottom) {
        box.scrollTop = box.scrollHeight;
      } else if (r.distanceBottom != null) {
        box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight - r.distanceBottom);
      } else if (r.scrollTop != null) {
        box.scrollTop = r.scrollTop;
      }
      if (clear) pendingScrollRestoreRef.current = null;
    };
    requestAnimationFrame(() => {
      apply(false);
      requestAnimationFrame(() => apply(true));
    });
  }, [activeId, messages]);

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
      if (data?.id) {
        const key = String(data.id);
        const prev = messagesCacheRef.current.get(key) || {};
        messagesCacheRef.current.set(key, { ...prev, detail: data });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadMessages = useCallback(async (cid, { silent = false, preserveOlder = false } = {}) => {
    if (!cid) return;
    const key = String(cid);
    const cached = messagesCacheRef.current.get(key);
    const hasCachedMsgs = Boolean(cached?.messages?.length);
    const isActive = () => String(activeIdRef.current) === key;

    // Spinner only for cold open of active chat (no cache, nothing on screen)
    if (!silent && !hasCachedMsgs && isActive()) {
      setLoadingMsgs(true);
    }

    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?limit=${PAGE_SIZE}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const items = data?.results || [];
      const hm = Boolean(data?.has_more);
      const nb = data?.next_before_id || (items.length ? items[0].id : null);

      const mergeLists = (prev, incoming) => {
        if (!prev?.length) return incoming || [];
        const map = new Map();
        for (const m of prev) {
          if (m?.id != null) map.set(String(m.id), m);
        }
        for (const m of incoming || []) {
          if (m?.id == null) continue;
          const k = String(m.id);
          map.set(k, { ...(map.get(k) || {}), ...m });
        }
        return Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          if (ta !== tb) return ta - tb;
          return Number(a.id) - Number(b.id);
        });
      };

      const mergedForCache = (silent || preserveOlder)
        ? mergeLists(cached?.messages || [], items)
        : items;
      messagesCacheRef.current.set(key, {
        messages: mergedForCache,
        hasMore: (silent || preserveOlder) ? Boolean(cached?.hasMore || hm) : hm,
        nextBefore: (silent || preserveOlder) ? (cached?.nextBefore || nb) : nb,
        detail: messagesCacheRef.current.get(key)?.detail || null,
      });

      // Don't update UI if user already switched away
      if (!isActive()) return;

      if (silent || preserveOlder) {
        setMessages((prev) => mergeLists(prev, items));
        messagesConvIdRef.current = cid;
        if (!nextBeforeRef.current && nb) {
          setNextBefore(nb);
          nextBeforeRef.current = nb;
        }
        if (hm && !hasMoreMsgsRef.current) {
          setHasMoreMsgs(true);
          hasMoreMsgsRef.current = true;
        }
      } else {
        setMessages(items);
        messagesConvIdRef.current = cid;
        setHasMoreMsgs(hm);
        setNextBefore(nb);
        hasMoreMsgsRef.current = hm;
        nextBeforeRef.current = nb;
      }

      try {
        wsRef.current?.send(JSON.stringify({ type: "subscribe", conversation_id: Number(cid) }));
      } catch { /* */ }
      // Viewport-only receipts — see markVisibleMessagesRead()
      if (!silent && !preserveOlder) {
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 30);
      }
    } catch (e) {
      if (isActive()) setError(e?.response?.data?.message || "Failed to load messages");
    } finally {
      if (isActive()) setLoadingMsgs(false);
    }
  }, []);


  const loadOlder = useCallback(async () => {
    const cid = activeIdRef.current;
    if (!cid || loadingMoreRef.current) return;
    // Resolve cursor: prefer ref/state, fall back to oldest loaded message id
    let cursor = nextBeforeRef.current || nextBefore;
    if (!cursor) {
      // Derive from current messages (oldest id)
      // messages state may be stale in closure — read from cache
      const cached = messagesCacheRef.current.get(String(cid));
      const list = cached?.messages || [];
      if (list.length) cursor = list[0]?.id;
    }
    if (!cursor && !hasMoreMsgsRef.current && !hasMoreMsgs) return;
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const el = listRef.current;
    const prevH = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?limit=${PAGE_SIZE}&before_id=${cursor}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const older = data?.results || [];
      if (!older.length) {
        setHasMoreMsgs(false);
        setNextBefore(null);
        hasMoreMsgsRef.current = false;
        nextBeforeRef.current = null;
        return;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => String(m.id)));
        const uniqueOlder = older.filter((m) => m?.id != null && !ids.has(String(m.id)));
        return [...uniqueOlder, ...prev];
      });
      const hm = Boolean(data?.has_more);
      const nb = data?.next_before_id || older[0]?.id || null;
      setHasMoreMsgs(hm);
      setNextBefore(nb);
      hasMoreMsgsRef.current = hm;
      nextBeforeRef.current = nb;
      requestAnimationFrame(() => {
        if (!el) return;
        const diff = el.scrollHeight - prevH;
        el.scrollTop = prevTop + diff;
      });
    } catch { /* */ } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMoreMsgs, nextBefore]);

  const stopAllMedia = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("messenger:audio-stop"));
    } catch { /* */ }
    try {
      document.querySelectorAll("video").forEach((v) => {
        try { v.pause(); } catch { /* */ }
      });
    } catch { /* */ }
    setAudioPlayer(null);
  }, []);

  const closeChat = useCallback(() => {
    // Cache is kept so reopening is instant
    setActiveId(null);
    activeIdRef.current = null;
    setActiveDetail(null);
    setMessages([]);
    setHasMoreMsgs(false);
    setNextBefore(null);
    hasMoreMsgsRef.current = false;
    nextBeforeRef.current = null;
    setMobileShowChat(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setReplyTo(null);
    setEditingMsg(null);
    setText("");
    closePanel();
    setHashReady(true);
    setHash(null);
    if (isMobile) setDrawerOpen(true);
  }, [isMobile, closePanel]);

  const openChat = useCallback(async (c, { hashUser, jumpToMessageId } = {}) => {
    if (!c?.id) return;
    const cid = String(c.id);
    // Persist scroll position of the chat we are leaving
    if (activeIdRef.current && String(activeIdRef.current) !== cid) {
      const el = listRef.current;
      const prevKey = String(activeIdRef.current);
      const prev = messagesCacheRef.current.get(prevKey) || {};
      if (el) {
        const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        messagesCacheRef.current.set(prevKey, {
          ...prev,
          scrollTop: el.scrollTop,
          distanceBottom: distBottom,
          nearBottom: distBottom < 140,
        });
      }
    }

    setActiveId(c.id);
    activeIdRef.current = c.id;
    setMobileShowChat(true);
    setReplyTo(null);
    setEditingMsg(null);
    setText("");
    setCtx(null);
    if (isMobile) setDrawerOpen(false);

    // Restore from cache instantly (no spinner / no blank flash)
    const cached = messagesCacheRef.current.get(cid);
    setNewBelowCount(0);
    pendingNewIdsRef.current = [];
    seenQueuedRef.current = new Set();
    setSeenMsgIds(new Set());
    setShowScrollDown(false);
    setTypingUsers({});
    typingSentRef.current = false;
    if (cached?.messages?.length) {
      messagesConvIdRef.current = c.id;
      setMessages(cached.messages);
      setHasMoreMsgs(Boolean(cached.hasMore));
      setNextBefore(cached.nextBefore || null);
      hasMoreMsgsRef.current = Boolean(cached.hasMore);
      nextBeforeRef.current = cached.nextBefore || null;
      if (cached.detail) setActiveDetail(cached.detail);
      setLoadingMsgs(false);
      // Queue scroll restore (applied after paint)
      if (!jumpToMessageId) {
        pendingScrollRestoreRef.current = {
          scrollTop: cached.scrollTop,
          distanceBottom: cached.distanceBottom,
          nearBottom: cached.nearBottom,
        };
      }
    } else {
      messagesConvIdRef.current = null;
      setMessages([]);
      setHasMoreMsgs(false);
      setNextBefore(null);
      hasMoreMsgsRef.current = false;
      nextBeforeRef.current = null;
      pendingScrollRestoreRef.current = null;
    }

    if (jumpToMessageId) pendingJumpRef.current = jumpToMessageId;

    try {
      if (isMobile) {
        const state = window.history.state || {};
        if (!state.messengerChat) {
          window.history.pushState(
            { ...state, messengerChat: true, messengerChatId: c.id },
            "",
            window.location.href
          );
        } else {
          window.history.replaceState(
            { ...state, messengerChat: true, messengerChatId: c.id },
            "",
            window.location.href
          );
        }
      }
    } catch { /* */ }
    if (hashUser) setHash("u", hashUser);
    else if (c.type === "private" && c.peer?.username) setHash("u", c.peer.username);
    else setHash("c", c.id);

    // Background merge refresh when cached; full load when cold
    if (cached?.messages?.length) {
      await Promise.all([
        loadMessages(c.id, { silent: true, preserveOlder: true }),
        loadConversationDetail(c.id),
      ]);
      // Re-apply scroll after silent merge (message list may have grown)
      const restore = pendingScrollRestoreRef.current;
      if (restore && listRef.current && !jumpToMessageId) {
        const el = listRef.current;
        requestAnimationFrame(() => {
          if (!listRef.current) return;
          const box = listRef.current;
          if (restore.nearBottom) {
            box.scrollTop = box.scrollHeight;
          } else if (restore.distanceBottom != null) {
            box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight - restore.distanceBottom);
          } else if (restore.scrollTop != null) {
            box.scrollTop = restore.scrollTop;
          }
          pendingScrollRestoreRef.current = null;
        });
      }
    } else {
      await Promise.all([loadMessages(c.id), loadConversationDetail(c.id)]);
    }

    // After load, jump if requested
    if (pendingJumpRef.current) {
      const target = pendingJumpRef.current;
      pendingJumpRef.current = null;
      // try scroll; if missing keep loading older pages
      const tryJump = async () => {
        for (let i = 0; i < 25; i++) {
          const el = document.getElementById(`msg-${target}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setJumpHighlightId(target);
            setTimeout(() => setJumpHighlightId((cur) => (cur === target ? null : cur)), 2000);
            return;
          }
          if (!hasMoreMsgsRef.current) break;
          await loadOlder();
          await new Promise((r) => setTimeout(r, 40));
        }
        flash("Message not found in history");
      };
      setTimeout(() => { tryJump(); }, 80);
    } else if (!cached?.messages?.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "auto" }), 40);
    }
  }, [isMobile, loadMessages, loadConversationDetail, loadOlder]);

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

  /* WebSocket — with token refresh on expired-token disconnect.
   *
   * The backend closes the socket with code 4401 when the JWT is invalid/expired.
   * When that happens we attempt to refresh the access token and reconnect once.
   * If refresh fails, the user is redirected to /signin_or_signup by
   * refreshAccessToken().
   *
   * We also proactively refresh the token shortly before it expires so that
   * the WS connection doesn't drop in the first place.
   */
  useEffect(() => {
    let cancelled = false;
    let pingTimer = null;
    let reconnectTimer = null;
    let refreshing = false;

    const buildUrl = (tok) => `${WS_URL}?token=${encodeURIComponent(tok)}`;

    const handleOnMessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.type === "message.deleted") {
        const mid = data.message_id || data.id;
        const cid = String(data.conversation_id || "");
        if (mid && cid === String(activeIdRef.current)) {
          setMessages((prev) => prev.filter((m) => String(m.id) !== String(mid)));
          // patch cache
          const cached = messagesCacheRef.current.get(cid);
          if (cached?.messages) {
            messagesCacheRef.current.set(cid, {
              ...cached,
              messages: cached.messages.filter((m) => String(m.id) !== String(mid)),
            });
          }
        }
        loadConversations({ silent: true });
      }
      if (["message.new", "message.edited", "message.reaction", "message.read"].includes(data.type)) {
        if (String(data.conversation_id) === String(activeIdRef.current)) {
          if (data.type === "message.new") {
            const mid = data.message?.id || data.message_id || data.id;
            if (mid && !nearBottomRef.current) {
              const sid = String(mid);
              if (!pendingNewIdsRef.current.includes(sid)) {
                pendingNewIdsRef.current = [...pendingNewIdsRef.current, sid];
                setNewBelowCount(pendingNewIdsRef.current.length);
              }
            } else if (nearBottomRef.current) {
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 40);
            }
          }
          loadMessages(activeIdRef.current, { silent: true });
        }
        loadConversations({ silent: true });
      }
      if (data.type === "typing" && String(data.conversation_id) === String(activeIdRef.current)) {
        const uid = Number(data.user_id);
        if (!uid || String(uid) === String(meId)) return;
        setTypingUsers((prev) => {
          const next = { ...prev };
          if (data.is_typing) {
            next[uid] = {
              username: data.username || "Someone",
              until: Date.now() + 4000,
            };
          } else {
            delete next[uid];
          }
          return next;
        });
      }
      if (data.type === "presence.update" && data.user_id != null) {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (data.online) next.add(Number(data.user_id));
          else next.delete(Number(data.user_id));
          return next;
        });
        loadConversations({ silent: true });
      }
      if ([
        "member.left", "member.removed", "member.role_changed",
        "ownership.transferred", "conversation.deleted", "member.joined",
        "messages.cleared",
      ].includes(data.type)) {
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
          loadMessages(data.conversation_id, { silent: data.type !== "messages.cleared" });
          if (panelHistoryRef.current.includes("join-requests")) {
            loadConvJoinRequests(data.conversation_id);
          }
        }
        loadConversations({ silent: true });
      }
      if (data.type === "profile.update") {
        loadConversations({ silent: true });
        if (activeIdRef.current) {
          loadConversationDetail(activeIdRef.current);
          // Do not reload messages on profile updates — that used to wipe
          // older pages the user had already scrolled in.
        }
        if (profileDataRef.current?.id && String(profileDataRef.current.id) === String(data.user_id)) {
          refreshProfileData(profileDataRef.current.id);
        }
      }
      if (data.type === "group.settings_changed") {
        if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
          loadConversationDetail(data.conversation_id);
          loadMessages(data.conversation_id, { silent: false });
        }
        loadConversations({ silent: true });
      }
      if ([
        "join_request.new", "join_request.approved",
        "join_request.rejected", "join_request.cancelled",
      ].includes(data.type)) {
        if (data.conversation_id && String(data.conversation_id) === String(activeIdRef.current)) {
          loadConvJoinRequests(data.conversation_id);
        }
        if (panelHistoryRef.current.includes("my-requests")) {
          loadMyJoinRequests();
        }
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

    const connect = async () => {
      let token = localStorage.getItem("access");
      if (!token) {
        // Not logged in — abort. The auth-changed listener will reconnect
        // after the user logs in.
        return;
      }
      // Proactively refresh the token if it's about to expire.
      try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        const exp = Number(payload.exp || 0) * 1000;
        if (exp && exp - Date.now() < 10000) {
          if (!refreshing) {
            refreshing = true;
            try { token = await refreshAccessToken(); }
            catch { refreshing = false; return; }
            finally { refreshing = false; }
          }
        }
      } catch { /* not a JWT — fall through */ }

      if (cancelled) return;
      const ws = new WebSocket(buildUrl(token));
      wsRef.current = ws;
      ws.onmessage = handleOnMessage;
      ws.onclose = (ev) => {
        clearInterval(pingTimer);
        if (cancelled) return;
        // 4401 = our backend's "auth failed" close code (see consumers.py).
        // Try to refresh the token and reconnect once.
        if (ev.code === 4401) {
          if (!refreshing) {
            refreshing = true;
            refreshAccessToken()
              .then(() => {
                refreshing = false;
                if (!cancelled) reconnectTimer = setTimeout(connect, 300);
              })
              .catch(() => {
                refreshing = false;
                // refreshAccessToken already redirected to /signin_or_signup
              });
          }
          return;
        }
        // Other close codes — try to reconnect with exponential backoff.
        // The token might still be valid (network blip, server restart, etc.).
        if (!localStorage.getItem("access")) return;
        reconnectTimer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        try { ws.close(); } catch { /* */ }
      };
      pingTimer = setInterval(() => {
        try { ws.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
      }, 25000);
    };

    connect();

    // Listen for auth changes (login / logout / token refresh) so we reconnect
    // immediately after the user logs in.
    const onAuth = () => {
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      try { wsRef.current?.close(); } catch { /* */ }
      reconnectTimer = setTimeout(connect, 200);
    };
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth);

    return () => {
      cancelled = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
      try { wsRef.current?.close(); } catch { /* */ }
    };
  }, [loadConversations, loadMessages]);

  /* Esc global — closes dialogs/panels in priority order */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (preview) { setPreview(null); return; }
      if (galleryState) { setGalleryState(null); return; }
      if (readersMessage) { setReadersMessage(null); return; }
      if (videoEditFile) { setVideoEditFile(null); return; }
      if (cropFile) { setCropFile(null); return; }
      if (mediaSettingsOpen) { setMediaSettingsOpen(false); return; }
      if (ctx) { setCtx(null); return; }
      if (reactAnchor) { setReactAnchor(null); return; }
      if (editingMsg) { setEditingMsg(null); setText(""); return; }
      if (replyTo) { setReplyTo(null); return; }
      if (panelHistory.length) { popPanel(); return; }
      if (activeId) { closeChat(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, galleryState, readersMessage, videoEditFile, cropFile, mediaSettingsOpen, ctx, reactAnchor, editingMsg, replyTo, panelHistory, activeId, closeChat, popPanel]);

  /**
   * Mobile browser / OS back button:
   *  - While inside a chat → go back to conversation list (do NOT leave messenger)
   *  - While on conversation list → require a second back press to leave messenger
   */
  const exitConfirmRef = useRef(false);
  const exitToastTimerRef = useRef(null);
  const [exitHint, setExitHint] = useState(false);

  useEffect(() => {
    try {
      const st = window.history.state || {};
      if (!st.messengerRoot) {
        window.history.replaceState({ ...st, messengerRoot: true }, "", window.location.href);
      }
    } catch { /* */ }

    const onPopState = () => {
      if (preview) { setPreview(null); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (galleryState) { setGalleryState(null); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (readersMessage) { setReadersMessage(null); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (videoEditFile) { setVideoEditFile(null); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (cropFile) { setCropFile(null); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (mediaSettingsOpen) { setMediaSettingsOpen(false); window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href); return; }
      if (panelHistory.length) {
        popPanel();
        window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href);
        return;
      }

      if (activeId || mobileShowChat) {
        closeChat();
        try {
          window.history.pushState({ messengerRoot: true }, "", window.location.href);
        } catch { /* */ }
        exitConfirmRef.current = false;
        setExitHint(false);
        return;
      }

      if (!exitConfirmRef.current) {
        exitConfirmRef.current = true;
        setExitHint(true);
        try {
          window.history.pushState({ messengerRoot: true }, "", window.location.href);
        } catch { /* */ }
        if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
        exitToastTimerRef.current = setTimeout(() => {
          exitConfirmRef.current = false;
          setExitHint(false);
        }, 2000);
        return;
      }

      exitConfirmRef.current = false;
      setExitHint(false);
      stopAllMedia();
      navigate(-1);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (exitToastTimerRef.current) clearTimeout(exitToastTimerRef.current);
    };
  }, [
    activeId, mobileShowChat, closeChat, popPanel, panelHistory, preview, galleryState,
    readersMessage, videoEditFile, cropFile, mediaSettingsOpen, stopAllMedia, navigate,
  ]);

  // Stop media when Messenger unmounts
  useEffect(() => {
    return () => {
      try {
        window.dispatchEvent(new CustomEvent("messenger:audio-stop"));
      } catch { /* */ }
      try {
        document.querySelectorAll("video").forEach((v) => {
          try { v.pause(); } catch { /* */ }
        });
      } catch { /* */ }
    };
  }, []);

  /* Expire stale typing indicators */
  useEffect(() => {
    const t = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.until > now) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

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


  const onChatDragEnter = (e) => {
    if (!activeIdRef.current) return;
    if (!e.dataTransfer?.types?.includes?.("Files") && !(e.dataTransfer?.types && [...e.dataTransfer.types].includes("Files"))) return;
    e.preventDefault();
    e.stopPropagation();
    chatDragDepthRef.current += 1;
    setChatFileDrag(true);
  };
  const onChatDragOver = (e) => {
    if (!activeIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    try { e.dataTransfer.dropEffect = "copy"; } catch { /* */ }
  };
  const onChatDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragDepthRef.current = Math.max(0, chatDragDepthRef.current - 1);
    if (chatDragDepthRef.current === 0) setChatFileDrag(false);
  };
  const onDropFilesToChat = (e) => {
    e.preventDefault();
    e.stopPropagation();
    chatDragDepthRef.current = 0;
    setChatFileDrag(false);
    if (!activeIdRef.current) return;
    const list = e.dataTransfer?.files;
    if (!list?.length) return;
    const arr = Array.from(list).map((f) => attachMessengerOriginal(f, f));
    setFiles((prev) => [...prev, ...arr]);
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

    const filesToSend = [...files];
    const emptyFile = filesToSend.find((f) => !f || Number(f.size || 0) <= 0);
    if (emptyFile) {
      setError(`${emptyFile?.name || "File"} is empty and was not sent`);
      return;
    }

    // Plain text or the selected "all files in one message" mode.
    if (!filesToSend.length || sendFilesTogether || filesToSend.length === 1) {
      const form = new FormData();
      form.append("body", body);
      if (replyTo) form.append("reply_to", replyTo.id);
      filesToSend.forEach((f) => form.append("files", f));
      const pendingId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (filesToSend.length) {
        const totalBytes = filesToSend.reduce((sum, f) => sum + Number(f.size || 0), 0);
        setPendingUploads((prev) => [...prev, {
          id: pendingId, conversationId: activeId, body,
          files: filesToSend.map((f) => ({ name: f.name, size: f.size, type: f.type })),
          loaded: 0, total: totalBytes, progress: 0, status: "uploading",
        }]);
      }
      setText(""); setFiles([]);
      const rep = replyTo; setReplyTo(null);
      try {
        const res = await apiRequest({
          method: "POST", url: `${MSG_API}/conversations/${activeId}/messages/`, data: form,
          onUploadProgress: (event) => {
            if (!filesToSend.length) return;
            const total = event.total || filesToSend.reduce((sum, f) => sum + Number(f.size || 0), 0);
            const loaded = event.loaded || 0;
            const progress = total ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
            setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, loaded, total, progress } : u));
          },
        });
        const created = unwrapData(res);
        if (created) {
          if (filesToSend.length) {
            setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, progress: 100, status: "sent" } : u));
          }
          await loadMessages(activeId, { silent: true });
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
          loadConversations({ silent: true });
          if (filesToSend.length) setTimeout(() => setPendingUploads((prev) => prev.filter((u) => u.id !== pendingId)), 600);
        }
      } catch (e) {
        if (rep) setReplyTo(rep);
        const msg = e?.response?.data?.message || "Send failed";
        setError(msg);
        if (filesToSend.length) setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, status: "failed", error: msg } : u));
      }
      return;
    }

    // "Send separately": each selected file becomes its own message.
    const rep = replyTo;
    setText(""); setFiles([]); setReplyTo(null);
    let firstError = null;
    for (let i = 0; i < filesToSend.length; i += 1) {
      const file = filesToSend[i];
      const pendingId = `upload-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
      setPendingUploads((prev) => [...prev, {
        id: pendingId, conversationId: activeId, body: i === 0 ? body : "",
        files: [{ name: file.name, size: file.size, type: file.type }],
        loaded: 0, total: Number(file.size || 0), progress: 0, status: "uploading",
      }]);
      const form = new FormData();
      if (i === 0) form.append("body", body);
      if (i === 0 && rep) form.append("reply_to", rep.id);
      form.append("files", file);
      try {
        await apiRequest({
          method: "POST", url: `${MSG_API}/conversations/${activeId}/messages/`, data: form,
          onUploadProgress: (event) => {
            const total = event.total || Number(file.size || 0);
            const loaded = event.loaded || 0;
            const progress = total ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
            setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, loaded, total, progress } : u));
          },
        });
        setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, progress: 100, status: "sent" } : u));
      } catch (e) {
        const msg = e?.response?.data?.message || `Failed to send ${file.name || "file"}`;
        firstError = firstError || msg;
        setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, status: "failed", error: msg } : u));
      }
    }
    if (firstError) setError(firstError);
    await loadMessages(activeId, { silent: true });
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
    loadConversations({ silent: true });
    setTimeout(() => {
      setPendingUploads((prev) => prev.filter((u) => String(u.conversationId) !== String(activeId) || u.status === "failed"));
    }, 700);
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
      const ids = forwardOpen._bulkIds?.length ? forwardOpen._bulkIds : [forwardOpen.id];
      for (const id of ids) {
        try {
          await apiRequest({
            method: "POST", url: `${MSG_API}/messages/${id}/forward/`,
            data: { conversation_id: convId },
          });
        } catch { /* continue */ }
      }
      flash(ids.length > 1 ? `Forwarded ${ids.length} messages` : "Forwarded");
      setForwardOpen(null);
      setSelectionMode(false);
      setSelectedIds(new Set());
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

  const sendTypingSignal = useCallback((isTyping) => {
    const cid = activeIdRef.current;
    if (!cid || !wsRef.current || wsRef.current.readyState !== 1) return;
    try {
      wsRef.current.send(JSON.stringify({
        type: "typing",
        conversation_id: Number(cid),
        is_typing: !!isTyping,
      }));
    } catch { /* */ }
  }, []);

  const handleComposerText = useCallback((valueOrFn) => {
    setText((prev) => {
      const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
      // Notify peers we're typing (debounced stop)
      if (String(next || "").trim()) {
        if (!typingSentRef.current) {
          typingSentRef.current = true;
          sendTypingSignal(true);
        }
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
          typingSentRef.current = false;
          sendTypingSignal(false);
        }, 2500);
      } else if (typingSentRef.current) {
        typingSentRef.current = false;
        sendTypingSignal(false);
      }
      return next;
    });
  }, [sendTypingSignal]);

  const formatTypingLabel = useCallback((map, isGroup) => {
    const list = Object.values(map || {});
    if (!list.length) return "";
    const trim = (n) => {
      const s = String(n || "Someone");
      return s.length > 14 ? `${s.slice(0, 12)}…` : s;
    };
    if (!isGroup) return "is typing…";
    if (list.length === 1) return `${trim(list[0].username)} is typing…`;
    if (list.length === 2) {
      return `${trim(list[0].username)}, ${trim(list[1].username)} are typing…`;
    }
    if (list.length === 3) {
      return `${trim(list[0].username)}, ${trim(list[1].username)}, ${trim(list[2].username)} are typing…`;
    }
    return "Several people are typing…";
  }, []);

  const markChatRead = async (conv) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${conv.id}/read/`,
        data: { force_all: true },
      });
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

  // Open the "Join this group?" confirmation dialog when the user clicks a
  // non-member public group row in the search results.
  const confirmJoinPublicGroup = (group) => {
    if (!group?.id) return;
    setJoinConfirm({ group });
  };
  const onConfirmJoin = async () => {
    const g = joinConfirm?.group;
    setJoinConfirm(null);
    if (g) await joinPublicGroup(g);
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
      // Backend returns {success, message, data: {joined, conversation: {...}}}
      // unwrapData extracts .data, so we still have {joined, conversation}.
      const payload = unwrapData(res);
      const conv = payload?.conversation || (payload?.id ? payload : null);
      setJoinOpen(false); setJoinCode("");
      closePanel();
      await loadConversations({ silent: false });
      if (conv?.id) await openChat(conv);
      else flash("Joined — open the chat from the sidebar");
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
      playAudioFromMessage(att, null);
      return;
    }
    if (k === "text") {
      try {
        const r = await fetch(withTokenQuery(att.url), { headers: authHeaders() });
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
  const onJumpToMessage = useCallback(async (msgId) => {
    if (!msgId) return;
    const el0 = document.getElementById(`msg-${msgId}`);
    if (el0) {
      el0.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpHighlightId(msgId);
      setTimeout(() => setJumpHighlightId((cur) => (cur === msgId ? null : cur)), 2000);
      return;
    }
    // Message not in DOM yet — load older pages until it appears
    for (let i = 0; i < 25; i++) {
      if (!hasMoreMsgsRef.current && i > 0) break;
      await loadOlder();
      await new Promise((r) => setTimeout(r, 50));
      const el = document.getElementById(`msg-${msgId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setJumpHighlightId(msgId);
        setTimeout(() => setJumpHighlightId((cur) => (cur === msgId ? null : cur)), 2000);
        return;
      }
    }
    flash("Message not found — try Load older messages");
  }, [loadOlder]);

  const goToAudioTrack = useCallback(async ({ conversationId, messageId }) => {
    if (conversationId && String(conversationId) !== String(activeId)) {
      const conv = conversations.find((c) => String(c.id) === String(conversationId));
      if (conv) {
        await openChat(conv, { jumpToMessageId: messageId });
        return;
      }
    }
    if (messageId) await onJumpToMessage(messageId);
  }, [activeId, conversations, openChat, onJumpToMessage]);


  /* -------------------- derived -------------------- */

  const activeConv = activeDetail || conversations.find((c) => c.id === activeId);
  const peer = peerUser(activeConv, meId);
  const role = myRole(activeConv, meId);

  const recountNewBelow = () => {
    const root = listRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    const still = [];
    for (const id of pendingNewIdsRef.current) {
      const el = document.getElementById(`msg-${id}`);
      if (!el) { still.push(id); continue; }
      const r = el.getBoundingClientRect();
      const visible = r.bottom > rootRect.top + 8 && r.top < rootRect.bottom - 8;
      if (!visible || r.top > rootRect.bottom - 48) still.push(id);
    }
    pendingNewIdsRef.current = still;
    setNewBelowCount(still.length);
  };


    const flushSeenReceipts = useCallback((cid) => {
    const ids = Array.from(seenQueuedRef.current);
    if (!cid || !ids.length) return;
    const batch = ids.slice(-100).map((x) => Number(x)).filter((n) => !Number.isNaN(n));
    if (!batch.length) return;
    apiRequest({
      method: "POST",
      url: `${MSG_API}/conversations/${cid}/read/`,
      data: { message_ids: batch },
    }).then(() => {
      loadConversations({ silent: true });
    }).catch(() => {});
  }, []);

  const markVisibleMessagesRead = useCallback(() => {
    const cid = activeIdRef.current;
    const root = listRef.current;
    if (!cid || !root) return;
    const rootRect = root.getBoundingClientRect();
    let found = false;
    root.querySelectorAll("[data-msg-id]").forEach((node) => {
      const id = node.getAttribute("data-msg-id");
      if (!id) return;
      if (node.getAttribute("data-msg-mine") === "1") return;
      const r = node.getBoundingClientRect();
      const visibleH = Math.min(r.bottom, rootRect.bottom) - Math.max(r.top, rootRect.top);
      const ratio = visibleH / Math.max(r.height, 1);
      if (ratio >= 0.45 && r.top < rootRect.bottom - 4 && r.bottom > rootRect.top + 4) {
        if (!seenQueuedRef.current.has(String(id))) {
          seenQueuedRef.current.add(String(id));
          found = true;
        }
      }
    });
    if (!found) return;
    if (found) {
      setSeenMsgIds(new Set(seenQueuedRef.current));
    }
    if (seenFlushTimerRef.current) clearTimeout(seenFlushTimerRef.current);
    seenFlushTimerRef.current = setTimeout(() => flushSeenReceipts(cid), 300);
  }, [flushSeenReceipts]);

  const scrollToNextNew = () => {
    // First pending unread, centered — not the absolute bottom
    let targetId = pendingNewIdsRef.current.length ? pendingNewIdsRef.current[0] : null;
    if (!targetId) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowScrollDown(false);
      setTimeout(() => markVisibleMessagesRead(), 400);
      return;
    }
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setJumpHighlightId(targetId);
      setTimeout(() => setJumpHighlightId((cur) => (cur === targetId ? null : cur)), 1600);
      setTimeout(() => {
        recountNewBelow();
        markVisibleMessagesRead();
      }, 450);
    } else {
      (async () => {
        for (let i = 0; i < 15; i++) {
          if (!hasMoreMsgsRef.current) break;
          await loadOlder();
          await new Promise((r) => setTimeout(r, 50));
          const node = document.getElementById(`msg-${targetId}`);
          if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => { recountNewBelow(); markVisibleMessagesRead(); }, 450);
            return;
          }
        }
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => markVisibleMessagesRead(), 400);
      })();
    }
  };


  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
    pendingNewIdsRef.current = [];
    setNewBelowCount(0);
    setTimeout(() => markVisibleMessagesRead(), 400);
  };

  const onScrollMsgs = (e) => {
    const el = e.target;
    const h = el.clientHeight || 0;
    const distBottom = el.scrollHeight - el.scrollTop - h;
    nearBottomRef.current = distBottom < 120;
    setShowScrollDown(distBottom > 180);
    if (nearBottomRef.current) {
      pendingNewIdsRef.current = [];
      setNewBelowCount(0);
    } else {
      recountNewBelow();
    }
    markVisibleMessagesRead();
    const threshold = isMobile
      ? Math.max(520, h * 0.6)
      : Math.max(280, h * 0.3);
    if (el.scrollTop < threshold && (hasMoreMsgs || hasMoreMsgsRef.current) && !loadingMoreRef.current) {
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

  const selectionAnchorRef = useRef(null); // message id where selection drag started
  const selectingRef = useRef(false);

  const toggleSelectMessage = (message, forceEnter = false) => {
    if (!message?.id) return;
    const id = String(message.id);
    if (forceEnter) {
      // Long-press: select ONLY this message. Range starts after real drag.
      setSelectionMode(true);
      selectingRef.current = false;
      selectionAnchorRef.current = id;
      setSelectedIds(new Set([id]));
      return;
    }
    if (!selectionMode) setSelectionMode(true);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
    selectionAnchorRef.current = id;
  };

  const selectRangeByIds = (fromId, toId) => {
    const ids = messages.filter((m) => m?.id && !m.is_system).map((m) => String(m.id));
    const a = ids.indexOf(String(fromId));
    const b = ids.indexOf(String(toId));
    if (a < 0 || b < 0) return;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const slice = ids.slice(lo, hi + 1);
    setSelectionMode(true);
    setSelectedIds(new Set(slice));
  };

  const selectionDragStartRef = useRef(null);

  const onMessagesListPointerDown = (e) => {
    const bubble = e.target.closest?.("[data-msg-id]");
    if (!bubble) return;
    const msgId = bubble.getAttribute("data-msg-id");
    if (!msgId) return;
    if (selectionMode) {
      selectionAnchorRef.current = msgId;
      selectingRef.current = false;
      selectionDragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onMessagesListPointerMove = (e) => {
    if (!selectionMode) return;
    const start = selectionDragStartRef.current;
    if (!start && !selectingRef.current) return;
    if (!selectingRef.current && start) {
      const dx = Math.abs(e.clientX - start.x);
      const dy = Math.abs(e.clientY - start.y);
      if (dx < 12 && dy < 12) return;
      selectingRef.current = true;
    }
    if (!selectingRef.current) return;

    // Edge auto-scroll so user can keep selecting beyond the viewport
    const root = listRef.current;
    if (root) {
      const rect = root.getBoundingClientRect();
      const edge = 56;
      let delta = 0;
      if (e.clientY < rect.top + edge) {
        delta = -Math.max(8, (rect.top + edge - e.clientY) * 0.35);
      } else if (e.clientY > rect.bottom - edge) {
        delta = Math.max(8, (e.clientY - (rect.bottom - edge)) * 0.35);
      }
      if (delta) {
        root.scrollTop += delta;
        if (!selectionAutoScrollRef.current) {
          selectionAutoScrollRef.current = true;
          requestAnimationFrame(() => { selectionAutoScrollRef.current = false; });
        }
      }
    }

    const el = document.elementFromPoint(e.clientX, e.clientY);
    const bubble = el?.closest?.("[data-msg-id]");
    if (!bubble) return;
    const msgId = bubble.getAttribute("data-msg-id");
    if (!msgId) return;
    if (!selectionAnchorRef.current) selectionAnchorRef.current = msgId;
    selectRangeByIds(selectionAnchorRef.current, msgId);
  };

  const onMessagesListPointerUp = () => {
    selectingRef.current = false;
    selectionDragStartRef.current = null;
    selectionAutoScrollRef.current = false;
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} message(s)?`)) return;
    try {
      for (const id of ids) {
        try {
          await apiRequest({ method: "DELETE", url: `${MSG_API}/messages/${id}/` });
        } catch { /* continue */ }
      }
      setMessages((prev) => prev.filter((m) => !selectedIds.has(String(m.id))));
      clearSelection();
      flash("Deleted");
    } catch {
      setError("Failed to delete some messages");
    }
  };

  const bulkForwardSelected = () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    // Reuse forward dialog for first selected; multi-forward best-effort
    const first = messages.find((m) => String(m.id) === ids[0]);
    if (first) setForwardOpen({ ...first, _bulkIds: ids });
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
      onDragEnter={onChatDragEnter}
      onDragOver={onChatDragOver}
      onDragLeave={onChatDragLeave}
      onDrop={onDropFilesToChat}
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
          {chatFileDrag && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 40,
                bgcolor: (t) => t.palette.mode === "dark"
                  ? "rgba(25,118,210,0.22)"
                  : "rgba(25,118,210,0.14)",
                border: "3px dashed",
                borderColor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Box sx={{
                px: 2.5, py: 1.5,
                borderRadius: 2,
                bgcolor: "background.paper",
                boxShadow: 6,
                textAlign: "center",
              }}>
                <Typography fontWeight={800} color="primary.main">
                  Drop files to attach
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Images, videos, documents…
                </Typography>
              </Box>
            </Box>
          )}
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{
              px: 1, py: 0.85, bgcolor: "background.paper",
              borderBottom: "1px solid", borderColor: "divider", minHeight: 56,
              position: "relative", zIndex: 11,
            }}>
            {isMobile && <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>}
            {!isMobile && (
              <IconButton
                onClick={() => setDrawerOpen((v) => !v)}
                size="small"
                title={drawerOpen ? "Hide chat list" : "Show chat list"}
              >
                {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
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
              <Stack direction="row" spacing={0.5} alignItems="center"
                onClick={(e) => { if (peer?.username) e.stopPropagation(); }}
              >
                <Typography
                  variant="caption"
                  color={Object.keys(typingUsers).length ? "primary.main" : "text.secondary"}
                  noWrap
                  sx={{ fontStyle: Object.keys(typingUsers).length ? "italic" : "normal", maxWidth: 220 }}
                >
                  {Object.keys(typingUsers).length
                    ? formatTypingLabel(typingUsers, activeConv?.type === "group")
                    : activeConv?.type === "group"
                      ? `${(activeConv?.participants || []).length} members`
                      : peer?.id && onlineUsers.has(Number(peer.id))
                        ? "online"
                        : peer?.username ? `@${peer.username}` : "tap for info"}
                </Typography>
                {peer?.username && (
                  <Tooltip title="Copy username">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(peer.username);
                        flash("Username copied");
                      }}
                      sx={{ p: 0.2 }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
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

          {/* Mini-player sits UNDER the user header (avatar + username) */}
          <AudioPlayerBar
            player={audioPlayer}
            onChange={setAudioPlayer}
            onStateChange={onAudioStateChange}
            onGoToTrack={goToAudioTrack}
          />

          {/* Multi-select action bar — under header + audio player */}
          {selectionMode && (
            <Box
              sx={{
                bgcolor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                px: 1.5, py: 0.75,
                display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap",
                zIndex: 5,
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 72 }}>
                {selectedIds.size} selected
              </Typography>
              {selectedIds.size === 1 && (
                <Button
                  size="small"
                  onClick={() => {
                    const id = Array.from(selectedIds)[0];
                    const m = messages.find((x) => String(x.id) === String(id));
                    if (m) { setReplyTo(m); setEditingMsg(null); }
                    clearSelection();
                    inputRef.current?.focus();
                  }}
                >Reply</Button>
              )}
              <Button size="small" onClick={bulkForwardSelected} disabled={!selectedIds.size}>Forward</Button>
              <Button size="small" color="error" onClick={bulkDeleteSelected} disabled={!selectedIds.size}>Delete</Button>
              <Button size="small" onClick={clearSelection}>Cancel</Button>
            </Box>
          )}

          {/* "Add to contacts?" banner — Telegram-style.
              Shows when the active chat is private AND the peer is NOT in the
              current user's contacts. The user can dismiss (X) or accept (Add). */}
          {activeConv?.type === "private" && peer && peer.is_contact === false && !peer.is_blocked && (
            <AddToContactsBanner
              username={peer.username}
              onAdd={() => addContact(peer.id)}
            />
          )}

          {/* Group description banner — visible to non-admin members so they
              see what the group is about without opening the info panel.
              Admins see the editable description in the info panel instead. */}
          {activeConv?.type === "group"
            && activeConv.description
            && role !== "owner" && role !== "admin"
            && !dismissedGroupDesc.has(activeConv.id) && (
            <GroupDescriptionBanner
              description={activeConv.description}
              onDismiss={() => setDismissedGroupDesc((s) => new Set(s).add(activeConv.id))}
            />
          )}

          <Box
            ref={listRef} onScroll={onScrollMsgs}
            sx={{
              position: "relative",
              flex: 1, overflow: "auto", px: { xs: 0.75, sm: 1.5 }, py: 1,
              // Soften visual jank when older messages prepend
              scrollBehavior: "auto",
              "& > *": { transition: "opacity 0.2s ease" },
              touchAction: selectionMode ? "none" : "pan-y",
              userSelect: selectionMode ? "none" : "auto",
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              // Mobile/desktop: right-click anywhere in list tries to open menu for nearest message
              const bubble = e.target.closest?.("[data-msg-id]");
              if (bubble) {
                const id = bubble.getAttribute("data-msg-id");
                const msg = messages.find((x) => String(x.id) === String(id));
                if (msg) openCtx(e, msg);
              }
            }}
            onPointerDown={onMessagesListPointerDown}
            onPointerMove={onMessagesListPointerMove}
            onPointerUp={onMessagesListPointerUp}
            onPointerCancel={onMessagesListPointerUp}
            onPointerLeave={onMessagesListPointerUp}
          >
            {hasMoreMsgs && (
              <Box
                sx={{
                  textAlign: "center",
                  py: 1.25,
                  opacity: loadingMore ? 1 : 0.85,
                  transition: "opacity 0.25s ease",
                }}
              >
                {loadingMore
                  ? (
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                      <CircularProgress size={16} thickness={4} />
                      <Typography variant="caption" color="text.secondary">Loading earlier messages…</Typography>
                    </Stack>
                  )
                  : <Button size="small" onClick={loadOlder} sx={{ textTransform: "none" }}>Load older messages</Button>}
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
                  selectionMode={selectionMode}
                  selected={selectedIds.has(String(m.id))}
                  isUnread={
                    String(m.sender?.id) !== String(meId)
                    && !m.is_system
                    && !seenMsgIds.has(String(m.id))
                  }
                  onToggleSelect={toggleSelectMessage}
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
                  onPlayAudio={(att) => playAudioFromMessage(att, m)}
                  onToggleAudio={onToggleAudio}
                  onSeekAudio={onSeekAudio}
                  activeAudioId={audioState.attId}
                  audioIsPlaying={audioState.isPlaying}
                  audioCurrentTime={audioState.currentTime}
                  audioDuration={audioState.duration}
                  onMentionClick={loadUserProfileByUsername}
                />
              </Box>
            ))}
            {pendingUploads
              .filter((u) => String(u.conversationId) === String(activeId))
              .map((u) => (
                <Box key={u.id} sx={{ display: "flex", justifyContent: "flex-end", mb: 0.8, px: 0.5 }}>
                  <Box sx={{
                    width: { xs: "82%", sm: 360 },
                    maxWidth: "82%",
                    px: 1.25,
                    py: 1,
                    borderRadius: "14px 14px 4px 14px",
                    bgcolor: u.status === "failed" ? "error.dark" : "primary.main",
                    color: "#fff",
                    boxShadow: 1,
                  }}>
                    {u.body && (
                      <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 14.5, mb: 0.5 }}>
                        {u.body}
                      </Typography>
                    )}
                    <Stack spacing={0.5}>
                      {u.files.map((f, idx) => (
                        <Typography key={`${f.name}-${idx}`} variant="caption" noWrap sx={{ opacity: 0.9 }}>
                          {f.name || "file"}
                        </Typography>
                      ))}
                      <LinearProgress
                        variant={u.total ? "determinate" : "indeterminate"}
                        value={u.progress || 0}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "rgba(255,255,255,0.25)",
                          "& .MuiLinearProgress-bar": { bgcolor: "#fff" },
                        }}
                      />
                      <Typography variant="caption" sx={{ opacity: 0.85, textAlign: "right" }}>
                        {u.status === "failed" ? (u.error || "Failed") : u.status === "sent" ? "Sent" : `${u.progress || 0}% uploading`}
                      </Typography>
                    </Stack>
                  </Box>
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
              text={text} setText={handleComposerText}
              files={files} setFiles={(v) => {
                const next = typeof v === "function" ? v(files) : v;
                setFiles(next);
              }}
              sendFilesTogether={sendFilesTogether}
              setSendFilesTogether={setSendFilesTogether}
              replyTo={replyTo} editingMsg={editingMsg}
              onCancelReplyOrEdit={() => { setReplyTo(null); setEditingMsg(null); setText(""); }}
              onSend={sendOrEdit}
              onPickImage={(f) => { attachMessengerOriginal(f, f); setCropFile(f); }}
              onPickVideo={(f) => setVideoEditFile(f)}
              inputRef={inputRef}
              onKeyDown={onComposerKeyDown}
              onEditAttachment={(file, index) => {
                if (file?.type?.startsWith("image/")) {
                  setCropEditIndex(index);
                  setCropFile(messengerOriginalOf(file));
                } else if (file?.type?.startsWith("video/")) {
                  setVideoEditIndex(index);
                  setVideoEditFile(file);
                }
              }}
            />
          )}

          {(showScrollDown || newBelowCount > 0) && (
            <Box
              sx={{
                position: "absolute",
                right: { xs: 12, sm: 16 },
                bottom: { xs: 78, sm: 86 },
                zIndex: 12,
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "flex-end",
              }}
            >
              {(showScrollDown || newBelowCount > 0) && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={newBelowCount > 0 ? scrollToNextNew : scrollToBottom}
                  sx={{
                    pointerEvents: "auto",
                    borderRadius: 999,
                    minWidth: 44,
                    height: 44,
                    px: newBelowCount > 0 ? 1.5 : 1.25,
                    boxShadow: 6,
                    textTransform: "none",
                    fontWeight: 800,
                  }}
                >
                  {newBelowCount > 0 ? `↓ ${newBelowCount}` : "↓"}
                </Button>
              )}
            </Box>
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
      onConfirmJoinPublicGroup={confirmJoinPublicGroup}
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
      audioPlayer={audioPlayer}
      onAudioPlayerChange={setAudioPlayer}
      onAudioStateChange={onAudioStateChange}
      onGoToAudioTrack={goToAudioTrack}
      showAudioPlayer={isMobile}
      meAvatar={meAvatar}
    />
  );

  /* -------------------- render -------------------- */

  const ctxMsg = ctx?.message;
  const ctxMine = ctxMsg && String(ctxMsg.sender?.id) === String(meId);

  // Right panel content (rendered inside the centered modal Dialog below)
  const panelIsOpen = Boolean(rightPanel) && rightPanel !== "my-profile";

  return (
    <Box
      sx={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column", bgcolor: "background.default" }}
      onClick={() => { if (ctx) setCtx(null); }}
    >
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
      {/* Mobile sidebar — player is rendered inside Sidebar above the search bar */}
      {isMobile && (!activeId || !mobileShowChat) && (
        <Box sx={{
          width: "100%", height: "100%", position: "absolute", inset: 0, zIndex: 2,
          bgcolor: "background.paper",
        }}>
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

      </Box>{/* end main flex row under player */}

      {/* Centered settings / panel modal (with back-button navigation) */}
      <Dialog
        open={panelIsOpen}
        onClose={closePanel}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 1.25, maxHeight: "90vh", height: "auto", minHeight: 320 } }}
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
            onOpenMediaSettings={() => setMediaSettingsOpen(true)}
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
            onViewProfile={(uid) => loadUserProfile(uid)}
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
        PaperProps={{ sx: { borderRadius: 1.25 } }}>
        <DialogContent dividers sx={{ p: 0 }}>
          <MessengerProfileEditor
            onClose={popPanel}
            onPhotosChange={(_photos, primaryUrl) => {
              if (primaryUrl) {
                const u = withTokenQuery(primaryUrl);
                const sep = u.includes("?") ? "&" : "?";
                setMeAvatar(`${u}${sep}_t=${Date.now()}`);
              } else {
                setMeAvatar(null);
                refreshMeAvatar();
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Message right-click context menu */}
      <ContextMenu ctx={ctx} onClose={() => setCtx(null)}>
        <MessageContextMenuItems
          ctxMsg={ctxMsg} isMine={ctxMine}
          onReply={(m) => { setReplyTo(m); setEditingMsg(null); setCtx(null); inputRef.current?.focus(); }}
          onReact={(e, m) => { setReactAnchor({ anchorPosition: { top: e.clientY, left: e.clientX }, message: m }); setCtx(null); }}
          onForward={(m) => { setForwardOpen(m); setCtx(null); }}
          onSelect={(m) => { toggleSelectMessage(m, true); setCtx(null); }}
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
        onClose={() => { setCropFile(null); setCropEditIndex(null); }}
        onConfirm={(blob, filename) => {
          const cropped = new File([blob], filename || "image.jpg", { type: blob.type || "image/jpeg" });
          attachMessengerOriginal(cropped, cropFile);
          setFiles((prev) => {
            if (cropEditIndex != null && cropEditIndex >= 0 && cropEditIndex < prev.length) {
              const next = [...prev];
              next[cropEditIndex] = cropped;
              return next;
            }
            return [...prev, cropped];
          });
          setCropFile(null);
          setCropEditIndex(null);
        }}
        circular={false}
        outputSize={1600}
        title="Edit image"
        confirmLabel="Done"
      />

      {/* Video edit dialog (trim + crop before sending) */}
      <VideoEditDialog
        open={Boolean(videoEditFile)}
        file={videoEditFile}
        onClose={() => { setVideoEditFile(null); setVideoEditIndex(null); }}
        onConfirm={(blob, filename) => {
          const edited = new File([blob], filename || "video.webm", { type: blob.type || "video/webm" });
          setFiles((prev) => {
            if (videoEditIndex != null && videoEditIndex >= 0 && videoEditIndex < prev.length) {
              const next = [...prev];
              next[videoEditIndex] = edited;
              return next;
            }
            return [...prev, edited];
          });
          setVideoEditFile(null);
          setVideoEditIndex(null);
        }}
        confirmLabel="Done"
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

      {/* "Join this public group?" confirmation dialog — shown when the user
          clicks a non-member public group row in the search results. */}
      <Dialog
        open={Boolean(joinConfirm)}
        onClose={() => setJoinConfirm(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 1.25 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {joinConfirm?.group?.avatar_url ? (
            <Avatar src={withTokenQuery(joinConfirm.group.avatar_url)} sx={{ width: 40, height: 40 }} />
          ) : (
            <Avatar sx={{ width: 40, height: 40 }}>{joinConfirm?.group?.title?.[0]?.toUpperCase()}</Avatar>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography fontWeight={700} noWrap>{joinConfirm?.group?.title || "Group"}</Typography>
            <Typography variant="caption" color="text.secondary">
              {(joinConfirm?.group?.participants?.length || 0)} members
              {joinConfirm?.group?.requires_approval ? " · approval required" : ""}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {joinConfirm?.group?.description ? (
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {joinConfirm.group.description}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No description provided.
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            {joinConfirm?.group?.requires_approval
              ? "An admin will need to approve your request before you can join."
              : "You will be added as a member immediately."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button onClick={() => setJoinConfirm(null)} color="inherit">Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={onConfirmJoin}
          >
            {joinConfirm?.group?.requires_approval ? "Send request" : "Join group"}
          </Button>
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
                    <Avatar src={withTokenQuery(u.avatar) || undefined}>{u.username?.[0]}</Avatar>
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

      {/* Media settings — camera/microphone picker for voice & video messages */}
      <MediaSettingsDialog
        open={mediaSettingsOpen}
        onClose={() => setMediaSettingsOpen(false)}
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
      <Snackbar
        open={exitHint}
        message="Press back again to leave Messenger"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 24, sm: 24 } }}
      />
      {!hashReady && !showAuthPopup && (
        <Box sx={{
          position: "fixed", inset: 0, bgcolor: "background.default",
          zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CircularProgress />
        </Box>
      )}

      {/* "Not authenticated" popup — prompts the user to sign in / sign up
          instead of leaving them looking at a blank black screen. */}
      <Dialog
        open={showAuthPopup}
        onClose={() => setShowAuthPopup(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 1.25 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LockOutlinedIcon color="primary" />
          Sign in required
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            You need to be signed in to use the messenger. Please sign in or
            create an account to continue.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => setShowAuthPopup(false)} color="inherit">
            Dismiss
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/signin_or_signup")}
          >
            Go to sign in
          </Button>
        </DialogActions>
      </Dialog>
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

/**
 * Group description banner — shown to non-admin members at the top of the chat
 * so they can see what the group is about without opening the info panel.
 * Dismissible per-conversation (parent tracks dismissed set).
 */
function GroupDescriptionBanner({ description, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > 140;
  const display = expanded || !isLong ? description : `${description.slice(0, 140)}…`;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        px: 2,
        py: 1,
        bgcolor: (t) => t.palette.mode === "dark" ? "rgba(33,150,243,0.10)" : "rgba(33,150,243,0.06)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <InfoOutlinedIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "text.primary",
        }}
      >
        {display}
        {isLong && (
          <Box
            component="span"
            onClick={() => setExpanded((e) => !e)}
            sx={{
              color: "primary.main",
              cursor: "pointer",
              ml: 0.5,
              fontWeight: 600,
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </Box>
        )}
      </Typography>
      <IconButton size="small" onClick={onDismiss} sx={{ mt: -0.25 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
