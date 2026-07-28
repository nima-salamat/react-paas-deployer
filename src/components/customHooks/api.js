import axios from 'axios';

const REFRESH_URL = `https://${import.meta.env.VITE_API_BASE}/auth/api/login/token/refresh/`;


export async function apiRequest(request) {
  const { method = 'GET', url, data = {}, params = {} } = typeof request === 'string' ? { url: request } : request || {};
  const accessToken = localStorage.getItem('access');

  try {
    const headers = {};
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    if (!(data instanceof FormData)) headers['Content-Type'] = 'application/json';

    const response = await axios({ method, url, data, params, headers });
    return response;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return handleRefreshTokenAndRetry({ method, url, data, params });
    }
    console.error('API request failed', error);
    throw error;
  }
}

async function handleRefreshTokenAndRetry({ method, url, data, params }) {
  const refreshToken = localStorage.getItem('refresh');
  if (!refreshToken) throw new Error('No refresh token');

  try {
    const refreshResponse = await axios.post(REFRESH_URL, { refresh: refreshToken });
    if (refreshResponse.status === 200) {
      localStorage.setItem('access', refreshResponse.data.access);
      if (refreshResponse.data.refresh) {
        localStorage.setItem('refresh', refreshResponse.data.refresh);
      }
      const headers = { 'Content-Type': 'application/json' };
      if (refreshResponse.data.access) headers['Authorization'] = `Bearer ${refreshResponse.data.access}`;
      const retryResponse = await axios({ method, url, data, params, headers });
      return retryResponse;
    } else {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
      throw new Error('Refresh token invalid');
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      window.location.href = '/login';
    } else {
      console.error('Network error or server unreachable:', error.message);
    }
    throw error;
  }
}

export default apiRequest;
