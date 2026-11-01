import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";

const ToastCtx = createContext(null);

/**
 * Shared toast provider so any panel can push messages without prop-drilling.
 * Usage:
 *   const pushToast = useToast();
 *   pushToast("Plan saved");
 *   pushToast({ severity: "error", message: "Failed" });
 */
export function ToastProvider({ children }) {
  const { t } = useLocale();
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const push = useCallback((msgOrObj) => {
    if (typeof msgOrObj === "string") {
      setToast({ severity: "success", message: t(msgOrObj) });
    } else if (React.isValidElement(msgOrObj)) {
      setToast({ severity: "success", message: msgOrObj });
    } else if (msgOrObj && typeof msgOrObj === "object") {
      const message = msgOrObj.message ?? "";
      setToast({
        severity: msgOrObj.severity || "success",
        message: typeof message === "string" ? t(message) : message,
      });
    } else {
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 4500);
  }, [t]);

  const close = useCallback(() => setToast(null), []);

  const value = useMemo(() => push, [push]);

  // Auto-pick severity: if the message string contains "fail" or "error", downgrade to error.
  const resolvedSeverity = (() => {
    if (!toast) return "success";
    if (toast.severity !== "success") return toast.severity;
    const m = String(toast.message || "").toLowerCase();
    if (m.includes("fail") || m.includes("error") || m.includes("denied") || m.includes("cannot")) return "error";
    if (m.includes("warn")) return "warning";
    return "success";
  })();

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4500}
        onClose={close}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={resolvedSeverity}
          variant="filled"
          onClose={close}
          sx={{ maxWidth: 480, whiteSpace: "pre-wrap" }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </ToastCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) {
    // Fallback no-op so panels don't crash outside provider
    return () => {};
  }
  return ctx;
}
