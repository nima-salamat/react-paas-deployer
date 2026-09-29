import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import LockClockOutlinedIcon from "@mui/icons-material/LockClockOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import { clearAuthAndRedirect } from "../customHooks/apiRequest.jsx";
import {
  fetchMySessions,
  logoutAllMySessions,
  revokeMySession,
} from "./sessionApi";

function formatDuration(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
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

function sessionTitle(session) {
  const device = session?.device || {};
  return device.name || device.client || device.platform || "Unknown device";
}

function SessionRow({ session, canManageOthers, onRevoke, loadingId }) {
  const isCurrent = Boolean(session?.current);
  const disabled = !isCurrent && (!canManageOthers || loadingId === session?.id);

  return (
    <ListItem
      disableGutters
      sx={{
        py: 1.5,
        alignItems: "flex-start",
        gap: 1,
      }}
      secondaryAction={
        isCurrent ? (
          <Button
            size="small"
            color="error"
            variant="outlined"
            startIcon={<LogoutOutlinedIcon />}
            onClick={() => onRevoke(session)}
            disabled={loadingId === session?.id}
            sx={{ textTransform: "none", whiteSpace: "nowrap" }}
          >
            {loadingId === session?.id ? "Signing out…" : "Sign out"}
          </Button>
        ) : (
          <Tooltip
            title={
              canManageOthers
                ? "Sign out this session"
                : "You can manage other sessions after your current session is 2 hours old."
            }
          >
            <span>
              <Button
                size="small"
                color="error"
                variant="outlined"
                startIcon={
                  canManageOthers ? <LogoutOutlinedIcon /> : <LockClockOutlinedIcon />
                }
                onClick={() => onRevoke(session)}
                disabled={disabled}
                sx={{ textTransform: "none", whiteSpace: "nowrap" }}
              >
                {loadingId === session?.id ? "Signing out…" : "Sign out"}
              </Button>
            </span>
          </Tooltip>
        )
      }
    >
      <ListItemIcon sx={{ minWidth: 38, pt: 0.25 }}>
        <DevicesOutlinedIcon color={isCurrent ? "primary" : "action"} />
      </ListItemIcon>
      <ListItemText
        primary={
          <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap" useFlexGap pr={10}>
            <Typography fontWeight={750}>{sessionTitle(session)}</Typography>
            {isCurrent && <Chip size="small" color="primary" label="Current" sx={{ height: 22 }} />}
          </Stack>
        }
        secondary={
          <Stack spacing={0.25} sx={{ mt: 0.35, pr: 8 }}>
            <Typography component="span" variant="caption" color="text.secondary">
              {[session?.device?.platform, session?.device?.client].filter(Boolean).join(" · ") || "Device details unavailable"}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary">
              Created {formatDate(session?.created_at)} · Last active {formatRelative(session?.last_seen_at)}
            </Typography>
            <Typography component="span" variant="caption" color="text.secondary">
              Expires {formatDate(session?.expires_at)}
            </Typography>
          </Stack>
        }
      />
    </ListItem>
  );
}

export default function SessionManager({ title = "Devices & sessions", compact = false }) {
  const [sessions, setSessions] = useState([]);
  const [management, setManagement] = useState({
    minimum_age_seconds: 7200,
    current_session_age_seconds: 0,
    can_revoke_others: false,
  });
  const [activeCount, setActiveCount] = useState(0);
  const [maxActiveSessions, setMaxActiveSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const [loadingId, setLoadingId] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setActionError("");

    try {
      const data = await fetchMySessions();
      setSessions(Array.isArray(data?.results) ? data.results : []);
      setActiveCount(Number(data?.active_count || 0));
      setMaxActiveSessions(data?.max_active_sessions ?? null);
      setManagement({
        minimum_age_seconds: Number(data?.session_management?.minimum_age_seconds || 7200),
        current_session_age_seconds: Number(data?.session_management?.current_session_age_seconds || 0),
        can_revoke_others: Boolean(data?.session_management?.can_revoke_others),
      });
    } catch (error) {
      setActionError(
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "Could not load your active sessions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load({ silent: true }), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const remainingSeconds = useMemo(
    () =>
      Math.max(
        0,
        Number(management.minimum_age_seconds || 0) -
          Number(management.current_session_age_seconds || 0),
      ),
    [management],
  );

  const currentSession = sessions.find((session) => session.current);
  const hasSessionContext = Boolean(currentSession);
  const hasOtherSessions = sessions.some((session) => !session.current);
  const canLogoutAll = hasSessionContext && (!hasOtherSessions || management.can_revoke_others);

  const handleRevoke = async (session) => {
    const isCurrent = Boolean(session?.current);
    if (!hasSessionContext) {
      setActionError("Sign in again with a session-bound login before using session management.");
      return;
    }
    if (
      !isCurrent &&
      !management.can_revoke_others
    ) {
      setActionError(
        `You can manage other sessions after your current session has been active for ${formatDuration(remainingSeconds)}.`
      );
      return;
    }

    const label = isCurrent ? "your current session" : `${sessionTitle(session)} session`;
    if (!window.confirm(`Sign out of ${label}?`)) return;

    setLoadingId(session.id);
    setActionError("");
    try {
      await revokeMySession(session.id);
      if (isCurrent) {
        clearAuthAndRedirect();
        return;
      }
      await load({ silent: true });
    } catch (error) {
      setActionError(
        error?.response?.data?.code === "session_too_new_for_management"
          ? `This session is still locked. You can manage other sessions after ${formatDuration(
              Number(error?.response?.data?.remaining_seconds || remainingSeconds),
            )}.`
          : error?.response?.data?.detail ||
            error?.response?.data?.message ||
            "Could not revoke the session."
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!hasSessionContext) {
      setActionError("Sign in again with a session-bound login before using session management.");
      return;
    }
    if (!canLogoutAll) {
      setActionError(
        `You can sign out all sessions after your current session has been active for ${formatDuration(remainingSeconds)}.`
      );
      return;
    }

    if (!window.confirm("Sign out all active sessions?")) return;

    setActionError("");
    try {
      await logoutAllMySessions();
      clearAuthAndRedirect();
    } catch (error) {
      setActionError(
        error?.response?.data?.code === "session_too_new_for_management"
          ? `You can sign out other sessions after ${formatDuration(
              Number(error?.response?.data?.remaining_seconds || remainingSeconds),
            )}.`
          : error?.response?.data?.detail ||
            error?.response?.data?.message ||
            "Could not sign out all sessions."
      );
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: compact ? 2 : 2.5,
        borderRadius: 2.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }}>
        <ShieldOutlinedIcon color="primary" />
        <Typography variant={compact ? "subtitle1" : "h6"} fontWeight={800}>
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Refresh sessions">
          <span>
            <IconButton
              size="small"
              onClick={() => load({ silent: true })}
              disabled={refreshing || loading}
            >
              {refreshing ? <CircularProgress size={17} /> : <RefreshOutlinedIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        <Chip size="small" label={`${activeCount} active`} />
        {maxActiveSessions != null && (
          <Chip size="small" variant="outlined" label={`Limit ${maxActiveSessions}`} />
        )}
      </Stack>

      {!hasSessionContext && sessions.length > 0 && (
        <Alert severity="warning" icon={<ShieldOutlinedIcon />} sx={{ mb: 1.5 }}>
          This login token is not bound to a managed session. Sign in again to manage your devices and sessions.
        </Alert>
      )}

      {hasSessionContext && !management.can_revoke_others && hasOtherSessions && (
        <Alert
          severity="info"
          icon={<LockClockOutlinedIcon />}
          sx={{ mb: 1.5 }}
        >
          Your current session becomes eligible to manage other sessions in{" "}
          <strong>{formatDuration(remainingSeconds)}</strong>.
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress size={28} />
        </Box>
      ) : sessions.length ? (
        <List disablePadding divider>
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              canManageOthers={management.can_revoke_others}
              onRevoke={handleRevoke}
              loadingId={loadingId}
            />
          ))}
        </List>
      ) : (
        <Alert severity="warning">No active session record was returned for this login.</Alert>
      )}

      <Divider sx={{ my: 2 }} />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
        <Button
          color="error"
          variant="contained"
          startIcon={<LogoutOutlinedIcon />}
          onClick={handleLogoutAll}
          disabled={!canLogoutAll || loading}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Sign out all sessions
        </Button>
        {!management.can_revoke_others && hasOtherSessions && (
          <Typography variant="caption" color="text.secondary">
            Available in {formatDuration(remainingSeconds)}.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
