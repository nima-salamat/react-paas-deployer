import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Alert,
  Stack,
  IconButton,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = "http://127.0.0.1:8000";
const VOLUME_ROOT = `${API_BASE}/services/volume/`;
const SERVICE_ROOT = `${API_BASE}/services/service/`;
const MODE_OPTIONS = [
  { value: "readwrite", label: "Read / Write" },
  { value: "read", label: "Read Only" },
  { value: "write", label: "Write Only" },
];

const DEFAULT_FORM = {
  name: "",
  bind: "/data",
  mode: "readwrite",
  size_mb: "",
  service: "",
};

export default function Volumes() {
  const [volumes, setVolumes] = useState([]);
  const [services, setServices] = useState([]);
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

  const loadVolumes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiRequest({ method: "GET", url: VOLUME_ROOT });
      const data = resp.data;
      setVolumes(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load volumes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const resp = await apiRequest({ method: "GET", url: SERVICE_ROOT });
      const data = resp.data;
      setServices(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadVolumes();
    loadServices();
  }, [loadVolumes, loadServices]);

  const openCreateDialog = () => {
    setCurrentVolume(null);
    setFormData(DEFAULT_FORM);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEditDialog = (volume) => {
    setCurrentVolume(volume);
    setFormData({
      name: volume.name,
      bind: volume.bind || "/data",
      mode: volume.mode || "readwrite",
      size_mb: String(volume.size_mb || ""),
      service: volume.service || "",
    });
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentVolume(null);
    setFormData(DEFAULT_FORM);
  };

  const handleSaveVolume = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: formData.name.trim(),
        bind: formData.bind.trim(),
        mode: formData.mode,
        size_mb: Number(formData.size_mb),
        service: formData.service || null,
      };

      if (!payload.name) {
        setError("Volume name is required.");
        return;
      }
      if (!payload.bind) {
        setError("Bind path is required.");
        return;
      }
      if (!payload.size_mb || Number.isNaN(payload.size_mb) || payload.size_mb < 1) {
        setError("Please enter a valid size in MB.");
        return;
      }

      if (currentVolume) {
        await apiRequest({ method: "PATCH", url: `${VOLUME_ROOT}${currentVolume.id}/`, data: payload });
        setSuccess("Volume updated successfully.");
      } else {
        await apiRequest({ method: "POST", url: VOLUME_ROOT, data: payload });
        setSuccess("Volume created successfully.");
      }
      closeDialog();
      await loadVolumes();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.message || "Unable to save volume.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVolume = async (volume) => {
    if (!window.confirm(`Delete volume '${volume.name}'? This cannot be undone.`)) return;
    setError(null);
    setSuccess(null);
    try {
      await apiRequest({ method: "DELETE", url: `${VOLUME_ROOT}${volume.id}/` });
      setSuccess("Volume deleted.");
      await loadVolumes();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.detail || "Unable to delete volume.");
    }
  };

  const handleViewFiles = async (volume) => {
    setFileLoading(true);
    setFileError(null);
    try {
      const resp = await apiRequest({ method: "GET", url: `${VOLUME_ROOT}${volume.id}/files/` });
      setFileList(Array.isArray(resp.data.files) ? resp.data.files : []);
      setFileDialogOpen(true);
    } catch (err) {
      console.error(err);
      setFileError(err.response?.data?.detail || "Unable to load volume file list.");
    } finally {
      setFileLoading(false);
    }
  };

  const handleDownloadVolume = async (volume) => {
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem("access");
      const response = await fetch(`${VOLUME_ROOT}${volume.id}/download/`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.detail || "Unable to download archive.");
      }
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${volume.name}.tar.gz`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to download volume archive.");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Volume Management
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Create, edit, download and delete volumes for your services.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreateDialog}>
          Create Volume
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Paper elevation={3} sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Bind Path</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Size (MB)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {volumes.map((volume) => (
                  <TableRow key={volume.id}>
                    <TableCell>{volume.name}</TableCell>
                    <TableCell>{volume.bind}</TableCell>
                    <TableCell>{volume.mode}</TableCell>
                    <TableCell>{volume.size_mb}</TableCell>
                    <TableCell>{volume.is_unused ? "Unused" : volume.service_name || "Attached"}</TableCell>
                    <TableCell>{volume.service_name || "—"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" startIcon={<VisibilityIcon />} onClick={() => handleViewFiles(volume)}>
                          Files
                        </Button>
                        <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownloadVolume(volume)}>
                          Download
                        </Button>
                        <IconButton size="small" onClick={() => openEditDialog(volume)} aria-label="Edit volume">
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteVolume(volume)} aria-label="Delete volume">
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {volumes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      No volumes found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{currentVolume ? "Edit Volume" : "Create Volume"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Volume Name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
                disabled={Boolean(currentVolume)}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bind Path"
                name="bind"
                value={formData.bind}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Size (MB)"
                name="size_mb"
                type="number"
                value={formData.size_mb}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Mode</InputLabel>
                <Select name="mode" value={formData.mode} label="Mode" onChange={handleFormChange}>
                  {MODE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Attach Service</InputLabel>
                <Select name="service" value={formData.service || ""} label="Attach Service" onChange={handleFormChange}>
                  <MenuItem value="">No service</MenuItem>
                  {services.map((service) => (
                    <MenuItem key={service.id} value={service.id}>
                      {service.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSaveVolume} variant="contained" disabled={saving}>
            {currentVolume ? "Save changes" : "Create Volume"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={fileDialogOpen} onClose={() => setFileDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Volume Files</DialogTitle>
        <DialogContent>
          {fileLoading ? (
            <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress />
            </Box>
          ) : fileError ? (
            <Alert severity="error">{fileError}</Alert>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Path</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Size</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fileList.map((item, index) => (
                    <TableRow key={`${item.path}-${index}`}>
                      <TableCell>{item.path || "./"}</TableCell>
                      <TableCell>{item.type || "file"}</TableCell>
                      <TableCell>{item.size ? `${item.size} bytes` : "-"}</TableCell>
                    </TableRow>
                  ))}
                  {fileList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No files found in this volume.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
