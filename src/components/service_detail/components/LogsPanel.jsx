import React from "react";
import {
  Stack,
  Paper,
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import LogPanel from "./LogPanel";
import RefreshIcon from "@mui/icons-material/Refresh";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SyncIcon from "@mui/icons-material/Sync";

export default function LogsPanel({
  serviceLogs,
  serviceLogActions,
  deployLogs,
  deployLogActions,
  deploys,
  currentDeployForLogs,
  id,
  isDesktop,
  handleDownloadEntries,
  handleCopyEntries,
}) {
  const deployLive = Boolean(deployLogs?.connected);
  const deployReconnecting = Boolean(deployLogs?.reconnecting);

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960, width: "100%" }}>
      <LogPanel
        title="Service logs"
        subtitle="Live stream + retained history"
        entries={serviceLogs.entries}
        loading={serviceLogs.loading}
        error={serviceLogs.error}
        connected={serviceLogs.connected}
        reconnecting={serviceLogs.reconnecting}
        paused={serviceLogs.paused}
        filter={serviceLogs.filter}
        level={serviceLogs.level}
        searchMode={serviceLogs.searchMode}
        onSearchModeChange={serviceLogActions.setSearchMode}
        historyQInput={serviceLogs.historyQInput}
        onHistoryQChange={serviceLogActions.setHistoryQInput}
        supportServerSearch
        gap={serviceLogs.gap}
        onDismissGap={() => serviceLogActions.setGap?.(null)}
        usage={serviceLogs.usage}
        policy={serviceLogs.policy}
        searching={serviceLogs.searching}
        hasMoreOlder={serviceLogs.hasMoreOlder}
        loadingOlder={serviceLogs.loadingOlder}
        onLoadOlder={serviceLogActions.loadOlder}
        onFilterChange={serviceLogActions.setFilter}
        onLevelChange={serviceLogActions.setLevel}
        onTogglePaused={serviceLogActions.onTogglePaused}
        onRefresh={serviceLogActions.refresh}
        onClear={serviceLogActions.clear}
        onServerDownload={() => serviceLogActions.download?.("txt")}
        onDownload={(entries) =>
          handleDownloadEntries(`service-${id}-logs.txt`, entries)
        }
        exporting={serviceLogs.exporting}
        onCopy={(entries) => handleCopyEntries(entries)}
        onJumpToLatest={() => {
          serviceLogActions.jumpToLatest?.();
          const el = serviceLogActions.scrollRef?.current;
          if (el) el.scrollTop = el.scrollHeight;
        }}
        onRetryConnection={serviceLogActions.retryConnection}
        scrollRef={serviceLogActions.scrollRef}
        emptyText="No service logs yet."
      />

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2.25 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 1.75 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Deploy history
              </Typography>
              <Chip
                icon={
                  deployReconnecting ? (
                    <SyncIcon />
                  ) : deployLive ? (
                    <WifiIcon />
                  ) : (
                    <WifiOffIcon />
                  )
                }
                label={
                  deployReconnecting
                    ? "Reconnecting…"
                    : deployLive
                    ? "Live events"
                    : "Offline"
                }
                color={deployLive ? "success" : deployReconnecting ? "warning" : "default"}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Latest at the bottom. Live deployment events appear while connected.
            </Typography>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            flexWrap="wrap"
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            <FormControl
              size="small"
              sx={{
                minWidth: { xs: 0, sm: 200 },
                width: { xs: "100%", sm: "auto" },
              }}
            >
              <InputLabel>Deploy</InputLabel>
              <Select
                label="Deploy"
                value={deployLogs.deployId || ""}
                onChange={(e) => deployLogActions.setDeployId(e.target.value)}
              >
                {deploys.length ? (
                  deploys.map((deploy) => {
                    const label = `${deploy.name || "Deploy"}${
                      deploy.version ? ` • ${deploy.version}` : ""
                    }`;
                    return (
                      <MenuItem
                        key={deploy.id ?? deploy.pk}
                        value={String(deploy.id ?? deploy.pk ?? "")}
                      >
                        {label}
                      </MenuItem>
                    );
                  })
                ) : (
                  <MenuItem value="" disabled>
                    No deploys yet
                  </MenuItem>
                )}
              </Select>
            </FormControl>

            <Button
              size="small"
              variant="outlined"
              onClick={() => deployLogActions.refresh(deployLogs.deployId)}
              startIcon={<RefreshIcon />}
              fullWidth={!isDesktop}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
            >
              Refresh history
            </Button>
          </Stack>
        </Stack>

        <LogPanel
          title={
            currentDeployForLogs
              ? `Deploy: ${currentDeployForLogs.name || currentDeployForLogs.id}`
              : "Deploy history"
          }
          subtitle="Newest at the bottom. Live stages from the deploy worker appear automatically."
          entries={deployLogs.entries}
          loading={deployLogs.loading}
          loadingOlder={deployLogs.loadingOlder}
          error={deployLogs.error}
          connected={deployLive}
          reconnecting={deployReconnecting}
          showConnectionChip
          filter={deployLogs.filter}
          level={deployLogs.level}
          onFilterChange={deployLogActions.setFilter}
          onLevelChange={deployLogActions.setLevel}
          onRefresh={() => deployLogActions.refresh(deployLogs.deployId)}
          onClear={deployLogActions.clear}
          onServerDownload={
            deployLogActions.download
              ? () => deployLogActions.download(deployLogs.deployId)
              : undefined
          }
          onDownload={(entries) =>
            handleDownloadEntries(
              `deploy-${deployLogs.deployId || id}-logs.txt`,
              entries
            )
          }
          exporting={deployLogs.exporting}
          onCopy={(entries) => handleCopyEntries(entries)}
          onJumpToLatest={() => {
            const el = deployLogActions.scrollRef?.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          onLoadOlder={deployLogActions.loadOlder}
          hasMoreOlder={deployLogs.hasMoreOlder}
          onRetryConnection={deployLogActions.retryConnection}
          scrollRef={deployLogActions.scrollRef}
          emptyText="No deploy history available. Start a deploy to see live events."
        />
      </Paper>
    </Stack>
  );
}
