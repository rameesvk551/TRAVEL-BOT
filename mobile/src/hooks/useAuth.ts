// FILE: mobile/src/hooks/useAuth.ts
// Auth mutations: login, signup, logout, forgot/reset password.
// Mirrors the web's useAuth.js but stores tokens in MMKV.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import {
  setString, setObject, remove, getString, StorageKeys,
} from '../lib/storage';
import { clearManifestCache } from './useManifest';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  agencyName: string;
  agencyPhone: string;
  agencyEmail: string;
  whatsappNumber: string;
  agentName: string;
  agentEmail: string;
  agentPassword: string;
  industry: string;
}

interface AuthResult {
  agent: Record<string, unknown>;
  agency: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Save auth result to MMKV
// ---------------------------------------------------------------------------

function persistAuth(result: AuthResult) {
  setString(StorageKeys.ACCESS_TOKEN, result.accessToken);
  setString(StorageKeys.REFRESH_TOKEN, result.refreshToken);
  setObject(StorageKeys.AGENT, result.agent);
  setObject(StorageKeys.AGENCY, result.agency);
}

function clearAuth() {
  remove(StorageKeys.ACCESS_TOKEN);
  remove(StorageKeys.REFRESH_TOKEN);
  remove(StorageKeys.AGENT);
  remove(StorageKeys.AGENCY);
  clearManifestCache();
}

// ---------------------------------------------------------------------------
// Auth state reader (synchronous — from MMKV, not async)
// ---------------------------------------------------------------------------

export function getAuthState() {
  const accessToken = getString(StorageKeys.ACCESS_TOKEN);
  const agent = (() => {
    const raw = getString(StorageKeys.AGENT);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  })();
  const agency = (() => {
    const raw = getString(StorageKeys.AGENCY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  })();

  return {
    isAuthenticated: Boolean(accessToken),
    accessToken: accessToken ?? null,
    agent,
    agency,
  };
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useLogin(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginData) => authApi.login(data),
    onSuccess: (response) => {
      persistAuth(response.data as AuthResult);
      queryClient.clear(); // Clear stale data from previous session
      onSuccess?.();
    },
  });
}

export function useRegister(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterData) => authApi.register(data as any),
    onSuccess: (response) => {
      persistAuth(response.data as AuthResult);
      queryClient.clear();
      onSuccess?.();
    },
  });
}

export function useLogout(onSuccess?: () => void) {
  return useMutation({
    mutationFn: async () => {
      const refreshToken = getString(StorageKeys.REFRESH_TOKEN);
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // Logout should succeed even if the API call fails
        }
      }
    },
    onSettled: () => {
      clearAuth();
      onSuccess?.();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: { email: string }) => authApi.forgotPassword(data),
  });
}

export function useResetPassword(onSuccess?: () => void) {
  return useMutation({
    mutationFn: (data: { token: string; password: string }) =>
      authApi.resetPassword(data),
    onSuccess: () => {
      onSuccess?.();
    },
  });
}

/**
 * Try to restore the session on app boot by refreshing the access token.
 * Returns true if the session was restored, false otherwise.
 */
export async function tryRestoreSession(): Promise<boolean> {
  const refreshToken = getString(StorageKeys.REFRESH_TOKEN);
  if (!refreshToken) return false;

  try {
    const response = await authApi.refresh(refreshToken);
    const { accessToken, refreshToken: newRefresh } = response.data;
    setString(StorageKeys.ACCESS_TOKEN, accessToken);
    if (newRefresh) setString(StorageKeys.REFRESH_TOKEN, newRefresh);
    return true;
  } catch {
    clearAuth();
    return false;
  }
}
