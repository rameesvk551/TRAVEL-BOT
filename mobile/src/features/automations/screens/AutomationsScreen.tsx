// FILE: mobile/src/features/automations/screens/AutomationsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useAutomations, Automation } from '../api';
import { ListRow, Badge, EmptyState, Skeleton, Button, Card } from '../../../ui';
import { Zap, Plus } from 'lucide-react-native';

export function AutomationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data: automations, isLoading, refetch } = useAutomations();

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Automation }) => {
    return (
      <Card style={{ padding: 0, marginBottom: s.s4, marginHorizontal: s.s4 }} onPress={() => navigation.navigate('FlowBuilder', { automationId: item.id })}>
        <ListRow
          leading={
            <View style={{ width: 40, height: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
               <Zap size={20} color={item.status === 'Active' ? '#25D366' : theme.colors.text.tertiary} />
            </View>
          }
          title={item.name}
          subtitle={`Trigger: ${item.trigger}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
               <Badge label={item.status} variant={item.status === 'Active' ? 'success' : 'neutral'} />
            </View>
          }
          onPress={() => navigation.navigate('FlowBuilder', { automationId: item.id })}
        />
        <View style={{ padding: s.s3, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
           <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Runs: {item.runCount.toLocaleString()}</Text>
           <Button variant="plain" label="Edit Flow" onPress={() => navigation.navigate('FlowBuilder', { automationId: item.id })} />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Automations</Text>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={100} />)}
          </View>
        ) : !automations || automations.length === 0 ? (
          <EmptyState icon={Zap} title="No automations" message="Create automated workflows for your business." />
        ) : (
          <FL
            data={automations}
            renderItem={renderItem}
            estimatedItemSize={120}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('FlowBuilder')} />
      </View>
    </SafeAreaView>
  );
}
