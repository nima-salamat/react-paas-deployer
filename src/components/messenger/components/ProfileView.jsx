import React, { useState } from "react";
import {
  Box, Stack, Typography, Avatar, Button, Dialog, DialogContent, IconButton,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import BlockIcon from "@mui/icons-material/Block";
import MessageIcon from "@mui/icons-material/Message";
import CloseIcon from "@mui/icons-material/Close";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

/**
 * Read-only profile view for ANOTHER user (not me).
 * Triggered when the user clicks an avatar / "View profile" on someone else.
 *
 * The Photos strip now opens a full-screen gallery Dialog with < > navigation
 * so the user can swipe through ALL profile photos of that user.
 *
 * Props:
 *  - profileData: { id, username, avatar, photos, is_contact, is_blocked }
 *  - onMessage: (user) => void
 *  - onAddContact: (userId) => void
 *  - onBlock: (userId) => void
 *  - onOpenPhoto: (photoUrl) => void   // legacy single-photo opener (still called for fallback)
 */
export default function ProfileView({
  profileData, onMessage, onAddContact, onBlock, onOpenPhoto,
  isOnline,
}) {
  const [galleryIndex, setGalleryIndex] = useState(null);

  if (!profileData) return null;
  const photos = profileData.photos || [];

  const openGallery = (idx) => setGalleryIndex(idx);
  const closeGallery = () => setGalleryIndex(null);
  const goPrev = () => setGalleryIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
  const goNext = () => setGalleryIndex((i) => (i === null ? i : (i + 1) % photos.length));

  const currentIndex = galleryIndex ?? 0;
  const currentPhoto = photos[currentIndex];

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ textAlign: "center", mb: 2 }}>
        <Box sx={{ position: "relative", display: "inline-block" }}>
          <Avatar
            src={profileData.avatar || (photos[0] && photos[0].url) || undefined}
            sx={{ width: 96, height: 96, mx: "auto", mb: 1, fontSize: 36, cursor: photos.length ? "pointer" : "default" }}
            onClick={() => photos.length && openGallery(0)}
          >
            {profileData.username?.[0]?.toUpperCase()}
          </Avatar>
          {isOnline && (
            <Box
              sx={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                bgcolor: "#4caf50",
                border: "3px solid",
                borderColor: "background.paper",
                zIndex: 1,
              }}
            />
          )}
        </Box>
        <Typography variant="h6">@{profileData.username}</Typography>
        {isOnline && (
          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600, display: "block" }}>
            online
          </Typography>
        )}
        {profileData.is_contact && (
          <Typography variant="caption" color="text.secondary">In your contacts</Typography>
        )}
        {profileData.is_blocked && (
          <Typography variant="caption" color="error.main">Blocked</Typography>
        )}
        {profileData.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: "italic", px: 1 }}>
            {profileData.bio}
          </Typography>
        )}
      </Box>

      {photos.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Photos ({photos.length})
          </Typography>
          <Stack direction="row" spacing={1} sx={{ overflowX: "auto", pb: 0.5 }}>
            {photos.map((ph, i) => (
              <Box
                key={ph.id || i}
                component="img"
                src={ph.url}
                alt=""
                onClick={() => openGallery(i)}
                sx={{
                  width: 72, height: 72, borderRadius: 1, objectFit: "cover",
                  flexShrink: 0, cursor: "pointer",
                  transition: "transform 0.15s",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Stack spacing={1}>
        <Button variant="contained" startIcon={<MessageIcon />} onClick={() => onMessage(profileData)}>
          Message
        </Button>
        {!profileData.is_contact && (
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => onAddContact(profileData.id)}>
            Add contact
          </Button>
        )}
        {!profileData.is_blocked && (
          <Button color="error" variant="outlined" startIcon={<BlockIcon />} onClick={() => onBlock(profileData.id)}>
            Block
          </Button>
        )}
      </Stack>

      {/* Full-screen photo gallery */}
      <Dialog
        open={galleryIndex !== null}
        onClose={closeGallery}
        fullWidth
        maxWidth="md"
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
            <Box
              component="img"
              src={currentPhoto.url}
              alt=""
              sx={{
                maxWidth: "100%", maxHeight: "80vh", display: "block",
                userSelect: "none",
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
