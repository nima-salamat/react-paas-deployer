import React, { useCallback, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  ButtonBase,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import StorageIcon from "@mui/icons-material/Storage";
import HubIcon from "@mui/icons-material/Hub";

/**
 * Compact sticky header for mobile — single source of truth for
 * service identity + counts (not repeated in sidebar / controls).
 */
export default function MobileServiceHeader({
  service,
  serviceRunning,
  selectedDeploy,
  selectedPlatform,
  selectedIsDb,
  deployCount = 0,
  volumeCount = 0,
  networkName,
  activeTabLabel,
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const host = service?.service_host || null;
  const serviceName = service?.service_name || null;
  const copyTarget = host || serviceName;

  const statusLabel =
    serviceRunning === true
      ? "Running"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? String(service.status)
      : serviceRunning === false
      ? "Stopped"
      : service?.status || "Unknown";

  const statusColor =
    serviceRunning === true ||
    ["running", "success"].includes(String(service?.status || ""))
      ? "success"
      : ["queued", "deploying", "stopping"].includes(String(service?.status || ""))
      ? "warning"
      : "default";

  const handleCopy = useCallback(async () => {
    if (!copyTarget) return;
    try {
      await navigator.clipboard.writeText(String(copyTarget));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  }, [copyTarget]);

  return (
    <Paper
      elevation={0}
      sx={{
        position: "sticky",
        top: 0,
        zIndex: (t) => t.zIndex.appBar - 1,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        mb: 1.5,
        overflow: "hidden",
        bgcolor: (t) =>
          t.palette.mode === "dark" ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.96)",
        backdropFilter: "blur(10px)",
      }}
    >
      <ButtonBase
        onClick={() => setExpanded((v) => !v)}
        sx={{
          display: "block",
          width: "100%",
          textAlign: "left",
          px: 1.5,
          py: 1.25,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  wordBreak: "break-word",
                }}
              >
                {service?.name || "Service"}
              </Typography>
              <Chip
                label={statusLabel}
                size="small"
                color={statusColor}
                sx={{ height: 22, fontWeight: 700, fontSize: 11 }}
              />
              {activeTabLabel ? (
                <Chip
                  label={activeTabLabel}
                  size="small"
                  variant="outlined"
                  color="primary"
                  sx={{ height: 22, fontSize: 11, fontWeight: 600 }}
                />
              ) : null}
            </Stack>

            {(host || serviceName) && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  display: "block",
                  mt: 0.4,
                  fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
                  fontSize: 11.5,
                  wordBreak: "break-all",
                  lineHeight: 1.35,
                }}
              >
                {host || serviceName}
              </Typography>
            )}
          </Box>

          <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0, mt: 0.25 }}>
            {copyTarget ? (
              <Tooltip title={copied ? "Copied" : "Copy host"}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  sx={{ p: 0.5 }}
                >
                  {copied ? (
                    <CheckIcon sx={{ fontSize: 18, color: "success.main" }} />
                  ) : (
                    <ContentCopyIcon sx={{ fontSize: 18 }} />
                  )}
                </IconButton>
              </Tooltip>
            ) : null}
            {expanded ? (
              <ExpandLessIcon sx={{ color: "text.secondary", fontSize: 22 }} />
            ) : (
              <ExpandMoreIcon sx={{ color: "text.secondary", fontSize: 22 }} />
            )}
          </Stack>
        </Stack>
      </ButtonBase>

      <Collapse in={expanded}>
        <Box sx={{ px: 1.5, pb: 1.5, pt: 0 }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Chip
              icon={<Inventory2Icon sx={{ fontSize: "14px !important" }} />}
              label={`${deployCount}`}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontWeight: 600 }}
            />
            <Chip
              icon={<StorageIcon sx={{ fontSize: "14px !important" }} />}
              label={`${volumeCount}`}
              size="small"
              variant="outlined"
              sx={{ height: 24, fontWeight: 600 }}
            />
            <Chip
              icon={<HubIcon sx={{ fontSize: "14px !important" }} />}
              label={networkName && networkName !== "—" ? networkName : "No net"}
              size="small"
              variant="outlined"
              sx={{ height: 24, maxWidth: 140 }}
            />
            {selectedPlatform ? (
              <Chip
                label={`${selectedIsDb ? "DB" : "App"} · ${selectedPlatform}`}
                size="small"
                color={selectedIsDb ? "info" : "default"}
                variant="outlined"
                sx={{ height: 24 }}
              />
            ) : null}
            {selectedDeploy ? (
              <Chip
                label={`Sel: ${selectedDeploy.name || selectedDeploy.id}`}
                size="small"
                color="success"
                sx={{ height: 24, fontWeight: 600, maxWidth: 160 }}
              />
            ) : null}
          </Stack>
          {serviceName && host && serviceName !== host ? (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              docker: {serviceName}
            </Typography>
          ) : null}
        </Box>
      </Collapse>
    </Paper>
  );
}
