// FILE: mobile/src/features/settings/screens/SettingsScreen.tsx
// Account, appearance, workspace, sign out. Reads the signed-in agent from MMKV
// and the agency from GET /agencies/me.

import React from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building, LogOut } from 'lucide-react-native';
import { useTheme, ThemeMode } from '../../../theme/ThemeProvider';
import { SectionHeader, ListRow, Card, Avatar, Segmented, Skeleton, Button } from '../../../ui';
import { getAuthState, useLogout } from '../../../hooks/useAuth';
import api from '../../../lib/api';
import { useBusinessProfile } from '../api';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];
const THEME_LABELS = ['System', 'Light', 'Dark'];

export function SettingsScreen({ navigation }: any) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const s = theme.spacing;

  const { agent } = getAuthState();
  const agency = useBusinessProfile();
  const { mutate: logout, isPending: signingOut } = useLogout();

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () =>
          logout(undefined, {
            onSettled: () => {
              // useLogout has cleared the MMKV auth state. This request 401s,
              // which drives the api client's auth-failure handler and returns
              // the app to the Auth stack.
              api.get('/auth/me').catch(() => {});
            },
          }),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* ---------------- Identity ---------------- */}
        <View style={{ alignItems: 'center', marginBottom: s.s6 }}>
          <Avatar name={agent?.name} size={80} />
          <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>
            {agent?.name || 'Signed in'}
          </Text>
          <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: s.s1 }]}>
            {agent?.email || '—'}
          </Text>
          {agency.isLoading ? (
            <View style={{ marginTop: s.s2, width: 140 }}>
              <Skeleton height={16} />
            </View>
          ) : agency.data ? (
            <Text style={[theme.typography.footnote, { color: theme.colors.text.tertiary, marginTop: s.s2 }]}>
              {agency.data.name} · {agent?.role === 'ADMIN' ? 'Admin' : 'Agent'}
            </Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: s.s4, gap: s.s5 }}>
          {/* ---------------- Appearance ---------------- */}
          <View>
            <SectionHeader title="Appearance" />
            <Card>
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s3 }]}>
                Theme
              </Text>
              <Segmented
                segments={THEME_LABELS}
                selectedIndex={Math.max(0, THEME_MODES.indexOf(themeMode))}
                onChange={(i) => setThemeMode(THEME_MODES[i])}
              />
            </Card>
          </View>

          {/* ---------------- Workspace ---------------- */}
          <View>
            <SectionHeader title="Workspace" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                leading={<Building size={20} color={theme.colors.accent} />}
                title="Business profile"
                subtitle={agency.data?.name || undefined}
                onPress={() => navigation.navigate('BusinessProfile')}
                accessibilityLabel="Business profile"
                accessibilityHint="Opens your agency's profile and tax details"
              />
            </Card>
          </View>

          {/* ---------------- Session ---------------- */}
          <View>
            <SectionHeader title="Session" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                leading={<LogOut size={20} color={theme.colors.status.danger} />}
                title="Sign out"
                onPress={confirmSignOut}
                accessibilityLabel="Sign out"
                accessibilityHint="Clears your session on this device"
              />
            </Card>
            {signingOut && (
              <View style={{ marginTop: s.s3 }}>
                <Button variant="plain" label="Signing out…" loading disabled accessibilityLabel="Signing out" />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
