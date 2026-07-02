// FILE: mobile/src/theme/ThemeProvider.tsx
// Follows system appearance with manual override. Exposes useTheme().
// Accepts tenant accent + logo from the manifest to customize the theme (§8).

import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { Theme, lightTheme, darkTheme, applyAccentOverride } from './theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  tenantLogo: string | null;
  setTenantBranding: (accent: string | null, logo: string | null) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: React.ReactNode;
  /** Persisted mode from MMKV — pass in from storage on mount */
  initialMode?: ThemeMode;
  /** Callback when mode changes — persist to MMKV */
  onModeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({ children, initialMode = 'system', onModeChange }: ThemeProviderProps) {
  const systemScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>(initialMode);
  const [accentOverride, setAccentOverride] = useState<string | null>(null);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    onModeChange?.(mode);
  }, [onModeChange]);

  const setTenantBranding = useCallback((accent: string | null, logo: string | null) => {
    setAccentOverride(accent);
    setTenantLogo(logo);
  }, []);

  const theme = useMemo(() => {
    // Resolve which palette to use
    const isDark = themeMode === 'system'
      ? systemScheme === 'dark'
      : themeMode === 'dark';

    const baseTheme = isDark ? darkTheme : lightTheme;

    // Apply tenant accent if provided (§8 white-label hook)
    return applyAccentOverride(baseTheme, accentOverride);
  }, [themeMode, systemScheme, accentOverride]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    themeMode,
    setThemeMode,
    tenantLogo,
    setTenantBranding,
  }), [theme, themeMode, setThemeMode, tenantLogo, setTenantBranding]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

// Convenience: just the theme object
export function useThemeTokens(): Theme {
  return useTheme().theme;
}
