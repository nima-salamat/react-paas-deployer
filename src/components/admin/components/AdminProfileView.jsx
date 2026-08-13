import React, { useMemo, useState } from "react";
import {
  Avatar, Box, Chip, Dialog, DialogContent, Divider, IconButton, Paper,
  Stack, Tooltip, Typography, alpha,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import EmailIcon from "@mui/icons-material/Email";
import ShieldIcon from "@mui/icons-material/Shield";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { authMediaSrc } from "../adminUtils";
import MediaLightbox from "./MediaLightbox.jsx";

/**
 * AdminProfileView — read-only profile dialog for a user (admin context).
 * Adapted from messenger ProfileView: avatar gallery, username copy, bio, flags.
 *
 * Props:
 *   open, onClose
 *   user: { id, username, email, profiles?, avatar?, image?, is_staff?, is_superuser?,
 *           is_active?, bio?, date_joined? }
 */
export default function AdminProfileView({ open, onClose, user }) {
  const [copied, setCopied] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);

  const photos = useMemo(() => {
    const list = [];
    const profiles = user?.profiles || [];
    profiles.forEach((p) => {
      if (p?.image) list.push({ url: p.image, name: `photo-${p.order ?? list.length + 1}` });
    });
    if (!list.length && user?.avatar) list.push({ url: user.avatar, name: "avatar" });
    if (!list.length && user?.image) list.push({ url: user.image, name: "image" });
    return list;
  }, [user]);

  const avatarSrc = photos[0] ? authMediaSrc(photos[0].url) : "";
  const username = user?.username || "";

  const copyUsername = async () => {
    try {
      await navigator.clipboard?.writeText(username);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* */ }
  };

  if (!user) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pt: 1 }}>
          <IconButton onClick={onClose} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ pt: 0, pb: 2.5 }}>
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Avatar
              src={avatarSrc || undefined}
              sx={{
                width: 104,
                height: 104,
                mx: "auto",
                mb: 1.25,
                fontSize: 36,
                fontWeight: 800,
                bgcolor: "primary.main",
                cursor: photos.length ? "pointer" : "default",
                border: "3px solid",
                borderColor: "divider",
              }}
              onClick={() => photos.length && setGalleryIndex(0)}
            >
              {(username || "?").charAt(0).toUpperCase()}
            </Avatar>

            <Typography variant="h6" fontWeight={800} sx={{ mb: 0.25 }}>
              {username || "—"}
            </Typography>

            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              justifyContent="center"
              sx={{ mb: 1 }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontFamily: "monospace", fontWeight: 500 }}
              >
                @{username}
              </Typography>
              <Tooltip title={copied ? "Copied!" : "Copy username"}>
                <IconButton size="small" onClick={copyUsername} sx={{ p: 0.3 }}>
                  {copied ? (
                    <CheckIcon fontSize="small" color="success" />
                  ) : (
                    <ContentCopyIcon fontSize="small" color="action" />
                  )}
                </IconButton>
              </Tooltip>
            </Stack>

            <Stack
              direction="row"
              spacing={0.5}
              justifyContent="center"
              sx={{ mb: 1, flexWrap: "wrap", gap: 0.5 }}
            >
              {user.is_superuser && (
                <Chip
                  size="small"
                  color="error"
                  icon={<ShieldIcon sx={{ fontSize: 14 }} />}
                  label="superuser"
                  sx={{ height: 22, fontWeight: 700 }}
                />
              )}
              {user.is_staff && !user.is_superuser && (
                <Chip
                  size="small"
                  color="primary"
                  icon={<VerifiedUserIcon sx={{ fontSize: 14 }} />}
                  label="staff"
                  sx={{ height: 22, fontWeight: 700 }}
                />
              )}
              {user.is_active === false && (
                <Chip size="small" color="warning" label="inactive" sx={{ height: 22 }} />
              )}
              {user.is_active !== false && (
                <Chip size="small" color="success" variant="outlined" label="active" sx={{ height: 22 }} />
              )}
            </Stack>

            {user.email && (
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="center"
                gap={0.75}
                sx={{ color: "text.secondary" }}
              >
                <EmailIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2">{user.email}</Typography>
              </Stack>
            )}

            {user.date_joined && (
              <Typography variant="caption" color="text.disabled" display="block" mt={0.75}>
                Joined {new Date(user.date_joined).toLocaleDateString()}
              </Typography>
            )}

            {user.bio && (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  mt: 1.5,
                  textAlign: "left",
                  bgcolor: (t) => alpha(t.palette.action.hover, 0.5),
                  borderRadius: 1.5,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
                >
                  Bio
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontStyle: "italic" }}
                >
                  {user.bio}
                </Typography>
              </Paper>
            )}
          </Box>

          {photos.length > 0 && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: "block" }}>
                Photos ({photos.length})
              </Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" useFlexGap>
                {photos.map((p, idx) => (
                  <Box
                    key={idx}
                    component="img"
                    src={authMediaSrc(p.url)}
                    alt={p.name}
                    onClick={() => setGalleryIndex(idx)}
                    sx={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      borderRadius: 1.5,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: "divider",
                      "&:hover": { opacity: 0.9, outline: "2px solid", outlineColor: "primary.main" },
                    }}
                  />
                ))}
              </Stack>
            </>
          )}
        </DialogContent>
      </Dialog>

      <MediaLightbox
        open={galleryIndex != null}
        onClose={() => setGalleryIndex(null)}
        items={photos}
        index={galleryIndex ?? 0}
        onIndexChange={setGalleryIndex}
        title={username}
      />
    </>
  );
}
