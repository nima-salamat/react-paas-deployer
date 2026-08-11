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
  Popover,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
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
import BrokenImageIcon from "@mui/icons-material/BrokenImage";
import InsertEmoticonIcon from "@mui/icons-material/InsertEmoticon";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import ReactAvatarEditor from "react-avatar-editor";
import { format, parseISO } from "date-fns";
import apiRequest from "../customHooks/apiRequest";

// --- DND-Kit Imports ---
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}/users/`;

/** Size of the crop canvas inside the editor (px) */
const EDITOR_SIZE = 360;

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

const PRESET_EMOJIS = [
  "😀", "😂", "😍", "😎", "🤩", "👑",
  "💡", "🔥", "❤️", "⭐", "🚀", "🍕",
  "🎉", "🏆", "💎", "✨", "🎵", "💬",
];

// ─── helpers ───────────────────────────────────────────────────────────────

function hasAccessToken() {
  try {
    return Boolean(window.localStorage.getItem("access"));
  } catch {
    return false;
  }
}

/**
 * Build a displayable absolute URL for a profile photo.
 * Backend returns relative /media/images/... URLs protected by JWT.
 * <img> cannot send Authorization headers, so we append ?token=<access>.
 */
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
      let url = c.trim();
      // Resolve relative URLs against the API host first
      if (url.startsWith("/")) {
        const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
        url = `${host}${url}`;
      } else if (!/^https?:\/\//i.test(url) && import.meta.env.VITE_API_BASE) {
        const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
        url = `${host}/${url}`;
      }

      // Any /media/ path is JWT-protected (images, messenger, tickets)
      if (/\/media\//i.test(url) || /\/api\/messenger\/attachments\//i.test(url)) {
        const token = localStorage.getItem("access");
        if (token) {
          try {
            const u = new URL(url);
            u.searchParams.set("token", token);
            return u.toString();
          } catch {
            const sep = url.includes("?") ? "&" : "?";
            return `${url}${sep}token=${encodeURIComponent(token)}`;
          }
        }
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

function revokeUrl(url) {
  if (url && typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  // fallback for some OS that omit MIME
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif)$/i.test(file.name || "");
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
        const normalized = list.map((p) => ({
          ...p,
          id: getProfileId(p),
          image_url: resolveProfileImageUrl(p),
        }));
        normalized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setProfiles(normalized);
        return normalized;
      } catch (err) {
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

// ─── Sortable Photo — whole card is draggable; click still opens preview ───

const SortablePhoto = ({ id, profile, index, handleDeleteProfile, onPreview }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // Track whether a drag actually started so click doesn't fire after drag
  const didDragRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.55 : 1,
  };

  const src = resolveProfileImageUrl(profile);

  useEffect(() => {
    if (isDragging) didDragRef.current = true;
  }, [isDragging]);

  const handlePreviewClick = (e) => {
    e.stopPropagation();
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    if (src) onPreview(src);
  };

  // Merge with dnd-kit listeners — never replace onPointerDown or drag breaks
  const mergedListeners = listeners
    ? {
        ...listeners,
        onPointerDown: (e) => {
          didDragRef.current = false;
          listeners.onPointerDown?.(e);
        },
      }
    : undefined;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 10 : 0}
      {...attributes}
      {...mergedListeners}
      sx={{
        p: 1.25,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: isDragging
          ? "primary.main"
          : index === 0
          ? "primary.main"
          : "divider",
        position: "relative",
        width: 132,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        transition: "box-shadow 0.15s, border-color 0.15s, opacity 0.15s",
        "&:hover": {
          boxShadow: isDragging ? undefined : 3,
        },
      }}
    >
      {/* Number Badge */}
      <Box
        sx={{
          position: "absolute",
          top: 6,
          left: 6,
          width: 24,
          height: 24,
          bgcolor: index === 0 ? "primary.main" : "grey.800",
          color: "white",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: "bold",
          boxShadow: 2,
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        {index + 1}
      </Box>

      {/* Primary Tag */}
      {index === 0 && (
        <Chip
          icon={<StarIcon sx={{ fontSize: 14 }} />}
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

      {/* Delete — stop drag from starting on this control */}
      <IconButton
        color="error"
        size="small"
        sx={{
          position: "absolute",
          top: 4,
          right: 4,
          bgcolor: alpha("#000", 0.4),
          color: "#fff",
          "&:hover": { bgcolor: "error.main" },
          zIndex: 3,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleDeleteProfile(getProfileId(profile));
        }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>

      {/* Photo — click opens preview; drag reorders */}
      <Box
        onClick={handlePreviewClick}
        sx={{
          cursor: isDragging ? "grabbing" : "grab",
          borderRadius: 2,
          overflow: "hidden",
          mt: 1.5,
          position: "relative",
          "&:hover": { opacity: 0.92 },
        }}
      >
        <Avatar
          src={src || undefined}
          alt={`Photo ${index + 1}`}
          sx={{
            width: 108,
            height: 108,
            mx: "auto",
            borderRadius: 2,
            pointerEvents: "none",
            bgcolor: "action.hover",
          }}
          variant="rounded"
          draggable={false}
        >
          {/* Fallback shown when src is missing or fails to load (404).
              The user might have a stale URL cached from a deleted photo. */}
          <BrokenImageIcon sx={{ fontSize: 36, color: "text.disabled" }} />
        </Avatar>
      </Box>
    </Paper>
  );
};

// ─── Profile page ──────────────────────────────────────────────────────────

const Profile = () => {
  const theme = useTheme();
  // Desktop only for OS file drag-and-drop (not tablet / phone)
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const prefersFinePointer = useMediaQuery("(pointer: fine)", { noSsr: true });
  const enableFileDrop = isDesktop && prefersFinePointer;

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
  const [previewImageSrc, setPreviewImageSrc] = useState(null);

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

  // ── Image pipeline ─────────────────────────────────────────────────────
  // original* = source chosen by user (never mutated by Apply)
  // newImageFile / previewUrl = final composite ready for upload / thumbnail
  const [originalFile, setOriginalFile] = useState(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState(null);
  const [newImageFile, setNewImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [hasAppliedEdit, setHasAppliedEdit] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [circularCrop, setCircularCrop] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // Desktop drop-zone highlight
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  // --- EMOJI & ICON EDITOR STATE ---
  const [emojis, setEmojis] = useState([]);
  const [selectedEmojiId, setSelectedEmojiId] = useState(null);
  const [draggingEmojiId, setDraggingEmojiId] = useState(null);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const editorContainerRef = useRef(null);

  // Snapshot of editor settings so reopening restores exact state (without baking image)
  const editorSnapshotRef = useRef({
    zoom: 1,
    rotation: 0,
    position: { x: 0.5, y: 0.5 },
    circularCrop: true,
    emojis: [],
  });

  // --- DND-Kit Sensors ---
  // Pointer: small distance so click ≠ drag (preview still works)
  // Touch: short delay so scroll/tap work on mobile; reorder still possible
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 180,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Keep latest blob URLs for unmount cleanup
  const originalPreviewUrlRef = useRef(originalPreviewUrl);
  const previewUrlRef = useRef(previewUrl);
  originalPreviewUrlRef.current = originalPreviewUrl;
  previewUrlRef.current = previewUrl;

  useEffect(() => {
    return () => {
      revokeUrl(originalPreviewUrlRef.current);
      if (previewUrlRef.current !== originalPreviewUrlRef.current) {
        revokeUrl(previewUrlRef.current);
      }
    };
  }, []);

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

  const nextOrder = useMemo(() => {
    if (!profiles.length) return 0;
    return Math.max(...profiles.map((p) => Number(p.order) || 0)) + 1;
  }, [profiles]);

  const clearPendingImage = () => {
    if (previewUrl && previewUrl !== originalPreviewUrl) {
      revokeUrl(previewUrl);
    }
    revokeUrl(originalPreviewUrl);
    setOriginalFile(null);
    setOriginalPreviewUrl(null);
    setNewImageFile(null);
    setPreviewUrl(null);
    setHasAppliedEdit(false);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
    setCircularCrop(true);
    setEmojis([]);
    setSelectedEmojiId(null);
    editorSnapshotRef.current = {
      zoom: 1,
      rotation: 0,
      position: { x: 0.5, y: 0.5 },
      circularCrop: true,
      emojis: [],
    };
  };

  const handleAddProfile = async () => {
    const fileToUpload = newImageFile || originalFile;
    if (!fileToUpload) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", fileToUpload, "profile.jpg");
    formData.append("order", String(nextOrder));
    try {
      await apiRequest({
        url: `${API_BASE}profile/set/`,
        method: "POST",
        data: formData,
      });
      setSuccess("Profile photo added");
      clearPendingImage();
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

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = profiles.findIndex((p) => String(getProfileId(p)) === active.id);
    const newIndex = profiles.findIndex((p) => String(getProfileId(p)) === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    const updatedProfiles = arrayMove(profiles, oldIndex, newIndex);
    const reorderedProfiles = updatedProfiles.map((p, index) => ({ ...p, order: index }));

    setProfiles(reorderedProfiles);

    const orderDict = reorderedProfiles.reduce((acc, p) => {
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

  const fetchPasswordStatus = async () => {
    setPasswordStatusLoading(true);
    try {
      const response = await apiRequest({
        url: `${API_BASE}password/status/`,
        method: "GET",
      });
      setHasPassword(Boolean(response.data?.has_password));
    } catch (err) {
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

  /** Load a File into the editor pipeline and open Adjust & Decorate */
  const loadImageFile = (file) => {
    if (!file || !isImageFile(file)) {
      setError("Please choose a valid image file.");
      return;
    }

    if (previewUrl && previewUrl !== originalPreviewUrl) {
      revokeUrl(previewUrl);
    }
    revokeUrl(originalPreviewUrl);

    const url = URL.createObjectURL(file);
    setOriginalFile(file);
    setOriginalPreviewUrl(url);
    setNewImageFile(null);
    setPreviewUrl(url);
    setHasAppliedEdit(false);

    setZoom(1);
    setRotation(0);
    setPosition({ x: 0.5, y: 0.5 });
    setCircularCrop(true);
    setEmojis([]);
    setSelectedEmojiId(null);
    editorSnapshotRef.current = {
      zoom: 1,
      rotation: 0,
      position: { x: 0.5, y: 0.5 },
      circularCrop: true,
      emojis: [],
    };

    setEditorOpen(true);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImageFile(file);
  };

  // ── Desktop file drag & drop ────────────────────────────────────────────
  const handleDropZoneDragEnter = (e) => {
    if (!enableFileDrop) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) {
      setIsDragOver(true);
    }
  };

  const handleDropZoneDragLeave = (e) => {
    if (!enableFileDrop) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDropZoneDragOver = (e) => {
    if (!enableFileDrop) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDropZoneDrop = (e) => {
    if (!enableFileDrop) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    const file = files[0];
    loadImageFile(file);
  };

  const openEditor = () => {
    if (!originalPreviewUrl) return;
    const snap = editorSnapshotRef.current;
    setZoom(snap.zoom);
    setRotation(snap.rotation);
    setPosition(snap.position || { x: 0.5, y: 0.5 });
    setCircularCrop(snap.circularCrop);
    setEmojis(snap.emojis || []);
    setSelectedEmojiId(null);
    setEditorOpen(true);
  };

  // --- EMOJI EDITOR LOGIC ---
  const handleAddEmoji = (emojiChar) => {
    const newEmoji = {
      id: Date.now().toString(),
      char: emojiChar,
      x: EDITOR_SIZE / 2,
      y: EDITOR_SIZE / 2,
      size: 48,
    };
    setEmojis((prev) => [...prev, newEmoji]);
    setSelectedEmojiId(newEmoji.id);
    setEmojiAnchorEl(null);
  };

  const handleEmojiPointerDown = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingEmojiId(id);
    setSelectedEmojiId(id);
  };

  const handleEditorPointerMove = (e) => {
    if (!draggingEmojiId || !editorContainerRef.current) return;
    const rect = editorContainerRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    x = Math.max(0, Math.min(EDITOR_SIZE, x));
    y = Math.max(0, Math.min(EDITOR_SIZE, y));

    setEmojis((prev) =>
      prev.map((em) => (em.id === draggingEmojiId ? { ...em, x, y } : em))
    );
  };

  const handleEditorPointerUp = () => {
    setDraggingEmojiId(null);
  };

  const buildFinalBlob = () =>
    new Promise((resolve) => {
      if (!editorRef.current) {
        resolve(null);
        return;
      }

      const canvas = editorRef.current.getImageScaledToCanvas();
      const ctx = canvas.getContext("2d");

      const scaleX = canvas.width / EDITOR_SIZE;
      const scaleY = canvas.height / EDITOR_SIZE;

      emojis.forEach((emp) => {
        ctx.font = `${emp.size * scaleX}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(emp.char, emp.x * scaleX, emp.y * scaleY);
      });

      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });

  const handleApplyEdit = async () => {
    const blob = await buildFinalBlob();
    if (blob) {
      if (previewUrl && previewUrl !== originalPreviewUrl) {
        revokeUrl(previewUrl);
      }
      const url = URL.createObjectURL(blob);
      setNewImageFile(blob);
      setPreviewUrl(url);
      setHasAppliedEdit(true);
    }

    editorSnapshotRef.current = {
      zoom,
      rotation,
      position: { ...position },
      circularCrop,
      emojis: emojis.map((e) => ({ ...e })),
    };

    setEditorOpen(false);
  };

  const handleCancelEditor = () => {
    const snap = editorSnapshotRef.current;
    setZoom(snap.zoom);
    setRotation(snap.rotation);
    setPosition(snap.position || { x: 0.5, y: 0.5 });
    setCircularCrop(snap.circularCrop);
    setEmojis(snap.emojis || []);
    setSelectedEmojiId(null);
    setEditorOpen(false);
  };

  const primaryUrl = profiles[0] ? resolveProfileImageUrl(profiles[0]) : null;

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

  const canUpload = Boolean(newImageFile || originalFile);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
        {/* Hero Section */}
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

        {/* System Alerts */}
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

        {/* User Info Form */}
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

        {/* Photos List */}
        <Paper elevation={0} sx={{ ...sectionPaper, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <PhotoLibraryIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>
              Profile photos
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tap a photo to preview. Drag the photo itself to reorder.
            {enableFileDrop ? " On desktop you can also drop an image below." : ""}
          </Typography>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={profiles.map((p) => String(getProfileId(p)))}
              strategy={rectSortingStrategy}
            >
              <Stack
                direction="row"
                spacing={2}
                sx={{
                  flexWrap: "wrap",
                  gap: 2,
                  minHeight: 120,
                  alignItems: "flex-start",
                }}
              >
                {profiles.map((profile, index) => {
                  const id = String(getProfileId(profile));
                  return (
                    <SortablePhoto
                      key={id}
                      id={id}
                      profile={profile}
                      index={index}
                      handleDeleteProfile={handleDeleteProfile}
                      onPreview={(src) => setPreviewImageSrc(src)}
                    />
                  );
                })}
                {!profiles.length && (
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No photos yet — add one below.
                  </Typography>
                )}
              </Stack>
            </SortableContext>
          </DndContext>

          <Divider sx={{ my: 2.5 }} />

          {/* Desktop-only drop zone */}
          {enableFileDrop && (
            <Box
              onDragEnter={handleDropZoneDragEnter}
              onDragLeave={handleDropZoneDragLeave}
              onDragOver={handleDropZoneDragOver}
              onDrop={handleDropZoneDrop}
              sx={{
                mb: 2,
                p: 3,
                borderRadius: 3,
                border: "2px dashed",
                borderColor: isDragOver ? "primary.main" : "divider",
                bgcolor: isDragOver
                  ? alpha(theme.palette.primary.main, 0.08)
                  : alpha(theme.palette.action.hover, 0.04),
                textAlign: "center",
                transition: "border-color 0.15s, background-color 0.15s",
                cursor: "copy",
              }}
            >
              <CloudUploadIcon
                sx={{
                  fontSize: 40,
                  color: isDragOver ? "primary.main" : "text.secondary",
                  mb: 1,
                }}
              />
              <Typography variant="body1" fontWeight={700} sx={{ mb: 0.5 }}>
                {isDragOver ? "Drop image to edit" : "Drag & drop a photo here"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Opens Adjust & Decorate automatically · JPG, PNG, WebP…
              </Typography>
            </Box>
          )}

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            {previewUrl && (
              <Avatar
                src={previewUrl}
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  border: hasAppliedEdit ? "2px solid" : "1px dashed",
                  borderColor: hasAppliedEdit ? "primary.main" : "divider",
                }}
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
            {originalPreviewUrl && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={openEditor}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Adjust & Decorate
              </Button>
            )}
            <Button
              variant="contained"
              onClick={handleAddProfile}
              disabled={!canUpload || uploadingImage}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
            >
              {uploadingImage ? "Uploading…" : "Upload photo"}
            </Button>
            {(originalFile || newImageFile) && (
              <Button
                variant="text"
                color="inherit"
                onClick={clearPendingImage}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Clear
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {hasAppliedEdit
              ? "Edits are ready — they will be applied when you upload."
              : "Order is assigned automatically. The #1 photo is set as primary."}
          </Typography>
        </Paper>

        {/* Security Section */}
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

        {/* Photo Preview Dialog */}
        <Dialog
          open={Boolean(previewImageSrc)}
          onClose={() => setPreviewImageSrc(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3, maxHeight: "92vh" } }}
        >
          <DialogTitle
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 800,
            }}
          >
            Photo Preview
            <IconButton onClick={() => setPreviewImageSrc(null)} size="small">
              &times;
            </IconButton>
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              p: { xs: 1.5, sm: 3 },
              bgcolor: (t) =>
                t.palette.mode === "dark" ? "grey.900" : "grey.100",
            }}
          >
            {previewImageSrc && (
              <Box
                component="img"
                src={previewImageSrc}
                alt="Preview"
                sx={{
                  maxWidth: "100%",
                  maxHeight: "78vh",
                  borderRadius: 2,
                  objectFit: "contain",
                  boxShadow: 4,
                }}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPreviewImageSrc(null)} sx={{ textTransform: "none" }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Image Editor & Emoji Decoration Dialog */}
        <Dialog
          open={editorOpen}
          onClose={handleCancelEditor}
          maxWidth="md"
          fullWidth
          PaperProps={{ sx: { borderRadius: 3 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
            Adjust & Decorate Photo
          </DialogTitle>
          <DialogContent
            onPointerMove={handleEditorPointerMove}
            onPointerUp={handleEditorPointerUp}
            onPointerLeave={handleEditorPointerUp}
            sx={{ pt: 1 }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mb: 2, display: "flex", alignItems: "center", gap: 0.75 }}
            >
              <OpenWithIcon fontSize="small" />
              Drag the photo to reposition · use sliders for zoom & rotation
            </Typography>

            <Box
              ref={editorContainerRef}
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 2.5,
                position: "relative",
                width: EDITOR_SIZE,
                height: EDITOR_SIZE,
                maxWidth: "100%",
                mx: "auto",
                overflow: "hidden",
                borderRadius: circularCrop ? "50%" : 3,
                boxShadow: 4,
                border: "2px solid",
                borderColor: "divider",
                bgcolor: "grey.900",
                cursor: "grab",
                touchAction: "none",
                "&:active": { cursor: "grabbing" },
              }}
            >
              {originalPreviewUrl && (
                <ReactAvatarEditor
                  ref={editorRef}
                  image={originalPreviewUrl}
                  width={EDITOR_SIZE}
                  height={EDITOR_SIZE}
                  border={0}
                  borderRadius={circularCrop ? EDITOR_SIZE / 2 : 0}
                  color={[0, 0, 0, 0.55]}
                  scale={zoom}
                  rotate={rotation}
                  position={position}
                  onPositionChange={setPosition}
                  style={{ width: "100%", height: "100%" }}
                />
              )}

              {emojis.map((em) => (
                <Box
                  key={em.id}
                  onPointerDown={(e) => handleEmojiPointerDown(e, em.id)}
                  sx={{
                    position: "absolute",
                    left: em.x,
                    top: em.y,
                    transform: "translate(-50%, -50%)",
                    fontSize: `${em.size}px`,
                    cursor: "grab",
                    userSelect: "none",
                    lineHeight: 1,
                    touchAction: "none",
                    border: selectedEmojiId === em.id ? "2px dashed #1976d2" : "none",
                    padding: "2px",
                    borderRadius: "4px",
                    bgcolor:
                      selectedEmojiId === em.id
                        ? alpha("#1976d2", 0.15)
                        : "transparent",
                    zIndex: 2,
                    "&:active": { cursor: "grabbing" },
                  }}
                >
                  {em.char}
                </Box>
              ))}
            </Box>

            <Stack
              direction="row"
              spacing={1}
              justifyContent="center"
              sx={{ mb: 2 }}
              flexWrap="wrap"
              useFlexGap
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<InsertEmoticonIcon />}
                onClick={(e) => setEmojiAnchorEl(e.currentTarget)}
                sx={{ textTransform: "none", borderRadius: 2 }}
              >
                Add Emoji / Icon
              </Button>
              <Popover
                open={Boolean(emojiAnchorEl)}
                anchorEl={emojiAnchorEl}
                onClose={() => setEmojiAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
                transformOrigin={{ vertical: "top", horizontal: "center" }}
              >
                <Box
                  sx={{
                    p: 1.25,
                    display: "grid",
                    gridTemplateColumns: "repeat(6, 1fr)",
                    gap: 0.5,
                  }}
                >
                  {PRESET_EMOJIS.map((em) => (
                    <IconButton key={em} onClick={() => handleAddEmoji(em)} size="small">
                      {em}
                    </IconButton>
                  ))}
                </Box>
              </Popover>
            </Stack>

            {selectedEmojiId && (
              <Paper
                sx={{ p: 1.5, mb: 2, bgcolor: alpha(theme.palette.primary.main, 0.06) }}
                variant="outlined"
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 1 }}
                >
                  <Typography variant="body2" fontWeight="bold">
                    Emoji size
                  </Typography>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => {
                      setEmojis((prev) => prev.filter((em) => em.id !== selectedEmojiId));
                      setSelectedEmojiId(null);
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Slider
                  value={emojis.find((e) => e.id === selectedEmojiId)?.size || 48}
                  onChange={(_, val) =>
                    setEmojis((prev) =>
                      prev.map((em) =>
                        em.id === selectedEmojiId ? { ...em, size: val } : em
                      )
                    )
                  }
                  min={16}
                  max={140}
                  size="small"
                />
              </Paper>
            )}

            <Stack spacing={1.5}>
              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <ZoomInIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>
                    Zoom
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                    {zoom.toFixed(2)}×
                  </Typography>
                </Stack>
                <Slider
                  value={zoom}
                  onChange={(_, v) => setZoom(v)}
                  min={1}
                  max={4}
                  step={0.01}
                  size="small"
                />
              </Box>

              <Box>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                  <RotateRightIcon fontSize="small" color="action" />
                  <Typography variant="body2" fontWeight={600}>
                    Rotation
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                    {rotation}°
                  </Typography>
                </Stack>
                <Slider
                  value={rotation}
                  onChange={(_, v) => setRotation(v)}
                  min={-180}
                  max={180}
                  step={1}
                  size="small"
                />
              </Box>

              <Stack direction="row" alignItems="center">
                <Switch
                  checked={circularCrop}
                  onChange={(e) => setCircularCrop(e.target.checked)}
                  size="small"
                />
                <Typography variant="body2">Circular crop</Typography>
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={handleCancelEditor} sx={{ textTransform: "none" }}>
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

        {/* Set / Change Password Dialog */}
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

        {/* Remove Password Dialog */}
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
