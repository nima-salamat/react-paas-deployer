import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Paper, Stack,
  TextField, Typography, Alert, IconButton,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData } from "./api";

const STATUS_COLOR = { open: "info", in_progress: "warning", waiting_user: "secondary", resolved: "success", closed: "default" };

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setTicket(unwrapData(res));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/close/` });
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to close");
    }
  };

  if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (!ticket) return <Alert severity="error">{error || "Not found"}</Alert>;
  const closed = ticket.status === "closed" || ticket.status === "resolved";

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: "auto" }}>
      <Stack direction="row" alignItems="center" gap={1} mb={2}>
        <IconButton onClick={() => navigate("/tickets")}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" fontWeight={700}>{ticket.public_id}</Typography>
        <Chip size="small" label={ticket.status} color={STATUS_COLOR[ticket.status] || "default"} />
        <Chip size="small" label={ticket.priority} variant="outlined" />
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
        {!closed && <Button size="small" color="inherit" sx={{ mt: 1 }} onClick={closeTicket}>Close ticket</Button>}
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Stack spacing={2} mb={3}>
        {(ticket.messages || []).map((m) => (
          <Paper key={m.id} sx={{ p: 2, bgcolor: m.is_staff_reply ? "action.hover" : "background.paper" }}>
            <Stack direction="row" gap={1.5} alignItems="flex-start">
              <Avatar sx={{ width: 36, height: 36 }}>{(m.author?.username || "?")[0]?.toUpperCase()}</Avatar>
              <Box flex={1}>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap">
                  <Typography fontWeight={600}>{m.author?.username || "User"}{m.is_staff_reply ? " (Staff)" : ""}</Typography>
                  <Typography variant="caption" color="text.secondary">{new Date(m.created_at).toLocaleString()}</Typography>
                </Stack>
                <Box sx={{ mt: 1, "& p": { m: 0 } }} dangerouslySetInnerHTML={{ __html: m.body }} />
                {(m.attachments || []).map((a) => (
                  <Button key={a.id} size="small" href={a.download_url} target="_blank" rel="noopener">{a.original_filename}</Button>
                ))}
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
      {!closed && (
        <Paper sx={{ p: 2 }}>
          <Typography fontWeight={600} mb={1}>Reply</Typography>
          <TextField fullWidth multiline minRows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply…" />
          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5}>
            <Button component="label" size="small">Attach<input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></Button>
            <Button variant="contained" disabled={sending || !reply.trim()} onClick={sendReply}>{sending ? "Sending…" : "Send"}</Button>
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
