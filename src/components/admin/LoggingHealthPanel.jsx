import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";

/**
 * Admin logging health dashboard.
 * Mount via existing admin router, e.g.:
 *   <Route path="/admin/logging" element={<LoggingHealthPanel />} />
 * Or Wagtail custom view embedding this SPA fragment.
 */
export default function LoggingHealthPanel({ apiPath = "/api/service/admin/logging/health/" }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access");
      const resp = await axios.get(apiPath, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setData(resp.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Failed to load logging health");
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  if (loading && !data) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
  if (error && !data) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

  const collectors = data?.collectors || [];
  const totals = data?.totals || {};
  const top = data?.top_services_by_storage || [];
  const statusColor =
    data?.overall_status === "healthy"
      ? "success"
      : data?.overall_status === "disconnected"
        ? "error"
        : "warning";

  return (
    <Stack spacing={2} sx={{ p: 2, maxWidth: 1100 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5" fontWeight={800}>Logging health</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={data?.overall_status || "unknown"} color={statusColor} />
          <Button size="small" onClick={load}>Refresh</Button>
        </Stack>
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Subsystem</Typography>
        <Typography variant="body2">
          Log DB: {data?.db_ok ? "ok" : "down"} · Redis/cache: {data?.redis_ok ? "ok" : "down"}
          {data?.ingestion_lag_seconds != null ? ` · lag ${Math.round(data.ingestion_lag_seconds)}s` : ""}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Retention task: {data?.retention_task} · Reconcile: {data?.reconcile_task}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          Storage: {Math.round((totals.storage || 0) / 1024 / 1024)} MB · Entries: {totals.entries || 0} · Dropped: {totals.dropped || 0}
        </Typography>
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Collectors</Typography>
        {collectors.map((c) => (
          <Box key={c.instance_id} sx={{ mb: 1.25 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={c.status || "unknown"} color={c.status === "healthy" ? "success" : "warning"} />
              <Typography variant="body2" fontFamily="monospace">{c.instance_id}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              heartbeat {c.last_heartbeat || "—"} · last ingest {c.last_successful_ingestion || "—"} ·
              streams {c.active_streams} · containers {c.active_containers} · buffer {c.buffer_bytes}B ·
              dropped {c.dropped_entries}/{c.dropped_bytes}B
              {c.last_error ? ` · error: ${c.last_error}` : ""}
            </Typography>
          </Box>
        ))}
        {!collectors.length && (
          <Typography variant="body2">No collector heartbeats. Is `run_log_collector` running?</Typography>
        )}
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Top services by storage</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Service</TableCell>
              <TableCell align="right">Bytes</TableCell>
              <TableCell align="right">Entries</TableCell>
              <TableCell align="right">Dropped</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {top.map((r) => (
              <TableRow key={String(r.service_id)}>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{String(r.service_id)}</TableCell>
                <TableCell align="right">{r.current_storage_bytes}</TableCell>
                <TableCell align="right">{r.entry_count}</TableCell>
                <TableCell align="right">{r.entries_dropped}</TableCell>
              </TableRow>
            ))}
            {!top.length && (
              <TableRow><TableCell colSpan={4}>No usage rows yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}
