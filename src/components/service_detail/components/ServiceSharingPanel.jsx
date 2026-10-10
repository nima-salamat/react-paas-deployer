import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import PersonOutlineRoundedIcon from "@mui/icons-material/PersonOutlineRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import apiRequest from "../../customHooks/apiRequest";
import ShareServiceDialog, {
  RULE_LABELS,
} from "../../service/services/ShareServiceDialog";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const SHARES_URL = `${API_BASE}/services/services/shared/`;
const shareUrl = (shareId) => `${API_BASE}/services/services/shares/${shareId}/`;

const ELEVATED_RULES = new Set([
  "can_view_db_credentials",
  "can_shell_advanced",
  "can_shell_replace",
  "can_purge",
  "can_deploy_edit_others",
  "can_deploy_remove_others",
  "can_change_config",
]);

function recipientDetails(share) {
  if (share?.group_id != null) {
    return {
      label: share.group_title || `Group ${share.group_id}`,
      kind: "group",
      subtitle: "Messenger group",
    };
  }
  return {
    label: share?.target_username || `User ${share?.target_user_id || ""}`.trim(),
    kind: "user",
    subtitle: "Direct access",
  };
}

function getExpiryState(expiresAt) {
  if (!expiresAt) return { label: "No expiry", color: "default" };
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return { label: "Expiry date unknown", color: "default" };
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return { label: "Expired", color: "error" };
  if (remaining <= 7 * 24 * 60 * 60 * 1000) return { label: "Expires soon", color: "warning" };
  return {
    label: `Until ${new Date(timestamp).toLocaleDateString()}`,
    color: "default",
  };
}

function describePermissions(rules = {}) {
  return Object.entries(rules)
    .filter(([key, enabled]) => key !== "daily_deploy_limit" && Boolean(enabled))
    .map(([key]) => RULE_LABELS[key] || key.replace(/^can_/, "").replaceAll("_", " "));
}

function ShareSummaryCard({ share, onEdit, onRemove, removing }) {
  const recipient = recipientDetails(share);
  const permissionLabels = describePermissions(share.rules);
  const enabledCount = permissionLabels.length;
  const expiry = getExpiryState(share.expires_at);
  const elevated = Object.entries(share.rules || {}).some(
    ([key, enabled]) => ELEVATED_RULES.has(key) && Boolean(enabled)
  );
  const isExpired = expiry.label === "Expired";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 2 },
        borderRadius: 2.5,
        borderColor: "divider",
        opacity: isExpired ? 0.82 : 1,
        transition: "border-color 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 5px 22px rgba(0,0,0,0.18)"
              : "0 5px 22px rgba(15,23,42,0.06)",
        },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="flex-start" spacing={1.25}>
          <Avatar
            variant="rounded"
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              bgcolor: recipient.kind === "group" ? "secondary.100" : "primary.100",
              color: recipient.kind === "group" ? "secondary.dark" : "primary.dark",
              flexShrink: 0,
            }}
          >
            {recipient.kind === "group" ? <GroupOutlinedIcon /> : <PersonOutlineRoundedIcon />}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={800} sx={{ overflowWrap: "anywhere" }}>
                {recipient.label}
              </Typography>
              <Chip size="small" variant="outlined" label={recipient.kind === "group" ? "Group" : "User"} />
              {share.preset ? (
                <Chip size="small" color="primary" variant="outlined" label={share.preset} />
              ) : null}
              {elevated ? (
                <Chip
                  size="small"
                  color="warning"
                  icon={<ShieldOutlinedIcon />}
                  label="Elevated access"
                />
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {recipient.subtitle}
              {share.note ? ` · ${share.note}` : ""}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0, mt: -0.5, mr: -0.5 }}>
            <Tooltip title="Edit access and rules">
              <span>
                <IconButton
                  size="small"
                  aria-label={`Edit share for ${recipient.label}`}
                  onClick={() => onEdit(share)}
                  disabled={removing}
                >
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Remove access">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  aria-label={`Remove share for ${recipient.label}`}
                  onClick={() => onRemove(share)}
                  disabled={removing}
                >
                  {removing ? <CircularProgress size={18} /> : <DeleteOutlineRoundedIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Divider />

        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <ShieldOutlinedIcon fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={700}>
              {enabledCount} permission{enabledCount === 1 ? "" : "s"} enabled
            </Typography>
            <Typography variant="caption" color="text.secondary">
              · {Number(share.rules?.daily_deploy_limit ?? 0)} deploys/day
            </Typography>
          </Stack>
          <Chip
            size="small"
            icon={<AccessTimeRoundedIcon />}
            label={expiry.label}
            color={expiry.color}
            variant={expiry.color === "default" ? "outlined" : "filled"}
          />
        </Stack>

        {permissionLabels.length ? (
          <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.75}>
            {permissionLabels.slice(0, 4).map((label) => (
              <Chip key={label} size="small" variant="outlined" label={label} />
            ))}
            {permissionLabels.length > 4 ? (
              <Chip
                size="small"
                variant="outlined"
                label={`+${permissionLabels.length - 4} more`}
              />
            ) : null}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No actions enabled. The recipient may not be able to use this service.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

export default function ServiceSharingPanel({ service }) {
  const serviceId = service?.id ?? service?.pk;
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShare, setEditingShare] = useState(null);
  const [shareToRemove, setShareToRemove] = useState(null);
  const [removingId, setRemovingId] = useState("");
  const [requestVersion, setRequestVersion] = useState(0);

  const loadShares = useCallback(async () => {
    if (!serviceId) {
      setShares([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({
        method: "GET",
        url: SHARES_URL,
        params: { scope: "created" },
      });
      const body = response?.data || {};
      const rows = Array.isArray(body.shares)
        ? body.shares
        : Array.isArray(body.results)
          ? body.results
          : [];
      setShares(
        rows.filter((share) => {
          const shareServiceId = share.service_id ?? share.service?.id ?? share.service?.pk;
          return String(shareServiceId) === String(serviceId) && share.is_active !== false;
        })
      );
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message;
      setError(detail || "Could not load sharing settings for this service.");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadShares();
  }, [loadShares, requestVersion]);

  const visibleShares = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shares;
    return shares.filter((share) => {
      const recipient = recipientDetails(share);
      return [recipient.label, recipient.subtitle, share.note, share.preset]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [query, shares]);

  const groupCount = shares.filter((share) => share.group_id != null).length;
  const userCount = shares.length - groupCount;
  const expiringCount = shares.filter((share) => {
    if (!share.expires_at) return false;
    const expiresAt = new Date(share.expires_at).getTime();
    return Number.isFinite(expiresAt) && expiresAt > Date.now() &&
      expiresAt - Date.now() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const openCreateDialog = () => {
    setEditingShare(null);
    setDialogOpen(true);
  };

  const openEditDialog = (share) => {
    setEditingShare(share);
    setDialogOpen(true);
  };

  const closeShareDialog = () => {
    setDialogOpen(false);
    setEditingShare(null);
  };

  const confirmRemoveShare = async () => {
    const shareId = shareToRemove?.id;
    if (!shareId) return;
    setRemovingId(String(shareId));
    setError("");
    setNotice(null);
    try {
      await apiRequest({ method: "DELETE", url: shareUrl(shareId) });
      setShares((previous) => previous.filter((share) => String(share.id) !== String(shareId)));
      setShareToRemove(null);
      setNotice({
        severity: "success",
        message: `Access removed for ${recipientDetails(shareToRemove).label}.`,
      });
      setRequestVersion((version) => version + 1);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Could not remove this share.");
    } finally {
      setRemovingId("");
    }
  };

  return (
    <Stack spacing={2.25} sx={{ minWidth: 0, pb: 2 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          backgroundImage: (theme) =>
            theme.palette.mode === "dark"
              ? "linear-gradient(135deg, rgba(30,41,59,0.75), rgba(15,23,42,0.45))"
              : "linear-gradient(135deg, #ffffff, #f8fafc)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar
              variant="rounded"
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "primary.contrastText",
              }}
            >
              <ShareOutlinedIcon />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={850}>
                Sharing & access
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage who can access {service?.name || "this service"} and which actions they can perform.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-start" flexShrink={0}>
            <Tooltip title="Refresh shares">
              <span>
                <IconButton
                  aria-label="Refresh shares"
                  onClick={() => setRequestVersion((version) => version + 1)}
                  disabled={loading}
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
                >
                  {loading ? <CircularProgress size={19} /> : <RefreshRoundedIcon />}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="contained"
              disableElevation
              startIcon={<AddRoundedIcon />}
              onClick={openCreateDialog}
              disabled={!serviceId}
              sx={{ borderRadius: 2, textTransform: "none", fontWeight: 750 }}
            >
              Add share
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => setRequestVersion((version) => version + 1)}>
              Retry
            </Button>
          }
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      ) : null}

      {notice ? (
        <Alert severity={notice.severity} onClose={() => setNotice(null)}>
          {notice.message}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gap: 1.25,
        }}
      >
        {[
          { label: "Active shares", value: shares.length, icon: <ShareOutlinedIcon /> },
          { label: "Groups", value: groupCount, icon: <GroupOutlinedIcon /> },
          { label: "People", value: userCount, icon: <PersonOutlineRoundedIcon /> },
          { label: "Expiring in 7 days", value: expiringCount, icon: <AccessTimeRoundedIcon /> },
        ].map((stat) => (
          <Paper
            key={stat.label}
            variant="outlined"
            sx={{ p: 1.5, borderRadius: 2.25, borderColor: "divider", minWidth: 0 }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box sx={{ color: "text.secondary", display: "flex" }}>{stat.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h5" fontWeight={850} lineHeight={1.15}>
                  {loading ? "—" : stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {stat.label}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Box>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "stretch", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
      >
        <Box>
          <Typography variant="h6" fontWeight={850}>
            Who has access?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Each share has its own permission rules, optional expiry, and recipient scope.
          </Typography>
        </Box>
        <TextField
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people, groups, notes…"
          aria-label="Search shares"
          sx={{ width: { xs: "100%", sm: 300 }, maxWidth: "100%" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {loading && !shares.length ? (
        <Stack spacing={1.25}>
          <Skeleton variant="rounded" height={136} />
          <Skeleton variant="rounded" height={136} />
        </Stack>
      ) : visibleShares.length ? (
        <Stack spacing={1.25}>
          {visibleShares.map((share) => (
            <ShareSummaryCard
              key={share.id}
              share={share}
              onEdit={openEditDialog}
              onRemove={setShareToRemove}
              removing={removingId === String(share.id)}
            />
          ))}
        </Stack>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            borderStyle: "dashed",
            textAlign: "center",
          }}
        >
          <Avatar
            sx={{ mx: "auto", mb: 1.5, bgcolor: "action.hover", color: "text.secondary", width: 54, height: 54 }}
          >
            <ShareOutlinedIcon />
          </Avatar>
          <Typography variant="h6" fontWeight={800}>
            {query ? "No matching shares" : "This service is private"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: "auto", mt: 0.75 }}>
            {query
              ? "Try a different search term, or clear the search to see all recipients."
              : "Add a person or messenger group, then choose exactly which service actions they can use."}
          </Typography>
          {!query ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<AddRoundedIcon />}
              onClick={openCreateDialog}
              sx={{ mt: 2, borderRadius: 2, textTransform: "none" }}
            >
              Create first share
            </Button>
          ) : null}
        </Paper>
      )}

      <ShareServiceDialog
        open={dialogOpen}
        onClose={closeShareDialog}
        service={service}
        existingShare={editingShare}
        onDone={() => {
          setNotice({
            severity: "success",
            message: editingShare ? "Share and permission rules updated." : "Share created successfully.",
          });
          setRequestVersion((version) => version + 1);
        }}
      />

      <Dialog
        open={Boolean(shareToRemove)}
        onClose={() => (removingId ? null : setShareToRemove(null))}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Remove service access?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {shareToRemove
              ? `This will revoke access for ${recipientDetails(shareToRemove).label}. They will no longer be able to use this share.`
              : "This will revoke access for the selected recipient."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShareToRemove(null)} disabled={Boolean(removingId)}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            onClick={confirmRemoveShare}
            disabled={Boolean(removingId)}
            startIcon={removingId ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlineRoundedIcon />}
          >
            {removingId ? "Removing…" : "Remove access"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
