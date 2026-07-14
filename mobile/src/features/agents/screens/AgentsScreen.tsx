// FILE: mobile/src/features/agents/screens/AgentsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Users, Plus } from 'lucide-react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAgents, apiErrorMessage, Agent } from '../api';
import { Segmented, ListRow, Badge, EmptyState, ErrorState, Skeleton, Avatar, Button } from '../../../ui';

const FL = FlashList as any;

// The backend list endpoint takes no role filter — filter client-side.
const FILTERS: Array<{ label: string; role?: Agent['role'] }> = [
  { label: 'All' },
  { label: 'Admins', role: 'ADMIN' },
  { label: 'Agents', role: 'AGENT' },
];

export function AgentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;
  const [filterIndex, setFilterIndex] = useState(0);

  const { data, isLoading, isRefetching, isError, error, refetch } = useAgents();

  const agents = useMemo(() => {
    const role = FILTERS[filterIndex].role;
    if (!data) return [];
    return role ? data.filter((a) => a.role === role) : data;
  }, [data, filterIndex]);

  const renderItem = ({ item }: { item: Agent }) => (
    <ListRow
      leading={<Avatar name={item.name} />}
      title={item.name}
      subtitle={item.email}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={item.role === 'ADMIN' ? 'Admin' : 'Agent'} variant="info" />
          <Badge label={item.isOnline ? 'Online' : 'Offline'} variant={item.isOnline ? 'success' : 'neutral'} dot />
        </View>
      }
      onPress={() => navigation.navigate('AgentForm', { agentId: item.id })}
      accessibilityLabel={`${item.name}, ${item.role === 'ADMIN' ? 'admin' : 'agent'}, ${item.isOnline ? 'online' : 'offline'}`}
      accessibilityHint="Opens this team member's profile"
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Team</Text>
        <Segmented
          segments={FILTERS.map((f) => f.label)}
          selectedIndex={filterIndex}
          onChange={setFilterIndex}
        />
      </View>

      <View style={{ flex: 1 }}>
        {isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState
              message={apiErrorMessage(error, 'Could not load your team.')}
              onRetry={() => refetch()}
            />
          </View>
        ) : isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members"
            message="Add your first team member to start assigning leads."
            actionLabel="Add member"
            onAction={() => navigation.navigate('AgentForm')}
          />
        ) : (
          <FL
            data={agents}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: s.s4,
                }}
              />
            )}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => navigation.navigate('AgentForm')}
          accessibilityLabel="Add a team member"
        />
      </View>
    </SafeAreaView>
  );
}
