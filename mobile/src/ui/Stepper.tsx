// FILE: mobile/src/ui/Stepper.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Minus, Plus } from 'lucide-react-native';
import * as haptics from '../lib/haptics';

export interface StepperProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

export function Stepper({ label, value, onChange, min = 0, max = 999 }: StepperProps) {
  const { theme } = useTheme();

  const handleMinus = () => {
    if (value > min) {
      haptics.light();
      onChange(value - 1);
    }
  };

  const handlePlus = () => {
    if (value < max) {
      haptics.light();
      onChange(value + 1);
    }
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
          {label}
        </Text>
      )}
      <View style={styles.controls}>
        <Pressable
          onPress={handleMinus}
          disabled={value <= min}
          style={[styles.btn, { backgroundColor: theme.colors.bg.fill }]}
        >
          <Minus color={value <= min ? theme.colors.text.tertiary : theme.colors.accent} size={20} />
        </Pressable>
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, width: 40, textAlign: 'center' }]}>
          {value}
        </Text>
        <Pressable
          onPress={handlePlus}
          disabled={value >= max}
          style={[styles.btn, { backgroundColor: theme.colors.bg.fill }]}
        >
          <Plus color={value >= max ? theme.colors.text.tertiary : theme.colors.accent} size={20} />
        </Pressable>
      </View>
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
