import React, { useState, useMemo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  TextField,
  Chip,
  Alert,
  CircularProgress,
  MenuItem,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Switch,
  FormControlLabel,
  Radio,
  Collapse,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import AddIcon from "@mui/icons-material/Add";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MemoryIcon from "@mui/icons-material/Memory";
import SdStorageIcon from "@mui/icons-material/SdStorage";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import EditIcon from "@mui/icons-material/Edit";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle, action }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 1,
        flexWrap: "wrap",
        mb: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: (t) =>
              t.palette.mode === "dark"
                ? "rgba(59,130,246,0.15)"
                : "rgba(59,130,246,0.1)",
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>
      {action}
    </Box>
  );
}

function StorageQuotaBar({ storage }) {
  if (!storage) return null;
  const quota = Number(storage.quota_mb) || 0;
  const used = Number(storage.used_mb) || 0;
  const remaining = Number(storage.remaining_mb) || 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const color = pct >= 95 ? "error" : pct >= 80 ? "warning" : "primary";

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2, borderColor: "divider" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Plan storage quota
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {used.toLocaleString()} / {quota.toLocaleString()} MB
          {quota ? ` (${pct}%)` : ""}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 1, mb: 0.75 }}
      />
      <Typography variant="caption" color="text.secondary">
        Remaining: <strong>{remaining.toLocaleString()} MB</strong>
        {storage.quota_gb != null ? ` · Plan limit ${storage.quota_gb} GB` : ""}
        {" · Volumes are exclusive to this service."}
      </Typography>
    </Paper>
  );
}

function PlanCard({ plan, selected, isCurrent, onSelect, onClearSelection }) {
  const handleClick = () => {
    if (isCurrent) { onClearSelection?.(); return; }
    onSelect?.(plan);
  };
  return (
    <Paper
      elevation={0}
      onClick={handleClick}
      sx={{
        p: 2, borderRadius: 2, border: "2px solid", cursor: "pointer",
        borderColor: isCurrent ? "success.main" : selected ? "primary.main" : "divider",
        bgcolor: (t) =>
          isCurrent
            ? t.palette.mode === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.06)"
            : selected
            ? t.palette.mode === "dark" ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.05)"
            : t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "#fff",
        transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
        "&:hover": {
          borderColor: isCurrent ? "success.main" : selected ? "primary.main" : "primary.light",
          boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
        },
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{plan.name || "Plan"}</Typography>
        {isCurrent ? (
          <Chip icon={<CheckCircleIcon sx={{ fontSize: 16 }} />} label="Current" color="success" size="small" sx={{ fontWeight: 700, height: 24 }} />
        ) : (
          <Radio checked={selected && !isCurrent} size="small" color="primary" sx={{ p: 0 }} />
        )}
      </Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1.25 }}>
        {plan.platform && <Chip label={plan.platform} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
        {plan.plan_type && <Chip label={plan.plan_type} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
        {plan.storage_type && <Chip label={plan.storage_type} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
      </Stack>
      <Stack spacing={0.5}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <MemoryIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="body2" color="text.secondary">
            CPU <strong>{plan.max_cpu ?? "—"}</strong>{" · "}RAM <strong>{plan.max_ram ?? "—"}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <SdStorageIcon sx={{ fontSize: 16, color: "text.secondary" }} />
          <Typography variant="body2" color="text.secondary">
            Storage <strong>{plan.max_storage ?? "—"} GB</strong>
          </Typography>
        </Box>
      </Stack>
      {plan.price_per_hour != null && (
        <Typography variant="body2" sx={{ mt: 1.25, fontWeight: 800, color: "primary.main" }}>
          {plan.price_per_hour} / hour
        </Typography>
      )}
    </Paper>
  );
}

function NetworkCard({ network, isAttached, onAttach, onDetach, loading }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5, borderRadius: 2,
        borderColor: isAttached ? "info.main" : "divider",
        bgcolor: (t) => isAttached
          ? t.palette.mode === "dark" ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.05)"
          : "transparent",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{network.name || network.id}</Typography>
          {isAttached && <Chip label="Attached" size="small" color="info" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />}
        </Stack>
        {network.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            {network.description}
          </Typography>
        )}
      </Box>
      {isAttached ? (
        <Button size="small" color="warning" variant="outlined" startIcon={<LinkOffIcon />} disabled={loading} onClick={onDetach} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
          Detach
        </Button>
      ) : (
        <Button size="small" variant="contained" startIcon={<LinkIcon />} disabled={loading} onClick={() => onAttach(network)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}>
          Attach
        </Button>
      )}
    </Paper>
  );
}

// ─── Enhanced VolumeCard ───────────────────────────────────────────────────
function VolumeCard({ volume, isAttached, onAttach, onDetach, onDelete, onViewFiles, onDownload, loading, remainingMb }) {
  const size = Number(volume.size_mb) || 0;
  const exceeds = !isAttached && remainingMb != null && size > remainingMb;
  const bind = volume.bind || volume.default_bind || "—";
  const mode = volume.mode || volume.default_mode || "rw";

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75, borderRadius: 2,
        borderColor: isAttached ? "success.main" : exceeds ? "error.light" : "divider",
        bgcolor: (t) => isAttached
          ? t.palette.mode === "dark" ? "rgba(34,197,94,0.08)" : "rgba(34,197,94,0.05)"
          : "transparent",
      }}
    >
      {/* Header row */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{volume.name}</Typography>
            {isAttached
              ? <Chip label="Attached" size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
              : <Chip label="Available" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
            {exceeds && <Chip label="Exceeds quota" size="small" color="error" sx={{ height: 20, fontSize: 11 }} />}
          </Stack>

          <Stack direction="row" spacing={1.5} sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
            {volume.size_mb != null && (
              <Typography variant="caption" color="text.secondary">
                <strong>{volume.size_mb} MB</strong>
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {bind}
            </Typography>
            <Chip label={mode} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          </Stack>
        </Box>

        {/* Action buttons */}
        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0}>
          <Tooltip title="View files">
            <span>
              <IconButton size="small" onClick={() => onViewFiles?.(volume)} disabled={loading}>
                <FolderOpenIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download archive">
            <span>
              <IconButton size="small" onClick={() => onDownload?.(volume)} disabled={loading}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {isAttached ? (
            <Tooltip title="Detach from this service">
              <span>
                <IconButton size="small" color="warning" disabled={loading} onClick={() => onDetach(volume.id ?? volume.pk)}>
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Button
              size="small"
              variant="contained"
              startIcon={<LinkIcon />}
              disabled={loading || exceeds}
              onClick={() => onAttach(volume)}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
            >
              Attach
            </Button>
          )}

          <Tooltip title="Delete volume">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={loading || isAttached}
                onClick={() => onDelete?.(volume)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Box>
    </Paper>
  );
}

// ─── Files Dialog ─────────────────────────────────────────────────────────
function FilesDialog({ open, onClose, volumeName, files, loading, error }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 2.5 } }}>
      <DialogTitle sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
        <FolderOpenIcon color="primary" />
        Files — {volumeName || "volume"}
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ py: 5, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={28} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        ) : files.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <InsertDriveFileIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary">No files in this volume.</Typography>
          </Box>
        ) : (
          <Stack spacing={0.5} sx={{ mt: 0.5 }}>
            {files.map((item, index) => (
              <Paper
                key={`${item.path}-${index}`}
                variant="outlined"
                sx={{ px: 1.5, py: 1, borderRadius: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}
              >
                <InsertDriveFileIcon sx={{ fontSize: 16, color: "text.secondary", flexShrink: 0 }} />
                <Typography
                  variant="body2"
                  sx={{ fontFamily: "monospace", flex: 1, wordBreak: "break-all" }}
                >
                  {item.path || "./"}
                </Typography>
                <Chip label={item.type || "file"} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                {item.size != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {item.size >= 1024 * 1024
                      ? `${(item.size / 1024 / 1024).toFixed(1)} MB`
                      : item.size >= 1024
                      ? `${(item.size / 1024).toFixed(1)} KB`
                      : `${item.size} B`}
                  </Typography>
                )}
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─────────────────────────────────────────────
// Main SettingsPanel
// ─────────────────────────────────────────────

export default function SettingsPanel({
  service,
  planDetail,
  networkName,
  networkDetail,
  selectedNetworkId,
  setSelectedNetworkId,
  availableNetworks,
  networkActionLoading,
  onAttachNetwork,
  onDetachNetwork,
  onCreateNetwork,
  attachedVolumes,
  availableVolumes,
  selectedVolumeId,
  setSelectedVolumeId,
  volumeActionLoading,
  onAttachVolume,
  onDetachVolume,
  onCreateVolume,
  onDeleteVolume,
  onViewVolumeFiles,
  onDownloadVolume,
  availablePlans,
  plansLoading,
  selectedPlanId,
  setSelectedPlanId,
  planActionLoading,
  onApplyPlan,
  error,
  successMessage,
}) {
  // Network dialog
  const [createNetworkOpen, setCreateNetworkOpen] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState("");
  const [newNetworkDesc, setNewNetworkDesc] = useState("");
  const [creatingNetwork, setCreatingNetwork] = useState(false);

  // Volume create dialog
  const [createVolumeOpen, setCreateVolumeOpen] = useState(false);
  const [newVolumeName, setNewVolumeName] = useState("");
  const [newVolumeSize, setNewVolumeSize] = useState("1024");
  const [newVolumeBind, setNewVolumeBind] = useState("/data");
  const [newVolumeMode, setNewVolumeMode] = useState("rw");
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [createVolumeError, setCreateVolumeError] = useState(null);

  // Files dialog state
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [filesDialogTitle, setFilesDialogTitle] = useState("");
  const [filesDialogList, setFilesDialogList] = useState([]);
  const [filesDialogLoading, setFilesDialogLoading] = useState(false);
  const [filesDialogError, setFilesDialogError] = useState(null);

  // Delete confirm dialog
  const [deleteVolumeDialog, setDeleteVolumeDialog] = useState({ open: false, volume: null, loading: false });

  // UI toggles
  const [applyImmediately, setApplyImmediately] = useState(false);
  const [showAllNetworks, setShowAllNetworks] = useState(false);
  const [showAvailableVolumes, setShowAvailableVolumes] = useState(true);

  // ── Storage quota ──────────────────────────────────────────────────────
  const storage = useMemo(() => {
    return (
      service?.storage ||
      (planDetail?.max_storage != null
        ? {
            quota_mb: Math.round(Number(planDetail.max_storage) * 1024),
            used_mb: (attachedVolumes || []).reduce((s, v) => s + (Number(v.size_mb) || 0), 0),
            remaining_mb: 0,
            quota_gb: Number(planDetail.max_storage),
          }
        : null)
    );
  }, [service, planDetail, attachedVolumes]);

  const storageNormalized = useMemo(() => {
    if (!storage) return null;
    const quota = Number(storage.quota_mb) || 0;
    const used = Number(storage.used_mb) || 0;
    const remaining = storage.remaining_mb != null ? Number(storage.remaining_mb) : Math.max(0, quota - used);
    return { ...storage, remaining_mb: remaining };
  }, [storage]);

  const remainingMb = storageNormalized?.remaining_mb ?? null;

  // ── Plan helpers ───────────────────────────────────────────────────────
  const currentPlatform = useMemo(() => {
    const raw = planDetail?.platform ?? service?.plan?.platform ?? service?.plan_detail?.platform ?? "";
    return String(raw || "").toLowerCase().trim();
  }, [planDetail, service]);

  const currentPlanId = useMemo(() => {
    const candidates = [
      planDetail?.id, planDetail?.pk,
      service?.plan?.id, service?.plan?.pk,
      typeof service?.plan === "string" || typeof service?.plan === "number" ? service.plan : null,
    ];
    for (const c of candidates) {
      if (c != null && String(c).trim() !== "") return String(c);
    }
    return "";
  }, [planDetail, service]);

  const samePlatformPlans = useMemo(() => {
    if (!Array.isArray(availablePlans)) return [];
    if (!currentPlatform) return availablePlans;
    return availablePlans.filter((p) => String(p.platform || "").toLowerCase().trim() === currentPlatform);
  }, [availablePlans, currentPlatform]);

  const currentNetworkId = useMemo(() => {
    return String(
      service?.network?.id ?? service?.network?.pk ?? service?.network ??
      networkDetail?.id ?? networkDetail?.pk ?? ""
    );
  }, [service, networkDetail]);

  // ── Network handlers ───────────────────────────────────────────────────
  const handleCreateNetwork = async () => {
    if (!newNetworkName.trim()) return;
    setCreatingNetwork(true);
    try {
      await onCreateNetwork?.({ name: newNetworkName.trim(), description: newNetworkDesc.trim() });
      setCreateNetworkOpen(false);
      setNewNetworkName("");
      setNewNetworkDesc("");
    } finally {
      setCreatingNetwork(false);
    }
  };

  // ── Volume handlers ────────────────────────────────────────────────────
  const handleCreateVolume = async () => {
    setCreateVolumeError(null);
    if (!newVolumeName.trim()) return;
    const size = Number(newVolumeSize);
    if (!Number.isFinite(size) || size <= 0) { setCreateVolumeError("Size must be a positive number (MB)."); return; }
    const bind = String(newVolumeBind || "").trim();
    if (!bind) { setCreateVolumeError("Bind directory is required."); return; }
    if (remainingMb != null && size > remainingMb) {
      setCreateVolumeError(`Not enough storage. Requested ${size} MB, remaining ${remainingMb} MB.`);
      return;
    }
    setCreatingVolume(true);
    try {
      await onCreateVolume?.({
        name: newVolumeName.trim(),
        size_mb: size,
        default_bind: bind,
        default_mode: newVolumeMode || "rw",
        service: service?.id ?? service?.pk ?? undefined,
      });
      setCreateVolumeOpen(false);
      setNewVolumeName(""); setNewVolumeSize("1024"); setNewVolumeBind("/data"); setNewVolumeMode("rw");
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.size_mb ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        "Unable to create volume.";
      setCreateVolumeError(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
      throw err;
    } finally {
      setCreatingVolume(false);
    }
  };

  const handleViewFiles = useCallback(async (volume) => {
    setFilesDialogTitle(volume.name || "volume");
    setFilesDialogList([]);
    setFilesDialogError(null);
    setFilesDialogLoading(true);
    setFilesDialogOpen(true);
    try {
      const result = await onViewVolumeFiles?.(volume);
      setFilesDialogList(Array.isArray(result) ? result : []);
    } catch (err) {
      setFilesDialogError(err?.response?.data?.detail || err?.message || "Unable to load files.");
    } finally {
      setFilesDialogLoading(false);
    }
  }, [onViewVolumeFiles]);

  const handleDeleteVolume = useCallback((volume) => {
    setDeleteVolumeDialog({ open: true, volume, loading: false });
  }, []);

  const confirmDeleteVolume = useCallback(async () => {
    const volume = deleteVolumeDialog.volume;
    if (!volume) return;
    setDeleteVolumeDialog((d) => ({ ...d, loading: true }));
    try {
      await onDeleteVolume?.(volume);
    } finally {
      setDeleteVolumeDialog({ open: false, volume: null, loading: false });
    }
  }, [deleteVolumeDialog.volume, onDeleteVolume]);

  // ─────────────────────────────────────────────────────────────────────
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ borderRadius: 2 }}>{successMessage}</Alert>}

      {/* ═══════════════ NETWORK ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<HubIcon fontSize="small" />}
          title="Network"
          subtitle="One private network can be attached to this service."
          action={
            <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setCreateNetworkOpen(true)} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
              New
            </Button>
          }
        />

        {/* Currently attached */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5, mb: 2, borderRadius: 2,
            borderColor: currentNetworkId ? "info.main" : "divider",
            bgcolor: (t) => currentNetworkId
              ? t.palette.mode === "dark" ? "rgba(6,182,212,0.08)" : "rgba(6,182,212,0.05)"
              : t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "grey.50",
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Currently attached</Typography>
              <Typography variant="body1" sx={{ fontWeight: 800 }}>
                {networkName && networkName !== "—" ? networkName : "No network"}
              </Typography>
            </Box>
            {currentNetworkId && (
              <Button size="small" color="warning" variant="outlined" startIcon={<LinkOffIcon />} disabled={networkActionLoading} onClick={onDetachNetwork} sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}>
                Detach
              </Button>
            )}
          </Stack>
        </Paper>

        <Button
          size="small"
          endIcon={showAllNetworks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAllNetworks((v) => !v)}
          sx={{ mb: 1, textTransform: "none", fontWeight: 600 }}
        >
          {showAllNetworks ? "Hide networks" : `Show all networks (${(availableNetworks || []).length})`}
        </Button>

        <Collapse in={showAllNetworks}>
          <Stack spacing={1}>
            {(availableNetworks || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No networks yet. Create one with the New button.</Typography>
            ) : (
              (availableNetworks || []).map((n) => {
                const nid = String(n.id ?? n.pk ?? "");
                return (
                  <NetworkCard
                    key={nid}
                    network={n}
                    isAttached={nid && nid === currentNetworkId}
                    loading={networkActionLoading}
                    onDetach={onDetachNetwork}
                    onAttach={() => onAttachNetwork?.(nid)}
                  />
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ═══════════════ VOLUMES ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<StorageIcon fontSize="small" />}
          title="Volumes"
          subtitle="Exclusive storage for this service. Volumes are not shareable."
          action={
            <Button
              size="small" startIcon={<AddIcon />} variant="outlined"
              onClick={() => { setCreateVolumeError(null); setCreateVolumeOpen(true); }}
              disabled={remainingMb != null && remainingMb <= 0}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
            >
              New
            </Button>
          }
        />

        <StorageQuotaBar storage={storageNormalized} />

        {/* Attached volumes */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Attached ({(attachedVolumes || []).length})
        </Typography>
        {(attachedVolumes || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No volumes attached to this service.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {(attachedVolumes || []).map((v) => (
              <VolumeCard
                key={v.id ?? v.pk}
                volume={v}
                isAttached
                loading={volumeActionLoading}
                onDetach={onDetachVolume}
                onDelete={handleDeleteVolume}
                onViewFiles={handleViewFiles}
                onDownload={onDownloadVolume}
                remainingMb={remainingMb}
              />
            ))}
          </Stack>
        )}

        {/* Available volumes */}
        <Button
          size="small"
          endIcon={showAvailableVolumes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAvailableVolumes((v) => !v)}
          sx={{ mb: 1, textTransform: "none", fontWeight: 600 }}
        >
          {showAvailableVolumes
            ? "Hide available volumes"
            : `Show available volumes (${(availableVolumes || []).length})`}
        </Button>

        <Collapse in={showAvailableVolumes}>
          <Stack spacing={1}>
            {(availableVolumes || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No unused volumes. Create one with the New button.
              </Typography>
            ) : (
              (availableVolumes || []).map((v) => {
                const vid = String(v.id ?? v.pk ?? "");
                return (
                  <VolumeCard
                    key={vid}
                    volume={v}
                    isAttached={false}
                    loading={volumeActionLoading}
                    onAttach={() => onAttachVolume?.(vid)}
                    onDelete={handleDeleteVolume}
                    onViewFiles={handleViewFiles}
                    onDownload={onDownloadVolume}
                    remainingMb={remainingMb}
                  />
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ═══════════════ PLAN ═══════════════ */}
      <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<SpeedIcon fontSize="small" />}
          title="Plan"
          subtitle={
            currentPlatform
              ? `Plans for platform "${currentPlatform}". Current plan cannot be re-selected.`
              : "Choose a plan for this service."
          }
        />

        {plansLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : samePlatformPlans.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No plans available for this platform.</Typography>
        ) : (
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1.5, mb: 2,
              }}
            >
              {samePlatformPlans.map((p) => {
                const pid = String(p.id ?? p.pk ?? "");
                const isCurrent = pid === currentPlanId;
                const isSelected = pid === String(selectedPlanId || "") && !isCurrent;
                return (
                  <PlanCard
                    key={pid}
                    plan={p}
                    isCurrent={isCurrent}
                    selected={isSelected}
                    onSelect={(plan) => setSelectedPlanId?.(String(plan.id ?? plan.pk))}
                    onClearSelection={() => setSelectedPlanId?.("")}
                  />
                );
              })}
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
              <FormControlLabel
                control={
                  <Switch
                    checked={applyImmediately}
                    onChange={(e) => setApplyImmediately(e.target.checked)}
                    size="small"
                    disabled={!selectedPlanId || String(selectedPlanId) === currentPlanId}
                  />
                }
                label={<Typography variant="body2">Apply immediately (redeploy if a deploy is selected)</Typography>}
              />
              <Button
                variant="contained" size="medium"
                disabled={!selectedPlanId || String(selectedPlanId) === currentPlanId || planActionLoading}
                onClick={() => onApplyPlan?.(selectedPlanId, applyImmediately)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, minWidth: 140, px: 3 }}
              >
                {planActionLoading ? "Applying..." : "Apply plan"}
              </Button>
            </Stack>
          </>
        )}
      </Paper>

      {/* ═══════════ Create Network Dialog ═══════════ */}
      <Dialog
        open={createNetworkOpen}
        onClose={() => !creatingNetwork && setCreateNetworkOpen(false)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create network</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField autoFocus fullWidth size="small" label="Name" value={newNetworkName} onChange={(e) => setNewNetworkName(e.target.value)} />
            <TextField fullWidth size="small" label="Description (optional)" value={newNetworkDesc} onChange={(e) => setNewNetworkDesc(e.target.value)} multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateNetworkOpen(false)} disabled={creatingNetwork} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateNetwork} disabled={!newNetworkName.trim() || creatingNetwork} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}>
            {creatingNetwork ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════ Create Volume Dialog ═══════════ */}
      <Dialog
        open={createVolumeOpen}
        onClose={() => !creatingVolume && setCreateVolumeOpen(false)}
        fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Create volume</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            {storageNormalized && (
              <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                Remaining quota: <strong>{storageNormalized.remaining_mb.toLocaleString()} MB</strong>
                {" "}(plan {storageNormalized.quota_gb ?? "—"} GB). This volume will be exclusive to this service.
              </Alert>
            )}
            {createVolumeError && <Alert severity="error" sx={{ borderRadius: 1.5 }}>{createVolumeError}</Alert>}
            <TextField
              autoFocus fullWidth size="small" label="Name" value={newVolumeName}
              onChange={(e) => setNewVolumeName(e.target.value)}
              helperText="Unique volume name"
            />
            <TextField
              fullWidth size="small" label="Size (MB)" type="number" value={newVolumeSize}
              onChange={(e) => setNewVolumeSize(e.target.value)}
              inputProps={{ min: 1, max: remainingMb != null ? remainingMb : undefined }}
              helperText={remainingMb != null ? `Max allowed by quota: ${remainingMb} MB` : undefined}
              error={remainingMb != null && Number(newVolumeSize) > remainingMb}
            />
            <TextField
              fullWidth size="small" label="Bind directory" value={newVolumeBind}
              onChange={(e) => setNewVolumeBind(e.target.value)}
              placeholder="/data"
              helperText="Path inside container (e.g. /data, /var/lib/mysql)"
            />
            <TextField
              select fullWidth size="small" label="Access mode" value={newVolumeMode}
              onChange={(e) => setNewVolumeMode(e.target.value)}
            >
              <MenuItem value="rw">Read-write (rw)</MenuItem>
              <MenuItem value="ro">Read-only (ro)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateVolumeOpen(false)} disabled={creatingVolume} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained" onClick={handleCreateVolume}
            disabled={
              !newVolumeName.trim() || !String(newVolumeBind || "").trim() || creatingVolume ||
              (remainingMb != null && Number(newVolumeSize) > remainingMb)
            }
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {creatingVolume ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ═══════════ Files Dialog ═══════════ */}
      <FilesDialog
        open={filesDialogOpen}
        onClose={() => setFilesDialogOpen(false)}
        volumeName={filesDialogTitle}
        files={filesDialogList}
        loading={filesDialogLoading}
        error={filesDialogError}
      />

      {/* ═══════════ Delete Confirm Dialog ═══════════ */}
      <Dialog open={deleteVolumeDialog.open} onClose={() => !deleteVolumeDialog.loading && setDeleteVolumeDialog({ open: false, volume: null, loading: false })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete volume</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>"{deleteVolumeDialog.volume?.name}"</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteVolumeDialog({ open: false, volume: null, loading: false })} disabled={deleteVolumeDialog.loading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={confirmDeleteVolume} disabled={deleteVolumeDialog.loading} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}>
            {deleteVolumeDialog.loading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}