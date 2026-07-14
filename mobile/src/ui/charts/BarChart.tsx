// FILE: mobile/src/ui/charts/BarChart.tsx
// Magnitude comparison → horizontal bars (long category names read better
// horizontally on a phone). Always zero-baselined. Every bar carries a direct
// value label, so identity/magnitude is never color-alone.
//
// `variant` picks the color job:
//   'nominal'  — categories with no inherent order (lead sources, agents).
//                Every bar takes the SAME hue; bar length already encodes value,
//                so spending the identity channel on it would be noise.
//   'ordinal'  — categories WITH an order (pipeline stages, tiers). One hue,
//                monotone lightness ramp, so the order is visible in the color.
//   'status'   — bars that mean good/warning/bad. Reserved status tokens.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

export interface BarDatum {
  label: string;
  value: number;
  /** Only read when variant='status'. */
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  onPress?: () => void;
}

export interface BarChartProps {
  data: BarDatum[];
  variant?: 'nominal' | 'ordinal' | 'status';
  formatValue?: (v: number) => string;
  /** Emphasis form: color this one bar, mute the rest. Index into `data`. */
  emphasizeIndex?: number;
}

const ROW_HEIGHT = 36;
const TRACK_HEIGHT = 10;

export function BarChart({
  data,
  variant = 'nominal',
  formatValue = (v) => String(v),
  emphasizeIndex,
}: BarChartProps) {
  const { theme } = useTheme();
  const s = theme.spacing;

  if (data.length === 0) {
    return (
      <View style={{ paddingVertical: s.s6, alignItems: 'center' }}>
        <Text style={[theme.typography.footnote, { color: theme.colors.text.tertiary }]}>No data yet</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  const colorFor = (d: BarDatum, i: number): string => {
    if (emphasizeIndex != null) {
      return i === emphasizeIndex ? theme.colors.accent : theme.colors.chart.muted;
    }
    if (variant === 'status') {
      return theme.colors.status[d.status ?? 'neutral'];
    }
    if (variant === 'ordinal') {
      const ramp = theme.colors.chart.ordinal;
      // Spread N categories across the ramp so first→last reads light→dark.
      const idx = data.length === 1 ? 0 : Math.round((i / (data.length - 1)) * (ramp.length - 1));
      return ramp[idx];
    }
    // Nominal: ONE hue for every bar — bar length already encodes the value, so
    // coloring by value would spend the identity channel re-saying it. It's the
    // brand accent (white-label tenants override it), which is safe here because
    // every bar carries a direct value label — the relief channel that makes a
    // sub-3:1 tenant accent still readable.
    return theme.colors.accent;
  };

  return (
    <View accessibilityRole="summary">
      {data.map((d, i) => {
        const pct = Math.max(d.value / max, 0);
        const Row = d.onPress ? Pressable : View;

        return (
          <Row
            key={`${d.label}-${i}`}
            onPress={d.onPress}
            accessibilityRole={d.onPress ? 'button' : undefined}
            accessibilityLabel={`${d.label}: ${formatValue(d.value)}`}
            style={{ height: ROW_HEIGHT, justifyContent: 'center' }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s.s1 }}>
              <Text
                numberOfLines={1}
                style={[theme.typography.subhead, { flex: 1, color: theme.colors.text.secondary }]}
              >
                {d.label}
              </Text>
              {/* Value in text ink, never the series color. Tabular so digits align. */}
              <Text
                style={[
                  theme.typography.subhead,
                  {
                    color: theme.colors.text.primary,
                    fontWeight: '600',
                    fontVariant: ['tabular-nums'],
                    marginLeft: s.s2,
                  },
                ]}
              >
                {formatValue(d.value)}
              </Text>
            </View>

            <View
              style={{
                height: TRACK_HEIGHT,
                borderRadius: TRACK_HEIGHT / 2,
                backgroundColor: theme.colors.bg.fill,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct * 100}%`,
                  height: '100%',
                  minWidth: d.value > 0 ? 4 : 0, // a nonzero value never renders as nothing
                  borderRadius: TRACK_HEIGHT / 2, // 4px+ rounded data-end
                  backgroundColor: colorFor(d, i),
                }}
              />
            </View>
          </Row>
        );
      })}
    </View>
  );
}
