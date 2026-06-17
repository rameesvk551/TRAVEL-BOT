// FILE: /frontend/src/store/brandingStore.js
// DEPS: zustand
// Holds the resolved white-label branding for the current host/partner.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const DEFAULT_BRANDING = {
  partnerId: null,
  brandName: 'Wayon',
  logoUrl: null,
  faviconUrl: '/wayon-logo.svg?v=20260506',
  primaryColor: '#00A884',
  accentColor: '#141414',
  loginTagline: 'Access your premium travel concierge dashboard.',
  loginImageUrl: '/login-hero.jpg',
  supportEmail: null,
  supportUrl: null,
  isWhiteLabel: false,
};

/**
 * Branding store — persisted so the app paints the correct brand instantly on
 * reload (before the network request resolves), avoiding a Wayon flash.
 */
export const useBrandingStore = create(
  persist(
    (set) => ({
      branding: DEFAULT_BRANDING,
      loaded: false,
      setBranding: (branding) =>
        set({ branding: { ...DEFAULT_BRANDING, ...(branding || {}) }, loaded: true }),
      reset: () => set({ branding: DEFAULT_BRANDING, loaded: false }),
    }),
    {
      name: 'travelbot-branding',
      partialize: (state) => ({ branding: state.branding }),
    }
  )
);
