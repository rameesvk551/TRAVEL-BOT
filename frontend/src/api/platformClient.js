import axios from 'axios';
import { usePlatformAuthStore } from '../store/platformAuthStore';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const platformClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

platformClient.interceptors.request.use((config) => {
  const token = usePlatformAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

platformClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isAuthEndpoint = originalRequest.url?.includes('/platform/auth/login') || originalRequest.url?.includes('/platform/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return platformClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = usePlatformAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No platform refresh token');

        const { data } = await axios.post(`${API_BASE}/platform/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: nextRefresh } = data.data;
        usePlatformAuthStore.getState().setTokens(accessToken, nextRefresh);
        processQueue(null, accessToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return platformClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        usePlatformAuthStore.getState().logout();
        window.location.href = '/platform/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default platformClient;
