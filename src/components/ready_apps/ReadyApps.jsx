import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Container,
  InputAdornment,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import apiRequest from "../customHooks/apiRequest";

const API_ROOT =
  "https://" +
  String(import.meta.env.VITE_API_BASE || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
const CATALOG_ROOT = API_ROOT + "/api/application-catalog";

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function AppLogo({ app, size = 58 }) {
  const [failed, setFailed] = useState(false);
  const logo = String(app?.logo || "");
  const label = String(app?.name || "?").trim().charAt(0).toUpperCase() || "A";

  return (
    <Box
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 2.4,
        display: "grid",
        placeItems: "center",
        position: "relative",
        overflow: "hidden",
        background:
          theme.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(81,129,255,.28), rgba(126,87,255,.12))"
            : "linear-gradient(145deg, rgba(81,129,255,.12), rgba(126,87,255,.08))",
        border: "1px solid",
        borderColor: alpha(theme.palette.primary.main, 0.18),
        boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(120deg, rgba(255,255,255,.14), transparent 48%)",
          pointerEvents: "none",
        },
      })}
    >
      {!failed && (/^https?:\/\//i.test(logo) || /^\//.test(logo)) ? (
        <Box
          component="img"
          src={logo}
          alt=""
          onError={() => setFailed(true)}
          sx={{
            width: "68%",
            height: "68%",
            objectFit: "contain",
            position: "relative",
            zIndex: 1,
          }}
        />
      ) : (
        <AppsRoundedIcon sx={{ fontSize: size * 0.47, color: "primary.main", position: "relative", zIndex: 1 }} />
      )}
    </Box>
  );
}

function AppCard({ app }) {
  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        height: "100%",
        borderRadius: 2.5,
        borderColor: alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.75 : 0.9),
        backgroundColor: theme.palette.background.paper,
        overflow: "hidden",
        transition: "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-4px)",
          borderColor: alpha(theme.palette.primary.main, 0.34),
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 18px 50px rgba(0,0,0,.24)"
              : "0 18px 50px rgba(26,39,73,.10)",
        },
      })}
    >
      <CardActionArea
        component={RouterLink}
        to={"/dashboard/ready-apps/" + encodeURIComponent(app.id)}
        sx={{ height: "100%" }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 2.6 }, minHeight: 235, display: "flex", flexDirection: "column" }}>
          <Stack direction="row" spacing={1.6} alignItems="center">
            <AppLogo app={app} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 800 }}
              >
                {app.category || "Application"}
              </Typography>
              <Typography
                component="h2"
                variant="h6"
                sx={{ fontWeight: 900, letterSpacing: "-.02em", mt: .15 }}
                noWrap
              >
                {app.name}
              </Typography>
            </Box>
          </Stack>

          <Typography
            color="text.secondary"
            sx={{
              mt: 2,
              lineHeight: 1.6,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {app.description || "A curated application, ready to deploy."}
          </Typography>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: "auto", pt: 2.6 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {app.software_version ? "v" + app.software_version : "Managed runtime"}
            </Typography>
            <Stack direction="row" spacing={.55} alignItems="center" sx={{ color: "primary.main", fontWeight: 850 }}>
              <Typography variant="body2" sx={{ fontWeight: 850 }}>Install</Typography>
              <ArrowForwardRoundedIcon sx={{ fontSize: 17 }} />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default function ReadyApps() {
  const [apps, setApps] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ method: "GET", url: CATALOG_ROOT + "/apps/" });
      setApps(normalizeList(response.data));
    } catch (err) {
      setError(String(err?.response?.data?.detail || err?.response?.data?.error || "Couldn't load the app library."));
    } finally {
      if (background) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!error || loading || refreshing) return undefined;
    const timer = window.setTimeout(() => load(true), 12000);
    return () => window.clearTimeout(timer);
  }, [error, loading, refreshing, load]);

  const visibleApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...apps]
      .filter((app) => {
        if (!needle) return true;
        const haystack = [
          app?.name,
          app?.description,
          app?.category,
          ...(app?.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
  }, [apps, query]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 4.5 } }}>
      <Stack spacing={3.25}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-end" }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{ fontSize: { xs: 30, md: 42 }, lineHeight: 1.05, fontWeight: 950, letterSpacing: "-.045em" }}
            >
              App Library
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 520 }}>
              Pick an app. Configure it. Ship it.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems="stretch">
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => load(true)}
              disabled={loading || refreshing}
              sx={{ borderRadius: 2, px: 1.7, py: 1, fontWeight: 800 }}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps/installations"
              variant="outlined"
              startIcon={<Inventory2OutlinedIcon />}
              sx={{
                borderRadius: 2,
                px: 1.7,
                py: 1,
                fontWeight: 850,
              }}
            >
              Deployed Apps
            </Button>
          </Stack>
        </Stack>

        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search apps"
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            maxWidth: 560,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              bgcolor: "background.paper",
            },
          }}
        />

        {error && (
          <Alert
            severity="error"
            sx={{ borderRadius: 2.2 }}
            action={<Button color="inherit" size="small" onClick={() => load(true)} disabled={loading || refreshing}>Retry</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2 }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} variant="outlined" sx={{ borderRadius: 2.5, p: 2.5 }}>
                <Stack spacing={1.5}>
                  <Skeleton variant="rounded" width={58} height={58} />
                  <Skeleton variant="rounded" width="52%" height={28} />
                  <Skeleton variant="rounded" width="90%" height={18} />
                  <Skeleton variant="rounded" width="76%" height={18} />
                </Stack>
              </Card>
            ))}
          </Box>
        ) : error && apps.length === 0 ? (
          <Card variant="outlined" sx={{ borderRadius: 2.5, p: { xs: 3.5, md: 5.5 }, textAlign: "center" }}>
            <AppsRoundedIcon sx={{ fontSize: 42, color: "text.disabled" }} />
            <Typography sx={{ mt: 1.4, fontWeight: 900 }}>App library unavailable</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>We couldn’t retrieve the app catalog.</Typography>
            <Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={() => load(true)} disabled={refreshing} sx={{ mt: 2, borderRadius: 2 }}>Try again</Button>
          </Card>
        ) : visibleApps.length === 0 ? (
          <Card
            variant="outlined"
            sx={{ borderRadius: 2.5, p: { xs: 3.5, md: 5.5 }, textAlign: "center" }}
          >
            <AppsRoundedIcon sx={{ fontSize: 42, color: "text.disabled" }} />
            <Typography sx={{ mt: 1.4, fontWeight: 900 }}>
              {query ? "No matching apps" : "No apps available"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>
              {query ? "Try a different search." : "The library is empty right now."}
            </Typography>
          </Card>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" },
              gap: 2,
            }}
          >
            {visibleApps.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </Box>
        )}
      </Stack>
    </Container>
  );
}
