import React, { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import { useProfiles, resolveProfileImageUrl } from "../profile/profile.jsx";

const resolveName = (profile) =>
  profile?.display_name ||
  profile?.full_name ||
  profile?.name ||
  profile?.username ||
  profile?.email ||
  "Account";

const resolveInitials = (profile) => {
  const value = resolveName(profile).trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  return (
    parts.length === 1
      ? parts[0].slice(0, 2)
      : `${parts[0][0]}${parts[1][0]}`
  ).toUpperCase();
};

/**
 * Shared dashboard chrome.
 * - default: title Dashboard + mobile menu
 * - serviceDetail: back + service name
 * - profileMode: back + Profile (only when profile is outside the shell)
 */
export default function DashboardNavbar({
  serviceDetail = false,
  serviceName = "",
  profileMode = false,
  onBack = null,
  onMenuClick = null,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { profiles, primaryImageUrl } = useProfiles();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const currentProfile = useMemo(() => {
    if (!Array.isArray(profiles) || profiles.length === 0) return null;
    return [...profiles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))[0];
  }, [profiles]);

  const avatar = resolveProfileImageUrl(currentProfile) || primaryImageUrl || undefined;
  const profileName = resolveName(currentProfile);

  // Derive a short section title from the path when in the shell
  const sectionTitle = useMemo(() => {
    if (serviceDetail) return serviceName || "Service";
    if (profileMode) return "Profile";
    const p = location.pathname;
    if (p.startsWith("/dashboard/networks")) return "Networks";
    if (p.startsWith("/dashboard/volumes")) return "Volumes";
    if (p.startsWith("/dashboard/plans")) return "Plans";
    if (p.startsWith("/dashboard/tickets")) return "Tickets";
    if (p.startsWith("/dashboard/profile")) return "Profile";
    if (p.startsWith("/dashboard/services")) return "Services";
    return "Dashboard";
  }, [location.pathname, serviceDetail, profileMode, serviceName]);

  const subtitle = serviceDetail
    ? "Service workspace"
    : profileMode
      ? "Account settings"
      : "Infrastructure";

  const showBack = serviceDetail || profileMode;
  const showMenu = !serviceDetail && !profileMode && typeof onMenuClick === "function";

  const handleBack = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    navigate("/dashboard/services");
  };

  const openLogoutDialog = () => {
    setMenuAnchor(null);
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = () => {
    try {
      localStorage.removeItem("access");
      localStorage.removeItem("refresh");
      window.dispatchEvent(new Event("auth-changed"));
    } catch {
      // Ignore browser storage errors.
    }
    setLogoutDialogOpen(false);
    navigate("/signin_or_signup", { replace: true });
  };

  const navButtonSx = {
    width: { xs: 36, sm: 38 },
    height: { xs: 36, sm: 38 },
    border: "1px solid",
    borderColor: alpha(theme.palette.divider, 0.95),
    color: "text.secondary",
    bgcolor: alpha(theme.palette.background.paper, 0.55),
    "&:hover": {
      bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === "dark" ? 0.07 : 0.035),
      color: "text.primary",
    },
  };

  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar,
        width: "100%",
        borderBottom: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.95),
        bgcolor: alpha(
          theme.palette.background.paper,
          theme.palette.mode === "dark" ? 0.92 : 0.88
        ),
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          mx: "auto",
          px: { xs: 1, sm: 2, md: 2.5 },
          position: "relative",
        }}
      >
        <Box
          sx={{
            minHeight: { xs: 56, sm: 62 },
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.75, sm: 1.25, md: 1.5 },
          }}
        >
          <Stack direction="row" alignItems="center" spacing={{ xs: 0.75, sm: 1 }} sx={{ minWidth: 0, flex: 1 }}>
            {showMenu && (
              <IconButton
                size="small"
                onClick={onMenuClick}
                sx={{ ...navButtonSx, display: { xs: "inline-flex", md: "none" } }}
                aria-label="Open menu"
              >
                <MenuRoundedIcon sx={{ fontSize: { xs: 20, sm: 21 } }} />
              </IconButton>
            )}

            {showBack && (
              <Tooltip title="Back to Dashboard">
                <IconButton
                  size="small"
                  onClick={handleBack}
                  sx={navButtonSx}
                  aria-label="Back to dashboard"
                >
                  <ArrowBackRoundedIcon sx={{ fontSize: { xs: 18, sm: 19 } }} />
                </IconButton>
              </Tooltip>
            )}

            <Box
              component="img"
              src="/icon.svg"
              alt=""
              sx={{
                width: { xs: 30, sm: 34 },
                height: { xs: 30, sm: 34 },
                objectFit: "contain",
                flexShrink: 0,
              }}
            />

            <Box sx={{ minWidth: 0 }}>
              <Typography
                noWrap
                sx={{
                  fontWeight: 850,
                  letterSpacing: "-0.02em",
                  fontSize: { xs: 13, sm: 14 },
                  lineHeight: 1.1,
                  maxWidth: { xs: 170, sm: 280, md: 420 },
                }}
              >
                {sectionTitle}
              </Typography>
              <Typography
                noWrap
                sx={{
                  display: { xs: "none", sm: "block" },
                  mt: 0.35,
                  color: "text.secondary",
                  fontSize: 11,
                  lineHeight: 1.1,
                }}
              >
                {subtitle}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 0.75 }} sx={{ flexShrink: 0 }}>
            <Tooltip title="Home">
              <IconButton size="small" onClick={() => navigate("/")} sx={navButtonSx} aria-label="Home">
                <HomeOutlinedIcon sx={{ fontSize: { xs: 19, sm: 20 } }} />
              </IconButton>
            </Tooltip>

            <Tooltip title={profileName}>
              <IconButton
                size="small"
                onClick={(event) => setMenuAnchor(event.currentTarget)}
                sx={{
                  p: 0.25,
                  borderRadius: 99,
                  border: "1px solid",
                  borderColor: alpha(theme.palette.divider, 0.95),
                }}
                aria-label="Account menu"
              >
                <Avatar
                  src={avatar}
                  alt={profileName}
                  sx={{
                    width: { xs: 32, sm: 34 },
                    height: { xs: 32, sm: 34 },
                    bgcolor: "primary.main",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {resolveInitials(currentProfile)}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              minWidth: 210,
              borderRadius: 2.5,
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <MenuItem disabled sx={{ opacity: 1, py: 1.25 }}>
          <Stack spacing={0.15} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{profileName}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 11 }}>
              {currentProfile?.email || "Account"}
            </Typography>
          </Stack>
        </MenuItem>
        {!profileMode && !location.pathname.startsWith("/dashboard/profile") && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              navigate("/dashboard/profile");
            }}
          >
            <PersonOutlineOutlinedIcon fontSize="small" sx={{ mr: 1.2 }} />
            Profile
          </MenuItem>
        )}
        <MenuItem onClick={openLogoutDialog} sx={{ color: "error.main" }}>
          <LogoutRoundedIcon fontSize="small" sx={{ mr: 1.2 }} />
          Sign out
        </MenuItem>
      </Menu>

      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm logout</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to sign out? You will need to sign in again to
            access your dashboard.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogoutDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleLogoutConfirm}
            color="error"
            variant="contained"
            autoFocus
          >
            Sign out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
