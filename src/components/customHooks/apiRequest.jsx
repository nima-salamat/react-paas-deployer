import axios from 'axios';

const REFRESH_URL = 'http://127.0.0.1:8000/auth/api/login/token/refresh/';

const apiRequest = async ({ method = 'GET', url, data = {}, params = {} }) => {
  const accessToken = localStorage.getItem('access');

  try {
    // build headers only if token exists
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    const response = await axios({
      method,
      url,
      data,
      params,
      headers,
    });

    return response;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return handleRefreshTokenAndRetry({ method, url, data, params });
    } else {
      console.error('API request failed', error);
      throw error;
    }
  }
};

const handleRefreshTokenAndRetry = async ({ method, url, data, params }) => {
  try {
    const refreshToken = localStorage.getItem('refresh');
    if (!refreshToken) throw new Error('No refresh token');

    const refreshResponse = await axios.post(REFRESH_URL, { refresh: refreshToken });

    if (refreshResponse.status === 200) {
      localStorage.setItem('access', refreshResponse.data.access);
      if (refreshResponse.data.refresh) {
        localStorage.setItem('refresh', refreshResponse.data.refresh);
      }

      const headers = { 'Content-Type': 'application/json' };
      if (refreshResponse.data.access) headers['Authorization'] = `Bearer ${refreshResponse.data.access}`;

      const retryResponse = await axios({
        method,
        url,
        data,
        params,
        headers,
      });

      return retryResponse;
    }
  } catch (refreshError) {
    console.error('Refresh token failed', refreshError);
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    // redirect to login page
    window.location.href = '/login';
    throw refreshError;
  }
};

export default apiRequest;
