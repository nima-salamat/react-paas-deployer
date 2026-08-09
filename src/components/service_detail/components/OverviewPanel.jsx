import React, { useState, useEffect, useCallback } from "react";
import {
  Paper, Typography, Box, Stack, Divider, Chip, IconButton, Tooltip,
  InputAdornment, TextField, CircularProgress, Alert, Collapse,
} from "@mui/material";
import {
  Visibility, VisibilityOff, ContentCopy, Refresh as RefreshIcon,
  Storage as StorageIcon, VpnKey as VpnKeyIcon, Terminal as TerminalIcon,
} from "@mui/icons-material";
import { formatDate, parseDeployConfig, isDbPlatform, buildConnectionString, buildConnectionHints } from "../utils";
import { DEPLOY_BASE } from "../constants";
import DnsIcon from "@mui/icons-material/Dns";
import SpeedIcon from "@mui/icons-material/Speed";
import HubIcon from "@mui/icons-material/Hub";

function InfoRow({ label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 2,
        py: 0.75,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box
        component="div"
        sx={{
          fontWeight: 600,
          textAlign: "right",
          wordBreak: "break-word",
          fontSize: "0.875rem",
          lineHeight: 1.43,
        }}
      >
        {value ?? "—"}
      </Box>
    </Box>
  );
}

function SectionCard({ icon, title, children }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        backgroundImage: (t) =>
          t.palette.mode === "dark"
            ? "linear-gradient(145deg, rgba(30,41,59,0.4), rgba(15,23,42,0.6))"
            : "linear-gradient(145deg, #ffffff, #f8fafc)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.75 }}>
        {icon}
        <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      {children}
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Credential row — masked by default, eye toggle to reveal, copy button.
// ---------------------------------------------------------------------------
function CredentialRow({ label, value, mono = false, sensitive = false }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (value == null) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available (e.g. insecure origin) — silently fail
    }
  }, [value]);

  const displayValue = value == null || value === ""
    ? "—"
    : (sensitive && !revealed)
      ? "••••••••"
      : String(value);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 1,
        py: 0.75,
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, flexShrink: 0 }}>
        {label}
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0, flex: 1, justifyContent: "flex-end" }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 600,
            textAlign: "right",
            wordBreak: "break-all",
            fontSize: "0.875rem",
            lineHeight: 1.43,
            fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
          }}
        >
          {displayValue}
        </Typography>
        {sensitive && value != null && value !== "" && (
          <Tooltip title={revealed ? "Hide" : "Show"}>
            <IconButton
              size="small"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? "Hide value" : "Show value"}
            >
              {revealed ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {value != null && value !== "" && (
          <Tooltip title={copied ? "Copied!" : "Copy"}>
            <IconButton size="small" onClick={handleCopy} aria-label={`Copy ${label}`}>
              <ContentCopy fontSize="small" color={copied ? "success" : "inherit"} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Connection-string block — monospace, copy button, collapsible hints.
// ---------------------------------------------------------------------------
function ConnectionStringBlock({ platform, cfg, serviceHost }) {
  const [copied, setCopied] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const uri = buildConnectionString(platform, cfg, serviceHost);
  const hints = buildConnectionHints(platform, cfg, serviceHost);

  if (!uri) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.75 }}>
        Connection string
      </Typography>
      <Box
        sx={{
          position: "relative",
          p: 1.5,
          borderRadius: 1.5,
          bgcolor: (t) => t.palette.mode === "dark" ? "rgba(2,6,23,0.6)" : "rgba(15,23,42,0.04)",
          border: "1px solid",
          borderColor: "divider",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: "0.8rem",
          wordBreak: "break-all",
          lineHeight: 1.5,
          pr: 5,
        }}
      >
        {uri}
        <Tooltip title={copied ? "Copied!" : "Copy connection string"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            sx={{ position: "absolute", top: 4, right: 4 }}
            aria-label="Copy connection string"
          >
            <ContentCopy fontSize="small" color={copied ? "success" : "inherit"} />
          </IconButton>
        </Tooltip>
      </Box>

      {hints.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: "pointer", userSelect: "none" }}
            onClick={() => setShowHints((s) => !s)}
          >
            <TerminalIcon fontSize="small" color="action" />
            <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
              {showHints ? "Hide" : "Show"} connection examples
            </Typography>
          </Box>
          <Collapse in={showHints}>
            <Box
              sx={{
                mt: 1,
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: (t) => t.palette.mode === "dark" ? "rgba(2,6,23,0.4)" : "rgba(15,23,42,0.02)",
                border: "1px solid",
                borderColor: "divider",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "0.75rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {hints.join("\n")}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Database credentials card — fetches real credentials via the reveal
// endpoint (because DeploySerializer masks them in the regular API).
// ---------------------------------------------------------------------------
function DatabaseCredentialsCard({ selectedDeploy, serviceHost }) {
  const [creds, setCreds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deployId = selectedDeploy?.id || selectedDeploy?.pk;
  const platform = parseDeployConfig(selectedDeploy?.config).platform || selectedDeploy?.platform;

  const fetchCreds = useCallback(async () => {
    if (!deployId) return;
    setLoading(true);
    setError(null);
    try {
      const access = localStorage.getItem("access");
      const headers = access ? { Authorization: `Bearer ${access}` } : {};
      const resp = await fetch(`${DEPLOY_BASE}${deployId}/reveal_db_credentials/`, { headers });
      const data = await resp.json();
      if (!resp.ok || data.result === "error") {
        throw new Error(data.detail || `HTTP ${resp.status}`);
      }
      setCreds(data.config);
    } catch (e) {
      setError(e.message || "Failed to load credentials.");
    } finally {
      setLoading(false);
    }
  }, [deployId]);

  useEffect(() => {
    // Only auto-fetch when the deploy is a DB platform.
    if (deployId && isDbPlatform(platform)) {
      fetchCreds();
    } else {
      setCreds(null);
    }
  }, [deployId, platform, fetchCreds]);

  if (!isDbPlatform(platform)) return null;

  return (
    <SectionCard
      icon={<StorageIcon color="primary" fontSize="small" />}
      title="Database credentials"
    >
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">Loading credentials…</Typography>
        </Box>
      )}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 1 }}
          action={
            <IconButton color="inherit" size="small" onClick={fetchCreds}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          }
        >
          {error}
        </Alert>
      )}
      {!loading && !error && creds && (
        <>
          <CredentialRow label="Platform" value={platform} />
          <CredentialRow label="Host" value={serviceHost || "—"} mono />
          <CredentialRow label="Port" value={creds.port ?? "default"} mono />
          <CredentialRow label="Database" value={creds.database} mono />
          <CredentialRow label="Username" value={creds.username} mono />
          <CredentialRow label="Password" value={creds.password} mono sensitive />
          {creds.root_password != null && (
            <CredentialRow label="Root password" value={creds.root_password} mono sensitive />
          )}
          {creds.env && Object.keys(creds.env).length > 0 && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                Extra environment variables
              </Typography>
              {Object.entries(creds.env).map(([k, v]) => (
                <CredentialRow key={k} label={k} value={v} mono sensitive />
              ))}
            </>
          )}
          <ConnectionStringBlock platform={platform} cfg={creds} serviceHost={serviceHost} />
        </>
      )}
    </SectionCard>
  );
}

export default function OverviewPanel({
  service,
  serviceRunning,
  selectedDeploy,
  planDetail,
  networkName,
  networkDetail,
  hideServiceIdentity = false,
}) {
  const serviceHost = service?.service_host || null;

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960, width: "100%" }}>
      {!hideServiceIdentity ? (
      <SectionCard
        icon={<DnsIcon color="primary" fontSize="small" />}
        title="Service details"
      >
        <InfoRow label="Name" value={service?.name} />
        <InfoRow label="Service name" value={service?.service_name || null} />
        <InfoRow label="Service host" value={serviceHost} />
        <InfoRow label="Status" value={service?.status} />
        <InfoRow
          label="Running"
          value={
            serviceRunning === null ? null : serviceRunning ? (
              <Chip label="Yes" size="small" color="success" sx={{ height: 22, fontWeight: 600 }} />
            ) : (
              <Chip label="No" size="small" color="default" sx={{ height: 22 }} />
            )
          }
        />
        <InfoRow
          label="Selected deploy"
          value={
            selectedDeploy
              ? `${selectedDeploy.name || selectedDeploy.id}${
                  selectedDeploy.version ? ` (v${selectedDeploy.version})` : ""
                }`
              : "None"
          }
        />
        {service?.created_at ? (
          <InfoRow label="Created" value={formatDate(service.created_at)} />
        ) : null}
        {service?.updated_at ? (
          <InfoRow label="Updated" value={formatDate(service.updated_at)} />
        ) : null}
      </SectionCard>
      ) : (
      <SectionCard
        icon={<DnsIcon color="primary" fontSize="small" />}
        title="Selected deploy"
      >
        <InfoRow
          label="Deploy"
          value={
            selectedDeploy
              ? `${selectedDeploy.name || selectedDeploy.id}${
                  selectedDeploy.version ? ` (v${selectedDeploy.version})` : ""
                }`
              : "None"
          }
        />
        {service?.created_at ? (
          <InfoRow label="Created" value={formatDate(service.created_at)} />
        ) : null}
        {service?.updated_at ? (
          <InfoRow label="Updated" value={formatDate(service.updated_at)} />
        ) : null}
      </SectionCard>
      )}

      {/* Database credentials card — only renders for DB-platform deploys. */}
      {selectedDeploy && (
        <DatabaseCredentialsCard
          selectedDeploy={selectedDeploy}
          serviceHost={serviceHost}
        />
      )}

      <SectionCard
        icon={<SpeedIcon color="primary" fontSize="small" />}
        title="Plan"
      >
        <InfoRow label="Name" value={planDetail?.name ?? service?.plan?.name} />
        <InfoRow
          label="Platform"
          value={planDetail?.platform ?? service?.plan?.platform}
        />
        <InfoRow
          label="CPU"
          value={planDetail?.max_cpu ?? service?.plan?.max_cpu}
        />
        <InfoRow
          label="RAM"
          value={planDetail?.max_ram ?? service?.plan?.max_ram}
        />
        <InfoRow
          label="Storage"
          value={planDetail?.max_storage ?? service?.plan?.max_storage}
        />
        <InfoRow
          label="Price / hour"
          value={planDetail?.price_per_hour ?? service?.plan?.price_per_hour}
        />
      </SectionCard>

      <SectionCard
        icon={<HubIcon color="primary" fontSize="small" />}
        title="Network"
      >
        <InfoRow label="Name" value={networkName} />
        {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && (
          <InfoRow
            label="CIDR"
            value={networkDetail?.network?.cidr ?? networkDetail?.cidr}
          />
        )}
      </SectionCard>
    </Stack>
  );
}
