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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import StorageIcon from "@mui/icons-material/Storage";
import VisibilityIcon from "@mui/icons-material/Visibility";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const VOLUME_ROOT = `${API_BASE}/api/volumes/`;
const SERVICE_ROOT = `${API_BASE}/services/service/`;

const MODE_OPTIONS = [
  { value: "rw", label: "Read / Write (rw)" },
  { value: "ro", label: "Read Only (ro)" },
];

const DEFAULT_FORM = {
  name: "",
  default_bind: "/data",
  default_mode: "rw",
  size_mb: "1024",
};

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
  if (d.error) return String(d.error);
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

export default function Volumes() {
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
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

  const openCreateDialog = () => {
    setCurrentVolume(null);
    setFormData(DEFAULT_FORM);
    setDialogOpen(true);
    setError(null);
  };

  const openEditDialog = (volume) => {
    setCurrentVolume(volume);
    setFormData({
      name: volume.name || "",
      default_bind: volume.default_bind || volume.bind || "/data",
      default_mode: volume.default_mode || volume.mode || "rw",
      size_mb: String(volume.size_mb || ""),
    });
    setDialogOpen(true);
    setError(null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentVolume(null);
    setFormData(DEFAULT_FORM);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveVolume = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        default_bind: formData.default_bind.trim(),
        default_mode: formData.default_mode || "rw",
        size_mb: Number(formData.size_mb),
      };
      if (!payload.name) {
        setError("Volume name is required.");
        return;
      }
      if (!payload.default_bind || !payload.default_bind.startsWith("/")) {
        setError("Bind path must be an absolute container path (e.g. /data).");
        return;
      }
      if (!payload.size_mb || Number.isNaN(payload.size_mb) || payload.size_mb < 1) {
        setError("Please enter a valid size in MB.");
        return;
      }

      if (currentVolume) {
        const id = currentVolume.id ?? currentVolume.pk;
        // name is typically immutable
        const { name, ...patch } = payload;
        await apiRequest({
          method: "PATCH",
          url: `${VOLUME_ROOT}${id}/`,
          data: patch,
        });
        setSuccess("Volume updated.");
      } else {
        await apiRequest({ method: "POST", url: VOLUME_ROOT, data: payload });
        setSuccess("Volume created.");
      }
      closeDialog();
      await loadVolumes();
    } catch (err) {
      setError(friendlyError(err, "Unable to save volume."));
    } finally {
      setSaving(false);
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
        throw new Error(body?.detail || "Unable to download archive.");
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

  const attachedLabel = (v) => {
    if (v.is_unused) return "Unused";
    if (v.attached_services_count != null) return `${v.attached_services_count} service(s)`;
    if (v.service_name) return v.service_name;
    if (v.attached_services?.length) return `${v.attached_services.length} service(s)`;
    return "—";
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3.5 } }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", sm: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: "grid",
                placeItems: "center",
                bgcolor: "primary.main",
                color: "#fff",
              }}
            >
              <StorageIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: "-0.02em" }}>
                Volumes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Named Docker volumes for your services
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton
            onClick={loadVolumes}
            disabled={loading}
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
          >
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            Create volume
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          borderRadius: 2.5,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Bind path</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Mode</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {volumes.map((volume) => {
                  const id = volume.id ?? volume.pk;
                  const bind = volume.default_bind || volume.bind || "—";
                  const mode = volume.default_mode || volume.mode || "rw";
                  return (
                    <TableRow key={id} hover>
                      <TableCell>
                        <Typography fontWeight={700}>{volume.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {bind}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={mode} sx={{ fontWeight: 700, height: 22 }} />
                      </TableCell>
                      <TableCell>{volume.size_mb != null ? `${volume.size_mb} MB` : "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={attachedLabel(volume)}
                          color={volume.is_unused ? "default" : "success"}
                          variant={volume.is_unused ? "outlined" : "filled"}
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleViewFiles(volume)} title="Files">
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDownloadVolume(volume)} title="Download">
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => openEditDialog(volume)} title="Edit">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteVolume(volume)}
                            title="Delete"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {volumes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                      <Typography color="text.secondary">No volumes yet.</Typography>
                      <Button
                        sx={{ mt: 1.5, textTransform: "none", fontWeight: 700 }}
                        startIcon={<AddIcon />}
                        onClick={openCreateDialog}
                      >
                        Create your first volume
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2.5 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {currentVolume ? "Edit volume" : "Create volume"}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Name"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              disabled={Boolean(currentVolume)}
              helperText={currentVolume ? "Name cannot be changed" : "Unique Docker volume name"}
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeDialog} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveVolume}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
          >
            {saving ? "Saving…" : currentVolume ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={fileDialogOpen}
        onClose={() => setFileDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Files — {fileVolumeName || "volume"}
        </DialogTitle>
        <DialogContent>
          {fileLoading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : fileError ? (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {fileError}
            </Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Path</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fileList.map((item, index) => (
                    <TableRow key={`${item.path}-${index}`}>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                        {item.path || "./"}
                      </TableCell>
                      <TableCell>{item.type || "file"}</TableCell>
                      <TableCell>{item.size != null ? `${item.size} B` : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {fileList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        No files in this volume.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFileDialogOpen(false)} sx={{ textTransform: "none" }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
