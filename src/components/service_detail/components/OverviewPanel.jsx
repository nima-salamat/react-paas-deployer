import React from "react";
import { Paper, Typography, Box, Stack, Divider, Chip } from "@mui/material";
import { formatDate } from "../utils";
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
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          textAlign: "right",
          wordBreak: "break-word",
        }}
      >
        {value ?? "—"}
      </Typography>
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

export default function OverviewPanel({
  service,
  serviceRunning,
  selectedDeploy,
  planDetail,
  networkName,
  networkDetail,
}) {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 960 }}>
      <SectionCard
        icon={<DnsIcon color="primary" fontSize="small" />}
        title="Service details"
      >
        <InfoRow label="Name" value={service?.name} />
        <InfoRow label="Service name" value={service?.service_name || null} />
        <InfoRow label="Service host" value={service?.service_host || null} />
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
