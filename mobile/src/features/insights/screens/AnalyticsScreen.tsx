// FILE: mobile/src/features/insights/screens/AnalyticsScreen.tsx
// Sales / revenue report — GET /analytics/sales. All money is integer paise.
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useSalesReport, rangeParams, foldTail, RANGE_KEYS, RangeKey } from '../api';
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
import { TrendingUp } from 'lucide-react-native';
import { formatCurrency, formatCurrencyCompact, formatDate } from '../../../lib/formatters';

export function AnalyticsScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [rangeIndex, setRangeIndex] = React.useState(1); // default 30D
  const range: RangeKey = RANGE_KEYS[rangeIndex];
  const { data, isLoading, isError, refetch } = useSalesReport(range);

  const dayLabel = (iso: string) => formatDate(iso, { year: undefined });

  const revenueTrend = data?.revenueByDay.map((d) => ({
    label: dayLabel(d.date),
    value: d.revenue,
  }));

  // Unordered categories → nominal (one hue; bar length already encodes value).
  const destinationBars = data
    ? foldTail(data.revenueByDestination, 6, (d) => ({
        label: d.destination,
        value: d.revenue,
      }))
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
          Analytics
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
            <ErrorState message="Couldn't load the sales report." onRetry={refetch} />
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
                  label="Revenue"
                  value={formatCurrencyCompact(data.totalRevenue)}
                  delta={data.revenueChange ?? undefined}
                  trend={data.revenueByDay.map((d) => d.revenue)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Bookings"
                  value={data.totalBookings}
                  delta={data.bookingsChange ?? undefined}
                  trend={data.revenueByDay.map((d) => d.count)}
                />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard
                  label="Avg booking value"
                  value={formatCurrencyCompact(data.avgBookingValue)}
                />
              </View>
              <View style={{ width: '48%' }}>
                {/* Money still owed to us — a rise is bad. */}
                <MetricCard
                  label="Outstanding"
                  value={formatCurrencyCompact(data.outstanding)}
                  invertDelta
                />
              </View>
            </View>

            <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
              <SectionHeader title="Revenue over time" />
              {revenueTrend && revenueTrend.length > 0 ? (
                <Card>
                  <AreaChart
                    data={revenueTrend}
                    formatValue={(v) => formatCurrencyCompact(v)}
                    accessibilityLabel={`Revenue trend over the last ${range}. Total ${formatCurrency(
                      data.totalRevenue,
                    )}.`}
                  />
                </Card>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title="No revenue yet"
                  message="Paid bookings in this period will chart here."
                />
              )}
            </View>

            {destinationBars.length > 0 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Revenue by destination" />
                <Card>
                  <BarChart
                    data={destinationBars}
                    variant="nominal"
                    formatValue={(v) => formatCurrencyCompact(v)}
                  />
                </Card>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
