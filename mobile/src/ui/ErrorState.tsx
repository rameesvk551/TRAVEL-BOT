// FILE: mobile/src/ui/ErrorState.tsx
// The failure surface. Now that no screen silently falls back to mock data, this
// is what the user actually sees when the server is unreachable — so it has to
// say what broke and offer a way out, not just flash a red box.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react-native';

export interface ErrorStateProps {
  /** Short statement of what failed. Defaults to a generic but honest line. */
  title?: string;
  /** The server's own message, when there is one. */
  message: string;
  onRetry?: () => void;
  /** Renders inline (compact, in-flow) rather than as a full-height centered state. */
  inline?: boolean;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, inline }: ErrorStateProps) {
  const { theme } = useTheme();
  const s = theme.spacing;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${message}`}
      style={[
        styles.container,
        inline ? styles.inline : styles.block,
        {
          padding: s.s4,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.bg.surface,
        },
      ]}
    >
      {/* Icon + text, never color alone — the failure still reads under CVD. */}
      <AlertTriangle
        color={theme.colors.status.danger}
        size={inline ? 20 : 28}
        style={{ marginBottom: s.s2 }}
      />

      <Text
        style={[
          theme.typography.headline,
          { color: theme.colors.text.primary, textAlign: inline ? 'left' : 'center' },
        ]}
      >
        {title}
      </Text>

      <Text
        style={[
          theme.typography.subhead,
          {
            color: theme.colors.text.secondary,
            textAlign: inline ? 'left' : 'center',
            marginTop: s.s1,
          },
        ]}
      >
        {message}
      </Text>

      {onRetry && (
        <View style={{ marginTop: s.s4 }}>
          {/* Retrying isn't destructive — a red button here reads as "delete". */}
          <Button variant="tinted" label="Try again" onPress={onRetry} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  block: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    alignItems: 'flex-start',
  },
});
