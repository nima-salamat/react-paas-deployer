import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import ComputerRoundedIcon from "@mui/icons-material/ComputerRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import PlatformIcon from "../plans/PlatformIcon.jsx";

const PLANS_API = `https://${import.meta.env.VITE_API_BASE}/plans/`;

const normalizeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const planKey = (plan) =>
  String(
    plan?.id ??
      plan?.pk ??
      [plan?.platform, plan?.name, plan?.max_cpu, plan?.max_ram, plan?.price_per_hour].join("|")
  );

const formatPrice = (value) => {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `$${number >= 1 ? number.toFixed(2) : number.toFixed(3)}/hr`;
};

const formatStorage = (value) => {
  if (value == null || value === "") return null;
  return typeof value === "number" ? `${value} GB` : String(value);
};

function PreviewCard({ plan }) {
  const platform = plan?.platform ?? "Platform";
  const cpu = plan?.max_cpu ?? plan?.cpu;
  const ram = plan?.max_ram ?? plan?.ram;
  const storage = formatStorage(plan?.max_storage ?? plan?.storage ?? plan?.disk ?? plan?.storage_gb);
  const price = formatPrice(plan?.price_per_hour ?? plan?.price);

  return (
    <Paper
      elevation={0}
      sx={(theme) => ({
        height: "100%",
        p: { xs: 1.75, sm: 2 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.68 : 0.86),
        backdropFilter: "blur(14px)",
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: alpha(theme.palette.primary.main, 0.42),
          boxShadow: `0 18px 42px ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.08)}`,
        },
      })}
    >
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PlatformIcon platformKey={platform} label={platform} size={30} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 800 }}>
              {platform}
            </Typography>
            <Typography sx={{ fontWeight: 850, lineHeight: 1.2 }} noWrap>
              {plan?.name ?? "Unnamed plan"}
            </Typography>
          </Box>
        </Stack>

        <Stack spacing={0.9} sx={{ flex: 1 }}>
          {cpu != null && (
            <Stack direction="row" spacing={0.8} alignItems="center">
              <ComputerRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="body2">CPU {cpu}</Typography>
            </Stack>
          )}
          {ram != null && (
            <Stack direction="row" spacing={0.8} alignItems="center">
              <MemoryRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="body2">RAM {ram}</Typography>
            </Stack>
          )}
          {storage && (
            <Stack direction="row" spacing={0.8} alignItems="center">
              <StorageRoundedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
              <Typography variant="body2">Storage {storage}</Typography>
            </Stack>
          )}
        </Stack>

        {price && (
          <Typography sx={{ fontWeight: 900, fontSize: "1.02rem" }}>{price}</Typography>
        )}
      </Stack>
    </Paper>
  );
}

export default function PlansPreview() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    axios
      .get(PLANS_API, { params: { page: 1 }, signal: controller.signal })
      .then((response) => {
        if (!mounted) return;
        const unique = [];
        const seen = new Set();
        for (const plan of normalizeArray(response.data)) {
          const key = planKey(plan);
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(plan);
          }
        }
        setPlans(unique.slice(0, 6));
      })
      .catch((requestError) => {
        if (!mounted || axios.isCancel?.(requestError) || requestError?.name === "CanceledError") return;
        setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const platformCount = useMemo(
    () => new Set(plans.map((plan) => String(plan?.platform ?? "")).filter(Boolean)).size,
    [plans]
  );

  return (
    <Box component="section" id="plans" sx={{ scrollSnapAlign: { md: "start" }, scrollSnapStop: { md: "always" }, py: { xs: 7, md: 11 } }}>
      <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 3 } }}>
        <Paper
          elevation={0}
          sx={(theme) => ({
            position: "relative",
            overflow: "hidden",
            borderRadius: { xs: 3, md: 5 },
            p: { xs: 2, sm: 3, md: 5 },
            border: "1px solid",
            borderColor: alpha(theme.palette.primary.main, 0.14),
            background:
              theme.palette.mode === "dark"
                ? "linear-gradient(145deg, rgba(14,24,39,.94), rgba(9,17,29,.72))"
                : "linear-gradient(145deg, rgba(255,255,255,.96), rgba(239,246,255,.9))",
            boxShadow: `0 24px 60px ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.08 : 0.06)}`,
          })}
        >
          <Box
            sx={{
              position: "absolute",
              inset: "-20% auto auto -10%",
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: (theme) => `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.15)}, transparent 68%)`,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            spacing={2}
            sx={{ position: "relative", zIndex: 1 }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                    color: "primary.main",
                  }}
                >
                  <LayersOutlinedIcon fontSize="small" />
                </Box>
                <Chip label="Plans" size="small" sx={{ fontWeight: 850 }} />
                {platformCount > 0 && <Chip label={`${platformCount} platforms`} size="small" variant="outlined" />}
              </Stack>
              <Typography
                component="h2"
                sx={{
                  fontWeight: 950,
                  fontSize: { xs: "clamp(1.9rem, 7vw, 2.8rem)", md: "3.6rem" },
                  lineHeight: 1,
                  letterSpacing: "-.055em",
                  maxWidth: 820,
                }}
              >
                Choose the resources that fit your workload.
              </Typography>
              <Typography sx={{ mt: 1.5, maxWidth: 760, lineHeight: 1.75 }} color="text.secondary">
                Compare compute, memory and storage plans directly from the homepage. Open the full Plans workspace for all platforms, filters, and service creation.
              </Typography>
            </Box>

            <Button
              component={RouterLink}
              to="/plans"
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{ borderRadius: 999, px: 2.3, minHeight: 46, fontWeight: 850, flexShrink: 0 }}
            >
              View all plans
            </Button>
          </Stack>

          <Box
            sx={{
              position: "relative",
              zIndex: 1,
              mt: { xs: 3.5, md: 5 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
              gap: 2,
            }}
          >
            {loading ? (
              <Box sx={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            ) : error ? (
              <Box sx={{ gridColumn: "1 / -1", textAlign: "center", py: 4 }}>
                <Typography sx={{ fontWeight: 750 }}>Plans are temporarily unavailable.</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  The complete Plans page is still available from the navigation.
                </Typography>
              </Box>
            ) : plans.length ? (
              plans.map((plan) => <PreviewCard key={planKey(plan)} plan={plan} />)
            ) : (
              <Box sx={{ gridColumn: "1 / -1", textAlign: "center", py: 4 }}>
                <Typography sx={{ fontWeight: 750 }}>No plans are available right now.</Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
