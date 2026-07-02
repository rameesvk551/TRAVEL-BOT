// FILE: /frontend/src/hooks/useAuthInit.js
// DEPS: react, axios

import { useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/authApi';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Restores the persisted session once on app boot.
 *
 * It always attempts a refresh, because the refresh token may live ONLY in the
 * HttpOnly `rt` cookie (sent via withCredentials) — for example on Safari/Mac &
 * iOS standalone PWAs, which evict localStorage after ~7 days of inactivity. The
 * server rotates the token and slides the 30-day window forward on every open.
 *
 * The refresh uses raw axios (not the shared client) so a failure does NOT trip
 * the 401 interceptor's hard redirect — that would loop on the login page. On
 * failure we just clear any stale tokens and let the route guards send the user
 * to login. Either way we flip `bootstrapped` so the guards stop showing the loader.
 */
export function useAuthInit() {
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);

  useEffect(() => {
    if (useAuthStore.getState().bootstrapped) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const { refreshToken } = useAuthStore.getState();
        const { data } = await axios.post(
          `${API_BASE}/auth/refresh`,
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        );
        if (!cancelled && data?.data?.accessToken) {
          useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
        }
      } catch {
        // No valid session (no cookie / expired / revoked). If we don't have a
        // usable access token either, clear so the guards route to login.
        if (!useAuthStore.getState().accessToken) {
          useAuthStore.getState().logout();
        }
      }

      // Best-effort profile refresh so permissions/branding stay current.
      try {
        if (useAuthStore.getState().accessToken) {
          const res = await authApi.me();
          const profile = res?.data;
          if (!cancelled && profile) {
            const { agency, ...agent } = profile;
            useAuthStore.getState().updateAgent(agent);
            if (agency) useAuthStore.getState().updateAgency(agency);
          }
        }
      } catch {
        // The shared client's 401 interceptor handles refresh/logout here.
      }

      if (!cancelled) setBootstrapped(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [setBootstrapped]);
}
