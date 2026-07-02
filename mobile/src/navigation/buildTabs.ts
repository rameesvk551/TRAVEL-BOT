// FILE: mobile/src/navigation/buildTabs.ts
// Tab selection algorithm (Doc 3 §5). Deterministic: Home first, More last,
// up to 3 middle tabs from the manifest, backfilled by priority.

import type { AppManifest } from './types';

// Backfill priority — used only when the manifest/profile doesn't yield 3 middle tabs
const TAB_BACKFILL_PRIORITY = [
  'inbox', 'bookings', 'reservations', 'jobs', 'leads', 'campaigns',
  'customers', 'payments', 'packages', 'analytics', 'accounting',
];

/**
 * Build the ordered list of tab keys from the manifest.
 *
 * Guarantees:
 * - Always 3–5 tabs
 * - Home first, More last
 * - Never a tab for a module the tenant can't access
 * - Deterministic across launches
 */
export function buildTabs(manifest: AppManifest): string[] {
  const enabledSet = new Set(manifest.modules);
  const candidates = manifest.tabs ?? [];

  const middle: string[] = [];
  const push = (key: string) => {
    if (
      key !== 'home' &&
      key !== 'more' &&
      enabledSet.has(key) &&
      !middle.includes(key)
    ) {
      middle.push(key);
    }
  };

  // Use manifest tabs first
  candidates.forEach(push);

  // Backfill if we don't have 3 middle tabs
  if (middle.length < 3) {
    TAB_BACKFILL_PRIORITY.forEach(push);
  }

  return ['home', ...middle.slice(0, 3), 'more'];
}
