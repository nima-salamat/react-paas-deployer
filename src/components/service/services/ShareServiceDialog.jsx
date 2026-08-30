/**
 * Share a service with a messenger group or a specific user + permission rules.
 * Supports presets, expires_at, admin_only.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Divider,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import apiRequest from "../../customHooks/apiRequest";
import { SHARE_CREATE_URL, shareDetailUrl, friendlyError } from "./helpers";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const PRESETS_URL = `${API_BASE}/services/share-presets/`;
const GROUPS_URL = `${API_BASE}/api/messenger/conversations/`;

export const DEFAULT_SHARE_RULES = {
  can_view: true,
  can_view_logs: true,
  can_view_deploy_logs: true,
  can_view_metrics: true,
  can_view_db_credentials: false,
  can_start: false,
  can_stop: false,
  can_restart: false,
  can_rebuild: false,
  can_purge: false,
  can_deploy_add: false,
  can_deploy_edit: false,
  can_deploy_remove: false,
  can_deploy_select: false,
  can_volume_add: false,
  can_volume_edit: false,
  can_volume_delete: false,
  can_volume_attach: false,
  can_volume_detach: false,
  can_network_change: false,
  can_change_config: false,
};

export const RULE_LABELS = {
  can_view: "View service",
  can_view_logs: "View service logs",
  can_view_deploy_logs: "View deploy logs",
  can_view_metrics: "View metrics",
  can_view_db_credentials: "View DB credentials",
  can_start: "Start",
  can_stop: "Stop",
  can_restart: "Restart",
  can_rebuild: "Rebuild",
  can_purge: "Purge runtime",
  can_deploy_add: "Add deploy",
  can_deploy_edit: "Edit own deploys",
  can_deploy_remove: "Remove own deploys",
  can_deploy_select: "Select active deploy",
  can_volume_add: "Add volume",
  can_volume_edit: "Edit volume",
  can_volume_delete: "Delete volume",
  can_volume_attach: "Attach volume",
  can_volume_detach: "Detach volume",
  can_network_change: "Change network",
  can_change_config: "Change service config",
};

const PRESET_META = {
  viewer: { label: "Viewer", color: "default", hint: "View + logs only" },
  operator: { label: "Operator", color: "primary", hint: "Start / stop / rebuild" },
  developer: { label: "Developer", color: "secondary", hint: "Deploys + volumes" },
  ops: { label: "Ops", color: "warning", hint: "Full control except delete service" },
};

function toLocalInputValue(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalInputValue(local) {
  if (!local) return null;
  try {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export default function ShareServiceDialog({
  open,
  onClose,
  service = null,
  existingShare = null,
  onDone = null,
  fixedGroupId = null,
  fixedGroupTitle = "",
}) {
  const isEdit = Boolean(existingShare?.id);
  const [mode, setMode] = useState("group");
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [rules, setRules] = useState({ ...DEFAULT_SHARE_RULES });
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const [expiresLocal, setExpiresLocal] = useState("");
  const [presetMap, setPresetMap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPresets = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: PRESETS_URL });
      const data = res?.data || {};
      if (data.presets && typeof data.presets === "object") setPresetMap(data.presets);
    } catch {
      setPresetMap(null);
    }
  }, []);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: GROUPS_URL });
      const body = res?.data;
      let list = [];
      if (Array.isArray(body)) list = body;
      else if (Array.isArray(body?.results)) list = body.results;
      else if (Array.isArray(body?.data)) list = body.data;
      else if (Array.isArray(body?.conversations)) list = body.conversations;
      setGroups(
        list.filter((c) => String(c.type || c.conversation_type || "").toLowerCase() === "group")
      );
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError("");
    loadPresets();
    if (isEdit) {
      const s = existingShare;
      setRules({ ...DEFAULT_SHARE_RULES, ...(s.rules || {}) });
      setNote(s.note || "");
      setPreset(s.preset || "");
      setAdminOnly(Boolean(s.admin_only));
      setExpiresLocal(toLocalInputValue(s.expires_at));
      setMode(s.group_id ? "group" : "user");
      setGroupId(s.group_id ? String(s.group_id) : "");
      setTargetUserId(s.target_user_id ? String(s.target_user_id) : "");
    } else {
      setRules({ ...DEFAULT_SHARE_RULES });
      setNote("");
      setPreset("");
      setAdminOnly(false);
      setExpiresLocal("");
      setMode("group");
      setGroupId(fixedGroupId ? String(fixedGroupId) : "");
      setTargetUserId("");
      if (!fixedGroupId) loadGroups();
    }
  }, [open, isEdit, existingShare, fixedGroupId, loadGroups, loadPresets]);

  const applyPreset = (name) => {
    if (!name) {
      setPreset("");
      return;
    }
    setPreset(name);
    const fromApi = presetMap?.[name];
    if (fromApi && typeof fromApi === "object") {
      setRules({ ...DEFAULT_SHARE_RULES, ...fromApi });
      return;
    }
    const local = {
      viewer: {
        can_view: true,
        can_view_logs: true,
        can_view_deploy_logs: true,
        can_view_metrics: true,
      },
      operator: {
        can_view: true,
        can_view_logs: true,
        can_view_deploy_logs: true,
        can_view_metrics: true,
        can_start: true,
        can_stop: true,
        can_restart: true,
        can_rebuild: true,
      },
      developer: {
        can_view: true,
        can_view_logs: true,
        can_view_deploy_logs: true,
        can_view_metrics: true,
        can_start: true,
        can_stop: true,
        can_restart: true,
        can_rebuild: true,
        can_deploy_add: true,
        can_deploy_edit: true,
        can_deploy_remove: true,
        can_deploy_select: true,
        can_volume_attach: true,
        can_volume_detach: true,
        can_change_config: true,
      },
      ops: Object.fromEntries(Object.keys(DEFAULT_SHARE_RULES).map((k) => [k, true])),
    };
    setRules({ ...DEFAULT_SHARE_RULES, ...(local[name] || {}) });
  };

  const toggleRule = (key) => {
    setPreset("");
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        rules,
        note: (note || "").trim(),
        admin_only: Boolean(adminOnly),
        expires_at: fromLocalInputValue(expiresLocal),
        preset: preset || "",
      };

      if (isEdit) {
        await apiRequest({
          method: "PATCH",
          url: shareDetailUrl(existingShare.id),
          data: payload,
        });
      } else {
        if (!service?.id && !service?.pk) {
          setError("No service selected");
          setSaving(false);
          return;
        }
        const body = {
          service_id: service.id || service.pk,
          ...payload,
        };
        if (fixedGroupId || mode === "group") {
          const gid = fixedGroupId || groupId;
          if (!gid) {
            setError("Select a group");
            setSaving(false);
            return;
          }
          body.group_id = Number(gid) || gid;
        } else {
          if (!targetUserId.trim()) {
            setError("Enter target user id");
            setSaving(false);
            return;
          }
          body.target_user_id = targetUserId.trim();
        }
        await apiRequest({
          method: "POST",
          url: SHARE_CREATE_URL,
          data: body,
        });
      }
      onDone?.();
      onClose?.();
    } catch (e) {
      setError(friendlyError(e) || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const serviceName = service?.name || existingShare?.service_name || "Service";

  return (
    <Dialog open={open} onClose={() => !saving && onClose?.()} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? "Edit share rules" : "Share service"}
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {serviceName}
          {fixedGroupTitle ? ` · ${fixedGroupTitle}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {!isEdit && !fixedGroupId && (
            <>
              <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} fullWidth>
                <ToggleButton value="group">Group</ToggleButton>
                <ToggleButton value="user">User</ToggleButton>
              </ToggleButtonGroup>
              {mode === "group" ? (
                <FormControl size="small" fullWidth>
                  <InputLabel>Group</InputLabel>
                  <Select label="Group" value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={loading}>
                    {groups.map((g) => (
                      <MenuItem key={g.id ?? g.pk} value={String(g.id ?? g.pk)}>
                        {g.title || g.name || g.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <TextField
                  size="small"
                  fullWidth
                  label="Target user ID"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  helperText="UUID of the user to share with"
                />
              )}
            </>
          )}

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Quick presets
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
              {Object.entries(PRESET_META).map(([key, meta]) => (
                <Chip
                  key={key}
                  label={meta.label}
                  color={preset === key ? meta.color : "default"}
                  variant={preset === key ? "filled" : "outlined"}
                  onClick={() => applyPreset(key)}
                  sx={{ fontWeight: 700 }}
                  title={meta.hint}
                />
              ))}
              {preset ? (
                <Chip label="Clear preset" variant="outlined" onClick={() => setPreset("")} sx={{ fontWeight: 600 }} />
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {preset ? PRESET_META[preset]?.hint || preset : "Pick a preset or toggle rules manually"}
            </Typography>
          </Box>

          <Divider />

          <Stack spacing={1.25}>
            <FormControlLabel
              control={<Switch checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    Admins only
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Only group owner/admin can use the service
                  </Typography>
                </Box>
              }
            />
            <TextField
              size="small"
              fullWidth
              type="datetime-local"
              label="Expires at (optional)"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Leave empty for no expiry"
            />
            <TextField size="small" fullWidth label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          </Stack>

          <Divider />

          <Typography variant="subtitle2" fontWeight={700}>
            Allowed actions
          </Typography>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
            {Object.keys(DEFAULT_SHARE_RULES).map((key) => (
              <FormControlLabel
                key={key}
                control={<Checkbox size="small" checked={!!rules[key]} onChange={() => toggleRule(key)} />}
                label={<Typography variant="caption">{RULE_LABELS[key] || key}</Typography>}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  pr: 1,
                  m: 0.25,
                  minWidth: "46%",
                }}
              />
            ))}
          </Stack>

          {error ? <Alert severity="error">{String(error)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ShareIcon />}
        >
          {isEdit ? "Save" : "Share"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
