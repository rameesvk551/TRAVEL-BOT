// FILE: mobile/src/ui/SwipeableRow.tsx
import React, { useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
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
  const ref = useRef<SwipeableMethods>(null);

  // Fire the action, then snap the row shut so it doesn't sit open behind a
  // navigation push or a list re-render.
  const fire = (action: SwipeAction) => {
    ref.current?.close();
    action.onPress();
  };

  const renderActions = (actions: SwipeAction[] | undefined) => {
    if (!actions || actions.length === 0) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => fire(action)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={{
              backgroundColor: action.color || theme.colors.accent,
              justifyContent: 'center',
              alignItems: 'center',
              width: 80,
              height: '100%',
            }}
          >
            {action.icon && <action.icon color={theme.colors.text.onAccent} size={24} style={{ marginBottom: 4 }} />}
            <Text style={[theme.typography.caption, { color: theme.colors.text.onAccent }]}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Swipeable
      ref={ref}
      renderLeftActions={() => renderActions(leftActions)}
      renderRightActions={() => renderActions(rightActions)}
      // A full swipe past the threshold triggers that side's primary action.
      onSwipeableOpen={(direction) => {
        const primary = direction === 'left' ? leftActions?.[0] : rightActions?.[0];
        if (primary) fire(primary);
      }}
    >
      <View style={{ backgroundColor: theme.colors.bg.surface }}>
        {children}
      </View>
    </Swipeable>
  );
}
