// FILE: mobile/src/navigation/useLabel.ts
// Vocabulary layer (Doc 3 §6). Resolves every user-facing business noun
// through the manifest labels, falling back to the registry's defaultLabel.

import { useCallback } from 'react';
import { MODULES } from './registry';
import type { AppManifest } from './types';

/**
 * Returns a t(key) function that resolves business nouns through the manifest.
 *
 * Resolution order:
 * 1. manifest.labels[key]  (industry-specific override)
 * 2. MODULES[key].defaultLabel  (registry default)
 * 3. key  (raw key as last resort)
 *
 * Usage:
 *   const t = useLabel(manifest);
 *   t('bookings')  // → "Reservations" (resort) | "Jobs" (cleaning) | "Bookings" (travel)
 */
export function useLabel(manifest: AppManifest | null) {
  return useCallback(
    (key: string): string => {
      // 1. Check manifest labels
      if (manifest?.labels?.[key]) {
        return manifest.labels[key];
      }
      // 2. Check registry default
      if (MODULES[key]?.defaultLabel) {
        return MODULES[key].defaultLabel;
      }
      // 3. Capitalize the key itself
      return key.charAt(0).toUpperCase() + key.slice(1);
    },
    [manifest?.labels]
  );
}

/**
 * Non-hook version for use outside components (e.g. navigation options).
 */
export function resolveLabel(
  key: string,
  labels: Record<string, string> | null | undefined,
): string {
  if (labels?.[key]) return labels[key];
  if (MODULES[key]?.defaultLabel) return MODULES[key].defaultLabel;
  return key.charAt(0).toUpperCase() + key.slice(1);
}
