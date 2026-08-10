import React, { useEffect, useState } from "react";
import {
  Box, Button, FormControl, InputLabel, MenuItem, Paper, Select,
  Stack, TextField, Typography, Alert, CircularProgress, LinearProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";
import { TICKETS_API, unwrapData, unwrapList } from "./api";

export default function CreateTicket() {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [deploys, setDeploys] = useState([]);
  const [departmentId, setDepartmentId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [deployId, setDeployId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [depsError, setDepsError] = useState("");

  const loadOptions = async () => {
    setLoadingDeps(true);
    setDepsError("");
    try {
      const [depRes, ctxRes] = await Promise.all([
        apiRequest({ method: "GET", url: `${TICKETS_API}/departments/` }),
        apiRequest({ method: "GET", url: `${TICKETS_API}/context/` }),
      ]);
      const deps = unwrapData(depRes);
      setDepartments(Array.isArray(deps) ? deps : unwrapList(depRes));
      const ctx = unwrapData(ctxRes) || {};
      setServices(ctx.services || []);
      setDeploys(ctx.deploys || []);
    } catch (e) {
      setDepsError(e?.response?.data?.message || "Failed to load departments. Check login and API.");
      setDepartments([]);
    } finally {
      setLoadingDeps(false);
    }
  };

  useEffect(() => { loadOptions(); }, []);

  useEffect(() => {
    if (serviceId === undefined) return;
    (async () => {
      try {
        const params = serviceId ? { service_id: serviceId } : {};
        const res = await apiRequest({ method: "GET", url: `${TICKETS_API}/context/`, params });
        const ctx = unwrapData(res) || {};
        setDeploys(ctx.deploys || []);
        setDeployId("");
      } catch { /* ignore */ }
    })();
  }, [serviceId]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!departmentId || subject.trim().length < 3 || !body.trim()) {
      setError("Please fill department, subject (min 3 chars) and message.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("department_id", departmentId);
      form.append("subject", subject.trim());
      form.append("body", body.trim().includes("<") ? body : `<p>${body.replace(/\n/g, "<br>")}</p>`);
      form.append("priority", priority);
      if (serviceId) form.append("service_id", serviceId);
      if (deployId) form.append("deploy_id", deployId);
      files.forEach((f) => form.append("attachments", f));
      const res = await apiRequest({ method: "POST", url: `${TICKETS_API}/`, data: form });
      const ticket = unwrapData(res);
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  if (loadingDeps) {
    return (
      <Box p={4} display="flex" flexDirection="column" alignItems="center" gap={2}>
        <CircularProgress />
        <Typography color="text.secondary">Loading departments…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Create Ticket</Typography>
      <Paper sx={{ p: 3 }} component="form" onSubmit={submit}>
        {depsError && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={loadOptions}>Retry</Button>}>
            {depsError}
          </Alert>
        )}
        {!depsError && departments.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>No departments available. Ask an admin to create one.</Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2.5}>
          <FormControl fullWidth required>
            <InputLabel>Department</InputLabel>
            <Select label="Department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              {departments.map((d) => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Service (optional)</InputLabel>
            <Select label="Service (optional)" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {services.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Deploy (optional)</InputLabel>
            <Select label="Deploy (optional)" value={deployId} onChange={(e) => setDeployId(e.target.value)}>
              <MenuItem value=""><em>None</em></MenuItem>
              {deploys.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  {d.name || d.version || String(d.id).slice(0, 8)}{d.status ? ` · ${d.status}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth inputProps={{ maxLength: 255 }} />
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Message" required multiline minRows={6} value={body} onChange={(e) => setBody(e.target.value)} fullWidth />
          <Button variant="outlined" component="label">
            Attach files
            <input hidden type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </Button>
          {files.length > 0 && <Typography variant="body2">{files.map((f) => f.name).join(", ")}</Typography>}
          {loading && <LinearProgress />}
          <Stack direction="row" gap={2} justifyContent="flex-end">
            <Button onClick={() => navigate("/tickets")}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={loading || !departments.length}>{loading ? "Creating…" : "Create Ticket"}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
