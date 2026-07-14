// FILE: mobile/src/ui/charts/Sparkline.tsx
// The trend half of a stat tile. No axes, no labels, no legend — the tile's
// value and delta carry the numbers; this only carries the shape.

import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeProvider';

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Defaults to the accent. Pass a status token when the trend itself is good/bad. */
  color?: string;
}

export function Sparkline({ values, width = 72, height = 24, color }: SparklineProps) {
  const { theme } = useTheme();
  const stroke = color ?? theme.colors.accent;

  const d = useMemo(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const step = width / (values.length - 1);

    return values
      .map((v, i) => {
        const x = i * step;
        // Inset by 2px top/bottom so the 2px stroke never clips at the edges.
        const y = 2 + (height - 4) * (1 - (v - min) / span);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }, [values, width, height]);

  if (!d) return <View style={{ width, height }} />;

  return (
    // Decorative: the stat tile already states the value and delta in text.
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Path d={d} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
