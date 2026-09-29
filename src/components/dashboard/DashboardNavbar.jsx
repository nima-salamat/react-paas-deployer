import React, { useMemo } from "react";
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ThemeMenuButton from "../layout/ThemeMenuButton.jsx";
import AccountMenu from "../layout/AccountMenu.jsx";
import { useProfiles } from "../profile/profileContext.jsx";

const resolveName = (profile) =>
  profile?.display_name ||
  profile?.full_name ||
  profile?.name ||
  profile?.username ||
  profile?.email ||
  "Account";

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
  themeMode = "system",
  onThemeModeChange,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { profiles, primaryImageUrl } = useProfiles();
  
  const currentProfile = useMemo(() => {
    if (!Array.isArray(profiles) || profiles.length === 0) return null;
    return [...profiles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))[0];
  }, [profiles]);

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
            <ThemeMenuButton
              themeMode={themeMode}
              onThemeModeChange={onThemeModeChange}
              buttonSx={navButtonSx}
            />
            <Tooltip title="Home">
              <IconButton size="small" onClick={() => navigate("/")} sx={navButtonSx} aria-label="Home">
                <HomeOutlinedIcon sx={{ fontSize: { xs: 19, sm: 20 } }} />
              </IconButton>
            </Tooltip>

            <AccountMenu
              profilePath="/dashboard/profile"
              hideProfile={profileMode || location.pathname.startsWith("/dashboard/profile")}
              size={34}
              tooltip={profileName}
              buttonSx={{ ...navButtonSx }}
            />
          </Stack>
        </Box>
      </Box>

    </Box>
  );
}
