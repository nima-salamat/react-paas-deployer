import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Chip, CircularProgress, Stack, Typography, Alert, IconButton,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData } from "./api";
import { useTicketNotify } from "./TicketNotifyContext";
import MessageBubble from "./MessageBubble";
import ChatComposer from "./ChatComposer";
import { htmlToPlain } from "./SimpleHtmlEditor";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscribe, send, connected, userId } = useTicketNotify();
  const [ticket, setTicket] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  const applySeenLocal = useCallback((ids, at) => {
    if (!ids?.length) return;
    const idSet = new Set(ids.map(String));
    setTicket((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: (prev.messages || []).map((m) =>
          idSet.has(String(m.id))
            ? { ...m, seen_at: at || new Date().toISOString(), is_seen: true }
            : m
        ),
      };
    });
  }, []);

  const markRead = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    try {
      const res = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/read/` });
      const data = res.data?.data || res.data || {};
      applySeenLocal(data.message_ids || [], data.last_read_at);
    } catch { /* */ }
  }, [id, applySeenLocal]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setInitialLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setTicket(unwrapData(res));
      setError("");
    } catch (e) {
      if (!silent) setError(e?.response?.data?.message || "Failed to load ticket");
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load({ silent: false }); }, [load]);

  useEffect(() => {
    if (!ticket) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const t = setTimeout(() => markRead(), 120);
    return () => clearTimeout(t);
  }, [ticket?.messages?.length, markRead, ticket]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [markRead]);

  useEffect(() => {
    send({ type: "subscribe_ticket", ticket_id: Number(id) });
    const unsub = subscribe((ev) => {
      if (String(ev.ticket_id) !== String(id)) return;
      if (ev.type === "ticket.message" || ev.type === "ticket.updated") {
        load({ silent: true });
      } else if (ev.type === "ticket.seen") {
        const ids = (ev.message_ids || []).map(String);
        if (!ids.length) {
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
        } else {
          applySeenLocal(ids);
        }
      }
    });
    return () => {
      send({ type: "unsubscribe_ticket", ticket_id: Number(id) });
      unsub();
    };
  }, [id, send, subscribe, load, userId, applySeenLocal]);

  useEffect(() => {
    if (connected) return undefined;
    const t = setInterval(() => load({ silent: true }), 8000);
    return () => clearInterval(t);
  }, [connected, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages?.length]);

  const sendReply = async () => {
    if (!htmlToPlain(reply) && !files.length) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("body", htmlToPlain(reply) ? reply : "<p></p>");
      files.forEach((f) => form.append("attachments", f));
      const res = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/messages/`, data: form });
      const created = res.data?.data || res.data;
      setReply("");
      setFiles([]);
      if (created && created.id) {
        setTicket((prev) => {
          if (!prev) return prev;
          const exists = (prev.messages || []).some((m) => String(m.id) === String(created.id));
          if (exists) {
            return {
              ...prev,
              messages: prev.messages.map((m) =>
                String(m.id) === String(created.id) ? { ...m, ...created } : m
              ),
            };
          }
          return { ...prev, messages: [...(prev.messages || []), created] };
        });
      }
      await load({ silent: true });
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  if (initialLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !ticket) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!ticket) return null;

  return (
    <Box
      sx={{
        height: { xs: "calc(100vh - 64px)", md: "calc(100vh - 80px)" },
        maxWidth: 900,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          flexShrink: 0,
        }}
      >
        <IconButton onClick={() => navigate("/tickets")} size="small"><ArrowBackIcon /></IconButton>
        <Box flex={1} minWidth={0}>
          <Typography variant="subtitle1" fontWeight={700} noWrap>{ticket.subject}</Typography>
          <Typography variant="caption" color="text.secondary">
            {ticket.public_id}
            {refreshing ? " · updating…" : connected ? " · live" : " · offline"}
          </Typography>
        </Box>
        <Chip size="small" label={ticket.status} color={STATUS_COLOR[ticket.status] || "default"} />
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ borderRadius: 0 }} onClose={() => setError("")}>{error}</Alert>
      )}

      {/* Messages */}
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          px: 1,
          py: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.100"),
        }}
      >
        {(ticket.messages || []).map((m) => {
          const mine = userId != null && m.author?.id != null && String(m.author.id) === String(userId);
          return <MessageBubble key={m.id} message={m} mine={mine} />;
        })}
        <div ref={bottomRef} />
      </Box>

      {/* Composer */}
      {ticket.status === "closed" ? (
        <Alert severity="info" sx={{ borderRadius: 0 }}>This ticket is closed.</Alert>
      ) : (
        <ChatComposer
          value={reply}
          onChange={setReply}
          files={files}
          onFilesChange={setFiles}
          onSend={sendReply}
          sending={sending}
        />
      )}
    </Box>
  );
}
