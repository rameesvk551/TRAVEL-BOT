// FILE: mobile/src/navigation/PlaceholderStack.tsx
// The honest dead-end. A module the tenant HAS access to but that the phone
// deliberately doesn't render (e.g. the website builder — a canvas tool that has
// no good phone form). It must read as "use the web dashboard", not as a bug and
// not as internal roadmap-speak.

import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Monitor } from 'lucide-react-native';
import { EmptyState } from '../ui';
import { useTheme } from '../theme/ThemeProvider';
import { resolveLabel } from './useLabel';
import { useManifest } from '../hooks/useManifest';

export function PlaceholderStack({ route }: any) {
  const { theme } = useTheme();
  const { manifest } = useManifest();

  const moduleKey: string = route?.params?.moduleName ?? '';
  // Use the tenant's own vocabulary for the module, not the raw key.
  const label = moduleKey ? resolveLabel(moduleKey, manifest?.labels) : 'This module';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={Monitor}
          title={`${label} is on the web`}
          message={`${label} needs a bigger canvas than a phone. Open the dashboard in a browser to use it — everything else in your account works here.`}
        />
      </View>
    </SafeAreaView>
  );
}
