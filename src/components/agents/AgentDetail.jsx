import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import BlockRoundedIcon from "@mui/icons-material/BlockRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useNavigate, useParams } from "react-router-dom";
import { getApiErrorMessage } from "../service_detail/errorUtils";
import { getAgent, listScopes, listCredentials, issueCredential, rotateCredentials, revokeCredential, deleteCredential, setAgentStatus, listAudit, updateAgent, generateManifest, downloadManifest, deleteAgent } from "./agentApi";

function fmt(value) { return value ? new Date(value).toLocaleString() : "Never"; }
function provisioningLabel(value) {
  if (value === "dashboard") return "Dashboard";
  if (value === "api_enrollment") return "API enrollment";
  return "Legacy / unspecified";
}

export default function AgentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [scopeCatalog, setScopeCatalog] = useState({ scopes: [], defaults: [] });
  const [credentials, setCredentials] = useState([]);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [expiresDays, setExpiresDays] = useState(30);
  const [tokenDialog, setTokenDialog] = useState({ open: false, token: "", title: "", warning: "" });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", scopes: [] });
  const [copied, setCopied] = useState(false);
  const [manifestDialog, setManifestDialog] = useState({ open: false, content: "", filename: "" });
  const [manifestCopied, setManifestCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const groupedScopes = useMemo(() => (scopeCatalog.scopes || []).reduce((acc, scope) => {
    (acc[scope.category] ||= []).push(scope);
    return acc;
  }, {}), [scopeCatalog.scopes]);


  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [agentData, scopesData, credsData, auditData] = await Promise.all([getAgent(id), listScopes(), listCredentials(id), listAudit(id)]);
      setAgent(agentData);
      setScopeCatalog(scopesData);
      setCredentials(Array.isArray(credsData.results) ? credsData.results : []);
      setAudit(Array.isArray(auditData.results) ? auditData.results : []);
      setDraft({ name: agentData.name || "", description: agentData.description || "", scopes: agentData.scopes || [] });
    } catch (e) { setError(getApiErrorMessage(e, "Failed to load Agent.")); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const mutate = async (action) => {
    setSaving(true); setError("");
    try {
      const data = await action();
      if (data?.agent) setAgent(data.agent);
      await load();
      return data;
    } catch (e) { setError(getApiErrorMessage(e, "Agent operation failed.")); return null; }
    finally { setSaving(false); }
  };

  const toggleScope = (name) => setDraft((prev) => ({ ...prev, scopes: prev.scopes.includes(name) ? prev.scopes.filter((x) => x !== name) : [...prev.scopes, name] }));

  const saveProfile = async () => {
    const data = await mutate(() => updateAgent(id, { name: draft.name.trim(), description: draft.description, scopes: draft.scopes }), null);
    if (data) setEditing(false);
  };

  const showToken = (result) => setTokenDialog({
    open: true,
    token: result?.credential?.token || "",
    title: result?.warning?.startsWith("All") ? "Agent credentials rotated" : "Access token created",
    warning: result?.warning || "This token is shown only once. Store it in a secure secret store.",
  });

  const issue = async () => {
    const result = await mutate(() => issueCredential(id, { expires_in_days: Number(expiresDays) }), null);
    if (result) { setIssueOpen(false); showToken(result); }
  };

  const rotate = async () => {
    if (!window.confirm("Rotate credentials? All currently active Agent credentials will be revoked and one new credential will be issued.")) return;
    const result = await mutate(() => rotateCredentials(id), null);
    if (result) showToken(result);
  };

  const statusAction = async (action) => {
    const text = action === "revoke" ? "Revoke this Agent permanently?" : action === "disable" ? "Disable this Agent?" : "Enable this Agent?";
    if (!window.confirm(text)) return;
    await mutate(() => setAgentStatus(id, action), null);
  };

  const removeAgent = () => {
    setDeleteTarget({ type: "agent" });
  };

  const removeCredential = (credential) => {
    setDeleteTarget({ type: "credential", credential });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setSaving(true);
    setDeleteTarget(null);
    setError("");
    try {
      if (target.type === "agent") {
        await deleteAgent(id);
      } else {
        await deleteCredential(id, target.credential.id);
      }
      if (target.type === "agent") {
        navigate("/dashboard/agents", { replace: true });
      } else {
        await load();
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete Agent."));
    } finally {
      setSaving(false);
    }
  };

  const copyToken = async () => {
    if (!tokenDialog.token) return;
    try { await navigator.clipboard.writeText(tokenDialog.token); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); }
  };

  const doManifest = async () => {
    setSaving(true); setError("");
    try {
      const result = await generateManifest(id);
      if (!result?.content) throw new Error("The server returned an empty AGENT.md.");
      setManifestDialog({ open: true, content: result.content, filename: result.filename || "AGENT-" + id + ".md" });
      setManifestCopied(false);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to generate AGENT.md."));
    } finally {
      setSaving(false);
    }
  };

  const copyManifest = async () => {
    if (!manifestDialog.content) return;
    try {
      await navigator.clipboard.writeText(manifestDialog.content);
      setManifestCopied(true);
      window.setTimeout(() => setManifestCopied(false), 1400);
    } catch {
      setManifestCopied(false);
    }
  };

  if (loading) return <Box sx={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress /></Box>;
  if (!agent) return <Container maxWidth="md" sx={{ py: 6 }}><Alert severity="error" sx={{ borderRadius: 2 }}>{error || "Agent not found."}</Alert><Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/dashboard/agents")} sx={{ mt: 2 }}>Back to Agents</Button></Container>;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 } }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
          <Box>
            <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate("/dashboard/agents")} sx={{ px: 0, mb: 0.8 }}>Agents</Button>
            <Stack direction="row" spacing={1} alignItems="center">
              <SmartToyOutlinedIcon color="primary" />
              <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>{agent.name}</Typography>
              <Chip size="small" label={agent.status} color={agent.status === "active" ? "success" : agent.status === "disabled" ? "warning" : "default"} sx={{ height: 24, fontWeight: 750 }} />
              <Chip size="small" variant="outlined" label={"Provisioned via " + provisioningLabel(agent.provisioning_source)} sx={{ height: 24, fontWeight: 700 }} />
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.55 }}>{agent.description || "No description"}</Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<DescriptionRoundedIcon />} onClick={doManifest} disabled={saving || agent.status !== "active"} sx={{ borderRadius: 1.5 }}>{saving ? "Generating…" : "View AGENT.md"}</Button>
            <Button variant="outlined" startIcon={<KeyRoundedIcon />} onClick={() => setIssueOpen(true)} disabled={saving || agent.status !== "active"} sx={{ borderRadius: 1.5 }}>Issue token</Button>
            {agent.status === "active" ? <Button color="warning" variant="outlined" startIcon={<BlockRoundedIcon />} onClick={() => statusAction("disable")} disabled={saving} sx={{ borderRadius: 1.5 }}>Disable</Button> : null}
            {agent.status === "disabled" ? <Button variant="outlined" startIcon={<RestartAltRoundedIcon />} onClick={() => statusAction("enable")} disabled={saving} sx={{ borderRadius: 1.5 }}>Enable</Button> : null}
            {agent.status !== "revoked" ? <Button color="error" variant="outlined" onClick={() => statusAction("revoke")} disabled={saving} sx={{ borderRadius: 1.5 }}>Revoke</Button> : null}
            <Button
              color="error"
              variant="contained"
              startIcon={<DeleteOutlineRoundedIcon />}
              onClick={removeAgent}
              disabled={saving}
              sx={{ borderRadius: 1.5, fontWeight: 800 }}
            >
              {saving ? "Deleting…" : "Delete"}
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ borderRadius: 2 }} action={<IconButton color="inherit" onClick={load}><RefreshRoundedIcon /></IconButton>}>{error}</Alert> : null}

        <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: "hidden" }}>
          <Tabs value={tab} onChange={(e, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ px: 1.5 }}>
            <Tab label="Overview" />
            <Tab label={"Permissions (" + agent.scope_count + ")"} />
            <Tab label={"Credentials (" + agent.active_credential_count + ")"} />
            <Tab label="Audit" />
          </Tabs>
          <Divider />

          {tab === 0 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                Deleting this Agent is permanent. Its credentials, enrollment tokens and idempotency records are removed with it. A revoked Agent can still be deleted.
              </Alert>
              <Stack spacing={2.25}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  {[["Status", agent.status], ["Provisioned via", provisioningLabel(agent.provisioning_source)], ["Created", fmt(agent.created_at)], ["Last used", fmt(agent.last_used_at)], ["Active credentials", String(agent.active_credential_count)]] .map(([label, value]) => (
                    <Paper key={label} variant="outlined" sx={{ p: 1.75, flex: 1, borderRadius: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ mt: 0.3, fontWeight: 750 }}>{value}</Typography></Paper>
                  ))}
                </Stack>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box><Typography variant="subtitle1" fontWeight={850}>Agent profile</Typography><Typography variant="body2" color="text.secondary">The Agent belongs to your account and is independent from individual services.</Typography></Box>
                    <Button variant={editing ? "contained" : "outlined"} onClick={() => setEditing((v) => !v)} sx={{ borderRadius: 1.5 }}>{editing ? "Cancel" : "Edit"}</Button>
                  </Stack>
                  {editing ? (
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <TextField label="Name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} fullWidth />
                      <TextField label="Description" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} multiline minRows={2} fullWidth />
                      <Button variant="contained" onClick={saveProfile} disabled={saving || !draft.name.trim()} sx={{ alignSelf: "flex-start", borderRadius: 1.5 }}>Save changes</Button>
                    </Stack>
                  ) : null}
                </Paper>
              </Stack>
            </Box>
          ) : null}

          {tab === 1 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>Grant only the permissions the automation client actually needs. Destructive and high-risk scopes are marked.</Alert>
              <Stack spacing={2}>
                {Object.entries(groupedScopes).map(([category, scopes]) => (
                  <Paper key={category} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: "capitalize" }}>{category.replace(/_/g, " ")}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      {scopes.map((scope) => {
                        const selected = draft.scopes.includes(scope.name);
                        const suffix = scope.destructive ? " · destructive" : scope.high_risk ? " · high risk" : "";
                        return <Chip key={scope.name} label={scope.label + suffix} icon={selected ? <CheckRoundedIcon /> : undefined} color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"} onClick={() => toggleScope(scope.name)} sx={{ height: 31, fontWeight: 650 }} />;
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
              <Button variant="contained" onClick={saveProfile} disabled={saving} sx={{ mt: 2, borderRadius: 1.5 }}>Save permissions</Button>
            </Box>
          ) : null}

          {tab === 2 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
                <Button variant="contained" startIcon={<KeyRoundedIcon />} onClick={() => setIssueOpen(true)} disabled={saving || agent.status !== "active"} sx={{ borderRadius: 1.5 }}>Issue new token</Button>
                <Button variant="outlined" onClick={rotate} disabled={saving || agent.status !== "active"} sx={{ borderRadius: 1.5 }}>Rotate all credentials</Button>
              </Stack>
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>Plaintext access tokens are never listed here. A newly issued or rotated token is shown once only.</Alert>
              <Stack spacing={1}>
                {credentials.length ? credentials.map((credential) => (
                  <Paper key={credential.id} variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
                      <Box sx={{ flex: 1 }}><Typography fontFamily="ui-monospace, monospace" fontWeight={800}>{credential.prefix}</Typography><Typography variant="caption" color="text.secondary">Created {fmt(credential.created_at)} · Expires {fmt(credential.expires_at)} · Last used {fmt(credential.last_used_at)}{credential.issued_via ? " · Issued via " + provisioningLabel(credential.issued_via === "api_enrollment" ? "api_enrollment" : "dashboard") : ""}</Typography></Box>
                      <Chip size="small" label={credential.active ? "active" : "revoked / expired"} color={credential.active ? "success" : "default"} sx={{ fontWeight: 700 }} />
                      {credential.active ? <Button size="small" color="error" variant="outlined" onClick={async () => {
                        if (!window.confirm("Revoke this credential? It will stop authenticating but its record will remain available for audit/history.")) return;
                        try { setSaving(true); setError(""); await revokeCredential(id, credential.id); await load(); } catch (e) { setError(getApiErrorMessage(e, "Failed to revoke credential.")); } finally { setSaving(false); }
                      }} disabled={saving} sx={{ borderRadius: 1.5 }}>Revoke</Button> : null}
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => removeCredential(credential)}
                        disabled={saving}
                        sx={{ borderRadius: 1.5, fontWeight: 750 }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Paper>
                )) : <Typography color="text.secondary">No credentials have been issued.</Typography>}
              </Stack>
            </Box>
          ) : null}

          {tab === 3 ? (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={1}>
                {audit.length ? audit.map((event) => (
                  <Paper key={event.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1.2} justifyContent="space-between">
                      <Box>
                        <Typography fontWeight={800}>{event.action}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {event.resource_type || "agent"}{event.resource_id ? " · " + event.resource_id : ""} · {fmt(event.occurred_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Request {event.request_id || "—"} · {event.duration_ms != null ? event.duration_ms + " ms" : "duration —"}{event.error_code ? " · " + event.error_code : ""}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.7} alignItems="center"><Chip size="small" label={event.success ? "success" : "failed"} color={event.success ? "success" : "error"} /><Typography variant="caption" color="text.secondary">{event.http_status || "—"}</Typography></Stack>
                    </Stack>
                  </Paper>
                )) : <Typography color="text.secondary">No audit events yet.</Typography>}
              </Stack>
            </Box>
          ) : null}
        </Paper>
      </Stack>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ pb: 1.2, fontWeight: 900, letterSpacing: "-0.02em" }}>
          {deleteTarget?.type === "credential" ? "Delete credential" : "Delete Agent"}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 2.25 }}>
          <Stack spacing={1.5}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "error.main",
                color: "error.contrastText",
              }}
            >
              <DeleteOutlineRoundedIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>
                {deleteTarget?.type === "credential"
                  ? "Delete this credential permanently?"
                  : "Delete " + (agent?.name || "this Agent") + " permanently?"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55, lineHeight: 1.65 }}>
                {deleteTarget?.type === "credential"
                  ? "An active token will stop working immediately. The credential record will be removed, while its audit event remains available for history."
                  : "This cannot be undone. All credentials, enrollment tokens and idempotency records belonging to this Agent will be deleted."}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={confirmDelete}
            disabled={saving}
            sx={{ borderRadius: 1.5, fontWeight: 800 }}
          >
            {saving ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={manifestDialog.open}
        onClose={() => setManifestDialog({ open: false, content: "", filename: "" })}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ fontWeight: 850 }}>AGENT.md</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            This generated file contains a short-lived, single-use enrollment token. Copy or save it only where the automation client can use it, and do not publish it.
          </Alert>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              minHeight: 320,
              maxHeight: "62vh",
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              bgcolor: "action.hover",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: { xs: 12, sm: 13 },
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {manifestDialog.content}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {manifestDialog.filename || "AGENT.md"} · generated on demand
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={manifestCopied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
              onClick={copyManifest}
              disabled={!manifestDialog.content}
            >
              {manifestCopied ? "Copied" : "Copy"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadRoundedIcon />}
              onClick={() => downloadManifest(manifestDialog.content, manifestDialog.filename || "AGENT.md")}
              disabled={!manifestDialog.content}
            >
              Download
            </Button>
            <Button
              variant="contained"
              onClick={() => setManifestDialog({ open: false, content: "", filename: "" })}
            >
              Done
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <Dialog open={issueOpen} onClose={() => !saving && setIssueOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 850 }}>Issue Agent access token</DialogTitle>
        <DialogContent dividers>
          <TextField type="number" label="Expires in days" value={expiresDays} onChange={(e) => setExpiresDays(e.target.value)} inputProps={{ min: 1, max: 3650 }} helperText="1–3650 days. The server default is used only when no value is supplied." fullWidth />
        </DialogContent>
        <DialogActions><Button onClick={() => setIssueOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" onClick={issue} disabled={saving || Number(expiresDays) < 1 || Number(expiresDays) > 3650}>{saving ? "Issuing…" : "Issue token"}</Button></DialogActions>
      </Dialog>

      <Dialog open={tokenDialog.open} onClose={() => setTokenDialog({ open: false, token: "", title: "", warning: "" })} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 850 }}>{tokenDialog.title}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{tokenDialog.warning}</Alert>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, bgcolor: "action.hover", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>{tokenDialog.token || "Token unavailable"}</Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}><Button startIcon={copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />} onClick={copyToken} disabled={!tokenDialog.token}>{copied ? "Copied" : "Copy token"}</Button><Button variant="contained" onClick={() => setTokenDialog({ open: false, token: "", title: "", warning: "" })}>Done</Button></DialogActions>
      </Dialog>
    </Container>
  );
}