import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, FormControlLabel,
  Paper, Stack, Switch, TextField, Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from "@mui/icons-material/Refresh";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import apiRequest from "../../customHooks/apiRequest";
import { loginSettingsAdminApi, hasAnyRule } from "../adminUtils";
import PermissionGate from "../components/PermissionGate";
import { useToast } from "../components/ToastContext";

// Every group below mirrors the Django admin.py fieldsets in
// auth_users/admin.py → LoginSettingsAdmin. Each field is rendered with
// the right control (Switch for booleans, TextField for text/numbers).

const GROUPS = [
  {
    title: "Identifiers",
    description: "Which identifiers users can use to log in or sign up.",
    fields: [
      ["allow_username", "Allow username", "bool"],
      ["allow_email", "Allow email", "bool"],
      ["allow_phone", "Allow phone", "bool"],
    ],
  },
  {
    title: "Authentication factors",
    description: "OTP and/or password requirements for authentication.",
    fields: [
      ["require_otp", "Require OTP", "bool"],
      ["require_password", "Require password", "bool"],
      ["password_as_second_factor", "Password as second factor (2FA)", "bool"],
    ],
  },
  {
    title: "Signup / activation",
    description:
      "When allow_auto_signup=False (or require_invite_for_signup=True), new accounts can only be created with a valid invite link.",
    fields: [
      ["allow_auto_signup", "Allow auto-signup", "bool"],
      ["require_invite_for_signup", "Require invite for signup", "bool"],
      ["auto_activate_on_signup", "Auto-activate on signup", "bool"],
      ["require_password_on_signup", "Require password on signup", "bool"],
      ["activate_after_successful_otp", "Activate after successful OTP", "bool"],
    ],
  },
  {
    title: "Login master switch",
    description:
      "When allow_login=False the entire login/signup UI is blocked and the custom title + message are shown to users.",
    fields: [
      ["allow_login", "Allow login (master switch)", "bool"],
    ],
  },
  {
    title: "Username recovery (Forgot Username)",
    description: "Enable username recovery and pick channels for sending the OTP.",
    fields: [
      ["allow_username_recovery", "Allow username recovery", "bool"],
      ["recovery_via_email", "Recovery via email", "bool"],
      ["recovery_via_phone", "Recovery via phone", "bool"],
    ],
  },
  {
    title: "Password recovery (Forgot Password)",
    description: "Enable/disable forgot-password flow and control channels + password rules.",
    fields: [
      ["allow_password_recovery", "Allow password recovery", "bool"],
      ["password_recovery_via_email", "Password recovery via email", "bool"],
      ["password_recovery_via_phone", "Password recovery via phone", "bool"],
      ["require_confirm_password", "Require confirm password", "bool"],
      ["min_password_length", "Min password length", "int"],
    ],
  },
  {
    title: "OTP settings",
    description: "OTP code length, expiry window and max attempts before lock.",
    fields: [
      ["otp_length", "OTP length (digits)", "int"],
      ["otp_expire_minutes", "OTP expire (minutes)", "int"],
      ["otp_max_attempts", "OTP max attempts", "int"],
    ],
  },
  {
    title: "Login-closed message",
    description: "Shown to users when the master login switch is OFF.",
    fields: [
      ["custom_login_closed_title", "Login-closed title", "text"],
      ["custom_login_closed_message", "Login-closed message", "text"],
    ],
  },
];

const ALL_FIELDS = GROUPS.flatMap((g) => g.fields.map(([key]) => key));

export default function LoginSettingsPanel() {
  const pushToast = useToast();
  const canManage = hasAnyRule("login_settings.manage");
  const API = useMemo(() => loginSettingsAdminApi(), []);

  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: API });
      const data = res.data?.data || res.data?.settings || res.data || {};
      // Ensure all fields exist (default to false/0/"") so the form is stable
      const normalized = {};
      for (const key of ALL_FIELDS) {
        normalized[key] = data[key] ?? defaultFor(key);
      }
      setForm(normalized);
      setDirty(false);
    } catch (e) {
      pushToast(e?.response?.data?.message || "Failed to load login settings");
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [API, pushToast]);

  useEffect(() => { load(); }, [load]);

  const setField = (key, val) => {
    setForm((s) => ({ ...s, [key]: val }));
    setDirty(true);
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      await apiRequest({ method: "PATCH", url: API, data: form });
      pushToast("Login settings saved");
      setDirty(false);
      load();
    } catch (e) {
      pushToast(e?.response?.data?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <Stack alignItems="center" gap={1.5}>
          <CircularProgress />
          <Typography color="text.secondary">Loading login settings…</Typography>
        </Stack>
      </Box>
    );
  }

  if (!form) {
    return <Alert severity="warning">Could not load login settings.</Alert>;
  }

  return (
    <PermissionGate anyOf={["login_settings.view", "login_settings.manage"]}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Login system</Typography>
          <Typography variant="body2" color="text.secondary">
            Control signup, OTP, recovery and the master login switch.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button startIcon={<RefreshIcon />} onClick={load} disabled={busy}>Refresh</Button>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={save}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          )}
        </Stack>
      </Stack>

      {!form.allow_login && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Login is currently <strong>closed</strong>. Users see: “{form.custom_login_closed_title || "Login unavailable"}”
          {form.custom_login_closed_message && (
            <>
              {" — "}
              <em>{form.custom_login_closed_message}</em>
            </>
          )}
        </Alert>
      )}

      {!canManage && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You have view-only permission. Editing is disabled.
        </Alert>
      )}

      <Stack gap={2}>
        {GROUPS.map((g) => (
          <Paper key={g.title} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
              <Typography fontWeight={700}>{g.title}</Typography>
              {g.title === "Login master switch" && (
                <Chip
                  size="small"
                  label={form.allow_login ? "OPEN" : "CLOSED"}
                  color={form.allow_login ? "success" : "error"}
                  sx={{ height: 20, fontSize: 11 }}
                />
              )}
            </Stack>
            {g.description && (
              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                {g.description}
              </Typography>
            )}
            <Divider sx={{ mb: 1.5 }} />
            <Stack gap={1.25}>
              {g.fields.map(([key, label, type]) => (
                <FieldRow
                  key={key}
                  fieldKey={key}
                  label={label}
                  type={type}
                  value={form[key]}
                  disabled={!canManage}
                  onChange={(v) => setField(key, v)}
                />
              ))}
            </Stack>
          </Paper>
        ))}

        {canManage && (
          <Stack direction="row" justifyContent="flex-end" gap={1}>
            <Button onClick={load} disabled={busy || !dirty}>Discard</Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={save}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </Stack>
        )}
      </Stack>
    </PermissionGate>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function defaultFor(key) {
  if (key.endsWith("_length") || key.endsWith("_minutes") || key.endsWith("_attempts")) return 0;
  if (key.startsWith("custom_")) return "";
  return false;
}

function FieldRow({ fieldKey, label, type, value, disabled, onChange }) {
  if (type === "bool") {
    return (
      <FormControlLabel
        disabled={disabled}
        control={
          <Switch
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
        }
        label={label}
        sx={{ m: 0, alignItems: "center" }}
      />
    );
  }
  if (type === "int") {
    return (
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} gap={1} sx={{ width: "100%" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500}>{label}</Typography>
        </Box>
        <TextField
          size="small"
          type="number"
          value={value ?? ""}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          sx={{ width: { xs: "100%", sm: 160 } }}
          inputProps={{ min: 1 }}
        />
      </Stack>
    );
  }
  // text
  return (
    <Stack gap={0.5}>
      <Typography variant="body2" fontWeight={500}>{label}</Typography>
      <TextField
        size="small"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        fullWidth
        multiline={fieldKey === "custom_login_closed_message"}
        minRows={fieldKey === "custom_login_closed_message" ? 2 : 1}
      />
    </Stack>
  );
}
