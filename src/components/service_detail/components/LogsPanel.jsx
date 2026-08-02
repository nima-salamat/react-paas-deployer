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
} from "@mui/material";
import LogPanel from "./LogPanel";
import RefreshIcon from "@mui/icons-material/Refresh";

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
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      <LogPanel
        title="Service logs"
        subtitle="Latest logs stay at the bottom. Scroll up for older lines."
        entries={serviceLogs.entries}
        loading={serviceLogs.loading}
        error={serviceLogs.error}
        connected={serviceLogs.connected}
        paused={serviceLogs.paused}
        filter={serviceLogs.filter}
        level={serviceLogs.level}
        onFilterChange={serviceLogActions.setFilter}
        onLevelChange={serviceLogActions.setLevel}
        onTogglePaused={serviceLogActions.onTogglePaused}
        onRefresh={serviceLogActions.refresh}
        onClear={serviceLogActions.clear}
        onDownload={(entries) =>
          handleDownloadEntries(`service-${id}-logs.txt`, entries)
        }
        onCopy={(entries) => handleCopyEntries(entries)}
        onJumpToLatest={() => {
          const el = serviceLogActions.scrollRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }}
        scrollRef={serviceLogActions.scrollRef}
        emptyText="No service logs yet."
      />

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.75, sm: 2.25 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 1.75 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Deploy history
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Latest at the bottom. Scroll up to load older logs.
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
                value={deployLogs.deployId}
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
          subtitle="Newest at the bottom. Scroll up for older records."
          entries={deployLogs.entries}
          loading={deployLogs.loading}
          loadingOlder={deployLogs.loadingOlder}
          error={deployLogs.error}
          connected={false}
          showConnectionChip={false}
          filter={deployLogs.filter}
          level={deployLogs.level}
          onFilterChange={deployLogActions.setFilter}
          onLevelChange={deployLogActions.setLevel}
          onRefresh={() => deployLogActions.refresh(deployLogs.deployId)}
          onClear={deployLogActions.clear}
          onDownload={(entries) =>
            handleDownloadEntries(
              `deploy-${deployLogs.deployId || id}-logs.txt`,
              entries
            )
          }
          onCopy={(entries) => handleCopyEntries(entries)}
          onJumpToLatest={() => {
            const el = deployLogActions.scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          onLoadOlder={deployLogActions.loadOlder}
          hasMoreOlder={deployLogs.hasMoreOlder}
          scrollRef={deployLogActions.scrollRef}
          emptyText="No deploy history available."
        />
      </Paper>
    </Stack>
  );
}
