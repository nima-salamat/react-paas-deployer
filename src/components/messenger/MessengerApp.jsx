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
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, IconButton, CircularProgress, Menu, MenuItem, ListItemIcon,
  Stack, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, FormControlLabel, Switch, List, ListItemButton, ListItemAvatar,
  ListItemText, Divider, Fade, Chip, Popover, Tooltip, useMediaQuery, LinearProgress,
  Snackbar, Paper,
} from "@mui/material";
import { useTheme, ThemeProvider, createTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
/* ContentCopyIcon removed from chat header — copy lives in ProfileView */
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
  copyText, parseHash, setHash, attachmentKind, isVoiceAttachment, withTokenQuery, REACTIONS, PAGE_SIZE, LOAD_OLDER_SIZE,
  downloadAttachmentToCache, getCachedAttachment, getIsMobileDevice,
} from "./messengerUtils";
import Sidebar from "./components/Sidebar";
import MessageBubble, { MessageContextMenuItems } from "./components/MessageBubble";
import MessageComposer from "./components/MessageComposer";
import ImageCropDialog from "./components/ImageCropDialog";
import ReadReceiptsDialog from "./components/ReadReceiptsDialog";
import RightPanel from "./components/RightPanel";
import MessengerProfileEditor from "./MessengerProfileEditor";
import ContextMenu from "./components/ContextMenu";
import AudioPlayerBar from "./components/AudioPlayerBar";
import MediaGalleryDialog from "./components/MediaGalleryDialog";
import ChatMediaLibraryDialog from "./components/ChatMediaLibraryDialog";
import VideoEditDialog from "./components/VideoEditDialog";
import PinnedMessageBar from "./components/PinnedMessageBar";
import JitsiCallModal from "./components/JitsiCallModal";
import IncomingCallBanner from "./components/IncomingCallBanner";
import AddToContactsBanner from "./components/AddToContactsBanner";
import GroupDescriptionBanner from "./components/GroupDescriptionBanner";
import MessageSearchDialog from "./components/MessageSearchDialog";
import PreviewTextBody from "./components/PreviewTextBody";
import { attachMessengerOriginal, messengerOriginalOf, attachMessengerImageEdits, messengerImageEditsOf, attachMessengerVideoEdits, messengerVideoEditsOf, finalizeMessengerFiles, guessLangFromName } from "./modules/fileHelpers";
import { mergeConversations } from "./modules/mergeConversations";
import {
  writeComposerDraft,
  readComposerDraft,
  resolveComposerDraft,
  draftPayload,
} from "./modules/composerDrafts";
import { isGroupDescDismissed, persistGroupDescDismiss } from "./modules/groupDescDismiss";
import useKeyboardLayout from "./hooks/useKeyboardLayout";
import useMessengerWebSocket from "./hooks/useMessengerWebSocket";
import MessengerDialogs from "./components/MessengerDialogs";

import CallIcon from "@mui/icons-material/Call";
import VideocamIcon from "@mui/icons-material/Videocam";
import CallEndIcon from "@mui/icons-material/CallEnd";
import SearchIcon from "@mui/icons-material/Search";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";






import {
  slimMessageForCache,
  readMessengerMsgCache,
  writeMessengerMsgCache,
  touchMessengerMsgCache,
  MSG_SESSION_MAX_MSGS,
} from "./modules/msgCache";
import { parseCallSystemBody, formatCallSystemLabel, normalizeMessage, normalizeMessages } from "./modules/callSystemMessage";
import { getSenderGroupFlags } from "./modules/messageGrouping";
import { readAppearance, writeAppearance, getPalette, normalizeColorThemeId } from "./modules/appearance";
import { getScrollPrefetchPlan, shouldChainLoadOlder, shouldChainLoadNewer } from "./modules/scrollPrefetch";
import { MSG_SCROLL_CLASS, MSG_SCROLL_STYLE_TEXT, updateScrollbarGutterVisibility } from "./modules/msgScrollStyles";

export default function MessengerApp({ themeMode = "system", onThemeModeChange }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  // Real phone/tablet (UA/OS/pointer) — independent of window width.
  // Narrow desktop windows must NOT be treated as mobile for Enter / keyboard.
  const isMobileDevice = getIsMobileDevice();

  // Mobile virtual keyboard — visualViewport binding
  const kbLayout = useKeyboardLayout(isMobileDevice);

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
  const [chatOpening, setChatOpening] = useState(false);
  const [activeDetail, setActiveDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  const [hasMoreMsgs, setHasMoreMsgs] = useState(false);
  const [hasMoreNewer, setHasMoreNewer] = useState(false);
  const hasMoreNewerRef = useRef(false);
  const nextAfterRef = useRef(null);
  const [nextBefore, setNextBefore] = useState(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  // Per-conversation message cache — switching chats restores instantly, no flicker.
  // Also hydrated from sessionStorage so leaving /messenger and coming back is fast.
  const messagesCacheRef = useRef(null);
  if (messagesCacheRef.current == null) {
    messagesCacheRef.current = readMessengerMsgCache();
  }
  const pendingScrollRestoreRef = useRef(null); // chat-switch viewport restore
  const olderScrollPinRef = useRef(null); // { el, prevH, prevTop } after loadOlder
  const scrollVelRef = useRef({ lastTop: 0, lastTs: 0, velocity: 0 });
  const restoringScrollRef = useRef(false);
  const messagesConvIdRef = useRef(null); // which conversation current messages state belongs to
  const hasMoreMsgsRef = useRef(false);
  const nextBeforeRef = useRef(null);
  const pendingJumpRef = useRef(null); // messageId to scroll to after load
  const nearBottomRef = useRef(true);
  /** Last known viewport for active chat — survives message prepend/paint races */
  const scrollAnchorRef = useRef(null); // { convId, scrollTop, distanceBottom, nearBottom }
  /** Re-apply restore until this time (ms) or until user scrolls */
  const scrollRestoreUntilRef = useRef(0);
  const stickGenRef = useRef(0);
  const stickTimersRef = useRef([]);
  /** px from bottom still treated as following the live chat (keep tight for cache accuracy) */
  const NEAR_BOTTOM_PX = 120;
  const pendingNewIdsRef = useRef([]); // ids arrived while scrolled up
  const [newBelowCount, setNewBelowCount] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [scrollDownOpacity, setScrollDownOpacity] = useState(0);
  const scrollDownFadeTimerRef = useRef(null);
  const scrollDownDismissedRef = useRef(false);
  const userScrollIntentRef = useRef(false);
  // Tracks which conversations have a known scroll position (cache restore / user scroll).
  const scrollPositionKnownRef = useRef(new Set());
  const [chatFileDrag, setChatFileDrag] = useState(false);
  const chatDragDepthRef = useRef(0);
  // typingUsers: { [userId]: { username, until } } for active chat
  const [typingUsers, setTypingUsers] = useState({});
  const seenQueuedRef = useRef(new Set());
  const flushedSeenRef = useRef(new Set()); // already POSTed to /read/
  const [seenMsgIds, setSeenMsgIds] = useState(() => new Set());
  const seenFlushTimerRef = useRef(null);
  const typingStopTimerRef = useRef(null);
  const typingSentRef = useRef(false);
  const selectionAutoScrollRef = useRef(null);
  // Throttle heavy scroll work (DOM queries + sessionStorage) to prevent UI freezes
  const scrollWorkRafRef = useRef(null);
  const lastScrollPersistTsRef = useRef(0);
  const lastMarkReadTsRef = useRef(0);

  // Pinned messages for the active conversation
  const [pinnedMessages, setPinnedMessages] = useState([]); // [{ id, message, pinned_at }]
  const [currentPinIndex, setCurrentPinIndex] = useState(0); // which pin is shown in the bar

  // Composer state — text lives in MessageComposer local state so typing does not
  // re-render the whole shell (message list, sidebar). textRef is source of truth
  // for send / draft flush. forceComposerText only for rare external updates.
  const textRef = useRef("");
  const [composerExternalText, setComposerExternalText] = useState("");
  const [composerTextVersion, setComposerTextVersion] = useState(0);
  const forceComposerText = useCallback((valueOrFn) => {
    const prev = textRef.current;
    const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
    const v = next == null ? "" : String(next);
    textRef.current = v;
    setComposerExternalText(v);
    setComposerTextVersion((n) => n + 1);
  }, []);
  const draftSyncTimerRef = useRef(null);
  const draftListTimerRef = useRef(null);
  const lastDraftSyncedRef = useRef({ convId: null, text: null });
  /** Immediately persist draft to localStorage + chat list + WebSocket (no debounce). */
  const flushDraftToServer = useCallback((convId, text, { updateList = true } = {}) => {
    if (convId == null) return;
    const cid = String(convId);
    const payload = text == null ? "" : String(text);
    try { writeComposerDraft(cid, payload); } catch { /* */ }
    if (updateList) {
      setConversations((prev) => {
        let changed = false;
        const mapped = prev.map((c) => {
          if (String(c.id) !== cid) return c;
          if ((c.draft_text || "") === payload) return c;
          changed = true;
          return { ...c, draft_text: payload };
        });
        return changed ? mapped : prev;
      });
    }
    const last = lastDraftSyncedRef.current;
    if (last.convId === cid && last.text === payload) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      try {
        wsRef.current.send(JSON.stringify(draftPayload(cid, payload)));
        lastDraftSyncedRef.current = { convId: cid, text: payload };
      } catch { /* */ }
    }
  }, []);
  const [scheduledFor, setScheduledFor] = useState(null);
  const [appearance, setAppearance] = useState(() => readAppearance());
  const updateAppearance = useCallback((partial) => {
    setAppearance((prev) => writeAppearance({ ...prev, ...partial }));
  }, []);

  // Messenger-only theme (color palette does NOT affect the rest of the site)
  const parentTheme = useTheme();
  const parentMode = parentTheme.palette.mode === "dark" ? "dark" : "light";
  const messengerTheme = useMemo(() => {
    const mode = parentMode;
    const colorId = normalizeColorThemeId(appearance?.colorTheme);
    const pal = getPalette(colorId, mode);
    const isDark = mode === "dark";
    return createTheme({
      palette: {
        mode,
        primary: {
          main: pal.primary,
          dark: isDark ? pal.primarySoft : pal.primaryHover,
          light: isDark ? pal.primaryHover : pal.primarySoft,
          contrastText: "#ffffff",
        },
        secondary: parentTheme.palette.secondary,
        success: { main: pal.success },
        warning: { main: pal.warning },
        error: { main: pal.danger },
        background: {
          default: pal.background,
          paper: pal.surface,
        },
        text: {
          primary: pal.text,
          secondary: pal.textSecondary,
          disabled: pal.textMuted,
        },
        divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
        action: parentTheme.palette.action,
      },
      shape: parentTheme.shape,
      typography: parentTheme.typography,
      breakpoints: parentTheme.breakpoints,
      spacing: parentTheme.spacing,
      transitions: parentTheme.transitions,
      zIndex: parentTheme.zIndex,
      customColors: {
        surfaceElevated: pal.surfaceElevated,
        surfaceHover: pal.surfaceHover,
        border: pal.border,
        borderStrong: pal.borderStrong,
        textMuted: pal.textMuted,
        primarySoft: pal.primarySoft,
        bubbleMine: pal.bubbleMine || pal.primary,
        colorThemeId: colorId,
      },
    });
  }, [parentMode, parentTheme, appearance?.colorTheme]);
  const [dayJumpOpen, setDayJumpOpen] = useState(false);
  const [msgSearchOpen, setMsgSearchOpen] = useState(false);
  const [msgSearchQ, setMsgSearchQ] = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState([]);
  const [msgSearchLoading, setMsgSearchLoading] = useState(false);
  const [msgSearchIdx, setMsgSearchIdx] = useState(-1);


  const [files, setFiles] = useState([]);
  const [mediaSpoiler, setMediaSpoiler] = useState(false);
  const [mediaViewOnce, setMediaViewOnce] = useState(false);
  const [sendFilesTogether, setSendFilesTogether] = useState(() => {
    try { return localStorage.getItem("messenger.sendFilesTogether") !== "false"; } catch { return true; }
  });
  const [pendingUploads, setPendingUploads] = useState([]);
  // Auto-dismiss failed upload bubbles after a few seconds
  useEffect(() => {
    const failed = pendingUploads.filter((u) => u.status === "failed");
    if (!failed.length) return undefined;
    const timers = failed.map((u) =>
      setTimeout(() => {
        setPendingUploads((prev) => prev.filter((x) => x.id !== u.id));
      }, 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [pendingUploads]);

  const [replyTo, setReplyTo] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const editingMsgRef = useRef(null);
  useEffect(() => { editingMsgRef.current = editingMsg; }, [editingMsg]);
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
  const [callChoiceOpen, setCallChoiceOpen] = useState(false);

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
  const [cropEditIndex, setCropEditIndex] = useState(null);
  const [cropInitialEdits, setCropInitialEdits] = useState(null); // replace files[index] when set
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
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

  // Video edit dialog (trim + crop before sending)
  const [videoEditFile, setVideoEditFile] = useState(null);
  const [videoInitialEdits, setVideoInitialEdits] = useState(null);

  // "Join this public group?" confirmation dialog — shown when the user clicks
  // a non-member public group row in the search results (Telegram shows a
  // preview + Join button instead of silently doing nothing).
  const [joinConfirm, setJoinConfirm] = useState(null); // { group }

  // Read receipts
  const [readersMessage, setReadersMessage] = useState(null);
  // Jitsi call state
  const [callConfig, setCallConfig] = useState(null);
  const callConfigRef = useRef(null);
  useEffect(() => { callConfigRef.current = callConfig; }, [callConfig]);
  const [incomingCall, setIncomingCall] = useState(null); // { conversation_id, initiator, media, ... }
  const [activeCallInfo, setActiveCallInfo] = useState(null); // ongoing/ringing in current chat
  const [callMode, setCallMode] = useState("inline"); // "full" | "inline" | "mini" — from JitsiCallModal
  // Telegram-style fixed video-note PiP (not draggable; tied to one conversation)
  const [videoNotePip, setVideoNotePip] = useState(null); // { key, src, currentTime, conversationId, ... }

  const seenRingIdsRef = useRef(new Set());
  const incomingCallRef = useRef(null);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // Video-note PiP: listen for hand-off from ChatVideo; stop when leaving that chat
  useEffect(() => {
    const onPip = (e) => {
      const d = e?.detail;
      if (!d) {
        setVideoNotePip(null);
        return;
      }
      setVideoNotePip(d);
    };
    window.addEventListener("messenger:video-note-pip", onPip);
    return () => window.removeEventListener("messenger:video-note-pip", onPip);
  }, []);

  useEffect(() => {
    // Leaving the conversation that owns the video-note → stop PiP
    setVideoNotePip((prev) => {
      if (!prev) return null;
      if (prev.conversationId == null) return null;
      if (activeId == null) return null; // chat list: stop
      if (String(prev.conversationId) !== String(activeId)) return null;
      return prev;
    });
  }, [activeId]);


  // When chat changes, check live/ringing call (also covers offline→online within ring window)
  useEffect(() => {
    if (!activeId) {
      setActiveCallInfo(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/conversations/${activeId}/call/active/`,
        });
        const data = unwrapData(res);
        if (cancelled) return;
        if (data?.active) {
          setActiveCallInfo({ ...data, conversation_id: data.conversation_id || activeId });
          if (
            data.status === "ringing"
            && String(data.initiator?.id) !== String(meId)
            && !callConfigRef.current
          ) {
            const rid = data.call_id;
            if (rid && !seenRingIdsRef.current.has(String(rid))) {
              seenRingIdsRef.current.add(String(rid));
              const remaining = data.ring_remaining ?? 30;
              setIncomingCall({
                conversation_id: data.conversation_id || activeId,
                call_id: data.call_id,
                media: data.media,
                is_video: data.is_video,
                initiator: data.initiator,
                ring_timeout: remaining,
                _receivedAt: Date.now() - (30 - remaining) * 1000,
                replay: true,
              });
            }
          }
        } else {
          setActiveCallInfo(null);
        }
      } catch {
        if (!cancelled) setActiveCallInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, meId]);

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
  // Group description banners the user has dismissed (per conversation id).
  // Values are description snapshots so a changed description shows again.
  const [dismissedGroupDesc, setDismissedGroupDesc] = useState(() => {
    try {
      const map = readDismissedGroupDesc();
      return new Map(Object.entries(map));
    } catch {
      return new Map();
    }
  });
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
  const [jumpHighlightDayId, setJumpHighlightDayId] = useState(null);

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

  // Pinned messages loader must be initialized before useMessengerWebSocket
  // is invoked during render; otherwise the websocket hook sees a TDZ error.
  const loadPinnedMessages = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/conversations/${convId}/pinned-messages/` });
      const data = unwrapData(res);
      const pins = Array.isArray(data) ? [...data].reverse() : [];
      setPinnedMessages(pins);
      setCurrentPinIndex((prev) => (prev >= pins.length ? 0 : prev));
    } catch {
      setPinnedMessages([]);
      setCurrentPinIndex(0);
    }
  }, []);

  // Join-request loaders must be initialized before useMessengerWebSocket is
  // invoked during render; keeping them here avoids temporal-dead-zone errors.
  const loadMyJoinRequests = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/join-requests/` });
      const list = unwrapData(res) || [];
      setMyJoinRequests(list);
      setMyRequestsBadge(list.filter((r) => r.status === "pending").length);
      return list;
    } catch {
      return [];
    }
  }, []);

  const loadConvJoinRequests = useCallback(async (convId) => {
    if (!convId) return;
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${convId}/join-requests/`,
      });
      setConvJoinRequests(unwrapData(res) || []);
    } catch {
      setConvJoinRequests([]);
    }
  }, []);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  /**
   * Cross-chat incoming-call poller.
   *
   * When the user is sitting in chat A, they should still be alerted if
   * someone rings them in chat B. We poll each conversation (except the
   * active one) every ~12s, looking for ringing sessions we haven't seen
   * yet. If found, we surface the incoming-call banner so the user can
   * accept or decline.
   *
   * We bail out entirely if the user is already in a call (callConfig set)
   * or already showing an incoming-call banner.
   */
  useEffect(() => {
    if (callConfig) return undefined;
    let cancelled = false;

    const checkConversations = async () => {
      if (cancelled) return;
      if (incomingCallRef.current) return;
      const convs = conversationsRef.current || [];
      const candidates = convs
        .filter((c) => String(c.id) !== String(activeIdRef.current))
        .slice(0, 25);
      for (const c of candidates) {
        if (cancelled || incomingCallRef.current) return;
        try {
          const res = await apiRequest({
            method: "GET",
            url: `${MSG_API}/conversations/${c.id}/call/active/`,
          });
          if (cancelled) return;
          const data = unwrapData(res);
          if (!data?.active) continue;
          if (data.status !== "ringing") continue;
          if (String(data.initiator?.id) === String(meId)) continue;
          const rid = data.call_id;
          if (!rid || seenRingIdsRef.current.has(String(rid))) continue;
          seenRingIdsRef.current.add(String(rid));
          const remaining = data.ring_remaining ?? 30;
          setIncomingCall({
            conversation_id: data.conversation_id || c.id,
            call_id: data.call_id,
            media: data.media,
            is_video: data.is_video,
            initiator: data.initiator,
            ring_timeout: remaining,
            _receivedAt: Date.now() - (30 - remaining) * 1000,
            replay: true,
          });
          return;
        } catch { /* ignore — likely 404 */ }
      }
    };

    const initial = setTimeout(checkConversations, 2000);
    const interval = setInterval(checkConversations, 12000);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [callConfig, meId]);

  // Cancel pending scroll rAF on unmount
  useEffect(() => () => {
    if (scrollWorkRafRef.current != null) {
      cancelAnimationFrame(scrollWorkRafRef.current);
      scrollWorkRafRef.current = null;
    }
  }, []);

  // Keep message/data cache warm without sampling scrollTop during React renders.
  // scrollTop is owned by the scroll handler + explicit chat-switch save/restore.
  useEffect(() => {
    if (!activeId) return;
    if (String(messagesConvIdRef.current) !== String(activeId)) return;
    if (!messages?.length) return;
    const key = String(activeId);
    const prev = messagesCacheRef.current.get(key) || {};
    messagesCacheRef.current.set(key, {
      ...prev,
      messages,
      hasMore: hasMoreMsgs,
      nextBefore,
      detail: activeDetail || prev.detail || null,
    });
  }, [activeId, messages, hasMoreMsgs, nextBefore, activeDetail]);

  // Restore / hold viewport after paint. Prefer distance-from-bottom (stable when
  // older messages prepend). Re-apply while scrollRestoreUntilRef is active so a
  // short first paint cannot pin the user at scrollTop 0.
  useLayoutEffect(() => {
    if (!activeId || !messages?.length || !listRef.current) return;

    const box = listRef.current;
    const cid = String(activeId);

    // Prefer explicit pending restore, else lasting anchor for this conv
    let r = pendingScrollRestoreRef.current;
    if (r && (r.prevH != null || r.el)) r = null; // loadOlder pin
    if (!r && scrollAnchorRef.current && String(scrollAnchorRef.current.convId) === cid) {
      r = scrollAnchorRef.current;
    }
    if (!r) return;

    const stillHolding = Date.now() < scrollRestoreUntilRef.current
      || pendingScrollRestoreRef.current === r
      || (pendingScrollRestoreRef.current
        && pendingScrollRestoreRef.current.distanceBottom === r.distanceBottom);

    // Only force restore when holding or first pending apply
    if (!stillHolding && !pendingScrollRestoreRef.current) return;

    restoringScrollRef.current = true;
    const apply = () => {
      if (!listRef.current || String(activeIdRef.current) !== cid) return;
      const anchor = pendingScrollRestoreRef.current || scrollAnchorRef.current;
      if (!anchor || (anchor.convId && String(anchor.convId) !== cid)) return;
      if (anchor.nearBottom) {
        box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
      } else if (anchor.anchorMsgId) {
        const el = document.getElementById(`msg-${anchor.anchorMsgId}`);
        if (el) {
          el.scrollIntoView({ block: "center" });
        } else {
          // Message deleted from DOM/cache — stay near that history region
          if (Number.isFinite(anchor.distanceBottom)) {
            box.scrollTop = Math.max(
              0,
              box.scrollHeight - box.clientHeight - Number(anchor.distanceBottom)
            );
          } else if (Number.isFinite(anchor.scrollTop)) {
            box.scrollTop = Math.max(
              0,
              Math.min(Number(anchor.scrollTop), box.scrollHeight - box.clientHeight)
            );
          } else {
            box.scrollTop = Math.max(0, (box.scrollHeight - box.clientHeight) * 0.35);
          }
        }
      } else if (Number.isFinite(anchor.distanceBottom)) {
        box.scrollTop = Math.max(
          0,
          box.scrollHeight - box.clientHeight - Number(anchor.distanceBottom)
        );
      } else if (Number.isFinite(anchor.scrollTop)) {
        box.scrollTop = Math.max(
          0,
          Math.min(Number(anchor.scrollTop), box.scrollHeight - box.clientHeight)
        );
      } else {
        box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
      }
    };

    apply();
    requestAnimationFrame(() => {
      apply();
      const restoredDistance = Math.max(0, box.scrollHeight - box.scrollTop - box.clientHeight);
      nearBottomRef.current = restoredDistance < NEAR_BOTTOM_PX;
      restoringScrollRef.current = false;

      // Keep anchor in sync with what we applied
      const prevAnchor = scrollAnchorRef.current;
      scrollAnchorRef.current = {
        convId: cid,
        scrollTop: box.scrollTop,
        distanceBottom: restoredDistance,
        nearBottom: restoredDistance < NEAR_BOTTOM_PX,
        anchorMsgId: prevAnchor?.anchorMsgId || null,
      };

      // Clear one-shot pending after first successful paint; hold window may re-use anchor
      if (pendingScrollRestoreRef.current && !pendingScrollRestoreRef.current.el) {
        pendingScrollRestoreRef.current = null;
      }

      const restoredShouldShow = restoredDistance > 180;
      scrollDownDismissedRef.current = false;
      if (scrollDownFadeTimerRef.current) {
        clearTimeout(scrollDownFadeTimerRef.current);
        scrollDownFadeTimerRef.current = null;
      }
      if (restoredShouldShow) {
        setShowScrollDown(true);
        setScrollDownOpacity(1);
        scrollDownFadeTimerRef.current = setTimeout(() => {
          setScrollDownOpacity(0);
          scrollDownFadeTimerRef.current = setTimeout(() => {
            setShowScrollDown(false);
            scrollDownFadeTimerRef.current = null;
          }, 250);
        }, 1800);
      } else {
        setShowScrollDown(false);
        setScrollDownOpacity(0);
      }
      if (restoredDistance < NEAR_BOTTOM_PX) {
        pendingNewIdsRef.current = [];
        setNewBelowCount(0);
      }
      scrollPositionKnownRef.current.add(cid);
      setTimeout(() => { try { markVisibleMessagesRead(); } catch { /* */ } }, 120);
      // Only a couple of pages if we landed flush against the top edge
      if (box.scrollTop < Math.max(320, box.clientHeight * 0.5) && hasMoreMsgsRef.current) {
        setTimeout(() => {
          try { fillOlderNearTop({ convId: cid, maxPages: 2 }); } catch { /* */ }
        }, 100);
      }
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

  /* -------------------- calls (helpers defined later, after openChat) -------------------- */
  // Note: startCall / startCallWithUser are declared *after* openChat to
  // avoid a temporal-dead-zone reference (openChat is a `const` defined
  // further down). They are referenced by the chat header call buttons
  // and by ProfileView, which only run after the component has mounted,
  // so the late definition is safe.

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
      const next = data?.results || [];
      // Merge by id: keep previous object reference when payload is unchanged so
      // Sidebar Avatars do not remount / re-download on every silent refresh.
      setConversations((prev) => mergeConversations(prev, next));
      // Sync presence from API: add online peers AND drop offline ones
      setOnlineUsers((prev) => {
        const nextSet = new Set(prev);
        for (const c of next) {
          if (c?.type === "private" && c.peer?.id != null) {
            const id = Number(c.peer.id);
            const online = Boolean(c.peer.is_online ?? c.peer.online);
            if (online) nextSet.add(id);
            else nextSet.delete(id);
          }
        }
        return nextSet;
      });
      return next;
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
        touchMessengerMsgCache(messagesCacheRef.current, key, { ...prev, detail: data });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const loadMessages = useCallback(async (cid, { silent = false, preserveOlder = false, replace = false } = {}) => {
    if (!cid) return;
    const key = String(cid);
    const cached = messagesCacheRef.current.get(key);
    const hasCachedMsgs = Boolean(cached?.messages?.length);
    const isActive = () => String(activeIdRef.current) === key;
    // replace: drop mid-history window and keep only the latest server page
    // (used by "jump to bottom" so we never download the entire gap)
    const doReplace = Boolean(replace) && !preserveOlder;

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
        // Drop optimistic temps that match a confirmed server message
        // (same sender + body, within ~2 minutes) so order stays clean.
        const confirmed = Array.from(map.values()).filter((m) => !String(m.id).startsWith("temp-"));
        for (const [k, m] of [...map.entries()]) {
          if (!String(k).startsWith("temp-")) continue;
          const tBody = String(m.body || "").trim();
          const tSender = String(m.sender?.id ?? "");
          const tTime = new Date(m.created_at || 0).getTime();
          const matched = confirmed.some((c) => {
            if (String(c.sender?.id ?? "") !== tSender) return false;
            if (String(c.body || "").trim() !== tBody) return false;
            const ct = new Date(c.created_at || 0).getTime();
            return Math.abs(ct - tTime) < 120000;
          });
          if (matched) map.delete(k);
        }
        return Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.created_at || 0).getTime();
          const tb = new Date(b.created_at || 0).getTime();
          if (ta !== tb) return ta - tb;
          // Prefer real numeric ids after temps with same timestamp
          const aTemp = String(a.id).startsWith("temp-");
          const bTemp = String(b.id).startsWith("temp-");
          if (aTemp !== bTemp) return aTemp ? 1 : -1;
          const na = Number(a.id);
          const nb = Number(b.id);
          if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
          return String(a.id).localeCompare(String(b.id));
        });
      };

      const mergedForCache = (!doReplace && (silent || preserveOlder))
        ? mergeLists(cached?.messages || [], items)
        : items;
      touchMessengerMsgCache(messagesCacheRef.current, key, {
        messages: mergedForCache,
        hasMore: doReplace ? hm : ((silent || preserveOlder) ? Boolean(cached?.hasMore || hm) : hm),
        nextBefore: doReplace ? nb : ((silent || preserveOlder) ? (cached?.nextBefore || nb) : nb),
        hasMoreNewer: false,
        nextAfter: items.length ? items[items.length - 1]?.id : null,
        nearBottom: doReplace ? true : (messagesCacheRef.current.get(key)?.nearBottom),
        anchorMsgId: doReplace ? null : (messagesCacheRef.current.get(key)?.anchorMsgId),
        detail: messagesCacheRef.current.get(key)?.detail || null,
      });

      // Don't update UI if user already switched away
      if (!isActive()) return;

      if (!doReplace && (silent || preserveOlder)) {
        setMessages((prev) => normalizeMessages(mergeLists(prev, items)));
        messagesConvIdRef.current = cid;
        if (!nextBeforeRef.current && nb) {
          setNextBefore(nb);
          nextBeforeRef.current = nb;
        }
        if (hm && !hasMoreMsgsRef.current) {
          setHasMoreMsgs(true);
          hasMoreMsgsRef.current = true;
        }
        if (items.length) {
          hasMoreNewerRef.current = false;
          setHasMoreNewer(false);
          nextAfterRef.current = items[items.length - 1]?.id || nextAfterRef.current;
        }
      } else {
        // Full replace — live edge only (cheap jump-to-bottom)
        setMessages(normalizeMessages(items));
        messagesRef.current = normalizeMessages(items);
        messagesConvIdRef.current = cid;
        setHasMoreMsgs(hm);
        setNextBefore(nb);
        hasMoreMsgsRef.current = hm;
        nextBeforeRef.current = nb;
        hasMoreNewerRef.current = false;
        setHasMoreNewer(false);
        nextAfterRef.current = items.length ? items[items.length - 1]?.id : null;
      }

      try {
        wsRef.current?.send(JSON.stringify({ type: "subscribe", conversation_id: Number(cid) }));
      } catch { /* */ }
      // Viewport-only receipts — see markVisibleMessages().
      // The initial viewport is restored by the chat-open effect below.
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
      const cached = messagesCacheRef.current.get(String(cid));
      const list = (messagesRef.current?.length ? messagesRef.current : null)
        || cached?.messages
        || [];
      if (list.length) cursor = list[0]?.id;
    }
    // Always attempt when we have a cursor — server decides if more exist.
    // (cached hasMore:false can be stale after restore mid-history)
    if (!cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const el = listRef.current;
    const prevH = el?.scrollHeight || 0;
    const prevTop = el?.scrollTop || 0;
    if (el) {
      olderScrollPinRef.current = { el, prevH, prevTop };
    }
    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?limit=${LOAD_OLDER_SIZE}&before_id=${cursor}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const older = data?.results || [];
      if (!older.length) {
        setHasMoreMsgs(false);
        setNextBefore(null);
        hasMoreMsgsRef.current = false;
        nextBeforeRef.current = null;
        olderScrollPinRef.current = null;
        return;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => String(m.id)));
        const uniqueOlder = older.filter((m) => m?.id != null && !ids.has(String(m.id)));
        const next = [...uniqueOlder, ...prev];
        // Keep cache + ref in sync immediately so jump-to-day can read oldest day
        try {
          const key = String(cid);
          const cached = messagesCacheRef.current.get(key) || {};
          touchMessengerMsgCache(messagesCacheRef.current, key, { ...cached, messages: next, hasMore: Boolean(data?.has_more), nextBefore: data?.next_before_id || older[0]?.id || null });
          messagesRef.current = next;
        } catch { /* */ }
        return next;
      });
      const hm = Boolean(data?.has_more);
      const nb = data?.next_before_id || older[0]?.id || null;
      setHasMoreMsgs(hm);
      setNextBefore(nb);
      hasMoreMsgsRef.current = hm;
      nextBeforeRef.current = nb;
    } catch {
      olderScrollPinRef.current = null;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      // Prefetch next page if still near top after this batch
      requestAnimationFrame(() => {
        const box = listRef.current;
        if (!box || loadingMoreRef.current) return;
        if (!hasMoreMsgsRef.current) return;
        if (shouldChainLoadOlder(box, isMobile)) loadOlder();
      });
    }
  }, [hasMoreMsgs, nextBefore]);

  /**
   * Load a window centered on a message id — one request restores mid-history
   * without climbing from the live edge page-by-page.
   */
  /**
   * Load a window around an id. If that message was deleted, the API still
   * returns neighbouring messages (id ≤ / > around_id). Returns:
   *   { ok, exactFound, focusId }
   * focusId = original id if still present, else closest neighbour.
   */
  const loadAroundMessage = useCallback(async (cid, aroundId) => {
    if (!cid || aroundId == null) {
      return { ok: false, exactFound: false, focusId: null };
    }
    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?around_id=${encodeURIComponent(aroundId)}&limit=50`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const items = normalizeMessages(data?.results || []);
      if (!items.length) {
        // Truly nothing around that point → caller should fall back to latest
        return { ok: false, exactFound: false, focusId: null };
      }
      if (String(activeIdRef.current) !== String(cid)) {
        return { ok: false, exactFound: false, focusId: null };
      }
      const hm = Boolean(data?.has_more);
      const hmn = Boolean(data?.has_more_newer);
      const nb = data?.next_before_id || items[0]?.id || null;
      const na = data?.next_after_id || items[items.length - 1]?.id || null;
      setMessages(items);
      messagesRef.current = items;
      messagesConvIdRef.current = cid;
      setHasMoreMsgs(hm);
      hasMoreMsgsRef.current = hm;
      setNextBefore(nb);
      nextBeforeRef.current = nb;
      setHasMoreNewer(hmn);
      hasMoreNewerRef.current = hmn;
      nextAfterRef.current = na;
      touchMessengerMsgCache(messagesCacheRef.current, String(cid), {
        messages: items,
        hasMore: hm,
        hasMoreNewer: hmn,
        nextBefore: nb,
        nextAfter: na,
      });
      const exactFound = items.some((m) => String(m.id) === String(aroundId));
      let focusId = exactFound ? aroundId : null;
      if (!focusId) {
        // Pick closest id to the deleted anchor (numeric when possible)
        const target = Number(aroundId);
        if (Number.isFinite(target)) {
          let best = items[0]?.id;
          let bestDist = Infinity;
          for (const m of items) {
            const n = Number(m.id);
            if (!Number.isFinite(n)) continue;
            const d = Math.abs(n - target);
            if (d < bestDist) {
              bestDist = d;
              best = m.id;
            }
          }
          focusId = best;
        } else {
          focusId = items[Math.floor(items.length / 2)]?.id;
        }
      }
      return { ok: true, exactFound, focusId };
    } catch {
      return { ok: false, exactFound: false, focusId: null };
    }
  }, []);

  /** Scroll to a message id, or center the list if the node is gone. */
  const scrollToMessageIdOrFallback = (msgId) => {
    const box = listRef.current;
    if (!box) return;
    restoringScrollRef.current = true;
    const el = msgId ? document.getElementById(`msg-${msgId}`) : null;
    if (el) {
      el.scrollIntoView({ block: "center" });
    } else if (box.scrollHeight > box.clientHeight) {
      // Mid-window fallback — better than jumping to live edge by accident
      box.scrollTop = Math.max(0, (box.scrollHeight - box.clientHeight) * 0.35);
    }
    requestAnimationFrame(() => {
      restoringScrollRef.current = false;
    });
  };

  /** Append newer messages when the user scrolls down through a mid-history window. */
  const loadNewer = useCallback(async () => {
    const cid = activeIdRef.current;
    if (!cid || loadingMoreRef.current) return;
    if (!hasMoreNewerRef.current) return;
    let cursor = nextAfterRef.current;
    if (!cursor) {
      const list = messagesRef.current || [];
      if (list.length) cursor = list[list.length - 1]?.id;
    }
    if (!cursor) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const token = localStorage.getItem("access") || "";
      const url = `${MSG_API}/conversations/${cid}/messages/?after_id=${encodeURIComponent(cursor)}&limit=${LOAD_OLDER_SIZE}`
        + (token ? `&token=${encodeURIComponent(token)}` : "");
      const res = await apiRequest({ method: "GET", url });
      const data = unwrapData(res);
      const newer = normalizeMessages(data?.results || []);
      if (!newer.length) {
        hasMoreNewerRef.current = false;
        setHasMoreNewer(false);
        return;
      }
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => String(m.id)));
        const unique = newer.filter((m) => m?.id != null && !ids.has(String(m.id)));
        const next = [...prev, ...unique];
        messagesRef.current = next;
        try {
          const key = String(cid);
          const cached = messagesCacheRef.current.get(key) || {};
          touchMessengerMsgCache(messagesCacheRef.current, key, {
            ...cached,
            messages: next,
            hasMoreNewer: Boolean(data?.has_more_newer),
            nextAfter: data?.next_after_id || unique[unique.length - 1]?.id || cursor,
          });
        } catch { /* */ }
        return next;
      });
      const hmn = Boolean(data?.has_more_newer);
      hasMoreNewerRef.current = hmn;
      setHasMoreNewer(hmn);
      nextAfterRef.current = data?.next_after_id || newer[newer.length - 1]?.id || cursor;
    } catch { /* */ }
    finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      // Keep filling toward the live edge while still near the window bottom
      requestAnimationFrame(() => {
        const box = listRef.current;
        if (!box || loadingMoreRef.current || !hasMoreNewerRef.current) return;
        if (shouldChainLoadNewer(box, isMobile)) loadNewer();
      });
    }
  }, []);

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
    // Persist draft before clearing composer so Esc / back never loses text
    const leavingId = activeIdRef.current;
    if (leavingId != null && !editingMsgRef.current) {
      try {
        flushDraftToServer(leavingId, textRef.current);
      } catch { /* */ }
    }
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
    forceComposerText("");
    setPinnedMessages([]);
    setCurrentPinIndex(0);
    closePanel();
    setHashReady(true);
    setHash(null);
    // Always show the chat-list sidebar after leaving a chat (desktop + mobile)
    setDrawerOpen(true);
  }, [closePanel, flushDraftToServer]);

  const openChat = useCallback(async (c, { hashUser, jumpToMessageId } = {}) => {
    if (!c?.id) return;
    const cid = String(c.id);
    // Only show the full-screen "Opening chat…" overlay on a cold open (no cache).
    // Cached chats paint instantly — never block the UI on network.
    const earlyCached = messagesCacheRef.current.get(cid);
    const hasEarlyCache = Boolean(earlyCached?.messages?.length);
    setChatOpening(!hasEarlyCache);
    // Flush draft of the chat we are leaving (local + server, no debounce)
    if (activeIdRef.current && String(activeIdRef.current) !== cid) {
      if (!editingMsgRef.current) {
        try {
          flushDraftToServer(activeIdRef.current, textRef.current);
        } catch { /* */ }
      }
    }
    // Persist scroll position of the chat we are leaving
    if (activeIdRef.current && String(activeIdRef.current) !== cid) {
      const el = listRef.current;
      const prevKey = String(activeIdRef.current);
      const prev = messagesCacheRef.current.get(prevKey) || {};
      if (el && !restoringScrollRef.current) {
        const distBottom = Math.max(0, el.scrollHeight - el.scrollTop - el.clientHeight);
        const atBottom = distBottom < NEAR_BOTTOM_PX;
        const snapshot = {
          scrollTop: Math.max(0, el.scrollTop),
          distanceBottom: atBottom ? 0 : distBottom,
          nearBottom: atBottom,
          savedAt: Date.now(),
        };
        scrollAnchorRef.current = { convId: prevKey, ...snapshot };
        touchMessengerMsgCache(messagesCacheRef.current, prevKey, { ...prev, ...snapshot });
        try {
          sessionStorage.setItem(
            "messenger.scrollAnchor." + prevKey,
            JSON.stringify(snapshot)
          );
        } catch { /* */ }
      }
    }

    setActiveId(c.id);
    activeIdRef.current = c.id;
    setMobileShowChat(true);
    setMsgSearchOpen(false);
    setMsgSearchQ("");
    setMsgSearchResults([]);
    setMsgSearchIdx(-1);
    setReplyTo(null);
    setEditingMsg(null);
    // Restore unsent draft: localStorage is source of truth on this device
    forceComposerText(resolveComposerDraft(c.id, c.draft_text));
    // Keep list preview in sync with what we actually put in the composer
    try {
      const restored = readComposerDraft(c.id) || resolveComposerDraft(c.id, c.draft_text);
      if ((c.draft_text || "") !== restored) {
        setConversations((prev) => prev.map((row) =>
          String(row.id) === cid ? { ...row, draft_text: restored } : row
        ));
      }
    } catch { /* */ }
    setCtx(null);
    if (isMobile) setDrawerOpen(false);

    // Restore from cache instantly (no spinner / no blank flash)
    const cached = messagesCacheRef.current.get(cid);
    setNewBelowCount(0);
    pendingNewIdsRef.current = [];
    seenQueuedRef.current = new Set();
    flushedSeenRef.current = new Set();
    setSeenMsgIds(new Set());
    setShowScrollDown(false);
    setScrollDownOpacity(0);
    scrollDownDismissedRef.current = false;
    userScrollIntentRef.current = false;
    if (scrollDownFadeTimerRef.current) {
      clearTimeout(scrollDownFadeTimerRef.current);
      scrollDownFadeTimerRef.current = null;
    }
    setTypingUsers({});
    typingSentRef.current = false;
    // Reset pinned messages state for the new chat
    setPinnedMessages([]);
    setCurrentPinIndex(0);
    if (cached?.messages?.length) {
      messagesConvIdRef.current = c.id;
      setMessages(normalizeMessages(cached.messages || []));
      // Prefer cached flags; if missing, assume there may be older history so
      // loadOlder can probe (server returns empty → hasMore false).
      const oldestId = cached.messages?.[0]?.id || null;
      const newestId = cached.messages?.[cached.messages.length - 1]?.id || null;
      const nb = cached.nextBefore || oldestId || null;
      const hm = cached.hasMore == null ? true : Boolean(cached.hasMore);
      const hmn = cached.hasMoreNewer == null
        ? Boolean(cached.nearBottom !== true)
        : Boolean(cached.hasMoreNewer);
      setHasMoreMsgs(hm);
      setNextBefore(nb);
      hasMoreMsgsRef.current = hm;
      nextBeforeRef.current = nb;
      setHasMoreNewer(hmn);
      hasMoreNewerRef.current = hmn;
      nextAfterRef.current = cached.nextAfter || newestId || null;
      if (cached.detail) setActiveDetail(cached.detail);
      setLoadingMsgs(false);
      // Queue a single deterministic viewport restore. Unknown/legacy caches
      // intentionally fall back to bottom rather than jumping to the top.
      if (!jumpToMessageId) {
        // Cancel any delayed stick-to-bottom from the previous chat
        try {
          for (const t of stickTimersRef.current || []) clearTimeout(t);
          stickTimersRef.current = [];
          stickGenRef.current += 1;
        } catch { /* */ }

        let scrollTop = Number.isFinite(cached.scrollTop) ? cached.scrollTop : null;
        let distanceBottom = Number.isFinite(cached.distanceBottom) ? cached.distanceBottom : null;
        let nearBottom = cached.nearBottom === true;
        let anchorMsgId = cached.anchorMsgId || null;
        try {
          const raw = sessionStorage.getItem("messenger.scrollAnchor." + cid);
          if (raw) {
            const s = JSON.parse(raw);
            const cacheSaved = Number(cached.savedAt) || 0;
            const sessSaved = Number(s.savedAt) || 0;
            const preferSession = sessSaved >= cacheSaved;
            if (preferSession) {
              if (s.nearBottom === true) {
                nearBottom = true;
                distanceBottom = 0;
                scrollTop = null;
                anchorMsgId = null;
              } else {
                if (s.nearBottom === false) nearBottom = false;
                if (Number.isFinite(s.distanceBottom)) distanceBottom = s.distanceBottom;
                if (Number.isFinite(s.scrollTop)) scrollTop = s.scrollTop;
                if (s.anchorMsgId) anchorMsgId = s.anchorMsgId;
              }
            } else {
              if (Number.isFinite(s.distanceBottom) && distanceBottom == null) {
                distanceBottom = s.distanceBottom;
              }
              if (Number.isFinite(s.scrollTop) && scrollTop == null) {
                scrollTop = s.scrollTop;
              }
              if (cached.nearBottom == null && (s.nearBottom === true || s.nearBottom === false)) {
                nearBottom = !!s.nearBottom;
              }
              if (!anchorMsgId && s.anchorMsgId) anchorMsgId = s.anchorMsgId;
            }
          }
        } catch { /* */ }

        if (nearBottom) {
          distanceBottom = 0;
          scrollTop = null;
          anchorMsgId = null;
        }

        const restore = {
          convId: cid,
          scrollTop,
          distanceBottom,
          nearBottom: !!nearBottom,
          anchorMsgId: anchorMsgId || null,
        };
        pendingScrollRestoreRef.current = restore;
        scrollAnchorRef.current = restore;
        // Short hold only for paint — we no longer climb pages for 1s+
        scrollRestoreUntilRef.current = Date.now() + 400;
        nearBottomRef.current = !!nearBottom;
      } else {
        pendingScrollRestoreRef.current = null;
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

    // Cached: paint already done — refresh in background, never block UI.
    // Cold: load messages first so the thread appears ASAP, then detail/pins.
    if (cached?.messages?.length) {
      setChatOpening(false);
      const keepAtBottomAfterRefresh = cached.nearBottom === true;
      const anchorId = scrollAnchorRef.current?.anchorMsgId
        || cached.anchorMsgId
        || null;
      const cachedIds = new Set((cached.messages || []).map((m) => String(m.id)));
      const needAround = Boolean(
        anchorId
        && !keepAtBottomAfterRefresh
        && !cachedIds.has(String(anchorId))
      );

      void Promise.all([
        needAround
          ? loadAroundMessage(c.id, anchorId)
          : loadMessages(c.id, { silent: true, preserveOlder: true }),
        loadConversationDetail(c.id),
        loadPinnedMessages(c.id),
      ]).then(async (results) => {
        if (String(activeIdRef.current) !== String(c.id)) return;
        if (keepAtBottomAfterRefresh) {
          requestAnimationFrame(() => {
            const box = listRef.current;
            if (
              box
              && String(activeIdRef.current) === String(c.id)
              && nearBottomRef.current
              && !restoringScrollRef.current
            ) {
              box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
            }
          });
          return;
        }
        if (!anchorId) return;
        let focusId = anchorId;
        if (needAround) {
          const aroundRes = results?.[0];
          if (!aroundRes || aroundRes.ok === false) {
            // Deleted + empty neighbourhood → latest page at bottom
            await loadMessages(c.id, { silent: true, preserveOlder: false });
            requestAnimationFrame(() => {
              const box = listRef.current;
              if (box) box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
              nearBottomRef.current = true;
              persistViewportSnapshot(true);
            });
            return;
          }
          focusId = aroundRes.focusId || anchorId;
          // Refresh stored anchor to a message that still exists
          if (focusId && String(focusId) !== String(anchorId)) {
            try {
              const key = String(c.id);
              const prev = messagesCacheRef.current.get(key) || {};
              const snap = {
                ...prev,
                anchorMsgId: focusId,
                nearBottom: false,
                savedAt: Date.now(),
              };
              messagesCacheRef.current.set(key, snap);
              scrollAnchorRef.current = { convId: key, ...snap };
              sessionStorage.setItem(
                "messenger.scrollAnchor." + key,
                JSON.stringify({
                  anchorMsgId: focusId,
                  nearBottom: false,
                  distanceBottom: prev.distanceBottom,
                  scrollTop: prev.scrollTop,
                  savedAt: Date.now(),
                })
              );
            } catch { /* */ }
          }
        }
        requestAnimationFrame(() => {
          scrollToMessageIdOrFallback(focusId);
          // Warm newer pages so scrolling down is ready immediately
          if (hasMoreNewerRef.current) {
            setTimeout(() => {
              try { loadNewer(); } catch { /* */ }
            }, 80);
            setTimeout(() => {
              try {
                if (hasMoreNewerRef.current && !loadingMoreRef.current) loadNewer();
              } catch { /* */ }
            }, 220);
          }
        });
      });
    } else {
      try {
        await loadMessages(c.id);
      } finally {
        // Drop overlay as soon as messages are on screen (don't wait for pins/detail)
        if (String(activeIdRef.current) === String(c.id)) setChatOpening(false);
      }
      void Promise.all([
        loadConversationDetail(c.id),
        loadPinnedMessages(c.id),
      ]);
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
      requestAnimationFrame(() => {
        const box = listRef.current;
        if (!box || String(activeIdRef.current) !== String(cid)) return;
        restoringScrollRef.current = true;
        box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
        nearBottomRef.current = true;
        requestAnimationFrame(() => { restoringScrollRef.current = false; });
      });
    }
    // Ensure overlay is gone even if loadMessages was skipped / failed early
    if (String(activeIdRef.current) === String(c.id)) setChatOpening(false);
    // Viewport seen after open. force_all only when landing near the latest messages
    // so mid-history open does not silently mark everything below as read.
    setTimeout(() => {
      if (String(activeIdRef.current) !== String(c.id)) return;
      try { markVisibleMessagesRead(); } catch { /* */ }
      if (nearBottomRef.current) {
        markChatRead(c);
      }
    }, 450);
    setTimeout(() => {
      if (String(activeIdRef.current) !== String(c.id)) return;
      try { markVisibleMessagesRead(); } catch { /* */ }
    }, 900);
  }, [isMobile, loadMessages, loadConversationDetail, loadOlder, flushDraftToServer]);

  /* -------------------- calls -------------------- */

  /**
   * Start a new call in the ACTIVE conversation.
   * Refuses to start if the user is already in another call (busy).
   *
   * Defined here (after openChat) because startCallWithUser depends on
   * openChat — declaring it earlier would hit a TDZ violation under
   * strict-mode bundlers (Vite production build).
   */
  const startCall = useCallback(async ({ video, audio = true } = {}) => {
    if (!activeId) return;
    if (callConfigRef.current) {
      flash("You're already in a call — end it first");
      return;
    }
    // Compute the active conversation inline — `activeConv` is a derived
    // value defined further down in the component body, so referencing it
    // here would hit a TDZ violation in production builds. We replicate the
    // same derivation locally from already-declared state.
    const conv = activeDetail || conversations.find((c) => c.id === activeId);
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${activeId}/call/`,
        data: { video, audio },
      });
      const cfg = unwrapData(res);
      if (cfg?.room) {
        const isGroup = conv?.type === "group";
        const peer = !isGroup ? peerUser(conv, meId) : null;
        setCallConfig({
          ...cfg,
          is_initiator: true,
          is_group: isGroup,
          conversation_id: activeId,
          peer_title: isGroup
            ? (convTitle(conv, meId) || "Group call")
            : (peer?.username || peer?.display_name || convTitle(conv, meId) || "Call"),
          peer_avatar: withTokenQuery(
            isGroup ? convAvatar(conv, meId) : (peer?.avatar || peer?.avatar_url || convAvatar(conv, meId))
          ) || null,
        });
        setActiveCallInfo({
          call_id: cfg.call_id,
          status: "ringing",
          is_video: !!video,
          initiator: { id: meId, username: "You" },
          conversation_id: activeId,
        });
      }
    } catch (e) {
      flash(e?.response?.data?.message || "Could not start call");
    }
  }, [activeId, activeDetail, conversations, meId, flash]);

  /**
   * Start a call with a specific user (used by ProfileView call buttons).
   * Opens (or reuses) the DM with that user, then starts the call.
   */
  const startCallWithUser = useCallback(async (user, opts = {}) => {
    if (!user?.id) return;
    if (callConfigRef.current) {
      flash("You're already in a call — end it first");
      return;
    }
    try {
      // Ensure a DM exists
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/`,
        data: { type: "private", user_id: user.id },
      });
      const conv = unwrapData(res) || res?.data;
      const convId = conv?.id;
      if (!convId) {
        flash("Could not open conversation");
        return;
      }
      // Open the chat (does nothing if already open)
      openChat(conv);
      // Small delay so activeId propagates before we fire the call
      setTimeout(() => {
        (async () => {
          try {
            const r = await apiRequest({
              method: "POST",
              url: `${MSG_API}/conversations/${convId}/call/`,
              data: { video: !!opts.video, audio: true },
            });
            const cfg = unwrapData(r);
            if (cfg?.room) {
              setCallConfig({
                ...cfg,
                is_initiator: true,
                is_group: false,
                conversation_id: convId,
                peer_title: user.username || user.display_name || "Call",
                peer_avatar: withTokenQuery(user.avatar || user.avatar_url) || null,
              });
              setActiveCallInfo({
                call_id: cfg.call_id,
                status: "ringing",
                is_video: !!opts.video,
                initiator: { id: meId, username: "You" },
                conversation_id: convId,
              });
            }
          } catch (e) {
            flash(e?.response?.data?.message || "Could not start call");
          }
        })();
      }, 250);
    } catch (e) {
      flash(e?.response?.data?.message || "Could not start call");
    }
  }, [flash, meId, openChat]);

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

  const [remoteEmojiPlay, setRemoteEmojiPlay] = useState(null); // { messageId, key }
  const onRemoteEmojiPlay = useCallback((messageId) => {
    setRemoteEmojiPlay({ messageId: String(messageId), key: Date.now() });
  }, []);

  useMessengerWebSocket({
    meId,
    wsRef,
    activeIdRef,
    callConfigRef,
    panelHistoryRef,
    messagesCacheRef,
    nearBottomRef,
    pendingNewIdsRef,
    seenRingIdsRef,
    bottomRef,
    loadConversations,
    loadMessages,
    loadConversationDetail,
    loadPinnedMessages,
    loadConvJoinRequests,
    loadMyJoinRequests,
    closeChat,
    openChat,
    flash,
    setMessages,
    setOnlineUsers,
    setTypingUsers,
    setIncomingCall,
    setCallConfig,
    setActiveCallInfo,
    setNewBelowCount,
    setText: forceComposerText,
    setConversations,
    onRemoteEmojiPlay,
  });


  /* Esc global — closes dialogs/panels in priority order */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Don't steal Esc from an open native <dialog> / contenteditable edge case
      if (preview) { setPreview(null); return; }
      if (galleryState) { setGalleryState(null); return; }
      if (mediaLibraryOpen) { setMediaLibraryOpen(false); return; }
      if (readersMessage) { setReadersMessage(null); return; }
      if (videoEditFile) { setVideoEditFile(null); return; }
      if (cropFile) { setCropFile(null); return; }
      if (mediaSettingsOpen) { setMediaSettingsOpen(false); return; }
      if (msgSearchOpen) {
        setMsgSearchOpen(false);
        setMsgSearchQ("");
        setMsgSearchResults([]);
        setMsgSearchIdx(-1);
        setJumpHighlightId(null);
        return;
      }
      if (dayJumpOpen) { setDayJumpOpen(false); return; }
      if (ctx) { setCtx(null); return; }
      if (reactAnchor) { setReactAnchor(null); return; }
      if (confirmDelete) { setConfirmDelete(null); return; }
      if (confirmBlock) { setConfirmBlock(null); return; }
      if (confirmLeave) { setConfirmLeave(null); return; }
      if (confirmCleanup) { setConfirmCleanup(null); return; }
      if (joinConfirm) { setJoinConfirm(null); return; }
      if (forwardOpen) { setForwardOpen(null); return; }
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        return;
      }
      if (editingMsg) {
        setEditingMsg(null);
        forceComposerText(activeId ? readComposerDraft(activeId) : "");
        return;
      }
      if (replyTo) { setReplyTo(null); return; }
      if (panelHistory.length) {
        // Close the entire right panel stack so the next Esc can leave the chat
        closePanel();
        return;
      }
      // Desktop: if the chat-list drawer was hidden with ">", reopen it first
      if (!isMobile && !drawerOpen) {
        setDrawerOpen(true);
        return;
      }
      // Leave the open chat → show conversation list (drawer guaranteed open)
      if (activeId || mobileShowChat) {
        closeChat();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    preview, galleryState, mediaLibraryOpen, readersMessage, videoEditFile, cropFile,
    mediaSettingsOpen, msgSearchOpen, dayJumpOpen, ctx, reactAnchor, editingMsg, replyTo,
    panelHistory, activeId, mobileShowChat, closeChat, closePanel, drawerOpen, isMobile,
    confirmDelete, confirmBlock, confirmLeave, confirmCleanup, joinConfirm, forwardOpen,
    selectionMode,
  ]);

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
      const pushRoot = () => {
        try {
          window.history.pushState({ ...(window.history.state || {}), messengerRoot: true }, "", window.location.href);
        } catch { /* */ }
      };

      // Close overlays / selection first (never leave the page)
      if (preview) { setPreview(null); pushRoot(); return; }
      if (galleryState) { setGalleryState(null); pushRoot(); return; }
      if (readersMessage) { setReadersMessage(null); pushRoot(); return; }
      if (videoEditFile) { setVideoEditFile(null); pushRoot(); return; }
      if (cropFile) { setCropFile(null); pushRoot(); return; }
      if (mediaSettingsOpen) { setMediaSettingsOpen(false); pushRoot(); return; }
      if (msgSearchOpen) {
        setMsgSearchOpen(false);
        setMsgSearchQ("");
        setMsgSearchResults([]);
        setMsgSearchIdx(-1);
        setJumpHighlightId(null);
        pushRoot();
        return;
      }
      if (dayJumpOpen) { setDayJumpOpen(false); pushRoot(); return; }
      if (ctx) { setCtx(null); pushRoot(); return; }
      if (reactAnchor) { setReactAnchor(null); pushRoot(); return; }
      if (confirmDelete) { setConfirmDelete(null); pushRoot(); return; }
      if (confirmBlock) { setConfirmBlock(null); pushRoot(); return; }
      if (confirmLeave) { setConfirmLeave(null); pushRoot(); return; }
      if (confirmCleanup) { setConfirmCleanup(null); pushRoot(); return; }
      if (joinConfirm) { setJoinConfirm(null); pushRoot(); return; }
      if (forwardOpen) { setForwardOpen(null); pushRoot(); return; }
      if (joinOpen) { setJoinOpen(false); pushRoot(); return; }
      if (addMemberOpen) { setAddMemberOpen(false); pushRoot(); return; }
      if (createGroupOpen) { setCreateGroupOpen(false); pushRoot(); return; }
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        pushRoot();
        return;
      }
      if (editingMsg) {
        setEditingMsg(null);
        forceComposerText(activeId ? readComposerDraft(activeId) : "");
        pushRoot();
        return;
      }
      if (replyTo) { setReplyTo(null); pushRoot(); return; }

      // Right panel stack (profile, settings, contacts, …)
      if (panelHistory.length) {
        popPanel();
        pushRoot();
        return;
      }

      if (activeId || mobileShowChat) {
        closeChat();
        pushRoot();
        exitConfirmRef.current = false;
        setExitHint(false);
        return;
      }

      // Conversation list: require second back to leave messenger (all tabs)
      if (!exitConfirmRef.current) {
        exitConfirmRef.current = true;
        setExitHint(true);
        pushRoot();
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
    msgSearchOpen, dayJumpOpen, ctx, reactAnchor, confirmDelete, confirmBlock, confirmLeave,
    confirmCleanup, joinConfirm, forwardOpen, joinOpen, addMemberOpen, createGroupOpen,
    selectionMode, editingMsg, replyTo,
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
    const body = String(textRef.current || "").trim();
    if (editingMsg) {
      if (!body) return;
      try {
        const res = await apiRequest({
          method: "PATCH", url: `${MSG_API}/messages/${editingMsg.id}/edit/`,
          data: { body },
        });
        const updated = unwrapData(res);
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditingMsg(null);
        // After edit, restore any remaining draft for this chat (or empty)
        forceComposerText(readComposerDraft(activeId));
        flash("Edited");
      } catch (e) {
        setError(e?.response?.data?.message || "Edit failed");
      }
      return;
    }
    if (!body && !files.length) return;

    // Bake deferred image crops/draws right before upload
    let filesToSend = [...files];
    try {
      filesToSend = await finalizeMessengerFiles(filesToSend, { outputSize: 1600 });
    } catch (e) {
      setError(e?.message || "Could not process image edits");
      return;
    }
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
      if (scheduledFor) form.append("scheduled_for", scheduledFor);
      filesToSend.forEach((f) => form.append("files", f));
      if (mediaSpoiler) form.append("is_spoiler", "1");
      if (mediaViewOnce) form.append("is_view_once", "1");
      const pendingId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tempMsgId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const localCreatedAt = new Date().toISOString();
      const rep = replyTo;
      // Optimistic bubble for text (and for file sends that complete quickly)
      if (!filesToSend.length) {
        const optimistic = {
          id: tempMsgId,
          body,
          created_at: scheduledFor || localCreatedAt,
          sender: {
            id: meId,
            username: profileDataRef.current?.username || "You",
            avatar: meAvatar || profileDataRef.current?.avatar || null,
          },
          attachments: [],
          reply_to_preview: rep
            ? {
                id: rep.id,
                body: typeof rep.body === "string" ? rep.body : String(rep.body || ""),
                sender: rep.sender,
              }
            : null,
          read_state: "pending",
          _pending: true,
          is_scheduled: Boolean(scheduledFor),
          scheduled_for: scheduledFor || null,
        };
        setMessages((prev) => {
          const next = [...prev, optimistic].sort((a, b) => {
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            if (ta !== tb) return ta - tb;
            return String(a.id).localeCompare(String(b.id));
          });
          return next;
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 20);
      }
      if (filesToSend.length) {
        const totalBytes = filesToSend.reduce((sum, f) => sum + Number(f.size || 0), 0);
        setPendingUploads((prev) => [...prev, {
          id: pendingId, conversationId: activeId, body,
          files: filesToSend.map((f) => ({ name: f.name, size: f.size, type: f.type })),
          loaded: 0, total: totalBytes, progress: 0, status: "uploading",
        }]);
      }
      // Stop typing indicator for peers immediately on send
      stopTypingSignal();
      forceComposerText(""); setFiles([]);
      setMediaSpoiler(false);
      setMediaViewOnce(false);
      // Clear draft locally + on server immediately (not debounced)
      try { flushDraftToServer(activeId, ""); } catch { /* */ }
      setReplyTo(null);
      setScheduledFor(null);
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
          // Replace optimistic temp with confirmed message (server time + id)
          if (!filesToSend.length) {
            setMessages((prev) => {
              const withoutTemp = prev.filter((m) => String(m.id) !== tempMsgId);
              const map = new Map();
              for (const m of withoutTemp) {
                if (m?.id != null) map.set(String(m.id), m);
              }
              map.set(String(created.id), { ...created, _pending: false, read_state: created.read_state || "sent" });
              return Array.from(map.values()).sort((a, b) => {
                const ta = new Date(a.created_at || 0).getTime();
                const tb = new Date(b.created_at || 0).getTime();
                if (ta !== tb) return ta - tb;
                const aTemp = String(a.id).startsWith("temp-");
                const bTemp = String(b.id).startsWith("temp-");
                if (aTemp !== bTemp) return aTemp ? 1 : -1;
                const na = Number(a.id);
                const nb = Number(b.id);
                if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
                return String(a.id).localeCompare(String(b.id));
              });
            });
          } else {
            await loadMessages(activeId, { silent: true });
          }
          setScheduledFor(null);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 30);
          loadConversations({ silent: true });
          if (filesToSend.length) setTimeout(() => setPendingUploads((prev) => prev.filter((u) => u.id !== pendingId)), 600);
        }
      } catch (e) {
        if (rep) setReplyTo(rep);
        const msg = e?.response?.data?.message || "Send failed";
        setError(msg);
        // Remove optimistic bubble on failure
        if (!filesToSend.length) {
          setMessages((prev) => prev.filter((m) => String(m.id) !== tempMsgId));
        }
        if (filesToSend.length) setPendingUploads((prev) => prev.map((u) => u.id === pendingId ? { ...u, status: "failed", error: msg } : u));
      }
      return;
    }

    // "Send separately": each selected file becomes its own message.
    const rep = replyTo;
    stopTypingSignal();
    forceComposerText(""); setFiles([]); setReplyTo(null);
    try { flushDraftToServer(activeId, ""); } catch { /* */ }
    setScheduledFor(null);
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
      if (mediaSpoiler) form.append("is_spoiler", "1");
      if (mediaViewOnce) form.append("is_view_once", "1");
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
    forceComposerText(typeof m.body === "string" ? m.body : String(m.body || ""));
    setCtx(null);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const onComposerKeyDown = (e) => {
    // ArrowUp → edit last own message ONLY when the composer is completely empty
    // (no text, no blank lines from Shift+Enter). Whitespace-only / "\n\n" must NOT trigger.
    if (
      e.key === "ArrowUp"
      && !e.shiftKey
      && !e.altKey
      && !e.ctrlKey
      && !e.metaKey
      && !editingMsg
      && !replyTo
      && textRef.current === ""
    ) {
      const lastMine = [...messages].reverse().find(
        (m) => String(m.sender?.id) === String(meId) && !m.is_deleted && !m.is_system
      );
      if (lastMine) {
        e.preventDefault();
        startEdit(lastMine);
      }
      return;
    }
    // Real mobile device: Enter = new line (Send button only).
    // Desktop (even if the window is narrow): Enter sends, Shift+Enter = new line.
    if (e.key === "Enter" && !e.shiftKey && !isMobileDevice) {
      e.preventDefault();
      sendOrEdit();
    }
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
      // Always refresh pinned bar — the deleted message may have been pinned
      if (activeIdRef.current) loadPinnedMessages(activeIdRef.current);
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
    const id = Number(userId);
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/blocks/${encodeURIComponent(id)}/unblock/`,
      });

      // The backend is the source of truth. Update every in-memory representation
      // immediately so stale conversation/profile snapshots cannot re-show Block.
      flash(res?.data?.message || "Unblocked");
      setBlocks((prev) => prev.filter((u) => String(u.id) !== String(id)));
      setProfileData((p) => (p && String(p.id) === String(id)
        ? { ...p, is_blocked: false }
        : p));
      setActiveDetail((d) => (d?.peer?.id && String(d.peer.id) === String(id)
        ? { ...d, peer: { ...d.peer, is_blocked: false } }
        : d));
      setConversations((prev) => prev.map((c) => (
        c.type === "private" && c.peer?.id && String(c.peer.id) === String(id)
          ? { ...c, peer: { ...c.peer, is_blocked: false } }
          : c
      )));

      // Re-fetch the authoritative profile state. This also guards against an
      // old object captured before the block/unblock transition.
      try {
        const profileRes = await apiRequest({
          method: "GET",
          url: `${MSG_API}/users/${encodeURIComponent(id)}/profile/`,
        });
        const freshProfile = unwrapData(profileRes);
        if (freshProfile && String(freshProfile.id) === String(id)) {
          setProfileData((p) => (p && String(p.id) === String(id) ? freshProfile : p));
          setActiveDetail((d) => (d?.peer?.id && String(d.peer.id) === String(id)
            ? { ...d, peer: { ...d.peer, is_blocked: !!freshProfile.is_blocked } }
            : d));
        }
      } catch { /* optimistic state is already correct */ }

      await loadConversations({ silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Unblock failed");
    }
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

  /* ---- Pinned Messages (per-message pin) ---- */

  const pinMessage = useCallback(async (msg) => {
    if (!msg?.id) return;
    try {
      const res = await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msg.id}/pin/` });
      const data = unwrapData(res);
      // Refresh pinned messages for the active conversation
      if (activeIdRef.current) {
        await loadPinnedMessages(activeIdRef.current);
      }
      // Also reload conversation detail to keep pins in sync
      if (activeIdRef.current) {
        loadConversationDetail(activeIdRef.current);
      }
      flash(data?.pinned ? "Message pinned" : "Message unpinned");
    } catch (e) {
      setError(e?.response?.data?.message || "Pin message failed");
    }
  }, [loadPinnedMessages, loadConversationDetail]);

  // Cycle through pinned messages: up = older pin (next index, wraps), down = newer pin (prev index, wraps)
  const cyclePinnedUp = useCallback(() => {
    if (pinnedMessages.length <= 1) return;
    setCurrentPinIndex((prev) => (prev + 1) % pinnedMessages.length);
  }, [pinnedMessages.length]);

  const cyclePinnedDown = useCallback(() => {
    if (pinnedMessages.length <= 1) return;
    setCurrentPinIndex((prev) => (prev - 1 + pinnedMessages.length) % pinnedMessages.length);
  }, [pinnedMessages.length]);

  // Check if a specific message is currently pinned (for context menu icon)
  const isMessagePinned = useCallback((msgId) => {
    return pinnedMessages.some((p) => String(p.message?.id) === String(msgId));
  }, [pinnedMessages]);
  const jumpToMessageInChat = useCallback(async (messageId) => {
    if (!messageId || !activeIdRef.current) return;
    const id = String(messageId);

    const flashTarget = (el) => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch { /* */ }
      // Drive the React highlight on the message wrapper (yellow pulse)
      setJumpHighlightId(id);
      window.setTimeout(() => {
        setJumpHighlightId((cur) => (String(cur) === id ? null : cur));
      }, 2200);
    };

    const findEl = () =>
      document.getElementById(`msg-${id}`)
      || document.querySelector(`[data-msg-id="${id}"]`);

    let el = findEl();
    if (el) {
      // Double rAF so layout is settled after dialog close
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      el = findEl() || el;
      flashTarget(el);
      return;
    }

    // Not in DOM yet — load older pages until it appears (wait for paint)
    for (let i = 0; i < 30; i += 1) {
      if (!hasMoreMsgsRef.current && i > 0) break;
      await loadOlder();
      // Wait for React commit + browser paint after prepending messages
      await new Promise((r) => setTimeout(r, 60));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      el = findEl();
      if (el) {
        flashTarget(el);
        return;
      }
    }
    try { flash("Message not found — try Load older messages"); } catch { /* */ }
  }, [loadOlder, flash]);

  const jumpToDayInChat = useCallback(async (dayItem) => {
    if (!dayItem) return;
    const label = String(dayItem.label || "").trim();
    if (!label) return;

    const waitPaint = async () => {
      await new Promise((r) => setTimeout(r, 50));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    };

    const findDayEl = () => {
      // Always prefer label — day element id changes as older chunks prepend
      const byLabel = Array.from(document.querySelectorAll("[data-day-label]")).find(
        (n) => n.getAttribute("data-day-label") === label
      );
      if (byLabel) return byLabel;
      const dayId = String(dayItem.id || "");
      if (dayId) {
        return document.getElementById(dayId)
          || document.querySelector(`[data-day-id="${dayId}"]`);
      }
      return null;
    };

    const oldestDayLabel = () => {
      let list = messagesRef.current || [];
      if (!list.length) {
        const cached = messagesCacheRef.current.get(String(activeIdRef.current));
        list = cached?.messages || [];
      }
      if (!list.length) return null;
      // messages are chronological ascending (oldest first)
      return formatDay(list[0]?.created_at);
    };

    const flashDay = (el) => {
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch { /* */ }
      // Highlight by label so it survives id renames after more loads
      setJumpHighlightDayId(label);
      window.setTimeout(() => {
        setJumpHighlightDayId((cur) => (String(cur) === label ? null : cur));
      }, 2200);
    };

    await waitPaint();

    // Keep loading older history until we reach the START of this day:
    // stop when the oldest loaded message is from an earlier day, or no more pages.
    // Stopping at the first chunk that merely contains this day leaves the separator
    // mid-day — user asked to land on the first message / day tag of that day.
    for (let i = 0; i < 40; i += 1) {
      const oldest = oldestDayLabel();
      const el = findDayEl();

      // True start of day: we have the day marker AND oldest message is NOT still this day
      // (i.e. previous day is loaded, or history is exhausted).
      if (el && oldest && oldest !== label) {
        await waitPaint();
        flashDay(findDayEl() || el);
        return;
      }
      // History exhausted while still on this day → separator is at true start
      if (el && !hasMoreMsgsRef.current) {
        await waitPaint();
        flashDay(findDayEl() || el);
        return;
      }

      if (!hasMoreMsgsRef.current) break;
      const lenBefore = (messagesRef.current || []).length;
      await loadOlder();
      // Wait until React commits prepended messages (or timeout)
      for (let w = 0; w < 20; w += 1) {
        await waitPaint();
        if ((messagesRef.current || []).length !== lenBefore) break;
      }
    }

    // Fallback: best available day marker even if mid-day
    const finalEl = findDayEl();
    if (finalEl) {
      flashDay(finalEl);
      return;
    }
    try { flash("Day not found — try Load older messages"); } catch { /* */ }
  }, [loadOlder, flash]);

  // Force yellow flash even when jumping to the same message again
  const flashJumpMessage = useCallback((messageId) => {
    if (messageId == null) return;
    const id = String(messageId);
    setJumpHighlightId(null);
    // Re-apply on next frame so CSS animation restarts
    requestAnimationFrame(() => {
      setJumpHighlightId(id);
      window.setTimeout(() => {
        setJumpHighlightId((cur) => (String(cur) === id ? null : cur));
      }, 2200);
    });
  }, []);

  const msgSearchResultsRef = useRef([]);
  useEffect(() => { msgSearchResultsRef.current = msgSearchResults; }, [msgSearchResults]);
  const msgSearchIdxRef = useRef(-1);
  useEffect(() => { msgSearchIdxRef.current = msgSearchIdx; }, [msgSearchIdx]);
  const msgSearchLastQRef = useRef("");

  const runMessageSearch = useCallback(async (q, { keepIndex = false } = {}) => {
    const cid = activeIdRef.current;
    const query = (q ?? "").trim();
    if (!cid || !query) {
      setMsgSearchResults([]);
      setMsgSearchIdx(-1);
      msgSearchLastQRef.current = "";
      return;
    }
    // Skip duplicate network search for identical query (stops blink loop)
    if (query === msgSearchLastQRef.current && msgSearchResultsRef.current.length) {
      const idx = keepIndex && msgSearchIdxRef.current >= 0 ? msgSearchIdxRef.current : 0;
      const mid = msgSearchResultsRef.current[idx]?.id
        || msgSearchResultsRef.current[0]?.id;
      if (mid) {
        setMsgSearchIdx(idx >= 0 ? idx : 0);
        await jumpToMessageInChat(mid);
        flashJumpMessage(mid);
      }
      return;
    }
    setMsgSearchLoading(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${MSG_API}/conversations/${cid}/messages/search/?q=${encodeURIComponent(query)}&limit=80`,
      });
      const data = unwrapData(res);
      const list = data?.results || [];
      msgSearchLastQRef.current = query;
      setMsgSearchResults(list);
      if (list.length) {
        const idx = 0;
        setMsgSearchIdx(idx);
        const mid = list[idx]?.id;
        if (mid) {
          await jumpToMessageInChat(mid);
          flashJumpMessage(mid);
        }
      } else {
        setMsgSearchIdx(-1);
      }
    } catch {
      setMsgSearchResults([]);
      setMsgSearchIdx(-1);
    } finally {
      setMsgSearchLoading(false);
    }
  }, [jumpToMessageInChat, flashJumpMessage]);

  const goMsgSearchResult = useCallback((dir) => {
    const list = msgSearchResultsRef.current;
    if (!list.length) return;
    let next = msgSearchIdxRef.current < 0 ? 0 : msgSearchIdxRef.current + dir;
    if (next < 0) next = list.length - 1;
    if (next >= list.length) next = 0;
    setMsgSearchIdx(next);
    const mid = list[next]?.id;
    if (mid) {
      jumpToMessageInChat(mid).then(() => flashJumpMessage(mid));
    }
  }, [jumpToMessageInChat, flashJumpMessage]);

  const focusCurrentSearchResult = useCallback(() => {
    const list = msgSearchResultsRef.current;
    const idx = msgSearchIdxRef.current;
    if (!list.length) {
      runMessageSearch(msgSearchQ, { keepIndex: false });
      return;
    }
    const i = idx >= 0 && idx < list.length ? idx : 0;
    setMsgSearchIdx(i);
    const mid = list[i]?.id;
    if (mid) {
      jumpToMessageInChat(mid).then(() => flashJumpMessage(mid));
    }
  }, [jumpToMessageInChat, flashJumpMessage, runMessageSearch, msgSearchQ]);

  const closeMsgSearch = useCallback(() => {
    setMsgSearchOpen(false);
    setMsgSearchQ("");
    setMsgSearchResults([]);
    setMsgSearchIdx(-1);
    msgSearchLastQRef.current = "";
    setJumpHighlightId(null);
  }, []);

  const openMsgSearch = useCallback(() => {
    // Hide composer contents: clear pending attachments / reply / edit
    setFiles([]);
    setReplyTo(null);
    setEditingMsg(null);
    setSendFilesTogether(false);
    setMediaSpoiler(false);
    setMediaViewOnce(false);
    setMsgSearchOpen(true);
  }, []);


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

  /** Immediately tell peers we stopped typing (e.g. after send). */
  const stopTypingSignal = useCallback(() => {
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (typingSentRef.current) {
      typingSentRef.current = false;
      sendTypingSignal(false);
    }
  }, [sendTypingSignal]);

  // Called on every keystroke from MessageComposer — MUST NOT set React state for the
  // text itself (that would re-render message list + sidebar). Only refs + debounced side effects.
  const handleComposerText = useCallback((valueOrFn) => {
    const prev = textRef.current;
    const next = typeof valueOrFn === "function" ? valueOrFn(prev) : valueOrFn;
    const nextStr = next == null ? "" : String(next);
    textRef.current = nextStr;

    const cid = activeIdRef.current;
    if (cid) {
      try { writeComposerDraft(cid, nextStr); } catch { /* */ }
    }

    // Typing indicator
    if (String(nextStr || "").trim()) {
      if (!typingSentRef.current) {
        typingSentRef.current = true;
        sendTypingSignal(true);
      }
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = setTimeout(() => {
        typingSentRef.current = false;
        sendTypingSignal(false);
        typingStopTimerRef.current = null;
      }, 2200);
    } else if (typingSentRef.current) {
      typingSentRef.current = false;
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      sendTypingSignal(false);
    }

    // Debounced chat-list draft preview + WS sync (no per-keystroke React text state)
    if (editingMsgRef.current) return;
    if (!cid) return;
    const cidStr = String(cid);

    if (draftListTimerRef.current) clearTimeout(draftListTimerRef.current);
    draftListTimerRef.current = setTimeout(() => {
      const d = String(textRef.current || "");
      setConversations((prev) => {
        let changed = false;
        const mapped = prev.map((c) => {
          if (String(c.id) !== cidStr) return c;
          if ((c.draft_text || "") === d) return c;
          changed = true;
          return { ...c, draft_text: d };
        });
        return changed ? mapped : prev;
      });
    }, 350);

    if (draftSyncTimerRef.current) clearTimeout(draftSyncTimerRef.current);
    draftSyncTimerRef.current = setTimeout(() => {
      const id = activeIdRef.current;
      if (!id) return;
      const payload = String(textRef.current || "");
      const last = lastDraftSyncedRef.current;
      if (last.convId === String(id) && last.text === payload) return;
      if (wsRef.current && wsRef.current.readyState === 1) {
        try {
          wsRef.current.send(JSON.stringify(draftPayload(id, payload)));
          lastDraftSyncedRef.current = { convId: String(id), text: payload };
        } catch { /* */ }
      }
    }, 1200);
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
      // History visibility changes require a fresh message window for all members
      if (patch && Object.prototype.hasOwnProperty.call(patch, "history_visibility")) {
        messagesCacheRef.current.delete(String(activeId));
        await loadMessages(activeId, { silent: false, preserveOlder: false });
      }
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

  const downloadAttachmentFile = async (att) => {
    if (!att) return;
    const name = (att.original_filename || att.name || "download").replace(/[/\\?%*:|"<>]/g, "_");
    try {
      let blob = null;
      if (att._blobUrl) {
        const r = await fetch(att._blobUrl);
        blob = await r.blob();
      } else if (att.url) {
        const r = await fetch(withTokenQuery(att.url), {
          headers: authHeaders(),
          credentials: "include",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        blob = await r.blob();
      } else {
        return;
      }

      // Chrome/Edge: real save dialog when available
      if (typeof window.showSaveFilePicker === "function") {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: name,
            types: [{
              description: "File",
              accept: { "application/octet-stream": ["." + ((name.split(".").pop() || "bin"))] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          flash?.("Saved");
          return;
        } catch (err) {
          if (err && (err.name === "AbortError" || err.name === "NotAllowedError")) return;
        }
      }

      // Force disk download: browsers open text/pdf blob: URLs as a tab.
      // octet-stream + download attribute saves into the Downloads folder.
      const forced = new Blob([await blob.arrayBuffer()], { type: "application/octet-stream" });
      const obj = URL.createObjectURL(forced);
      const a = document.createElement("a");
      a.href = obj;
      a.setAttribute("download", name);
      a.style.display = "none";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { a.remove(); } catch { /* */ }
        try { URL.revokeObjectURL(obj); } catch { /* */ }
      }, 2000);
    } catch (e) {
      flash?.(e?.message || "Download failed");
    }
  };

  const openPreview = async (att) => {
    // If already a cached blob URL from FileAttachmentCard, open directly
    if (att?._fromCache && att?._blobUrl) {
      const k = attachmentKind(att);
      if (k === "pdf") {
        setPreview({ att, kind: "pdf", blobUrl: att._blobUrl });
        return;
      }
      if (k === "text") {
        try {
          const r = await fetch(att._blobUrl);
          const textContent = await r.text();
          setPreview({ att, kind: "text", textContent: textContent.slice(0, 200000), blobUrl: att._blobUrl });
        } catch {
          setPreview({ att, kind: "text", textContent: "(Could not load text)", blobUrl: att._blobUrl });
        }
        return;
      }
      setPreview({ att, kind: k || "file", blobUrl: att._blobUrl });
      return;
    }

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

    // PDF / text / generic files: download into blob cache first (Telegram-style).
    // iframe of the API URL fails when the API sends X-Frame-Options: deny.
    if (k === "pdf" || k === "text" || k === "file") {
      try {
        const entry = await downloadAttachmentToCache(att, authHeaders());
        if (k === "text") {
          const textContent = await entry.blob.text();
          setPreview({
            att,
            kind: "text",
            textContent: textContent.slice(0, 200000),
            blobUrl: entry.blobUrl,
          });
        } else if (k === "pdf") {
          setPreview({ att, kind: "pdf", blobUrl: entry.blobUrl });
        } else {
          setPreview({ att, kind: "file", blobUrl: entry.blobUrl });
        }
      } catch (e) {
        setPreview({
          att,
          kind: k,
          error: e?.message || "Download failed",
        });
      }
      return;
    }
    setPreview({ att, kind: k });
  };

  // Reply-jump: scroll the replied message into view + flash highlight
  const onJumpToMessage = useCallback(async (msgId) => {
    // Share the same robust path as search / day-jump
    return jumpToMessageInChat(msgId);
  }, [jumpToMessageInChat]);

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

  // @mention candidates are local to the active conversation so suggestions
  // stay fast and relevant without a network request for every keystroke.
  const mentionUsers = useMemo(() => {
    const out = [];
    const pushUser = (u) => {
      if (!u || String(u.id) === String(meId)) return;
      const username = u.username || u.user?.username;
      if (!username) return;
      out.push({
        id: u.id || u.user?.id,
        username,
        display_name: u.display_name || u.full_name || u.name || u.user?.display_name || username,
        avatar: u.avatar || u.avatar_url || u.user?.avatar || u.user?.avatar_url,
      });
    };

    if (activeConv?.type === "group") {
      for (const participant of activeConv.participants || []) {
        pushUser(participant?.user || participant);
      }
    } else {
      pushUser(peer);
      for (const contact of contacts || []) pushUser(contact?.contact || contact);
    }

    const seen = new Set();
    return out.filter((u) => {
      const key = String(u.username).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeConv, peer, contacts, meId]);

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
    if (!cid) return;
    // Only POST ids not yet acknowledged in this session
    const pending = Array.from(seenQueuedRef.current)
      .filter((id) => !flushedSeenRef.current.has(String(id)));
    if (!pending.length) return;
    const batch = pending
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(-200);
    if (!batch.length) return;
    // Optimistic: mark flushed so rapid scroll does not spam identical POSTs
    batch.forEach((id) => flushedSeenRef.current.add(String(id)));
    apiRequest({
      method: "POST",
      url: `${MSG_API}/conversations/${cid}/read/`,
      data: {
        message_ids: batch,
        // Some backends also accept last_read_id
        last_read_id: batch[batch.length - 1],
      },
    }).then(() => {
      loadConversations({ silent: true });
    }).catch(() => {
      // Allow retry on next visibility pass
      batch.forEach((id) => flushedSeenRef.current.delete(String(id)));
    });
  }, []);

  const markVisibleMessagesRead = useCallback(() => {
    const cid = activeIdRef.current;
    const root = listRef.current;
    if (!cid || !root) return;
    const rootRect = root.getBoundingClientRect();
    let found = false;
    // Prefer data-msg-id nodes (MessageBubble); also accept #msg-<id> wrappers.
    // Only walk elements that can intersect the viewport — early-exit once past bottom.
    // (Full querySelectorAll on every call was a major source of scroll freezes.)
    const nodes = root.querySelectorAll("[data-msg-id], [id^='msg-']");
    const len = nodes.length;
    for (let i = 0; i < len; i += 1) {
      const node = nodes[i];
      let id = node.getAttribute("data-msg-id");
      if (!id && node.id && node.id.startsWith("msg-")) id = node.id.slice(4);
      if (!id) continue;
      // Skip own messages only. System/call events must mark as seen too.
      const mineAttr = node.getAttribute("data-msg-mine");
      if (mineAttr === "1") continue;
      if (mineAttr == null) {
        const inner = node.querySelector?.("[data-msg-mine]");
        if (inner?.getAttribute("data-msg-mine") === "1") continue;
      }
      const r = node.getBoundingClientRect();
      // Past the bottom of the list viewport — remaining nodes are further down
      if (r.top > rootRect.bottom + 4) break;
      if (r.bottom < rootRect.top - 4) continue;
      const overlap = Math.min(r.bottom, rootRect.bottom) - Math.max(r.top, rootRect.top);
      if (overlap < 12) continue;
      if (!seenQueuedRef.current.has(String(id))) {
        seenQueuedRef.current.add(String(id));
        found = true;
      }
    }
    if (!found) return;
    setSeenMsgIds(new Set(seenQueuedRef.current));
    if (seenFlushTimerRef.current) clearTimeout(seenFlushTimerRef.current);
    seenFlushTimerRef.current = setTimeout(() => flushSeenReceipts(cid), 250);
  }, [flushSeenReceipts]);

  const dismissScrollDownButton = () => {
    // Hide during programmatic smooth-scroll. Re-armed only by a real user
    // gesture (wheel / touch / pointer), never by the programmatic scroll events.
    scrollDownDismissedRef.current = true;
    userScrollIntentRef.current = false;
    if (scrollDownFadeTimerRef.current) {
      clearTimeout(scrollDownFadeTimerRef.current);
      scrollDownFadeTimerRef.current = null;
    }
    setScrollDownOpacity(0);
    setShowScrollDown(false);
  };

  const scrollDownHoverRef = useRef(false);

  const clearScrollDownFadeTimers = () => {
    if (scrollDownFadeTimerRef.current) {
      clearTimeout(scrollDownFadeTimerRef.current);
      scrollDownFadeTimerRef.current = null;
    }
  };

  const scheduleScrollDownFade = () => {
    clearScrollDownFadeTimers();
    if (scrollDownHoverRef.current) return;
    scrollDownFadeTimerRef.current = setTimeout(() => {
      if (scrollDownHoverRef.current) return;
      setScrollDownOpacity(0);
      scrollDownFadeTimerRef.current = setTimeout(() => {
        if (scrollDownHoverRef.current) return;
        setShowScrollDown(false);
        scrollDownFadeTimerRef.current = null;
      }, 250);
    }, 1800);
  };

  const armScrollDownButton = () => {
    scrollDownDismissedRef.current = false;
    setShowScrollDown(true);
    setScrollDownOpacity(1);
    scheduleScrollDownFade();
  };

  /**
   * After a step-scroll settles: mark everything currently in the viewport as
   * seen, recount remaining "new below", and keep the ↓ button if more remains
   * so the user can tap again (Telegram-style page-down through unread).
   */
  const afterStepScrollSettle = (delay = 420) => {
    setTimeout(() => {
      const root = listRef.current;
      if (!root) return;
      markVisibleMessagesRead();
      recountNewBelow();
      const distBottom = Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
      nearBottomRef.current = distBottom < NEAR_BOTTOM_PX;
      if (distBottom > 180 || pendingNewIdsRef.current.length > 0) {
        // Allow the control to stay usable for the next tap without requiring
        // a manual wheel/touch first.
        armScrollDownButton();
      } else {
        dismissScrollDownButton();
        pendingNewIdsRef.current = [];
        setNewBelowCount(0);
      }
    }, delay);
  };

  /**
   * First unseen message that is not yet fully in view (below or only partially
   * visible near the bottom edge). Prefers WS-tracked pendingNewIds, then falls
   * back to scanning DOM nodes that are not mine and not yet in seenQueuedRef.
   */
  const findNextUnreadBelow = () => {
    const root = listRef.current;
    if (!root) return null;
    const rootRect = root.getBoundingClientRect();
    const edge = rootRect.bottom - 56; // treat near-bottom partial as "still below"

    // 1) Pending new arrivals while scrolled up (chronological order)
    for (const id of pendingNewIdsRef.current) {
      const el = document.getElementById(`msg-${id}`);
      if (!el) return String(id); // not in DOM yet — load-older path will try
      const r = el.getBoundingClientRect();
      // Still below, or only partially visible near the bottom edge
      if (r.top > edge || r.bottom > rootRect.bottom - 8) {
        return String(id);
      }
    }

    // 2) Any other unread (not mine, not yet queued as seen) below the viewport
    const nodes = root.querySelectorAll("[data-msg-id]");
    for (const node of nodes) {
      const id = node.getAttribute("data-msg-id");
      if (!id) continue;
      if (node.getAttribute("data-msg-mine") === "1") continue;
      if (seenQueuedRef.current.has(String(id))) continue;
      const r = node.getBoundingClientRect();
      if (r.top > edge || r.bottom > rootRect.bottom - 8) {
        return String(id);
      }
    }
    return null;
  };

  const scrollToNextNew = () => {
    // Soft-suppress only during the smooth scroll; afterStepScrollSettle will
    // re-arm the button if there is still content below.
    scrollDownDismissedRef.current = true;
    userScrollIntentRef.current = false;
    if (scrollDownFadeTimerRef.current) {
      clearTimeout(scrollDownFadeTimerRef.current);
      scrollDownFadeTimerRef.current = null;
    }

    const root = listRef.current;
    const targetId = findNextUnreadBelow();

    if (targetId) {
      const el = document.getElementById(`msg-${targetId}`);
      if (el) {
        // First unseen → center of the viewport so the user can read it
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setJumpHighlightId(targetId);
        setTimeout(() => setJumpHighlightId((cur) => (cur === targetId ? null : cur)), 1600);
        afterStepScrollSettle(450);
        return;
      }
      // Not mounted yet — try loading older pages (rare for "below", but safe)
      (async () => {
        for (let i = 0; i < 15; i++) {
          if (!hasMoreMsgsRef.current) break;
          await loadOlder();
          await new Promise((r) => setTimeout(r, 50));
          const node = document.getElementById(`msg-${targetId}`);
          if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "center" });
            setJumpHighlightId(targetId);
            setTimeout(() => setJumpHighlightId((cur) => (cur === targetId ? null : cur)), 1600);
            afterStepScrollSettle(450);
            return;
          }
        }
        // Fallback: one viewport step
        if (root) {
          const step = Math.max(120, Math.floor(root.clientHeight * 0.85));
          root.scrollBy({ top: step, behavior: "smooth" });
          afterStepScrollSettle(450);
        }
      })();
      return;
    }

    // No specific unread target: step down by ~one viewport (not jump to end)
    if (root) {
      const distBottom = Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
      if (distBottom <= 180) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        pendingNewIdsRef.current = [];
        setNewBelowCount(0);
        afterStepScrollSettle(400);
        return;
      }
      const step = Math.max(120, Math.floor(root.clientHeight * 0.85));
      root.scrollBy({ top: Math.min(step, distBottom), behavior: "smooth" });
      afterStepScrollSettle(450);
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    afterStepScrollSettle(400);
  };

  /** Message id currently near the upper-third of the viewport (stable restore key). */
  const findAnchorMessageId = (root) => {
    if (!root) return null;
    try {
      const nodes = root.querySelectorAll("[id^='msg-']");
      if (!nodes.length) return null;
      const rootRect = root.getBoundingClientRect();
      const targetY = rootRect.top + Math.min(root.clientHeight * 0.28, 160);
      let bestId = null;
      let bestDist = Infinity;
      const len = nodes.length;
      for (let i = 0; i < len; i += 1) {
        const el = nodes[i];
        const r = el.getBoundingClientRect();
        // Nodes are in document order (top → bottom). Stop once past viewport.
        if (r.top > rootRect.bottom + 20) break;
        if (r.bottom < rootRect.top - 20) continue;
        const dist = Math.abs(r.top - targetY);
        if (dist < bestDist) {
          bestDist = dist;
          const id = el.id.startsWith("msg-") ? el.id.slice(4) : null;
          if (id && !String(id).startsWith("temp-")) bestId = id;
        }
      }
      return bestId;
    } catch {
      return null;
    }
  };

  /** Write current (or forced-bottom) viewport into memory + sessionStorage. */
  const persistViewportSnapshot = (forceBottom = false) => {
    const cid = activeIdRef.current;
    if (!cid) return;
    const key = String(cid);
    const root = listRef.current;
    let distBottom = 0;
    let scrollTop = 0;
    let anchorMsgId = null;
    if (forceBottom) {
      distBottom = 0;
      nearBottomRef.current = true;
      if (root) scrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
      // Live edge — no mid-history anchor
      anchorMsgId = null;
    } else if (root) {
      distBottom = Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
      scrollTop = Math.max(0, root.scrollTop);
      nearBottomRef.current = distBottom < NEAR_BOTTOM_PX;
      if (!nearBottomRef.current) anchorMsgId = findAnchorMessageId(root);
    } else {
      return;
    }
    const atBottom = forceBottom || distBottom < NEAR_BOTTOM_PX;
    const snapshot = {
      scrollTop: atBottom
        ? Math.max(0, (root?.scrollHeight || 0) - (root?.clientHeight || 0))
        : scrollTop,
      distanceBottom: atBottom ? 0 : distBottom,
      nearBottom: atBottom,
      anchorMsgId: atBottom ? null : (anchorMsgId || null),
      savedAt: Date.now(),
    };
    const prev = messagesCacheRef.current.get(key) || {};
    messagesCacheRef.current.set(key, { ...prev, ...snapshot });
    try { writeMessengerMsgCache(messagesCacheRef.current); } catch { /* */ }
    scrollAnchorRef.current = { convId: key, ...snapshot };
    try {
      sessionStorage.setItem("messenger.scrollAnchor." + key, JSON.stringify(snapshot));
    } catch { /* */ }
  };

  const measureDistBottom = () => {
    const root = listRef.current;
    if (!root) return 0;
    return Math.max(0, root.scrollHeight - root.scrollTop - root.clientHeight);
  };

  const isNearBottomNow = () => {
    // During restore window, trust the anchor — don't auto-stick to bottom
    if (Date.now() < scrollRestoreUntilRef.current) return false;
    if (restoringScrollRef.current) return false;
    if (nearBottomRef.current) return true;
    return measureDistBottom() <= NEAR_BOTTOM_PX;
  };

  const clearStickTimers = () => {
    const arr = stickTimersRef.current || [];
    for (const t of arr) {
      try { clearTimeout(t); } catch { /* */ }
    }
    stickTimersRef.current = [];
    stickGenRef.current += 1;
  };

  /**
   * Pin to latest content only when the user is following the chat.
   * Cancellable — chat switch / restore must not be overwritten by late timers.
   */
  const stickToBottom = useCallback((opts = {}) => {
    if (restoringScrollRef.current) return;
    if (Date.now() < scrollRestoreUntilRef.current) return;
    if (!nearBottomRef.current && measureDistBottom() > NEAR_BOTTOM_PX) return;

    const smooth = opts.smooth !== false;
    const passes = Number.isFinite(opts.passes) ? opts.passes : 3;
    const gen = ++stickGenRef.current;
    // Drop previous pending sticks
    for (const t of stickTimersRef.current || []) {
      try { clearTimeout(t); } catch { /* */ }
    }
    stickTimersRef.current = [];

    const run = () => {
      if (gen !== stickGenRef.current) return;
      if (restoringScrollRef.current) return;
      if (Date.now() < scrollRestoreUntilRef.current) return;
      const root = listRef.current;
      if (root) {
        const top = root.scrollHeight;
        if (smooth) {
          try {
            root.scrollTo({ top, behavior: "smooth" });
          } catch {
            root.scrollTop = top;
          }
        } else {
          root.scrollTop = top;
        }
      }
      try {
        bottomRef.current?.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
      } catch {
        try { bottomRef.current?.scrollIntoView?.(); } catch { /* */ }
      }
    };
    run();
    requestAnimationFrame(() => {
      if (gen !== stickGenRef.current) return;
      run();
      for (let i = 1; i <= passes; i += 1) {
        const id = setTimeout(run, 40 + i * 60);
        stickTimersRef.current.push(id);
      }
      // After layout settles, persist "at bottom" so reload does not jump mid-history
      const idPersist = setTimeout(() => {
        if (gen !== stickGenRef.current) return;
        persistViewportSnapshot(true);
      }, 120);
      stickTimersRef.current.push(idPersist);
    });
    nearBottomRef.current = true;
    persistViewportSnapshot(true);
  }, []);

  const scrollToBottom = () => {
    /**
     * Jump to live edge — smart, not destructive:
     *
     * A) Continuous history already in memory (user scrolled up via loadOlder
     *    from the live edge; hasMoreNewer=false): KEEP all messages, only scroll.
     *    Wiping them would be wasteful and jarring.
     *
     * B) Real gap (opened mid-history / around_id window; hasMoreNewer=true):
     *    REPLACE with the latest server page in one request. Do not page through
     *    the unloaded gap with loadNewer.
     */
    scrollRestoreUntilRef.current = 0;
    nearBottomRef.current = true;
    pendingNewIdsRef.current = [];
    setNewBelowCount(0);
    dismissScrollDownButton();
    const cid = activeIdRef.current;

    const pinHard = (smooth = false) => {
      const root = listRef.current;
      if (root) {
        const top = root.scrollHeight;
        if (smooth) {
          try { root.scrollTo({ top, behavior: "smooth" }); }
          catch { root.scrollTop = top; }
        } else {
          root.scrollTop = top;
        }
      }
      try {
        bottomRef.current?.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
      } catch {
        try { bottomRef.current?.scrollIntoView?.(); } catch { /* */ }
      }
      nearBottomRef.current = true;
      persistViewportSnapshot(true);
    };

    // ONLY a gap of unloaded newer messages justifies dropping the window.
    // Distance-from-bottom alone must NOT clear history the user already paid for.
    const hasUnloadedGap = hasMoreNewerRef.current === true;

    if (!cid) {
      pinHard(true);
      setTimeout(() => markVisibleMessagesRead(), 400);
      return;
    }

    if (hasUnloadedGap) {
      hasMoreNewerRef.current = false;
      setHasMoreNewer(false);
      loadingMoreRef.current = false;
      Promise.resolve(loadMessages(cid, { silent: true, preserveOlder: false, replace: true }))
        .then(() => {
          try {
            prevMsgLenRef.current = (messagesRef.current || []).length;
          } catch { /* */ }
          pinHard(false);
          requestAnimationFrame(() => pinHard(false));
          setTimeout(() => pinHard(false), 40);
          setTimeout(() => pinHard(true), 100);
        })
        .catch(() => { pinHard(true); });
    } else {
      // Full continuous thread in memory — preserve it, just go to the end
      pinHard(true);
      Promise.resolve(loadMessages(cid, { silent: true, preserveOlder: true }))
        .then(() => {
          pinHard(true);
          setTimeout(() => pinHard(false), 60);
        })
        .catch(() => {});
    }
    setTimeout(() => markVisibleMessagesRead(), 400);
  };

  /**
   * After opening mid-history (or landing near the top of the loaded window),
   * keep pulling older pages until there is comfortable padding above the
   * viewport — or the server says there is nothing older.
   */
  const fillOlderNearTop = useCallback(async (opts = {}) => {
    const maxPages = Number.isFinite(opts.maxPages) ? opts.maxPages : 10;
    const padPx = Number.isFinite(opts.padPx) ? opts.padPx : null;
    for (let i = 0; i < maxPages; i += 1) {
      if (String(activeIdRef.current) !== String(opts.convId || activeIdRef.current)) return;
      if (loadingMoreRef.current) {
        await new Promise((r) => setTimeout(r, 80));
        continue;
      }
      const box = listRef.current;
      if (!box) return;
      const h = box.clientHeight || 1;
      const need = padPx != null ? padPx : Math.max(900, h * 1.8);
      // Stop when we have enough content above the viewport, or server exhausted
      if (box.scrollTop > need) return;
      if (!hasMoreMsgsRef.current && i > 0) return;
      const beforeLen = (messagesRef.current || []).length;
      await loadOlder();
      await new Promise((r) => setTimeout(r, 40));
      const afterLen = (messagesRef.current || []).length;
      if (afterLen <= beforeLen) return; // nothing new prepended
    }
  }, [loadOlder]);

  // Flush viewport + draft before tab close / reload so state survives refresh
  useEffect(() => {
    const flush = () => {
      try { persistViewportSnapshot(!!nearBottomRef.current); } catch { /* */ }
      const cid = activeIdRef.current;
      if (cid != null && !editingMsgRef.current) {
        try {
          // Best-effort: localStorage always; WS if still open
          writeComposerDraft(cid, textRef.current);
          if (wsRef.current && wsRef.current.readyState === 1) {
            wsRef.current.send(JSON.stringify(draftPayload(cid, textRef.current)));
          }
        } catch { /* */ }
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // After inbound messages land (WS → loadMessages), stick to bottom if the user
  // was already following the chat. Fixes race where scroll ran before paint.
  const prevMsgLenRef = useRef(0);
  const prevTypingCountRef = useRef(0);
  useEffect(() => {
    // Chat switch: reset counters and cancel delayed stick-to-bottom
    prevMsgLenRef.current = 0;
    prevTypingCountRef.current = 0;
    try {
      for (const t of stickTimersRef.current || []) clearTimeout(t);
      stickTimersRef.current = [];
      stickGenRef.current += 1;
    } catch { /* */ }
  }, [activeId]);

  useEffect(() => {
    const len = messages.length;
    const prev = prevMsgLenRef.current;
    prevMsgLenRef.current = len;
    if (!activeId || len <= prev) return;
    // Initial hydrate for this chat (prev === 0) → openChat owns scroll restore
    if (prev === 0) return;
    if (!isNearBottomNow()) return;
    stickToBottom({ smooth: true, passes: 5 });
    setTimeout(() => {
      try { markVisibleMessagesRead(); } catch { /* */ }
    }, 380);
  }, [messages, activeId, stickToBottom]);

  // Typing indicator adds height below the last message — keep it in view.
  useEffect(() => {
    const n = Object.keys(typingUsers || {}).length;
    const prev = prevTypingCountRef.current;
    prevTypingCountRef.current = n;
    if (!activeId) return;
    if (n <= prev) return; // only when someone starts typing / more typers
    if (!isNearBottomNow()) return;
    stickToBottom({ smooth: true, passes: 5 });
  }, [typingUsers, activeId, stickToBottom]);

  const rearmScrollDownByUser = () => {
    // Only a real user gesture clears the programmatic-dismiss flag.
    userScrollIntentRef.current = true;
    scrollDownDismissedRef.current = false;
  };

  const onScrollMsgs = (e) => {
    const el = e.target;
    const h = el.clientHeight || 0;
    const distBottom = Math.max(0, el.scrollHeight - el.scrollTop - h);
    nearBottomRef.current = distBottom < NEAR_BOTTOM_PX;

    // Lightweight velocity tracking (cheap, every event)
    const now = performance.now();
    const sv = scrollVelRef.current;
    const dt = Math.max(1, now - (sv.lastTs || now));
    const dy = el.scrollTop - (sv.lastTop || el.scrollTop);
    const inst = dy / dt;
    sv.velocity = sv.lastTs ? (sv.velocity * 0.65 + inst * 0.35) : inst;
    sv.lastTop = el.scrollTop;
    sv.lastTs = now;

    // Jump-to-bottom FAB — keep responsive (cheap setState only when needed)
    const awayFromBottom = distBottom > Math.max(NEAR_BOTTOM_PX, 160);
    const hasNewBelow = (pendingNewIdsRef.current?.length || 0) > 0 || newBelowCount > 0;

    if (!awayFromBottom) {
      scrollDownDismissedRef.current = false;
      userScrollIntentRef.current = false;
      if (scrollDownFadeTimerRef.current) {
        clearTimeout(scrollDownFadeTimerRef.current);
        scrollDownFadeTimerRef.current = null;
      }
      setScrollDownOpacity(0);
      setShowScrollDown(false);
      pendingNewIdsRef.current = [];
      setNewBelowCount(0);
    } else if (scrollDownDismissedRef.current && !userScrollIntentRef.current) {
      setShowScrollDown(false);
      setScrollDownOpacity(0);
    } else {
      armScrollDownButton();
      if (hasNewBelow) recountNewBelow();
    }

    // Prefetch (cheap checks)
    const plan = getScrollPrefetchPlan(el, {
      isMobile,
      hasMoreNewer: hasMoreNewerRef.current,
      loading: loadingMoreRef.current,
    });
    if (plan.loadOlder) loadOlder();
    if (plan.loadNewer) loadNewer();

    // ===== HEAVY WORK (DOM queries, sessionStorage, mark-read) — throttled via rAF + time =====
    // Running querySelectorAll + getBoundingClientRect on every scroll event freezes the UI
    // when the chat has many messages. Coalesce to one job per frame and further rate-limit
    // the most expensive pieces.
    if (scrollWorkRafRef.current != null) return;
    scrollWorkRafRef.current = requestAnimationFrame(() => {
      scrollWorkRafRef.current = null;
      const cid = activeIdRef.current;
      if (!cid || restoringScrollRef.current) return;

      const box = listRef.current;
      if (!box) return;
      const bh = box.clientHeight || 0;
      const dBottom = Math.max(0, box.scrollHeight - box.scrollTop - bh);

      // End restore-hold only on intentional user delta
      if (Date.now() < scrollRestoreUntilRef.current) {
        const anchor = scrollAnchorRef.current;
        const expected = anchor && Number.isFinite(anchor.distanceBottom)
          ? anchor.distanceBottom
          : null;
        if (expected == null || Math.abs(dBottom - expected) > 40) {
          scrollRestoreUntilRef.current = 0;
        }
      }

      const key = String(cid);
      const atBottom = dBottom < NEAR_BOTTOM_PX;
      const ts = Date.now();
      // Persist viewport at most ~4×/sec and skip expensive anchor scan when near bottom
      if (ts - lastScrollPersistTsRef.current > 250) {
        lastScrollPersistTsRef.current = ts;
        const snapshot = {
          scrollTop: Math.max(0, box.scrollTop),
          distanceBottom: atBottom ? 0 : dBottom,
          nearBottom: atBottom,
          anchorMsgId: atBottom ? null : findAnchorMessageId(box),
          savedAt: ts,
        };
        const prev = messagesCacheRef.current.get(key) || {};
        messagesCacheRef.current.set(key, { ...prev, ...snapshot });
        scrollAnchorRef.current = { convId: key, ...snapshot };
        scrollPositionKnownRef.current.add(key);
        try {
          sessionStorage.setItem(
            "messenger.scrollAnchor." + key,
            JSON.stringify(snapshot)
          );
        } catch { /* */ }
      }

      // Mark visible as read at most ~3×/sec
      if (ts - lastMarkReadTsRef.current > 320) {
        lastMarkReadTsRef.current = ts;
        try { markVisibleMessagesRead(); } catch { /* */ }
      }
    });
  };

  // Pin viewport after prepending older messages (separate from chat-switch restore).
  useLayoutEffect(() => {
    const snap = olderScrollPinRef.current;
    if (!snap?.el) return;
    olderScrollPinRef.current = null;
    const { el, prevH, prevTop } = snap;
    const apply = () => {
      const diff = el.scrollHeight - prevH;
      if (diff > 0) el.scrollTop = prevTop + diff;
    };
    apply();
    requestAnimationFrame(apply);
  }, [messages]);

  const messagesWithDays = useMemo(() => {
    const out = [];
    let lastDay = "";
    for (const m of messages) {
      const day = formatDay(m.created_at);
      if (day !== lastDay) {
        out.push({ type: "day", id: `day-${day}-${m.id}`, label: day });
        lastDay = day;
      }
      out.push({ ...normalizeMessage(m), type: "msg" });
    }
    return out;
  }, [messages]);

  const openCtx = (e, message) => {
    e.preventDefault?.();
    e.stopPropagation?.();

    if (!message?.id || message?.type === "day") return;

    // A context menu belongs to the message that was actually right-clicked.
    setCtx({
      x: Number.isFinite(e?.clientX) ? e.clientX : window.innerWidth / 2,
      y: Number.isFinite(e?.clientY) ? e.clientY : window.innerHeight / 2,
      message,
    });
  };

  const selectionAnchorRef = useRef(null); // message id where selection drag started
  const selectingRef = useRef(false);

  const toggleSelectMessage = (message, forceEnter = false, event = null) => {
    if (!message?.id || message?.type === "day") return;

    const id = String(message.id);

    if (forceEnter) {
      // Long-press: select only the pressed message, exactly as Telegram does.
      setSelectionMode(true);
      selectingRef.current = false;
      selectionAnchorRef.current = id;
      selectionDragStartRef.current = null;
      setSelectedIds(new Set([id]));
      return;
    }

    // Shift-click selects a contiguous range from the current anchor.
    if (event?.shiftKey && selectionAnchorRef.current) {
      selectRangeByIds(selectionAnchorRef.current, id);
      return;
    }

    // Ctrl/Cmd-click toggles one message; ordinary click in selection mode does
    // the same. This keeps the selection predictable on desktop and touch.
    if (!selectionMode) setSelectionMode(true);

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      if (next.size === 0) {
        setSelectionMode(false);
        selectionAnchorRef.current = null;
      }
      return next;
    });

    selectionAnchorRef.current = id;
  };

  const selectRangeByIds = (fromId, toId) => {
    const ids = messages.filter((m) => m?.id).map((m) => String(m.id));
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
    selectionAnchorRef.current = null;
    selectingRef.current = false;
    selectionDragStartRef.current = null;
  };

  // Telegram-style Escape: leave message-selection mode first; otherwise
  // close the message context menu.
  useEffect(() => {
    const onSelectionKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (selectionMode) {
        e.preventDefault();
        clearSelection();
        return;
      }

      if (ctx) {
        e.preventDefault();
        setCtx(null);
      }
    };

    window.addEventListener("keydown", onSelectionKeyDown);
    return () => window.removeEventListener("keydown", onSelectionKeyDown);
  }, [selectionMode, ctx]);

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
      // Always refresh pinned bar — any deleted message may have been pinned
      if (activeIdRef.current) loadPinnedMessages(activeIdRef.current);
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

  // The call modal is rendered INLINE inside the chat pane (under the chat
  // header, above the audio player) so it never escapes the viewport on
  // window resize. We build it as a stable element here so the chat pane
  // can drop it into the right slot.
  // Resolve the conversation the active call belongs to — never the currently
  // open chat if the user navigated away mid-call.
  const callConversationId = callConfig?.conversation_id || null;
  const callConv = useMemo(() => {
    if (!callConversationId) return null;
    if (String(activeId) === String(callConversationId)) {
      return activeDetail || activeConv || null;
    }
    return conversations.find((c) => String(c.id) === String(callConversationId)) || null;
  }, [callConversationId, activeId, activeDetail, activeConv, conversations]);

  const callMemberDirectory = useMemo(() => {
    const conv = callConv || (String(activeId) === String(callConversationId) ? (activeDetail || activeConv) : null);
    const parts = conv?.participants || [];
    const out = [];
    for (const p of parts) {
      const u = p.user || p;
      if (!u) continue;
      out.push({
        id: u.id,
        username: u.username,
        display_name: u.display_name || u.username,
        avatar: withTokenQuery(u.avatar || u.avatar_url) || null,
      });
    }
    if (meId) {
      out.push({
        id: meId,
        username: profileData?.username || "You",
        display_name: profileData?.username || "You",
        avatar: meAvatar || withTokenQuery(profileData?.avatar) || null,
      });
    }
    return out;
  }, [callConv, callConversationId, activeId, activeDetail, activeConv, meId, meAvatar, profileData]);

  const callIsGroup = Boolean(
    callConfig?.is_group
    || callConv?.type === "group"
  );

  // In-call chat must show the call's conversation messages, not whatever
  // chat the user currently has open in the main pane.
  const callChatMessages = useMemo(() => {
    if (!callConversationId) return [];
    if (String(activeId) === String(callConversationId)) return messages || [];
    const cached = messagesCacheRef.current.get(String(callConversationId));
    return cached?.messages || [];
  }, [callConversationId, activeId, messages]);

  const sendCallChat = useCallback(async (body) => {
    const cid = callConfig?.conversation_id || activeId;
    if (!cid || !body?.trim()) return;
    try {
      const form = new FormData();
      form.append("body", body.trim());
      const res = await apiRequest({
        method: "POST",
        url: `${MSG_API}/conversations/${cid}/messages/`,
        data: form,
      });
      const created = unwrapData(res);
      if (created) {
        const merge = (prev) => {
          const map = new Map();
          for (const m of prev || []) {
            if (m?.id != null) map.set(String(m.id), m);
          }
          map.set(String(created.id), created);
          return Array.from(map.values()).sort((a, b) => {
            const ta = new Date(a.created_at || 0).getTime();
            const tb = new Date(b.created_at || 0).getTime();
            return ta - tb;
          });
        };
        // Always keep cache for the call conversation in sync
        const key = String(cid);
        const cached = messagesCacheRef.current.get(key);
        if (cached) {
          messagesCacheRef.current.set(key, { ...cached, messages: merge(cached.messages) });
        } else {
          messagesCacheRef.current.set(key, { messages: merge([]), hasMore: true });
        }
        // Only mutate the visible messages list when that chat is open
        if (String(activeIdRef.current) === String(cid)) {
          setMessages((prev) => merge(prev));
        }
      }
    } catch {
      flash("Could not send message");
    }
  }, [callConfig, activeId, flash]);

  const callModalElement = callConfig ? (
    <JitsiCallModal
      callConfig={callConfig}
      title={callConfig.peer_title || convTitle(callConv, meId) || "Call"}
      peerAvatar={callConfig.peer_avatar || withTokenQuery(convAvatar(callConv, meId))}
      isGroup={callIsGroup}
      memberDirectory={callMemberDirectory}
      messages={callChatMessages}
      meId={meId}
      onSendChat={sendCallChat}
      onLoadOlder={String(activeId) === String(callConversationId) ? loadOlder : undefined}
      loadingMore={String(activeId) === String(callConversationId) ? loadingMore : false}
      hasMoreMessages={String(activeId) === String(callConversationId) ? hasMoreMsgs : false}
      onModeChange={setCallMode}
      onClose={async () => {
        const cid = callConfig?.conversation_id || activeId;
        const callId = callConfig?.call_id;
        setCallConfig(null);
        setCallMode("inline");
        if (cid) {
          try {
            await apiRequest({
              method: "POST",
              url: `${MSG_API}/conversations/${cid}/call/end/`,
              data: { call_id: callId, reason: "ended" },
            });
          } catch { /* */ }
        }
      }}
    />
  ) : null;
  const callIsMini = Boolean(callConfig && callMode === "mini");
  const callIsExpanded = Boolean(callConfig && callMode !== "mini");

  const chatPane = (
    <Box
      sx={{
        flex: 1, height: "100%",
        display: "flex", flexDirection: "column",
        bgcolor: "background.default",
        minWidth: 0, width: "100%",
        position: "relative",
      }}
      onContextMenu={(e) => { if (e.target === e.currentTarget) e.preventDefault(); }}
      onDragEnter={onChatDragEnter}
      onDragOver={onChatDragOver}
      onDragLeave={onChatDragLeave}
      onDrop={onDropFilesToChat}
    >
      {chatOpening && isMobile && !messages.length && (
        <Box sx={{
          position: "absolute", inset: 0, zIndex: 55, display: "flex", alignItems: "center", justifyContent: "center",
          bgcolor: "background.default",
          backdropFilter: "blur(8px)",
          animation: "chatLoadingFade 160ms ease-out",
          '@keyframes chatLoadingFade': { from: { opacity: 0 }, to: { opacity: 1 } },
        }}>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.2 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: "50%", border: "3px solid", borderColor: "divider", borderTopColor: "primary.main", animation: "chatSpin .75s linear infinite", '@keyframes chatSpin': { to: { transform: "rotate(360deg)" } } }} />
            <Typography variant="caption" color="text.secondary">Opening chat…</Typography>
          </Box>
        </Box>
      )}
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
          <Stack
            direction="row"
            alignItems="center"
            spacing={msgSearchOpen ? (isMobile ? 0 : 0.5) : 1}
            sx={{
              px: msgSearchOpen && isMobile ? 0.35 : 1,
              py: 0.85,
              bgcolor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
              minHeight: 56,
              position: "relative",
              zIndex: 11,
            }}
          >
            {isMobile && !msgSearchOpen && <IconButton onClick={closeChat}><ArrowBackIcon /></IconButton>}
            {isMobile && msgSearchOpen && (
              <IconButton onClick={closeMsgSearch} size="small" sx={{ p: 0.4, flexShrink: 0 }} title="Close search">
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            {!isMobile && (
              <IconButton
                onClick={() => setDrawerOpen((v) => !v)}
                size="small"
                title={drawerOpen ? "Hide chat list" : "Show chat list"}
              >
                {drawerOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
              </IconButton>
            )}
            {msgSearchOpen && !isMobile ? (
              <>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  placeholder="Search messages…"
                  value={msgSearchQ}
                  onChange={(e) => setMsgSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); closeMsgSearch(); }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!msgSearchResults.length || msgSearchLastQRef.current !== msgSearchQ.trim()) {
                        runMessageSearch(msgSearchQ);
                      } else {
                        goMsgSearchResult(1);
                      }
                    }
                    if (e.key === "Enter" && e.shiftKey) {
                      e.preventDefault();
                      goMsgSearchResult(-1);
                    }
                    if (e.key === "F3") {
                      e.preventDefault();
                      goMsgSearchResult(e.shiftKey ? -1 : 1);
                    }
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "action.hover",
                      minHeight: { xs: 40, sm: 36 },
                      fontSize: { xs: 16, sm: 14 },
                    },
                    "& .MuiOutlinedInput-input": {
                      py: { xs: 1, sm: 0.75 },
                      px: { xs: 1, sm: 1.5 },
                    },
                  }}
                />
                <IconButton
                  color="primary"
                  size="small"
                  title="Search"
                  disabled={msgSearchLoading || !msgSearchQ.trim()}
                  onClick={() => {
                    if (msgSearchLastQRef.current === msgSearchQ.trim() && msgSearchResults.length) {
                      focusCurrentSearchResult();
                    } else {
                      runMessageSearch(msgSearchQ);
                    }
                  }}
                  sx={{ p: 1, flexShrink: 0 }}
                >
                  {msgSearchLoading ? <CircularProgress size={18} /> : <SearchIcon />}
                </IconButton>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  onClick={focusCurrentSearchResult}
                  sx={{
                    minWidth: 48,
                    textAlign: "center",
                    px: 0.25,
                    flexShrink: 0,
                    cursor: msgSearchResults.length ? "pointer" : "default",
                    userSelect: "none",
                  }}
                  title="Go to current result"
                >
                  {msgSearchLoading
                    ? "…"
                    : msgSearchResults.length
                      ? `${msgSearchIdx + 1}/${msgSearchResults.length}`
                      : (msgSearchLastQRef.current ? "0/0" : "")}
                </Typography>
                <IconButton
                  size="small"
                  disabled={!msgSearchResults.length}
                  onClick={() => goMsgSearchResult(-1)}
                  title="Previous result"
                  sx={{ p: 1, flexShrink: 0 }}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={!msgSearchResults.length}
                  onClick={() => goMsgSearchResult(1)}
                  title="Next result"
                  sx={{ p: 1, flexShrink: 0 }}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={closeMsgSearch} size="small" title="Close search">
                  <CloseIcon />
                </IconButton>
              </>
            ) : !msgSearchOpen ? (
              <>
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
              <Typography
                variant="caption"
                color={Object.keys(typingUsers).length ? "primary.main" : "text.secondary"}
                noWrap
                sx={{ fontStyle: Object.keys(typingUsers).length ? "italic" : "normal", maxWidth: 280 }}
              >
                {Object.keys(typingUsers).length
                  ? formatTypingLabel(typingUsers, activeConv?.type === "group")
                  : activeConv?.type === "group"
                    ? `${(activeConv?.participants || []).length} members`
                    : peer?.id && onlineUsers.has(Number(peer.id))
                      ? "online"
                      : "tap for info"}
              </Typography>
            </Box>
            {/* Mobile: keep a single call icon → popup with voice/video; rest in ⋮ menu */}
            {isMobile ? (
              <Tooltip title="Call">
                <IconButton
                  onClick={() => setCallChoiceOpen(true)}
                  sx={{
                    color: "text.secondary",
                    "&:hover": { bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" },
                  }}
                >
                  <CallIcon />
                </IconButton>
              </Tooltip>
            ) : (
              <>
                <Tooltip title="Voice call">
                  <IconButton
                    onClick={() => startCall({ video: false, audio: true })}
                    sx={{
                      color: "text.secondary",
                      "&:hover": { bgcolor: (t) => alpha(t.palette.success.main, 0.12), color: "success.main" },
                    }}
                  >
                    <CallIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Video call">
                  <IconButton
                    onClick={() => startCall({ video: true, audio: true })}
                    sx={{
                      color: "text.secondary",
                      "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: "primary.main" },
                    }}
                  >
                    <VideocamIcon />
                  </IconButton>
                </Tooltip>
                <IconButton onClick={() => pushPanel("info")}>
                  <InfoOutlinedIcon />
                </IconButton>
                <IconButton size="small" title="Search messages" onClick={() => openMsgSearch()}>
                  <SearchIcon fontSize="small" />
                </IconButton>
              </>
            )}
            <IconButton onClick={(e) => setHeaderMenu(e.currentTarget)}><MoreVertIcon /></IconButton>
            <Menu anchorEl={headerMenu} open={Boolean(headerMenu)} onClose={() => setHeaderMenu(null)}>
              {isMobile && (
                <MenuItem onClick={() => { openMsgSearch(); setHeaderMenu(null); }}>
                  <ListItemIcon><SearchIcon fontSize="small" /></ListItemIcon> Search messages
                </MenuItem>
              )}
              {isMobile && (
                <MenuItem onClick={() => {
                  pushPanel("info");
                  setHeaderMenu(null);
                }}>
                  <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon>
                  Chat info
                </MenuItem>
              )}
              {!isMobile && peer && (
                <MenuItem onClick={() => { loadUserProfile(peer.id); setHeaderMenu(null); }}>
                  <ListItemIcon><InfoOutlinedIcon fontSize="small" /></ListItemIcon> View profile
                </MenuItem>
              )}
              {peer && !peer.is_contact && !peer.is_blocked && (
                <MenuItem onClick={() => { addContact(peer.id); setHeaderMenu(null); }}>
                  <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon> Add contact
                </MenuItem>
              )}
              <MenuItem onClick={() => { setConfirmCleanup({ conv: activeConv }); setHeaderMenu(null); }}>
                <ListItemIcon><CleaningServicesIcon fontSize="small" /></ListItemIcon> Clear messages
              </MenuItem>
              {peer && !peer.is_blocked && (
                <MenuItem onClick={() => { setConfirmBlock({ user: peer }); setHeaderMenu(null); }}>
                  <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Block
                </MenuItem>
              )}
              {peer && peer.is_blocked && (
                <MenuItem onClick={() => { unblockUser(peer.id); setHeaderMenu(null); }}>
                  <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon> Unblock
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
              {activeConv?.type === "group" && (
                <MenuItem onClick={() => { setConfirmLeave({ conv: activeConv }); setHeaderMenu(null); }}>
                  <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon> Leave
                </MenuItem>
              )}
            </Menu>
              </>
            ) : (
              /* Mobile search mode: minimal header — search UI is at the bottom */
              <>
                <Typography fontWeight={600} noWrap fontSize={15} sx={{ flex: 1 }}>
                  Search messages
                </Typography>
                <IconButton onClick={closeMsgSearch} size="small" title="Close search">
                  <CloseIcon />
                </IconButton>
              </>
            )}

          </Stack>

          {/* Call surface is mounted at Messenger shell level (below) so the
              mini bar sits under the settings / list header, not floating over it. */}

          {/* Mini-player sits UNDER the user header (avatar + username) */}
          <AudioPlayerBar
            player={audioPlayer}
            onChange={setAudioPlayer}
            onStateChange={onAudioStateChange}
            onGoToTrack={goToAudioTrack}
          />

          {videoNotePip?.src && String(videoNotePip.conversationId) === String(activeId) && (
            <Box
              sx={{
                position: "absolute",
                top: 64,
                right: 12,
                zIndex: 30,
                width: 120,
                height: 120,
                borderRadius: "50%",
                overflow: "hidden",
                bgcolor: "#000",
                boxShadow: 6,
                border: "2px solid",
                borderColor: "background.paper",
                pointerEvents: "auto",
              }}
            >
              <video
                key={videoNotePip.key}
                src={videoNotePip.src}
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && videoNotePip.currentTime != null) {
                    try {
                      if (Math.abs((el.currentTime || 0) - videoNotePip.currentTime) > 0.35) {
                        el.currentTime = videoNotePip.currentTime;
                      }
                    } catch { /* */ }
                  }
                }}
                onEnded={() => setVideoNotePip(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  const v = e.currentTarget;
                  if (v.paused) v.play().catch(() => {});
                  else v.pause();
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                  borderRadius: "50%",
                }}
              />
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setVideoNotePip(null); }}
                sx={{
                  position: "absolute", top: 2, right: 2,
                  bgcolor: "rgba(0,0,0,0.55)", color: "#fff",
                  width: 24, height: 24,
                  "&:hover": { bgcolor: "rgba(0,0,0,0.75)" },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}

          {/* Telegram-style message selection toolbar */}
          {selectionMode && (
            <Box
              sx={{
                bgcolor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                px: { xs: 0.75, sm: 1 },
                py: 0.5,
                minHeight: 48,
                display: "flex",
                alignItems: "center",
                gap: 0.25,
                zIndex: 5,
              }}
            >
              <IconButton
                size="small"
                onClick={clearSelection}
                aria-label="Close selection"
                title="Cancel selection"
              >
                <CloseIcon fontSize="small" />
              </IconButton>

              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ flex: 1, minWidth: 60, px: 0.5 }}
              >
                {selectedIds.size} selected
              </Typography>

              {selectedIds.size === 1 && (
                <Button
                  size="small"
                  onClick={() => {
                    const id = Array.from(selectedIds)[0];
                    const m = messages.find((x) => String(x.id) === String(id));
                    if (m) {
                      setReplyTo(m);
                      setEditingMsg(null);
                    }
                    clearSelection();
                    inputRef.current?.focus();
                  }}
                >
                  Reply
                </Button>
              )}

              <Button
                size="small"
                onClick={bulkForwardSelected}
                disabled={!selectedIds.size}
              >
                Forward
              </Button>

              <Button
                size="small"
                color="error"
                onClick={bulkDeleteSelected}
                disabled={!selectedIds.size}
              >
                Delete
              </Button>
            </Box>
          )}

          {/* Pinned message bar — floating island below header + audio + selection bar */}
          <PinnedMessageBar
            pinnedMessages={pinnedMessages}
            currentIndex={currentPinIndex}
            onCycleUp={cyclePinnedUp}
            onCycleDown={cyclePinnedDown}
            onJumpToMessage={onJumpToMessage}
            headerHeight={56}
          />

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
            && dismissedGroupDesc.get(String(activeConv.id)) !== String(activeConv.description || "")
            && (
            <GroupDescriptionBanner
              description={activeConv.description}
              onDismiss={() => {
                persistGroupDescDismiss(activeConv.id, activeConv.description);
                setDismissedGroupDesc((m) => {
                  const next = new Map(m);
                  next.set(String(activeConv.id), String(activeConv.description || ""));
                  return next;
                });
              }}
            />
          )}

            {activeCallInfo && !callConfig && (
              <Paper
                elevation={0}
                sx={{
                  mx: 1.5, mt: 1, mb: 0.5, px: 1.5, py: 1, borderRadius: 1,
                  display: "flex", alignItems: "center", gap: 1.5,
                  bgcolor: (theme) => theme.palette.mode === "dark" ? "rgba(25,118,210,0.15)" : "rgba(25,118,210,0.08)",
                  border: "1px solid", borderColor: "primary.main",
                }}
              >
                <CallIcon color="primary" fontSize="small" />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {activeCallInfo.status === "ringing" ? "Incoming call" : "Call in progress"}
                    {activeCallInfo.is_video ? " · video" : " · voice"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {activeCallInfo.initiator?.username || "Tap join to enter"}
                  </Typography>
                </Box>
                <IconButton
                  color="success"
                  size="small"
                  sx={{ bgcolor: "success.main", color: "#fff", "&:hover": { bgcolor: "success.dark" } }}
                  onClick={async () => {
                    const cid = activeId;
                    const callId = activeCallInfo.call_id;
                    try {
                      const res = await apiRequest({
                        method: "GET",
                        url: `${MSG_API}/conversations/${cid}/call/join/` + (callId ? `?call_id=${encodeURIComponent(callId)}` : ""),
                      });
                      const cfg = unwrapData(res);
                      if (cfg?.room) {
                        setIncomingCall(null);
                        setCallConfig({
                          ...cfg,
                          is_initiator: false,
                          is_group: activeConv?.type === "group",
                          conversation_id: cid,
                          peer_title: activeCallInfo.initiator?.username || convTitle(activeConv, meId) || "Call",
                          peer_avatar: null,
                        });
                        setActiveCallInfo(null);
                      }
                    } catch (e) {
                      flash(e?.response?.data?.message || "Could not join call");
                    }
                  }}
                >
                  <CallIcon fontSize="small" />
                </IconButton>
              </Paper>
            )}
          <Box
            ref={listRef} className={MSG_SCROLL_CLASS} onScroll={onScrollMsgs}
            onMouseMove={(e) => {
              if (isMobile) return;
              updateScrollbarGutterVisibility(listRef.current, e.clientX, true);
            }}
            onMouseLeave={() => {
              if (isMobile) return;
              updateScrollbarGutterVisibility(listRef.current, null, false);
            }}
            sx={{
              position: "relative",
              flex: 1, overflow: "auto", px: { xs: 0.75, sm: 1.5 }, pt: 1.5, pb: 1,
              // Soften visual jank when older messages prepend
              scrollBehavior: "auto",
              "& > *": { transition: "opacity 0.2s ease" },
              touchAction: selectionMode ? "none" : "pan-y",
              userSelect: selectionMode ? "none" : "auto",
              // Expanded call takes the stage; mini bar keeps messages visible
              // (Telegram / WhatsApp style). Messages stay mounted so scroll
              // position is preserved across minimise/expand.
              // MUST be column — default flex row lays messages left-to-right.
              display: callIsExpanded ? "none" : "flex",
              flexDirection: "column",
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
            onWheel={rearmScrollDownByUser}
            onTouchMove={rearmScrollDownByUser}
            onPointerDown={(e) => {
              rearmScrollDownByUser();
              onMessagesListPointerDown(e);
            }}
            onPointerMove={(e) => {
              // Pointer movement can be the scrollbar drag on desktop or a
              // touch/drag gesture on mobile. Treat it as user intent.
              if (e.buttons || e.pointerType === "touch" || e.pointerType === "pen") {
                rearmScrollDownByUser();
              }
              onMessagesListPointerMove(e);
            }}
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
            {messagesWithDays.map((m, msgIdx) => {
              const isMsg = m.type === "msg";
              const isDay = m.type === "day";
              const msgHl = isMsg && jumpHighlightId != null && String(jumpHighlightId) === String(m.id);
              const dayHl = isDay && jumpHighlightDayId != null && (
                String(jumpHighlightDayId) === String(m.id)
                || String(jumpHighlightDayId) === String(m.label)
              );
              const { isFirstInSenderGroup, isLastInSenderGroup } = getSenderGroupFlags(messagesWithDays, msgIdx);
              return (
              <Box
                key={m.id}
                id={isMsg ? `msg-${m.id}` : isDay ? m.id : undefined}
                data-day-id={isDay ? m.id : undefined}
                data-day-label={isDay ? m.label : undefined}
                sx={
                  msgHl
                    ? {
                        animation: "msgFlash 2.2s ease-out",
                        borderRadius: 2,
                        "@keyframes msgFlash": {
                          "0%": {
                            backgroundColor: "rgba(255, 193, 7, 0.55)",
                            boxShadow: "0 0 0 3px rgba(255, 193, 7, 0.65)",
                          },
                          "35%": {
                            backgroundColor: "rgba(255, 193, 7, 0.35)",
                            boxShadow: "0 0 0 2px rgba(255, 193, 7, 0.4)",
                          },
                          "100%": {
                            backgroundColor: "transparent",
                            boxShadow: "none",
                          },
                        },
                      }
                    : undefined
                }
              >
                <MessageBubble
                  isFirstInSenderGroup={isFirstInSenderGroup}
                  isLastInSenderGroup={isLastInSenderGroup}
                  showOwnAvatar={appearance?.showOwnAvatar !== false}
                  showOthersAvatar={appearance?.showOthersAvatar !== false}
                  bubbleStyle={appearance?.bubbleStyle || "modern"}
                  remoteEmojiPlay={
                    remoteEmojiPlay && String(remoteEmojiPlay.messageId) === String(m.id)
                      ? remoteEmojiPlay.key
                      : 0
                  }
                  onEmojiPlay={(msg) => {
                    const cid = activeIdRef.current;
                    if (!cid || !wsRef.current || wsRef.current.readyState !== 1 || !msg?.id) return;
                    try {
                      wsRef.current.send(JSON.stringify({
                        type: "emoji_play",
                        conversation_id: Number(cid),
                        message_id: Number(msg.id),
                      }));
                    } catch { /* */ }
                  }}
                  onDayClick={() => setDayJumpOpen(true)}
                  onCancelSchedule={async (msg) => {
                    if (!msg?.id) return;
                    try {
                      await apiRequest({ method: "POST", url: `${MSG_API}/messages/${msg.id}/cancel-schedule/` });
                      setMessages((prev) => prev.filter((m) => String(m.id) !== String(msg.id)));
                      flash("Scheduled message cancelled");
                    } catch (e) {
                      setError(e?.response?.data?.message || "Cancel failed");
                    }
                  }}
                  m={isDay ? { ...m, _dayHighlight: dayHl } : m}
                  meId={meId} activeConv={activeConv}
                  onContextOpen={openCtx}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(String(m.id))}
                  isUnread={
                    (String(m.sender?.id) !== String(meId) || m.is_system)
                    && !seenMsgIds.has(String(m.id))
                  }
                  isPinnedMessage={isMessagePinned(m.id)}
                  onToggleSelect={toggleSelectMessage}
                  onReact={react}
                  onReactAnchor={(e, message) => setReactAnchor({ anchorPosition: { top: e.clientY, left: e.clientX }, message })}
                  onReply={(message) => { setReplyTo(message); setEditingMsg(null); inputRef.current?.focus(); }}
                  onEdit={startEdit}
                  onDelete={deleteMsg}
                  onForward={(message) => setForwardOpen(message)}
                  onOpenPreview={openPreview}
                  onEditCode={(fence) => {
                    forceComposerText((prev) => {
                      const p = (prev || "").trim();
                      return p ? `${p}\n\n${fence}` : fence;
                    });
                    setTimeout(() => inputRef.current?.focus?.(), 50);
                  }}
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
            );})}

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
            {/* iMessage-style typing bubble */}
            {Object.keys(typingUsers).length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "flex-end",
                  mb: 0.7,
                  px: 0.5,
                  py: 0.1,
                }}
              >
                <Box sx={{ width: 28, mr: 0.75, flexShrink: 0 }} />
                <Box
                  sx={{
                    px: 1.5,
                    py: 1.1,
                    borderRadius: "14px 14px 14px 4px",
                    bgcolor: (t) => t.palette.mode === "dark" ? "background.paper" : "background.paper",
                    boxShadow: (t) => t.palette.mode === "dark" ? "none" : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.45,
                    minWidth: 52,
                    minHeight: 28,
                  }}
                >
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        bgcolor: "text.secondary",
                        animation: "typingDotPulse 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.2}s`,
                        "@keyframes typingDotPulse": {
                          "0%, 60%, 100%": { opacity: 0.35, transform: "translateY(0)" },
                          "30%": { opacity: 1, transform: "translateY(-2px)" },
                        },
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            <div ref={bottomRef} />

          </Box>

          {/* Channel mode: if only_admins_send is on and the current user is not
              an admin, show a notice instead of the composer.
              When a call is active (inline), the composer is hidden because
              the call surface takes over the chat pane. When the call is
              minimised to the thin bar, the composer stays available. */}
          {callIsExpanded ? null : (
            isMobile && msgSearchOpen ? (
              /* Mobile: search bar replaces the composer at the bottom */
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{
                  px: 1,
                  py: 0.85,
                  bgcolor: "background.paper",
                  borderTop: "1px solid",
                  borderColor: "divider",
                  minHeight: 56,
                }}
              >
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  placeholder="Search messages…"
                  value={msgSearchQ}
                  onChange={(e) => setMsgSearchQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") { e.preventDefault(); closeMsgSearch(); }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!msgSearchResults.length || msgSearchLastQRef.current !== msgSearchQ.trim()) {
                        runMessageSearch(msgSearchQ);
                      } else {
                        goMsgSearchResult(1);
                      }
                    }
                    if (e.key === "Enter" && e.shiftKey) {
                      e.preventDefault();
                      goMsgSearchResult(-1);
                    }
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "action.hover",
                      minHeight: 40,
                      fontSize: 16,
                    },
                    "& .MuiOutlinedInput-input": { py: 1, px: 1 },
                  }}
                />
                <IconButton
                  color="primary"
                  size="small"
                  title="Search"
                  disabled={msgSearchLoading || !msgSearchQ.trim()}
                  onClick={() => {
                    if (msgSearchLastQRef.current === msgSearchQ.trim() && msgSearchResults.length) {
                      focusCurrentSearchResult();
                    } else {
                      runMessageSearch(msgSearchQ);
                    }
                  }}
                  sx={{ p: 0.45, flexShrink: 0 }}
                >
                  {msgSearchLoading ? <CircularProgress size={18} /> : <SearchIcon fontSize="small" />}
                </IconButton>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  onClick={focusCurrentSearchResult}
                  sx={{
                    minWidth: 28,
                    textAlign: "center",
                    flexShrink: 0,
                    cursor: msgSearchResults.length ? "pointer" : "default",
                    userSelect: "none",
                    fontSize: 11,
                  }}
                  title="Go to current result"
                >
                  {msgSearchLoading
                    ? "…"
                    : msgSearchResults.length
                      ? `${msgSearchIdx + 1}/${msgSearchResults.length}`
                      : (msgSearchLastQRef.current ? "0/0" : "")}
                </Typography>
                <IconButton
                  size="small"
                  disabled={!msgSearchResults.length}
                  onClick={() => goMsgSearchResult(-1)}
                  title="Previous result"
                  sx={{ p: 0.35, flexShrink: 0 }}
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={!msgSearchResults.length}
                  onClick={() => goMsgSearchResult(1)}
                  title="Next result"
                  sx={{ p: 0.35, flexShrink: 0 }}
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : activeConv?.type === "group"
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
              text={composerExternalText} textVersion={composerTextVersion} setText={handleComposerText}
              files={files} setFiles={(v) => {
                const next = typeof v === "function" ? v(files) : v;
                setFiles(next);
              }}
              sendFilesTogether={sendFilesTogether}
              mediaSpoiler={mediaSpoiler}
              setMediaSpoiler={setMediaSpoiler}
              mediaViewOnce={mediaViewOnce}
              setMediaViewOnce={setMediaViewOnce}
              setSendFilesTogether={setSendFilesTogether}
              replyTo={replyTo} editingMsg={editingMsg}
              onCancelReplyOrEdit={() => {
                setReplyTo(null);
                setEditingMsg(null);
                // Restore draft after canceling edit/reply
                forceComposerText(activeId ? readComposerDraft(activeId) : "");
              }}
              onSend={sendOrEdit}
              scheduledFor={scheduledFor}
              setScheduledFor={setScheduledFor}
              onPickImage={(f) => { attachMessengerOriginal(f, f); setCropInitialEdits(null); setCropFile(f); }}
              onPickVideo={(f) => { attachMessengerOriginal(f, f); setVideoInitialEdits(null); setVideoEditFile(f); }}
              inputRef={inputRef}
              onKeyDown={onComposerKeyDown}
              mentionUsers={mentionUsers}
              onEditAttachment={(file, index) => {
                if (file?.type?.startsWith("image/")) {
                  setCropEditIndex(index);
                  setCropInitialEdits(messengerImageEditsOf(file) || null);
                  setCropFile(messengerOriginalOf(file));
                } else if (file?.type?.startsWith("video/") || messengerVideoEditsOf(file)) {
                  setVideoEditIndex(index);
                  setVideoInitialEdits(messengerVideoEditsOf(file) || null);
                  setVideoEditFile(messengerOriginalOf(file));
                }
              }}
            />
          ))}

          {showScrollDown && (
            <Box
              onMouseEnter={() => {
                scrollDownHoverRef.current = true;
                clearScrollDownFadeTimers();
                setScrollDownOpacity(1);
              }}
              onMouseLeave={() => {
                scrollDownHoverRef.current = false;
                scheduleScrollDownFade();
              }}
              sx={{
                position: "absolute",
                right: { xs: 12, sm: 16 },
                bottom: { xs: 78, sm: 86 },
                zIndex: 12,
                pointerEvents: "auto",
                opacity: scrollDownOpacity,
                transition: "opacity 220ms ease",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignItems: "flex-end",
                visibility: showScrollDown ? "visible" : "hidden",
              }}
            >
              <Button
                variant="contained"
                size="small"
                onClick={newBelowCount > 0 ? scrollToNextNew : scrollToBottom}
                aria-label={newBelowCount > 0 ? `Go to new messages (${newBelowCount})` : "Scroll to bottom"}
                title={newBelowCount > 0 ? `${newBelowCount} new` : "Scroll to bottom"}
                sx={{
                  pointerEvents: showScrollDown ? "auto" : "none",
                  borderRadius: "50%",
                  minWidth: 48,
                  width: 48,
                  height: 48,
                  p: 0,
                  boxShadow: 6,
                  textTransform: "none",
                  fontWeight: 800,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <KeyboardArrowDownIcon sx={{ fontSize: 28 }} />
                {newBelowCount > 0 && (
                  <Box
                    component="span"
                    sx={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      minWidth: 20,
                      height: 20,
                      px: 0.5,
                      borderRadius: 10,
                      bgcolor: "error.main",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 800,
                      lineHeight: "20px",
                      textAlign: "center",
                      boxShadow: 2,
                    }}
                  >
                    {newBelowCount > 99 ? "99+" : newBelowCount}
                  </Box>
                )}
              </Button>
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
    <ThemeProvider theme={messengerTheme}>
    <Box
      sx={{
        position: "fixed",
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        // On mobile, bind to visualViewport so the header stays on screen when
        // the soft keyboard opens (instead of staying glued to the layout viewport).
        top: isMobileDevice ? kbLayout.top : 0,
        left: 0,
        right: 0,
        height: isMobileDevice ? kbLayout.height : "100%",
        bottom: isMobileDevice ? "auto" : 0,
        overflow: "hidden",
      }}
      onClick={() => { if (ctx) setCtx(null); }}
    >
      <style>{MSG_SCROLL_STYLE_TEXT}</style>

      {/* Ongoing-call mini strip — directly under the top of the messenger shell
          (settings header lives inside Sidebar below this when on the list;
          when in a chat the strip stays global so it does not cover chat menus).
          Full/expanded mode is position:fixed inside JitsiCallModal. */}
      {callConfig && (
        <Box
          sx={
            callIsMini
              ? {
                  flexShrink: 0,
                  width: "100%",
                  zIndex: 20,
                  order: -1,
                }
              : {
                  // full: modal is fixed overlay; keep a zero-size mount point
                  position: "fixed",
                  width: 0,
                  height: 0,
                  overflow: "visible",
                  zIndex: 1400,
                  pointerEvents: "none",
                  "& > *": { pointerEvents: "auto" },
                }
          }
        >
          {callModalElement}
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
      {/* Mobile sidebar — kept mounted so avatars are not re-fetched every
          time the user leaves a chat. Hidden with visibility when in a chat. */}
      {isMobile && (
        <Box sx={{
          width: "100%", height: "100%", position: "absolute", inset: 0, zIndex: 2,
          bgcolor: "background.paper",
          visibility: (!activeId || !mobileShowChat) ? "visible" : "hidden",
          pointerEvents: (!activeId || !mobileShowChat) ? "auto" : "none",
          opacity: (!activeId || !mobileShowChat) ? 1 : 0,
          transform: (!activeId || !mobileShowChat) ? "translateX(0)" : "translateX(-12px)",
          transition: "opacity 180ms ease, transform 220ms ease, visibility 0s linear 220ms",
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
        // When a call is active on mobile, keep the pane "visible" to the
        // compositor so the fixed call UI is never clipped/suppressed —
        // still cover with the sidebar layer when browsing the chat list.
        visibility: (isMobile && (!activeId || !mobileShowChat) && !callConfig) ? "hidden" : "visible",
        position: isMobile && (!activeId || !mobileShowChat) ? "absolute" : "relative",
        width: isMobile && (!activeId || !mobileShowChat) && !callConfig ? 0 : "auto",
        overflow: callConfig ? "visible" : "hidden",
        zIndex: callConfig && isMobile ? 3 : "auto",
        animation: activeId && mobileShowChat ? "messengerChatIn 220ms cubic-bezier(.2,.75,.25,1)" : "none",
        '@keyframes messengerChatIn': {
          from: { opacity: 0, transform: isMobile ? "translateX(16px)" : "translateY(5px)" },
          to: { opacity: 1, transform: "translate3d(0,0,0)" },
        },
      }}>
        {chatPane}
      </Box>

      {/* Mobile call surface portal:
          Chat pane uses visibility:hidden when the list is shown, which would
          hide position:fixed children in some cases / stacking contexts.
          Re-parenting is handled inside JitsiCallModal via position:fixed +
          high z-index; this spacer keeps the connection alive when the pane
          is hidden by still allowing the existing instance inside chatPane
          to paint (fixed escapes). No second instance. */}

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
            onOpenChatInfo={() => {
              // From peer profile → open this chat's info panel
              setPanelHistory(["info"]);
            }}
            onOpenContacts={() => { loadContacts(); pushPanel("contacts"); }}
            onOpenBlocks={() => { loadBlocks(); pushPanel("blocks"); }}
            onOpenMyRequests={() => { loadMyJoinRequests(); pushPanel("my-requests"); }}
            onOpenConvJoinRequests={() => { loadConvJoinRequests(activeConv?.id); pushPanel("conv-requests"); }}
            onOpenCreateGroup={() => setCreateGroupOpen(true)}
            onOpenJoin={() => setJoinOpen(true)}
            onNavigateHome={() => navigate("/")}
            onOpenMediaSettings={() => setMediaSettingsOpen(true)}
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
            appearance={appearance}
            onAppearanceChange={updateAppearance}
            colorThemeId={appearance?.colorTheme || "default"}
            onColorThemeChange={(id) => updateAppearance({ colorTheme: id })}
            onOpenAppearance={() => pushPanel("appearance")}
            onOpenSharedMedia={() => setMediaLibraryOpen(true)}
            conversationId={activeId}
            onMediaShowInChat={(att) => {
              closePanel();
              const mid = att?.message_id || att?.message?.id;
              if (mid) jumpToMessageInChat(mid);
            }}
            onMediaView={(att, ctx) => {
              if (!att) return;
              setGalleryState({
                startAttachment: att,
                initialItems: ctx?.items || null,
                kinds: ctx?.kinds || null,
                fromSharedMedia: true,
              });
            }}
            onMediaDownload={async (att) => {
              try {
                const url = withTokenQuery(att?.file_url || att?.url || att?.file || "");
                if (!url) return;
                const a = document.createElement("a");
                a.href = url;
                a.download = att?.original_filename || att?.name || "download";
                a.target = "_blank";
                a.rel = "noopener";
                document.body.appendChild(a);
                a.click();
                a.remove();
              } catch { /* */ }
            }}
            onMediaReply={(att) => {
              closePanel();
              const mid = att?.message_id || att?.message?.id;
              const msg = (messagesRef.current || messages || []).find((m) => String(m.id) === String(mid));
              if (msg) {
                setReplyTo(msg);
                setEditingMsg(null);
              } else if (mid) jumpToMessageInChat(mid);
            }}
            onMediaForward={(att) => {
              closePanel();
              const mid = att?.message_id || att?.message?.id;
              const msg = (messagesRef.current || messages || []).find((m) => String(m.id) === String(mid));
              if (msg) setForwardOpen(msg);
              else if (mid) jumpToMessageInChat(mid);
            }}
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
            onVoiceCall={(u) => startCallWithUser(u, { video: false })}
            onVideoCall={(u) => startCallWithUser(u, { video: true })}
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
          onSelect={(m) => {
            toggleSelectMessage(m, true);
            setCtx(null);
          }}
          onPinMessage={(m) => { pinMessage(m); setCtx(null); }}
          isPinned={ctxMsg ? isMessagePinned(ctxMsg.id) : false}
          onCopy={async (m) => { await copyText(typeof m?.body === "string" ? m.body : ""); flash("Copied"); setCtx(null); }}
          onPreview={(a) => { openPreview(a); setCtx(null); }}
          onDownload={(a) => { downloadAttachmentFile(a); setCtx(null); }}
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
        initialEdits={cropInitialEdits}
        onClose={() => { setCropFile(null); setCropEditIndex(null); setCropInitialEdits(null); }}
        onConfirm={(blob, filename, edits) => {
          // Preview shows crop+draw. Edits metadata kept so send can re-bake from original,
          // and reopening the editor restores crop rectangle + strokes.
          const preview = new File([blob], filename || "image.jpg", { type: blob.type || "image/jpeg" });
          attachMessengerOriginal(preview, messengerOriginalOf(cropFile) || cropFile);
          if (edits) {
            attachMessengerImageEdits(preview, { ...edits, pending: edits.pending !== false });
          }
          setFiles((prev) => {
            if (cropEditIndex != null && cropEditIndex >= 0 && cropEditIndex < prev.length) {
              const next = [...prev];
              next[cropEditIndex] = preview;
              return next;
            }
            return [...prev, preview];
          });
          setCropFile(null);
          setCropEditIndex(null);
          setCropInitialEdits(null);
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
        initialEdits={videoInitialEdits}
        onClose={() => { setVideoEditFile(null); setVideoEditIndex(null); setVideoInitialEdits(null); }}
        onConfirm={(carrierFile, filename, edits) => {
          // carrier is original bytes; edits applied on send via finalizeMessengerFiles
          const f = carrierFile instanceof File
            ? carrierFile
            : new File([carrierFile], filename || "video.mp4", { type: "video/mp4" });
          attachMessengerOriginal(f, messengerOriginalOf(videoEditFile) || videoEditFile);
          if (edits) attachMessengerVideoEdits(f, edits);
          setFiles((prev) => {
            if (videoEditIndex != null && videoEditIndex >= 0 && videoEditIndex < prev.length) {
              const next = [...prev];
              next[videoEditIndex] = f;
              return next;
            }
            return [...prev, f];
          });
          setVideoEditFile(null);
          setVideoEditIndex(null);
          setVideoInitialEdits(null);
        }}
        confirmLabel="Done"
      />

      {/* Read receipts ("Seen by") dialog */}
      <ReadReceiptsDialog
        message={readersMessage}
        onClose={() => setReadersMessage(null)}
      />

      {/* Jitsi call modal — now rendered INSIDE chatPane so it sits under
          the chat header (above the audio player). On mobile it occupies
          the settings pane area. The JitsiCallModal itself supports a
          "mini" floating mode if the user wants to keep chatting while in
          a call. */}

      {/* Incoming call banner + ringtone (max 30s) */}
      {incomingCall && !callConfig && (
        <IncomingCallBanner
          incomingCall={incomingCall}
          onAccept={async () => {
            const cid = incomingCall.conversation_id;
            const callId = incomingCall.call_id;
            setIncomingCall(null);
            try {
              const res = await apiRequest({
                method: "GET",
                url: `${MSG_API}/conversations/${cid}/call/join/` + (callId ? `?call_id=${encodeURIComponent(callId)}` : ""),
              });
              const cfg = unwrapData(res);
              if (cfg?.room) {
                if (incomingCall.media) {
                  cfg.config = {
                    ...(cfg.config || {}),
                    startWithVideoMuted: !incomingCall.media.video,
                    startWithAudioMuted: !incomingCall.media.audio,
                  };
                }
                const joinConv = conversations.find((c) => String(c.id) === String(cid));
                const isGroupCall = !!incomingCall.is_group || joinConv?.type === "group";
                const initiator = incomingCall.initiator || {};
                // Private call: show the other person's identity, not whichever chat is open
                const peerTitle = isGroupCall
                  ? (convTitle(joinConv, meId) || incomingCall.peer_title || "Group call")
                  : (initiator.username || initiator.display_name || incomingCall.peer_title || "Call");
                const peerAv = isGroupCall
                  ? withTokenQuery(convAvatar(joinConv, meId))
                  : withTokenQuery(initiator.avatar || initiator.avatar_url) || null;
                setCallConfig({
                  ...cfg,
                  is_initiator: false,
                  is_group: isGroupCall,
                  conversation_id: cid,
                  peer_title: peerTitle,
                  peer_avatar: peerAv,
                });
                // Always open the conversation the call belongs to
                if (String(activeId) !== String(cid)) {
                  if (joinConv) openChat(joinConv);
                  else {
                    // Cold join: still switch active id so chat pane matches the call
                    openChat({ id: cid, type: isGroupCall ? "group" : "private", peer: initiator });
                  }
                }
              }
            } catch (e) {
              flash(e?.response?.data?.message || "Could not join call");
            }
          }}
          onDecline={async () => {
            const cid = incomingCall.conversation_id;
            const callId = incomingCall.call_id;
            setIncomingCall(null);
            try {
              await apiRequest({
                method: "POST",
                url: `${MSG_API}/conversations/${cid}/call/end/`,
                data: { call_id: callId, reason: "declined" },
              });
            } catch { /* */ }
          }}
          onTimeout={async () => {
            const cid = incomingCall.conversation_id;
            const callId = incomingCall.call_id;
            setIncomingCall(null);
            try {
              await apiRequest({
                method: "POST",
                url: `${MSG_API}/conversations/${cid}/call/end/`,
                data: { call_id: callId, reason: "no_answer" },
              });
            } catch { /* */ }
          }}
        />
      )}

<ChatMediaLibraryDialog
        open={mediaLibraryOpen}
        onClose={() => setMediaLibraryOpen(false)}
        conversationId={activeId}
        onView={(att, ctx) => {
          // Keep Shared media open underneath; only open the viewer
          if (!att) return;
          setGalleryState({
            startAttachment: att,
            initialItems: ctx?.items || null,
            kinds: ctx?.kinds || null,
            fromSharedMedia: true,
          });
        }}
        onShowInChat={(att) => {
          setMediaLibraryOpen(false);
          closePanel();
          const mid = att?.message_id || att?.message?.id;
          if (mid) jumpToMessageInChat(mid);
        }}
        onDownload={async (att) => {
          try {
            const url = withTokenQuery(att?.file_url || att?.url || att?.file || "");
            if (!url) return;
            const a = document.createElement("a");
            a.href = url;
            a.download = att?.original_filename || att?.name || "download";
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
          } catch { /* */ }
        }}
        onReply={(att) => {
          setMediaLibraryOpen(false);
          const mid = att?.message_id || att?.message?.id;
          const msg = (messagesRef.current || messages || []).find((m) => String(m.id) === String(mid));
          if (msg) {
            setReplyTo(msg);
            setEditingMsg(null);
            setTimeout(() => inputRef.current?.focus?.(), 50);
          } else if (mid) {
            jumpToMessageInChat(mid);
          }
        }}
        onForward={(att) => {
          setMediaLibraryOpen(false);
          const mid = att?.message_id || att?.message?.id;
          const msg = (messagesRef.current || messages || []).find((m) => String(m.id) === String(mid));
          if (msg) setForwardOpen(msg);
          else if (mid) jumpToMessageInChat(mid);
        }}
      />

{/* In-chat media gallery dialog (image / video, with < > navigation) */}
      <MediaGalleryDialog
        open={Boolean(galleryState)}
        conversationId={activeId}
        startAttachment={galleryState?.startAttachment}
        initialItems={galleryState?.initialItems || null}
        kinds={galleryState?.kinds || null}
        onClose={() => {
          // Return to Shared media (do not close chat info)
          setGalleryState(null);
        }}
        onShowInChat={(att) => {
          const mid = att?.message_id || att?.message?.id || galleryState?.messageId;
          if (mid) jumpToMessageInChat(mid);
        }}
        onReply={(att) => {
          const mid = att?.message_id || att?.message?.id || galleryState?.messageId;
          const msg = messages.find((m) => String(m.id) === String(mid));
          if (msg) setReplyTo(msg);
          else if (mid) setReplyTo({ id: mid, body: att?.original_filename || "Media", sender: null });
        }}
      />

      {/* Text / file preview dialog (non-media) */}
      <Dialog open={Boolean(preview)} onClose={() => setPreview(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: "background.default" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography noWrap sx={{ flex: 1 }} fontWeight={600}>
            {preview?.att?.original_filename || "Preview"}
          </Typography>
          {(preview?.att?.url || preview?.blobUrl) && (
            <IconButton onClick={() => downloadAttachmentFile({
              ...preview.att,
              _blobUrl: preview.blobUrl,
              original_filename: preview.att?.original_filename,
            })}>
              <DownloadIcon />
            </IconButton>
          )}
          <IconButton onClick={() => setPreview(null)}><ArrowBackIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 240, display: "flex", justifyContent: "center", alignItems: "center" }}>
          {preview?.kind === "pdf" && (preview?.blobUrl || preview?.att?.url) && (
            <Box
              component="iframe"
              src={preview.blobUrl || withTokenQuery(preview.att.url)}
              title="pdf"
              sx={{ width: "100%", height: "70vh", border: 0, borderRadius: 1 }}
            />
          )}
          {preview?.error && (
            <Typography color="error.main" sx={{ p: 2 }}>{preview.error}</Typography>
          )}
          {preview?.kind === "text" && (
            <PreviewTextBody
              text={preview.textContent}
              filename={preview?.att?.original_filename || ""}
            />
          )}
          {preview?.kind === "file" && (
            <Stack alignItems="center" spacing={2}>
              <Typography>No inline preview for this file type.</Typography>
              <Button variant="contained" startIcon={<DownloadIcon />}
                onClick={() => downloadAttachmentFile({
                  ...preview.att,
                  _blobUrl: preview.blobUrl,
                })}>
                Download
              </Button>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      <MessengerDialogs
        meId={meId}
        conversations={conversations}
        contacts={contacts}
        activeConv={activeConv}
        forwardOpen={forwardOpen}
        setForwardOpen={setForwardOpen}
        forwardTo={forwardTo}
        createGroupOpen={createGroupOpen}
        setCreateGroupOpen={setCreateGroupOpen}
        groupTitle={groupTitle}
        setGroupTitle={setGroupTitle}
        groupPublic={groupPublic}
        setGroupPublic={setGroupPublic}
        createGroup={createGroup}
        joinOpen={joinOpen}
        setJoinOpen={setJoinOpen}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        joinByCode={joinByCode}
        joinConfirm={joinConfirm}
        setJoinConfirm={setJoinConfirm}
        onConfirmJoin={onConfirmJoin}
        addMemberOpen={addMemberOpen}
        setAddMemberOpen={setAddMemberOpen}
        addMemberSelected={addMemberSelected}
        setAddMemberSelected={setAddMemberSelected}
        addMembersToGroup={addMembersToGroup}
        callChoiceOpen={callChoiceOpen}
        setCallChoiceOpen={setCallChoiceOpen}
        startCall={startCall}
        confirmDelete={confirmDelete}
        setConfirmDelete={setConfirmDelete}
        deleteConversation={deleteConversation}
        confirmCleanup={confirmCleanup}
        setConfirmCleanup={setConfirmCleanup}
        cleanupConversation={cleanupConversation}
        confirmBlock={confirmBlock}
        setConfirmBlock={setConfirmBlock}
        blockUser={blockUser}
        confirmLeave={confirmLeave}
        setConfirmLeave={setConfirmLeave}
        leaveChat={leaveChat}
        mediaSettingsOpen={mediaSettingsOpen}
        setMediaSettingsOpen={setMediaSettingsOpen}
        toast={toast}
        error={error}
        setError={setError}
        exitHint={exitHint}
        hashReady={hashReady}
        showAuthPopup={showAuthPopup}
        setShowAuthPopup={setShowAuthPopup}
        navigate={navigate}
        dayJumpOpen={dayJumpOpen}
        setDayJumpOpen={setDayJumpOpen}
        messagesWithDays={messagesWithDays}
        messages={messages}
        jumpToDayInChat={jumpToDayInChat}
      />
    </Box>
    </ThemeProvider>
  );
}