// FILE: mobile/src/ui/Input.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<TextInput, InputProps>(
  ({ label, error, style, ...props }, ref) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    return (
      <View style={{ width: '100%', marginBottom: theme.spacing.s3 }}>
        {label && (
          <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: theme.spacing.s1 }]}>
            {label}
          </Text>
        )}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.colors.bg.fill,
              borderRadius: theme.radius.md,
              borderColor: error ? theme.colors.status.danger : isFocused ? theme.colors.accent : 'transparent',
              borderWidth: 1,
            },
          ]}
        >
          <TextInput
            ref={ref}
            style={[
              theme.typography.body,
              { color: theme.colors.text.primary, height: 48, paddingHorizontal: theme.spacing.s4 },
              style,
            ]}
            placeholderTextColor={theme.colors.text.tertiary}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
        </View>
        {error && (
          <Text style={[theme.typography.caption, { color: theme.colors.status.danger, marginTop: theme.spacing.s1 }]}>
            {error}
          </Text>
        )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  inputContainer: {
    width: '100%',
    overflow: 'hidden',
  },
});
