import React, { memo } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LaunchIcon from "@mui/icons-material/Launch";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import ComputerIcon from "@mui/icons-material/Computer";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import HubIcon from "@mui/icons-material/Hub";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import AppsIcon from "@mui/icons-material/Apps";
import { resolveServiceKind, resolveUsage, getKey } from "./helpers";
import UsageBar from "./UsageBar";

const btnSx = {
  borderRadius: 1.5,
  textTransform: "none",
  fontWeight: 600,
  height: 34,
  minWidth: 0,
};

function ServiceItem({
  s,
  layout = "card",
  isReadOnly = false,
  planCache = {},
  networkCache = {},
  statusEntry = null,
  onToggleStatus,
  onEdit,
  onDelete,
  onOpen,
}) {
  const planIsObj = s.plan && typeof s.plan === "object";
  const netIsObj = s.network && typeof s.network === "object";
  const planId = planIsObj ? s.plan.id ?? s.plan.pk : s.plan;
  const networkId = netIsObj ? s.network.id ?? s.network.pk : s.network;

  const networkName = netIsObj
    ? s.network.name
    : networkCache[networkId]?.name ?? "—";
  const plan = planIsObj ? s.plan : planCache[planId];
  const cpu = plan?.max_cpu;
  const ram = plan?.max_ram;
  const storage = plan?.max_storage;
  const price = plan?.price_per_hour;

  const kind = resolveServiceKind(s, planCache);
  const isDb = kind === "db";
  const platformLabel = String(plan?.platform || "").toLowerCase();
  const status = String(s.status || "").toLowerCase();
  const isUpdating = ["updating...", "queued", "deploying", "stopping"].includes(
    status
  );
  const isRunning = status === "running";
  const statusColor = isRunning ? "success" : isUpdating ? "warning" : "default";

  // Prefer live status entry over nested object lookup (stable prop)
  const usage = resolveUsage(
    statusEntry
      ? { ...s, cpu_percent: statusEntry.cpu, memory_percent: statusEntry.ram }
      : s,
    {}
  );

  const kindChip = (
    <Chip
      size="small"
      icon={
        isDb ? (
          <StorageOutlinedIcon sx={{ fontSize: 14 }} />
        ) : (
          <AppsIcon sx={{ fontSize: 14 }} />
        )
      }
      label={
        isDb
          ? platformLabel
            ? `DB · ${platformLabel}`
            : "Database"
          : platformLabel
          ? `App · ${platformLabel}`
          : "App"
      }
      color={isDb ? "info" : "default"}
      variant={isDb ? "filled" : "outlined"}
      sx={{ height: 24, fontWeight: 700, fontSize: 11 }}
    />
  );

  const stats = (
    <Box sx={{ mt: layout === "row" ? 0 : 1.5 }}>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {cpu != null && (
          <Chip
            size="small"
            icon={<ComputerIcon sx={{ fontSize: 14 }} />}
            label={`${cpu} CPU`}
            sx={{ height: 24 }}
          />
        )}
        {ram != null && (
          <Chip
            size="small"
            icon={<MemoryIcon sx={{ fontSize: 14 }} />}
            label={`${ram} MB`}
            sx={{ height: 24 }}
          />
        )}
        {storage != null && (
          <Chip
            size="small"
            icon={<StorageIcon sx={{ fontSize: 14 }} />}
            label={`${storage} GB`}
            sx={{ height: 24 }}
          />
        )}
        {price != null && (
          <Chip
            size="small"
            icon={<AttachMoneyIcon sx={{ fontSize: 14 }} />}
            label={`${price}/hr`}
            color="success"
            variant="outlined"
            sx={{ height: 24 }}
          />
        )}
      </Stack>
      {(usage.cpu != null || usage.ram != null) && (
        <Stack direction="row" spacing={1.5} sx={{ mt: 1.25 }}>
          <UsageBar label="CPU" value={usage.cpu} dense />
          <UsageBar label="RAM" value={usage.ram} dense />
        </Stack>
      )}
    </Box>
  );

  const actions = !isReadOnly && (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
      <Button
        size="small"
        variant="contained"
        color={isRunning ? "error" : "success"}
        disabled={isUpdating}
        startIcon={
          isRunning ? <StopIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />
        }
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus?.(s, s.status);
        }}
        sx={{ ...btnSx, minWidth: 88 }}
      >
        {isUpdating ? "…" : isRunning ? "Stop" : "Start"}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(s);
        }}
        sx={{ ...btnSx, minWidth: 72 }}
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
          onDelete?.(s.id ?? s.pk);
        }}
        sx={{ ...btnSx, minWidth: 80 }}
      >
        Delete
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<LaunchIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(s);
        }}
        sx={{ ...btnSx, minWidth: 76 }}
      >
        Open
      </Button>
    </Stack>
  );

  if (layout === "row") {
    return (
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 2,
          mb: 1.25,
          flexWrap: "wrap",
          gap: 1.5,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box sx={{ flex: 1, minWidth: 160 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" fontWeight={800}>
              {s.name || "(no name)"}
            </Typography>
            {kindChip}
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <HubIcon sx={{ fontSize: 14 }} /> {networkName}
          </Typography>
        </Box>
        <Box sx={{ flex: 2, minWidth: 200 }}>{stats}</Box>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <Chip
            label={s.status ?? "unknown"}
            color={statusColor}
            size="small"
            sx={{ fontWeight: 700, height: 24 }}
          />
          {actions}
        </Box>
      </Paper>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.5), rgba(15,23,42,0.7))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
      }}
    >
      <Box sx={{ p: 2, flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 0.35 }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.25,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  bgcolor: (t) =>
                    isDb
                      ? t.palette.mode === "dark"
                        ? "rgba(6,182,212,0.2)"
                        : "rgba(6,182,212,0.12)"
                      : t.palette.mode === "dark"
                      ? "rgba(99,102,241,0.2)"
                      : "rgba(99,102,241,0.1)",
                  color: isDb ? "info.main" : "primary.main",
                }}
              >
                {isDb ? (
                  <StorageOutlinedIcon sx={{ fontSize: 18 }} />
                ) : (
                  <AppsIcon sx={{ fontSize: 18 }} />
                )}
              </Box>
              <Typography variant="subtitle1" fontWeight={800} noWrap>
                {s.name || "(no name)"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              {kindChip}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                <HubIcon sx={{ fontSize: 14 }} /> {networkName}
              </Typography>
            </Stack>
          </Box>
          <Chip
            label={s.status ?? "unknown"}
            color={statusColor}
            size="small"
            sx={{ fontWeight: 700, height: 24, flexShrink: 0 }}
          />
        </Box>
        {stats}
      </Box>
      {!isReadOnly && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.02)",
          }}
        >
          {actions}
        </Box>
      )}
    </Paper>
  );
}

function shallowServiceEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    getKey(a) === getKey(b) &&
    a.name === b.name &&
    a.status === b.status &&
    a.plan === b.plan &&
    a.network === b.network
  );
}

function statusEntryEqual(a, b) {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.cpu === b.cpu && a.ram === b.ram && a.running === b.running;
}

export default memo(ServiceItem, (prev, next) => {
  if (prev.layout !== next.layout) return false;
  if (prev.isReadOnly !== next.isReadOnly) return false;
  if (!shallowServiceEqual(prev.s, next.s)) return false;
  if (!statusEntryEqual(prev.statusEntry, next.statusEntry)) return false;
  // plan/network caches: only care about THIS service's entries
  const planIsObj = next.s?.plan && typeof next.s.plan === "object";
  const netIsObj = next.s?.network && typeof next.s.network === "object";
  const planId = planIsObj ? next.s.plan.id ?? next.s.plan.pk : next.s?.plan;
  const networkId = netIsObj ? next.s.network.id ?? next.s.network.pk : next.s?.network;
  if (planId != null && prev.planCache?.[planId] !== next.planCache?.[planId]) return false;
  if (networkId != null && prev.networkCache?.[networkId] !== next.networkCache?.[networkId])
    return false;
  return true;
});
