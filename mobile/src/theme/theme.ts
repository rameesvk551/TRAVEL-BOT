// FILE: mobile/src/theme/theme.ts
// Combines all token layers into a single Theme object with light/dark variants.

import {
  ColorTokens, TypographyTokens, SpacingTokens, RadiusTokens,
  ElevationTokens, MotionTokens,
  lightColors, darkColors, typography, spacing, radius,
  lightElevation, darkElevation, motion,
} from './tokens';

// ---------------------------------------------------------------------------
// Theme type — the single object every component consumes via useTheme()
// ---------------------------------------------------------------------------

export interface Theme {
  dark: boolean;
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  radius: RadiusTokens;
  elevation: ElevationTokens;
  motion: MotionTokens;
}

// ---------------------------------------------------------------------------
// Light + dark theme objects
// ---------------------------------------------------------------------------

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  typography,
  spacing,
  radius,
  elevation: lightElevation,
  motion,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  typography,
  spacing,
  radius,
  elevation: darkElevation,
  motion,
};

// ---------------------------------------------------------------------------
// Helper: create a theme with a tenant accent override (§8 white-label hook)
// ---------------------------------------------------------------------------

export function applyAccentOverride(theme: Theme, accent: string | null): Theme {
  if (!accent) return theme;
  return {
    ...theme,
    colors: {
      ...theme.colors,
      accent,
      // Derive pressed and tint from the override accent
      accentPressed: accent, // In production, darken/lighten; for now use the accent itself
      accentTint: theme.dark
        ? `${accent}24` // 14% opacity in dark
        : `${accent}14`, // 8% opacity in light
    },
  };
}
