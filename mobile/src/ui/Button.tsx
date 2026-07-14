// FILE: mobile/src/ui/Button.tsx
import React from 'react';
import { Pressable, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import * as haptics from '../lib/haptics';
import { LucideIcon } from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive' | 'icon' | 'fab';

export interface ButtonProps {
  variant: ButtonVariant;
  label?: string;
  icon?: LucideIcon;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: any;
  /**
   * Required for icon-only buttons ('icon' and 'fab'): with no `label` there is
   * no text for a screen reader to fall back on, so without this the control is
   * announced as an unlabeled button.
   */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  variant,
  label,
  icon: Icon,
  onPress,
  disabled,
  loading,
  fullWidth,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(theme.motion.pressScale.toValue, {
      damping: theme.motion.pressScale.damping,
      stiffness: theme.motion.pressScale.stiffness,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: theme.motion.pressScale.damping,
      stiffness: theme.motion.pressScale.stiffness,
    });
  };

  const handlePress = () => {
    if (disabled || loading) return;
    if (variant === 'primary' || variant === 'destructive' || variant === 'fab') {
      haptics.medium();
    } else {
      haptics.light();
    }
    onPress?.();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getStyle = () => {
    const base: any = {
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.5 : 1,
    };
    if (fullWidth) base.width = '100%';

    switch (variant) {
      case 'primary':
        return {
          ...base,
          backgroundColor: theme.colors.accent,
          height: 50,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.s4,
        };
      case 'secondary':
        return {
          ...base,
          backgroundColor: theme.colors.bg.fill,
          height: 50,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.s4,
        };
      case 'tinted':
        return {
          ...base,
          backgroundColor: theme.colors.accentTint,
          height: 44,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.s4,
        };
      case 'plain':
        return { ...base, padding: theme.spacing.s2 };
      case 'destructive':
        return {
          ...base,
          backgroundColor: theme.colors.status.danger,
          height: 50,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.s4,
        };
      case 'icon':
        return {
          ...base,
          width: 44,
          height: 44,
          borderRadius: theme.radius.full,
          backgroundColor: 'transparent',
        };
      case 'fab':
        return {
          ...base,
          position: 'absolute',
          bottom: theme.spacing.s6,
          right: theme.spacing.s4,
          width: 56,
          height: 56,
          borderRadius: theme.radius.full,
          backgroundColor: theme.colors.accent,
          ...theme.elevation.e3,
        };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'destructive':
      case 'fab':
        return theme.colors.text.onAccent;
      case 'secondary':
        return theme.colors.text.primary;
      case 'tinted':
      case 'plain':
        return theme.colors.accent;
      case 'icon':
        return theme.colors.text.secondary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return theme.typography.headline;
      case 'secondary':
      case 'tinted':
      case 'plain':
        return theme.typography.headline;
      default:
        return theme.typography.body;
    }
  };

  const textColor = getTextColor();
  const textStyle = getTextStyle();

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      // Announces "dimmed" when disabled and "busy" while a mutation is in
      // flight, so the loading spinner isn't a purely visual signal.
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[getStyle(), style, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {Icon && <Icon color={textColor} size={variant === 'icon' ? 24 : 20} />}
          {label && (
            <Text style={[textStyle, { color: textColor, marginLeft: Icon && variant !== 'icon' ? theme.spacing.s2 : 0 }]}>
              {label}
            </Text>
          )}
        </>
      )}
    </AnimatedPressable>
  );
}
