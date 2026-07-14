// FILE: mobile/src/ui/Card.tsx
import React from 'react';
import { View, StyleProp, ViewStyle, Pressable, AccessibilityRole } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Card({
  children,
  style,
  onPress,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
}: CardProps) {
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
      <Pressable
        onPress={onPress}
        // A tappable card is a button; without this it announces as plain text
        // and VoiceOver users never learn it can be activated.
        accessibilityRole={accessibilityRole ?? 'button'}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={cardStyle}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}
