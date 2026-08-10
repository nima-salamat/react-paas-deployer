import React, { useCallback, useEffect, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem,
  Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography, Pagination, Alert,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapList } from "./api";
import { useTicketNotify } from "./TicketNotifyContext";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
const PRIORITY_COLOR = { low: "default", normal: "info", high: "warning", urgent: "error" };

export default function TicketList() {
  const { subscribe, connected } = useTicketNotify();
  const [tick, setTick] = useState(0);

  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
      setCount(data.count || results.length || 0);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load tickets");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, status, priority]);

  
  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === "ticket.message" || ev.type === "ticket.updated" || ev.type === "ticket.created") {
        // soft reload list
        setTick((n) => n + 1);
      }
    });
  }, [subscribe]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, tick]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems="center" mb={3} gap={2}>
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="h5" fontWeight={700}>Support Tickets</Typography>
          <Chip size="small" label={connected ? "Live" : "Offline"} color={connected ? "success" : "default"} variant="outlined" />
        </Stack>
        <Button variant="contained" onClick={() => navigate("/tickets/new")}>New Ticket</Button>
      </Stack>
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
        </Stack>
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
      {loading ? (
        <Box display="flex" justifyContent="center" p={6}><CircularProgress /></Box>
      ) : tickets.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography color="text.secondary">No tickets found.</Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate("/tickets/new")}>Create your first ticket</Button>
        </Paper>
      ) : (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                <TableCell>Subject</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/tickets/${t.id}`)}>
                  <TableCell>{t.public_id}</TableCell>
                  <TableCell>{t.subject}</TableCell>
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
    </Box>
  );
}
