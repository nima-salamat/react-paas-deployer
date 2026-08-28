import React, {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { Link as RouterLink } from "react-router-dom";
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import LaunchIcon from "@mui/icons-material/Launch";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import StorageIcon from "@mui/icons-material/Storage";
import PlatformIcon from "./PlatformIcon";

const CreateDeploymentModal = lazy(() => import("./CreateDeploymentModal"));

const PLATFORMS_API = `https://${import.meta.env.VITE_API_BASE}/plans/platforms/`;
const PLANS_API = `https://${import.meta.env.VITE_API_BASE}/plans/`;

/* ─── helpers ─────────────────────────────────────────────────────────── */

const getKey = (p) => {
  if (!p) return "null";
  if (p.id != null) return String(p.id);
  return [
    p.platform ?? "",
    typeof p.name === "string" ? p.name : JSON.stringify(p.name ?? ""),
    p.max_cpu ?? "",
    p.max_ram ?? "",
    p.price_per_hour ?? "",
  ].join("|");
};

const normalizeArray = (v) => {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.results)) return v.results;
  if (Array.isArray(v?.data)) return v.data;
  return [];
};

const normalizePlatformItem = (item) => {
  if (Array.isArray(item)) {
    return [String(item[0] ?? ""), String(item[1] ?? item[0] ?? "")];
  }
  if (item && typeof item === "object") {
    const key = String(
      item.key ?? item.value ?? item.code ?? item.platform ?? item.id ?? item.pk ?? ""
    );
    const label = String(item.label ?? item.name ?? item.title ?? item.platform ?? key);
    return [key, label];
  }
  return [String(item ?? ""), String(item ?? "")];
};

const uniqueBy = (arr, keyFn) => {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
};

const getErrorMessage = (error, fallback = "Something went wrong.") => {
  if (axios.isCancel?.(error) || error?.name === "CanceledError") return null;
  if (typeof error === "string") return error;
  const data = error?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.detail) return String(data.detail);
  if (data?.message) return String(data.message);
  if (data && typeof data === "object") {
    const first = Object.values(data).find(
      (v) => typeof v === "string" || Array.isArray(v)
    );
    if (Array.isArray(first)) return first.join(", ");
    if (first) return String(first);
  }
  return error?.message || fallback;
};

/** Classify platform as database vs application */
const DB_RE =
  /postgres|postgresql|mysql|mariadb|mongo|mongodb|redis|sqlite|elastic|elasticsearch|cassandra|cockroach|memcached|neo4j|influx|clickhouse|timescale|rabbitmq|kafka/i;

const isDatabasePlatform = (key, label) =>
  DB_RE.test(String(key || "")) || DB_RE.test(String(label || ""));

/* ─── Plan card ───────────────────────────────────────────────────────── */

const PlanCard = memo(function PlanCard({ plan, onCreate }) {
  const pKey = plan.platform ?? "";
  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        width: "100%",
        boxSizing: "border-box",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        transition: "border-color 180ms ease, background-color 180ms ease, transform 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          borderColor: "primary.main",
          transform: "translateY(-3px)",
          boxShadow: theme.palette.mode === "dark"
            ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
            : `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.primary.main, 0.06)
              : alpha(theme.palette.primary.main, 0.03),
        },
      })}
    >
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0, display: "flex", gap: 1, alignItems: "flex-start" }}>
            <PlatformIcon platformKey={pKey} label={pKey} size={28} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                {plan.platform ?? "Platform"}
              </Typography>
              <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                {plan.name ?? "Unnamed"}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {plan.plan_type
                  ? `${plan.plan_type}${plan.storage_type ? ` · ${plan.storage_type}` : ""}`
                  : plan.platform}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 2, flex: 1 }}>
        <Stack spacing={0.75}>
          {(plan.max_cpu != null || plan.cpu != null) && (
            <Typography variant="body2" color="text.secondary">
              CPU: <b>{plan.max_cpu ?? plan.cpu}</b>
            </Typography>
          )}
          {(plan.max_ram != null || plan.ram != null) && (
            <Typography variant="body2" color="text.secondary">
              RAM: <b>{plan.max_ram ?? plan.ram}</b>
            </Typography>
          )}
          {(plan.price_per_hour != null || plan.price != null) && (
            <Typography variant="body2" color="text.secondary">
              Price: <b>{plan.price_per_hour ?? plan.price}</b>
            </Typography>
          )}
        </Stack>
      </Box>
      <Box sx={{ p: 1.5, pt: 0 }}>
        <Button
          fullWidth
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onCreate(plan);
          }}
          sx={{ borderRadius: 1 }}
        >
          Create
        </Button>
      </Box>
    </Paper>
  );
});

/* ─── Main ────────────────────────────────────────────────────────────── */

export default function PlatformPlans() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({});
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  /** 0 = Apps, 1 = Databases */
  const [filterTab, setFilterTab] = useState(0);

  const fetchIdRef = useRef(0);
  const lastPlansSig = useRef(null);
  const lastPlatformsSig = useRef(null);
  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const appPlatforms = useMemo(
    () => platforms.filter(([k, l]) => !isDatabasePlatform(k, l)),
    [platforms]
  );
  const dbPlatforms = useMemo(
    () => platforms.filter(([k, l]) => isDatabasePlatform(k, l)),
    [platforms]
  );
  const visiblePlatforms = filterTab === 0 ? appPlatforms : dbPlatforms;
  const visibleKeys = useMemo(
    () => visiblePlatforms.map(([k]) => String(k)),
    [visiblePlatforms]
  );

  const selectedLabels = useMemo(() => {
    const map = new Map(platforms.map(([k, l]) => [String(k), l]));
    return selectedPlatforms.map((k) => map.get(String(k)) ?? String(k));
  }, [platforms, selectedPlatforms]);

  const allSelectedInTab =
    visibleKeys.length > 0 && visibleKeys.every((k) => selectedPlatforms.includes(k));

  const fetchPlatforms = useCallback(async (signal, { force = false } = {}) => {
    setLoadingPlatforms(true);
    setFetchError(null);
    try {
      const res = await axios.get(PLATFORMS_API, { signal });
      const normalized = uniqueBy(
        normalizeArray(res.data).map(normalizePlatformItem).filter(([k]) => k),
        (i) => i[0]
      );
      const sig = JSON.stringify(normalized);
      if (force || lastPlatformsSig.current !== sig) {
        lastPlatformsSig.current = sig;
        setPlatforms(normalized);
      }
      setSelectedPlatforms((cur) => {
        if (!cur.length) return [];
        const valid = new Set(normalized.map(([k]) => String(k)));
        return cur.filter((k) => valid.has(String(k)));
      });
    } catch (e) {
      if (axios.isCancel?.(e) || e?.name === "CanceledError") return;
      setFetchError(getErrorMessage(e, "Failed to load platforms."));
      setPlatforms([]);
    } finally {
      setLoadingPlatforms(false);
    }
  }, []);

  const fetchPlans = useCallback(
    async (signal, { force = false, appendPage } = {}) => {
      const targetPage = appendPage ?? page;
      const id = ++fetchIdRef.current;
      if (appendPage && appendPage > 1) {
        setLoadingMore(true);
        loadingMoreRef.current = true;
      } else {
        setLoadingPlans(true);
      }
      setFetchError(null);
      const filtered = selectedPlatforms.length > 0;

      try {
        if (!filtered) {
          const res = await axios.get(PLANS_API, { params: { page: targetPage }, signal });
          if (fetchIdRef.current !== id) return;
          const results = normalizeArray(res.data);
          const prev =
            targetPage > 1 && lastPlansSig.current?.raw
              ? JSON.parse(lastPlansSig.current.raw)
              : [];
          const merged = uniqueBy(
            targetPage === 1 ? results : [...prev, ...results],
            getKey
          );
          const sig = JSON.stringify(merged.map(getKey));
          if (force || lastPlansSig.current?.sig !== sig) {
            lastPlansSig.current = { sig, raw: JSON.stringify(merged) };
            setPlans(merged);
          }
          setHasNext(Boolean(res.data?.next ?? res.data?.has_next));
        } else {
          const settled = await Promise.allSettled(
            selectedPlatforms.map((p) =>
              axios.post(PLATFORMS_API, { platform: p }, { signal })
            )
          );
          if (fetchIdRef.current !== id) return;
          const merged = [];
          settled.forEach((r) => {
            if (r.status === "fulfilled") {
              const d = r.value?.data;
              if (Array.isArray(d)) merged.push(...d);
              else if (Array.isArray(d?.results)) merged.push(...d.results);
              else if (d) merged.push(d);
            }
          });
          const unique = uniqueBy(merged, getKey);
          const sig = JSON.stringify(unique.map(getKey));
          if (force || lastPlansSig.current?.sig !== sig) {
            lastPlansSig.current = { sig, raw: JSON.stringify(unique) };
            setPlans(unique);
          }
          setHasNext(false);
        }
      } catch (e) {
        if (axios.isCancel?.(e) || e?.name === "CanceledError") return;
        setFetchError(getErrorMessage(e, "Failed to load plans."));
        if (targetPage === 1) setPlans([]);
      } finally {
        if (fetchIdRef.current === id) {
          setLoadingPlans(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [page, selectedPlatforms]
  );

  useEffect(() => {
    const c = new AbortController();
    fetchPlatforms(c.signal);
    return () => c.abort();
  }, [fetchPlatforms]);

  useEffect(() => {
    const c = new AbortController();
    fetchPlans(c.signal);
    return () => c.abort();
  }, [fetchPlans]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (
          hit &&
          hasNext &&
          selectedPlatforms.length === 0 &&
          !loadingPlans &&
          !loadingMoreRef.current
        ) {
          setPage((p) => p + 1);
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNext, selectedPlatforms.length, loadingPlans, plans.length]);

  const togglePlatform = (code) => {
    const key = String(code);
    setSelectedPlatforms((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      setPage(1);
      lastPlansSig.current = null;
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedPlatforms([]);
    setPage(1);
    lastPlansSig.current = null;
  };

  const toggleSelectAllInTab = () => {
    setSelectedPlatforms((prev) => {
      let next;
      if (allSelectedInTab) {
        // deselect only current tab keys
        const drop = new Set(visibleKeys);
        next = prev.filter((k) => !drop.has(k));
      } else {
        const set = new Set(prev);
        visibleKeys.forEach((k) => set.add(k));
        next = Array.from(set);
      }
      setPage(1);
      lastPlansSig.current = null;
      return next;
    });
  };

  const openCreate = (plan) => {
    const planId = plan?.id ?? plan?.pk ?? plan?.uuid ?? null;
    setModalInitial(
      plan
        ? {
            name: "",
            plan_id: planId,
            plan_name: plan.name ?? plan.title ?? "—",
            platform: plan.platform ?? "",
          }
        : {}
    );
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalInitial({});
  };

  const handleCreated = (r) => {
    if (r?.ok) {
      console.log("Deployment created successfully.");
    }
  };

  const retryAll = () => {
    lastPlatformsSig.current = null;
    lastPlansSig.current = null;
    setPage(1);
    setFetchError(null);
    fetchPlatforms(undefined, { force: true });
    // fetchPlans will re-run via effect when page resets; force immediate:
    fetchPlans(undefined, { force: true });
  };

  const filterTabs = (
    <Tabs
      value={filterTab}
      onChange={(_, v) => setFilterTab(v)}
      variant="fullWidth"
      sx={{
        minHeight: 36,
        mb: 1.25,
        "& .MuiTab-root": { minHeight: 36, py: 0.5, fontWeight: 700, fontSize: 13 },
      }}
    >
      <Tab
        icon={<AppsIcon sx={{ fontSize: 16 }} />}
        iconPosition="start"
        label={`Apps (${appPlatforms.length})`}
      />
      <Tab
        icon={<StorageIcon sx={{ fontSize: 16 }} />}
        iconPosition="start"
        label={`Databases (${dbPlatforms.length})`}
      />
    </Tabs>
  );

  const filterContent = (
    <Stack spacing={1.5}>
      {filterTabs}

      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 800,
            background: (t) =>
              `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.secondary.main}, ${t.palette.primary.main})`,
            backgroundSize: "200% auto",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            transition: "background-position 0.6s ease",
            backgroundPosition: "0% center",
            cursor: "default",
            "&:hover": {
              backgroundPosition: "100% center",
            },
          }}
        >
          Platforms
        </Typography>
        <Stack direction="row" spacing={0.75}>
          <Button
            size="small"
            variant="outlined"
            onClick={toggleSelectAllInTab}
            disabled={!visiblePlatforms.length || loadingPlatforms}
            sx={{ borderRadius: 1, px: 1, minWidth: 0, fontSize: 11 }}
          >
            {allSelectedInTab ? "Deselect" : "Select all"}
          </Button>
          <Button
            size="small"
            onClick={clearFilters}
            disabled={!selectedPlatforms.length}
            sx={{ borderRadius: 1, px: 1, minWidth: 0, fontSize: 11 }}
          >
            Clear
          </Button>
        </Stack>
      </Stack>

      <Divider />

      {loadingPlatforms ? (
        <Stack spacing={0.75}>
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </Stack>
      ) : visiblePlatforms.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {filterTab === 0 ? "No app platforms" : "No database platforms"}
        </Typography>
      ) : (
        <Stack spacing={0.75} sx={{ maxHeight: { md: "calc(100vh - 280px)" }, overflow: "auto", pr: 0.5 }}>
          {visiblePlatforms.map(([key, label]) => {
            const selected = selectedPlatforms.includes(String(key));
            return (
              <Button
                key={key}
                fullWidth
                size="small"
                variant={selected ? "contained" : "outlined"}
                onClick={() => togglePlatform(key)}
                startIcon={<PlatformIcon platformKey={key} label={label} size={20} />}
                sx={{
                  borderRadius: 1,
                  justifyContent: "flex-start",
                  fontWeight: selected ? 700 : 500,
                  textTransform: "none",
                }}
              >
                {label}
              </Button>
            );
          })}
        </Stack>
      )}
    </Stack>
  );

  return (
    <Box sx={{ width: "100%", maxWidth: 1280, mx: "auto", px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, boxSizing: "border-box" }}>
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "#fff",
                borderRadius: 1,
                flexShrink: 0,
              }}
            >
              <LayersOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Typography component="h1" variant="h3" sx={{ fontWeight: 850, lineHeight: 1.1 }}>
                Plans
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a plan and create a deployment
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={retryAll}
              disabled={loadingPlatforms || loadingPlans}
              sx={{ borderRadius: 1 }}
            >
              Refresh
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<LaunchIcon />}
              component={RouterLink}
              to="/services"
              sx={{ borderRadius: 1 }}
            >
              Services
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Box component="section" aria-labelledby="available-plans-heading" sx={{ mt: 1 }}>
        <Typography
          id="available-plans-heading"
          component="h2"
          variant="h5"
          sx={{ fontWeight: 850, letterSpacing: "-0.02em", mb: 1 }}
        >
          Available deployment plans
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 760 }}>
          Compare application and data-service resources and choose the plan that fits your workload.
        </Typography>
      </Box>

      <Box
        sx={{
          display: { xs: "flex", md: "grid" },
          flexDirection: "column",
          gridTemplateColumns: { md: "260px 1fr" },
          gap: 2,
          alignItems: "start",
          width: "100%",
          // sticky children need a non-overflowing ancestor chain
          overflow: "visible",
        }}
      >
        {/* Desktop sticky filter sidebar — moves with scroll */}
        {/* Sticky filter: sticks under navbar while scrolling; returns to flow when scrolling back up */}
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            position: "sticky",
            top: 88,
            zIndex: 3,
            alignSelf: "start",
            maxHeight: "calc(100vh - 104px)",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              maxHeight: "calc(100vh - 104px)",
              overflow: "auto",
            }}
          >
            {filterContent}
          </Paper>
        </Box>

        <Box sx={{ width: "100%", minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ display: { xs: "flex", md: "none" }, mb: 1.5 }}
          >
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterAltOutlinedIcon />}
              onClick={() => setMobileFilterOpen(true)}
              sx={{ borderRadius: 1 }}
            >
              Filters
              {selectedPlatforms.length > 0 ? ` (${selectedPlatforms.length})` : ""}
            </Button>
            <IconButton
              onClick={retryAll}
              disabled={loadingPlatforms || loadingPlans}
              sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}
            >
              <RefreshIcon />
            </IconButton>
          </Stack>

          {selectedLabels.length > 0 && isMobile && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {selectedLabels.map((l) => (
                <Chip key={l} label={l} size="small" sx={{ borderRadius: 1 }} />
              ))}
            </Stack>
          )}

          <Paper
            elevation={0}
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                {selectedPlatforms.length > 0 ? "Filtered plans" : "All plans"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {loadingPlans ? "Loading…" : `${plans.length} result${plans.length === 1 ? "" : "s"}`}
              </Typography>
            </Stack>

            {fetchError && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  border: "1px solid",
                  borderColor: "error.main",
                  bgcolor: alpha(theme.palette.error.main, 0.06),
                  borderRadius: 1,
                }}
              >
                <Typography color="error" variant="body2" sx={{ mb: 1 }}>
                  {fetchError}
                </Typography>
                <Button size="small" variant="contained" color="error" onClick={retryAll} sx={{ borderRadius: 1 }}>
                  Retry
                </Button>
              </Box>
            )}

            {loadingPlans && plans.length === 0 ? (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                  gap: 2,
                  width: "100%",
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
                ))}
              </Box>
            ) : plans.length === 0 && !fetchError ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  No plans found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Change filters or refresh.
                </Typography>
                <Button variant="contained" onClick={retryAll} sx={{ borderRadius: 1 }}>
                  Refresh
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                  gap: 2,
                  width: "100%",
                }}
              >
                {plans.map((plan) => (
                  <PlanCard key={getKey(plan)} plan={plan} onCreate={openCreate} />
                ))}
              </Box>
            )}

            {/* Infinite-scroll sentinel (replaces Load more button) */}
            {hasNext && selectedPlatforms.length === 0 && (
              <Box
                ref={sentinelRef}
                sx={{ display: "flex", justifyContent: "center", py: 3, minHeight: 48 }}
              >
                {(loadingMore || loadingPlans) && <CircularProgress size={24} />}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>

      <Drawer
        anchor="bottom"
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "85vh",
            p: 2,
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Filters
          </Typography>
          <IconButton onClick={() => setMobileFilterOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
        <Divider sx={{ mb: 1.5 }} />
        {filterContent}
        <Button
          fullWidth
          variant="contained"
          onClick={() => setMobileFilterOpen(false)}
          sx={{ mt: 2, borderRadius: 1 }}
        >
          Done
        </Button>
      </Drawer>

      <Suspense
        fallback={
          <Box sx={{ display: "grid", placeItems: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        }
      >
        <CreateDeploymentModal
          open={modalOpen}
          initialData={modalInitial}
          onCancel={closeModal}
          onCreate={handleCreated}
          notifyOnSuccess
        />
      </Suspense>
    </Box>
  );
}
