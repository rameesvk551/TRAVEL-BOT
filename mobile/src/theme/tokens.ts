// FILE: mobile/src/theme/tokens.ts
// Design System §3 — Complete token set. Every color, size, radius, and duration
// in the app references a token from here. No raw hex or pixel literals in screens.

import { TextStyle, ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// §3.1 Color — Semantic tokens (light + dark)
// ---------------------------------------------------------------------------

export interface ColorTokens {
  bg: {
    canvas: string;
    surface: string;
    surfaceRaised: string;
    fill: string;
    scrim: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    onAccent: string;
  };
  accent: string;
  accentPressed: string;
  accentTint: string;
  border: {
    hairline: string;
  };
  status: {
    success: string;
    warning: string;
    danger: string;
    info: string;
    neutral: string;
  };
  chart: ChartColorTokens;
}

// §3.1a Chart color — four jobs, four ramps.
//
// These are NOT free-form. Every ramp below was checked with the dataviz
// validator (lightness band, chroma floor, Machado-2009 CVD separation under
// protanopia/deuteranopia, and contrast vs the chart surface) and passes all
// six checks in BOTH modes. Dark is a selected set of steps, not a flip of
// light. Do not hand-edit a hex here — re-run the validator and snap to a
// passing step, or the palette silently stops being colorblind-safe.
//
//   categorical — identity (which series). Fixed order, assigned in sequence,
//                 NEVER cycled. A 9th series folds into "Other".
//   ordinal     — position in a sequence (pipeline stage, tier). One hue,
//                 monotone lightness.
//   status      — reserved meaning; never reused as "series 4".
//   grid/axis   — recessive; must never compete with the marks.
export interface ChartColorTokens {
  categorical: readonly string[];
  ordinal: readonly string[];
  grid: string;
  axis: string;
  /** Fill under a single-series area/line. Pair with `accent` for the stroke. */
  areaFill: string;
  /** The de-emphasis gray for the "emphasis" form: one series colored, rest muted. */
  muted: string;
}

export const lightColors: ColorTokens = {
  bg: {
    canvas: '#F2F2F7',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    fill: '#EFEFF4',
    scrim: 'rgba(0,0,0,0.4)',
  },
  text: {
    primary: '#1C1C1E',
    secondary: 'rgba(60,60,67,0.6)',
    tertiary: 'rgba(60,60,67,0.3)',
    onAccent: '#FFFFFF',
  },
  accent: '#007AFF',
  accentPressed: '#0060DF',
  accentTint: 'rgba(0,122,255,0.08)',
  border: {
    hairline: 'rgba(60,60,67,0.12)',
  },
  status: {
    success: '#34C759',
    warning: '#FF9F0A',
    danger: '#FF3B30',
    info: '#5E5CE6',
    neutral: '#8E8E93',
  },
  chart: {
    // Validated light: lightness band PASS · chroma floor PASS ·
    // worst adjacent CVD ΔE 19.5 (protan) PASS · contrast vs surface PASS.
    categorical: ['#007AFF', '#C86A00', '#AF52DE', '#0E9C90', '#FF2D55', '#5856D6', '#1B7F3B', '#0F7FB0'],
    // Validated ordinal light: monotone L · adjacent ΔL ≥ 0.06 · light end 2.16:1.
    ordinal: ['#79B0FF', '#4693FF', '#007AFF', '#0057CC', '#003B7A'],
    grid: 'rgba(60,60,67,0.10)',
    axis: 'rgba(60,60,67,0.45)',
    areaFill: 'rgba(0,122,255,0.16)',
    muted: 'rgba(60,60,67,0.20)',
  },
};

export const darkColors: ColorTokens = {
  bg: {
    canvas: '#000000',
    surface: '#1C1C1E',
    surfaceRaised: '#2C2C2E',
    fill: '#2C2C2E',
    scrim: 'rgba(0,0,0,0.6)',
  },
  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(235,235,245,0.6)',
    tertiary: 'rgba(235,235,245,0.3)',
    onAccent: '#FFFFFF',
  },
  accent: '#0A84FF',
  accentPressed: '#3D9BFF',
  accentTint: 'rgba(10,132,255,0.14)',
  border: {
    hairline: 'rgba(84,84,88,0.6)',
  },
  status: {
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    info: '#5E5CE6',
    neutral: '#8E8E93',
  },
  chart: {
    // Validated dark against surface #1C1C1E: lightness band PASS · chroma floor
    // PASS · worst adjacent CVD ΔE 20.7 (protan) PASS · contrast PASS.
    categorical: ['#0A84FF', '#C97A00', '#BF5AF2', '#2AA79E', '#FF375F', '#5E5CE6', '#3FA65C', '#2F9FD0'],
    // Validated ordinal dark: monotone L · adjacent ΔL ≥ 0.06 · light end 2.47:1.
    ordinal: ['#0F5AA8', '#0A6ACC', '#0A84FF', '#4DA6FF', '#8CC6FF'],
    grid: 'rgba(235,235,245,0.12)',
    axis: 'rgba(235,235,245,0.45)',
    areaFill: 'rgba(10,132,255,0.22)',
    muted: 'rgba(235,235,245,0.22)',
  },
};

// ---------------------------------------------------------------------------
// §3.2 Typography — SF Pro / System font, Dynamic Type ready
// ---------------------------------------------------------------------------

export interface TypographyStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  letterSpacing: number;
}

export interface TypographyTokens {
  largeTitle: TypographyStyle;
  title1: TypographyStyle;
  title2: TypographyStyle;
  title3: TypographyStyle;
  headline: TypographyStyle;
  body: TypographyStyle;
  callout: TypographyStyle;
  subhead: TypographyStyle;
  footnote: TypographyStyle;
  caption: TypographyStyle;
  caption2: TypographyStyle;
}

export const typography: TypographyTokens = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.4 },
  title1:     { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.3 },
  title2:     { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0 },
  title3:     { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0 },
  headline:   { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.4 },
  body:       { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.4 },
  callout:    { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.3 },
  subhead:    { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.2 },
  footnote:   { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.1 },
  caption:    { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2:   { fontSize: 11, lineHeight: 13, fontWeight: '600', letterSpacing: 0.5 },
};

// ---------------------------------------------------------------------------
// §3.3 Spacing — 4pt base grid
// ---------------------------------------------------------------------------

export interface SpacingTokens {
  s1: number;   // 4
  s2: number;   // 8
  s3: number;   // 12
  s4: number;   // 16
  s5: number;   // 20
  s6: number;   // 24
  s8: number;   // 32
  s10: number;  // 40
  s12: number;  // 48
}

export const spacing: SpacingTokens = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
};

// Screen gutter: space.4 (16pt) left/right
export const SCREEN_GUTTER = spacing.s4;
// Card padding: 16pt
export const CARD_PADDING = spacing.s4;
// Card-to-card gap: 12pt
export const CARD_GAP = spacing.s3;
// Section gap: 24-32pt
export const SECTION_GAP = spacing.s6;
// Min tap target: 44×44pt
export const MIN_TAP_TARGET = 44;

// ---------------------------------------------------------------------------
// §3.4 Radius
// ---------------------------------------------------------------------------

export interface RadiusTokens {
  sm: number;   // 8
  md: number;   // 12
  lg: number;   // 16
  xl: number;   // 20
  full: number; // 999 (pill)
}

export const radius: RadiusTokens = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

// ---------------------------------------------------------------------------
// §3.4 Elevation — dark-friendly, subtle shadows
// ---------------------------------------------------------------------------

export interface ElevationStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number; // Android
}

export interface ElevationTokens {
  e0: ElevationStyle;
  e1: ElevationStyle;
  e2: ElevationStyle;
  e3: ElevationStyle;
}

export const lightElevation: ElevationTokens = {
  e0: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  e1: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  e2: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  e3: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 6 },
};

export const darkElevation: ElevationTokens = {
  e0: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  e1: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.30, shadowRadius: 8, elevation: 2 },
  e2: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.44, shadowRadius: 24, elevation: 8 },
  e3: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.50, shadowRadius: 16, elevation: 6 },
};

// ---------------------------------------------------------------------------
// §6 Motion — spring-based, quick, meaningful
// ---------------------------------------------------------------------------

export interface MotionTokens {
  sheetPresent: { damping: number; stiffness: number };
  pressScale: { toValue: number; damping: number; stiffness: number };
  listItemEnter: { fadeMs: number; risePoints: number; staggerMs: number };
  valueCount: { durationMs: number };
  chartDraw: { durationMs: number };
  skeletonShimmer: { durationMs: number };
  tabSwitch: { durationMs: number };
}

export const motion: MotionTokens = {
  sheetPresent: { damping: 30, stiffness: 320 },
  pressScale: { toValue: 0.96, damping: 15, stiffness: 400 },
  listItemEnter: { fadeMs: 200, risePoints: 8, staggerMs: 20 },
  valueCount: { durationMs: 400 },
  chartDraw: { durationMs: 400 },
  skeletonShimmer: { durationMs: 1200 },
  tabSwitch: { durationMs: 120 },
};

// ---------------------------------------------------------------------------
// §3.5 Iconography — defaults
// ---------------------------------------------------------------------------

export const ICON_SIZE = {
  default: 24,
  dense: 20,
  tabBar: 28,
} as const;

export const ICON_STROKE_WIDTH = 2;
