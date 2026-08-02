import React from "react";
import { Box, Stack, Typography, LinearProgress, useTheme } from "@mui/material";

export default function UsageBar({ label, value, dense = false }) {
  const theme = useTheme();
  if (value == null) return null;

  const pct = Math.min(Math.max(Number(value) || 0, 0), 100);
  const barColor =
    pct >= 90
      ? theme.palette.error.main
      : pct >= 70
      ? theme.palette.warning.main
      : pct >= 40
      ? theme.palette.success.main
      : theme.palette.primary.main;

  return (
    <Box sx={{ minWidth: dense ? 64 : 72, flex: 1 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.35 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="caption" fontWeight={800} sx={{ color: barColor }}>
          {Math.round(pct)}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: dense ? 5 : 6,
          borderRadius: 99,
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "grey.200",
          "& .MuiLinearProgress-bar": {
            bgcolor: barColor,
            borderRadius: 99,
          },
        }}
      />
    </Box>
  );
}
