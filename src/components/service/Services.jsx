/**
 * Services list page — modular entry.
 * Submodules live in ./services/
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import apiRequest from "../customHooks/apiRequest";

import ServiceItem from "./services/ServiceItem";
import ServiceEditDialog from "./services/ServiceEditDialog";
import ServicesToolbar from "./services/ServicesToolbar";
import {
  API_BASE,
  NETWORK_API_ROOT,
  VOLUME_API_ROOT,
  PLANS_API,
  SERVICE_ACTION_ROOT,
  SERVICE_API,
  getKey,
  friendlyError,
  extractList,
  buildUrl,
  resolveServiceKind,
  volumesAttachedToService,
  sameListById,
  clampPct,
} from "./services/helpers";

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item != null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const setValue = useCallback(
    (value) => {
      setStoredValue((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [key]
  );
  return [storedValue, setValue];
}

export default function ServicesListMui({
  apiUrl = "/services/service/",
  pageSize = 10,
  showSearch = true,
  extraQueryParams = {},
  onOpen = null,
}) {
  const navigate = useNavigate();

  const extraQueryParamsStr = JSON.stringify(extraQueryParams);

  const [viewMode, setViewMode] = useLocalStorage("services_view_mode", "cards");
  const [autoRefresh, setAutoRefresh] = useLocalStorage(
    "services_auto_refresh",
    false
  );
  const [refreshInterval, setRefreshInterval] = useLocalStorage(
    "services_refresh_interval",
    5000
  );

  const [services, setServices] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [servicesFetchError, setServicesFetchError] = useState(null);

  const [planCache, setPlanCache] = useState({});
  const [networkCache, setNetworkCache] = useState({});
  const [statusMap, setStatusMap] = useState({});

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksFetchError, setNetworksFetchError] = useState(null);
  const [volumes, setVolumes] = useState([]);
  const [volumesLoading, setVolumesLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [plansForPlatform, setPlansForPlatform] = useState({});
  const [plansForPlatformErrors, setPlansForPlatformErrors] = useState({});
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [alertState, setAlertState] = useState(null);

  const mountedRef = useRef(true);
  const editingOpenRef = useRef(false);
  const plansForPlatformRef = useRef({});
  const volumesRef = useRef([]);
  const servicesRef = useRef([]);
  const statusBusyRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    editingOpenRef.current = Boolean(editingDraft);
  }, [editingDraft]);
  useEffect(() => {
    plansForPlatformRef.current = plansForPlatform;
  }, [plansForPlatform]);
  useEffect(() => {
    volumesRef.current = volumes;
  }, [volumes]);
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  const showAlert = useCallback((severity, message) => {
    setAlertState({ severity, message });
  }, []);

  const handleAuthError = useCallback(
    (e) => {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        showAlert("error", "Not authenticated. Redirecting…");
        setAutoRefresh(false);
        setTimeout(() => {
          if (mountedRef.current) navigate("/signin_or_signup");
        }, 800);
        return true;
      }
      return false;
    },
    [navigate, showAlert, setAutoRefresh]
  );

  // ─── Services list ───────────────────────────────────────────────────────

  const fetchServices = useCallback(
    async (isBackground = false) => {
      if (isBackground && editingOpenRef.current) return;

      if (!isBackground) {
        setLoading(page === 1);
        setLoadingMore(page > 1);
        setServicesFetchError(null);
      }
      try {
        const targetPage = isBackground ? 1 : page;
        const targetPageSize = isBackground
          ? Math.max(page * pageSize, pageSize)
          : pageSize;
        
        const params = JSON.parse(extraQueryParamsStr);
        const url = buildUrl(
          apiUrl,
          params,
          targetPage,
          targetPageSize,
          query
        );
        const res = await apiRequest({ method: "GET", url });
        if (!mountedRef.current) return;

        const results = extractList(res.data);

        setServices((prev) => {
          if (isBackground) {
            // Soft merge by id — keep previous object refs when fields unchanged
            const byId = new Map(prev.map((s) => [getKey(s), s]));
            let changed = false;
            const merged = results.map((r) => {
              const key = getKey(r);
              const old = byId.get(key);
              if (
                old &&
                old.name === r.name &&
                old.status === r.status &&
                old.plan === r.plan &&
                old.network === r.network
              ) {
                return old;
              }
              changed = true;
              return old ? { ...old, ...r } : r;
            });
            if (!changed && merged.length === prev.length) return prev;
            return merged;
          }
          return page === 1
            ? results
            : [
                ...prev,
                ...results.filter(
                  (r) => !prev.some((p) => getKey(p) === getKey(r))
                ),
              ];
        });

        setPlanCache((prev) => {
          let next = prev;
          for (const s of results) {
            if (s.plan && typeof s.plan === "object") {
              const id = s.plan.id ?? s.plan.pk;
              if (id != null && !prev[id]) {
                if (next === prev) next = { ...prev };
                next[id] = s.plan;
              }
            }
          }
          return next;
        });
        setNetworkCache((prev) => {
          let next = prev;
          for (const s of results) {
            if (s.network && typeof s.network === "object") {
              const id = s.network.id ?? s.network.pk;
              if (id != null && !prev[id]) {
                if (next === prev) next = { ...prev };
                next[id] = s.network;
              }
            }
          }
          return next;
        });

        if (!isBackground) setHasNext(Boolean(res.data?.next));
      } catch (e) {
        if (!mountedRef.current) return;
        if (handleAuthError(e)) return;
        if (!isBackground) {
          if (e?.response?.status === 404) {
            setServices([]);
            setHasNext(false);
            setServicesFetchError(null);
          } else {
            setServicesFetchError(friendlyError(e, "Failed to load services."));
            if (page === 1) setServices([]);
            setHasNext(false);
          }
        }
      } finally {
        if (mountedRef.current && !isBackground) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [apiUrl, extraQueryParamsStr, page, pageSize, query, handleAuthError]
  );

  /** Live CPU/RAM via service_status (same API as ServiceDetail). */
  const fetchStatusBatch = useCallback(async () => {
    if (editingOpenRef.current || statusBusyRef.current) return;
    const list = servicesRef.current || [];
    if (!list.length) return;
    statusBusyRef.current = true;
    try {
      // Limit concurrent status checks to avoid hammering API
      const slice = list.slice(0, 12);
      const entries = await Promise.all(
        slice.map(async (s) => {
          const sid = s.id ?? s.pk;
          if (sid == null) return null;
          try {
            const res = await apiRequest({
              method: "POST",
              url: `${SERVICE_ACTION_ROOT}service_status/`,
              data: { service_id: sid },
            });
            if (res.status === 200 && res.data) {
              return [
                String(sid),
                {
                  running: Boolean(res.data.running),
                  cpu: clampPct(res.data.cpu),
                  ram: clampPct(res.data.ram),
                },
              ];
            }
          } catch {
            /* skip */
          }
          return null;
        })
      );
      if (!mountedRef.current) return;
      setStatusMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const entry of entries) {
          if (!entry) continue;
          const [id, val] = entry;
          const old = prev[id];
          if (
            !old ||
            old.cpu !== val.cpu ||
            old.ram !== val.ram ||
            old.running !== val.running
          ) {
            next[id] = val;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } finally {
      statusBusyRef.current = false;
    }
  }, []);

  // ─── Networks / volumes (mount-once, no page-coupled refresh) ────────────

  const fetchNetworks = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent);
      if (silent && editingOpenRef.current) return;
      if (!silent) {
        setNetworksLoading(true);
        setNetworksFetchError(null);
      }
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${NETWORK_API_ROOT}?page_size=100`,
        });
        if (!mountedRef.current) return;
        const items = extractList(res.data);
        setNetworks((prev) =>
          sameListById(prev, items) ? prev : items
        );
      } catch (e) {
        if (!mountedRef.current) return;
        if (handleAuthError(e)) return;
        if (e?.response?.status === 404) {
          setNetworksFetchError(null);
        } else if (!silent) {
          setNetworksFetchError(friendlyError(e, "Failed to load networks."));
        }
      } finally {
        if (mountedRef.current && !silent) setNetworksLoading(false);
      }
    },
    [handleAuthError]
  );

  const fetchVolumes = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent);
      if (silent && editingOpenRef.current) return;
      if (!silent) setVolumesLoading(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${VOLUME_API_ROOT}?page_size=100`,
        });
        if (!mountedRef.current) return;
        const items = extractList(res.data);
        setVolumes((prev) => (sameListById(prev, items) ? prev : items));
      } catch (e) {
        if (e?.response?.status !== 404) handleAuthError(e);
        if (mountedRef.current && !silent) setVolumes([]);
      } finally {
        if (mountedRef.current && !silent) setVolumesLoading(false);
      }
    },
    [handleAuthError]
  );

  useEffect(() => {
    fetchServices(false);
  }, [fetchServices]);

  useEffect(() => {
    fetchNetworks({ silent: false });
    fetchVolumes({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh services; status polled less often to avoid card blink
  useEffect(() => {
    if (!autoRefresh) return undefined;
    let statusTick = 0;
    const tick = async () => {
      if (editingOpenRef.current) return;
      await fetchServices(true);
      statusTick += 1;
      // status only every 2nd poll (or every poll if interval >= 10s)
      if (statusTick % 2 === 0 || Number(refreshInterval) >= 10000) {
        await fetchStatusBatch();
      }
    };
    const id = setInterval(
      tick,
      Math.max(3000, Number(refreshInterval) || 5000)
    );
    return () => clearInterval(id);
  }, [autoRefresh, refreshInterval, fetchServices, fetchStatusBatch]);

  // One status fetch after list first loads (not on every services change)
  const statusBootRef = useRef(false);
  useEffect(() => {
    if (statusBootRef.current) return;
    if (!services.length) return;
    statusBootRef.current = true;
    const t = setTimeout(() => {
      if (mountedRef.current && !editingOpenRef.current) fetchStatusBatch();
    }, 800);
    return () => clearTimeout(t);
  }, [services.length, fetchStatusBatch]);

  // ─── Plans for edit ──────────────────────────────────────────────────────

  const fetchPlansForPlatform = useCallback(
    async (platform) => {
      if (!platform) return [];
      if (plansForPlatformRef.current[platform]) {
        return plansForPlatformRef.current[platform];
      }
      try {
        let res;
        try {
          res = await apiRequest({
            method: "POST",
            url: `${PLANS_API}platforms/`,
            data: { platform },
          });
        } catch {
          res = await apiRequest({
            method: "GET",
            url: `${PLANS_API}?page_size=100`,
          });
        }
        let plans = extractList(res.data);
        if (!Array.isArray(plans)) {
          plans = Array.isArray(res.data) ? res.data : [];
        }
        plans = plans.filter(
          (p) =>
            !p.platform ||
            String(p.platform).toLowerCase() === String(platform).toLowerCase()
        );
        setPlansForPlatform((s) => {
          const next = { ...s, [platform]: plans };
          plansForPlatformRef.current = next;
          return next;
        });
        setPlansForPlatformErrors((s) => {
          const next = { ...s };
          delete next[platform];
          return next;
        });
        return plans;
      } catch (e) {
        if (e?.response?.status === 404) {
          setPlansForPlatform((s) => {
            const next = { ...s, [platform]: [] };
            plansForPlatformRef.current = next;
            return next;
          });
          return [];
        }
        handleAuthError(e);
        setPlansForPlatformErrors((s) => ({
          ...s,
          [platform]: friendlyError(e, "Failed to load plans."),
        }));
        return [];
      }
    },
    [handleAuthError]
  );

  // ─── Actions ─────────────────────────────────────────────────────────────

  const createNetworkInline = useCallback(
    async (name) => {
      try {
        const res = await apiRequest({
          method: "POST",
          url: NETWORK_API_ROOT,
          data: { name },
        });
        await fetchNetworks({ silent: false });
        showAlert("success", "Network created.");
        return res.data;
      } catch (e) {
        if (handleAuthError(e)) return null;
        showAlert("error", friendlyError(e, "Failed to create network."));
        return null;
      }
    },
    [fetchNetworks, handleAuthError, showAlert]
  );

  const updateService = async (serviceId, payload) => {
    setActionLoading(true);
    try {
      await apiRequest({
        method: "PATCH",
        url: `${SERVICE_API}${serviceId}/`,
        data: payload,
      });
      setServices((prev) =>
        prev.map((s) =>
          String(s.id ?? s.pk) === String(serviceId) ? { ...s, ...payload } : s
        )
      );
      return true;
    } catch (e) {
      if (handleAuthError(e)) return false;
      showAlert("error", friendlyError(e, "Failed to save."));
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleServiceStatus = useCallback(
    async (service, currentStatus) => {
      const serviceId = service.id ?? service.pk;
      const running = String(currentStatus || "").toLowerCase() === "running";
      const action = running ? "stop_service" : "start_service";

      setServices((prev) =>
        prev.map((s) =>
          String(s.id ?? s.pk) === String(serviceId)
            ? { ...s, status: "updating..." }
            : s
        )
      );

      try {
        await apiRequest({
          method: "POST",
          url: `${SERVICE_ACTION_ROOT}${action}/`,
          data: { service_id: serviceId },
        });
        setServices((prev) =>
          prev.map((s) =>
            String(s.id ?? s.pk) === String(serviceId)
              ? { ...s, status: running ? "stopping" : "queued" }
              : s
          )
        );
        showAlert("success", running ? "Stop requested." : "Start requested.");
        setTimeout(() => {
          if (mountedRef.current && !editingOpenRef.current) {
            fetchServices(true);
            fetchStatusBatch();
          }
        }, 2000);
      } catch (e) {
        if (handleAuthError(e)) return;
        setServices((prev) =>
          prev.map((s) =>
            String(s.id ?? s.pk) === String(serviceId)
              ? { ...s, status: currentStatus }
              : s
          )
        );
        showAlert("error", friendlyError(e, "Failed to change status."));
      }
    },
    [handleAuthError, showAlert, fetchServices, fetchStatusBatch]
  );

  const deleteService = useCallback(
    async (serviceId) => {
      if (!window.confirm("Delete this service?")) return;
      setActionLoading(true);
      try {
        await apiRequest({
          method: "DELETE",
          url: `${SERVICE_API}${serviceId}/`,
        });
        setServices((prev) =>
          prev.filter((s) => String(s.id ?? s.pk) !== String(serviceId))
        );
        showAlert("success", "Service deleted.");
      } catch (e) {
        if (handleAuthError(e)) return;
        showAlert("error", friendlyError(e, "Failed to delete."));
      } finally {
        setActionLoading(false);
      }
    },
    [handleAuthError, showAlert]
  );

  const handleOpen = useCallback(
    (s) => {
      if (typeof onOpen === "function") onOpen(s);
      else navigate(`/service/${s.id ?? s.pk}`);
    },
    [navigate, onOpen]
  );

  const handleEdit = useCallback((s) => {
    const planIsObj = s.plan && typeof s.plan === "object";
    const netIsObj = s.network && typeof s.network === "object";
    const planId = planIsObj ? s.plan.id ?? s.plan.pk : s.plan;
    const networkId = netIsObj ? s.network.id ?? s.network.pk : s.network;
    const attached = volumesAttachedToService(
      volumesRef.current,
      s.id ?? s.pk
    );
    setEditingDraft({
      service: s,
      selectedNetwork: networkId ?? null,
      selectedPlanId: planId ?? null,
      selectedVolumeIds: attached,
      initialVolumeIds: attached.slice(),
    });
  }, []);

  const closeEdit = () => setEditingDraft(null);

  const saveEdit = async () => {
    if (!editingDraft) return;
    const svc = editingDraft.service;
    const serviceId = svc.id ?? svc.pk;
    const payload = {};

    const originalNet = svc.network
      ? svc.network.id ?? svc.network.pk ?? svc.network
      : null;
    if ((editingDraft.selectedNetwork ?? null) !== (originalNet ?? null)) {
      payload.network = editingDraft.selectedNetwork ?? null;
    }

    const originalPlan = svc.plan
      ? svc.plan.id ?? svc.plan.pk ?? svc.plan
      : null;
    if (
      editingDraft.selectedPlanId &&
      String(editingDraft.selectedPlanId) !== String(originalPlan)
    ) {
      payload.plan = editingDraft.selectedPlanId;
    }

    let ok = true;
    if (Object.keys(payload).length > 0) {
      ok = await updateService(serviceId, payload);
    }

    const desired = new Set(
      (editingDraft.selectedVolumeIds || []).map(String)
    );
    const initial = new Set(
      (editingDraft.initialVolumeIds || []).map(String)
    );

    // Attach newly selected volumes (exclusive ownership via PATCH)
    for (const vid of desired) {
      if (!initial.has(vid)) {
        try {
          await apiRequest({
            method: "PATCH",
            url: `${VOLUME_API_ROOT}${vid}/`,
            data: { service: serviceId },
          });
        } catch (e) {
          const msg =
            e?.response?.data?.errors?.size_mb ||
            e?.response?.data?.error ||
            e?.response?.data?.detail ||
            "Failed to attach volume (quota or ownership).";
          showAlert(
            "error",
            typeof msg === "object" ? JSON.stringify(msg) : String(msg)
          );
          ok = false;
        }
      }
    }

    // Detach removed volumes
    for (const vid of initial) {
      if (!desired.has(vid)) {
        try {
          await apiRequest({
            method: "PATCH",
            url: `${VOLUME_API_ROOT}${vid}/`,
            data: { service: null },
          });
        } catch (e) {
          showAlert("error", "Failed to detach volume.");
          ok = false;
        }
      }
    }

    setEditingDraft(null);
    await fetchVolumes({ silent: false });
    if (ok) {
      showAlert("success", "Changes saved.");
      fetchServices(true);
    }
  };

  const filteredServices = useMemo(() => {
    if (kindFilter === "all") return services;
    return services.filter(
      (s) => resolveServiceKind(s, planCache) === kindFilter
    );
  }, [services, kindFilter, planCache]);

  const kindCounts = useMemo(() => {
    let app = 0;
    let db = 0;
    for (const s of services) {
      const k = resolveServiceKind(s, planCache);
      if (k === "db") db += 1;
      else if (k === "app") app += 1;
    }
    return { app, db, all: services.length };
  }, [services, planCache]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 } }}>
      <ServicesToolbar
        query={query}
        setQuery={setQuery}
        onSearch={() => {
          setPage(1);
          fetchServices(false);
        }}
        viewMode={viewMode}
        setViewMode={setViewMode}
        kindFilter={kindFilter}
        setKindFilter={setKindFilter}
        kindCounts={kindCounts}
        autoRefresh={autoRefresh}
        setAutoRefresh={setAutoRefresh}
        refreshInterval={refreshInterval}
        setRefreshInterval={setRefreshInterval}
        onRefresh={() => {
          setPage(1);
          fetchServices(false);
          fetchStatusBatch();
        }}
        refreshDisabled={loading || Boolean(editingDraft)}
        menuAnchorEl={menuAnchorEl}
        setMenuAnchorEl={setMenuAnchorEl}
        showSearch={showSearch}
      />

      <Snackbar
        open={Boolean(alertState)}
        autoHideDuration={3500}
        onClose={() => setAlertState(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={alertState?.severity || "info"}
          onClose={() => setAlertState(null)}
          sx={{ width: "100%", borderRadius: 1.5 }}
        >
          {alertState?.message}
        </Alert>
      </Snackbar>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {servicesFetchError && !loading && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
            {servicesFetchError}
          </Alert>
          <Button
            variant="contained"
            onClick={() => fetchServices(false)}
            sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
          >
            Retry
          </Button>
        </Paper>
      )}

      {!loading && !servicesFetchError && (
        <Box>
          {filteredServices.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                py: 6,
                textAlign: "center",
                borderRadius: 2.5,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography color="text.secondary">
                {services.length === 0
                  ? "No services found."
                  : "No services match this filter."}
              </Typography>
            </Paper>
          ) : viewMode === "rows" ? (
            <Stack>
              {filteredServices.map((s) => (
                <ServiceItem
                  key={getKey(s)}
                  s={s}
                  layout="row"
                  isReadOnly={false}
                  planCache={planCache}
                  networkCache={networkCache}
                  statusEntry={statusMap[getKey(s)] || null}
                  onToggleStatus={toggleServiceStatus}
                  onEdit={handleEdit}
                  onDelete={deleteService}
                  onOpen={handleOpen}
                />
              ))}
            </Stack>
          ) : (
            <Grid container spacing={2.5}>
              {filteredServices.map((s) => (
                <Grid item xs={12} sm={6} lg={4} key={getKey(s)}>
                  <ServiceItem
                    s={s}
                    layout="card"
                    isReadOnly={viewMode === "overview"}
                    planCache={planCache}
                    networkCache={networkCache}
                    statusEntry={statusMap[getKey(s)] || null}
                    onToggleStatus={toggleServiceStatus}
                    onEdit={handleEdit}
                    onDelete={deleteService}
                    onOpen={handleOpen}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {hasNext && !loading && (
        <Box sx={{ textAlign: "center", mt: 3.5 }}>
          <Button
            variant="contained"
            onClick={() => setPage((p) => p + 1)}
            disabled={loadingMore}
            sx={{
              borderRadius: 1.5,
              textTransform: "none",
              fontWeight: 700,
              px: 3,
            }}
          >
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </Box>
      )}

      <ServiceEditDialog
        open={Boolean(editingDraft)}
        draft={editingDraft}
        setDraft={setEditingDraft}
        onClose={closeEdit}
        onSave={saveEdit}
        saving={actionLoading}
        networks={networks}
        networksLoading={networksLoading}
        networksFetchError={networksFetchError}
        retryNetworks={() => fetchNetworks({ silent: false })}
        createNetworkInline={createNetworkInline}
        fetchPlansForPlatform={fetchPlansForPlatform}
        plansForPlatformErrors={plansForPlatformErrors}
        volumes={volumes}
        volumesLoading={volumesLoading}
      />
    </Container>
  );
}