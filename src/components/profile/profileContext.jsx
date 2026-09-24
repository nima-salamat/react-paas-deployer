import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import apiRequest from "../customHooks/apiRequest";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}/users/`;

function hasAccessToken() {
  try {
    return Boolean(window.localStorage.getItem("access"));
  } catch {
    return false;
  }
}

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
    if (typeof c !== "string" || !c.trim()) continue;
    let url = c.trim();

    if (url.startsWith("/")) {
      const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
      url = `${host}${url}`;
    } else if (!/^https?:\/\//i.test(url) && import.meta.env.VITE_API_BASE) {
      const host = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/$/, "");
      url = `${host}/${url}`;
    }

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

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
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
        const response = await apiRequest({ url: `${API_BASE}profile/list/`, method: "GET" });
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
    [profiles, fetchProfiles, loadingProfiles, profileError],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
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
}
