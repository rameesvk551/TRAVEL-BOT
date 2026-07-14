// FILE: mobile/src/features/ads/screens/AdsScreen.tsx
// Meta Ads only — the backend has no Google Ads provider.
//
// NO TREND CHART HERE ON PURPOSE: /ads/campaigns/:id/insights returns a single
// aggregate row (the backend's normalizeInsights collapses Meta's response to
// source[0]), so there is no daily series to plot. Rather than fabricate one,
// spend is compared ACROSS campaigns as a bar chart, which the data does support.

import React from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAdCampaigns, AdCampaign, formatAdMoney } from '../api';
import {
  Card,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  MetricCard,
  SectionHeader,
  ListRow,
  BarChart,
  type BarDatum,
} from '../../../ui';
import { BarChart3, Activity } from 'lucide-react-native';

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'warning';
  return 'neutral';
}

function titleCase(value: string): string {
  if (!value) return 'Unknown';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function AdsScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const { data: ads, isLoading, isError, error, refetch, isRefetching } = useAdCampaigns();

  const campaigns = ads ?? [];
  const totalSpend = campaigns.reduce((sum, ad) => sum + (ad.insights?.spend ?? 0), 0);
  const totalLeads = campaigns.reduce((sum, ad) => sum + (ad.leadCount ?? 0), 0);
  const totalClicks = campaigns.reduce((sum, ad) => sum + (ad.insights?.clicks ?? 0), 0);
  const avgCPA = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const activeCount = campaigns.filter((a) => (a.status || '').toUpperCase() === 'ACTIVE').length;

  // Spend by campaign. Nominal: these are just identities, not good/bad — so one
  // hue, and bar length carries the magnitude.
  const spendBars: BarDatum[] = campaigns
    .filter((a) => (a.insights?.spend ?? 0) > 0)
    .sort((a, b) => (b.insights?.spend ?? 0) - (a.insights?.spend ?? 0))
    .slice(0, 6)
    .map((a) => ({ label: a.name, value: a.insights?.spend ?? 0 }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Ads</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={{ width: '48%' }}>
                  <Skeleton height={100} />
                </View>
              ))}
            </View>
            <Skeleton height={200} />
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No ad campaigns"
            message="Connect your Meta ad account on the web app to see performance here."
          />
        ) : (
          <View style={{ gap: s.s5 }}>
            {/* Totals */}
            <View style={{ paddingHorizontal: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
              <View style={{ width: '48%' }}>
                <MetricCard label="Total spend" value={formatAdMoney(totalSpend)} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Leads" value={totalLeads.toLocaleString('en-IN')} />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Cost per lead" value={formatAdMoney(avgCPA)} invertDelta />
              </View>
              <View style={{ width: '48%' }}>
                <MetricCard label="Active campaigns" value={activeCount.toLocaleString('en-IN')} />
              </View>
            </View>

            {/* Spend comparison */}
            {spendBars.length > 1 && (
              <View style={{ paddingHorizontal: s.s4, gap: s.s3 }}>
                <SectionHeader title="Spend by campaign" />
                <Card>
                  <BarChart data={spendBars} variant="nominal" formatValue={formatAdMoney} />
                </Card>
              </View>
            )}

            {/* Per-campaign detail */}
            <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
              <SectionHeader title="Campaigns" />
              {campaigns.map((ad: AdCampaign) => {
                const spend = ad.insights?.spend ?? 0;
                const clicks = ad.insights?.clicks ?? 0;
                const leads = ad.leadCount ?? 0;
                const cpa = leads > 0 ? spend / leads : 0;

                return (
                  <Card key={ad.id} style={{ padding: 0, overflow: 'hidden' }}>
                    <ListRow
                      leading={<Activity size={20} color={theme.colors.accent} />}
                      title={ad.name}
                      subtitle={
                        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                          <Badge label={titleCase(ad.status)} variant={statusVariant(ad.status)} />
                          {ad.objective ? <Badge label={titleCase(ad.objective)} variant="info" /> : null}
                        </View>
                      }
                    />
                    <View
                      style={{
                        padding: s.s4,
                        paddingTop: 0,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      {[
                        { label: 'Spend', value: formatAdMoney(spend) },
                        { label: 'Clicks', value: clicks.toLocaleString('en-IN') },
                        { label: 'Leads', value: leads.toLocaleString('en-IN') },
                        { label: 'CPA', value: formatAdMoney(cpa) },
                      ].map((stat) => (
                        <View key={stat.label}>
                          <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                            {stat.label}
                          </Text>
                          <Text
                            style={[
                              theme.typography.subhead,
                              { color: theme.colors.text.primary, marginTop: 2, fontVariant: ['tabular-nums'] },
                            ]}
                          >
                            {stat.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                );
              })}
            </View>

            <Text
              style={[
                theme.typography.caption2,
                { color: theme.colors.text.tertiary, textAlign: 'center', paddingHorizontal: s.s4 },
              ]}
            >
              {totalClicks.toLocaleString('en-IN')} clicks across {campaigns.length} campaigns.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
