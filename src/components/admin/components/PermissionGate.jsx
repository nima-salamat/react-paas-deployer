import React from "react";
import { Box, Typography, Paper } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { hasRule } from "../adminUtils";

/**
 * Conditionally render children if the user has the required rule(s).
 *
 * Props:
 *   rule        — single code, e.g. "services.manage"
 *   anyOf       — array of codes (OR semantics)
 *   allOf       — array of codes (AND semantics)
 *   fallback    — optional custom fallback node
 *   silent      — if true, render nothing when denied
 */
export default function PermissionGate({
  rule,
  anyOf,
  allOf,
  fallback,
  silent = false,
  children,
}) {
  let allowed = true;
  if (rule) allowed = hasRule(rule);
  if (Array.isArray(anyOf) && anyOf.length) allowed = anyOf.some((c) => hasRule(c));
  if (Array.isArray(allOf) && allOf.length) allowed = allOf.every((c) => hasRule(c));

  if (allowed) return <>{children}</>;
  if (silent) return null;
  if (fallback) return fallback;

  return (
    <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
      <LockOutlinedIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
      <Typography color="text.secondary">
        You don’t have permission for this action.
      </Typography>
    </Paper>
  );
}
