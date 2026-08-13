import React, { useEffect, useState } from "react";
import {
  AppBar, Avatar, Badge, Box, Button, Chip, Divider, FormControlLabel,
  IconButton, List, ListItem, ListItemText, Menu, MenuItem, Popover,
  Stack, Switch, Toolbar, Tooltip, Typography, alpha,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MarkChatReadIcon from "@mui/icons-material/MarkChatRead";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PeopleIcon from "@mui/icons-material/People";
import { isSessionSuperuser, isSessionStaff, authMediaSrc } from "../adminUtils";

/**
 * AdminTopBar — sticky header.
 *
 * Fixes:
 *   - Real profile image from me.profiles / me.avatar
 *   - "My profile" entry in the account menu
 *   - Cleaner spacing and density
 */
export default function AdminTopBar({
  me,
  title = "Admin",
  liveConnected,
  onMenuClick,
  showMenuButton,
  onBackToDeployer,
  onLogout,
  onNavigate,
  notifications = [],
  onMarkAllRead,
  unreadCount = 0,
}) {
  const [profileMenu, setProfileMenu] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem("admin_notifications_muted") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("admin_notifications_muted", muted ? "1" : "0");
    } catch { /* */ }
  }, [muted]);

  const isSuper = isSessionSuperuser();
  const isStaff = isSessionStaff();
  const effectiveUnread = muted ? 0 : unreadCount;

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
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.92),
        color: "text.primary",
        borderBottom: 1,
        borderColor: "divider",
        backdropFilter: "blur(10px)",
      }}
    >
      <Toolbar sx={{ gap: 1.25, px: { xs: 1.25, sm: 2 }, minHeight: { xs: 56, sm: 60 } }}>
        {showMenuButton && (
          <IconButton onClick={onMenuClick} aria-label="open navigation" size="small">
            <MenuIcon />
          </IconButton>
        )}

        <Box sx={{ minWidth: 0, flex: { xs: 1, sm: 0 } }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}
          >
            Admin Console
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={onBackToDeployer}
          sx={{
            display: { xs: "none", sm: "inline-flex" },
            borderRadius: 1,
            textTransform: "none",
            fontWeight: 600,
            borderColor: "divider",
            color: "text.primary",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            },
          }}
        >
          Deployer
        </Button>

        <Tooltip title={liveConnected ? "WebSocket connected" : "Realtime offline"}>
          <Chip
            size="small"
            variant="outlined"
            icon={
              <FiberManualRecordIcon
                sx={{ fontSize: 10, color: liveConnected ? "success.main" : "text.disabled" }}
              />
            }
            label={liveConnected ? "Live" : "Offline"}
            sx={{
              mr: 0.25,
              display: { xs: "none", md: "inline-flex" },
              borderRadius: 1,
              height: 26,
              fontWeight: 600,
            }}
          />
        </Tooltip>

        {/* Notifications */}
        <Tooltip title={muted ? "Notifications muted" : "Notifications"}>
          <IconButton onClick={(e) => setNotifAnchor(e.currentTarget)} size="small">
            {muted ? (
              <NotificationsOffIcon fontSize="small" />
            ) : (
              <Badge badgeContent={effectiveUnread > 0 ? effectiveUnread : null} color="error">
                <NotificationsIcon fontSize="small" />
              </Badge>
            )}
          </IconButton>
        </Tooltip>

        <Popover
          open={Boolean(notifAnchor)}
          anchorEl={notifAnchor}
          onClose={() => setNotifAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{ paper: { sx: { width: 360, maxWidth: "100vw", mt: 1, borderRadius: 1.5 } } }}
        >
          <Box
            sx={{
              p: 1.5,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle2" fontWeight={800}>
              Notifications
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!muted}
                  onChange={(e) => setMuted(!e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">{muted ? "Muted" : "On"}</Typography>
              }
              sx={{ mr: 0 }}
            />
          </Box>
          <Box sx={{ maxHeight: 340, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <Box sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  No notifications
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {notifications.slice(0, 30).map((n) => (
                  <ListItem
                    key={n.id}
                    sx={{
                      bgcolor: n.unread ? (t) => alpha(t.palette.primary.main, 0.04) : "transparent",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      py: 1,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          {n.unread && (
                            <FiberManualRecordIcon sx={{ fontSize: 8, color: "primary.main" }} />
                          )}
                          <Typography
                            variant="body2"
                            fontWeight={n.unread ? 700 : 500}
                            noWrap
                          >
                            {n.title}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <>
                          {n.body && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              noWrap
                            >
                              {n.body}
                            </Typography>
                          )}
                          {n.ts && (
                            <Typography
                              variant="overline"
                              color="text.disabled"
                              sx={{ fontSize: 9 }}
                            >
                              {new Date(n.ts).toLocaleString()}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
          <Box
            sx={{
              p: 1,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <Button
              size="small"
              startIcon={<MarkChatReadIcon />}
              onClick={() => {
                onMarkAllRead?.();
                setNotifAnchor(null);
              }}
              disabled={!unreadCount}
              sx={{ textTransform: "none" }}
            >
              Mark all read
            </Button>
            <Button size="small" onClick={() => setNotifAnchor(null)} sx={{ textTransform: "none" }}>
              Close
            </Button>
          </Box>
        </Popover>

        {/* Profile */}
        <Tooltip title={me?.username || "Account"}>
          <IconButton
            onClick={(e) => setProfileMenu(e.currentTarget)}
            size="small"
            sx={{ p: 0.4 }}
          >
            <Avatar
              src={avatarSrc || undefined}
              sx={{
                width: 32,
                height: 32,
                bgcolor: "primary.main",
                fontSize: 13,
                fontWeight: 700,
                borderRadius: 1,
              }}
            >
              {initial}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu
          anchorEl={profileMenu}
          open={Boolean(profileMenu)}
          onClose={() => setProfileMenu(null)}
          slotProps={{ paper: { sx: { mt: 1, minWidth: 240, borderRadius: 1.5 } } }}
        >
          <Box sx={{ px: 2, py: 1.25 }}>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <Avatar
                src={avatarSrc || undefined}
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: "primary.main",
                  fontWeight: 700,
                  borderRadius: 1,
                }}
              >
                {initial}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>
                  {me?.username || "—"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {me?.email || "—"}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" gap={0.5} mt={1} flexWrap="wrap">
              {isSuper && (
                <Chip size="small" color="error" label="superuser" sx={{ height: 20, fontSize: 11 }} />
              )}
              {isStaff && !isSuper && (
                <Chip size="small" color="primary" label="staff" sx={{ height: 20, fontSize: 11 }} />
              )}
            </Stack>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              setProfileMenu(null);
              onNavigate?.("profile");
            }}
          >
            <PersonOutlineIcon fontSize="small" sx={{ mr: 1.5 }} />
            My profile
          </MenuItem>
          <MenuItem
            onClick={() => {
              setProfileMenu(null);
              onNavigate?.("users");
            }}
          >
            <PeopleIcon fontSize="small" sx={{ mr: 1.5 }} />
            Users &amp; access
          </MenuItem>
          <MenuItem
            onClick={() => {
              setProfileMenu(null);
              onBackToDeployer?.();
            }}
          >
            <ArrowBackIcon fontSize="small" sx={{ mr: 1.5 }} />
            Back to deployer
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              setProfileMenu(null);
              onLogout?.();
            }}
            sx={{ color: "error.main" }}
          >
            <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
