import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  alpha,
  Divider,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import MiscellaneousServicesOutlinedIcon from "@mui/icons-material/MiscellaneousServicesOutlined";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";

export const SIDEBAR_WIDTH = 232;

const NAV_ITEMS = [
  {
    group: "Infrastructure",
    items: [
      { id: "services", label: "Services", path: "/dashboard/services", icon: MiscellaneousServicesOutlinedIcon },
      { id: "networks", label: "Networks", path: "/dashboard/networks", icon: LanOutlinedIcon },
      { id: "volumes", label: "Volumes", path: "/dashboard/volumes", icon: StorageOutlinedIcon },
    ],
  },
  {
    group: "Account",
    items: [
      { id: "plans", label: "Plans", path: "/dashboard/plans", icon: SellOutlinedIcon },
      { id: "tickets", label: "Tickets", path: "/dashboard/tickets", icon: ConfirmationNumberOutlinedIcon },
      { id: "profile", label: "Profile", path: "/dashboard/profile", icon: PersonOutlineOutlinedIcon },
    ],
  },
];

function resolveActiveId(pathname) {
  if (pathname.startsWith("/dashboard/services")) return "services";
  if (pathname.startsWith("/dashboard/networks")) return "networks";
  if (pathname.startsWith("/dashboard/volumes")) return "volumes";
  if (pathname.startsWith("/dashboard/plans")) return "plans";
  if (pathname.startsWith("/dashboard/tickets")) return "tickets";
  if (pathname.startsWith("/dashboard/profile") || pathname === "/profile") return "profile";
  // legacy query tabs
  return "services";
}

function SidebarContent({ onNavigate }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const activeId = resolveActiveId(location.pathname);

  const go = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        py: 1.25,
        px: 1,
      }}
    >
      {NAV_ITEMS.map((group, gi) => (
        <Box key={group.group} sx={{ mb: gi < NAV_ITEMS.length - 1 ? 1.25 : 0 }}>
          <Typography
            sx={{
              px: 1.25,
              pt: gi === 0 ? 0.5 : 1,
              pb: 0.75,
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            {group.group}
          </Typography>
          <List disablePadding dense>
            {group.items.map(({ id, label, path, icon: Icon }) => {
              const selected = activeId === id;
              return (
                <ListItemButton
                  key={id}
                  selected={selected}
                  onClick={() => go(path)}
                  sx={{
                    mb: 0.35,
                    borderRadius: 2,
                    minHeight: 40,
                    px: 1.25,
                    "&.Mui-selected": {
                      bgcolor: alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === "dark" ? 0.18 : 0.1
                      ),
                      color: "text.primary",
                      "&:hover": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.24 : 0.14
                        ),
                      },
                    },
                    "&:hover": {
                      bgcolor: alpha(
                        theme.palette.text.primary,
                        theme.palette.mode === "dark" ? 0.06 : 0.04
                      ),
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: selected ? "primary.main" : "text.secondary" }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={label}
                    primaryTypographyProps={{
                      fontWeight: selected ? 800 : 650,
                      fontSize: 13.5,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          {gi < NAV_ITEMS.length - 1 && (
            <Divider sx={{ mt: 1.25, mx: 0.5, borderColor: alpha(theme.palette.divider, 0.8) }} />
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Permanent sidebar on md+, temporary drawer on mobile.
 */
export default function DashboardSidebar({ mobileOpen, onClose }) {
  const theme = useTheme();

  const paperSx = {
    width: SIDEBAR_WIDTH,
    boxSizing: "border-box",
    borderRight: "1px solid",
    borderColor: alpha(theme.palette.divider, 0.95),
    bgcolor: alpha(
      theme.palette.background.paper,
      theme.palette.mode === "dark" ? 0.92 : 0.96
    ),
    backdropFilter: "blur(16px)",
  };

  return (
    <>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={Boolean(mobileOpen)}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            ...paperSx,
            top: 0,
            height: "100%",
          },
        }}
      >
        <Box
          sx={{
            minHeight: 56,
            display: "flex",
            alignItems: "center",
            px: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            fontWeight: 850,
            fontSize: 14,
          }}
        >
          Menu
        </Box>
        <SidebarContent onNavigate={onClose} />
      </Drawer>

      {/* Desktop permanent */}
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            ...paperSx,
            position: "relative",
            height: "100%",
            border: "none",
            borderRight: "1px solid",
            borderColor: alpha(theme.palette.divider, 0.95),
          },
        }}
      >
        <SidebarContent />
      </Drawer>
    </>
  );
}
