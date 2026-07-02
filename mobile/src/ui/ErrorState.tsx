// FILE: mobile/src/ui/ErrorState.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react-native';

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.status.danger + '10', borderRadius: theme.radius.md, padding: theme.spacing.s4 },
      ]}
    >
      <AlertTriangle color={theme.colors.status.danger} size={24} style={{ marginBottom: theme.spacing.s2 }} />
      <Text style={[theme.typography.body, { color: theme.colors.text.primary, marginBottom: theme.spacing.s4 }]}>
        {message}
      </Text>
      <Button variant="destructive" label="Retry" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    width: '100%',
  },
});
