import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import { LuCpu, LuDatabase, LuHardDrive, LuMemoryStick } from "react-icons/lu";
import VolumeIcon from "../../VolumeIcon.jsx";
import VolumeFilesDialog from "../../volumes/VolumeFilesDialog.jsx";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AddIcon from "@mui/icons-material/Add";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import LinkIcon from "@mui/icons-material/Link";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import EditIcon from "@mui/icons-material/Edit";
import { getApiErrorMessage } from "../errorUtils";

function normalizePlanPlatform(value) {
  const raw = value && typeof value === "object"
    ? value.key ?? value.value ?? value.code ?? value.name ?? value.label ?? value.platform ?? ""
    : value;
  const normalized = String(raw || "").toLowerCase().trim().replace(/[\s_]+/g, "-");
  return ["docker-swarm", "swarm", "docker-engine", "docker-engine-swarm"].includes(normalized)
    ? "docker"
    : normalized;
}

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
      <Stack spacing={0.65}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
          <LuCpu size={16} />
          <Typography variant="body2" color="text.secondary">
            CPU <strong>{plan.max_cpu ?? "—"}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
          <LuMemoryStick size={16} />
          <Typography variant="body2" color="text.secondary">
            RAM <strong>{plan.max_ram ?? "—"}</strong>
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary" }}>
          <LuHardDrive size={16} />
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

function VolumeCard({
  volume,
  isAttached,
  onAttach,
  onDetach,
  onDelete,
  onEdit,
  onViewFiles,
  onDownload,
  loading,
  remainingMb,
  canMutate,
  mutateReason,
  canAttach = canMutate,
  canDetach = canMutate,
  canDelete = canMutate,
}) {
  const size = Number(volume.size_mb) || 0;
  const exceeds = !isAttached && remainingMb != null && size > remainingMb;
  const bind = volume.bind || volume.default_bind || "—";
  const mode = volume.mode || volume.default_mode || "rw";
  const blocked = !canMutate;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderRadius: 2,
        borderColor: isAttached ? "success.main" : exceeds ? "error.light" : "divider",
        bgcolor: (t) =>
          isAttached
            ? t.palette.mode === "dark"
              ? "rgba(34,197,94,0.08)"
              : "rgba(34,197,94,0.05)"
            : "transparent",
        opacity: blocked ? 0.8 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {volume.name}
            </Typography>
            {isAttached ? (
              <Chip label="Attached" size="small" color="success" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            ) : (
              <Chip label="Available" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
            )}
            {exceeds && (
              <Chip label="Exceeds quota" size="small" color="error" sx={{ height: 20, fontSize: 11 }} />
            )}
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
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
            Edit is allowed only if this volume is not yet provisioned in Docker.
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} alignItems="center" flexShrink={0} flexWrap="wrap" useFlexGap>
          <Tooltip title={volume.docker_exists === true ? "Volume is already provisioned in Docker; metadata is locked." : blocked ? mutateReason || "Cannot edit now" : "Edit volume metadata"}>
            <span>
              <IconButton
                size="small"
                color="primary"
                disabled={loading || blocked || volume.docker_exists === true}
                onClick={() => onEdit?.(volume)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {onViewFiles && (
            <Tooltip title="View files">
              <span>
                <IconButton size="small" onClick={() => onViewFiles?.(volume)} disabled={loading}>
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onDownload && (
            <Tooltip title="Download archive">
              <span>
                <IconButton size="small" onClick={() => onDownload?.(volume)} disabled={loading}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

          {isAttached ? (
            <Tooltip title={blocked ? mutateReason || "Service busy — detach may fail" : "Detach"}>
              <span>
                <Button
                  size="small"
                  color="warning"
                  variant="outlined"
                  disabled={loading || !canDetach}
                  onClick={() => onDetach?.(volume.id ?? volume.pk, volume)}
                  startIcon={<LinkOffIcon fontSize="small" />}
                  sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
                >
                  Detach
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Tooltip
              title={
                blocked
                  ? mutateReason || "Cannot attach now"
                  : exceeds
                  ? "Exceeds plan storage"
                  : "Attach"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<LinkIcon />}
                  disabled={loading || exceeds || !canAttach}
                  onClick={() => onAttach(volume)}
                  sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
                >
                  Attach
                </Button>
              </span>
            </Tooltip>
          )}

          <Tooltip
            title={
              isAttached
                ? blocked
                  ? mutateReason || "Stop service & remove runtime, or detach first"
                  : "Delete mounted volume (service must be idle)"
                : "Delete volume permanently"
            }
          >
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={loading || !canDelete || (isAttached && !canDetach)}
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


// ─────────────────────────────────────────────
// Main SettingsPanel
// ─────────────────────────────────────────────

export default function SettingsPanel({
  onSectionChange,
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
  databaseBindings = [],
  databaseResources = [],
  catalogDatabaseDependencies = [],
  databaseLoading = false,
  databaseActionLoading = false,
  onBindDatabase,
  onUnbindDatabase,
  selectedVolumeId,
  setSelectedVolumeId,
  volumeActionLoading,
  onAttachVolume,
  onDetachVolume,
  onCreateVolume,
  onUpdateVolume,
  onDeleteVolume,
  onViewVolumeFiles,
  onDownloadVolume,
  canMutateVolumes = true,
  volumeMutateReason = "",
  volumeCapabilities = null,
  onPurgeRuntime,
  purgeRuntimeLoading = false,
  onDeleteService,
  deleteServiceLoading = false,
  availablePlans,
  plansLoading,
  plansError = "",
  onRefreshPlans,
  selectedPlanId,
  setSelectedPlanId,
  planActionLoading,
  onApplyPlan,
  error,
  successMessage,
}) {
  const navigate = useNavigate();

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

  // Edit volume dialog
  const [editVolumeOpen, setEditVolumeOpen] = useState(false);
  const [editingVolume, setEditingVolume] = useState(null);
  const [editVolumeForm, setEditVolumeForm] = useState({
    name: "",
    size_mb: "1024",
    default_bind: "/data",
    default_mode: "rw",
  });
  const [editingVolumeSaving, setEditingVolumeSaving] = useState(false);
  const [editVolumeError, setEditVolumeError] = useState(null);

  // Files dialog state
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [filesDialogTitle, setFilesDialogTitle] = useState("");
  const [filesDialogList, setFilesDialogList] = useState([]);
  const [filesDialogLoading, setFilesDialogLoading] = useState(false);
  const [filesDialogError, setFilesDialogError] = useState(null);

  // Delete confirm dialog
  const [deleteVolumeDialog, setDeleteVolumeDialog] = useState({ open: false, volume: null, loading: false });

  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [deleteServiceConfirmOpen, setDeleteServiceConfirmOpen] = useState(false);
  const [deleteServiceError, setDeleteServiceError] = useState(null);
  const [volumeActionError, setVolumeActionError] = useState(null);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState("");
  const [databaseAlias, setDatabaseAlias] = useState("default");
  const [databasePrefix, setDatabasePrefix] = useState("DB");
  const [databaseAccessMode, setDatabaseAccessMode] = useState("rw");
  const [databaseFormError, setDatabaseFormError] = useState(null);

  // Local mount overrides so Detach/Attach UI updates even if parent
  // keeps listing volumes only by service_id (soft-detach keeps ownership).
  // key = volume id string → true=mounted, false=soft-detached
  const [mountOverrides, setMountOverrides] = useState({});

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

  // Idle service ⇒ UI allows attach/detach; backend still enforces container absence.
  const serviceStatus = String(
    service?.status ??
      service?.deploy_status ??
      service?.state ??
      service?.service_status ??
      ""
  )
    .toLowerCase()
    .trim();
  const statusBusy = ["queued", "deploying", "stopping", "running", "pending", "updating..."].includes(
    serviceStatus
  );
  const effectiveCanMutate = Boolean(volumeCapabilities ? volumeCapabilities.mutable : canMutateVolumes) && !statusBusy;
  const canAttach = effectiveCanMutate && (volumeCapabilities ? volumeCapabilities.can_attach !== false : true);
  const canDetach = effectiveCanMutate && (volumeCapabilities ? volumeCapabilities.can_detach !== false : true);
  const canAdd = effectiveCanMutate && (volumeCapabilities ? volumeCapabilities.can_add !== false : true);
  const effectiveMutateReason = !effectiveCanMutate
    ? (volumeCapabilities?.reason || volumeMutateReason || "Volume changes are unavailable for the current service state.")
    : "";

  const serviceIdStr = String(
    service?.id ?? service?.pk ?? service?.uuid ?? ""
  );

  const volumeIdOf = (v) => String(v?.id ?? v?.pk ?? "");

  const isVolumeMounted = useCallback(
    (v) => {
      if (!v) return false;
      const id = volumeIdOf(v);
      // 1) Local override after attach/detach (survives parent re-fetch mistakes)
      if (Object.prototype.hasOwnProperty.call(mountOverrides, id)) {
        return !!mountOverrides[id];
      }
      // 2) Explicit API flag (authoritative from backend list)
      if (typeof v.is_mounted === "boolean") return v.is_mounted;
      // 3) service_attachments from API
      if (v.service_attachments != null && typeof v.service_attachments === "object") {
        const atts = v.service_attachments;
        if (Object.keys(atts).length === 0) return false;
        if (serviceIdStr && atts[serviceIdStr]) return true;
        return Object.keys(atts).length > 0;
      }
      // 4) Fallback: parent list membership
      const inAttached = (attachedVolumes || []).some((x) => volumeIdOf(x) === id);
      const inAvailable = (availableVolumes || []).some((x) => volumeIdOf(x) === id);
      if (inAttached && !inAvailable) return true;
      if (inAvailable && !inAttached) return false;
      return inAttached;
    },
    [mountOverrides, serviceIdStr, attachedVolumes, availableVolumes]
  );

  // Merge both lists; split by real mount state (not parent buckets)
  const { mountedList, unmountedList } = useMemo(() => {
    const map = new Map();
    for (const v of [...(attachedVolumes || []), ...(availableVolumes || [])]) {
      const id = volumeIdOf(v);
      if (!id) continue;
      map.set(id, v);
    }
    const all = [...map.values()];
    const mounted = [];
    const unmounted = [];
    for (const v of all) {
      if (isVolumeMounted(v)) mounted.push(v);
      else unmounted.push(v);
    }
    return { mountedList: mounted, unmountedList: unmounted };
  }, [attachedVolumes, availableVolumes, isVolumeMounted]);

  // ── Plan helpers ───────────────────────────────────────────────────────
  const currentPlatform = useMemo(() => normalizePlanPlatform(
    planDetail?.platform ??
    service?.plan?.platform ??
    service?.plan_detail?.platform ??
    ""
  ), [planDetail, service]);

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
    return availablePlans.filter((plan) => {
      const platform = normalizePlanPlatform(plan?.platform);
      // Some plan endpoints omit the platform label on otherwise valid plans.
      // Keep those visible instead of presenting a false empty state.
      return !platform || platform === currentPlatform;
    });
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
  const handleOpenEditVolume = (volume) => {
    setEditVolumeError(null);
    setEditingVolume(volume);
    setEditVolumeForm({
      name: volume?.name || "",
      size_mb: String(volume?.size_mb ?? 1024),
      default_bind: volume?.default_bind || volume?.bind || "/data",
      default_mode: volume?.default_mode || volume?.mode || "rw",
    });
    setEditVolumeOpen(true);
  };

  const handleSaveEditVolume = async () => {
    if (!editingVolume) return;
    setEditVolumeError(null);
    const n = editVolumeForm.name.trim();
    const bind = editVolumeForm.default_bind.trim();
    const size = Number(editVolumeForm.size_mb);
    if (!n) {
      setEditVolumeError("Name is required.");
      return;
    }
    if (!bind.startsWith("/")) {
      setEditVolumeError("Bind must be an absolute path, e.g. /data");
      return;
    }
    if (!size || size < 1) {
      setEditVolumeError("Valid size (MB) is required.");
      return;
    }
    setEditingVolumeSaving(true);
    try {
      await onUpdateVolume?.(editingVolume, {
        name: n,
        size_mb: size,
        default_bind: bind,
        default_mode: editVolumeForm.default_mode || "rw",
      });
      setEditVolumeOpen(false);
      setEditingVolume(null);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.errors ||
        err?.message ||
        "Unable to update volume. If it exists in Docker, fields are locked.";
      setEditVolumeError(getApiErrorMessage(err, "Unable to update the volume."));
    } finally {
      setEditingVolumeSaving(false);
    }
  };

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
      setCreateVolumeError(getApiErrorMessage(err, "Unable to create volume."));
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
      setFilesDialogError(getApiErrorMessage(err, "Unable to load volume files."));
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

  const handleConfirmPurgeRuntime = useCallback(async () => {
    try {
      await onPurgeRuntime?.();
    } finally {
      setPurgeConfirmOpen(false);
    }
  }, [onPurgeRuntime]);

  const handleConfirmDeleteService = useCallback(async () => {
    if (!onDeleteService) {
      setDeleteServiceError("Service deletion is not available from this page.");
      return;
    }
    setDeleteServiceError(null);
    try {
      await onDeleteService();
      setDeleteServiceConfirmOpen(false);
      navigate("/dashboard/services");
    } catch (err) {
      setDeleteServiceError(getApiErrorMessage(err, "Could not delete the service."));
    }
  }, [onDeleteService]);


  const handleDetachVolume = useCallback(
    async (id, volume) => {
      setVolumeActionError(null);
      const vid = String(id ?? volumeIdOf(volume) ?? "");
      if (!vid || vid === "undefined" || vid === "null") {
        setVolumeActionError("Detach failed because the volume id is missing.");
        return;
      }
      try {
        if (!onDetachVolume) {
          throw new Error(
            "onDetachVolume is not provided by parent. " +
              "Wire: onDetachVolume={(id) => api.post(`/volume/${id}/detach/`)}"
          );
        }
        const result = await onDetachVolume(vid, volume);
        if (result?.is_mounted === true) {
          throw new Error("Detach was not confirmed by the backend.");
        }
        setMountOverrides((prev) => ({ ...prev, [vid]: false }));
        return result;
      } catch (err) {
        console.error("detach error", err);
        setVolumeActionError(getApiErrorMessage(err, "Could not detach the volume."));
      }
    },
    [onDetachVolume]
  );

  const handleAttachVolume = useCallback(
    async (idOrVolume) => {
      setVolumeActionError(null);
      const vid =
        typeof idOrVolume === "object"
          ? volumeIdOf(idOrVolume)
          : String(idOrVolume ?? "");
      try {
        if (onAttachVolume) {
          await onAttachVolume(vid);
        } else {
          throw new Error("onAttachVolume is not provided by parent");
        }
        if (idOrVolume?.is_mounted === false) throw new Error("Attach was not confirmed by the backend.");
        setMountOverrides((prev) => ({ ...prev, [vid]: true }));
      } catch (err) {
        console.error(err);
        setVolumeActionError(getApiErrorMessage(err, "Could not attach the volume."));
        throw err;
      }
    },
    [onAttachVolume]
  );

  // ─────────────────────────────────────────────────────────────────────
  const SETTINGS_SECTION_IDS = ["network", "database", "volume", "plan", "danger-zone"];

  useEffect(() => {
    if (!onSectionChange || typeof IntersectionObserver === "undefined") return undefined;

    const nodes = SETTINGS_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!nodes.length) return undefined;

    let lastSection = "";
    try {
      const currentHash = decodeURIComponent(String(window.location.hash || "").replace(/^#/, ""));
      if (SETTINGS_SECTION_IDS.includes(currentHash)) {
        lastSection = currentHash;
      }
    } catch {
      /* keep empty */
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (!visible.length) return;

        const nextSection = visible[0].target.id;
        if (!nextSection || nextSection === lastSection) return;
        lastSection = nextSection;
        onSectionChange(nextSection);
      },
      {
        root: null,
        rootMargin: "-16% 0px -62% 0px",
        threshold: [0, 0.1],
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [onSectionChange]);

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
      {volumeActionError ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{volumeActionError}</Alert>
      ) : null}
      {successMessage && <Alert severity="success" sx={{ borderRadius: 2 }}>{successMessage}</Alert>}

      {/* ═══════════════ NETWORK ═══════════════ */}
      <Paper id="network" elevation={0} sx={{ scrollMarginTop: { xs: 12, md: 16 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
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

      {/* ═══════════════ DATABASES ═══════════════ */}
      <Paper id="database" elevation={0} sx={{ scrollMarginTop: { xs: 12, md: 16 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<LuDatabase size={18} />}
          title="Databases"
          subtitle="Choose a managed database resource or an existing database service. The backend checks ownership and private-network reachability; credentials stay in the backend secret store."
        />
        {databaseFormError ? <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{databaseFormError}</Alert> : null}
        {databaseLoading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}><CircularProgress size={28} /></Box>
        ) : (
          <Stack spacing={1.25}>
            {catalogDatabaseDependencies.length > 0 ? (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Database declared by this Ready App
                </Typography>
                <Stack spacing={1}>
                  {catalogDatabaseDependencies.map((database) => (
                    <Box key={database.service_id || database.service_key} sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          {database.name || database.service_key || "Database service"}
                        </Typography>
                        {database.engine ? (
                          <Chip size="small" label={database.engine} color="primary" variant="outlined" sx={{ height: 22 }} />
                        ) : null}
                        <Chip size="small" label="Ready App dependency" color="success" variant="outlined" sx={{ height: 22 }} />
                        {database.status ? (
                          <Chip size="small" label={database.status} variant="outlined" sx={{ height: 22 }} />
                        ) : null}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        Host alias: {database.host || database.service_key || "—"}
                        {database.port ? `:${database.port}` : ""}
                        {database.database_name ? ` · Database ${database.database_name}` : ""}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.25, lineHeight: 1.6 }}>
                  This connection is declared by the Ready App installation and is managed with that application. It is separate from optional managed bindings below; this panel does not test live database connectivity or reveal passwords.
                </Typography>
              </Paper>
            ) : null}
            {databaseBindings.length === 0 ? (
              <Alert severity={catalogDatabaseDependencies.length > 0 ? "success" : "info"} sx={{ borderRadius: 2 }}>
                {catalogDatabaseDependencies.length > 0
                  ? "This service has a database dependency configured by its Ready App. No separate managed binding is required for that declared connection."
                  : "No managed database binding is attached. Connections configured through the application runtime or a Ready App are separate and may already exist."}
              </Alert>
            ) : databaseBindings.map((binding) => (
              <Paper key={binding.id || `${binding.database}-${binding.alias}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{binding.database_name_runtime || binding.database_name || binding.database}</Typography>
                      {binding.engine ? <Chip size="small" label={binding.engine} color="primary" variant="outlined" sx={{ height: 22 }} /> : null}
                      {binding.status ? <Chip size="small" label={`Resource: ${binding.status}`} variant="outlined" sx={{ height: 22 }} /> : null}
                      {binding.binding_status === "configured_unverified" ? <Chip size="small" label="Binding saved · not tested" variant="outlined" sx={{ height: 22 }} /> : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      {binding.host || "managed"}{binding.port ? `:${binding.port}` : ""} · alias {binding.alias || "default"} · env prefix {binding.env_prefix || "DB"} · {String(binding.access_mode || "rw").toUpperCase()}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    color="warning"
                    variant="outlined"
                    disabled={databaseActionLoading || statusBusy}
                    startIcon={<LinkOffIcon />}
                    onClick={() => onUnbindDatabase?.(binding.alias)}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, flexShrink: 0 }}
                  >
                    Disconnect
                  </Button>
                </Stack>
              </Paper>
            ))}

            <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, bgcolor: "background.default" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Connect a database resource or service</Typography>
              {(databaseResources || []).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {catalogDatabaseDependencies.length > 0
                    ? "The database declared by this Ready App is shown above. No additional managed database resources or regular database services are available to attach."
                    : "No database resources or database services are available yet. Create a database service or register an external database resource first."}
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {(databaseResources || []).some((resource) => resource.resource_type === "database_service" && resource.connectable === false) ? (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      To use an existing database service, attach this service and the database service to the same private network first.
                    </Alert>
                  ) : null}
                  <TextField
                    select fullWidth size="small" label="Database resource or service"
                    value={selectedDatabaseId}
                    onChange={(e) => setSelectedDatabaseId(e.target.value)}
                    disabled={databaseActionLoading || statusBusy}
                  >
                    {(databaseResources || []).map((resource) => {
                      const resourceId = String(resource.id ?? resource.pk);
                      const needsNetwork = resource.connectable === false;
                      const sourceLabel = resource.resource_type === "database_service" ? "existing service" : "managed resource";
                      return (
                        <MenuItem value={resourceId} key={resourceId} disabled={needsNetwork}>
                          {resource.name} · {resource.engine} · {sourceLabel}
                          {resource.status ? ` · ${resource.status}` : ""}
                          {needsNetwork ? " · network required" : ""}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <TextField size="small" fullWidth label="Alias" value={databaseAlias} onChange={(e) => setDatabaseAlias(e.target.value)} disabled={databaseActionLoading} />
                    <TextField size="small" fullWidth label="Environment prefix" value={databasePrefix} onChange={(e) => setDatabasePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} disabled={databaseActionLoading} />
                    <TextField select size="small" fullWidth label="Access" value={databaseAccessMode} onChange={(e) => setDatabaseAccessMode(e.target.value)} disabled={databaseActionLoading}>
                      <MenuItem value="rw">Read / write</MenuItem>
                      <MenuItem value="ro">Read only</MenuItem>
                    </TextField>
                  </Stack>
                  <Button
                    variant="contained" size="small" startIcon={<LinkIcon />}
                    disabled={!selectedDatabaseId || databaseActionLoading}
                    onClick={async () => {
                      setDatabaseFormError(null);
                      try {
                        await onBindDatabase?.({ database: selectedDatabaseId, alias: databaseAlias.trim() || "default", env_prefix: databasePrefix.trim() || "DB", access_mode: databaseAccessMode });
                        setSelectedDatabaseId("");
                      } catch (err) {
                        setDatabaseFormError(getApiErrorMessage(err, "Could not connect the database."));
                      }
                    }}
                    sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, alignSelf: "flex-start" }}
                  >
                    {databaseActionLoading ? "Connecting…" : "Connect database"}
                  </Button>
                </Stack>
              )}
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, lineHeight: 1.6 }}>
                Passwords are never shown here. Saving a binding does not test live connectivity. Create a new deployment revision to apply a connection or disconnection; restarting an old immutable revision does not rewrite its stored settings. Credentials are stored encrypted and injected only at runtime.
              </Typography>
            </Paper>
          </Stack>
        )}
      </Paper>
      {/* ═══════════════ VOLUMES ═══════════════ */}
      <Paper id="volume" elevation={0} sx={{ scrollMarginTop: { xs: 12, md: 16 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<VolumeIcon size={18} />}
          title="Volumes"
          subtitle="Exclusive storage for this service. Volumes are not shareable."
          action={
            <Button
              size="small" startIcon={<AddIcon />} variant="outlined"
              onClick={() => { setCreateVolumeError(null); setCreateVolumeOpen(true); }}
              disabled={(remainingMb != null && remainingMb <= 0) || !canAdd}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 600 }}
            >
              New
            </Button>
          }
        />

        <StorageQuotaBar storage={storageNormalized} />

        <Alert
          severity={effectiveCanMutate ? "info" : "warning"}
          sx={{ mb: 2, borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.45 }}>
            {effectiveCanMutate
              ? "Quota counts every volume owned by this service (attached and soft-detached). Name/size/path lock after Docker provision. Soft-detached volumes can be deleted anytime; mounted ones need an idle runtime."
              : effectiveMutateReason ||
                "Stop the service before changing volumes. If a container still exists, use Danger zone → Remove runtime."}
          </Typography>
        </Alert>

        {/* Attached (mounted) volumes — split by is_mounted, not parent buckets */}
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Attached ({mountedList.length})
        </Typography>
        {mountedList.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No volumes mounted on this service.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {mountedList.map((v) => (
              <VolumeCard
                key={v.id ?? v.pk}
                volume={v}
                isAttached
                loading={volumeActionLoading}
                onDetach={handleDetachVolume}
                onDelete={handleDeleteVolume}
                onEdit={handleOpenEditVolume}
                onViewFiles={handleViewFiles}
                onDownload={onDownloadVolume}
                remainingMb={remainingMb}
                canMutate={effectiveCanMutate}
                mutateReason={effectiveMutateReason}
                canAttach={canAttach}
                canDetach={canDetach}
                canDelete={volumeCapabilities ? volumeCapabilities.can_delete !== false : effectiveCanMutate}
              />
            ))}
          </Stack>
        )}

        {/* Available / soft-detached volumes */}
        <Button
          size="small"
          endIcon={showAvailableVolumes ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          onClick={() => setShowAvailableVolumes((v) => !v)}
          sx={{ mb: 1, textTransform: "none", fontWeight: 600 }}
        >
          {showAvailableVolumes
            ? "Hide available volumes"
            : `Show available volumes (${unmountedList.length})`}
        </Button>

        <Collapse in={showAvailableVolumes}>
          <Stack spacing={1}>
            {unmountedList.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No unmounted volumes. Create one with the New button.
              </Typography>
            ) : (
              unmountedList.map((v) => {
                const vid = String(v.id ?? v.pk ?? "");
                return (
                  <VolumeCard
                    key={vid}
                    volume={v}
                    isAttached={false}
                    loading={volumeActionLoading}
                    onAttach={() => handleAttachVolume(vid)}
                    onDelete={handleDeleteVolume}
                    onEdit={handleOpenEditVolume}
                    onViewFiles={handleViewFiles}
                    onDownload={onDownloadVolume}
                    remainingMb={remainingMb}
                    canMutate={effectiveCanMutate}
                    mutateReason={effectiveMutateReason}
                    canAttach={canAttach}
                    canDetach={canDetach}
                    canDelete={volumeCapabilities ? volumeCapabilities.can_delete !== false : effectiveCanMutate}
                  />
                );
              })
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ═══════════════ PLAN ═══════════════ */}
      <Paper id="plan" elevation={0} sx={{ scrollMarginTop: { xs: 12, md: 16 }, p: { xs: 2, sm: 2.5 }, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
        <SectionHeader
          icon={<SellOutlinedIcon fontSize="small" />}
          title="Plan"
          subtitle={
            currentPlatform
              ? `Plans for platform "${currentPlatform}". Current plan cannot be re-selected.`
              : "Choose a plan for this service."
          }
          action={
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => onRefreshPlans?.()}
              disabled={plansLoading}
              sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
            >
              {plansLoading ? "Loading…" : "Refresh plans"}
            </Button>
          }
        />

        {plansError && (
          <Alert
            severity="error"
            sx={{ mb: 1.5, borderRadius: 1.5 }}
            action={
              <Button color="inherit" size="small" onClick={() => onRefreshPlans?.()} disabled={plansLoading}>
                Retry
              </Button>
            }
          >
            {plansError}
          </Alert>
        )}

        {plansLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : samePlatformPlans.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No plans are available for this platform. Refresh to try again or check that plans are configured for this runtime.</Typography>
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


      {/* ═══════════════ DANGER ZONE ═══════════════ */}
      <Paper
        id="danger-zone"
        elevation={0}
        sx={{
          scrollMarginTop: { xs: 12, md: 16 },
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "error.light",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.03)",
        }}
      >
        <SectionHeader
          icon={<DeleteIcon fontSize="small" color="error" />}
          title="Danger zone"
          subtitle="Destructive actions. Runtime must be removed before volume topology changes."
        />

        <Stack spacing={1.5}>
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: "divider" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Remove container & image
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Force-stop and delete the Docker container and image for this service.
                  Required before attach / detach / edit of volumes while a runtime still exists.
                </Typography>
              </Box>
              <Button
                color="error"
                variant="outlined"
                disabled={!onPurgeRuntime || purgeRuntimeLoading}
                onClick={() => setPurgeConfirmOpen(true)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {purgeRuntimeLoading ? "Removing…" : "Remove runtime"}
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, borderColor: "error.light" }}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "error.main" }}>
                  Delete this service
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {statusBusy
                    ? `Service is currently "${serviceStatus}". Stop it, then delete.`
                    : "Permanently delete this service. Runtime is already idle — you can delete now. You will be redirected to /service."}
                </Typography>
              </Box>
              <Button
                color="error"
                variant="contained"
                disabled={deleteServiceLoading || statusBusy}
                onClick={() => setDeleteServiceConfirmOpen(true)}
                sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {deleteServiceLoading
                  ? "Deleting…"
                  : statusBusy
                  ? "Stop service first"
                  : "Delete service"}
              </Button>
            </Stack>
          </Paper>
        </Stack>
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

      
      {/* ═══════════ Edit Volume Dialog ═══════════ */}
      <Dialog
        open={editVolumeOpen}
        onClose={() => !editingVolumeSaving && setEditVolumeOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Edit volume</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              Metadata can be changed only while this volume is <strong>not</strong> provisioned in Docker.
              After the first deploy, name/size/path/mode are locked.
            </Alert>
            {editVolumeError && (
              <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                {editVolumeError}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              size="small"
              label="Name"
              value={editVolumeForm.name}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, name: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Size (MB)"
              type="number"
              value={editVolumeForm.size_mb}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, size_mb: e.target.value }))}
              inputProps={{ min: 1 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Bind directory"
              value={editVolumeForm.default_bind}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, default_bind: e.target.value }))}
              placeholder="/data"
            />
            <TextField
              select
              fullWidth
              size="small"
              label="Access mode"
              value={editVolumeForm.default_mode}
              onChange={(e) => setEditVolumeForm((p) => ({ ...p, default_mode: e.target.value }))}
            >
              <MenuItem value="rw">Read-write (rw)</MenuItem>
              <MenuItem value="ro">Read-only (ro)</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setEditVolumeOpen(false)}
            disabled={editingVolumeSaving}
            sx={{ textTransform: "none" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEditVolume}
            disabled={editingVolumeSaving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {editingVolumeSaving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

{/* ═══════════ Files Dialog ═══════════ */}
      <VolumeFilesDialog
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

      {/* Purge runtime confirm */}
      <Dialog
        open={purgeConfirmOpen}
        onClose={() => !purgeRuntimeLoading && setPurgeConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Remove container & image?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            This will force-stop and delete the Docker container and related images for this service.
            Volumes on disk are <strong>not</strong> deleted.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            After removal you can attach, detach, or edit volumes that are not yet provisioned in Docker.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPurgeConfirmOpen(false)} disabled={purgeRuntimeLoading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmPurgeRuntime}
            disabled={purgeRuntimeLoading}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {purgeRuntimeLoading ? "Removing…" : "Yes, remove runtime"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete service confirm */}
      <Dialog
        open={deleteServiceConfirmOpen}
        onClose={() => {
          if (!deleteServiceLoading) {
            setDeleteServiceConfirmOpen(false);
            setDeleteServiceError(null);
          }
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: "error.main" }}>Delete service?</DialogTitle>
        <DialogContent>
          {deleteServiceError ? (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{deleteServiceError}</Alert>
          ) : null}
          <Typography variant="body2" sx={{ mb: 1 }}>
            Permanently delete service <strong>"{service?.name || "this service"}"</strong>.
            This cannot be undone.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {statusBusy
              ? "Service is still busy. Stop it before deleting."
              : "Service is idle. After deletion you will be redirected to /service."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteServiceConfirmOpen(false)} disabled={deleteServiceLoading} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteService}
            disabled={deleteServiceLoading}
            sx={{ textTransform: "none", fontWeight: 800, borderRadius: 1.5 }}
          >
            {deleteServiceLoading ? "Deleting…" : "Yes, delete service"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}