// FILE: mobile/src/features/insights/screens/CRMReportScreen.tsx
// Pipeline / CRM report — GET /analytics/crm.
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useCrmReport, foldTail, RANGE_KEYS, RangeKey } from '../api';
import {
  MetricCard,
  SectionHeader,
  Skeleton,
  Segmented,
  Card,
  ErrorState,
  EmptyState,
  BarChart,
} from '../../../ui';
import { Users } from 'lucide-react-native';
import { formatPercent } from '../../../lib/formatters';

export function CRMReportScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [rangeIndex, setRangeIndex] = React.useState(1); // default 30D
  const range: RangeKey = RANGE_KEYS[rangeIndex];
  const { data, isLoading, isError, refetch } = useCrmReport(range);

  // Pipeline stages are ordered → ordinal ramp makes the order visible.
  const funnelBars = (data?.funnel ?? []).map((stage) => ({
    label: stage.name,
    value: stage.count,
  }));

  // Lead sources are unordered categories → nominal.
  const sourceBars = data
    ? foldTail(data.topSources, 6, (src) => ({ label: src.source, value: src.count }))
    : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[
            theme.typography.largeTitle,
            { color: theme.colors.text.primary, marginBottom: s.s4 },
          ]}
        >
          Pipeline Report
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
            <ErrorState message="Couldn't load the pipeline report." onRetry={refetch} />
          </View>
        ) : (
          <View style={{ gap: s.s5 }}>
            {/* Range-scoped headline numbers. No deltas here: the only changes the
                API returns are calendar-month, shown in their own section below. */}
            <View
              style={{
                paddingHorizontal: s.s4,
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: s.s3,
              }}
            >
              <View style={{ width: '48%' }}>
                <MetricCard label="Total leads" value={data.cards.totalLeads} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Open deals" value={data.cards.openDeals} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Won" value={data.cards.wonInRange} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Conversion" value={formatPercent(data.cards.conversion)} />
              </View>
            </View>

            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader title="Funnel" />
              {funnelBars.length > 0 ? (
                <Card>
                  <BarChart data={funnelBars} variant="ordinal" />
                </Card>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No leads yet"
                  message="Leads in this period will chart here."
                />
              )}
            </View>

            {sourceBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Top lead sources" />
                <Card>
                  <BarChart data={sourceBars} variant="nominal" />
                </Card>
              </View>
            )}

            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader
                title={`${data.monthAtGlance.thisMonthLabel} vs ${data.monthAtGlance.lastMonthLabel}`}
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                <View style={{ width: '48%' }}>
                  <MetricCard
                    label="New leads"
                    value={data.monthAtGlance.newLeads.value}
                    delta={data.monthAtGlance.newLeads.change}
                  />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard
                    label="Won"
                    value={data.monthAtGlance.won.value}
                    delta={data.monthAtGlance.won.change}
                  />
                </View>
                <View style={{ width: '48%' }}>
                  {/* More lost leads is bad. */}
                  <MetricCard
                    label="Lost"
                    value={data.monthAtGlance.lost.value}
                    delta={data.monthAtGlance.lost.change}
                    invertDelta
                  />
                </View>
              </View>
            </View>

            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader title="Needs attention" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Hot leads" value={data.needsAttention.hot} />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Overdue follow-ups" value={data.needsAttention.overdue} />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Stale leads" value={data.needsAttention.stale} />
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
