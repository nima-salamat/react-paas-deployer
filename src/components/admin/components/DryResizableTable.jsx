import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import { DRY_BORDER, DRY_BORDER_LIGHT, DryEmptyState } from "./DryTable.jsx";

/**
 * DryResizableTable — hard-edge table with Excel-like column resizing.
 *
 * Features:
 *   - Sharp corners only (borderRadius: 0 everywhere)
 *   - Each column header has a draggable resize handle on its right edge
 *   - Column widths persist in localStorage (per `storageKey`)
 *   - Min width 60px, max width 600px (sane bounds)
 *   - Long cell text is truncated with ellipsis (no overflow to next column)
 *   - Optional `column.render(row)` for custom cell content
 *   - Optional `column.onCellClick(row)` for clickable FK chips etc.
 *
 * Props:
 *   columns: [{ id, label, align?, initialWidth?, render?(row), onCellClick?(row), stopPropagation? }]
 *   rows: array of objects with unique `id` or `pk`
 *   storageKey: string — localStorage key for persisting column widths
 *   minWidth: number — total min-width of the table (scroll trigger)
 *   emptyMessage: string
 *   onRowClick?: (row) => void
 *
 * The resize handle is a 6px-wide hit area on the right edge of each header
 * cell. The cursor becomes col-resize on hover. Dragging updates the column
 * width in real-time. Widths are persisted on mouseup (debounced).
 */
const MIN_COL_WIDTH = 60;
const MAX_COL_WIDTH = 600;
const RESIZE_HANDLE_WIDTH = 8;

export default function DryResizableTable({
  columns = [],
  rows = [],
  storageKey = "",
  minWidth = 640,
  emptyMessage = "No rows",
  onRowClick,
}) {
  // ─── Persisted column widths ──────────────────────────────────────────
  const loadWidths = useCallback(() => {
    if (!storageKey) return {};
    try {
      const raw = localStorage.getItem(`admin_dry_table_widths_${storageKey}`);
      if (raw) return JSON.parse(raw) || {};
    } catch { /* */ }
    return {};
  }, [storageKey]);

  const [widths, setWidths] = useState(() => {
    const saved = loadWidths();
    const init = {};
    columns.forEach((c) => {
      init[c.id] = saved[c.id] || c.initialWidth || 140;
    });
    return init;
  });

  // Reload widths if storageKey changes
  useEffect(() => {
    const saved = loadWidths();
    const init = {};
    columns.forEach((c) => {
      init[c.id] = saved[c.id] || c.initialWidth || 140;
    });
    setWidths(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persistWidths = useRef(null);
  persistWidths.current = () => {
    if (!storageKey) return;
    try {
      localStorage.setItem(
        `admin_dry_table_widths_${storageKey}`,
        JSON.stringify(widths)
      );
    } catch { /* */ }
  };

  // ─── Resize drag state ────────────────────────────────────────────────
  const dragState = useRef({
    columnId: null,
    startX: 0,
    startWidth: 0,
  });
  const [activeHandle, setActiveHandle] = useState(null);

  const onHandleMouseDown = (columnId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      columnId,
      startX: e.clientX,
      startWidth: widths[columnId] || 140,
    };
    setActiveHandle(columnId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      const ds = dragState.current;
      if (!ds.columnId) return;
      const delta = e.clientX - ds.startX;
      let next = ds.startWidth + delta;
      if (next < MIN_COL_WIDTH) next = MIN_COL_WIDTH;
      if (next > MAX_COL_WIDTH) next = MAX_COL_WIDTH;
      setWidths((prev) => ({ ...prev, [ds.columnId]: next }));
    };
    const onMouseUp = () => {
      if (dragState.current.columnId) {
        dragState.current.columnId = null;
        setActiveHandle(null);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        // Persist on mouseup (debounced via rAF)
        requestAnimationFrame(() => persistWidths.current?.());
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const totalWidth = columns.reduce(
    (sum, c) => sum + (widths[c.id] || 140),
    0
  );

  if (!rows.length) {
    return <DryEmptyState>{emptyMessage}</DryEmptyState>;
  }

  return (
    <Box sx={{ overflowX: "auto", width: "100%" }}>
      <Box
        component="table"
        sx={{
          width: totalWidth,
          minWidth,
          borderCollapse: "collapse",
          tableLayout: "fixed",
        }}
      >
        <Box component="thead" sx={{ bgcolor: "action.hover" }}>
          <tr>
            {columns.map((col) => {
              const w = widths[col.id] || 140;
              const isActive = activeHandle === col.id;
              return (
                <Box
                  key={col.id}
                  component="th"
                  sx={{
                    width: w,
                    minWidth: w,
                    maxWidth: w,
                    position: "relative",
                    textAlign: col.align || "left",
                    padding: "8px 10px",
                    paddingRight: `${RESIZE_HANDLE_WIDTH + 4}px`,
                    fontWeight: 700,
                    fontSize: 11,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    borderBottom: DRY_BORDER,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    verticalAlign: "bottom",
                    userSelect: "none",
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      verticalAlign: "bottom",
                    }}
                  >
                    {col.label}
                  </Box>
                  {/* Resize handle */}
                  <Box
                    onMouseDown={onHandleMouseDown(col.id)}
                    onClick={(e) => e.stopPropagation()}
                    title="Drag to resize"
                    sx={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      width: RESIZE_HANDLE_WIDTH,
                      cursor: "col-resize",
                      bgcolor: isActive
                        ? "primary.main"
                        : "transparent",
                      borderLeft: DRY_BORDER_LIGHT,
                      transition: "background-color 0.1s",
                      "&:hover": {
                        bgcolor: "primary.main",
                      },
                      zIndex: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: 1,
                        height: 14,
                        bgcolor: isActive
                          ? "#fff"
                          : "rgba(127,127,127,0.4)",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </tr>
        </Box>
        <tbody>
          {rows.map((row, idx) => {
            const key = row.id ?? row.pk ?? idx;
            return (
              <tr
                key={key}
                style={{
                  borderTop: DRY_BORDER_LIGHT,
                  cursor: onRowClick ? "pointer" : "default",
                }}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => {
                  const w = widths[col.id] || 140;
                  const value = col.render ? col.render(row) : (row[col.id] ?? "—");
                  return (
                    <Box
                      key={col.id}
                      component="td"
                      onClick={
                        col.stopPropagation
                          ? (e) => e.stopPropagation()
                          : undefined
                      }
                      sx={{
                        width: w,
                        minWidth: w,
                        maxWidth: w,
                        textAlign: col.align || "left",
                        padding: "8px 10px",
                        fontSize: 12,
                        verticalAlign: "middle",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {value}
                    </Box>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
}
