import React, { useCallback, useEffect, useState } from "react";
import {
  Box, Chip, CircularProgress, IconButton, Pagination, Paper, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import apiRequest from "../customHooks/apiRequest";
import { svcApi, deployApi } from "./adminUtils";
import ServiceAdminDrawer from "./ServiceAdminDrawer";

export default function ServicesPanel({ setToast }) {
  const SVC_API = svcApi();
  const DEPLOY_API = deployApi();

  const [svcList, setSvcList] = useState([]);
  const [svcPage, setSvcPage] = useState(1);
  const [svcCount, setSvcCount] = useState(0);
  const [svcSearch, setSvcSearch] = useState("");
  const [svcLoading, setSvcLoading] = useState(false);
  const [svcActionBusy, setSvcActionBusy] = useState(null);
  const [svcDetail, setSvcDetail] = useState(null);
  const [svcVolumes, setSvcVolumes] = useState([]);
  const [svcDeploys, setSvcDeploys] = useState([]);
  const [svcNetworks, setSvcNetworks] = useState([]);
  const [detailTab, setDetailTab] = useState("overview");

  const loadServices = useCallback(async () => {
    setSvcLoading(true);
    try {
      const params = { page: svcPage, page_size: 20 };
      if (svcSearch) params.q_search = svcSearch;
      const res = await apiRequest({ method: "GET", url: `${SVC_API}/service/`, params });
      const data = res.data || {};
      setSvcList(data.results || data.data || []);
      setSvcCount(typeof data.count === "number" ? data.count : (data.results || []).length);
    } catch (e) {
      setSvcList([]);
      setToast?.(e?.response?.data?.detail || "Failed to load services");
    } finally {
      setSvcLoading(false);
    }
  }, [SVC_API, svcPage, svcSearch, setToast]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const openSvcDetail = async (svc) => {
    setSvcDetail(svc);
    setDetailTab("overview");
    const ownerId = svc.user_info?.id || svc.user;
    try {
      const res = await apiRequest({ method: "GET", url: `${SVC_API}/volume/`, params: { service: svc.id } });
      setSvcVolumes((res.data || {}).results || res.data?.data || []);
    } catch { setSvcVolumes([]); }
    try {
      const res = await apiRequest({ method: "GET", url: `${DEPLOY_API}/`, params: { service_id: svc.id, page_size: 50 } });
      setSvcDeploys((res.data || {}).results || res.data?.data || []);
    } catch { setSvcDeploys([]); }
    try {
      const res = await apiRequest({
        method: "GET", url: `${SVC_API}/networks/`,
        params: ownerId ? { user_id: ownerId } : {},
      });
      setSvcNetworks((res.data || {}).results || res.data?.data || []);
    } catch { setSvcNetworks([]); }
  };

  const svcAction = async (action, serviceId) => {
    setSvcActionBusy(`${action}-${serviceId}`);
    try {
      if (action === "start") {
        await apiRequest({ method: "POST", url: `${SVC_API}/start_service/`, data: { service_id: serviceId } });
        setToast?.("Start queued");
      } else if (action === "stop") {
        await apiRequest({ method: "POST", url: `${SVC_API}/stop_service/`, data: { service_id: serviceId } });
        setToast?.("Stop queued");
      } else if (action === "restart") {
        await apiRequest({ method: "POST", url: `${SVC_API}/stop_service/`, data: { service_id: serviceId } });
        setTimeout(async () => {
          try { await apiRequest({ method: "POST", url: `${SVC_API}/start_service/`, data: { service_id: serviceId } }); } catch { /* */ }
        }, 2500);
        setToast?.("Restart queued");
      } else if (action === "purge") {
        await apiRequest({ method: "POST", url: `${SVC_API}/purge_service_runtime/`, data: { service_id: serviceId } });
        setToast?.("Runtime purged");
      } else if (action === "delete") {
        if (!window.confirm("Delete this service?")) return;
        await apiRequest({ method: "DELETE", url: `${SVC_API}/service/${serviceId}/` });
        setToast?.("Service deleted");
        setSvcDetail(null);
      }
      await loadServices();
      if (svcDetail && String(svcDetail.id) === String(serviceId) && action !== "delete") {
        openSvcDetail(svcDetail);
      }
    } catch (e) {
      setToast?.(e?.response?.data?.detail || "Action failed");
    } finally {
      setSvcActionBusy(null);
    }
  };

  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} gap={1.5} mb={2}>
        <Typography variant="h5" fontWeight={700}>All services</Typography>
        <TextField size="small" placeholder="Search name or username…" value={svcSearch}
          onChange={(e) => { setSvcSearch(e.target.value); setSvcPage(1); }}
          sx={{ minWidth: { xs: "100%", sm: 260 } }}
        />
      </Stack>
      <Paper sx={{ overflow: "auto" }}>
        {svcLoading ? (
          <Box display="flex" justifyContent="center" py={4}><CircularProgress /></Box>
        ) : (
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {svcList.map((s) => (
                <TableRow key={s.id} hover sx={{ cursor: "pointer" }} onClick={() => openSvcDetail(s)}>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={14}>{s.name}</Typography>
                    <Typography variant="caption" color="text.secondary" fontFamily="monospace">{String(s.id).slice(0, 8)}</Typography>
                  </TableCell>
                  <TableCell>{s.user_info?.username || s.user_username || s.user || "—"}</TableCell>
                  <TableCell>
                    <Chip size="small" label={s.status || "—"} color={
                      String(s.status).toLowerCase() === "running" ? "success"
                        : String(s.status).toLowerCase() === "failed" ? "error" : "default"
                    } />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end" flexWrap="wrap">
                      <Tooltip title="Start"><IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("start", s.id)}><PlayArrowIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Stop"><IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("stop", s.id)}><StopIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Restart"><IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("restart", s.id)}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Purge"><IconButton size="small" disabled={!!svcActionBusy} onClick={() => svcAction("purge", s.id)}><CleaningServicesIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Open"><IconButton size="small" onClick={() => openSvcDetail(s)}><CloudUploadIcon fontSize="small" /></IconButton></Tooltip>
                      <Tooltip title="Delete"><IconButton size="small" color="error" disabled={!!svcActionBusy} onClick={() => svcAction("delete", s.id)}><DeleteOutlineIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {!svcList.length && (
                <TableRow><TableCell colSpan={4}><Typography color="text.secondary" align="center" py={3}>No services found</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
        {svcCount > 20 && (
          <Box display="flex" justifyContent="center" p={2}>
            <Pagination page={svcPage} count={Math.ceil(svcCount / 20)} onChange={(_, v) => setSvcPage(v)} />
          </Box>
        )}
      </Paper>

      <ServiceAdminDrawer
        svcDetail={svcDetail}
        onClose={() => setSvcDetail(null)}
        svcDeploys={svcDeploys}
        svcVolumes={svcVolumes}
        svcNetworks={svcNetworks}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        onAction={svcAction}
        onRefresh={() => svcDetail && openSvcDetail(svcDetail)}
        setToast={setToast}
      />
    </>
  );
}
