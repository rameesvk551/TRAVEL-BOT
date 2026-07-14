// FILE: mobile/src/features/insights/screens/CallingReportScreen.tsx
//
// Agent calling report — GET /analytics/calls (tracked call logs: KPIs, daily
// trend, status breakdown, per-agent rollup, best call window).
//
// This is NOT /missed-calls: that route is the separate inbound-WhatsApp-call
// log with its own auto-reply behaviour and its own screen.
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCallingReport,
  callStatusTone,
  formatDuration,
  RANGE_KEYS,
  RangeKey,
} from '../api';
import {
  MetricCard,
  SectionHeader,
  Skeleton,
  Segmented,
  Card,
  ErrorState,
  EmptyState,
  AreaChart,
  BarChart,
} from '../../../ui';
import { PhoneCall } from 'lucide-react-native';
import { formatDate, formatPercent } from '../../../lib/formatters';

/** 14 → "2 PM", 0 → "12 AM". */
function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

export function CallingReportScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [rangeIndex, setRangeIndex] = React.useState(1); // default 30D
  const range: RangeKey = RANGE_KEYS[rangeIndex];
  const { data, isLoading, isError, refetch } = useCallingReport(range);

  const dayLabel = (iso: string) => formatDate(iso, { year: undefined });

  const callTrend = (data?.byDay ?? []).map((d) => ({
    label: dayLabel(d.date),
    value: d.total,
  }));

  // Call statuses genuinely mean good/bad → the one legitimate status variant.
  const statusBars = (data?.byStatus ?? []).slice(0, 7).map((row) => ({
    label: row.status,
    value: row.count,
    status: callStatusTone(row.status),
  }));

  // Agents are unordered categories → nominal.
  const agentBars = (data?.agentStats ?? []).slice(0, 7).map((a) => ({
    label: a.name,
    value: a.total,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[
            theme.typography.largeTitle,
            { color: theme.colors.text.primary, marginBottom: s.s4 },
          ]}
        >
          Agent Calling
        </Text>
        <Segmented segments={RANGE_KEYS} selectedIndex={rangeIndex} onChange={setRangeIndex} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={{ padding: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: '48%' }}>
                <Skeleton height={100} />
              </View>
            ))}
          </View>
        ) : isError || !data ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load the calling report." onRetry={refetch} />
          </View>
        ) : (
          <View style={{ gap: s.s5 }}>
            <View
              style={{
                paddingHorizontal: s.s4,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: s.s3,
              }}
            >
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Total calls"
                  value={data.kpis.totalCalls}
                  delta={data.deltas?.totalCalls}
                  trend={data.byDay.map((d) => d.total)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Answer rate"
                  value={formatPercent(data.kpis.answerRate)}
                  delta={data.deltas?.answerRate}
                  trend={data.byDay.map((d) => d.connected)}
                />
              </View>
              <View style={{ width: '48%' }}>
                {/* More missed calls is bad. */}
                <MetricCard
                  label="Missed calls"
                  value={data.kpis.missedCalls}
                  invertDelta
                  trend={data.byDay.map((d) => d.missed)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Avg talk time" value={formatDuration(data.kpis.avgTalkSec)} />
              </View>
            </View>

            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader title="Calls per day" />
              {callTrend.length > 0 ? (
                <Card>
                  <AreaChart
                    data={callTrend}
                    formatValue={(v) => String(Math.round(v))}
                    accessibilityLabel={`Call volume over the last ${range}. ${data.kpis.totalCalls} calls, ${data.kpis.connectedCalls} connected.`}
                  />
                </Card>
              ) : (
                <EmptyState
                  icon={PhoneCall}
                  title="No calls yet"
                  message="Calls placed in this period will chart here."
                />
              )}
              {data.bestWindow && (
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                  Best time to call: {hourLabel(data.bestWindow.hour)} —{' '}
                  {data.bestWindow.connectRate}% connect rate over {data.bestWindow.calls} calls.
                </Text>
              )}
            </View>

            {statusBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Call outcomes" />
                <Card>
                  <BarChart data={statusBars} variant="status" />
                </Card>
              </View>
            )}

            {agentBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Calls by agent" />
                <Card>
                  <BarChart data={agentBars} variant="nominal" />
                </Card>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
