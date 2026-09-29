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
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import { useProfiles, resolveProfileImageUrl } from "../profile/profileContext.jsx";
import { clearStoredAuth } from "../customHooks/authSession.js";

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

export default function AccountMenu({
  avatar = null,
  size = 38,
  profilePath = "/dashboard/profile",
  hideProfile = false,
  ariaLabel = "Account menu",
  tooltip = null,
  buttonSx = {},
  showLogoutDialog = true,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { profiles, primaryImageUrl } = useProfiles();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const currentProfile = useMemo(() => {
    if (!Array.isArray(profiles) || profiles.length === 0) return null;
    return [...profiles].sort((a, b) => (a.order ?? 999) - (b.order ?? 999))[0];
  }, [profiles]);

  const profileName = resolveName(currentProfile);
  const avatarSrc = avatar || resolveProfileImageUrl(currentProfile) || primaryImageUrl || undefined;
  const initials = resolveInitials(currentProfile);

  const handleLogoutConfirm = () => {
    clearStoredAuth(window.localStorage);
    setLogoutDialogOpen(false);
    setMenuAnchor(null);

    try {
      window.dispatchEvent(new Event("auth-changed"));
      window.dispatchEvent(new Event("auth"));
    } catch {
      /* ignore browser event errors */
    }

    navigate("/signin_or_signup", { replace: true });
  };

  const handleProfile = () => {
    setMenuAnchor(null);
    try {
      sessionStorage.removeItem("profileFromDashboard");
      sessionStorage.removeItem("profileReturnTo");
    } catch {
      /* ignore storage errors */
    }
    navigate(profilePath);
  };

  const trigger = (
    <IconButton
      size="small"
      onClick={(event) => setMenuAnchor(event.currentTarget)}
      sx={{
        p: 0.25,
        borderRadius: 99,
        border: "1px solid",
        borderColor: alpha(theme.palette.divider, 0.95),
        ...buttonSx,
      }}
      aria-label={ariaLabel}
    >
      <Avatar
        src={avatarSrc}
        alt={profileName}
        sx={{
          width: size,
          height: size,
          bgcolor: "primary.main",
          fontSize: 12,
          fontWeight: 900,
        }}
      >
        {initials}
      </Avatar>
    </IconButton>
  );

  return (
    <>
      {tooltip ? (
        <Box component="span" sx={{ display: "inline-flex" }} title={tooltip}>
          {trigger}
        </Box>
      ) : (
        trigger
      )}

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
            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>
              {profileName}
            </Typography>
            <Typography sx={{ color: "text.secondary", fontSize: 11 }}>
              {currentProfile?.email || "Account"}
            </Typography>
          </Stack>
        </MenuItem>

        {!hideProfile && (
          <MenuItem onClick={handleProfile}>
            <PersonOutlineOutlinedIcon fontSize="small" sx={{ mr: 1.2 }} />
            Profile
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            if (showLogoutDialog) {
              setLogoutDialogOpen(true);
            } else {
              handleLogoutConfirm();
            }
          }}
          sx={{ color: "error.main" }}
        >
          <LogoutRoundedIcon fontSize="small" sx={{ mr: 1.2 }} />
          Sign out
        </MenuItem>
      </Menu>

      {showLogoutDialog && (
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
              access your account.
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
      )}
    </>
  );
}
