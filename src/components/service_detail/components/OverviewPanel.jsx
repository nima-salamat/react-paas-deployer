import React from "react";
import { Paper, Typography, Box, Stack } from "@mui/material";
import { formatDate } from "../utils";

export default function OverviewPanel({
  service,
  serviceRunning,
  selectedDeploy,
  planDetail,
  networkName,
  networkDetail,
}) {
  return (
    <Stack spacing={{ xs: 1.5, sm: 2 }} sx={{ maxWidth: 960 }}>
      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Service details
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {service?.name || "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Host:</strong>{" "}
            {service?.service_name
              ? `${service.service_name}.${import.meta.env.VITE_DEPLOY_BASE}`
              : "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Status:</strong> {service?.status || "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Running:</strong>{" "}
            {serviceRunning === null ? "—" : serviceRunning ? "Yes" : "No"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Selected deploy:</strong>{" "}
            {selectedDeploy
              ? `${selectedDeploy.name || selectedDeploy.id}${
                  selectedDeploy.version ? ` (v${selectedDeploy.version})` : ""
                }`
              : "None"}
          </Box>
          {service?.created_at ? (
            <Box sx={{ mb: 0.75 }}>
              <strong>Created:</strong> {formatDate(service.created_at)}
            </Box>
          ) : null}
          {service?.updated_at ? (
            <Box sx={{ mb: 0.75 }}>
              <strong>Updated:</strong> {formatDate(service.updated_at)}
            </Box>
          ) : null}
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Plan
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {planDetail?.name ?? service?.plan?.name ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Platform:</strong>{" "}
            {planDetail?.platform ?? service?.plan?.platform ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>CPU:</strong> {planDetail?.max_cpu ?? service?.plan?.max_cpu ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>RAM:</strong> {planDetail?.max_ram ?? service?.plan?.max_ram ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Storage:</strong>{" "}
            {planDetail?.max_storage ?? service?.plan?.max_storage ?? "—"}
          </Box>
          <Box sx={{ mb: 0.75 }}>
            <strong>Price:</strong>{" "}
            {planDetail?.price_per_hour ?? service?.plan?.price_per_hour ?? "—"}
          </Box>
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
          Network
        </Typography>
        <Box sx={{ fontSize: 13, color: "text.secondary" }}>
          <Box sx={{ mb: 0.75 }}>
            <strong>Name:</strong> {networkName}
          </Box>
          {(networkDetail?.network?.cidr ?? networkDetail?.cidr) && (
            <Box sx={{ mb: 0.75 }}>
              <strong>CIDR:</strong>{" "}
              {networkDetail?.network?.cidr ?? networkDetail?.cidr}
            </Box>
          )}
        </Box>
      </Paper>
    </Stack>
  );
}