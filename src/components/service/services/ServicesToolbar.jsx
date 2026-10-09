import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import FilterListIcon from "@mui/icons-material/FilterList";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";

export default function ServicesToolbar({
  query,
  setQuery,
  onSearch,
  onClearSearch = null,
  viewMode,
  setViewMode,
  kindFilter,
  setKindFilter,
  kindCounts,
  autoRefresh,
  setAutoRefresh,
  refreshInterval,
  setRefreshInterval,
  onRefresh,
  refreshDisabled,
  menuAnchorEl,
  setMenuAnchorEl,
  showSearch = true,
  shareScope = "mine",
  setShareScope = null,
  shareCounts = { mine: 0, shared_with_me: 0, shared_by_me: 0 },
}) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2.5,
          flexWrap: "wrap",
          gap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            fontWeight={850}
            sx={{ letterSpacing: "-0.025em", lineHeight: 1.15 }}
          >
            {shareScope === "shared_with_me"
              ? "Shared with me"
              : shareScope === "shared_by_me"
              ? "Shared by me"
              : "My Services"}
          </Typography>
          {shareScope === "mine" && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35 }}>
              Build from scratch or start with a managed app.
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={0.6} alignItems="center">
          {shareScope === "mine" && (
            <Button
              component={RouterLink}
              to="/dashboard/ready-apps"
              size="small"
              variant="outlined"
              startIcon={<AppsOutlinedIcon sx={{ fontSize: 17 }} />}
              sx={{ borderRadius: 1.8, fontWeight: 800, textTransform: "none", minHeight: 36 }}
            >
              App Library
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton
              onClick={onRefresh}
              disabled={refreshDisabled}
              size="small"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton
              onClick={(e) => setMenuAnchorEl(e.currentTarget)}
              size="small"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1.5,
              }}
            >
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchorEl}
            open={Boolean(menuAnchorEl)}
            onClose={() => setMenuAnchorEl(null)}
            disableScrollLock
            PaperProps={{ sx: { borderRadius: 2, minWidth: 220, mt: 1 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                Settings
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    size="small"
                  />
                }
                label="Auto refresh"
              />
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={0.75}
                >
                  Interval
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  disabled={!autoRefresh}
                >
                  <MenuItem value={2000}>2s</MenuItem>
                  <MenuItem value={5000}>5s</MenuItem>
                  <MenuItem value={10000}>10s</MenuItem>
                  <MenuItem value={30000}>30s</MenuItem>
                </Select>
              </Box>
            </Box>
          </Menu>
        </Stack>
      </Box>

      {showSearch && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, sm: 2 },
            mb: 3,
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(220px, 1fr) 125px minmax(0, max-content)" },
            gap: 1.25,
            alignItems: "center",
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              onSearch();
            }}
            sx={{ display: "flex", gap: 1, flexGrow: 1, width: "100%", minWidth: 0, gridColumn: { xs: "1 / -1", md: "1" } }}
          >
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services by name or owner…"
            InputProps={{
                endAdornment: query ? (
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => (onClearSearch ? onClearSearch() : setQuery(""))}
                  >
                    <Typography component="span" sx={{ fontSize: 16, lineHeight: 1 }}>×</Typography>
                  </IconButton>
                ) : null,
              }}
            />
            <Button
              variant="contained"
              type="submit"
              disableElevation
              sx={{
                borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 700,
                px: { xs: 1.75, sm: 2.5 },
                flexShrink: 0,
                minHeight: 40,
              }}
            >
              Search
            </Button>
          </Box>
          <FormControl size="small" sx={{ gridColumn: { xs: "1 / -1", md: "2" }, width: { xs: "100%", md: 125 }, minWidth: 0 }}>
            <InputLabel>View</InputLabel>
            <Select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              label="View"
            >
              <MenuItem value="cards">Cards</MenuItem>
              <MenuItem value="rows">List</MenuItem>
              <MenuItem value="overview">Overview</MenuItem>
            </Select>
          </FormControl>
          {typeof setShareScope === "function" && (
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ width: "100%", mb: 0, gridColumn: "1 / -1", gridRow: { md: 2 } }}
            >
              {[
                { key: "mine", label: `Mine (${shareCounts.mine ?? 0})` },
                {
                  key: "shared_with_me",
                  label: `Shared with me (${shareCounts.shared_with_me ?? 0})`,
                },
                {
                  key: "shared_by_me",
                  label: `I shared (${shareCounts.shared_by_me ?? 0})`,
                },
              ].map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  size="small"
                  color={shareScope === f.key ? "secondary" : "default"}
                  variant={shareScope === f.key ? "filled" : "outlined"}
                  onClick={() => setShareScope(f.key)}
                  sx={{ fontWeight: 700, height: 28 }}
                />
              ))}
            </Stack>
          )}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ gridColumn: { xs: "1 / -1", md: "3" }, gridRow: { md: 1 }, justifyContent: { xs: "flex-start", md: "flex-end" }, minWidth: 0 }}
          >
            <FilterListIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            {[
              { key: "all", label: `All (${kindCounts.all})` },
              {
                key: "app",
                label: `App (${kindCounts.app})`,
                icon: <WidgetsOutlinedIcon sx={{ fontSize: 16 }} />,
              },
              {
                key: "db",
                label: `Database (${kindCounts.db})`,
                icon: <StorageOutlinedIcon sx={{ fontSize: 16 }} />,
                color: "info",
              },
            ].map((f) => (
              <Chip
                key={f.key}
                icon={f.icon}
                label={f.label}
                size="small"
                color={kindFilter === f.key ? f.color || "primary" : "default"}
                variant={kindFilter === f.key ? "filled" : "outlined"}
                onClick={() => setKindFilter(f.key)}
                sx={{ fontWeight: 700, height: 28 }}
              />
            ))}
          </Stack>
        </Paper>
      )}
    </>
  );
}
