// FILE: mobile/src/ui/Segmented.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import * as haptics from '../lib/haptics';

export interface SegmentedProps {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function Segmented({ segments, selectedIndex, onChange }: SegmentedProps) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);

  const segmentWidth = width / segments.length;

  React.useEffect(() => {
    if (segmentWidth > 0) {
      offset.value = withTiming(selectedIndex * segmentWidth, {
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      });
    }
  }, [selectedIndex, segmentWidth, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    width: segmentWidth,
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (index: number) => {
    if (index !== selectedIndex) {
      haptics.selection();
      onChange(index);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.colors.bg.fill, borderRadius: theme.radius.sm, padding: 2 },
      ]}
      onLayout={handleLayout}
    >
      {width > 0 && (
        <Animated.View
          style={[
            styles.indicator,
            {
              backgroundColor: theme.dark ? theme.colors.bg.surfaceRaised : theme.colors.bg.surface,
              borderRadius: theme.radius.sm - 2,
              ...theme.elevation.e1,
            },
            animatedStyle,
          ]}
        />
      )}
      {segments.map((segment, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Pressable
            key={index}
            style={styles.segment}
            onPress={() => handlePress(index)}
          >
            <Text
              style={[
                theme.typography.subhead,
                {
                  color: isSelected ? theme.colors.text.primary : theme.colors.text.secondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {segment}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 32,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    height: '100%',
    top: 2,
    bottom: 2,
    left: 2,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
});
