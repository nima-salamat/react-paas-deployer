/**
 * Share service — group (member of) or contact user, with rules + per-member limits.
 * Paginated groups / contacts / group members. Role chips for members.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  TextField,
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
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  InputAdornment,
  Pagination,
  Tabs,
  Tab,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import SearchIcon from "@mui/icons-material/Search";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import apiRequest from "../../customHooks/apiRequest";
import { SHARE_CREATE_URL, shareDetailUrl, friendlyError } from "./helpers";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const PRESETS_URL = `${API_BASE}/services/share-presets/`;
const MSG_API = `${API_BASE}/api/messenger`;
const CONVERSATIONS_URL = `${MSG_API}/conversations/`;
const CONTACTS_URL = `${MSG_API}/contacts/`;
const participantsUrl = (id) => `${MSG_API}/conversations/${id}/participants/`;

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
  daily_deploy_limit: 50,
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
  daily_deploy_limit: "Daily deploy limit",
};

const PRESET_META = {
  viewer: { label: "Viewer", color: "default", hint: "View + logs only" },
  operator: { label: "Operator", color: "primary", hint: "Start / stop / rebuild" },
  developer: { label: "Developer", color: "secondary", hint: "Deploys + volumes" },
  ops: { label: "Ops", color: "warning", hint: "Full control except delete service" },
};

const ROLE_COLOR = {
  owner: "error",
  admin: "warning",
  member: "default",
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

function applyLocalPreset(name) {
  const local = {
    viewer: {
      can_view: true,
      can_view_logs: true,
      can_view_deploy_logs: true,
      can_view_metrics: true,
      daily_deploy_limit: 0,
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
      daily_deploy_limit: 10,
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
      daily_deploy_limit: 20,
    },
    ops: {
      ...Object.fromEntries(Object.keys(DEFAULT_SHARE_RULES).map((k) => [k, k === "daily_deploy_limit" ? 50 : true])),
    },
  };
  return { ...DEFAULT_SHARE_RULES, ...(local[name] || {}) };
}

function RulesGrid({ rules, onChange }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.5}>
        {Object.keys(DEFAULT_SHARE_RULES)
          .filter((k) => k !== "daily_deploy_limit")
          .map((key) => (
            <FormControlLabel
              key={key}
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
              }}
            />
          ))}
      </Stack>
      <TextField
        size="small"
        type="number"
        label="Daily deploy limit (max 50)"
        value={rules.daily_deploy_limit ?? 50}
        onChange={(e) => {
          let n = parseInt(e.target.value, 10);
          if (Number.isNaN(n)) n = 0;
          n = Math.max(0, Math.min(50, n));
          onChange({ ...rules, daily_deploy_limit: n });
        }}
        inputProps={{ min: 0, max: 50 }}
        helperText="Deploys/builds allowed per day"
        fullWidth
      />
    </Stack>
  );
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
  // Recipient may open dialog by mistake — never allow them to mutate rules
  const viewOnly = Boolean(
    isEdit && existingShare && existingShare.is_owner === false
  );
  const [mode, setMode] = useState("group"); // group | user
  const [rules, setRules] = useState({ ...DEFAULT_SHARE_RULES });
  const [note, setNote] = useState("");
  const [preset, setPreset] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const [expiresLocal, setExpiresLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existingShares, setExistingShares] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Groups (paginated)
  const [groups, setGroups] = useState([]);
  const [groupPage, setGroupPage] = useState(1);
  const [groupTotal, setGroupTotal] = useState(0);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Contacts (paginated)
  const [contacts, setContacts] = useState([]);
  const [contactPage, setContactPage] = useState(1);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactQuery, setContactQuery] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetUsername, setTargetUsername] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Group members (paginated) + role filter
  const [members, setMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberRole, setMemberRole] = useState("all"); // all|owner|admin|member
  const [loadingMembers, setLoadingMembers] = useState(false);
  // per-member overrides when sharing to group
  const [memberOverrides, setMemberOverrides] = useState({});
  const [selectedMemberId, setSelectedMemberId] = useState(null);


  const loadExistingShares = useCallback(async () => {
    const sid = service?.id || service?.pk || existingShare?.service_id;
    if (!sid) {
      setExistingShares([]);
      return;
    }
    setLoadingExisting(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${API_BASE}/services/services/shared/`,
        params: { scope: "created" },
      });
      const body = res?.data || {};
      let list = body.shares || body.results || [];
      if (!Array.isArray(list)) list = [];
      list = list.filter((s) => String(s.service_id) === String(sid) && s.is_active !== false);
      setExistingShares(list);
    } catch {
      setExistingShares([]);
    } finally {
      setLoadingExisting(false);
    }
  }, [service, existingShare]);

  const unshareExisting = async (shareId) => {
    try {
      await apiRequest({
        method: "DELETE",
        url: `${API_BASE}/services/services/shares/${shareId}/`,
      });
      // Optimistic UI update — remove immediately without waiting for reload
      setExistingShares((prev) => prev.filter((s) => String(s.id) !== String(shareId)));
      await loadExistingShares();
      onDone?.();
    } catch (e) {
      setError(friendlyError(e) || e?.message || "Unshare failed");
      loadExistingShares();
    }
  };

  const PAGE_SIZE = 10;
  const searchTimer = useRef(null);

  const loadGroups = useCallback(
    async (page = 1, q = "") => {
      setLoadingGroups(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: CONVERSATIONS_URL,
          params: { page, page_size: PAGE_SIZE, q: q || undefined },
        });
        const body = res?.data?.data || res?.data || {};
        let list = body.results || body.conversations || (Array.isArray(body) ? body : []);
        if (!Array.isArray(list)) list = [];
        // Only groups the user is in
        list = list.filter((c) => String(c.type || "").toLowerCase() === "group");
        setGroups(list);
        setGroupTotal(body.total != null ? body.total : list.length);
        setGroupPage(page);
      } catch {
        setGroups([]);
        setGroupTotal(0);
      } finally {
        setLoadingGroups(false);
      }
    },
    []
  );

  const loadContacts = useCallback(async (page = 1, q = "") => {
    setLoadingContacts(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: CONTACTS_URL,
        params: { page, page_size: PAGE_SIZE, q: q || undefined },
      });
      const body = res?.data?.data || res?.data || {};
      let list = body.results || (Array.isArray(body) ? body : []);
      if (!Array.isArray(list)) list = [];
      setContacts(list);
      setContactTotal(body.total != null ? body.total : list.length);
      setContactPage(page);
    } catch {
      setContacts([]);
      setContactTotal(0);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadMembers = useCallback(
    async (gid, page = 1, q = "", role = "all") => {
      if (!gid) return;
      setLoadingMembers(true);
      try {
        const params = { page, page_size: PAGE_SIZE };
        if (q) params.q = q;
        if (role && role !== "all") params.role = role;
        const res = await apiRequest({
          method: "GET",
          url: participantsUrl(gid),
          params,
        });
        const body = res?.data?.data || res?.data || {};
        const list = body.results || [];
        setMembers(Array.isArray(list) ? list : []);
        setMemberTotal(body.total || 0);
        setMemberPage(page);
      } catch {
        setMembers([]);
        setMemberTotal(0);
      } finally {
        setLoadingMembers(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    setError("");
    loadExistingShares();
    if (isEdit) {
      const s = existingShare;
      setRules({ ...DEFAULT_SHARE_RULES, ...(s.rules || {}) });
      setNote(s.note || "");
      setPreset(s.preset || "");
      setAdminOnly(Boolean(s.admin_only));
      setExpiresLocal(toLocalInputValue(s.expires_at));
      setMode(s.group_id ? "group" : "user");
      setGroupId(s.group_id ? String(s.group_id) : "");
      setGroupTitle(s.group_title || "");
      setTargetUserId(s.target_user_id ? String(s.target_user_id) : "");
      setTargetUsername(s.target_username || "");
      if (s.group_id) loadMembers(s.group_id, 1, "", "all");
    } else {
      setRules({ ...DEFAULT_SHARE_RULES });
      setNote("");
      setPreset("");
      setAdminOnly(false);
      setExpiresLocal("");
      setMode("group");
      setGroupId(fixedGroupId ? String(fixedGroupId) : "");
      setGroupTitle(fixedGroupTitle || "");
      setTargetUserId("");
      setTargetUsername("");
      setMemberOverrides({});
      setSelectedMemberId(null);
      if (fixedGroupId) {
        loadMembers(fixedGroupId, 1, "", "all");
      } else {
        loadGroups(1, "");
      }
    }
  }, [open, isEdit, existingShare, fixedGroupId, fixedGroupTitle, loadGroups, loadMembers]);

  // Debounced search
  const onGroupSearch = (val) => {
    setGroupQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadGroups(1, val), 300);
  };
  const onContactSearch = (val) => {
    setContactQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadContacts(1, val), 300);
  };
  const onMemberSearch = (val) => {
    setMemberQuery(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMembers(groupId, 1, val, memberRole), 300);
  };

  const selectGroup = (g) => {
    const id = String(g.id ?? g.pk);
    setGroupId(id);
    setGroupTitle(g.title || g.name || id);
    setMemberPage(1);
    setMemberQuery("");
    setMemberRole("all");
    setMemberOverrides({});
    loadMembers(id, 1, "", "all");
  };

  const selectContact = (c) => {
    const u = c.contact || c.user || c;
    setTargetUserId(String(u.id ?? u.pk ?? c.contact_id ?? ""));
    setTargetUsername(c.nickname || u.username || u.email || String(u.id));
  };

  const applyPreset = (name) => {
    setPreset(name);
    setRules(applyLocalPreset(name));
  };

  const handleSave = async () => {
    if (viewOnly) {
      onClose?.();
      return;
    }
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
        // Optional: save member overrides if group
        if (groupId && Object.keys(memberOverrides).length) {
          await apiRequest({
            method: "PUT",
            url: `${API_BASE}/services/services/shares/${existingShare.id}/members/`,
            data: {
              members: Object.values(memberOverrides).map((m) => ({
                user_id: m.user_id,
                rules: m.rules,
                is_enabled: m.is_enabled !== false,
              })),
            },
          });
        }
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
          body.members = Object.values(memberOverrides).map((m) => ({
            user_id: m.user_id,
            rules: m.rules,
            is_enabled: m.is_enabled !== false,
          }));
        } else {
          if (!targetUserId.trim()) {
            setError("Select a contact");
            setSaving(false);
            return;
          }
          body.target_user_id = targetUserId.trim();
        }
        await apiRequest({ method: "POST", url: SHARE_CREATE_URL, data: body });
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
  const groupPages = Math.max(1, Math.ceil(groupTotal / PAGE_SIZE) || 1);
  const contactPages = Math.max(1, Math.ceil(contactTotal / PAGE_SIZE) || 1);
  const memberPages = Math.max(1, Math.ceil(memberTotal / PAGE_SIZE) || 1);

  const editMemberRules = (m) => {
    const uid = String(m.user_id);
    setSelectedMemberId(uid);
    setMemberOverrides((prev) => ({
      ...prev,
      [uid]: prev[uid] || {
        user_id: m.user_id,
        username: m.username,
        role: m.role,
        rules: { ...rules },
        is_enabled: true,
      },
    }));
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose?.()} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? "Edit share" : "Share service"}
        <Typography variant="body2" color="text.secondary" fontWeight={500}>
          {serviceName}
          {groupTitle ? ` · ${groupTitle}` : targetUsername ? ` · @${targetUsername}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {viewOnly && (
            <Alert severity="info">
              You can only view your effective permissions. Only the sharer can change rules.
            </Alert>
          )}
          {!isEdit && !fixedGroupId && (
            <>
              <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => {
                if (!v) return;
                setMode(v);
                if (v === "group") loadGroups(1, groupQuery);
                else loadContacts(1, contactQuery);
              }} fullWidth>
                <ToggleButton value="group">Groups</ToggleButton>
                <ToggleButton value="user">Contacts</ToggleButton>
              </ToggleButtonGroup>

              {mode === "group" && (
                <Box>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search groups…"
                    value={groupQuery}
                    onChange={(e) => onGroupSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 1 }}
                  />
                  {loadingGroups ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : groups.length === 0 ? (
                    <Alert severity="info">No groups found. Join a group in Messenger first.</Alert>
                  ) : (
                    <List dense sx={{ maxHeight: 220, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      {groups.map((g) => {
                        const id = String(g.id ?? g.pk);
                        return (
                          <ListItemButton key={id} selected={groupId === id} onClick={() => selectGroup(g)}>
                            <ListItemAvatar>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                <GroupIcon fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={g.title || g.name || id}
                              secondary={`${g.participants_count || g.member_count || ""} members`.trim()}
                            />
                          </ListItemButton>
                        );
                      })}
                    </List>
                  )}
                  {groupPages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                      <Pagination
                        size="small"
                        page={groupPage}
                        count={groupPages}
                        onChange={(_, p) => loadGroups(p, groupQuery)}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {mode === "user" && (
                <Box>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Search contacts…"
                    value={contactQuery}
                    onChange={(e) => onContactSearch(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ mb: 1 }}
                  />
                  {loadingContacts ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : contacts.length === 0 ? (
                    <Alert severity="info">No contacts. Add contacts in Messenger.</Alert>
                  ) : (
                    <List dense sx={{ maxHeight: 220, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      {contacts.map((c) => {
                        const u = c.contact || c.user || c;
                        const uid = String(u.id ?? u.pk ?? c.contact_id);
                        return (
                          <ListItemButton key={uid} selected={targetUserId === uid} onClick={() => selectContact(c)}>
                            <ListItemAvatar>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                <PersonIcon fontSize="small" />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={c.nickname || u.username || uid}
                              secondary={u.username && c.nickname ? `@${u.username}` : undefined}
                            />
                          </ListItemButton>
                        );
                      })}
                    </List>
                  )}
                  {contactPages > 1 && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                      <Pagination
                        size="small"
                        page={contactPage}
                        count={contactPages}
                        onChange={(_, p) => loadContacts(p, contactQuery)}
                      />
                    </Box>
                  )}
                  {targetUserId && (
                    <Chip
                      sx={{ mt: 1 }}
                      color="primary"
                      label={`Selected: ${targetUsername || targetUserId}`}
                      onDelete={() => {
                        setTargetUserId("");
                        setTargetUsername("");
                      }}
                    />
                  )}
                </Box>
              )}
            </>
          )}

          {/* Group members when a group is selected */}
          {(groupId || fixedGroupId) && mode === "group" && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Group members
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                <TextField
                  size="small"
                  placeholder="Search members…"
                  value={memberQuery}
                  onChange={(e) => onMemberSearch(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={memberRole}
                  onChange={(_, v) => {
                    if (!v) return;
                    setMemberRole(v);
                    loadMembers(groupId || fixedGroupId, 1, memberQuery, v);
                  }}
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="owner">Owner</ToggleButton>
                  <ToggleButton value="admin">Admin</ToggleButton>
                  <ToggleButton value="member">Member</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              {loadingMembers ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : members.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No members on this page.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 200, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  {members.map((m) => {
                    const uid = String(m.user_id);
                    const ov = memberOverrides[uid];
                    return (
                      <ListItemButton key={uid} selected={selectedMemberId === uid} onClick={() => editMemberRules(m)}>
                        <ListItemAvatar>
                          <Avatar sx={{ width: 28, height: 28 }}>
                            <PersonIcon fontSize="small" />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <span>{m.username || m.user_id}</span>
                              <Chip
                                size="small"
                                label={m.role || "member"}
                                color={ROLE_COLOR[m.role] || "default"}
                                sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                              />
                              {ov && (
                                <Chip size="small" label="custom rules" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                              )}
                            </Stack>
                          }
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
              {memberPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
                  <Pagination
                    size="small"
                    page={memberPage}
                    count={memberPages}
                    onChange={(_, p) => loadMembers(groupId || fixedGroupId, p, memberQuery, memberRole)}
                  />
                </Box>
              )}
              {selectedMemberId && memberOverrides[selectedMemberId] && (
                <Box sx={{ mt: 1.5, p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
                      Rules for @{memberOverrides[selectedMemberId].username}
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={memberOverrides[selectedMemberId].is_enabled !== false}
                          onChange={(e) =>
                            setMemberOverrides((prev) => ({
                              ...prev,
                              [selectedMemberId]: {
                                ...prev[selectedMemberId],
                                is_enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                      }
                      label="Enabled"
                    />
                  </Stack>
                  <RulesGrid
                    rules={memberOverrides[selectedMemberId].rules}
                    onChange={(r) =>
                      setMemberOverrides((prev) => ({
                        ...prev,
                        [selectedMemberId]: { ...prev[selectedMemberId], rules: r },
                      }))
                    }
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Existing shares for this service */}
          {!isEdit && (
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                Already shared with
              </Typography>
              {loadingExisting ? (
                <CircularProgress size={20} />
              ) : existingShares.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Not shared anywhere yet.
                </Typography>
              ) : (
                <List dense sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                  {existingShares.map((s) => (
                    <ListItemButton key={s.id} sx={{ cursor: "default" }}>
                      <ListItemText
                        primary={
                          s.group_title
                            ? `Group: ${s.group_title}`
                            : s.target_username
                            ? `User: @${s.target_username}`
                            : s.group_id
                            ? `Group #${s.group_id}`
                            : `Share ${s.id}`
                        }
                        secondary={s.preset || s.note || undefined}
                      />
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => unshareExisting(s.id)}
                      >
                        Unshare
                      </Button>
                    </ListItemButton>
                  ))}
                </List>
              )}
            </Box>
          )}

          <Divider />

          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Default rules {mode === "group" ? "(for members without custom rules)" : ""}
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mb: 1 }}>
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
            </Stack>
            <FormControlLabel
              control={<Switch checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} size="small" />}
              label="Admins only (base gate)"
            />
            <TextField
              size="small"
              fullWidth
              type="datetime-local"
              label="Expires at (optional)"
              value={expiresLocal}
              onChange={(e) => setExpiresLocal(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 1, mb: 1 }}
            />
            <TextField size="small" fullWidth label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ mb: 1 }} />
            <RulesGrid
              rules={rules}
              onChange={(r) => {
                setPreset("");
                setRules(r);
              }}
            />
          </Box>

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
          disabled={saving || viewOnly}
          startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <ShareIcon />}
        >
          {viewOnly ? "Close" : isEdit ? "Save" : "Share"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
