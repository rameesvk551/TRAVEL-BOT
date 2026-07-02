// FILE: /frontend/src/store/authStore.js
// DEPS: zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Auth store — persists tokens and agent/agency info to localStorage.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      agent: null,
      agency: null,
      accessToken: null,
      refreshToken: null,
      // Runtime-only flag (not persisted): true once the stored session has been
      // validated/refreshed on app boot. Guards wait on this to avoid flashing login.
      bootstrapped: false,

      setBootstrapped: (value) => set({ bootstrapped: value }),

      setAuth: (data) =>
        set({
          agent: data.agent,
          agency: data.agency,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateAgent: (updates) =>
        set((state) => ({
          agent: state.agent ? { ...state.agent, ...updates } : null,
        })),

      updateAgency: (updates) =>
        set((state) => ({
          agency: state.agency ? { ...state.agency, ...updates } : null,
        })),

      logout: () =>
        set({
          agent: null,
          agency: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: 'travelbot-auth',
      partialize: (state) => ({
        agent: state.agent,
        agency: state.agency,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
