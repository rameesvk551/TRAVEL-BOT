// FILE: mobile/src/ui/Badge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  label?: string;
  variant: BadgeVariant;
  dot?: boolean;
}

export function Badge({ label, variant, dot }: BadgeProps) {
  const { theme } = useTheme();

  const getColor = () => {
    switch (variant) {
      case 'success': return theme.colors.status.success;
      case 'warning': return theme.colors.status.warning;
      case 'danger': return theme.colors.status.danger;
      case 'info': return theme.colors.status.info;
      case 'neutral': return theme.colors.status.neutral;
    }
  };

  const color = getColor();
  const bgColor = color + '20'; // ~12% opacity roughly

  if (dot) {
    return (
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: color,
        }}
      />
    );
  }

  return (
    <View
      style={{
        backgroundColor: bgColor,
        paddingHorizontal: theme.spacing.s2,
        paddingVertical: 2,
        borderRadius: theme.radius.sm,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[theme.typography.caption2, { color, fontWeight: '600' }]}>
        {label}
      </Text>
    </View>
  );
}
