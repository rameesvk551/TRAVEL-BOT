// FILE: mobile/src/features/campaigns/screens/CampaignsScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useCampaigns, Campaign, CampaignStatus } from '../api';
import { Segmented, Badge, EmptyState, ErrorState, Skeleton, Button, MetricCard, Card } from '../../../ui';
import { Megaphone, Plus } from 'lucide-react-native';
import { formatDate } from '../../../lib/formatters';

const FILTERS: Array<{ label: string; value?: CampaignStatus }> = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Sent', value: 'SENT' },
];

/** BROADCAST → "Broadcast", RE_ENGAGEMENT → "Re engagement". */
export function humanizeEnum(value: string): string {
  if (!value) return '';
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusVariant(status: CampaignStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'SENT':
      return 'success';
    case 'SENDING':
      return 'info';
    case 'SCHEDULED':
      return 'warning';
    case 'FAILED':
      return 'danger';
    default:
      return 'neutral';
  }
}

/** The date that matters depends on where the campaign is in its life. */
function campaignDate(c: Campaign): string {
  return formatDate(c.sentAt || c.scheduledAt || c.createdAt);
}

export function CampaignsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterIndex, setFilterIndex] = useState(0);
  const { data, isLoading, isError, error, refetch, isRefetching } = useCampaigns(FILTERS[filterIndex].value);

  const s = theme.spacing;
  const campaigns = data?.data ?? [];
  const summary = data?.summary;

  const renderItem = ({ item }: { item: Campaign }) => (
    <Card
      style={{ padding: s.s3, marginBottom: s.s4, marginHorizontal: s.s4 }}
      onPress={() => navigation.navigate('CampaignDetail', { campaignId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${humanizeEnum(item.status)}, ${item.sent} sent`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: s.s3 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.bg.fill,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Megaphone size={20} color={theme.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              <Badge label={humanizeEnum(item.type)} variant="info" />
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                {campaignDate(item)}
              </Text>
            </View>
          </View>
        </View>
        <Badge label={humanizeEnum(item.status)} variant={statusVariant(item.status)} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: s.s3,
          paddingTop: s.s3,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.hairline,
        }}
      >
        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
          {item.sent.toLocaleString('en-IN')}{' '}
          <Text style={{ color: theme.colors.text.secondary }}>Sent</Text>
        </Text>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
          {item.delivered.toLocaleString('en-IN')}{' '}
          <Text style={{ color: theme.colors.text.secondary }}>Delivered</Text>
        </Text>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
          {item.read.toLocaleString('en-IN')}{' '}
          <Text style={{ color: theme.colors.text.secondary }}>Read</Text>
        </Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>
          Campaigns
        </Text>

        <View style={{ flexDirection: 'row', gap: s.s3, marginBottom: s.s4 }}>
          <View style={{ flex: 1 }}>
            <MetricCard label="Messages sent" value={(summary?.totalSent ?? 0).toLocaleString('en-IN')} />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard label="Delivered" value={(summary?.totalDelivered ?? 0).toLocaleString('en-IN')} />
          </View>
        </View>

        <Segmented segments={FILTERS.map((f) => f.label)} selectedIndex={filterIndex} onChange={setFilterIndex} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={120} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns" message="Start reaching out to your audience." />
        ) : (
          <FL
            data={campaigns}
            renderItem={renderItem}
            keyExtractor={(item: Campaign) => item.id}
            estimatedItemSize={140}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => navigation.navigate('CampaignForm')}
          accessibilityLabel="New campaign"
        />
      </View>
    </SafeAreaView>
  );
}
