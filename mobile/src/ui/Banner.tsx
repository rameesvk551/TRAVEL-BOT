// FILE: mobile/src/ui/Banner.tsx
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { WifiOff, AlertCircle, Info, AlertTriangle, X } from 'lucide-react-native';

export type BannerVariant = 'offline' | 'error' | 'info' | 'warning';

export interface BannerProps {
  visible: boolean;
  message: string;
  variant: BannerVariant;
  onDismiss?: () => void;
}

export function Banner({ visible, message, variant, onDismiss }: BannerProps) {
  const { theme } = useTheme();

  if (!visible) return null;

  const getStyle = () => {
    switch (variant) {
      case 'offline': return { bg: theme.colors.bg.fill, text: theme.colors.text.secondary };
      case 'error': return { bg: theme.colors.status.danger, text: '#FFFFFF' };
      case 'warning': return { bg: theme.colors.status.warning, text: '#FFFFFF' };
      case 'info': return { bg: theme.colors.status.info, text: '#FFFFFF' };
    }
  };

  const getIcon = (color: string) => {
    switch (variant) {
      case 'offline': return <WifiOff color={color} size={16} />;
      case 'error': return <AlertCircle color={color} size={16} />;
      case 'warning': return <AlertTriangle color={color} size={16} />;
      case 'info': return <Info color={color} size={16} />;
    }
  };

  const style = getStyle();

  return (
    <View style={[styles.container, { backgroundColor: style.bg, paddingHorizontal: theme.spacing.s4 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {getIcon(style.text)}
        <Text style={[theme.typography.footnote, { color: style.text, marginLeft: theme.spacing.s2 }]}>
          {message}
        </Text>
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} style={{ padding: theme.spacing.s2 }}>
          <X color={style.text} size={16} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'space-between',
  },
});
