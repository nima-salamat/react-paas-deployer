import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack,
} from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import VideocamIcon from "@mui/icons-material/Videocam";

/**
 * Mobile call picker — two large buttons (voice | video).
 */
export default function CallChoiceDialog({ open, onClose, onVoice, onVideo }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 3, mx: 2 } }}
    >
      <DialogTitle sx={{ textAlign: "center", pb: 1, fontWeight: 700 }}>
        Call
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 2.5 }}>
        <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 1 }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<CallIcon />}
            onClick={() => {
              onClose?.();
              onVoice?.();
            }}
            sx={{
              flex: 1,
              py: 2,
              borderRadius: 2.5,
              fontSize: 16,
              fontWeight: 700,
              boxShadow: 3,
            }}
          >
            Voice
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<VideocamIcon />}
            onClick={() => {
              onClose?.();
              onVideo?.();
            }}
            sx={{
              flex: 1,
              py: 2,
              borderRadius: 2.5,
              fontSize: 16,
              fontWeight: 700,
              boxShadow: 3,
            }}
          >
            Video
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
