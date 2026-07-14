// FILE: mobile/src/features/home/screens/HomeScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useDashboardSummary, useTodaysDepartures, type DashboardPeriod } from '../api';
import { getAuthState } from '../../../hooks/useAuth';
import { formatCurrencyCompact, formatPercent } from '../../../lib/formatters';
import {
  MetricCard,
  SectionHeader,
  ListRow,
  ChartWrapper,
  Card,
  ErrorState,
  Badge,
  Segmented,
  Skeleton,
  AreaChart,
  BarChart,
} from '../../../ui';
import { Plane } from 'lucide-react-native';

const PERIODS: DashboardPeriod[] = [7, 30, 90];

/**
 * Payments only exist on days money actually moved, so the API returns a sparse
 * series. A day with no paid payment earned zero — fill it in rather than letting
 * the chart draw a straight line across a gap it never measured.
 */
function zeroFill(
  trend: { date: string; amount: number }[],
  days: DashboardPeriod,
): { date: string; amount: number }[] {
  const byDay = new Map(trend.map((point) => [point.date.slice(0, 10), point.amount]));
  const filled: { date: string; amount: number }[] = [];
  for (let offset = days; offset >= 0; offset -= 1) {
    const day = new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
    filled.push({ date: day, amount: byDay.get(day) ?? 0 });
  }
  return filled;
}

/** "2026-07-14" -> "14 Jul" */
function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { agent: user } = getAuthState();
  const [periodIndex, setPeriodIndex] = useState(1); // default 30 days
  const days = PERIODS[periodIndex];

  const { data: dashboard, isLoading, isError, refetch, isRefetching } = useDashboardSummary(days);
  const departures = useTodaysDepartures();

  const s = theme.spacing;

  const revenueSeries = useMemo(
    () => (dashboard ? zeroFill(dashboard.revenueTrend, days) : []),
    [dashboard, days],
  );

  // Cross-tab jumps: tabs are keyed by module ('leads'), screens by name ('Leads').
  const goToLeads = (params?: Record<string, unknown>) =>
    navigation.navigate('leads', { screen: 'Leads', params });
  const goToBookings = () => navigation.navigate('bookings', { screen: 'Bookings' });

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ paddingHorizontal: s.s4, paddingTop: s.s6 }}>
          <Skeleton height={40} width={120} style={{ marginBottom: s.s4 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s6 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width="48%" height={100} />
            ))}
          </View>
          <Skeleton height={200} style={{ marginBottom: s.s6 }} />
          <Skeleton height={200} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !dashboard) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.colors.bg.canvas, justifyContent: 'center', paddingHorizontal: s.s4 }}
        edges={['top']}
      >
        <ErrorState message="Couldn't load your dashboard." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s12, paddingTop: s.s4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: s.s6 }}>
          <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Home</Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginTop: s.s1 }]}>
            {user?.name || 'Agent'} ·{' '}
            <Text style={{ color: theme.colors.accent }}>{user?.agencyName || 'TravelBot'}</Text>
          </Text>
        </View>

        {/* Period — drives every query below via the react-query key */}
        <View style={{ marginBottom: s.s4 }}>
          <Segmented
            segments={['7 Days', '30 Days', '90 Days']}
            selectedIndex={periodIndex}
            onChange={setPeriodIndex}
          />
        </View>

        {/* KPI grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s6 }}>
          <View style={{ width: '48%' }}>
            <MetricCard label="New Leads" value={dashboard.leads.total} onPress={() => goToLeads()} />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard label="Conversion" value={formatPercent(dashboard.leads.conversion)} />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Bookings"
              value={dashboard.revenue.bookings}
              delta={dashboard.revenue.bookingsChangePct ?? undefined}
              onPress={goToBookings}
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Revenue"
              value={formatCurrencyCompact(dashboard.revenue.total)}
              delta={dashboard.revenue.changePct ?? undefined}
              trend={revenueSeries.map((point) => point.amount)}
              onPress={goToBookings}
            />
          </View>
        </View>

        {/* Revenue trend */}
        <SectionHeader title="REVENUE TREND" />
        <Card style={{ marginBottom: s.s6, padding: s.s2 }}>
          <ChartWrapper height={180}>
            <AreaChart
              data={revenueSeries.map((point) => ({ label: shortDay(point.date), value: point.amount }))}
              height={180}
              formatValue={formatCurrencyCompact}
              accessibilityLabel={`Revenue over the last ${days} days, totalling ${formatCurrencyCompact(
                dashboard.revenue.total,
              )}`}
            />
          </ChartWrapper>
        </Card>

        {/* Pipeline — stages are ordered, so the bars take an ordinal ramp */}
        <SectionHeader title="PIPELINE" action="See all" onAction={() => goToLeads()} />
        <Card style={{ marginBottom: s.s6, padding: s.s4 }}>
          <BarChart
            variant="ordinal"
            data={dashboard.pipeline.map((stage) => ({ label: stage.name, value: stage.count }))}
          />
        </Card>

        {/* Needs attention */}
        <SectionHeader title="NEEDS ATTENTION" />
        <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>
          {dashboard.attentionCounts.overdue} overdue · {dashboard.attentionCounts.hot} hot ·{' '}
          {dashboard.attentionCounts.stale} going cold
        </Text>
        <View
          style={{
            backgroundColor: theme.colors.bg.surface,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            ...theme.elevation.e1,
            marginBottom: s.s6,
          }}
        >
          {dashboard.attentionItems.length === 0 ? (
            <View style={{ padding: s.s6, alignItems: 'center' }}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>All caught up.</Text>
            </View>
          ) : (
            dashboard.attentionItems.map((item, index) => (
              <React.Fragment key={item.leadId}>
                {index > 0 && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.colors.border.hairline,
                      marginLeft: s.s10 + s.s3,
                    }}
                  />
                )}
                <ListRow
                  leading={<Badge variant={item.priority === 'High' ? 'danger' : 'warning'} dot />}
                  title={item.name}
                  subtitle={item.reason}
                  onPress={() => goToLeads({ focusLeadId: item.leadId })}
                  accessibilityLabel={`${item.name}. ${item.reason}. Open lead.`}
                />
              </React.Fragment>
            ))
          )}
        </View>

        {/* Today's departures */}
        <SectionHeader title="TODAY'S DEPARTURES" action="See all" onAction={goToBookings} />
        <View
          style={{
            backgroundColor: theme.colors.bg.surface,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            ...theme.elevation.e1,
            marginBottom: s.s6,
          }}
        >
          {departures.isLoading ? (
            <View style={{ padding: s.s4, gap: s.s2 }}>
              <Skeleton height={44} />
              <Skeleton height={44} />
            </View>
          ) : departures.isError ? (
            <View style={{ padding: s.s4 }}>
              <ErrorState message="Couldn't load today's departures." onRetry={departures.refetch} />
            </View>
          ) : !departures.data || departures.data.length === 0 ? (
            <View style={{ padding: s.s6, alignItems: 'center' }}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                No departures today.
              </Text>
            </View>
          ) : (
            departures.data.map((departure, index) => (
              <React.Fragment key={departure.id}>
                {index > 0 && (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: theme.colors.border.hairline,
                      marginLeft: s.s10 + s.s3,
                    }}
                  />
                )}
                <ListRow
                  leading={<Plane color={theme.colors.text.tertiary} size={24} />}
                  title={departure.customerName}
                  subtitle={departure.itemName}
                  onPress={goToBookings}
                  accessibilityLabel={`${departure.customerName}, ${departure.itemName}. Open bookings.`}
                />
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
