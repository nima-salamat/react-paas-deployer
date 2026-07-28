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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = "http://127.0.0.1:8000";
const NETWORK_ROOT = `${API_BASE}/services/networks/`;

const DEFAULT_FORM = {
  name: "",
  description: "",
};

export default function Networks() {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);

  const loadNetworks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiRequest({ method: "GET", url: NETWORK_ROOT });
      const data = resp.data;
      setNetworks(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error(err);
      setError("Unable to load networks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetworks();
  }, [loadNetworks]);

  const openCreateDialog = () => {
    setCurrentNetwork(null);
    setFormData(DEFAULT_FORM);
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const openEditDialog = (network) => {
    setCurrentNetwork(network);
    setFormData({ name: network.name || "", description: network.description || "" });
    setDialogOpen(true);
    setError(null);
    setSuccess(null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentNetwork(null);
    setFormData(DEFAULT_FORM);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveNetwork = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
      };
      if (!payload.name) {
        setError("Network name is required.");
        return;
      }
      if (currentNetwork) {
        await apiRequest({ method: "PATCH", url: `${NETWORK_ROOT}${currentNetwork.id}/`, data: payload });
        setSuccess("Network updated successfully.");
      } else {
        await apiRequest({ method: "POST", url: NETWORK_ROOT, data: payload });
        setSuccess("Network created successfully.");
      }
      closeDialog();
      await loadNetworks();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.response?.data?.detail || "Unable to save network.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNetwork = async (network) => {
    if (!window.confirm(`Delete network '${network.name}'?`)) return;
    setError(null);
    setSuccess(null);
    try {
      await apiRequest({ method: "DELETE", url: `${NETWORK_ROOT}${network.id}/` });
      setSuccess("Network deleted successfully.");
      await loadNetworks();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.response?.data?.error || "Unable to delete network.");
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Network Management
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Create, edit and remove private networks used by your services.
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreateDialog}>
          Create Network
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
                  <TableCell>Description</TableCell>
                  <TableCell>Connected Services</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {networks.map((network) => (
                  <TableRow key={network.id}>
                    <TableCell>{network.name}</TableCell>
                    <TableCell>{network.description || "—"}</TableCell>
                    <TableCell>{network.connected_services ?? 0}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <IconButton size="small" onClick={() => openEditDialog(network)} aria-label="Edit network">
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteNetwork(network)}
                          aria-label="Delete network"
                          disabled={network.connected_services > 0}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {networks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      No networks found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{currentNetwork ? "Edit Network" : "Create Network"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleFormChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                multiline
                minRows={3}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSaveNetwork} variant="contained" disabled={saving}>
            {currentNetwork ? "Save Changes" : "Create Network"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
