import React, { useEffect, useRef, useState } from "react";
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
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import SettingsBrightnessOutlinedIcon from "@mui/icons-material/SettingsBrightnessOutlined";

import defaultUserIcon from "../../assets/icons/user.svg";
import { useProfiles } from "../profile/profile.jsx";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;

const navItems = [
  { path: "/", label: "Home", icon: HomeOutlinedIcon },
  {
    path: "/services",
    label: "Services",
    icon: MiscellaneousServicesOutlinedIcon,
  },
  {
    path: "/volumes",
    label: "Volumes",
    icon: Inventory2OutlinedIcon,
  },
  {
    path: "/networks",
    label: "Networks",
    icon: LanOutlinedIcon,
  },
  {
    path: "/plans",
    label: "Plans",
    icon: PaidOutlinedIcon,
  },
  {
    path: "/aboutUs",
    label: "About us",
    icon: InfoOutlinedIcon,
  },
  {
    path: "/profile",
    label: "Profile",
    icon: PersonOutlineOutlinedIcon,
  },
];

const themeChoices = [
  {
    value: "light",
    label: "Light",
    icon: LightModeOutlinedIcon,
  },
  {
    value: "dark",
    label: "Dark",
    icon: DarkModeOutlinedIcon,
  },
  {
    value: "system",
    label: "System",
    icon: SettingsBrightnessOutlinedIcon,
  },
];

export default function Navbar({
  themeMode = "system",
  onThemeModeChange,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userImage, setUserImage] = useState(null);

  const firstItemRef = useRef(null);

  /*
   * ---------------------------------------------------------
   * Request guards
   * ---------------------------------------------------------
   */

  // Prevent validateToken from running repeatedly.
  const authCheckStartedRef = useRef(false);

  // Prevent multiple profile requests at the same time.
  const profileRequestRef = useRef(null);

  // Remember the profile list we already loaded.
  const profilesLoadedRef = useRef(false);

  // Remember which profile is currently represented by the navbar.
  const currentProfileIdRef = useRef(null);

  // Prevent state updates after unmount.
  const mountedRef = useRef(true);

  /*
   * useProfiles
   */
  const { profiles, fetchProfiles: refreshProfiles } = useProfiles();

  /*
   * Keep mounted state.
   */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * Theme / UI
   * ---------------------------------------------------------
   */

  const appBarBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.background.paper, 0.72)
      : alpha(theme.palette.background.paper, 0.88);

  const drawerPaperBg =
    theme.palette.mode === "dark"
      ? "rgba(10, 15, 28, 0.96)"
      : "rgba(255, 255, 255, 0.97)";

  const isActive = (path) => {
    if (path === "/") {
      return location.pathname === "/";
    }

    if (path === "/services") {
      return (
        location.pathname === "/services" ||
        location.pathname.startsWith("/service/")
      );
    }

    return Boolean(
      matchPath(
        {
          path,
          end: true,
        },
        location.pathname
      )
    );
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  /*
   * ---------------------------------------------------------
   * Drawer focus
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!drawerOpen || !firstItemRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      firstItemRef.current?.focus();
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [drawerOpen]);

  /*
   * Close drawer when route changes.
   *
   * IMPORTANT:
   * This effect ONLY controls the drawer.
   * It does NOT validate authentication.
   * It does NOT fetch profiles.
   */
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  /*
   * ---------------------------------------------------------
   * Profile helpers
   * ---------------------------------------------------------
   */

  const getProfileId = (profile) => {
    if (!profile) {
      return null;
    }

    return (
      profile.id ??
      profile.pk ??
      profile.uuid ??
      profile.user_id ??
      null
    );
  };

  const getProfileImage = (profile) => {
    if (!profile) {
      return null;
    }

    return (
      profile.image_url ??
      profile.image ??
      profile.avatar ??
      profile.avatar_url ??
      null
    );
  };

  /*
   * Get currently visible profile ID from URL.
   *
   * This supports common patterns such as:
   *
   * /profile
   * /profile/123
   * /profile/abc-uuid
   */
  const getViewedProfileId = () => {
    const pathname = location.pathname;

    const match = pathname.match(/^\/profile\/([^/]+)/);

    if (!match) {
      return null;
    }

    return decodeURIComponent(match[1]);
  };

  /*
   * ---------------------------------------------------------
   * Profile image
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * No userImage dependency here.
   *
   * The old version had:
   *
   * [profiles, loggedIn, userImage]
   *
   * while also changing userImage inside the effect.
   *
   * That's unnecessary and can cause extra render/effect cycles.
   */

  useEffect(() => {
    if (!loggedIn) {
      currentProfileIdRef.current = null;

      if (mountedRef.current) {
        setUserImage(null);
      }

      return;
    }

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return;
    }

    const sortedProfiles = [...profiles].sort(
      (a, b) => (a.order ?? 999) - (b.order ?? 999)
    );

    const currentProfile = sortedProfiles[0];

    const profileId = getProfileId(currentProfile);
    const imageUrl = getProfileImage(currentProfile);

    currentProfileIdRef.current = profileId;

    if (mountedRef.current) {
      setUserImage((previousImage) => {
        if (previousImage === imageUrl) {
          return previousImage;
        }

        return imageUrl;
      });
    }
  }, [profiles, loggedIn]);

  /*
   * ---------------------------------------------------------
   * Load profiles ONLY when necessary
   * ---------------------------------------------------------
   *
   * This function is intentionally NOT called on every route.
   *
   * It has three rules:
   *
   * 1. If not logged in -> don't fetch.
   *
   * 2. If we already have profiles -> don't fetch.
   *
   * 3. If another request is already running -> wait for it.
   */

  const loadProfilesIfNeeded = async ({
    force = false,
    viewedProfileId = null,
  } = {}) => {
    if (!loggedIn) {
      return;
    }

    /*
     * If another profile request is currently running,
     * don't create another one.
     */
    if (profileRequestRef.current) {
      return profileRequestRef.current;
    }

    /*
     * Determine whether we actually need the request.
     */
    const hasProfiles =
      Array.isArray(profiles) && profiles.length > 0;

    const currentProfileId = currentProfileIdRef.current;

    const profileChanged =
      viewedProfileId &&
      currentProfileId &&
      String(viewedProfileId) !== String(currentProfileId);

    /*
     * No force + profiles already loaded + same profile:
     * NO REQUEST.
     */
    if (
      !force &&
      profilesLoadedRef.current &&
      hasProfiles &&
      !profileChanged
    ) {
      return;
    }

    /*
     * If profiles exist and we're not viewing another profile,
     * there is no reason to reload.
     */
    if (
      !force &&
      hasProfiles &&
      !profileChanged
    ) {
      profilesLoadedRef.current = true;
      return;
    }

    try {
      const request = Promise.resolve(refreshProfiles());

      profileRequestRef.current = request;

      await request;

      if (mountedRef.current) {
        profilesLoadedRef.current = true;
      }
    } catch (error) {
      console.error("Failed to load profiles:", error);
    } finally {
      /*
       * Only clear the request if this is still the active request.
       */
      if (profileRequestRef.current) {
        profileRequestRef.current = null;
      }
    }
  };

  /*
   * ---------------------------------------------------------
   * Authentication
   * ---------------------------------------------------------
   *
   * THIS IS THE IMPORTANT FIX.
   *
   * Authentication validation does NOT depend on:
   *
   * location.pathname
   *
   * Therefore navigating:
   *
   * /
   * -> /services
   * -> /volumes
   * -> /networks
   * -> /plans
   *
   * will NOT call validateToken again.
   */

  useEffect(() => {
    /*
     * Prevent repeated execution.
     *
     * This also protects against React StrictMode causing
     * the effect setup to execute twice in development.
     */
    if (authCheckStartedRef.current) {
      return;
    }

    authCheckStartedRef.current = true;

    let cancelled = false;

    const checkAuth = async () => {
      const accessToken =
        window.localStorage.getItem("access");

      /*
       * No token = guest.
       */
      if (!accessToken) {
        if (!cancelled && mountedRef.current) {
          setLoggedIn(false);
          setCheckingAuth(false);
        }

        return;
      }

      /*
       * We don't need to validate on the login page.
       */
      if (location.pathname === "/login") {
        if (!cancelled && mountedRef.current) {
          setLoggedIn(false);
          setCheckingAuth(false);
        }

        return;
      }

      if (mountedRef.current) {
        setCheckingAuth(true);
      }

      try {
        const validateRes = await fetch(
          `${API_BASE}/auth/api/validateToken/`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (cancelled || !mountedRef.current) {
          return;
        }

        if (!validateRes.ok) {
          /*
           * Invalid access token.
           *
           * Don't repeatedly validate it.
           */
          setLoggedIn(false);
          setUserImage(null);
          profilesLoadedRef.current = false;
          currentProfileIdRef.current = null;

          return;
        }

        /*
         * Token is valid.
         */
        setLoggedIn(true);

        /*
         * Load profile once after authentication.
         *
         * This happens only here, not on every route.
         */
        await loadProfilesIfNeeded();
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          console.error("Auth check failed:", error);

          setLoggedIn(false);
          setUserImage(null);
          profilesLoadedRef.current = false;
          currentProfileIdRef.current = null;
        }
      } finally {
        if (!cancelled && mountedRef.current) {
          setCheckingAuth(false);
        }
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };

    /*
     * INTENTIONALLY EMPTY DEPENDENCY ARRAY.
     *
     * DO NOT add location.pathname here.
     *
     * DO NOT add refreshProfiles here.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * ---------------------------------------------------------
   * Profile route change handling
   * ---------------------------------------------------------
   *
   * Changing pages does NOT refresh the profile.
   *
   * Only when a concrete profile ID appears in the URL and
   * that ID is different from the currently loaded profile
   * do we request fresh profile data.
   *
   * Example:
   *
   * /services
   * /volumes
   * /plans
   *
   * -> NO profile request.
   *
   * /profile/10
   * /profile/10
   *
   * -> NO second request.
   *
   * /profile/10
   * /profile/20
   *
   * -> profile refresh is allowed.
   */

  const previousViewedProfileIdRef = useRef(null);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    const viewedProfileId = getViewedProfileId();

    /*
     * No concrete profile in URL.
     *
     * For /profile we keep the existing profile.
     */
    if (!viewedProfileId) {
      previousViewedProfileIdRef.current = null;
      return;
    }

    const previousViewedProfileId =
      previousViewedProfileIdRef.current;

    /*
     * Same profile as before -> nothing to do.
     */
    if (
      previousViewedProfileId &&
      String(previousViewedProfileId) ===
        String(viewedProfileId)
    ) {
      return;
    }

    previousViewedProfileIdRef.current = viewedProfileId;

    /*
     * If the profile currently loaded in the navbar is already
     * this profile, don't fetch it again.
     */
    const currentProfileId =
      currentProfileIdRef.current;

    if (
      currentProfileId &&
      String(currentProfileId) === String(viewedProfileId)
    ) {
      return;
    }

    /*
     * Different profile -> refresh.
     */
    loadProfilesIfNeeded({
      force: true,
      viewedProfileId,
    });

    /*
     * Intentionally only react to the pathname.
     * The auth effect is completely separate.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, loggedIn]);

  /*
   * ---------------------------------------------------------
   * Logout
   * ---------------------------------------------------------
   */

  const handleLogout = () => {
    window.localStorage.removeItem("access");
    window.localStorage.removeItem("refresh");

    /*
     * Reset local/cache state.
     */
    profilesLoadedRef.current = false;
    currentProfileIdRef.current = null;
    previousViewedProfileIdRef.current = null;
    profileRequestRef.current = null;

    setLoggedIn(false);
    setUserImage(null);
    setCheckingAuth(false);

    navigate("/login");
  };

  /*
   * ---------------------------------------------------------
   * Sign in
   * ---------------------------------------------------------
   */

  const handleSignInClick = async ({
    fromMenu = false,
  } = {}) => {
    if (checkingAuth) {
      return;
    }

    const accessToken =
      window.localStorage.getItem("access");

    /*
     * No token -> login page.
     */
    if (!accessToken) {
      window.localStorage.setItem("auth_mode", "login");

      if (fromMenu) {
        closeDrawer();
      }

      navigate("/login");

      return;
    }

    setCheckingAuth(true);

    try {
      const validateRes = await fetch(
        `${API_BASE}/auth/api/validateToken/`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!validateRes.ok) {
        window.localStorage.setItem("auth_mode", "login");

        setLoggedIn(false);
        setUserImage(null);

        profilesLoadedRef.current = false;
        currentProfileIdRef.current = null;

        if (fromMenu) {
          closeDrawer();
        }

        navigate("/login");

        return;
      }

      /*
       * Token valid.
       */
      setLoggedIn(true);

      /*
       * Only load profiles if we don't already have them.
       */
      await loadProfilesIfNeeded();

      if (fromMenu) {
        closeDrawer();
      }
    } catch (error) {
      console.error(
        "Auth validation failed on sign-in click:",
        error
      );

      window.localStorage.setItem("auth_mode", "login");

      setLoggedIn(false);
      setUserImage(null);

      profilesLoadedRef.current = false;
      currentProfileIdRef.current = null;

      if (fromMenu) {
        closeDrawer();
      }

      navigate("/login");
    } finally {
      if (mountedRef.current) {
        setCheckingAuth(false);
      }
    }
  };

  /*
   * ---------------------------------------------------------
   * Theme
   * ---------------------------------------------------------
   */

  const handleThemeChange = (_, nextMode) => {
    if (!nextMode || nextMode === themeMode) {
      return;
    }

    if (typeof onThemeModeChange === "function") {
      onThemeModeChange(nextMode);
    }
  };

  const drawerWidth = {
    xs: "88vw",
    sm: 360,
    md: 396,
  };

  const avatarSrc = userImage || defaultUserIcon;

  /*
   * ---------------------------------------------------------
   * Render
   * ---------------------------------------------------------
   */

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
            minHeight: {
              xs: 64,
              sm: 72,
            },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              minWidth: 0,
            }}
          >
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open sidebar"
              onClick={() => setDrawerOpen(true)}
              sx={{
                borderRadius: 2,
                border: "1px solid",
                borderColor: alpha(
                  theme.palette.text.primary,
                  0.08
                ),
                bgcolor: alpha(
                  theme.palette.background.paper,
                  0.16
                ),
                "&:hover": {
                  bgcolor: alpha(
                    theme.palette.background.paper,
                    0.28
                  ),
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
                  flexDirection: "column",
                  alignItems: "flex-start",
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 900,
                    lineHeight: 1.1,
                  }}
                  noWrap
                >
                  PaaS Deployer
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                >
                  Modern control panel
                </Typography>
              </Box>
            </Button>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            {!checkingAuth && loggedIn ? (
              <IconButton
                onClick={() => navigate("/profile")}
                aria-label="Open profile"
                sx={{
                  p: 0.25,
                  border: "1px solid",
                  borderColor: alpha(
                    theme.palette.text.primary,
                    0.08
                  ),
                }}
              >
                <Avatar
                  src={avatarSrc}
                  alt="User"
                  sx={{
                    width: 38,
                    height: 38,
                  }}
                />
              </IconButton>
            ) : !checkingAuth ? (
              <Button
                variant="outlined"
                onClick={() =>
                  handleSignInClick({
                    fromMenu: false,
                  })
                }
                sx={{
                  borderColor: alpha(
                    theme.palette.text.primary,
                    0.14
                  ),
                  color: "inherit",
                  bgcolor: alpha(
                    theme.palette.background.paper,
                    0.16
                  ),
                }}
              >
                Sign In
              </Button>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={closeDrawer}
        ModalProps={{
          keepMounted: true,
        }}
        PaperProps={{
          sx: {
            width: drawerWidth,
            maxWidth: 420,
            bgcolor: drawerPaperBg,
            color: theme.palette.text.primary,
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter:
              "blur(18px) saturate(140%)",
            borderRight: "1px solid",
            borderColor: alpha(
              theme.palette.divider,
              0.9
            ),
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
              theme.palette.mode === "dark"
                ? "rgba(0,0,0,0.58)"
                : "rgba(15,23,42,0.38)",
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
            borderColor: alpha(
              theme.palette.divider,
              1
            ),
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
            sx={{
              color: "inherit",
              textDecoration: "none",
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                color: "#fff",
                background:
                  "linear-gradient(135deg, #2f66ff 0%, #7c5cff 100%)",
                boxShadow:
                  "0 12px 24px rgba(47,102,255,0.28)",
                flexShrink: 0,
              }}
            >
              PD
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 900,
                  lineHeight: 1.1,
                }}
                noWrap
              >
                PaaS Deployer
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
              >
                Navigation & theme controls
              </Typography>
            </Box>
          </Stack>

          <IconButton
            aria-label="Close sidebar"
            onClick={closeDrawer}
            sx={{
              borderRadius: 2,
            }}
          >
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
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <ListItemButton
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    selected={active}
                    aria-current={
                      active ? "page" : undefined
                    }
                    onClick={closeDrawer}
                    ref={
                      index === 0
                        ? firstItemRef
                        : null
                    }
                    sx={{
                      mb: 0.75,
                      borderRadius: 3,
                      px: 1.5,
                      py: 1.1,
                      color: active
                        ? "primary.main"
                        : "text.primary",
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
                        backgroundColor: active
                          ? theme.palette.primary.main
                          : "transparent",
                        transition:
                          "background-color 180ms ease",
                      },

                      "&:hover": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark"
                            ? 0.16
                            : 0.08
                        ),
                        transform:
                          "translateX(2px)",
                      },

                      "&.Mui-selected": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark"
                            ? 0.22
                            : 0.12
                        ),
                        boxShadow: `inset 0 0 0 1px ${alpha(
                          theme.palette.primary.main,
                          0.16
                        )}`,
                      },

                      "&.Mui-selected:hover": {
                        bgcolor: alpha(
                          theme.palette.primary.main,
                          theme.palette.mode === "dark"
                            ? 0.26
                            : 0.16
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
                        color: active
                          ? "primary.main"
                          : "text.secondary",
                      }}
                    >
                      <Icon fontSize="small" />
                    </ListItemIcon>

                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active
                          ? 800
                          : 600,
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
                borderColor: alpha(
                  theme.palette.divider,
                  1
                ),
              }}
            >
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
              >
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

                <Box
                  sx={{
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                    }}
                    noWrap
                  >
                    {loggedIn
                      ? "Workspace ready"
                      : "Guest mode"}
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    noWrap
                  >
                    {loggedIn
                      ? "Manage your account and deployments"
                      : "Sign in to sync your account"}
                  </Typography>
                </Box>
              </Stack>

              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={1}
                sx={{ mt: 1.25 }}
              >
                {loggedIn ? (
                  <>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={
                        <PersonOutlineOutlinedIcon />
                      }
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
                      startIcon={
                        <LogoutOutlinedIcon />
                      }
                      onClick={() => {
                        closeDrawer();
                        handleLogout();
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
                    onClick={() =>
                      handleSignInClick({
                        fromMenu: true,
                      })
                    }
                    disabled={checkingAuth}
                  >
                    Sign In
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
              borderColor: alpha(
                theme.palette.divider,
                1
              ),
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
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 800,
                    lineHeight: 1.1,
                  }}
                >
                  Theme
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
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
                  borderColor: alpha(
                    theme.palette.text.primary,
                    0.12
                  ),
                  borderRadius: 2.25,
                  px: 1,
                  color: "text.secondary",
                },

                "& .MuiToggleButton-root.Mui-selected": {
                  color: "primary.main",
                  bgcolor: alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === "dark"
                      ? 0.18
                      : 0.1
                  ),
                  borderColor: alpha(
                    theme.palette.primary.main,
                    0.3
                  ),
                },

                "& .MuiToggleButton-root.Mui-selected:hover":
                  {
                    bgcolor: alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === "dark"
                        ? 0.24
                        : 0.14
                    ),
                  },
              }}
            >
              {themeChoices.map((choice) => {
                const ChoiceIcon = choice.icon;

                return (
                  <ToggleButton
                    key={choice.value}
                    value={choice.value}
                    aria-label={choice.label}
                  >
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <ChoiceIcon fontSize="small" />

                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                        }}
                      >
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
    </>
  );
}