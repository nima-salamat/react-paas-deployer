import React, { memo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import { LuCpu, LuDatabase, LuHardDrive, LuMemoryStick } from "react-icons/lu";

import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import HubIcon from "@mui/icons-material/Hub";

import AppsIcon from "@mui/icons-material/Apps";
import ShareIcon from "@mui/icons-material/Share";
import { RULE_LABELS } from "./ShareServiceDialog";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { resolveServiceKind, resolveUsage, getKey } from "./helpers";
import ServicePlatformBadge from "../ServicePlatformBadge.jsx";
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
  onPrefetch = null,
  shareMeta = null, // { shareId, isOwnerShare, isReceived, permissions, label }
  onShare = null,
  onManageShare = null,
  onUnshare = null,
  onRestart = null,
  onLeaveShare = null,
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
  const platformLabel = String(plan?.platform || s.platform || "").toLowerCase();
  const status = String(s.status || "").toLowerCase();
  const isUpdating = ["updating...", "queued", "deploying", "stopping"].includes(
    status
  );
  const isRunning = status === "running";
  const isFailed = ["failed", "error"].includes(status);
  const statusColor = isRunning ? "success" : isUpdating ? "warning" : isFailed ? "error" : "default";
  const statusLabel = status
    ? status.replace(/[_-]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase())
    : "Unknown";
  const isCatalogManaged = String(s?.source_kind || "").toLowerCase() === "catalog" || Boolean(s?.application_instance_id);
  const catalogId = String(s?.source_config?.catalog_id || s?.catalog_id || s?.application_instance?.catalog_id || "").trim();
  const catalogLabel = catalogId ? catalogId.replace(/-with-(postgres|postgresql|mariadb|mysql|worker|redis)/gi, "").replace(/[-_]+/g, " ") : "Managed app";

  const usage = resolveUsage(
    statusEntry
      ? {
          ...s,
          ...(statusEntry.cpu != null ? { cpu_percent: statusEntry.cpu } : {}),
          ...(statusEntry.ram != null ? { memory_percent: statusEntry.ram } : {}),
        }
      : s,
    {}
  );

  const cpuUsageLoading =
    usage.cpu == null && (!statusEntry || statusEntry.loading);
  const ramUsageLoading =
    usage.ram == null && (!statusEntry || statusEntry.loading);

  const kindChip = (
    <ServicePlatformBadge
      platformKey={platformLabel || (isDb ? "database" : "application")}
      typeLabel={isCatalogManaged ? "Ready App" : isDb ? "Database" : "Application"}
      platformLabel={isCatalogManaged ? catalogLabel : platformLabel || "Unknown platform"}
      isDatabase={isDb}
      isReadyApp={isCatalogManaged}
    />
  );

  const metaChips = (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {cpu != null && (
        <Chip
          size="small"
          icon={<LuCpu size={13} />}
          label={`${cpu} CPU`}
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
      {ram != null && (
        <Chip
          size="small"
          icon={<LuMemoryStick size={13} />}
          label={`${ram} MB`}
          sx={{ height: 22, fontSize: 11 }}
        />
      )}
      {storage != null && (
        <Chip
          size="small"
          icon={<LuHardDrive size={13} />}
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
        
      }}
    >
      <UsageBar label="CPU" value={usage.cpu} loading={cpuUsageLoading} error={statusEntry?.error} dense />
      <UsageBar label="RAM" value={usage.ram} loading={ramUsageLoading} error={statusEntry?.error} dense />
    </Stack>
  );

  const isReceived = Boolean(shareMeta?.isReceived);
  const perms = shareMeta?.permissions || {};
  const canStart = isReceived ? !!perms.can_start : true;
  const canStop = isReceived ? !!perms.can_stop : true;
  const canRestart = isReceived ? !!perms.can_restart : true;
  const showStartStop = !isCatalogManaged && (!isReceived || canStart || canStop);
  const [myPermsOpen, setMyPermsOpen] = useState(false);

  const actionBtnSx = {
    borderRadius: 1.5,
    textTransform: "none",
    fontWeight: 700,
    minWidth: 0,
    flex: "1 1 calc(50% - 4px)",
    py: 0.85,
    fontSize: { xs: 12.5, sm: 13 },
  };

  const actions = (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.75,
        width: "100%",
      }}
    >
      {showStartStop && (
      <Button
        size="small"
        variant="contained"
        color={isRunning ? "error" : "success"}
        disabled={
          isUpdating ||
          (isRunning ? !canStop : !canStart)
        }
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
      )}
      <Button
        size="small"
        variant="contained"
        startIcon={<ArrowForwardRoundedIcon fontSize="small" />}
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(s);
        }}
        sx={actionBtnSx}
      >
        Details
      </Button>
      {isCatalogManaged ? (
        <Button
          size="small"
          variant="outlined"
          color="primary"
          component={RouterLink}
          to={s.application_instance_id
            ? "/dashboard/ready-apps/installations/" + encodeURIComponent(s.application_instance_id)
            : "/dashboard/ready-apps/installations"}
          startIcon={<AppsIcon fontSize="small" />}
          onClick={(e) => e.stopPropagation()}
          sx={actionBtnSx}
        >
          Manage Ready App
        </Button>
      ) : (
        <>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(s);
            }}
            sx={actionBtnSx}
            disabled={Boolean(shareMeta?.isReceived)}
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
            disabled={Boolean(shareMeta?.isReceived)}
          >
            Delete
          </Button>
        </>
      )}

      {(canRestart && onRestart && !isCatalogManaged) && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<RestartAltIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            onRestart?.(s);
          }}
          sx={actionBtnSx}
        >
          Restart
        </Button>
      )}
      {shareMeta?.isReceived && shareMeta?.shareId && onLeaveShare && !shareMeta?.isOwnerShare && (
        <Button
          size="small"
          variant="outlined"
          color="warning"
          startIcon={<LogoutIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            onLeaveShare?.(shareMeta);
          }}
          sx={actionBtnSx}
        >
          Leave share
        </Button>
      )}
      {!shareMeta?.isReceived && !isCatalogManaged && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<ShareIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            onShare?.(s);
          }}
          sx={actionBtnSx}
        >
          Share
        </Button>
      )}
      {shareMeta?.isOwnerShare && (
        <>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SettingsIcon fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              onManageShare?.(shareMeta);
            }}
            sx={actionBtnSx}
          >
            Rules
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<LinkOffIcon fontSize="small" />}
            onClick={(e) => {
              e.stopPropagation();
              onUnshare?.(shareMeta);
            }}
            sx={actionBtnSx}
          >
            Unshare
          </Button>
        </>
      )}
      {shareMeta?.isReceived && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<SettingsIcon fontSize="small" />}
          onClick={(e) => {
            e.stopPropagation();
            setMyPermsOpen(true);
          }}
          sx={actionBtnSx}
        >
          My permissions
        </Button>
      )}
    </Box>
  );

  const myPermsDialog = (
    <Dialog open={myPermsOpen} onClose={() => setMyPermsOpen(false)} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Your permissions</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Read-only. Only the person who shared this service can change rules.
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {Object.entries(perms)
            .filter(([k, v]) => k !== "daily_deploy_limit" && !!v)
            .map(([k]) => (
              <Chip key={k} size="small" label={RULE_LABELS[k] || k} color="primary" variant="outlined" />
            ))}
          {perms.daily_deploy_limit != null && (
            <Chip
              size="small"
              label={`Daily deploy limit: ${perms.daily_deploy_limit}`}
              color="secondary"
              variant="outlined"
            />
          )}
          {Object.entries(perms).filter(([k, v]) => k !== "daily_deploy_limit" && !!v).length === 0 && (
            <Typography variant="body2" color="text.secondary">No action permissions granted.</Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setMyPermsOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  );

  /* ─── Row layout ─── */
  if (layout === "row") {
    return (
      <>
        {myPermsDialog}
        <Paper elevation={0} onMouseEnter={() => onPrefetch?.(s)} onFocus={() => onPrefetch?.(s)}
          sx={{ p: { xs: 1.5, sm: 2 }, mb: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 1.25, md: 2 }}
            alignItems={{ xs: "stretch", md: "center" }}>
            <Box sx={{ flex: 1, minWidth: 0, containerType: "inline-size" }}>
              <Box sx={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr) auto",
                gridTemplateRows: "auto",
                alignItems: "center",
                columnGap: 1,
                rowGap: 0.7,
                width: "100%",
                minWidth: 0,
                containerType: "inline-size",
                "@container (max-width: 560px)": {
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gridTemplateRows: "auto auto",
                  alignItems: "start",
                  "& .service-item-name": { gridColumn: "1 / -1", gridRow: 2, mt: 0.15 },
                  "& .service-item-status": { gridColumn: 2, gridRow: 1, justifySelf: "end" },
                },
              }}>
                {kindChip}
                <Typography className="service-item-name" variant="subtitle1" title={s.name || "(no name)"} fontWeight={800}
                  sx={{ minWidth: 0, textAlign: "left", lineHeight: 1.25, overflowWrap: "anywhere",
                    display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
                  {s.name || "(no name)"}
                </Typography>
                <Stack className="service-item-status" direction="row" spacing={0.5} justifyContent="flex-end"
                  alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                  {shareMeta?.isReceived && <Chip size="small" color="secondary" label={shareMeta.label || "Shared"} sx={{ fontWeight: 700, height: 22 }} />}
                  {shareMeta?.adminOnly && <Chip size="small" color="warning" variant="outlined" label="Admins only" sx={{ fontWeight: 700, height: 22 }} />}
                  {shareMeta?.preset && <Chip size="small" variant="outlined" label={shareMeta.preset} sx={{ fontWeight: 700, height: 22 }} />}
                  {shareMeta?.isOwnerShare && <Chip size="small" color="info" variant="outlined" label="I shared" sx={{ fontWeight: 700, height: 22 }} />}
                  <Chip label={statusLabel} color={statusColor} size="small" sx={{ fontWeight: 700, height: 22, flexShrink: 0 }} />
                </Stack>
              </Box>
              <Typography variant="body2" color="text.secondary"
                sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 0.5, mt: 0.75,
                  textAlign: "left", overflowWrap: "anywhere", minWidth: 0 }}>
                <HubIcon sx={{ fontSize: 14, flexShrink: 0 }} />
                <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{networkName}</Box>
              </Typography>
              {metaChips}
              {usageBars}
            </Box>
            <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}>{actions}</Box>
          </Stack>
        </Paper>
      </>
    );
  }

  /* ─── Card layout ─── */
  return (
    <>
      {myPermsDialog}
      <Paper elevation={0} onMouseEnter={() => onPrefetch?.(s)} onFocus={() => onPrefetch?.(s)}
        sx={{
          width: "100%", height: "100%", minHeight: { xs: 220, sm: 240 },
          display: "flex", flexDirection: "column", borderRadius: 2.5, border: "1px solid",
          borderColor: "divider", overflow: "hidden",
          backgroundImage: (t) => t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.55), rgba(15,23,42,0.75))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
        }}>
        <Box sx={{ p: { xs: 1.5, sm: 2 }, flexGrow: 1, display: "flex", flexDirection: "column",
          minHeight: { xs: 140, sm: 150 }, minWidth: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ minWidth: 0 }}>
            {kindChip}
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end"
              flexWrap="wrap" useFlexGap sx={{ minWidth: 0, flexShrink: 0 }}>
              {shareMeta?.isReceived && <Chip size="small" color="secondary" label={shareMeta.label || "Shared"} sx={{ fontWeight: 700, height: 22 }} />}
              {shareMeta?.isOwnerShare && <Chip size="small" color="info" variant="outlined" label="I shared" sx={{ fontWeight: 700, height: 22 }} />}
              <Chip label={statusLabel} color={statusColor} size="small" sx={{ fontWeight: 700, height: 22, flexShrink: 0 }} />
            </Stack>
          </Stack>
          <Typography variant="subtitle1" title={s.name || "(no name)"} fontWeight={800}
            sx={{ mt: 1, minWidth: 0, minHeight: 26, textAlign: "left", lineHeight: 1.25, overflowWrap: "anywhere",
              display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
            {s.name || "(no name)"}
          </Typography>
          <Typography variant="caption" color="text.secondary"
            sx={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 0.35, mt: 0.65,
              minWidth: 0, textAlign: "left", overflowWrap: "anywhere" }}>
            <HubIcon sx={{ fontSize: 13, flexShrink: 0 }} />
            <Box component="span" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>{networkName}</Box>
          </Typography>
          {metaChips}
          {usageBars}
          <Box sx={{ flexGrow: 1 }} />
        </Box>
        <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, mt: "auto", borderTop: "1px solid",
          borderColor: "divider", bgcolor: (t) => t.palette.mode === "dark" ? "rgba(0,0,0,0.18)" : "rgba(15,23,42,0.02)" }}>
          {actions}
        </Box>
      </Paper>
    </>
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
  return a.cpu === b.cpu && a.ram === b.ram && a.running === b.running && a.loading === b.loading && a.error === b.error;
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
