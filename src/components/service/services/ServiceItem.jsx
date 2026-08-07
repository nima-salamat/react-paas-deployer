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
      sx={{ height: 22, fontWeight: 700, fontSize: 11 }}
    />
  );

  const metaChips = (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {cpu != null && (
        <Chip
          size="small"
          icon={<ComputerIcon sx={{ fontSize: 13 }} />}
          label={`${cpu} CPU`}
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
      {ram != null && (
        <Chip
          size="small"
          icon={<MemoryIcon sx={{ fontSize: 13 }} />}
          label={`${ram} MB`}
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
      {storage != null && (
        <Chip
          size="small"
          icon={<StorageIcon sx={{ fontSize: 13 }} />}
          label={`${storage} GB`}
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
      {price != null && (
        <Chip
          size="small"
          icon={<AttachMoneyIcon sx={{ fontSize: 13 }} />}
          label={`${price}/hr`}
          color="success"
          variant="outlined"
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
    </Stack>
  );

  const usageBars = (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        mt: 1.25,
        minHeight: 28,
        visibility: usage.cpu != null || usage.ram != null ? "visible" : "hidden",
      }}
    >
      <UsageBar label="CPU" value={usage.cpu ?? 0} dense />
      <UsageBar label="RAM" value={usage.ram ?? 0} dense />
    </Stack>
  );

  const actionBtnSx = {
    borderRadius: 1.5,
    textTransform: "none",
    fontWeight: 700,
    minWidth: 0,
    flex: "1 1 calc(50% - 4px)",
    py: 0.85,
    fontSize: { xs: 12.5, sm: 13 },
  };

  const actions = !isReadOnly && (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        width: "100%",
      }}
    >
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
        sx={actionBtnSx}
      >
        {isUpdating ? "…" : isRunning ? "Stop" : "Start"}
      </Button>
      <Button
        size="small"
        variant="contained"
        startIcon={<LaunchIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(s);
        }}
        sx={actionBtnSx}
      >
        Open
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(s);
        }}
        sx={actionBtnSx}
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
        sx={actionBtnSx}
      >
        Delete
      </Button>
    </Box>
  );

  /* ─── Row layout ─── */
  if (layout === "row") {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          mb: 1.25,
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={{ xs: 1.25, md: 2 }}
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.25 }}>
                {s.name || "(no name)"}
              </Typography>
              {kindChip}
              <Chip
                label={s.status ?? "unknown"}
                color={statusColor}
                size="small"
                sx={{ fontWeight: 700, height: 22 }}
              />
            </Stack>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.35 }}
            >
              <HubIcon sx={{ fontSize: 14 }} /> {networkName}
            </Typography>
            {metaChips}
            {usageBars}
          </Box>
          <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}>{actions}</Box>
        </Stack>
      </Paper>
    );
  }

  /* ─── Card layout ─── */
  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        height: "100%",
        minHeight: { xs: 220, sm: 240 },
        display: "flex",
        flexDirection: "column",
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.55), rgba(15,23,42,0.75))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
      }}
    >
      <Box
        sx={{
          p: { xs: 1.5, sm: 2 },
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: { xs: 140, sm: 150 },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
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
                <StorageOutlinedIcon sx={{ fontSize: 20 }} />
              ) : (
                <AppsIcon sx={{ fontSize: 20 }} />
              )}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                fontWeight={800}
                sx={{
                  lineHeight: 1.25,
                  wordBreak: "break-word",
                }}
              >
                {s.name || "(no name)"}
              </Typography>
              <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                {kindChip}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.35 }}
                >
                  <HubIcon sx={{ fontSize: 13 }} /> {networkName}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <Chip
            label={s.status ?? "unknown"}
            color={statusColor}
            size="small"
            sx={{ fontWeight: 700, height: 22, flexShrink: 0 }}
          />
        </Stack>

        {metaChips}
        {usageBars}
        <Box sx={{ flexGrow: 1 }} />
      </Box>

      {!isReadOnly && (
        <Box
          sx={{
            px: { xs: 1.25, sm: 1.5 },
            py: 1.25,
            mt: "auto",
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: (t) =>
              t.palette.mode === "dark" ? "rgba(0,0,0,0.18)" : "rgba(15,23,42,0.02)",
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
  const planIsObj = next.s?.plan && typeof next.s.plan === "object";
  const netIsObj = next.s?.network && typeof next.s.network === "object";
  const planId = planIsObj ? next.s.plan.id ?? next.s.plan.pk : next.s?.plan;
  const networkId = netIsObj ? next.s.network.id ?? next.s.network.pk : next.s?.network;
  if (planId != null && prev.planCache?.[planId] !== next.planCache?.[planId]) return false;
  if (networkId != null && prev.networkCache?.[networkId] !== next.networkCache?.[networkId])
    return false;
  return true;
});
