import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch,
  TextField, Tooltip, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BusinessIcon from "@mui/icons-material/Business";
import apiRequest from "../../customHooks/apiRequest";
import { hostBase, hasAnyRule } from "../adminUtils";
import { useToast } from "../components/ToastContext";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import {
  DRY_BORDER_LIGHT, DryPanel, DryTh, DryTd, DryCreateButton, DryEmptyState,
} from "../components/DryTable";

const API = () => `${hostBase()}/api/tickets/admin/departments/`;

const blankDraft = () => ({
  id: null,
  name: "",
  description: "",
  order: "0",
  is_active: true,
});

function dataFromResponse(response) {
  const body = response?.data || {};
  const raw = body?.data ?? body;
  return Array.isArray(raw) ? raw : (raw?.results || raw?.departments || []);
}

function errorMessage(error, fallback) {
  const body = error?.response?.data;
  if (typeof body?.message === "string" && body.message) return body.message;
  if (typeof body?.detail === "string" && body.detail) return body.detail;
  const errors = body?.errors || body;
  if (errors && typeof errors === "object") {
    const messages = Object.entries(errors)
      .map(([field, value]) => {
        const text = Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
        return text ? `${field}: ${text}` : "";
      })
      .filter(Boolean);
    if (messages.length) return messages.join(" · ");
  }
  return fallback;
}

export default function DepartmentsPanel() {
  const pushToast = useToast();
  const canManage = hasAnyRule("departments.manage");
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState(blankDraft);
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ method: "GET", url: API() });
      setDepartments(dataFromResponse(response));
    } catch (err) {
      setDepartments([]);
      setError(errorMessage(err, "Could not load departments."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDepartments(); }, [loadDepartments]);

  const openCreate = () => {
    setDraft(blankDraft());
    setEditorOpen(true);
  };

  const openEdit = (department) => {
    setDraft({
      id: department.id,
      name: department.name || "",
      description: department.description || "",
      order: String(department.order ?? 0),
      is_active: department.is_active !== false,
    });
    setEditorOpen(true);
  };

  const saveDepartment = async () => {
    if (!canManage || busy || !draft.name.trim()) return;
    setBusy(true);
    setError("");
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      order: Number.isFinite(Number(draft.order)) ? Number(draft.order) : 0,
      is_active: Boolean(draft.is_active),
    };
    try {
      if (draft.id) {
        await apiRequest({
          method: "PUT",
          url: `${API()}${draft.id}/`,
          data: payload,
        });
        pushToast("Department updated");
      } else {
        await apiRequest({ method: "POST", url: API(), data: payload });
        pushToast("Department created");
      }
      setEditorOpen(false);
      setDraft(blankDraft());
      await loadDepartments();
    } catch (err) {
      setError(errorMessage(err, "Could not save department."));
    } finally {
      setBusy(false);
    }
  };

  const deactivateDepartment = async () => {
    if (!canManage || !deactivateTarget || busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest({
        method: "DELETE",
        url: `${API()}${deactivateTarget.id}/`,
      });
      pushToast("Department deactivated");
      setDeactivateTarget(null);
      await loadDepartments();
    } catch (err) {
      setError(errorMessage(err, "Could not deactivate department."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        gap={1.5}
      >
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <BusinessIcon color="action" />
            <Typography variant="h5" fontWeight={800}>Departments</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Manage support departments and routing metadata. Ticket assignments and department membership are left untouched.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          {canManage && (
            <DryCreateButton onClick={openCreate} disabled={busy}>
              Create department
            </DryCreateButton>
          )}
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={15} /> : <RefreshIcon />}
            onClick={() => void loadDepartments()}
            disabled={loading || busy}
            sx={{ borderRadius: 0, textTransform: "none" }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      {!canManage && (
        <Alert severity="info" variant="outlined">
          You can view departments assigned to you. Managing department metadata requires <code>departments.manage</code>.
        </Alert>
      )}

      <DryPanel sx={{ overflow: "hidden" }}>
        {loading && !departments.length ? (
          <DryEmptyState>
            <CircularProgress size={18} sx={{ mr: 1 }} />
            Loading departments…
          </DryEmptyState>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Box
              component="table"
              sx={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}
            >
              <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                <tr>
                  <DryTh>Department</DryTh>
                  <DryTh>Slug</DryTh>
                  <DryTh align="center">Status</DryTh>
                  <DryTh align="right">Staff</DryTh>
                  <DryTh align="right">Open tickets</DryTh>
                  <DryTh align="right">Total tickets</DryTh>
                  <DryTh align="right">Order</DryTh>
                  {canManage && <DryTh align="right">Actions</DryTh>}
                </tr>
              </Box>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id} style={{ borderTop: DRY_BORDER_LIGHT }}>
                    <DryTd>
                      <Box sx={{ minWidth: 140, maxWidth: 280 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {department.name || "Untitled department"}
                        </Typography>
                        {department.description && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {department.description}
                          </Typography>
                        )}
                      </Box>
                    </DryTd>
                    <DryTd>
                      <Typography variant="caption" fontFamily="monospace">
                        {department.slug || "—"}
                      </Typography>
                    </DryTd>
                    <DryTd align="center">
                      <Chip
                        size="small"
                        label={department.is_active ? "Active" : "Inactive"}
                        color={department.is_active ? "success" : "default"}
                        sx={{ height: 20, borderRadius: 0, fontSize: 10 }}
                      />
                    </DryTd>
                    <DryTd align="right">{department.staff_count ?? "—"}</DryTd>
                    <DryTd align="right">{department.open_tickets ?? "—"}</DryTd>
                    <DryTd align="right">{department.total_tickets ?? "—"}</DryTd>
                    <DryTd align="right">{department.order ?? 0}</DryTd>
                    {canManage && (
                      <DryTd align="right">
                        <Stack direction="row" justifyContent="flex-end" gap={0.25}>
                          <Tooltip title="Edit department">
                            <IconButton size="small" onClick={() => openEdit(department)} disabled={busy}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {department.is_active && (
                            <Tooltip title="Deactivate department">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeactivateTarget(department)}
                                disabled={busy}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </DryTd>
                    )}
                  </tr>
                ))}
                {!departments.length && !loading && (
                  <tr>
                    <DryTd colSpan={canManage ? 8 : 7} align="center">
                      No departments found.
                    </DryTd>
                  </tr>
                )}
              </tbody>
            </Box>
          </Box>
        )}
      </DryPanel>

      <Alert severity="info" variant="outlined">
        Adding or removing department members and changing manager roles remains a superuser-only operation; this panel intentionally manages metadata only.
      </Alert>

      <Dialog
        open={editorOpen}
        onClose={() => { if (!busy) setEditorOpen(false); }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{draft.id ? "Edit department" : "Create department"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              required
              autoFocus
              fullWidth
              inputProps={{ maxLength: 100 }}
              helperText="The URL slug is generated by the backend and cannot be edited here."
            />
            <TextField
              label="Description"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              fullWidth
              multiline
              minRows={3}
            />
            <TextField
              label="Display order"
              type="number"
              value={draft.order}
              onChange={(event) => setDraft((current) => ({ ...current, order: event.target.value }))}
              inputProps={{ min: 0, step: 1 }}
              fullWidth
            />
            <FormControlLabel
              control={(
                <Switch
                  checked={Boolean(draft.is_active)}
                  onChange={(event) => setDraft((current) => ({ ...current, is_active: event.target.checked }))}
                />
              )}
              label="Department active"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void saveDepartment()}
            disabled={!draft.name.trim() || busy}
          >
            {busy ? "Saving…" : draft.id ? "Save changes" : "Create department"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        title="Deactivate department?"
        message={`“${deactivateTarget?.name || "This department"}” will be hidden from active department workflows. Existing tickets remain in place.`}
        confirmLabel="Deactivate"
        confirmColor="error"
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => void deactivateDepartment()}
      />
    </Stack>
  );
}
