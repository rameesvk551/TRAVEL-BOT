// FILE: mobile/src/features/agents/screens/AgentsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useAgents, Agent } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar, Button } from '../../../ui';
import { Users, Plus } from 'lucide-react-native';

export function AgentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [role, setRole] = useState(0); // 0: All, 1: Admin, 2: Sales
  const roles = ['All', 'Admin', 'Sales'];
  const { data: agents, isLoading, refetch } = useAgents(roles[role]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Agent }) => {
    return (
      <ListRow
        leading={<Avatar name={item.name} />}
        title={item.name}
        subtitle={`Routing limit: ${item.routingLimit}`}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Badge label={item.role} variant="info" />
             <Badge label={item.status} variant={item.status === 'Online' ? 'success' : 'neutral'} dot />
          </View>
        }
        onPress={() => navigation.navigate('AgentForm', { agentId: item.id })}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Team</Text>
        <Segmented segments={roles} selectedIndex={role} onChange={setRole} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !agents || agents.length === 0 ? (
          <EmptyState icon={Users} title="No agents" message="Add your team members." />
        ) : (
          <FL
            data={agents}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('AgentForm')} />
      </View>
    </SafeAreaView>
  );
}
