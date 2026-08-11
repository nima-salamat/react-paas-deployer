import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Paper, Stack,
  TextField, Typography, Alert, IconButton, Tooltip,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DoneIcon from "@mui/icons-material/Done";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData } from "./api";
import { useTicketNotify } from "./TicketNotifyContext";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};

function SeenTicks({ seen, mine }) {
  if (!mine) return null;
  if (seen) {
    return (
      <Tooltip title="Seen">
        <DoneAllIcon sx={{ fontSize: 16, color: "primary.main", ml: 0.5 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Sent">
      <DoneIcon sx={{ fontSize: 16, color: "text.disabled", ml: 0.5 }} />
    </Tooltip>
  );
}

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscribe, send, connected, userId } = useTicketNotify();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const bottomRef = useRef(null);
  const ticketRef = useRef(null);
  ticketRef.current = ticket;

  const markRead = useCallback(async () => {
    // Only when this detail page is mounted. Skip if tab is hidden (user not looking).
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    try {
      const res = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/read/` });
      const data = res.data?.data || res.data || {};
      const ids = data.message_ids || [];
      if (ids.length && ticketRef.current) {
        const idSet = new Set(ids.map(String));
        setTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: (prev.messages || []).map((m) =>
              idSet.has(String(m.id)) ? { ...m, seen_at: data.last_read_at || new Date().toISOString(), is_seen: true } : m
            ),
          };
        });
      }
    } catch { /* */ }
  }, [id]);

  const load = useCallback(async (silent = false, { mark = true } = {}) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setTicket(unwrapData(res));
      // Only mark as read when the tab is visible; being online alone must not
      // send a seen signal.
      if (mark && typeof document !== "undefined" && document.visibilityState === "visible") {
        setTimeout(() => { markRead(); }, 80);
      }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load ticket");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id, markRead]);

  useEffect(() => { load(); }, [load]);

  // Live events for this ticket
  useEffect(() => {
    send({ type: "subscribe_ticket", ticket_id: Number(id) });
    const unsub = subscribe((ev) => {
      if (String(ev.ticket_id) !== String(id)) return;
      if (ev.type === "ticket.message" || ev.type === "ticket.updated") {
        load(true);
      } else if (ev.type === "ticket.seen") {
        // Other party read our messages
        const ids = (ev.message_ids || []).map(String);
        if (!ids.length) {
          // fallback: mark all my messages as seen
          setTicket((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: (prev.messages || []).map((m) => {
                const mine = userId != null && m.author?.id != null && String(m.author.id) === String(userId);
                return mine ? { ...m, seen_at: m.seen_at || new Date().toISOString(), is_seen: true } : m;
              }),
            };
          });
          return;
        }
        const idSet = new Set(ids);
        setTicket((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: (prev.messages || []).map((m) =>
              idSet.has(String(m.id)) ? { ...m, seen_at: new Date().toISOString(), is_seen: true } : m
            ),
          };
        });
      }
    });
    return () => {
      send({ type: "unsubscribe_ticket", ticket_id: Number(id) });
      unsub();
    };
  }, [id, send, subscribe, load, userId]);

  // Re-mark read only when this ticket detail becomes visible again.
  // Presence on WS (online) must never imply seen.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead]);

  // Polling fallback when WS offline
  useEffect(() => {
    if (connected) return undefined;
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, [connected, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("body", reply.trim().includes("<") ? reply : `<p>${reply.replace(/\n/g, "<br>")}</p>`);
      files.forEach((f) => form.append("attachments", f));
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/messages/`, data: form });
      setReply("");
      setFiles([]);
      await load(true);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/close/` });
      await load(true);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to close");
    }
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!ticket) return <Alert severity="error">{error || "Not found"}</Alert>;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 960, mx: "auto" }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2} flexWrap="wrap">
        <IconButton onClick={() => navigate("/tickets")}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>{ticket.public_id}</Typography>
        <Chip size="small" label={ticket.status} color={STATUS_COLOR[ticket.status] || "default"} />
        <Chip size="small" label={ticket.priority} variant="outlined" />
        <Chip
          size="small"
          variant="outlined"
          icon={<FiberManualRecordIcon />}
          label={connected ? "Live" : "Offline"}
          color={connected ? "success" : "default"}
        />
      </Stack>

      <Paper sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="h6">{ticket.subject}</Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {ticket.department?.name} · Created {new Date(ticket.created_at).toLocaleString()}
        </Typography>
        {(ticket.service || ticket.deploy) && (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {ticket.service?.name ? `Service: ${ticket.service.name}` : ""}
            {ticket.deploy ? ` · Deploy: ${ticket.deploy.name || ticket.deploy.version || ""}` : ""}
          </Typography>
        )}
        {!closed && (
          <Button size="small" color="inherit" sx={{ mt: 1 }} onClick={closeTicket}>Close ticket</Button>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Stack spacing={1.5} mb={3}>
        {(ticket.messages || []).map((m) => {
          const mine = userId != null && m.author?.id != null && String(m.author.id) === String(userId);
          return (
            <Paper
              key={m.id}
              elevation={0}
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: m.is_staff_reply ? "action.hover" : "background.paper",
                borderColor: m.is_staff_reply ? "primary.light" : "divider",
              }}
            >
              <Stack direction="row" gap={1.5} alignItems="flex-start">
                <Avatar sx={{ width: 36, height: 36 }}>
                  {(m.author?.username || "?")[0]?.toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Stack direction="row" justifyContent="space-between" flexWrap="wrap" alignItems="center">
                    <Typography fontWeight={600}>
                      {m.author?.username || "User"}
                      {m.is_staff_reply ? " (Staff)" : ""}
                    </Typography>
                    <Stack direction="row" alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {new Date(m.created_at).toLocaleString()}
                      </Typography>
                      <SeenTicks seen={Boolean(m.seen_at || m.is_seen)} mine={mine} />
                    </Stack>
                  </Stack>
                  <Box sx={{ mt: 1, "& p": { m: 0 } }} dangerouslySetInnerHTML={{ __html: m.body }} />
                  {(m.attachments || []).map((a) => (
                    <Button key={a.id} size="small" href={a.download_url} target="_blank" rel="noopener">
                      {a.original_filename}
                    </Button>
                  ))}
                </Box>
              </Stack>
            </Paper>
          );
        })}
        <div ref={bottomRef} />
      </Stack>

      {!closed && (
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={600} mb={1}>Reply</Typography>
          <TextField
            fullWidth multiline minRows={4} value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply…"
          />
          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5}>
            <Button component="label" size="small">
              Attach
              <input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </Button>
            <Button variant="contained" disabled={sending || !reply.trim()} onClick={sendReply}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
