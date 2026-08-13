import React from "react";
import { Box, Chip, Stack, Typography, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

/**
 * DryTable — shared hard-edge table primitives for the admin panel.
 *
 * Design philosophy (locked-in by the project's "no curves" requirement):
 *   - Every surface has borderRadius: 0
 *   - Borders are thin gray hairlines (no shadows)
 *   - No gradients, no glassmorphism, no rounded chips
 *   - Typography is compact, uppercase headers, monospace for IDs
 *
 * Exports:
 *   - DRY_BORDER / DRY_BORDER_LIGHT  — shared border constants
 *   - DryPanel                        — sharp-cornered Box wrapper
 *   - DryInfoBanner                   — left-stripe info banner
 *   - DryTh / DryTd                   — table cell primitives
 *   - DryChip / DryWarningChip        — sharp-cornered chips
 *   - DryCreateButton                 — prominent "create row" button
 *   - DryEmptyState                   — empty-state placeholder
 *   - DryToolbar                       — sharp-cornered table toolbar
 */

export const DRY_BORDER = "1px solid rgba(127, 127, 127, 0.35)";
export const DRY_BORDER_LIGHT = "1px solid rgba(127, 127, 127, 0.18)";

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------
export function DryPanel({ sx, children, ...rest }) {
  return (
    <Box
      {...rest}
      sx={{
        bgcolor: "background.paper",
        border: DRY_BORDER,
        borderRadius: 0,
        boxShadow: "none",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function DryInfoBanner({ children, color = "info.main", icon: Icon, sx, ...rest }) {
  return (
    <Box
      {...rest}
      sx={{
        p: 1.5,
        border: DRY_BORDER,
        borderLeft: `4px solid ${color}`,
        bgcolor: "action.hover",
        borderRadius: 0,
        ...sx,
      }}
    >
      <Stack direction="row" gap={1.5} alignItems="flex-start">
        {Icon && <Icon sx={{ mt: 0.25, color }} fontSize="small" />}
        <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
      </Stack>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Table cells
// ---------------------------------------------------------------------------
export function DryTh({ children, align = "left", sx, ...rest }) {
  return (
    <Box
      component="th"
      {...rest}
      sx={{
        textAlign: align,
        padding: "8px 10px",
        fontWeight: 700,
        fontSize: 11,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        borderBottom: DRY_BORDER,
        whiteSpace: "nowrap",
        verticalAlign: "bottom",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function DryTd({ children, align = "left", sx, ...rest }) {
  return (
    <Box
      component="td"
      {...rest}
      sx={{
        textAlign: align,
        padding: "8px 10px",
        fontSize: 12,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Chips — sharp corners only
// ---------------------------------------------------------------------------
export function DryChip({ label, yes = false, color, ...rest }) {
  return (
    <Chip
      size="small"
      label={label}
      {...rest}
      sx={{
        height: 18,
        fontSize: 10,
        bgcolor: yes ? "success.main" : (color || "action.hover"),
        color: yes ? "#fff" : "text.secondary",
        borderRadius: 0,
        border: DRY_BORDER_LIGHT,
      }}
    />
  );
}

export function DryWarningChip({ label = "deletable", ...rest }) {
  return (
    <Chip
      size="small"
      label={label}
      {...rest}
      sx={{
        height: 18,
        fontSize: 10,
        bgcolor: "warning.main",
        color: "#fff",
        borderRadius: 0,
        border: DRY_BORDER_LIGHT,
      }}
    />
  );
}

// Backward-compat helpers exported as functions (used by TablesPanel).
export const dryChipSx = (yes) => ({
  height: 18,
  fontSize: 10,
  bgcolor: yes ? "success.main" : "action.hover",
  color: yes ? "#fff" : "text.secondary",
  borderRadius: 0,
  border: DRY_BORDER_LIGHT,
});

export const dryWarningChipSx = {
  height: 18,
  fontSize: 10,
  bgcolor: "warning.main",
  color: "#fff",
  borderRadius: 0,
  border: DRY_BORDER_LIGHT,
};

// ---------------------------------------------------------------------------
// Buttons — sharp corners, formal
// ---------------------------------------------------------------------------
/**
 * Prominent "Create row" affordance for hard-edge tables.
 * Renders a full-width, sharp-cornered outlined button with a + icon.
 * Visually distinct from the regular small buttons in the same row.
 */
export function DryCreateButton({ children, onClick, disabled, sx, ...rest }) {
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={<AddIcon fontSize="small" />}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      sx={{
        borderRadius: 0,
        textTransform: "none",
        fontWeight: 700,
        border: DRY_BORDER,
        "&:hover": {
          border: DRY_BORDER,
          bgcolor: "action.hover",
        },
        ...sx,
      }}
    >
      {children}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
export function DryEmptyState({ children = "No rows", sx }) {
  return (
    <Box sx={{ p: 3, textAlign: "center", ...sx }}>
      <Typography variant="caption" color="text.secondary">
        {children}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Table toolbar — sharp-cornered row container
// ---------------------------------------------------------------------------
export function DryToolbar({ children, sx, ...rest }) {
  return (
    <Box
      {...rest}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        borderBottom: DRY_BORDER_LIGHT,
        bgcolor: "action.hover",
        borderRadius: 0,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
