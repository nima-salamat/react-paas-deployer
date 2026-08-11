import React, { useEffect, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItemAvatar,
  ListItem, ListItemText, Avatar, Typography, Stack, Box, Divider, Tabs, Tab, CircularProgress,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import DoneIcon from "@mui/icons-material/Done";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import apiRequest from "../../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "../api";
import { formatTime, withTokenQuery } from "../messengerUtils";

/**
 * "Seen by" dialog — shows who has / hasn't read a specific message.
 * Opens when user picks "Info" / "Seen by" from the right-click menu
 * on a message they sent.
 *
 * Props:
 *  - message: object | null  (the message)
 *  - onClose: () => void
 */
export default function ReadReceiptsDialog({ message, onClose }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!message) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiRequest({
          method: "GET",
          url: `${MSG_API}/messages/${message.id}/readers/`,
        });
        if (!cancelled) {
          setData(unwrapData(res));
          setTab(0);
        }
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [message]);

  if (!message) return null;
  const readList = data?.read || [];
  const unreadList = data?.unread || [];
  const sentState = readList.length <= 1 && unreadList.length === 0 ? "sent" : "read";

  return (
    <Dialog open={Boolean(message)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: "flex", alignItems: "center", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
          {sentState === "read"
            ? <DoneAllIcon color="primary" fontSize="small" />
            : <DoneIcon color="action" fontSize="small" />}
          <Typography fontWeight={700}>Message info</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <Divider />
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary">Message</Typography>
        <Typography variant="body2" sx={{ mt: 0.25, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {typeof message.body === "string" && message.body
            ? (message.body.length > 140 ? message.body.slice(0, 140) + "…" : message.body)
            : (message.attachments?.length ? "📎 Attachment" : "—")}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {formatTime(message.created_at)}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab icon={<VisibilityIcon fontSize="small" />} iconPosition="start"
          label={`Read (${readList.length})`} />
        <Tab icon={<VisibilityOffIcon fontSize="small" />} iconPosition="start"
          label={`Unread (${unreadList.length})`} />
      </Tabs>
      <DialogContent dividers sx={{ p: 0, maxHeight: 320 }}>
        {loading ? (
          <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={22} /></Box>
        ) : tab === 0 ? (
          <List dense disablePadding>
            {readList.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Nobody has read this message yet.
              </Typography>
            )}
            {readList.map((r, i) => (
              <ListItem key={`${r.user?.id ?? i}`}>
                <ListItemAvatar>
                  <Avatar src={withTokenQuery(r.user?.avatar) || undefined} sx={{ width: 36, height: 36 }}>
                    {r.user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={r.user?.username || "User"}
                  secondary={r.seen_at ? formatTime(r.seen_at) : ""}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <List dense disablePadding>
            {unreadList.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Everyone has read this message.
              </Typography>
            )}
            {unreadList.map((r, i) => (
              <ListItem key={`${r.user?.id ?? i}`}>
                <ListItemAvatar>
                  <Avatar src={withTokenQuery(r.user?.avatar) || undefined} sx={{ width: 36, height: 36 }}>
                    {r.user?.username?.[0]?.toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={r.user?.username || "User"} />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
