import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar, Box, Button, Chip, CircularProgress, Divider, Drawer, FormControl,
  Grid, IconButton, InputLabel, List, ListItemButton, ListItemIcon, ListItemText,
  MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Toolbar, Typography, Pagination, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Switch, FormControlLabel,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import BusinessIcon from "@mui/icons-material/Business";
import GroupIcon from "@mui/icons-material/Group";
import CloseIcon from "@mui/icons-material/Close";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData } from "../tickets/api";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};
const PRIORITY_COLOR = { low: "default", normal: "info", high: "warning", urgent: "error" };

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { id: "tickets", label: "Tickets", icon: <ConfirmationNumberIcon /> },
  { id: "departments", label: "Departments", icon: <BusinessIcon />, adminOnly: true },
  { id: "staff", label: "Staff", icon: <GroupIcon />, adminOnly: true },
];

function StatCard({ label, value, color }) {
  return (
    <Paper sx={{ p: 2, height: "100%" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={700} color={color || "text.primary"}>{value ?? "—"}</Typography>
    </Paper>
  );
}

export default function StaffConsole() {
  const [section, setSection] = useState("dashboard");
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");

  // tickets
  const [tickets, setTickets] = useState([]);
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [departments, setDepartments] = useState([]);

  // detail drawer
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [deptStaff, setDeptStaff] = useState([]);
  const [files, setFiles] = useState([]);

  // admin departments
  const [adminDeps, setAdminDeps] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [depError, setDepError] = useState("");
  const [depDialog, setDepDialog] = useState(null); // null | {mode, data}
  const [depForm, setDepForm] = useState({ name: "", description: "", is_active: true, order: 0 });
  const [memberDialog, setMemberDialog] = useState(null); // department object
  const [memberUserId, setMemberUserId] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);

  // detect admin from /admin/staff (403 = not admin)
  useEffect(() => {
    (async () => {
      try {
        await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/staff/` });
        setIsAdmin(true);
      } catch {
        setIsAdmin(false);
      }
    })();
  }, []);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/stats/` });
      setStats(unwrapData(res));
    } catch (e) {
      setStatsError(e?.response?.data?.message || "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/departments/` });
      const data = unwrapData(res);
      setDepartments(Array.isArray(data) ? data : []);
      setAdminDeps(Array.isArray(data) ? data : []);
    } catch {
      try {
        const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/departments/`, params: { all: "1" } });
        const data = unwrapData(res);
        setDepartments(Array.isArray(data) ? data : []);
      } catch { /* ignore */ }
    }
  }, []);

  const loadTickets = useCallback(async () => {
    setTLoading(true);
    setTError("");
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (department) params.department = department;
      if (assignedFilter) params.assigned_to = assignedFilter;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/`, params });
      const data = res.data;
      const results = data.results || data.data || [];
      setTickets(Array.isArray(results) ? results : []);
      setCount(data.count || results.length || 0);
    } catch (e) {
      setTError(e?.response?.data?.message || "Failed to load tickets");
      setTickets([]);
    } finally {
      setTLoading(false);
    }
  }, [page, search, status, priority, department, assignedFilter]);

  useEffect(() => { loadStats(); loadDepartments(); }, [loadStats, loadDepartments]);
  useEffect(() => {
    if (section === "tickets" || section === "dashboard") {
      const t = setTimeout(loadTickets, search ? 300 : 0);
      return () => clearTimeout(t);
    }
  }, [section, loadTickets]);

  useEffect(() => {
    if (section === "departments") loadDepartments();
    if (section === "staff" && isAdmin) {
      setStaffLoading(true);
      apiRequest({ method: "GET", url: `${TICKETS_API}/admin/staff/` })
        .then((res) => setStaffList(unwrapData(res) || []))
        .catch(() => setStaffList([]))
        .finally(() => setStaffLoading(false));
    }
  }, [section, isAdmin, loadDepartments]);

  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setActionError("");
    setReply("");
    setFiles([]);
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      const d = unwrapData(res);
      setDetail(d);
      if (d?.department?.id) {
        try {
          const sr = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/departments/${d.department.id}/staff/` });
          setDeptStaff(unwrapData(sr) || []);
        } catch { setDeptStaff([]); }
      }
    } catch (e) {
      setActionError(e?.response?.data?.message || "Failed to load");
    } finally {
      setDetailLoading(false);
    }
  };

  const changeStatus = async (v) => {
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/status/`, data: { status: v } });
      await openDetail(selectedId); loadTickets(); loadStats();
    } catch (e) { setActionError(e?.response?.data?.message || "Status failed"); }
  };
  const changePriority = async (v) => {
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/priority/`, data: { priority: v } });
      await openDetail(selectedId); loadTickets();
    } catch (e) { setActionError(e?.response?.data?.message || "Priority failed"); }
  };
  const changeDepartment = async (v) => {
    try {
      await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/department/`, data: { department_id: v } });
      await openDetail(selectedId); loadTickets();
    } catch (e) { setActionError(e?.response?.data?.message || "Department change failed"); }
  };
  const assignTo = async (userId) => {
    try {
      await apiRequest({
        method: "POST",
        url: `${TICKETS_API}/staff/${selectedId}/assign/`,
        data: { assigned_to_id: userId === "" ? null : userId },
      });
      await openDetail(selectedId); loadTickets();
    } catch (e) { setActionError(e?.response?.data?.message || "Assign failed"); }
  };
  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("body", reply.trim().includes("<") ? reply : `<p>${reply.replace(/\n/g, "<br>")}</p>`);
      files.forEach((f) => form.append("attachments", f));
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${selectedId}/messages/`, data: form });
      setReply(""); setFiles([]);
      await openDetail(selectedId); loadTickets();
    } catch (e) { setActionError(e?.response?.data?.message || "Reply failed"); }
    finally { setSending(false); }
  };

  const saveDepartment = async () => {
    try {
      if (depDialog?.mode === "edit") {
        await apiRequest({ method: "PUT", url: `${TICKETS_API}/admin/departments/${depDialog.data.id}/`, data: depForm });
      } else {
        await apiRequest({ method: "POST", url: `${TICKETS_API}/admin/departments/`, data: depForm });
      }
      setDepDialog(null);
      loadDepartments();
    } catch (e) {
      setDepError(e?.response?.data?.message || "Save failed");
    }
  };

  const addMember = async () => {
    if (!memberDialog || !memberUserId) return;
    try {
      await apiRequest({
        method: "POST",
        url: `${TICKETS_API}/admin/departments/${memberDialog.id}/members/`,
        data: { user_id: memberUserId, is_manager: false },
      });
      setMemberUserId("");
      loadDepartments();
      // refresh membership view
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/departments/${memberDialog.id}/` });
      setMemberDialog({ ...memberDialog, memberships: unwrapData(res)?.memberships || [] });
    } catch (e) {
      setDepError(e?.response?.data?.message || "Add member failed");
    }
  };

  const removeMember = async (userId) => {
    if (!memberDialog) return;
    try {
      await apiRequest({
        method: "DELETE",
        url: `${TICKETS_API}/admin/departments/${memberDialog.id}/members/`,
        data: { user_id: userId },
      });
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/departments/${memberDialog.id}/` });
      setMemberDialog({ ...memberDialog, memberships: unwrapData(res)?.memberships || [] });
      loadDepartments();
    } catch (e) {
      setDepError(e?.response?.data?.message || "Remove failed");
    }
  };

  const openMemberDialog = async (dep) => {
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/departments/${dep.id}/` });
      const data = unwrapData(res);
      setMemberDialog({ ...dep, memberships: data?.memberships || [] });
      const sr = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/staff/` });
      setStaffList(unwrapData(sr) || []);
    } catch (e) {
      setDepError(e?.response?.data?.message || "Failed to load members");
    }
  };

  const navItems = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <Box sx={{ display: "flex", minHeight: "70vh" }}>
      <Paper sx={{ width: 220, flexShrink: 0, borderRadius: 0, display: { xs: "none", md: "block" } }} elevation={0} variant="outlined">
        <Typography sx={{ p: 2, fontWeight: 700 }}>Staff Console</Typography>
        <List dense>
          {navItems.map((n) => (
            <ListItemButton key={n.id} selected={section === n.id} onClick={() => setSection(n.id)}>
              <ListItemIcon>{n.icon}</ListItemIcon>
              <ListItemText primary={n.label} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>
        {/* Mobile section select */}
        <FormControl size="small" fullWidth sx={{ mb: 2, display: { md: "none" } }}>
          <InputLabel>Section</InputLabel>
          <Select label="Section" value={section} onChange={(e) => setSection(e.target.value)}>
            {navItems.map((n) => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
          </Select>
        </FormControl>

        {section === "dashboard" && (
          <>
            <Typography variant="h5" fontWeight={700} mb={2}>Dashboard</Typography>
            {statsLoading ? <CircularProgress /> : statsError ? (
              <Alert severity="error" action={<Button onClick={loadStats}>Retry</Button>}>{statsError}</Alert>
            ) : stats && (
              <Grid container spacing={2} mb={3}>
                {[
                  ["Total", stats.total], ["Open", stats.open, "info.main"], ["In Progress", stats.in_progress, "warning.main"],
                  ["Waiting User", stats.waiting_user], ["Resolved", stats.resolved, "success.main"], ["Closed", stats.closed],
                  ["Urgent", stats.urgent, "error.main"], ["Unassigned", stats.unassigned],
                ].map(([label, val, color]) => (
                  <Grid key={label} item xs={6} sm={4} md={3}><StatCard label={label} value={val} color={color} /></Grid>
                ))}
              </Grid>
            )}
            {stats?.by_department?.length > 0 && (
              <Paper sx={{ p: 2 }}>
                <Typography fontWeight={600} mb={1}>By Department</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Department</TableCell><TableCell>Total</TableCell><TableCell>Open</TableCell></TableRow></TableHead>
                  <TableBody>
                    {stats.by_department.map((d) => (
                      <TableRow key={d.department_id}><TableCell>{d.name}</TableCell><TableCell>{d.total}</TableCell><TableCell>{d.open}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}

        {section === "tickets" && (
          <>
            <Typography variant="h5" fontWeight={700} mb={2}>Tickets</Typography>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} gap={2} flexWrap="wrap">
                <TextField size="small" label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 180 }} />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    {["open","in_progress","waiting_user","resolved","closed"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 110 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    {["low","normal","high","urgent"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Department</InputLabel>
                  <Select label="Department" value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Assigned</InputLabel>
                  <Select label="Assigned" value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="me">Mine</MenuItem>
                    <MenuItem value="unassigned">Unassigned</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
            {tError && <Alert severity="error" sx={{ mb: 2 }} action={<Button onClick={loadTickets}>Retry</Button>}>{tError}</Alert>}
            {tLoading ? <CircularProgress /> : tickets.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">No tickets.</Typography></Paper>
            ) : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Number</TableCell><TableCell>Subject</TableCell><TableCell>User</TableCell>
                      <TableCell>Service</TableCell><TableCell>Dept</TableCell><TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell><TableCell>Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => openDetail(t.id)}>
                        <TableCell>{t.public_id}</TableCell>
                        <TableCell>{t.subject}</TableCell>
                        <TableCell>{t.user?.username}</TableCell>
                        <TableCell>{t.service?.name || "—"}</TableCell>
                        <TableCell>{t.department?.name}</TableCell>
                        <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                        <TableCell><Chip size="small" label={t.priority} color={PRIORITY_COLOR[t.priority] || "default"} variant="outlined" /></TableCell>
                        <TableCell>{t.last_message_at ? new Date(t.last_message_at).toLocaleString() : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {count > 15 && <Box display="flex" justifyContent="center" p={2}><Pagination page={page} count={Math.ceil(count / 15)} onChange={(_, v) => setPage(v)} /></Box>}
              </Paper>
            )}
          </>
        )}

        {section === "departments" && isAdmin && (
          <>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h5" fontWeight={700}>Departments</Typography>
              <Button variant="contained" onClick={() => { setDepForm({ name: "", description: "", is_active: true, order: 0 }); setDepDialog({ mode: "create" }); }}>New Department</Button>
            </Stack>
            {depError && <Alert severity="error" sx={{ mb: 2 }}>{depError}</Alert>}
            <Grid container spacing={2}>
              {adminDeps.map((d) => (
                <Grid item xs={12} sm={6} md={4} key={d.id}>
                  <Paper sx={{ p: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography fontWeight={700}>{d.name}</Typography>
                      <Chip size="small" label={d.is_active ? "Active" : "Inactive"} color={d.is_active ? "success" : "default"} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" mt={1}>{d.staff_count ?? 0} Staff · {d.open_tickets ?? 0} Open · {d.total_tickets ?? 0} Total</Typography>
                    <Stack direction="row" gap={1} mt={2}>
                      <Button size="small" onClick={() => { setDepForm({ name: d.name, description: d.description || "", is_active: d.is_active, order: d.order || 0 }); setDepDialog({ mode: "edit", data: d }); }}>Edit</Button>
                      <Button size="small" onClick={() => openMemberDialog(d)}>Staff</Button>
                    </Stack>
                  </Paper>
                </Grid>
              ))}
              {adminDeps.length === 0 && <Grid item xs={12}><Alert severity="info">No departments yet.</Alert></Grid>}
            </Grid>
          </>
        )}

        {section === "staff" && isAdmin && (
          <>
            <Typography variant="h5" fontWeight={700} mb={2}>Staff Management</Typography>
            {staffLoading ? <CircularProgress /> : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell><TableCell>Email</TableCell><TableCell>Departments</TableCell>
                      <TableCell>Open Assigned</TableCell><TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {staffList.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.username}{s.is_superuser ? " (Admin)" : ""}</TableCell>
                        <TableCell>{s.email}</TableCell>
                        <TableCell>{(s.departments || []).map((d) => d.name).join(", ") || "—"}</TableCell>
                        <TableCell>{s.assigned_open}</TableCell>
                        <TableCell><Chip size="small" label={s.is_active ? "Active" : "Inactive"} color={s.is_active ? "success" : "default"} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}
      </Box>

      {/* Ticket detail drawer */}
      <Drawer anchor="right" open={Boolean(selectedId)} onClose={() => { setSelectedId(null); setDetail(null); }}
        PaperProps={{ sx: { width: { xs: "100%", sm: 520 } } }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography fontWeight={700}>{detail?.public_id || "Ticket"}</Typography>
          <IconButton onClick={() => { setSelectedId(null); setDetail(null); }}><CloseIcon /></IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ p: 2, overflow: "auto" }}>
          {detailLoading && <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>}
          {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
          {detail && !detailLoading && (
            <>
              <Typography variant="h6">{detail.subject}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                User: {detail.user?.username} ({detail.user?.email || "—"})
              </Typography>
              {(detail.service || detail.deploy) && (
                <Typography variant="body2" color="text.secondary" mb={1}>
                  {detail.service?.name ? `Service: ${detail.service.name}` : ""}
                  {detail.deploy ? ` · Deploy: ${detail.deploy.name || detail.deploy.version || ""}` : ""}
                </Typography>
              )}
              <Stack spacing={1.5} mb={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={detail.status} onChange={(e) => changeStatus(e.target.value)}>
                    {["open","in_progress","waiting_user","resolved","closed"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select label="Priority" value={detail.priority} onChange={(e) => changePriority(e.target.value)}>
                    {["low","normal","high","urgent"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Department</InputLabel>
                  <Select label="Department" value={detail.department?.id || ""} onChange={(e) => changeDepartment(e.target.value)}>
                    {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel>Assigned to</InputLabel>
                  <Select label="Assigned to" value={detail.assigned_to?.id || ""} onChange={(e) => assignTo(e.target.value)}>
                    <MenuItem value="">Unassigned</MenuItem>
                    {deptStaff.map((s) => <MenuItem key={s.id} value={s.id}>{s.username}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography fontWeight={600} mb={1}>Conversation</Typography>
              <Stack spacing={1.5} mb={2} sx={{ maxHeight: 280, overflow: "auto" }}>
                {(detail.messages || []).map((m) => (
                  <Paper key={m.id} variant="outlined" sx={{ p: 1.5, bgcolor: m.is_staff_reply ? "action.hover" : "background.paper" }}>
                    <Stack direction="row" gap={1}>
                      <Avatar sx={{ width: 28, height: 28 }}>{(m.author?.username || "?")[0]?.toUpperCase()}</Avatar>
                      <Box flex={1}>
                        <Typography variant="body2" fontWeight={600}>{m.author?.username}{m.is_staff_reply ? " (Staff)" : ""}</Typography>
                        <Box sx={{ fontSize: 13, "& p": { m: 0 } }} dangerouslySetInnerHTML={{ __html: m.body }} />
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              {detail.status !== "closed" && (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <TextField fullWidth multiline minRows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as staff…" />
                  <Stack direction="row" justifyContent="space-between" mt={1}>
                    <Button component="label" size="small">Attach<input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} /></Button>
                    <Button variant="contained" disabled={sending || !reply.trim()} onClick={sendReply}>{sending ? "Sending…" : "Send reply"}</Button>
                  </Stack>
                </Paper>
              )}
            </>
          )}
        </Box>
      </Drawer>

      {/* Department create/edit dialog */}
      <Dialog open={Boolean(depDialog)} onClose={() => setDepDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>{depDialog?.mode === "edit" ? "Edit Department" : "New Department"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Name" value={depForm.name} onChange={(e) => setDepForm({ ...depForm, name: e.target.value })} fullWidth />
            <TextField label="Description" value={depForm.description} onChange={(e) => setDepForm({ ...depForm, description: e.target.value })} fullWidth multiline minRows={2} />
            <TextField label="Order" type="number" value={depForm.order} onChange={(e) => setDepForm({ ...depForm, order: Number(e.target.value) })} fullWidth />
            <FormControlLabel control={<Switch checked={depForm.is_active} onChange={(e) => setDepForm({ ...depForm, is_active: e.target.checked })} />} label="Active" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepDialog(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveDepartment}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={Boolean(memberDialog)} onClose={() => setMemberDialog(null)} fullWidth maxWidth="sm">
        <DialogTitle>Staff — {memberDialog?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={1} mt={1}>
            {(memberDialog?.memberships || []).map((m) => (
              <Stack key={m.id} direction="row" justifyContent="space-between" alignItems="center">
                <Typography>{m.username} ({m.email}){m.is_manager ? " · manager" : ""}</Typography>
                <Button size="small" color="error" onClick={() => removeMember(m.user_id)}>Remove</Button>
              </Stack>
            ))}
            <Divider />
            <FormControl fullWidth size="small">
              <InputLabel>Add staff</InputLabel>
              <Select label="Add staff" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)}>
                {staffList.map((s) => <MenuItem key={s.id} value={s.id}>{s.username}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={addMember} disabled={!memberUserId}>Add to department</Button>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setMemberDialog(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
