import React, { useState } from "react";
import {
  Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Pagination,
  Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { STATUS_COLOR } from "../adminUtils";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const PAGE_SIZE = 15;

const thSx = {
  textAlign: "left",
  px: 1.5,
  py: 1.1,
  fontWeight: 700,
  fontSize: 12,
  color: "text.secondary",
  whiteSpace: "nowrap",
  borderBottom: 1,
  borderColor: "divider",
};

const tdSx = {
  px: 1.5,
  py: 1.15,
  fontSize: 13,
  verticalAlign: "middle",
};

/**
 * TicketsPanel — list + filters + delete (with confirm).
 * No custom Th/Td components — plain Box th/td only.
 */
export default function TicketsPanel({
  tickets = [],
  count = 0,
  page,
  setPage,
  search,
  setSearch,
  status,
  setStatus,
  priority,
  setPriority,
  assignedFilter,
  setAssignedFilter,
  tLoading = false,
  onOpen,
  onDelete,
  onRefresh,
}) {
  const pages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const [deleteId, setDeleteId] = useState(null);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1.5}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Tickets
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {count.toLocaleString()} total tickets
          </Typography>
        </Box>
        {onRefresh && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={tLoading}
            variant="outlined"
            sx={{ borderRadius: 1, textTransform: "none" }}
          >
            Refresh
          </Button>
        )}
      </Stack>

      <Box sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label="Search subject / number"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 200, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="open,in_progress,waiting_user">Active</MenuItem>
              {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel>Priority</InputLabel>
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              {["low", "normal", "high", "urgent"].map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Assigned</InputLabel>
            <Select
              label="Assigned"
              value={assignedFilter}
              onChange={(e) => {
                setAssignedFilter(e.target.value);
                setPage(1);
              }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="me">Mine</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <Box sx={{ border: 1, borderColor: "divider", overflow: "auto", borderRadius: 1.5 }}>
        <Box
          component="table"
          sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}
        >
          <Box component="thead" sx={{ bgcolor: "action.hover" }}>
            <Box component="tr">
              <Box component="th" sx={thSx}>Number</Box>
              <Box component="th" sx={thSx}>Subject</Box>
              <Box component="th" sx={thSx}>User</Box>
              <Box component="th" sx={thSx}>Status</Box>
              <Box component="th" sx={thSx}>Priority</Box>
              <Box component="th" sx={{ ...thSx, textAlign: "right" }}>Actions</Box>
            </Box>
          </Box>
          <Box component="tbody">
            {tickets.map((t) => (
              <Box
                component="tr"
                key={t.id}
                onClick={() => onOpen?.(t.id)}
                sx={{
                  borderTop: "1px solid rgba(127,127,127,0.18)",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Box component="td" sx={tdSx}>
                  <code style={{ fontSize: 11 }}>{t.public_id}</code>
                </Box>
                <Box component="td" sx={tdSx}>
                  <Typography fontWeight={600} fontSize={13} noWrap sx={{ maxWidth: 320 }}>
                    {t.subject}
                  </Typography>
                </Box>
                <Box component="td" sx={tdSx}>
                  {t.user?.username || "—"}
                </Box>
                <Box component="td" sx={tdSx}>
                  <Chip
                    size="small"
                    label={t.status}
                    color={STATUS_COLOR[t.status] || "default"}
                    sx={{ height: 20, fontSize: 11, borderRadius: 1 }}
                  />
                </Box>
                <Box component="td" sx={tdSx}>
                  {t.priority || "—"}
                </Box>
                <Box
                  component="td"
                  sx={{ ...tdSx, textAlign: "right" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip title="Delete ticket">
                    <IconButton size="small" color="error" onClick={() => setDeleteId(t.id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            ))}
            {!tickets.length && (
              <Box component="tr">
                <Box component="td" colSpan={6} sx={{ p: 3, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    {tLoading ? "Loading…" : "No tickets"}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {pages > 1 && (
        <Box display="flex" justifyContent="center" p={2}>
          <Pagination
            page={page}
            count={pages}
            onChange={(_, v) => setPage(v)}
            color="primary"
            showFirstButton
            showLastButton
            siblingCount={1}
            boundaryCount={1}
          />
        </Box>
      )}

      <ConfirmDialog
        open={deleteId != null}
        title="Delete ticket?"
        message="This will permanently delete the ticket and all its messages. This action cannot be undone."
        confirmLabel="Delete ticket"
        confirmColor="error"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (id != null) onDelete?.(id);
        }}
      />
    </Stack>
  );
}
