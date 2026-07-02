// FILE: mobile/src/ui/Field.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface FieldProps {
  label: string;
  children: React.ReactNode;
  error?: string;
}

export function Field({ label, children, error }: FieldProps) {
  const { theme } = useTheme();

  return (
    <View style={{ width: '100%', marginBottom: theme.spacing.s3 }}>
      <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: theme.spacing.s1 }]}>
        {label}
      </Text>
      {children}
      {error && (
        <Text style={[theme.typography.caption, { color: theme.colors.status.danger, marginTop: theme.spacing.s1 }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
