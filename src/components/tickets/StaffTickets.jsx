import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Divider, FormControl,
  InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, Pagination, Alert, Drawer,
  IconButton, Toolbar,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API } from "./api";
import { useTicketNotify } from "./TicketNotifyContext";
import MessageBubble from "./MessageBubble";
import SimpleHtmlEditor, { htmlToPlain } from "./SimpleHtmlEditor";
import PendingFilesBar from "./PendingFilesBar";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
const PRIORITY_COLOR = { low: "default", normal: "info", high: "warning", urgent: "error" };

export default function StaffTickets() {
  const { subscribe, connected } = useTicketNotify();
  const selectedIdRef = useRef(null);
  const openDetailRef = useRef(async () => {});

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoadRef = useRef(true);
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

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  const loadList = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent);
    if (!silent && firstLoadRef.current) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (department) params.department = department;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/`, params });
      const data = res.data;
      const results = data.results || data.data || data;
      setTickets(Array.isArray(results) ? results : []);
      setCount(typeof data.count === 'number' ? data.count : (Array.isArray(results) ? results.length : 0));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tickets (staff only)");
      if (firstLoadRef.current) setTickets([]);
    } finally {
      firstLoadRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, status, priority, department]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/departments/`, params: { all: "1" } });
        const data = res.data?.data || res.data || [];
        setDepartments(Array.isArray(data) ? data : []);
      } catch { /* */ }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadList(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => {
    return subscribe((ev) => {
      if (!ev?.type) return;
      if (ev.type === "ticket.message" || ev.type === "ticket.created" || ev.type === "ticket.updated") {
        loadList({ silent: true });
        const sid = selectedIdRef.current;
        if (sid != null && String(sid) === String(ev.ticket_id)) openDetailRef.current?.(sid);
      } else if (ev.type === "ticket.seen") {
        const sid = selectedIdRef.current;
        if (sid != null && String(sid) === String(ev.ticket_id)) openDetailRef.current?.(sid);
      }
    });
  }, [subscribe, loadList]);

  const openDetail = async (id, opts = {}) => {
    const silent = Boolean(opts.silent);
    setSelectedId(id);
    selectedIdRef.current = id;
    if (!silent) {
      setDetailLoading(true);
      setReply("");
      setFiles([]);
    }
    setActionError("");
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setDetail(res.data?.data || res.data);
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        try {
          const rr = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/read/` });
          const rd = rr.data?.data || rr.data || {};
          const ids = new Set((rd.message_ids || []).map(String));
          if (ids.size) {
            setDetail((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: (prev.messages || []).map((m) =>
                  ids.has(String(m.id))
                    ? { ...m, seen_at: rd.last_read_at || new Date().toISOString(), is_seen: true }
                    : m
                ),
              };
            });
          }
        } catch { /* */ }
      }
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to load ticket");
    } finally {
      setDetailLoading(false);
    }
  };
  openDetailRef.current = (id) => openDetail(id, { silent: true });

  const changeStatus = async (newStatus) => {
    if (!selectedId) return;
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/status/`, data: { status: newStatus } });
      await openDetail(selectedId, { silent: true });
      loadList({ silent: true });
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to update status");
    }
  };

  const changePriority = async (newPriority) => {
    if (!selectedId) return;
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/priority/`, data: { priority: newPriority } });
      await openDetail(selectedId, { silent: true });
      loadList({ silent: true });
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to update priority");
    }
  };

  const sendReply = async () => {
    if ((!htmlToPlain(reply) && !files.length) || !selectedId) return;
    setSending(true);
    setActionError("");
    try {
      const form = new FormData();
      form.append("body", htmlToPlain(reply) ? reply : "<p></p>");
      files.forEach((f) => form.append("attachments", f));
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${selectedId}/messages/`, data: form });
      setReply("");
      setFiles([]);
      await openDetail(selectedId, { silent: true });
      loadList({ silent: true });
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Staff tickets</Typography>
          <Typography variant="caption" color="text.secondary">
            {connected ? "Live on" : "Live offline"}{refreshing ? " · refreshing…" : ""}
          </Typography>
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} gap={1.5} mb={2}>
        <TextField size="small" label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} fullWidth />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {Object.keys(STATUS_COLOR).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Priority</InputLabel>
          <Select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {Object.keys(PRIORITY_COLOR).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Department</InputLabel>
          <Select label="Department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : (
        <Paper variant="outlined" sx={{ opacity: refreshing ? 0.85 : 1 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} hover selected={selectedId === t.id} sx={{ cursor: "pointer" }} onClick={() => openDetail(t.id)}>
                  <TableCell>{t.public_id}</TableCell>
                  <TableCell>{t.subject}</TableCell>
                  <TableCell>{t.user?.username || "—"}</TableCell>
                  <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                  <TableCell><Chip size="small" label={t.priority} color={PRIORITY_COLOR[t.priority] || "default"} variant="outlined" /></TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {t.last_message_at || t.updated_at ? new Date(t.last_message_at || t.updated_at).toLocaleString() : "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {Math.ceil((count || 0) / 15) > 1 && (
            <Box display="flex" justifyContent="center" py={1.5}>
              <Pagination page={page} count={Math.max(1, Math.ceil((count || 0) / 15))} onChange={(_, p) => setPage(p)} color="primary" showFirstButton showLastButton />
            </Box>
          )}
        </Paper>
      )}

      <Drawer
        anchor="right"
        open={Boolean(selectedId)}
        onClose={() => { setSelectedId(null); setDetail(null); }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, maxWidth: "100vw" } }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography fontWeight={700}>{detail?.public_id || "Ticket"}</Typography>
          <IconButton onClick={() => { setSelectedId(null); setDetail(null); }}><CloseIcon /></IconButton>
        </Toolbar>
        <Box sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
          {detailLoading && !detail && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}
          {actionError && <Alert severity="error" sx={{ mb: 1 }}>{actionError}</Alert>}
          {detail && (
            <>
              <Typography variant="h6">{detail.subject}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {detail.user?.username} · {detail.user?.email}
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} gap={1} mb={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={detail.status} onChange={(e) => changeStatus(e.target.value)}>
                    {Object.keys(STATUS_COLOR).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select label="Priority" value={detail.priority} onChange={(e) => changePriority(e.target.value)}>
                    {Object.keys(PRIORITY_COLOR).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <Typography fontWeight={600} mb={1}>Conversation</Typography>
              <Box sx={{
                flex: 1, minHeight: 280, maxHeight: "calc(100vh - 320px)", overflow: "auto",
                display: "flex", flexDirection: "column", gap: 1.1, p: 1, mb: 1.5,
                bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.100"),
                borderRadius: 2, border: "none",
              }}>
                {(detail.messages || []).map((m) => (
                  <MessageBubble key={m.id} message={m} mine={Boolean(m.is_staff_reply)} showHtmlToggle />
                ))}
              </Box>
              {detail.status !== "closed" && (
                <Box>
                  <SimpleHtmlEditor value={reply} onChange={setReply} minHeight={100} disabled={sending} />
                  <PendingFilesBar
                    files={files}
                    onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    onClear={() => setFiles([])}
                  />
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1} gap={1}>
                    <Button component="label" size="small" variant="outlined">
                      Attach
                      <input
                        hidden
                        type="file"
                        multiple
                        accept="image/*,audio/*,video/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || []);
                          setFiles((prev) => [...prev, ...picked].slice(0, 5));
                          e.target.value = "";
                        }}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary" flex={1}>
                      {files.length ? `${files.length} selected` : "Images, audio, video, docs"}
                    </Typography>
                    <Button variant="contained" disabled={sending || (!htmlToPlain(reply) && !files.length)} onClick={sendReply}>
                      {sending ? "Sending…" : "Send reply"}
                    </Button>
                  </Stack>
                </Box>
              )}
            </>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
