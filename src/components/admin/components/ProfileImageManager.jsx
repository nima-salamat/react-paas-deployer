import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar, Box, Button, Chip, IconButton, Paper, Stack, Typography, alpha,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import apiRequest from "../../customHooks/apiRequest";
import ImageCropDialog from "../../messenger/components/ImageCropDialog.jsx";
import MediaLightbox from "./MediaLightbox.jsx";
import {
  adminUserProfilesApi,
  adminUserProfileDetailApi,
  adminUserProfileReorderApi,
  authMediaSrc,
} from "../adminUtils";

const MAX_PROFILE_PHOTOS = 5;

function getImageUrl(profile) {
  if (!profile) return "";
  if (typeof profile.image === "string") return profile.image;
  return profile.image?.url || profile.image_url || profile.imageUrl || "";
}

function sortProfiles(list) {
  return [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => (Number(a?.order) || 0) - (Number(b?.order) || 0)
  );
}

function isImageFile(file) {
  return Boolean(file) && (
    file.type?.startsWith("image/") ||
    /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(file.name || "")
  );
}

function SortableThumb({ profile, index, disabled, onDelete, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(profile.id), disabled });
  const didDragRef = useRef(false);

  useEffect(() => {
    if (isDragging) didDragRef.current = true;
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };
  const imageUrl = getImageUrl(profile);
  const mergedListeners = listeners ? {
    ...listeners,
    onPointerDown: (event) => {
      didDragRef.current = false;
      listeners.onPointerDown?.(event);
    },
  } : undefined;

  const openPreview = (event) => {
    event.stopPropagation();
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (imageUrl) onOpen?.(profile);
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 10 : 0}
      {...attributes}
      {...mergedListeners}
      sx={{
        p: 1.25,
        pt: 1.6,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: isDragging || index === 0 ? "primary.main" : "divider",
        position: "relative",
        overflow: "visible",
        width: 132,
        cursor: disabled ? "default" : isDragging ? "grabbing" : "grab",
        touchAction: disabled ? "auto" : "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
        "&:hover": { boxShadow: isDragging ? undefined : 3 },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 6,
          left: 6,
          width: 24,
          height: 24,
          bgcolor: index === 0 ? "primary.main" : "grey.800",
          color: "#fff",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 800,
          boxShadow: 2,
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        {index + 1}
      </Box>
      {index === 0 && (
        <Chip
          label="Primary"
          size="small"
          color="primary"
          sx={{
            position: "absolute",
            top: -10,
            left: "50%",
            transform: "translateX(-50%)",
            height: 20,
            fontSize: 10,
            fontWeight: 800,
            zIndex: 3,
            pointerEvents: "none",
          }}
        />
      )}
      {!disabled && (
        <IconButton
          color="error"
          size="small"
          aria-label="Delete profile photo"
          sx={{
            position: "absolute",
            top: 4,
            right: 4,
            bgcolor: (theme) => alpha(theme.palette.error.main, 0.86),
            color: "#fff",
            "&:hover": { bgcolor: "error.main" },
            zIndex: 4,
            width: 25,
            height: 25,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete?.(profile.id);
          }}
        >
          <DeleteOutlineIcon sx={{ fontSize: 17 }} />
        </IconButton>
      )}
      <Box
        onClick={openPreview}
        sx={{
          cursor: imageUrl ? (isDragging ? "grabbing" : "zoom-in") : "default",
          borderRadius: 2,
          overflow: "hidden",
          mt: 1.5,
          position: "relative",
          "&:hover": { opacity: 0.92 },
        }}
      >
        <Avatar
          src={imageUrl ? authMediaSrc(imageUrl) : undefined}
          alt={`Profile photo ${index + 1}`}
          variant="rounded"
          draggable={false}
          sx={{
            width: 108,
            height: 108,
            mx: "auto",
            borderRadius: 2,
            pointerEvents: "none",
            bgcolor: "action.hover",
          }}
        >
          <BrokenImageIcon sx={{ fontSize: 36, color: "text.disabled" }} />
        </Avatar>
      </Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.9 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
          {index === 0 ? "Primary avatar" : `Photo ${index + 1}`}
        </Typography>
        {imageUrl && <OpenInNewIcon sx={{ fontSize: 14, color: "text.disabled" }} />}
      </Stack>
    </Paper>
  );
}

/** Admin counterpart to the user Profile photo manager. */
export default function ProfileImageManager({
  userId,
  disabled = false,
  onToast,
  onChange,
  initial = [],
}) {
  const [profiles, setProfiles] = useState(() => sortProfiles(initial));
  const [uploading, setUploading] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [cropFile, setCropFile] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setProfiles(sortProfiles(initial));
    setActiveId(null);
    setPreviewIndex(null);
  }, [initial, userId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => profiles.map((profile) => String(profile.id)), [profiles]);
  const previewItems = useMemo(
    () => profiles.filter((profile) => getImageUrl(profile)).map((profile) => ({
      id: profile.id,
      url: getImageUrl(profile),
      name: `Profile photo ${profile.order ?? ""}`.trim(),
    })),
    [profiles]
  );

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await apiRequest({ method: "GET", url: adminUserProfilesApi(userId) });
      const data = response.data?.data || response.data || {};
      setProfiles(sortProfiles(data.profiles || []));
    } catch (error) {
      onToast?.(error?.response?.data?.message || "Failed to load profile photos");
    }
  }, [userId, onToast]);

  const uploadCroppedImage = async (blob, filename) => {
    setCropFile(null);
    if (!blob || !userId) return;
    setUploading(true);
    try {
      const file = new File([blob], filename || "profile-photo.png", {
        type: blob.type || "image/png",
      });
      const formData = new FormData();
      formData.append("image", file, file.name);
      await apiRequest({
        method: "POST",
        url: adminUserProfilesApi(userId),
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      onToast?.("Profile image uploaded");
      await refresh();
      onChange?.();
    } catch (error) {
      const data = error?.response?.data;
      onToast?.(data?.message || data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFilePick = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || disabled) return;
    if (profiles.length >= MAX_PROFILE_PHOTOS) {
      onToast?.(`A user can have at most ${MAX_PROFILE_PHOTOS} profile photos.`);
      return;
    }
    if (!isImageFile(file)) {
      onToast?.("Please choose a valid image file.");
      return;
    }
    setCropFile(file);
  };

  const handleDelete = async (profileId) => {
    if (disabled || !userId) return;
    if (!window.confirm("Delete this profile image?")) return;
    try {
      await apiRequest({
        method: "DELETE",
        url: adminUserProfileDetailApi(userId, profileId),
      });
      const remaining = sortProfiles(
        profiles.filter((profile) => String(profile.id) !== String(profileId))
      ).map((profile, index) => ({ ...profile, order: index + 1 }));
      setProfiles(remaining);
      onToast?.("Profile image deleted");
      onChange?.();
    } catch (error) {
      onToast?.(error?.response?.data?.message || "Delete failed");
    }
  };

  const persistOrder = async (orderedProfiles) => {
    try {
      const orders = orderedProfiles.map((profile, index) => ({
        id: profile.id,
        order: index + 1,
      }));
      await apiRequest({
        method: "POST",
        url: adminUserProfileReorderApi(userId),
        data: { orders },
      });
      onToast?.("Profile photo order saved");
      onChange?.();
    } catch (error) {
      onToast?.(error?.response?.data?.message || "Reordering profile photos failed");
      await refresh();
    }
  };

  const onDragEnd = async (event) => {
    setActiveId(null);
    const { active, over } = event;
    if (disabled || uploading || !over || String(active.id) === String(over.id)) return;

    const oldIndex = profiles.findIndex((profile) => String(profile.id) === String(active.id));
    const newIndex = profiles.findIndex((profile) => String(profile.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(profiles, oldIndex, newIndex).map((profile, index) => ({
      ...profile,
      order: index + 1,
    }));
    setProfiles(reordered);
    await persistOrder(reordered);
  };

  const openPreview = (profile) => {
    const index = previewItems.findIndex((item) => String(item.id) === String(profile.id));
    if (index >= 0) setPreviewIndex(index);
  };

  if (!userId) return null;
  const activeProfile = profiles.find((profile) => String(profile.id) === String(activeId));

  return (
    <>
      <Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={1.25}
          mb={1.5}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight={800}>Profile photos</Typography>
            <Typography variant="caption" color="text.secondary">
              Up to {MAX_PROFILE_PHOTOS} images. Drag a photo itself to reorder; the first photo is the primary avatar.
            </Typography>
          </Box>
          {!disabled && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddPhotoAlternateIcon />}
              disabled={uploading || profiles.length >= MAX_PROFILE_PHOTOS}
              onClick={() => fileInputRef.current?.click()}
              sx={{ borderRadius: 1.5, textTransform: "none", flexShrink: 0 }}
            >
              {uploading ? "Uploading…" : profiles.length >= MAX_PROFILE_PHOTOS ? "Photo limit reached" : "Add image"}
            </Button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePick} />
        </Stack>

        {profiles.length === 0 ? (
          <Box
            sx={{
              p: 3,
              border: "1px dashed",
              borderColor: "divider",
              borderRadius: 2,
              textAlign: "center",
              bgcolor: "action.hover",
            }}
          >
            <AddPhotoAlternateIcon sx={{ fontSize: 28, color: "text.disabled", mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              No profile photos yet. Add one to set the user's primary avatar.
            </Typography>
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setActiveId(String(event.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ pt: 1 }}>
                {profiles.map((profile, index) => (
                  <SortableThumb
                    key={String(profile.id)}
                    profile={profile}
                    index={index}
                    disabled={disabled || uploading}
                    onDelete={handleDelete}
                    onOpen={openPreview}
                  />
                ))}
              </Stack>
            </SortableContext>
            <DragOverlay>
              {activeProfile ? (
                <Paper
                  elevation={10}
                  sx={{
                    width: 132,
                    p: 1.25,
                    pt: 1.6,
                    borderRadius: 2.5,
                    border: "2px solid",
                    borderColor: "primary.main",
                  }}
                >
                  <Avatar
                    src={getImageUrl(activeProfile) ? authMediaSrc(getImageUrl(activeProfile)) : undefined}
                    variant="rounded"
                    sx={{ width: 108, height: 108, mx: "auto", borderRadius: 2 }}
                  >
                    <BrokenImageIcon />
                  </Avatar>
                  <Typography variant="caption" sx={{ display: "block", mt: 1, fontWeight: 800, textAlign: "center" }}>
                    {String(activeProfile.id) === String(profiles[0]?.id) ? "Primary avatar" : "Reordering…"}
                  </Typography>
                </Paper>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      <ImageCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={uploadCroppedImage}
        circular
        outputSize={512}
        title="Crop profile photo"
        confirmLabel="Crop & upload"
      />
      <MediaLightbox
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
        items={previewItems}
        index={previewIndex ?? 0}
        onIndexChange={setPreviewIndex}
        title="Profile photos"
      />
    </>
  );
}
