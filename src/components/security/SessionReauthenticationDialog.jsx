import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import SigninOrSignup from "../signin_or_signup/signin_or_signup.jsx";
import { logoutCurrentBrowser } from "../customHooks/logout.js";
import {
  AUTH_LIFECYCLE_KEY,
  clearSessionReauthRequired,
  isAuthRoute,
  isSessionReauthRequired,
  isSessionBoundToken,
} from "../customHooks/authSession.js";
import { useLocale } from "../../i18n/LocaleProvider.jsx";

function readLifecycleEvent() {
  try {
    const value = JSON.parse(window.localStorage.getItem(AUTH_LIFECYCLE_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export default function SessionReauthenticationDialog() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocale();
  const [open, setOpen] = useState(() => isSessionReauthRequired());
  const openRef = useRef(open);
  const [attempt, setAttempt] = useState(0);
  const [reason, setReason] = useState("");
  const [switchingAccount, setSwitchingAccount] = useState(false);

  const showExpiredSession = useCallback((nextReason = "session_expired") => {
    if (isAuthRoute(window.location?.pathname)) return;
    setReason(nextReason);
    if (!openRef.current) setAttempt((value) => value + 1);
    openRef.current = true;
    setOpen(true);
  }, []);

  const closeReauthentication = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    setReason("");
  }, []);

  const applyLifecycleEvent = useCallback((value) => {
    if (!value || typeof value !== "object") return;
    if (value.event === "expired") {
      showExpiredSession(value.reason || "session_expired");
      return;
    }
    if (value.event === "logout" || value.event === "login") {
      clearSessionReauthRequired();
      closeReauthentication();
    }
  }, [closeReauthentication, showExpiredSession]);

  useEffect(() => {
    const onExpired = (event) => {
      showExpiredSession(event?.detail?.reason || "session_expired");
    };

    const onAuthChanged = () => {
      let token = null;
      try {
        token = window.localStorage.getItem("access");
      } catch {
        token = null;
      }
      if (token && isSessionBoundToken(token)) {
        clearSessionReauthRequired();
        closeReauthentication();
        return;
      }
      applyLifecycleEvent(readLifecycleEvent());
    };

    const onLifecycleStorage = (event) => {
      if (event.key === AUTH_LIFECYCLE_KEY && event.newValue) {
        try {
          applyLifecycleEvent(JSON.parse(event.newValue));
        } catch {
          // Ignore malformed cross-tab lifecycle notifications.
        }
        return;
      }
      if (event.key === "access" && event.newValue) {
        clearSessionReauthRequired();
        closeReauthentication();
      }
    };

    const onExplicitLogout = () => {
      clearSessionReauthRequired();
      closeReauthentication();
    };

    window.addEventListener("session-expired", onExpired);
    window.addEventListener("auth-changed", onAuthChanged);
    window.addEventListener("auth-logged-out", onExplicitLogout);
    window.addEventListener("storage", onLifecycleStorage);

    // The expiry marker survives a reload in this tab. The shared lifecycle
    // record also lets other tabs restore the same dialog after an expiry.
    applyLifecycleEvent(readLifecycleEvent());
    if (isSessionReauthRequired()) {
      showExpiredSession("session_expired");
    }

    return () => {
      window.removeEventListener("session-expired", onExpired);
      window.removeEventListener("auth-changed", onAuthChanged);
      window.removeEventListener("auth-logged-out", onExplicitLogout);
      window.removeEventListener("storage", onLifecycleStorage);
    };
  }, [applyLifecycleEvent, closeReauthentication, showExpiredSession]);

  useEffect(() => {
    if (isAuthRoute(location.pathname)) {
      closeReauthentication();
      return;
    }
    const lifecycle = readLifecycleEvent();
    if (isSessionReauthRequired() || lifecycle?.event === "expired") {
      showExpiredSession(lifecycle?.reason || "session_expired");
    }
  }, [closeReauthentication, location.pathname, showExpiredSession]);

  const handleAuthenticated = () => {
    clearSessionReauthRequired();
    closeReauthentication();
  };

  const handleSwitchAccount = async () => {
    if (switchingAccount) return;
    setSwitchingAccount(true);
    try {
      // This is an intentional logout, not another expiry. It also signs out
      // the independent Matrix device before clearing remembered identifiers.
      await logoutCurrentBrowser({ revokeDjangoSession: false });
    } finally {
      setSwitchingAccount(false);
      closeReauthentication();
      navigate("/signin_or_signup", { replace: true });
    }
  };

  const visible = open && !isAuthRoute(location.pathname);

  return (
    <Dialog
      open={visible}
      fullWidth
      maxWidth="sm"
      scroll="paper"
      disableEscapeKeyDown
      onClose={() => {}}
      aria-labelledby="session-reauthentication-title"
      aria-describedby="session-reauthentication-description"
      PaperProps={{
        sx: {
          borderRadius: { xs: 2, sm: 3 },
          overflow: "hidden",
          maxHeight: "min(92dvh, 900px)",
        },
      }}
    >
      <DialogTitle id="session-reauthentication-title" sx={{ pb: 0.5 }}>
        {t("Your session has expired")}
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
        <Stack spacing={1.5}>
          <Typography
            id="session-reauthentication-description"
            variant="body2"
            color="text.secondary"
          >
            {t("Sign in again to continue. After successful authentication, you will return to the page you were using.")}
          </Typography>
          {reason === "refresh_token_missing" && (
            <Alert severity="info" variant="outlined">
              {t("Your saved sign-in session is no longer available. Please verify your identity again.")}
            </Alert>
          )}
          <SigninOrSignup
            key={attempt}
            reauthMode
            onAuthenticated={handleAuthenticated}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 280 }}>
          {t("You can also sign out and choose a different account.")}
        </Typography>
        <Button
          color="inherit"
          onClick={handleSwitchAccount}
          disabled={switchingAccount}
          sx={{ whiteSpace: "nowrap" }}
        >
          {t("Sign out")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
