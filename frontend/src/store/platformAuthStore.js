import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePlatformAuthStore = create(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (data) =>
        set({
          admin: data.admin,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        }),

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      logout: () =>
        set({
          admin: null,
          accessToken: null,
          refreshToken: null,
        }),
    }),
    {
      name: 'travelbot-platform-auth',
      partialize: (state) => ({
        admin: state.admin,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
