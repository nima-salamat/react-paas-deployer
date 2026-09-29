import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { getApiErrorMeta } from "../errorUtils";

export default function ServiceErrorAlert({
  error,
  onRetry,
  onClose,
  title = "Action failed",
}) {
  if (!error) return null;

  const meta = getApiErrorMeta(
    typeof error === "string" ? { message: error } : error,
    title
  );

  return (
    <Collapse in={Boolean(error)} unmountOnExit>
      <Alert
        severity="error"
        icon={<ErrorOutlineRoundedIcon />}
        sx={{
          mb: 2,
          borderRadius: 2.5,
          alignItems: "flex-start",
          border: "1px solid",
          borderColor: "error.main",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(127,29,29,0.18)"
              : "rgba(254,226,226,0.72)",
          "& .MuiAlert-message": { width: "100%" },
        }}
        action={
          <Stack direction="row" spacing={0.5}>
            {onRetry ? (
              <Button
                size="small"
                color="inherit"
                startIcon={<RefreshRoundedIcon fontSize="small" />}
                onClick={onRetry}
                sx={{ fontWeight: 800 }}
              >
                Retry
              </Button>
            ) : null}
            {onClose ? (
              <Button
                size="small"
                color="inherit"
                startIcon={<CloseRoundedIcon fontSize="small" />}
                onClick={onClose}
                sx={{ fontWeight: 800 }}
              >
                Dismiss
              </Button>
            ) : null}
          </Stack>
        }
      >
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography sx={{ fontWeight: 850 }}>{title}</Typography>
            {meta.status ? (
              <Chip
                size="small"
                label={meta.code ? `${meta.status} · ${meta.code}` : String(meta.status)}
                color="error"
                variant="outlined"
                sx={{ fontWeight: 800, height: 23 }}
              />
            ) : null}
          </Stack>
          <Box sx={{ color: "text.primary", lineHeight: 1.55, wordBreak: "break-word" }}>
            {meta.message}
          </Box>
          {meta.statusMessage && meta.statusMessage !== meta.message ? (
            <Typography variant="caption" color="text.secondary">
              {meta.statusMessage}
            </Typography>
          ) : null}
        </Stack>
      </Alert>
    </Collapse>
  );
}
