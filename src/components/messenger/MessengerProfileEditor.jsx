/**
 * Profile photo editor for Messenger — uses the same users.Profile APIs
 * as the main Profile page (/users/profile/list|set|delete|order/).
 *
 * Features:
 *  - Upload / delete profile photos (max 5)
 *  - Crop + compress before upload (fixes 400 Bad Request from ImageValidator)
 *  - Drag to reorder (uses /users/profile/order/ endpoint)
 *  - Photo privacy scope (everyone / contacts / nobody / specific)
 *  - Bio editor (Telegram-style 'about' field) — saved via /messenger/me/bio/
 *  - Back arrow button at the top (closes the editor)
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Stack, Typography, IconButton, Button, CircularProgress, Avatar,
  FormControl, Select, MenuItem, InputLabel, Chip, alpha, Paper, TextField,
} from "@mui/material";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import apiRequest from "../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "./api";
import ImageCropDialog from "./components/ImageCropDialog";
import { withTokenQuery } from "./messengerUtils";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}/users/`.replace(/([^:]\/)\/+/g, "$1");

function resolveUrl(profile) {
  if (!profile) return null;
  const candidates = [
    profile.image_url,
    profile.imageUrl,
    profile.avatar_url,
    typeof profile.image === "string" ? profile.image : null,
    profile.image?.url,
  ].filter(Boolean);
  const url = candidates[0] || null;
  if (!url) return null;
  return withTokenQuery(url);
}


function SortableMessengerPhoto({ photo, index, onDelete }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: String(photo.id) });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.55 : 1,
  };
  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 8 : 1}
      {...attributes}
      {...listeners}
      sx={{
        position: "relative", width: 96, height: 96, p: 0.5, borderRadius: 2,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
        border: "1px solid", borderColor: index === 0 ? "primary.main" : "divider",
      }}
    >
      <Box sx={{
        position: "absolute", top: 2, left: 2, zIndex: 3, width: 20, height: 20,
        borderRadius: "50%", bgcolor: "primary.main", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 800, boxShadow: 1, pointerEvents: "none",
      }}>{index + 1}</Box>
      <Avatar
        src={photo.image_url || undefined}
        variant="rounded"
        sx={{ width: "100%", height: "100%", border: "1px solid", borderColor: "divider", pointerEvents: "none" }}
      />
      {index === 0 && (
        <Chip size="small" label="Primary" color="primary"
          sx={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", height: 18, fontSize: 10, pointerEvents: "none" }}
        />
      )}
      <IconButton
        size="small"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
        sx={{
          position: "absolute", top: -6, right: -6, bgcolor: "error.main", color: "#fff",
          width: 24, height: 24, "&:hover": { bgcolor: "error.dark" }, zIndex: 4,
        }}
      >
        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Paper>
  );
}

export default function MessengerProfileEditor({ onClose, onPhotosChange }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [privacy, setPrivacy] = useState("everyone");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cropFile, setCropFile] = useState(null); // File pending crop
  const [bio, setBio] = useState("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const fileRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const flash = (m) => {
    setOk(m);
    setTimeout(() => setOk(""), 2000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest({ url: `${API_BASE}profile/list/`, method: "GET" });
      const raw = response?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.profiles)
            ? raw.profiles
            : Array.isArray(raw?.data)
              ? raw.data
              : [];
      const normalized = list
        .map((p) => ({
          ...p,
          id: p.id ?? p.pk,
          image_url: resolveUrl(p),
          order: p.order ?? 0,
        }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setPhotos(normalized);
      try {
        const primary = normalized[0];
        const url = primary?.image_url || null;
        onPhotosChange?.(normalized, url);
      } catch { /* */ }
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load photos");
    } finally {
      setLoading(false);
    }
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/photos/` });
      const data = unwrapData(res);
      if (data?.privacy?.scope) setPrivacy(data.privacy.scope);
    } catch { /* optional */ }
    // Load bio
    try {
      const res = await apiRequest({ method: "GET", url: `${MSG_API}/me/bio/` });
      const data = unwrapData(res);
      setBio(data?.text || "");
    } catch { /* optional */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // When user picks a file, open the crop dialog instead of uploading directly.
  // This ensures the image is cropped + compressed to meet the backend
  // ImageValidator constraints (≤2MB, ≤2560x1440) and avoids 400 errors.
  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Only images allowed");
      return;
    }
    setCropFile(file);
  };

  // Called when ImageCropDialog confirms — uploads the cropped blob.
  const onCropConfirm = async (blob, filename) => {
    setCropFile(null);
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      const file = new File([blob], filename, { type: "image/jpeg" });
      form.append("image", file);
      form.append("order", String(photos.length));
      await apiRequest({ url: `${API_BASE}profile/set/`, method: "POST", data: form });
      flash("Photo added");
      await load();
      // Notify all conversations the user is part of that their profile changed
      // so the new avatar propagates everywhere in real time.
      try {
        await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
      } catch { /* optional */ }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors || "Upload failed";
      setError(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("Remove this profile photo?")) return;
    try {
      await apiRequest({
        url: `${API_BASE}profile/delete/`,
        method: "POST",
        data: { id },
      });
      flash("Deleted");
      await load();
      // Broadcast the change so other chats see the avatar removed/changed
      try {
        await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
      } catch { /* optional */ }
    } catch {
      try {
        await apiRequest({ url: `${API_BASE}profile/delete/?id=${id}`, method: "DELETE" });
        flash("Deleted");
        await load();
        try {
          await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
        } catch { /* optional */ }
      } catch (e2) {
        setError(e2?.response?.data?.message || "Delete failed");
      }
    }
  };

  const savePrivacy = async (scope) => {
    setPrivacy(scope);
    try {
      await apiRequest({
        method: "PATCH",
        url: `${MSG_API}/me/photo-privacy/`,
        data: { scope },
      });
      flash("Privacy saved");
    } catch (e) {
      setError(e?.response?.data?.message || "Privacy save failed");
    }
  };

  // Save bio (Telegram-style 'about' field)
  const saveBio = async () => {
    const text = (bioDraft || "").slice(0, 255);
    try {
      await apiRequest({ method: "PATCH", url: `${MSG_API}/me/bio/`, data: { text } });
      setBio(text);
      setBioEditing(false);
      flash("Bio saved");
      // Broadcast so other chats/profiles see the new bio
      try {
        await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
      } catch { /* optional */ }
    } catch (e) {
      setError(e?.response?.data?.message || "Bio save failed");
    }
  };

  const startEditBio = () => {
    setBioDraft(bio || "");
    setBioEditing(true);
  };

  const cancelEditBio = () => {
    setBioEditing(false);
    setBioDraft("");
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || String(active.id) === String(over.id)) return;
    const oldIndex = photos.findIndex((p) => String(p.id) === String(active.id));
    const newIndex = photos.findIndex((p) => String(p.id) === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(photos, oldIndex, newIndex).map((p, idx) => ({ ...p, order: idx }));
    setPhotos(next);
    const orderMap = {};
    next.forEach((p) => { orderMap[String(p.id)] = p.order; });
    try {
      await apiRequest({
        method: "POST",
        url: `${API_BASE}profile/order/`,
        data: { order: orderMap },
      });
      flash("Order saved");
      try {
        await apiRequest({ method: "POST", url: `${MSG_API}/me/profile-broadcast/` });
      } catch { /* optional */ }
      // Update chat-list avatar (primary = first ordered photo)
      const primary = next[0];
      const url = primary?.image_url || primary?.imageUrl || primary?.url
        || (typeof primary?.image === "string" ? primary.image : primary?.image?.url)
        || null;
      onPhotosChange?.(next, url);
    } catch (err) {
      setError(err?.response?.data?.message || "Reorder failed");
      await load();
    }
  };


  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 520, mx: "auto" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        {onClose && (
          <IconButton onClick={onClose} size="small" title="Back">
            <ArrowBackIcon />
          </IconButton>
        )}
        <Typography variant="h6" fontWeight={700}>
          My profile photos
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Drag a photo to reorder. The first photo is your primary avatar.
        Max 5 photos. Visible in Messenger according to your privacy setting.
      </Typography>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map((p) => String(p.id))} strategy={rectSortingStrategy}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
              {photos.map((p, i) => (
                <SortableMessengerPhoto key={p.id} photo={p} index={i} onDelete={onDelete} />
              ))}
              {photos.length < 5 && (
                <Button
                  variant="outlined"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  sx={{
                    width: 96, height: 96, minWidth: 96, borderStyle: "dashed",
                    display: "flex", flexDirection: "column", gap: 0.5,
                  }}
                >
                  {uploading ? <CircularProgress size={22} /> : <AddPhotoAlternateIcon />}
                  <Typography variant="caption">Add</Typography>
                </Button>
              )}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => fileRef.current?.click()}
          disabled={uploading || photos.length >= 5}
        >
          Upload photo
        </Button>
        <Button variant="text" onClick={load}>Refresh</Button>
      </Stack>

      <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
        <Typography variant="subtitle2" sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
          <LockOutlinedIcon fontSize="small" /> Who can see my photos in Messenger
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Visibility</InputLabel>
          <Select label="Visibility" value={privacy} onChange={(e) => savePrivacy(e.target.value)}>
            <MenuItem value="everyone">Everyone</MenuItem>
            <MenuItem value="contacts">Contacts only</MenuItem>
            <MenuItem value="nobody">Nobody</MenuItem>
            <MenuItem value="specific">Specific users</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Bio editor — Telegram-style 'about' field */}
      <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: (t) => alpha(t.palette.secondary.main, 0.06) }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
          <EditIcon fontSize="small" color="action" />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>Bio (about me)</Typography>
          {!bioEditing && (
            <IconButton size="small" onClick={startEditBio} title="Edit bio">
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
        {bioEditing ? (
          <Stack spacing={1}>
            <TextField
              fullWidth size="small" multiline minRows={2} maxRows={4}
              placeholder="A few words about you (max 255 chars)"
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value.slice(0, 255))}
              inputProps={{ maxLength: 255 }}
              helperText={`${bioDraft.length}/255`}
            />
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="contained" onClick={saveBio}>Save</Button>
              <Button size="small" onClick={cancelEditBio}>Cancel</Button>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color={bio ? "text.primary" : "text.secondary"} sx={{ fontStyle: bio ? "normal" : "italic" }}>
            {bio || "No bio yet. Click ✎ to add one."}
          </Typography>
        )}
      </Box>

      {error && <Chip color="error" label={String(error)} onDelete={() => setError("")} sx={{ mt: 2 }} />}
      {ok && <Chip color="success" label={ok} sx={{ mt: 2 }} />}

      {onClose && (
        <Button fullWidth sx={{ mt: 2 }} onClick={onClose}>Done</Button>
      )}

      {/* Circular crop dialog — compresses image to ≤512px before upload */}
      <ImageCropDialog
        open={Boolean(cropFile)}
        file={cropFile}
        onClose={() => setCropFile(null)}
        onConfirm={onCropConfirm}
        circular
        outputSize={512}
        title="Crop profile photo"
      />
    </Box>
  );
}
