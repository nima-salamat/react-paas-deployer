import React, { useState } from "react";
import TranslatedTextTree from "../../../i18n/TranslatedTextTree.jsx";
import {
  Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Pagination,
  Select, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { STATUS_COLOR } from "../adminUtils";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import ResponsiveTable from "../components/ResponsiveTable.jsx";

const PAGE_SIZE = 15;

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

  return (    <TranslatedTextTree>

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

      <ResponsiveTable
        rows={tickets}
        minWidth={760}
        emptyMessage={tLoading ? "Loading…" : "No tickets"}
        onRowClick={(ticket) => onOpen?.(ticket.id)}
        columns={[
          {
            id: "public_id",
            label: "Number",
            render: (ticket) => <code style={{ fontSize: 11 }}>{ticket.public_id}</code>,
          },
          {
            id: "subject",
            label: "Subject",
            render: (ticket) => (
              <Typography fontWeight={650} fontSize={13} sx={{ maxWidth: 360, overflowWrap: "anywhere" }}>
                {ticket.subject || "—"}
              </Typography>
            ),
          },
          {
            id: "user",
            label: "User",
            render: (ticket) => ticket.user?.username || "—",
          },
          {
            id: "status",
            label: "Status",
            render: (ticket) => (
              <Chip
                size="small"
                label={ticket.status}
                color={STATUS_COLOR[ticket.status] || "default"}
                sx={{ height: 22, fontSize: 11 }}
              />
            ),
          },
          {
            id: "priority",
            label: "Priority",
            render: (ticket) => ticket.priority || "—",
          },
          {
            id: "actions",
            label: "Actions",
            align: "right",
            stopPropagation: true,
            render: (ticket) => (
              <Tooltip title="Delete ticket">
                <IconButton size="small" color="error" onClick={() => setDeleteId(ticket.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ),
          },
        ]}
      />

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
    </TranslatedTextTree>
  );
}
