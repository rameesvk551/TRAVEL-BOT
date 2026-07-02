// FILE: mobile/src/ui/ListRow.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { ChevronRight } from 'lucide-react-native';
import * as haptics from '../lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ListRowProps {
  leading?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function ListRow({ leading, title, subtitle, trailing, onPress, accessibilityLabel }: ListRowProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!onPress) return;
    scale.value = withSpring(theme.motion.pressScale.toValue, {
      damping: theme.motion.pressScale.damping,
      stiffness: theme.motion.pressScale.stiffness,
    });
  };

  const handlePressOut = () => {
    if (!onPress) return;
    scale.value = withSpring(1, {
      damping: theme.motion.pressScale.damping,
      stiffness: theme.motion.pressScale.stiffness,
    });
  };

  const handlePress = () => {
    if (!onPress) return;
    haptics.light();
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        { minHeight: 64, paddingVertical: theme.spacing.s3, paddingHorizontal: theme.spacing.s4 },
        animatedStyle,
      ]}
    >
      {leading && <View style={[styles.leading, { marginRight: theme.spacing.s3 }]}>{leading}</View>}
      <View style={styles.content}>
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          typeof subtitle === 'string' ? (
            <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: 2 }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ marginTop: 2 }}>{subtitle}</View>
          )
        )}
      </View>
      {trailing && <View style={[styles.trailing, { marginLeft: theme.spacing.s3 }]}>{trailing}</View>}
      {onPress && !trailing && (
        <View style={[styles.trailing, { marginLeft: theme.spacing.s3 }]}>
          <ChevronRight color={theme.colors.text.tertiary} size={20} />
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  leading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  trailing: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
