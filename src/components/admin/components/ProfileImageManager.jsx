import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, IconButton, Stack, Typography, alpha,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import apiRequest from "../../customHooks/apiRequest";
import {
  adminUserProfilesApi,
  adminUserProfileDetailApi,
  adminUserProfileReorderApi,
  authMediaSrc,
} from "../adminUtils";

function SortableThumb({ profile, disabled, onDelete, onOpen }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: profile.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        position: "relative",
        width: 88,
        height: 88,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        bgcolor: "action.hover",
        overflow: "hidden",
        cursor: disabled ? "default" : "grab",
        "&:active": { cursor: disabled ? "default" : "grabbing" },
      }}
    >
      {!disabled && (
        <Box
          {...attributes}
          {...listeners}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 2,
            width: 22,
            height: 22,
            bgcolor: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "grab",
            borderBottomRightRadius: 6,
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 14 }} />
        </Box>
      )}

      {profile.image && (
        <Box
          component="img"
          src={authMediaSrc(profile.image)}
          alt={`profile-${profile.order}`}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}

      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.5,
          bgcolor: alpha("#000", 0.55),
          opacity: 0,
          transition: "opacity 0.15s",
          "&:hover": { opacity: 1 },
        }}
      >
        {profile.image && (
          <IconButton
            size="small"
            sx={{ color: "#fff", bgcolor: alpha("#fff", 0.15) }}
            onClick={() => onOpen?.(profile)}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        )}
        {!disabled && (
          <IconButton
            size="small"
            color="error"
            sx={{ bgcolor: alpha("#fff", 0.15) }}
            onClick={() => onDelete?.(profile.id)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <Box
        sx={{
          position: "absolute",
          bottom: 0,
          right: 0,
          bgcolor: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 9,
          px: 0.5,
          fontFamily: "monospace",
          borderTopLeftRadius: 4,
        }}
      >
        #{profile.order}
      </Box>
    </Box>
  );
}

/**
 * ProfileImageManager — manage a user's profile photos with reliable DnD reorder.
 * Uses @dnd-kit (already in project deps) instead of fragile HTML5 DnD.
 */
export default function ProfileImageManager({
  userId,
  disabled = false,
  onToast,
  onChange,
  initial = [],
}) {
  const [profiles, setProfiles] = useState(initial || []);
  const [uploading, setUploading] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setProfiles(initial || []);
  }, [initial, userId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const ids = useMemo(() => profiles.map((p) => p.id), [profiles]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiRequest({ method: "GET", url: adminUserProfilesApi(userId) });
      const d = res.data?.data || res.data || {};
      setProfiles(d.profiles || []);
    } catch (e) {
      onToast?.(e?.response?.data?.message || "Failed to load profiles");
    }
  }, [userId, onToast]);

  const handleFile = async (file) => {
    if (!file || !userId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      await apiRequest({
        method: "POST",
        url: adminUserProfilesApi(userId),
        data: fd,
        headers: { "Content-Type": "multipart/form-data" },
      });
      onToast?.("Profile image uploaded");
      await refresh();
      onChange?.();
    } catch (e) {
      const d = e?.response?.data;
      onToast?.(d?.message || d?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (profileId) => {
    if (!window.confirm("Delete this profile image?")) return;
    try {
      await apiRequest({
        method: "DELETE",
        url: adminUserProfileDetailApi(userId, profileId),
      });
      onToast?.("Deleted");
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      onChange?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || "Delete failed");
    }
  };

  const persistOrder = async (ordered) => {
    try {
      const orders = ordered.map((p, idx) => ({ id: p.id, order: idx + 1 }));
      await apiRequest({
        method: "POST",
        url: adminUserProfileReorderApi(userId),
        data: { orders },
      });
      onToast?.("Order saved");
      onChange?.();
    } catch (e) {
      onToast?.(e?.response?.data?.message || "Reorder failed");
      await refresh();
    }
  };

  const onDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const onDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    setProfiles((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex).map((p, idx) => ({
        ...p,
        order: idx + 1,
      }));
      // fire-and-forget persist
      persistOrder(next);
      return next;
    });
  };

  if (!userId) return null;

  const activeProfile = profiles.find((p) => p.id === activeId);

  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={1.5}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            Profile images
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Up to 5 images. Drag the handle to reorder.
          </Typography>
        </Box>
        {!disabled && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddPhotoAlternateIcon />}
            disabled={uploading || profiles.length >= 5}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderRadius: 1, textTransform: "none" }}
          >
            {uploading ? "Uploading…" : "Add image"}
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </Stack>

      {profiles.length === 0 ? (
        <Box
          sx={{
            p: 3,
            border: "1px dashed",
            borderColor: "divider",
            borderRadius: 1.5,
            textAlign: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            No profile images yet.
          </Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              {profiles.map((p) => (
                <SortableThumb
                  key={p.id}
                  profile={p}
                  disabled={disabled}
                  onDelete={handleDelete}
                  onOpen={(prof) => {
                    if (prof.image) window.open(authMediaSrc(prof.image), "_blank");
                  }}
                />
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay>
            {activeProfile ? (
              <Box
                sx={{
                  width: 88,
                  height: 88,
                  borderRadius: 1.5,
                  overflow: "hidden",
                  boxShadow: 6,
                  border: "2px solid",
                  borderColor: "primary.main",
                }}
              >
                {activeProfile.image && (
                  <Box
                    component="img"
                    src={authMediaSrc(activeProfile.image)}
                    alt=""
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </Box>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </Box>
  );
}
