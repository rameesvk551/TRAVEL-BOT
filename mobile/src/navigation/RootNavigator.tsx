// FILE: mobile/src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthNavigator } from './AuthNavigator';
import { AppNavigator } from './AppNavigator';
import { getAuthState, tryRestoreSession } from '../hooks/useAuth';
import { setAuthFailureHandler } from '../lib/api';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

type AppState = 'loading' | 'authenticated' | 'unauthenticated';

export function RootNavigator() {
  const { theme } = useTheme();
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    // 1. Setup global auth failure handler for the API client
    setAuthFailureHandler(() => {
      setAppState('unauthenticated');
    });

    // 2. Initial boot check
    async function bootstrap() {
      const auth = getAuthState();
      if (!auth.isAuthenticated) {
        setAppState('unauthenticated');
        return;
      }

      // We have tokens, try to refresh/restore session
      const restored = await tryRestoreSession();
      if (restored) {
        setAppState('authenticated');
      } else {
        setAppState('unauthenticated');
      }
    }

    bootstrap();
  }, []);

  if (appState === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg.canvas }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {appState === 'authenticated' ? (
        <Stack.Screen name="Main" component={AppNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
