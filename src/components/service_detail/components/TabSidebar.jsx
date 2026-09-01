import React from "react";
import {
  Paper,
  Box,
  Tabs,
  Tab,
  Divider,
  Stack,
  Typography,
  Chip,
  useTheme,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SubjectIcon from "@mui/icons-material/Subject";
import SettingsIcon from "@mui/icons-material/Settings";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";

const ALL_TABS = [
  { value: "overview", label: "Overview", icon: <Inventory2Icon fontSize="small" /> },
  { value: "create", label: "Create deploy", icon: <AddCircleOutlineIcon fontSize="small" /> },
  { value: "logs", label: "Logs", icon: <SubjectIcon fontSize="small" /> },
  { value: "settings", label: "Settings", icon: <SettingsIcon fontSize="small" /> },
  { value: "shell", label: "Shell", icon: <TerminalRoundedIcon fontSize="small" /> },
];

export default function TabSidebar({
  activeTab,
  setActiveTab,
  service,
  selectedDeploy,
  deployCount,
  volumeCount,
  networkName,
  serviceRunning,
  allowedTabs = null, // null = all tabs; array of tab values
}) {
  const theme = useTheme();
  const TABS = allowedTabs
    ? ALL_TABS.filter((tab) => allowedTabs.includes(tab.value))
    : ALL_TABS;

  return (
    <Paper
      elevation={0}
      sx={{
        position: "sticky",
        top: 16,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(180deg, #0f172a, #1e293b)"
            : "linear-gradient(180deg, #ffffff, #f8fafc)",
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
          sx={{
            minHeight: 0,
            "& .MuiTabs-indicator": {
              left: 0,
              width: 3,
              borderRadius: "0 4px 4px 0",
            },
            "& .MuiTab-root": {
              alignItems: "flex-start",
              textAlign: "left",
              py: 1.25,
              px: 1.75,
              minHeight: 48,
              borderRadius: 1.5,
              mb: 0.5,
              textTransform: "none",
              fontWeight: 600,
              fontSize: 14,
              color: "text.secondary",
              "&.Mui-selected": {
                color: "primary.main",
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(59,130,246,0.12)"
                    : "rgba(59,130,246,0.08)",
              },
              "&:hover": {
                bgcolor: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
              },
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
            />
          ))}
        </Tabs>

        <Divider sx={{ my: 2 }} />

        <Stack spacing={1.25}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.75,
              borderRadius: 2,
              borderColor: "divider",
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
              {service?.name || "Service"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 11,
              }}
            >
              {service?.service_host || service?.service_name || "—"}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
              <Chip
                label={
                  serviceRunning === true
                    ? "running"
                    : service?.status || "unknown"
                }
                size="small"
                color={
                  serviceRunning === true ||
                  ["running", "success"].includes(String(service?.status || ""))
                    ? "success"
                    : ["queued", "deploying", "stopping"].includes(
                        String(service?.status || "")
                      )
                    ? "warning"
                    : "default"
                }
                sx={{ fontWeight: 600, height: 22, fontSize: 11 }}
              />
              {selectedDeploy ? (
                <Chip
                  label={`Deploy: ${selectedDeploy.name || selectedDeploy.id}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 22, fontSize: 11 }}
                />
              ) : null}
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
            }}
          >
            <Paper
              variant="outlined"
              sx={{ p: 1.25, borderRadius: 1.5, textAlign: "center" }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Deploys
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {deployCount}
              </Typography>
            </Paper>
            <Paper
              variant="outlined"
              sx={{ p: 1.25, borderRadius: 1.5, textAlign: "center" }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Volumes
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {volumeCount}
              </Typography>
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Network
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontWeight: 700, wordBreak: "break-word", mt: 0.25 }}
            >
              {networkName || "—"}
            </Typography>
          </Paper>
        </Stack>
      </Box>
    </Paper>
  );
}
