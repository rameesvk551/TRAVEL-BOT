// FILE: mobile/src/lib/storage.ts
// MMKV wrapper — fast key-value storage for auth tokens, manifest cache,
// theme preference, and pinned hub modules.

import { MMKV } from 'react-native-mmkv';

// @ts-ignore
export const storage = new MMKV({ id: 'travelbot-mobile' });

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export const StorageKeys = {
  ACCESS_TOKEN: 'auth.accessToken',
  REFRESH_TOKEN: 'auth.refreshToken',
  AGENT: 'auth.agent',
  AGENCY: 'auth.agency',
  MANIFEST: 'manifest',
  THEME_MODE: 'theme.mode',
  PINNED_MODULES: 'hub.pinned',
  BIOMETRIC_ENABLED: 'auth.biometric',
} as const;

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function getObject<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setObject(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function getBoolean(key: string): boolean {
  return storage.getBoolean(key) ?? false;
}

export function setBoolean(key: string, value: boolean): void {
  storage.set(key, value);
}

export function remove(key: string): void {
  storage.delete(key);
}

export function clearAll(): void {
  storage.clearAll();
}
