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
  IconButton,
  Paper,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import HubIcon from "@mui/icons-material/Hub";
import RefreshIcon from "@mui/icons-material/Refresh";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`;
const NETWORK_ROOT = `${API_BASE}/api/networks/`;

const DEFAULT_FORM = { name: "", description: "" };

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

export default function Networks() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));

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
      setNetworks(extractList(resp.data));
    } catch (err) {
      if (err?.response?.status === 404) setNetworks([]);
      else setError(friendlyError(err, "Unable to load networks."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetworks();
  }, [loadNetworks]);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(null), 3500);
    return () => clearTimeout(t);
  }, [success]);

  const openCreateDialog = () => {
    setCurrentNetwork(null);
    setFormData(DEFAULT_FORM);
    setDialogOpen(true);
    setError(null);
  };

  const openEditDialog = (network) => {
    setCurrentNetwork(network);
    setFormData({
      name: network.name || "",
      description: network.description || "",
    });
    setDialogOpen(true);
    setError(null);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCurrentNetwork(null);
    setFormData(DEFAULT_FORM);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveNetwork = async () => {
    setSaving(true);
    setError(null);
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
        const id = currentNetwork.id ?? currentNetwork.pk;
        await apiRequest({
          method: "PATCH",
          url: `${NETWORK_ROOT}${id}/`,
          data: payload,
        });
        setSuccess("Network updated.");
      } else {
        await apiRequest({ method: "POST", url: NETWORK_ROOT, data: payload });
        setSuccess("Network created.");
      }
      closeDialog();
      await loadNetworks();
    } catch (err) {
      setError(friendlyError(err, "Unable to save network."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNetwork = async (network) => {
    const connected = network.connected_services ?? 0;
    if (connected > 0) {
      setError("Cannot delete a network that still has connected services.");
      return;
    }
    if (!window.confirm(`Delete network "${network.name}"?`)) return;
    try {
      const id = network.id ?? network.pk;
      await apiRequest({ method: "DELETE", url: `${NETWORK_ROOT}${id}/` });
      setSuccess("Network deleted.");
      await loadNetworks();
    } catch (err) {
      setError(friendlyError(err, "Unable to delete network."));
    }
  };

  // Mobile card view for each network
  const NetworkCard = ({ network }) => {
    const id = network.id ?? network.pk;
    const connected = network.connected_services ?? 0;

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
                {network.name}
              </Typography>
              {network.description ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {network.description}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ mt: 0.25 }}>
                  No description
                </Typography>
              )}
            </Box>
            <Chip
              size="small"
              label={`${connected} service${connected !== 1 ? "s" : ""}`}
              color={connected > 0 ? "info" : "default"}
              sx={{ fontWeight: 700, height: 22, flexShrink: 0, ml: 1 }}
            />
          </Stack>

          <Divider />

          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEditDialog(network)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip
              title={
                connected > 0
                  ? "Detach services before deleting"
                  : "Delete"
              }
            >
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={connected > 0}
                  onClick={() => handleDeleteNetwork(network)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
      {/* Header */}
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
            <HubIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant={isMobile ? "h6" : "h5"}
              fontWeight={800}
              sx={{ letterSpacing: "-0.01em", lineHeight: 1.2 }}
            >
              Networks
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              Private Docker networks for your services
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", sm: "auto" } }}>
          <IconButton
            onClick={loadNetworks}
            disabled={loading}
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              flexShrink: 0,
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            fullWidth={isMobile}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 1,
              whiteSpace: "nowrap",
            }}
          >
            Create network
          </Button>
        </Stack>
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

      {/* Content */}
      {loading ? (
        <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={32} />
        </Box>
      ) : networks.length === 0 ? (
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
          <Typography color="text.secondary" gutterBottom>
            No networks yet.
          </Typography>
          <Button
            sx={{ mt: 1, textTransform: "none", fontWeight: 700, borderRadius: 1 }}
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
          >
            Create your first network
          </Button>
        </Paper>
      ) : isMobile || isTablet ? (
        /* Card layout for mobile / tablet */
        <Box>
          {networks.map((network) => (
            <NetworkCard key={network.id ?? network.pk} network={network} />
          ))}
        </Box>
      ) : (
        /* Table layout for desktop */
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
            <Table size="small" sx={{ minWidth: 480 }}>
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
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 13 }}>Services</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 13 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {networks.map((network) => {
                  const id = network.id ?? network.pk;
                  const connected = network.connected_services ?? 0;
                  return (
                    <TableRow
                      key={id}
                      hover
                      sx={{
                        "& td": { borderBottom: "1px solid", borderColor: "divider", py: 1 },
                        "&:last-child td": { borderBottom: 0 },
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={600} fontSize={14}>
                          {network.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {network.description || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={connected}
                          color={connected > 0 ? "info" : "default"}
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(network)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={
                              connected > 0
                                ? "Detach services before deleting"
                                : "Delete"
                            }
                          >
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={connected > 0}
                                onClick={() => handleDeleteNetwork(network)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
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

      {/* Create / Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {currentNetwork ? "Edit network" : "Create network"}
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
              autoFocus
            />
            <TextField
              fullWidth
              size="small"
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={closeDialog} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveNetwork}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1 }}
          >
            {saving ? "Saving…" : currentNetwork ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
