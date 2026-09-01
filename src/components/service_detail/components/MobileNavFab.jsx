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
  Fab,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import SubjectIcon from "@mui/icons-material/Subject";
import SettingsIcon from "@mui/icons-material/Settings";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import CloseIcon from "@mui/icons-material/Close";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";

const ALL_TABS = [
  { value: "overview", label: "Overview", icon: <Inventory2Icon /> },
  { value: "create", label: "Deploys", icon: <AddCircleOutlineIcon /> },
  { value: "logs", label: "Logs", icon: <SubjectIcon /> },
  { value: "settings", label: "Settings", icon: <SettingsIcon /> },
  { value: "shell", label: "Shell", icon: <TerminalRoundedIcon /> },
];

/**
 * Service-section FAB — geometric mirror of app FloatingNav.
 * FloatingNav defaults: position bottom-right, anchorOffset { bottom: 24, right: 24 }
 * → this FAB: bottom-left with { bottom: 24, left: 24 }
 * Same size (52 mobile / 56 desktop), borderRadius 3, shadow, zIndex 20.
 */
export default function MobileNavFab({
  allowedTabs = null,
  activeTab,
  setActiveTab,
  service,
  selectedDeploy,
  deployCount = 0,
  volumeCount = 0,
  networkName,
  serviceRunning,
  // keep in sync with FloatingNav anchorOffset
  anchorOffset = { bottom: 24, left: 24 },
}) {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const TABS = allowedTabs
    ? ALL_TABS.filter((tab) => allowedTabs.includes(tab.value))
    : ALL_TABS;
  const [open, setOpen] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const sheetStartY = useRef(0);
  const sheetDragging = useRef(false);

  const bottom = anchorOffset?.bottom ?? 24;
  const left = anchorOffset?.left ?? 24;
  const fabSize = isSm ? 52 : 56;

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
      {/* Fixed FAB — mirror of FloatingNav (right ↔ left) */}
      <Box
        sx={{
          position: "fixed",
          zIndex: 20, // same as FloatingNav
          bottom,
          left,
          right: "auto",
          pointerEvents: "none",
        }}
      >
        <Tooltip title={open ? "Close sections" : "Service sections"} placement="right">
          <Fab
            onClick={() => setOpen(true)}
            size={isSm ? "medium" : "large"}
            color="primary"
            aria-label="Open service sections"
            sx={{
              pointerEvents: "auto",
              boxShadow:
                theme.palette.mode === "dark"
                  ? "0 8px 28px rgba(0,0,0,0.5)"
                  : "0 8px 28px rgba(37,99,235,0.35)",
              borderRadius: 3,
              width: fabSize,
              height: fabSize,
            }}
          >
            <WidgetsOutlinedIcon sx={{ fontSize: 22, color: "#fff" }} />
          </Fab>
        </Tooltip>
      </Box>

      <Drawer
        anchor="bottom"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{
          onTouchStart: onSheetTouchStart,
          onTouchMove: onSheetTouchMove,
          onTouchEnd: onSheetTouchEnd,
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "78vh",
            transform: sheetOffset ? `translateY(${sheetOffset}px)` : undefined,
            transition: sheetDragging.current ? "none" : "transform 0.2s ease",
            pb: "env(safe-area-inset-bottom, 0px)",
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.25, pb: 0.5 }}>
          <Box
            sx={{
              width: 40,
              height: 4,
              borderRadius: 99,
              bgcolor: "divider",
              mx: "auto",
              mb: 1.25,
            }}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={800} noWrap>
                {service?.name || "Service"}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={statusLabel}
                  color={statusColor}
                  sx={{ height: 22, fontWeight: 700 }}
                />
                {networkName ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.35 }}
                  >
                    <HubIcon sx={{ fontSize: 13 }} /> {networkName}
                  </Typography>
                ) : null}
                {volumeCount > 0 ? (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.35 }}
                  >
                    <StorageIcon sx={{ fontSize: 13 }} /> {volumeCount} vol
                  </Typography>
                ) : null}
                {deployCount > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {deployCount} deploy{deployCount === 1 ? "" : "s"}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
          {selectedDeploy?.name ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }} noWrap>
              Selected deploy: {selectedDeploy.name}
            </Typography>
          ) : null}
        </Box>

        <Divider sx={{ my: 1 }} />

        <List sx={{ px: 1, pb: 2 }}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.value;
            return (
              <ListItemButton
                key={tab.value}
                selected={selected}
                onClick={() => go(tab.value)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  py: 1.25,
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: selected ? "primary.main" : "text.secondary" }}>
                  {tab.value === "create" ? (
                    <Badge badgeContent={deployCount || 0} color="primary" max={99}>
                      {tab.icon}
                    </Badge>
                  ) : (
                    tab.icon
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={tab.label}
                  primaryTypographyProps={{ fontWeight: selected ? 800 : 600 }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>
    </>
  );
}
