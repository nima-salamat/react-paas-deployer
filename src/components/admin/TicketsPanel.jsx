import React from "react";
import {
  Box, Chip, CircularProgress, FormControl, IconButton, InputLabel, MenuItem,
  Pagination, Paper, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { STATUS_COLOR } from "./adminUtils";

const PAGE_SIZE = 15;

export default function TicketsPanel({
  tickets, count, page, setPage, search, setSearch,
  status, setStatus, priority, setPriority, assignedFilter, setAssignedFilter,
  tLoading, onOpen, onDelete,
}) {
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  return (
    <>
      <Typography variant="h5" fontWeight={700} mb={2}>Tickets</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2} flexWrap="wrap" useFlexGap>
          <TextField size="small" label="Search" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            sx={{ minWidth: 200, flex: 1 }} />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="open,in_progress,waiting_user">Active</MenuItem>
              {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Priority</InputLabel>
            <Select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              {["low", "normal", "high", "urgent"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Assigned</InputLabel>
            <Select label="Assigned" value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="me">Mine</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>
      {tLoading ? <CircularProgress /> : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell><TableCell>Subject</TableCell>
                <TableCell>User</TableCell><TableCell>Status</TableCell>
                <TableCell>Priority</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ cursor: "pointer" }} onClick={() => onOpen(t.id)}>{t.public_id}</TableCell>
                  <TableCell sx={{ cursor: "pointer" }} onClick={() => onOpen(t.id)}>{t.subject}</TableCell>
                  <TableCell>{t.user?.username}</TableCell>
                  <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDelete(t.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!tickets.length && (
                <TableRow><TableCell colSpan={6} align="center"><Typography color="text.secondary" py={3}>No tickets</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          {pages > 1 && (
            <Box display="flex" justifyContent="center" p={2}>
              <Pagination page={page} count={pages} onChange={(_, v) => setPage(v)}
                showFirstButton showLastButton color="primary"
                siblingCount={1} boundaryCount={1} />
            </Box>
          )}
        </Paper>
      )}
    </>
  );
}
