// FILE: /frontend/src/hooks/useBranding.js
// Resolves and applies white-label branding (theme color, title, favicon).

import { useEffect } from 'react';
import { brandingApi } from '../api/brandingApi';
import { useBrandingStore, DEFAULT_BRANDING } from '../store/brandingStore';

/**
 * Applies a branding payload to the document: CSS variables consumed by the
 * shell, the page title, the theme-color meta, and the favicon.
 */
export function applyBranding(branding) {
  const b = { ...DEFAULT_BRANDING, ...(branding || {}) };
  const root = document.documentElement;
  root.style.setProperty('--brand-primary', b.primaryColor);
  root.style.setProperty('--brand-accent', b.accentColor || b.primaryColor);

  if (b.brandName) document.title = b.brandName;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && b.primaryColor) themeMeta.setAttribute('content', b.primaryColor);

  if (b.faviconUrl) {
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
      link.setAttribute('href', b.faviconUrl);
    });
  }
  return b;
}

/**
 * Boot hook — paints persisted branding immediately, then refreshes it from the
 * server for the current host. Call once at the app root.
 */
export function useBranding() {
  const branding = useBrandingStore((s) => s.branding);
  const setBranding = useBrandingStore((s) => s.setBranding);

  useEffect(() => {
    // Paint whatever we have cached right away to avoid a default-brand flash.
    applyBranding(branding);

    let cancelled = false;
    brandingApi
      .get()
      .then((res) => {
        if (cancelled) return;
        const resolved = res?.data || DEFAULT_BRANDING;
        setBranding(resolved);
        applyBranding(resolved);
      })
      .catch(() => {
        // Network/branding failure: keep cached/default branding.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return branding;
}
