import React, { useState, useEffect, useCallback } from "react";
import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, alpha } from "@mui/material/styles";
import ClickAwayListener from "@mui/material/ClickAwayListener";

import HomeIcon from "@mui/icons-material/Home";
import StorageIcon from "@mui/icons-material/Storage";
import PriceChangeIcon from "@mui/icons-material/PriceChange";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";

import { motion } from "framer-motion";

function AnimatedMenuIcon({ open = false, size = 22, stroke = "currentColor", strokeWidth = 2.2 }) {
  const transition = { duration: 0.22, ease: "easeInOut" };

  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
      sx={{ display: "block" }}
    >
      <motion.line
        x1="4"
        x2="20"
        y1="7"
        y2="7"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { y1: 12, y2: 12, rotate: 45 } : { y1: 7, y2: 7, rotate: 0 }}
        transition={transition}
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.line
        x1="4"
        x2="20"
        y1="12"
        y2="12"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { opacity: 0, scaleX: 0.4 } : { opacity: 1, scaleX: 1 }}
        transition={transition}
        style={{ transformOrigin: "12px 12px" }}
      />
      <motion.line
        x1="4"
        x2="20"
        y1="17"
        y2="17"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={false}
        animate={open ? { y1: 12, y2: 12, rotate: -45 } : { y1: 17, y2: 17, rotate: 0 }}
        transition={transition}
        style={{ transformOrigin: "12px 12px" }}
      />
    </Box>
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
  const location = useLocation();

  const readLoggedIn = () => Boolean(window.localStorage.getItem("access"));

  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(() =>
    typeof loggedInProp === "boolean" ? loggedInProp : readLoggedIn()
  );

  useEffect(() => {
    if (typeof loggedInProp === "boolean") setLoggedIn(loggedInProp);
  }, [loggedInProp]);

  useEffect(() => {
    const sync = () => setLoggedIn(readLoggedIn());

    window.addEventListener("auth-changed", sync);
    window.addEventListener("auth", sync);
    window.addEventListener("storage", (e) => {
      if (e.key === "access" || e.key === "refresh") sync();
    });

    return () => {
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("auth", sync);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const toggle = useCallback(() => {
    setLoggedIn(readLoggedIn());
    setOpen((s) => !s);
  }, []);

  const handleLogout = () => {
    if (typeof onLogout === "function") {
      onLogout();
      close();
      return;
    }

    window.localStorage.removeItem("access");
    window.localStorage.removeItem("refresh");
    setLoggedIn(false);
    try {
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("auth"));
    } catch {}
    navigate("/signin_or_signup");
    close();
  };

  const bottom = anchorOffset?.bottom ?? 24;
  const right = anchorOffset?.right ?? 24;

  const containerSx =
    position === "bottom-center"
      ? { left: "50%", transform: "translateX(-50%)", right: "auto" }
      : { right, left: "auto" };

  // لیست آیتم‌ها برای کاربران مهمان (لاگین نکرده)
  const guestItems = [
    { to: "/", label: "Home", icon: <HomeIcon /> },
    { to: "/plans", label: "Plans", icon: <PriceChangeIcon /> },
    {
      to: "/signin_or_signup",
      label: "Sign in / Sign up",
      icon: <LoginIcon />,
      onClick: () => {
        try {
          window.localStorage.setItem("auth_mode", "signin_or_signup");
        } catch {}
      },
    },
  ];

  // لیست آیتم‌ها برای کاربران لاگین کرده
  const authItems = [
    { to: "/", label: "Home", icon: <HomeIcon /> },
    { to: "/services", label: "Services", icon: <StorageIcon /> },
    { to: "/volumes", label: "Volumes", icon: <Inventory2OutlinedIcon /> },
    { to: "/networks", label: "Networks", icon: <LanOutlinedIcon /> },
    { to: "/tickets", label: "Tickets", icon: <ConfirmationNumberOutlinedIcon /> },
    { to: "/messenger", label: "Messenger", icon: <ChatBubbleOutlineIcon /> },
    { to: "/admin", label: "Admin", icon: <AdminPanelSettingsOutlinedIcon /> },
    { to: "/plans", label: "Plans", icon: <PriceChangeIcon /> },
    { to: "/profile", label: "Profile", icon: <AccountCircleIcon /> },
    {
      to: "#",
      label: "Logout",
      icon: <LogoutIcon />,
      color: "error",
      onClick: handleLogout,
    },
  ];

  const items = loggedIn ? authItems : guestItems;

  return (
    <Box
      sx={{
        position: "fixed",
        zIndex: 20,
        bottom,
        ...containerSx,
        pointerEvents: "none",
      }}
    >
      <ClickAwayListener onClickAway={() => open && close()}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            pointerEvents: "auto",
          }}
        >
          <Collapse in={open} timeout={220} unmountOnExit>
            {/* استک حاوی دکمه‌های کشیده شونده */}
            <Stack spacing={1} sx={{ mb: 2, alignItems: "flex-end" }}>
              {items.map((item, index) => (
                <Button
                  key={index}
                  component={item.to === "#" ? "button" : RouterLink}
                  to={item.to === "#" ? undefined : item.to}
                  onClick={(e) => {
                    if (item.to === "#") e.preventDefault();
                    if (item.onClick) item.onClick();
                    if (item.to !== "#") close();
                  }}
                  sx={{
                    minWidth: 48,
                    maxWidth: isSm ? 240 : 48, // در موبایل عرض همیشه باز باشد
                    height: 48,
                    borderRadius: "24px",
                    p: 0,
                    display: "flex",
                    flexDirection: "row-reverse", // قرارگیری آیکن در سمت راست
                    alignItems: "center",
                    justifyContent: "flex-start",
                    bgcolor: alpha(theme.palette.background.paper, 0.95),
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    boxShadow:
                      theme.palette.mode === "dark"
                        ? "0 4px 12px rgba(0,0,0,0.4)"
                        : "0 4px 12px rgba(15,23,42,0.12)",
                    border: "1px solid",
                    borderColor: alpha(theme.palette.divider, 0.08),
                    color: item.color === "error" ? "error.main" : "text.primary",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    transition: "max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s",
                    "&:hover": {
                      maxWidth: 240, // باز شدن کادر تا این مقدار موقع هاور در حالت دسکتاپ
                      bgcolor: theme.palette.background.paper,
                    },
                    "&:hover .nav-label": {
                      opacity: 1, // نمایش متن موقع هاور در حالت دسکتاپ
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box
                    className="nav-label"
                    sx={{
                      opacity: isSm ? 1 : 0, // در موبایل شفافیت کامل باشد تا نوشته پنهان نشود
                      pr: 0.5,
                      pl: 2.5,
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      transition: "opacity 0.2s ease 0.1s",
                    }}
                  >
                    {item.label}
                  </Box>
                </Button>
              ))}
            </Stack>
          </Collapse>

          <Tooltip
            title={open ? "Close menu" : loggedIn ? "Quick navigation" : "Account & navigation"}
            placement="left"
          >
            <Fab
              onClick={toggle}
              size={isSm ? "medium" : "large"}
              color="primary"
              aria-expanded={open}
              aria-label={open ? "Close quick menu" : "Open quick menu"}
              sx={{
                pointerEvents: "auto",
                boxShadow:
                  theme.palette.mode === "dark"
                    ? "0 8px 28px rgba(0,0,0,0.5)"
                    : "0 8px 28px rgba(37,99,235,0.35)",
                borderRadius: 3,
                width: isSm ? 52 : 56,
                height: isSm ? 52 : 56,
              }}
            >
              <AnimatedMenuIcon open={open} size={22} stroke="#fff" strokeWidth={2.2} />
            </Fab>
          </Tooltip>
        </Box>
      </ClickAwayListener>
    </Box>
  );
}