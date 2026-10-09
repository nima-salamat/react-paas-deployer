import React from "react";
import { Box, Typography, alpha } from "@mui/material";
import PlatformIcon from "../plans/PlatformIcon.jsx";

/**
 * Fixed-footprint service identity mark shared by Service List and Service Detail.
 * The icon/platform side remains a consistent width while the service name can
 * grow or wrap independently beside it.
 */
export default function ServicePlatformBadge({
  platformKey = "",
  platformLabel = "",
  typeLabel = "Application",
  isDatabase = false,
  isReadyApp = false,
}) {
  const visiblePlatform = String(platformLabel || platformKey || "Unknown platform");

  return (
    <Box
      component="span"
      title={`${typeLabel} · ${visiblePlatform}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        flex: "0 0 auto",
        width: { xs: 132, sm: 156 },
        height: 52,
        boxSizing: "border-box",
        minWidth: 0,
        px: 0.9,
        py: 0.65,
        overflow: "hidden",
        border: "1px solid",
        borderColor: (theme) =>
          isDatabase
            ? alpha(theme.palette.info.main, 0.34)
            : isReadyApp
              ? alpha(theme.palette.secondary.main, 0.32)
              : theme.palette.divider,
        borderRadius: 1.8,
        bgcolor: (theme) =>
          isDatabase
            ? alpha(theme.palette.info.main, theme.palette.mode === "dark" ? 0.10 : 0.055)
            : isReadyApp
              ? alpha(theme.palette.secondary.main, theme.palette.mode === "dark" ? 0.10 : 0.05)
              : "action.hover",
      }}
    >
      <PlatformIcon
        platformKey={platformKey || visiblePlatform}
        label={visiblePlatform}
        size={16}
      />
      <Box sx={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
        <Typography
          component="span"
          sx={{
            display: "block",
            color: isDatabase ? "info.main" : isReadyApp ? "secondary.main" : "text.secondary",
            fontSize: 9.5,
            lineHeight: 1.15,
            fontWeight: 850,
            letterSpacing: "0.035em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {typeLabel}
        </Typography>
        <Typography
          component="span"
          sx={{
            display: "block",
            mt: 0.45,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11.5,
            lineHeight: 1.2,
            fontWeight: 800,
            color: "text.primary",
            textTransform: "capitalize",
          }}
        >
          {visiblePlatform}
        </Typography>
      </Box>
    </Box>
  );
}
