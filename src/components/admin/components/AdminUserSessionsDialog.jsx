import React, { useCallback, useEffect, useState } from "react";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";
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
  Tooltip,
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/Refresh";
import ComputerOutlinedIcon from "@mui/icons-material/ComputerOutlined";
import PhoneAndroidOutlinedIcon from "@mui/icons-material/PhoneAndroidOutlined";
import TabletMacOutlinedIcon from "@mui/icons-material/TabletMacOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import {
  fetchAdminUserSessions,
  logoutAllAdminUserSessions,
  revokeAdminUserSession,
} from "../../security/sessionApi";

function formatDate(value, language) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(language === "fa" ? "fa-IR" : undefined);
}

function formatRelative(value, t) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return t("just now");
  if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t("minutes ago")}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ${t("hours ago")}`;
  return `${Math.floor(seconds / 86400)} ${t("days ago")}`;
}

function titleFor(session, t) {
  const device = session?.device || {};
  return device.name || [device.browser, device.os].filter(Boolean).join(" on ") || device.client || t("Web browser");
}

function DeviceIcon({ type }) {
  if (type === "mobile") return <PhoneAndroidOutlinedIcon />;
  if (type === "tablet") return <TabletMacOutlinedIcon />;
  return <ComputerOutlinedIcon />;
}

function deviceSummary(session, t) {
  const device = session?.device || {};
  const browser = [device.browser, device.browser_version].filter(Boolean).join(" ");
  const os = [device.os, device.os_version].filter(Boolean).join(" ");
  const model = device.device_model || "";
  const meta = device.client_metadata || {};
  const location = device.ip || device.last_ip || "";
  return {
    primary: [browser, os, model].filter(Boolean).join(" · ") || device.client || t("Browser session"),
    secondary: [
      location ? `IP ${location}` : "",
      meta.timezone || "",
      meta.locale || "",
    ].filter(Boolean).join(" · ") || t("Network details unavailable"),
    ua: device.user_agent || "",
  };
}

export default function AdminUserSessionsDialog({
  open,
  user,
  canManage = false,
  onClose,
  onToast,
}) {
  const { t, language } = useLocale();
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
        t("Could not load user sessions.")
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
    if (!window.confirm(t("Revoke this session?"))) return;
    setActionId(session.id);
    setError("");
    try {
      await revokeAdminUserSession(user.id, session.id);
      onToast?.(t("Session revoked"));
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        t("Could not revoke the session.")
      );
    } finally {
      setActionId(null);
    }
  };

  const revokeAll = async () => {
    if (!canManage || !user?.id) return;
    if (!window.confirm(t("Revoke all active sessions for this user?"))) return;
    setActionId("__all__");
    setError("");
    try {
      const result = await logoutAllAdminUserSessions(user.id);
      onToast?.(t("Sessions revoked") + ": " + Number(result?.revoked || 0));
      await load();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        t("Could not revoke all sessions.")
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
            <Chip size="small" label={`${Number(data?.active_count || 0)} ${t("active")}`} />
            {data?.max_active_sessions != null && (
              <Chip size="small" variant="outlined" label={`${t("Limit")} ${data.max_active_sessions}`} />
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
                        {t(actionId === session.id ? "Revoking…" : "Revoke")}
                      </Button>
                    ) : null
                  }
                >
                  <ListItemIcon sx={{ minWidth: 38, pt: 0.25 }}>
                    <DeviceIcon type={session?.device?.device_type} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography fontWeight={700} pr={10}>{titleFor(session, t)}</Typography>}
                    secondary={
                      <Stack spacing={0.35} sx={{ mt: 0.35, pr: 8 }}>
                        <Typography variant="caption" color="text.secondary">{deviceSummary(session, t).primary}</Typography>
                        <Typography variant="caption" color="text.secondary">{deviceSummary(session, t).secondary}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Created {formatDate(session?.created_at, language)} · {t("Last active")} {formatRelative(session?.last_seen_at, t)} · {t("Expires")} {formatDate(session?.expires_at, language)}
                        </Typography>
                        {deviceSummary(session, t).ua && (
                          <Tooltip title={deviceSummary(session, t).ua} placement="bottom-start">
                            <Typography variant="caption" color="text.disabled" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {deviceSummary(session, t).ua}
                            </Typography>
                          </Tooltip>
                        )}
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info">{t("This user has no active authentication sessions.")}</Alert>
          )}

          {!canManage && (
            <Alert severity="info">
              {t("You have session view permission only.")} <code>auth_sessions.manage</code> {t("to enable revoke controls.")}
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
            {t("Revoke all sessions")}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
