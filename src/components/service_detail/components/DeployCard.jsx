import React, { memo } from "react";
import { Box, Paper, Typography, Button, Stack, Chip, Avatar, useTheme } from "@mui/material";
import { getDeployPlatform, isDbPlatform, formatDate, shallowEqualObj, parseDeployConfig } from "../utils";

export default memo(function DeployCard({
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

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, sm: 1.75 },
        borderRadius: 1.5,
        height: "100%",
        maxWidth: "100%",
        bgcolor:
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.03)"
            : "rgba(255,255,255,0.9)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
      }}
    >
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.25} justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                fontSize: 15,
              }}
            >
              {(deploy?.name || "?").charAt(0).toUpperCase()}
            </Avatar>

            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 800, lineHeight: 1.2, wordBreak: "break-word" }}
                >
                  {deploy?.name || "Unnamed deploy"}
                </Typography>
                {isSelected ? <Chip label="Selected" size="small" color="success" /> : null}
                {(() => {
                  const p = getDeployPlatform(deploy);
                  const db = isDbPlatform(p);
                  return p ? (
                    <Chip
                      label={`${db ? "DB" : "App"} · ${p}`}
                      size="small"
                      color={db ? "info" : "default"}
                      variant="outlined"
                    />
                  ) : null;
                })()}
                {statusText ? <Chip label={statusText} size="small" variant="outlined" /> : null}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                v{deploy?.version || "—"} · {formatDate(deploy?.created_at)}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        <Box sx={{ minHeight: 40, flex: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 12.5,
              lineHeight: 1.45,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {snippet ? snippet.slice(0, 160) : "No configuration text."}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant={isSelected ? "outlined" : "contained"}
            disabled={busy || cannotSelect}
            onClick={() => (isSelected ? onUnselect(deploy) : onSelect(deploy))}
            sx={{ flex: "1 1 auto", minWidth: 72 }}
          >
            {busy ? "..." : isSelected ? "Unselect" : "Select"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onEdit(deploy)}
            disabled={busy}
            sx={{ flex: "1 1 auto", minWidth: 56 }}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onDelete(deploy)}
            disabled={busy}
            sx={{ flex: "1 1 auto", minWidth: 56 }}
          >
            Delete
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}, (prev, next) => {
  if (prev.deploy !== next.deploy) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.cannotSelect !== next.cannotSelect) return false;
  return shallowEqualObj(prev.actionState || {}, next.actionState || {});
});