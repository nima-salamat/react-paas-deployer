import React from "react";
import { Box, Paper, Stack, Typography, alpha, useTheme } from "@mui/material";
import { resolveThemeColor } from "../adminUtils";

/**
 * StatCard — small KPI tile.
 *
 * `color` may be a dotted theme path like "primary.main" or a real color
 * value (#hex / rgb). We resolve dotted paths against the theme so we can
 * safely apply alpha() to it.
 */
export default function StatCard({ label, value, color, icon }) {
  const theme = useTheme();
  const c = resolveThemeColor(theme, color);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        height: "100%",
        background: `linear-gradient(135deg, ${alpha(c, 0.06)} 0%, ${theme.palette.background.paper} 100%)`,
        borderColor: alpha(c, 0.18),
        transition: "transform .15s ease, box-shadow .15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 6px 20px ${alpha(c, 0.12)}`,
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1, lineHeight: 1 }}>
            {label}
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: color || "text.primary" }}>
            {value ?? "—"}
          </Typography>
        </Box>
        {icon && (
          <Box
            sx={{
              width: 40, height: 40,
              display: "grid", placeItems: "center",
              bgcolor: alpha(c, 0.12),
              color: color || "primary.main",
              borderRadius: 1.5,
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
