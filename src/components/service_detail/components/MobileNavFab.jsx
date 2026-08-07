import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Drawer,
  Typography,
  Stack,
  Chip,
  IconButton,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  useTheme,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SubjectIcon from "@mui/icons-material/Subject";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";

const TABS = [
  { value: "overview", label: "Overview", icon: <Inventory2Icon /> },
  { value: "create", label: "Deploys", icon: <AddCircleOutlineIcon /> },
  { value: "logs", label: "Logs", icon: <SubjectIcon /> },
  { value: "settings", label: "Settings", icon: <SettingsIcon /> },
];

/**
 * Fixed service-section FAB — bottom-left (opposite of app FloatingNav bottom-right).
 * Icon: Widgets (not hamburger) so it does not clash with the global menu.
 */
export default function MobileNavFab({
  activeTab,
  setActiveTab,
  service,
  selectedDeploy,
  deployCount = 0,
  volumeCount = 0,
  networkName,
  serviceRunning,
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const sheetStartY = useRef(0);
  const sheetDragging = useRef(false);

  const go = (value) => {
    setActiveTab(value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) setSheetOffset(0);
  }, [open]);

  const statusLabel =
    serviceRunning === true ? "running" : service?.status || "unknown";

  const statusColor =
    serviceRunning === true ||
    ["running", "success"].includes(String(service?.status || ""))
      ? "success"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? "warning"
      : "default";

  const onSheetTouchStart = (e) => {
    sheetDragging.current = true;
    sheetStartY.current = e.touches[0].clientY;
  };
  const onSheetTouchMove = (e) => {
    if (!sheetDragging.current) return;
    const dy = e.touches[0].clientY - sheetStartY.current;
    if (dy > 0) setSheetOffset(dy);
  };
  const onSheetTouchEnd = () => {
    sheetDragging.current = false;
    if (sheetOffset > 80) setOpen(false);
    setSheetOffset(0);
  };

  return (
    <>
      <Box
        role="button"
        aria-label="Open service sections"
        onClick={() => setOpen(true)}
        sx={{
          position: "fixed",
          left: 16,
          bottom: 24,
          zIndex: (t) => t.zIndex.speedDial,
          width: 52,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          boxShadow:
            theme.palette.mode === "dark"
              ? "0 8px 28px rgba(0,0,0,0.5)"
              : "0 8px 28px rgba(37,99,235,0.35)",
          cursor: "pointer",
          border: "2px solid",
          borderColor:
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.55)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          "&:active": { transform: "scale(0.94)" },
          mb: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <Badge
          color="warning"
          variant="dot"
          invisible={!selectedDeploy}
          overlap="circular"
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <WidgetsOutlinedIcon sx={{ fontSize: 26 }} />
        </Badge>
      </Box>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "78vh",
            pb: "env(safe-area-inset-bottom, 0px)",
            transform: sheetOffset ? `translateY(${sheetOffset}px)` : undefined,
            transition: sheetOffset ? "none" : undefined,
          },
          onTouchStart: onSheetTouchStart,
          onTouchMove: onSheetTouchMove,
          onTouchEnd: onSheetTouchEnd,
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1.25, pb: 0.5 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider" }} />
        </Box>

        <Box sx={{ px: 2, pb: 1, display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
              {service?.name || "Service"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                fontSize: 11,
                wordBreak: "break-all",
              }}
            >
              {service?.service_host || service?.service_name || "—"}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Chip
                label={statusLabel}
                size="small"
                color={statusColor}
                sx={{ height: 22, fontWeight: 700, fontSize: 11 }}
              />
              {selectedDeploy ? (
                <Chip
                  label={selectedDeploy.name || selectedDeploy.id}
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={{ height: 22, fontSize: 11, maxWidth: 140 }}
                />
              ) : null}
            </Stack>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close menu">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Stack direction="row" spacing={1} sx={{ px: 2, pb: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<Inventory2Icon sx={{ fontSize: "14px !important" }} />}
            label={`${deployCount} deploys`}
            size="small"
            variant="outlined"
            sx={{ height: 24 }}
          />
          <Chip
            icon={<StorageIcon sx={{ fontSize: "14px !important" }} />}
            label={`${volumeCount} volumes`}
            size="small"
            variant="outlined"
            sx={{ height: 24 }}
          />
          <Chip
            icon={<HubIcon sx={{ fontSize: "14px !important" }} />}
            label={networkName && networkName !== "—" ? networkName : "No network"}
            size="small"
            variant="outlined"
            sx={{ height: 24, maxWidth: 160 }}
          />
        </Stack>

        <Divider />

        <List sx={{ py: 1 }}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.value;
            return (
              <ListItemButton
                key={tab.value}
                selected={selected}
                onClick={() => go(tab.value)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  "&.Mui-selected": {
                    bgcolor:
                      theme.palette.mode === "dark"
                        ? "rgba(59,130,246,0.16)"
                        : "rgba(59,130,246,0.1)",
                  },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 40, color: selected ? "primary.main" : "text.secondary" }}
                >
                  {tab.icon}
                </ListItemIcon>
                <ListItemText
                  primary={tab.label}
                  primaryTypographyProps={{ fontWeight: selected ? 800 : 600 }}
                />
                {selected ? (
                  <Chip
                    label="Now"
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                  />
                ) : null}
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
}
