// FILE: mobile/src/features/home/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useDashboardSummary } from '../api';
import { getAuthState } from '../../../hooks/useAuth';
import { MetricCard, SectionHeader, ListRow, ChartWrapper, Card, EmptyState, Badge, Segmented, Button, Skeleton } from '../../../ui';
import { FileWarning, Banknote, CalendarDays, Plane } from 'lucide-react-native';

export function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { agent: user } = getAuthState();
  const { data: dashboard, isLoading, error, refetch } = useDashboardSummary();
  const [period, setPeriod] = useState(0); // 0: 7d, 1: 30d, 2: 90d

  const s = theme.spacing;

  // Simple skeleton loader for the whole screen
  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ paddingHorizontal: s.s4, paddingTop: s.s6 }}>
          <Skeleton height={40} width={120} style={{ marginBottom: s.s4 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s6 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} width="48%" height={100} />)}
          </View>
          <Skeleton height={200} style={{ marginBottom: s.s6 }} />
          <Skeleton height={200} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !dashboard) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas, justifyContent: 'center' }} edges={['top']}>
        <EmptyState
          icon={FileWarning}
          title="Couldn't load dashboard"
          message="Something went wrong while fetching your data."
          actionLabel="Try again"
          onAction={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s12, paddingTop: s.s4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: s.s6 }}>
          <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Home</Text>
          <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginTop: s.s1 }]}>
            Good morning, {user?.name || 'Agent'} · <Text style={{ color: theme.colors.accent }}>{user?.agencyName || 'TravelBot'}</Text>
          </Text>
        </View>

        {/* Period Selector */}
        <View style={{ marginBottom: s.s4 }}>
          <Segmented segments={['7 Days', '30 Days', '90 Days']} selectedIndex={period} onChange={setPeriod} />
        </View>

        {/* KPI Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s6 }}>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="New Leads"
              value={dashboard.newLeads.value.toString()}
              delta={dashboard.newLeads.delta}
              onPress={() => navigation.navigate('Leads')}
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Conversion"
              value={`${dashboard.conversion.value}%`}
              delta={dashboard.conversion.delta}
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Bookings"
              value={dashboard.bookings.value.toString()}
              delta={dashboard.bookings.delta}
              onPress={() => navigation.navigate('Bookings')}
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Revenue"
              value={`₹${(dashboard.revenue.value / 1000).toFixed(1)}k`}
              delta={dashboard.revenue.delta}
              onPress={() => navigation.navigate('more', { screen: 'Payments' })}
            />
          </View>
        </View>

        {/* Revenue Trend */}
        <SectionHeader title="REVENUE TREND" />
        <Card style={{ marginBottom: s.s6, padding: s.s2 }}>
          <ChartWrapper height={150}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              [ Area Chart Component Placeholder ]
            </Text>
          </ChartWrapper>
        </Card>

        {/* Pipeline */}
        <SectionHeader title="PIPELINE" />
        <Card style={{ marginBottom: s.s6, padding: s.s4, gap: s.s3 }}>
          {dashboard.pipeline.map(pipe => (
            <View key={pipe.status} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>{pipe.status}</Text>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>{pipe.count}</Text>
            </View>
          ))}
        </Card>

        {/* Needs Attention */}
        <SectionHeader title="NEEDS ATTENTION" />
        <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.elevation.e1, marginBottom: s.s6 }}>
          {dashboard.needsAttention.length === 0 ? (
            <View style={{ padding: s.s6, alignItems: 'center' }}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>All caught up!</Text>
            </View>
          ) : (
            dashboard.needsAttention.map((item, index) => (
              <React.Fragment key={item.id}>
                {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: s.s10 + s.s3 }} />}
                <ListRow
                  leading={<Badge variant={item.type === 'payment' ? 'danger' : 'warning'} dot />}
                  title={item.title}
                  subtitle={new Date(item.date).toLocaleDateString()}
                  onPress={() => {}}
                />
              </React.Fragment>
            ))
          )}
        </View>

        {/* Today's Departures */}
        <SectionHeader title="TODAY'S DEPARTURES" action="See all" onAction={() => navigation.navigate('Bookings')} />
        <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.elevation.e1, marginBottom: s.s6 }}>
          {dashboard.departures.length === 0 ? (
            <View style={{ padding: s.s6, alignItems: 'center' }}>
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>No departures today.</Text>
            </View>
          ) : (
            dashboard.departures.map((dep, index) => (
              <React.Fragment key={dep.id}>
                {index > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: s.s10 + s.s3 }} />}
                <ListRow
                  leading={<Plane color={theme.colors.text.tertiary} size={24} />}
                  title={dep.customerName}
                  subtitle={dep.itemName}
                  onPress={() => {}}
                />
              </React.Fragment>
            ))
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
