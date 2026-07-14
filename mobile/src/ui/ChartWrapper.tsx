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
    // Sized to include the chart's own axis band, so axis labels are never
    // clipped into a nested scroll. Charts render at full width inside it.
    <View style={[{ height, width: '100%', justifyContent: 'center' }, style]}>
      {children ?? (
        <Text
          style={[
            theme.typography.footnote,
            { color: theme.colors.text.tertiary, textAlign: 'center' },
          ]}
        >
          No data yet
        </Text>
      )}
    </View>
  );
}
