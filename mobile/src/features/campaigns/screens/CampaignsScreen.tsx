// FILE: mobile/src/features/campaigns/screens/CampaignsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useCampaigns, Campaign } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Button, MetricCard, Card } from '../../../ui';
import { Megaphone, Plus, MessageCircle, Mail } from 'lucide-react-native';

export function CampaignsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Draft, 2: Scheduled, 3: Sent
  const statuses = ['All', 'Draft', 'Scheduled', 'Sent'];
  const { data: campaigns, isLoading, refetch } = useCampaigns(statuses[status]);

  const s = theme.spacing;

  const getStatusVariant = (s: string) => {
    if (s === 'Sent') return 'success';
    if (s === 'Scheduled') return 'warning';
    return 'neutral';
  };

  const renderItem = ({ item }: { item: Campaign }) => {
    const Icon = item.type === 'WhatsApp' ? MessageCircle : Mail;
    return (
      <Card style={{ padding: s.s3, marginBottom: s.s4, marginHorizontal: s.s4 }} onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: s.s3 }}>
            <View style={{ width: 44, height: 44, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
               <Icon size={20} color={item.type === 'WhatsApp' ? '#25D366' : theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
                <Badge label={item.type} variant="info" />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>
          <Badge label={item.status} variant={getStatusVariant(item.status)} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s.s3, paddingTop: s.s3, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
          <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
            {item.sentCount.toLocaleString()} <Text style={{ color: theme.colors.text.secondary }}>Sent</Text>
          </Text>
          {item.clickCount !== undefined && (
             <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
                {item.clickCount.toLocaleString()} <Text style={{ color: theme.colors.text.secondary }}>Clicks</Text>
             </Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Campaigns</Text>
        
        {/* KPI Grid */}
        <View style={{ flexDirection: 'row', gap: s.s3, marginBottom: s.s4 }}>
           <View style={{ flex: 1 }}><MetricCard label="Sent (30d)" value="15.2K" /></View>
           <View style={{ flex: 1 }}><MetricCard label="Clicks" value="4.1K" /></View>
        </View>

        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={120} />)}
          </View>
        ) : !campaigns || campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns" message="Start reaching out to your audience." />
        ) : (
          <FL
            data={campaigns}
            renderItem={renderItem}
            estimatedItemSize={140}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('CampaignForm')} />
      </View>
    </SafeAreaView>
  );
}
