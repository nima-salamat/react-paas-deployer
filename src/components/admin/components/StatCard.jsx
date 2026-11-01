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
        p: { xs: 1.5, sm: 2 },
        minHeight: { xs: 112, sm: 128 },
        height: "100%",
        borderRadius: 2.5,
        background: `linear-gradient(135deg, ${alpha(c, 0.09)} 0%, ${theme.palette.background.paper} 78%)`,
        borderColor: alpha(c, 0.2),
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.035)",
        transition: "transform .15s ease, box-shadow .15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: `0 6px 20px ${alpha(c, 0.12)}`,
        },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 0.8, lineHeight: 1.2, fontWeight: 800, fontSize: 10.5 }}
          >
            {label}
          </Typography>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{ mt: 0.75, color: color || "text.primary", fontSize: "clamp(1.55rem, 2.5vw, 2.05rem)", lineHeight: 1 }}
          >
            {value ?? "—"}
          </Typography>
        </Box>
        {icon && (
          <Box
            sx={{
              width: { xs: 34, sm: 42 },
              height: { xs: 34, sm: 42 },
              display: "grid",
              placeItems: "center",
              bgcolor: alpha(c, 0.13),
              color: color || "primary.main",
              borderRadius: 2,
              "& svg": { fontSize: { xs: 18, sm: 21 } },
            }}
          >
            {icon}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
