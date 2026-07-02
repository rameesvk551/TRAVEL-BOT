// FILE: mobile/src/ui/SearchBar.tsx
import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Search, X } from 'lucide-react-native';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search', onFocus, onBlur }: SearchBarProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleClear = () => {
    onChangeText('');
  };

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.bg.fill,
            borderRadius: theme.radius.sm,
          },
        ]}
      >
        <Search color={theme.colors.text.tertiary} size={20} style={{ marginLeft: theme.spacing.s2 }} />
        <TextInput
          style={[
            theme.typography.body,
            { color: theme.colors.text.primary, height: 36, flex: 1, paddingHorizontal: theme.spacing.s2 },
          ]}
          placeholderTextColor={theme.colors.text.tertiary}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {value.length > 0 && (
          <Pressable onPress={handleClear} style={{ padding: theme.spacing.s2 }}>
            <X color={theme.colors.text.secondary} size={16} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
