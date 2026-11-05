import axios from "axios";
import { clearStoredAuth, expireStoredAuth, getSessionBoundAccessToken } from "./authSession.js";
import { normalizeLanguage, translateText } from "../../i18n/messages.js";

/**
 * Build refresh URL consistently with the rest of the app.
 * Backend route (auth urls):  api/login/token/refresh   (no trailing slash in urls.py)
 * Mounted under /auth/  →  /auth/api/login/token/refresh
 *
 * Django APPEND_SLASH can break POST body on redirect, so we prefer the
 * exact path and only fall back to the slashed variant once.
 */
const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");

function getPreferredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem("paas-language")) || "en-us";
  } catch {
    return "en-us";
  }
}

function localizeApiPayload(value, key = "") {
  if (getPreferredLanguage() !== "fa" || value == null) return value;
  if (typeof value === "string") {
    return ["message", "detail", "error", "errors", "non_field_errors"].includes(key)
      ? translateText(value, "fa")
      : value;
  }
  if (Array.isArray(value)) return value.map((item) => localizeApiPayload(item, key));
  if (typeof value !== "object") return value;

  const localized = { ...value };
  for (const [childKey, childValue] of Object.entries(localized)) {
    if (["message", "detail", "error", "errors", "non_field_errors"].includes(childKey)) {
      localized[childKey] = localizeApiPayload(childValue, childKey);
    } else if (key === "errors") {
      localized[childKey] = localizeApiPayload(childValue, "error");
    }
  }
  return localized;
}

function localizeApiError(error) {
  if (error?.response?.data) {
    error.response.data = localizeApiPayload(error.response.data, "errors");
  }
  if (error?.message && getPreferredLanguage() === "fa") {
    error.message = translateText(error.message, "fa");
  }
  return error;
}
const REFRESH_URLS = [
  `${API_HOST}/auth/api/login/token/refresh`,
  `${API_HOST}/auth/api/login/token/refresh/`,
];

function notifyNetworkError(error) {
  const status = error?.response?.status;
  const transient =
    !error?.response ||
    error?.code === "ERR_NETWORK" ||
    error?.code === "ECONNABORTED" ||
    [502, 503, 504].includes(status);

  if (!transient) return;

  try {
    window.dispatchEvent(
      new CustomEvent("app-network-error", {
        detail: {
          status: status || 0,
          code: error?.code || "",
        },
      }),
    );
  } catch {
    /* ignore */
  }
}

function notifyNetworkRecovered() {
  try {
    window.dispatchEvent(new Event("app-network-recovered"));
  } catch {
    /* ignore */
  }
}

function isAccessTokenExpired(token, leewayMs = 5000) {
  if (!token) return true;
  try {
    const part = token.split(".")[1];
    if (!part) return true;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    const exp = Number(payload?.exp || 0) * 1000;
    return !exp || exp <= Date.now() + leewayMs;
  } catch {
    return false;
  }
}

// Single-flight refresh: many parallel 401s must share one refresh call
let refreshPromise = null;

function clearAuthAndRedirect(reason = "refresh_rejected") {
  expireStoredAuth(localStorage, reason);
}

function buildHeaders(accessToken, data) {
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  headers["Accept-Language"] = getPreferredLanguage() === "fa" ? "fa" : "en-US";
  // Let the browser set multipart boundary for FormData
  if (!(data instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function postRefresh(refreshToken) {
  let lastError;
  for (const url of REFRESH_URLS) {
    try {
      const resp = await axios.post(
        url,
        { refresh: refreshToken },
        {
          headers: {
            "Content-Type": "application/json",
            "Accept-Language": getPreferredLanguage() === "fa" ? "fa" : "en-US",
          },
          timeout: 5000,
          // Do not send expired access token to refresh endpoint
          validateStatus: (s) => s >= 200 && s < 300,
        }
      );
      return resp;
    } catch (err) {
      lastError = err;
      const status = err?.response?.status;
      // 404/405 → try alternate trailing-slash form; 401 → token really dead
      if (status === 401 || status === 403) {
        throw err;
      }
      // continue to next URL candidate
    }
  }
  throw lastError || new Error("Refresh failed");
}

/**
 * Refresh access (and optionally rotate refresh). Concurrent callers await the same promise.
 */
function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = localStorage.getItem("refresh");
    if (!refreshToken) {
      clearAuthAndRedirect("refresh_token_missing");
      throw new Error("No refresh token");
    }

    try {
      const refreshResponse = await postRefresh(refreshToken);
      const access = refreshResponse?.data?.access;
      if (!access) {
        clearAuthAndRedirect("refresh_response_invalid");
        throw new Error("Refresh response missing access token");
      }

      localStorage.setItem("access", access);
      notifyNetworkRecovered();
      // SimpleJWT only returns a new refresh when ROTATE_REFRESH_TOKENS=True
      if (refreshResponse.data.refresh) {
        localStorage.setItem("refresh", refreshResponse.data.refresh);
      }

      try {
        window.dispatchEvent(new Event("auth-changed"));
      } catch {
        /* ignore */
      }

      return access;
    } catch (err) {
      notifyNetworkError(err);
      const status = err?.response?.status;
      // Only an explicit auth rejection proves that the refresh credential
      // is invalid. Network/timeout/5xx failures are transient and MUST NOT
      // destroy the locally stored session.
      if (status === 401 || status === 403) {
        clearAuthAndRedirect("refresh_token_rejected");
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const apiRequest = async ({ method = "GET", url, data = {}, params = {}, onUploadProgress, responseType }) => {
  const storedAccessToken = localStorage.getItem("access");
  let accessToken = getSessionBoundAccessToken(localStorage);

  if (storedAccessToken && !accessToken) {
    throw new Error("Authentication session is required");
  }

  // Avoid an avoidable first 401 when a normal access token has already
  // expired. Refresh before protected requests; the existing 401 path still
  // handles revoked/invalid tokens that cannot be detected locally.
  if (accessToken && isAccessTokenExpired(accessToken)) {
    try {
      accessToken = await refreshAccessToken();
    } catch (error) {
      throw error;
    }
  }

  try {
    const response = await axios({
      method,
      url,
      data,
      params,
      headers: buildHeaders(accessToken, data),
      onUploadProgress,
      ...(responseType ? { responseType } : {}),
    });
    response.data = localizeApiPayload(response.data);

    try {
      window.dispatchEvent(new Event("app-network-recovered"));
    } catch {
      /* ignore */
    }

    return response;
  } catch (caughtError) {
    const error = localizeApiError(caughtError);
    const status = error?.response?.status;

    // Only attempt refresh on authenticated-endpoint failures
    if (status === 401) {
      // If the failing call was the refresh endpoint itself, give up
      const failedUrl = String(url || "");
      if (failedUrl.includes("/login/token/refresh")) {
        clearAuthAndRedirect("refresh_endpoint_rejected");
        throw error;
      }

      try {
        const newAccess = await refreshAccessToken();
        const retryResponse = await axios({
          method,
          url,
          data,
          params,
          headers: buildHeaders(newAccess, data),
          onUploadProgress,
          ...(responseType ? { responseType } : {}),
        });
        retryResponse.data = localizeApiPayload(retryResponse.data);
        notifyNetworkRecovered();
        return retryResponse;
      } catch (refreshErr) {
        // refreshAccessToken already redirected on hard auth failure
        console.error("Token refresh failed", refreshErr);
        throw refreshErr;
      }
    }

    notifyNetworkError(error);
    throw error;
  }
};

export default apiRequest;
export { refreshAccessToken, clearAuthAndRedirect };
