// FILE: mobile/src/ui/ChartWrapper.tsx
import React from 'react';
import { View, StyleProp, ViewStyle, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface ChartWrapperProps {
  children?: React.ReactNode;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ChartWrapper({ children, height = 200, style }: ChartWrapperProps) {
  const { theme } = useTheme();

  return (
    <View style={[{ height, width: '100%', justifyContent: 'center', alignItems: 'center' }, style]}>
      {/* 
        In Phase 0, we're not fully integrating victory-native yet to avoid native dependencies issues,
        so we provide a placeholder container that injects the right styles.
      */}
      {children ? children : (
        <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
          Chart area (victory-native wrapper)
        </Text>
      )}
    </View>
  );
}
