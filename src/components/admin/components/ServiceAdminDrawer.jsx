import React, { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Drawer, IconButton, Stack, TextField, Toolbar, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import StorageIcon from "@mui/icons-material/Storage";
import LockIcon from "@mui/icons-material/Lock";
import apiRequest from "../../customHooks/apiRequest";
import { hostBase, svcApi, deployApi } from "../adminUtils";
import {
  DRY_BORDER, DRY_BORDER_LIGHT, DryPanel, DryTh, DryTd, DryCreateButton,
  DryEmptyState,
} from "./DryTable";

/**
 * Staff service inspector — resources are owned by the service's user, not the admin.
 *
 * Hard-edge styling (no border-radius anywhere). All resource lists are
 * rendered as proper <table> elements using the shared DryTable primitives,
 * matching the look of TablesPanel / PlansPanel / ServicesPanel.
 *
 * Create-row capability is exposed as a prominent outlined button at the
 * top of each resource table (Deploys / Volumes / Networks), opening a
 * Dialog form with sharp-cornered inputs.
 *
 * Props:
 *   canManage: boolean — hide create/destroy affordances if false.
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
  canManage = false,
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
        url: `${SVC_API}/admin/volumes/`,
        data: {
          name,
          size_mb,
          default_bind: volBind || "/data",
          default_mode: "rw",
          service: svcDetail.id,
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
        url: `${SVC_API}/admin/networks/`,
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

  const tabs = [
    ["overview", "Overview"],
    ["deploys", `Deploys (${svcDeploys.length})`],
    ["volumes", `Volumes (${svcVolumes.length})`],
    ["networks", `Networks (${svcNetworks.length})`],
  ];

  return (
    <>
      <Drawer
        anchor="right"
        open={Boolean(svcDetail)}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: "100%", sm: "min(640px, 100vw)" }, maxWidth: 720, borderRadius: 0 } }}
      >
        <Toolbar sx={{ justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography fontWeight={800} noWrap>{svcDetail.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Owner: <strong>{ownerName}</strong>
            </Typography>
          </Box>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Toolbar>

        <Box sx={{ p: 2, pb: 4, overflowY: "auto" }}>
          <Stack gap={1.5}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Chip
                size="small"
                label={svcDetail.status || "—"}
                color={String(svcDetail.status || "").toLowerCase() === "running" ? "success"
                  : String(svcDetail.status || "").toLowerCase() === "failed" ? "error" : "default"}
                variant={svcDetail.status === "running" ? "filled" : "outlined"}
                sx={{ borderRadius: 0, height: 20, fontSize: 10 }}
              />
              <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                {svcDetail.id}
              </Typography>
            </Stack>

            {canManage ? (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                <Button size="small" variant="outlined" color="success" startIcon={<PlayArrowIcon />}
                  onClick={() => onAction("start", svcDetail.id)}
                  sx={dryBtnSx}>Start</Button>
                <Button size="small" variant="outlined" color="error" startIcon={<StopIcon />}
                  onClick={() => onAction("stop", svcDetail.id)}
                  sx={dryBtnSx}>Stop</Button>
                <Button size="small" variant="outlined" startIcon={<RestartAltIcon />}
                  onClick={() => onAction("restart", svcDetail.id)}
                  sx={dryBtnSx}>Restart</Button>
                <Button size="small" variant="outlined" startIcon={<CleaningServicesIcon />}
                  onClick={() => onAction("purge", svcDetail.id)}
                  sx={dryBtnSx}>Purge</Button>
                <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineIcon />}
                  onClick={() => onAction("delete", svcDetail.id)}
                  sx={dryBtnSx}>Delete</Button>
              </Stack>
            ) : (
              <DryPanel sx={{ p: 1.25, bgcolor: "action.hover" }}>
                <Stack direction="row" gap={1.5} alignItems="flex-start">
                  <LockIcon color="action" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Read-only access</Typography>
                    <Typography variant="caption" color="text.secondary">
                      You don't have <code>services.manage</code> or <code>services.delete</code>, so
                      you can inspect but not modify this service.
                    </Typography>
                  </Box>
                </Stack>
              </DryPanel>
            )}

            <Stack direction="row" gap={0.5} flexWrap="wrap">
              {tabs.map(([id, label]) => (
                <Chip
                  key={id}
                  label={label}
                  size="small"
                  color={detailTab === id ? "primary" : "default"}
                  variant={detailTab === id ? "filled" : "outlined"}
                  onClick={() => setDetailTab(id)}
                  sx={{ borderRadius: 0, height: 22, fontSize: 11 }}
                />
              ))}
            </Stack>
            <Divider />

            {detailTab === "overview" && (
              <Typography variant="body2" color="text.secondary">
                Managing resources for <strong>{ownerName}</strong>. New volumes, networks and deploys
                are owned by this user (not by staff). All tables below are hard-edge — no curves.
              </Typography>
            )}

            {/* ─── Deploys — hard-edge table ─────────────────────────────── */}
            {detailTab === "deploys" && (
              <DryPanel sx={{ overflow: "hidden" }}>
                <Box sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  p: 1, borderBottom: DRY_BORDER, bgcolor: "action.hover",
                }}>
                  <Typography variant="overline" fontWeight={700}>Deploys · {svcDeploys.length}</Typography>
                  {canManage && (
                    <DryCreateButton
                      onClick={() => {
                        setDeployName(`${svcDetail.name || "deploy"}-${Date.now().toString(36).slice(-4)}`);
                        setDeployVersion("1.0");
                        setDeployConfig("{}");
                        setDeployFile(null);
                        setDeployOpen(true);
                      }}
                    >
                      Add deploy
                    </DryCreateButton>
                  )}
                </Box>
                {svcDeploys.length === 0 ? (
                  <DryEmptyState>No deploys</DryEmptyState>
                ) : (
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                      <tr>
                        <DryTh>Name</DryTh>
                        <DryTh>Version</DryTh>
                        <DryTh>Status</DryTh>
                        <DryTh align="right">Actions</DryTh>
                      </tr>
                    </Box>
                    <tbody>
                      {svcDeploys.map((d) => (
                        <tr key={d.id} style={{ borderTop: DRY_BORDER_LIGHT }}>
                          <DryTd><Typography fontWeight={700} fontSize={13}>{d.name}</Typography></DryTd>
                          <DryTd><code style={{ fontSize: 11 }}>v{d.version}</code></DryTd>
                          <DryTd>
                            <Chip size="small" label={d.status || "—"}
                              sx={{ height: 18, fontSize: 10, borderRadius: 0 }} />
                          </DryTd>
                          <DryTd align="right">
                            <Stack direction="row" gap={0.5} justifyContent="flex-end" flexWrap="wrap">
                              {d.zip_file && (
                                <Button size="small" sx={dryBtnSx} onClick={() => {
                                  const url = typeof d.zip_file === "string" ? d.zip_file : d.zip_file?.url;
                                  if (url) window.open(url.startsWith("http") ? url : `${hostBase()}${url}`, "_blank");
                                }}>Download</Button>
                              )}
                              {canManage && (
                                <>
                                  <Button size="small" sx={dryBtnSx} onClick={async () => {
                                    try {
                                      await apiRequest({ method: "POST", url: `${DEPLOY_API}/set_deploy/`, data: { deploy_id: String(d.id), service_id: String(svcDetail.id) } });
                                      setToast("Deploy selected");
                                      onRefresh?.();
                                    } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                                  }}>Select</Button>
                                  <Button size="small" color="error" sx={dryBtnSx} onClick={async () => {
                                    if (!window.confirm(`Delete deploy "${d.name}"?`)) return;
                                    try {
                                      await apiRequest({ method: "DELETE", url: `${DEPLOY_API}/${d.id}/` });
                                      setToast("Deleted");
                                      onRefresh?.();
                                    } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                                  }}>Delete</Button>
                                </>
                              )}
                            </Stack>
                          </DryTd>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                )}
              </DryPanel>
            )}

            {/* ─── Volumes — hard-edge table ─────────────────────────────── */}
            {detailTab === "volumes" && (
              <DryPanel sx={{ overflow: "hidden" }}>
                <Box sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  p: 1, borderBottom: DRY_BORDER, bgcolor: "action.hover",
                }}>
                  <Typography variant="overline" fontWeight={700}>Volumes · {svcVolumes.length}</Typography>
                  {canManage && (
                    <DryCreateButton onClick={() => setVolOpen(true)} startIcon={<StorageIcon />}>
                      Create volume
                    </DryCreateButton>
                  )}
                </Box>
                {svcVolumes.length === 0 ? (
                  <DryEmptyState>No volumes</DryEmptyState>
                ) : (
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                      <tr>
                        <DryTh>Name</DryTh>
                        <DryTh align="right">Size (MB)</DryTh>
                        <DryTh>State</DryTh>
                        <DryTh align="right">Actions</DryTh>
                      </tr>
                    </Box>
                    <tbody>
                      {svcVolumes.map((v) => (
                        <tr key={v.id} style={{ borderTop: DRY_BORDER_LIGHT }}>
                          <DryTd><Typography fontWeight={700} fontSize={13}>{v.name}</Typography></DryTd>
                          <DryTd align="right"><code style={{ fontSize: 11 }}>{v.size_mb}</code></DryTd>
                          <DryTd>
                            <Chip size="small" label={v.is_mounted ? "mounted" : "detached"}
                              color={v.is_mounted ? "success" : "default"}
                              variant={v.is_mounted ? "filled" : "outlined"}
                              sx={{ height: 18, fontSize: 10, borderRadius: 0 }} />
                          </DryTd>
                          <DryTd align="right">
                            {canManage && (
                              <Stack direction="row" gap={0.5} justifyContent="flex-end">
                                <Button size="small" sx={dryBtnSx} onClick={async () => {
                                  try {
                                    await apiRequest({ method: "POST", url: `${SVC_API}/admin/volumes/${v.id}/detach/` });
                                    setToast("Detached"); onRefresh?.();
                                  } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                                }}>Detach</Button>
                                <Button size="small" color="error" sx={dryBtnSx} onClick={async () => {
                                  if (!window.confirm("Delete volume?")) return;
                                  try {
                                    await apiRequest({ method: "DELETE", url: `${SVC_API}/admin/volumes/${v.id}/` });
                                    setToast("Deleted"); onRefresh?.();
                                  } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                                }}>Delete</Button>
                              </Stack>
                            )}
                          </DryTd>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                )}
              </DryPanel>
            )}

            {/* ─── Networks — hard-edge table ────────────────────────────── */}
            {detailTab === "networks" && (
              <DryPanel sx={{ overflow: "hidden" }}>
                <Box sx={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  p: 1, borderBottom: DRY_BORDER, bgcolor: "action.hover",
                }}>
                  <Typography variant="overline" fontWeight={700}>Networks · {svcNetworks.length}</Typography>
                  {canManage && (
                    <DryCreateButton onClick={() => setNetOpen(true)}>
                      Create network
                    </DryCreateButton>
                  )}
                </Box>
                {svcNetworks.length === 0 ? (
                  <DryEmptyState>No networks</DryEmptyState>
                ) : (
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <Box component="thead" sx={{ bgcolor: "action.hover" }}>
                      <tr>
                        <DryTh>Name</DryTh>
                        <DryTh>Description</DryTh>
                        <DryTh align="right">Actions</DryTh>
                      </tr>
                    </Box>
                    <tbody>
                      {svcNetworks.map((n) => (
                        <tr key={n.id} style={{ borderTop: DRY_BORDER_LIGHT }}>
                          <DryTd><Typography fontWeight={700} fontSize={13}>{n.name}</Typography></DryTd>
                          <DryTd>
                            <Typography variant="caption" color="text.secondary">
                              {n.description || "—"}
                            </Typography>
                          </DryTd>
                          <DryTd align="right">
                            {canManage && (
                              <Button size="small" color="error" sx={dryBtnSx} onClick={async () => {
                                if (!window.confirm(`Delete network "${n.name}"?`)) return;
                                try {
                                  await apiRequest({ method: "DELETE", url: `${SVC_API}/admin/networks/${n.id}/` });
                                  setToast("Deleted"); onRefresh?.();
                                } catch (e) { setToast(e?.response?.data?.detail || "Failed"); }
                              }}>Delete</Button>
                            )}
                          </DryTd>
                        </tr>
                      ))}
                    </tbody>
                  </Box>
                )}
              </DryPanel>
            )}
          </Stack>
        </Box>
      </Drawer>

      {/* Create deploy dialog — hard edge */}
      <Dialog open={deployOpen} onClose={() => !busy && setDeployOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>Create deploy for {ownerName}</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" required value={deployName}
              onChange={(e) => setDeployName(e.target.value)} fullWidth
              sx={dryInputSx} />
            <TextField size="small" label="Version" value={deployVersion}
              onChange={(e) => setDeployVersion(e.target.value)} fullWidth
              sx={dryInputSx} />
            <TextField size="small" label="Config (JSON)" value={deployConfig}
              onChange={(e) => setDeployConfig(e.target.value)} multiline minRows={4} fullWidth
              inputProps={{ style: { fontFamily: "monospace", fontSize: 12 } }}
              sx={dryInputSx} />
            <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} fullWidth
              sx={{ borderRadius: 0, textTransform: "none" }}>
              {deployFile ? deployFile.name : "Choose ZIP (optional)"}
              <input type="file" hidden accept=".zip,application/zip"
                onChange={(e) => setDeployFile(e.target.files?.[0] || null)} />
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setDeployOpen(false)} disabled={busy}
            sx={{ borderRadius: 0, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={createDeploy} disabled={busy || !deployName.trim()}
            sx={{ borderRadius: 0, textTransform: "none", fontWeight: 700 }}>
            {busy ? "…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create volume dialog — hard edge */}
      <Dialog open={volOpen} onClose={() => !busy && setVolOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>Create volume for {ownerName}</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" value={volName}
              onChange={(e) => setVolName(e.target.value)} fullWidth sx={dryInputSx} />
            <TextField size="small" label="Size (MB)" type="number" value={volSize}
              onChange={(e) => setVolSize(e.target.value)} fullWidth sx={dryInputSx} />
            <TextField size="small" label="Default bind path" value={volBind}
              onChange={(e) => setVolBind(e.target.value)} fullWidth sx={dryInputSx} />
            <Typography variant="caption" color="text.secondary">
              Owner will be <strong>{ownerName}</strong>, attached to this service.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setVolOpen(false)} disabled={busy}
            sx={{ borderRadius: 0, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={createVolume} disabled={busy}
            sx={{ borderRadius: 0, textTransform: "none", fontWeight: 700 }}>
            {busy ? "…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create network dialog — hard edge */}
      <Dialog open={netOpen} onClose={() => !busy && setNetOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 0 } }}>
        <DialogTitle sx={{ borderBottom: DRY_BORDER_LIGHT }}>Create network for {ownerName}</DialogTitle>
        <DialogContent dividers>
          <Stack gap={2} mt={1}>
            <TextField size="small" label="Name" value={netName}
              onChange={(e) => setNetName(e.target.value)} fullWidth sx={dryInputSx} />
            <TextField size="small" label="Description" value={netDesc}
              onChange={(e) => setNetDesc(e.target.value)} fullWidth sx={dryInputSx} />
            <Typography variant="caption" color="text.secondary">
              Owner will be <strong>{ownerName}</strong>.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ borderTop: DRY_BORDER_LIGHT, p: 1.5 }}>
          <Button onClick={() => setNetOpen(false)} disabled={busy}
            sx={{ borderRadius: 0, textTransform: "none" }}>Cancel</Button>
          <Button variant="contained" onClick={createNetwork} disabled={busy}
            sx={{ borderRadius: 0, textTransform: "none", fontWeight: 700 }}>
            {busy ? "…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── Local styling constants ────────────────────────────────────────────────
const dryBtnSx = {
  borderRadius: 0,
  textTransform: "none",
  fontWeight: 600,
  fontSize: 11,
  minHeight: 26,
};

const dryInputSx = {
  "& .MuiOutlinedInput-root": { borderRadius: 0 },
};
