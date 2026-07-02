// FILE: mobile/src/ui/Switch.tsx
import React from 'react';
import { View, Text, Switch as RNSwitch, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label?: string;
}

export function Switch({ value, onValueChange, label }: SwitchProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
          {label}
        </Text>
      )}
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.bg.fill, true: theme.colors.accent }}
        thumbColor={theme.colors.bg.surface}
        ios_backgroundColor={theme.colors.bg.fill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
});
