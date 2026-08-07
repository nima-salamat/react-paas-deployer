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
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
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

  // Attachable = owned by this service OR unused
  const attachableVolumes = useMemo(() => {
    return (volumes || []).filter((v) => {
      const owner = v.service?.id ?? v.service?.pk ?? v.service ?? null;
      if (owner == null || v.is_unused) return true;
      return String(owner) === serviceId;
    });
  }, [volumes, serviceId]);

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
            subtitle="Private network for this service"
          />
          {networksFetchError && (
            <Alert
              severity="error"
              sx={{ mb: 1.5, borderRadius: 1.5 }}
              action={
                <Button size="small" onClick={retryNetworks} sx={{ textTransform: "none" }}>
                  Retry
                </Button>
              }
            >
              {networksFetchError}
            </Alert>
          )}
          {networksLoading && networks.length === 0 ? (
            <CircularProgress size={22} />
          ) : (
            <Stack spacing={1}>
              {networks.map((n) => {
                const nid = String(n.id ?? n.pk);
                const isSelected = String(draft.selectedNetwork ?? "") === nid;
                const isCurrent = nid === currentNetworkId;
                return (
                  <Paper
                    key={nid}
                    elevation={0}
                    onClick={() => setDraft((d) => ({ ...d, selectedNetwork: nid }))}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: "2px solid",
                      borderColor: isSelected
                        ? "primary.main"
                        : isCurrent
                        ? "success.main"
                        : "divider",
                      cursor: "pointer",
                      bgcolor: (t) =>
                        isSelected
                          ? t.palette.mode === "dark"
                            ? "rgba(59,130,246,0.1)"
                            : "rgba(59,130,246,0.05)"
                          : isCurrent
                          ? t.palette.mode === "dark"
                            ? "rgba(34,197,94,0.08)"
                            : "rgba(34,197,94,0.05)"
                          : "transparent",
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={800}>
                          {n.name}
                        </Typography>
                        {n.description && (
                          <Typography variant="caption" color="text.secondary">
                            {n.description}
                          </Typography>
                        )}
                      </Box>
                      {isCurrent && (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                          label="Current"
                          color="success"
                          size="small"
                          sx={{ height: 22, fontWeight: 800 }}
                        />
                      )}
                      {isSelected && !isCurrent && (
                        <Chip
                          label="Selected"
                          color="primary"
                          size="small"
                          sx={{ height: 22, fontWeight: 800 }}
                        />
                      )}
                    </Stack>
                  </Paper>
                );
              })}
              {networks.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No networks yet.
                </Typography>
              )}
            </Stack>
          )}
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
            subtitle="Switch plan on Save. Same platform only."
          />
          {plansLoading ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : plansForPlatformErrors[platform] ? (
            <Alert
              severity="error"
              sx={{ borderRadius: 1.5 }}
              action={
                <Button size="small" onClick={() => fetchPlansForPlatform(platform)}>
                  Retry
                </Button>
              }
            >
              {plansForPlatformErrors[platform]}
            </Alert>
          ) : (
            <Grid container spacing={1.5}>
              {availablePlans.length === 0 ? (
                <Grid item xs={12}>
                  <Typography color="text.secondary">No plans for this platform.</Typography>
                </Grid>
              ) : (
                availablePlans.map((p) => {
                  const pid = String(p.id ?? p.pk);
                  const isSelected = String(draft.selectedPlanId ?? "") === pid;
                  const isCurrent = pid === currentPlanId;
                  return (
                    <Grid item xs={12} sm={6} key={pid}>
                      <Paper
                        elevation={0}
                        onClick={() => setDraft((d) => ({ ...d, selectedPlanId: pid }))}
                        sx={{
                          p: 1.75,
                          borderRadius: 2,
                          cursor: "pointer",
                          border: "2px solid",
                          borderColor: isCurrent
                            ? "success.main"
                            : isSelected
                            ? "primary.main"
                            : "divider",
                          height: "100%",
                          bgcolor: (t) =>
                            isCurrent
                              ? t.palette.mode === "dark"
                                ? "rgba(34,197,94,0.08)"
                                : "rgba(34,197,94,0.06)"
                              : isSelected
                              ? t.palette.mode === "dark"
                                ? "rgba(59,130,246,0.1)"
                                : "rgba(59,130,246,0.05)"
                              : "transparent",
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Typography fontWeight={800}>{p.name}</Typography>
                          {isCurrent ? (
                            <Chip
                              icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                              label="Current"
                              color="success"
                              size="small"
                              sx={{ height: 22, fontWeight: 800 }}
                            />
                          ) : isSelected ? (
                            <Chip
                              label="Selected"
                              color="primary"
                              size="small"
                              sx={{ height: 22, fontWeight: 800 }}
                            />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                          {[
                            p.max_cpu != null && `${p.max_cpu} CPU`,
                            p.max_ram != null && `${p.max_ram} MB`,
                            p.max_storage != null && `${p.max_storage} GB`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                        {p.price_per_hour != null && (
                          <Typography
                            variant="body2"
                            sx={{ mt: 0.75, fontWeight: 800, color: "success.main" }}
                          >
                            {p.price_per_hour}/hr
                          </Typography>
                        )}
                      </Paper>
                    </Grid>
                  );
                })
              )}
            </Grid>
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
            <CircularProgress size={22} />
          ) : attachableVolumes.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              No volumes yet. Create one below.
            </Typography>
          ) : (
            <Stack spacing={1} sx={{ mb: 2 }}>
              {attachableVolumes.map((v) => {
                const vid = String(v.id ?? v.pk);
                const isAttached = selectedVols.includes(vid);
                const size = Number(v.size_mb) || 0;
                const wouldExceed =
                  !isAttached && quotaMb != null && usedBySelection + size > quotaMb;
                return (
                  <Paper
                    key={vid}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: isAttached
                        ? "success.main"
                        : wouldExceed
                        ? "error.light"
                        : "divider",
                      bgcolor: (t) =>
                        isAttached
                          ? t.palette.mode === "dark"
                            ? "rgba(34,197,94,0.08)"
                            : "rgba(34,197,94,0.05)"
                          : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      flexWrap: "wrap",
                      opacity: wouldExceed ? 0.65 : 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" fontWeight={800}>
                          {v.name}
                        </Typography>
                        <Chip
                          label={isAttached ? "Attached" : "Available"}
                          size="small"
                          color={isAttached ? "success" : "default"}
                          variant={isAttached ? "filled" : "outlined"}
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                        {wouldExceed && (
                          <Chip
                            label="Exceeds quota"
                            size="small"
                            color="error"
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {v.default_bind || v.bind || "—"}
                        {v.size_mb != null ? ` · ${v.size_mb} MB` : ""}
                      </Typography>
                    </Box>
                    {isAttached ? (
                      <Button
                        size="small"
                        color="warning"
                        startIcon={<LinkOffIcon />}
                        onClick={() => toggleVolume(vid, size)}
                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
                      >
                        Detach
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<LinkIcon />}
                        disabled={wouldExceed || !canMutateVolumes}
                        onClick={() => toggleVolume(vid, size)}
                        sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
                      >
                        Attach
                      </Button>
                    )}
                  </Paper>
                );
              })}
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
