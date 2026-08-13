import React, { useState } from "react";
import {
  Box, CircularProgress, Drawer, FormControl, IconButton,
  MenuItem, Select, Stack, Tooltip, Typography, Chip, alpha, Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import AdminTicketMessage from "./AdminTicketMessage.jsx";
import AdminTicketComposer from "./AdminTicketComposer.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import AdminProfileView from "./AdminProfileView.jsx";
import { STATUS_COLOR } from "../adminUtils";

const RAIL_W = 44;

/**
 * TicketDetailDrawer — status select sits top-right in the header row
 * so the message thread gets more vertical space.
 */
export default function TicketDetailDrawer({
  open,
  detail,
  detailLoading,
  reply,
  setReply,
  files,
  setFiles,
  sending,
  onClose,
  onSend,
  onChangeStatus,
  onDelete,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewUser, setViewUser] = useState(null);
  const statusColor = STATUS_COLOR[detail?.status] || "default";

  const ticketUser = detail?.user || null;
  const username = ticketUser?.username;

  const openMessenger = () => {
    if (!username) return;
    const url = `/messenger#u/${encodeURIComponent(username)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: "min(600px, 100vw)" },
            maxWidth: 680,
            height: "100%",
            display: "flex",
            flexDirection: "row",
            overflow: "hidden",
          },
        }}
      >
        {/* Thin left action rail */}
        <Box
          sx={{
            width: RAIL_W,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            bgcolor: (t) => alpha(t.palette.action.hover, 0.35),
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 1,
            gap: 0.5,
          }}
        >
          <Tooltip title="Close" placement="right">
            <IconButton size="small" onClick={onClose} aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Divider flexItem sx={{ my: 0.5, width: 28, alignSelf: "center" }} />

          {ticketUser && (
            <Tooltip title="View profile" placement="right">
              <IconButton
                size="small"
                onClick={() => setViewUser(ticketUser)}
                aria-label="View profile"
              >
                <PersonOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {username && (
            <Tooltip title={`Message ${username} in messenger`} placement="right">
              <IconButton
                size="small"
                onClick={openMessenger}
                aria-label="Open messenger"
                color="primary"
              >
                <ChatBubbleOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ flex: 1 }} />

          {detail && onDelete && (
            <Tooltip title="Delete ticket" placement="right">
              <IconButton
                size="small"
                color="error"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete ticket"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Main column */}
        <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Compact single header — status on top-right */}
          <Box
            sx={{
              px: 1.75,
              py: 1.15,
              borderBottom: 1,
              borderColor: "divider",
              flexShrink: 0,
              bgcolor: (t) => alpha(t.palette.action.hover, 0.2),
            }}
          >
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              gap={1.25}
            >
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack direction="row" alignItems="center" gap={0.75} mb={0.35} flexWrap="wrap">
                  <Typography fontWeight={800} noWrap sx={{ fontSize: 13.5 }}>
                    {detail?.public_id || "Ticket"}
                  </Typography>
                  {detail?.status && (
                    <Chip
                      size="small"
                      label={detail.status}
                      color={statusColor}
                      sx={{ height: 20, fontWeight: 700, borderRadius: 1, fontSize: 11 }}
                    />
                  )}
                </Stack>
                {detail && (
                  <>
                    <Typography
                      sx={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3 }}
                      noWrap
                    >
                      {detail.subject}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.2 }} noWrap>
                      {detail.user?.username || "—"}
                      {detail.user?.email ? ` · ${detail.user.email}` : ""}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Status dropdown — top right */}
              {detail && onChangeStatus && (
                <FormControl size="small" sx={{ minWidth: 140, flexShrink: 0, mt: 0.15 }}>
                  <Select
                    value={detail.status}
                    onChange={(e) => onChangeStatus(e.target.value)}
                    sx={{
                      borderRadius: 1.25,
                      fontWeight: 600,
                      fontSize: 12.5,
                      height: 34,
                    }}
                  >
                    {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Stack>
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
            {detailLoading && !detail && (
              <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                <CircularProgress size={32} />
              </Box>
            )}

            {detail && (
              <>
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.75,
                    p: 1.75,
                    bgcolor: (t) =>
                      t.palette.mode === "dark"
                        ? alpha(t.palette.common.black, 0.25)
                        : alpha(t.palette.grey[100], 0.85),
                  }}
                >
                  {(detail.messages || []).length === 0 ? (
                    <Typography
                      sx={{ textAlign: "center", py: 4, fontSize: 13, color: "text.secondary" }}
                    >
                      No messages yet.
                    </Typography>
                  ) : (
                    (detail.messages || []).map((msg) => (
                      <AdminTicketMessage
                        key={msg.id}
                        message={msg}
                        showHtmlToggle
                        onAvatarClick={(user) => setViewUser(user || msg.user || msg.author)}
                      />
                    ))
                  )}
                </Box>

                {detail.status !== "closed" && (
                  <Box sx={{ flexShrink: 0 }}>
                    <AdminTicketComposer
                      value={reply}
                      onChange={setReply}
                      files={files}
                      onFilesChange={setFiles}
                      onSend={onSend}
                      sending={sending}
                    />
                  </Box>
                )}
                {detail.status === "closed" && (
                  <Box
                    sx={{
                      flexShrink: 0,
                      p: 1.5,
                      borderTop: 1,
                      borderColor: "divider",
                      textAlign: "center",
                    }}
                  >
                    <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                      This ticket is closed. Re-open it to reply.
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
      </Drawer>

      <AdminProfileView
        open={Boolean(viewUser)}
        onClose={() => setViewUser(null)}
        user={viewUser}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete ticket?"
        message="This will permanently delete the ticket and all its messages. This action cannot be undone."
        confirmLabel="Delete ticket"
        confirmColor="error"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete?.();
        }}
      />
    </>
  );
}
