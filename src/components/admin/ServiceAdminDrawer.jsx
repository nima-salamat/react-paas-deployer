import React, { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, IconButton, Paper, Stack, TextField, Toolbar, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import StorageIcon from "@mui/icons-material/Storage";
import apiRequest from "../customHooks/apiRequest";
import { hostBase, svcApi, deployApi } from "./adminUtils";

/**
 * Staff service inspector — resources are owned by the service's user, not the admin.
 */
export default function ServiceAdminDrawer({
  svcDetail,
  onClose,
  svcDeploys = [],
  svcVolumes = [],
  svcNetworks = [],
  detailTab,
  setDetailTab,
  onAction,
  onRefresh,
  setToast,
}) {
  const SVC_API = svcApi();
  const DEPLOY_API = deployApi();
  const ownerId = svcDetail?.user_info?.id || svcDetail?.user;
  const ownerName = svcDetail?.user_info?.username || svcDetail?.user_username || "user";

  const [deployOpen, setDeployOpen] = useState(false);
  const [deployName, setDeployName] = useState("");
  const [deployVersion, setDeployVersion] = useState("1.0");
  const [deployConfig, setDeployConfig] = useState("{}");
  const [deployFile, setDeployFile] = useState(null);
  const [busy, setBusy] = useState(false);

  const [volOpen, setVolOpen] = useState(false);
  const [volName, setVolName] = useState("");
  const [volSize, setVolSize] = useState("1024");
  const [volBind, setVolBind] = useState("/data");

  const [netOpen, setNetOpen] = useState(false);
  const [netName, setNetName] = useState("");
  const [netDesc, setNetDesc] = useState("");

  if (!svcDetail) return null;

  const createDeploy = async () => {
    const name = (deployName || "").trim();
    if (name.length < 4) { setToast("Deploy name must be at least 4 characters"); return; }
    setBusy(true);
    try {
      let configObj = {};
      try { configObj = deployConfig ? JSON.parse(deployConfig) : {}; }
      catch { setToast("Invalid config JSON"); setBusy(false); return; }
      const fd = new FormData();
      fd.append("name", name);
      fd.append("service", svcDetail.id);
      if (deployVersion) fd.append("version", deployVersion);
      fd.append("config", JSON.stringify(configObj));
      if (deployFile) fd.append("zip_file", deployFile);
      await apiRequest({
        method: "POST", url: `${DEPLOY_API}/`, data: fd,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setToast(`Deploy created for ${ownerName}`);
      setDeployOpen(false);
      setDeployFile(null);
      onRefresh?.();
    } catch (e) {
      const d = e?.response?.data;
      setToast(d?.detail || d?.error || (d?.errors && JSON.stringify(d.errors)) || "Create deploy failed");
    } finally { setBusy(false); }
  };

  const createVolume = async () => {
    const name = (volName || "").trim();
    const size_mb = parseInt(volSize, 10);
    if (!name || !size_mb) { setToast("Name and size required"); return; }
    setBusy(true);
    try {
      await apiRequest({
        method: "POST",
        url: `${SVC_API}/volume/`,
        data: {
          name,
          size_mb,
          default_bind: volBind || "/data",
          default_mode: "rw",
          service: svcDetail.id,
          // Owner must be the service user, not staff
          user_id: ownerId,
          user: ownerId,
        },
      });
      setToast(`Volume created for ${ownerName}`);
      setVolOpen(false);
      setVolName("");
      onRefresh?.();
    } catch (e) {
      const d = e?.response?.data;
      setToast(d?.error || d?.detail || (d?.errors && JSON.stringify(d.errors)) || "Create volume failed");
    } finally { setBusy(false); }
  };

  const createNetwork = async () => {
    const name = (netName || "").trim();
    if (!name) { setToast("Network name required"); return; }
    setBusy(true);
    try {
      await apiRequest({
        method: "POST",
        url: `${SVC_API}/networks/`,
        data: {
          name,
          description: netDesc || "",
          user_id: ownerId,
          user: ownerId,
        },
      });
      setToast(`Network created for ${ownerName}`);
      setNetOpen(false);
      setNetName("");
      onRefresh?.();
    } catch (e) {
      const d = e?.response?.data;
      setToast(d?.error || d?.detail || "Create network failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(svcDetail)}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: "min(560px, 100vw)" }, maxWidth: 640 } }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Box>
            <Typography fontWeight={700} noWrap>{svcDetail.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Owner: <strong>{ownerName}</strong>
            </Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ p: 2, pb: 4 }}>
          <Stack gap={1.5}>
            <Typography variant="body2">Status: <Chip size="small" label={svcDetail.status || "—"} /></Typography>
            <Typography variant="caption" fontFamily="monospace" color="text.secondary">{svcDetail.id}</Typography>

            <Stack direction="row" flexWrap="wrap" gap={1}>
              <Button size="small" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => onAction("start", svcDetail.id)}>Start</Button>
              <Button size="small" variant="outlined" startIcon={<StopIcon />} onClick={() => onAction("stop", svcDetail.id)}>Stop</Button>
              <Button size="small" variant="outlined" startIcon={<RestartAltIcon />} onClick={() => onAction("restart", svcDetail.id)}>Restart</Button>
              <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon />} onClick={() => onAction("purge", svcDetail.id)}>Purge</Button>
              <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => onAction("delete", svcDetail.id)}>Delete</Button>
            </Stack>

            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {[
                ["overview", "Overview"],
                ["deploys", `Deploys (${svcDeploys.length})`],
                ["volumes", `Volumes (${svcVolumes.length})`],
                ["networks", `Networks (${svcNetworks.length})`],
              ].map(([id, label]) => (
                <Chip key={id} label={label} size="small"
                  color={detailTab === id ? "primary" : "default"}
                  variant={detailTab === id ? "filled" : "outlined"}
                  onClick={() => setDetailTab(id)}
                />
              ))}
            </Stack>
            <Divider />

            {detailTab === "overview" && (
              <Typography variant="body2" color="text.secondary">
                Managing resources for <strong>{ownerName}</strong>. New volumes, networks and deploys
                are owned by this user (not by staff).
              </Typography>
            )}

            {detailTab === "deploys" && (
              <Stack gap={1.25}>
                <Button size="small" variant="contained" startIcon={<CloudUploadIcon />}
                  onClick={() => {
                    setDeployName(`${svcDetail.name || "deploy"}-${Date.now().toString(36).slice(-4)}`);
                    setDeployVersion("1.0");
                    setDeployConfig("{}");
                    setDeployFile(null);
                    setDeployOpen(true);
                  }}
                >Add deploy</Button>
                {!svcDeploys.length && <Typography variant="body2" color="text.secondary">No deploys</Typography>}
                {svcDeploys.map((d) => (
                  <Paper key={d.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
                      <Box>
                        <Typography fontWeight={700} fontSize={14}>{d.name}</Typography>
                        <Typography variant="caption" color="text.secondary">v{d.version} · {d.status || "—"}</Typography>
                      </Box>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {d.zip_file && (
                          <Button size="small" onClick={() => {
                            const url = typeof d.zip_file === "string" ? d.zip_file : d.zip_file?.url;
                            if (url) window.open(url.startsWith("http") ? url : `${hostBase()}${url}`, "_blank");
                          }}>Download</Button>
                        )}
                        <Button size="small" onClick={async () => {
                          try {
                            await apiRequest({ method: "POST", url: `${DEPLOY_API}/set_deploy/`, data: { deploy_id: String(d.id), service_id: String(svcDetail.id) } });
                            setToast("Deploy selected");
                            onRefresh?.();
                          } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                        }}>Select</Button>
                        <Button size="small" color="error" onClick={async () => {
                          if (!window.confirm(`Delete deploy "${d.name}"?`)) return;
                          try {
                            await apiRequest({ method: "DELETE", url: `${DEPLOY_API}/${d.id}/` });
                            setToast("Deleted");
                            onRefresh?.();
                          } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                        }}>Delete</Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            {detailTab === "volumes" && (
              <Stack gap={1}>
                <Button size="small" variant="contained" startIcon={<StorageIcon />} onClick={() => setVolOpen(true)}>
                  Create volume for {ownerName}
                </Button>
                {!svcVolumes.length && <Typography variant="body2" color="text.secondary">No volumes</Typography>}
                {svcVolumes.map((v) => (
                  <Paper key={v.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Typography fontWeight={600} fontSize={14}>{v.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{v.size_mb} MB · {v.is_mounted ? "mounted" : "detached"}</Typography>
                    <Stack direction="row" gap={0.5} mt={0.75}>
                      <Button size="small" onClick={async () => {
                        try {
                          await apiRequest({ method: "POST", url: `${SVC_API}/volume/${v.id}/detach/` });
                          setToast("Detached"); onRefresh?.();
                        } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                      }}>Detach</Button>
                      <Button size="small" color="error" onClick={async () => {
                        if (!window.confirm("Delete volume?")) return;
                        try {
                          await apiRequest({ method: "DELETE", url: `${SVC_API}/volume/${v.id}/` });
                          setToast("Deleted"); onRefresh?.();
                        } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                      }}>Delete</Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            {detailTab === "networks" && (
              <Stack gap={1}>
                <Button size="small" variant="contained" onClick={() => setNetOpen(true)}>
                  Create network for {ownerName}
                </Button>
                {!svcNetworks.length && <Typography variant="body2" color="text.secondary">No networks</Typography>}
                {svcNetworks.map((n) => (
                  <Paper key={n.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Typography fontWeight={600} fontSize={14}>{n.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{n.description || "—"}</Typography>
                    <Button size="small" color="error" sx={{ mt: 0.75 }} onClick={async () => {
                      if (!window.confirm(`Delete network "${n.name}"?`)) return;
                      try {
                        await apiRequest({ method: "DELETE", url: `${SVC_API}/networks/${n.id}/` });
                        setToast("Deleted"); onRefresh?.();
                      } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                    }}>Delete</Button>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={deployOpen} onClose={() => !busy && setDeployOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create deploy for {ownerName}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" required value={deployName} onChange={(e) => setDeployName(e.target.value)} fullWidth />
            <TextField size="small" label="Version" value={deployVersion} onChange={(e) => setDeployVersion(e.target.value)} fullWidth />
            <TextField size="small" label="Config (JSON)" value={deployConfig} onChange={(e) => setDeployConfig(e.target.value)} multiline minRows={4} fullWidth inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }} />
            <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} fullWidth>
              {deployFile ? deployFile.name : "Choose ZIP (optional)"}
              <input type="file" hidden accept=".zip,application/zip" onChange={(e) => setDeployFile(e.target.files?.[0] || null)} />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={createDeploy} disabled={busy || !deployName.trim()}>{busy ? "…" : "Create"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={volOpen} onClose={() => !busy && setVolOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create volume for {ownerName}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" value={volName} onChange={(e) => setVolName(e.target.value)} fullWidth />
            <TextField size="small" label="Size (MB)" type="number" value={volSize} onChange={(e) => setVolSize(e.target.value)} fullWidth />
            <TextField size="small" label="Default bind path" value={volBind} onChange={(e) => setVolBind(e.target.value)} fullWidth />
            <Typography variant="caption" color="text.secondary">Owner will be <strong>{ownerName}</strong>, attached to this service.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVolOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={createVolume} disabled={busy}>{busy ? "…" : "Create"}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={netOpen} onClose={() => !busy && setNetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create network for {ownerName}</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" value={netName} onChange={(e) => setNetName(e.target.value)} fullWidth />
            <TextField size="small" label="Description" value={netDesc} onChange={(e) => setNetDesc(e.target.value)} fullWidth />
            <Typography variant="caption" color="text.secondary">Owner will be <strong>{ownerName}</strong>.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNetOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="contained" onClick={createNetwork} disabled={busy}>{busy ? "…" : "Create"}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
