import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Divider, FormControl,
  InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, Pagination, Alert, Drawer,
  IconButton, Toolbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData, unwrapList } from "./api";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
const PRIORITY_COLOR = { low: "default", normal: "info", high: "warning", urgent: "error" };

export default function StaffTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState([]);

  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [files, setFiles] = useState([]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (department) params.department = department;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/", params });
      const data = res.data;
      const results = data.results || data.data || data;
      setTickets(Array.isArray(results) ? results : []);
      setCount(data.count || (Array.isArray(results) ? results.length : 0));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tickets (staff only)");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority, department]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/departments/", params: { all: "1" } });
        const data = res.data?.data || res.data || [];
        setDepartments(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadList, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setActionError("");
    setReply("");
    setFiles([]);
    try {
      const res = await apiRequest({ method: "GET", url: `/api/tickets/${id}/` });
      setDetail(res.data?.data || res.data);
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to load ticket");
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (newStatus) => {
    if (!selectedId) return;
    try {
      await apiRequest({ method: "POST", url: `/api/tickets/staff/${selectedId}/status/`, data: { status: newStatus } });
      await openDetail(selectedId);
      loadList();
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to update status");
    }
  };

  const changePriority = async (newPriority) => {
    if (!selectedId) return;
    try {
      await apiRequest({ method: "POST", url: `/api/tickets/staff/${selectedId}/priority/`, data: { priority: newPriority } });
      await openDetail(selectedId);
      loadList();
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to update priority");
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    setActionError("");
    try {
      const form = new FormData();
      form.append("body", reply.trim().includes("<") ? reply : `<p>${reply.replace(/\n/g, "<br>")}</p>`);
      files.forEach((f) => form.append("attachments", f));
      await apiRequest({ method: "POST", url: `/api/tickets/${selectedId}/messages/`, data: form });
      setReply("");
      setFiles([]);
      await openDetail(selectedId);
      loadList();
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Staff — Support Tickets</Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={2}>
          <TextField size="small" label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} fullWidth />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="waiting_user">Waiting for User</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Department</InputLabel>
            <Select label="Department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
      ) : tickets.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">No tickets in your departments.</Typography>
        </Paper>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} hover sx={{ cursor: "pointer" }} selected={selectedId === t.id} onClick={() => openDetail(t.id)}>
                  <TableCell>{t.public_id}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell>{t.user?.username || "—"}</TableCell>
                  <TableCell>{t.service?.name || "—"}</TableCell>
                  <TableCell>{t.department?.name || "—"}</TableCell>
                  <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                  <TableCell><Chip size="small" label={t.priority} color={PRIORITY_COLOR[t.priority] || "default"} variant="outlined" /></TableCell>
                  <TableCell>{t.last_message_at || t.updated_at ? new Date(t.last_message_at || t.updated_at).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {count > 15 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination page={page} count={Math.ceil(count / 15)} onChange={(_, v) => setPage(v)} />
            </Box>
          )}
        </Paper>
      )}

      <Drawer anchor="right" open={Boolean(selectedId)} onClose={() => { setSelectedId(null); setDetail(null); }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 480, md: 560 } } }}>
        <Toolbar sx={{ justifyContent: "space-between", px: 2 }}>
          <Typography fontWeight={700}>{detail?.public_id || "Ticket"}</Typography>
          <IconButton onClick={() => { setSelectedId(null); setDetail(null); }}><CloseIcon /></IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ p: 2, overflow: "auto" }}>
          {detailLoading && <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>}
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          {detail && !detailLoading && (
            <>
              <Typography variant="h6" gutterBottom>{detail.subject}</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mb={1}>
                <Chip size="small" label={detail.status} color={STATUS_COLOR[detail.status] || "default"} />
                <Chip size="small" label={detail.priority} variant="outlined" />
                <Chip size="small" label={detail.department?.name || "—"} variant="outlined" />
              </Stack>
              <Typography variant="body2" color="text.secondary" mb={1}>
                User: {detail.user?.username} ({detail.user?.email || "—"})
              </Typography>
              {(detail.service || detail.deploy) && (
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {detail.service?.name ? `Service: ${detail.service.name}` : ""}
                  {detail.deploy ? ` · Deploy: ${detail.deploy.name || detail.deploy.version || detail.deploy.id}` : ""}
                </Typography>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={detail.status} onChange={(e) => changeStatus(e.target.value)}>
                    <MenuItem value="open">Open</MenuItem>
                    <MenuItem value="in_progress">In Progress</MenuItem>
                    <MenuItem value="waiting_user">Waiting for User</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                    <MenuItem value="closed">Closed</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select label="Priority" value={detail.priority} onChange={(e) => changePriority(e.target.value)}>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography fontWeight={600} mb={1}>Conversation</Typography>
              <Stack spacing={1.5} mb={2} sx={{ maxHeight: 360, overflow: "auto" }}>
                {(detail.messages || []).map((m) => (
                  <Paper key={m.id} variant="outlined" sx={{ p: 1.5, bgcolor: m.is_staff_reply ? "action.hover" : "background.paper" }}>
                    <Stack direction="row" gap={1} alignItems="flex-start">
                      <Avatar sx={{ width: 32, height: 32 }}>{(m.author?.username || "?")[0]?.toUpperCase()}</Avatar>
                      <Box flex={1}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" fontWeight={600}>
                            {m.author?.username || "User"}{m.is_staff_reply ? " (Staff)" : ""}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{new Date(m.created_at).toLocaleString()}</Typography>
                        </Stack>
                        <Box sx={{ mt: 0.5, fontSize: 14, "& p": { m: 0 } }} dangerouslySetInnerHTML={{ __html: m.body }} />
                        {(m.attachments || []).map((a) => (
                          <Button key={a.id} size="small" href={a.download_url} target="_blank" rel="noopener">{a.original_filename}</Button>
                        ))}
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              {detail.status !== "closed" && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography fontWeight={600} mb={1}>Reply as staff</Typography>
                  <TextField fullWidth multiline minRows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" />
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                    <Button component="label" size="small">Attach<input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></Button>
                    <Button variant="contained" disabled={sending || !reply.trim()} onClick={sendReply}>
                      {sending ? "Sending…" : "Send reply"}
                    </Button>
                  </Stack>
                  {files.length > 0 && <Typography variant="caption">{files.map((f) => f.name).join(", ")}</Typography>}
                </Paper>
              )}
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
