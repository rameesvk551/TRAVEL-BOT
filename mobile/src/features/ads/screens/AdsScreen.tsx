// FILE: mobile/src/features/ads/screens/AdsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAds, AdCampaign } from '../api';
import { Card, Badge, EmptyState, Skeleton, MetricCard, SectionHeader, ListRow } from '../../../ui';
import { BarChart3, Globe, Activity } from 'lucide-react-native';

export function AdsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data: ads, isLoading, refetch } = useAds();

  const s = theme.spacing;

  const totalSpend = ads?.reduce((sum, ad) => sum + ad.spend, 0) || 0;
  const totalLeads = ads?.reduce((sum, ad) => sum + ad.leads, 0) || 0;
  const avgCPA = totalLeads > 0 ? (totalSpend / totalLeads) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Ads Manager</Text>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
              {[1, 2, 3, 4].map(i => <View key={i} style={{ width: '48%' }}><Skeleton height={100} /></View>)}
            </View>
            <Skeleton height={200} />
          </View>
        ) : !ads || ads.length === 0 ? (
          <EmptyState icon={BarChart3} title="No active ads" message="Connect your ad accounts to see performance." />
        ) : (
          <View style={{ gap: s.s5 }}>
            {/* KPI Grid */}
            <View style={{ paddingHorizontal: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
               <View style={{ width: '48%' }}><MetricCard label="Total Spend (30d)" value={`₹${totalSpend.toLocaleString('en-IN')}`} /></View>
               <View style={{ width: '48%' }}><MetricCard label="Total Leads" value={totalLeads.toLocaleString('en-IN')} /></View>
               <View style={{ width: '48%' }}><MetricCard label="Avg CPA" value={`₹${avgCPA.toFixed(0)}`} /></View>
               <View style={{ width: '48%' }}><MetricCard label="Active Campaigns" value={ads.filter(a => a.status === 'Active').length} /></View>
            </View>

            <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
              <SectionHeader title="Campaign Performance" />
              {ads.map(ad => (
                <Card key={ad.id} style={{ padding: 0, overflow: 'hidden' }}>
                  <ListRow 
                    leading={<Activity size={20} color={theme.colors.accent} />}
                    title={ad.name}
                    subtitle={
                      <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                         <Badge label={ad.platform} variant="info" />
                         <Badge label={ad.status} variant={ad.status === 'Active' ? 'success' : 'neutral'} />
                      </View>
                    }
                  />
                  <View style={{ padding: s.s4, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between' }}>
                     <View>
                        <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Spend</Text>
                        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: 2 }]}>₹{ad.spend.toLocaleString('en-IN')}</Text>
                     </View>
                     <View>
                        <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Clicks</Text>
                        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: 2 }]}>{ad.clicks.toLocaleString()}</Text>
                     </View>
                     <View>
                        <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Leads</Text>
                        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: 2 }]}>{ad.leads.toLocaleString()}</Text>
                     </View>
                     <View>
                        <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>CPA</Text>
                        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: 2 }]}>₹{(ad.leads > 0 ? ad.spend / ad.leads : 0).toFixed(0)}</Text>
                     </View>
                  </View>
                </Card>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
