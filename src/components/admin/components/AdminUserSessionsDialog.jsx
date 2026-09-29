import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/Refresh";
import {
  fetchAdminUserSessions,
  logoutAllAdminUserSessions,
  revokeAdminUserSession,
} from "../../security/sessionApi";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatRelative(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function titleFor(session) {
  const device = session?.device || {};
  return device.name || device.client || device.platform || "Unknown device";
}

export default function AdminUserSessionsDialog({
  open,
  user,
  canManage = false,
  onClose,
  onToast,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      setData(await fetchAdminUserSessions(user.id));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Could not load user sessions."
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open) load();
    else {
      setData(null);
      setError("");
    }
  }, [open, load]);

  const revoke = async (session) => {
    if (!canManage || !user?.id || !session?.id) return;
    if (!window.confirm(`Revoke the ${titleFor(session)} session?`)) return;
    setActionId(session.id);
    setError("");
    try {
      await revokeAdminUserSession(user.id, session.id);
      onToast?.("Session revoked");
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Could not revoke the session."
      );
    } finally {
      setActionId(null);
    }
  };

  const revokeAll = async () => {
    if (!canManage || !user?.id) return;
    if (!window.confirm(`Revoke all active sessions for @${user.username}?`)) return;
    setActionId("__all__");
    setError("");
    try {
      const result = await logoutAllAdminUserSessions(user.id);
      onToast?.(`${Number(result?.revoked || 0)} session(s) revoked`);
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Could not revoke all sessions."
      );
    } finally {
      setActionId(null);
    }
  };

  const sessions = Array.isArray(data?.results) ? data.results : [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <DevicesOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800}>User sessions</Typography>
            <Typography variant="caption" color="text.secondary">
              @{user?.username || "user"}
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${Number(data?.active_count || 0)} active`} />
            {data?.max_active_sessions != null && (
              <Chip size="small" variant="outlined" label={`Limit ${data.max_active_sessions}`} />
            )}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              startIcon={loading ? <CircularProgress size={15} /> : <RefreshOutlinedIcon />}
              onClick={load}
              disabled={loading}
              sx={{ textTransform: "none" }}
            >
              Refresh
            </Button>
          </Stack>

          {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

          {loading && !data ? (
            <Box display="flex" justifyContent="center" py={5}>
              <CircularProgress />
            </Box>
          ) : sessions.length ? (
            <List disablePadding divider>
              {sessions.map((session) => (
                <ListItem
                  key={session.id}
                  disableGutters
                  sx={{ py: 1.5, alignItems: "flex-start" }}
                  secondaryAction={
                    canManage ? (
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<LogoutOutlinedIcon />}
                        onClick={() => revoke(session)}
                        disabled={actionId === session.id || actionId === "__all__"}
                        sx={{ textTransform: "none" }}
                      >
                        {actionId === session.id ? "Revoking…" : "Revoke"}
                      </Button>
                    ) : null
                  }
                >
                  <ListItemIcon sx={{ minWidth: 38, pt: 0.25 }}>
                    <DevicesOutlinedIcon />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography fontWeight={700} pr={10}>{titleFor(session)}</Typography>}
                    secondary={
                      <Stack spacing={0.25} sx={{ mt: 0.35, pr: 8 }}>
                        <Typography variant="caption" color="text.secondary">
                          {[session?.device?.platform, session?.device?.client].filter(Boolean).join(" · ") || "Device details unavailable"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Created {formatDate(session?.created_at)} · Last active {formatRelative(session?.last_seen_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Expires {formatDate(session?.expires_at)}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">This user has no active authentication sessions.</Alert>
          )}

          {!canManage && (
            <Alert severity="info">
              You have session view permission only. Grant <code>auth_sessions.manage</code> for revoke controls.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
        {canManage && sessions.length > 0 && (
          <Button
            color="error"
            variant="contained"
            startIcon={<LogoutOutlinedIcon />}
            onClick={revokeAll}
            disabled={actionId != null}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Revoke all sessions
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
