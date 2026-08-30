/**
 * GroupSharedServicesPanel — list / share / manage rules for services in a group.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Tooltip,
} from "@mui/material";
import ShareIcon from "@mui/icons-material/Share";
import SettingsIcon from "@mui/icons-material/Settings";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import CloudQueueIcon from "@mui/icons-material/CloudQueue";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import apiRequest from "../../customHooks/apiRequest";
import ShareServiceDialog from "../../service/services/ShareServiceDialog";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const SERVICES_ROOT = `${API_BASE}/services`;

export default function GroupSharedServicesPanel({ activeConv, meId, onClose }) {
  const groupId = activeConv?.id ?? activeConv?.pk;
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [editShare, setEditShare] = useState(null);
  const [pickServiceOpen, setPickServiceOpen] = useState(false);
  const [myServices, setMyServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);

  const loadShares = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest({
        method: "GET",
        url: `${SERVICES_ROOT}/services/groups/${groupId}/shares/`,
      });
      const data = res?.data || {};
      setShares(Array.isArray(data.shares) ? data.shares : []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load shares");
      setShares([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const openNewShare = async () => {
    setEditShare(null);
    setSelectedService(null);
    try {
      const res = await apiRequest({ method: "GET", url: `${SERVICES_ROOT}/services/mine/` });
      const list = res?.data?.services || res?.data?.results || [];
      setMyServices(Array.isArray(list) ? list : []);
    } catch {
      setMyServices([]);
    }
    setPickServiceOpen(true);
  };

  const openEdit = (share) => {
    setEditShare(share);
    setSelectedService(null);
    setShareOpen(true);
  };

  const handleUnshare = async (share) => {
    try {
      await apiRequest({
        method: "DELETE",
        url: `${SERVICES_ROOT}/services/shares/${share.id}/`,
      });
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Unshare failed");
    }
  };

  const runAction = async (share, action) => {
    const serviceId = share.service_id || share.service?.id;
    if (!serviceId) return;
    const pathMap = {
      start: `${SERVICES_ROOT}/start_service/`,
      stop: `${SERVICES_ROOT}/stop_service/`,
      restart: `${SERVICES_ROOT}/restart_service/`,
    };
    const path = pathMap[action];
    if (!path) return;
    try {
      await apiRequest({ method: "POST", url: path, data: { service_id: serviceId } });
      loadShares();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Action failed");
    }
  };

  if (!groupId || String(activeConv?.type || "").toLowerCase() !== "group") {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Shared services are only available in groups.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <CloudQueueIcon fontSize="small" color="primary" />
        <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1 }}>
          Shared services
        </Typography>
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={loadShares} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          disableElevation
          startIcon={<ShareIcon />}
          onClick={openNewShare}
          sx={{ textTransform: "none", fontWeight: 700, borderRadius: 1.5 }}
        >
          Share
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ m: 1.5 }} onClose={() => setError("")}>
          {String(error)}
        </Alert>
      ) : null}

      <Box sx={{ flex: 1, overflow: "auto", px: 0.5 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : shares.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No services shared with this group yet.
            </Typography>
            <Button size="small" startIcon={<ShareIcon />} onClick={openNewShare} sx={{ mt: 1.5, textTransform: "none" }}>
              Share a service
            </Button>
          </Box>
        ) : (
          <List dense disablePadding>
            {shares.map((share) => {
              const name = share.service_name || share.service?.name || share.service_id || "Service";
              const status = share.service_status || share.service?.status || "—";
              const isOwner = String(share.shared_by_id) === String(meId);
              const perms = share.my_permissions || share.rules || {};
              return (
                <ListItem
                  key={share.id}
                  alignItems="flex-start"
                  sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1.25 }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" fontWeight={700}>
                          {name}
                        </Typography>
                        <Chip size="small" label={status} sx={{ height: 20, fontWeight: 700 }} />
                        {isOwner && <Chip size="small" color="info" variant="outlined" label="Mine" sx={{ height: 20 }} />}
                        {share.admin_only && (
                          <Chip size="small" color="warning" variant="outlined" label="Admins only" sx={{ height: 20 }} />
                        )}
                        {share.preset && (
                          <Chip size="small" variant="outlined" label={share.preset} sx={{ height: 20 }} />
                        )}
                        {share.expires_at && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`exp ${new Date(share.expires_at).toLocaleDateString()}`}
                            sx={{ height: 20 }}
                          />
                        )}
                      </Stack>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        by {share.shared_by_username || "—"}
                        {share.note ? ` · ${share.note}` : ""}
                      </Typography>
                    }
                  />
                  <Stack direction="row" spacing={0.25} alignItems="center">
                    {perms.can_start && (
                      <Tooltip title="Start">
                        <IconButton size="small" onClick={() => runAction(share, "start")}>
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {perms.can_stop && (
                      <Tooltip title="Stop">
                        <IconButton size="small" onClick={() => runAction(share, "stop")}>
                          <StopIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {perms.can_restart && (
                      <Tooltip title="Restart">
                        <IconButton size="small" onClick={() => runAction(share, "restart")}>
                          <RestartAltIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {isOwner && (
                      <>
                        <Tooltip title="Rules">
                          <IconButton size="small" onClick={() => openEdit(share)}>
                            <SettingsIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Unshare">
                          <IconButton size="small" color="warning" onClick={() => handleUnshare(share)}>
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    {!isOwner && (
                      <Tooltip title="View permissions">
                        <IconButton size="small" onClick={() => openEdit(share)}>
                          <SettingsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>

      {/* Pick service then open ShareServiceDialog */}
      {pickServiceOpen && (
        <ShareServiceDialog
          open={Boolean(selectedService) || pickServiceOpen}
          onClose={() => {
            setPickServiceOpen(false);
            setSelectedService(null);
          }}
          service={selectedService}
          fixedGroupId={groupId}
          fixedGroupTitle={activeConv?.title || ""}
          onDone={() => {
            setPickServiceOpen(false);
            setSelectedService(null);
            loadShares();
          }}
        />
      )}

      {/* Service picker overlay when no service selected yet */}
      {pickServiceOpen && !selectedService && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "background.paper",
            zIndex: 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ flex: 1 }}>
              Select your service
            </Typography>
            <Button size="small" onClick={() => setPickServiceOpen(false)}>
              Cancel
            </Button>
          </Stack>
          <List dense sx={{ overflow: "auto", flex: 1 }}>
            {myServices.length === 0 ? (
              <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  You have no services to share.
                </Typography>
              </Box>
            ) : (
              myServices.map((s) => (
                <ListItem
                  key={s.id ?? s.pk}
                  button
                  onClick={() => {
                    setSelectedService(s);
                  }}
                >
                  <ListItemText primary={s.name || s.id} secondary={s.status || ""} />
                </ListItem>
              ))
            )}
          </List>
        </Box>
      )}

      {editShare && (
        <ShareServiceDialog
          open={Boolean(editShare)}
          onClose={() => setEditShare(null)}
          existingShare={editShare}
          fixedGroupId={groupId}
          fixedGroupTitle={activeConv?.title || ""}
          onDone={() => {
            setEditShare(null);
            loadShares();
          }}
        />
      )}
    </Box>
  );
}
