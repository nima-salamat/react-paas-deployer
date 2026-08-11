import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography,
} from "@mui/material";

/**
 * Generic confirmation popup. Shown before sensitive operations
 * (delete chat, delete group, block user, leave chat).
 *
 * Props:
 *  - open: boolean
 *  - title: string
 *  - message: string
 *  - confirmLabel?: string (default "Delete")
 *  - confirmColor?: "error" | "primary" | "warning" (default "error")
 *  - onConfirm: () => void
 *  - onClose: () => void
 */
export default function ConfirmDialog({
  open, title, message, onConfirm, onClose,
  confirmLabel = "Delete", confirmColor = "error",
}) {
  return (
    <Dialog open={Boolean(open)} onClose={onClose}>
      <DialogTitle>{title || "Are you sure?"}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{message || ""}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color={confirmColor} variant="contained" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
