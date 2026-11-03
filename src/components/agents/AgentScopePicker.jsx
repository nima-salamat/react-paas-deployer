import React from "react";
import {
  Box,
  Checkbox,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { useLocale } from "../../i18n/LocaleProvider.jsx";

/**
 * Reusable grouped Agent-scope selector.
 *
 * The category checkbox is tri-state: checked means every scope in the group
 * is selected, indeterminate means a subset is selected, and unchecked means
 * none are selected. Individual scopes remain independently selectable.
 */
export default function AgentScopePicker({
  groups = {},
  selectedScopes = [],
  onToggleScope,
  onToggleCategory,
  disabled = false,
}) {
  const { t } = useLocale();
  const selected = new Set(selectedScopes);

  return (
    <Stack spacing={1.5}>
      {Object.entries(groups).map(([category, scopes]) => {
        const categoryScopes = Array.isArray(scopes) ? scopes : [];
        const selectedCount = categoryScopes.reduce(
          (count, scope) => count + (selected.has(scope.name) ? 1 : 0),
          0,
        );
        const allSelected = categoryScopes.length > 0 && selectedCount === categoryScopes.length;
        const partiallySelected = selectedCount > 0 && !allSelected;

        return (
          <Paper key={category} variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 850, textTransform: "capitalize" }}>
                  {t(category.replace(/_/g, " "))}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedCount} / {categoryScopes.length} {t("selected")}
                </Typography>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {allSelected ? t("Deselect category") : t("Select category")}
                </Typography>
                <Checkbox
                  checked={allSelected}
                  indeterminate={partiallySelected}
                  disabled={disabled || categoryScopes.length === 0}
                  onChange={() => onToggleCategory?.(category, categoryScopes)}
                  inputProps={{ "aria-label": t(allSelected ? "Deselect all in category" : "Select all in category") }}
                  size="small"
                />
              </Stack>
            </Stack>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {categoryScopes.map((scope) => {
                const isSelected = selected.has(scope.name);
                const riskLabel = scope.destructive
                  ? t("destructive")
                  : scope.high_risk
                    ? t("high risk")
                    : "";
                return (
                  <Chip
                    key={scope.name}
                    label={t(scope.label) + (riskLabel ? ` · ${riskLabel}` : "")}
                    icon={isSelected ? <CheckRoundedIcon /> : undefined}
                    color={isSelected ? "primary" : "default"}
                    variant={isSelected ? "filled" : "outlined"}
                    disabled={disabled}
                    onClick={() => onToggleScope?.(scope.name)}
                    sx={{ height: 31, fontWeight: 650 }}
                  />
                );
              })}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
