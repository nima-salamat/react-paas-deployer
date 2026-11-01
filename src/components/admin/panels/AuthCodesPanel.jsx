import React, { useState } from "react";
import TranslatedTextTree from "../../../i18n/TranslatedTextTree.jsx";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";
import {
  Box, Button, Chip, IconButton, Pagination, Stack, TextField, Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import ResponsiveTable from "../components/ResponsiveTable.jsx";

const PAGE_SIZE = 25;

/**
 * AuthCodesPanel — OTP codes list with confirm on delete / purge.
 * Uses plain Box component="th|td" (no external Th/Td helpers).
 */
export default function AuthCodesPanel({
  codes = [],
  canManage = false,
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
  const { t } = useLocale();
  const pages = Math.max(1, Math.ceil((codeCount || 0) / PAGE_SIZE));
  const [deleteId, setDeleteId] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);

  return (    <TranslatedTextTree>

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
          {canManage && (
            <Button
              color="warning"
              variant="outlined"
              onClick={() => setConfirmPurge(true)}
              sx={{ textTransform: "none", borderRadius: 1 }}
            >
              Purge expired
            </Button>
          )}
        </Stack>
      </Stack>

      <TextField
        className="admin-filter-search"
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

      <ResponsiveTable
        rows={codes}
        minWidth={760}
        emptyMessage={codeLoading ? "Loading…" : "No codes"}
        columns={[
          {
            id: "username",
            label: "User",
            render: (code) => code.username || code.user?.username || "—",
          },
          {
            id: "contact",
            label: "Contact",
            render: (code) => code.contact || "—",
          },
          {
            id: "purpose",
            label: "Purpose",
            render: (code) => <Chip size="small" label={t(code.purpose || "—")} />,
          },
          {
            id: "code",
            label: "Code",
            render: (code) => (
              <Typography variant="caption" fontFamily="monospace" sx={{ letterSpacing: 1 }}>
                {code.code}
              </Typography>
            ),
          },
          {
            id: "attempts",
            label: "Attempts",
            align: "right",
            render: (code) => code.attempts ?? 0,
          },
          {
            id: "status",
            label: "Status",
            render: (code) => code.is_expired ? (
              <Chip size="small" label="expired" />
            ) : code.is_locked ? (
              <Chip size="small" color="warning" label="locked" />
            ) : (
              <Chip size="small" color="success" label="valid" />
            ),
          },
          ...(canManage ? [{
            id: "actions",
            label: "Actions",
            align: "right",
            stopPropagation: true,
            render: (code) => (
              <IconButton size="small" color="error" onClick={() => setDeleteId(code.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            ),
          }] : []),
        ]}
      />

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

      {canManage && (
        <>
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
        </>
      )}
    </Stack>
    </TranslatedTextTree>
  );
}
