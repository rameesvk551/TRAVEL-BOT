// FILE: mobile/src/ui/ProgressBar.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';

export interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
}

export function ProgressBar({ progress, height = 4 }: ProgressBarProps) {
  const { theme } = useTheme();
  const widthPercent = useSharedValue(0);

  useEffect(() => {
    widthPercent.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 300,
      easing: Easing.out(Easing.ease),
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthPercent.value * 100}%` as DimensionValue,
  }));

  return (
    <View style={[styles.track, { backgroundColor: theme.colors.bg.fill, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: theme.colors.accent, height, borderRadius: height / 2 },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
