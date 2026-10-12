import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Divider, IconButton, Paper,
  Stack, TextField, Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import KeyIcon from "@mui/icons-material/Key";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import MatrixRecoveryDialog from "./MatrixRecoveryDialog";
import MatrixDevicesDialog from "./MatrixDevicesDialog";
import {
  assertSecureMessagingReady, getRecoveryState, getSecureMatrixClient,
  hasSecureMatrixInitialSync, MatrixSecureError,
} from "./MatrixSecureClient";

function describeEvent(event, ownUserId) {
  const type = event.getType();
  const wireType = event.getWireType?.() || type;
  const content = event.getContent?.() || {};
  const sender = event.getSender?.() || "";
  const timestamp = Number(event.getTs?.() || Date.now());
  const eventId = event.getId?.() || `${sender}:${timestamp}`;

  if (type === "m.room.message" && wireType !== "m.room.encrypted") {
    // E2EE room membership and a room-level encryption state are not enough:
    // a buggy/malicious client can still submit an unencrypted m.room.message.
    // Never show its body in a UI that claims this room is end-to-end encrypted.
    return {
      id: eventId,
      sender,
      timestamp,
      isOwn: sender === ownUserId,
      body: "Unencrypted event rejected. Its content is hidden because it did not arrive through Matrix E2EE.",
      undecryptable: true,
      unencrypted: true,
    };
  }

  if (type === "m.room.encrypted") {
    return {
      id: eventId,
      sender,
      timestamp,
      isOwn: sender === ownUserId,
      body: "This message cannot be decrypted on this device. Verify another device or restore the existing recovery key.",
      undecryptable: true,
    };
  }

  if (type !== "m.room.message") return null;
  let body;
  if (content.msgtype === "m.text" || content.msgtype === "m.notice") {
    body = typeof content.body === "string" ? content.body : "";
  } else if (content.msgtype === "m.emote") {
    body = typeof content.body === "string" ? `• ${content.body}` : "Encrypted message";
  } else {
    body = "Encrypted media or a message type not supported in this first secure-chat release.";
  }

  return {
    id: eventId,
    sender,
    timestamp,
    isOwn: sender === ownUserId,
    body: body || "Encrypted message",
    undecryptable: content.msgtype === "m.bad.encrypted",
  };
}

function getRoomMessages(room, ownUserId) {
  if (!room) return [];
  const events = room.getLiveTimeline?.().getEvents?.() || [];
  const seen = new Set();
  return events
    .map((event) => describeEvent(event, ownUserId))
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

async function nonBlockingRecoveryState(client) {
  try {
    return await getRecoveryState(client);
  } catch {
    return { state: "needs_setup", statusUnavailable: true };
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

export default function SecureChatPanel({ conversation, currentUserId }) {
  const roomId = conversation?.matrix_room_id;
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [recoveryState, setRecoveryState] = useState(null);
  const [matrixClient, setMatrixClient] = useState(null);
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
    setRoomDisplayName(room.name || conversation?.title || "Secure conversation");
    setMessages(getRoomMessages(room, client.getUserId()));
  }, [roomId, conversation?.title]);

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

        const room = client.getRoom(roomId);
        if (!room) {
          throw new MatrixSecureError(
            "No Matrix room or pending invitation arrived for this secure conversation. Ask the sender to retry the invitation from Messenger.",
            "room_not_available",
          );
        }

        const membership = room.getMyMembership?.();
        setRoomDisplayName(room.name || conversation?.title || "Secure conversation");
        setHasMoreHistory(true);

        if (membership === "invite") {
          // An invitee's Rust crypto store may not yet know the room is encrypted:
          // isEncryptionEnabledInRoom() can return false for a room it considers
          // unknown. The backend already verified this immutable room mapping.
          // Joining sends no chat content; encryption is rechecked after membership
          // becomes "join", and outgoing messages remain blocked until then.
          setRecoveryState(await nonBlockingRecoveryState(client));
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

        setRecoveryState(await nonBlockingRecoveryState(client));
        if (cancelled) return;
        setMessages(getRoomMessages(room, client.getUserId()));
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
  }, [roomId, currentUserId, revision, refreshTimeline, conversation?.title]);

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

  const onRecoveryReady = async () => {
    setRecoveryOpen(false);
    if (!matrixClient) return;
    try {
      await assertSecureMessagingReady(matrixClient);
      setRecoveryState(await nonBlockingRecoveryState(matrixClient));
      refreshTimeline(matrixClient);
      setError("");
      const room = matrixClient.getRoom(roomId);
      if (room?.getMyMembership?.() === "invite") setPhase("invited");
      else if (room?.getMyMembership?.() === "join") {
        setPhase(roomHasPendingInvites(room) ? "waiting_for_peer" : "ready");
      } else setPhase("error");
    } catch (err) {
      setError(err?.message || "Encrypted key backup is not ready.");
      setPhase("recovery_required");
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
    }
  };

  const title = roomDisplayName || conversation?.title || "Secure conversation";
  const currentMatrixUser = matrixClient?.getUserId?.() || "";
  const secureFeatureNotice = useMemo(
    () => "This first secure-chat release supports encrypted text messages and Element-style key recovery. Server search, ordinary Messenger file upload, forwarding, reactions, scheduled messages and Jitsi calls are intentionally unavailable in this room.",
    [],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, bgcolor: "background.default" }}>
      <Paper square elevation={0} sx={{ display: "flex", alignItems: "center", px: 2, py: 1.25, gap: 1, borderBottom: "1px solid", borderColor: "divider" }}>
        <LockOutlinedIcon color="success" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography fontWeight={750} noWrap>{title}</Typography>
          <Typography variant="caption" color="text.secondary">
            End-to-end encrypted · {currentMatrixUser || "connecting device"}
          </Typography>
        </Box>
        <IconButton aria-label="Reconnect secure chat" onClick={() => setRevision((value) => value + 1)} disabled={phase === "connecting"}>
          <RefreshIcon />
        </IconButton>
        <Button size="small" onClick={() => setDevicesOpen(true)}>
          Devices
        </Button>
        <Button size="small" startIcon={<KeyIcon />} onClick={() => setRecoveryOpen(true)}>
          Recovery
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
          {recoveryState?.state !== "ready" && (
            <Alert severity="info" sx={{ maxWidth: 540 }}>
              Key recovery is recommended, but it is not required to accept the invitation or send messages. You can configure recovery from the key button after joining.
            </Alert>
          )}
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

      {phase === "ready" && recoveryState?.state !== "ready" && (
        <Alert
          severity="warning"
          sx={{ mx: 1.5, mt: 1 }}
          action={(
            <Button color="inherit" size="small" onClick={() => setRecoveryOpen(true)}>
              Set up recovery
            </Button>
          )}
        >
          {recoveryState?.statusUnavailable
            ? "Encrypted messaging is available, but the recovery status could not be checked. Review key recovery when the connection is restored."
            : recoveryState?.state === "recovery_required"
              ? "Encrypted messaging is available, but this device has not verified the existing key backup. Restore the existing recovery key to recover older history; the app will not overwrite it."
              : "Encrypted messaging is available, but key recovery is not set up. Save a recovery key to reduce the risk of permanently losing history if this device is lost."}
        </Alert>
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
                      <Typography variant="caption" fontWeight={700} color="primary.main">
                        {message.sender}
                      </Typography>
                    )}
                    <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {message.body}
                    </Typography>
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
            <TextField
              fullWidth multiline maxRows={5}
              placeholder="Write an end-to-end encrypted message…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={sending || phase !== "ready"}
              inputProps={{ "aria-label": "Encrypted message" }}
            />
            <Button
              type="submit" variant="contained" aria-label="Send encrypted message"
              disabled={!draft.trim() || sending || phase !== "ready"}
              sx={{ minWidth: 52, alignSelf: "stretch" }}
            >
              {sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
            </Button>
          </Box>
        </>
      )}

      <MatrixRecoveryDialog
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        onReady={onRecoveryReady}
      />
      <MatrixDevicesDialog
        open={devicesOpen}
        onClose={() => setDevicesOpen(false)}
        onCurrentDeviceRevoked={() => {
          setDevicesOpen(false);
          setError("This Matrix device was revoked. Reopen secure chat only after creating a new device and completing the key-recovery flow.");
          setPhase("error");
          setMatrixClient(null);
          setMessages([]);
        }}
      />
    </Box>
  );
}
