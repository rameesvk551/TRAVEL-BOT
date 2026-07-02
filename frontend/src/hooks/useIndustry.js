// FILE: /frontend/src/hooks/useIndustry.js
//
// Reads the logged-in tenant's industry from the auth store and exposes
// presentation helpers. Backend data is unchanged — this only affects wording
// and which modules are shown.

import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  getIndustryProfile,
  navLabel,
  term,
  industryModuleVisible,
  TRAVEL_INDUSTRY,
} from '../config/industryProfiles';

export function useIndustry() {
  const agency = useAuthStore((s) => s.agency);
  const industry = agency?.industry || TRAVEL_INDUSTRY;
  const sidebarPreferences = agency?.sidebarPreferences;

  return useMemo(() => {
    const profile = getIndustryProfile(industry);
    return {
      industry,
      profile,
      /** Sidebar label for a route path (falls back to the supplied default). */
      navLabel: (path, fallback) => navLabel(industry, path, fallback),
      /** Body term for a semantic key, e.g. t('bookings', 'Bookings'). */
      t: (key, fallback) => term(industry, key, fallback),
      /** Whether a module path is shown by default for this industry. */
      moduleVisible: (path) => industryModuleVisible(industry, path),
      /** Whether a module path is enabled after platform-admin tenant controls. */
      moduleEnabled: (path) => {
        if (Array.isArray(sidebarPreferences) && sidebarPreferences.length > 0) {
          return sidebarPreferences.includes(path);
        }
        return industryModuleVisible(industry, path);
      },
    };
  }, [industry, sidebarPreferences]);
}
