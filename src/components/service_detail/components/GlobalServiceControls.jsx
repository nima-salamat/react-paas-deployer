import React from "react";
import { Paper, Typography, Box, Button, Stack, Chip, LinearProgress, useTheme } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RefreshIcon from "@mui/icons-material/Refresh";
import LinkIcon from "@mui/icons-material/Launch";

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

  return (
    <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3, mb: 2 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
          flexWrap: "wrap",
          mb: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {service?.name || "Service"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {service?.service_name ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}` : "—"}
          </Typography>
        </Box>
        <Chip
          label={
            serviceRunning === true
              ? "Running"
              : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
              ? String(service.status)
              : serviceRunning === false
              ? "Stopped"
              : service?.status || "Unknown"
          }
          color={
            serviceRunning === true || ["running", "success"].includes(String(service?.status || ""))
              ? "success"
              : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
              ? "warning"
              : "default"
          }
          size="small"
        />
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 1.5 }}>
        <Button
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={() => startService()}
          disabled={!service || serviceLoading || serviceBusy || !selectedDeployId}
          fullWidth
          size="small"
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
          size="small"
        >
          {rebuildLoading
            ? "Rebuilding..."
            : selectedIsDb
            ? "Rebuild DB"
            : "Rebuild"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<StopIcon />}
          onClick={stopService}
          disabled={!service || serviceLoading || serviceBusy}
          fullWidth
          size="small"
        >
          Stop
        </Button>
        <Button
          variant="outlined"
          onClick={() => checkServiceRunning(false)}
          disabled={!service || serviceStatusLoadingManual}
          fullWidth
          size="small"
        >
          {serviceStatusLoadingManual ? "Checking..." : "Check status"}
        </Button>
        <Button
          variant="outlined"
          onClick={openServiceInNewTab}
          disabled={!service?.service_name || selectedIsDb}
          startIcon={<LinkIcon />}
          fullWidth
          size="small"
          title={selectedIsDb ? "DB services are not opened in browser" : undefined}
        >
          Open
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }} flexWrap="wrap" useFlexGap>
        <Chip label={`Status: ${service?.status || "—"}`} size="small" variant="outlined" />
        <Chip label={`Deploys: ${deployCount}`} size="small" variant="outlined" />
        <Chip label={`Volumes: ${volumeCount}`} size="small" variant="outlined" />
        <Chip label={`Network: ${networkName}`} size="small" variant="outlined" />
        {selectedDeploy ? (
          <Chip
            label={`Selected: ${selectedDeploy.name || selectedDeploy.id}`}
            size="small"
            color="success"
          />
        ) : null}
        {selectedPlatform ? (
          <Chip
            label={`${selectedIsDb ? "DB" : "App"} · ${selectedPlatform}`}
            size="small"
            color={selectedIsDb ? "info" : "default"}
            variant="outlined"
          />
        ) : null}
      </Stack>

      <Stack spacing={0.75}>
        <Typography variant="caption">
          CPU {serviceCpu !== null ? `${serviceCpu}%` : "—"}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(serviceCpu || 0, 0), 100)}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceCpu) },
          }}
        />
        <Typography variant="caption">
          RAM {serviceRam !== null ? `${serviceRam}%` : "—"}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(Math.max(serviceRam || 0, 0), 100)}
          sx={{
            height: 8,
            borderRadius: 1,
            bgcolor: "grey.200",
            "& .MuiLinearProgress-bar": { bgcolor: colorForPercent(serviceRam) },
          }}
        />
      </Stack>
    </Paper>
  );
}