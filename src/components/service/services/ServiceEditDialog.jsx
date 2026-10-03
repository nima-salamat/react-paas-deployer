import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Radio,
  Collapse,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MemoryIcon from "@mui/icons-material/Memory";
import SdStorageIcon from "@mui/icons-material/SdStorage";
import apiRequest from "../../customHooks/apiRequest";
import { VOLUME_API_ROOT } from "./helpers";

function SectionHead({ icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: "grid",
          placeItems: "center",
          bgcolor: (t) =>
            t.palette.mode === "dark" ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)",
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
    </Stack>
  );
}

function StorageBar({ quotaMb, usedMb }) {
  if (quotaMb == null) return null;
  const used = Number(usedMb) || 0;
  const quota = Number(quotaMb) || 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const color = pct >= 95 ? "error" : pct >= 80 ? "warning" : "primary";
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 2 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" fontWeight={700}>
          Plan storage
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {used.toLocaleString()} / {quota.toLocaleString()} MB ({pct}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ height: 8, borderRadius: 1 }}
      />
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        Remaining {(Math.max(0, quota - used)).toLocaleString()} MB · Exclusive volumes only
      </Typography>
    </Paper>
  );
}

function EditBody({
  draft,
  setDraft,
  networks,
  networksLoading,
  networksFetchError,
  retryNetworks,
  createNetworkInline,
  fetchPlansForPlatform,
  plansForPlatformErrors,
  volumes,
  volumesLoading,
  onVolumesChanged,
  canMutateVolumes = true,
  volumeMutateReason = "",
  onPurgeRuntime,
  purgeRuntimeLoading = false,
  onDeleteVolume,
}) {
  const svc = draft.service;
  const platform =
    svc.plan && typeof svc.plan === "object"
      ? svc.plan.platform ?? ""
      : svc.platform || "";

  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [newNetName, setNewNetName] = useState("");
  const [creatingNet, setCreatingNet] = useState(false);
  const [volumeError, setVolumeError] = useState(null);
  const [volumeMsg, setVolumeMsg] = useState(null);
  const [creatingVolume, setCreatingVolume] = useState(false);
  const [newVol, setNewVol] = useState({
    name: "",
    size_mb: "1024",
    default_bind: "/data",
    default_mode: "rw",
  });
  const loadedPlatformRef = useRef(null);
  const [showAllNetworks, setShowAllNetworks] = useState(false);
  const [showAvailableVolumes, setShowAvailableVolumes] = useState(true);

  const serviceId = String(svc.id ?? svc.pk ?? "");

  const quotaMb = useMemo(() => {
    if (svc.storage?.quota_mb != null) return Number(svc.storage.quota_mb);
    const gb =
      svc.plan?.max_storage ??
      (typeof svc.plan === "object" ? svc.plan?.max_storage : null);
    if (gb != null) return Math.round(Number(gb) * 1024);
    return null;
  }, [svc]);

  const selectedVols = draft.selectedVolumeIds || [];

  // Attachable = owned by this service OR unused.
  const attachableVolumes = useMemo(() => {
    return (volumes || []).filter((v) => {
      const owner = v.service?.id ?? v.service?.pk ?? v.service ?? null;
      if (owner == null || v.is_unused) return true;
      return String(owner) === serviceId;
    });
  }, [volumes, serviceId]);

  const selectedVolumeItems = useMemo(
    () =>
      attachableVolumes.filter((v) =>
        selectedVols.includes(String(v.id ?? v.pk))
      ),
    [attachableVolumes, selectedVols]
  );

  const availableVolumeItems = useMemo(
    () =>
      attachableVolumes.filter(
        (v) => !selectedVols.includes(String(v.id ?? v.pk))
      ),
    [attachableVolumes, selectedVols]
  );

  const usedBySelection = useMemo(() => {
    let total = 0;
    for (const v of attachableVolumes) {
      const id = String(v.id ?? v.pk);
      if (selectedVols.includes(id)) total += Number(v.size_mb) || 0;
    }
    return total;
  }, [attachableVolumes, selectedVols]);

  const remainingMb =
    quotaMb != null ? Math.max(0, quotaMb - usedBySelection) : null;

  useEffect(() => {
    if (!platform) {
      setAvailablePlans([]);
      loadedPlatformRef.current = null;
      return;
    }
    if (loadedPlatformRef.current === platform) return;
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      const plans = await fetchPlansForPlatform(platform);
      if (cancelled) return;
      setAvailablePlans(
        (plans || []).filter(
          (p) =>
            !p.platform ||
            String(p.platform).toLowerCase() === String(platform).toLowerCase()
        )
      );
      loadedPlatformRef.current = platform;
      setPlansLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [platform, fetchPlansForPlatform]);

  const currentPlanId = String(svc.plan?.id ?? svc.plan?.pk ?? svc.plan ?? "");
  const currentNetworkId = String(
    svc.network?.id ?? svc.network?.pk ?? svc.network ?? ""
  );

  const toggleVolume = (vid, sizeMb) => {
    setVolumeError(null);
    const id = String(vid);
    setDraft((d) => {
      const cur = d.selectedVolumeIds || [];
      if (cur.includes(id)) {
        return { ...d, selectedVolumeIds: cur.filter((x) => x !== id) };
      }
      if (quotaMb != null) {
        const other = cur.reduce((acc, id2) => {
          const v = attachableVolumes.find((x) => String(x.id ?? x.pk) === id2);
          return acc + (Number(v?.size_mb) || 0);
        }, 0);
        if (other + (Number(sizeMb) || 0) > quotaMb) {
          setVolumeError(`Cannot attach: would exceed plan storage (${quotaMb} MB).`);
          return d;
        }
      }
      return { ...d, selectedVolumeIds: [...cur, id] };
    });
  };

  const handleCreateVolume = async () => {
    setVolumeError(null);
    setVolumeMsg(null);
    const n = newVol.name.trim();
    const bind = newVol.default_bind.trim();
    const size = Number(newVol.size_mb);
    if (!n) {
      setVolumeError("Volume name is required.");
      return;
    }
    if (!bind.startsWith("/")) {
      setVolumeError("Bind must be an absolute path, e.g. /data");
      return;
    }
    if (!size || size < 1) {
      setVolumeError("Valid size (MB) is required.");
      return;
    }
    if (remainingMb != null && size > remainingMb) {
      setVolumeError(`Not enough storage. Remaining: ${remainingMb} MB.`);
      return;
    }

    setCreatingVolume(true);
    try {
      // Create already owned by this service (exclusive)
      const res = await apiRequest({
        method: "POST",
        url: VOLUME_API_ROOT,
        data: {
          name: n,
          size_mb: size,
          default_bind: bind,
          default_mode: newVol.default_mode || "rw",
          service: serviceId,
        },
      });
      const id = String(res.data?.id ?? res.data?.pk ?? "");
      await onVolumesChanged?.();
      if (id) {
        setDraft((d) => ({
          ...d,
          selectedVolumeIds: d.selectedVolumeIds?.includes(id)
            ? d.selectedVolumeIds
            : [...(d.selectedVolumeIds || []), id],
          // treat as already "initial" so Save won't re-PATCH attach
          initialVolumeIds: [...(d.initialVolumeIds || []), id],
        }));
      }
      setNewVol({ name: "", size_mb: "1024", default_bind: "/data", default_mode: "rw" });
      setVolumeMsg("Volume created and attached to this service.");
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.size_mb ||
        err?.response?.data?.errors ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Failed to create volume.";
      setVolumeError(typeof msg === "object" ? JSON.stringify(msg) : String(msg));
    } finally {
      setCreatingVolume(false);
    }
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 240px" },
        gap: { xs: 2.5, md: 3 },
      }}
    >
      <Stack spacing={2.5}>
        {/* Network */}
        <Box>
          <SectionHead
            icon={<HubIcon fontSize="small" />}
            title="Network"
            subtitle="One private network can be attached to this service."
          />

          {networksFetchError && (
            <Alert
              severity="error"
              sx={{ mb: 1.5, borderRadius: 2 }}
              action={
                <Button size="small" onClick={retryNetworks} sx={{ textTransform: "none" }}>
                  Retry
                </Button>
              }
            >
              {networksFetchError}
            </Alert>
          )}

          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 1.5,
              borderRadius: 2,
              borderColor:
                currentNetworkId === String(draft.selectedNetwork || "")
                  ? "info.main"
                  : "divider",
              bgcolor: (t) =>
                currentNetworkId &&
                currentNetworkId === String(draft.selectedNetwork || "")
                  ? t.palette.mode === "dark"
                    ? "rgba(6,182,212,0.08)"
                    : "rgba(6,182,212,0.05)"
                  : t.palette.mode === "dark"
                  ? "rgba(255,255,255,0.02)"
                  : "grey.50",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              spacing={1}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
                  Currently attached
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 800 }}>
                  {networks.find(
                    (n) => String(n.id ?? n.pk) === currentNetworkId
                  )?.name || "No network"}
                </Typography>
              </Box>
              {currentNetworkId &&
                String(draft.selectedNetwork || "") !== currentNetworkId && (
                  <Chip
                    label="Change pending"
                    size="small"
                    color="warning"
                    sx={{ fontWeight: 750 }}
                  />
                )}
            </Stack>
          </Paper>

          <Button
            size="small"
            endIcon={showAllNetworks ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowAllNetworks((value) => !value)}
            sx={{ mb: 1, textTransform: "none", fontWeight: 650, px: 0.5 }}
          >
            {showAllNetworks
              ? "Hide networks"
              : `Choose another network (${networks.length})`}
          </Button>

          <Collapse in={showAllNetworks}>
            {networksLoading && networks.length === 0 ? (
              <Box sx={{ py: 2, textAlign: "center" }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack spacing={1}>
                {networks.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No networks yet. Create one below.
                  </Typography>
                ) : (
                  networks.map((n) => {
                    const nid = String(n.id ?? n.pk);
                    const selected = nid === String(draft.selectedNetwork ?? "");
                    const current = nid === currentNetworkId;
                    return (
                      <Paper
                        key={nid}
                        variant="outlined"
                        onClick={() =>
                          setDraft((d) => ({ ...d, selectedNetwork: nid }))
                        }
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          cursor: "pointer",
                          borderColor: current
                            ? "info.main"
                            : selected
                            ? "primary.main"
                            : "divider",
                          bgcolor: (t) =>
                            current
                              ? t.palette.mode === "dark"
                                ? "rgba(6,182,212,0.08)"
                                : "rgba(6,182,212,0.05)"
                              : selected
                              ? t.palette.mode === "dark"
                                ? "rgba(59,130,246,0.10)"
                                : "rgba(59,130,246,0.05)"
                              : "transparent",
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Radio checked={selected} size="small" sx={{ p: 0 }} />
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" fontWeight={800}>
                              {n.name}
                            </Typography>
                            {n.description && (
                              <Typography variant="caption" color="text.secondary">
                                {n.description}
                              </Typography>
                            )}
                          </Box>
                          {current && (
                            <Chip
                              label="Current"
                              size="small"
                              color="info"
                              sx={{ height: 22, fontSize: 11, fontWeight: 750 }}
                            />
                          )}
                        </Stack>
                      </Paper>
                    );
                  })
                )}
              </Stack>
            )}
          </Collapse>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              placeholder="New network name"
              value={newNetName}
              onChange={(e) => setNewNetName(e.target.value)}
              fullWidth
            />
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={creatingNet || !newNetName.trim()}
              sx={{
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
              onClick={async () => {
                setCreatingNet(true);
                try {
                  const created = await createNetworkInline(newNetName.trim());
                  if (created) {
                    setDraft((d) => ({
                      ...d,
                      selectedNetwork: created.id ?? created.pk,
                    }));
                    setNewNetName("");
                    setShowAllNetworks(true);
                  }
                } finally {
                  setCreatingNet(false);
                }
              }}
            >
              {creatingNet ? "…" : "Create"}
            </Button>
          </Stack>
        </Box>

        <Divider />

        {/* Plan */}
        <Box>
          <SectionHead
            icon={<SpeedIcon fontSize="small" />}
            title={platform ? `Plan · ${platform}` : "Plan"}
            subtitle="Choose a plan for the same platform. Applied when you save."
          />

          {plansLoading ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : plansForPlatformErrors[platform] ? (
            <Alert
              severity="error"
              sx={{ borderRadius: 2 }}
              action={
                <Button
                  size="small"
                  onClick={() => fetchPlansForPlatform(platform)}
                  sx={{ textTransform: "none" }}
                >
                  Retry
                </Button>
              }
            >
              {plansForPlatformErrors[platform]}
            </Alert>
          ) : availablePlans.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No plans available for this platform.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 1.5,
              }}
            >
              {availablePlans.map((p) => {
                const pid = String(p.id ?? p.pk);
                const isSelected = pid === String(draft.selectedPlanId ?? "");
                const isCurrent = pid === currentPlanId;
                return (
                  <Paper
                    key={pid}
                    elevation={0}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        selectedPlanId: isCurrent ? currentPlanId : pid,
                      }))
                    }
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "2px solid",
                      borderColor: isCurrent
                        ? "success.main"
                        : isSelected
                        ? "primary.main"
                        : "divider",
                      cursor: "pointer",
                      bgcolor: (t) =>
                        isCurrent
                          ? t.palette.mode === "dark"
                            ? "rgba(34,197,94,0.08)"
                            : "rgba(34,197,94,0.06)"
                          : isSelected
                          ? t.palette.mode === "dark"
                            ? "rgba(59,130,246,0.10)"
                            : "rgba(59,130,246,0.05)"
                          : "transparent",
                      transition: "border-color .15s, box-shadow .15s",
                      "&:hover": {
                        borderColor: isCurrent
                          ? "success.main"
                          : isSelected
                          ? "primary.main"
                          : "primary.light",
                        boxShadow: "0 4px 14px rgba(0,0,0,.08)",
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      gap={1}
                      sx={{ mb: 1 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {p.name || "Plan"}
                        </Typography>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          flexWrap="wrap"
                          useFlexGap
                          sx={{ mt: 0.75 }}
                        >
                          {p.platform && (
                            <Chip
                              label={p.platform}
                              size="small"
                              variant="outlined"
                              sx={{ height: 21, fontSize: 11 }}
                            />
                          )}
                          {p.plan_type && (
                            <Chip
                              label={p.plan_type}
                              size="small"
                              variant="outlined"
                              sx={{ height: 21, fontSize: 11 }}
                            />
                          )}
                        </Stack>
                      </Box>
                      {isCurrent ? (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 15 }} />}
                          label="Current"
                          color="success"
                          size="small"
                          sx={{ height: 23, fontWeight: 750 }}
                        />
                      ) : (
                        <Radio checked={isSelected} size="small" sx={{ p: 0.25 }} />
                      )}
                    </Stack>

                    <Stack spacing={0.5}>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <MemoryIcon sx={{ fontSize: 16 }} color="action" />
                        <Typography variant="body2" color="text.secondary">
                          CPU <strong>{p.max_cpu ?? "—"}</strong>
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <MemoryIcon sx={{ fontSize: 16 }} color="action" />
                        <Typography variant="body2" color="text.secondary">
                          RAM <strong>{p.max_ram ?? "—"}</strong>
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <SdStorageIcon sx={{ fontSize: 16 }} color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Storage <strong>{p.max_storage ?? "—"} GB</strong>
                        </Typography>
                      </Stack>
                    </Stack>

                    {p.price_per_hour != null && (
                      <Typography
                        variant="body2"
                        sx={{ mt: 1.25, fontWeight: 800, color: "primary.main" }}
                      >
                        {p.price_per_hour} / hour
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Volumes */}
        <Box>
          <SectionHead
            icon={<StorageIcon fontSize="small" />}
            title="Volumes"
            subtitle="Exclusive to this service. Create or attach unused ones. Applied on Save."
          />
          {!canMutateVolumes && (
            <Alert
              severity="warning"
              sx={{ mb: 1.5, borderRadius: 1.5 }}
              action={
                onPurgeRuntime ? (
                  <Button
                    color="inherit"
                    size="small"
                    disabled={purgeRuntimeLoading}
                    onClick={() => onPurgeRuntime?.()}
                    sx={{ textTransform: "none", fontWeight: 700 }}
                  >
                    {purgeRuntimeLoading ? "Removing…" : "Remove container & image"}
                  </Button>
                ) : null
              }
            >
              {volumeMutateReason ||
                "Stop service and remove container & image before changing volumes."}
            </Alert>
          )}
          <StorageBar quotaMb={quotaMb} usedMb={usedBySelection} />
          {volumeError && (
            <Alert
              severity="error"
              sx={{ mb: 1.5, borderRadius: 1.5 }}
              onClose={() => setVolumeError(null)}
            >
              {volumeError}
            </Alert>
          )}
          {volumeMsg && (
            <Alert
              severity="success"
              sx={{ mb: 1.5, borderRadius: 1.5 }}
              onClose={() => setVolumeMsg(null)}
            >
              {volumeMsg}
            </Alert>
          )}

          {volumesLoading && attachableVolumes.length === 0 ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : attachableVolumes.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No volumes available for this service yet.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 750, mb: 1 }}>
                  Selected for this service ({selectedVolumeItems.length})
                </Typography>
                {selectedVolumeItems.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No volumes selected.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {selectedVolumeItems.map((v) => {
                      const vid = String(v.id ?? v.pk);
                      const size = Number(v.size_mb) || 0;
                      return (
                        <Paper
                          key={vid}
                          variant="outlined"
                          sx={{
                            p: 1.75,
                            borderRadius: 2,
                            borderColor: "success.main",
                            bgcolor: (t) =>
                              t.palette.mode === "dark"
                                ? "rgba(34,197,94,0.08)"
                                : "rgba(34,197,94,0.05)",
                          }}
                        >
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            justifyContent="space-between"
                            alignItems={{ xs: "stretch", sm: "center" }}
                            spacing={1.25}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                flexWrap="wrap"
                                useFlexGap
                              >
                                <Typography variant="body2" fontWeight={800}>
                                  {v.name}
                                </Typography>
                                <Chip
                                  label="Selected"
                                  size="small"
                                  color="success"
                                  sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                                />
                              </Stack>
                              <Stack
                                direction="row"
                                spacing={1.5}
                                flexWrap="wrap"
                                useFlexGap
                                sx={{ mt: 0.75 }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontFamily: "monospace" }}
                                >
                                  {v.default_bind || v.bind || "—"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {size} MB
                                </Typography>
                                <Chip
                                  label={v.default_mode || v.mode || "rw"}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 10 }}
                                />
                              </Stack>
                            </Box>
                            <Button
                              size="small"
                              color="warning"
                              variant="outlined"
                              startIcon={<LinkOffIcon />}
                              disabled={!canMutateVolumes}
                              onClick={() => toggleVolume(vid, size)}
                              sx={{
                                textTransform: "none",
                                fontWeight: 700,
                                borderRadius: 1.5,
                                flexShrink: 0,
                              }}
                            >
                              Detach
                            </Button>
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                )}
              </Box>

              <Box>
                <Button
                  size="small"
                  endIcon={
                    showAvailableVolumes ? <ExpandLessIcon /> : <ExpandMoreIcon />
                  }
                  onClick={() => setShowAvailableVolumes((value) => !value)}
                  sx={{
                    px: 0.5,
                    textTransform: "none",
                    fontWeight: 650,
                    mb: 1,
                  }}
                >
                  {showAvailableVolumes
                    ? "Hide available volumes"
                    : `Show available volumes (${availableVolumeItems.length})`}
                </Button>

                <Collapse in={showAvailableVolumes}>
                  {availableVolumeItems.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No unused volumes available.
                    </Typography>
                  ) : (
                    <Stack spacing={1}>
                      {availableVolumeItems.map((v) => {
                        const vid = String(v.id ?? v.pk);
                        const size = Number(v.size_mb) || 0;
                        const wouldExceed =
                          quotaMb != null && usedBySelection + size > quotaMb;
                        return (
                          <Paper
                            key={vid}
                            variant="outlined"
                            sx={{
                              p: 1.75,
                              borderRadius: 2,
                              borderColor: wouldExceed
                                ? "error.light"
                                : "divider",
                              opacity: wouldExceed ? 0.65 : 1,
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              alignItems={{ xs: "stretch", sm: "center" }}
                              spacing={1.25}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Stack
                                  direction="row"
                                  spacing={0.75}
                                  alignItems="center"
                                  flexWrap="wrap"
                                  useFlexGap
                                >
                                  <Typography variant="body2" fontWeight={750}>
                                    {v.name}
                                  </Typography>
                                  <Chip
                                    label="Available"
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                                  />
                                  {wouldExceed && (
                                    <Chip
                                      label="Exceeds quota"
                                      color="error"
                                      size="small"
                                      sx={{ height: 20, fontSize: 11 }}
                                    />
                                  )}
                                </Stack>
                                <Stack
                                  direction="row"
                                  spacing={1.5}
                                  flexWrap="wrap"
                                  useFlexGap
                                  sx={{ mt: 0.75 }}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontFamily: "monospace" }}
                                  >
                                    {v.default_bind || v.bind || "—"}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {size} MB
                                  </Typography>
                                  <Chip
                                    label={v.default_mode || v.mode || "rw"}
                                    size="small"
                                    variant="outlined"
                                    sx={{ height: 18, fontSize: 10 }}
                                  />
                                </Stack>
                              </Box>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<LinkIcon />}
                                disabled={wouldExceed || !canMutateVolumes}
                                onClick={() => toggleVolume(vid, size)}
                                sx={{
                                  textTransform: "none",
                                  fontWeight: 700,
                                  borderRadius: 1.5,
                                  flexShrink: 0,
                                }}
                              >
                                Attach
                              </Button>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  )}
                </Collapse>
              </Box>
            </Stack>
          )}

          {/* Create volume inline */}
          <Paper
            variant="outlined"
            sx={{ p: 1.5, borderRadius: 2, borderStyle: "dashed" }}
          >
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
              Create volume
            </Typography>
            <Stack spacing={1}>
              <TextField
                size="small"
                label="Name"
                value={newVol.name}
                onChange={(e) => setNewVol((p) => ({ ...p, name: e.target.value }))}
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  size="small"
                  label="Bind path"
                  value={newVol.default_bind}
                  onChange={(e) => setNewVol((p) => ({ ...p, default_bind: e.target.value }))}
                  fullWidth
                  placeholder="/data"
                />
                <TextField
                  size="small"
                  label="Size MB"
                  type="number"
                  value={newVol.size_mb}
                  onChange={(e) => setNewVol((p) => ({ ...p, size_mb: e.target.value }))}
                  inputProps={{
                    min: 1,
                    max: remainingMb != null ? remainingMb : undefined,
                  }}
                  sx={{ width: { xs: "100%", sm: 120 } }}
                />
                <TextField
                  select
                  size="small"
                  label="Mode"
                  value={newVol.default_mode}
                  onChange={(e) => setNewVol((p) => ({ ...p, default_mode: e.target.value }))}
                  sx={{ width: { xs: "100%", sm: 100 } }}
                >
                  <MenuItem value="rw">rw</MenuItem>
                  <MenuItem value="ro">ro</MenuItem>
                </TextField>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreateVolume}
                disabled={
                  creatingVolume || (remainingMb != null && remainingMb <= 0) || !canMutateVolumes
                }
                sx={{
                  borderRadius: 1.5,
                  textTransform: "none",
                  fontWeight: 700,
                  alignSelf: "flex-start",
                }}
              >
                {creatingVolume ? "Creating…" : "Create & attach"}
              </Button>
            </Stack>
          </Paper>
        </Box>
      </Stack>

      {/* Overview sidebar — below content on mobile */}
      <Box sx={{ order: { xs: -1, md: 0 } }}>
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            position: { md: "sticky" },
            top: 8,
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} gutterBottom>
            Overview
          </Typography>
          <Stack spacing={0.75}>
            <Typography variant="body2">
              <strong>Name:</strong> {svc.name}
            </Typography>
            <Typography variant="body2">
              <strong>Status:</strong> {svc.status || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Platform:</strong> {platform || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Network:</strong>{" "}
              {networks.find(
                (n) => String(n.id ?? n.pk) === String(draft.selectedNetwork)
              )?.name || "—"}
            </Typography>
            <Typography variant="body2">
              <strong>Volumes:</strong> {selectedVols.length}
              {quotaMb != null ? ` · ${usedBySelection}/${quotaMb} MB` : ""}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

export default function ServiceEditDialog({
  open,
  draft,
  setDraft,
  onClose,
  onSave,
  saving,
  networks,
  networksLoading,
  networksFetchError,
  retryNetworks,
  createNetworkInline,
  fetchPlansForPlatform,
  plansForPlatformErrors,
  volumes,
  volumesLoading,
  onVolumesChanged,
  canMutateVolumes = true,
  volumeMutateReason = "",
  onPurgeRuntime,
  purgeRuntimeLoading = false,
  onDeleteVolume,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      disableScrollLock
      keepMounted={false}
      PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2.5 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 800,
          py: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={800} noWrap>
            Settings
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {draft?.service?.name}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 1.5, sm: 3 } }}>
        {draft && (
          <EditBody
            draft={draft}
            setDraft={setDraft}
            networks={networks}
            networksLoading={networksLoading}
            networksFetchError={networksFetchError}
            retryNetworks={retryNetworks}
            createNetworkInline={createNetworkInline}
            fetchPlansForPlatform={fetchPlansForPlatform}
            plansForPlatformErrors={plansForPlatformErrors}
            volumes={volumes}
            volumesLoading={volumesLoading}
            onVolumesChanged={onVolumesChanged}
            canMutateVolumes={canMutateVolumes}
            volumeMutateReason={volumeMutateReason}
            onPurgeRuntime={onPurgeRuntime}
            purgeRuntimeLoading={purgeRuntimeLoading}
            onDeleteVolume={onDeleteVolume}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={saving}
          onClick={onSave}
          sx={{ borderRadius: 1.5, textTransform: "none", fontWeight: 700 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
