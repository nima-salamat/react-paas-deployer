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
import { getAuthCacheScope, getSessionBoundAccessToken } from "../customHooks/authSession.js";
import { readProfileCache, writeProfileCache } from "./profileCache.js";

const API_BASE = `https://${import.meta.env.VITE_API_BASE}/users/`;

function hasAccessToken() {
  try {
    return Boolean(getSessionBoundAccessToken(window.localStorage));
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
      const token = getSessionBoundAccessToken(localStorage);
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

function normalizeProfiles(list) {
  return list.map((profile) => ({
    ...profile,
    id: getProfileId(profile),
    image_url: resolveProfileImageUrl(profile),
  })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
  const initialScope = getAuthCacheScope();
  const [profiles, setProfiles] = useState(() =>
    normalizeProfiles(readProfileCache(initialScope) || []),
  );
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileError, setProfileError] = useState("");
  const activeScopeRef = useRef(initialScope);
  const inFlightRef = useRef(null);

  const fetchProfiles = useCallback(async () => {
    const scope = getAuthCacheScope();
    if (!scope) {
      activeScopeRef.current = "";
      setProfiles([]);
      setLoadingProfiles(false);
      setProfileError("");
      return [];
    }

    if (activeScopeRef.current !== scope) {
      activeScopeRef.current = scope;
      setProfiles(normalizeProfiles(readProfileCache(scope) || []));
      setProfileError("");
    }
    if (inFlightRef.current?.scope === scope) return inFlightRef.current.promise;

    const requestState = { scope, promise: null };
    inFlightRef.current = requestState;
    setLoadingProfiles(true);
    setProfileError("");

    requestState.promise = (async () => {
      try {
        const response = await apiRequest({ url: `${API_BASE}profile/list/`, method: "GET" });
        const raw = response?.data;
        const list = Array.isArray(raw) ? raw
          : Array.isArray(raw?.results) ? raw.results
            : Array.isArray(raw?.profiles) ? raw.profiles : [];
        const normalized = normalizeProfiles(list);

        if (activeScopeRef.current === scope && getAuthCacheScope() === scope) {
          // Store raw API objects, never token-bearing resolved image URLs.
          writeProfileCache(scope, list);
          setProfiles(normalized);
        }
        return normalized;
      } catch (err) {
        if (activeScopeRef.current === scope && getAuthCacheScope() === scope) {
          if (err?.response?.status === 401 || err?.response?.status === 403) {
            setProfiles([]);
            setProfileError("");
          } else {
            // Preserve the previous successful snapshot during network failures.
            setProfileError(friendlyErr(err, "Failed to fetch profiles"));
          }
        }
        return [];
      } finally {
        if (inFlightRef.current === requestState) {
          inFlightRef.current = null;
          setLoadingProfiles(false);
        }
      }
    })();
    return requestState.promise;
  }, []);

  useEffect(() => {
    void fetchProfiles();
    const onAuth = () => { void fetchProfiles(); };
    const onStorage = (event) => {
      if (!event || event.key === "access" || event.key === "refresh") void fetchProfiles();
    };
    window.addEventListener("auth-changed", onAuth);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("auth-changed", onAuth);
      window.removeEventListener("storage", onStorage);
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
