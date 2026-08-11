/**
 * Profile photo editor for Messenger — uses the same users.Profile APIs
 * as the main Profile page (/users/profile/list|set|delete|order/).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box, Stack, Typography, IconButton, Button, CircularProgress, Avatar,
  FormControl, Select, MenuItem, InputLabel, Chip, alpha,
} from "@mui/material";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import apiRequest from "../customHooks/apiRequest.jsx";
import { MSG_API, unwrapData } from "./api";

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
  let url = candidates[0] || null;
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
  if (url.startsWith("/")) return `${host}${url}`;
  return `${host}/${url}`;
}

export default function MessengerProfileEditor({ onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [privacy, setPrivacy] = useState("everyone");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const fileRef = useRef(null);

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
  }, []);

  useEffect(() => { load(); }, [load]);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setError("Only images allowed");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      await apiRequest({ url: `${API_BASE}profile/set/`, method: "POST", data: form });
      flash("Photo added");
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.errors || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await apiRequest({
        url: `${API_BASE}profile/delete/`,
        method: "POST",
        data: { id },
      });
      flash("Deleted");
      await load();
    } catch (err) {
      // try DELETE with query
      try {
        await apiRequest({ url: `${API_BASE}profile/delete/?id=${id}`, method: "DELETE" });
        flash("Deleted");
        await load();
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

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 }, maxWidth: 480, mx: "auto" }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Profile photos
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Same photos as your main Profile page (max 5). Visible in Messenger according to privacy below.
      </Typography>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress /></Box>
      ) : (
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {photos.map((p) => (
            <Box key={p.id} sx={{ position: "relative", width: 88, height: 88 }}>
              <Avatar
                src={p.image_url || undefined}
                variant="rounded"
                sx={{ width: 88, height: 88, border: "1px solid", borderColor: "divider" }}
              />
              <IconButton
                size="small"
                onClick={() => onDelete(p.id)}
                sx={{
                  position: "absolute", top: -6, right: -6,
                  bgcolor: "error.main", color: "#fff",
                  width: 24, height: 24,
                  "&:hover": { bgcolor: "error.dark" },
                }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          {photos.length < 5 && (
            <Button
              variant="outlined"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              sx={{
                width: 88, height: 88, minWidth: 88, borderStyle: "dashed",
                display: "flex", flexDirection: "column", gap: 0.5,
              }}
            >
              {uploading ? <CircularProgress size={22} /> : <AddPhotoAlternateIcon />}
              <Typography variant="caption">Add</Typography>
            </Button>
          )}
        </Stack>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />

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

      {error && <Chip color="error" label={String(error)} onDelete={() => setError("")} sx={{ mt: 2 }} />}
      {ok && <Chip color="success" label={ok} sx={{ mt: 2 }} />}

      {onClose && (
        <Button fullWidth sx={{ mt: 2 }} onClick={onClose}>Done</Button>
      )}
    </Box>
  );
}
