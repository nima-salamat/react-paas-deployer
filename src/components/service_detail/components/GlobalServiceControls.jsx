import React, { useCallback, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  Stack,
  Chip,
  LinearProgress,
  useTheme,
  Divider,
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox,
  Alert,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkIcon from "@mui/icons-material/Launch";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import HubIcon from "@mui/icons-material/Hub";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import CancelIcon from "@mui/icons-material/Cancel";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = useCallback(async (text, key) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  }, []);
  return { copied, copy };
}

function CopyBtn({ value, k, title, copied, onCopy }) {
  if (!value) return null;
  return (
    <Tooltip title={copied === k ? "Copied!" : title}>
      <IconButton
        size="small"
        onClick={() => onCopy(value, k)}
        sx={{ p: 0.35 }}
        aria-label={title}
      >
        {copied === k ? (
          <CheckIcon sx={{ fontSize: 16, color: "success.main" }} />
        ) : (
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}

/** service_name = docker label, service_host = label.DEPLOYMENT_DOMAIN */
function ServiceIdentity({ service, onCopied }) {
  const { copied, copy } = useCopy();
  const handle = (v, k) => {
    copy(v, k);
    onCopied?.(k, v);
  };

  const serviceName = service?.service_name || null;
  const serviceHost = service?.service_host || null;

  if (!serviceName && !serviceHost) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }

  return (
    <Stack spacing={0.35}>
      {serviceHost ? (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 12.5,
              wordBreak: "break-all",
            }}
          >
            {serviceHost}
          </Typography>
          <CopyBtn
            value={serviceHost}
            k="host"
            title="Copy host"
            copied={copied}
            onCopy={handle}
          />
        </Stack>
      ) : null}
      {serviceName ? (
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Service name:{" "}
            <Box
              component="span"
              sx={{
                fontFamily: "ui-monospace, monospace",
                fontWeight: 700,
                color: "text.primary",
              }}
            >
              {serviceName}
            </Box>
          </Typography>
          <CopyBtn
            value={serviceName}
            k="name"
            title="Copy service name"
            copied={copied}
            onCopy={handle}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function GlobalServiceControls({
  service,
  serviceRunning,
  serviceCpu,
  serviceRam,
  serviceLoading,
  serviceBusy,
  serviceStatusLoadingManual,
  selectedDeploy,
  selectedDeployId,
  selectedIsDb,
  selectedPlatform,
  deployCount,
  volumeCount,
  networkName,
  rebuildLoading,
  forceCancelLoading = false,
  actions,
  onCopyFeedback,
  compact = false,
}) {
  const theme = useTheme();
  const {
    startService,
    stopService,
    rebuildService,
    forceCancelDeploy,
    checkServiceRunning,
    openServiceInNewTab,
  } = actions;

  // ---------------------------------------------------------------------
  // Force re-init toggle (DB platforms only).
  //
  // When checked, the next click on "Rebuild DB" will send
  // ?force_reinit=true to the rebuild endpoint. The backend then wipes
  // every named Docker volume bound to this DB BEFORE starting the
  // container, so the database reinitialises from scratch.
  //
  // Use case: a previous deploy failed mid-init and left corrupt data in
  // the volume (typical symptom: container starts, mysqld silently dies
  // 2 seconds after "InnoDB initialization has started", Docker
  // restart_policy kicks in every ~60s — restart loop). A normal rebuild
  // preserves the volume and keeps failing; force re-init wipes it.
  //
  // Host-bind paths (starting with "/") are NEVER wiped — only named
  // Docker volumes managed by the platform. (Enforced in db_deployer.py.)
  // ---------------------------------------------------------------------
  const [forceReinit, setForceReinit] = useState(false);

  const handleRebuildClick = () => {
    if (typeof rebuildService !== "function") return;
    rebuildService({ forceReinit });
    // Reset the toggle right after triggering so the operator doesn't
    // accidentally wipe the volume again on the next rebuild.
    setForceReinit(false);
  };

  const colorForPercent = (p) => {
    const pct = Number(p) || 0;
    if (pct >= 90) return theme.palette.error.main;
    if (pct >= 70) return theme.palette.warning.main;
    if (pct >= 40) return theme.palette.success.main;
    return theme.palette.primary.main;
  };

  const statusLabel =
    serviceRunning === true
      ? "Running"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? String(service.status)
      : serviceRunning === false
      ? "Stopped"
      : service?.status || "Unknown";

  const statusColor =
    serviceRunning === true ||
    ["running", "success"].includes(String(service?.status || ""))
      ? "success"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? "warning"
      : "default";

  const canOpen = Boolean(service?.service_host || service?.service_name) && !selectedIsDb;

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? { xs: 1.5, sm: 2 } : { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        mb: compact ? 1.5 : 2.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
      }}
    >
      {!compact ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 1.5,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
                mb: 0.5,
              }}
            >
              {service?.name || "Service"}
            </Typography>
            <ServiceIdentity service={service} onCopied={onCopyFeedback} />
          </Box>
          <Chip
            label={statusLabel}
            color={statusColor}
            size="medium"
            sx={{ fontWeight: 700, height: 28 }}
          />
        </Box>
      ) : (
        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700, mb: 1.25 }}>
          Controls
        </Typography>
      )}

      <Stack
        direction={{ xs: compact ? "row" : "column", sm: "row" }}
        spacing={1}
        sx={{ mb: compact ? 1.5 : 2.5 }}
        flexWrap={compact ? "wrap" : "nowrap"}
        useFlexGap
      >

        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => startService()}
          disabled={!service || serviceLoading || serviceBusy || !selectedDeployId}
          fullWidth={!compact}
          size={compact ? "small" : "medium"}
          sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
        >
          Start
        </Button>
        <Button
          variant="outlined"
          color={forceReinit ? "error" : "warning"}
          startIcon={<RefreshIcon />}
          onClick={handleRebuildClick}
          disabled={
            !service || serviceLoading || serviceBusy || rebuildLoading || !selectedDeployId
          }
          fullWidth={!compact}
          size={compact ? "small" : "medium"}
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
        >
          {rebuildLoading
            ? "Rebuilding..."
            : selectedIsDb
              ? (forceReinit ? "Rebuild DB (wipe volume)" : "Rebuild DB")
              : "Rebuild"}
        </Button>
        {serviceBusy || forceCancelLoading ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => forceCancelDeploy?.()}
            disabled={!service || forceCancelLoading || !forceCancelDeploy}
            fullWidth={!compact}
            size={compact ? "small" : "medium"}
            title="Stop deploy immediately and remove intermediate containers/images"
            sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
          >
            {forceCancelLoading ? "Cancelling..." : "Force cancel"}
          </Button>
        ) : null}
        <Button
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={stopService}
          disabled={!service || serviceLoading || serviceBusy}
          fullWidth={!compact}
          size={compact ? "small" : "medium"}
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
        >
          Stop
        </Button>
        <Button
          variant="outlined"
          onClick={() => checkServiceRunning(false)}
          disabled={!service || serviceStatusLoadingManual}
          fullWidth={!compact}
          size={compact ? "small" : "medium"}
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
        >
          {serviceStatusLoadingManual ? "Checking..." : "Check status"}
        </Button>
        <Button
          variant="outlined"
          onClick={openServiceInNewTab}
          disabled={!canOpen}
          startIcon={<LinkIcon />}
          fullWidth={!compact}
          size={compact ? "small" : "medium"}
          title={selectedIsDb ? "DB services are not opened in browser" : undefined}
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: compact ? 0.75 : 1, flex: compact ? "1 1 40%" : undefined, minWidth: compact ? 0 : undefined }}
        >
          Open
        </Button>
      </Stack>

      {/* ----------------------------------------------------------------- */}
      {/* Force re-init toggle — DB platforms only.                          */}
      {/* Shows a warning Alert explaining the destructive action, with a    */}
      {/* Checkbox the operator must tick before clicking "Rebuild DB".      */}
      {/* ----------------------------------------------------------------- */}
      {selectedIsDb && selectedDeployId ? (
        <Alert
          severity={forceReinit ? "error" : "warning"}
          icon={<WarningAmberIcon fontSize="small" />}
          sx={{
            mb: compact ? 1.5 : 2,
            borderRadius: 1.5,
            alignItems: "center",
            // Subtle pulsing border when armed to draw the eye.
            ...(forceReinit
              ? {
                  border: "1px solid",
                  borderColor: "error.main",
                  boxShadow: (t) =>
                    t.palette.mode === "dark"
                      ? "0 0 0 1px rgba(244,67,54,0.35)"
                      : "0 0 0 1px rgba(244,67,54,0.25)",
                }
              : {}),
          }}
          action={
            <FormControlLabel
              control={
                <Checkbox
                  checked={forceReinit}
                  onChange={(e) => setForceReinit(e.target.checked)}
                  size="small"
                  color="error"
                  disabled={rebuildLoading || serviceBusy}
                />
              }
              label={
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                  Force re-initialize
                </Typography>
              }
              sx={{ mr: 0, ml: 1 }}
            />
          }
        >
          <Typography variant="caption" component="div" sx={{ lineHeight: 1.45 }}>
            {forceReinit ? (
              <>
                <strong>Danger zone.</strong> The next "Rebuild DB" click will{" "}
                <strong>wipe the data volume(s)</strong> and reinitialize the
                database from scratch. <strong>All data will be lost.</strong>{" "}
                Use this only when a previous deploy failed mid-init and left
                corrupt data (typical symptom: container restart loop with
                mysqld silently dying right after "InnoDB initialization has
                started").
              </>
            ) : (
              <>
                Tick this to wipe the data volume on the next rebuild. Useful
                when the DB is stuck in a restart loop after a failed init.
                Normal rebuilds preserve data.
              </>
            )}
          </Typography>
        </Alert>
      ) : null}

      {!compact ? (
        <>
      <Stack direction="row" spacing={1} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
            <Chip
              icon={<Inventory2Icon sx={{ fontSize: 16 }} />}
              label={`Deploys: ${deployCount}`}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            />
            <Chip
              icon={<StorageIcon sx={{ fontSize: 16 }} />}
              label={`Volumes: ${volumeCount}`}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            />
            <Chip
              icon={<HubIcon sx={{ fontSize: 16 }} />}
              label={`Network: ${networkName}`}
              size="small"
              variant="outlined"
              sx={{ borderRadius: 1.5 }}
            />
            {selectedDeploy ? (
              <Chip
                label={`Selected: ${selectedDeploy.name || selectedDeploy.id}`}
                size="small"
                color="success"
                sx={{ borderRadius: 1.5, fontWeight: 600 }}
              />
            ) : null}
            {selectedPlatform ? (
              <Chip
                label={`${selectedIsDb ? "DB" : "App"} · ${selectedPlatform}`}
                size="small"
                color={selectedIsDb ? "info" : "default"}
                variant="outlined"
                sx={{ borderRadius: 1.5 }}
              />
            ) : null}
          </Stack>

          <Divider sx={{ mb: 2 }} />
        </>
      ) : null}


      <Stack spacing={1.5}>
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <MemoryIcon sx={{ fontSize: 14 }} /> CPU
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {serviceCpu !== null ? `${serviceCpu}%` : "—"}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(Math.max(serviceCpu || 0, 0), 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "grey.200",
              "& .MuiLinearProgress-bar": {
                bgcolor: colorForPercent(serviceCpu),
                borderRadius: 4,
              },
            }}
          />
        </Box>
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <MemoryIcon sx={{ fontSize: 14 }} /> RAM
            </Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {serviceRam !== null ? `${serviceRam}%` : "—"}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(Math.max(serviceRam || 0, 0), 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "grey.200",
              "& .MuiLinearProgress-bar": {
                bgcolor: colorForPercent(serviceRam),
                borderRadius: 4,
              },
            }}
          />
        </Box>
      </Stack>
    </Paper>
  );
}
