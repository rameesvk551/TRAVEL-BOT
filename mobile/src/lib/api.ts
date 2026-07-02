// FILE: mobile/src/lib/api.ts
// Axios client with JWT bearer + automatic token refresh.
// Mirrors the web pattern from frontend/src/api/client.js but uses MMKV
// instead of localStorage and navigates via a ref instead of window.location.

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import { getString, setString, remove, StorageKeys } from './storage';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Expo env vars must be prefixed with EXPO_PUBLIC_
const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// Navigation ref — set by RootNavigator so we can redirect to Login on auth failure
// ---------------------------------------------------------------------------

let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getString(StorageKeys.ACCESS_TOKEN);

  // Remove Content-Type for FormData (multipart uploads)
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — auto-refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getString(StorageKeys.REFRESH_TOKEN);
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
        );
        const { accessToken: newAccess, refreshToken: newRefresh } = data.data;

        setString(StorageKeys.ACCESS_TOKEN, newAccess);
        if (newRefresh) setString(StorageKeys.REFRESH_TOKEN, newRefresh);
        processQueue(null, newAccess);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Clear auth state
        remove(StorageKeys.ACCESS_TOKEN);
        remove(StorageKeys.REFRESH_TOKEN);
        remove(StorageKeys.AGENT);
        remove(StorageKeys.AGENCY);
        // Navigate to login
        onAuthFailure?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ---------------------------------------------------------------------------
// Auth API (matches frontend/src/api/authApi.js)
// ---------------------------------------------------------------------------

export const authApi = {
  register: (data: Record<string, unknown>) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  forgotPassword: (data: { email: string }) =>
    api.post('/auth/forgot-password', data).then((r) => r.data),
  resetPassword: (data: { token: string; password: string }) =>
    api.post('/auth/reset-password', data).then((r) => r.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () =>
    api.get('/auth/me').then((r) => r.data),
  appManifest: () =>
    api.get('/me/app-manifest').then((r) => r.data),
};
