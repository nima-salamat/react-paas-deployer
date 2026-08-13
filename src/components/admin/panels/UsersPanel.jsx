import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Avatar, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, FormControl, FormControlLabel,
  Grid, IconButton, InputLabel, MenuItem, Pagination, Paper, Select, Stack,
  Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  Tooltip, Typography, useMediaQuery, useTheme, Checkbox,
  Collapse,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import apiRequest from "../../customHooks/apiRequest";
import {
  adminUsersApi, adminPermissionsUrl, getGroupedPermissions, hasAnyRule,
  canGrantRule, isSessionSuperuser, authMediaSrc,
} from "../adminUtils";
import { useToast } from "../components/ToastContext";
import ProfileImageManager from "../components/ProfileImageManager";
import AdminProfileView from "../components/AdminProfileView";
import MediaLightbox from "../components/MediaLightbox";
import { useNavigate } from "react-router-dom";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";

const PAGE_SIZE = 20;

export default function UsersPanel({ setToast: setToastProp }) {
  const pushToast = useToast();
  const setToast = setToastProp || pushToast;
  const [users, setUsers] = useState([]);
  const [userCount, setUserCount] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userStaffOnly, setUserStaffOnly] = useState("");
  const [userActive, setUserActive] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [, setPermCatalog] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", is_staff: false });
  const [deleting, setDeleting] = useState(null);

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("sm"));

  const canManage = hasAnyRule("users.manage");
  const canCreate = canManage || hasAnyRule("users.create");
  const canManageRules = hasAnyRule("users.manage_rules");
  // Rules section visible if user can manage rules OR full manage
  const canEditRules = canManage || canManageRules;
  const canDelete = canManage;
  const isSuperuser = isSessionSuperuser();
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const params = { page: userPage, page_size: PAGE_SIZE };
      if (userSearch) params.search = userSearch;
      if (userStaffOnly !== "") params.is_staff = userStaffOnly;
      if (userActive !== "") params.is_active = userActive;
      const res = await apiRequest({ method: "GET", url: adminUsersApi(), params });
      const data = res.data;
      setUsers(data.results || data.data?.results || []);
      setUserCount(typeof data.count === "number" ? data.count : (data.results || []).length);
    } catch (e) {
      setUsers([]);
      setToast?.(e?.response?.data?.message || e?.response?.data?.detail || "Cannot load users");
    } finally {
      setUserLoading(false);
    }
  }, [userPage, userSearch, userStaffOnly, userActive, setToast]);

  const loadPerms = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: adminPermissionsUrl() });
      const d = res.data?.data || res.data || {};
      setPermCatalog(d?.permissions || []);
    } catch {
      setPermCatalog([]); // fallback to defaults baked into adminUtils
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { loadPerms(); }, [loadPerms]);

  const pages = Math.max(1, Math.ceil((userCount || 0) / PAGE_SIZE));

  const saveUser = async () => {
    if (!editUser) return;
    try {
      const payload = {
        email: editUser.email,
        is_active: editUser.is_active,
      };
      // only include fields the user is allowed to change
      if (canManage) {
        payload.is_staff = editUser.is_staff;
        if (isSuperuser && editUser.is_superuser !== undefined) {
          payload.is_superuser = editUser.is_superuser;
        }
        if (editUser.rules) payload.rules = editUser.rules;
      } else if (canManageRules && editUser.rules) {
        // manage_rules-only path: only rules are sent (backend enforces this too)
        payload.rules = editUser.rules;
        // Strip other fields so the backend's manage_rules branch accepts it
        delete payload.email;
        delete payload.is_active;
      }
      if (editUser.password) payload.password = editUser.password;

      await apiRequest({
        method: "PATCH",
        url: `${adminUsersApi()}/${editUser.id}/`,
        data: payload,
      });
      setToast("User updated");
      setEditUser(null);
      loadUsers();
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.response?.data?.message;
      const forbidden = e?.response?.data?.forbidden;
      setToast?.(detail || (forbidden ? `Cannot grant: ${forbidden.join(", ")}` : "Update failed"));
    }
  };

  const createUser = async () => {
    try {
      const payload = {
        username: newUser.username,
        email: newUser.email || undefined,
        password: newUser.password || undefined,
      };
      if (canManage) {
        payload.is_staff = newUser.is_staff;
      }
      await apiRequest({ method: "POST", url: adminUsersApi(), data: payload });
      setToast("User created");
      setCreateOpen(false);
      setNewUser({ username: "", email: "", password: "", is_staff: false });
      loadUsers();
    } catch (e) {
      setToast(e?.response?.data?.message || e?.response?.data?.detail || "Create failed");
    }
  };

  const deactivateUser = async (id) => {
    if (!window.confirm("Deactivate this user? They will no longer be able to log in.")) return;
    setDeleting(id);
    try {
      await apiRequest({ method: "DELETE", url: `${adminUsersApi()}/${id}/` });
      setToast("User deactivated");
      loadUsers();
    } catch (e) {
      setToast(e?.response?.data?.message || e?.response?.data?.detail || "Failed");
    } finally {
      setDeleting(null);
    }
  };

  const toggleRule = (code, on) => {
    setEditUser((s) => {
      if (!s) return s;
      const set = new Set(s.rules || []);
      if (on) set.add(code); else set.delete(code);
      return { ...s, rules: Array.from(set) };
    });
  };

  const goToUserChat = (username) => {
    // Open messenger in a new window/tab
    const url = `/messenger#u/${encodeURIComponent(username)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ─── helpers for profile avatar in the table ───────────────────────────
  const profileThumb = (u) => {
    const ps = u?.profiles || [];
    if (ps.length === 0) {
      if (u?.avatar) return authMediaSrc(u.avatar);
      if (u?.image) return authMediaSrc(u.image);
      return null;
    }
    // prefer lowest order
    const sorted = [...ps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const img = sorted.find((p) => p.image)?.image || sorted[0]?.image;
    if (!img) return null;
    return authMediaSrc(img);
  };

  const [viewUser, setViewUser] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { items, index }

  const grouped = useMemo(() => getGroupedPermissions(), []);

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Users &amp; access</Typography>
          <Typography variant="body2" color="text.secondary">
            {canManage
              ? "Manage accounts, staff flags, and permission rules"
              : canCreate
              ? "Create and edit basic user accounts (rules and staff flag are read-only)"
              : "Browse user accounts"}
          </Typography>
        </Box>
        {canCreate && (
          <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setCreateOpen(true)}>
            New user
          </Button>
        )}
      </Stack>

      {/* Filter card */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 1.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
          <TextField
            size="small"
            placeholder="Search username / email"
            value={userSearch}
            onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: "text.secondary" }} />,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select value={userStaffOnly} onChange={(e) => { setUserStaffOnly(e.target.value); setUserPage(1); }}>
              <MenuItem value="">All types</MenuItem>
              <MenuItem value="1">Staff</MenuItem>
              <MenuItem value="0">Users</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <Select value={userActive} onChange={(e) => { setUserActive(e.target.value); setUserPage(1); }}>
              <MenuItem value="">Any status</MenuItem>
              <MenuItem value="1">Active</MenuItem>
              <MenuItem value="0">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: "hidden" }}>
        {userLoading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: "action.hover" }}>
                  <TableCell>User</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Flags</TableCell>
                  <TableCell>Rules</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" gap={1.25}>
                        <Avatar
                          src={profileThumb(u) || undefined}
                          onClick={() => setViewUser(u)}
                          sx={{
                            width: 32, height: 32, bgcolor: "primary.main", fontSize: 13, fontWeight: 700,
                            cursor: "pointer",
                            "&:hover": { outline: "2px solid", outlineColor: "primary.main" },
                          }}
                        >
                          {(u.username || "?").charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={600} fontSize={14}>{u.username}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Joined {u.date_joined ? new Date(u.date_joined).toLocaleDateString() : "—"}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>{u.email || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap>
                        {u.is_superuser && (
                          <Tooltip title="Superuser — bypasses all permission checks">
                            <Chip size="small" color="error" icon={<ShieldIcon sx={{ fontSize: 13 }} />} label="super" sx={{ height: 22, fontSize: 11 }} />
                          </Tooltip>
                        )}
                        {u.is_staff && (
                          <Tooltip title="Staff">
                            <Chip size="small" color="primary" icon={<VerifiedUserIcon sx={{ fontSize: 13 }} />} label="staff" sx={{ height: 22, fontSize: 11 }} />
                          </Tooltip>
                        )}
                        {!u.is_active && (
                          <Chip size="small" color="default" icon={<LockIcon sx={{ fontSize: 13 }} />} label="inactive" sx={{ height: 22, fontSize: 11 }} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {(u.rules || []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary">—</Typography>
                      ) : (
                        <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap>
                          {(u.rules || []).slice(0, 4).map((r) => (
                            <Chip key={r} size="small" variant="outlined" label={r.split(".").pop()} sx={{ height: 22, fontSize: 11 }} />
                          ))}
                          {(u.rules || []).length > 4 && (
                            <Chip size="small" label={`+${u.rules.length - 4}`} sx={{ height: 22, fontSize: 11 }} />
                          )}
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" gap={0.5}>
                        <Tooltip title={`Open chat with ${u.username}`}>
                          <IconButton size="small" onClick={() => goToUserChat(u.username)}>
                            <ChatBubbleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canCreate && (
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => setEditUser({ ...u, rules: u.rules || [], password: "" })}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {canDelete && u.id !== (editUser?.id || -1) && (
                          <Tooltip title="Deactivate">
                            <IconButton size="small" color="error" disabled={deleting === u.id} onClick={() => deactivateUser(u.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!users.length && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary" align="center" py={4}>No users found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Box>
        )}
        {pages > 1 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination
              page={userPage}
              count={pages}
              onChange={(_, v) => setUserPage(v)}
              showFirstButton
              showLastButton
              color="primary"
              siblingCount={1}
              boundaryCount={1}
            />
          </Box>
        )}
      </Paper>

      {/* Edit user dialog */}
      <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} maxWidth="md" fullWidth fullScreen={!isDesktop}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography component="div" variant="h6" fontWeight={800}>Edit user</Typography>
              <Typography variant="caption" color="text.secondary">@{editUser?.username}</Typography>
            </Box>
            {editUser?.is_superuser && <Chip size="small" color="error" icon={<ShieldIcon />} label="superuser" />}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {editUser && (
            <Stack gap={2.5}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Email"
                    size="small"
                    value={editUser.email || ""}
                    onChange={(e) => setEditUser((s) => ({ ...s, email: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="New password (leave blank to keep)"
                    size="small"
                    type="password"
                    value={editUser.password || ""}
                    onChange={(e) => setEditUser((s) => ({ ...s, password: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormControlLabel
                    control={<Switch checked={!!editUser.is_active} onChange={(e) => setEditUser((s) => ({ ...s, is_active: e.target.checked }))} />}
                    label={<Stack><Typography variant="body2">Active</Typography><Typography variant="caption" color="text.secondary">Can log in</Typography></Stack>}
                  />
                </Grid>
                {canManage && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControlLabel
                      control={<Switch checked={!!editUser.is_staff} onChange={(e) => setEditUser((s) => ({ ...s, is_staff: e.target.checked }))} />}
                      label={<Stack><Typography variant="body2">Staff</Typography><Typography variant="caption" color="text.secondary">Access admin</Typography></Stack>}
                    />
                  </Grid>
                )}
                {isSuperuser && (
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormControlLabel
                      control={<Switch checked={!!editUser.is_superuser} onChange={(e) => setEditUser((s) => ({ ...s, is_superuser: e.target.checked }))} />}
                      label={<Stack><Typography variant="body2">Superuser</Typography><Typography variant="caption" color="text.secondary">Bypass all checks</Typography></Stack>}
                    />
                  </Grid>
                )}
              </Grid>

              {canEditRules ? (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Access rules</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Rules you cannot grant (because you don't have them yourself) are disabled.
                    Superuser bypasses this restriction.
                    {!canManage && canManageRules && (
                      <> You have <code>users.manage_rules</code> only — you can edit rules but not other fields.</>
                    )}
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, maxHeight: 320, overflow: "auto" }}>
                    <Stack gap={1.5}>
                      {grouped.map((group) => (
                        <Box key={group.group}>
                          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
                            {group.group}
                          </Typography>
                          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.5, mt: 0.5 }}>
                            {group.codes.map((code) => {
                              const allowed = canGrantRule(code);
                              const checked = (editUser.rules || []).includes(code);
                              return (
                                <FormControlLabel
                                  key={code}
                                  sx={{ m: 0, alignItems: "center", mr: 1 }}
                                  control={
                                    <Checkbox
                                      size="small"
                                      checked={checked}
                                      disabled={!allowed}
                                      onChange={(e) => toggleRule(code, e.target.checked)}
                                    />
                                  }
                                  label={
                                    <Stack direction="row" alignItems="center" gap={0.5}>
                                      <Typography variant="caption" fontFamily="monospace">{code}</Typography>
                                      {!allowed && <LockIcon sx={{ fontSize: 11, color: "text.disabled" }} />}
                                    </Stack>
                                  }
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Box>
              ) : (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover" }}>
                  <Stack direction="row" gap={1.5} alignItems="flex-start">
                    <LockIcon color="action" sx={{ mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        You have <code>users.create</code> but not <code>users.manage</code>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        You can edit email, password, and active flag. The staff flag, superuser flag,
                        and permission rules are read-only for your role. Ask a superuser or someone
                        with <code>users.manage</code> to grant elevated permissions.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              )}

              {/* Profile image manager — visible to users.create and above */}
              {(canCreate || canManage) && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>Profile photos</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                    Add, remove, or drag to reorder the user's profile photos. Max 5 images.
                  </Typography>
                  <ProfileImageManager
                    userId={editUser.id}
                    disabled={!canCreate && !canManage}
                    onToast={setToast}
                    initial={editUser.profiles || []}
                    onChange={() => {
                      loadUsers();
                      // Notify admin shell to refresh "me" if editing self
                      try {
                        window.dispatchEvent(new CustomEvent("admin-profile-changed", {
                          detail: { userId: editUser.id },
                        }));
                      } catch { /* */ }
                    }}
                  />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveUser}>Save changes</Button>
        </DialogActions>
      </Dialog>

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth fullScreen={!isDesktop}>
        <DialogTitle>Create user</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField
              size="small"
              label="Username"
              value={newUser.username}
              onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              size="small"
              label="Email"
              value={newUser.email}
              onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))}
              fullWidth
            />
            <TextField
              size="small"
              type="password"
              label="Password"
              value={newUser.password}
              onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
              fullWidth
            />
            {canManage && (
              <FormControlLabel
                control={<Switch checked={!!newUser.is_staff} onChange={(e) => setNewUser((s) => ({ ...s, is_staff: e.target.checked }))} />}
                label="Staff"
              />
            )}
            {!canManage && (
              <Typography variant="caption" color="text.secondary">
                The new account will be a regular user (no staff flag).
                To create a staff account you need <code>users.manage</code>.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createUser} disabled={!newUser.username.trim()}>Create</Button>
        </DialogActions>
      </Dialog>

      <AdminProfileView
        open={Boolean(viewUser)}
        onClose={() => setViewUser(null)}
        user={viewUser}
      />

      <MediaLightbox
        open={Boolean(lightbox)}
        onClose={() => setLightbox(null)}
        items={lightbox?.items || []}
        index={lightbox?.index || 0}
        onIndexChange={(i) => setLightbox((prev) => (prev ? { ...prev, index: i } : null))}
      />
    </Stack>
  );
}
