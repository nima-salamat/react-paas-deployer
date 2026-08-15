import React, { useState } from "react";
import { Box, Typography, Button, IconButton } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Banner shown when the active private chat peer is not in contacts.
 * Session-dismissible (X); parent handles the actual addContact call.
 */
export default function AddToContactsBanner({ username, onAdd }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: (t) => t.palette.mode === "dark" ? "rgba(33,150,243,0.12)" : "rgba(33,150,243,0.08)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <PersonAddIcon fontSize="small" color="primary" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        <strong>@{username || "this user"}</strong> is not in your contacts. Add them?
      </Typography>
      <Button
        size="small"
        variant="contained"
        color="primary"
        startIcon={<PersonAddIcon />}
        onClick={() => { onAdd(); setDismissed(true); }}
      >
        Add
      </Button>
      <IconButton size="small" onClick={() => setDismissed(true)}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
