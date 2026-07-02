// FILE: mobile/src/navigation/PlaceholderStack.tsx
import React from 'react';
import { View } from 'react-native';
import { EmptyState } from '../ui';
import { Wrench } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

export function PlaceholderStack({ route }: any) {
  const { theme } = useTheme();
  const moduleName = route?.params?.moduleName || 'Module';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
      <EmptyState
        icon={Wrench}
        title={`${moduleName} (Phase X)`}
        message="This module is not included in Phase 0."
      />
    </View>
  );
}
