import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import DeleteIcon from "@mui/icons-material/Delete";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import PersonIcon from "@mui/icons-material/Person";
import PhotoLibraryIcon from "@mui/icons-material/PhotoLibrary";
import StarIcon from "@mui/icons-material/Star";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ReactAvatarEditor from "react-avatar-editor";
import { format, parseISO } from "date-fns";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}/users/`;

const COLOR_CHOICES = [
  { value: 0, label: "Default" },
  { value: 1, label: "Red" },
  { value: 2, label: "Blue" },
  { value: 3, label: "Green" },
  { value: 4, label: "Yellow" },
  { value: 5, label: "Purple" },
  { value: 6, label: "Orange" },
  { value: 7, label: "Pink" },
  { value: 8, label: "Teal" },
  { value: 9, label: "Indigo" },
  { value: 10, label: "Gray" },
  { value: 11, label: "Black" },
  { value: 12, label: "White" },
];

const THEME_CHOICES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// ─── helpers ───────────────────────────────────────────────────────────────

function hasAccessToken() {
  try {
    return Boolean(window.localStorage.getItem("access"));
  } catch {
    return false;
  }
}

/** Normalize profile image URL from any shape the API may return. */
export function resolveProfileImageUrl(profile) {
  if (!profile) return null;
  const candidates = [
    profile.image_url,
    profile.imageUrl,
    profile.avatar_url,
    profile.avatar,
    typeof profile.image === "string" ? profile.image : null,
    profile.image?.url,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const url = c.trim();
      // Relative media path → absolute against API host
      if (url.startsWith("/")) {
        const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
        return `${host}${url}`;
      }
      return url;
    }
  }
  return null;
}

function getProfileId(profile) {
  if (!profile) return null;
  return profile.id ?? profile.pk ?? profile.uuid ?? null;
}

function friendlyErr(err, fallback = "Something went wrong.") {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string") return data.message.replace(/^(error|success)::/, "");
  if (data.errors) {
    if (typeof data.errors === "string") return data.errors;
    try {
      const parts = Object.entries(data.errors).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map((x) => `${k}: ${x}`) : [`${k}: ${v}`]
      );
      if (parts.length) return parts.join(" · ");
    } catch {
      /* ignore */
    }
  }
  if (data.detail) return String(data.detail);
  return fallback;
}

// ─── Context ───────────────────────────────────────────────────────────────

const ProfileContext = createContext(null);

export const ProfileProvider = ({ children }) => {
  const [profiles, setProfiles] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileError, setProfileError] = useState("");
  const inFlightRef = useRef(null);

  const fetchProfiles = useCallback(async () => {
    if (!hasAccessToken()) {
      setProfiles([]);
      setLoadingProfiles(false);
      setProfileError("");
      return [];
    }

    if (inFlightRef.current) return inFlightRef.current;

    setLoadingProfiles(true);
    setProfileError("");

    const req = (async () => {
      try {
        const response = await apiRequest({
          url: `${API_BASE}profile/list/`,
          method: "GET",
        });
        const raw = response?.data;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw?.results)
          ? raw.results
          : Array.isArray(raw?.profiles)
          ? raw.profiles
          : [];
        // Normalize image_url for consumers (Navbar, etc.)
        const normalized = list.map((p) => ({
          ...p,
          id: getProfileId(p),
          image_url: resolveProfileImageUrl(p),
        }));
        normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setProfiles(normalized);
        return normalized;
      } catch (err) {
        // 401 → empty, no scary error for guests
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          setProfiles([]);
          setProfileError("");
          return [];
        }
        setProfileError(friendlyErr(err, "Failed to fetch profiles"));
        return [];
      } finally {
        setLoadingProfiles(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = req;
    return req;
  }, []);

  useEffect(() => {
    fetchProfiles();

    const onAuth = () => fetchProfiles();
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onAuth);
    return () => {
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onAuth);
    };
  }, [fetchProfiles]);

  const value = useMemo(
    () => ({
      profiles,
      setProfiles,
      fetchProfiles,
      loadingProfiles,
      profileError,
      primaryImageUrl: profiles[0] ? resolveProfileImageUrl(profiles[0]) : null,
    }),
    [profiles, fetchProfiles, loadingProfiles, profileError]
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
};

export const useProfiles = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    return {
      profiles: [],
      setProfiles: () => {},
      fetchProfiles: async () => [],
      loadingProfiles: false,
      profileError: "",
      primaryImageUrl: null,
    };
  }
  return ctx;
};

// ─── Drag-drop helper for StrictMode ───────────────────────────────────────

const StrictModeDroppable = ({ children, ...props }) => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(id);
      setEnabled(false);
    };
  }, []);
  if (!enabled) return null;
  return <Droppable {...props}>{children}</Droppable>;
};

// ─── Profile page ──────────────────────────────────────────────────────────

const Profile = () => {
  const theme = useTheme();
  const {
    profiles,
    setProfiles,
    fetchProfiles,
    loadingProfiles,
    profileError,
  } = useProfiles();

  const [userData, setUserData] = useState({
    username: "",
    email: "",
    phone_number: "",
    theme: "light",
    color: 0,
    birthdate: null,
    email_verified: false,
    phone_number_verified: false,
  });

  const [loadingUser, setLoadingUser] = useState(true);
  const [passwordStatusLoading, setPasswordStatusLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(null);
  const [passwordOperationLoading, setPasswordOperationLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [deletePasswordDialogOpen, setDeletePasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password: "",
    confirm_password: "",
    new_password: "",
    new_confirm_password: "",
  });
  const [deletePasswordData, setDeletePasswordData] = useState({
    password: "",
    confirm_password: "",
  });

  const [newImageFile, setNewImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [circularCrop, setCircularCrop] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUserData();
    fetchPasswordStatus();
  }, []);

  useEffect(() => {
    if (!success) return undefined;
    const t = setTimeout(() => setSuccess(""), 3500);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(""), 4500);
    return () => clearTimeout(t);
  }, [error]);

  const fetchUserData = async () => {
    setLoadingUser(true);
    try {
      const response = await apiRequest({ url: `${API_BASE}user/`, method: "GET" });
      const user = response.data?.user ?? response.data;
      const validColor =
        COLOR_CHOICES.find((opt) => opt.value === user.color)?.value ??
        COLOR_CHOICES[0].value;
      setUserData({
        ...user,
        birthdate: user.birthdate ? parseISO(user.birthdate) : null,
        email: user.email ?? "",
        phone_number: user.phone_number ?? "",
        color: validColor,
        theme: user.theme || "light",
      });
    } catch (err) {
      setError(friendlyErr(err, "Failed to fetch user data"));
    } finally {
      setLoadingUser(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (date) => {
    setUserData((prev) => ({ ...prev, birthdate: date }));
  };

  const handleUpdateUser = async () => {
    const dataToSend = {
      username: userData.username,
      email: userData.email,
      phone_number: userData.phone_number,
      theme: userData.theme,
      color: userData.color,
      birthdate: userData.birthdate
        ? format(userData.birthdate, "yyyy-MM-dd")
        : null,
    };
    try {
      await apiRequest({
        url: `${API_BASE}user/`,
        method: "PUT",
        data: dataToSend,
      });
      setSuccess("Profile updated successfully");
      setEditMode(false);
      fetchUserData();
    } catch (err) {
      setError(friendlyErr(err, "Failed to update user"));
    }
  };

  // Auto-assign next order — user never picks it
  const nextOrder = useMemo(() => {
    if (!profiles.length) return 0;
    return Math.max(...profiles.map((p) => Number(p.order) || 0)) + 1;
  }, [profiles]);

  const handleAddProfile = async () => {
    if (!newImageFile) return;
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", newImageFile, "profile.jpg");
    formData.append("order", String(nextOrder));
    try {
      await apiRequest({
        url: `${API_BASE}profile/set/`,
        method: "POST",
        data: formData,
      });
      setSuccess("Profile photo added");
      setNewImageFile(null);
      setPreviewUrl(null);
      await fetchProfiles();
      try {
        window.dispatchEvent(new Event("auth-changed"));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(friendlyErr(err, "Failed to add profile photo"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProfile = async (id) => {
    if (!window.confirm("Remove this profile photo?")) return;
    try {
      await apiRequest({
        url: `${API_BASE}profile/delete/`,
        method: "POST",
        data: { id },
      });
      setSuccess("Profile photo removed");
      await fetchProfiles();
      try {
        window.dispatchEvent(new Event("auth-changed"));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(friendlyErr(err, "Failed to delete profile photo"));
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(profiles);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const updated = items.map((p, index) => ({ ...p, order: index }));
    setProfiles(updated);

    const orderDict = updated.reduce((acc, p) => {
      const id = getProfileId(p);
      if (id != null) acc[String(id)] = p.order;
      return acc;
    }, {});

    (async () => {
      try {
        await apiRequest({
          url: `${API_BASE}profile/order/`,
          method: "POST",
          data: { order: orderDict },
        });
        setSuccess("Photo order updated");
        try {
          window.dispatchEvent(new Event("auth-changed"));
        } catch {
          /* ignore */
        }
      } catch (err) {
        setError(friendlyErr(err, "Failed to update order"));
        fetchProfiles();
      }
    })();
  };

  // Password API paths match users/urls.py
  const fetchPasswordStatus = async () => {
    setPasswordStatusLoading(true);
    try {
      const response = await apiRequest({
        url: `${API_BASE}password/status/`,
        method: "GET",
      });
      setHasPassword(Boolean(response.data?.has_password));
    } catch (err) {
      // fallback: older path
      try {
        const response = await apiRequest({
          url: `${API_BASE}password-status/`,
          method: "GET",
        });
        setHasPassword(Boolean(response.data?.has_password));
      } catch {
        setHasPassword(false);
      }
    } finally {
      setPasswordStatusLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeletePasswordChange = (e) => {
    const { name, value } = e.target;
    setDeletePasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSetPassword = async () => {
    if (passwordData.new_password !== passwordData.new_confirm_password) {
      setError("New password and confirmation do not match.");
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}password/set/`,
        method: "POST",
        data: {
          new_password: passwordData.new_password,
          new_confirm_password: passwordData.new_confirm_password,
        },
      });
      setSuccess("Password has been set.");
      setPasswordDialogOpen(false);
      setPasswordData({
        password: "",
        confirm_password: "",
        new_password: "",
        new_confirm_password: "",
      });
      await fetchPasswordStatus();
    } catch (err) {
      setError(friendlyErr(err, "Failed to set password"));
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.password !== passwordData.confirm_password) {
      setError("Current password confirmation does not match.");
      return;
    }
    if (passwordData.new_password !== passwordData.new_confirm_password) {
      setError("New password and confirmation do not match.");
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}password/change/`,
        method: "POST",
        data: {
          current_password: passwordData.password,
          new_password: passwordData.new_password,
          new_confirm_password: passwordData.new_confirm_password,
        },
      });
      setSuccess("Password changed successfully.");
      setPasswordDialogOpen(false);
      setPasswordData({
        password: "",
        confirm_password: "",
        new_password: "",
        new_confirm_password: "",
      });
      await fetchPasswordStatus();
    } catch (err) {
      setError(friendlyErr(err, "Failed to change password"));
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    if (deletePasswordData.password !== deletePasswordData.confirm_password) {
      setError("Password confirmation does not match.");
      return;
    }
    setPasswordOperationLoading(true);
    try {
      await apiRequest({
        url: `${API_BASE}password/remove/`,
        method: "DELETE",
        data: { current_password: deletePasswordData.password },
      });
      setSuccess("Password removed successfully.");
      setDeletePasswordDialogOpen(false);
      setDeletePasswordData({ password: "", confirm_password: "" });
      await fetchPasswordStatus();
    } catch (err) {
      setError(friendlyErr(err, "Failed to remove password"));
    } finally {
      setPasswordOperationLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setZoom(1);
    setRotation(0);
    setCircularCrop(true);
    setEditorOpen(true);
  };

  const handleApplyEdit = () => {
    if (!editorRef.current) {
      setEditorOpen(false);
      return;
    }
    editorRef.current.getImageScaledToCanvas().toBlob(
      (blob) => {
        if (blob) {
          setNewImageFile(blob);
          setPreviewUrl(URL.createObjectURL(blob));
        }
        setEditorOpen(false);
      },
      "image/jpeg",
      0.92
    );
  };

  const primaryUrl =
    profiles[0] ? resolveProfileImageUrl(profiles[0]) : null;

  if (loadingUser && loadingProfiles) {
    return (
      <Box sx={{ display: "grid", placeItems: "center", minHeight: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  const sectionPaper = {
    p: { xs: 2.5, sm: 3.5 },
    borderRadius: 3,
    border: "1px solid",
    borderColor: "divider",
    backgroundImage: (t) =>
      t.palette.mode === "dark"
        ? "linear-gradient(145deg, rgba(30,41,59,0.55), rgba(15,23,42,0.75))"
        : "linear-gradient(145deg, #ffffff, #f8fafc)",
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        {/* Hero */}
        <Paper elevation={0} sx={{ ...sectionPaper, mb: 3 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2.5}
            alignItems={{ xs: "center", sm: "flex-start" }}
          >
            <Avatar
              src={primaryUrl || undefined}
              alt={userData.username || "User"}
              sx={{
                width: 88,
                height: 88,
                border: "3px solid",
                borderColor: "primary.main",
                boxShadow: 3,
                fontSize: 36,
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                color: "primary.main",
              }}
            >
              {!primaryUrl && (userData.username?.[0]?.toUpperCase() || <PersonIcon />)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: "center", sm: "left" } }}>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: "-0.02em" }}>
                {userData.username || "Your profile"}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                {userData.email || userData.phone_number || "Manage account, photos & security"}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, justifyContent: { xs: "center", sm: "flex-start" } }}
                flexWrap="wrap"
                useFlexGap
              >
                {userData.email_verified && (
                  <Chip size="small" color="success" label="Email verified" sx={{ fontWeight: 700 }} />
                )}
                {userData.phone_number_verified && (
                  <Chip size="small" color="success" label="Phone verified" sx={{ fontWeight: 700 }} />
                )}
                {!passwordStatusLoading && (
                  <Chip
                    size="small"
                    icon={hasPassword ? <LockIcon /> : <LockOpenIcon />}
                    label={hasPassword ? "Password on" : "No password"}
                    color={hasPassword ? "primary" : "default"}
                    variant={hasPassword ? "filled" : "outlined"}
                    sx={{ fontWeight: 700 }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {(error || profileError || success) && (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError("")} sx={{ borderRadius: 2 }}>
                {error}
              </Alert>
            )}
            {profileError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {profileError}
              </Alert>
            )}
            {success && (
              <Alert severity="success" onClose={() => setSuccess("")} sx={{ borderRadius: 2 }}>
                {success}
              </Alert>
            )}
          </Stack>
        )}

        {/* User info */}
        <Paper elevation={0} sx={{ ...sectionPaper, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <PersonIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Account details
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Username"
                name="username"
                value={userData.username}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Email"
                name="email"
                value={userData.email}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode || userData.email_verified}
                helperText={userData.email_verified ? "Verified — contact support to change" : ""}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone number"
                name="phone_number"
                value={userData.phone_number}
                onChange={handleInputChange}
                fullWidth
                disabled={!editMode || userData.phone_number_verified}
                helperText={userData.phone_number_verified ? "Verified" : ""}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Birthdate"
                value={userData.birthdate}
                onChange={handleDateChange}
                maxDate={new Date()}
                disabled={!editMode}
                slotProps={{
                  textField: { fullWidth: true, size: "small" },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" disabled={!editMode}>
                <InputLabel>Theme preference</InputLabel>
                <Select
                  name="theme"
                  value={userData.theme}
                  onChange={handleInputChange}
                  label="Theme preference"
                >
                  {THEME_CHOICES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small" disabled={!editMode}>
                <InputLabel>Accent color</InputLabel>
                <Select
                  name="color"
                  value={userData.color}
                  onChange={handleInputChange}
                  label="Accent color"
                >
                  {COLOR_CHOICES.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
            {editMode ? (
              <>
                <Button
                  variant="contained"
                  onClick={handleUpdateUser}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                >
                  Save changes
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setEditMode(false);
                    fetchUserData();
                  }}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setEditMode(true)}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
              >
                Edit profile
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Photos */}
        <Paper elevation={0} sx={{ ...sectionPaper, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <PhotoLibraryIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Profile photos
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag to reorder. The first photo is shown in the navbar.
          </Typography>

          <DragDropContext onDragEnd={handleDragEnd}>
            <StrictModeDroppable droppableId="profiles" direction="horizontal">
              {(provided) => (
                <Stack
                  direction="row"
                  spacing={2}
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  sx={{
                    flexWrap: "wrap",
                    gap: 2,
                    minHeight: 120,
                    alignItems: "flex-start",
                  }}
                >
                  {profiles.map((profile, index) => {
                    const id = String(getProfileId(profile));
                    const src = resolveProfileImageUrl(profile);
                    return (
                      <Draggable key={id} draggableId={id} index={index}>
                        {(drag) => (
                          <Paper
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            elevation={0}
                            sx={{
                              p: 1.25,
                              borderRadius: 2.5,
                              border: "1px solid",
                              borderColor: index === 0 ? "primary.main" : "divider",
                              position: "relative",
                              cursor: "grab",
                              width: 132,
                            }}
                          >
                            {index === 0 && (
                              <Chip
                                icon={<StarIcon sx={{ fontSize: 14 }} />}
                                label="Primary"
                                size="small"
                                color="primary"
                                sx={{
                                  position: "absolute",
                                  top: 6,
                                  left: 6,
                                  height: 22,
                                  fontSize: 10,
                                  fontWeight: 800,
                                  zIndex: 1,
                                }}
                              />
                            )}
                            <Avatar
                              src={src || undefined}
                              alt={`Photo ${index + 1}`}
                              sx={{
                                width: 108,
                                height: 108,
                                mx: "auto",
                                borderRadius: 2,
                              }}
                              variant="rounded"
                            />
                            <IconButton
                              color="error"
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                bgcolor: alpha("#000", 0.35),
                                color: "#fff",
                                "&:hover": { bgcolor: "error.main" },
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProfile(getProfileId(profile));
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Paper>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                  {!profiles.length && (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      No photos yet — add one below.
                    </Typography>
                  )}
                </Stack>
              )}
            </StrictModeDroppable>
          </DragDropContext>

          <Divider sx={{ my: 2.5 }} />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            {previewUrl && (
              <Avatar
                src={previewUrl}
                sx={{ width: 56, height: 56, borderRadius: 2 }}
                variant="rounded"
              />
            )}
            <Button
              variant="outlined"
              component="label"
              startIcon={<AddPhotoAlternateIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              Choose photo
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageChange}
              />
            </Button>
            {previewUrl && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setEditorOpen(true)}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Adjust
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleAddProfile}
              disabled={!newImageFile || uploadingImage}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              {uploadingImage ? "Uploading…" : "Upload photo"}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Order is assigned automatically. Drag cards to change which one is primary.
          </Typography>
        </Paper>

        {/* Password */}
        <Paper elevation={0} sx={{ ...sectionPaper }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <LockIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Password & security
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {passwordStatusLoading
              ? "Checking password status…"
              : hasPassword
              ? "A password is set. You can change or remove it."
              : "No password yet. Set one if you want password login in addition to code login."}
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {hasPassword ? (
              <>
                <Button
                  variant="contained"
                  onClick={() => setPasswordDialogOpen(true)}
                  sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                >
                  Change password
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setDeletePasswordDialogOpen(true)}
                  sx={{ textTransform: "none", borderRadius: 2 }}
                >
                  Remove password
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => setPasswordDialogOpen(true)}
                disabled={passwordStatusLoading}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
              >
                Set password
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Image editor */}
        <Dialog
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Adjust photo</DialogTitle>
          <DialogContent>
            <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
              {previewUrl && (
                <ReactAvatarEditor
                  ref={editorRef}
                  image={previewUrl}
                  width={250}
                  height={250}
                  border={40}
                  borderRadius={circularCrop ? 125 : 0}
                  color={[255, 255, 255, 0.6]}
                  scale={zoom}
                  rotate={rotation}
                />
              )}
            </Box>
            <Typography variant="body2" gutterBottom>
              Zoom
            </Typography>
            <Slider value={zoom} onChange={(_, v) => setZoom(v)} min={1} max={3} step={0.01} />
            <Typography variant="body2" gutterBottom>
              Rotation
            </Typography>
            <Slider
              value={rotation}
              onChange={(_, v) => setRotation(v)}
              min={-180}
              max={180}
              step={1}
            />
            <Stack direction="row" alignItems="center" sx={{ mt: 1 }}>
              <Switch
                checked={circularCrop}
                onChange={(e) => setCircularCrop(e.target.checked)}
              />
              <Typography variant="body2">Circular crop</Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditorOpen(false)} sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyEdit}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              Apply
            </Button>
          </DialogActions>
        </Dialog>

        {/* Set / change password */}
        <Dialog
          open={passwordDialogOpen}
          onClose={() => setPasswordDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>
            {hasPassword ? "Change password" : "Set password"}
          </DialogTitle>
          <DialogContent>
            {hasPassword && (
              <>
                <TextField
                  label="Current password"
                  name="password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.password}
                  onChange={handlePasswordChange}
                  fullWidth
                  size="small"
                  sx={{ mb: 1.5, mt: 1 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          onClick={() => setShowCurrentPassword((p) => !p)}
                        >
                          {showCurrentPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="Confirm current password"
                  name="confirm_password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  fullWidth
                  size="small"
                  sx={{ mb: 1.5 }}
                />
              </>
            )}
            <TextField
              label="New password"
              name="new_password"
              type={showNewPassword ? "text" : "password"}
              value={passwordData.new_password}
              onChange={handlePasswordChange}
              fullWidth
              size="small"
              sx={{ mb: 1.5, mt: hasPassword ? 0 : 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowNewPassword((p) => !p)}>
                      {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm new password"
              name="new_confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              value={passwordData.new_confirm_password}
              onChange={handlePasswordChange}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowConfirmPassword((p) => !p)}>
                      {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPasswordDialogOpen(false)} sx={{ textTransform: "none" }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={passwordOperationLoading}
              onClick={hasPassword ? handleChangePassword : handleSetPassword}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              {passwordOperationLoading
                ? "Saving…"
                : hasPassword
                ? "Save"
                : "Set password"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Remove password */}
        <Dialog
          open={deletePasswordDialogOpen}
          onClose={() => setDeletePasswordDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>Remove password</DialogTitle>
          <DialogContent>
            <TextField
              label="Current password"
              name="password"
              type={showDeletePassword ? "text" : "password"}
              value={deletePasswordData.password}
              onChange={handleDeletePasswordChange}
              fullWidth
              size="small"
              sx={{ mb: 1.5, mt: 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={() => setShowDeletePassword((p) => !p)}>
                      {showDeletePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Confirm current password"
              name="confirm_password"
              type={showDeletePassword ? "text" : "password"}
              value={deletePasswordData.confirm_password}
              onChange={handleDeletePasswordChange}
              fullWidth
              size="small"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeletePasswordDialogOpen(false)}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={passwordOperationLoading}
              onClick={handleRemovePassword}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              {passwordOperationLoading ? "Removing…" : "Remove password"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default Profile;
