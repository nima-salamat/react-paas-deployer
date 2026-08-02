import React, { memo } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Avatar,
  useTheme,
} from "@mui/material";
import {
  getDeployPlatform,
  isDbPlatform,
  formatDate,
  shallowEqualObj,
} from "../utils";

export default memo(
  function DeployCard({
    deploy,
    isSelected,
    cannotSelect,
    actionState,
    onEdit,
    onSelect,
    onUnselect,
    onDelete,
  }) {
    const theme = useTheme();
    const busy =
      Boolean(actionState?.selecting) ||
      Boolean(actionState?.updating) ||
      Boolean(actionState?.deleting);

    const statusText = String(deploy?.status ?? deploy?.stage ?? "").trim();
    const snippet =
      typeof deploy?.config === "string"
        ? deploy.config
        : deploy?.config
        ? JSON.stringify(deploy.config, null, 2)
        : "";

    const platform = getDeployPlatform(deploy);
    const isDb = isDbPlatform(platform);

    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.75, sm: 2 },
          borderRadius: 2,
          height: "100%",
          maxWidth: "100%",
          border: "1px solid",
          borderColor: isSelected ? "success.main" : "divider",
          bgcolor: (t) =>
            isSelected
              ? t.palette.mode === "dark"
                ? "rgba(34,197,94,0.08)"
                : "rgba(34,197,94,0.04)"
              : t.palette.mode === "dark"
              ? "rgba(255,255,255,0.02)"
              : "#fff",
          transition: "border-color 0.15s, box-shadow 0.15s",
          "&:hover": {
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          },
        }}
      >
        <Stack spacing={1.5} sx={{ height: "100%" }}>
          <Stack
            direction="row"
            spacing={1.25}
            justifyContent="space-between"
            alignItems="flex-start"
          >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  bgcolor: isDb ? "info.main" : "primary.main",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {(deploy?.name || "?").charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 800,
                      lineHeight: 1.25,
                      wordBreak: "break-word",
                    }}
                  >
                    {deploy?.name || "Unnamed deploy"}
                  </Typography>
                  {isSelected ? (
                    <Chip
                      label="Selected"
                      size="small"
                      color="success"
                      sx={{ height: 20, fontSize: 11, fontWeight: 700 }}
                    />
                  ) : null}
                </Stack>

                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mt: 0.5 }}
                >
                  {platform ? (
                    <Chip
                      label={`${isDb ? "DB" : "App"} · ${platform}`}
                      size="small"
                      color={isDb ? "info" : "default"}
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  ) : null}
                  {statusText ? (
                    <Chip
                      label={statusText}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  ) : null}
                </Stack>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  v{deploy?.version || "—"} · {formatDate(deploy?.created_at)}
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <Box sx={{ minHeight: 44, flex: 1 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12.5,
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              }}
            >
              {snippet ? snippet.slice(0, 160) : "No configuration text."}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant={isSelected ? "outlined" : "contained"}
              color={isSelected ? "success" : "primary"}
              disabled={busy || cannotSelect}
              onClick={() => (isSelected ? onUnselect(deploy) : onSelect(deploy))}
              sx={{
                flex: "1 1 auto",
                minWidth: 72,
                borderRadius: 1.5,
                fontWeight: 700,
                textTransform: "none",
              }}
            >
              {busy ? "..." : isSelected ? "Unselect" : "Select"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => onEdit(deploy)}
              disabled={busy}
              sx={{
                flex: "1 1 auto",
                minWidth: 56,
                borderRadius: 1.5,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              Edit
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onDelete(deploy)}
              disabled={busy}
              sx={{
                flex: "1 1 auto",
                minWidth: 56,
                borderRadius: 1.5,
                fontWeight: 600,
                textTransform: "none",
              }}
            >
              Delete
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  },
  (prev, next) => {
    if (prev.deploy !== next.deploy) return false;
    if (prev.isSelected !== next.isSelected) return false;
    if (prev.cannotSelect !== next.cannotSelect) return false;
    return shallowEqualObj(prev.actionState || {}, next.actionState || {});
  }
);
