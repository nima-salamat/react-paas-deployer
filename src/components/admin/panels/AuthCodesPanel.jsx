import React, { useState } from "react";
import {
  Box, Button, Chip, IconButton, Pagination, Stack, TextField, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const PAGE_SIZE = 25;

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
 * AuthCodesPanel — OTP codes list with confirm on delete / purge.
 * Uses plain Box component="th|td" (no external Th/Td helpers).
 */
export default function AuthCodesPanel({
  codes = [],
  codeCount = 0,
  codePage,
  setCodePage,
  codeSearch,
  setCodeSearch,
  codeLoading = false,
  onPurge,
  onDelete,
  onRefresh,
}) {
  const pages = Math.max(1, Math.ceil((codeCount || 0) / PAGE_SIZE));
  const [deleteId, setDeleteId] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1.5}
        flexWrap="wrap"
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            Auth codes (OTP)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One-time codes currently issued for login, signup, recovery and password reset.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          {onRefresh && (
            <Button
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={codeLoading}
              sx={{ textTransform: "none", borderRadius: 1 }}
            >
              Refresh
            </Button>
          )}
          <Button
            color="warning"
            variant="outlined"
            onClick={() => setConfirmPurge(true)}
            sx={{ textTransform: "none", borderRadius: 1 }}
          >
            Purge expired
          </Button>
        </Stack>
      </Stack>

      <TextField
        size="small"
        fullWidth
        label="Search username / email / contact / code"
        placeholder="e.g. alice@example.com, +98…, 123456"
        value={codeSearch}
        onChange={(e) => {
          setCodeSearch(e.target.value);
          setCodePage(1);
        }}
      />

      <Box sx={{ border: 1, borderColor: "divider", overflow: "auto", borderRadius: 1.5 }}>
        <Box
          component="table"
          sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}
        >
          <Box component="thead" sx={{ bgcolor: "action.hover" }}>
            <Box component="tr">
              <Box component="th" sx={thSx}>User</Box>
              <Box component="th" sx={thSx}>Contact</Box>
              <Box component="th" sx={thSx}>Purpose</Box>
              <Box component="th" sx={thSx}>Code</Box>
              <Box component="th" sx={{ ...thSx, textAlign: "right" }}>Attempts</Box>
              <Box component="th" sx={{ ...thSx, textAlign: "center" }}>Status</Box>
              <Box component="th" sx={{ ...thSx, textAlign: "right" }}> </Box>
            </Box>
          </Box>
          <Box component="tbody">
            {codes.map((c) => (
              <Box
                component="tr"
                key={c.id}
                sx={{ borderTop: "1px solid rgba(127,127,127,0.18)" }}
              >
                <Box component="td" sx={tdSx}>
                  {c.username || c.user?.username || "—"}
                </Box>
                <Box component="td" sx={tdSx}>
                  {c.contact || "—"}
                </Box>
                <Box component="td" sx={tdSx}>
                  <Chip
                    size="small"
                    label={c.purpose}
                    sx={{ height: 20, fontSize: 11, borderRadius: 1 }}
                  />
                </Box>
                <Box component="td" sx={tdSx}>
                  <Typography variant="caption" fontFamily="monospace" sx={{ letterSpacing: 1 }}>
                    {c.code}
                  </Typography>
                </Box>
                <Box component="td" sx={{ ...tdSx, textAlign: "right" }}>
                  {c.attempts}
                </Box>
                <Box component="td" sx={{ ...tdSx, textAlign: "center" }}>
                  {c.is_expired ? (
                    <Chip size="small" label="expired" sx={{ height: 20, fontSize: 11, borderRadius: 1 }} />
                  ) : c.is_locked ? (
                    <Chip size="small" color="warning" label="locked" sx={{ height: 20, fontSize: 11, borderRadius: 1 }} />
                  ) : (
                    <Chip size="small" color="success" label="valid" sx={{ height: 20, fontSize: 11, borderRadius: 1 }} />
                  )}
                </Box>
                <Box component="td" sx={{ ...tdSx, textAlign: "right" }}>
                  <IconButton size="small" color="error" onClick={() => setDeleteId(c.id)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            ))}
            {!codes.length && (
              <Box component="tr">
                <Box component="td" colSpan={7} sx={{ p: 3, textAlign: "center" }}>
                  <Typography color="text.secondary">
                    {codeLoading ? "Loading…" : "No codes"}
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
            page={codePage}
            count={pages}
            onChange={(_, v) => setCodePage(v)}
            color="primary"
          />
        </Box>
      )}

      <ConfirmDialog
        open={deleteId != null}
        title="Delete auth code?"
        message="This one-time code will be removed. The user may need a new code to continue."
        confirmLabel="Delete"
        confirmColor="error"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          const id = deleteId;
          setDeleteId(null);
          if (id != null) onDelete?.(id);
        }}
      />
      <ConfirmDialog
        open={confirmPurge}
        title="Purge expired codes?"
        message="All expired OTP codes will be permanently removed from the database."
        confirmLabel="Purge expired"
        confirmColor="warning"
        onCancel={() => setConfirmPurge(false)}
        onConfirm={() => {
          setConfirmPurge(false);
          onPurge?.();
        }}
      />
    </Stack>
  );
}
