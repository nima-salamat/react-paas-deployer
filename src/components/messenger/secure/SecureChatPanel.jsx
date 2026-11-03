import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Avatar, Badge, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, IconButton, LinearProgress, Menu, MenuItem, Paper, Popover, Slider, Stack, TextField,
  Tooltip, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import MicIcon from "@mui/icons-material/Mic";
import SendIcon from "@mui/icons-material/Send";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import StopIcon from "@mui/icons-material/Stop";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import ClearIcon from "@mui/icons-material/Clear";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import PauseRoundedIcon from "@mui/icons-material/PauseRounded";
import {
  assertSecureMessagingReady, getSecureMatrixClient, getSecureMatrixSession,
  hasSecureMatrixInitialSync, MatrixSecureError, resolveMatrixUsers,
  sendEncryptedMedia, decryptEncryptedMedia,
} from "./MatrixSecureClient";
import { formatDuration, withTokenQuery } from "../messengerUtils";
import MediaGalleryDialog from "../components/MediaGalleryDialog";
import VideoPlayer from "../components/VideoPlayer";

const AUTO_DECRYPT_MEDIA_MAX_BYTES = 12 * 1024 * 1024;

function getRoomReadReceiptEventId(room, userId) {
  const receipt = room?.getReadReceiptForUserId?.(userId);
  return receipt?.eventId || room?.getEventReadUpTo?.(userId) || null;
}

function findFirstUnreadEventId(room, ownUserId) {
  const events = room?.getLiveTimeline?.().getEvents?.() || [];
  if (!events.length) return null;
  const readUpToId = getRoomReadReceiptEventId(room, ownUserId);
  const readIndex = readUpToId ? events.findIndex((event) => event.getId?.() === readUpToId) : -1;
  const unreadEvents = events.slice(Math.max(0, readIndex + 1));
  const firstIncoming = unreadEvents.find((event) => (
    event.getSender?.() !== ownUserId
    && (event.getType?.() === "m.room.message" || event.getWireType?.() === "m.room.encrypted")
    && !relationForMatrixEvent(event).rel_type
    && Boolean(event.getId?.())
  ));
  return firstIncoming?.getId?.() || null;
}

function findUnreadEventIdByCount(room, ownUserId, unreadCount) {
  const events = room?.getLiveTimeline?.().getEvents?.() || [];
  const incoming = events.filter((event) => (
    event.getSender?.() !== ownUserId
    && isSecureTimelineMessage(event)
  ));
  const startIndex = Math.max(0, incoming.length - Math.max(0, Number(unreadCount) || 0));
  return incoming[startIndex]?.getId?.() || null;
}

const INITIAL_SECURE_MESSAGE_COUNT = 50;
const SECURE_HISTORY_PAGE_SIZE = 40;
const MAX_INITIAL_UNREAD_HISTORY_PAGES = 100;

function isSecureTimelineMessage(event) {
  const isMessage = event?.getType?.() === "m.room.message" || event?.getWireType?.() === "m.room.encrypted";
  return Boolean(isMessage && !relationForMatrixEvent(event).rel_type);
}

function countIncomingSecureMessages(events, ownUserId) {
  return events.filter((event) => isSecureTimelineMessage(event) && event.getSender?.() !== ownUserId).length;
}

async function prepareInitialSecureTimeline(client, room, ownUserId, unreadCount) {
  const receiptEventId = getRoomReadReceiptEventId(room, ownUserId);
  let exhausted = false;
  let pagesLoaded = 0;

  while (pagesLoaded < MAX_INITIAL_UNREAD_HISTORY_PAGES) {
    const events = room?.getLiveTimeline?.().getEvents?.() || [];
    const messageCount = events.filter(isSecureTimelineMessage).length;
    const unreadBoundaryAvailable = unreadCount <= 0
      ? true
      : receiptEventId
        ? events.some((event) => event.getId?.() === receiptEventId)
        : countIncomingSecureMessages(events, ownUserId) >= unreadCount;

    if (messageCount >= INITIAL_SECURE_MESSAGE_COUNT && unreadBoundaryAvailable) break;

    const beforeCount = events.length;
    try {
      await client.scrollback(room, SECURE_HISTORY_PAGE_SIZE);
    } catch {
      exhausted = true;
      break;
    }
    const afterCount = room?.getLiveTimeline?.().getEvents?.().length || 0;
    if (afterCount <= beforeCount) {
      exhausted = true;
      break;
    }
    pagesLoaded += 1;
  }

  const hasReadMarker = Boolean(
    receiptEventId
    && (room?.getLiveTimeline?.().getEvents?.() || []).some((event) => event.getId?.() === receiptEventId)
  );
  const unreadAnchorId = unreadCount <= 0
    ? null
    : hasReadMarker
      ? findFirstUnreadEventId(room, ownUserId)
      : findUnreadEventIdByCount(room, ownUserId, unreadCount);
  return {
    unreadAnchorId,
    hasMoreHistory: !exhausted,
    pagesLoaded,
  };
}

function getReadReceiptSummary(room, messageId, ownUserId) {
  const events = room?.getLiveTimeline?.().getEvents?.() || [];
  const messageIndex = events.findIndex((event) => event.getId?.() === messageId);
  if (messageIndex < 0) return { readCount: 0, total: 0 };
  const peers = (room?.getMembers?.() || []).filter((member) => (
    member?.membership === "join" && member?.userId && member.userId !== ownUserId
  ));
  const readCount = peers.filter((member) => {
    const readEventId = room.getEventReadUpTo?.(member.userId);
    if (!readEventId) return false;
    const readIndex = events.findIndex((event) => event.getId?.() === readEventId);
    return readIndex >= messageIndex;
  }).length;
  return { readCount, total: peers.length };
}

function appNameForParticipant(participant) {
  const user = participant?.user || participant || {};
  return String(user.display_name || user.full_name || user.name || user.username || "").trim();
}

function appConversationTitle(conversation, currentUserId) {
  const explicit = String(conversation?.title || "").trim();
  if (explicit) return explicit;
  const peer = (conversation?.participants || []).find((participant) => {
    const user = participant?.user || participant;
    return String(user?.id ?? participant?.user_id ?? "") !== String(currentUserId ?? "");
  });
  return appNameForParticipant(peer) || "Secure conversation";
}

function secureDateLabel(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function relationForMatrixEvent(event) {
  return event?.getRelation?.()
    || event?.getWireContent?.()?.["m.relates_to"]
    || event?.getContent?.()?.["m.relates_to"]
    || {};
}

function describeEvent(event, ownUserId, profilesByMatrixId = {}) {
  const type = event.getType();
  const unsigned = event.getUnsigned?.() || {};
  const isRedacted = Boolean(event.isRedacted?.() || unsigned.redacted_because);
  const wireType = event.getWireType?.() || type;
  const content = event.getContent?.() || {};
  const senderId = event.getSender?.() || "";
  const profile = profilesByMatrixId[senderId] || null;
  const sender = senderId === ownUserId ? "You" : (profile?.displayName || "Member");
  const timestamp = Number(event.getTs?.() || Date.now());
  const eventId = event.getId?.() || `${senderId}:${timestamp}`;

  if (isRedacted) {
    return {
      id: eventId, sender, senderId, senderAvatar: profile?.avatar || null,
      timestamp, isOwn: senderId === ownUserId,
      body: "This message was deleted.",
      redacted: true, msgtype: "m.text",
    };
  }

  if (type === "m.room.message" && wireType !== "m.room.encrypted") {
    // Fail closed: an encrypted-room label cannot make a plaintext event safe.
    return {
      id: eventId, sender, senderId, senderAvatar: profile?.avatar || null,
      timestamp, isOwn: senderId === ownUserId,
      body: "Unencrypted event rejected. Its content is hidden because it did not arrive through Matrix E2EE.",
      undecryptable: true, unencrypted: true,
    };
  }
  if (type === "m.room.encrypted") {
    return {
      id: eventId, sender, senderId, senderAvatar: profile?.avatar || null,
      timestamp, isOwn: senderId === ownUserId,
      body: "This message cannot be decrypted on this device. Open Secure chat settings to recover its keys.",
      undecryptable: true,
    };
  }
  if (type !== "m.room.message") return null;

  const msgtype = content.msgtype || "m.text";
  const media = ["m.image", "m.audio", "m.video", "m.file"].includes(msgtype)
    && Boolean(content.file && content.file.url?.startsWith("mxc://"));
  let body;
  if (msgtype === "m.text" || msgtype === "m.notice") {
    body = typeof content.body === "string" ? content.body : "";
  } else if (msgtype === "m.emote") {
    body = typeof content.body === "string" ? `• ${content.body}` : "Encrypted message";
  } else if (media) {
    body = typeof content.body === "string" ? content.body : "Encrypted attachment";
  } else if (["m.image", "m.audio", "m.video", "m.file"].includes(msgtype)) {
    body = "This attachment is not encrypted correctly and was not opened.";
  } else {
    body = "Encrypted message type not supported in this version.";
  }
  return {
    id: eventId, sender, senderId, senderAvatar: profile?.avatar || null,
    timestamp, isOwn: senderId === ownUserId,
    body: body || "Encrypted message",
    undecryptable: msgtype === "m.bad.encrypted",
    mediaType: media ? msgtype : null,
    file: media ? content.file : null,
    info: media ? content.info : null,
    filename: media ? (content.filename || content.body || "Encrypted attachment") : null,
    msgtype,
    edited: Boolean(event.replacingEvent?.() || event.replacingEventId?.() || event.getServerAggregatedRelation?.("m.replace")),
  };
}

function getRoomMessages(room, ownUserId, profilesByMatrixId = {}) {
  if (!room) return [];
  const events = room.getLiveTimeline?.().getEvents?.() || [];
  const seen = new Set();
  const rows = events
    .filter((event) => relationForMatrixEvent(event).rel_type !== "m.replace")
    .map((event) => describeEvent(event, ownUserId, profilesByMatrixId))
    .filter((row) => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  for (const event of events) {
    const content = event.getContent?.() || {};
    const relation = relationForMatrixEvent(event);
    if (event.getType?.() === "m.room.message" && relation.rel_type === "m.replace" && relation.event_id) {
      const target = rowsById.get(relation.event_id);
      const replacement = content["m.new_content"] || event.getClearContent?.()?.["m.new_content"] || {};
      if (
        target
        && !target.redacted
        && !target.mediaType
        && String(target.senderId || "") === String(event.getSender?.() || "")
        && typeof replacement.body === "string"
        && replacement.msgtype === "m.text"
      ) {
        target.body = replacement.body;
        target.edited = true;
      }
      continue;
    }
    if (event.getType?.() !== "m.reaction") continue;
    if (relation.rel_type !== "m.annotation" || !relation.event_id || !relation.key) continue;
    const target = rowsById.get(relation.event_id);
    if (!target || target.undecryptable || target.redacted) continue;
    if (!Array.isArray(target.reactions)) target.reactions = [];
    target.reactions.push({
      id: event.getId?.() || String(event.getTs?.() || Date.now()),
      key: String(relation.key),
      senderId: event.getSender?.() || "",
    });
  }
  return rows.sort((a, b) => a.timestamp - b.timestamp);
}

function getReadReceiptStatus(room, messageId, ownUserId) {
  const summary = getReadReceiptSummary(room, messageId, ownUserId);
  if (!summary.total || !summary.readCount) return "Sent";
  if (summary.readCount >= summary.total) return "Seen";
  return "Seen by " + summary.readCount + " of " + summary.total;
}

function getReactionGroups(reactions = [], ownUserId = "") {
  const grouped = new Map();
  for (const reaction of reactions) {
    const key = String(reaction?.key || "");
    if (!key) continue;
    const current = grouped.get(key) || { key, count: 0, own: false };
    current.count += 1;
    current.own = current.own || String(reaction.senderId || "") === String(ownUserId || "");
    grouped.set(key, current);
  }
  return [...grouped.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function roomHasPendingInvites(room) {
  try {
    const events = room?.currentState?.getStateEvents?.("m.room.member");
    // Fail closed when Matrix membership state cannot be read. The room must
    // not send its Megolm session only to this browser's device by mistake.
    if (!Array.isArray(events)) return true;
    return events.some((event) => event?.getContent?.()?.membership === "invite");
  } catch {
    return true;
  }
}

function waitForRoomMembership(client, roomId, expectedMembership, timeoutMs = 20000) {
  const readMembership = () => client.getRoom(roomId)?.getMyMembership?.();
  if (readMembership() === expectedMembership) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let finished = false;
    let timeout;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      client.off("RoomMember.membership", onMembership);
      if (error) reject(error);
      else resolve();
    };
    const onMembership = (_event, member) => {
      if (member?.roomId !== roomId) return;
      if (readMembership() === expectedMembership) finish();
    };

    client.on("RoomMember.membership", onMembership);
    timeout = setTimeout(() => finish(new MatrixSecureError(
      "Matrix accepted the join request but has not synchronized the joined room state yet. Secure messaging remains blocked; retry after synchronization.",
      "join_sync_timeout",
    )), timeoutMs);

    // Close the race where membership changed just before listener registration.
    if (readMembership() === expectedMembership) finish();
  });
}

function waitForSync(client) {
  if (hasSecureMatrixInitialSync(client)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      client.off("sync", onSync);
      if (error) reject(error);
      else resolve();
    };
    const onSync = (state) => {
      // SYNCING can be the first request still in flight. Wait for PREPARED so
      // the pending invitation and membership state has been hydrated.
      if (state === "PREPARED") finish();
      if (state === "ERROR" || state === "STOPPED") {
        finish(new MatrixSecureError("The Matrix device could not complete its initial synchronization.", "sync_failed"));
      }
    };
    const timeout = setTimeout(() => finish(
      new MatrixSecureError("Matrix initial synchronization timed out. Secure chat remains unavailable.", "sync_timeout"),
    ), 20000);
    client.on("sync", onSync);
    // Close the race where PREPARED arrives between the initial check and listener registration.
    if (hasSecureMatrixInitialSync(client)) finish();
  });
}


function SecureAudioPlayer({ src, filename, onDownload }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const updateTime = () => setCurrentTime(audio.currentTime || 0);
    const updateDuration = () => {
      const value = Number(audio.duration);
      setDuration(Number.isFinite(value) && value > 0 ? value : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => { setPlaying(false); setAudioError(true); };
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.load();
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || audioError) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setAudioError(true);
        setPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        width: "min(100%, 380px)",
        p: 1,
        borderRadius: 2.5,
        bgcolor: "rgba(0,0,0,0.035)",
        borderColor: "divider",
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton
          aria-label={playing ? "Pause encrypted audio" : "Play encrypted audio"}
          onClick={() => void togglePlayback()}
          disabled={audioError}
          sx={{
            width: 42,
            height: 42,
            flex: "0 0 42px",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            "&:hover": { bgcolor: "primary.dark" },
            "&.Mui-disabled": { bgcolor: "action.disabledBackground" },
          }}
        >
          {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={650} noWrap title={filename || "Audio message"}>
            {filename || "Audio message"}
          </Typography>
          {audioError ? (
            <Typography variant="caption" color="error.main">Audio could not be played</Typography>
          ) : (
            <Slider
              size="small"
              value={Math.min(currentTime, duration || 0)}
              min={0}
              max={duration || 1}
              onChange={(_, value) => {
                const next = Array.isArray(value) ? value[0] : value;
                setCurrentTime(next);
                if (audioRef.current && duration > 0) audioRef.current.currentTime = next;
              }}
              sx={{
                py: 0.15,
                my: -0.15,
                color: "primary.main",
                "& .MuiSlider-thumb": { width: 10, height: 10 },
                "& .MuiSlider-rail": { opacity: 0.22 },
              }}
              aria-label="Audio progress"
            />
          )}
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatDuration(currentTime)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
              {formatDuration(duration)}
            </Typography>
          </Stack>
        </Box>
        {onDownload && (
          <Tooltip title="Download decrypted audio">
            <IconButton size="small" aria-label="Download encrypted audio" onClick={onDownload}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}

export default function SecureChatPanel({
  conversation,
  currentUserId,
  onSecureClientReady,
  onRegisterReconnect,
  onSecureUnreadCountChange,
}) {
  const roomId = conversation?.matrix_room_id;
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState("");
  const [matrixClient, setMatrixClient] = useState(null);
  const profilesByMatrixIdRef = useRef({});
  const mediaObjectUrlsRef = useRef(new Set());
  const [loadedMedia, setLoadedMedia] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [mediaStatus, setMediaStatus] = useState({});
  const [pendingUpload, setPendingUpload] = useState(null);
  const mediaOperationsRef = useRef(new Set());
  const autoDecryptStartedRef = useRef(new Set());
  const mediaBusyRef = useRef(false);
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const draftInputRef = useRef(null);
  const readReceiptSentRef = useRef(new Set());
  const [receiptRevision, setReceiptRevision] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadCountRef = useRef(0);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const isNearBottomRef = useRef(true);
  const [timelineInitialised, setTimelineInitialised] = useState(false);
  const initialScrollHandledRef = useRef(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roomMenuAnchor, setRoomMenuAnchor] = useState(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState(null);
  const reactionOperationsRef = useRef(new Set());
  const [secureViewerAttachment, setSecureViewerAttachment] = useState(null);
  const secureViewerItems = useMemo(
    () => (secureViewerAttachment ? [secureViewerAttachment] : null),
    [secureViewerAttachment],
  );
  const [messageMenuAnchor, setMessageMenuAnchor] = useState(null);
  const [messageMenuTarget, setMessageMenuTarget] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const voiceRecordingCancelledRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const timelineRef = useRef(null);
  const inviteJoinInProgressRef = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    for (const url of mediaObjectUrlsRef.current) URL.revokeObjectURL(url);
    mediaObjectUrlsRef.current.clear();
    mediaOperationsRef.current.clear();
    autoDecryptStartedRef.current.clear();
    readReceiptSentRef.current.clear();
    reactionOperationsRef.current.clear();
    profilesByMatrixIdRef.current = {};
    setLoadedMedia({});
    setLoadingMedia({});
    setMediaStatus({});
    setPendingUpload(null);
    setMessages([]);
    setDraft("");
    setError("");
    setSearchOpen(false);
    setSearchQuery("");
    setRoomMenuAnchor(null);
    setReactionPickerMessageId(null);
    setReactionPickerAnchor(null);
    setSecureViewerAttachment(null);
    unreadCountRef.current = 0;
    setUnreadCount(0);
    setShowJumpToBottom(false);
    isNearBottomRef.current = true;
    setMessageMenuAnchor(null);
    setMessageMenuTarget(null);
    setEditingMessage(null);
    setEditDraft("");
    setDeletingMessage(null);
    setUnreadAnchorId(null);
    setTimelineInitialised(false);
    initialScrollHandledRef.current = false;
    setPhase("connecting");
  }, [roomId]);

  const refreshTimeline = useCallback((client) => {
    const room = client.getRoom(roomId);
    if (!room) return;
    setMessages(getRoomMessages(room, client.getUserId(), profilesByMatrixIdRef.current));
    const nextUnreadCount = Math.max(0, Number(room.getUnreadNotificationCount?.("total") || 0));
    unreadCountRef.current = nextUnreadCount;
    setUnreadCount(nextUnreadCount);
    onSecureUnreadCountChange?.(nextUnreadCount);
  }, [roomId, onSecureUnreadCountChange]);

  useEffect(() => {
    let cancelled = false;
    let activeClient = null;
    let roomListenersAttached = false;
    let waitingForInviteAcceptance = false;
    let inviteTransitionRevalidationRequested = false;
    const onTimeline = (event, room) => {
      if (!room || room.roomId !== roomId) return;
      refreshTimeline(activeClient);
    };
    const onDecrypted = () => refreshTimeline(activeClient);
    const onReceipt = (_event, room) => {
      if (room?.roomId !== roomId) return;
      setReceiptRevision((value) => value + 1);
      const nextUnreadCount = Math.max(0, Number(room.getUnreadNotificationCount?.("total") || 0));
      unreadCountRef.current = nextUnreadCount;
      setUnreadCount(nextUnreadCount);
      onSecureUnreadCountChange?.(nextUnreadCount);
    };
    const attachRoomListeners = () => {
      if (roomListenersAttached || !activeClient) return;
      activeClient.on("Room.timeline", onTimeline);
      activeClient.on("Event.decrypted", onDecrypted);
      activeClient.on("Room.receipt", onReceipt);
      roomListenersAttached = true;
    };
    const updateRoomMembershipState = () => {
      const room = activeClient?.getRoom(roomId);
      if (!room) return;
      const membership = room.getMyMembership?.();
      if (membership === "invite") {
        // Keep the accept action from reappearing while joinRoom() is still
        // synchronizing the newly joined room and its encryption state.
        if (!inviteJoinInProgressRef.current) setPhase("invited");
        return;
      }
      if (membership !== "join") return;
      if (waitingForInviteAcceptance) {
        // A locally initiated join must finish syncing before connect() checks
        // Rust crypto's room marker. For a join accepted in another Matrix
        // client, re-enter connect() and apply the same post-join validation.
        if (inviteJoinInProgressRef.current) return;
        if (!inviteTransitionRevalidationRequested) {
          inviteTransitionRevalidationRequested = true;
          setPhase("connecting");
          setRevision((value) => value + 1);
        }
        return;
      }
      attachRoomListeners();
      setPhase(roomHasPendingInvites(room) ? "waiting_for_peer" : "ready");
      refreshTimeline(activeClient);
    };
    const onSync = (state) => {
      if (state === "ERROR") {
        setError("Matrix synchronization failed. No messages are sent through the normal plaintext Messenger path.");
      }
      if (state === "SYNCING" || state === "PREPARED") updateRoomMembershipState();
    };
    const onMembership = (_event, member) => {
      if (member?.roomId !== roomId) return;
      updateRoomMembershipState();
    };

    async function connect() {
      setPhase("connecting");
      setTimelineInitialised(false);
      initialScrollHandledRef.current = false;
      setError("");
      if (!roomId) {
        setError("This encrypted conversation is missing its Matrix room binding.");
        setPhase("error");
        return;
      }
      try {
        const client = await getSecureMatrixClient();
        if (cancelled) return;
        activeClient = client;
        setMatrixClient(client);
        await waitForSync(client);
        try { Promise.resolve(onSecureClientReady?.()).catch(() => {}); } catch { /* non-blocking notification */ }

        const room = client.getRoom(roomId);
        if (!room) {
          throw new MatrixSecureError(
            "No Matrix room or pending invitation arrived for this secure conversation. Ask the sender to retry the invitation from Messenger.",
            "room_not_available",
          );
        }

        const membership = room.getMyMembership?.();
            setHasMoreHistory(true);

        const participants = conversation?.participants || [];
        const localUserIds = [...new Set([
          Number(currentUserId),
          ...participants.map((participant) => Number(participant?.user?.id ?? participant?.user_id ?? participant?.id)),
        ].filter((id) => Number.isInteger(id) && id > 0))];
        let roomReadyForTimeline = false;
        // Profile metadata is presentation-only. Never wait on the Django profile
        // API before showing the accept-invitation action or validating encryption.
        void resolveMatrixUsers(localUserIds, getSecureMatrixSession()).then((identities) => {
          if (cancelled) return;
          const mappedProfiles = {};
          for (const identity of identities) {
            const participant = participants.find((candidate) => String(candidate?.user?.id ?? candidate?.user_id ?? candidate?.id) === String(identity.user_id));
            const user = participant?.user || participant || {};
            if (identity?.matrix_user_id) {
              mappedProfiles[identity.matrix_user_id] = {
                displayName: appNameForParticipant(user) || "Member",
                avatar: withTokenQuery(user.avatar || user.avatar_url) || null,
                userId: identity.user_id,
              };
            }
          }
          profilesByMatrixIdRef.current = mappedProfiles;
          if (!cancelled && roomReadyForTimeline) refreshTimeline(client);
        }).catch(() => {
          if (cancelled) return;
          // Profile API failure must not block invite acceptance or secure chat.
          profilesByMatrixIdRef.current = {};
        });
        if (cancelled) return;

        if (membership === "invite") {
          // An invitee's Rust crypto store may not yet know the room is encrypted:
          // isEncryptionEnabledInRoom() can return false for a room it considers
          // unknown. The backend already verified this immutable room mapping.
          // Joining sends no chat content; encryption is rechecked after membership
          // becomes "join", and outgoing messages remain blocked until then.
          setMessages([]);
          setPhase("invited");
          waitingForInviteAcceptance = true;
          // If the invite is accepted from another trusted Matrix client, watch
          // membership changes and open the timeline without requiring reload.
          client.on("sync", onSync);
          client.on("RoomMember.membership", onMembership);
          return;
        }
        if (membership !== "join") {
          throw new MatrixSecureError(
            "This device is not a joined member of the encrypted room. It may have been removed or the invitation may have been declined.",
            "not_joined",
          );
        }

        // Only require Rust crypto's persistent encryption marker once this
        // device has joined. Never relax the check on the send path below.
        const isEncrypted = await client.getCrypto().isEncryptionEnabledInRoom(roomId);
        if (!isEncrypted) {
          throw new MatrixSecureError(
            "The mapped Matrix room is not confirmed as end-to-end encrypted. Sending is blocked.",
            "room_not_encrypted",
          );
        }

        if (cancelled) return;
        roomReadyForTimeline = true;
        const unreadCount = Number(room.getUnreadNotificationCount?.("total") || 0);
        const initialHistory = await prepareInitialSecureTimeline(client, room, client.getUserId(), unreadCount);
        if (cancelled) return;
        setMessages(getRoomMessages(room, client.getUserId(), profilesByMatrixIdRef.current));
        setUnreadAnchorId(initialHistory.unreadAnchorId);
        setHasMoreHistory(initialHistory.hasMoreHistory);
        unreadCountRef.current = unreadCount;
        setUnreadCount(unreadCount);
        setTimelineInitialised(true);
        onSecureUnreadCountChange?.(unreadCount);
        attachRoomListeners();
        client.on("sync", onSync);
        client.on("RoomMember.membership", onMembership);
        setPhase(roomHasPendingInvites(room) ? "waiting_for_peer" : "ready");
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Could not open this encrypted room.");
        setPhase("error");
      }
    }
    void connect();
    return () => {
      cancelled = true;
      if (activeClient) {
        activeClient.off("Room.timeline", onTimeline);
        activeClient.off("Event.decrypted", onDecrypted);
        activeClient.off("Room.receipt", onReceipt);
        activeClient.off("sync", onSync);
        activeClient.off("RoomMember.membership", onMembership);
      }
    };
  }, [roomId, currentUserId, revision, refreshTimeline, conversation?.title, conversation?.participants, onSecureClientReady, onSecureUnreadCountChange]);

  const reconnectSecureChat = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    onRegisterReconnect?.(reconnectSecureChat);
    return () => onRegisterReconnect?.(null);
  }, [onRegisterReconnect, reconnectSecureChat]);

  const markEventRead = useCallback(async (event) => {
    if (!matrixClient || !event || event.getSender?.() === matrixClient.getUserId()) return;
    const eventId = String(event.getId?.() || "");
    if (!eventId || readReceiptSentRef.current.has(eventId)) return;
    readReceiptSentRef.current.add(eventId);
    try {
      // Receipts are Matrix room metadata, not plaintext Messenger messages.
      await matrixClient.sendReadReceipt(event);
      setReceiptRevision((value) => value + 1);
      const timelineEvents = matrixClient.getRoom(roomId)?.getLiveTimeline?.().getEvents?.() || [];
      const readIndex = timelineEvents.findIndex((candidate) => candidate.getId?.() === eventId);
      setUnreadAnchorId((current) => {
        if (!current) return null;
        const anchorIndex = timelineEvents.findIndex((candidate) => candidate.getId?.() === current);
        return anchorIndex >= 0 && readIndex >= anchorIndex ? null : current;
      });
      const room = matrixClient.getRoom(roomId);
      const roomUnreadCount = Math.max(0, Number(room?.getUnreadNotificationCount?.("total") || 0));
      const nextUnreadCount = unreadCountRef.current > 0
        ? Math.min(roomUnreadCount, unreadCountRef.current - 1)
        : roomUnreadCount;
      unreadCountRef.current = nextUnreadCount;
      setUnreadCount(nextUnreadCount);
      onSecureUnreadCountChange?.(nextUnreadCount);
    } catch {
      // Keep the receipt retryable when the homeserver is temporarily unavailable.
      readReceiptSentRef.current.delete(eventId);
    }
  }, [matrixClient, roomId, onSecureUnreadCountChange]);

  useEffect(() => {
    const root = timelineRef.current;
    if (phase !== "ready" || !matrixClient || !root || typeof IntersectionObserver === "undefined") return undefined;
    const room = matrixClient.getRoom(roomId);
    if (!room) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (document.visibilityState !== "visible") return;
      const events = room.getLiveTimeline?.().getEvents?.() || [];
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) continue;
        const eventId = entry.target.getAttribute("data-secure-event-id");
        const isOwn = entry.target.getAttribute("data-secure-own") === "true";
        if (!eventId || isOwn) continue;
        const event = events.find((candidate) => candidate.getId?.() === eventId);
        if (event) void markEventRead(event);
      }
    }, { root, threshold: [0.6] });
    root.querySelectorAll("[data-secure-event-id]").forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [phase, matrixClient, roomId, messages, markEventRead, searchQuery]);

  useEffect(() => {
    const root = timelineRef.current;
    if (phase !== "ready" || !timelineInitialised || !messages.length || !root || initialScrollHandledRef.current) return;
    requestAnimationFrame(() => {
      if (initialScrollHandledRef.current || !timelineRef.current) return;
      if (unreadAnchorId) {
        const target = Array.from(timelineRef.current.querySelectorAll("[data-secure-event-id]"))
          .find((node) => node.getAttribute("data-secure-event-id") === unreadAnchorId);
        if (target) target.scrollIntoView({ block: "start", behavior: "auto" });
        else timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
      } else {
        timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
      }
      const distanceFromBottom = Math.max(
        0,
        timelineRef.current.scrollHeight - timelineRef.current.scrollTop - timelineRef.current.clientHeight,
      );
      isNearBottomRef.current = distanceFromBottom < 120;
      setShowJumpToBottom(distanceFromBottom >= 120);
      initialScrollHandledRef.current = true;
    });
  }, [phase, timelineInitialised, messages, unreadAnchorId]);

  useEffect(() => {
    if (!timelineInitialised || !initialScrollHandledRef.current || !isNearBottomRef.current) return;
    requestAnimationFrame(() => {
      const scroller = timelineRef.current;
      if (!scroller || !isNearBottomRef.current) return;
      scroller.scrollTop = scroller.scrollHeight;
      setShowJumpToBottom(false);
    });
  }, [messages, timelineInitialised]);

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return messages;
    return messages.filter((message) => [
      message.body, message.sender, message.filename,
    ].some((value) => String(value || "").toLocaleLowerCase().includes(query)));
  }, [messages, searchQuery]);

  const loadOlderHistory = useCallback(async () => {
    if (!matrixClient || !roomId || loadingOlder || !hasMoreHistory) return;
    const room = matrixClient.getRoom(roomId);
    if (!room) {
      setHasMoreHistory(false);
      return;
    }
    const scroller = timelineRef.current;
    const beforeHeight = scroller?.scrollHeight || 0;
    const beforeTop = scroller?.scrollTop || 0;
    const beforeCount = room.getLiveTimeline?.().getEvents?.().length || 0;
    setLoadingOlder(true);
    setError("");
    try {
      await matrixClient.scrollback(room, 40);
      const afterCount = room.getLiveTimeline?.().getEvents?.().length || 0;
      refreshTimeline(matrixClient);
      if (afterCount <= beforeCount) setHasMoreHistory(false);
      requestAnimationFrame(() => {
        if (scroller) {
          scroller.scrollTop = beforeTop + Math.max(0, scroller.scrollHeight - beforeHeight);
        }
      });
    } catch (err) {
      setError(err?.message || "Could not load older encrypted messages from Matrix.");
    } finally {
      setLoadingOlder(false);
    }
  }, [matrixClient, roomId, loadingOlder, hasMoreHistory, refreshTimeline]);

  const onTimelineScroll = (event) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const distanceFromBottom = Math.max(0, scrollHeight - scrollTop - clientHeight);
    const nearBottom = distanceFromBottom < 120;
    isNearBottomRef.current = nearBottom;
    setShowJumpToBottom(!nearBottom);
    if (scrollTop < 48 && hasMoreHistory && !loadingOlder) {
      void loadOlderHistory();
    }
  };

  const jumpToLatestMessage = () => {
    const scroller = timelineRef.current;
    if (!scroller) return;
    isNearBottomRef.current = true;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  };

  const acceptInvitation = async () => {
    if (!matrixClient || !roomId || phase !== "invited" || inviteJoinInProgressRef.current) return;
    inviteJoinInProgressRef.current = true;
    setPhase("connecting");
    setError("");
    try {
      await matrixClient.joinRoom(roomId);
      // joinRoom() can return a local Room before the next /sync has updated
      // membership and encryption state. Wait for the local joined state before
      // rerunning connect() and checking Rust crypto.
      await waitForRoomMembership(matrixClient, roomId, "join");
      inviteJoinInProgressRef.current = false;
      setRevision((value) => value + 1);
    } catch (err) {
      inviteJoinInProgressRef.current = false;
      const currentRoom = matrixClient.getRoom(roomId);
      if (currentRoom?.getMyMembership?.() === "join") {
        // Joining may have succeeded even if follow-up sync failed; validate the
        // joined room instead of restoring a stale invitation action.
        setRevision((value) => value + 1);
        setPhase("connecting");
      } else {
        setError(err?.message || "Could not accept the encrypted-room invitation.");
        setPhase("invited");
      }
    }
  };


  const openEncryptedMedia = useCallback(async (message, { silent = false } = {}) => {
    const messageId = String(message?.id || "");
    if (!matrixClient || !message?.file || !messageId || mediaOperationsRef.current.has(messageId)) return;
    mediaOperationsRef.current.add(messageId);
    setLoadingMedia((prev) => ({ ...prev, [messageId]: true }));
    setMediaStatus((prev) => ({ ...prev, [messageId]: "Preparing encrypted attachment…" }));
    if (!silent) setError("");
    try {
      const blob = await decryptEncryptedMedia(matrixClient, message, {
        onStatus: (status) => setMediaStatus((prev) => ({ ...prev, [messageId]: status })),
      });
      const url = URL.createObjectURL(blob);
      mediaObjectUrlsRef.current.add(url);
      setLoadedMedia((prev) => ({ ...prev, [messageId]: { url, mimeType: blob.type, filename: message.filename, size: blob.size } }));
      setMediaStatus((prev) => ({ ...prev, [messageId]: "Decrypted and verified on this device" }));
    } catch (err) {
      setMediaStatus((prev) => ({ ...prev, [messageId]: "Could not decrypt this attachment" }));
      if (!silent) setError(err?.message || "Could not verify and decrypt this attachment.");
    } finally {
      mediaOperationsRef.current.delete(messageId);
      setLoadingMedia((prev) => ({ ...prev, [messageId]: false }));
    }
  }, [matrixClient]);

  const downloadLoadedMedia = useCallback((message) => {
    const media = loadedMedia[message?.id];
    if (!media?.url) return;
    const anchor = document.createElement("a");
    anchor.href = media.url;
    anchor.download = String(media.filename || message.filename || "encrypted-attachment").replace(/[\\/]/g, "_");
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [loadedMedia]);

  useEffect(() => {
    if (phase !== "ready" || !matrixClient || !messages.length) return undefined;
    let cancelled = false;
    const decryptSmallMedia = async () => {
      for (const message of messages) {
        if (cancelled) return;
        if (!message.mediaType || !message.file || loadedMedia[message.id]) continue;
        const messageId = String(message.id);
        if (autoDecryptStartedRef.current.has(messageId) || mediaOperationsRef.current.has(messageId)) continue;
        const size = Number(message.info?.size || 0);
        if (!Number.isFinite(size) || size <= 0 || size > AUTO_DECRYPT_MEDIA_MAX_BYTES) continue;
        autoDecryptStartedRef.current.add(messageId);
        await openEncryptedMedia(message, { silent: true });
      }
    };
    void decryptSmallMedia();
    return () => { cancelled = true; };
  }, [phase, matrixClient, messages, loadedMedia, openEncryptedMedia]);

  const sendMediaFile = async (file, options = {}) => {
    if (!file || !matrixClient || !roomId || mediaBusyRef.current || phase !== "ready") return;
    mediaBusyRef.current = true;
    setMediaBusy(true);
    setPendingUpload({
      id: String(Date.now()) + "-" + String(file.name || "attachment"),
      filename: file.name || "Encrypted attachment",
      status: "Preparing attachment…",
    });
    setError("");
    try {
      const room = matrixClient.getRoom(roomId);
      if (!room || room.getMyMembership?.() !== "join") {
        throw new MatrixSecureError("Join the encrypted room before sending media.", "not_joined");
      }
      if (roomHasPendingInvites(room)) {
        setPhase("waiting_for_peer");
        throw new MatrixSecureError("Secure media sending is paused until every invited participant has joined.", "participants_pending");
      }
      await sendEncryptedMedia(matrixClient, roomId, file, {
        ...options,
        onStatus: (status) => setPendingUpload((prev) => prev ? { ...prev, status } : prev),
      });
      refreshTimeline(matrixClient);
    } catch (err) {
      setError(err?.message || "Encrypted attachment could not be sent.");
    } finally {
      mediaBusyRef.current = false;
      setMediaBusy(false);
      setPendingUpload(null);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const cancelVoiceRecording = () => {
    if (!recordingVoice && !mediaRecorderRef.current) return;
    voiceRecordingCancelledRef.current = true;
    setRecordingVoice(false);
    setMediaBusy(true);
    setError("");
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
        return;
      } catch {
        // Fall through to release the microphone if the recorder cannot stop.
      }
    }
    mediaChunksRef.current = [];
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    voiceRecordingCancelledRef.current = false;
    setMediaBusy(false);
  };

  const toggleVoiceRecording = async () => {
    if (recordingVoice) {
      setMediaBusy(true);
      try { mediaRecorderRef.current?.stop(); } catch {
        mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        mediaChunksRef.current = [];
        setMediaBusy(false);
      }
      setRecordingVoice(false);
      return;
    }
    if (phase !== "ready" || mediaBusy) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice messages are unavailable in this browser. Choose an audio file instead.");
      return;
    }
    try {
      setError("");
      voiceRecordingCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mediaChunksRef.current = [];
      const supportedType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = supportedType ? new MediaRecorder(stream, { mimeType: supportedType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) mediaChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        voiceRecordingCancelledRef.current = true;
        setError("Voice recording failed. Check microphone permissions and try again.");
        setRecordingVoice(false);
        setMediaBusy(true);
        try {
          if (recorder.state !== "inactive") recorder.stop();
          else {
            mediaChunksRef.current = [];
            mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
            mediaStreamRef.current = null;
            mediaRecorderRef.current = null;
            voiceRecordingCancelledRef.current = false;
            setMediaBusy(false);
          }
        } catch {
          mediaChunksRef.current = [];
          mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          mediaRecorderRef.current = null;
          voiceRecordingCancelledRef.current = false;
          setMediaBusy(false);
        }
      };
      recorder.onstop = () => {
        const cancelled = voiceRecordingCancelledRef.current;
        voiceRecordingCancelledRef.current = false;
        const chunks = mediaChunksRef.current;
        mediaChunksRef.current = [];
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });
        mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingVoice(false);
        setMediaBusy(false);
        if (cancelled) return;
        if (blob.size > 0) {
          const extension = mimeType.includes("mp4") ? "m4a" : "webm";
          const file = new File([blob], `voice-message-${Date.now()}.${extension}`, { type: mimeType });
          void sendMediaFile(file, { msgtype: "m.audio", caption: "Voice message" });
        } else {
          setError("The recording was empty and was not sent.");
        }
      };
      recorder.start();
      setRecordingVoice(true);
    } catch (err) {
      mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;
      voiceRecordingCancelledRef.current = false;
      setMediaBusy(false);
      setError(err?.message || "Microphone access was denied.");
    }
  };

  useEffect(() => () => {
    try {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        if (mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      }
    } catch { /* no-op */ }
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    for (const url of mediaObjectUrlsRef.current) URL.revokeObjectURL(url);
    mediaObjectUrlsRef.current.clear();
  }, []);

  const toggleSecureReaction = useCallback(async (message, emoji) => {
    if (!matrixClient || !roomId || phase !== "ready" || !message?.id || !emoji) return;
    const operationKey = String(message.id) + ":" + String(emoji);
    if (reactionOperationsRef.current.has(operationKey)) return;
    reactionOperationsRef.current.add(operationKey);
    try {
      const room = matrixClient.getRoom(roomId);
      if (!room || room.getMyMembership?.() !== "join") {
        throw new MatrixSecureError("Join the encrypted room before reacting.", "not_joined");
      }
      if (roomHasPendingInvites(room)) {
        throw new MatrixSecureError("Reactions are paused until every invited participant has joined.", "participants_pending");
      }
      await assertSecureMessagingReady(matrixClient);
      if (!(await matrixClient.getCrypto().isEncryptionEnabledInRoom(roomId))) {
        throw new MatrixSecureError("Room encryption is not confirmed. The reaction was not sent.", "encryption_lost");
      }
      const ownReaction = (message.reactions || []).find((reaction) => (
        reaction.key === emoji && String(reaction.senderId || "") === String(matrixClient.getUserId() || "")
      ));
      if (ownReaction?.id) {
        await matrixClient.redactEvent(roomId, ownReaction.id);
      } else {
        // MatrixClient.sendEvent encrypts timeline events automatically in encrypted rooms.
        await matrixClient.sendEvent(roomId, "m.reaction", {
          "m.relates_to": {
            rel_type: "m.annotation",
            event_id: message.id,
            key: emoji,
          },
        });
      }
      refreshTimeline(matrixClient);
      setReactionPickerMessageId(null);
    } catch (err) {
      setError(err?.message || "Secure reaction could not be sent.");
    } finally {
      reactionOperationsRef.current.delete(operationKey);
    }
  }, [matrixClient, roomId, phase, refreshTimeline]);

  const startEditSecureMessage = (message) => {
    if (!message?.isOwn || message?.mediaType || message?.redacted || message?.undecryptable) return;
    setMessageMenuAnchor(null);
    setMessageMenuTarget(null);
    setEditDraft(String(message.body || ""));
    setEditingMessage(message);
  };

  const saveSecureMessageEdit = async () => {
    const body = editDraft.trim();
    if (!editingMessage?.id || !body || savingEdit || !matrixClient || phase !== "ready") return;
    setSavingEdit(true);
    setError("");
    try {
      const room = matrixClient.getRoom(roomId);
      if (!room || room.getMyMembership?.() !== "join") {
        throw new MatrixSecureError("You must remain a joined room member to edit this message.", "not_joined");
      }
      if (roomHasPendingInvites(room)) {
        throw new MatrixSecureError("Secure message editing is paused until every participant has joined.", "participants_pending");
      }
      const originalEvent = room.findEventById?.(editingMessage.id);
      if (!editingMessage.isOwn || (originalEvent && originalEvent.getSender?.() !== matrixClient.getUserId())) {
        throw new MatrixSecureError("Only the original sender can edit this secure message.", "edit_not_allowed");
      }
      await assertSecureMessagingReady(matrixClient);
      if (!(await matrixClient.getCrypto().isEncryptionEnabledInRoom(roomId))) {
        throw new MatrixSecureError("Room encryption is not confirmed. The edit was not sent.", "encryption_lost");
      }
      await matrixClient.sendEvent(roomId, "m.room.message", {
        msgtype: "m.text",
        body: "* " + body,
        "m.new_content": { msgtype: "m.text", body },
        "m.relates_to": { rel_type: "m.replace", event_id: editingMessage.id },
      });
      setEditingMessage(null);
      setEditDraft("");
      refreshTimeline(matrixClient);
    } catch (err) {
      setError(err?.message || "Secure message edit could not be sent.");
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmSecureMessageDelete = async () => {
    if (!deletingMessage?.id || deleting || !matrixClient || phase !== "ready") return;
    setDeleting(true);
    setError("");
    try {
      const room = matrixClient.getRoom(roomId);
      if (!room || room.getMyMembership?.() !== "join") {
        throw new MatrixSecureError("You must remain a joined room member to delete this message.", "not_joined");
      }
      if (roomHasPendingInvites(room)) {
        throw new MatrixSecureError("Secure message deletion is paused until every participant has joined.", "participants_pending");
      }
      const originalEvent = room.findEventById?.(deletingMessage.id);
      if (!deletingMessage.isOwn || (originalEvent && originalEvent.getSender?.() !== matrixClient.getUserId())) {
        throw new MatrixSecureError("Only the original sender can delete this secure message.", "delete_not_allowed");
      }
      await assertSecureMessagingReady(matrixClient);
      if (!(await matrixClient.getCrypto().isEncryptionEnabledInRoom(roomId))) {
        throw new MatrixSecureError("Room encryption is not confirmed. The deletion was not sent.", "encryption_lost");
      }
      await matrixClient.redactEvent(roomId, deletingMessage.id);
      setDeletingMessage(null);
      refreshTimeline(matrixClient);
    } catch (err) {
      setError(err?.message || "Secure message deletion could not be sent.");
    } finally {
      setDeleting(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || !matrixClient || !roomId || sending || phase !== "ready") return;
    setSending(true);
    setError("");
    try {
      const room = matrixClient.getRoom(roomId);
      if (!room || room.getMyMembership?.() !== "join") {
        throw new MatrixSecureError("Join the encrypted-room invitation before sending messages.", "not_joined");
      }
      if (roomHasPendingInvites(room)) {
        setPhase("waiting_for_peer");
        throw new MatrixSecureError(
          "Secure messaging is paused until all invited participants have accepted and initialized an encrypted device.",
          "participants_pending",
        );
      }
      await assertSecureMessagingReady(matrixClient);
      const isEncrypted = await matrixClient.getCrypto().isEncryptionEnabledInRoom(roomId);
      if (!isEncrypted) {
        throw new MatrixSecureError("Encryption is no longer confirmed for this room. Sending has been stopped.", "encryption_lost");
      }
      await matrixClient.sendTextMessage(roomId, body);
      setDraft("");
      refreshTimeline(matrixClient);
    } catch (err) {
      setError(err?.message || "Encrypted message could not be sent.");
    } finally {
      setSending(false);
      requestAnimationFrame(() => draftInputRef.current?.focus());
    }
  };

  return (
    <Box role="region" aria-label={appConversationTitle(conversation, currentUserId)} sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "background.default" }}>
      {error && <Alert severity="error" sx={{ mx: 1.5, mt: 1 }}>{error}</Alert>}

      {phase === "connecting" && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 260, p: 3 }}>
          <Paper
            elevation={0}
            sx={{
              width: "min(100%, 380px)",
              p: 3,
              textAlign: "center",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 4,
              bgcolor: "background.paper",
              boxShadow: (theme) => theme.palette.mode === "dark"
                ? "0 16px 50px rgba(0,0,0,.22)"
                : "0 16px 50px rgba(15,23,42,.07)",
            }}
          >
            <Box sx={{
              mx: "auto", mb: 2, width: 58, height: 58, borderRadius: 3,
              display: "grid", placeItems: "center",
              color: "success.main",
              bgcolor: (theme) => alpha(theme.palette.success.main, theme.palette.mode === "dark" ? 0.18 : 0.10),
            }}>
              <LockOutlinedIcon sx={{ fontSize: 28 }} />
            </Box>
            <CircularProgress size={22} thickness={4} sx={{ mb: 1.5 }} />
            <Typography fontWeight={750}>Opening secure conversation</Typography>
            <Typography color="text.secondary" variant="body2" sx={{ mt: 0.6 }}>
              Verifying this device and preparing encrypted messages…
            </Typography>
          </Paper>
        </Box>
      )}

      {phase === "error" && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 3, flex: 1 }}>
          <Paper
            elevation={0}
            sx={{
              width: "min(100%, 480px)", p: { xs: 2.5, sm: 3.5 },
              display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
              textAlign: "center", border: "1px solid", borderColor: "divider",
              borderRadius: 4, bgcolor: "background.paper",
            }}
          >
            <Box sx={{
              width: 60, height: 60, borderRadius: 3, display: "grid", placeItems: "center",
              color: "error.main", bgcolor: (theme) => alpha(theme.palette.error.main, 0.10),
            }}>
              <LockOutlinedIcon sx={{ fontSize: 30 }} />
            </Box>
            <Typography variant="h6" fontWeight={800}>Secure room unavailable</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 390, lineHeight: 1.7 }}>
              The normal Messenger timeline is intentionally hidden. Check Matrix configuration, device authentication, room membership and key recovery, then retry.
            </Typography>
            <Button variant="contained" onClick={() => setRevision((value) => value + 1)} sx={{ mt: 0.5, px: 3, borderRadius: 2.5 }}>
              Try again
            </Button>
          </Paper>
        </Box>
      )}

      {phase === "invited" && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 3, flex: 1 }}>
          <Paper elevation={0} sx={{
            width: "min(100%, 500px)", p: { xs: 2.5, sm: 3.5 },
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
            textAlign: "center", border: "1px solid", borderColor: "divider",
            borderRadius: 4, bgcolor: "background.paper",
          }}>
            <Box sx={{
              width: 66, height: 66, borderRadius: 3, display: "grid", placeItems: "center",
              color: "success.main", bgcolor: (theme) => alpha(theme.palette.success.main, 0.11),
            }}>
              <LockOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Chip label="Private invitation" color="success" variant="outlined" size="small" />
            <Typography variant="h6" fontWeight={800}>Encrypted conversation invitation</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 410, lineHeight: 1.7 }}>
              This is a separate end-to-end encrypted room. Accept the invitation to join it and start secure messaging. Your existing standard conversation and its history will remain unchanged.
            </Typography>
            <Button variant="contained" onClick={() => void acceptInvitation()} sx={{ mt: 0.5, px: 3, borderRadius: 2.5 }}>
              Accept secure invitation
            </Button>
          </Paper>
        </Box>
      )}

      {phase === "waiting_for_peer" && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 3, flex: 1 }}>
          <Paper elevation={0} sx={{
            width: "min(100%, 540px)", p: { xs: 2.5, sm: 3.5 },
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5,
            textAlign: "center", border: "1px solid", borderColor: "divider",
            borderRadius: 4, bgcolor: "background.paper",
          }}>
            <Box sx={{
              width: 66, height: 66, borderRadius: 3, display: "grid", placeItems: "center",
              color: "warning.main", bgcolor: (theme) => alpha(theme.palette.warning.main, 0.12),
            }}>
              <LockOutlinedIcon sx={{ fontSize: 32 }} />
            </Box>
            <Chip label="Waiting for participants" color="warning" variant="outlined" size="small" />
            <Typography variant="h6" fontWeight={800}>Waiting for secure-room participants</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, lineHeight: 1.7 }}>
              The encrypted invitation is ready, but one or more participants have not joined with a Matrix device yet. Sending stays paused so message keys are not shared only with this device. They can accept the invitation when they come online.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your standard Messenger history remains separate and unchanged.
            </Typography>
            <Button variant="outlined" onClick={() => setRevision((value) => value + 1)} sx={{ mt: 0.5, borderRadius: 2.5 }}>
              Check invitation status
            </Button>
          </Paper>
        </Box>
      )}

      {phase === "ready" && (
        <>
          <Box
            sx={{
              minHeight: 54,
              px: { xs: 1.25, md: 2.5 },
              display: "flex",
              alignItems: "center",
              gap: 1.1,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              backgroundImage: (theme) => theme.palette.mode === "dark"
                ? "linear-gradient(110deg, rgba(45,125,95,.10), transparent 42%)"
                : "linear-gradient(110deg, rgba(30,140,100,.055), transparent 42%)",
            }}
          >
            {searchOpen ? (
              <>
                <TextField autoFocus fullWidth size="small" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search loaded encrypted history on this device…" inputProps={{ "aria-label": "Search loaded encrypted history" }} sx={{ "& .MuiOutlinedInput-root": { minHeight: 36, fontSize: 13, borderRadius: 3 } }} />
                <Tooltip title="Close search">
                  <IconButton size="small" aria-label="Close secure history search" onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Box sx={{
                  width: 7, height: 7, borderRadius: "50%", bgcolor: "success.main",
                  boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.success.main, 0.13)}`,
                }} />
                <Typography variant="caption" color="text.secondary" fontWeight={550}>
                  {messages.length} messages on this device
                </Typography>
              </Stack>
            )}
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              icon={<LockOutlinedIcon sx={{ fontSize: "14px !important" }} />}
              label="End-to-end encrypted"
              color="success"
              variant="outlined"
              sx={{
                height: 27,
                px: 0.35,
                borderRadius: 2,
                fontSize: 10.5,
                fontWeight: 700,
                bgcolor: (theme) => alpha(theme.palette.success.main, 0.045),
                "& .MuiChip-icon": { ml: 0.65 },
              }}
            />
            <Tooltip title="Secure chat options">
              <IconButton size="small" aria-label="Secure chat options" onClick={(event) => setRoomMenuAnchor(event.currentTarget)}>
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Menu
            anchorEl={roomMenuAnchor}
            open={Boolean(roomMenuAnchor)}
            onClose={() => setRoomMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => {
              setSearchOpen(true);
              setSearchQuery("");
              setRoomMenuAnchor(null);
            }}>
              <SearchIcon fontSize="small" sx={{ mr: 1.2 }} />
              Search loaded messages
            </MenuItem>
          </Menu>
          <Box sx={{ flex: 1, minHeight: 0, position: "relative", display: "flex" }}>
          <Box
            ref={timelineRef}
            onScroll={onTimelineScroll}
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              px: { xs: 1.25, sm: 2, md: 3.25 },
              py: { xs: 1.75, md: 2.5 },
              scrollBehavior: "smooth",
              overscrollBehavior: "contain",
              backgroundImage: (theme) => theme.palette.mode === "dark"
                ? "radial-gradient(circle at 14% 16%, rgba(60,145,110,.075), transparent 28%), radial-gradient(circle at 92% 84%, rgba(80,110,180,.065), transparent 30%)"
                : "radial-gradient(circle at 14% 16%, rgba(50,150,110,.055), transparent 28%), radial-gradient(circle at 92% 84%, rgba(100,130,190,.045), transparent 30%)",
              "&::-webkit-scrollbar": { width: 8 },
              "&::-webkit-scrollbar-thumb": {
                borderRadius: 8,
                backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.16),
                border: "2px solid transparent",
                backgroundClip: "padding-box",
              },
              "&::-webkit-scrollbar-thumb:hover": {
                backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.28),
              },
            }}
          >
            {hasMoreHistory && (
              <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
                <Button size="small" onClick={() => void loadOlderHistory()} disabled={loadingOlder}>
                  {loadingOlder ? "Loading older encrypted messages…" : "Load older messages"}
                </Button>
              </Box>
            )}
            {messages.length > 0 && filteredMessages.length === 0 && (
              <Typography color="text.secondary" textAlign="center" sx={{ mt: 5 }}>
                No matches in the decrypted messages currently loaded on this device.
              </Typography>
            )}
            {messages.length === 0 && (
              <Typography color="text.secondary" textAlign="center" sx={{ mt: 5 }}>
                No readable messages are available on this device yet.
              </Typography>
            )}
            <Stack spacing={0.9} sx={{ maxWidth: 860, mx: "auto", pb: 1 }}>
              {filteredMessages.map((message, messageIndex) => {
                const previousMessage = filteredMessages[messageIndex - 1];
                const showDate = !previousMessage
                  || new Date(previousMessage.timestamp).toDateString() !== new Date(message.timestamp).toDateString();
                const showSender = !message.isOwn && (
                  !previousMessage
                  || previousMessage.isOwn
                  || previousMessage.senderId !== message.senderId
                  || Number(message.timestamp) - Number(previousMessage.timestamp) > 5 * 60 * 1000
                );
                return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 0.9 }}>
                      <Chip
                        size="small"
                        label={secureDateLabel(message.timestamp)}
                        sx={{
                          height: 25,
                          px: 0.5,
                          borderRadius: 2,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "text.secondary",
                          bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.78 : 0.88),
                          border: "1px solid",
                          borderColor: "divider",
                          backdropFilter: "blur(8px)",
                        }}
                      />
                    </Box>
                  )}
                {message.id === unreadAnchorId && !searchQuery.trim() && (
                  <Box sx={{ width: "100%", py: 0.5 }}>
                    <Divider><Chip size="small" color="primary" label="Unread messages" /></Divider>
                  </Box>
                )}
                <Box
                  data-secure-event-id={message.id}
                  data-secure-own={message.isOwn ? "true" : "false"}
                  className="secure-message-row"
                  sx={{
                    display: "flex",
                    justifyContent: message.isOwn ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    px: { xs: 0, sm: 0.5 },
                    "&:hover .secure-message-reaction": { opacity: 1, transform: "translateY(0)" },
                    "&:focus-within .secure-message-reaction": { opacity: 1, transform: "translateY(0)" },
                  }}
                >
                  <Paper
                    elevation={0}
                    data-receipt-revision={receiptRevision}
                    sx={{
                      position: "relative",
                      maxWidth: { xs: "88%", sm: "min(78%, 700px)" },
                      minWidth: 0,
                      border: "1px solid",
                      borderColor: message.undecryptable ? "warning.main" : message.isOwn ? "transparent" : "divider",
                      bgcolor: message.isOwn ? "primary.main" : "background.paper",
                      background: message.isOwn
                        ? (theme) => `linear-gradient(145deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`
                        : (theme) => theme.palette.background.paper,
                      color: message.isOwn ? "primary.contrastText" : "text.primary",
                      boxShadow: message.isOwn
                        ? "0 5px 16px rgba(20,70,110,0.16)"
                        : (theme) => theme.palette.mode === "dark"
                          ? "0 3px 12px rgba(0,0,0,.15)"
                          : "0 3px 14px rgba(15,23,42,.055)",
                      px: { xs: 1.35, sm: 1.65 },
                      py: { xs: 1.05, sm: 1.2 },
                      borderRadius: message.isOwn ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
                      transition: "box-shadow .18s ease, transform .18s ease",
                      "&:hover": {
                        boxShadow: message.isOwn
                          ? "0 7px 20px rgba(20,70,110,0.20)"
                          : (theme) => theme.palette.mode === "dark" ? "0 5px 16px rgba(0,0,0,.24)" : "0 5px 18px rgba(15,23,42,.09)",
                      },
                    }}
                  >
                    {showSender && (
                      <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                        <Avatar
                          src={message.senderAvatar || undefined}
                          sx={{
                            width: 25, height: 25, fontSize: 11, fontWeight: 800,
                            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                            color: "primary.main",
                            border: "1px solid",
                            borderColor: (theme) => alpha(theme.palette.primary.main, 0.12),
                          }}
                        >
                          {(message.sender || "M").slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" fontWeight={750} color="primary.main" sx={{ letterSpacing: 0.05 }}>
                          {message.sender}
                        </Typography>
                      </Stack>
                    )}
                    {message.mediaType && (
                      <Box sx={{ display: "grid", gap: 1, my: 0.5, minWidth: 150 }}>
                        {loadedMedia[message.id] && message.mediaType === "m.image" && (
                          <Tooltip title="Open image viewer">
                            <Box
                              component="button"
                              type="button"
                              onClick={() => setSecureViewerAttachment({
                                id: String(message.id),
                                message_id: message.id,
                                url: loadedMedia[message.id].url,
                                kind: "image",
                                content_type: loadedMedia[message.id].mimeType || message.info?.mimetype || "image/jpeg",
                                original_filename: message.filename || "Encrypted image",
                              })}
                              sx={{
                                display: "block",
                                position: "relative",
                                maxWidth: "min(65vw, 420px)",
                                p: 0,
                                border: 0,
                                borderRadius: 2,
                                overflow: "hidden",
                                bgcolor: "transparent",
                                cursor: "zoom-in",
                                lineHeight: 0,
                                "& img": { display: "block", maxWidth: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 2 },
                                "& .secure-image-open": {
                                  position: "absolute",
                                  right: 8,
                                  bottom: 8,
                                  display: "grid",
                                  placeItems: "center",
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  color: "#fff",
                                  bgcolor: "rgba(0,0,0,0.58)",
                                  opacity: 0,
                                  transition: "opacity .18s ease",
                                },
                                "&:hover .secure-image-open, &:focus-visible .secure-image-open": { opacity: 1 },
                              }}
                            >
                              <img src={loadedMedia[message.id].url} alt={message.filename || "Encrypted image"} />
                              <Box className="secure-image-open"><OpenInFullRoundedIcon fontSize="small" /></Box>
                            </Box>
                          </Tooltip>
                        )}
                        {loadedMedia[message.id] && message.mediaType === "m.audio" && (
                          <SecureAudioPlayer
                            src={loadedMedia[message.id].url}
                            filename={message.filename || "Audio message"}
                            onDownload={() => downloadLoadedMedia(message)}
                          />
                        )}
                        {loadedMedia[message.id] && message.mediaType === "m.video" && (
                          <VideoPlayer
                            src={loadedMedia[message.id].url}
                            filename={message.filename || "Encrypted video"}
                            contentType={loadedMedia[message.id].mimeType || message.info?.mimetype || "video/mp4"}
                            maxWidth={420}
                            maxHeight={300}
                          />
                        )}
                        {loadedMedia[message.id] && message.mediaType === "m.file" && (
                          <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => downloadLoadedMedia(message)}>
                            Download decrypted file
                          </Button>
                        )}
                        {!loadedMedia[message.id] && !loadingMedia[message.id] && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              autoDecryptStartedRef.current.add(String(message.id));
                              void openEncryptedMedia(message);
                            }}
                          >
                            {Number(message.info?.size || 0) > AUTO_DECRYPT_MEDIA_MAX_BYTES ? "Decrypt large attachment" : "Decrypt attachment"}
                          </Button>
                        )}
                        {loadingMedia[message.id] && (
                          <Stack spacing={0.6}>
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <CircularProgress size={15} />
                              <Typography variant="caption" color="text.secondary">{mediaStatus[message.id] || "Processing encrypted attachment…"}</Typography>
                            </Stack>
                            <LinearProgress />
                          </Stack>
                        )}
                        {!loadingMedia[message.id] && mediaStatus[message.id] && (
                          <Typography variant="caption" color="text.secondary">{mediaStatus[message.id]}</Typography>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {message.filename || message.body} · E2EE
                          {Number(message.info?.size || 0) > 0 ? " · " + (Number(message.info.size) / (1024 * 1024)).toFixed(1) + " MB" : ""}
                        </Typography>
                      </Box>
                    )}
                    {!message.mediaType && (
                      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {message.body}
                      </Typography>
                    )}
                    <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.55} sx={{ mt: 0.8 }}>
                      {message.edited && (
                        <Typography variant="caption" sx={{ color: message.isOwn ? "rgba(255,255,255,0.70)" : "text.secondary", fontSize: 10 }}>
                          edited
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{
                          color: message.isOwn ? "rgba(255,255,255,0.72)" : "text.secondary",
                          fontSize: 10.5,
                          lineHeight: 1.2,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                      {message.isOwn && (
                        <Tooltip title={getReadReceiptStatus(matrixClient?.getRoom(roomId), message.id, matrixClient?.getUserId())}>
                          <DoneAllIcon sx={{
                            fontSize: 15,
                            color: getReadReceiptStatus(matrixClient?.getRoom(roomId), message.id, matrixClient?.getUserId()) === "Seen"
                              ? "#9de4ca"
                              : "rgba(255,255,255,0.65)",
                          }} />
                        </Tooltip>
                      )}
                      <Tooltip title="Message options">
                        <IconButton
                          size="small"
                          aria-label="Message options"
                          onClick={(event) => {
                            setMessageMenuTarget(message);
                            setMessageMenuAnchor(event.currentTarget);
                          }}
                          sx={{
                            width: 23,
                            height: 23,
                            ml: 0.1,
                            p: 0,
                            color: message.isOwn ? "rgba(255,255,255,0.74)" : "text.secondary",
                            "&:hover": { bgcolor: message.isOwn ? "rgba(255,255,255,.14)" : "action.hover" },
                          }}
                        >
                          <MoreVertIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                    {message.reactions?.length > 0 && (
                      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.45} sx={{ mt: 0.8 }}>
                        {getReactionGroups(message.reactions, matrixClient?.getUserId()).map((reaction) => (
                          <Chip
                            key={reaction.key}
                            size="small"
                            clickable
                            color={reaction.own ? "success" : "default"}
                            variant={reaction.own ? "filled" : "outlined"}
                            label={reaction.key + " " + reaction.count}
                            onClick={() => void toggleSecureReaction(message, reaction.key)}
                            sx={{
                              height: 25,
                              borderRadius: 2,
                              fontWeight: 650,
                              bgcolor: reaction.own
                                ? undefined
                                : (theme) => alpha(theme.palette.background.default, 0.72),
                            }}
                          />
                        ))}
                      </Stack>
                    )}
                    <Tooltip title={reactionPickerMessageId === message.id ? "Close reactions" : "Add reaction"}>
                      <IconButton
                        className="secure-message-reaction"
                        size="small"
                        aria-label="Add secure reaction"
                        onClick={(event) => {
                          setReactionPickerMessageId((current) => current === message.id ? null : message.id);
                          setReactionPickerAnchor((current) => current && reactionPickerMessageId === message.id ? null : event.currentTarget);
                        }}
                        sx={{
                          position: "absolute",
                          top: 6,
                          [message.isOwn ? "left" : "right"]: -34,
                          width: 29,
                          height: 29,
                          p: 0,
                          opacity: { xs: 0.85, md: 0 },
                          transform: "translateY(3px)",
                          color: "text.secondary",
                          bgcolor: "background.paper",
                          border: "1px solid",
                          borderColor: "divider",
                          boxShadow: 1,
                          transition: "opacity .16s ease, transform .16s ease",
                          "&:hover": { bgcolor: "action.hover", color: "primary.main" },
                        }}
                      >
                        <EmojiEmotionsIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                </Box>
                </React.Fragment>
                );
              })}
              {pendingUpload && (
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Paper elevation={0} sx={{ width: "min(78%, 420px)", p: 1.5, border: "1px solid", borderColor: "primary.main", bgcolor: "background.paper", borderRadius: 3, boxShadow: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <LockOutlinedIcon color="success" fontSize="small" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={650} noWrap>{pendingUpload.filename}</Typography>
                        <Typography variant="caption" color="text.secondary">{pendingUpload.status}</Typography>
                      </Box>
                      <CircularProgress size={17} />
                    </Stack>
                    <LinearProgress sx={{ mt: 1 }} />
                  </Paper>
                </Box>
              )}
            </Stack>
          </Box>
          {showJumpToBottom && (
            <Box sx={{ position: "absolute", right: { xs: 14, md: 24 }, bottom: 18, zIndex: 4 }}>
              <Badge
                badgeContent={unreadCount > 99 ? "99+" : unreadCount}
                color="primary"
                invisible={unreadCount <= 0}
                overlap="circular"
                anchorOrigin={{ vertical: "top", horizontal: "right" }}
                sx={{
                  "& .MuiBadge-badge": {
                    minWidth: 21,
                    height: 21,
                    px: 0.6,
                    fontSize: 10.5,
                    fontWeight: 800,
                    boxShadow: 2,
                    border: "2px solid",
                    borderColor: "background.paper",
                  },
                }}
              >
                <IconButton
                  aria-label={unreadCount > 0 ? `Jump to latest message, ${unreadCount} unread` : "Jump to latest message"}
                  onClick={jumpToLatestMessage}
                  sx={{
                    width: 46,
                    height: 46,
                    bgcolor: "background.paper",
                    color: "primary.main",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: "0 5px 18px rgba(0,0,0,0.18)",
                    "&:hover": { bgcolor: "action.hover", transform: "translateY(-2px)" },
                    transition: "transform .18s ease, background-color .18s ease",
                  }}
                >
                  <KeyboardArrowDownRoundedIcon sx={{ fontSize: 28 }} />
                </IconButton>
              </Badge>
            </Box>
          )}
          </Box>
          <Divider sx={{ borderColor: "divider" }} />
          <Box
            component="form"
            onSubmit={(event) => { event.preventDefault(); void send(); }}
            sx={{
              p: { xs: 1, sm: 1.5 },
              display: "flex",
              alignItems: "center",
              gap: { xs: 0.65, sm: 0.9 },
              maxWidth: 960,
              mx: "auto",
              width: "100%",
              bgcolor: "background.paper",
              backgroundImage: (theme) => theme.palette.mode === "dark"
                ? "linear-gradient(0deg, rgba(255,255,255,.015), transparent)"
                : "linear-gradient(0deg, rgba(15,23,42,.018), transparent)",
            }}
          >
            <input
              ref={mediaInputRef}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendMediaFile(file);
              }}
            />
            <IconButton
              aria-label="Attach encrypted file"
              title="Attach an encrypted image, voice, video, or file"
              disabled={mediaBusy || sending || phase !== "ready"}
              onClick={() => mediaInputRef.current?.click()}
              sx={{
                flex: "0 0 42px", width: 42, height: 42, minWidth: 42, minHeight: 42,
                aspectRatio: "1 / 1", alignSelf: "center", borderRadius: 2.5, p: 0,
                color: "text.secondary", bgcolor: "action.hover",
                "&:hover": { bgcolor: "action.selected", color: "primary.main" },
              }}
            >
              <AttachFileIcon />
            </IconButton>
            <IconButton
              aria-label={recordingVoice ? "Stop and send voice message" : "Record voice message"}
              title={recordingVoice ? "Stop and send voice message" : "Record voice message"}
              color={recordingVoice ? "error" : "default"}
              disabled={mediaBusy || sending || phase !== "ready"}
              onClick={() => void toggleVoiceRecording()}
              sx={{
                flex: "0 0 42px", width: 42, height: 42, minWidth: 42, minHeight: 42,
                aspectRatio: "1 / 1", alignSelf: "center", borderRadius: 2.5, p: 0,
                bgcolor: recordingVoice ? "error.main" : "action.hover",
                color: recordingVoice ? "error.contrastText" : "text.secondary",
                "&:hover": { bgcolor: recordingVoice ? "error.dark" : "action.selected", color: recordingVoice ? "error.contrastText" : "primary.main" },
              }}
            >
              {recordingVoice ? <StopIcon /> : <MicIcon />}
            </IconButton>
            {recordingVoice && (
              <Button
                color="error"
                size="small"
                onClick={cancelVoiceRecording}
                startIcon={<CloseIcon />}
                sx={{ flexShrink: 0, minWidth: 0, px: 1, borderRadius: 2, fontWeight: 700 }}
              >
                Cancel
              </Button>
            )}
            <TextField
              inputRef={draftInputRef}
              fullWidth multiline minRows={1} maxRows={5}
              variant="outlined"
              placeholder={recordingVoice ? "Recording voice message…" : "Message securely…"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent?.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={sending || mediaBusy || recordingVoice || phase !== "ready"}
              inputProps={{ "aria-label": "Encrypted message" }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  minHeight: 46,
                  alignItems: "center",
                  borderRadius: 3.25,
                  bgcolor: "action.hover",
                  transition: "background-color .18s ease, box-shadow .18s ease",
                  "& fieldset": { borderColor: "transparent" },
                  "&:hover fieldset": { borderColor: "divider" },
                  "&.Mui-focused": {
                    bgcolor: "background.paper",
                    boxShadow: (theme) => `0 0 0 3px ${alpha(theme.palette.primary.main, 0.10)}`,
                  },
                  "&.Mui-focused fieldset": { borderColor: "primary.main", borderWidth: 1 },
                },
                "& .MuiInputBase-input": { py: 1.15, px: 1.5, fontSize: 14 },
              }}
            />
            <Button
              type="submit" variant="contained" aria-label="Send encrypted message"
              disabled={!draft.trim() || sending || mediaBusy || recordingVoice || phase !== "ready"}
              sx={{
                flex: "0 0 44px", width: 44, height: 44, minWidth: 44, minHeight: 44,
                aspectRatio: "1 / 1", alignSelf: "center", borderRadius: 2.75, p: 0,
                boxShadow: "0 4px 12px rgba(25,118,210,.20)",
                transition: "transform .16s ease, box-shadow .16s ease",
                "&:hover": { transform: "translateY(-1px)", boxShadow: "0 7px 16px rgba(25,118,210,.26)" },
                "&.Mui-disabled": { bgcolor: "action.disabledBackground", color: "text.disabled", boxShadow: "none" },
              }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </Button>
          </Box>
        </>
      )}

      <Popover
        open={Boolean(reactionPickerAnchor && reactionPickerMessageId)}
        anchorEl={reactionPickerAnchor}
        onClose={() => {
          setReactionPickerAnchor(null);
          setReactionPickerMessageId(null);
        }}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        transformOrigin={{ vertical: "bottom", horizontal: "center" }}
        slotProps={{
          paper: {
            sx: {
              p: 0.75,
              borderRadius: 3,
              boxShadow: "0 8px 28px rgba(0,0,0,0.2)",
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <Stack direction="row" spacing={0.25} alignItems="center">
          {["👍", "❤️", "😂", "😮", "🙏", "🎉", "🔥"].map((emoji) => (
            <IconButton
              key={emoji}
              aria-label={`React with ${emoji}`}
              onClick={() => {
                const target = messages.find((message) => message.id === reactionPickerMessageId);
                if (target) void toggleSecureReaction(target, emoji);
                setReactionPickerAnchor(null);
                setReactionPickerMessageId(null);
              }}
              sx={{ width: 38, height: 38, fontSize: 20 }}
            >
              {emoji}
            </IconButton>
          ))}
        </Stack>
      </Popover>

      <MediaGalleryDialog
        open={Boolean(secureViewerAttachment)}
        conversationId={null}
        startAttachment={secureViewerAttachment}
        initialItems={secureViewerItems}
        kinds="image,video"
        onClose={() => setSecureViewerAttachment(null)}
      />

      <Menu
        anchorEl={messageMenuAnchor}
        open={Boolean(messageMenuAnchor && messageMenuTarget)}
        onClose={() => {
          setMessageMenuAnchor(null);
          setMessageMenuTarget(null);
        }}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {messageMenuTarget && !messageMenuTarget.redacted && !messageMenuTarget.mediaType && (
          <MenuItem onClick={() => {
            try { void navigator.clipboard?.writeText(messageMenuTarget.body || ""); } catch { /* clipboard unavailable */ }
            setMessageMenuAnchor(null);
            setMessageMenuTarget(null);
          }}>
            <ContentCopyIcon fontSize="small" sx={{ mr: 1.2 }} />
            Copy text
          </MenuItem>
        )}
        {messageMenuTarget && !messageMenuTarget.redacted && (
          <MenuItem onClick={() => {
            setReactionPickerMessageId(messageMenuTarget.id);
            setReactionPickerAnchor(messageMenuAnchor);
            setMessageMenuAnchor(null);
            setMessageMenuTarget(null);
          }}>
            <EmojiEmotionsIcon fontSize="small" sx={{ mr: 1.2 }} />
            React
          </MenuItem>
        )}
        {messageMenuTarget?.isOwn && !messageMenuTarget.redacted && !messageMenuTarget.mediaType && (
          <MenuItem onClick={() => startEditSecureMessage(messageMenuTarget)}>
            <EditOutlinedIcon fontSize="small" sx={{ mr: 1.2 }} />
            Edit message
          </MenuItem>
        )}
        {messageMenuTarget?.isOwn && !messageMenuTarget.redacted && (
          <MenuItem
            onClick={() => {
              setDeletingMessage(messageMenuTarget);
              setMessageMenuAnchor(null);
              setMessageMenuTarget(null);
            }}
            sx={{ color: "error.main" }}
          >
            <DeleteOutlineIcon fontSize="small" sx={{ mr: 1.2 }} />
            Delete message
          </MenuItem>
        )}
        {messageMenuTarget?.mediaType && loadedMedia[messageMenuTarget.id] && (
          <MenuItem onClick={() => {
            downloadLoadedMedia(messageMenuTarget);
            setMessageMenuAnchor(null);
            setMessageMenuTarget(null);
          }}>
            <DownloadIcon fontSize="small" sx={{ mr: 1.2 }} />
            Download attachment
          </MenuItem>
        )}
        {messageMenuTarget?.file && !loadedMedia[messageMenuTarget.id] && (
          <MenuItem onClick={() => {
            void openEncryptedMedia(messageMenuTarget);
            setMessageMenuAnchor(null);
            setMessageMenuTarget(null);
          }}>
            <DownloadIcon fontSize="small" sx={{ mr: 1.2 }} />
            Decrypt attachment
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={Boolean(editingMessage)}
        onClose={() => { if (!savingEdit) { setEditingMessage(null); setEditDraft(""); } }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Edit encrypted message</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            maxRows={10}
            value={editDraft}
            onChange={(event) => setEditDraft(event.target.value)}
            placeholder="Edit your message…"
            sx={{ mt: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            The edit is sent as a new encrypted Matrix event. The original message event remains in room history.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={savingEdit} onClick={() => { setEditingMessage(null); setEditDraft(""); }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={!editDraft.trim() || savingEdit} onClick={() => void saveSecureMessageEdit()}>
            {savingEdit ? <CircularProgress size={18} color="inherit" /> : "Save edit"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(deletingMessage)}
        onClose={() => { if (!deleting) setDeletingMessage(null); }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete encrypted message?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This sends a Matrix redaction for the message. Other devices may retain a copy that was already received or decrypted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={deleting} onClick={() => setDeletingMessage(null)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={() => void confirmSecureMessageDelete()}>
            {deleting ? <CircularProgress size={18} color="inherit" /> : "Delete message"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
