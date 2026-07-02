// FILE: mobile/src/features/leads/screens/FollowUpsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useFollowUps, useCompleteFollowUp, FollowUpTask } from '../api';
import { Button, Segmented, SwipeableRow, ListRow, MetricCard, Skeleton, EmptyState } from '../../../ui';
import { ArrowLeft, CheckCircle2, Clock, Plus, CalendarCheck } from 'lucide-react-native';
import { showToast } from '../../../ui/Toast';

export function FollowUpsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: Today, 1: Overdue, 2: Upcoming, 3: Done
  const filterNames = ['today', 'overdue', 'upcoming', 'done'];
  
  const { data: followUps, isLoading, refetch } = useFollowUps(filterNames[filterType]);
  const { mutate: completeTask } = useCompleteFollowUp();

  const s = theme.spacing;

  const handleComplete = (id: string) => {
    completeTask(id, {
      onSuccess: () => showToast('Follow-up marked as done', 'success')
    });
  };

  const renderItem = ({ item }: { item: FollowUpTask }) => {
    return (
      <SwipeableRow
        leftActions={[
          { label: 'Snooze', color: theme.colors.status.warning, icon: Clock, onPress: () => {} },
        ]}
        rightActions={item.status !== 'done' ? [
          { label: 'Done', color: theme.colors.status.success, icon: CheckCircle2, onPress: () => handleComplete(item.id) },
        ] : []}
      >
        <ListRow
          leading={
            <View style={{ backgroundColor: item.isOverdue ? theme.colors.status.danger + '20' : theme.colors.bg.fill, padding: 12, borderRadius: theme.radius.sm }}>
              {item.status === 'done' ? (
                <CheckCircle2 color={theme.colors.status.success} size={24} />
              ) : (
                <CalendarCheck color={item.isOverdue ? theme.colors.status.danger : theme.colors.accent} size={24} />
              )}
            </View>
          }
          title={item.leadName}
          subtitle={`${item.note} · ${item.trip}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[theme.typography.caption2, { color: item.isOverdue ? theme.colors.status.danger : theme.colors.text.secondary, fontWeight: item.isOverdue ? '600' : '400' }]}>
                {new Date(item.dueTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>{item.assignedAgent}</Text>
            </View>
          }
          onPress={() => {}} // Could open edit sheet or lead detail
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s2, paddingTop: s.s2, paddingBottom: s.s4 }}>
        <Button variant="plain" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginLeft: s.s2, flex: 1 }]}>Follow-ups</Text>
      </View>

      <View style={{ paddingHorizontal: s.s4 }}>
        {/* Stat strip */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s4 }}>
          <View style={{ width: '48%' }}><MetricCard label="Scheduled" value="12" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Overdue" value="2" delta={-1} /></View>
          <View style={{ width: '48%' }}><MetricCard label="Today" value="5" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Done" value="8" /></View>
        </View>

        <View style={{ marginBottom: s.s4 }}>
          <Segmented segments={['Today', 'Overdue', 'Upcoming', 'Done']} selectedIndex={filterType} onChange={setFilterType} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !followUps || followUps.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing due" message="You're on top of it!" />
        ) : (
          <FL
            data={followUps}
            renderItem={renderItem}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 72 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}
