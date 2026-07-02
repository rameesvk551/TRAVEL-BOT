// FILE: mobile/src/ui/Avatar.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export interface AvatarProps {
  name?: string | null;
  imageUri?: string | null;
  size?: number;
}

const COLORS = [
  '#007AFF', // blue
  '#34C759', // green
  '#FF9F0A', // orange
  '#FF3B30', // red
  '#5E5CE6', // indigo
  '#AF52DE', // purple
  '#FF2D55', // pink
];

function getDeterministicColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export function Avatar({ name, imageUri, size = 40 }: AvatarProps) {
  const { theme } = useTheme();

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  const displayName = name || '?';
  const bgColor = getDeterministicColor(displayName);
  const initials = getInitials(displayName);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={[
          theme.typography.subhead,
          { color: '#FFFFFF', fontWeight: '600', fontSize: size * 0.4 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}
