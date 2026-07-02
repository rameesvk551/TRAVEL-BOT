// FILE: mobile/src/ui/Toast.tsx
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import * as haptics from '../lib/haptics';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  message: string;
  variant: ToastVariant;
  id: number;
}

const TOAST_EVENT = 'show-toast';
let toastId = 0;

export function showToast(message: string, variant: ToastVariant = 'info') {
  DeviceEventEmitter.emit(TOAST_EVENT, { message, variant, id: ++toastId });
}

export function ToastContainer() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);

  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(TOAST_EVENT, (data: ToastData) => {
      setToast(data);
      if (data.variant === 'error') haptics.error();
      else if (data.variant === 'success') haptics.success();
      else if (data.variant === 'warning') haptics.warning();

      translateY.value = withSpring(insets.top + theme.spacing.s2, { damping: 15 });
      opacity.value = withTiming(1, { duration: 200 });

      setTimeout(() => {
        translateY.value = withTiming(-100, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 }, (finished) => {
          if (finished) {
            runOnJS(setToast)(null);
          }
        });
      }, 2500);
    });

    return () => subscription.remove();
  }, [insets.top, theme.spacing.s2]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.variant) {
      case 'success': return <CheckCircle2 color={theme.colors.status.success} size={20} />;
      case 'error': return <AlertCircle color={theme.colors.status.danger} size={20} />;
      case 'warning': return <AlertTriangle color={theme.colors.status.warning} size={20} />;
      case 'info': return <Info color={theme.colors.status.info} size={20} />;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg.surfaceRaised,
          borderRadius: theme.radius.full,
          paddingHorizontal: theme.spacing.s4,
          paddingVertical: theme.spacing.s3,
          ...theme.elevation.e2,
        },
        animatedStyle,
      ]}
      pointerEvents="none"
    >
      {getIcon()}
      <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginLeft: theme.spacing.s2 }]}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
