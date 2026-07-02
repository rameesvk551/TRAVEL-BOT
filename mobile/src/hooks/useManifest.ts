// FILE: mobile/src/hooks/useManifest.ts
// Fetches, caches, and revalidates the app manifest from GET /api/me/app-manifest.
// Applies tenant accent/logo to the theme. Cache-first, revalidate in background.

import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../lib/api';
import { getObject, setObject, StorageKeys } from '../lib/storage';
import { useTheme } from '../theme/ThemeProvider';
import type { AppManifest } from '../navigation/types';

const MANIFEST_QUERY_KEY = ['app-manifest'];

/**
 * Hook to manage the app manifest lifecycle:
 * 1. On mount: load cached manifest from MMKV instantly
 * 2. In background: fetch fresh manifest from API
 * 3. If changed: update cache, apply branding, optionally notify
 */
export function useManifest() {
  const { setTenantBranding } = useTheme();
  const queryClient = useQueryClient();
  const prevManifestRef = useRef<AppManifest | null>(null);

  // Seed React Query cache with MMKV cached data (instant)
  const cachedManifest = getObject<AppManifest>(StorageKeys.MANIFEST);

  const {
    data: manifest,
    isLoading,
    error,
    refetch,
  } = useQuery<AppManifest>({
    queryKey: MANIFEST_QUERY_KEY,
    queryFn: async () => {
      const response = await authApi.appManifest();
      return response.data as AppManifest;
    },
    initialData: cachedManifest ?? undefined,
    staleTime: 5 * 60 * 1000,       // 5 min — revalidate in background
    gcTime: 30 * 60 * 1000,         // 30 min cache
    refetchOnMount: 'always',        // Always revalidate on mount
  });

  // Apply branding whenever manifest changes
  useEffect(() => {
    if (!manifest) return;

    // Cache to MMKV
    setObject(StorageKeys.MANIFEST, manifest);

    // Apply tenant accent + logo to theme
    setTenantBranding(
      manifest.tenant.accent,
      manifest.tenant.logo,
    );

    // Detect if modules/tabs changed (for "workspace updated" toast)
    const prev = prevManifestRef.current;
    if (prev) {
      const tabsChanged = JSON.stringify(prev.tabs) !== JSON.stringify(manifest.tabs);
      const modulesChanged = JSON.stringify(prev.modules) !== JSON.stringify(manifest.modules);
      if (tabsChanged || modulesChanged) {
        // TODO: Show "Your workspace was updated" toast when Toast component is wired
      }
    }
    prevManifestRef.current = manifest;
  }, [manifest, setTenantBranding]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MANIFEST_QUERY_KEY });
  }, [queryClient]);

  return {
    manifest: manifest ?? null,
    isLoading: isLoading && !cachedManifest,
    error,
    refetch,
    invalidate,
  };
}

/**
 * Clear the cached manifest (on logout).
 */
export function clearManifestCache() {
  import('../lib/storage').then(({ remove }) => {
    remove(StorageKeys.MANIFEST);
  });
}
