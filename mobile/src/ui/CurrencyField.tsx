// FILE: mobile/src/ui/CurrencyField.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface CurrencyFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
}

export function CurrencyField({ label, value, onChangeText, placeholder, error }: CurrencyFieldProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Group thousands on blur for Indian currency format (e.g. 1,00,000)
  const formatOnBlur = () => {
    setIsFocused(false);
    if (!value) return;
    const numeric = value.replace(/[^0-9]/g, '');
    if (numeric) {
      const formatted = Number(numeric).toLocaleString('en-IN');
      onChangeText(formatted);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Remove commas when editing
    onChangeText(value.replace(/,/g, ''));
  };

  return (
    <View style={{ width: '100%', marginBottom: theme.spacing.s3 }}>
      {label && (
        <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: theme.spacing.s1 }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.bg.fill,
            borderRadius: theme.radius.md,
            borderColor: error ? theme.colors.status.danger : isFocused ? theme.colors.accent : 'transparent',
            borderWidth: 1,
            paddingHorizontal: theme.spacing.s4,
          },
        ]}
      >
        <Text style={[theme.typography.body, { color: value ? theme.colors.text.primary : theme.colors.text.tertiary, marginRight: 4 }]}>
          ₹
        </Text>
        <TextInput
          style={[
            theme.typography.body,
            { color: theme.colors.text.primary, height: 48, flex: 1, fontVariant: ['tabular-nums'] },
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={formatOnBlur}
          keyboardType="numeric"
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
});
