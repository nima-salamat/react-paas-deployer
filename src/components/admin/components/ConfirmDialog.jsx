import React from "react";
import {
  Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from "@mui/material";
import { useLocale } from "../../../i18n/LocaleProvider.jsx";

/**
 * Shared confirm dialog for destructive / unusual actions.
 *
 * Props:
 *   open, title, message, confirmLabel, cancelLabel, confirmColor, onConfirm, onCancel, loading
 */
export default function ConfirmDialog({
  open,
  title = "Confirm",
  message = "Are you sure?",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor = "error",
  onConfirm,
  onCancel,
  loading = false,
}) {
  const { t } = useLocale();
  const localize = (value) => typeof value === "string" ? t(value) : value;
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{localize(title)}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: "text.secondary", fontSize: 14 }}>
          {localize(message)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button
          onClick={onCancel}
          disabled={loading}
          sx={{ textTransform: "none", borderRadius: 1 }}
        >
          {localize(cancelLabel)}
        </Button>
        <Button
          variant="contained"
          color={confirmColor}
          onClick={onConfirm}
          disabled={loading}
          autoFocus
          sx={{ textTransform: "none", borderRadius: 1, fontWeight: 700 }}
        >
          {loading ? "…" : localize(confirmLabel)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
