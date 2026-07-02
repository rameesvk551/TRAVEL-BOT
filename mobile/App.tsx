// FILE: mobile/App.tsx
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { queryClient } from './src/lib/queryClient';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ToastContainer } from './src/ui/Toast';
import { getString, setString, StorageKeys } from './src/lib/storage';
import { ThemeMode } from './src/theme/ThemeProvider';

function AppContent() {
  const { theme, themeMode } = useTheme();

  // Adapt react-navigation theme to match ours
  const navTheme = theme.dark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: theme.colors.accent,
      background: theme.colors.bg.canvas,
      card: theme.colors.bg.surface,
      text: theme.colors.text.primary,
      border: theme.colors.border.hairline,
    }
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.accent,
      background: theme.colors.bg.canvas,
      card: theme.colors.bg.surface,
      text: theme.colors.text.primary,
      border: theme.colors.border.hairline,
    }
  };

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
      <ToastContainer />
    </>
  );
}

export default function App() {
  // Load initial theme from MMKV
  const initialMode = (getString(StorageKeys.THEME_MODE) || 'system') as ThemeMode;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider 
            initialMode={initialMode}
            onModeChange={(mode) => setString(StorageKeys.THEME_MODE, mode)}
          >
            <AppContent />
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
