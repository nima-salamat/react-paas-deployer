/**
 * Group shared services — list, share (pick service → rules → per-member), manage.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  Switch,
  Divider,
  Stepper,
  Step,
  StepLabel,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import SettingsIcon from "@mui/icons-material/Settings";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonIcon from "@mui/icons-material/Person";
import apiRequest from "../../customHooks/apiRequest";
import {
  DEFAULT_SHARE_RULES,
  RULE_LABELS,
} from "../../service/services/ShareServiceDialog";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const SERVICES_ROOT = `${API_BASE}/services`;
const SERVICE_LIST = `${API_BASE}/services/service/`;

const PRESET_META = {
  viewer: { label: "Viewer" },
  operator: { label: "Operator" },
  developer: { label: "Developer" },
  ops: { label: "Ops" },
};

function normalizeRules(raw) {
  return { ...DEFAULT_SHARE_RULES, ...(raw || {}) };
}

function applyLocalPreset(name) {
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
  return normalizeRules(local[name] || {});
}

function RulesGrid({ rules, onChange, disabled }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
        {Object.keys(DEFAULT_SHARE_RULES)
          .filter((k) => k !== "daily_deploy_limit")
          .map((key) => (
            <FormControlLabel
              key={key}
              disabled={disabled}
              control={
                <Checkbox
                  size="small"
                  checked={!!rules[key]}
                  onChange={() => onChange({ ...rules, [key]: !rules[key] })}
                />
              }
              label={<Typography variant="caption">{RULE_LABELS[key] || key}</Typography>}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                pr: 1,
                m: 0.25,
                minWidth: "46%",
                opacity: disabled ? 0.6 : 1,
              }}
            />
          ))}
      </Stack>
      <TextField
        size="small"
        type="number"
        disabled={disabled}
        label="Daily deploy limit (max 50)"
        value={rules.daily_deploy_limit ?? 50}
        onChange={(e) => {
          let n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) n = 0;
          n = Math.max(0, Math.min(50, n));
          onChange({ ...rules, daily_deploy_limit: n });
        }}
        inputProps={{ min: 0, max: 50 }}
        helperText="Deploys/builds this member may run per day on this service"
        fullWidth
      />
    </Stack>
  );
}

export default function GroupSharedServicesPanel({ activeConv, meId, onClose }) {
  const groupId = activeConv?.id ?? activeConv?.pk;
  const participants = useMemo(() => {
    const raw = activeConv?.participants || activeConv?.members || [];
    return Array.isArray(raw) ? raw : [];
  }, [activeConv]);

  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [myServices, setMyServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [defaultRules, setDefaultRules] = useState({ ...DEFAULT_SHARE_RULES });
  const [preset, setPreset] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const [note, setNote] = useState("");
  const [expiresLocal, setExpiresLocal] = useState("");
  // memberOverrides: { [userId]: { rules, is_enabled, has_override } }
  const [memberOverrides, setMemberOverrides] = useState({});
  const [saving, setSaving] = useState(false);

  // Edit existing share members
  const [manageShare, setManageShare] = useState(null);
  const [manageMembers, setManageMembers] = useState([]);
  const [manageDefaultRules, setManageDefaultRules] = useState({});
  const [manageLoading, setManageLoading] = useState(false);

  const loadShares = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${SERVICES_ROOT}/services/groups/${groupId}/shares/`,
      });
      const data = res?.data || {};
      setShares(Array.isArray(data.shares) ? data.shares : []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load shares");
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const loadMyServices = useCallback(async () => {
    setLoadingServices(true);
    setError("");
    let list = [];
    try {
      const res = await apiRequest({ method: "GET", url: `${SERVICES_ROOT}/services/mine/` });
      list = res?.data?.services || res?.data?.results || res?.data?.data || [];
      if (!Array.isArray(list)) list = [];
    } catch {
      list = [];
    }
    // Fallback: regular service list (owner-scoped)
    if (list.length === 0) {
      try {
        const res2 = await apiRequest({
          method: "GET",
          url: SERVICE_LIST,
          params: { page_size: 100 },
        });
        const body = res2?.data;
        if (Array.isArray(body)) list = body;
        else if (Array.isArray(body?.results)) list = body.results;
        else if (Array.isArray(body?.data)) list = body.data;
        else list = [];
      } catch {
        list = [];
      }
    }
    setMyServices(list);
    setLoadingServices(false);
  }, []);

  const openWizard = () => {
    setStep(0);
    setSelectedService(null);
    setDefaultRules({ ...DEFAULT_SHARE_RULES });
    setPreset("");
    setAdminOnly(false);
    setNote("");
    setExpiresLocal("");
    setMemberOverrides({});
    setWizardOpen(true);
    loadMyServices();
  };

  const initMemberOverridesFromParticipants = (baseRules) => {
    const map = {};
    participants.forEach((p) => {
      const u = p.user || p;
      const uid = String(u.id ?? u.pk ?? p.user_id ?? "");
      if (!uid || String(uid) === String(meId)) return;
      map[uid] = {
        user_id: u.id ?? u.pk ?? p.user_id,
        username: u.username || u.email || uid,
        role: p.role || "member",
        rules: { ...baseRules },
        is_enabled: true,
        has_override: false,
      };
    });
    setMemberOverrides(map);
  };

  const goToRules = (svc) => {
    setSelectedService(svc);
    setStep(1);
  };

  const goToMembers = () => {
    initMemberOverridesFromParticipants(defaultRules);
    setStep(2);
  };

  const setMemberRule = (uid, patch) => {
    setMemberOverrides((prev) => ({
      ...prev,
      [uid]: {
        ...prev[uid],
        ...patch,
        has_override: true,
      },
    }));
  };

  const fromLocalInputValue = (local) => {
    if (!local) return null;
    try {
      const d = new Date(local);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  };

  const submitShare = async () => {
    if (!selectedService) return;
    setSaving(true);
    setError("");
    try {
      const members = Object.values(memberOverrides).map((m) => ({
        user_id: m.user_id,
        rules: m.rules,
        is_enabled: m.is_enabled,
      }));
      await apiRequest({
        method: "POST",
        url: `${SERVICES_ROOT}/services/share/`,
        data: {
          service_id: selectedService.id ?? selectedService.pk,
          group_id: groupId,
          rules: defaultRules,
          note: note.trim(),
          admin_only: adminOnly,
          expires_at: fromLocalInputValue(expiresLocal),
          preset: preset || "",
          members,
        },
      });
      setWizardOpen(false);
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Share failed");
    } finally {
      setSaving(false);
    }
  };

  const handleUnshare = async (share) => {
    try {
      await apiRequest({
        method: "DELETE",
        url: `${SERVICES_ROOT}/services/shares/${share.id}/`,
      });
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Unshare failed");
    }
  };

  const runAction = async (share, action) => {
    const serviceId = share.service_id || share.service?.id;
    if (!serviceId) return;
    const pathMap = {
      start: `${SERVICES_ROOT}/start_service/`,
      stop: `${SERVICES_ROOT}/stop_service/`,
      restart: `${SERVICES_ROOT}/restart_service/`,
    };
    try {
      await apiRequest({ method: "POST", url: pathMap[action], data: { service_id: serviceId } });
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Action failed");
    }
  };

  const openManageMembers = async (share) => {
    setManageShare(share);
    setManageLoading(true);
    setError("");
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${SERVICES_ROOT}/services/shares/${share.id}/members/`,
      });
      const data = res?.data || {};
      setManageMembers(Array.isArray(data.members) ? data.members : []);
      setManageDefaultRules(normalizeRules(data.default_rules || share.rules));
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load members");
      setManageShare(null);
    } finally {
      setManageLoading(false);
    }
  };

  const saveManageMembers = async () => {
    if (!manageShare) return;
    setSaving(true);
    try {
      await apiRequest({
        method: "PUT",
        url: `${SERVICES_ROOT}/services/shares/${manageShare.id}/members/`,
        data: {
          members: manageMembers.map((m) => ({
            user_id: m.user_id,
            rules: m.rules,
            is_enabled: m.is_enabled,
          })),
        },
      });
      setManageShare(null);
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!groupId || String(activeConv?.type || "").toLowerCase() !== "group") {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Shared services are only available in groups.
        </Typography>
      </Box>
    );
  }

  const memberList = Object.values(memberOverrides);

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <CloudQueueIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1 }}>
          Shared services
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadShares} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          disableElevation
          startIcon={<ShareIcon />}
          onClick={openWizard}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
        >
          Share
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ m: 1.5 }} onClose={() => setError("")}>
          {String(error)}
        </Alert>
      ) : null}

      <Box sx={{ flex: 1, overflow: "auto", px: 0.5 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : shares.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No services shared with this group yet.
            </Typography>
            <Button size="small" startIcon={<ShareIcon />} onClick={openWizard} sx={{ mt: 1.5, textTransform: "none" }}>
              Share a service
            </Button>
          </Box>
        ) : (
          <List dense disablePadding>
            {shares.map((share) => {
              const name = share.service_name || share.service?.name || share.service_id || "Service";
              const status = share.service_status || share.service?.status || "—";
              const isOwner = String(share.shared_by_id) === String(meId);
              const perms = share.my_permissions || share.rules || {};
              return (
                <ListItem
                  key={share.id}
                  alignItems="flex-start"
                  sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.25 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" fontWeight={700}>
                          {name}
                        </Typography>
                        <Chip size="small" label={status} sx={{ height: 20, fontWeight: 700 }} />
                        {isOwner && (
                          <Chip size="small" color="info" variant="outlined" label="Mine" sx={{ height: 20 }} />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        by {share.shared_by_username || "—"}
                        {share.note ? ` · ${share.note}` : ""}
                      </Typography>
                    }
                  />
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    {perms.can_start && (
                      <Tooltip title="Start">
                        <IconButton size="small" onClick={() => runAction(share, "start")}>
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {perms.can_stop && (
                      <Tooltip title="Stop">
                        <IconButton size="small" onClick={() => runAction(share, "stop")}>
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {perms.can_restart && (
                      <Tooltip title="Restart">
                        <IconButton size="small" onClick={() => runAction(share, "restart")}>
                          <RestartAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isOwner && (
                      <>
                        <Tooltip title="Member permissions">
                          <IconButton size="small" onClick={() => openManageMembers(share)}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Unshare">
                          <IconButton size="small" color="warning" onClick={() => handleUnshare(share)}>
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* ── Share wizard ── */}
      <Dialog open={wizardOpen} onClose={() => !saving && setWizardOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          Share service with group
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {activeConv?.title || `Group #${groupId}`}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 2 }}>
            <Step><StepLabel>Service</StepLabel></Step>
            <Step><StepLabel>Default rules</StepLabel></Step>
            <Step><StepLabel>Members</StepLabel></Step>
          </Stepper>

          {step === 0 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Choose one of your services to share
              </Typography>
              {loadingServices ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : myServices.length === 0 ? (
                <Alert severity="info">You have no services to share.</Alert>
              ) : (
                <List dense>
                  {myServices.map((s) => (
                    <ListItemButton
                      key={s.id ?? s.pk}
                      selected={String(selectedService?.id ?? selectedService?.pk) === String(s.id ?? s.pk)}
                      onClick={() => goToRules(s)}
                    >
                      <ListItemText
                        primary={s.name || s.id}
                        secondary={s.status || s.plan?.name || ""}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          )}

          {step === 1 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                {selectedService?.name || "Service"} — default rules for the group
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                {Object.entries(PRESET_META).map(([key, meta]) => (
                  <Chip
                    key={key}
                    label={meta.label}
                    color={preset === key ? "primary" : "default"}
                    variant={preset === key ? "filled" : "outlined"}
                    onClick={() => {
                      setPreset(key);
                      setDefaultRules(applyLocalPreset(key));
                    }}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Stack>
              <FormControlLabel
                control={<Switch size="small" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} />}
                label="Admins only (base gate — still can set per-member below)"
              />
              <TextField
                size="small"
                type="datetime-local"
                label="Expires at (optional)"
                value={expiresLocal}
                onChange={(e) => setExpiresLocal(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField size="small" label="Note" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />
              <Divider />
              <RulesGrid
                rules={defaultRules}
                onChange={(r) => {
                  setPreset("");
                  setDefaultRules(r);
                }}
              />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Set permissions per group member. Disabled members cannot use the service.
              </Typography>
              {memberList.length === 0 ? (
                <Alert severity="warning">
                  No other members found on this conversation object. You can still share with default rules;
                  open Member permissions later after members load.
                </Alert>
              ) : (
                memberList.map((m) => (
                  <Box
                    key={m.user_id}
                    sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <Avatar sx={{ width: 28, height: 28 }}>
                        <PersonIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {m.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {m.role}
                        </Typography>
                      </Box>
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={m.is_enabled}
                            onChange={(e) =>
                              setMemberRule(String(m.user_id), { is_enabled: e.target.checked })
                            }
                          />
                        }
                        label="Enabled"
                      />
                      <Button
                        size="small"
                        onClick={() =>
                          setMemberRule(String(m.user_id), {
                            rules: { ...defaultRules },
                            has_override: false,
                          })
                        }
                      >
                        Reset
                      </Button>
                    </Stack>
                    {m.is_enabled && (
                      <RulesGrid
                        rules={m.rules}
                        onChange={(r) => setMemberRule(String(m.user_id), { rules: r })}
                      />
                    )}
                  </Box>
                ))
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setWizardOpen(false)} disabled={saving}>
            Cancel
          </Button>
          {step > 0 && (
            <Button onClick={() => setStep((s) => s - 1)} disabled={saving} startIcon={<ArrowBackIcon />}>
              Back
            </Button>
          )}
          {step === 1 && (
            <Button variant="contained" disableElevation onClick={goToMembers}>
              Next: Members
            </Button>
          )}
          {step === 2 && (
            <Button
              variant="contained"
              disableElevation
              onClick={submitShare}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ShareIcon />}
            >
              Share
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* ── Manage members dialog ── */}
      <Dialog
        open={Boolean(manageShare)}
        onClose={() => !saving && setManageShare(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Member permissions
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {manageShare?.service_name || manageShare?.service?.name || "Service"}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {manageLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {manageMembers.map((m, idx) => (
                <Box
                  key={m.user_id}
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <Avatar sx={{ width: 28, height: 28 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {m.username || m.display_name || m.user_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {m.role}
                        {m.has_override ? " · custom" : " · default"}
                      </Typography>
                    </Box>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={m.is_enabled}
                          onChange={(e) => {
                            const next = [...manageMembers];
                            next[idx] = { ...m, is_enabled: e.target.checked };
                            setManageMembers(next);
                          }}
                        />
                      }
                      label="Enabled"
                    />
                  </Stack>
                  {m.is_enabled && (
                    <RulesGrid
                      rules={normalizeRules(m.rules)}
                      onChange={(r) => {
                        const next = [...manageMembers];
                        next[idx] = { ...m, rules: r, has_override: true };
                        setManageMembers(next);
                      }}
                    />
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setManageShare(null)} disabled={saving}>
            Close
          </Button>
          <Button variant="contained" disableElevation onClick={saveManageMembers} disabled={saving || manageLoading}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
