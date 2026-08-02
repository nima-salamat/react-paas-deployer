import React from "react";
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
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkIcon from "@mui/icons-material/Launch";
import MemoryIcon from "@mui/icons-material/Memory";
import StorageIcon from "@mui/icons-material/Storage";
import HubIcon from "@mui/icons-material/Hub";
import Inventory2Icon from "@mui/icons-material/Inventory2";

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
  actions,
}) {
  const theme = useTheme();
  const { startService, stopService, rebuildService, checkServiceRunning, openServiceInNewTab } = actions;

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
    serviceRunning === true || ["running", "success"].includes(String(service?.status || ""))
      ? "success"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? "warning"
      : "default";

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        mb: 2.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
      }}
    >
      {/* Header */}
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
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              mb: 0.25,
            }}
          >
            {service?.name || "Service"}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12.5,
            }}
          >
            {service?.service_name
              ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`
              : "—"}
          </Typography>
        </Box>
        <Chip
          label={statusLabel}
          color={statusColor}
          size="medium"
          sx={{ fontWeight: 700, height: 28 }}
        />
      </Box>

      {/* Action buttons */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: 2.5 }}
      >
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => startService()}
          disabled={!service || serviceLoading || serviceBusy || !selectedDeployId}
          fullWidth
          size="medium"
          sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: "none", py: 1 }}
        >
          Start
        </Button>
        <Button
          variant="outlined"
          color="warning"
          startIcon={<RefreshIcon />}
          onClick={rebuildService}
          disabled={!service || serviceLoading || serviceBusy || rebuildLoading || !selectedDeployId}
          fullWidth
          size="medium"
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: 1 }}
        >
          {rebuildLoading ? "Rebuilding..." : selectedIsDb ? "Rebuild DB" : "Rebuild"}
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<StopIcon />}
          onClick={stopService}
          disabled={!service || serviceLoading || serviceBusy}
          fullWidth
          size="medium"
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: 1 }}
        >
          Stop
        </Button>
        <Button
          variant="outlined"
          onClick={() => checkServiceRunning(false)}
          disabled={!service || serviceStatusLoadingManual}
          fullWidth
          size="medium"
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: 1 }}
        >
          {serviceStatusLoadingManual ? "Checking..." : "Check status"}
        </Button>
        <Button
          variant="outlined"
          onClick={openServiceInNewTab}
          disabled={!service?.service_name || selectedIsDb}
          startIcon={<LinkIcon />}
          fullWidth
          size="medium"
          title={selectedIsDb ? "DB services are not opened in browser" : undefined}
          sx={{ borderRadius: 1.5, fontWeight: 600, textTransform: "none", py: 1 }}
        >
          Open
        </Button>
      </Stack>

      {/* Meta chips */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 2.5 }}
        flexWrap="wrap"
        useFlexGap
      >
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

      {/* Resource meters */}
      <Stack spacing={1.5}>
        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}>
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
            <Typography variant="caption" sx={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 0.5 }}>
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
