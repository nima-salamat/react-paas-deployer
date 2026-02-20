import React, { useEffect, useRef, useState, useCallback, Suspense, lazy, memo } from "react";
import axios from "axios";
import { Link as RouterLink} from "react-router-dom";

import { motion } from "framer-motion";
import {
  Box,
  Grid,
  Chip,
  Typography,
  Button,
  Skeleton,
  Paper,
  Modal,
  Backdrop,
  useTheme,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloseIcon from "@mui/icons-material/Close";
import LaunchIcon from "@mui/icons-material/Launch";

// lazy modal (same as your CreateDeploymentModal)
const CreateDeploymentModal = lazy(() => import("./CreateDeploymentModal"));

// API endpoints (adjust if needed)
const PLATFORMS_API = "http://127.0.0.1:8000/plans/platforms/";
const PLANS_API = "http://127.0.0.1:8000/plans/";

/* ============================
   Helpers
   ============================ */
const getKey = (p) => {
  if (!p) return "null";
  if (p.id !== undefined && p.id !== null) return String(p.id);
  const name = typeof p.name === "string" ? p.name : JSON.stringify(p.name ?? "");
  const platform = p.platform ?? "";
  const cpu = p.max_cpu ?? "";
  const ram = p.max_ram ?? "";
  const price = p.price_per_hour ?? "";
  return `${platform}|${name}|${cpu}|${ram}|${price}`;
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

// smart merge to avoid re-render / flicker: reuse references when fields unchanged
const mergePlansSmart = (existing = [], incoming = []) => {
  try {
    if (!Array.isArray(incoming)) return existing;
    if (!Array.isArray(existing)) return incoming;
    if (existing.length === incoming.length) {
      let changed = false;
      const out = incoming.map((inc, i) => {
        const ex = existing[i];
        if (!ex || String(ex.id) !== String(inc.id)) {
          changed = true;
          return inc;
        }
        // shallow compare important fields
        const f1 = getKey(ex);
        const f2 = getKey(inc);
        if (f1 === f2) return ex; // reuse exact object if key identical
        changed = true;
        return inc;
      });
      if (!changed) return existing;
      return out;
    }
  } catch (e) {
    console.debug("mergePlansSmart err", e);
  }
  return incoming;
};

/* ============================
   Presentational subcomponents
   ============================ */
const PlanCard = memo(
  function PlanCard({ plan, idx, onCreate }) {
    const isFeatured = !!plan.featured;
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.28, delay: Math.min(idx * 0.03, 0.4) }}
        style={{ width: "100%" }}
      >
        <Paper
          elevation={isFeatured ? 8 : 2}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onCreate(plan);
          }}
          onClick={() => onCreate(plan)}
          sx={(theme) => ({
            cursor: "pointer",
            borderRadius: 2,
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            // glass effect
            bgcolor: theme.palette.mode === "dark" ? "rgba(12,12,12,0.56)" : "rgba(255,255,255,0.72)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: isFeatured ? "1px solid rgba(25,135,84,0.12)" : "1px solid rgba(13,110,253,0.06)",
            transition: "transform 220ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms ease",
            '&:hover': { transform: 'translateY(-6px)', boxShadow: isFeatured ? '0 20px 60px rgba(8,25,58,0.10)' : '0 12px 36px rgba(8,25,58,0.06)' },
            outline: 'none',
          })}
        >
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "primary.main" }}>
                {plan.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {plan.plan_type ? `${plan.plan_type} • ${plan.storage_type || ""}` : plan.platform}
              </Typography>
            </Box>

            <Box textAlign="right">
              <Typography variant="subtitle2" sx={{ fontWeight: 900, color: "success.main" }}>
                {plan.price_per_hour}{" "}
                <Typography component="span" variant="caption" color="text.secondary">/ hr</Typography>
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Box sx={{ px: 1.25, py: 0.6, borderRadius: 1, border: "1px solid rgba(15,23,36,0.04)", minWidth: 64, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{plan.max_cpu}</Typography>
              <Typography variant="caption" color="text.secondary">CPU</Typography>
            </Box>
            <Box sx={{ px: 1.25, py: 0.6, borderRadius: 1, border: "1px solid rgba(15,23,36,0.04)", minWidth: 64, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{plan.max_ram}</Typography>
              <Typography variant="caption" color="text.secondary">MB RAM</Typography>
            </Box>
            <Box sx={{ px: 1.25, py: 0.6, borderRadius: 1, border: "1px solid rgba(15,23,36,0.04)", minWidth: 64, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>{plan.max_storage}</Typography>
              <Typography variant="caption" color="text.secondary">GB</Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={(e) => {
                e.stopPropagation();
                onCreate(plan);
              }}
            >
              Create
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "60%" }}>
              {plan.description ?? ""}
            </Typography>
          </Stack>
        </Paper>
      </motion.div>
    );
  },
  (a, b) => {
    // compare by stable key to avoid re-renders
    try {
      return getKey(a.plan) === getKey(b.plan) && a.idx === b.idx;
    } catch (e) {
      return a.plan === b.plan && a.idx === b.idx;
    }
  }
);

/* ============================
   Main component
   ============================ */
export default function PlatformPlans() {
  const theme = useTheme();

  const [platforms, setPlatforms] = useState([]); // array of [key, label]
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loadingPlatforms, setLoadingPlatforms] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  const fetchIdRef = useRef(0);
  const lastPlansRef = useRef(null); // keep last array of keys to avoid updating state if same
  const lastPlatformsRef = useRef(null);

  /* ------------ fetch platforms ------------ */
  const fetchPlatforms = useCallback(async () => {
    setLoadingPlatforms(true);
    setFetchError(null);
    try {
      const res = await axios.get(PLATFORMS_API);
      const data = Array.isArray(res.data) ? res.data : [];
      const normalized = data.map((p) => p);
      const keySig = JSON.stringify(normalized);
      if (lastPlatformsRef.current === keySig) {
        // no change -> do nothing to avoid flicker
      } else {
        lastPlatformsRef.current = keySig;
        setPlatforms(normalized);
      }
    } catch (e) {
      console.error("fetchPlatforms", e);
      setPlatforms([]);
      setFetchError("Failed to load platforms or plans.");
    } finally {
      setLoadingPlatforms(false);
    }
  }, []);

  /* ------------ fetch plans ------------ */
  const fetchPlans = useCallback(async () => {
    const thisFetch = ++fetchIdRef.current;
    setLoadingPlans(true);
    setFetchError(null);

    const isFiltered = selectedPlatforms.length > 0;

    try {
      if (!isFiltered) {
        const res = await axios.get(`${PLANS_API}?page=${page}`);
        if (fetchIdRef.current !== thisFetch) return; // stale
        const results = Array.isArray(res.data.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
        const incoming = page === 1 ? uniqueBy(results, getKey) : [...(lastPlansRef.current?.raw ?? []), ...results];
        const deduped = uniqueBy(incoming, getKey);
        const keySig = JSON.stringify(deduped.map(getKey));
        if (lastPlansRef.current?.sig === keySig) {
          // nothing changed -> reuse
        } else {
          lastPlansRef.current = { sig: keySig, raw: deduped };
          setPlans((prev) => mergePlansSmart(prev, deduped));
        }
        setHasNext(Boolean(res.data.next));
      } else {
        const promises = selectedPlatforms.map((p) => axios.post(PLATFORMS_API, { platform: p }));
        const settled = await Promise.allSettled(promises);
        if (fetchIdRef.current !== thisFetch) return; // stale
        const merged = [];
        settled.forEach((r) => {
          if (r.status === "fulfilled") {
            const data = r.value?.data;
            if (Array.isArray(data)) merged.push(...data);
            else if (Array.isArray(data?.results)) merged.push(...data.results);
            else if (data) merged.push(data);
          }
        });
        const unique = uniqueBy(merged, getKey);
        const keySig = JSON.stringify(unique.map(getKey));
        if (lastPlansRef.current?.sig === keySig) {
          // no update
        } else {
          lastPlansRef.current = { sig: keySig, raw: unique };
          setPlans(unique);
        }
        setHasNext(false);
      }
    } catch (e) {
      console.error("fetchPlans", e);
      setPlans([]);
      setFetchError("Failed to load platforms or plans.");
    } finally {
      setLoadingPlans(false);
    }
  }, [page, selectedPlatforms]);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  // re-fetch plans when filters or page change
  useEffect(() => {
    fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPlans, page, selectedPlatforms]);

  /* ------------ toggles ------------ */
  const togglePlatform = (code) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      setPage(1);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedPlatforms((prev) => {
      const all = platforms.map((p) => p[0]);
      const next = prev.length === platforms.length ? [] : all;
      setPage(1);
      return next;
    });
  };

  /* ------------ modal ------------ */
  const openCreate = (plan) => {
    setModalInitial(plan ? { name: plan.platform, type: plan.name, id: plan.id } : {});
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setModalInitial(null);
  };
  const handleCreated = (result) => {
    if (result?.ok) {
      closeModal();
    }
  };

  const retryAll = () => {
    fetchPlatforms();
    fetchPlans();
  };

  /* ------------ small UI helpers ------------ */
  const platformChipSx = (selected) => ({
    borderRadius: 999,
    px: 2,
    py: 1,
    cursor: "pointer",
    fontWeight: 700,
    boxShadow: selected ? (theme.palette.mode === "dark" ? "0 10px 30px rgba(13,110,253,0.08)" : "0 10px 30px rgba(13,110,253,0.08)") : "0 6px 18px rgba(8,25,58,0.03)",
    bgcolor: selected ? "primary.main" : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fff"),
    color: selected ? "#fff" : "text.primary",
    border: selected ? "1px solid rgba(13,110,253,0.18)" : "1px solid rgba(15,23,36,0.06)",
    transition: "transform .18s cubic-bezier(.2,.9,.3,1), box-shadow .18s",
    '&:hover': { transform: 'translateY(-3px)' },
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Paper sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(5,7,10,0.4)' : 'linear-gradient(180deg, rgba(250,252,255,0.6), rgba(255,255,255,0.8))', boxShadow: '0 12px 36px rgba(8,25,58,0.06)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="center" spacing={2} sx={{ mb: 1 }}>
          <Box sx={{ flex: '0 0 auto' }}>
            <Typography variant="h6">Select Platforms</Typography>
            <Typography variant="caption" color="text.secondary">Choose one or multiple platforms to filter plans</Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1}>
            <Tooltip title="Retry fetch">
              <IconButton onClick={retryAll} size="small"><RefreshIcon /></IconButton>
            </Tooltip>
             <Button variant="outlined" startIcon={<LaunchIcon />} fullWidth component={RouterLink} to="/services" >
                Services
              </Button>
          </Stack>
        </Stack>

        { (fetchError || (!platforms.length && !loadingPlatforms)) && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: "background.paper", borderRadius: 2 }}>
            <Typography color="error">{fetchError || "No platforms available."}</Typography>
            <Box sx={{ mt: 1 }}>
              <Button variant="contained" onClick={retryAll}>Retry</Button>
            </Box>
          </Paper>
        ) }

        {!fetchError && platforms.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Button size="small" variant="outlined" onClick={toggleSelectAll}>
                {selectedPlatforms.length === platforms.length ? "Deselect All" : "Select All"}
              </Button>
              <Box sx={{ flex: 1 }} />
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {platforms.map(([key, label]) => {
                const selected = selectedPlatforms.includes(key);
                return (
                  <Chip
                    key={key}
                    label={label}
                    onClick={() => togglePlatform(key)}
                    clickable
                    variant={selected ? 'filled' : 'outlined'}
                    sx={platformChipSx(selected)}
                    color={selected ? "primary" : "default"}
                    aria-pressed={selected}
                  />
                );
              })}
            </Stack>
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="subtitle1">Plans {selectedPlatforms.length > 0 ? "(filtered)" : "(all)"}</Typography>
          <Typography variant="caption" color="text.secondary">{loadingPlans ? "Loading..." : `${plans.length} results`}</Typography>
        </Box>

        {loadingPlans && (
          <Grid container spacing={2}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Skeleton variant="rounded" height={160} sx={{ borderRadius: 2 }} />
              </Grid>
            ))}
          </Grid>
        )}

        {!loadingPlans && !fetchError && plans.length === 0 && (
          <Typography color="text.secondary">No plans found.</Typography>
        )}

        {!loadingPlans && plans.length > 0 && (
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {plans.map((plan, idx) => (
              <Grid item xs={12} sm={6} md={4} key={getKey(plan)}>
                <PlanCard plan={plan} idx={idx} onCreate={openCreate} />
              </Grid>
            ))}
          </Grid>
        )}

        {hasNext && selectedPlatforms.length === 0 && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Button variant="contained" onClick={() => setPage((p) => p + 1)} disabled={loadingPlans}>
              {loadingPlans ? "Loading..." : "Load More"}
            </Button>
          </Box>
        )}

      </Paper>

      {/* Modal (glass backdrop, lazy loaded content) */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{ backdrop: { timeout: 300, sx: { backdropFilter: "blur(4px)", backgroundColor: "rgba(2,6,23,0.55)" } } }}
        aria-labelledby="create-deploy-modal"
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: { xs: "94%", sm: 720 },
            maxHeight: "86vh",
            overflow: "auto",
            borderRadius: 2,
            p: 2,
            bgcolor: theme.palette.mode === "dark" ? "rgba(12,12,12,0.6)" : "rgba(255,255,255,0.92)",
            backdropFilter: "blur(6px)",
            boxShadow: 24,
            border: "1px solid rgba(13,110,253,0.06)",
          }}
          role="dialog"
          aria-modal="true"
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Create Deployment</Typography>
            <IconButton onClick={closeModal}><CloseIcon /></IconButton>
          </Stack>

          <Suspense fallback={<Typography color="text.secondary">Loading deployment form...</Typography>}>
            <CreateDeploymentModal initialData={modalInitial} onCancel={closeModal} onCreate={handleCreated} />
          </Suspense>
        </Box>
      </Modal>
    </Box>
  );
}
