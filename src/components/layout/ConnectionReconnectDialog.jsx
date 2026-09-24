import { useCallback, useEffect, useMemo, useState } from "react";
import WifiOffRoundedIcon from "@mui/icons-material/WifiOffRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CloudOffRoundedIcon from "@mui/icons-material/CloudOffRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useLocation } from "react-router-dom";
import { useTheme, ThemeProvider, createTheme } from "@mui/material/styles";
import { getPalette, normalizeColorThemeId, readAppearance } from "../messenger/modules/appearance";

const RECONNECTABLE_PREFIXES = ["/dashboard", "/messenger"];

function isReconnectablePath(pathname) {
  return RECONNECTABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
}

function classifyEvent(event) {
  const detail = event?.detail || {};
  if (detail.code === "ERR_NETWORK" || detail.status === 0) {
    return "network";
  }
  return "backend";
}

function looksLikeChunkFailure(error) {
  const text = [
    error?.message,
    error?.reason?.message,
    error?.reason,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    text.includes("failed to fetch dynamically imported module") ||
    text.includes("importing a module script failed") ||
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("failed to fetch")
  );
}

export default function ConnectionReconnectDialog() {
  const location = useLocation();
  const isReconnectable = isReconnectablePath(location.pathname);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [failure, setFailure] = useState(null);
  const [retrying, setRetrying] = useState(false);

  // This dialog is mounted globally from App.jsx, outside MessengerApp's
  // nested ThemeProvider. Mirror the active Messenger palette on /messenger.
  const parentTheme = useTheme();
  const isMessengerPath = location.pathname === "/messenger"
    || location.pathname.startsWith("/messenger/");

  const messengerTheme = useMemo(() => {
    if (!isMessengerPath) return null;

    const mode = parentTheme.palette.mode === "dark" ? "dark" : "light";
    const appearance = readAppearance();
    const colorId = normalizeColorThemeId(appearance?.colorTheme);
    const pal = getPalette(colorId, mode);
    const isDark = mode === "dark";

    return createTheme({
      palette: {
        mode,
        primary: {
          main: pal.primary,
          dark: isDark ? pal.primarySoft : pal.primaryHover,
          light: isDark ? pal.primaryHover : pal.primarySoft,
          contrastText: "#ffffff",
        },
        secondary: parentTheme.palette.secondary,
        success: { main: pal.success },
        warning: { main: pal.warning },
        error: { main: pal.danger },
        background: {
          default: pal.background,
          paper: pal.surface,
        },
        text: {
          primary: pal.text,
          secondary: pal.textSecondary,
          disabled: pal.textMuted,
        },
        divider: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
        action: parentTheme.palette.action,
      },
      shape: parentTheme.shape,
      typography: parentTheme.typography,
      breakpoints: parentTheme.breakpoints,
      spacing: parentTheme.spacing,
      transitions: parentTheme.transitions,
      zIndex: parentTheme.zIndex,
    });
  }, [isMessengerPath, parentTheme]);

  useEffect(() => {
    const handleOffline = () => setOffline(true);
    const handleOnline = () => setOffline(false);
    const handleNetworkError = (event) => {
      setFailure(classifyEvent(event));
      setRetrying(false);
    };
    const handleRecovered = () => {
      setFailure(null);
      setRetrying(false);
    };
    const handleError = (event) => {
      const target = event?.target;
      if (
        target instanceof HTMLScriptElement ||
        target instanceof HTMLLinkElement
      ) {
        const source = target.src || target.href || "";
        const isLocalAsset =
          source.startsWith(window.location.origin) &&
          source.includes("/assets/");
        if (isLocalAsset) {
          setFailure("chunk");
        }
      }
    };
    const handleUnhandledRejection = (event) => {
      if (looksLikeChunkFailure(event?.reason)) {
        setFailure("chunk");
        setRetrying(false);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    window.addEventListener("app-network-error", handleNetworkError);
    window.addEventListener("app-network-recovered", handleRecovered);
    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("app-network-error", handleNetworkError);
      window.removeEventListener("app-network-recovered", handleRecovered);
      window.removeEventListener("error", handleError, true);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, []);

  useEffect(() => {
    if (!isReconnectable) {
      setFailure(null);
      setRetrying(false);
    }
  }, [isReconnectable]);

  const open = isReconnectable && (offline || Boolean(failure));

  const state = useMemo(() => {
    if (offline) {
      return {
        icon: <WifiOffRoundedIcon sx={{ fontSize: 30 }} />,
        title: "No internet connection",
        body: "PassDeployer cannot reach the network right now. Check your connection and reconnect.",
      };
    }

    if (failure === "chunk") {
      return {
        icon: <ErrorOutlineRoundedIcon sx={{ fontSize: 30 }} />,
        title: "Page could not load",
        body: "Part of this page could not be downloaded. This is usually a temporary connection or cache problem.",
      };
    }

    return {
      icon: <CloudOffRoundedIcon sx={{ fontSize: 30 }} />,
      title: "Connection lost",
      body: "We could not reach the PassDeployer service. Check your connection and reconnect to continue.",
    };
  }, [offline, failure]);

  const reconnect = useCallback(() => {
    setRetrying(true);
    window.location.reload();
  }, []);

  const dialog = (
    <Dialog
      open={open}
      fullWidth
      maxWidth="xs"
      disableEscapeKeyDown
      aria-labelledby="connection-reconnect-title"
      aria-describedby="connection-reconnect-description"
      PaperProps={{
        sx: {
          borderRadius: 3,
          bgcolor: "background.paper",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle id="connection-reconnect-title" sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 46,
              height: 46,
              display: "grid",
              placeItems: "center",
              borderRadius: 2,
              bgcolor: "action.hover",
              color: "primary.main",
              flexShrink: 0,
            }}
          >
            {state.icon}
          </Box>
          <Typography variant="h6" fontWeight={700}>
            {state.title}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Typography
          id="connection-reconnect-description"
          color="text.secondary"
          lineHeight={1.7}
        >
          {state.body}
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          variant="contained"
          size="large"
          onClick={reconnect}
          disabled={retrying}
          startIcon={
            retrying ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <RefreshRoundedIcon />
            )
          }
          sx={{ minWidth: 132 }}
        >
          {retrying ? "Reconnecting…" : "Reconnect"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return messengerTheme
    ? <ThemeProvider theme={messengerTheme}>{dialog}</ThemeProvider>
    : dialog;
}
