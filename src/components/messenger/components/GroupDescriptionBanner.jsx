import React, { useState } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Group description banner for non-admin members.
 * Dismissible per-conversation (parent tracks the dismissed set).
 */
export default function GroupDescriptionBanner({ description, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (description || "").length > 140;
  const display = expanded || !isLong ? description : `${description.slice(0, 140)}…`;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.25,
        px: 2,
        py: 1,
        bgcolor: (t) => t.palette.mode === "dark" ? "rgba(33,150,243,0.10)" : "rgba(33,150,243,0.06)",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <InfoOutlinedIcon fontSize="small" color="primary" sx={{ mt: 0.25 }} />
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          color: "text.primary",
        }}
      >
        {display}
        {isLong && (
          <Box
            component="span"
            onClick={() => setExpanded((e) => !e)}
            sx={{
              color: "primary.main",
              cursor: "pointer",
              ml: 0.5,
              fontWeight: 600,
            }}
          >
            {expanded ? "Show less" : "Show more"}
          </Box>
        )}
      </Typography>
      <IconButton size="small" onClick={onDismiss} sx={{ mt: -0.25 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
