import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, InputAdornment, LinearProgress, Pagination, Stack,
  TextField, Tooltip, Typography,
} from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LockIcon from "@mui/icons-material/Lock";
import StorageIcon from "@mui/icons-material/Storage";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import apiRequest from "../../customHooks/apiRequest";
import { adminTablesApi, hasAnyRule } from "../adminUtils";
import { useToast } from "../components/ToastContext";
import {
  DRY_BORDER, DRY_BORDER_LIGHT, DryPanel, DryInfoBanner, DryTh, DryTd,
  dryChipSx, dryWarningChipSx,
} from "../components/DryTable";
import FKPicker from "../components/FKPicker";

/**
 * TablesPanel — read + delete CRUD on registered Django models.
 *
 * Features:
 *   - Column drag-and-drop reorder (HTML5 DnD, persists in localStorage per table)
 *   - Text truncation: long cells are clamped to a max width, full text on hover
 *   - Foreign-key cells render as clickable chips — clicking navigates to that
 *     row's table view (in-place, via setActiveTable + openRowDetail)
 *   - Row detail dialog uses FKPicker for any FK fields
 *
 * Backend (users/admin_tables_api.py):
 *   GET    /api/users/admin/tables/                            → catalog
 *   GET    /api/users/admin/tables/<model_key>/?page=&q=       → paginated rows
 *   GET    /api/users/admin/tables/<model_key>/<pk>/           → single row
 *   DELETE /api/users/admin/tables/<model_key>/<pk>/           → delete (if deletable)
 *   GET    /api/users/admin/tables/<model_key>/fk-search/?q=   → FK picker search
 *
 * Styling: hard-edge (no border-radius anywhere). All surfaces use DryTable primitives.
 */

const MAX_CELL_WIDTH = 240; // px — long cells are truncated to this width
const COL_REORDER_PREFIX = "admin_table_col_order_";

export default function TablesPanel() {
  const pushToast = useToast();
  const canManage = hasAnyRule("tables.manage");

  const [tables, setTables] = useState([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [activeTable, setActiveTable] = useState(null);
  const [rows, setRows] = useState([]);
  const [fields, setFields] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [numPages, setNumPages] = useState(1);
  const [search, setSearch] = useState("");
  const [rowsLoading, setRowsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailRow, setDetailRow] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Column ordering (persisted per-table in localStorage)
  const [colOrder, setColOrder] = useState([]); // array of field names
  const [draggedCol, setDraggedCol] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: `${adminTablesApi()}/` });
      const d = res.data?.data || res.data || {};
      setTables(d.tables || []);
    } catch (e) {
      pushToast(e?.response?.data?.detail || "Failed to load table catalog");
    } finally {
      setTablesLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { loadTables(); }, [loadTables]);

  const loadRows = useCallback(async () => {
    if (!activeTable) return;
    setRowsLoading(true);
    try {
      const params = { page, page_size: perPage };
      if (search) params.q = search;
      const res = await apiRequest({
        method: "GET",
        url: `${adminTablesApi()}/${activeTable.key}/`,
        params,
      });
      const d = res.data?.data || res.data || {};
      setRows(d.rows || []);
      setFields(d.fields || []);
      setRowCount(d.count || 0);
      setNumPages(d.num_pages || 1);
      setPerPage(d.per_page || perPage);
      setTables((prev) => prev.map((t) =>
        t.key === activeTable.key ? { ...t, count: d.count ?? t.count } : t
      ));
    } catch (e) {
      pushToast(e?.response?.data?.detail || "Failed to load rows");
      setRows([]);
      setFields([]);
      setRowCount(0);
    } finally {
      setRowsLoading(false);
    }
  }, [activeTable, page, search, perPage, pushToast]);

  useEffect(() => {
    if (activeTable) {
      const t = setTimeout(loadRows, search ? 300 : 0);
      return () => clearTimeout(t);
    }
  }, [activeTable, page, search, perPage, loadRows]);

  // Restore column order from localStorage when activeTable changes
  useEffect(() => {
    if (!activeTable) {
      setColOrder([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`${COL_REORDER_PREFIX}${activeTable.key}`);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          setColOrder(arr);
          return;
        }
      }
    } catch { /* */ }
    // Default: keep server order
    setColOrder([]);
  }, [activeTable]);

  // Persist column order whenever it changes
  const persistColOrder = useCallback((order) => {
    if (!activeTable) return;
    try {
      localStorage.setItem(`${COL_REORDER_PREFIX}${activeTable.key}`, JSON.stringify(order));
    } catch { /* */ }
  }, [activeTable]);

  const openTable = (t) => {
    setActiveTable(t);
    setPage(1);
    setSearch("");
    setDetailRow(null);
  };

  const goBack = () => {
    setActiveTable(null);
    setRows([]);
    setFields([]);
    setSearch("");
    setPage(1);
    setDetailRow(null);
    setColOrder([]);
  };

  // Navigate to a related row (FK click). Switches the active table to the
  // related model, then opens the row detail.
  const navigateToRow = useCallback(async (modelKey, pk) => {
    // Find table in catalog
    const t = tables.find((x) => x.key === modelKey);
    if (!t) {
      pushToast(`Table ${modelKey} is not registered`);
      return;
    }
    setActiveTable(t);
    setPage(1);
    setSearch("");
    setDetailRow(null);
    // Wait a tick so activeTable state propagates, then open detail
    setTimeout(async () => {
      setDetailRow({ __loading: true, pk });
      setDetailLoading(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${adminTablesApi()}/${modelKey}/${pk}/`,
        });
        const d = res.data?.data || res.data || {};
        setDetailRow({ ...d, pk });
      } catch (e) {
        pushToast(e?.response?.data?.detail || "Failed to load row");
        setDetailRow(null);
      } finally {
        setDetailLoading(false);
      }
    }, 50);
  }, [tables, pushToast]);

  const openRowDetail = async (row) => {
    if (!activeTable) return;
    const pk = row.pk || row.id;
    if (!pk) return;
    setDetailRow({ __loading: true, pk });
    setDetailLoading(true);
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${adminTablesApi()}/${activeTable.key}/${pk}/`,
      });
      const d = res.data?.data || res.data || {};
      setDetailRow({ ...d, pk });
    } catch (e) {
      pushToast(e?.response?.data?.detail || "Failed to load row");
      setDetailRow(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Compute visible fields in the user's chosen column order
  const visibleFields = useMemo(() => {
    if (!fields.length) return [];
    const maxCols = 8;
    const ranked = [...fields].sort((a, b) => {
      const aRank = (a.name === "id" || a.name === "pk") ? -2 : (a.is_relation ? 1 : (a.sensitive ? 2 : 0));
      const bRank = (b.name === "id" || b.name === "pk") ? -2 : (b.is_relation ? 1 : (b.sensitive ? 2 : 0));
      return aRank - bRank;
    });
    const top = ranked.slice(0, maxCols);
    // Reorder according to colOrder
    if (colOrder.length === 0) return top;
    const lookup = new Map(top.map((f) => [f.name, f]));
    const ordered = colOrder.map((n) => lookup.get(n)).filter(Boolean);
    // Append any fields not in colOrder
    top.forEach((f) => {
      if (!ordered.find((x) => x.name === f.name)) ordered.push(f);
    });
    return ordered;
  }, [fields, colOrder]);

  // ─── Column drag handlers ───────────────────────────────────────────────
  const onColDragStart = (name) => () => setDraggedCol(name);
  const onColDragOver = (name) => (e) => {
    e.preventDefault();
    if (draggedCol && draggedCol !== name) setDragOverCol(name);
  };
  const onColDrop = (targetName) => (e) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetName) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    const newOrder = visibleFields.map((f) => f.name);
    const fromIdx = newOrder.indexOf(draggedCol);
    const toIdx = newOrder.indexOf(targetName);
    if (fromIdx === -1 || toIdx === -1) {
      setDraggedCol(null);
      setDragOverCol(null);
      return;
    }
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    setColOrder(newOrder);
    persistColOrder(newOrder);
    setDraggedCol(null);
    setDragOverCol(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !activeTable) return;
    setDeleting(true);
    try {
      await apiRequest({
        method: "DELETE",
        url: `${adminTablesApi()}/${activeTable.key}/${deleteTarget.pk}/`,
      });
      pushToast(`Row deleted: ${deleteTarget.label || deleteTarget.pk}`);
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else loadRows();
    } catch (e) {
      const detail = e?.response?.data?.detail
        || (e?.response?.data?.protected?.length
          ? `Cannot delete: referenced by ${e.response.data.protected.length} row(s)`
          : "Delete failed");
      pushToast(detail);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Catalog view ──────────────────────────────────────────────────────
  if (!activeTable) {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} gap={1.5}>
          <Box>
            <Typography variant="h5" fontWeight={800}>Database tables</Typography>
            <Typography variant="body2" color="text.secondary">
              Browse and inspect registered Django models. {canManage ? "Rows on deletable tables can be deleted." : "Read-only — you need tables.manage to delete rows."}
            </Typography>
          </Box>
          <Button startIcon={<RefreshIcon />} onClick={loadTables} disabled={tablesLoading} variant="outlined"
            sx={{ borderRadius: 0, textTransform: "none" }}>
            Refresh
          </Button>
        </Stack>

        <DryInfoBanner icon={StorageIcon} color="info.main">
          <Typography variant="body2" fontWeight={600}>Security model</Typography>
          <Typography variant="caption" color="text.secondary">
            Only models registered in <code>TABLE_REGISTRY</code> are exposed. Sensitive fields
            (passwords, tokens, secrets) are masked on read. Hard delete is restricted to models
            flagged <code>deletable=True</code> and requires the <code>tables.manage</code> rule.
            Column order can be rearranged by dragging the column header — it persists per table.
          </Typography>
        </DryInfoBanner>

        {tablesLoading ? (
          <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
        ) : tables.length === 0 ? (
          <DryPanel sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">No tables registered</Typography>
          </DryPanel>
        ) : (
          <DryPanel sx={{ overflow: "hidden" }}>
            <Box sx={{ overflowX: "auto" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                  <tr>
                    <DryTh>Table</DryTh>
                    <DryTh>App</DryTh>
                    <DryTh>Model</DryTh>
                    <DryTh align="right">Rows</DryTh>
                    <DryTh align="center">Search</DryTh>
                    <DryTh align="center">Deletable</DryTh>
                    <DryTh align="right"> </DryTh>
                  </tr>
                </Box>
                <tbody>
                  {tables.map((t) => (
                    <tr key={t.key} style={{ borderTop: DRY_BORDER_LIGHT }}>
                      <DryTd>
                        <Stack direction="row" alignItems="center" gap={1}>
                          <TableChartIcon fontSize="small" color="action" />
                          <Typography fontWeight={700} fontSize={13}>{t.label}</Typography>
                        </Stack>
                      </DryTd>
                      <DryTd><code style={{ fontSize: 11 }}>{t.app}</code></DryTd>
                      <DryTd><code style={{ fontSize: 11 }}>{t.model}</code></DryTd>
                      <DryTd align="right">{t.count ?? "—"}</DryTd>
                      <DryTd align="center">
                        {t.searchable
                          ? <Chip size="small" label="yes" sx={dryChipSx(true)} />
                          : <Chip size="small" label="no" sx={dryChipSx(false)} />}
                      </DryTd>
                      <DryTd align="center">
                        {t.deletable
                          ? <Chip size="small" label="deletable" sx={dryWarningChipSx} />
                          : <Chip size="small" icon={<LockIcon sx={{ fontSize: 11 }} />} label="read-only" sx={dryChipSx(false)} />}
                      </DryTd>
                      <DryTd align="right">
                        <Button size="small" onClick={() => openTable(t)} variant="outlined"
                          sx={{ borderRadius: 0, textTransform: "none" }}>
                          Open
                        </Button>
                      </DryTd>
                    </tr>
                  ))}
                </tbody>
              </Box>
            </Box>
          </DryPanel>
        )}
      </Stack>
    );
  }

  // ─── Rows view ─────────────────────────────────────────────────────────
  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <IconButton onClick={goBack} aria-label="back to catalog">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" fontWeight={800} noWrap>
            {activeTable.label}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontFamily="monospace">
            {activeTable.app}.{activeTable.model} · {rowCount.toLocaleString()} rows
          </Typography>
        </Box>
        <Tooltip title="Create / Update endpoints are not exposed by the backend for safety. Use the Django admin or a dedicated admin API for write operations.">
          <span>
            <Button size="small" variant="outlined" disabled
              sx={{ borderRadius: 0, textTransform: "none" }}>
              New row (locked)
            </Button>
          </span>
        </Tooltip>
        <Button startIcon={<RefreshIcon />} onClick={loadRows} disabled={rowsLoading} variant="outlined"
          sx={{ borderRadius: 0, textTransform: "none" }}>
          Refresh
        </Button>
      </Stack>

      <Typography variant="caption" color="text.secondary">
        Tip: drag the column header to reorder columns. Click any FK chip to navigate to that row.
      </Typography>

      {activeTable.searchable && (
        <DryPanel sx={{ p: 1.5 }}>
          <TextField
            size="small"
            placeholder="Search rows…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            fullWidth
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            }}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 0 } }}
          />
        </DryPanel>
      )}

      <DryPanel sx={{ overflow: "hidden" }}>
        {rowsLoading ? (
          <LinearProgress />
        ) : rows.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">No rows</Typography>
          </Box>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
              <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                <tr>
                  {visibleFields.map((f) => (
                    <DryTh
                      key={f.name}
                      draggable
                      onDragStart={onColDragStart(f.name)}
                      onDragOver={onColDragOver(f.name)}
                      onDrop={onColDrop(f.name)}
                      onDragEnd={() => { setDraggedCol(null); setDragOverCol(null); }}
                      sx={{
                        cursor: "grab",
                        outline: dragOverCol === f.name ? "2px solid #1976d2" : "none",
                        outlineOffset: -2,
                        opacity: draggedCol === f.name ? 0.4 : 1,
                        position: "relative",
                        "&:active": { cursor: "grabbing" },
                        "&:hover": { bgcolor: "action.selected" },
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={0.5}>
                        <DragIndicatorIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                        <Stack>
                          <Typography variant="caption" fontWeight={700}>{f.name}</Typography>
                          <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9, lineHeight: 1, display: "block" }}>
                            {f.type}
                          </Typography>
                        </Stack>
                        {f.sensitive && <LockIcon sx={{ fontSize: 10, color: "text.disabled" }} />}
                      </Stack>
                    </DryTh>
                  ))}
                  <DryTh align="right">Actions</DryTh>
                </tr>
              </Box>
              <tbody>
                {rows.map((r, idx) => {
                  const pk = r.pk || r.id || idx;
                  return (
                    <tr key={pk} style={{ borderTop: DRY_BORDER_LIGHT }}>
                      {visibleFields.map((f) => (
                        <DryTd key={f.name} sx={{ maxWidth: MAX_CELL_WIDTH, verticalAlign: "top" }}>
                          <CellRenderer
                            value={r[f.name]}
                            field={f}
                            onFkClick={f.is_relation && f.related ? (fkPk) => navigateToRow(f.related, fkPk) : null}
                          />
                        </DryTd>
                      ))}
                      <DryTd align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" onClick={() => openRowDetail(r)}
                            sx={{ borderRadius: 0, textTransform: "none", fontSize: 11 }}>View</Button>
                          {canManage && activeTable.deletable && (
                            <Tooltip title="Delete row">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteTarget({
                                  pk,
                                  label: r.username || r.name || r.public_id || pk,
                                })}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </DryTd>
                    </tr>
                  );
                })}
              </tbody>
            </Box>
          </Box>
        )}
        {numPages > 1 && (
          <Box display="flex" justifyContent="center" p={2} sx={{ borderTop: DRY_BORDER_LIGHT }}>
            <Pagination
              page={page}
              count={numPages}
              onChange={(_, v) => setPage(v)}
              color="primary"
              showFirstButton
              showLastButton
              siblingCount={1}
              boundaryCount={1}
            />
          </Box>
        )}
      </DryPanel>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>Delete row?</DialogTitle>
        <DialogContent>
          <Stack gap={1}>
            <Typography>
              You are about to <strong>permanently delete</strong> this row from <code>{activeTable.key}</code>:
            </Typography>
            <DryPanel sx={{ p: 1.5, fontFamily: "monospace", fontSize: 12 }}>
              {deleteTarget?.label || deleteTarget?.pk}
            </DryPanel>
            <Typography variant="caption" color="error">
              This cannot be undone. If the row is referenced by other rows via protected foreign keys, the delete will be blocked.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}
            sx={{ borderRadius: 0, textTransform: "none" }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}
            sx={{ borderRadius: 0, textTransform: "none", fontWeight: 700 }}>
            {deleting ? "Deleting…" : "Delete row"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Row detail dialog — uses FKPicker for FK fields */}
      <Dialog
        open={Boolean(detailRow)}
        onClose={() => setDetailRow(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}
      >
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <StorageIcon fontSize="small" />
            <span>Row detail · {activeTable.label}</span>
            {detailRow?.pk != null && (
              <code style={{ fontSize: 11, color: "text.secondary" }}>
                pk={String(detailRow.pk).slice(0, 16)}
              </code>
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading || detailRow?.__loading ? (
            <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
          ) : detailRow ? (
            <Box sx={{ border: DRY_BORDER, overflow: "hidden" }}>
              <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <tbody>
                  {Object.entries(detailRow)
                    .filter(([k]) => k !== "__loading" && k !== "pk")
                    .map(([k, v]) => {
                      const field = fields.find((f) => f.name === k);
                      const isFK = field?.is_relation && field?.related;
                      return (
                        <tr key={k} style={{ borderTop: DRY_BORDER_LIGHT }}>
                          <DryTd sx={{ width: 200, bgcolor: "action.hover" }}>
                            <Typography variant="caption" fontWeight={700}>{k}</Typography>
                            {field && (
                              <Typography variant="overline" color="text.secondary" sx={{ fontSize: 9, lineHeight: 1, display: "block" }}>
                                {field.type}
                              </Typography>
                            )}
                          </DryTd>
                          <DryTd>
                            {isFK ? (
                              <FKDetailCell
                                value={v}
                                relatedModelKey={field.related}
                                onNavigate={(fkPk) => {
                                  setDetailRow(null);
                                  navigateToRow(field.related, fkPk);
                                }}
                              />
                            ) : (
                              <CellValueDetail value={v} />
                            )}
                          </DryTd>
                        </tr>
                      );
                    })}
                </tbody>
              </Box>
            </Box>
          ) : (
            <Typography color="text.secondary">No data</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setDetailRow(null)}
            sx={{ borderRadius: 0, textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

// ─── Cell renderers ──────────────────────────────────────────────────────
function CellRenderer({ value, field, onFkClick }) {
  if (value === null || value === undefined || value === "") {
    return <Typography variant="caption" color="text.disabled">—</Typography>;
  }
  if (field?.sensitive) {
    return <Chip size="small" label="REDACTED" variant="outlined" sx={{ height: 18, fontSize: 10, borderRadius: 0 }} />;
  }
  if (typeof value === "boolean") {
    return (
      <Chip
        size="small"
        label={value ? "true" : "false"}
        sx={{
          height: 18,
          fontSize: 10,
          borderRadius: 0,
          bgcolor: value ? "success.main" : "action.hover",
          color: value ? "#fff" : "text.secondary",
        }}
      />
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <Typography variant="caption" color="text.disabled">[]</Typography>;
    return (
      <Stack gap={0.25}>
        {value.slice(0, 2).map((v, i) => (
          <Chip
            key={i}
            size="small"
            label={typeof v === "object" ? (v.str || v.pk || JSON.stringify(v)) : String(v)}
            variant="outlined"
            sx={{ height: 18, fontSize: 10, borderRadius: 0, maxWidth: MAX_CELL_WIDTH }}
          />
        ))}
        {value.length > 2 && (
          <Typography variant="caption" color="text.secondary">+{value.length - 2} more</Typography>
        )}
      </Stack>
    );
  }
  if (typeof value === "object") {
    const label = value.str || value.label || value.name || JSON.stringify(value);
    const pk = value.pk;
    // FK chip — clickable to navigate
    if (pk != null && onFkClick) {
      return (
        <Tooltip title={`Open ${field?.related || "related row"} #${pk}`}>
          <Chip
            size="small"
            label={`#${pk} · ${label}`}
            variant="outlined"
            onClick={() => onFkClick(pk)}
            sx={{
              height: 20, fontSize: 10, maxWidth: MAX_CELL_WIDTH, borderRadius: 0,
              cursor: "pointer",
              "&:hover": { bgcolor: "primary.main", color: "#fff" },
            }}
          />
        </Tooltip>
      );
    }
    return (
      <Tooltip title={JSON.stringify(value)}>
        <Chip size="small" label={label} variant="outlined" sx={{ height: 20, fontSize: 10, maxWidth: MAX_CELL_WIDTH, borderRadius: 0 }} />
      </Tooltip>
    );
  }
  const str = String(value);
  if (str.length > 60) {
    return (
      <Tooltip title={str}>
        <Box
          component="span"
          sx={{
            display: "inline-block",
            maxWidth: MAX_CELL_WIDTH,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "bottom",
            fontFamily: field?.type === "DateTimeField" || field?.type === "DateField" ? "monospace" : "inherit",
            fontSize: 12,
          }}
        >
          {str}
        </Box>
      </Tooltip>
    );
  }
  return (
    <Typography
      variant="caption"
      fontFamily={field?.type === "DateTimeField" || field?.type === "DateField" ? "monospace" : "inherit"}
    >
      {str}
    </Typography>
  );
}

function CellValueDetail({ value }) {
  if (value === null || value === undefined) {
    return <Typography variant="caption" color="text.disabled">null</Typography>;
  }
  if (typeof value === "object") {
    return (
      <Box
        component="pre"
        sx={{
          m: 0, p: 1, fontSize: 11, fontFamily: "monospace",
          bgcolor: "action.hover", border: DRY_BORDER_LIGHT, borderRadius: 0,
          overflow: "auto", maxHeight: 240,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    );
  }
  if (typeof value === "string" && value.length > 200) {
    return (
      <Box
        component="pre"
        sx={{
          m: 0, p: 1, fontSize: 11, fontFamily: "monospace",
          bgcolor: "action.hover", border: DRY_BORDER_LIGHT, borderRadius: 0,
          overflow: "auto", maxHeight: 240, whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}
      >
        {value}
      </Box>
    );
  }
  return <Typography variant="body2" fontFamily="monospace">{String(value)}</Typography>;
}

// FK cell inside the detail dialog — uses FKPicker for navigation/search
function FKDetailCell({ value, relatedModelKey, onNavigate }) {
  const pk = value?.pk;
  const str = value?.str || (pk != null ? `#${pk}` : "—");

  if (pk == null) {
    return <Typography variant="caption" color="text.disabled">null</Typography>;
  }

  return (
    <Stack direction="row" alignItems="center" gap={1} sx={{ width: "100%" }}>
      <Chip
        size="small"
        label={`#${pk} · ${str}`}
        variant="outlined"
        onClick={() => onNavigate(pk)}
        sx={{
          height: 22, fontSize: 11, borderRadius: 0, cursor: "pointer",
          "&:hover": { bgcolor: "primary.main", color: "#fff" },
          maxWidth: 320,
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
        {relatedModelKey}
      </Typography>
    </Stack>
  );
}
