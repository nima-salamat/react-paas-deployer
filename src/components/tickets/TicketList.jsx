import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Pagination, Alert,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API } from "./api";
import { useTicketNotify } from "./TicketNotifyContext";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
const PRIORITY_COLOR = { low: "default", normal: "info", high: "warning", urgent: "error" };
const UNREAD_KEY = "tickets_unread_ids_v1";

function loadUnread() {
  try {
    const raw = sessionStorage.getItem(UNREAD_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveUnread(set) {
  try {
    sessionStorage.setItem(UNREAD_KEY, JSON.stringify([...set]));
  } catch { /* */ }
}

export default function TicketList() {
  const { subscribe, connected } = useTicketNotify();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [unreadIds, setUnreadIds] = useState(() => loadUnread());
  const firstLoad = useRef(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (firstLoad.current || !silent) {
      if (firstLoad.current) setInitialLoading(true);
      else setRefreshing(true);
    } else {
      setRefreshing(true);
    }
    setError("");
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/`, params });
      const data = res.data;
      const results = data.results || data.data || (Array.isArray(data) ? data : []);
      setTickets(Array.isArray(results) ? results : []);
      setCount(typeof data.count === 'number' ? data.count : (results.length || 0));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tickets");
      if (firstLoad.current) setTickets([]);
    } finally {
      firstLoad.current = false;
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [page, search, status, priority]);

  useEffect(() => {
    const t = setTimeout(() => load({ silent: !firstLoad.current }), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    return subscribe((ev) => {
      if (!ev?.type) return;
      if (ev.type === "ticket.message" || ev.type === "ticket.updated" || ev.type === "ticket.created") {
        load({ silent: true });
        if (ev.type === "ticket.message" && ev.ticket_id != null) {
          setUnreadIds((prev) => {
            const next = new Set(prev);
            next.add(String(ev.ticket_id));
            saveUnread(next);
            return next;
          });
        }
      }
    });
  }, [subscribe, load]);

  const openTicket = (id) => {
    setUnreadIds((prev) => {
      const next = new Set(prev);
      next.delete(String(id));
      saveUnread(next);
      return next;
    });
    navigate(`/tickets/${id}`);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} gap={1} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>My tickets</Typography>
          <Typography variant="caption" color="text.secondary">
            {connected ? "Live updates on" : "Live offline"}
            {refreshing ? " · refreshing…" : ""}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => navigate("/tickets/new")}>New ticket</Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} gap={1.5} mb={2}>
        <TextField size="small" label="Search" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} fullWidth />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <MenuItem value="">All</MenuItem>
            {Object.keys(STATUS_COLOR).map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Priority</InputLabel>
          <Select label="Priority" value={priority} onChange={(e) => { setPage(1); setPriority(e.target.value); }}>
            <MenuItem value="">All</MenuItem>
            {Object.keys(PRIORITY_COLOR).map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </Select>
        </FormControl>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {initialLoading ? (
        <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
      ) : (
        <Paper variant="outlined" sx={{ position: "relative", opacity: refreshing ? 0.85 : 1, transition: "opacity .2s" }}>
          {refreshing && (
            <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
              <CircularProgress size={18} />
            </Box>
          )}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={28} />
                <TableCell>ID</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" align="center" py={3}>No tickets</Typography>
                  </TableCell>
                </TableRow>
              ) : tickets.map((t) => {
                const hasUnread = unreadIds.has(String(t.id));
                return (
                  <TableRow
                    key={t.id}
                    hover
                    sx={{ cursor: "pointer", bgcolor: hasUnread ? "action.selected" : undefined }}
                    onClick={() => openTicket(t.id)}
                  >
                    <TableCell sx={{ px: 1 }}>
                      {hasUnread ? (
                        <Badge color="error" variant="dot" overlap="circular">
                          <FiberManualRecordIcon sx={{ fontSize: 12, color: "error.main" }} />
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={hasUnread ? 700 : 400}>{t.public_id}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={hasUnread ? 700 : 400} noWrap sx={{ maxWidth: 320 }}>
                        {t.subject}
                      </Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                    <TableCell><Chip size="small" label={t.priority} color={PRIORITY_COLOR[t.priority] || "default"} variant="outlined" /></TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {t.last_message_at || t.updated_at
                          ? new Date(t.last_message_at || t.updated_at).toLocaleString()
                          : "—"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {Math.ceil((count || 0) / 10) > 1 && (
            <Box display="flex" justifyContent="center" py={1.5}>
              <Pagination
                page={page}
                count={Math.max(1, Math.ceil((count || 0) / 10))}
                onChange={(_, p) => setPage(p)}
                color="primary"
                showFirstButton
                showLastButton
              />
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
