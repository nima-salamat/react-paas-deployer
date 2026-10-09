import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import MemoryIcon from "@mui/icons-material/Memory";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import PlatformIcon from "../../plans/PlatformIcon.jsx";

export default function ServiceDeleteDialog({
  open,
  service,
  loading = false,
  error = "",
  onClose,
  onConfirm,
}) {
  const plan = service?.plan && typeof service.plan === "object" ? service.plan : null;
  const network = service?.network && typeof service.network === "object" ? service.network : null;
  const status = String(service?.status || "unknown").toLowerCase();
  const busy = ["queued", "deploying", "stopping", "running", "updating...", "pending"].includes(status);
  const platform = String(plan?.platform || service?.platform || "unknown");

  return (
    <Dialog
      open={Boolean(open)}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: "1px solid",
          borderColor: "error.main",
          overflow: "hidden",
        },
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, sm: 3 },
          pt: 2.5,
          pb: 2,
          bgcolor: (t) =>
            t.palette.mode === "dark"
              ? "rgba(239,68,68,0.075)"
              : "rgba(239,68,68,0.045)",
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
              bgcolor: "error.main",
              color: "error.contrastText",
            }}
          >
            <DeleteOutlineRoundedIcon />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 850, lineHeight: 1.15 }}>
              Delete service
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              This permanently removes the service and its PassDeployer-managed runtime resources.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5 }}>
        <Stack spacing={2}>
          <Box
            sx={{
              p: 1.75,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "action.hover",
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <PlatformIcon platformKey={platform} label={platform} size={22} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 850 }} noWrap>
                  {service?.name || "Unnamed service"}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                  {platform}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={status}
                color={status === "running" ? "success" : busy ? "warning" : ["failed", "error"].includes(status) ? "error" : "default"}
                sx={{ fontWeight: 750, textTransform: "capitalize" }}
              />
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
              {plan?.max_cpu != null && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <MemoryIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {plan.max_cpu} CPU
                  </Typography>
                </Stack>
              )}
              {plan?.max_storage != null && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <StorageIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {plan.max_storage} GB
                  </Typography>
                </Stack>
              )}
              {network?.name && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <HubIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {network.name}
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Alert
            severity={busy ? "warning" : "error"}
            icon={<WarningAmberRoundedIcon />}
            sx={{ borderRadius: 2 }}
          >
            {busy
              ? "This service is currently busy. Stop it before deleting it."
              : "This action cannot be undone. Service configuration, deployments, and owned resources will be removed according to the backend deletion policy."}
          </Alert>

          {error ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: { xs: 2.5, sm: 3 }, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ textTransform: "none", borderRadius: 1.5, fontWeight: 650 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={loading || busy || !service}
          startIcon={<DeleteOutlineRoundedIcon />}
          sx={{
            textTransform: "none",
            borderRadius: 1.5,
            fontWeight: 800,
            px: 2.25,
          }}
        >
          {loading ? "Deleting…" : "Delete permanently"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
