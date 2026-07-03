// FILE: mobile/src/ui/SwipeableRow.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// @ts-ignore
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useTheme } from '../theme/ThemeProvider';
import { LucideIcon } from 'lucide-react-native';

export interface SwipeAction {
  label: string;
  color?: string;
  icon?: LucideIcon;
  onPress: () => void;
}

export interface SwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
}

export function SwipeableRow({ children, leftActions, rightActions }: SwipeableRowProps) {
  const { theme } = useTheme();

  const renderActions = (actions: SwipeAction[] | undefined, progress: any, dragX: any, isRight: boolean) => {
    if (!actions || actions.length === 0) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {actions.map((action, index) => {
          const bgColor = action.color || theme.colors.accent;
          return (
            <TouchableOpacity
              key={index}
              onPress={action.onPress}
              style={{
                backgroundColor: bgColor,
                justifyContent: 'center',
                alignItems: 'center',
                width: 80,
                height: '100%',
              }}
            >
              {action.icon && <action.icon color={theme.colors.text.onAccent} size={24} style={{ marginBottom: 4 }} />}
              <Text style={[theme.typography.caption, { color: theme.colors.text.onAccent }]}>{action.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Swipeable
      renderLeftActions={(progress: any, dragX: any) => renderActions(leftActions, progress, dragX, false)}
      renderRightActions={(progress: any, dragX: any) => renderActions(rightActions, progress, dragX, true)}
      // Full swipe on left triggers first action if it exists
      onSwipeableLeftOpen={() => leftActions?.[0]?.onPress()}
      onSwipeableRightOpen={() => rightActions?.[0]?.onPress()}
    >
      <View style={{ backgroundColor: theme.colors.bg.surface }}>
        {children}
      </View>
    </Swipeable>
  );
}
