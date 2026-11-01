import React, { useEffect, useState } from "react";
import TranslatedTextTree from "../../../i18n/TranslatedTextTree.jsx";
import {
  AppBar, Avatar, Badge, Box, Button, Chip, Dialog, DialogContent,
  DialogTitle, Divider, FormControlLabel, IconButton, InputAdornment, List,
  ListItem, ListItemButton, ListItemText, Menu, MenuItem, Popover, Stack,
  Switch, TextField, Toolbar, Tooltip, Typography, alpha,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SearchRoundedIcon from "@mui/icons-material/Search";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import LogoutIcon from "@mui/icons-material/Logout";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MarkChatReadIcon from "@mui/icons-material/MarkChatRead";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import PeopleIcon from "@mui/icons-material/People";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import { isSessionSuperuser, isSessionStaff, authMediaSrc } from "../adminUtils";
import ThemeMenuButton from "../../layout/ThemeMenuButton.jsx";
import LanguageSwitcher from "../../layout/LanguageSwitcher.jsx";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";

const QUICK_NAV_ICONS = {
  overview: <DashboardRoundedIcon fontSize="small" />,
  tickets: <ConfirmationNumberOutlinedIcon fontSize="small" />,
  departments: <AccountTreeOutlinedIcon fontSize="small" />,
  users: <PeopleAltOutlinedIcon fontSize="small" />,
  services: <DnsOutlinedIcon fontSize="small" />,
  plans: <StorageOutlinedIcon fontSize="small" />,
  tables: <TableChartOutlinedIcon fontSize="small" />,
  docs: <MenuBookOutlinedIcon fontSize="small" />,
  login: <SettingsOutlinedIcon fontSize="small" />,
  invites: <LinkOutlinedIcon fontSize="small" />,
  codes: <VpnKeyOutlinedIcon fontSize="small" />,
  emails: <EmailOutlinedIcon fontSize="small" />,
  profile: <PersonOutlineIcon fontSize="small" />,
};

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
  navItems = [],
  notifications = [],
  onMarkAllRead,
  unreadCount = 0,
  themeMode = "system",
  onThemeModeChange,
}) {
  const { t } = useLocale();
  const [profileMenu, setProfileMenu] = useState(null);
  const [notifAnchor, setNotifAnchor] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
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

  useEffect(() => {
    const handleCommandShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        setCommandQuery("");
      }
    };
    window.addEventListener("keydown", handleCommandShortcut);
    return () => window.removeEventListener("keydown", handleCommandShortcut);
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    const query = commandQuery.trim().toLocaleLowerCase();
    if (!query) return true;
    return `${item.label} ${item.description || ""}`.toLocaleLowerCase().includes(query);
  });

  const openAdminPage = (id) => {
    setCommandOpen(false);
    setCommandQuery("");
    onNavigate?.(id);
  };

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

  return (    <TranslatedTextTree>

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
      <Toolbar
        sx={{
          gap: { xs: 0.35, sm: 0.75, lg: 1.1 },
          px: { xs: 1, sm: 2, lg: 2.5 },
          minHeight: { xs: 58, sm: 64 },
          flexWrap: "nowrap",
          minWidth: 0,
        }}
      >
        {showMenuButton && (
          <IconButton onClick={onMenuClick} aria-label="open navigation" size="small">
            <MenuIcon />
          </IconButton>
        )}

        <Box sx={{ minWidth: 0, flex: { xs: "1 1 auto", sm: "0 1 auto" }, flexShrink: 1 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap sx={{ lineHeight: 1.2 }}>
            {t(title)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.2 }}
          >
            Admin Console
          </Typography>
        </Box>

        <Box sx={{ flex: "1 1 0", minWidth: { xs: 0, sm: 4 }, display: { xs: "none", sm: "block" } }} />

        <Tooltip title={t("Search admin pages (Ctrl+K)")}>
          <IconButton
            onClick={() => {
              setCommandOpen(true);
              setCommandQuery("");
            }}
            aria-label={t("Search admin pages")}
            size="small"
            sx={{
              display: { xs: "inline-flex", lg: "none" },
              width: 36,
              height: 36,
              flexShrink: 0,
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <SearchRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          onClick={() => {
            setCommandOpen(true);
            setCommandQuery("");
          }}
          startIcon={<SearchRoundedIcon />}
          endIcon={
            <Box
              component="kbd"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 34,
                height: 20,
                px: 0.55,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                color: "text.secondary",
                fontFamily: '"Inter", ui-sans-serif, sans-serif',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 0,
                lineHeight: 1,
                whiteSpace: "nowrap",
                boxShadow: "0 1px 0 rgba(15, 23, 42, 0.08)",
              }}
            >
              Ctrl+K
            </Box>
          }
          sx={{
            display: { xs: "none", lg: "inline-flex" },
            width: 152,
            minWidth: 152,
            maxWidth: 152,
            height: 35,
            minHeight: 35,
            flexShrink: 0,
            justifyContent: "flex-start",
            px: 1,
            borderRadius: 1.5,
            border: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
            bgcolor: "action.hover",
            textTransform: "none",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: 0,
            "& .MuiButton-startIcon": {
              mr: 0.75,
              ml: 0,
              "& svg": { fontSize: 17 },
            },
            "& .MuiButton-endIcon": { ml: "auto", mr: 0 },
            "&:hover": { borderColor: "primary.main", bgcolor: "action.selected" },
          }}
        >
          {t("Search pages")}
        </Button>

        <LanguageSwitcher />
        <ThemeMenuButton
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
          buttonSx={{
            width: { xs: 36, sm: 38 },
            height: { xs: 36, sm: 38 },
          }}
        />

        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
          onClick={onBackToDeployer}
          sx={{
            display: "inline-flex",
            minWidth: { xs: 36, sm: "auto" },
            px: { xs: 0.5, sm: 1.25 },
            flexShrink: 0,
            borderRadius: 1.5,
            textTransform: "none",
            fontWeight: 600,
            borderColor: "divider",
            color: "text.primary",
            "&:hover": {
              borderColor: "primary.main",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            },
            "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
          }}
          aria-label="Back to Deployer"
        >
          <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
            {t("Back to deployer")}
          </Box>
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
              display: { xs: "none", lg: "inline-flex" },
              borderRadius: 1,
              height: 26,
              fontWeight: 600,
            }}
          />
        </Tooltip>

        {/* Notifications */}
        <Tooltip title={muted ? "Notifications muted" : "Notifications"}>
          <IconButton
            onClick={(e) => setNotifAnchor(e.currentTarget)}
            size="small"
            aria-label="Notifications"
            sx={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 1.5,
            }}
          >
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
            {t("Back to deployer")}
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

        <Dialog
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                mt: { xs: 0, sm: 5 },
                alignSelf: { xs: "stretch", sm: "flex-start" },
                borderRadius: { xs: 0, sm: 3 },
                overflow: "hidden",
                border: 1,
                borderColor: "divider",
                boxShadow: "0 28px 90px rgba(2, 8, 23, 0.28)",
              },
            },
          }}
        >
          <DialogTitle sx={{ px: { xs: 2, sm: 2.5 }, pt: 2.25, pb: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box>
                <Typography fontWeight={850}>{t("Quick navigation")}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("Find an admin section without leaving your keyboard")}
                </Typography>
              </Box>
              <Chip
                size="small"
                label="ESC"
                variant="outlined"
                sx={{
                  height: 22,
                  minWidth: 38,
                  borderRadius: 1.25,
                  fontFamily: '"Inter", ui-sans-serif, sans-serif',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.02,
                }}
              />
            </Stack>
          </DialogTitle>
          <DialogContent sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5 }}>
            <TextField
              autoFocus
              fullWidth
              size="medium"
              placeholder={t("Search pages and tools…")}
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2.25 } }}
            />
            <Stack spacing={0.5} sx={{ mt: 1.25, maxHeight: "min(52vh, 440px)", overflowY: "auto" }}>
              {filteredNavItems.length ? filteredNavItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  onClick={() => openAdminPage(item.id)}
                  sx={{
                    borderRadius: 2,
                    px: 1.25,
                    py: 1,
                    minHeight: 58,
                    gap: 1.25,
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.5,
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                      color: "primary.main",
                      fontWeight: 850,
                    }}
                  >
                    {QUICK_NAV_ICONS[item.id] || <SearchRoundedIcon fontSize="small" />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={750} fontSize={13.5}>{t(item.label)}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t(item.description || "Open this admin section")}
                    </Typography>
                  </Box>
                  <ArrowForwardRoundedIcon fontSize="small" color="disabled" />
                </ListItemButton>
              )) : (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography fontWeight={700}>{t("No matching admin pages")}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t("Try another page name or keyword")}
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
        </Dialog>
      </Toolbar>
    </AppBar>
    </TranslatedTextTree>
  );
}
