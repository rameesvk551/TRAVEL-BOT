// FILE: mobile/src/ui/Chip.tsx
import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { LucideIcon } from 'lucide-react-native';
import * as haptics from '../lib/haptics';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
}

export function Chip({ label, selected, onPress, icon: Icon }: ChipProps) {
  const { theme } = useTheme();

  const handlePress = () => {
    if (onPress) {
      haptics.light();
      onPress();
    }
  };

  const bgColor = selected ? theme.colors.accentTint : theme.colors.bg.fill;
  const textColor = selected ? theme.colors.accent : theme.colors.text.secondary;

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.s3,
          paddingVertical: theme.spacing.s1 + 2,
        },
      ]}
    >
      {Icon && <Icon color={textColor} size={16} style={{ marginRight: theme.spacing.s1 }} />}
      <Text style={[theme.typography.subhead, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});
