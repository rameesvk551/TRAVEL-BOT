// FILE: mobile/src/navigation/ModuleHub.tsx
import React, { useState, useMemo } from 'react';
import { View, ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useManifest } from '../hooks/useManifest';
import { useLogout } from '../hooks/useAuth';
import { SearchBar, SectionHeader, ListRow, EmptyState, Button } from '../ui';
import { MODULES, HUB_GROUP_ORDER, HUB_GROUP_LABELS } from './registry';
import { useLabel } from './useLabel';
import { getObject, setObject, StorageKeys } from '../lib/storage';
import { Settings, LogOut, Package } from 'lucide-react-native';

export function ModuleHub({ navigation }: any) {
  const { theme } = useTheme();
  const { manifest } = useManifest();
  const getLabel = useLabel(manifest);
  const [searchQuery, setSearchQuery] = useState('');
  const { mutate: logout, isPending } = useLogout();

  // Pinned modules state
  const [pinned, setPinned] = useState<string[]>(getObject<string[]>(StorageKeys.PINNED_MODULES) || []);

  const enabledModules = useMemo(() => new Set(manifest?.modules || []), [manifest]);

  // Grouped active modules based on manifest
  const groupedModules = useMemo(() => {
    const query = searchQuery.toLowerCase();
    
    // In Phase 0, if there's no hubGroups in manifest, we generate it from registry
    // The backend appManifestService does this in reality
    const groups = manifest?.hubGroups || HUB_GROUP_ORDER.map(g => ({ group: g, modules: [] as string[] }));
    
    // If we're generating them
    if (!manifest?.hubGroups) {
      Object.keys(MODULES).forEach(key => {
        if (enabledModules.has(key) && key !== 'home') {
          const mod = MODULES[key];
          const groupIndex = groups.findIndex(g => g.group === mod.group);
          if (groupIndex !== -1) groups[groupIndex].modules.push(key);
        }
      });
    }

    return groups.map(g => {
      const filtered = g.modules
        .filter(key => enabledModules.has(key)) // Ensure it's enabled
        .filter(key => getLabel(key).toLowerCase().includes(query)); // Search filter
      return { ...g, modules: filtered };
    }).filter(g => g.modules.length > 0);
  }, [manifest, enabledModules, searchQuery, getLabel]);

  const handleModulePress = (key: string) => {
    // In Phase 0, all just navigate to PlaceholderStack except gallery
    navigation.navigate(key, { moduleName: getLabel(key) });
  };

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s12 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginTop: s.s4, marginBottom: s.s4 }]}>
          More
        </Text>

        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search modules..."
        />

        <View style={{ height: s.s4 }} />

        {/* Pinned (Mocked for UI) */}
        {searchQuery === '' && pinned.length > 0 && (
          <View>
            <SectionHeader title="PINNED" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
              {/* Render pinned items... skipped in Phase0 for brevity, functionality comes later */}
            </View>
          </View>
        )}

        {groupedModules.length === 0 && searchQuery !== '' ? (
          <View style={{ marginTop: s.s12 }}>
            <EmptyState
              icon={Package}
              title="No modules found"
              message={`No results for "${searchQuery}"`}
            />
          </View>
        ) : (
          groupedModules.map(group => (
            <View key={group.group} style={{ marginBottom: s.s6 }}>
              <SectionHeader title={HUB_GROUP_LABELS[group.group as keyof typeof HUB_GROUP_LABELS] || group.group} />
              <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.elevation.e1 }}>
                {group.modules.map((key, index) => {
                  const mod = MODULES[key];
                  const Icon = mod.icon;
                  return (
                    <React.Fragment key={key}>
                      {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: s.s10 + s.s3 }} />}
                      <ListRow
                        leading={<View style={{ backgroundColor: theme.colors.accentTint, padding: 6, borderRadius: theme.radius.sm }}>
                          <Icon color={theme.colors.accent} size={20} />
                        </View>}
                        title={getLabel(key)}
                        onPress={() => handleModulePress(key)}
                      />
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={{ height: s.s4 }} />
        
        {/* Gallery for Dev */}
        <SectionHeader title="DEVELOPER" />
        <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.elevation.e1, marginBottom: s.s6 }}>
          <ListRow
            leading={<View style={{ backgroundColor: theme.colors.accentTint, padding: 6, borderRadius: theme.radius.sm }}>
              <Package color={theme.colors.accent} size={20} />
            </View>}
            title="Component Gallery"
            onPress={() => navigation.navigate('Gallery')}
          />
        </View>

        {/* Account actions */}
        <Button variant="secondary" label="Settings" icon={Settings} onPress={() => {}} fullWidth />
        <View style={{ height: s.s2 }} />
        <Button variant="destructive" label="Sign out" icon={LogOut} onPress={() => logout()} fullWidth loading={isPending} />

      </ScrollView>
    </SafeAreaView>
  );
}
