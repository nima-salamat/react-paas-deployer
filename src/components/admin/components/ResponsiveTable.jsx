import React from "react";
import {
  Box, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography, useMediaQuery, useTheme,
} from "@mui/material";

/**
 * ResponsiveTable — desktop: classic MUI table; mobile: stacked card list.
 *
 * columns: [{ id, label, align?, hideOnMobile?, render?(row), stopPropagation? }]
 * rows: array of objects (must have unique `id` or `pk`, otherwise index is used)
 */
export default function ResponsiveTable({
  columns = [],
  rows = [],
  onRowClick,
  emptyMessage = "No data",
  minWidth = 640,
  size = "small",
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  if (!rows.length) {
    return (
      <Paper sx={{ p: 3, textAlign: "center" }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }

  if (isMobile) {
    const mobileCols = columns.filter((c) => !c.hideOnMobile);
    return (
      <Stack gap={1.25}>
        {rows.map((row, idx) => {
          const key = row.id ?? row.pk ?? idx;
          return (
            <Paper
              key={key}
              variant="outlined"
              sx={{
                p: 1.5,
                cursor: onRowClick ? "pointer" : "default",
                "&:active": onRowClick ? { bgcolor: "action.selected" } : undefined,
              }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              <Stack gap={0.75}>
                {mobileCols.map((col) => {
                  const value = col.render ? col.render(row) : row[col.id];
                  return (
                    <Stack
                      key={col.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, pt: 0.25 }}>
                        {col.label}
                      </Typography>
                      <Box sx={{ textAlign: "right", minWidth: 0 }}>{value ?? "—"}</Box>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    );
  }

  return (
    <Paper sx={{ overflow: "auto" }}>
      <Table size={size} sx={{ minWidth }}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.id} align={col.align || "left"}>
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => {
            const key = row.id ?? row.pk ?? idx;
            return (
              <TableRow
                key={key}
                hover={Boolean(onRowClick)}
                sx={{ cursor: onRowClick ? "pointer" : "default" }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    align={col.align || "left"}
                    onClick={col.stopPropagation ? (e) => e.stopPropagation() : undefined}
                  >
                    {col.render ? col.render(row) : (row[col.id] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
