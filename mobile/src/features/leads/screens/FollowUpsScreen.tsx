// FILE: mobile/src/features/leads/screens/FollowUpsScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useFollowUps,
  useCompleteFollowUp,
  useSnoozeFollowUp,
  isFollowUpOverdue,
  type FollowUpTask,
  type FollowUpListParams,
} from '../api';
import { formatTime, formatDate } from '../../../lib/formatters';
import { Button, Segmented, SwipeableRow, ListRow, MetricCard, Skeleton, EmptyState, ErrorState } from '../../../ui';
import { ArrowLeft, CheckCircle2, Clock, CalendarCheck } from 'lucide-react-native';
import { showToast } from '../../../ui/Toast';

/** Each tab maps to filters the /leads/followups endpoint actually understands. */
function paramsForTab(index: number): FollowUpListParams {
  if (index === 1) return { status: 'Scheduled', due: 'overdue' };
  if (index === 2) {
    // Everything after today — the endpoint windows on scheduledAt.
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    return { status: 'Scheduled', dateFrom: tomorrow.toISOString() };
  }
  if (index === 3) return { status: 'Done' };
  return { status: 'Scheduled', due: 'today' };
}

export function FollowUpsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tab, setTab] = useState(0); // 0: Today, 1: Overdue, 2: Upcoming, 3: Done

  const params = useMemo(() => paramsForTab(tab), [tab]);
  const { data, isLoading, isError, refetch, isRefetching } = useFollowUps(params);
  const { mutate: completeTask } = useCompleteFollowUp();
  const { mutate: snoozeTask } = useSnoozeFollowUp();

  const followUps = data?.data ?? [];
  const metrics = data?.metrics;

  const s = theme.spacing;

  const handleComplete = (task: FollowUpTask) => {
    completeTask(
      { leadId: task.leadId, followUpId: task.id },
      {
        onSuccess: () => showToast('Follow-up marked as done', 'success'),
        onError: () => showToast('Could not close the follow-up', 'error'),
      },
    );
  };

  const handleSnooze = (task: FollowUpTask) => {
    snoozeTask(
      { leadId: task.leadId, followUpId: task.id, scheduledAt: task.scheduledAt },
      {
        onSuccess: () => showToast('Snoozed to tomorrow', 'success'),
        onError: () => showToast('Could not snooze the follow-up', 'error'),
      },
    );
  };

  const renderItem = ({ item }: { item: FollowUpTask }) => {
    const overdue = isFollowUpOverdue(item);
    const done = item.status === 'Done';
    const who = item.lead?.customer?.name || item.lead?.customer?.phone || 'Lead';
    const trip = item.lead?.destination || item.lead?.package?.name || '';
    const detail = [item.note, trip].filter(Boolean).join(' · ');

    return (
      <SwipeableRow
        leftActions={
          done
            ? []
            : [{ label: 'Snooze', color: theme.colors.status.warning, icon: Clock, onPress: () => handleSnooze(item) }]
        }
        rightActions={
          done
            ? []
            : [
                {
                  label: 'Done',
                  color: theme.colors.status.success,
                  icon: CheckCircle2,
                  onPress: () => handleComplete(item),
                },
              ]
        }
      >
        <ListRow
          leading={
            <View
              style={{
                backgroundColor: overdue ? theme.colors.status.danger + '20' : theme.colors.bg.fill,
                padding: s.s3,
                borderRadius: theme.radius.sm,
              }}
            >
              {done ? (
                <CheckCircle2 color={theme.colors.status.success} size={24} />
              ) : (
                <CalendarCheck color={overdue ? theme.colors.status.danger : theme.colors.accent} size={24} />
              )}
            </View>
          }
          title={who}
          subtitle={detail || 'No note'}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
              <Text
                style={[
                  theme.typography.caption2,
                  {
                    color: overdue ? theme.colors.status.danger : theme.colors.text.secondary,
                    fontWeight: overdue ? '600' : '400',
                  },
                ]}
              >
                {tab === 0 ? formatTime(item.scheduledAt) : formatDate(item.scheduledAt)}
              </Text>
              {!!item.agent?.name && (
                <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                  {item.agent.name}
                </Text>
              )}
            </View>
          }
          onPress={() => navigation.navigate('Leads', { focusLeadId: item.leadId })}
          accessibilityLabel={`Follow-up with ${who}${overdue ? ', overdue' : ''}. Open lead.`}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s2,
          paddingTop: s.s2,
          paddingBottom: s.s4,
        }}
      >
        <Button variant="plain" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginLeft: s.s2, flex: 1 }]}>
          Follow-ups
        </Text>
      </View>

      <View style={{ paddingHorizontal: s.s4 }}>
        {/* Counts are agency/agent-scoped by the same endpoint that returns the rows */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s4 }}>
          <View style={{ width: '48%' }}>
            <MetricCard label="Scheduled" value={metrics?.scheduled ?? '—'} />
          </View>
          <View style={{ width: '48%' }}>
            {/* A rising overdue count is bad news, not good */}
            <MetricCard label="Overdue" value={metrics?.overdue ?? '—'} invertDelta />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard label="Today" value={metrics?.today ?? '—'} />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard label="Done" value={metrics?.done ?? '—'} />
          </View>
        </View>

        <View style={{ marginBottom: s.s4 }}>
          <Segmented segments={['Today', 'Overdue', 'Upcoming', 'Done']} selectedIndex={tab} onChange={setTab} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load your follow-ups." onRetry={refetch} />
          </View>
        ) : followUps.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="Nothing due" message="You're on top of it." />
        ) : (
          <FL
            data={followUps}
            renderItem={renderItem}
            keyExtractor={(item: FollowUpTask) => item.id}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: 72,
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
