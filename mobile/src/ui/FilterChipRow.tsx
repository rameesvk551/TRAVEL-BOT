// FILE: mobile/src/ui/FilterChipRow.tsx
import React from 'react';
import { ScrollView, View, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Chip } from './Chip';
import { SlidersHorizontal } from 'lucide-react-native';
import * as haptics from '../lib/haptics';

export interface FilterChipRowProps {
  chips: { key: string; label: string; selected: boolean }[];
  onToggle: (key: string) => void;
  onFilterPress?: () => void;
}

export function FilterChipRow({ chips, onToggle, onFilterPress }: FilterChipRowProps) {
  const { theme } = useTheme();

  const handleFilterPress = () => {
    haptics.light();
    onFilterPress?.();
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: theme.spacing.s4, gap: theme.spacing.s2 }}
    >
      {onFilterPress && (
        <Pressable
          onPress={handleFilterPress}
          style={{
            backgroundColor: theme.colors.bg.fill,
            borderRadius: theme.radius.full,
            width: 32,
            height: 32,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <SlidersHorizontal color={theme.colors.text.secondary} size={16} />
        </Pressable>
      )}
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          label={chip.label}
          selected={chip.selected}
          onPress={() => onToggle(chip.key)}
        />
      ))}
    </ScrollView>
  );
}
