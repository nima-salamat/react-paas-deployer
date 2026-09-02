import axios from "axios";

/**
 * Build refresh URL consistently with the rest of the app.
 * Backend route (auth urls):  api/login/token/refresh   (no trailing slash in urls.py)
 * Mounted under /auth/  →  /auth/api/login/token/refresh
 *
 * Django APPEND_SLASH can break POST body on redirect, so we prefer the
 * exact path and only fall back to the slashed variant once.
 */
const API_HOST = `https://${import.meta.env.VITE_API_BASE}`.replace(/\/+$/, "");
const REFRESH_URLS = [
  `${API_HOST}/auth/api/login/token/refresh`,
  `${API_HOST}/auth/api/login/token/refresh/`,
];

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

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    window.dispatchEvent(new Event("auth-changed"));
    window.dispatchEvent(new Event("auth"));
  } catch {
    /* ignore */
  }
  // Avoid redirect loop if already on auth page
  const path = window.location?.pathname || "";
  if (!path.includes("signin") && !path.includes("signup") && !path.includes("login")) {
    window.location.href = "/signin_or_signup";
  }
}

function buildHeaders(accessToken, data) {
  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
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
          headers: { "Content-Type": "application/json" },
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
      clearAuthAndRedirect();
      throw new Error("No refresh token");
    }

    try {
      const refreshResponse = await postRefresh(refreshToken);
      const access = refreshResponse?.data?.access;
      if (!access) {
        clearAuthAndRedirect();
        throw new Error("Refresh response missing access token");
      }

      localStorage.setItem("access", access);
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
      const status = err?.response?.status;
      // Only an explicit auth rejection proves that the refresh credential
      // is invalid. Network/timeout/5xx failures are transient and MUST NOT
      // destroy the locally stored session.
      if (status === 401 || status === 403) {
        clearAuthAndRedirect();
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const apiRequest = async ({ method = "GET", url, data = {}, params = {}, onUploadProgress, responseType }) => {
  let accessToken = localStorage.getItem("access");

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
    return response;
  } catch (error) {
    const status = error?.response?.status;

    // Only attempt refresh on authenticated-endpoint failures
    if (status === 401) {
      // If the failing call was the refresh endpoint itself, give up
      const failedUrl = String(url || "");
      if (failedUrl.includes("/login/token/refresh")) {
        clearAuthAndRedirect();
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
        return retryResponse;
      } catch (refreshErr) {
        // refreshAccessToken already redirected on hard auth failure
        console.error("Token refresh failed", refreshErr);
        throw refreshErr;
      }
    }

    throw error;
  }
};

export default apiRequest;
export { refreshAccessToken, clearAuthAndRedirect };
