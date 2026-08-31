import React, { useEffect, useRef, useState } from "react";
import { TicketNotifyBell } from "../tickets/TicketNotifyContext.jsx";
import {
  Link as RouterLink,
  matchPath,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Typography,
  alpha,
} from "@mui/material";

import { useTheme } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import MiscellaneousServicesOutlinedIcon from "@mui/icons-material/MiscellaneousServicesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";

import { useProfiles, resolveProfileImageUrl } from "../profile/profile.jsx";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const DEFAULT_ICON = "/icon.svg";

const baseNavItems = [
  { path: "/", label: "Home", icon: HomeOutlinedIcon, guest: true },
  { path: "/docs", label: "Docs", icon: MenuBookOutlinedIcon, guest: true },
  { path: "/services", label: "Services", icon: MiscellaneousServicesOutlinedIcon, guest: false },
  { path: "/volumes", label: "Volumes", icon: Inventory2OutlinedIcon, guest: false },
  { path: "/networks", label: "Networks", icon: LanOutlinedIcon, guest: false },
  { path: "/tickets", label: "Tickets", icon: ConfirmationNumberOutlinedIcon, guest: false },
  { path: "/messenger", label: "Messenger", icon: ChatBubbleOutlineIcon, guest: false },
  { path: "/admin", label: "Admin", icon: AdminPanelSettingsOutlinedIcon, guest: false, staffOnly: true },
  { path: "/plans", label: "Plans", icon: PaidOutlinedIcon, guest: true },
  { path: "/aboutUs", label: "About us", icon: InfoOutlinedIcon, guest: true },
  { path: "/profile", label: "Profile", icon: PersonOutlineOutlinedIcon, guest: false },
];

const themeChoices = [
  { value: "light", label: "Light", icon: LightModeOutlinedIcon },
  { value: "dark", label: "Dark", icon: DarkModeOutlinedIcon },
  { value: "system", label: "System", icon: SettingsBrightnessOutlinedIcon },
];

export default function Navbar({ themeMode = "system", onThemeModeChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userImage, setUserImage] = useState(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const firstItemRef = useRef(null);
  const authCheckStartedRef = useRef(false);
  const profileRequestRef = useRef(null);
  const profilesLoadedRef = useRef(false);
  const currentProfileIdRef = useRef(null);
  const mountedRef = useRef(true);
  const previousViewedProfileIdRef = useRef(null);

  const { profiles, fetchProfiles: refreshProfiles, primaryImageUrl } = useProfiles();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const appBarBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.background.paper, 0.72)
      : alpha(theme.palette.background.paper, 0.88);

  const drawerPaperBg =
    theme.palette.mode === "dark" ? "rgba(10, 15, 28, 0.96)" : "rgba(255, 255, 255, 0.97)";

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/services") {
      return location.pathname === "/services" || location.pathname.startsWith("/service/");
    }
    if (path === "/tickets") {
      return location.pathname === "/tickets" || location.pathname.startsWith("/tickets/");
    }
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    }
    return Boolean(matchPath({ path, end: true }, location.pathname));
  };

  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    if (!drawerOpen || !firstItemRef.current) return undefined;
    const timer = window.setTimeout(() => {
      firstItemRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [drawerOpen]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const getProfileId = (profile) => {
    if (!profile) return null;
    return profile.id ?? profile.pk ?? profile.uuid ?? profile.user_id ?? null;
  };

  const getProfileImage = (profile) => resolveProfileImageUrl(profile);

  const getViewedProfileId = () => {
    const match = location.pathname.match(/^\/profile\/([^/]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  };

  useEffect(() => {
    if (!loggedIn) {
      currentProfileIdRef.current = null;
      if (mountedRef.current) setUserImage(null);
      return;
    }

    if (!Array.isArray(profiles) || profiles.length === 0) return;

    const sortedProfiles = [...profiles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const currentProfile = sortedProfiles[0];
    const profileId = getProfileId(currentProfile);
    const imageUrl = getProfileImage(currentProfile);

    currentProfileIdRef.current = profileId;

    if (mountedRef.current) {
      const next = imageUrl || primaryImageUrl || null;
      setUserImage((previousImage) => (previousImage === next ? previousImage : next));
    }
  }, [profiles, loggedIn, primaryImageUrl]);

  const loadProfilesIfNeeded = async ({ force = false, viewedProfileId = null } = {}) => {
    if (!loggedIn) return;

    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    const hasProfiles = Array.isArray(profiles) && profiles.length > 0;
    const currentProfileId = currentProfileIdRef.current;
    const profileChanged =
      viewedProfileId && currentProfileId && String(viewedProfileId) !== String(currentProfileId);

    if (!force && profilesLoadedRef.current && hasProfiles && !profileChanged) return;

    if (!force && hasProfiles && !profileChanged) {
      profilesLoadedRef.current = true;
      return;
    }

    try {
      const request = Promise.resolve(refreshProfiles());
      profileRequestRef.current = request;
      await request;
      if (mountedRef.current) profilesLoadedRef.current = true;
    } catch (error) {
      console.error("Failed to load profiles:", error);
    } finally {
      if (profileRequestRef.current) profileRequestRef.current = null;
    }
  };

  const runAuthCheck = async ({ force = false } = {}) => {
    const accessToken = window.localStorage.getItem("access");

    if (!accessToken) {
      if (mountedRef.current) {
        setLoggedIn(false);
      setIsStaff(false);
        setUserImage(null);
        setCheckingAuth(false);
        profilesLoadedRef.current = false;
        currentProfileIdRef.current = null;
      }
      return false;
    }

    if (location.pathname === "/signin_or_signup") {
      if (mountedRef.current) {
        setLoggedIn(false);
      setIsStaff(false);
        setCheckingAuth(false);
      }
      return false;
    }

    if (mountedRef.current) setCheckingAuth(true);

    try {
      const validateRes = await fetch(`${API_BASE}/auth/api/validateToken/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mountedRef.current) return false;

      if (!validateRes.ok) {
        setLoggedIn(false);
        setIsStaff(false);
        setUserImage(null);
        profilesLoadedRef.current = false;
        currentProfileIdRef.current = null;
        return false;
      }

      setLoggedIn(true);
      try {
        const body = await validateRes.json();
        const u = body.user || body;
        setIsStaff(Boolean(u?.is_staff || u?.is_superuser));
      } catch {
        // fallback: fetch user profile flags
        try {
          await refreshStaffFlag();
        } catch {
          setIsStaff(false);
        }
      }
      await loadProfilesIfNeeded({ force });
      return true;
    } catch (error) {
      if (mountedRef.current) {
        console.error("Auth check failed:", error);
        setLoggedIn(false);
      setIsStaff(false);
        setUserImage(null);
        profilesLoadedRef.current = false;
        currentProfileIdRef.current = null;
      }
      return false;
    } finally {
      if (mountedRef.current) setCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (authCheckStartedRef.current) return;
    authCheckStartedRef.current = true;

    let cancelled = false;

    (async () => {
      if (cancelled) return;
      await runAuthCheck();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleAuthChanged = () => {
      runAuthCheck({ force: true });
    };

    const handleStorage = (e) => {
      if (e.key === "access" || e.key === "refresh") {
        runAuthCheck({ force: true });
      }
    };

    window.addEventListener("auth-changed", handleAuthChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === "/signin_or_signup") return;

    const accessToken = window.localStorage.getItem("access");
    if (accessToken && !loggedIn && !checkingAuth) {
      runAuthCheck({ force: true });
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!loggedIn) return;

    const viewedProfileId = getViewedProfileId();

    if (!viewedProfileId) {
      previousViewedProfileIdRef.current = null;
      return;
    }

    const previousViewedProfileId = previousViewedProfileIdRef.current;

    if (previousViewedProfileId && String(previousViewedProfileId) === String(viewedProfileId)) {
      return;
    }

    previousViewedProfileIdRef.current = viewedProfileId;

    const currentProfileId = currentProfileIdRef.current;
    if (currentProfileId && String(currentProfileId) === String(viewedProfileId)) {
      return;
    }

    loadProfilesIfNeeded({ force: true, viewedProfileId });
  }, [location.pathname, loggedIn]);

  const handleLogoutConfirm = () => {
    window.localStorage.removeItem("access");
    window.localStorage.removeItem("refresh");

    profilesLoadedRef.current = false;
    currentProfileIdRef.current = null;
    previousViewedProfileIdRef.current = null;
    profileRequestRef.current = null;

    setLoggedIn(false);
      setIsStaff(false);
    setUserImage(null);
    setCheckingAuth(false);
    setLogoutDialogOpen(false);

    try {
      window.dispatchEvent(new Event("auth-changed"));
    } catch {}

    navigate("/signin_or_signup");
  };

  const handleSignInClick = async ({ fromMenu = false } = {}) => {
    if (checkingAuth) return;

    const accessToken = window.localStorage.getItem("access");

    if (!accessToken) {
      window.localStorage.setItem("auth_mode", "signin_or_signup");
      if (fromMenu) closeDrawer();
      navigate("/signin_or_signup");
      return;
    }

    setCheckingAuth(true);

    try {
      const validateRes = await fetch(`${API_BASE}/auth/api/validateToken/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!validateRes.ok) {
        window.localStorage.setItem("auth_mode", "signin_or_signup");
        setLoggedIn(false);
      setIsStaff(false);
        setUserImage(null);
        profilesLoadedRef.current = false;
        currentProfileIdRef.current = null;
        if (fromMenu) closeDrawer();
        navigate("/signin_or_signup");
        return;
      }

      setLoggedIn(true);
      await loadProfilesIfNeeded();
      if (fromMenu) closeDrawer();
    } catch (error) {
      console.error("Auth validation failed on sign-in click:", error);
      window.localStorage.setItem("auth_mode", "signin_or_signup");
      setLoggedIn(false);
      setIsStaff(false);
      setUserImage(null);
      profilesLoadedRef.current = false;
      currentProfileIdRef.current = null;
      if (fromMenu) closeDrawer();
      navigate("/signin_or_signup");
    } finally {
      if (mountedRef.current) setCheckingAuth(false);
    }
  };

  const handleThemeChange = (_, nextMode) => {
    if (!nextMode || nextMode === themeMode) return;
    if (typeof onThemeModeChange === "function") onThemeModeChange(nextMode);
  };

  const drawerWidth = { xs: "88vw", sm: 360, md: 396 };
  const avatarSrc = userImage || DEFAULT_ICON;
  
  async function refreshStaffFlag() {
    try {
      const accessToken = window.localStorage.getItem("access");
      if (!accessToken) {
        setIsStaff(false);
        return;
      }
      let res = await fetch(`${API_BASE}/api/users/user/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/users/user/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
      if (!res.ok) {
        setIsStaff(false);
        return;
      }
      const data = await res.json();
      const u = data.user || data;
      setIsStaff(Boolean(u?.is_staff || u?.is_superuser));
    } catch {
      setIsStaff(false);
    }
  };

  useEffect(() => {
    if (loggedIn) refreshStaffFlag();
    else setIsStaff(false);
  }, [loggedIn]);

  const visibleNavItems = baseNavItems.filter((item) => {
    if (!loggedIn && !item.guest) return false;
    if (item.staffOnly && !isStaff) return false;
    return loggedIn || item.guest;
  });

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: appBarBg,
          color: "text.primary",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            minHeight: { xs: 64, sm: 72 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open sidebar"
              onClick={() => setDrawerOpen(true)}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: alpha(theme.palette.text.primary, 0.08),
                bgcolor: alpha(theme.palette.background.paper, 0.16),
                "&:hover": {
                  bgcolor: alpha(theme.palette.background.paper, 0.28),
                },
              }}
            >
              <MenuIcon />
            </IconButton>

            <Button
              component={RouterLink}
              to="/"
              onClick={() => setDrawerOpen(false)}
              disableElevation
              sx={{
                p: 0,
                minWidth: 0,
                textTransform: "none",
                color: "inherit",
                justifyContent: "flex-start",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.25,
                  minWidth: 0,
                }}
              >
                <Box
                  component="img"
                  src={DEFAULT_ICON}
                  alt="PaaS Deployer"
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    flexShrink: 0,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    minWidth: 0,
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
                    PaaS Deployer
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Modern control panel
                  </Typography>
                </Box>
              </Box>
            </Button>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!checkingAuth && loggedIn ? (
              <>
              <TicketNotifyBell />
              <IconButton
                onClick={() => navigate("/profile")}
                aria-label="Open profile"
                sx={{
                  p: 0.25,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.text.primary, 0.08),
                }}
              >
                <Avatar
                  src={userImage || DEFAULT_ICON}
                  alt="User"
                  sx={{ width: 38, height: 38 }}
                  imgProps={{
                    onError: (e) => {
                      if (e.currentTarget.src !== DEFAULT_ICON) {
                        e.currentTarget.src = DEFAULT_ICON;
                      }
                    },
                  }}
                />
              </IconButton>
              </>
            ) : !checkingAuth ? (
              <>
                {/* Mobile View: Icon Only */}
                <IconButton
                  onClick={() => handleSignInClick({ fromMenu: false })}
                  aria-label="Sign in"
                  sx={{
                    display: { xs: "flex", sm: "none" },
                    border: "1px solid",
                    borderColor: alpha(theme.palette.text.primary, 0.14),
                    color: "inherit",
                    bgcolor: alpha(theme.palette.background.paper, 0.16),
                    borderRadius: 2,
                  }}
                >
                  <LoginOutlinedIcon fontSize="small" />
                </IconButton>

                {/* Tablet/Desktop View: Full Text Button */}
                <Button
                  variant="outlined"
                  onClick={() => handleSignInClick({ fromMenu: false })}
                  startIcon={<LoginOutlinedIcon />}
                  sx={{
                    display: { xs: "none", sm: "flex" },
                    borderColor: alpha(theme.palette.text.primary, 0.14),
                    color: "inherit",
                    bgcolor: alpha(theme.palette.background.paper, 0.16),
                    textTransform: "none",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  Sign in / Sign up
                </Button>
              </>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            width: drawerWidth,
            maxWidth: 420,
            bgcolor: drawerPaperBg,
            color: theme.palette.text.primary,
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            borderRight: "1px solid",
            borderColor: alpha(theme.palette.divider, 0.9),
            boxShadow:
              theme.palette.mode === "dark"
                ? "24px 0 48px rgba(0,0,0,0.35)"
                : "24px 0 48px rgba(15, 23, 42, 0.12)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor:
              theme.palette.mode === "dark" ? "rgba(0,0,0,0.58)" : "rgba(15,23,42,0.38)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            pt: 2,
            pb: 1.5,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            borderBottom: "1px solid",
            borderColor: alpha(theme.palette.divider, 1),
            flexShrink: 0,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            component={RouterLink}
            to="/"
            onClick={closeDrawer}
            sx={{ color: "inherit", textDecoration: "none", minWidth: 0 }}
          >
            <Box
              component="img"
              src={DEFAULT_ICON}
              alt="PaaS Deployer"
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                flexShrink: 0,
                objectFit: "contain",
                display: "block",
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 8px 20px rgba(0,0,0,0.35)"
                    : "0 8px 20px rgba(47,102,255,0.18)",
              }}
            />

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.1 }} noWrap>
                PaaS Deployer
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                Navigation & theme controls
              </Typography>
            </Box>
          </Stack>

          <IconButton aria-label="Close sidebar" onClick={closeDrawer} sx={{ borderRadius: 2 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box
            component="nav"
            aria-label="Sidebar navigation"
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              px: 1.25,
              py: 1.5,
            }}
          >
            <List sx={{ p: 0 }}>
              {visibleNavItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <ListItemButton
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    selected={active}
                    aria-current={active ? "page" : undefined}
                    onClick={closeDrawer}
                    ref={index === 0 ? firstItemRef : null}
                    sx={{
                      mb: 0.75,
                      borderRadius: 3,
                      px: 1.5,
                      py: 1.1,
                      color: active ? "primary.main" : "text.primary",
                      position: "relative",
                      overflow: "hidden",
                      transition:
                        "transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease, color 180ms ease",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: 8,
                        top: 8,
                        bottom: 8,
                        width: 4,
                        borderRadius: 999,
                        backgroundColor: active ? theme.palette.primary.main : "transparent",
                        transition: "background-color 180ms ease",
                      },
                      "&:hover": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.16 : 0.08
                        ),
                        transform: "translateX(2px)",
                      },
                      "&.Mui-selected": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.22 : 0.12
                        ),
                        boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.16)}`,
                      },
                      "&.Mui-selected:hover": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark" ? 0.26 : 0.16
                        ),
                      },
                      "&.Mui-focusVisible": {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: active ? "primary.main" : "text.secondary",
                      }}
                    >
                      <Icon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active ? 800 : 600,
                        noWrap: true,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>

            <Box
              sx={{
                mt: 1.5,
                pt: 1.75,
                borderTop: "1px solid",
                borderColor: alpha(theme.palette.divider, 1),
              }}
            >
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar
                  src={avatarSrc}
                  alt="User avatar"
                  sx={{
                    width: 42,
                    height: 42,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                    {loggedIn ? "Workspace ready" : "Guest mode"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {loggedIn
                      ? "Manage your account and deployments"
                      : "Sign in to sync your account"}
                  </Typography>
                </Box>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ mt: 1.25 }}
              >
                {loggedIn ? (
                  <>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<PersonOutlineOutlinedIcon />}
                      onClick={() => {
                        closeDrawer();
                        navigate("/profile");
                      }}
                    >
                      Profile
                    </Button>

                    <Button
                      fullWidth
                      variant="contained"
                      color="error"
                      startIcon={<LogoutOutlinedIcon />}
                      onClick={() => {
                        closeDrawer();
                        setLogoutDialogOpen(true);
                      }}
                    >
                      Logout
                    </Button>
                  </>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LoginOutlinedIcon />}
                    onClick={() => handleSignInClick({ fromMenu: true })}
                    disabled={checkingAuth}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    Sign in / Sign up
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              px: 2,
              py: 1.75,
              borderTop: "1px solid",
              borderColor: alpha(theme.palette.divider, 1),
              background:
                theme.palette.mode === "dark"
                  ? "linear-gradient(180deg, rgba(17,24,39,0.15), rgba(17,24,39,0.28))"
                  : "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.95))",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  Theme
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Light, dark, or system
                </Typography>
              </Box>
            </Stack>

            <ToggleButtonGroup
              fullWidth
              exclusive
              value={themeMode}
              onChange={handleThemeChange}
              aria-label="Theme mode"
              size="small"
              sx={{
                gap: 0.75,
                "& .MuiToggleButton-root": {
                  flex: 1,
                  minHeight: 44,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.text.primary, 0.12),
                  borderRadius: 2.25,
                  px: 1,
                  color: "text.secondary",
                },
                "& .MuiToggleButton-root.Mui-selected": {
                  color: "primary.main",
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.18 : 0.1
                  ),
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
                "& .MuiToggleButton-root.Mui-selected:hover": {
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark" ? 0.24 : 0.14
                  ),
                },
              }}
            >
              {themeChoices.map((choice) => {
                const ChoiceIcon = choice.icon;
                return (
                  <ToggleButton key={choice.value} value={choice.value} aria-label={choice.label}>
                    <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="center">
                      <ChoiceIcon fontSize="small" />
                      <Typography variant="caption" sx={{ fontWeight: 800 }}>
                        {choice.label}
                      </Typography>
                    </Stack>
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Drawer>

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm logout</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to log out?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleLogoutConfirm} color="error" variant="contained" autoFocus>
            Logout
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}