import React, { useMemo, useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, Pagination, Stack, TextField, Tooltip, Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import {
  DRY_BORDER_LIGHT, DryPanel, DryTh, DryTd,
  DryCreateButton, DryEmptyState,
} from "../components/DryTable";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

const PAGE_SIZE = 15;

/**
 * Build a public invite URL on the *site* domain (not API / deployer host).
 * Prefer VITE_APP_URL from .env; fall back to window.location.origin.
 */
function appBaseUrl() {
  const fromEnv = (import.meta.env.VITE_APP_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "";
}

function invitePublicUrl(inv) {
  // If backend already returned a full URL that points at the site, keep it
  // when it matches our app base; otherwise always rebuild from token.
  const token = inv?.token;
  if (!token) return inv?.url || "";
  const base = appBaseUrl();
  if (!base) return inv?.url || token;
  return `${base}/signin_or_signup?invite=${encodeURIComponent(token)}`;
}

/**
 * InvitesPanel — invite-link management.
 * Invite URLs always use VITE_APP_URL (site domain), never the API host.
 */
export default function InvitesPanel({
  invites = [],
  invLoading = false,
  newInvite,
  setNewInvite,
  onCreate,
  onDeactivate,
  onRefresh,
}) {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(null);
  const [deactivateToken, setDeactivateToken] = useState(null);

  const pages = Math.max(1, Math.ceil((invites?.length || 0) / PAGE_SIZE));
  const slice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return (invites || []).slice(start, start + PAGE_SIZE);
  }, [invites, page]);

  const copyToClipboard = async (token, url) => {
    const text = url || token;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setJustCopied(token);
      setTimeout(() => setJustCopied(null), 1800);
    } catch {
      /* noop */
    }
  };

  const openCreateDialog = () => {
    setNewInvite((s) => ({ label: s?.label || "", max_uses: s?.max_uses ?? "1" }));
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const ok = await onCreate?.();
    if (ok !== false) setCreateOpen(false);
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        gap={1.5}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>Invite links</Typography>
          <Typography variant="body2" color="text.secondary">
            Generate invite tokens to allow signup when public registration is closed.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <DryCreateButton onClick={openCreateDialog} startIcon={<AddIcon />}>
            Create invite
          </DryCreateButton>
          {onRefresh && (
            <Button
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={invLoading}
              variant="outlined"
              sx={{ borderRadius: 1, textTransform: "none" }}
            >
              Refresh
            </Button>
          )}
        </Stack>
      </Stack>

      <DryPanel sx={{ overflow: "hidden" }}>
        {invLoading && !slice.length ? (
          <DryEmptyState>Loading…</DryEmptyState>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}
            >
              <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                <tr>
                  <DryTh>Label</DryTh>
                  <DryTh>Token</DryTh>
                  <DryTh>Invite URL</DryTh>
                  <DryTh align="right">Uses</DryTh>
                  <DryTh align="center">Status</DryTh>
                  <DryTh align="right">Actions</DryTh>
                </tr>
              </Box>
              <tbody>
                {slice.map((inv) => {
                  const publicUrl = invitePublicUrl(inv);
                  return (
                    <tr key={inv.id || inv.token} style={{ borderTop: DRY_BORDER_LIGHT }}>
                      <DryTd>{inv.label || "—"}</DryTd>
                      <DryTd>
                        <Typography variant="caption" sx={{ fontFamily: "monospace", fontSize: 11 }}>
                          {inv.token?.slice(0, 24)}…
                        </Typography>
                      </DryTd>
                      <DryTd>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              maxWidth: 300,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={publicUrl}
                          >
                            {publicUrl}
                          </Typography>
                          <Tooltip title={justCopied === inv.token ? "Copied!" : "Copy URL"}>
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(inv.token, publicUrl)}
                            >
                              {justCopied === inv.token ? (
                                <CheckIcon fontSize="small" color="success" />
                              ) : (
                                <ContentCopyIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </DryTd>
                      <DryTd align="right">
                        {inv.uses_count ?? 0}
                        {inv.max_uses != null ? ` / ${inv.max_uses}` : " / ∞"}
                      </DryTd>
                      <DryTd align="center">
                        {inv.is_active ? (
                          <Chip
                            size="small"
                            label="active"
                            color="success"
                            sx={{ height: 18, fontSize: 10, borderRadius: 1 }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="disabled"
                            sx={{ height: 18, fontSize: 10, borderRadius: 1 }}
                          />
                        )}
                      </DryTd>
                      <DryTd align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Copy URL">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(inv.token, publicUrl)}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {inv.is_active && (
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              onClick={() => setDeactivateToken(inv.token)}
                              sx={{ borderRadius: 1, textTransform: "none", fontSize: 11 }}
                            >
                              Deactivate
                            </Button>
                          )}
                        </Stack>
                      </DryTd>
                    </tr>
                  );
                })}
                {!slice.length && (
                  <tr>
                    <DryTd colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No invites</Typography>
                    </DryTd>
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>
        )}
        {pages > 1 && (
          <Box display="flex" justifyContent="center" p={2} sx={{ borderTop: DRY_BORDER_LIGHT }}>
            <Pagination page={page} count={pages} onChange={(_, v) => setPage(v)} color="primary" />
          </Box>
        )}
      </DryPanel>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT, fontWeight: 800 }}>
          Create invite link
        </DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField
              size="small"
              label="Label (optional)"
              placeholder="e.g. Beta batch 1, Marketing Q4, …"
              value={newInvite?.label || ""}
              onChange={(e) => setNewInvite((s) => ({ ...s, label: e.target.value }))}
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
            />
            <TextField
              size="small"
              label="Max uses"
              placeholder="1 = one-time, empty = unlimited"
              value={newInvite?.max_uses ?? "1"}
              onChange={(e) => setNewInvite((s) => ({ ...s, max_uses: e.target.value }))}
              fullWidth
              helperText="Leave empty for unlimited uses."
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
            />
            <Typography variant="caption" color="text.secondary">
              Invite URL will use the site domain (
              {appBaseUrl() || "VITE_APP_URL / current origin"}
              ).
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ borderRadius: 1, textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivateToken)}
        title="Deactivate invite?"
        message="This invite link will stop working. Existing signups are not affected."
        confirmLabel="Deactivate"
        confirmColor="warning"
        onCancel={() => setDeactivateToken(null)}
        onConfirm={() => {
          const t = deactivateToken;
          setDeactivateToken(null);
          if (t) onDeactivate?.(t);
        }}
      />
    </Stack>
  );
}
