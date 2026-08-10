import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, FormControl, Grid, InputLabel, List, ListItemButton,
  ListItemText, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, Pagination,
} from "@mui/material";
import apiRequest from "../customHooks/apiRequest";
import { EMAILS_API, unwrapData } from "../tickets/api";

const VARS = ["{{ user.username }}", "{{ user.email }}", "{{ user.first_name }}", "{{ user.last_name }}", "{{ site_name }}", "{{ support_email }}"];

function StatCard({ label, value }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="h4" fontWeight={700}>{value ?? "—"}</Typography>
    </Paper>
  );
}

export default function EmailManagement() {
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [statsErr, setStatsErr] = useState("");
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logCount, setLogCount] = useState(0);
  const [logStatus, setLogStatus] = useState("");
  const [logSearch, setLogSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // compose
  const [tplId, setTplId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  // template editor
  const [editTpl, setEditTpl] = useState(null); // null | {id?} + fields
  const [tplForm, setTplForm] = useState({ name: "", subject: "", body: "", description: "", is_active: true });

  const loadStats = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${EMAILS_API}/stats/` });
      setStats(unwrapData(res));
      setStatsErr("");
    } catch (e) {
      setStatsErr(e?.response?.data?.message || "Failed to load stats (admin only)");
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${EMAILS_API}/templates/` });
      const data = res.data;
      setTemplates(data.results || data.data || (Array.isArray(data) ? data : []));
      setError("");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: logPage };
      if (logStatus) params.status = logStatus;
      if (logSearch) params.search = logSearch;
      const res = await apiRequest({ method: "GET", url: `${EMAILS_API}/logs/`, params });
      const data = res.data;
      setLogs(data.results || data.data || []);
      setLogCount(data.count || 0);
      setError("");
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [logPage, logStatus, logSearch]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    if (tab === "templates" || tab === "compose") loadTemplates();
    if (tab === "logs" || tab === "failed") loadLogs();
  }, [tab, loadTemplates, loadLogs]);

  const searchUsers = async (q) => {
    setUserQuery(q);
    if (!q || q.length < 1) { setUserResults([]); return; }
    try {
      const res = await apiRequest({ method: "GET", url: `${EMAILS_API}/users/`, params: { search: q } });
      setUserResults(unwrapData(res) || []);
    } catch { setUserResults([]); }
  };

  const doPreview = async () => {
    try {
      const res = await apiRequest({
        method: "POST",
        url: `${EMAILS_API}/templates/preview/`,
        data: {
          template_id: tplId || undefined,
          subject,
          body,
          user_id: selectedUsers[0]?.id,
        },
      });
      setPreview(unwrapData(res));
    } catch (e) {
      setError(e?.response?.data?.message || "Preview failed");
    }
  };

  const sendTest = async () => {
    if (!testEmail) return;
    setSending(true);
    try {
      await apiRequest({
        method: "POST",
        url: `${EMAILS_API}/send/`,
        data: { template_id: tplId || null, subject, body, is_test: true, test_email: testEmail },
      });
      alert("Test email queued");
    } catch (e) {
      setError(e?.response?.data?.message || "Test send failed");
    } finally {
      setSending(false);
    }
  };

  const sendBulk = async () => {
    if (!selectedUsers.length) { setError("Select at least one recipient"); return; }
    setSending(true);
    try {
      await apiRequest({
        method: "POST",
        url: `${EMAILS_API}/send/`,
        data: {
          template_id: tplId || null,
          subject,
          body,
          user_ids: selectedUsers.map((u) => u.id),
          is_test: false,
        },
      });
      alert("Emails queued");
      setTab("logs");
    } catch (e) {
      setError(e?.response?.data?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const saveTemplate = async () => {
    try {
      if (editTpl?.id) {
        await apiRequest({ method: "PUT", url: `${EMAILS_API}/templates/${editTpl.id}/`, data: tplForm });
      } else {
        await apiRequest({ method: "POST", url: `${EMAILS_API}/templates/`, data: tplForm });
      }
      setEditTpl(null);
      loadTemplates();
    } catch (e) {
      setError(e?.response?.data?.message || "Save template failed");
    }
  };

  const retryLog = async (id) => {
    try {
      await apiRequest({ method: "POST", url: `${EMAILS_API}/logs/${id}/retry/` });
      loadLogs();
    } catch (e) {
      setError(e?.response?.data?.message || "Retry failed");
    }
  };

  const insertVar = (v) => setBody((b) => b + v);

  const onSelectTemplate = (id) => {
    setTplId(id);
    const t = templates.find((x) => String(x.id) === String(id));
    if (t) {
      setSubject(t.subject || "");
      setBody(t.body || "");
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "templates", label: "Templates" },
    { id: "compose", label: "Compose" },
    { id: "logs", label: "Logs" },
    { id: "failed", label: "Failed" },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} mb={2}>Email Management</Typography>
      <Stack direction="row" gap={1} mb={3} flexWrap="wrap">
        {tabs.map((t) => (
          <Button key={t.id} variant={tab === t.id ? "contained" : "outlined"} size="small" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {tab === "dashboard" && (
        statsErr ? <Alert severity="error">{statsErr}</Alert> : !stats ? <CircularProgress /> : (
          <Grid container spacing={2}>
            {[
              ["Sent", stats.sent], ["Pending", stats.pending], ["Failed", stats.failed],
              ["Today", stats.today], ["This Week", stats.this_week],
              ["Sent Today", stats.sent_today], ["Failed Today", stats.failed_today],
            ].map(([l, v]) => (
              <Grid item xs={6} sm={4} md={3} key={l}><StatCard label={l} value={v} /></Grid>
            ))}
          </Grid>
        )
      )}

      {tab === "templates" && (
        <>
          <Stack direction="row" justifyContent="flex-end" mb={2}>
            <Button variant="contained" onClick={() => { setTplForm({ name: "", subject: "", body: "", description: "", is_active: true }); setEditTpl({}); }}>
              New Template
            </Button>
          </Stack>
          {loading ? <CircularProgress /> : (
            <Paper>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell><TableCell>Subject</TableCell><TableCell>Active</TableCell><TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.subject}</TableCell>
                      <TableCell><Chip size="small" label={t.is_active ? "Yes" : "No"} color={t.is_active ? "success" : "default"} /></TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => { setTplForm({ name: t.name, subject: t.subject, body: t.body, description: t.description || "", is_active: t.is_active }); setEditTpl(t); }}>Edit</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </>
      )}

      {tab === "compose" && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Template</InputLabel>
                  <Select label="Template" value={tplId} onChange={(e) => onSelectTemplate(e.target.value)}>
                    <MenuItem value="">Custom</MenuItem>
                    {templates.filter((t) => t.is_active).map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth size="small" />
                <TextField label="Body (HTML)" value={body} onChange={(e) => setBody(e.target.value)} fullWidth multiline minRows={8} />
                <Box>
                  <Typography variant="caption" color="text.secondary">Available variables (click to insert):</Typography>
                  <Stack direction="row" gap={0.5} flexWrap="wrap" mt={0.5}>
                    {VARS.map((v) => (
                      <Chip key={v} size="small" label={v} onClick={() => insertVar(v)} sx={{ cursor: "pointer" }} />
                    ))}
                  </Stack>
                </Box>
                <TextField
                  label="Search recipients"
                  value={userQuery}
                  onChange={(e) => searchUsers(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Search by username or email"
                />
                {userResults.length > 0 && (
                  <Paper variant="outlined" sx={{ maxHeight: 160, overflow: "auto" }}>
                    <List dense>
                      {userResults.map((u) => (
                        <ListItemButton key={u.id} onClick={() => {
                          if (!selectedUsers.find((x) => x.id === u.id)) setSelectedUsers([...selectedUsers, u]);
                        }}>
                          <ListItemText primary={u.username} secondary={u.email} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
                <Stack direction="row" gap={1} flexWrap="wrap">
                  {selectedUsers.map((u) => (
                    <Chip key={u.id} label={`${u.username}`} onDelete={() => setSelectedUsers(selectedUsers.filter((x) => x.id !== u.id))} />
                  ))}
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
                  <Button variant="outlined" onClick={doPreview}>Preview</Button>
                  <TextField size="small" label="Test email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                  <Button variant="outlined" disabled={sending} onClick={sendTest}>Send Test</Button>
                  <Button variant="contained" disabled={sending} onClick={sendBulk}>{sending ? "Sending…" : "Send"}</Button>
                </Stack>
              </Stack>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2, minHeight: 280 }}>
              <Typography fontWeight={600} mb={1}>Preview</Typography>
              {preview ? (
                <>
                  <Typography variant="subtitle2">Subject: {preview.subject}</Typography>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ "& p": { m: 0 } }} dangerouslySetInnerHTML={{ __html: preview.body }} />
                </>
              ) : (
                <Typography color="text.secondary">Click Preview to render with selected user variables.</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {(tab === "logs" || tab === "failed") && (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} gap={2} mb={2}>
            <TextField size="small" label="Search" value={logSearch} onChange={(e) => { setLogSearch(e.target.value); setLogPage(1); }} />
            {tab === "logs" && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={logStatus} onChange={(e) => { setLogStatus(e.target.value); setLogPage(1); }}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="sent">Sent</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="sending">Sending</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
          {loading ? <CircularProgress /> : (
            <Paper>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recipient</TableCell><TableCell>Subject</TableCell><TableCell>Status</TableCell>
                    <TableCell>Created</TableCell><TableCell>Sent</TableCell><TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(tab === "failed" ? logs.filter((l) => l.status === "failed") : logs).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.recipient_email}</TableCell>
                      <TableCell>{l.subject}</TableCell>
                      <TableCell><Chip size="small" label={l.status} color={l.status === "sent" ? "success" : l.status === "failed" ? "error" : "default"} /></TableCell>
                      <TableCell>{l.created_at ? new Date(l.created_at).toLocaleString() : "—"}</TableCell>
                      <TableCell>{l.sent_at ? new Date(l.sent_at).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        {l.status === "failed" && (
                          <Button size="small" onClick={() => retryLog(l.id)}>Retry</Button>
                        )}
                        {l.error_message && (
                          <Typography variant="caption" color="error" display="block">{l.error_message.slice(0, 80)}</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {logCount > 20 && (
                <Box display="flex" justifyContent="center" p={2}>
                  <Pagination page={logPage} count={Math.ceil(logCount / 20)} onChange={(_, v) => setLogPage(v)} />
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      <Dialog open={editTpl !== null} onClose={() => setEditTpl(null)} fullWidth maxWidth="md">
        <DialogTitle>{editTpl?.id ? "Edit Template" : "New Template"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField label="Name" value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} fullWidth />
            <TextField label="Subject" value={tplForm.subject} onChange={(e) => setTplForm({ ...tplForm, subject: e.target.value })} fullWidth />
            <TextField label="Body" value={tplForm.body} onChange={(e) => setTplForm({ ...tplForm, body: e.target.value })} fullWidth multiline minRows={8} />
            <TextField label="Description" value={tplForm.description} onChange={(e) => setTplForm({ ...tplForm, description: e.target.value })} fullWidth />
            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {VARS.map((v) => (
                <Chip key={v} size="small" label={v} onClick={() => setTplForm({ ...tplForm, body: tplForm.body + v })} sx={{ cursor: "pointer" }} />
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTpl(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveTemplate}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
