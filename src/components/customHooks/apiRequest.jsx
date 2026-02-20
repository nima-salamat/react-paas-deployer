import axios from 'axios';

const REFRESH_URL = 'http://127.0.0.1:8000/auth/api/login/token/refresh/';

const apiRequest = async ({ method = 'GET', url, data = {}, params = {} }) => {
  const accessToken = localStorage.getItem('access');

  try {
    const headers = {};

    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

    if (!(data instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

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
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        window.location.href = '/login';
      }
    } else {
      console.error('Network error or server unreachable:', error.message);
    }
    throw error;
  }
};

export default apiRequest;
