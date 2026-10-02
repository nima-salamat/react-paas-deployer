import React from "react";
import { Box, Stack, Typography, LinearProgress, CircularProgress, Tooltip } from "@mui/material";

export default function UsageBar({ label, value, loading = false, error = false, dense = false }) {
  const numeric = Number(value);
  const hasValue = Number.isFinite(numeric) && numeric >= 0;
  const pct = hasValue ? Math.min(Math.max(numeric, 0), 100) : null;
  const barColor = pct == null ? "text.disabled" : pct >= 90 ? "error.main" : pct >= 70 ? "warning.main" : pct >= 40 ? "success.main" : "primary.main";
  const title = loading ? label + " usage is being fetched" : error ? label + " live usage is currently unavailable" : hasValue ? label + " live usage" : label + " usage is not available";

  return (
    <Box sx={{ minWidth: dense ? 90 : 120, flex: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4, minHeight: 18 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
        <Tooltip title={title}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", minWidth: 30, justifyContent: "flex-end" }} aria-label={label + " " + (hasValue ? Math.round(pct) + "%" : loading ? "loading" : "unavailable")}>
            {loading ? <CircularProgress size={11} thickness={5} /> : <Typography variant="caption" fontWeight={800} color={barColor}>{hasValue ? Math.round(pct) + "%" : "—"}</Typography>}
          </Box>
        </Tooltip>
      </Stack>
      <LinearProgress
        variant={hasValue ? "determinate" : "indeterminate"}
        value={hasValue ? pct : undefined}
        sx={{
          height: dense ? 5 : 6,
          borderRadius: 99,
          bgcolor: "action.hover",
          "& .MuiLinearProgress-bar": { borderRadius: 99 },
        }}
        aria-label={label + " usage"}
      />
    </Box>
  );
}
