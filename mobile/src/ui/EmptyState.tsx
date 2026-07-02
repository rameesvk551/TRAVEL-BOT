// FILE: mobile/src/ui/EmptyState.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { LucideIcon } from 'lucide-react-native';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <Icon color={theme.colors.text.tertiary} size={48} style={{ marginBottom: theme.spacing.s4 }} />
      <Text style={[theme.typography.title3, { color: theme.colors.text.primary, marginBottom: theme.spacing.s2, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.text.secondary, textAlign: 'center', marginBottom: theme.spacing.s6 }]}>
        {message}
      </Text>
      {actionLabel && onAction && (
        <Button variant="primary" label={actionLabel} onPress={onAction} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
});
