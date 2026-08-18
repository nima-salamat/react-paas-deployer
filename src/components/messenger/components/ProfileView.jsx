import React, { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  Avatar,
  IconButton,
  Tooltip,
  Snackbar,
  Divider,
  Paper,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
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
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { withTokenQuery } from "../messengerUtils";

/**
 * Telegram-inspired profile page for another user.
 * The block/unblock action is deliberately controlled by the parent so the
 * profile reflects the same source of truth as the chat list.
 */
export default function ProfileView({
  profileData,
  onMessage,
  onAddContact,
  onBlock,
  onUnblock,
  isOnline,
  onOpenChatInfo,
  onVoiceCall,
  onVideoCall,
}) {
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);

  if (!profileData) return null;

  const photos = Array.isArray(profileData.photos) ? profileData.photos : [];
  const username = profileData.username || "";
  const displayName = profileData.full_name || `@${username}`;
  const isBlocked = Boolean(profileData.is_blocked);
  const isContact = Boolean(profileData.is_contact);
  const primaryAvatar = withTokenQuery(profileData.avatar) || withTokenQuery(photos[0]?.url) || undefined;

  const copyUsername = async () => {
    try {
      await navigator.clipboard?.writeText(`@${username}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable on insecure contexts.
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/?u=${encodeURIComponent(username)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${username}`, url });
      } else {
        await navigator.clipboard?.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // User cancelled the share sheet.
    }
  };

  const openGallery = (index) => setGalleryIndex(index);
  const closeGallery = () => setGalleryIndex(null);
  const goPrev = () => setGalleryIndex((index) => (
    index === null ? index : (index - 1 + photos.length) % photos.length
  ));
  const goNext = () => setGalleryIndex((index) => (
    index === null ? index : (index + 1) % photos.length
  ));

  const currentPhoto = galleryIndex === null ? null : photos[galleryIndex];
  const about = (profileData.bio || "").trim();

  return (
    <Box sx={{ bgcolor: "background.default", minHeight: "100%" }}>
      <Stack spacing={1.25} sx={{ p: { xs: 0, sm: 1.25 } }}>
        {/* Header / identity — intentionally simple, like Telegram profile pages */}
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: { xs: 0, sm: 3 },
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: { xs: 2, sm: 3 },
              pt: { xs: 3, sm: 4 },
              pb: 2.75,
              textAlign: "center",
              background: (theme) => `linear-gradient(180deg, ${theme.palette.primary.main}12 0%, ${theme.palette.background.paper} 74%)`,
            }}
          >
            <Box sx={{ position: "relative", display: "inline-flex" }}>
              <Avatar
                src={primaryAvatar}
                onClick={() => photos.length > 0 && openGallery(0)}
                sx={{
                  width: { xs: 104, sm: 124 },
                  height: { xs: 104, sm: 124 },
                  fontSize: { xs: 38, sm: 44 },
                  fontWeight: 700,
                  cursor: photos.length > 0 ? "pointer" : "default",
                  border: "4px solid",
                  borderColor: "background.paper",
                  boxShadow: 3,
                }}
              >
                {username?.[0]?.toUpperCase()}
              </Avatar>
              <Box
                sx={{
                  position: "absolute",
                  right: 4,
                  bottom: 5,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  bgcolor: isOnline ? "success.main" : "action.disabledBackground",
                  border: "3px solid",
                  borderColor: "background.paper",
                }}
              />
            </Box>

            <Typography sx={{ mt: 1.65, fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
              {displayName}
            </Typography>

            <Stack direction="row" spacing={0.4} justifyContent="center" alignItems="center" sx={{ mt: 0.45 }}>
              <Typography color="text.secondary" sx={{ fontSize: 14.5 }}>
                @{username}
              </Typography>
              <Tooltip title={copied ? "Copied" : "Copy username"}>
                <IconButton size="small" onClick={copyUsername} sx={{ p: 0.45 }}>
                  {copied ? <CheckIcon fontSize="inherit" color="success" /> : <ContentCopyIcon fontSize="inherit" />}
                </IconButton>
              </Tooltip>
            </Stack>

            <Typography
              variant="body2"
              color={isOnline ? "success.main" : "text.secondary"}
              sx={{ mt: 0.75, fontWeight: 600 }}
            >
              {isOnline ? "online" : "last seen recently"}
            </Typography>

            {isBlocked && (
              <Typography sx={{ mt: 1, color: "error.main", fontSize: 13, fontWeight: 700 }}>
                Blocked
              </Typography>
            )}
          </Box>

          <Divider />

          {/* Primary actions */}
          <Stack direction="row" spacing={0.8} sx={{ p: 1.25 }}>
            <ActionButton icon={<MessageIcon />} label="Message" onClick={() => onMessage?.(profileData)} />
            <ActionButton icon={<PhoneIcon />} label="Call" onClick={() => onVoiceCall?.(profileData)} />
            <ActionButton icon={<VideocamIcon />} label="Video" onClick={() => onVideoCall?.(profileData)} />
          </Stack>
        </Paper>

        {/* About / profile information */}
        {(about || isContact || isBlocked) && (
          <Paper
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: { xs: 0, sm: 3 },
              overflow: "hidden",
            }}
          >
            {about && (
              <List disablePadding>
                <ListItem sx={{ px: 2, py: 1.55, alignItems: "flex-start" }}>
                  <ListItemIcon sx={{ minWidth: 38, mt: 0.2 }}>
                    <InfoOutlinedIcon color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary="About"
                    secondary={about}
                    primaryTypographyProps={{ fontSize: 12.5, color: "text.secondary", fontWeight: 700 }}
                    secondaryTypographyProps={{ mt: 0.35, fontSize: 14.5, whiteSpace: "pre-wrap", lineHeight: 1.55 }}
                  />
                </ListItem>
              </List>
            )}
            {(isContact || isBlocked) && (
              <>
                {about && <Divider />}
                <List disablePadding>
                  <ListItem sx={{ px: 2, py: 1.35 }}>
                    <ListItemIcon sx={{ minWidth: 38 }}>
                      <FiberManualRecordIcon sx={{ fontSize: 11 }} color={isOnline ? "success" : "disabled"} />
                    </ListItemIcon>
                    <ListItemText
                      primary={isBlocked ? "Blocked" : "Contact"}
                      secondary={isBlocked ? "This user is blocked" : "This user is in your contacts"}
                      primaryTypographyProps={{ fontSize: 14.5, fontWeight: 700 }}
                      secondaryTypographyProps={{ fontSize: 12.5 }}
                    />
                  </ListItem>
                </List>
              </>
            )}
          </Paper>
        )}

        {/* Contact / moderation controls */}
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: { xs: 0, sm: 3 },
            overflow: "hidden",
          }}
        >
          <List disablePadding>
            {!isContact && !isBlocked && (
              <ListItemButtonRow
                icon={<PersonAddIcon color="primary" />}
                title="Add to contacts"
                onClick={() => onAddContact?.(profileData.id)}
              />
            )}
            <ListItemButtonRow
              icon={<NotificationsOffIcon color={muted ? "primary" : "action"} />}
              title={muted ? "Unmute notifications" : "Mute notifications"}
              onClick={() => setMuted((value) => !value)}
            />
            <ListItemButtonRow
              icon={<ShareIcon color="action" />}
              title="Share contact"
              onClick={shareProfile}
            />
            {typeof onOpenChatInfo === "function" && (
              <ListItemButtonRow
                icon={<InfoOutlinedIcon color="action" />}
                title="Chat info"
                onClick={onOpenChatInfo}
              />
            )}
            <Divider />
            {isBlocked ? (
              <ListItemButtonRow
                icon={<BlockIcon color="success" />}
                title="Unblock user"
                destructive={false}
                onClick={() => onUnblock?.(profileData.id)}
              />
            ) : (
              <ListItemButtonRow
                icon={<BlockIcon color="error" />}
                title="Block user"
                destructive
                onClick={() => onBlock?.(profileData.id)}
              />
            )}
          </List>
        </Paper>

        {/* Shared profile media */}
        {photos.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: { xs: 0, sm: 3 },
              overflow: "hidden",
            }}
          >
            <Box sx={{ px: 2, pt: 1.7, pb: 1.1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={0.9} alignItems="center">
                  <ImageOutlinedIcon sx={{ fontSize: 19 }} color="action" />
                  <Typography fontWeight={700}>Profile photos</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {photos.length}
                </Typography>
              </Stack>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.5 }}>
              {photos.map((photo, index) => (
                <Box
                  key={photo.id || index}
                  component="img"
                  src={withTokenQuery(photo.url)}
                  alt=""
                  onClick={() => openGallery(index)}
                  sx={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    display: "block",
                    cursor: "pointer",
                    transition: "transform .18s ease, filter .18s ease",
                    "&:hover": { filter: "brightness(.9)" },
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}
      </Stack>

      <Dialog open={galleryIndex !== null} onClose={closeGallery} fullWidth maxWidth="md">
        <Box sx={{ position: "relative", bgcolor: "#000", minHeight: 260 }}>
          {currentPhoto?.url && (
            <Box
              component="img"
              src={withTokenQuery(currentPhoto.url)}
              alt=""
              sx={{ width: "100%", maxHeight: "78vh", objectFit: "contain", display: "block" }}
            />
          )}
          <IconButton
            onClick={closeGallery}
            sx={{ position: "absolute", top: 10, right: 10, color: "white", bgcolor: "rgba(0,0,0,.38)" }}
          >
            <CloseIcon />
          </IconButton>
          {photos.length > 1 && (
            <>
              <IconButton onClick={goPrev} sx={{ position: "absolute", left: 10, top: "50%", color: "white", bgcolor: "rgba(0,0,0,.38)" }}>
                <ChevronLeftIcon />
              </IconButton>
              <IconButton onClick={goNext} sx={{ position: "absolute", right: 10, top: "50%", color: "white", bgcolor: "rgba(0,0,0,.38)" }}>
                <ChevronRightIcon />
              </IconButton>
            </>
          )}
        </Box>
      </Dialog>

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

function ActionButton({ icon, label, onClick }) {
  return (
    <Button
      onClick={onClick}
      fullWidth
      variant="text"
      sx={{
        minWidth: 0,
        borderRadius: 2,
        textTransform: "none",
        py: 0.9,
        display: "flex",
        flexDirection: "column",
        gap: 0.35,
        fontWeight: 700,
      }}
    >
      {icon}
      <Typography component="span" sx={{ fontSize: 12 }}>{label}</Typography>
    </Button>
  );
}

function ListItemButtonRow({ icon, title, onClick, destructive = false }) {
  return (
    <ListItem
      component="button"
      onClick={onClick}
      sx={{
        width: "100%",
        border: 0,
        background: "transparent",
        textAlign: "left",
        cursor: "pointer",
        px: 2,
        py: 1.45,
        display: "flex",
        color: destructive ? "error.main" : "inherit",
        transition: "background-color .16s ease",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
      <ListItemText
        primary={title}
        primaryTypographyProps={{ fontSize: 14.5, fontWeight: 600, color: destructive ? "error.main" : "text.primary" }}
      />
    </ListItem>
  );
}
