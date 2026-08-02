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

const CreateDeploymentModal = lazy(() => import("./CreateDeploymentModal"));

const PLATFORMS_API = `https://${import.meta.env.VITE_API_BASE}/plans/platforms/`;
const PLANS_API = `https://${import.meta.env.VITE_API_BASE}/plans/`;

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

const PlanCard = memo(function PlanCard({ plan, onCreate }) {
  return (
    <Paper
      elevation={0}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onCreate(plan);
      }}
      onClick={() => onCreate(plan)}
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
        cursor: "pointer",
        transition: "border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: "primary.main",
          bgcolor:
            theme.palette.mode === "dark"
              ? alpha(theme.palette.primary.main, 0.06)
              : alpha(theme.palette.primary.main, 0.03),
        },
        "&:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 1,
        },
      })}
    >
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
              {plan.platform ?? "Platform"}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
              {plan.name ?? "Unnamed"}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {plan.plan_type
                ? `${plan.plan_type}${plan.storage_type ? ` · ${plan.storage_type}` : ""}`
                : plan.platform}
            </Typography>
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "success.main" }}>
              {plan.price_per_hour ?? "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              /hr
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ p: 2, flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Stack direction="row" spacing={1}>
          {[
            { label: "CPU", value: plan.max_cpu },
            { label: "RAM", value: plan.max_ram, unit: "MB" },
            { label: "Disk", value: plan.max_storage, unit: "GB" },
          ].map((m) => (
            <Box
              key={m.label}
              sx={{
                flex: 1,
                py: 1,
                px: 0.75,
                textAlign: "center",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                {m.value ?? "—"}
                {m.unit && m.value != null ? ` ${m.unit}` : ""}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {m.label}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {plan.description ?? "—"}
        </Typography>

        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={(e) => {
            e.stopPropagation();
            onCreate(plan);
          }}
          sx={{ borderRadius: 1, alignSelf: "flex-start" }}
        >
          Create
        </Button>
      </Box>
    </Paper>
  );
});

export default function PlatformPlans() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [platforms, setPlatforms] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState({});
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const fetchIdRef = useRef(0);
  const lastPlansSig = useRef(null);
  const lastPlatformsSig = useRef(null);

  const selectedLabels = useMemo(() => {
    const map = new Map(platforms.map(([k, l]) => [String(k), l]));
    return selectedPlatforms.map((k) => map.get(String(k)) ?? String(k));
  }, [platforms, selectedPlatforms]);

  const allKeys = useMemo(() => platforms.map(([k]) => String(k)), [platforms]);
  const allSelected = platforms.length > 0 && selectedPlatforms.length === platforms.length;

  const fetchPlatforms = useCallback(async (signal) => {
    setLoadingPlatforms(true);
    setFetchError(null);
    try {
      const res = await axios.get(PLATFORMS_API, { signal });
      const normalized = uniqueBy(
        normalizeArray(res.data).map(normalizePlatformItem).filter(([k]) => k),
        (i) => i[0]
      );
      const sig = JSON.stringify(normalized);
      if (lastPlatformsSig.current !== sig) {
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
    async (signal) => {
      const id = ++fetchIdRef.current;
      setLoadingPlans(true);
      setFetchError(null);
      const filtered = selectedPlatforms.length > 0;

      try {
        if (!filtered) {
          const res = await axios.get(PLANS_API, { params: { page }, signal });
          if (fetchIdRef.current !== id) return;
          const results = normalizeArray(res.data);
          const prev = lastPlansSig.current?.raw ? JSON.parse(lastPlansSig.current.raw) : [];
          const merged = uniqueBy(page === 1 ? results : [...prev, ...results], getKey);
          const sig = JSON.stringify(merged.map(getKey));
          if (lastPlansSig.current?.sig !== sig) {
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
          if (lastPlansSig.current?.sig !== sig) {
            lastPlansSig.current = { sig, raw: JSON.stringify(unique) };
            setPlans(unique);
          }
          setHasNext(false);
        }
      } catch (e) {
        if (axios.isCancel?.(e) || e?.name === "CanceledError") return;
        setFetchError(getErrorMessage(e, "Failed to load plans."));
        setPlans([]);
      } finally {
        if (fetchIdRef.current === id) setLoadingPlans(false);
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

  const togglePlatform = (code) => {
    const key = String(code);
    setSelectedPlatforms((prev) => {
      const next = prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key];
      setPage(1);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedPlatforms([]);
    setPage(1);
  };

  const toggleSelectAll = () => {
    setSelectedPlatforms((prev) => {
      const next = prev.length === platforms.length ? [] : allKeys;
      setPage(1);
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
    fetchPlatforms();
    fetchPlans();
  };

  const filterContent = (
    <Stack spacing={1.5}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Platforms
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Filter the plan list
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={toggleSelectAll}
          disabled={!platforms.length || loadingPlatforms}
          sx={{ borderRadius: 1 }}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </Button>
        <Button
          size="small"
          onClick={clearFilters}
          disabled={!selectedPlatforms.length}
          sx={{ borderRadius: 1 }}
        >
          Clear
        </Button>
      </Stack>

      <Divider />

      {loadingPlatforms ? (
        <Stack spacing={0.75}>
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </Stack>
      ) : platforms.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No platforms
        </Typography>
      ) : (
        <Stack spacing={0.75}>
          {platforms.map(([key, label]) => {
            const selected = selectedPlatforms.includes(String(key));
            return (
              <Button
                key={key}
                fullWidth
                size="small"
                variant={selected ? "contained" : "outlined"}
                onClick={() => togglePlatform(key)}
                sx={{
                  borderRadius: 1,
                  justifyContent: "flex-start",
                  fontWeight: selected ? 700 : 500,
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
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
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

      <Box
        sx={{
          display: { xs: "flex", md: "grid" },
          flexDirection: "column",
          gridTemplateColumns: { md: "240px 1fr" },
          gap: 2,
          alignItems: "start",
          width: "100%",
        }}
      >
        <Paper
          elevation={0}
          sx={{
            display: { xs: "none", md: "block" },
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            position: "sticky",
            top: 88,
          }}
        >
          {filterContent}
        </Paper>

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
            <IconButton onClick={retryAll} sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}>
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

            {loadingPlans ? (
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

            {hasNext && selectedPlatforms.length === 0 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loadingPlans}
                  sx={{ borderRadius: 1 }}
                >
                  {loadingPlans ? "Loading…" : "Load more"}
                </Button>
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
            maxHeight: "80vh",
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