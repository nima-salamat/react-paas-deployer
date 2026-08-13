import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, InputLabel, MenuItem, Pagination, Select, Stack,
  TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import apiRequest from "../../customHooks/apiRequest";
import {
  plansAdminApi, hasAnyRule,
  PLAN_NAME_CHOICES, PLAN_PLATFORM_CHOICES, PLAN_TYPE_CHOICES,
  STORAGE_TYPE_CHOICES, PLAN_NAME_COLORS,
} from "../adminUtils";
import PermissionGate from "../components/PermissionGate";
import { useToast } from "../components/ToastContext";

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  name: "Bronze",
  platform: "python",
  plan_type: "APP",
  max_cpu: 1,
  max_ram: 512,
  max_storage: 10,
  price_per_hour: 0,
  storage_type: "HDD",
};

export default function PlansPanel() {
  const pushToast = useToast();
  const canManage = hasAnyRule("plans.manage");
  const API = useMemo(() => plansAdminApi(), []);

  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [planType, setPlanType] = useState("");
  const [loading, setLoading] = useState(false);

  const [edit, setEdit] = useState(null); // null | {} for create | plan obj
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (search) params.q = search;
      if (platform) params.platform = platform;
      if (planType) params.plan_type = planType;
      const res = await apiRequest({ method: "GET", url: `${API}/`, params });
      const data = res.data || {};
      setList(data.results || data.data || data || []);
      setCount(typeof data.count === "number" ? data.count : (data.results || []).length);
    } catch (e) {
      setList([]);
      pushToast(e?.response?.data?.message || e?.response?.data?.detail || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [API, page, search, platform, planType, pushToast]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEdit({});
  };

  const openEdit = (p) => {
    setForm({
      name: p.name || "Bronze",
      platform: p.platform || "python",
      plan_type: p.plan_type || "APP",
      max_cpu: p.max_cpu ?? 1,
      max_ram: p.max_ram ?? 512,
      max_storage: p.max_storage ?? 10,
      price_per_hour: p.price_per_hour ?? 0,
      storage_type: p.storage_type || "HDD",
    });
    setEdit(p);
  };

  const closeDialog = () => {
    if (busy) return;
    setEdit(null);
  };

  const save = async () => {
    if (!form.name || !form.platform) {
      pushToast("Name and platform are required");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        platform: form.platform,
        plan_type: form.plan_type,
        max_cpu: Number(form.max_cpu),
        max_ram: Number(form.max_ram),
        max_storage: Number(form.max_storage),
        price_per_hour: Number(form.price_per_hour),
        storage_type: form.storage_type,
      };
      if (edit?.id) {
        await apiRequest({ method: "PATCH", url: `${API}/${edit.id}/`, data: payload });
        pushToast("Plan updated");
      } else {
        await apiRequest({ method: "POST", url: `${API}/`, data: payload });
        pushToast("Plan created");
      }
      setEdit(null);
      load();
    } catch (e) {
      const d = e?.response?.data;
      pushToast(d?.message || d?.detail || (d?.errors ? JSON.stringify(d.errors) : "Save failed"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await apiRequest({ method: "DELETE", url: `${API}/${deleteTarget.id}/` });
      pushToast(`Plan deleted: ${deleteTarget.name} / ${deleteTarget.platform}`);
      setDeleteTarget(null);
      // If deleting last row of current page, go back a page
      if (list.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (e) {
      pushToast(e?.response?.data?.message || e?.response?.data?.detail || "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const numPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));

  return (
    <PermissionGate anyOf={["plans.view", "plans.manage"]}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} mb={2}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Plans</Typography>
          <Typography variant="body2" color="text.secondary">
            Resource tiers offered to services. {canManage ? "Full CRUD enabled." : "Read-only — you need plans.manage to edit."}
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Refresh</Button>
          {canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>New plan</Button>
          )}
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} gap={2} mb={2}>
        <TextField size="small" label="Search name / platform" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} fullWidth />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Platform</InputLabel>
          <Select label="Platform" value={platform} onChange={(e) => { setPlatform(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {PLAN_PLATFORM_CHOICES.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={planType} onChange={(e) => { setPlanType(e.target.value); setPage(1); }}>
            <MenuItem value="">All</MenuItem>
            {PLAN_TYPE_CHOICES.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Box sx={{ overflowX: "auto" }}>
        {loading && !list.length ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : (
          <PlansTable
            rows={list}
            canManage={canManage}
            onEdit={openEdit}
            onDelete={(p) => setDeleteTarget(p)}
          />
        )}
      </Box>

      {numPages > 1 && (
        <Box display="flex" justifyContent="center" p={2}>
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

      {/* Create / Edit dialog */}
      <Dialog open={Boolean(edit)} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{edit?.id ? "Edit plan" : "Create plan"}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <FormControl size="small" fullWidth>
              <InputLabel>Name</InputLabel>
              <Select label="Name" value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}>
                {PLAN_NAME_CHOICES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Platform</InputLabel>
              <Select label="Platform" value={form.platform}
                onChange={(e) => setForm((s) => ({ ...s, platform: e.target.value }))}>
                {PLAN_PLATFORM_CHOICES.map((c) => (
                  <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Plan type</InputLabel>
                <Select label="Plan type" value={form.plan_type}
                  onChange={(e) => setForm((s) => ({ ...s, plan_type: e.target.value }))}>
                  {PLAN_TYPE_CHOICES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Storage type</InputLabel>
                <Select label="Storage type" value={form.storage_type}
                  onChange={(e) => setForm((s) => ({ ...s, storage_type: e.target.value }))}>
                  {STORAGE_TYPE_CHOICES.map((c) => (
                    <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField size="small" type="number" label="Max CPU (vCPU)" value={form.max_cpu}
                onChange={(e) => setForm((s) => ({ ...s, max_cpu: e.target.value }))} fullWidth />
              <TextField size="small" type="number" label="Max RAM (MB)" value={form.max_ram}
                onChange={(e) => setForm((s) => ({ ...s, max_ram: e.target.value }))} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={2}>
              <TextField size="small" type="number" label="Max storage (GB)" value={form.max_storage}
                onChange={(e) => setForm((s) => ({ ...s, max_storage: e.target.value }))} fullWidth />
              <TextField size="small" type="number" label="Price / hour (Toman)" value={form.price_per_hour}
                onChange={(e) => setForm((s) => ({ ...s, price_per_hour: e.target.value }))} fullWidth />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {busy ? "Saving…" : edit?.id ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !busy && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete plan?</DialogTitle>
        <DialogContent>
          <Stack gap={1}>
            <Typography>
              You are about to permanently delete plan:
            </Typography>
            <Box sx={{ p: 1.5, bgcolor: "action.hover", fontFamily: "monospace", fontSize: 13 }}>
              {deleteTarget?.name} / {deleteTarget?.platform}
            </Box>
            <Typography variant="caption" color="error">
              If any service is still assigned to this plan, the backend will refuse the delete.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={busy}>Cancel</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={busy}>
            {busy ? "Deleting…" : "Delete plan"}
          </Button>
        </DialogActions>
      </Dialog>
    </PermissionGate>
  );
}

// ─── Inline table component ─────────────────────────────────────────────────
function PlansTable({ rows, canManage, onEdit, onDelete }) {
  if (!rows.length) {
    return (
      <Box sx={{ p: 4, textAlign: "center", border: 1, borderColor: "divider" }}>
        <Typography color="text.secondary">No plans registered</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ border: 1, borderColor: "divider", overflow: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
        <Box component="thead" sx={{ bgcolor: "action.hover" }}>
          <tr>
            <Th>Name</Th>
            <Th>Platform</Th>
            <Th>Type</Th>
            <Th align="right">CPU</Th>
            <Th align="right">RAM</Th>
            <Th align="right">Storage</Th>
            <Th align="right">Storage type</Th>
            <Th align="right">Price/h</Th>
            <Th align="right">Price/day</Th>
            <Th align="right">Actions</Th>
          </tr>
        </Box>
        <tbody>
          {rows.map((r) => {
            const priceDay = Number(r.price_per_hour || 0) * 24;
            return (
              <tr key={r.id} style={{ borderTop: "1px solid", borderTopColor: "rgba(127,127,127,0.18)" }}>
                <Td>
                  <Chip
                    size="small"
                    label={r.name}
                    sx={{
                      bgcolor: PLAN_NAME_COLORS[r.name] || "#3b82f6",
                      color: "#fff",
                      fontWeight: 700,
                      height: 20,
                      fontSize: 11,
                    }}
                  />
                </Td>
                <Td><Typography variant="caption" fontWeight={600}>{r.platform}</Typography></Td>
                <Td>{r.plan_type}</Td>
                <Td align="right">{r.max_cpu}</Td>
                <Td align="right">{Number(r.max_ram).toLocaleString()} MB</Td>
                <Td align="right">{r.max_storage} GB</Td>
                <Td align="right">{r.storage_type}</Td>
                <Td align="right">{Number(r.price_per_hour).toLocaleString()}</Td>
                <Td align="right">{priceDay.toLocaleString()}</Td>
                <Td align="right">
                  {canManage ? (
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(r)}>Edit</Button>
                      <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => onDelete(r)}>Delete</Button>
                    </Stack>
                  ) : "—"}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Box>
    </Box>
  );
}

function Th({ children, align = "left" }) {
  return (
    <Box
      component="th"
      sx={{
        textAlign: align,
        padding: "10px 12px",
        fontWeight: 700,
        fontSize: 12,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        borderBottom: 1,
        borderBottomColor: "divider",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}

function Td({ children, align = "left" }) {
  return (
    <Box
      component="td"
      sx={{
        textAlign: align,
        padding: "10px 12px",
        fontSize: 13,
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
    >
      {children}
    </Box>
  );
}
