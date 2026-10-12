import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Avatar, Box, Button, CircularProgress, Divider, IconButton, Paper,
  Stack, TextField, Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import MicIcon from "@mui/icons-material/Mic";
import SettingsIcon from "@mui/icons-material/Settings";
import SendIcon from "@mui/icons-material/Send";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  assertSecureMessagingReady, getSecureMatrixClient, getSecureMatrixSession,
  hasSecureMatrixInitialSync, MatrixSecureError, resolveMatrixUsers,
  sendEncryptedMedia, decryptEncryptedMedia,
} from "./MatrixSecureClient";
import { withTokenQuery } from "../messengerUtils";

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

function describeEvent(event, ownUserId, profilesByMatrixId = {}) {
  const type = event.getType();
  const wireType = event.getWireType?.() || type;
  const content = event.getContent?.() || {};
  const senderId = event.getSender?.() || "";
  const profile = profilesByMatrixId[senderId] || null;
  const sender = senderId === ownUserId ? "You" : (profile?.displayName || "Member");
  const timestamp = Number(event.getTs?.() || Date.now());
  const eventId = event.getId?.() || `${senderId}:${timestamp}`;

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
  };
}

function getRoomMessages(room, ownUserId, profilesByMatrixId = {}) {
  if (!room) return [];
  const events = room.getLiveTimeline?.().getEvents?.() || [];
  const seen = new Set();
  return events
    .map((event) => describeEvent(event, ownUserId, profilesByMatrixId))
    .filter((row) => {
      if (!row || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
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

export default function SecureChatPanel({ conversation, currentUserId, onOpenSecuritySettings, onSecureClientReady }) {
  const roomId = conversation?.matrix_room_id;
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState("");
  const [matrixClient, setMatrixClient] = useState(null);
  const profilesByMatrixIdRef = useRef({});
  const mediaObjectUrlsRef = useRef(new Set());
  const [loadedMedia, setLoadedMedia] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [mediaBusy, setMediaBusy] = useState(false);
  const mediaInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaChunksRef = useRef([]);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const timelineRef = useRef(null);
  const inviteJoinInProgressRef = useRef(false);
  const [revision, setRevision] = useState(0);
  const [roomDisplayName, setRoomDisplayName] = useState(conversation?.title || "");

  const refreshTimeline = useCallback((client) => {
    const room = client.getRoom(roomId);
    if (!room) return;
    setRoomDisplayName(appConversationTitle(conversation, currentUserId));
    setMessages(getRoomMessages(room, client.getUserId(), profilesByMatrixIdRef.current));
  }, [roomId, conversation?.title, conversation?.participants, currentUserId]);

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
    const attachRoomListeners = () => {
      if (roomListenersAttached || !activeClient) return;
      activeClient.on("Room.timeline", onTimeline);
      activeClient.on("Event.decrypted", onDecrypted);
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
        setRoomDisplayName(appConversationTitle(conversation, currentUserId));
        setHasMoreHistory(true);

        const participants = conversation?.participants || [];
        const localUserIds = [...new Set([
          Number(currentUserId),
          ...participants.map((participant) => Number(participant?.user?.id ?? participant?.user_id ?? participant?.id)),
        ].filter((id) => Number.isInteger(id) && id > 0))];
        try {
          const identities = await resolveMatrixUsers(localUserIds, getSecureMatrixSession());
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
          if (!cancelled) setMessages(getRoomMessages(room, client.getUserId(), mappedProfiles));
        } catch {
          profilesByMatrixIdRef.current = {};
          // If profile metadata is unavailable, do not use raw Matrix IDs as names.
        }
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
        setMessages(getRoomMessages(room, client.getUserId(), profilesByMatrixIdRef.current));
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
        activeClient.off("sync", onSync);
        activeClient.off("RoomMember.membership", onMembership);
      }
    };
  }, [roomId, currentUserId, revision, refreshTimeline, conversation?.title, conversation?.participants, onSecureClientReady]);

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
    if (event.currentTarget.scrollTop < 48 && hasMoreHistory && !loadingOlder) {
      void loadOlderHistory();
    }
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


  const openEncryptedMedia = async (message, { download = false } = {}) => {
    if (!matrixClient || !message?.file || loadingMedia[message.id] || mediaBusy) return;
    setLoadingMedia((prev) => ({ ...prev, [message.id]: true }));
    setError("");
    try {
      const blob = await decryptEncryptedMedia(matrixClient, message);
      const url = URL.createObjectURL(blob);
      mediaObjectUrlsRef.current.add(url);
      if (download || message.mediaType === "m.file") {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = String(message.filename || "encrypted-attachment").replace(/[\\/\\0-\\x1f]/g, "_");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => {
          URL.revokeObjectURL(url);
          mediaObjectUrlsRef.current.delete(url);
        }, 30000);
      } else {
        setLoadedMedia((prev) => ({ ...prev, [message.id]: { url, mimeType: blob.type, filename: message.filename } }));
      }
    } catch (err) {
      setError(err?.message || "Could not verify and decrypt this attachment.");
    } finally {
      setLoadingMedia((prev) => ({ ...prev, [message.id]: false }));
    }
  };

  const sendMediaFile = async (file, options = {}) => {
    if (!file || !matrixClient || !roomId || mediaBusy || phase !== "ready") return;
    setMediaBusy(true);
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
      await sendEncryptedMedia(matrixClient, roomId, file, options);
      refreshTimeline(matrixClient);
    } catch (err) {
      setError(err?.message || "Encrypted attachment could not be sent.");
    } finally {
      setMediaBusy(false);
      if (mediaInputRef.current) mediaInputRef.current.value = "";
    }
  };

  const toggleVoiceRecording = async () => {
    if (recordingVoice) {
      try { mediaRecorderRef.current?.stop(); } catch { /* no-op */ }
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
        setError("Voice recording failed. Check microphone permissions and try again.");
        setRecordingVoice(false);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(mediaChunksRef.current, { type: mimeType });
        mediaChunksRef.current = [];
        mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
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
    }
  };

  const title = roomDisplayName || appConversationTitle(conversation, currentUserId);
  const secureFeatureNotice = useMemo(
    () => "Text, photos, voice notes, videos and files are end-to-end encrypted. Search, replies, edits/deletes, reactions, forwarding, read receipts, scheduled messages and live calls are not enabled in this secure room yet.",
    [],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "background.default" }}>
      <Paper square elevation={0} sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25, gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <LockOutlinedIcon color="success" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={750} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            End-to-end encrypted
          </Typography>
        </Box>
        <IconButton aria-label="Reconnect secure chat" onClick={() => setRevision((value) => value + 1)} disabled={phase === "connecting"}>
          <RefreshIcon />
        </IconButton>
        <Button size="small" startIcon={<SettingsIcon />} onClick={() => onOpenSecuritySettings?.()}>
          Security settings
        </Button>
      </Paper>

      <Alert severity="info" sx={{ mx: 1.5, mt: 1.25 }}>
        {secureFeatureNotice}
      </Alert>

      {error && <Alert severity="error" sx={{ mx: 1.5, mt: 1 }}>{error}</Alert>}

      {phase === "connecting" && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 200, gap: 1 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Verifying Matrix room and encrypted device…</Typography>
        </Box>
      )}

      {phase === "error" && (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2, p: 4, flex: 1 }}>
          <LockOutlinedIcon color="error" sx={{ fontSize: 42 }} />
          <Typography fontWeight={700}>Secure room unavailable</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={480}>
            The normal Messenger timeline is intentionally not shown. Check Matrix configuration, device authentication, room membership and key recovery, then try again.
          </Typography>
          <Button variant="outlined" onClick={() => setRevision((value) => value + 1)}>Try again</Button>
        </Box>
      )}

      {phase === "invited" && (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2, p: 4, flex: 1 }}>
          <LockOutlinedIcon color="success" sx={{ fontSize: 42 }} />
          <Typography fontWeight={700}>Encrypted conversation invitation</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={520}>
            This is a separate end-to-end encrypted room. Accept the invitation to join it and start secure messaging. Your existing standard conversation and its history will remain unchanged.
          </Typography>
          <Button variant="contained" onClick={() => void acceptInvitation()}>
            Accept secure invitation
          </Button>
        </Box>
      )}

      {phase === "waiting_for_peer" && (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2, p: 4, flex: 1 }}>
          <LockOutlinedIcon color="warning" sx={{ fontSize: 42 }} />
          <Typography fontWeight={700}>Waiting for secure-room participants</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={540}>
            The encrypted invitation has been created, but one or more participants have not joined with a Matrix device yet. Sending is paused so message keys are not shared only with the sender's device. The other person does not need to create a secure chat manually; they just need to open this invitation and accept it. They can do that when they come online.
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={540}>
            Your normal Messenger conversation and its history are separate and have not been deleted or moved.
          </Typography>
          <Button variant="outlined" onClick={() => setRevision((value) => value + 1)}>
            Check invitation status
          </Button>
        </Box>
      )}

      {phase === "ready" && (
        <>
          <Box
            ref={timelineRef}
            onScroll={onTimelineScroll}
            sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1.5, md: 3 }, py: 2 }}
          >
            {hasMoreHistory && (
              <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
                <Button size="small" onClick={() => void loadOlderHistory()} disabled={loadingOlder}>
                  {loadingOlder ? "Loading older encrypted messages…" : "Load older messages"}
                </Button>
              </Box>
            )}
            {messages.length === 0 && (
              <Typography color="text.secondary" textAlign="center" sx={{ mt: 5 }}>
                No readable messages are available on this device yet.
              </Typography>
            )}
            <Stack spacing={1.25} sx={{ maxWidth: 900, mx: "auto" }}>
              {messages.map((message) => (
                <Box key={message.id} sx={{ display: "flex", justifyContent: message.isOwn ? "flex-end" : "flex-start" }}>
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: "min(78%, 720px)",
                      border: "1px solid",
                      borderColor: message.undecryptable ? "warning.main" : "divider",
                      bgcolor: message.isOwn ? "action.selected" : "background.paper",
                      px: 1.5, py: 1, borderRadius: 1.5,
                    }}
                  >
                    {!message.isOwn && (
                      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.35 }}>
                        <Avatar src={message.senderAvatar || undefined} sx={{ width: 22, height: 22, fontSize: 11 }}>
                          {(message.sender || "M").slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Typography variant="caption" fontWeight={700} color="primary.main">
                          {message.sender}
                        </Typography>
                      </Stack>
                    )}
                    {message.mediaType && (
                      <Box sx={{ display: "grid", gap: 1, my: 0.5, minWidth: 150 }}>
                        {loadedMedia[message.id] && message.mediaType === "m.image" && (
                          <img src={loadedMedia[message.id].url} alt={message.filename || "Encrypted image"} style={{ display: "block", maxWidth: "min(65vw, 420px)", maxHeight: 420, objectFit: "contain", borderRadius: 8 }} />
                        )}
                        {loadedMedia[message.id] && message.mediaType === "m.audio" && (
                          <audio controls preload="none" src={loadedMedia[message.id].url} style={{ maxWidth: "min(65vw, 360px)" }} />
                        )}
                        {loadedMedia[message.id] && message.mediaType === "m.video" && (
                          <video controls preload="none" src={loadedMedia[message.id].url} style={{ maxWidth: "min(65vw, 420px)", maxHeight: 420, borderRadius: 8 }} />
                        )}
                        {!loadedMedia[message.id] && (
                          <Button
                            variant="outlined"
                            size="small"
                            disabled={Boolean(loadingMedia[message.id])}
                            onClick={() => void openEncryptedMedia(message, { download: message.mediaType === "m.file" })}
                          >
                            {loadingMedia[message.id] ? "Verifying and decrypting…" : message.mediaType === "m.image" ? "Load encrypted image" : message.mediaType === "m.audio" ? "Load encrypted voice message" : message.mediaType === "m.video" ? "Load encrypted video" : "Decrypt and download file"}
                          </Button>
                        )}
                        <Typography variant="caption" color="text.secondary">
                          {message.filename || message.body} · E2EE
                        </Typography>
                      </Box>
                    )}
                    {(!message.mediaType || !["m.image", "m.video", "m.file"].includes(message.mediaType)) && (
                      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {message.mediaType === "m.audio" ? (message.body === message.filename ? "Voice message" : message.body) : message.body}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "right", mt: 0.5 }}>
                      {new Date(message.timestamp).toLocaleString()}
                    </Typography>
                  </Paper>
                </Box>
              ))}
            </Stack>
          </Box>
          <Divider />
          <Box
            component="form"
            onSubmit={(event) => { event.preventDefault(); void send(); }}
            sx={{ p: 1.25, display: "flex", gap: 1, maxWidth: 960, mx: "auto", width: "100%" }}
          >
            <input
              ref={mediaInputRef}
              type="file"
              accept="image/*,audio/*,video/*,.pdf,.txt,.zip,.doc,.docx"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendMediaFile(file);
              }}
            />
            <IconButton aria-label="Attach encrypted file" title="Attach an encrypted image, voice, video, or file" disabled={mediaBusy || sending || phase !== "ready"} onClick={() => mediaInputRef.current?.click()}>
              <AttachFileIcon />
            </IconButton>
            <IconButton aria-label={recordingVoice ? "Stop and send voice message" : "Record voice message"} title={recordingVoice ? "Stop and send voice message" : "Record voice message"} color={recordingVoice ? "error" : "default"} disabled={mediaBusy || sending || phase !== "ready"} onClick={() => void toggleVoiceRecording()}>
              {recordingVoice ? <CircularProgress size={20} color="inherit" /> : <MicIcon />}
            </IconButton>
            <TextField
              fullWidth multiline minRows={1} maxRows={5}
              placeholder={recordingVoice ? "Recording voice message…" : "Write an end-to-end encrypted message…"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              disabled={sending || mediaBusy || recordingVoice || phase !== "ready"}
              inputProps={{ "aria-label": "Encrypted message" }}
            />
            <Button
              type="submit" variant="contained" aria-label="Send encrypted message"
              disabled={!draft.trim() || sending || mediaBusy || recordingVoice || phase !== "ready"}
              sx={{ minWidth: 52, alignSelf: "stretch" }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </Button>
          </Box>
        </>
      )}

    </Box>
  );
}
