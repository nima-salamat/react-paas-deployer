import React, { useMemo } from "react";
import {
  Avatar, Box, Divider, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Stack, Tooltip, Typography, alpha,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import EmailIcon from "@mui/icons-material/Email";
import PeopleIcon from "@mui/icons-material/People";
import LinkIcon from "@mui/icons-material/Link";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import DnsIcon from "@mui/icons-material/Dns";
import StorageIcon from "@mui/icons-material/Storage";
import TableChartIcon from "@mui/icons-material/TableChart";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { canSeeNav, isSessionSuperuser, isSessionStaff, authMediaSrc } from "../adminUtils";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: <DashboardIcon fontSize="small" />, shortcut: "1" },
  { id: "tickets", label: "Tickets", icon: <ConfirmationNumberIcon fontSize="small" />, shortcut: "2" },
  { id: "users", label: "Users & access", icon: <PeopleIcon fontSize="small" />, shortcut: "3" },
  { id: "services", label: "Services", icon: <DnsIcon fontSize="small" />, shortcut: "4" },
  { id: "plans", label: "Plans", icon: <StorageIcon fontSize="small" />, shortcut: "5" },
  { id: "tables", label: "DB tables", icon: <TableChartIcon fontSize="small" />, shortcut: "6" },
  { id: "login", label: "Login system", icon: <SettingsIcon fontSize="small" />, shortcut: "7" },
  { id: "invites", label: "Invites", icon: <LinkIcon fontSize="small" />, shortcut: "8" },
  { id: "codes", label: "Auth codes", icon: <VpnKeyIcon fontSize="small" />, shortcut: "9" },
  { id: "emails", label: "Email", icon: <EmailIcon fontSize="small" />, shortcut: "0" },
  { id: "profile", label: "My profile", icon: <PersonOutlineIcon fontSize="small" />, shortcut: "P" },
];

/**
 * AdminSidebar — collapse control is the FIRST item inside the nav list
 * (above Overview), so it stays fully visible when the rail is collapsed.
 */
export default function AdminSidebar({
  me,
  tab,
  onTabChange,
  liveConnected,
  onLogout,
  onBackToDeployer: _unused = null,
  collapsed = false,
  onToggleCollapse,
}) {
  void _unused;

  const nav = useMemo(
    () => NAV_ITEMS.filter((n) => n.id === "profile" || canSeeNav(n.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [me]
  );

  const isSuper = isSessionSuperuser();
  const isStaff = isSessionStaff();

  const avatarSrc = (() => {
    const profiles = me?.profiles || [];
    const first = profiles.find((p) => p.image) || profiles[0];
    if (first?.image) return authMediaSrc(first.image);
    if (me?.avatar) return authMediaSrc(me.avatar);
    if (me?.image) return authMediaSrc(me.image);
    return "";
  })();

  const initial = (me?.username || "A").charAt(0).toUpperCase();

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {/* Brand only — no collapse button here */}
      <Box sx={{ px: collapsed ? 1 : 1.75, pt: 1.75, pb: 1.25 }}>
        <Stack direction="row" alignItems="center" gap={1} justifyContent={collapsed ? "center" : "flex-start"}>
          <Avatar
            src={avatarSrc || undefined}
            sx={{
              width: 34,
              height: 34,
              bgcolor: "primary.main",
              fontWeight: 800,
              fontSize: 14,
              flexShrink: 0,
              borderRadius: 1.25,
            }}
          >
            {initial}
          </Avatar>

          {!collapsed && (
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={800} fontSize={13.5} noWrap>
                {me?.username || "Admin"}
              </Typography>
              <Stack direction="row" alignItems="center" gap={0.4}>
                <FiberManualRecordIcon
                  sx={{
                    fontSize: 9,
                    color: liveConnected ? "success.main" : "text.disabled",
                  }}
                />
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11 }}>
                  {liveConnected ? "Live" : "Offline"}
                </Typography>
              </Stack>
            </Box>
          )}
        </Stack>

        {!collapsed && (
          <Stack direction="row" gap={0.5} mt={1} flexWrap="wrap" useFlexGap>
            {isSuper && (
              <Box
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  px: 0.7,
                  py: 0.15,
                  bgcolor: (t) => alpha(t.palette.error.main, 0.12),
                  color: "error.main",
                  borderRadius: 0.5,
                  letterSpacing: 0.3,
                }}
              >
                SUPERUSER
              </Box>
            )}
            {isStaff && !isSuper && (
              <Box
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  px: 0.7,
                  py: 0.15,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
                  color: "primary.main",
                  borderRadius: 0.5,
                  letterSpacing: 0.3,
                }}
              >
                STAFF
              </Box>
            )}
          </Stack>
        )}
      </Box>

      <Divider />

      {/* Nav list — collapse is FIRST item, above Overview */}
      <List
        dense
        sx={{
          px: collapsed ? 0.75 : 1,
          py: 1,
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {onToggleCollapse && (
          <ListItem disablePadding sx={{ mb: 0.75 }}>
            <Tooltip
              title={collapsed ? "Expand sidebar (Alt+[)" : "Collapse sidebar (Alt+[)"}
              placement="right"
            >
              <ListItemButton
                onClick={onToggleCollapse}
                sx={{
                  borderRadius: 1.25,
                  px: collapsed ? 1 : 1.15,
                  py: 0.85,
                  minHeight: 38,
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: "text.secondary",
                  border: 1,
                  borderColor: "divider",
                  "&:hover": {
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                    borderColor: "primary.main",
                    color: "primary.main",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 34,
                    color: "inherit",
                    justifyContent: "center",
                  }}
                >
                  {collapsed ? (
                    <ChevronRightIcon fontSize="small" />
                  ) : (
                    <ChevronLeftIcon fontSize="small" />
                  )}
                </ListItemIcon>
                {!collapsed && (
                  <ListItemText
                    primary={collapsed ? "Expand" : "Collapse"}
                    primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
                  />
                )}
              </ListItemButton>
            </Tooltip>
          </ListItem>
        )}

        {nav.map((n) => {
          const selected = tab === n.id;
          const tip = collapsed
            ? `${n.label}${n.shortcut ? ` (Alt+${n.shortcut})` : ""}`
            : "";
          return (
            <ListItem key={n.id} disablePadding sx={{ mb: 0.3 }}>
              <Tooltip title={tip} placement="right" disableHoverListener={!collapsed}>
                <ListItemButton
                  selected={selected}
                  onClick={() => onTabChange(n.id)}
                  sx={{
                    borderRadius: 1.25,
                    px: collapsed ? 1 : 1.15,
                    py: 0.85,
                    minHeight: 38,
                    justifyContent: collapsed ? "center" : "flex-start",
                    position: "relative",
                    "&.Mui-selected": {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.09),
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 7,
                        bottom: 7,
                        width: 3,
                        borderRadius: 1,
                        bgcolor: "primary.main",
                      },
                      "& .MuiListItemIcon-root": { color: "primary.main" },
                      "& .MuiListItemText-primary": {
                        fontWeight: 700,
                        color: "primary.main",
                      },
                    },
                    "&:hover": {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 34,
                      color: selected ? "primary.main" : "text.secondary",
                      justifyContent: "center",
                    }}
                  >
                    {n.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <>
                      <ListItemText
                        primary={n.label}
                        primaryTypographyProps={{
                          fontSize: 13.5,
                          fontWeight: selected ? 700 : 500,
                        }}
                      />
                      {n.shortcut && (
                        <Typography
                          component="span"
                          sx={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "text.disabled",
                            fontFamily: "monospace",
                            ml: 0.5,
                            opacity: selected ? 0.9 : 0.65,
                          }}
                        >
                          ⌥{n.shortcut}
                        </Typography>
                      )}
                    </>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      <Box sx={{ p: 1 }}>
        <Tooltip title={collapsed ? "Sign out" : ""} placement="right" disableHoverListener={!collapsed}>
          <ListItemButton
            onClick={onLogout}
            sx={{
              borderRadius: 1.25,
              color: "error.main",
              justifyContent: collapsed ? "center" : "flex-start",
              px: collapsed ? 1 : 1.15,
              py: 0.85,
              "&:hover": {
                bgcolor: (t) => alpha(t.palette.error.main, 0.08),
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 34,
                color: "error.main",
                justifyContent: "center",
              }}
            >
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            {!collapsed && (
              <ListItemText
                primary="Sign out"
                primaryTypographyProps={{ fontSize: 13 }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
