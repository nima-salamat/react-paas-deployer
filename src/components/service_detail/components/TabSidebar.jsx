import React from "react";
import { Paper, Box, Tabs, Tab, Divider, Stack, Typography, Chip, useTheme } from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SubjectIcon from "@mui/icons-material/Subject";
import SettingsIcon from "@mui/icons-material/Settings";

const TABS = [
  { value: "overview", label: "Overview", icon: <Inventory2Icon fontSize="small" /> },
  { value: "create", label: "Create deploy", icon: <AddCircleOutlineIcon fontSize="small" /> },
  { value: "logs", label: "Logs", icon: <SubjectIcon fontSize="small" /> },
  { value: "settings", label: "Settings", icon: <SettingsIcon fontSize="small" /> },
];

export default function TabSidebar({ activeTab, setActiveTab, service, selectedDeploy, deployCount, volumeCount, networkName, serviceRunning }) {
  const theme = useTheme();

  return (
    <Paper
      elevation={1}
      sx={{
        position: "sticky",
        top: 16,
        borderRadius: 2,
        boxShadow: 3,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        backgroundImage:
          theme.palette.mode === "dark"
            ? "linear-gradient(180deg, #0b0f12, #111827)"
            : "linear-gradient(180deg, #ffffff, #f7fbff)",
      }}
    >
      <Box sx={{ p: 1.25 }}>
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 0,
            "& .MuiTab-root": {
              alignItems: "flex-start",
              textAlign: "left",
              py: 1.2,
              px: 1.5,
              minHeight: 54,
            },
          }}
        >
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              icon={tab.icon}
              iconPosition="start"
              label={tab.label}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                alignItems: "flex-start",
              }}
            />
          ))}
        </Tabs>

        <Divider sx={{ my: 1.5 }} />

        <Stack spacing={1}>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              {service?.name || "Service"}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {service?.service_name ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}` : "—"}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
              <Chip
                label={
                  serviceRunning === true
                    ? "running"
                    : service?.status || "unknown"
                }
                size="small"
                color={
                  serviceRunning === true || ["running", "success"].includes(String(service?.status || ""))
                    ? "success"
                    : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
                    ? "warning"
                    : "default"
                }
              />
              {selectedDeploy ? <Chip label={`Deploy: ${selectedDeploy.name || selectedDeploy.id}`} size="small" variant="outlined" /> : null}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Deploys
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {deployCount}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Network
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
              {networkName || "—"}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Volumes
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {volumeCount}
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Paper>
  );
}