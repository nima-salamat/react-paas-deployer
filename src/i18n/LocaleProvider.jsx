import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import apiRequest from "../components/customHooks/apiRequest.jsx";
import { decodeJwtPayload, getSessionBoundAccessToken } from "../components/customHooks/authSession.js";
import { LANGUAGE_OPTIONS, normalizeLanguage, translateText } from "./messages.js";

const LANGUAGE_STORAGE_KEY = "paas-language";
const EXPLICIT_LANGUAGE_KEY_PREFIX = "paas-language-explicit:";
const LANGUAGE_API_URL = "https://" + import.meta.env.VITE_API_BASE + "/api/users/user/language/";
const LocaleContext = createContext(null);

function readStoredLanguage() {
  if (typeof window === "undefined") return "en-us";
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) || "en-us";
  } catch {
    return "en-us";
  }
}

function getAuthenticatedAccountId() {
  try {
    const token = getSessionBoundAccessToken(window.localStorage);
    const payload = decodeJwtPayload(token);
    const accountId = payload?.user_id ?? payload?.user;
    return accountId == null ? "" : String(accountId);
  } catch {
    return "";
  }
}

export function LocaleProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage);
  const syncRequestRef = useRef(new Map());

  const applyLanguage = useCallback((nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    if (!normalized) return false;
    setLanguageState(normalized);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      window.dispatchEvent(new CustomEvent("app-language-changed", { detail: { language: normalized } }));
    } catch {
      // The in-memory preference remains active when storage is unavailable.
    }
    return true;
  }, []);

  const setLanguage = useCallback(async (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    if (!normalized) return;

    applyLanguage(normalized);
    const accountId = getAuthenticatedAccountId();
    if (!accountId) return;
    try {
      window.localStorage.setItem(`${EXPLICIT_LANGUAGE_KEY_PREFIX}${accountId}`, normalized);
    } catch {
      // The API update still proceeds when local storage is unavailable.
    }
    try {
      await apiRequest({
        method: "PATCH",
        url: LANGUAGE_API_URL,
        data: { language: normalized },
      });
    } catch (error) {
      // Keep the local choice usable when the API is temporarily unavailable.
      console.warn("Could not sync language preference to the account.", error);
    }
  }, [applyLanguage]);

  const syncAccountLanguage = useCallback(async () => {
    const accountId = getAuthenticatedAccountId();
    if (!accountId) return null;
    const pending = syncRequestRef.current.get(accountId);
    if (pending) return pending;

    const request = (async () => {
      try {
        let explicitLanguage = null;
        try {
          explicitLanguage = normalizeLanguage(
            window.localStorage.getItem(`${EXPLICIT_LANGUAGE_KEY_PREFIX}${accountId}`),
          );
        } catch {
          // Fall back to the server preference when local storage is unavailable.
        }

        if (explicitLanguage) {
          // The saved value belongs to this account; never reuse the global
          // language currently selected by another account in this browser.
          if (getAuthenticatedAccountId() === accountId) applyLanguage(explicitLanguage);
          await apiRequest({
            method: "PATCH",
            url: LANGUAGE_API_URL,
            data: { language: explicitLanguage },
          });
          return explicitLanguage;
        }

        const response = await apiRequest({ method: "GET", url: LANGUAGE_API_URL });
        const serverLanguage = normalizeLanguage(response?.data?.language);
        // Do not let a slow response for the previous account overwrite the
        // language after the user switches accounts in another tab.
        if (getAuthenticatedAccountId() === accountId && serverLanguage) applyLanguage(serverLanguage);
        return serverLanguage;
      } catch {
        return null;
      } finally {
        syncRequestRef.current.delete(accountId);
      }
    })();

    syncRequestRef.current.set(accountId, request);
    return request;
  }, [applyLanguage]);

  useEffect(() => {
    syncAccountLanguage();
    const handleAuthChanged = () => syncAccountLanguage();
    const handleStorage = (event) => {
      if (event.key !== LANGUAGE_STORAGE_KEY) return;
      const next = normalizeLanguage(event.newValue);
      if (next) setLanguageState(next);
    };
    window.addEventListener("auth-changed", handleAuthChanged);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("auth-changed", handleAuthChanged);
      window.removeEventListener("storage", handleStorage);
    };
  }, [syncAccountLanguage]);

  const value = useMemo(() => ({
    language,
    isRTL: language === "fa",
    languageOptions: LANGUAGE_OPTIONS,
    setLanguage,
    t: (message) => translateText(message, language),
  }), [language, setLanguage]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context) return context;
  return {
    language: "en-us",
    isRTL: false,
    languageOptions: LANGUAGE_OPTIONS,
    setLanguage: async () => {},
    t: (message) => String(message ?? "")
  };
}
