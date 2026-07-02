// FILE: mobile/src/ui/Grabber.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function Grabber() {
  const { theme } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.grabber,
          { backgroundColor: theme.colors.bg.fill },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
});
