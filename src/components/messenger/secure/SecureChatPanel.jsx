import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Divider, IconButton, Paper,
  Stack, TextField, Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import KeyIcon from "@mui/icons-material/Key";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import MatrixRecoveryDialog from "./MatrixRecoveryDialog";
import {
  assertSecureMessagingReady, getRecoveryState, getSecureMatrixClient,
  MatrixSecureError,
} from "./MatrixSecureClient";

function describeEvent(event, ownUserId) {
  const type = event.getType();
  const content = event.getContent?.() || {};
  const sender = event.getSender?.() || "";
  const timestamp = Number(event.getTs?.() || Date.now());
  const eventId = event.getId?.() || `${sender}:${timestamp}`;

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

function waitForSync(client) {
  if (client.getSyncState?.() === "SYNCING") return Promise.resolve();
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
      if (state === "SYNCING" || state === "PREPARED") finish();
      if (state === "ERROR" || state === "STOPPED") {
        finish(new MatrixSecureError("The Matrix device could not synchronize encrypted rooms.", "sync_failed"));
      }
    };
    const timeout = setTimeout(() => finish(
      new MatrixSecureError("Matrix synchronization timed out. Secure chat remains unavailable.", "sync_timeout"),
    ), 20000);
    client.on("sync", onSync);
  });
}

export default function SecureChatPanel({ conversation, currentUserId }) {
  const roomId = conversation?.matrix_room_id;
  const [phase, setPhase] = useState("connecting");
  const [error, setError] = useState("");
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryState, setRecoveryState] = useState(null);
  const [matrixClient, setMatrixClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
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
    const onTimeline = (event, room) => {
      if (!room || room.roomId !== roomId) return;
      refreshTimeline(activeClient);
    };
    const onDecrypted = () => refreshTimeline(activeClient);
    const onSync = (state) => {
      if (state === "ERROR") {
        setError("Matrix synchronization failed. Messages are not being sent through the normal Messenger path.");
      }
      if (state === "SYNCING" || state === "PREPARED") refreshTimeline(activeClient);
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
        let room = client.getRoom(roomId);
        if (room?.getMyMembership?.() === "invite") {
          await client.joinRoom(roomId);
          room = client.getRoom(roomId);
        } else if (!room) {
          try {
            await client.joinRoom(roomId);
          } catch {
            // The next check reports a safe, actionable state. Never use Django
            // message history as a substitute for a Matrix room.
          }
          room = client.getRoom(roomId);
        }
        if (!room) {
          throw new MatrixSecureError(
            "This Matrix room is not available to the current device. Confirm the invitation or ask a group admin to restore membership.",
            "room_not_available",
          );
        }
        const isEncrypted = await client.getCrypto().isEncryptionEnabledInRoom(roomId);
        if (!isEncrypted) {
          throw new MatrixSecureError(
            "The mapped Matrix room is not confirmed as end-to-end encrypted. Sending is blocked.",
            "room_not_encrypted",
          );
        }
        const state = await getRecoveryState(client);
        if (cancelled) return;
        setRecoveryState(state);
        setMatrixClient(client);
        setRoomDisplayName(room.name || conversation?.title || "Secure conversation");
        setMessages(getRoomMessages(room, client.getUserId()));
        client.on("Room.timeline", onTimeline);
        client.on("Event.decrypted", onDecrypted);
        client.on("sync", onSync);
        setPhase(state.state === "ready" ? "ready" : "recovery_required");
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
      }
    };
  }, [roomId, currentUserId, revision, refreshTimeline, conversation?.title]);

  const onRecoveryReady = async () => {
    setRecoveryOpen(false);
    if (!matrixClient) return;
    try {
      await assertSecureMessagingReady(matrixClient);
      setRecoveryState(await getRecoveryState(matrixClient));
      refreshTimeline(matrixClient);
      setError("");
      setPhase("ready");
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

      {phase === "recovery_required" && (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 2, p: 4, flex: 1 }}>
          <KeyIcon color="warning" sx={{ fontSize: 42 }} />
          <Typography fontWeight={700}>
            {recoveryState?.state === "needs_setup" ? "Set up encrypted history recovery" : "Restore encrypted history"}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={500}>
            {recoveryState?.state === "needs_setup"
              ? "Before sending, create a key backup and save its recovery key somewhere separate from this browser."
              : "This device does not yet have the trusted key material needed for history. Restore the existing recovery key, or use a trusted existing device. The account password alone cannot unlock older messages."}
          </Typography>
          <Button variant="contained" startIcon={<KeyIcon />} onClick={() => setRecoveryOpen(true)}>
            Configure or restore keys
          </Button>
        </Box>
      )}

      {phase === "ready" && (
        <>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: { xs: 1.5, md: 3 }, py: 2 }}>
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
    </Box>
  );
}
