import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Divider, Paper, Stack,
  TextField, Typography, alpha,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import apiRequest from "../../customHooks/apiRequest";
import {
  adminMeUrl, adminUsersApi, authMediaSrc, isSessionSuperuser, isSessionStaff,
} from "../adminUtils";
import ProfileImageManager from "../components/ProfileImageManager";
import { useToast } from "../components/ToastContext";

/**
 * ProfilePanel — personal settings for the currently logged-in staff/admin.
 *
 * Allows editing own email, viewing role badges, and managing own profile photos.
 */
export default function ProfilePanel({ me: meProp, onMeUpdated }) {
  const pushToast = useToast();
  const [me, setMe] = useState(meProp || null);
  const [loading, setLoading] = useState(!meProp);
  const [email, setEmail] = useState(meProp?.email || "");
  const [saving, setSaving] = useState(false);

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: adminMeUrl() });
      const d = res.data?.data || res.data || {};
      setMe(d);
      setEmail(d.email || "");
      onMeUpdated?.(d);
    } catch (e) {
      pushToast?.(e?.response?.data?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [onMeUpdated, pushToast]);

  useEffect(() => {
    if (!meProp) loadMe();
    else {
      setMe(meProp);
      setEmail(meProp.email || "");
    }
  }, [meProp, loadMe]);

  const avatarSrc = (() => {
    const profiles = me?.profiles || [];
    const first = profiles.find((p) => p.image) || profiles[0];
    if (first?.image) return authMediaSrc(first.image);
    if (me?.avatar) return authMediaSrc(me.avatar);
    if (me?.image) return authMediaSrc(me.image);
    return "";
  })();

  const saveEmail = async () => {
    if (!me?.id) return;
    setSaving(true);
    try {
      await apiRequest({
        method: "PATCH",
        url: `${adminUsersApi()}/${me.id}/`,
        data: { email },
      });
      pushToast?.("Profile updated");
      await loadMe();
    } catch (e) {
      pushToast?.(e?.response?.data?.message || e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  const isSuper = isSessionSuperuser();
  const isStaff = isSessionStaff();

  return (
    <Stack spacing={2.5} maxWidth={720}>
      <Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          My profile
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your personal account details and profile photos.
        </Typography>
      </Box>

      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 2 }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} gap={2.5} alignItems={{ sm: "center" }}>
          <Avatar
            src={avatarSrc || undefined}
            sx={{
              width: 72,
              height: 72,
              fontSize: 28,
              fontWeight: 800,
              bgcolor: "primary.main",
              borderRadius: 2,
            }}
          >
            {(me?.username || "A").charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={800} fontSize={18} noWrap>
              {me?.username || "—"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {me?.email || "—"}
            </Typography>
            <Stack direction="row" gap={0.75} mt={1} flexWrap="wrap">
              {isSuper && (
                <Chip size="small" color="error" label="Superuser" sx={{ fontWeight: 700 }} />
              )}
              {isStaff && !isSuper && (
                <Chip size="small" color="primary" label="Staff" sx={{ fontWeight: 700 }} />
              )}
              {me?.is_active === false && (
                <Chip size="small" color="warning" label="Inactive" />
              )}
            </Stack>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} gutterBottom>
          Account details
        </Typography>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Username"
            value={me?.username || ""}
            size="small"
            fullWidth
            disabled
            helperText="Username cannot be changed here."
          />
          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            fullWidth
            type="email"
          />
          <Box>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={saveEmail}
              disabled={saving || email === (me?.email || "")}
              sx={{ borderRadius: 1, textTransform: "none", fontWeight: 700 }}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
        <ProfileImageManager
          userId={me?.id}
          disabled={false}
          onToast={pushToast}
          initial={me?.profiles || []}
          onChange={() => {
            loadMe();
            try {
              window.dispatchEvent(new CustomEvent("admin-profile-changed", {
                detail: { userId: me?.id },
              }));
            } catch { /* */ }
          }}
        />
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.info.main, 0.04),
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Permissions and elevated roles are managed by a superuser under{" "}
          <strong>Users &amp; access</strong>. Contact a superuser if you need additional rules.
        </Typography>
      </Paper>
    </Stack>
  );
}
