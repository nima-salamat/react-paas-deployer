import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import VisibilityIcon from "@mui/icons-material/Visibility";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const VOLUME_ROOT = `${API_BASE}/api/volumes/`;

const MODE_OPTIONS = [
  { value: "rw", label: "Read / Write (rw)" },
  { value: "ro", label: "Read Only (ro)" },
];

function extractList(data) {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function friendlyError(err, fallback = "Something went wrong.") {
  const d = err?.response?.data;
  if (!d) return err?.message || fallback;
  if (typeof d === "string") return d;
  if (d.detail) return String(d.detail);
  if (d.error) {
    if (typeof d.error === "string") return d.error;
    try {
      return JSON.stringify(d.error);
    } catch {
      return String(d.error);
    }
  }
  if (d.message) return String(d.message);
  try {
    const parts = Object.entries(d).flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
    );
    if (parts.length) return parts.join(" · ");
  } catch {
    /* ignore */
  }
  return fallback;
}

/** Volume is exclusive to one service (API model). */
function getServiceId(volume) {
  if (volume.service == null || volume.service === "") return null;
  if (typeof volume.service === "object") {
    return volume.service.id ?? volume.service.pk ?? null;
  }
  return String(volume.service);
}

function getServiceName(volume) {
  if (volume.service_name) return volume.service_name;
  if (typeof volume.service === "object" && volume.service?.name) {
    return volume.service.name;
  }
  const sid = getServiceId(volume);
  return sid ? String(sid).slice(0, 8) + "…" : null;
}

function isMounted(volume) {
  if (typeof volume.is_mounted === "boolean") return volume.is_mounted;
  const atts = volume.service_attachments;
  if (atts && typeof atts === "object" && Object.keys(atts).length > 0) {
    return true;
  }
  return false;
}

function statusInfo(volume) {
  const sid = getServiceId(volume);
  const mounted = isMounted(volume);
  if (!sid) {
    return { label: "Unused", color: "default", variant: "outlined" };
  }
  if (mounted) {
    return {
      label: getServiceName(volume) || "Mounted",
      color: "success",
      variant: "filled",
    };
  }
  return {
    label: "Detached (owned)",
    color: "warning",
    variant: "outlined",
  };
}

export default function Volumes() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    default_bind: "/data",
    default_mode: "rw",
    size_mb: "",
  });
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileVolumeName, setFileVolumeName] = useState("");

  const loadVolumes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiRequest({ method: "GET", url: VOLUME_ROOT });
      setVolumes(extractList(resp.data));
    } catch (err) {
      if (err?.response?.status === 404) setVolumes([]);
      else setError(friendlyError(err, "Unable to load volumes."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVolumes();
  }, [loadVolumes]);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(null), 3500);
    return () => clearTimeout(t);
  }, [success]);

  const openEditDialog = (volume) => {
    setCurrentVolume(volume);
    setFormData({
      name: volume.name || "",
      default_bind:
        volume.bind || volume.default_bind || volume.bind_path || "/data",
      default_mode: volume.mode || volume.default_mode || "rw",
      size_mb: String(volume.size_mb ?? ""),
    });
    setDialogOpen(true);
    setError(null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentVolume(null);
    setFormData({
      name: "",
      default_bind: "/data",
      default_mode: "rw",
      size_mb: "",
    });
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveVolume = async () => {
    if (!currentVolume) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        default_bind: formData.default_bind.trim(),
        default_mode: formData.default_mode || "rw",
        size_mb: Number(formData.size_mb),
      };
      if (!payload.default_bind || !payload.default_bind.startsWith("/")) {
        setError("Bind path must be an absolute container path (e.g. /data).");
        return;
      }
      if (!payload.size_mb || Number.isNaN(payload.size_mb) || payload.size_mb < 1) {
        setError("Please enter a valid size in MB.");
        return;
      }

      const id = currentVolume.id ?? currentVolume.pk;
      await apiRequest({
        method: "PATCH",
        url: `${VOLUME_ROOT}${id}/`,
        data: payload,
      });
      setSuccess("Volume updated.");
      closeDialog();
      await loadVolumes();
    } catch (err) {
      setError(friendlyError(err, "Unable to save volume."));
    } finally {
      setSaving(false);
    }
  };

  const handleDetachVolume = async (volume, release = false) => {
    const msg = release
      ? `Hard-release volume "${volume.name}"? Ownership and quota will be cleared.`
      : `Soft-detach volume "${volume.name}"? Ownership is kept (quota still counts).`;
    if (!window.confirm(msg)) return;
    try {
      const id = volume.id ?? volume.pk;
      await apiRequest({
        method: "POST",
        url: `${VOLUME_ROOT}${id}/detach/`,
        data: release ? { release: true } : {},
      });
      setSuccess(release ? "Volume released." : "Volume detached.");
      await loadVolumes();
    } catch (err) {
      setError(friendlyError(err, "Unable to detach volume."));
    }
  };

  const handleDeleteVolume = async (volume) => {
    if (!window.confirm(`Delete volume "${volume.name}"? This cannot be undone.`)) return;
    try {
      const id = volume.id ?? volume.pk;
      await apiRequest({ method: "DELETE", url: `${VOLUME_ROOT}${id}/` });
      setSuccess("Volume deleted.");
      await loadVolumes();
    } catch (err) {
      setError(friendlyError(err, "Unable to delete volume."));
    }
  };

  const handleViewFiles = async (volume) => {
    setFileLoading(true);
    setFileError(null);
    setFileVolumeName(volume.name || "");
    try {
      const id = volume.id ?? volume.pk;
      const resp = await apiRequest({
        method: "GET",
        url: `${VOLUME_ROOT}${id}/files/`,
      });
      const files = resp.data?.files ?? resp.data?.results ?? resp.data;
      setFileList(Array.isArray(files) ? files : []);
      setFileDialogOpen(true);
    } catch (err) {
      setFileError(friendlyError(err, "Unable to load volume files."));
      setFileDialogOpen(true);
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownloadVolume = async (volume) => {
    try {
      const token = localStorage.getItem("access");
      const id = volume.id ?? volume.pk;
      const response = await fetch(`${VOLUME_ROOT}${id}/download/`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || body?.error || "Unable to download archive.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${volume.name || "volume"}.tar.gz`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Failed to download volume.");
    }
  };

  const VolumeCard = ({ volume }) => {
    const bind = volume.bind || volume.default_bind || "—";
    const mode = volume.mode || volume.default_mode || "rw";
    const st = statusInfo(volume);
    const sid = getServiceId(volume);
    const mounted = isMounted(volume);

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          mb: 1.5,
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={700} noWrap>
                {volume.name}
              </Typography>
              <Typography
                variant="body2"
                fontFamily="monospace"
                color="text.secondary"
                sx={{ wordBreak: "break-all", mt: 0.25 }}
              >
                {bind}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={mode}
              sx={{ fontWeight: 700, height: 22, flexShrink: 0, ml: 1 }}
            />
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={volume.size_mb != null ? `${volume.size_mb} MB` : "—"}
              variant="outlined"
              sx={{ fontWeight: 600, height: 22 }}
            />
            <Chip
              size="small"
              label={st.label}
              color={st.color}
              variant={st.variant}
              sx={{ fontWeight: 700, height: 22 }}
            />
            {mounted && (
              <Chip
                size="small"
                label="Mounted"
                color="info"
                sx={{ fontWeight: 700, height: 22 }}
              />
            )}
          </Stack>

          {sid && (
            <Typography variant="caption" color="text.secondary">
              Service: {getServiceName(volume) || sid}
            </Typography>
          )}

          <Divider />

          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Files">
              <IconButton size="small" onClick={() => handleViewFiles(volume)}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download">
              <IconButton size="small" onClick={() => handleDownloadVolume(volume)}>
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit metadata (only if not yet in Docker)">
              <IconButton size="small" onClick={() => openEditDialog(volume)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {sid && (
              <Tooltip title="Soft-detach (keep ownership / quota)">
                <IconButton
                  size="small"
                  onClick={() => handleDetachVolume(volume, false)}
                >
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Delete">
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteVolume(volume)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={1.5}
        sx={{ mb: 2.5 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              display: "grid",
              placeItems: "center",
              bgcolor: "primary.main",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <StorageIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={800}
              sx={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
            >
              Volumes
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              One volume → one service (exclusive)
            </Typography>
          </Box>
        </Stack>

        <IconButton
          onClick={loadVolumes}
          disabled={loading}
          size="small"
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            alignSelf: { xs: "flex-end", sm: "center" },
          }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Stack>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 1 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 1 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={32} />
        </Box>
      ) : volumes.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            py: 6,
            textAlign: "center",
          }}
        >
          <Typography color="text.secondary">No volumes yet.</Typography>
        </Paper>
      ) : isMobile || isTablet ? (
        <Box>
          {volumes.map((volume) => (
            <VolumeCard key={volume.id ?? volume.pk} volume={volume} />
          ))}
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 1,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: "action.hover",
                    "& th": {
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      py: 1.25,
                    },
                  }}
                >
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Bind path</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Mode</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Service</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {volumes.map((volume) => {
                  const id = volume.id ?? volume.pk;
                  const bind = volume.bind || volume.default_bind || "—";
                  const mode = volume.mode || volume.default_mode || "rw";
                  const st = statusInfo(volume);
                  const sid = getServiceId(volume);
                  const mounted = isMounted(volume);
                  return (
                    <TableRow
                      key={id}
                      hover
                      sx={{
                        "& td": {
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          py: 1,
                        },
                        "&:last-child td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={600} fontSize={14}>
                          {volume.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          fontSize={13}
                          sx={{ wordBreak: "break-all" }}
                        >
                          {bind}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={mode}
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {volume.size_mb != null ? `${volume.size_mb} MB` : "—"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {sid ? (
                          <Typography fontSize={13} fontWeight={600}>
                            {getServiceName(volume) || sid}
                          </Typography>
                        ) : (
                          <Typography fontSize={13} color="text.secondary">
                            —
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Chip
                            size="small"
                            label={st.label}
                            color={st.color}
                            variant={st.variant}
                            sx={{ fontWeight: 700, height: 22 }}
                          />
                          {mounted && (
                            <Chip
                              size="small"
                              label="Mounted"
                              color="info"
                              sx={{ fontWeight: 700, height: 22 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                          <Tooltip title="Files">
                            <IconButton
                              size="small"
                              onClick={() => handleViewFiles(volume)}
                            >
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={() => handleDownloadVolume(volume)}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit metadata">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(volume)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {sid && (
                            <Tooltip title="Soft-detach">
                              <IconButton
                                size="small"
                                onClick={() => handleDetachVolume(volume, false)}
                              >
                                <LinkOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteVolume(volume)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit volume</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
            Metadata (path, size, mode) can only change before the volume exists in
            Docker. After provision, detach/delete and recreate if you need changes.
          </Alert>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              name="name"
              value={formData.name}
              disabled
              helperText="Name cannot be changed here"
            />
            <TextField
              fullWidth
              size="small"
              label="Bind directory"
              name="default_bind"
              value={formData.default_bind}
              onChange={handleFormChange}
              placeholder="/data"
              helperText="Path inside the container (e.g. /var/lib/mysql)"
            />
            <TextField
              fullWidth
              size="small"
              label="Size (MB)"
              name="size_mb"
              type="number"
              value={formData.size_mb}
              onChange={handleFormChange}
              inputProps={{ min: 1 }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Access mode</InputLabel>
              <Select
                name="default_mode"
                value={formData.default_mode}
                label="Access mode"
                onChange={handleFormChange}
              >
                {MODE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={closeDialog} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveVolume}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fileDialogOpen}
        onClose={() => setFileDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Files — {fileVolumeName || "volume"}
        </DialogTitle>
        <DialogContent dividers>
          {fileLoading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : fileError ? (
            <Alert severity="error" sx={{ borderRadius: 1 }}>
              {fileError}
            </Alert>
          ) : fileList.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
              No files in this volume.
            </Typography>
          ) : isMobile ? (
            <Stack spacing={1}>
              {fileList.map((item, index) => (
                <Paper
                  key={`${item.path}-${index}`}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    fontFamily="monospace"
                    fontSize={13}
                    sx={{ wordBreak: "break-all" }}
                  >
                    {item.path || "./"}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                    <Chip
                      size="small"
                      label={item.type || "file"}
                      sx={{ height: 20, fontSize: 11 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {item.size != null ? `${item.size} B` : "—"}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: "action.hover",
                      "& th": {
                        borderBottom: "1px solid",
                        borderColor: "divider",
                        py: 1,
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Path</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fileList.map((item, index) => (
                    <TableRow
                      key={`${item.path}-${index}`}
                      sx={{
                        "& td": {
                          borderBottom: "1px solid",
                          borderColor: "divider",
                          py: 0.75,
                        },
                        "&:last-child td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontFamily: "monospace",
                          fontSize: 13,
                          wordBreak: "break-all",
                        }}
                      >
                        {item.path || "./"}
                      </TableCell>
                      <TableCell sx={{ fontSize: 13 }}>{item.type || "file"}</TableCell>
                      <TableCell sx={{ fontSize: 13 }}>
                        {item.size != null ? `${item.size} B` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setFileDialogOpen(false)}
            sx={{ textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
