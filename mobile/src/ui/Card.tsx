// FILE: mobile/src/ui/Card.tsx
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const { theme } = useTheme();

  const cardStyle = [
    {
      backgroundColor: theme.colors.bg.surface,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.s4,
      ...theme.elevation.e1,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={cardStyle}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}
