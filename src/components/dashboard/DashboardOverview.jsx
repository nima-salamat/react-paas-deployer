import { Link as RouterLink } from "react-router-dom";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, Typography, alpha } from "@mui/material";
import MiscellaneousServicesOutlinedIcon from "@mui/icons-material/MiscellaneousServicesOutlined";
import HubIcon from "@mui/icons-material/Hub";
import VolumeIcon from "../VolumeIcon.jsx";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import LaunchRoundedIcon from "@mui/icons-material/LaunchRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import PlatformIcon from "../plans/PlatformIcon.jsx";
import apiRequest from "../customHooks/apiRequest";
import { SERVICE_API, resolveServiceKind } from "../service/services/helpers";
import { TICKETS_API, unwrapList } from "../tickets/api.js";

const QUICK_LINKS = [
  ["Services", "/dashboard/services", MiscellaneousServicesOutlinedIcon],
  ["App Library", "/dashboard/ready-apps", AppsOutlinedIcon],
  ["Deployed Apps", "/dashboard/ready-apps/installations", AppsOutlinedIcon],
  ["Networks", "/dashboard/networks", HubIcon],
  ["Volumes", "/dashboard/volumes", VolumeIcon],
  ["Tickets", "/dashboard/tickets", ConfirmationNumberOutlinedIcon],
  ["Agents", "/dashboard/agents", SmartToyOutlinedIcon],
  ["Plans", "/dashboard/plans", SellOutlinedIcon],
  ["Profile", "/dashboard/profile", PersonOutlineOutlinedIcon],
];

const STATUS_LABELS = { running: "Running", stopped: "Stopped", failed: "Failed", queued: "Queued", deploying: "Deploying", stopping: "Stopping", pending: "Pending", succeeded: "Succeeded" };
const dateLabel = (v) => { const d = new Date(v || 0); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d); };

function StatCard({ icon, label, value, tone = "primary" }) {
  return <Paper elevation={0} sx={{ p: 2, minHeight: 112, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
    <Stack direction="row" spacing={1.2} alignItems="flex-start">
      <Box sx={{ width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 1.5, color: tone + ".main", bgcolor: (t) => alpha(t.palette[tone]?.main || t.palette.primary.main, t.palette.mode === "dark" ? 0.16 : 0.08) }}>{icon}</Box>
      <Box><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }}>{label}</Typography><Typography variant="h5" sx={{ fontWeight: 850, fontVariantNumeric: "tabular-nums" }}>{value == null ? <Skeleton width={40} /> : value}</Typography></Box>
    </Stack>
  </Paper>;
}

function ServiceMini({ service }) {
  const kind = resolveServiceKind(service, {});
  const platform = String(service?.plan?.platform || service?.platform || "").toLowerCase();
  const status = String(service?.status || "").toLowerCase();
  const id = service?.id ?? service?.pk;
  return <Button component={RouterLink} to={"/dashboard/services/" + id} sx={{ justifyContent: "flex-start", textAlign: "left", px: 1, py: 0.8, borderRadius: 1.5, color: "text.primary", minWidth: 0, "&:hover": { bgcolor: "action.hover" } }}>
    <PlatformIcon platformKey={platform} label={platform || kind} size={17} />
    <Box sx={{ ml: 1, minWidth: 0, flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service?.name || "(no name)"}</Typography>
      <Stack direction="row" spacing={0.7} alignItems="center"><Typography variant="caption" color="text.secondary">{kind === "db" ? "Database" : "Application"}</Typography><Chip size="small" label={STATUS_LABELS[status] || status || "Unknown"} color={status === "running" ? "success" : status === "failed" ? "error" : "default"} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} /></Stack>
    </Box><LaunchRoundedIcon sx={{ fontSize: 16, color: "text.disabled" }} />
  </Button>;
}

function TicketMini({ ticket }) {
  const status = String(ticket?.status || "").toLowerCase();
  return <Button component={RouterLink} to={"/dashboard/tickets/" + ticket?.id} sx={{ justifyContent: "flex-start", textAlign: "left", px: 1, py: 0.8, borderRadius: 1.5, color: "text.primary", minWidth: 0, "&:hover": { bgcolor: "action.hover" } }}>
    <ConfirmationNumberOutlinedIcon sx={{ mr: 1, color: "text.secondary", fontSize: 18 }} />
    <Box sx={{ minWidth: 0, flex: 1 }}><Typography variant="body2" sx={{ fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ticket?.subject || ticket?.public_id || "Ticket"}</Typography>
      <Stack direction="row" spacing={0.8} alignItems="center"><Chip size="small" label={status === "in_progress" ? "In progress" : "Open"} color={status === "in_progress" ? "warning" : "info"} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} /><Typography variant="caption" color="text.secondary">{dateLabel(ticket?.updated_at || ticket?.last_message_at || ticket?.created_at)}</Typography></Stack>
    </Box>
  </Button>;
}

export default function DashboardOverview() {
  const [state, setState] = useState({ loading: true, error: null, services: [], tickets: [], total: null, running: null, stopped: null, failed: null });
  const load = useCallback(async () => {
    setState((p) => ({ ...p, loading: true, error: null }));
    const results = await Promise.allSettled([
      apiRequest({ method: "GET", url: SERVICE_API + "?page=1&page_size=5" }),
      apiRequest({ method: "GET", url: SERVICE_API + "?page=1&page_size=1&status=running" }),
      apiRequest({ method: "GET", url: SERVICE_API + "?page=1&page_size=1&status=stopped" }),
      apiRequest({ method: "GET", url: SERVICE_API + "?page=1&page_size=1&status=failed" }),
      apiRequest({ method: "GET", url: TICKETS_API + "?page=1&page_size=5&status=open" }),
      apiRequest({ method: "GET", url: TICKETS_API + "?page=1&page_size=5&status=in_progress" }),
    ]);
    const page = results[0].status === "fulfilled" ? results[0].value.data : null;
    const ticketItems = [];
    [results[4], results[5]].forEach((r) => { if (r.status === "fulfilled") ticketItems.push(...unwrapList(r.value)); });
    ticketItems.sort((a,b) => new Date(b?.last_message_at || b?.updated_at || b?.created_at || 0) - new Date(a?.last_message_at || a?.updated_at || a?.created_at || 0));
    setState({
      loading: false,
      error: results[0].status === "rejected" ? "Unable to load the service overview." : null,
      total: page?.count ?? (Array.isArray(page?.results) ? page.results.length : 0),
      running: results[1].status === "fulfilled" ? results[1].value.data?.count ?? 0 : null,
      stopped: results[2].status === "fulfilled" ? results[2].value.data?.count ?? 0 : null,
      failed: results[3].status === "fulfilled" ? results[3].value.data?.count ?? 0 : null,
      services: Array.isArray(page?.results) ? page.results.slice(0,5) : Array.isArray(page) ? page.slice(0,5) : [],
      tickets: ticketItems.slice(0,5),
    });
  }, []);
  useEffect(() => { load(); }, [load]);
  return <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3.5 } }}><Stack spacing={2.5}>
    <Box><Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>Overview</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>Workspace health and recent activity.</Typography></Box>
    {state.error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{state.error}</Alert>}
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", xl: "repeat(4,minmax(0,1fr))" }, gap: 1.5 }}>
      <StatCard icon={<MiscellaneousServicesOutlinedIcon />} label="Total services" value={state.loading ? null : state.total} />
      <StatCard icon={<CheckCircleRoundedIcon />} label="Running" value={state.loading ? null : state.running} tone="success" />
      <StatCard icon={<AccessTimeRoundedIcon />} label="Stopped" value={state.loading ? null : state.stopped} tone="warning" />
      <StatCard icon={<ErrorOutlineRoundedIcon />} label="Failed" value={state.loading ? null : state.failed} tone="error" />
    </Box>
    <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 850 }}>Quick access</Typography><Typography variant="caption" color="text.secondary">Jump to a workspace area.</Typography>
      <Box sx={{ mt: 1.25, display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(4,minmax(0,1fr))", lg: "repeat(9,minmax(0,1fr))" }, gap: 1 }}>
        {QUICK_LINKS.map(([label,path,Icon]) => <Button key={path} component={RouterLink} to={path} sx={{ minHeight: 68, p: 1, flexDirection: "column", gap: 0.5, border: "1px solid", borderColor: "divider", borderRadius: 2, color: "text.primary" }}><Icon sx={{ color: "primary.main", fontSize: 21 }} /><Typography variant="caption" sx={{ fontWeight: 750 }}>{label}</Typography></Button>)}
      </Box>
    </Paper>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.15fr 1fr" }, gap: 2 }}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Recent services</Typography><Typography variant="caption" color="text.secondary">Newest first.</Typography></Box><Button component={RouterLink} size="small" to="/dashboard/services">View all</Button></Stack>
        {state.loading ? <Stack spacing={0.6} sx={{ mt: 1 }}><Skeleton variant="rounded" height={52}/><Skeleton variant="rounded" height={52}/><Skeleton variant="rounded" height={52}/></Stack> : state.services.length ? <Stack spacing={0.2} sx={{ mt: 0.8 }}>{state.services.map((s) => <ServiceMini key={s.id ?? s.pk} service={s}/>)}</Stack> : <Box sx={{ py: 4, textAlign: "center" }}><Typography color="text.secondary">No services yet.</Typography><Button component={RouterLink} sx={{ mt: 1 }} to="/dashboard/services">Open Services</Button></Box>}
      </Paper>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography variant="h6" sx={{ fontWeight: 850 }}>Active tickets</Typography><Typography variant="caption" color="text.secondary">Open or in progress · up to 5 shown.</Typography></Box><Button component={RouterLink} size="small" to="/dashboard/tickets">View all</Button></Stack>
        {state.tickets.length ? <Stack spacing={0.2} sx={{ mt: 0.8 }}>{state.tickets.map((t) => <TicketMini key={t.id} ticket={t}/>)}</Stack> : <Box sx={{ py: 4, textAlign: "center" }}><Typography color="text.secondary">No open or in-progress tickets.</Typography></Box>}
      </Paper>
    </Box>
  </Stack></Box>;
}