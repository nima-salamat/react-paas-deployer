import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Avatar, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, List, ListItem, ListItemAvatar, ListItemText,
  Stack, Typography,
} from "@mui/material";
import ComputerIcon from "@mui/icons-material/Computer";
import SmartphoneIcon from "@mui/icons-material/Smartphone";
import BlockIcon from "@mui/icons-material/Block";
import { MSG_API, authHeaders } from "../api";
import {
  getSecureMatrixSession, shutdownSecureMatrixClient,
} from "./MatrixSecureClient";

async function parseApiResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("The secure-device endpoint returned an invalid response.");
  }
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || "Secure-device operation failed.");
  }
  return body?.data ?? body;
}

export default function MatrixDevicesDialog({ open, onClose }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyDevice, setBusyDevice] = useState("");
  const [pendingRevoke, setPendingRevoke] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = getSecureMatrixSession();
      const response = await fetch(`${MSG_API}/secure/devices/`, {
        headers: authHeaders({
          ...(session?.deviceId ? { "X-Matrix-Device-ID": session.deviceId } : {}),
        }),
      });
      const data = await parseApiResponse(response);
      setDevices(Array.isArray(data?.results) ? data.results : []);
    } catch (err) {
      setError(err?.message || "Could not load Matrix devices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadDevices();
  }, [open, loadDevices]);

  const revoke = async (device) => {
    if (!device?.device_id || busyDevice) return;
    setBusyDevice(device.device_id);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${MSG_API}/secure/devices/${encodeURIComponent(device.device_id)}/revoke/`,
        {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({}),
        },
      );
      await parseApiResponse(response);
      const session = getSecureMatrixSession();
      const isCurrent = device.is_current || session?.deviceId === device.device_id;
      if (isCurrent) {
        shutdownSecureMatrixClient();
      }
      setPendingRevoke(null);
      setMessage(isCurrent
        ? "This device was revoked. Its secure session was cleared; opening secure chat again requires a new device and the existing recovery process."
        : `Device “${device.display_name || device.device_id}” was revoked.`);
      await loadDevices();
    } catch (err) {
      setError(err?.message || "Could not revoke the Matrix device.");
    } finally {
      setBusyDevice("");
    }
  };

  return (
    <Dialog open={Boolean(open)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Secure devices</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          <Alert severity="info">
            Revoking a device stops its Matrix session from receiving future room events and keys. It cannot delete message copies or keys that device already saved. Only devices registered through this Paas Deployer account appear here.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          {loading && <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}><CircularProgress size={22} /></Box>}
          {!loading && devices.length === 0 && (
            <Typography color="text.secondary" variant="body2">
              No Matrix devices are registered for this account yet.
            </Typography>
          )}
          <List disablePadding>
            {devices.map((device) => {
              const isCurrent = Boolean(device.is_current);
              const revoked = Boolean(device.revoked_at);
              return (
                <ListItem
                  key={device.device_id}
                  divider
                  alignItems="flex-start"
                  secondaryAction={(
                    <Button
                      size="small"
                      color="error"
                      startIcon={<BlockIcon />}
                      disabled={revoked || Boolean(busyDevice)}
                      onClick={() => setPendingRevoke(device)}
                    >
                      {revoked ? "Revoked" : "Revoke"}
                    </Button>
                  )}
                  sx={{ pr: 13, py: 1.25 }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: isCurrent ? "primary.main" : "action.selected", color: isCurrent ? "primary.contrastText" : "text.primary" }}>
                      {/Android|iPhone|iPad|Mobile/i.test(device.display_name || "") ? <SmartphoneIcon /> : <ComputerIcon />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={(
                      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75 }}>
                        <Typography component="span" fontWeight={700}>
                          {device.display_name || "Paas Deployer browser"}
                        </Typography>
                        {isCurrent && <Typography component="span" color="primary.main" variant="caption">(this device)</Typography>}
                        {revoked && <Typography component="span" color="error.main" variant="caption">(revoked)</Typography>}
                      </Box>
                    )}
                    secondary={(
                      <>
                        <Typography component="span" variant="caption" sx={{ display: "block", overflowWrap: "anywhere" }}>
                          Device ID: {device.device_id}
                        </Typography>
                        <Typography component="span" variant="caption" sx={{ display: "block" }}>
                          Registered: {device.created_at ? new Date(device.created_at).toLocaleString() : "Unknown"}
                        </Typography>
                      </>
                    )}
                  />
                </ListItem>
              );
            })}
          </List>
          {pendingRevoke && (
            <Alert
              severity="warning"
              action={(
                <Stack direction="row" spacing={1}>
                  <Button color="inherit" size="small" onClick={() => setPendingRevoke(null)}>Cancel</Button>
                  <Button color="error" size="small" disabled={Boolean(busyDevice)} onClick={() => void revoke(pendingRevoke)}>
                    {busyDevice ? "Revoking…" : "Confirm"}
                  </Button>
                </Stack>
              )}
            >
              Revoke {pendingRevoke.display_name || pendingRevoke.device_id}? This action does not erase content already downloaded by that device.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={() => void loadDevices()} disabled={loading || Boolean(busyDevice)}>Refresh</Button>
      </DialogActions>
    </Dialog>
  );
}
