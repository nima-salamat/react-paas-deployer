import React from "react";
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  Divider,
  Paper,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Refresh as RefreshIcon,
  Timer as TimerIcon,
  TimerOff as TimerOffIcon,
  Check as CheckIcon,
} from "@mui/icons-material";
import { REFRESH_INTERVAL_OPTIONS } from "../constants";

export default function ServiceToolbar({
  refreshIntervalMs,
  setRefreshIntervalMs,
  intervalMenuAnchor,
  setIntervalMenuAnchor,
  onRefresh,
  refreshing = false,
  navigate,
}) {
  const open = Boolean(intervalMenuAnchor);

  const handleOpenMenu = (event) => setIntervalMenuAnchor(event.currentTarget);
  const handleCloseMenu = () => setIntervalMenuAnchor(null);

  const handleSelectInterval = (value) => {
    setRefreshIntervalMs(value);
    handleCloseMenu();
  };

  const isOff = refreshIntervalMs == null || refreshIntervalMs < 1000;
  const currentLabel = isOff
    ? "Off"
    : REFRESH_INTERVAL_OPTIONS.find((o) => o.value === refreshIntervalMs)?.label ??
      `${Math.round(refreshIntervalMs / 1000)}s`;

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
        flexWrap: "wrap",
        px: 1.5,
        py: 1,
        mb: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: (t) =>
          t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
      }}
    >
      {/* Left: back */}
      <Tooltip title="Back to services list">
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => navigate("/services")}
          variant="text"
          color="inherit"
          sx={{ fontWeight: 600, textTransform: "none" }}
        >
          Services
        </Button>
      </Tooltip>

      {/* Right: refresh + interval */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: "auto" }}>
        <Tooltip title="Refresh now">
          <span>
            <IconButton
              size="small"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={`Auto-refresh: ${currentLabel}`}>
          <Button
            size="small"
            startIcon={
              isOff ? <TimerOffIcon fontSize="small" /> : <TimerIcon fontSize="small" />
            }
            onClick={handleOpenMenu}
            variant="outlined"
            color={isOff ? "inherit" : "primary"}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 1.5,
              minWidth: 72,
            }}
            aria-controls={open ? "refresh-interval-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={open ? "true" : undefined}
          >
            {currentLabel}
          </Button>
        </Tooltip>
      </Box>

      <Menu
        id="refresh-interval-menu"
        anchorEl={intervalMenuAnchor}
        open={open}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{ sx: { minWidth: 200, borderRadius: 2, mt: 0.5 } }}
      >
        <MenuItem disabled dense>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Auto-refresh interval
          </Typography>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        {REFRESH_INTERVAL_OPTIONS.map((opt) => (
          <MenuItem
            key={opt.value}
            selected={refreshIntervalMs === opt.value}
            onClick={() => handleSelectInterval(opt.value)}
            dense
            sx={{ borderRadius: 1, mx: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              {refreshIntervalMs === opt.value ? (
                <CheckIcon fontSize="small" color="primary" />
              ) : null}
            </ListItemIcon>
            <ListItemText primary={opt.label} />
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          selected={isOff}
          onClick={() => handleSelectInterval(0)}
          dense
          sx={{ borderRadius: 1, mx: 0.5 }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            {isOff ? (
              <CheckIcon fontSize="small" color="primary" />
            ) : (
              <TimerOffIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText primary="Disable auto-refresh" />
        </MenuItem>
      </Menu>
    </Paper>
  );
}
