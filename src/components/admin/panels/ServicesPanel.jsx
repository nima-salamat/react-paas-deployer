import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Avatar, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, IconButton, InputAdornment, MenuItem,
  Pagination, Stack, TextField, Tooltip, Typography, alpha, useMediaQuery,
  useTheme,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import apiRequest from "../../customHooks/apiRequest";
import { svcApi, deployApi, hasAnyRule, resolveThemeColor } from "../adminUtils";
import { useToast } from "../components/ToastContext";
import ServiceAdminDrawer from "../components/ServiceAdminDrawer";
import {
  DRY_BORDER, DRY_BORDER_LIGHT, DryPanel, DryTh, DryTd, DryCreateButton,
} from "../components/DryTable";

const STATUS_COLOR = {
  running: "success",
  failed: "error",
  stopped: "default",
  queued: "warning",
  deploying: "info",
  stopping: "warning",
  pending: "info",
  succeeded: "success",
};

function statusColor(s) {
  return STATUS_COLOR[String(s || "").toLowerCase()] || "default";
}

/**
 * ServicesPanel — admin inspector for any user's services.
 *
 * Hard-edge styling (no border-radius anywhere). All tables use the shared
 * DryTable primitives so the look matches TablesPanel / PlansPanel / etc.
 *
 * Create-row capability:
 *   - "Create service" button opens a dialog form (POST /admin/services/).
 *   - Backend AdminServiceViewSet.create requires user_id + name + plan
 *     (network optional). The form loads plans + the owner's networks.
 */
export default function ServicesPanel({ setToast: setToastProp }) {
  const pushToast = useToast();
  const setToast = setToastProp || pushToast;
  const SVC_API = svcApi();
  const DEPLOY_API = deployApi();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  const canManage = hasAnyRule("services.manage") || hasAnyRule("services.delete");

  const [svcList, setSvcList] = useState([]);
  const [svcPage, setSvcPage] = useState(1);
  const [svcCount, setSvcCount] = useState(0);
  const [svcSearch, setSvcSearch] = useState("");
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcActionBusy, setSvcActionBusy] = useState(null);
  const [svcDetail, setSvcDetail] = useState(null);
  const [svcVolumes, setSvcVolumes] = useState([]);
  const [svcDeploys, setSvcDeploys] = useState([]);
  const [svcNetworks, setSvcNetworks] = useState([]);
  const [detailTab, setDetailTab] = useState("overview");

  // Create-service dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createOwner, setCreateOwner] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPlan, setCreatePlan] = useState("");
  const [createNetwork, setCreateNetwork] = useState("");
  const [planOptions, setPlanOptions] = useState([]);
  const [ownerNetworks, setOwnerNetworks] = useState([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerOptions, setOwnerOptions] = useState([]);

  const loadServices = useCallback(async () => {
    setSvcLoading(true);
    try {
      const params = { page: svcPage, page_size: 20 };
      if (svcSearch) params.q_search = svcSearch;
      const res = await apiRequest({ method: "GET", url: `${SVC_API}/admin/services/`, params });
      const data = res.data || {};
      setSvcList(data.results || data.data || []);
      setSvcCount(typeof data.count === "number" ? data.count : (data.results || []).length);
    } catch (e) {
      setSvcList([]);
      setSvcCount(0);
      setToast?.(e?.response?.data?.detail || "Failed to load services");
    } finally {
      setSvcLoading(false);
    }
  }, [SVC_API, svcPage, svcSearch, setToast]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const openSvcDetail = async (svc) => {
    setSvcDetail(svc);
    setDetailTab("overview");
    const ownerId = svc.user_info?.id || svc.user;
    try {
      const res = await apiRequest({ method: "GET", url: `${SVC_API}/admin/volumes/`, params: { service: svc.id } });
      setSvcVolumes((res.data || {}).results || res.data?.data || []);
    } catch { setSvcVolumes([]); }
    try {
      const res = await apiRequest({ method: "GET", url: `${DEPLOY_API}/`, params: { service_id: svc.id, page_size: 50 } });
      setSvcDeploys((res.data || {}).results || res.data?.data || []);
    } catch { setSvcDeploys([]); }
    try {
      const res = await apiRequest({
        method: "GET", url: `${SVC_API}/admin/networks/`,
        params: ownerId ? { user_id: ownerId } : {},
      });
      setSvcNetworks((res.data || {}).results || res.data?.data || []);
    } catch { setSvcNetworks([]); }
  };

  const svcAction = async (action, serviceId) => {
    if (!canManage && action !== "delete") return;
    if (action === "delete" && !hasAnyRule("services.delete") && !hasAnyRule("services.manage")) return;
    setSvcActionBusy(`${action}-${serviceId}`);
    try {
      if (action === "start") {
        await apiRequest({ method: "POST", url: `${SVC_API}/admin/start_service/`, data: { service_id: serviceId } });
        setToast?.("Start queued");
      } else if (action === "stop") {
        await apiRequest({ method: "POST", url: `${SVC_API}/admin/stop_service/`, data: { service_id: serviceId } });
        setToast?.("Stop queued");
      } else if (action === "restart") {
        await apiRequest({ method: "POST", url: `${SVC_API}/admin/stop_service/`, data: { service_id: serviceId } });
        setTimeout(async () => {
          try { await apiRequest({ method: "POST", url: `${SVC_API}/admin/start_service/`, data: { service_id: serviceId } }); } catch { /* */ }
        }, 2500);
        setToast?.("Restart queued");
      } else if (action === "purge") {
        await apiRequest({ method: "POST", url: `${SVC_API}/admin/purge_service_runtime/`, data: { service_id: serviceId } });
        setToast?.("Runtime purged");
      } else if (action === "delete") {
        if (!window.confirm("Delete this service? Its runtime will be purged first.")) return;
        await apiRequest({ method: "DELETE", url: `${SVC_API}/admin/services/${serviceId}/` });
        setToast?.("Service deleted");
        setSvcDetail(null);
      }
      await loadServices();
      if (svcDetail && String(svcDetail.id) === String(serviceId) && action !== "delete") {
        openSvcDetail(svcDetail);
      }
    } catch (e) {
      setToast?.(e?.response?.data?.detail || "Action failed");
    } finally {
      setSvcActionBusy(null);
    }
  };

  // ─── Create-service dialog helpers ──────────────────────────────────────
  const loadPlans = useCallback(async () => {
    try {
      const res = await apiRequest({ method: "GET", url: `${svcApi().replace("/services", "")}/plans/admin/plans/?page_size=200` });
      const d = res.data || {};
      const list = d.results || d.data || d || [];
      setPlanOptions(Array.isArray(list) ? list : []);
    } catch {
      setPlanOptions([]);
    }
  }, []);

  const searchOwners = useCallback(async (q) => {
    if (!q || q.length < 2) { setOwnerOptions([]); return; }
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${svcApi().replace("/services", "")}/api/users/admin/users/?q=${encodeURIComponent(q)}&page_size=20`,
      });
      const d = res.data || {};
      const list = d.results || d.data || d.users || [];
      setOwnerOptions(Array.isArray(list) ? list : []);
    } catch {
      setOwnerOptions([]);
    }
  }, []);

  const loadOwnerNetworks = useCallback(async (userId) => {
    if (!userId) { setOwnerNetworks([]); return; }
    try {
      const res = await apiRequest({
        method: "GET", url: `${SVC_API}/admin/networks/`,
        params: { user_id: userId, page_size: 100 },
      });
      const d = res.data || {};
      setOwnerNetworks(d.results || d.data || []);
    } catch {
      setOwnerNetworks([]);
    }
  }, [SVC_API]);

  const openCreateDialog = () => {
    setCreateOpen(true);
    setCreateOwner("");
    setCreateName("");
    setCreatePlan("");
    setCreateNetwork("");
    setOwnerSearch("");
    setOwnerOptions([]);
    setOwnerNetworks([]);
    if (!planOptions.length) loadPlans();
  };

  const onOwnerPick = (userId) => {
    setCreateOwner(userId);
    setCreateNetwork("");
    loadOwnerNetworks(userId);
  };

  const submitCreate = async () => {
    const name = (createName || "").trim();
    if (!createOwner) { setToast("Select an owner first"); return; }
    if (!name || name.length > 30) { setToast("Name is required (≤ 30 chars)"); return; }
    if (!createPlan) { setToast("Select a plan"); return; }
    setCreateBusy(true);
    try {
      await apiRequest({
        method: "POST",
        url: `${SVC_API}/admin/services/`,
        data: {
          user_id: createOwner,
          name,
          plan: createPlan,
          network: createNetwork || null,
        },
      });
      setToast(`Service "${name}" created`);
      setCreateOpen(false);
      setSvcPage(1);
      await loadServices();
    } catch (e) {
      const d = e?.response?.data;
      setToast(d?.error || d?.detail || (d?.errors && JSON.stringify(d.errors)) || "Create service failed");
    } finally {
      setCreateBusy(false);
    }
  };

  const stats = useMemo(() => {
    const counts = { running: 0, failed: 0, other: 0 };
    svcList.forEach((s) => {
      const st = String(s.status || "").toLowerCase();
      if (st === "running") counts.running++;
      else if (st === "failed") counts.failed++;
      else counts.other++;
    });
    return { ...counts, total: svcCount };
  }, [svcList, svcCount]);

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1.5}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Services</Typography>
          <Typography variant="body2" color="text.secondary">
            Inspect and operate any user's service. {canManage ? "You can create, start, stop, purge, and delete." : "Read-only — no services.manage rule."}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          {canManage && (
            <DryCreateButton onClick={openCreateDialog} startIcon={<AddIcon />}>
              Create service
            </DryCreateButton>
          )}
          <Button startIcon={<RefreshIcon />} onClick={loadServices} disabled={svcLoading}
            variant="outlined" sx={{ borderRadius: 0, textTransform: "none" }}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Stats — hard edge */}
      <Grid container spacing={2}>
        {[
          ["Total", stats.total, "primary.main"],
          ["Running", stats.running, "success.main"],
          ["Failed", stats.failed, "error.main"],
          ["Other", stats.other, "text.secondary"],
        ].map(([label, val, color]) => (
          <Grid key={label} size={{ xs: 6, sm: 3 }}>
            <DryPanel sx={{ p: 1.75, borderColor: alpha(resolveThemeColor(theme, color), 0.25) }}>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, lineHeight: 1 }}>
                {label}
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ color: color || "text.primary" }}>
                {val ?? "—"}
              </Typography>
            </DryPanel>
          </Grid>
        ))}
      </Grid>

      {/* Search — hard edge */}
      <DryPanel sx={{ p: 2 }}>
        <TextField
          size="small"
          placeholder="Search by service name or owner username…"
          value={svcSearch}
          onChange={(e) => { setSvcSearch(e.target.value); setSvcPage(1); }}
          fullWidth
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
        />
      </DryPanel>

      {/* Table — hard edge */}
      <DryPanel sx={{ overflow: "hidden" }}>
        {svcLoading && !svcList.length ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : isDesktop ? (
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                <tr>
                  <DryTh>Service</DryTh>
                  <DryTh>Owner</DryTh>
                  <DryTh>Status</DryTh>
                  <DryTh align="right">Actions</DryTh>
                </tr>
              </Box>
              <tbody>
                {svcList.map((s) => (
                  <tr
                    key={s.id}
                    style={{ borderTop: DRY_BORDER_LIGHT, cursor: "pointer" }}
                    onClick={() => openSvcDetail(s)}
                  >
                    <DryTd>
                      <Stack direction="row" alignItems="center" gap={1.25}>
                        <Avatar variant="square" sx={{
                          width: 30, height: 30,
                          bgcolor: alpha(theme.palette.primary.main, 0.10),
                          color: "primary.main", fontWeight: 700,
                          borderRadius: 0,
                        }}>
                          {(s.name || "?").charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700} fontSize={13}>{s.name}</Typography>
                          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                            {String(s.id).slice(0, 8)}…
                          </Typography>
                        </Box>
                      </Stack>
                    </DryTd>
                    <DryTd>
                      {s.user_info?.username || s.user_username || s.user || "—"}
                    </DryTd>
                    <DryTd>
                      <Chip
                        size="small"
                        label={s.status || "—"}
                        color={statusColor(s.status)}
                        variant={s.status === "running" ? "filled" : "outlined"}
                        sx={{ height: 20, fontSize: 10, fontWeight: 600, borderRadius: 0 }}
                      />
                    </DryTd>
                    <DryTd align="right" onClick={(e) => e.stopPropagation()}>
                      <Stack direction="row" spacing={0.25} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                        {canManage && (
                          <>
                            <Tooltip title="Start">
                              <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("start", s.id)}>
                                <PlayArrowIcon fontSize="small" color="success" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Stop">
                              <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("stop", s.id)}>
                                <StopIcon fontSize="small" color="error" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Restart">
                              <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("restart", s.id)}>
                                <RestartAltIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Purge runtime">
                              <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("purge", s.id)}>
                                <CleaningServicesIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip title="Open detail">
                          <IconButton size="small" onClick={() => openSvcDetail(s)}>
                            <CloudUploadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {canManage && (
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" disabled={!!svcActionBusy} onClick={() => svcAction("delete", s.id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </DryTd>
                  </tr>
                ))}
                {!svcList.length && (
                  <tr>
                    <DryTd colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No services found</Typography>
                    </DryTd>
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>
        ) : (
          /* Mobile / tablet — square cards instead of rounded */
          <Stack spacing={1} divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />} sx={{ p: 1.5 }}>
            {svcList.map((s) => (
              <Box key={s.id} sx={{ border: DRY_BORDER_LIGHT, p: 1.25, borderRadius: 0, cursor: "pointer" }}
                onClick={() => openSvcDetail(s)}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize={13} noWrap>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {s.user_info?.username || s.user_username || s.user || "—"}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={s.status || "—"}
                    color={statusColor(s.status)}
                    variant={s.status === "running" ? "filled" : "outlined"}
                    sx={{ height: 20, fontSize: 10, fontWeight: 600, borderRadius: 0 }}
                  />
                </Stack>
                {canManage && (
                  <Stack direction="row" spacing={0.5} mt={1.5} flexWrap="wrap" useFlexGap onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("start", s.id)}><PlayArrowIcon fontSize="small" color="success" /></IconButton>
                    <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("stop", s.id)}><StopIcon fontSize="small" color="error" /></IconButton>
                    <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("restart", s.id)}><RestartAltIcon fontSize="small" /></IconButton>
                    <IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("purge", s.id)}><CleaningServicesIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" disabled={!!svcActionBusy} onClick={() => svcAction("delete", s.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Stack>
                )}
              </Box>
            ))}
            {!svcList.length && (
              <Typography color="text.secondary" align="center" py={4}>No services found</Typography>
            )}
          </Stack>
        )}
        {svcCount > 20 && (
          <Box display="flex" justifyContent="center" p={2} sx={{ borderTop: DRY_BORDER_LIGHT }}>
            <Pagination page={svcPage} count={Math.ceil(svcCount / 20)} onChange={(_, v) => setSvcPage(v)} color="primary" />
          </Box>
        )}
      </DryPanel>

      <ServiceAdminDrawer
        svcDetail={svcDetail}
        onClose={() => setSvcDetail(null)}
        svcDeploys={svcDeploys}
        svcVolumes={svcVolumes}
        svcNetworks={svcNetworks}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        onAction={svcAction}
        onRefresh={() => svcDetail && openSvcDetail(svcDetail)}
        setToast={setToast}
        canManage={canManage}
      />

      {/* Create service dialog — hard edge */}
      <Dialog open={createOpen} onClose={() => !createBusy && setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>Create service for a user</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField
              size="small"
              label="Search owner by username / email"
              value={ownerSearch}
              onChange={(e) => { setOwnerSearch(e.target.value); searchOwners(e.target.value); }}
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
            />
            {ownerOptions.length > 0 && (
              <Box sx={{ border: DRY_BORDER_LIGHT, maxHeight: 160, overflowY: "auto", borderRadius: 0 }}>
                {ownerOptions.map((u) => (
                  <Box
                    key={u.id}
                    onClick={() => { onOwnerPick(u.id); setOwnerSearch(u.username || u.email || ""); setOwnerOptions([]); }}
                    sx={{
                      px: 1.5, py: 1, cursor: "pointer",
                      borderBottom: DRY_BORDER_LIGHT,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>{u.username}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {createOwner && (
              <Typography variant="caption" color="text.secondary">
                Owner ID: <code>{createOwner}</code>
              </Typography>
            )}
            <TextField
              size="small"
              label="Service name (unique, ≤ 30 chars)"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              fullWidth
              inputProps={{ maxLength: 30 }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
            />
            <TextField
              size="small"
              select
              label="Plan"
              value={createPlan}
              onChange={(e) => setCreatePlan(e.target.value)}
              fullWidth
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
            >
              <MenuItem value=""><em>— select plan —</em></MenuItem>
              {planOptions.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name} · {p.platform} · {p.type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              select
              label="Network (optional)"
              value={createNetwork}
              onChange={(e) => setCreateNetwork(e.target.value)}
              fullWidth
              disabled={!ownerNetworks.length}
              helperText={!ownerNetworks.length ? "Owner has no networks yet — service will be created without one." : ""}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
            >
              <MenuItem value=""><em>— none —</em></MenuItem>
              {ownerNetworks.map((n) => (
                <MenuItem key={n.id} value={n.id}>{n.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={createBusy}
            sx={{ borderRadius: 0, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={submitCreate}
            disabled={createBusy || !createOwner || !createName.trim() || !createPlan}
            sx={{ borderRadius: 0, textTransform: "none", fontWeight: 700 }}>
            {createBusy ? "Creating…" : "Create service"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
