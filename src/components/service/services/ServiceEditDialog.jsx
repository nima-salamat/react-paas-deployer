import React, { useEffect, useRef, useState } from "react";
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
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import SpeedIcon from "@mui/icons-material/Speed";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";

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
    </Stack>
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
  const loadedPlatformRef = useRef(null);

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
  const selectedVols = draft.selectedVolumeIds || [];

  const toggleVolume = (vid) => {
    const id = String(vid);
    setDraft((d) => {
      const cur = d.selectedVolumeIds || [];
      return {
        ...d,
        selectedVolumeIds: cur.includes(id)
          ? cur.filter((x) => x !== id)
          : [...cur, id],
      };
    });
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 260px" },
        gap: 3,
      }}
    >
      <Stack spacing={3}>
        {/* Network */}
        <Box>
          <SectionHead
            icon={<HubIcon fontSize="small" />}
            title="Network"
            subtitle="Select a private network for this service"
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
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box>
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
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
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
            subtitle="Current plan is marked. Click another to switch (Save to apply)."
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
                  <Typography color="text.secondary">
                    No plans for this platform.
                  </Typography>
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
                        onClick={() =>
                          setDraft((d) => ({ ...d, selectedPlanId: pid }))
                        }
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
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
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
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mt: 0.75 }}
                        >
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
            subtitle="Attach or detach volumes — applied on Save"
          />
          {volumesLoading && volumes.length === 0 ? (
            <CircularProgress size={22} />
          ) : volumes.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No volumes available. Create volumes from the Volumes page, then attach them here.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {volumes.map((v) => {
                const vid = String(v.id ?? v.pk);
                const isAttached = selectedVols.includes(vid);
                return (
                  <Paper
                    key={vid}
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: isAttached ? "success.main" : "divider",
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
                    }}
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
                          label={isAttached ? "Attached" : "Available"}
                          size="small"
                          color={isAttached ? "success" : "default"}
                          variant={isAttached ? "filled" : "outlined"}
                          sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontFamily="monospace"
                      >
                        {v.default_bind || v.bind || "—"}
                        {v.size_mb != null ? ` · ${v.size_mb} MB` : ""}
                      </Typography>
                    </Box>
                    {isAttached ? (
                      <Button
                        size="small"
                        color="warning"
                        startIcon={<LinkOffIcon />}
                        onClick={() => toggleVolume(vid)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 1.5,
                        }}
                      >
                        Detach
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<LinkIcon />}
                        onClick={() => toggleVolume(vid)}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 1.5,
                        }}
                      >
                        Attach
                      </Button>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Box>
      </Stack>

      <Box>
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            position: "sticky",
            top: 8,
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} gutterBottom>
            Overview
          </Typography>
          <Stack spacing={1}>
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
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      disableScrollLock
      keepMounted={false}
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 800,
        }}
      >
        Settings — {draft?.service?.name}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
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
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
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
