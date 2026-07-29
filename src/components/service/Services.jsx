// ServicesListMui.jsx
import React, { useCallback, useEffect, useRef, useState, memo } from "react";
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
  Menu,
  FormControlLabel,
  Switch,
  Tooltip,
  FormControl,
  InputLabel,
} from "@mui/material";

import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import AddIcon from "@mui/icons-material/Add";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ComputerIcon from "@mui/icons-material/Computer";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

import apiRequest from "../customHooks/apiRequest";
import { useNavigate } from "react-router-dom";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const PLANS_API = `https://${import.meta.env.VITE_API_BASE}/plans/`;
const PLATFORMS_API = `https://${import.meta.env.VITE_API_BASE}/plans/platforms/`;
const NETWORK_API_ROOT = `https://${import.meta.env.VITE_API_BASE}/services/networks/`;

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error("Error saving to localStorage", error);
    }
  };
  return [storedValue, setValue];
}

// ==================== ServiceItem (خارج از کامپوننت اصلی تا memo کار کند) ====================
const ServiceItem = memo(function ServiceItem({
  s,
  layout,
  isReadOnly,
  planCache,
  networkCache,
  loadPlan,
  loadNetwork,
  onToggleStatus,
  onEdit,
  onDelete,
  onOpen,
}) {
  const planIsObj = s.plan && typeof s.plan === "object";
  const netIsObj = s.network && typeof s.network === "object";
  const planId = planIsObj ? s.plan.id ?? s.plan.pk : s.plan;
  const networkId = netIsObj ? s.network.id ?? s.network.pk : s.network;

  useEffect(() => {
    if (planId && !planCache[planId]) loadPlan(planId);
  }, [planId, planCache, loadPlan]);

  useEffect(() => {
    if (networkId && !networkCache[networkId]) loadNetwork(networkId);
  }, [networkId, networkCache, loadNetwork]);

  const networkName = netIsObj ? s.network.name : networkCache[networkId]?.name ?? "—";
  const cpu = planIsObj ? s.plan.max_cpu : planCache[planId]?.max_cpu;
  const ram = planIsObj ? s.plan.max_ram : planCache[planId]?.max_ram;
  const storage = planIsObj ? s.plan.max_storage : planCache[planId]?.max_storage;
  const price = planIsObj ? s.plan.price_per_hour : planCache[planId]?.price_per_hour;

  const isUpdating = s.status === "updating...";
  const isRunning = s.status === "running";

  const commonStats = (
    <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
      {cpu && <Chip size="small" icon={<ComputerIcon fontSize="small" />} label={`${cpu} Cores`} />}
      {ram && <Chip size="small" icon={<MemoryIcon fontSize="small" />} label={`${ram} MB`} />}
      {storage && <Chip size="small" icon={<StorageIcon fontSize="small" />} label={`${storage} GB`} />}
      {price && (
        <Chip
          size="small"
          icon={<AttachMoneyIcon fontSize="small" />}
          label={`${price}/hr`}
          color="success"
          variant="outlined"
        />
      )}
    </Box>
  );

  // دکمه‌ها با عرض و ارتفاع کاملاً ثابت + بدون transform
  const actionButtons = !isReadOnly && (
    <Box
      sx={{
        display: "flex",
        gap: 1,
        flexWrap: "nowrap",
        justifyContent: layout === "row" ? "flex-end" : "flex-start",
        mt: layout === "row" ? 0 : 2,
        minWidth: layout === "row" ? 340 : "auto",
        alignItems: "center",
        flexShrink: 0,
      }}
    >
      <Button
        size="small"
        variant="contained"
        color={isRunning ? "error" : "success"}
        disabled={isUpdating}
        startIcon={isRunning ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus(s, s.status);
        }}
        sx={{
          minWidth: 96,
          width: 96,
          height: 32,
          px: 1,
          transition: "background-color 0.15s ease, box-shadow 0.15s ease",
          "&:hover": {
            transform: "none !important",
          },
          "& .MuiButton-startIcon": {
            marginRight: "6px",
            marginLeft: 0,
          },
        }}
      >
        {isUpdating ? "..." : isRunning ? "Stop" : "Start"}
      </Button>

      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onEdit(s, networkId, planId);
        }}
        sx={{
          minWidth: 82,
          width: 82,
          height: 32,
          transition: "background-color 0.15s ease",
          "&:hover": { transform: "none !important" },
        }}
      >
        Edit
      </Button>

      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<DeleteIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(s.id ?? s.pk);
        }}
        sx={{
          minWidth: 90,
          width: 90,
          height: 32,
          transition: "background-color 0.15s ease",
          "&:hover": { transform: "none !important" },
        }}
      >
        Delete
      </Button>

      <Button
        size="small"
        variant="contained"
        startIcon={<LaunchIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(s);
        }}
        sx={{
          minWidth: 86,
          width: 86,
          height: 32,
          transition: "background-color 0.15s ease, box-shadow 0.15s ease",
          "&:hover": { transform: "none !important" },
        }}
      >
        Open
      </Button>
    </Box>
  );

  if (layout === "row") {
    return (
      <Card
        elevation={1}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          mb: 1,
          flexWrap: "wrap",
          transition: "none",
          "&:hover": { transform: "none" },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 180, mb: { xs: 2, md: 0 } }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {s.name || "(no name)"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {networkName}
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 2,
            display: "flex",
            justifyContent: { xs: "flex-start", md: "center" },
            minWidth: 220,
            mb: { xs: 2, md: 0 },
          }}
        >
          {commonStats}
        </Box>

        <Box
          sx={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: { xs: "flex-start", md: "flex-end" },
            minWidth: 340,
          }}
        >
          <Chip
            label={s.status ?? "unknown"}
            color={isRunning ? "success" : "default"}
            size="small"
            sx={{ mb: 1, minWidth: 80, height: 24 }}
          />
          {actionButtons}
        </Box>
      </Card>
    );
  }

  return (
    <Card
      elevation={3}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minWidth: layout === "carousel" ? 300 : "auto",
        transition: "none",
        "&:hover": { transform: "none" },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {s.name || "(no name)"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {networkName}
            </Typography>
          </Box>
          <Chip
            label={s.status ?? "unknown"}
            color={isRunning ? "success" : "default"}
            size="small"
            sx={{ minWidth: 80, height: 24 }}
          />
        </Box>

        {layout === "carousel" ? (
          commonStats
        ) : (
          <Box sx={{ mt: 2 }}>
            {cpu && (
              <Typography variant="body2">
                CPU: <strong>{cpu}</strong> cores
              </Typography>
            )}
            {ram && (
              <Typography variant="body2">
                RAM: <strong>{ram}</strong> MB
              </Typography>
            )}
            {storage && (
              <Typography variant="body2">
                Storage: <strong>{storage}</strong> GB
              </Typography>
            )}
            {price && (
              <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                Price/hr: <strong>{price}</strong>
              </Typography>
            )}
          </Box>
        )}
      </CardContent>

      {(!isReadOnly || (isReadOnly && layout !== "row")) && (
        <Box
          sx={{
            p: 2,
            display: "flex",
            gap: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.02)",
            minHeight: 56,
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          {actionButtons}
        </Box>
      )}
    </Card>
  );
});

// ==================== کامپوننت اصلی ====================
export default function ServicesListMui({
  apiUrl = "/services/service/",
  pageSize = 10,
  showSearch = true,
  extraQueryParams = {},
  onOpen = null,
}) {
  const theme = useTheme();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useLocalStorage("services_view_mode", "cards");
  const [autoRefresh, setAutoRefresh] = useLocalStorage("services_auto_refresh", false);
  const [refreshInterval, setRefreshInterval] = useLocalStorage("services_refresh_interval", 2000);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  const [services, setServices] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [servicesFetchError, setServicesFetchError] = useState(null);

  const [planCache, setPlanCache] = useState({});
  const [networkCache, setNetworkCache] = useState({});

  const [networks, setNetworks] = useState([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksFetchError, setNetworksFetchError] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [plansForPlatform, setPlansForPlatform] = useState({});
  const [plansForPlatformErrors, setPlansForPlatformErrors] = useState({});

  const [alertState, setAlertState] = useState(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  const getKey = (s) => {
    if (!s) return "null";
    if (s.id !== undefined && s.id !== null) return String(s.id);
    if (s.pk !== undefined && s.pk !== null) return String(s.pk);
    return `${s.name || ""}|${(s.plan && s.plan.platform) || ""}`;
  };

  const handleAuthError = useCallback(
    (e) => {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        setAlertState({ severity: "error", message: "You're not authenticated. Redirecting to login..." });
        setAutoRefresh(false);
        setTimeout(() => {
          if (isComponentMounted.current) navigate("/signin_or_signup");
        }, 2000);
        return true;
      }
      return false;
    },
    [navigate, setAutoRefresh]
  );

  const buildUrl = useCallback(
    (basePath, extra = {}, customPage = page, customPageSize = pageSize) => {
      try {
        const isAbsolute = String(basePath).startsWith("http");
        const base = isAbsolute ? basePath : `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        const url = new URL(base);
        url.searchParams.set("page", String(customPage));
        url.searchParams.set("page_size", String(customPageSize));
        if (query) url.searchParams.set("q_search", query);
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
        });
        return url.href;
      } catch {
        let base = `${API_BASE}${basePath.startsWith("/") ? basePath : "/" + basePath}`;
        let qs = `page=${customPage}&page_size=${customPageSize}`;
        if (query) qs += `&q_search=${encodeURIComponent(query)}`;
        Object.entries(extra).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") qs += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
        });
        return base + (base.includes("?") ? "&" : "?") + qs;
      }
    },
    [page, pageSize, query]
  );

  const fetchServices = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoading(page === 1);
        setLoadingMore(page > 1);
        setServicesFetchError(null);
      }

      try {
        const targetPage = isBackground ? 1 : page;
        const targetPageSize = isBackground ? page * pageSize : pageSize;

        const url = buildUrl(apiUrl, extraQueryParams, targetPage, targetPageSize);
        const res = await apiRequest({ method: "GET", url });

        if (!isComponentMounted.current) return;

        const data = res.data;
        const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];

        setServices((prev) => {
          if (isBackground) {
            // فقط اگر واقعاً تغییر کرده باشد جایگزین کن
            if (prev.length !== results.length) return results;
            const changed = results.some((r, i) => {
              const p = prev[i];
              if (!p) return true;
              return (
                getKey(p) !== getKey(r) ||
                p.status !== r.status ||
                p.name !== r.name ||
                JSON.stringify(p.plan) !== JSON.stringify(r.plan) ||
                JSON.stringify(p.network) !== JSON.stringify(r.network)
              );
            });
            return changed ? results : prev;
          }
          return page === 1
            ? results
            : [...prev, ...results.filter((r) => !prev.some((p) => getKey(p) === getKey(r)))];
        });

        if (!isBackground) {
          setHasNext(Boolean(data?.next));
        }
      } catch (e) {
        if (!isComponentMounted.current) return;
        if (handleAuthError(e)) return;

        if (!isBackground) {
          setServicesFetchError(
            e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to load services."
          );
          if (page === 1) setServices([]);
          setHasNext(false);
        }
      } finally {
        if (!isComponentMounted.current) return;
        if (!isBackground) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [page, pageSize, apiUrl, extraQueryParams, buildUrl, handleAuthError]
  );

  useEffect(() => {
    fetchServices(false);
  }, [page, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!autoRefresh) return;

    let timerId;
    let isPolling = true;

    const pollData = async () => {
      if (!isPolling) return;
      await fetchServices(true);
      if (isPolling) {
        timerId = setTimeout(pollData, refreshInterval);
      }
    };

    timerId = setTimeout(pollData, refreshInterval);

    return () => {
      isPolling = false;
      clearTimeout(timerId);
    };
  }, [autoRefresh, refreshInterval, fetchServices]);

  const fetchNetworks = useCallback(async () => {
    setNetworksLoading(true);
    setNetworksFetchError(null);
    try {
      const url = buildUrl(NETWORK_API_ROOT, { page_size: 100 }, 1, 100);
      const res = await apiRequest({ method: "GET", url });
      const items = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
      setNetworks(items);
      const cache = {};
      items.forEach((n) => {
        cache[n.id ?? n.pk] = n;
      });
      setNetworkCache((prev) => ({ ...prev, ...cache }));
    } catch (e) {
      if (handleAuthError(e)) return;
      setNetworksFetchError(e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to load networks.");
    } finally {
      setNetworksLoading(false);
    }
  }, [buildUrl, handleAuthError]);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  const loadPlan = useCallback(
    async (planId) => {
      if (!planId) return;
      setPlanCache((current) => {
        if (current[planId]) return current;
        (async () => {
          try {
            const res = await apiRequest({ method: "GET", url: `${PLANS_API}?id=${planId}` });
            if (!isComponentMounted.current) return;
            setPlanCache((p) => ({ ...p, [planId]: res.data }));
          } catch (e) {
            handleAuthError(e);
          }
        })();
        return current;
      });
    },
    [handleAuthError]
  );

  const loadNetwork = useCallback(
    async (networkId) => {
      if (!networkId) return;
      setNetworkCache((current) => {
        if (current[networkId]) return current;
        (async () => {
          try {
            const res = await apiRequest({ method: "GET", url: `${NETWORK_API_ROOT}${networkId}/` });
            if (!isComponentMounted.current) return;
            setNetworkCache((n) => ({ ...n, [networkId]: res.data }));
          } catch (e) {
            handleAuthError(e);
          }
        })();
        return current;
      });
    },
    [handleAuthError]
  );

  const getServiceDetailUrl = (id) => `${API_BASE}${apiUrl.endsWith("/") ? apiUrl : apiUrl + "/"}${id}/`;

  const handleOpen = useCallback(
    (svc) => {
      const id = svc.id ?? svc.pk;
      if (id) navigate(`/service/${id}`);
      else if (onOpen) onOpen(svc);
    },
    [navigate, onOpen]
  );

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
      if (handleAuthError(e)) return false;
      setAlertState({
        severity: "error",
        message: e?.response?.data ? JSON.stringify(e.response.data) : e?.message || "Failed to save.",
      });
      setTimeout(() => setAlertState(null), 3000);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const toggleServiceStatus = useCallback(
    async (service, currentStatus) => {
      const serviceId = service.id ?? service.pk;
      const newStatus = currentStatus === "running" ? "stopped" : "running";

      setServices((prev) =>
        prev.map((s) => (String(s.id ?? s.pk) === String(serviceId) ? { ...s, status: "updating..." } : s))
      );

      try {
        await apiRequest({ method: "PATCH", url: getServiceDetailUrl(serviceId), data: { status: newStatus } });
        setServices((prev) =>
          prev.map((s) => (String(s.id ?? s.pk) === String(serviceId) ? { ...s, status: newStatus } : s))
        );
      } catch (e) {
        if (handleAuthError(e)) return;
        setServices((prev) =>
          prev.map((s) => (String(s.id ?? s.pk) === String(serviceId) ? { ...s, status: currentStatus } : s))
        );
        setAlertState({ severity: "error", message: "Failed to change service status." });
        setTimeout(() => setAlertState(null), 3000);
      }
    },
    [handleAuthError]
  );

  const deleteService = useCallback(
    async (serviceId) => {
      if (!window.confirm("Are you sure you want to delete this service?")) return;
      setActionLoading(true);
      try {
        await apiRequest({ method: "DELETE", url: getServiceDetailUrl(serviceId) });
        setServices((prev) => prev.filter((s) => String(s.id ?? s.pk) !== String(serviceId)));
        setAlertState({ severity: "success", message: "Service deleted." });
        setTimeout(() => setAlertState(null), 2000);
      } catch (e) {
        if (handleAuthError(e)) return;
        setAlertState({ severity: "error", message: e?.message || "Failed to delete." });
        setTimeout(() => setAlertState(null), 3000);
      } finally {
        setActionLoading(false);
      }
    },
    [handleAuthError]
  );

  const fetchPlansForPlatform = async (platform) => {
    if (!platform || plansForPlatform[platform]) return plansForPlatform[platform] || [];
    try {
      const res = await apiRequest({ method: "POST", url: PLATFORMS_API, data: { platform } });
      const plans = res.data || [];
      setPlansForPlatform((p) => ({ ...p, [platform]: plans }));
      return plans;
    } catch (e) {
      handleAuthError(e);
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
    } catch (e) {
      if (handleAuthError(e)) return null;
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
    } catch (e) {
      if (handleAuthError(e)) return false;
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
    fetchServices(false);
  };

  const handleEdit = useCallback((s, networkId, planId) => {
    setEditingService({
      service: s,
      selectedNetwork: networkId ?? null,
      selectedPlanId: planId ?? null,
    });
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          My Services
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Tooltip title="Refresh Now">
            <IconButton
              onClick={() => {
                setPage(1);
                fetchServices(false);
              }}
              disabled={loading}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton onClick={(e) => setMenuAnchorEl(e.currentTarget)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={() => setMenuAnchorEl(null)}
            sx={{ mt: 1 }}
            disableScrollLock={true}
          >
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    size="small"
                  />
                }
                label="Auto Refresh"
              />
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Refresh Interval
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                  disabled={!autoRefresh}
                >
                  <MenuItem value={2000}>2 Seconds</MenuItem>
                  <MenuItem value={5000}>5 Seconds</MenuItem>
                  <MenuItem value={10000}>10 Seconds</MenuItem>
                </Select>
              </Box>
            </Box>
          </Menu>
        </Box>
      </Box>

      {showSearch && (
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 4,
            display: "flex",
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            backgroundColor: "background.default",
          }}
        >
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchServices(false);
            }}
            sx={{ display: "flex", gap: 1, flexGrow: 1 }}
          >
            <TextField
              fullWidth
              variant="outlined"
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search service name..."
            />
            <Button variant="contained" type="submit" disableElevation>
              Search
            </Button>
          </Box>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>View Display Mode</InputLabel>
            <Select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value);
                setCarouselIndex(0);
              }}
              label="View Display Mode"
            >
              <MenuItem value="cards">Card View</MenuItem>
              <MenuItem value="rows">List View (Rows)</MenuItem>
              <MenuItem value="carousel">Carousel View</MenuItem>
              <MenuItem value="overview">Overview (Read-Only)</MenuItem>
            </Select>
          </FormControl>
        </Paper>
      )}

      {alertState && (
        <Snackbar open autoHideDuration={3000} onClose={() => setAlertState(null)}>
          <Alert severity={alertState.severity} onClose={() => setAlertState(null)}>
            {alertState.message}
          </Alert>
        </Snackbar>
      )}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      )}

      {servicesFetchError && !loading && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography color="error">{servicesFetchError}</Typography>
          <Button variant="contained" onClick={retryAll} sx={{ mt: 2 }}>
            Retry
          </Button>
        </Paper>
      )}

      {!loading && !servicesFetchError && (
        <Box>
          {services.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No services found.
            </Typography>
          ) : (
            <>
              {(viewMode === "cards" || viewMode === "overview") && (
                <Grid container spacing={3}>
                  {services.map((s) => (
                    <Grid item xs={12} md={6} lg={4} key={getKey(s)}>
                      <ServiceItem
                        s={s}
                        layout="card"
                        isReadOnly={viewMode === "overview"}
                        planCache={planCache}
                        networkCache={networkCache}
                        loadPlan={loadPlan}
                        loadNetwork={loadNetwork}
                        onToggleStatus={toggleServiceStatus}
                        onEdit={handleEdit}
                        onDelete={deleteService}
                        onOpen={handleOpen}
                      />
                    </Grid>
                  ))}
                </Grid>
              )}

              {viewMode === "rows" && (
                <Stack spacing={0}>
                  {services.map((s) => (
                    <ServiceItem
                      key={getKey(s)}
                      s={s}
                      layout="row"
                      isReadOnly={false}
                      planCache={planCache}
                      networkCache={networkCache}
                      loadPlan={loadPlan}
                      loadNetwork={loadNetwork}
                      onToggleStatus={toggleServiceStatus}
                      onEdit={handleEdit}
                      onDelete={deleteService}
                      onOpen={handleOpen}
                    />
                  ))}
                </Stack>
              )}

              {viewMode === "carousel" && (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 4 }}>
                  {services[carouselIndex] && (
                    <Box sx={{ width: "100%", maxWidth: 600 }}>
                      <ServiceItem
                        s={services[carouselIndex]}
                        layout="carousel"
                        isReadOnly={false}
                        planCache={planCache}
                        networkCache={networkCache}
                        loadPlan={loadPlan}
                        loadNetwork={loadNetwork}
                        onToggleStatus={toggleServiceStatus}
                        onEdit={handleEdit}
                        onDelete={deleteService}
                        onOpen={handleOpen}
                      />
                    </Box>
                  )}
                  <Box sx={{ mt: 4, display: "flex", alignItems: "center", gap: 3 }}>
                    <Button
                      variant="outlined"
                      onClick={() => setCarouselIndex((i) => Math.max(0, i - 1))}
                      disabled={carouselIndex === 0}
                      startIcon={<ChevronLeftIcon />}
                    >
                      Prev
                    </Button>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      {carouselIndex + 1} of {services.length}
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={() => setCarouselIndex((i) => Math.min(services.length - 1, i + 1))}
                      disabled={carouselIndex === services.length - 1}
                      endIcon={<ChevronRightIcon />}
                    >
                      Next
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {hasNext && viewMode !== "carousel" && !loading && (
        <Box sx={{ textAlign: "center", mt: 4 }}>
          <Button
            variant="contained"
            onClick={() => {
              setPage((p) => p + 1);
              fetchServices(false);
            }}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </Box>
      )}

      <Dialog
        open={Boolean(editingService)}
        onClose={() => setEditingService(null)}
        fullWidth
        maxWidth="lg"
        disableScrollLock={true}
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

              const originalNet = svc.network ? svc.network.id ?? svc.network.pk ?? svc.network : null;
              if ((editingService.selectedNetwork ?? null) !== (originalNet ?? null)) {
                payload.network = editingService.selectedNetwork ?? null;
              }

              const originalPlan = svc.plan ? svc.plan.id ?? svc.plan.pk ?? svc.plan : null;
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
  const platform =
    svc.plan && typeof svc.plan === "object" ? svc.plan.platform ?? svc.plan.name : svc.platform;

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
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Network
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Select
            fullWidth
            size="small"
            value={editingService.selectedNetwork ?? ""}
            onChange={(e) =>
              setEditingService((es) => ({ ...es, selectedNetwork: e.target.value || null }))
            }
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

        {editingService.creatingNetwork && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography fontWeight={700} gutterBottom>
              Network Name
            </Typography>
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
                onClick={() =>
                  setEditingService((es) => {
                    const copy = { ...es };
                    delete copy.creatingNetwork;
                    return copy;
                  })
                }
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
                    setEditingService((es) => ({
                      ...es,
                      selectedNetwork: nid,
                      creatingNetwork: undefined,
                    }));
                  }
                }}
              >
                Create
              </Button>
            </Stack>
          </Paper>
        )}

        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Plans for {platform || "this service"}
          </Typography>

          {plansLoading ? (
            <CircularProgress size={24} />
          ) : (
            <>
              {plansForPlatformErrors[platform] && (
                <Alert
                  severity="error"
                  action={
                    <Button size="small" onClick={() => fetchPlansForPlatform(platform)}>
                      Retry
                    </Button>
                  }
                >
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

      <Box>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={700}>
            Service Overview
          </Typography>
          <Typography sx={{ mt: 2 }}>
            <strong>Status:</strong> {svc.status}
          </Typography>
          <Typography>
            <strong>Network:</strong> {svc.network?.name ?? svc.network ?? "(none)"}
          </Typography>
          <Typography>
            <strong>Plan:</strong> {svc.plan?.name ?? svc.plan ?? "(none)"}
          </Typography>
        </Paper>

        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              All Networks
            </Typography>
            {networksFetchError && (
              <Button size="small" onClick={retryNetworks}>
                Retry
              </Button>
            )}
          </Box>
          {networksLoading ? (
            <CircularProgress size={20} />
          ) : networks.length === 0 ? (
            <Typography>No networks yet</Typography>
          ) : (
            networks.map((n) => (
              <Typography key={n.id ?? n.pk} sx={{ py: 0.5 }}>
                {n.name}
              </Typography>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}