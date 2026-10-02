import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Pagination, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { createAgent, deleteAgent, listAgents, listScopes } from "./agentApi";
import { getApiErrorMessage } from "../service_detail/errorUtils";

function provisioningLabel(value) {
  if (value === "dashboard") return "Dashboard";
  if (value === "api_enrollment") return "API enrollment";
  return "Legacy / unspecified";
}

export default function Agents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceContext = searchParams.get("service");
  const [agents, setAgents] = useState([]);
  const [agentPage, setAgentPage] = useState(1);
  const [agentCount, setAgentCount] = useState(0);
  const [scopeCatalog, setScopeCatalog] = useState({ scopes: [], defaults: [] });
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", scopes: [] });

  const refresh = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    setError("");
    try {
      const [agentsData, scopesData] = await Promise.all([
        listAgents({ page: pageNumber, page_size: 5 }),
        listScopes(),
      ]);
      setAgents(Array.isArray(agentsData.results) ? agentsData.results : Array.isArray(agentsData) ? agentsData : []);
      setAgentCount(Number(agentsData.count) || (Array.isArray(agentsData) ? agentsData.length : 0));
      setAgentPage(pageNumber);
      setScopeCatalog(scopesData);
      setDraft((prev) => ({ ...prev, scopes: prev.scopes.length ? prev.scopes : scopesData.defaults || [] }));
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to load Agents."));
    } finally {
      setLoading(false);
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { refresh(1); }, [refresh]);

  const groupedScopes = useMemo(() => (scopeCatalog.scopes || []).reduce((acc, scope) => {
    (acc[scope.category] ||= []).push(scope);
    return acc;
  }, {}), [scopeCatalog.scopes]);

  const toggleScope = (name) => setDraft((prev) => ({
    ...prev,
    scopes: prev.scopes.includes(name) ? prev.scopes.filter((item) => item !== name) : [...prev.scopes, name],
  }));

  const openCreate = () => {
    setDraft({ name: "", description: "", scopes: scopeCatalog.defaults || [] });
    setDialogOpen(true);
  };

  const submitCreate = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const result = await createAgent({ name: draft.name.trim(), description: draft.description, scopes: draft.scopes });
      setDialogOpen(false);
      if (result.agent?.id) navigate("/dashboard/agents/" + result.agent.id);
      else await refresh();
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to create Agent."));
    } finally { setSaving(false); }
  };

  const removeAgent = (agent) => {
    setDeleteTarget(agent);
  };

  const confirmDeleteAgent = async () => {
    if (!deleteTarget) return;
    const agent = deleteTarget;
    setSaving(true);
    setDeleteTarget(null);
    setError("");
    try {
      await deleteAgent(agent.id);
      const targetPage = agents.length === 1 && agentPage > 1 ? agentPage - 1 : agentPage;
      await refresh(targetPage);
    } catch (e) {
      setError(getApiErrorMessage(e, "Failed to delete Agent."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 } }}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" gap={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <SmartToyOutlinedIcon color="primary" />
              <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>Agents</Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
              Manage scoped machine access to your PaaSDeployer control plane for automation clients and AI agents.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refresh(agentPage)} disabled={loading} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
                <RefreshRoundedIcon />
              </IconButton>
            </Tooltip>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ borderRadius: 1.5, fontWeight: 800 }}>
              Create agent
            </Button>
          </Stack>
        </Stack>

        {serviceContext ? <Alert severity="info" sx={{ borderRadius: 2 }}>
          You arrived here from a service. Agents remain account-level resources; the service is only navigation context.
        </Alert> : null}

        {error ? <Alert severity="error" sx={{ borderRadius: 2 }} action={<IconButton color="inherit" onClick={() => refresh(agentPage)}><RefreshRoundedIcon /></IconButton>}>{error}</Alert> : null}

        {loading ? <Box sx={{ py: 10, display: "flex", justifyContent: "center" }}><CircularProgress /></Box> : agents.length === 0 ? (
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 2.5, textAlign: "center" }}>
            <SmartToyOutlinedIcon sx={{ fontSize: 42, color: "primary.main" }} />
            <Typography variant="h6" sx={{ mt: 1.2, fontWeight: 850 }}>No Agents yet</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5, maxWidth: 560, mx: "auto" }}>
              Create an Agent, grant only the scopes it needs, then issue a short-lived credential for your automation client.
            </Typography>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ mt: 2, borderRadius: 1.5 }}>Create your first agent</Button>
          </Paper>
        ) : (
          <Stack spacing={1.25}>
            {agents.map((agent) => (
              <Paper key={agent.id} variant="outlined" sx={{ p: { xs: 1.75, sm: 2 }, borderRadius: 2.25 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="subtitle1" sx={{ fontWeight: 850 }}>{agent.name}</Typography>
                      <Chip size="small" label={agent.status} color={agent.status === "active" ? "success" : agent.status === "disabled" ? "warning" : "default"} sx={{ height: 23, fontWeight: 700 }} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>{agent.description || "No description"}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                      <Chip size="small" variant="outlined" label={agent.scope_count + " scopes"} />
                      <Chip size="small" variant="outlined" label={agent.active_credential_count + " active credentials"} />
                      <Chip size="small" variant="outlined" label={"Provisioned via " + provisioningLabel(agent.provisioning_source)} />
                      <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
                        Last used {agent.last_used_at ? new Date(agent.last_used_at).toLocaleString() : "never"}
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignSelf: { xs: "stretch", md: "center" } }}>
                    <Button variant="outlined" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate("/dashboard/agents/" + agent.id)} sx={{ borderRadius: 1.5, fontWeight: 750 }}>
                      Manage
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteOutlineRoundedIcon />}
                      onClick={() => removeAgent(agent)}
                      disabled={saving}
                      sx={{ borderRadius: 1.5, fontWeight: 750 }}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {agentCount > 5 ? (
          <Stack spacing={0.75} alignItems="center" sx={{ pt: 0.5 }}>
            <Pagination
              count={Math.max(1, Math.ceil(agentCount / 5))}
              page={agentPage}
              onChange={(_, value) => refresh(value)}
              disabled={loading}
              shape="rounded"
              color="primary"
            />
            <Typography variant="caption" color="text.secondary">
              Page {agentPage} of {Math.max(1, Math.ceil(agentCount / 5))} · {agentCount} Agents
            </Typography>
          </Stack>
        ) : null}
      </Stack>

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => !saving && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ pb: 1.2, fontWeight: 900, letterSpacing: "-0.02em" }}>
          Delete Agent
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
                Delete {deleteTarget?.name || "this Agent"} permanently?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.55, lineHeight: 1.65 }}>
                This cannot be undone. All credentials, enrollment tokens and idempotency records belonging to this Agent will be deleted.
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.75, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={confirmDeleteAgent}
            disabled={saving}
            sx={{ borderRadius: 1.5, fontWeight: 800 }}
          >
            {saving ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 850 }}>Create Agent</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField autoFocus fullWidth label="Name" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} helperText="Use a stable name such as claude-prod or ci-deployer." disabled={saving} />
            <TextField fullWidth multiline minRows={2} label="Description" value={draft.description} onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))} disabled={saving} />
            <Divider />
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2" sx={{ fontWeight: 850 }}>Initial scopes</Typography>
                <Stack direction="row" spacing={0.75}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      scopes: (scopeCatalog.scopes || []).map((scope) => scope.name),
                    }))}
                    disabled={saving || catalogLoading || !(scopeCatalog.scopes || []).length}
                    sx={{ borderRadius: 1.25, fontWeight: 750 }}
                  >
                    All
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setDraft((prev) => ({
                      ...prev,
                      scopes: [...(scopeCatalog.defaults || [])],
                    }))}
                    disabled={saving || catalogLoading}
                    sx={{ borderRadius: 1.25, fontWeight: 750 }}
                  >
                    Reset
                  </Button>
                </Stack>
              </Stack>
              {catalogLoading ? <CircularProgress size={20} /> : Object.entries(groupedScopes).map(([category, scopes]) => (
                <Box key={category}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: "text.secondary", textTransform: "uppercase", letterSpacing: ".08em" }}>{category.replace(/_/g, " ")}</Typography>
                  <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ mt: 0.65 }}>
                    {scopes.map((scope) => {
                      const selected = draft.scopes.includes(scope.name);
                      return <Chip key={scope.name} label={scope.label} size="small" color={selected ? "primary" : "default"} variant={selected ? "filled" : "outlined"} onClick={() => toggleScope(scope.name)} sx={{ fontWeight: 650, height: 28 }} />;
                    })}
                  </Stack>
                </Box>
              ))}
              {!catalogLoading && !(scopeCatalog.scopes || []).length ? <Typography color="text.secondary">No scope metadata available.</Typography> : null}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={submitCreate} disabled={saving || !draft.name.trim()}>{saving ? "Creating…" : "Create agent"}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}