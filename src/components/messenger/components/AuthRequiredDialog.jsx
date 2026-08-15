import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

/**
 * Shown when messenger APIs report the user is not authenticated.
 */
export default function AuthRequiredDialog({ open, onClose, onSignIn }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 1.25 } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LockOutlinedIcon color="primary" />
        Sign in required
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          You need to be signed in to use the messenger. Please sign in or
          create an account to continue.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Dismiss
        </Button>
        <Button variant="contained" color="primary" onClick={onSignIn}>
          Go to sign in
        </Button>
      </DialogActions>
    </Dialog>
  );
}
