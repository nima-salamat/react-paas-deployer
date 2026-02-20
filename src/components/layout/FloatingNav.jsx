// components/ui/FloatingNav.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, alpha } from "@mui/material/styles";
import Divider from "@mui/material/Divider";

import HomeIcon from "@mui/icons-material/Home";
import StorageIcon from "@mui/icons-material/Storage";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CloseIcon from "@mui/icons-material/Close";
import LoginIcon from "@mui/icons-material/Login";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LogoutIcon from "@mui/icons-material/Logout";

import { motion } from "framer-motion";

/**
 * FloatingNav with animated hamburger -> X icon
 */
function AnimatedMenuIcon({ open = false, size = 20, stroke = "currentColor", strokeWidth = 2.2 }) {
  // coords are inside 24x24 viewBox, origin for rotation is center (12,12)
  const transition = { duration: 0.22, ease: "easeInOut" };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      {/* top line */}
      <motion.line
        x1="4" y1="7" x2="20" y2="7"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { y: 5, rotate: 45 } : { y: 0, rotate: 0 }}
        transition={transition}
        style={{ originX: "12px", originY: "12px" }}
      />
      {/* middle line */}
      <motion.line
        x1="4" y1="12" x2="20" y2="12"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { opacity: 0, scaleX: 0.6 } : { opacity: 1, scaleX: 1 }}
        transition={transition}
        style={{ originX: "12px", originY: "12px" }}
      />
      {/* bottom line */}
      <motion.line
        x1="4" y1="17" x2="20" y2="17"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { y: -5, rotate: -45 } : { y: 0, rotate: 0 }}
        transition={transition}
        style={{ originX: "12px", originY: "12px" }}
      />
    </svg>
  );
}

export default function FloatingNav({
  loggedIn: loggedInProp,
  onLogout,
  position = "bottom-right",
  anchorOffset = { bottom: 24, right: 24 },
}) {
  const theme = useTheme();
  const isSm = useMediaQuery(theme.breakpoints.down("sm"));
  const navigate = useNavigate();

  const initialLoggedIn = typeof loggedInProp === "boolean"
    ? loggedInProp
    : Boolean(localStorage.getItem("access"));

  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);

  useEffect(() => { if (typeof loggedInProp === "boolean") setLoggedIn(loggedInProp); }, [loggedInProp]);

  useEffect(() => {
    const onStorage = (e) => { if (e.key === "access") setLoggedIn(Boolean(localStorage.getItem("access"))); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const onAuth = () => setLoggedIn(Boolean(localStorage.getItem("access")));
    window.addEventListener("auth", onAuth);
    return () => window.removeEventListener("auth", onAuth);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    const current = Boolean(localStorage.getItem("access"));
    setLoggedIn(current);
    setOpen((s) => !s);
  }, []);

  const handleLogout = () => {
    if (typeof onLogout === "function") onLogout();
    else {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      try { window.dispatchEvent(new Event("auth")); } catch (e) {}
      setLoggedIn(false);
      navigate("/login");
      close();
    }
  };

  const bottom = anchorOffset?.bottom ?? 24;
  const right = anchorOffset?.right ?? 24;
  const containerSx = position === "bottom-center"
    ? { left: "50%", transform: "translateX(-50%)", right: "auto" }
    : { right: right, left: "auto" };

  return (
    <Box
      sx={{
        position: "fixed",
        zIndex: 1400,
        bottom: bottom,
        ...containerSx,
        pointerEvents: "none",
      }}
      aria-hidden={false}
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, pointerEvents: "auto" }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Paper elevation={8} sx={{
            px: 1.5,
            py: 1,
            borderRadius: 2,
            minWidth: 180,
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            boxShadow: `0 8px 30px ${alpha(theme.palette.common.black, 0.12)}`,
          }}>
            <Stack spacing={1}>
              {loggedIn ? (
                <>
                  <Button component={RouterLink} to="/" startIcon={<HomeIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Home
                  </Button>
                  <Button component={RouterLink} to="/services" startIcon={<StorageIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Services
                  </Button>
                  <Button component={RouterLink} to="/plans" startIcon={<PriceChangeIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Plans
                  </Button>
                  <Button component={RouterLink} to="/profile" startIcon={<AccountCircleIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Profile
                  </Button>

                  <Divider />

                  <Button onClick={handleLogout} startIcon={<LogoutIcon />} color="inherit" sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button component={RouterLink} to="/login" startIcon={<LoginIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Sign in
                  </Button>

                  <Button component={RouterLink} to="/login?signup=1" startIcon={<PersonAddIcon />} onClick={close} sx={{ justifyContent: "flex-start", textTransform: "none" }}>
                    Create account
                  </Button>
                </>
              )}
            </Stack>
          </Paper>
        </Collapse>

        <Tooltip title={open ? "Close quick menu" : (loggedIn ? "Quick actions" : "Account actions")}>
          <Fab
            onClick={toggle}
            size={isSm ? "medium" : "large"}
            color="primary"
            aria-expanded={open}
            aria-label="open quick actions"
            sx={{
              pointerEvents: "auto",
              boxShadow: 6,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* single animated icon that morphs hamburger <-> X */}
            <AnimatedMenuIcon open={open} size={22} stroke="#fff" strokeWidth={2.2} />
          </Fab>
        </Tooltip>
      </Box>
    </Box>
  );
}