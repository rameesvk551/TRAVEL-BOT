// FILE: mobile/src/ui/SectionHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import * as haptics from '../lib/haptics';

export interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  const { theme } = useTheme();

  const handleAction = () => {
    if (onAction) {
      haptics.light();
      onAction();
    }
  };

  return (
    <View style={[styles.container, { marginBottom: theme.spacing.s2, marginTop: theme.spacing.s4 }]}>
      <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary, textTransform: 'uppercase' }]}>
        {title}
      </Text>
      {action && onAction && (
        <Pressable onPress={handleAction} hitSlop={10}>
          <Text style={[theme.typography.footnote, { color: theme.colors.accent, fontWeight: '600' }]}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    paddingHorizontal: 4,
  },
});
