import React, { useState } from "react";
import {
  Box, Stack, Typography, Avatar, Button, Dialog, DialogContent, IconButton,
  Tooltip, Snackbar, alpha, Divider, Chip, Paper,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import MessageIcon from "@mui/icons-material/Message";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import ShareIcon from "@mui/icons-material/Share";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import PhoneIcon from "@mui/icons-material/Phone";
import VideocamIcon from "@mui/icons-material/Videocam";
import MuteIcon from "@mui/icons-material/VolumeOff";
import { withTokenQuery } from "../messengerUtils";

/**
 * Read-only profile view for ANOTHER user (not me).
 *
 * Triggered when the user clicks the chat header avatar/name. This view IS
 * the merged "chat info + profile" panel — it shows:
 *  - Avatar (clickable to open full gallery)
 *  - Username with a copy button
 *  - Bio
 *  - Online status
 *  - Quick action buttons: Message, Call, Video call, Add contact, Block, Mute, Share
 *  - Photos strip with full-screen gallery
 *
 * Props:
 *  - profileData: { id, username, avatar, photos, is_contact, is_blocked, bio }
 *  - onMessage: (user) => void
 *  - onAddContact: (userId) => void
 *  - onBlock: (userId) => void
 *  - onOpenPhoto: (photoUrl) => void  (legacy single-photo opener — still called for fallback)
 *  - isOnline: boolean
 */
export default function ProfileView({
  profileData, onMessage, onAddContact, onBlock, onOpenPhoto, isOnline,
}) {
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);

  if (!profileData) return null;
  const photos = profileData.photos || [];
  const username = profileData.username || "";

  const openGallery = (idx) => setGalleryIndex(idx);
  const closeGallery = () => setGalleryIndex(null);
  const goPrev = () => setGalleryIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
  const goNext = () => setGalleryIndex((i) => (i === null ? i : (i + 1) % photos.length));

  const copyUsername = async () => {
    try {
      await navigator.clipboard?.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/?u=${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${username}`, url });
      } else {
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch { /* */ }
  };

  const currentIndex = galleryIndex ?? 0;
  const currentPhoto = photos[currentIndex];

  return (
    <Box sx={{ p: 2 }}>
      {/* Avatar + name + username (with copy) */}
      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Avatar
            src={withTokenQuery(profileData.avatar) || withTokenQuery(photos[0]?.url) || undefined}
            sx={{
              width: 110, height: 110, mx: "auto", mb: 1, fontSize: 40,
              cursor: photos.length ? "pointer" : "default",
              border: "3px solid", borderColor: isOnline ? "success.main" : "transparent",
            }}
            onClick={() => photos.length && openGallery(0)}
          >
            {username?.[0]?.toUpperCase()}
          </Avatar>
          {isOnline && (
            <Box sx={{
              position: "absolute", bottom: 8, right: 8,
              width: 18, height: 18, borderRadius: "50%",
              bgcolor: "#4caf50", border: "3px solid", borderColor: "background.paper",
              zIndex: 1,
            }} />
          )}
        </Box>

        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          {profileData.full_name || `@${username}`}
        </Typography>

        {/* Username with copy button */}
        <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center" sx={{ mb: 0.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontFamily: "monospace", fontWeight: 500 }}
          >
            @{username}
          </Typography>
          <Tooltip title={copied ? "Copied!" : "Copy username"}>
            <IconButton size="small" onClick={copyUsername} sx={{ p: 0.3 }}>
              {copied
                ? <CheckIcon fontSize="small" color="success" />
                : <ContentCopyIcon fontSize="small" color="action" />}
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Status chips */}
        <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}>
          {isOnline && (
            <Chip label="online" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
          )}
          {profileData.is_contact && (
            <Chip label="contact" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
          )}
          {profileData.is_blocked && (
            <Chip label="blocked" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
          )}
          {muted && (
            <Chip icon={<MuteIcon sx={{ fontSize: 12 }} />} label="muted" size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
          )}
        </Stack>

        {/* Bio */}
        {profileData.bio && (
          <Paper variant="outlined" sx={{ p: 1.25, mt: 1, textAlign: "left", bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
              Bio
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: "italic" }}>
              {profileData.bio}
            </Typography>
          </Paper>
        )}
      </Box>

      <Divider sx={{ my: 1.5 }} />

      {/* Quick action buttons — row 1: communication */}
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <Button
          fullWidth variant="contained" startIcon={<MessageIcon />}
          onClick={() => onMessage(profileData)}
        >
          Message
        </Button>
        <Tooltip title="Voice call (coming soon)">
          <span>
            <Button variant="outlined" disabled sx={{ minWidth: 0, px: 1.5 }}>
              <PhoneIcon />
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Video call (coming soon)">
          <span>
            <Button variant="outlined" disabled sx={{ minWidth: 0, px: 1.5 }}>
              <VideocamIcon />
            </Button>
          </span>
        </Tooltip>
      </Stack>

      {/* Quick action buttons — row 2: contact management */}
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap", gap: 1 }}>
        {!profileData.is_contact && (
          <Button
            variant="outlined" startIcon={<PersonAddIcon />}
            onClick={() => onAddContact(profileData.id)}
            sx={{ flex: 1, minWidth: 120 }}
          >
            Add contact
          </Button>
        )}
        <Tooltip title={muted ? "Unmute" : "Mute notifications"}>
          <Button
            variant="outlined"
            onClick={() => setMuted((m) => !m)}
            color={muted ? "primary" : "inherit"}
            sx={{ minWidth: 0, px: 1.5 }}
          >
            <NotificationsOffIcon />
          </Button>
        </Tooltip>
        <Tooltip title="Share profile link">
          <Button variant="outlined" onClick={shareProfile} sx={{ minWidth: 0, px: 1.5 }}>
            <ShareIcon />
          </Button>
        </Tooltip>
        {!profileData.is_blocked && (
          <Tooltip title="Block user">
            <Button
              variant="outlined" color="error"
              onClick={() => onBlock(profileData.id)}
              sx={{ minWidth: 0, px: 1.5 }}
            >
              <BlockIcon />
            </Button>
          </Tooltip>
        )}
      </Stack>

      {/* Photos section */}
      {photos.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
            Photos ({photos.length})
          </Typography>
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
            {photos.map((ph, i) => (
              <Box
                key={ph.id || i}
                component="img"
                src={withTokenQuery(ph.url)}
                alt=""
                onClick={() => openGallery(i)}
                sx={{
                  width: 80, height: 80, borderRadius: 1, objectFit: "cover",
                  flexShrink: 0, cursor: "pointer",
                  transition: "transform 0.15s",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Full-screen photo gallery */}
      <Dialog
        open={galleryIndex !== null}
        onClose={closeGallery}
        fullWidth maxWidth="md"
        PaperProps={{ sx: { bgcolor: "background.default", position: "relative" } }}
      >
        <IconButton
          onClick={closeGallery}
          sx={{ position: "absolute", top: 8, right: 8, zIndex: 2, bgcolor: "rgba(0,0,0,0.4)", color: "#fff" }}
        >
          <CloseIcon />
        </IconButton>
        {photos.length > 1 && (
          <>
            <IconButton
              onClick={goPrev}
              sx={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 2, bgcolor: "rgba(0,0,0,0.4)", color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              }}
            >
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
            <IconButton
              onClick={goNext}
              sx={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                zIndex: 2, bgcolor: "rgba(0,0,0,0.4)", color: "#fff",
                "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              }}
            >
              <ChevronRightIcon fontSize="large" />
            </IconButton>
            <Box sx={{
              position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
              zIndex: 2, bgcolor: "rgba(0,0,0,0.5)", color: "#fff",
              px: 1.5, py: 0.3, borderRadius: 2, fontSize: 12,
            }}>
              {currentIndex + 1} / {photos.length}
            </Box>
          </>
        )}
        <DialogContent sx={{ p: 0, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 320 }}>
          {currentPhoto && (
            <Box component="img" src={withTokenQuery(currentPhoto.url)} alt=""
              sx={{ maxWidth: "100%", maxHeight: "80vh", display: "block", userSelect: "none" }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Copy snackbar */}
      <Snackbar
        open={copied}
        autoHideDuration={1500}
        onClose={() => setCopied(false)}
        message="Copied to clipboard"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
