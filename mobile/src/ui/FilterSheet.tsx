// FILE: mobile/src/ui/FilterSheet.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../theme/ThemeProvider';
import { Check } from 'lucide-react-native';
import { Button } from './Button';
import { Grabber } from './Grabber';

export interface FilterOption {
  key: string;
  label: string;
  selected: boolean;
}

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: FilterOption[];
  onApply: (selectedKeys: string[]) => void;
  onToggle: (key: string) => void;
  onReset: () => void;
  resultCount?: number;
}

export const FilterSheet = React.forwardRef<BottomSheet, FilterSheetProps>(
  ({ visible, onClose, title, options, onApply, onToggle, onReset, resultCount }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['90%'], []);

    const handleSheetChanges = (index: number) => {
      if (index === -1) {
        onClose();
      }
    };

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    return (
      <BottomSheet
        ref={ref}
        index={visible ? 0 : -1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleComponent={Grabber}
        backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
      >
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.s4 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.s4, marginTop: theme.spacing.s2 }}>
            <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>{title}</Text>
            <Pressable onPress={onReset} hitSlop={10}>
              <Text style={[theme.typography.body, { color: theme.colors.accent }]}>Reset</Text>
            </Pressable>
          </View>

          {/* Options */}
          <BottomSheetScrollView>
            <View style={{ gap: theme.spacing.s1 }}>
              {options.map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => onToggle(opt.key)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: theme.spacing.s3,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.colors.border.hairline,
                  }}
                >
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                    {opt.label}
                  </Text>
                  {opt.selected && <Check color={theme.colors.accent} size={20} />}
                </Pressable>
              ))}
            </View>
          </BottomSheetScrollView>

          {/* Footer CTA */}
          <View style={{ paddingVertical: theme.spacing.s4 }}>
            <Button
              variant="primary"
              fullWidth
              label={resultCount !== undefined ? `Show ${resultCount} results` : 'Apply'}
              onPress={() => onApply(options.filter((o) => o.selected).map((o) => o.key))}
            />
          </View>
        </View>
      </BottomSheet>
    );
  }
);
