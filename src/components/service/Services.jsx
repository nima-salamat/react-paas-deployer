// ServicesListMui.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Grid,
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Chip,
  Stack,
  Snackbar,
  Alert,
  useTheme,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import AddIcon from "@mui/icons-material/Add";
import apiRequest from "../customHooks/apiRequest";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://127.0.0.1:8000";
const PLANS_API = `${API_BASE}/plans/`;
const PLATFORMS_API = `${API_BASE}/plans/platforms/`;
const NETWORK_API_ROOT = `${API_BASE}/services/networks/`;

export default function ServicesListMui({
  apiUrl = "/services/service/",
  pageSize = 10,
  showSearch = true,
  extraQueryParams = {},
  onOpen = null,
}) {
  const theme = useTheme();
  const navigate = useNavigate();

  // data states
  const [services, setServices] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [servicesFetchError, setServicesFetchError] = useState(null);

  // caches
  const [planCache, setPlanCache] = useState({});
  const [planCacheErrors, setPlanCacheErrors] = useState({});
  const [networkCache, setNetworkCache] = useState({});
  const [networkCacheErrors, setNetworkCacheErrors] = useState({});

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksFetchError, setNetworksFetchError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [editingService, setEditingService] = useState(null); // { service, selectedNetwork, selectedPlanId, creatingNetwork? }
  const [plansForPlatform, setPlansForPlatform] = useState({});
  const [plansForPlatformErrors, setPlansForPlatformErrors] = useState({});

  const [alertState, setAlertState] = useState(null);
  const fetchIdRef = useRef(0);

  const getKey = (s) => {
    if (!s) return "null";
    if (s.id !== undefined && s.id !== null) return String(s.id);
    if (s.pk !== undefined && s.pk !== null) return String(s.pk);
    return `${s.name || ""}|${(s.plan && s.plan.platform) || ""}`;
  };

  const uniqueBy = (arr, keyFn) => {
    const seen = new Set();
    return arr.filter((item) => {
      const k = keyFn(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const buildUrl = useCallback(
    (basePath, extra = {}) => {
      try {
        const isAbsolute = String(basePath).startsWith("http");
        const base = isAbsolute ? basePath : `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        const url = new URL(base);
        url.searchParams.set("page", String(page));
        url.searchParams.set("page_size", String(pageSize));
        if (query) url.searchParams.set("q_search", query);
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
        });
        return url.href;
      } catch {
        let base = `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        let qs = `page=${page}&page_size=${pageSize}`;
        if (query) qs += `&q_search=${encodeURIComponent(query)}`;
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });
        return base + (base.includes("?") ? "&" : "?") + qs;
      }
    },
    [page, pageSize, query]
  );

  // fetch services
  useEffect(() => {
    let mounted = true;
    const thisFetchId = ++fetchIdRef.current;
    setLoading(page === 1);
    setLoadingMore(page > 1);
    setServicesFetchError(null);

    (async () => {
      try {
        const url = buildUrl(apiUrl, extraQueryParams);
        const res = await apiRequest({ method: "GET", url });
        if (!mounted || fetchIdRef.current !== thisFetchId) return;

        const data = res.data;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

        setServices((prev) =>
          page === 1
            ? uniqueBy(results, getKey)
            : [...prev, ...results.filter((r) => !prev.some((p) => getKey(p) === getKey(r)))]
        );

        setHasNext(Boolean(data?.next));
      } catch (e) {
        if (!mounted) return;
        setServicesFetchError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to load services.");
        setServices([]);
        setHasNext(false);
      } finally {
        if (!mounted) return;
        setLoading(false);
        setLoadingMore(false);
      }
    })();

    return () => { mounted = false; };
  }, [page, apiUrl, buildUrl, JSON.stringify(extraQueryParams), query]);

  // fetch networks
  const fetchNetworks = useCallback(async () => {
    setNetworksLoading(true);
    setNetworksFetchError(null);
    try {
      const url = buildUrl(NETWORK_API_ROOT, { page_size: 100 });
      const res = await apiRequest({ method: "GET", url });
      const items = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setNetworks(items);
      const cache = {};
      items.forEach((n) => { cache[n.id ?? n.pk] = n; });
      setNetworkCache((prev) => ({ ...prev, ...cache }));
    } catch (e) {
      setNetworksFetchError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to load networks.");
    } finally {
      setNetworksLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => { fetchNetworks(); }, [fetchNetworks]);

  const loadPlan = useCallback(async (planId) => {
    if (!planId || planCache[planId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${PLANS_API}?id=${planId}` });
      setPlanCache((p) => ({ ...p, [planId]: res.data }));
    } catch (e) {
      setPlanCacheErrors((s) => ({ ...s, [planId]: e?.message || "Failed to load plan." }));
    }
  }, [planCache]);

  const loadNetwork = useCallback(async (networkId) => {
    if (!networkId || networkCache[networkId]) return;
    try {
      const res = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${networkId}/` });
      setNetworkCache((n) => ({ ...n, [networkId]: res.data }));
    } catch (e) {
      setNetworkCacheErrors((s) => ({ ...s, [networkId]: e?.message || "Failed to load network." }));
    }
  }, [networkCache]);

  const getServiceDetailUrl = (id) => `${API_BASE}${apiUrl.endsWith("/") ? apiUrl : apiUrl + "/"}${id}/`;

  const handleOpen = (svc) => {
    const id = svc.id ?? svc.pk;
    if (id) navigate(`/service/${id}`);
    else if (onOpen) onOpen(svc);
  };

  const updateService = async (serviceId, payload) => {
    setActionLoading(true);
    try {
      await apiRequest({ method: "PATCH", url: getServiceDetailUrl(serviceId), data: payload });
      setServices((prev) =>
        prev.map((s) => (String(s.id ?? s.pk) === String(serviceId) ? { ...s, ...payload } : s))
      );
      setAlertState({ severity: "success", message: "Saved successfully." });
      setTimeout(() => setAlertState(null), 2000);
      return true;
    } catch (e) {
      setAlertState({ severity: "error", message: e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to save." });
      setTimeout(() => setAlertState(null), 3000);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const deleteService = async (serviceId) => {
    if (!window.confirm("Are you sure you want to delete this service?")) return;
    setActionLoading(true);
    try {
      await apiRequest({ method: "DELETE", url: getServiceDetailUrl(serviceId) });
      setServices((prev) => prev.filter((s) => String(s.id ?? s.pk) !== String(serviceId)));
      setAlertState({ severity: "success", message: "Service deleted." });
      setTimeout(() => setAlertState(null), 2000);
    } catch (e) {
      setAlertState({ severity: "error", message: e?.message || "Failed to delete." });
      setTimeout(() => setAlertState(null), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  const fetchPlansForPlatform = async (platform) => {
    if (!platform || plansForPlatform[platform]) return plansForPlatform[platform] || [];
    try {
      const res = await apiRequest({ method: "POST", url: PLATFORMS_API, data: { platform } });
      const plans = res.data || [];
      setPlansForPlatform((p) => ({ ...p, [platform]: plans }));
      return plans;
    } catch (e) {
      setPlansForPlatformErrors((s) => ({ ...s, [platform]: e?.message || "Failed to load plans." }));
      return [];
    }
  };

  const createNetworkInline = async ({ name }) => {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    try {
      const res = await apiRequest({ method: "POST", url: NETWORK_API_ROOT, data: { name: trimmed } });
      await fetchNetworks();
      setAlertState({ severity: "success", message: "Network created." });
      setTimeout(() => setAlertState(null), 2000);
      return res.data;
    } catch {
      setAlertState({ severity: "error", message: "Failed to create network." });
      setTimeout(() => setAlertState(null), 3000);
      return null;
    }
  };

  const deleteNetwork = async (networkId) => {
    if (!window.confirm("Delete this network?")) return false;
    try {
      await apiRequest({ method: "DELETE", url: `${NETWORK_API_ROOT}${networkId}/` });
      await fetchNetworks();
      setServices((prev) =>
        prev.map((s) => {
          const nid = s.network?.id ?? s.network?.pk ?? s.network;
          return String(nid) === String(networkId) ? { ...s, network: null } : s;
        })
      );
      setAlertState({ severity: "success", message: "Network deleted." });
      setTimeout(() => setAlertState(null), 2000);
      return true;
    } catch {
      setAlertState({ severity: "error", message: "Failed to delete network." });
      setTimeout(() => setAlertState(null), 3000);
      return false;
    }
  };

  const retryAll = () => {
    setServicesFetchError(null);
    setNetworksFetchError(null);
    fetchNetworks();
    setPage(1);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" mb={2}>My Services</Typography>

      {showSearch && (
        <Box component="form" onSubmit={(e) => { e.preventDefault(); setPage(1); }} mb={3}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search service name..."
            />
            <Button variant="contained" type="submit">Search</Button>
          </Box>
        </Box>
      )}

      {alertState && (
        <Snackbar open autoHideDuration={3000} onClose={() => setAlertState(null)}>
          <Alert severity={alertState.severity} onClose={() => setAlertState(null)}>
            {alertState.message}
          </Alert>
        </Snackbar>
      )}

      {loading && <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>}

      {servicesFetchError && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography color="error">{servicesFetchError}</Typography>
          <Button variant="contained" onClick={retryAll} sx={{ mt: 2 }}>Retry</Button>
        </Paper>
      )}

      {!loading && !servicesFetchError && (
        <Grid container spacing={3}>
          {services.map((s) => {
            const planIsObj = s.plan && typeof s.plan === "object";
            const netIsObj = s.network && typeof s.network === "object";
            const planId = planIsObj ? (s.plan.id ?? s.plan.pk) : s.plan;
            const networkId = netIsObj ? (s.network.id ?? s.network.pk) : s.network;

            if (planId && !planCache[planId]) loadPlan(planId);
            if (networkId && !networkCache[networkId]) loadNetwork(networkId);

            const planPlatform = planIsObj ? (s.plan.platform ?? s.plan.name) : (planCache[planId]?.platform ?? planCache[planId]?.name ?? "—");
            const networkName = netIsObj ? s.network.name : networkCache[networkId]?.name ?? "—";

            const cpu = planIsObj ? s.plan.max_cpu : planCache[planId]?.max_cpu;
            const ram = planIsObj ? s.plan.max_ram : planCache[planId]?.max_ram;
            const storage = planIsObj ? s.plan.max_storage : planCache[planId]?.max_storage;
            const price = planIsObj ? s.plan.price_per_hour : planCache[planId]?.price_per_hour;

            return (
              <Grid item xs={12} md={6} lg={4} key={getKey(s)}>
                <Card elevation={3} sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{s.name || "(no name)"}</Typography>
                        <Typography variant="body2" color="text.secondary">{networkName}</Typography>
                      </Box>
                      <Chip label={s.status ?? "unknown"} color={s.status === "running" ? "success" : "default"} size="small" />
                    </Box>

                    <Box sx={{ mt: 2 }}>
                      {cpu && <Typography variant="body2">CPU: <strong>{cpu}</strong> cores</Typography>}
                      {ram && <Typography variant="body2">RAM: <strong>{ram}</strong> MB</Typography>}
                      {storage && <Typography variant="body2">Storage: <strong>{storage}</strong> GB</Typography>}
                      {price && <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>Price/hr: <strong>{price}</strong> toman</Typography>}
                    </Box>
                  </CardContent>

                  <Box sx={{ p: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingService({
                          service: s,
                          selectedNetwork: networkId ?? null,
                          selectedPlanId: planId ?? null,
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={(e) => { e.stopPropagation(); deleteService(s.id ?? s.pk); }}
                    >
                      Delete
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<LaunchIcon />}
                      onClick={(e) => { e.stopPropagation(); handleOpen(s); }}
                    >
                      Open
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {hasNext && (
        <Box sx={{ textAlign: "center", mt: 4 }}>
          <Button variant="contained" onClick={() => setPage((p) => p + 1)} disabled={loadingMore}>
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </Box>
      )}

      {/* ==================== EDIT DIALOG ==================== */}
      <Dialog
        open={Boolean(editingService)}
        onClose={() => setEditingService(null)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Edit Service — {editingService?.service?.name}
          <IconButton onClick={() => setEditingService(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {editingService && (
            <EditorInside
              editingService={editingService}
              setEditingService={setEditingService}
              networks={networks}
              networksLoading={networksLoading}
              networksFetchError={networksFetchError}
              retryNetworks={fetchNetworks}
              createNetworkInline={createNetworkInline}
              deleteNetwork={deleteNetwork}
              fetchPlansForPlatform={fetchPlansForPlatform}
              plansForPlatform={plansForPlatform}
              plansForPlatformErrors={plansForPlatformErrors}
              loadPlan={loadPlan}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setEditingService(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={actionLoading}
            onClick={async () => {
              const svc = editingService.service;
              const payload = {};

              // Network change
              const originalNet = svc.network ? (svc.network.id ?? svc.network.pk ?? svc.network) : null;
              if ((editingService.selectedNetwork ?? null) !== (originalNet ?? null)) {
                payload.network = editingService.selectedNetwork ?? null;
              }

              // Plan change
              const originalPlan = svc.plan ? (svc.plan.id ?? svc.plan.pk ?? svc.plan) : null;
              if (editingService.selectedPlanId && String(editingService.selectedPlanId) !== String(originalPlan)) {
                payload.plan = editingService.selectedPlanId;
              }

              if (Object.keys(payload).length === 0) {
                setEditingService(null);
                return;
              }

              const ok = await updateService(svc.id ?? svc.pk, payload);
              if (ok) setEditingService(null);
            }}
          >
            {actionLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

/* ====================== EditorInside ====================== */
function EditorInside({
  editingService,
  setEditingService,
  networks,
  networksLoading,
  networksFetchError,
  retryNetworks,
  createNetworkInline,
  deleteNetwork,
  fetchPlansForPlatform,
  plansForPlatform,
  plansForPlatformErrors,
  loadPlan,
}) {
  const svc = editingService.service;
  const platform = svc.plan && typeof svc.plan === "object"
    ? (svc.plan.platform ?? svc.plan.name)
    : svc.platform;

  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  useEffect(() => {
    if (!platform) {
      setAvailablePlans([]);
      return;
    }
    (async () => {
      setPlansLoading(true);
      const plans = await fetchPlansForPlatform(platform);
      setAvailablePlans(plans.filter((p) => !p.platform || String(p.platform) === String(platform)));
      setPlansLoading(false);
    })();
  }, [platform, fetchPlansForPlatform]);

  const onPickPlan = (planId) => {
    setEditingService((es) => ({ ...es, selectedPlanId: planId }));
    loadPlan(planId);
  };

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 340px" }, gap: 3 }}>
      {/* Left Column - Network & Plans */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>Network</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Select
            fullWidth
            size="small"
            value={editingService.selectedNetwork ?? ""}
            onChange={(e) => setEditingService((es) => ({ ...es, selectedNetwork: e.target.value || null }))}
          >
            <MenuItem value="">(No Network)</MenuItem>
            {networks.map((n) => (
              <MenuItem key={n.id ?? n.pk} value={n.id ?? n.pk}>
                {n.name}
              </MenuItem>
            ))}
          </Select>

          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setEditingService((es) => ({ ...es, creatingNetwork: { name: "" } }))}
          >
            Create
          </Button>

          {editingService.selectedNetwork && (
            <Button
              variant="outlined"
              color="error"
              onClick={async () => {
                await deleteNetwork(editingService.selectedNetwork);
                setEditingService((es) => ({ ...es, selectedNetwork: null }));
              }}
            >
              Delete
            </Button>
          )}
        </Box>

        {/* Create new network inline */}
        {editingService.creatingNetwork && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography fontWeight={700} gutterBottom>Network Name</Typography>
            <TextField
              fullWidth
              size="small"
              autoFocus
              value={editingService.creatingNetwork.name}
              onChange={(e) =>
                setEditingService((es) => ({
                  ...es,
                  creatingNetwork: { name: e.target.value },
                }))
              }
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                size="small"
                onClick={() => setEditingService((es) => {
                  const copy = { ...es };
                  delete copy.creatingNetwork;
                  return copy;
                })}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={async () => {
                  const created = await createNetworkInline(editingService.creatingNetwork);
                  if (created) {
                    const nid = created.id ?? created.pk;
                    setEditingService((es) => ({ ...es, selectedNetwork: nid, creatingNetwork: undefined }));
                  }
                }}
              >
                Create
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Plans */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Plans for {platform || "this service"}
          </Typography>

          {plansLoading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              {plansForPlatformErrors[platform] && (
                <Alert severity="error" action={<Button size="small" onClick={() => fetchPlansForPlatform(platform)}>Retry</Button>}>
                  {plansForPlatformErrors[platform]}
                </Alert>
              )}

              <Grid container spacing={1.5} sx={{ mt: 1 }}>
                {availablePlans.length === 0 ? (
                  <Typography color="text.secondary">No plans available</Typography>
                ) : (
                  availablePlans.map((p) => {
                    const pid = p.id ?? p.pk;
                    const isSelected = String(editingService.selectedPlanId ?? "") === String(pid);
                    return (
                      <Grid item xs={12} sm={6} key={pid}>
                        <Paper
                          variant="outlined"
                          onClick={() => onPickPlan(pid)}
                          sx={{
                            p: 2,
                            cursor: "pointer",
                            border: isSelected ? "2px solid" : "1px solid",
                            borderColor: isSelected ? "primary.main" : "divider",
                            bgcolor: isSelected ? "action.selected" : "background.paper",
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography fontWeight={700}>{p.name}</Typography>
                            <Typography variant="body2">{p.price_per_hour} /hr</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {p.max_cpu} CPU • {p.max_ram} MB • {p.max_storage} GB
                          </Typography>
                          {isSelected && <Chip label="Selected" color="success" size="small" sx={{ mt: 1 }} />}
                        </Paper>
                      </Grid>
                    );
                  })
                )}
              </Grid>
            </>
          )}
        </Box>
      </Box>

      {/* Right Column - Overview */}
      <Box>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>Service Overview</Typography>
          <Typography sx={{ mt: 2 }}><strong>Status:</strong> {svc.status}</Typography>
          <Typography><strong>Network:</strong> {svc.network?.name ?? svc.network ?? "(none)"}</Typography>
          <Typography><strong>Plan:</strong> {svc.plan?.name ?? svc.plan ?? "(none)"}</Typography>
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>All Networks</Typography>
            {networksFetchError && <Button size="small" onClick={retryNetworks}>Retry</Button>}
          </Box>
          {networksLoading ? (
            <CircularProgress size={20} />
          ) : networks.length === 0 ? (
            <Typography>No networks yet</Typography>
          ) : (
            networks.map((n) => (
              <Typography key={n.id ?? n.pk} sx={{ py: 0.5 }}>{n.name}</Typography>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}