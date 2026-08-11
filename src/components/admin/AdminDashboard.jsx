import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Drawer, FormControl, FormControlLabel, Grid, IconButton,
  InputLabel, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper,
  Select, Snackbar, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Toolbar, Typography, Pagination, Tooltip,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EmailIcon from "@mui/icons-material/Email";
import PeopleIcon from "@mui/icons-material/People";
import LinkIcon from "@mui/icons-material/Link";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, EMAILS_API, unwrapData } from "../tickets/api";
import EmailManagement from "../emails/EmailManagement.jsx";
import MessageBubble from "../tickets/MessageBubble.jsx";
import SimpleHtmlEditor, { htmlToPlain } from "../tickets/SimpleHtmlEditor.jsx";
import PendingFilesBar from "../tickets/PendingFilesBar.jsx";

const STATUS_COLOR = {
  open: "info", in_progress: "warning", waiting_user: "secondary",
  resolved: "success", closed: "default",
};

function hostBase() {
  return `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
}

function wsUrl() {
  const token = localStorage.getItem("access");
  if (!token) return null;
  try {
    const backendUrl = new URL(hostBase());
    const protocol = backendUrl.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${backendUrl.host}/ws/tickets/?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

function StatCard({ label, value, color }) {
  return (
    <Paper sx={{ p: 2, height: "100%" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={700} color={color || "text.primary"}>
        {value ?? "—"}
      </Typography>
    </Paper>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const [tab, setTab] = useState(initialTab === "permissions" ? "users" : initialTab);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [meLoading, setMeLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // tickets
  const [stats, setStats] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const wsRef = useRef(null);
  const selectedIdRef = useRef(null);
  const loadTicketsRef = useRef(() => {});
  const openDetailRef = useRef(async () => {});
  const loadStatsRef = useRef(() => {});
  const reconnectRef = useRef(0);
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const [tLoading, setTLoading] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);

  // users
  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(1);
  const [userCount, setUserCount] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userStaffOnly, setUserStaffOnly] = useState("");
  const [userActive, setUserActive] = useState("");
  const [userLoading, setUserLoading] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deptCatalog, setDeptCatalog] = useState([]); // [{id,name}]
  const [userMemberships, setUserMemberships] = useState([]); // [{department_id, is_manager}]
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [permCatalog, setPermCatalog] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", email: "", password: "", is_staff: false });

  // invites
  const [invites, setInvites] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [newInvite, setNewInvite] = useState({ label: "", max_uses: "1" });

  // auth codes
  const [codes, setCodes] = useState([]);
  const [codeCount, setCodeCount] = useState(0);
  const [codePage, setCodePage] = useState(1);
  const [codeSearch, setCodeSearch] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  const API_USERS = useMemo(() => `${hostBase()}/api/users/user/`, []);
  const ADMIN_USERS = useMemo(() => `${hostBase()}/api/users/admin/users/`, []);
  const AUTH = useMemo(() => `${hostBase()}/auth/api`, []);

  useEffect(() => {
    (async () => {
      try {
        let u = null;
        try {
          const res = await apiRequest({ method: "GET", url: `${AUTH}/validateToken/` });
          u = res.data?.user || res.data;
        } catch { /* */ }
        if (!u || u.is_staff === undefined) {
          const res = await apiRequest({ method: "GET", url: API_USERS });
          u = res.data?.user || res.data;
        }
        const staff = Boolean(u?.is_staff || u?.is_superuser);
        setIsStaff(staff);
        setIsAdmin(Boolean(u?.is_superuser));
        if (!staff) navigate("/tickets");
      } catch {
        navigate("/");
      } finally {
        setMeLoading(false);
      }
    })();
  }, [API_USERS, AUTH, navigate]);

  const loadStats = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/stats/` });
      setStats(unwrapData(res));
    } catch { /* */ }
  }, []);
  loadStatsRef.current = loadStats;

  const loadTickets = useCallback(async (opts = {}) => {
    const silent = Boolean(opts && opts.silent);
    if (!silent) setTLoading(true);
    try {
      const params = { page };
      if (search) params.search = search;
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (assignedFilter) params.assigned_to = assignedFilter;
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/staff/`, params });
      const data = res.data;
      const results = data.results || data.data || [];
      setTickets(Array.isArray(results) ? results : []);
      setCount(typeof data.count === 'number' ? data.count : (Array.isArray(results) ? results.length : 0));
    } catch {
      setTickets([]);
    } finally {
      setTLoading(false);
    }
  }, [page, search, status, priority, assignedFilter]);
  loadTicketsRef.current = loadTickets;

  const loadUsers = useCallback(async () => {
    setUserLoading(true);
    try {
      const params = { page: userPage, page_size: 20 };
      if (userSearch) params.search = userSearch;
      if (userStaffOnly !== "") params.is_staff = userStaffOnly;
      if (userActive !== "") params.is_active = userActive;
      const res = await apiRequest({ method: "GET", url: ADMIN_USERS, params });
      const data = res.data;
      // DRF pagination at top level
      setUsers(data.results || data.data?.results || []);
      setUserCount(typeof data.count === 'number' ? data.count : (Array.isArray(results) ? results.length : 0));
    } catch (e) {
      setUsers([]);
      setToast(e?.response?.data?.message || "Cannot load users (need users.view)");
    } finally {
      setUserLoading(false);
    }
  }, [ADMIN_USERS, userPage, userSearch, userStaffOnly, userActive]);

  const loadPerms = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${hostBase()}/api/users/admin/permissions/` });
      const d = unwrapData(res) || res.data?.data || res.data;
      setPermCatalog(d?.permissions || []);
    } catch {
      setPermCatalog([
        "tickets.view", "tickets.manage", "tickets.delete",
        "users.view", "users.manage", "invites.manage",
        "auth_codes.view", "emails.manage", "departments.manage",
      ]);
    }
  }, []);

  const loadInvites = useCallback(async () => {
    setInvLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${AUTH}/invite/list/` });
      const body = res.data || {};
      // ok() merges: { success, message, invites: [...] }
      const list = body.invites || body.data?.invites || body.results || body.data || [];
      setInvites(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("invite list", e);
      setInvites([]);
      setToast(e?.response?.data?.message || "Failed to load invites");
    } finally {
      setInvLoading(false);
    }
  }, [AUTH]);

  const loadCodes = useCallback(async () => {
    setCodeLoading(true);
    try {
      const params = { page: codePage };
      if (codeSearch) params.search = codeSearch;
      const res = await apiRequest({ method: "GET", url: `${AUTH}/admin/auth-codes/`, params });
      const d = res.data?.data || res.data;
      setCodes(d?.results || []);
      setCodeCount(d?.count || 0);
    } catch {
      setCodes([]);
    } finally {
      setCodeLoading(false);
    }
  }, [AUTH, codePage, codeSearch]);

  useEffect(() => {
    if (meLoading) return;
    loadStats();
  }, [meLoading, loadStats]);

  useEffect(() => {
    if (tab === "tickets" || tab === "overview") {
      const t = setTimeout(loadTickets, search ? 300 : 0);
      return () => clearTimeout(t);
    }
  }, [tab, loadTickets, search]);

  useEffect(() => {
    if (tab === "users") {
      loadUsers();
      loadPerms();
    }
    if (tab === "invites") loadInvites();
    if (tab === "codes") loadCodes();
  }, [tab, loadUsers, loadPerms, loadInvites, loadCodes]);

  // WebSocket
  useEffect(() => {
    if (meLoading) return;
    let closed = false;
    let timer;
    const connect = () => {
      const url = wsUrl();
      if (!url) return;
      const socket = new WebSocket(url);
      wsRef.current = socket;
      socket.onopen = () => {
        reconnectRef.current = 0;
        setLiveConnected(true);
        try { socket.send(JSON.stringify({ type: "ping" })); } catch { /* */ }
      };
      socket.onclose = () => {
        setLiveConnected(false);
        if (closed) return;
        const attempt = Math.min(reconnectRef.current + 1, 8);
        reconnectRef.current = attempt;
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
      };
      socket.onerror = () => { try { socket.close(); } catch { /* */ } };
      socket.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        if (data.type === "connected" || data.type === "pong") return;
        setLiveEvents((prev) => [data, ...prev].slice(0, 30));
        if (data.type === "ticket.created") {
          setToast(`New ticket ${data.public_id}: ${data.subject}`);
          loadStatsRef.current?.();
          loadTicketsRef.current?.({ silent: true });
        } else if (data.type === "ticket.message") {
          setToast(`New reply on ${data.public_id || data.ticket_id}`);
          const sid = selectedIdRef.current;
          if (sid != null && String(sid) === String(data.ticket_id)) {
            openDetailRef.current?.(sid);
          }
          loadTicketsRef.current?.({ silent: true });
        } else if (data.type === "ticket.updated" || data.type === "ticket.seen") {
          loadStatsRef.current?.();
          loadTicketsRef.current?.({ silent: true });
          const sid = selectedIdRef.current;
          if (data.type === "ticket.seen" && sid != null && String(sid) === String(data.ticket_id)) {
            openDetailRef.current?.(sid);
          }
        }
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      try { wsRef.current?.close(); } catch { /* */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meLoading]);

  const openDetail = async (id, opts = {}) => {
    const silent = Boolean(opts.silent);
    setSelectedId(id);
    selectedIdRef.current = id;
    if (!silent) {
      setDetailLoading(true);
      setReply("");
      setFiles([]);
    }
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/${id}/` });
      setDetail(unwrapData(res));
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        try {
          const rr = await apiRequest({ method: "POST", url: `${TICKETS_API}/${id}/read/` });
          const rd = rr.data?.data || rr.data || {};
          const ids = new Set((rd.message_ids || []).map(String));
          if (ids.size) {
            setDetail((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: (prev.messages || []).map((m) =>
                  ids.has(String(m.id))
                    ? { ...m, seen_at: rd.last_read_at || new Date().toISOString(), is_seen: true }
                    : m
                ),
              };
            });
          }
        } catch { /* */ }
      }
    } catch {
      if (!silent) setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };
  openDetailRef.current = (id) => openDetail(id, { silent: true });

  const changeStatus = async (v) => {
    await apiRequest({ method: "POST", url: `${TICKETS_API}/staff/${selectedId}/status/`, data: { status: v } });
    openDetail(selectedId);
    loadTickets();
    loadStats();
  };

  const sendReply = async () => {
    if (!htmlToPlain(reply) && !files.length) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("body", htmlToPlain(reply) ? reply : "<p></p>");
      files.forEach((f) => form.append("attachments", f));
      await apiRequest({ method: "POST", url: `${TICKETS_API}/${selectedId}/messages/`, data: form });
      setReply("");
      setFiles([]);
      await openDetail(selectedId, { silent: true });
      loadTickets({ silent: true });
    } finally {
      setSending(false);
    }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm("Delete this ticket permanently?")) return;
    try {
      await apiRequest({ method: "DELETE", url: `${TICKETS_API}/staff/${id}/delete/` });
      setToast("Ticket deleted");
      setSelectedId(null);
      setDetail(null);
      loadTickets();
      loadStats();
    } catch (e) {
      setToast(e?.response?.data?.message || "Delete failed");
    }
  };

  const loadUserMemberships = async (userId) => {
    setMembershipLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/admin/users/${userId}/memberships/` });
      const data = res.data?.data || res.data || {};
      setDeptCatalog(Array.isArray(data.departments) ? data.departments : []);
      setUserMemberships(
        (data.memberships || []).map((m) => ({
          department_id: m.department_id,
          is_manager: Boolean(m.is_manager),
        }))
      );
    } catch {
      setDeptCatalog([]);
      setUserMemberships([]);
    } finally {
      setMembershipLoading(false);
    }
  };

  const toggleDeptMembership = (deptId, checked) => {
    setUserMemberships((prev) => {
      if (checked) {
        if (prev.some((m) => String(m.department_id) === String(deptId))) return prev;
        return [...prev, { department_id: deptId, is_manager: false }];
      }
      return prev.filter((m) => String(m.department_id) !== String(deptId));
    });
  };

  const toggleDeptManager = (deptId, isManager) => {
    setUserMemberships((prev) =>
      prev.map((m) =>
        String(m.department_id) === String(deptId) ? { ...m, is_manager: isManager } : m
      )
    );
  };

  const saveUser = async () => {
    if (!editUser) return;
    try {
      await apiRequest({
        method: "PATCH",
        url: `${ADMIN_USERS}${editUser.id}/`,
        data: {
          is_staff: editUser.is_staff,
          is_active: editUser.is_active,
          is_superuser: editUser.is_superuser,
          email: editUser.email,
          rules: editUser.rules || [],
        },
      });
      try {
        await apiRequest({
          method: "PUT",
          url: `${TICKETS_API}/admin/users/${editUser.id}/memberships/`,
          data: { memberships: userMemberships },
        });
      } catch (me) {
        console.warn("memberships", me);
      }
      setToast("User updated");
      setEditUser(null);
      loadUsers();
    } catch (e) {
      setToast(e?.response?.data?.message || "Update failed");
    }
  };

  const createUser = async () => {
    try {
      await apiRequest({ method: "POST", url: ADMIN_USERS, data: newUser });
      setToast("User created");
      setCreateOpen(false);
      setNewUser({ username: "", email: "", password: "", is_staff: false });
      loadUsers();
    } catch (e) {
      setToast(e?.response?.data?.message || "Create failed");
    }
  };

  const deactivateUser = async (id) => {
    if (!window.confirm("Deactivate this user?")) return;
    try {
      await apiRequest({ method: "DELETE", url: `${ADMIN_USERS}${id}/` });
      setToast("User deactivated");
      loadUsers();
    } catch (e) {
      setToast(e?.response?.data?.message || "Failed");
    }
  };

  const createInvite = async () => {
    try {
      const body = {
        label: newInvite.label,
        max_uses: newInvite.max_uses === "" ? null : Number(newInvite.max_uses),
      };
      await apiRequest({ method: "POST", url: `${AUTH}/invite/create/`, data: body });
      setToast("Invite created");
      setNewInvite({ label: "", max_uses: "1" });
      loadInvites();
    } catch (e) {
      setToast(e?.response?.data?.message || "Failed");
    }
  };

  const deactivateInvite = async (token) => {
    try {
      await apiRequest({ method: "POST", url: `${AUTH}/invite/deactivate/`, data: { token } });
      setToast("Invite deactivated");
      loadInvites();
    } catch (e) {
      setToast(e?.response?.data?.message || "Failed");
    }
  };

  const deleteCode = async (id) => {
    try {
      await apiRequest({ method: "DELETE", url: `${AUTH}/admin/auth-codes/${id}/` });
      loadCodes();
    } catch (e) {
      setToast(e?.response?.data?.message || "Failed");
    }
  };

  const purgeCodes = async () => {
    try {
      const res = await apiRequest({ method: "POST", url: `${AUTH}/admin/auth-codes/purge/` });
      setToast(`Purged ${res.data?.data?.deleted ?? res.data?.deleted ?? 0} codes`);
      loadCodes();
    } catch (e) {
      setToast(e?.response?.data?.message || "Failed");
    }
  };

  const setTabAndUrl = (id) => {
    setTab(id);
    setSearchParams(id === "overview" ? {} : { tab: id });
  };

  const nav = [
    { id: "overview", label: "Overview", icon: <DashboardIcon /> },
    { id: "tickets", label: "Tickets", icon: <ConfirmationNumberIcon /> },
    ...(isAdmin || isStaff ? [{ id: "users", label: "Users & access", icon: <PeopleIcon /> }] : []),
    ...(isAdmin
      ? [
          { id: "invites", label: "Invites", icon: <LinkIcon /> },
          { id: "codes", label: "Auth codes", icon: <VpnKeyIcon /> },
          { id: "emails", label: "Email", icon: <EmailIcon /> },
        ]
      : []),
  ];

  if (meLoading) {
    return (
      <Box p={6} display="flex" justifyContent="center"><CircularProgress /></Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "75vh" }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          width: 240,
          flexShrink: 0,
          borderRadius: 0,
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          bgcolor: "background.paper",
          borderRight: 1,
          borderColor: "divider",
        }}
      >
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Typography variant="overline" color="text.secondary" letterSpacing={1.2}>
            Control center
          </Typography>
          <Typography fontWeight={800} fontSize={18} lineHeight={1.2}>Admin</Typography>
          <Stack direction="row" alignItems="center" gap={0.75} mt={1.25}>
            <FiberManualRecordIcon sx={{ fontSize: 11, color: liveConnected ? "success.main" : "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">
              {liveConnected ? "Realtime connected" : "Realtime offline"}
            </Typography>
          </Stack>
        </Box>
        <List dense sx={{ px: 1, flex: 1 }}>
          {nav.map((n) => (
            <ListItemButton
              key={n.id}
              selected={tab === n.id}
              onClick={() => setTabAndUrl(n.id)}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                "&.Mui-selected": {
                  bgcolor: "action.selected",
                  "& .MuiListItemIcon-root": { color: "primary.main" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{n.icon}</ListItemIcon>
              <ListItemText primary={n.label} primaryTypographyProps={{ fontWeight: tab === n.id ? 700 : 500, fontSize: 14 }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>

      <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0, bgcolor: "action.hover" }}>
        <FormControl size="small" fullWidth sx={{ mb: 2, display: { md: "none" } }}>
          <InputLabel>Section</InputLabel>
          <Select label="Section" value={tab} onChange={(e) => setTabAndUrl(e.target.value)}>
            {nav.map((n) => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
          </Select>
        </FormControl>

        {tab === "overview" && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" fontWeight={700}>Overview</Typography>
              <Chip size="small" icon={<FiberManualRecordIcon />} label={liveConnected ? "WebSocket connected" : "Connecting…"} color={liveConnected ? "success" : "default"} variant="outlined" />
            </Stack>
            {stats && (
              <Grid container spacing={2} mb={3}>
                {[
                  ["Total", stats.total], ["Open", stats.open, "info.main"],
                  ["In Progress", stats.in_progress, "warning.main"], ["Waiting", stats.waiting_user],
                  ["Urgent", stats.urgent, "error.main"], ["Unassigned", stats.unassigned],
                ].map(([label, val, color]) => (
                  <Grid key={label} item xs={6} sm={4} md={2}><StatCard label={label} value={val} color={color} /></Grid>
                ))}
              </Grid>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <Paper sx={{ p: 2 }}>
                  <Typography fontWeight={600} mb={1}>Recent tickets</Typography>
                  {tLoading ? <CircularProgress size={24} /> : (
                    <Table size="small">
                      <TableHead><TableRow>
                        <TableCell>ID</TableCell><TableCell>Subject</TableCell>
                        <TableCell>Status</TableCell><TableCell>User</TableCell>
                      </TableRow></TableHead>
                      <TableBody>
                        {tickets.slice(0, 8).map((t) => (
                          <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => openDetail(t.id)}>
                            <TableCell>{t.public_id}</TableCell>
                            <TableCell>{t.subject}</TableCell>
                            <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                            <TableCell>{t.user?.username}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={12} md={5}>
                <Paper sx={{ p: 2, maxHeight: 360, overflow: "auto" }}>
                  <Typography fontWeight={600} mb={1}>Live activity</Typography>
                  {liveEvents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Waiting for events…</Typography>
                  ) : (
                    <Stack spacing={1}>
                      {liveEvents.map((ev, i) => (
                        <Paper key={i} variant="outlined" sx={{ p: 1.2 }}>
                          <Stack direction="row" justifyContent="space-between">
                            <Chip size="small" label={ev.type} />
                            <Typography variant="caption">{ev.public_id}</Typography>
                          </Stack>
                          <Typography variant="body2" mt={0.5}>{ev.subject}</Typography>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}

        {tab === "tickets" && (
          <>
            <Typography variant="h5" fontWeight={700} mb={2}>Tickets</Typography>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} gap={2} flexWrap="wrap" useFlexGap>
                <TextField size="small" label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} sx={{ minWidth: 200, flex: 1 }} />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="open,in_progress,waiting_user">Active</MenuItem>
                    {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select label="Priority" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    {["low", "normal", "high", "urgent"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
            {tLoading ? <CircularProgress /> : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Number</TableCell><TableCell>Subject</TableCell>
                      <TableCell>User</TableCell><TableCell>Status</TableCell>
                      <TableCell>Priority</TableCell><TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tickets.map((t) => (
                      <TableRow key={t.id} hover>
                        <TableCell sx={{ cursor: "pointer" }} onClick={() => openDetail(t.id)}>{t.public_id}</TableCell>
                        <TableCell sx={{ cursor: "pointer" }} onClick={() => openDetail(t.id)}>{t.subject}</TableCell>
                        <TableCell>{t.user?.username}</TableCell>
                        <TableCell><Chip size="small" label={t.status} color={STATUS_COLOR[t.status] || "default"} /></TableCell>
                        <TableCell>{t.priority}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => deleteTicket(t.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {Math.ceil((count || 0) / 15) > 1 && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <Pagination page={page} count={Math.max(1, Math.ceil((count || 0) / 15))} onChange={(_, v) => setPage(v)} showFirstButton showLastButton color="primary" />
                  </Box>
                )}
              </Paper>
            )}
          </>
        )}

        {tab === "users" && (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
              <Box>
                <Typography variant="h5" fontWeight={700}>Users & access</Typography>
                <Typography variant="body2" color="text.secondary">
                  Manage accounts, staff flags, and permission rules in one place
                </Typography>
              </Box>
              {(isAdmin || isStaff) && (
                <Button variant="contained" onClick={() => setCreateOpen(true)}>New user</Button>
              )}
            </Stack>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                <TextField size="small" label="Search username / email" value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }} fullWidth />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Staff</InputLabel>
                  <Select label="Staff" value={userStaffOnly} onChange={(e) => { setUserStaffOnly(e.target.value); setUserPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="1">Staff</MenuItem>
                    <MenuItem value="0">Users</MenuItem>
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Active</InputLabel>
                  <Select label="Active" value={userActive} onChange={(e) => { setUserActive(e.target.value); setUserPage(1); }}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="1">Active</MenuItem>
                    <MenuItem value="0">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
            {userLoading ? <CircularProgress /> : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Flags</TableCell>
                      <TableCell>Rules</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} hover>
                        <TableCell>{u.username}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Stack direction="row" gap={0.5} flexWrap="wrap">
                            {u.is_superuser && <Chip size="small" color="error" label="super" />}
                            {u.is_staff && <Chip size="small" color="primary" label="staff" />}
                            {!u.is_active && <Chip size="small" label="inactive" />}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap>
                            {(u.rules || []).length === 0 ? (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            ) : (
                              (u.rules || []).slice(0, 4).map((r) => (
                                <Chip key={r} size="small" variant="outlined" label={r.split(".").pop()} sx={{ height: 22, fontSize: 11 }} />
                              ))
                            )}
                            {(u.rules || []).length > 4 && (
                              <Chip size="small" label={`+${u.rules.length - 4}`} sx={{ height: 22, fontSize: 11 }} />
                            )}
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => { const _u = { ...u, rules: u.rules || [] }; setEditUser(_u); loadUserMemberships(_u.id); }}>Edit</Button>
                          <IconButton size="small" color="error" onClick={() => deactivateUser(u.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {userCount > 20 && (
                  <Box display="flex" justifyContent="center" p={2}>
                    {Math.ceil((userCount || 0) / 20) > 1 && (
                      <Pagination page={userPage} count={Math.max(1, Math.ceil((userCount || 0) / 20))} onChange={(_, v) => setUserPage(v)} showFirstButton showLastButton color="primary" />
                    )}
                  </Box>
                )}
              </Paper>
            )}
          </>
        )}

        {tab === "invites" && isAdmin && (
          <>
            <Typography variant="h5" fontWeight={700} mb={2}>Invite links</Typography>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
                <TextField size="small" label="Label" value={newInvite.label}
                  onChange={(e) => setNewInvite((s) => ({ ...s, label: e.target.value }))} fullWidth />
                <TextField size="small" label="Max uses (empty=∞)" value={newInvite.max_uses}
                  onChange={(e) => setNewInvite((s) => ({ ...s, max_uses: e.target.value }))} sx={{ width: 160 }} />
                <Button variant="contained" onClick={createInvite}>Create</Button>
              </Stack>
            </Paper>
            {invLoading ? <CircularProgress /> : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Label</TableCell>
                      <TableCell>Token</TableCell>
                      <TableCell>Uses</TableCell>
                      <TableCell>Active</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.label || "—"}</TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>{inv.token}</Typography>
                        </TableCell>
                        <TableCell>{inv.uses_count}{inv.max_uses != null ? ` / ${inv.max_uses}` : " / ∞"}</TableCell>
                        <TableCell>
                          <Chip size="small" label={inv.is_active ? "active" : "off"} color={inv.is_active ? "success" : "default"} />
                        </TableCell>
                        <TableCell align="right">
                          {inv.is_active && (
                            <Button size="small" color="warning" onClick={() => deactivateInvite(inv.token)}>Deactivate</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}

        {tab === "codes" && isAdmin && (
          <>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h5" fontWeight={700}>Auth codes (OTP)</Typography>
              <Button size="small" color="warning" onClick={purgeCodes}>Purge expired</Button>
            </Stack>
            <TextField size="small" fullWidth label="Search user / contact / code" value={codeSearch}
              onChange={(e) => { setCodeSearch(e.target.value); setCodePage(1); }} sx={{ mb: 2 }} />
            {codeLoading ? <CircularProgress /> : (
              <Paper>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Contact</TableCell>
                      <TableCell>Purpose</TableCell>
                      <TableCell>Code</TableCell>
                      <TableCell>Attempts</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right"> </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {codes.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.username || "—"}</TableCell>
                        <TableCell>{c.contact || "—"}</TableCell>
                        <TableCell>{c.purpose}</TableCell>
                        <TableCell><Typography variant="caption" fontFamily="monospace">{c.code}</Typography></TableCell>
                        <TableCell>{c.attempts}</TableCell>
                        <TableCell>
                          {c.is_expired ? <Chip size="small" label="expired" /> :
                            c.is_locked ? <Chip size="small" color="warning" label="locked" /> :
                              <Chip size="small" color="success" label="valid" />}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton size="small" color="error" onClick={() => deleteCode(c.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {codeCount > 25 && (
                  <Box display="flex" justifyContent="center" p={2}>
                    <Pagination page={codePage} count={Math.ceil(codeCount / 25)} onChange={(_, v) => setCodePage(v)} />
                  </Box>
                )}
              </Paper>


            )}
          </>
        )}

        {tab === "emails" && isAdmin && <EmailManagement />}
      </Box>

      {/* Ticket drawer */}
      <Drawer anchor="right" open={Boolean(selectedId)} onClose={() => { setSelectedId(null); setDetail(null); }}
        PaperProps={{ sx: { width: { xs: "100%", sm: "min(560px, 100vw)" }, maxWidth: 640 } }}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography fontWeight={700}>{detail?.public_id || "Ticket"}</Typography>
          <Stack direction="row">
            {selectedId && (
              <IconButton color="error" onClick={() => deleteTicket(selectedId)}><DeleteOutlineIcon /></IconButton>
            )}
            <IconButton onClick={() => { setSelectedId(null); setDetail(null); }}><CloseIcon /></IconButton>
          </Stack>
        </Toolbar>
        <Divider />
        <Box sx={{ p: 2, overflow: "auto" }}>
          {detailLoading && !detail && <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>}
          {detail && (
            <>
              <Typography variant="h6">{detail.subject}</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                {detail.user?.username} · {detail.user?.email}
              </Typography>
              <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={detail.status} onChange={(e) => changeStatus(e.target.value)}>
                  {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 1.5, mt: 1 }}>
              <Box sx={{
                flex: 1, minHeight: 320, maxHeight: "calc(100vh - 260px)", overflow: "auto",
                display: "flex", flexDirection: "column", gap: 1.25, p: 1,
                bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.100"),
                  borderRadius: 2, border: "none",
              }}>
                {(detail.messages || []).map((m) => (
                  <MessageBubble key={m.id} message={m} mine={Boolean(m.is_staff_reply)} showHtmlToggle />
                ))}
              </Box>
              {detail.status !== "closed" && (
                <Box>
                  <SimpleHtmlEditor value={reply} onChange={setReply} minHeight={110} disabled={sending} />
                  <PendingFilesBar
                    files={files}
                    onRemove={(i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    onClear={() => setFiles([])}
                  />
                  <Stack direction="row" gap={1} alignItems="center" mt={1}>
                    <Button component="label" size="small" variant="outlined">
                      Attach
                      <input
                        hidden
                        type="file"
                        multiple
                        accept="image/*,audio/*,video/*,.pdf,.zip,.txt,.doc,.docx"
                        onChange={(e) => {
                          const picked = Array.from(e.target.files || []);
                          setFiles((prev) => [...prev, ...picked].slice(0, 5));
                          e.target.value = "";
                        }}
                      />
                    </Button>
                    <Typography variant="caption" color="text.secondary" flex={1}>
                      {files.length ? `${files.length} selected` : ""}
                    </Typography>
                    <Button variant="contained" disabled={sending || (!htmlToPlain(reply) && !files.length)} onClick={sendReply}>
                      {sending ? "Sending…" : "Send reply"}
                    </Button>
                  </Stack>
                </Box>
              )}
            </Box>
            </>
          )}
        </Box>
      </Drawer>

      {/* Edit user dialog */}
      <Dialog open={Boolean(editUser)} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit user
          <Typography component="span" color="text.secondary" fontWeight={400}> — {editUser?.username}</Typography>
        </DialogTitle>
        <DialogContent>
          {editUser && (
            <Stack gap={2} mt={1}>
              <TextField label="Email" size="small" value={editUser.email || ""}
                onChange={(e) => setEditUser((s) => ({ ...s, email: e.target.value }))} fullWidth />
              <FormControlLabel control={<Switch checked={!!editUser.is_active}
                onChange={(e) => setEditUser((s) => ({ ...s, is_active: e.target.checked }))} />} label="Active" />
              <FormControlLabel control={<Switch checked={!!editUser.is_staff}
                onChange={(e) => setEditUser((s) => ({ ...s, is_staff: e.target.checked }))} />} label="Staff" />
              {isAdmin && (
                <FormControlLabel control={<Switch checked={!!editUser.is_superuser}
                  onChange={(e) => setEditUser((s) => ({ ...s, is_superuser: e.target.checked }))} />} label="Superuser" />
              )}
              <Box>
                <Typography variant="subtitle2" gutterBottom>Access rules</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Staff need explicit rules. Superuser bypasses all checks.
                </Typography>
                <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 220, overflow: "auto" }}>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0.5 }}>
                    {(permCatalog.length ? permCatalog : []).map((code) => (
                      <FormControlLabel
                        key={code}
                        sx={{ m: 0, alignItems: "center" }}
                        control={
                          <Checkbox
                            size="small"
                            checked={(editUser.rules || []).includes(code)}
                            onChange={(e) => {
                              setEditUser((s) => {
                                const set = new Set(s.rules || []);
                                if (e.target.checked) set.add(code);
                                else set.delete(code);
                                return { ...s, rules: Array.from(set) };
                              });
                            }}
                          />
                        }
                        label={<Typography variant="caption" fontFamily="monospace">{code}</Typography>}
                      />
                    ))}
                  </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.5, mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    Department memberships
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    A user can belong to multiple departments. Managers can reassign tickets in that department.
                  </Typography>
                  {membershipLoading ? (
                    <CircularProgress size={22} />
                  ) : (
                    <Stack gap={0.5}>
                      {(deptCatalog || []).map((d) => {
                        const mem = (userMemberships || []).find((m) => String(m.department_id) === String(d.id));
                        const checked = Boolean(mem);
                        return (
                          <Stack key={d.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.25 }}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={checked}
                                  onChange={(e) => toggleDeptMembership(d.id, e.target.checked)}
                                />
                              }
                              label={<Typography variant="body2">{d.name}</Typography>}
                            />
                            <FormControlLabel
                              disabled={!checked}
                              control={
                                <Switch
                                  size="small"
                                  checked={Boolean(mem?.is_manager)}
                                  onChange={(e) => toggleDeptManager(d.id, e.target.checked)}
                                />
                              }
                              label={<Typography variant="caption">Manager</Typography>}
                            />
                          </Stack>
                        );
                      })}
                      {!deptCatalog?.length && (
                        <Typography variant="caption" color="text.secondary">No departments defined.</Typography>
                      )}
                    </Stack>
                  )}
                </Paper>

              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveUser}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create user</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Username" value={newUser.username}
              onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))} required />
            <TextField size="small" label="Email" value={newUser.email}
              onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} />
            <TextField size="small" type="password" label="Password" value={newUser.password}
              onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} />
            <FormControlLabel control={<Switch checked={newUser.is_staff}
              onChange={(e) => setNewUser((s) => ({ ...s, is_staff: e.target.checked }))} />} label="Staff" />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createUser}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={4500} onClose={() => setToast(null)}
        message={toast} anchorOrigin={{ vertical: "bottom", horizontal: "right" }} />
    </Box>
  );
}
