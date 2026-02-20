// components/layout/NavbarMui.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import Brightness7Icon from "@mui/icons-material/Brightness7";
import { useTheme, alpha } from "@mui/material/styles";
import defaultUserIcon from "../../assets/icons/user.svg";

import { useProfiles } from "../profile/profile.jsx";

export default function NavbarMui({ toggleTheme, themeMode: themeModeProp }) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const muiMode = theme.palette?.mode ?? "light";
  const themeMode = themeModeProp ?? muiMode;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userImage, setUserImage] = useState(null);
  const firstItemRef = useRef(null);

  const { profiles, fetchProfiles: refreshProfiles } = useProfiles();

  const prevImageRef = useRef(null);

  const navItems = [
    { path: "/", label: "Home" },
    { path: "/services", label: "Services" },
    { path: "/plans", label: "Plans" },
    { path: "/aboutUs", label: "About us" },
  ];

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    if (drawerOpen && firstItemRef.current) {
      setTimeout(() => firstItemRef.current.focus(), 60);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!loggedIn) {
      if (userImage !== null) {
        setUserImage(null);
        prevImageRef.current = null;
      }
      return;
    }

    if (!Array.isArray(profiles) || profiles.length === 0) {
      if (userImage !== null) {
        setUserImage(null);
        prevImageRef.current = null;
      }
      return;
    }

    const sorted = [...profiles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const newImageUrl = sorted[0]?.image_url || null;

    if (newImageUrl !== prevImageRef.current) {
      setUserImage(newImageUrl);
      prevImageRef.current = newImageUrl;
    }
  }, [profiles, loggedIn]);

  useEffect(() => {
    if (location.pathname === "/login") {
      setCheckingAuth(false);
      setLoggedIn(false);
      return;
    }

    const checkAuth = async () => {
      setCheckingAuth(true);
      const accessToken = localStorage.getItem("access");
      if (!accessToken) {
        setLoggedIn(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const validateRes = await fetch("http://localhost:8000/auth/api/validateToken/", {
          method: "GET",
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!validateRes.ok) {
          setLoggedIn(false);
          setCheckingAuth(false);
          return;
        }

        setLoggedIn(true);
        refreshProfiles();
      } catch (err) {
        console.error("Auth check failed:", err);
        setLoggedIn(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setLoggedIn(false);
    setUserImage(null);
    prevImageRef.current = null;
    navigate("/login");
  };

  const handleSignInClick = async ({ fromMenu = false } = {}) => {
    if (checkingAuth) return;
    setCheckingAuth(true);

    const accessToken = localStorage.getItem("access");
    if (!accessToken) {
      localStorage.setItem("auth_mode", "login");
      setCheckingAuth(false);
      if (fromMenu) setDrawerOpen(false);
      navigate("/login");
      return;
    }

    try {
      const validateRes = await fetch("http://localhost:8000/auth/api/validateToken/", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!validateRes.ok) {
        localStorage.setItem("auth_mode", "login");
        setCheckingAuth(false);
        if (fromMenu) setDrawerOpen(false);
        navigate("/login");
        return;
      }

      setLoggedIn(true);
      refreshProfiles();
      if (fromMenu) setDrawerOpen(false);
      setCheckingAuth(false);
    } catch (error) {
      console.error("Auth validation failed on sign-in click:", error);
      localStorage.setItem("auth_mode", "login");
      setCheckingAuth(false);
      if (fromMenu) setDrawerOpen(false);
      navigate("/login");
    }
  };

  const appBarBg = theme.palette.mode === "dark" ? alpha(theme.palette.background.paper, 0.06) : theme.palette.primary.main;
  const appBarContrast = theme.palette.getContrastText(typeof appBarBg === "string" ? appBarBg : theme.palette.primary.main);
  const drawerBg = theme.palette.mode === "dark" ? "rgba(10,16,26,0.92)" : "rgba(255,255,255,0.98)";
  const drawerContrast = theme.palette.getContrastText(drawerBg);

  const drawerPaperSx = {
    width: { xs: "92%", sm: 360 },
    maxWidth: 420,
    bgcolor: drawerBg,
    color: drawerContrast,
    backdropFilter: "blur(10px) saturate(120%)",
    WebkitBackdropFilter: "blur(10px) saturate(120%)",
    borderRadius: 0,
    p: 2,
    position: "fixed",
    left: 0,
    right: "auto",
    top: 0,
    height: "100vh",
    overflowY: "auto",
    zIndex: 1401,
  };

  const backdropSx = {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.36)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };

  const themeBtnRef = useRef(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const overlayRef = useRef(null);
  const [overlayStyle, setOverlayStyle] = useState({});

  const doToggleTheme = () => {
    if (typeof toggleTheme === "function") toggleTheme();
    else console.warn("NavbarMui: toggleTheme prop not provided.");
  };

  const handleOverlayTransitionEnd = (ev) => {
    if (ev.propertyName === "opacity") {
      setOverlayVisible(false);
      setOverlayStyle({});
    }
  };

  const startWave = () => {
    const btn = themeBtnRef.current;
    if (!btn) {
      doToggleTheme();
      return;
    }
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const maxDx = Math.max(cx, vw - cx);
    const maxDy = Math.max(cy, vh - cy);
    const radius = Math.hypot(maxDx, maxDy);
    const diameter = Math.ceil(radius * 2) + 16;
    const top = cy - diameter / 2;
    const left = cx - diameter / 2;
    const waveColor = (themeMode === "dark" ? "#0b1220" : "#3b82f6");

    setOverlayStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${diameter}px`,
      height: `${diameter}px`,
      borderRadius: "50%",
      transform: "scale(0)",
      backgroundColor: waveColor,
      zIndex: 15000,
      pointerEvents: "none",
      transition: "transform 520ms cubic-bezier(.2,.9,.2,1), opacity 360ms ease",
      opacity: 1,
    });

    setOverlayVisible(true);
    requestAnimationFrame(() => {
      setOverlayStyle((s) => ({ ...s, transform: "scale(1)" }));
    });
    setTimeout(() => {
      doToggleTheme();
      setOverlayStyle((s) => ({ ...s, opacity: 0 }));
    }, 520 + 40);
  };

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: appBarBg,
          color: appBarContrast,
          backdropFilter: "blur(6px)",
        }}
      >
        <Toolbar sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton edge="start" color="inherit" aria-label="open menu" onClick={() => setDrawerOpen(true)} sx={{ ml: 0 }}>
              <MenuIcon />
            </IconButton>
            <Typography
              component={RouterLink}
              to="/"
              sx={{
                color: "inherit",
                textDecoration: "none",
                fontWeight: 800,
                fontSize: 20,
              }}
            >
              PaaS Deployer
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!checkingAuth && loggedIn ? (
              <IconButton onClick={() => navigate("/profile")} aria-label="User profile" sx={{ color: "inherit", p: 0 }}>
                <Avatar src={userImage || defaultUserIcon} alt="user" sx={{ width: 36, height: 36 }} />
              </IconButton>
            ) : !checkingAuth && !loggedIn ? (
              <Button variant="outlined" color="inherit" onClick={() => handleSignInClick({ fromMenu: false })} sx={{ borderColor: alpha(appBarContrast, 0.12), color: "inherit" }}>
                Sign In
              </Button>
            ) : null}
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: drawerPaperSx }}
        BackdropProps={{ sx: backdropSx }}
        ModalProps={{ keepMounted: true }}
        SlideProps={{ direction: "right" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {loggedIn ? (
              <IconButton onClick={() => { setDrawerOpen(false); navigate("/profile"); }} aria-label="Open profile" sx={{ color: drawerContrast }}>
                <Avatar src={userImage || defaultUserIcon} alt="user" />
              </IconButton>
            ) : (
              <Button variant="text" onClick={() => handleSignInClick({ fromMenu: true })} disabled={checkingAuth} sx={{ color: drawerContrast }}>
                Sign in
              </Button>
            )}
            <Typography sx={{ fontWeight: 800, ml: 0.5, color: drawerContrast }}>Menu</Typography>
          </Box>
          <IconButton onClick={() => setDrawerOpen(false)} aria-label="close menu" sx={{ color: drawerContrast }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 1, borderColor: alpha(drawerContrast, 0.08) }} />

        <List sx={{ pb: 10 }}>
          {navItems.map((item, idx) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={item.path}
                onClick={() => setDrawerOpen(false)}
                selected={isActive(item.path)}
                sx={{
                  borderRadius: 1,
                  color: isActive(item.path) ? theme.palette.primary.main : drawerContrast,
                  backgroundColor: isActive(item.path) ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                }}
                ref={idx === 0 ? firstItemRef : null}
              >
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive(item.path) ? 800 : 600,
                    color: isActive(item.path) ? theme.palette.primary.main : drawerContrast,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Box sx={{ px: 1, mt: 1 }}>
          {!checkingAuth && !loggedIn && (
            <Button variant="contained" fullWidth onClick={() => handleSignInClick({ fromMenu: true })} disabled={checkingAuth} sx={{ mb: 1, borderRadius: 3 }}>
              Sign In / Create Account
            </Button>
          )}
          {!checkingAuth && loggedIn && (
            <>
              <Button variant="outlined" fullWidth component={RouterLink} to="/services" onClick={() => setDrawerOpen(false)} sx={{ mb: 1, borderRadius: 3 }}>
                Services
              </Button>
              <Button variant="outlined" fullWidth component={RouterLink} to="/plans" onClick={() => setDrawerOpen(false)} sx={{ mb: 1, borderRadius: 3 }}>
                Plans
              </Button>
              <Button variant="contained" color="error" fullWidth onClick={() => { handleLogout(); setDrawerOpen(false); }} sx={{ borderRadius: 3 }}>
                Logout
              </Button>
            </>
          )}
        </Box>

        <Divider sx={{ my: 2, borderColor: alpha(drawerContrast, 0.08) }} />

        <Box sx={{ position: "absolute", bottom: 16, left: 16, right: 16, px: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography sx={{ fontWeight: 700, display: { xs: "none", sm: "block" }, color: drawerContrast }}>Theme</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            ref={themeBtnRef}
            size="medium"
            variant="outlined"
            onClick={startWave}
            sx={{
              textTransform: "none",
              borderRadius: 3,
              px: 2,
              display: "flex",
              gap: 1,
              alignItems: "center",
              color: drawerContrast,
              borderColor: alpha(drawerContrast, 0.14),
            }}
            aria-label="Change theme"
            title="Change theme"
          >
            {themeMode === "dark" ? <Brightness7Icon /> : <Brightness4Icon />}
            <Typography sx={{ fontWeight: 700, color: drawerContrast }}>{themeMode === "dark" ? "Light" : "Dark"}</Typography>
          </Button>
        </Box>
      </Drawer>

      {overlayVisible && (
        <div
          ref={overlayRef}
          onTransitionEnd={handleOverlayTransitionEnd}
          style={{
            position: overlayStyle.position,
            top: overlayStyle.top,
            left: overlayStyle.left,
            width: overlayStyle.width,
            height: overlayStyle.height,
            borderRadius: overlayStyle.borderRadius,
            transform: overlayStyle.transform,
            backgroundColor: overlayStyle.backgroundColor,
            zIndex: overlayStyle.zIndex,
            pointerEvents: overlayStyle.pointerEvents,
            transition: overlayStyle.transition,
            opacity: overlayStyle.opacity,
          }}
          aria-hidden
        />
      )}
    </>
  );
}