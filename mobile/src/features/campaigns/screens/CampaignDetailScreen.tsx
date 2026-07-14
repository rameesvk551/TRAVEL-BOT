// FILE: mobile/src/features/campaigns/screens/CampaignDetailScreen.tsx
import React from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCampaign,
  useCampaignStats,
  useSendCampaign,
  useCancelCampaign,
  Campaign,
} from '../api';
import {
  Button,
  SectionHeader,
  Card,
  Skeleton,
  Badge,
  MetricCard,
  ListRow,
  ErrorState,
  BarChart,
  AreaChart,
  type BarDatum,
} from '../../../ui';
import { ArrowLeft, Edit3, Megaphone, Users, FileText, Send, Ban } from 'lucide-react-native';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import { humanizeEnum } from './CampaignsScreen';

/** Only DRAFT/SCHEDULED campaigns can still be edited or sent. */
const EDITABLE: Campaign['status'][] = ['DRAFT', 'SCHEDULED'];

function statusVariant(status: Campaign['status']): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
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

export function CampaignDetailScreen({ route, navigation }: any) {
  const { campaignId } = route.params;
  const { theme } = useTheme();
  const s = theme.spacing;

  const { data: campaign, isLoading, isError, error, refetch, isRefetching } = useCampaign(campaignId);

  // Stats only exist once a campaign has recipients — skip the call for drafts.
  const hasRun = campaign ? !EDITABLE.includes(campaign.status) : false;
  const { data: statsResult } = useCampaignStats(campaignId, hasRun);

  const sendMutation = useSendCampaign();
  const cancelMutation = useCancelCampaign();

  const confirmSend = () => {
    Alert.alert('Send campaign?', `This sends "${campaign?.name}" to its full audience now.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        style: 'default',
        onPress: () =>
          sendMutation.mutate(campaignId, {
            onError: (e: any) =>
              Alert.alert('Could not send', e?.response?.data?.error ?? e?.message ?? 'Please try again.'),
          }),
      },
    ]);
  };

  const confirmCancel = () => {
    Alert.alert('Cancel campaign?', 'Scheduled delivery will be stopped.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel campaign',
        style: 'destructive',
        onPress: () =>
          cancelMutation.mutate(campaignId, {
            onError: (e: any) =>
              Alert.alert('Could not cancel', e?.response?.data?.error ?? e?.message ?? 'Please try again.'),
          }),
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <SafeAreaView edges={['top']}>
          <View style={{ padding: s.s4, gap: s.s4 }}>
            <Skeleton height={40} />
            <Skeleton height={150} />
            <Skeleton height={120} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (isError || !campaign) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
        </View>
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const stats = statsResult?.stats;
  const timeline = statsResult?.timeline ?? [];

  // Part-to-whole delivery breakdown → bars, never a donut. These genuinely mean
  // good/bad, so the status palette is the honest choice here.
  const deliveryBars: BarDatum[] = stats
    ? [
        { label: 'Sent', value: stats.sent, status: 'neutral' },
        { label: 'Delivered', value: stats.delivered, status: 'success' },
        { label: 'Read', value: stats.read, status: 'info' },
        { label: 'Failed', value: stats.failed, status: 'danger' },
      ]
    : [];

  const canEdit = EDITABLE.includes(campaign.status);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.bg.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
          <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
          {canEdit && (
            <Button
              variant="icon"
              icon={Edit3}
              onPress={() => navigation.navigate('CampaignForm', { campaignId: campaign.id })}
              accessibilityLabel="Edit campaign"
            />
          )}
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {/* Header */}
        <View
          style={{
            padding: s.s4,
            backgroundColor: theme.colors.bg.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.border.hairline,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s.s3 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.bg.fill,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Megaphone size={24} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>{campaign.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2, flexWrap: 'wrap' }}>
                <Badge label={humanizeEnum(campaign.type)} variant="info" />
                <Badge label={humanizeEnum(campaign.status)} variant={statusVariant(campaign.status)} />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  {formatDateTime(campaign.sentAt || campaign.scheduledAt || campaign.createdAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ padding: s.s4, gap: s.s5 }}>
          {/* Outcomes */}
          {stats && (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Outcomes" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Recipients" value={stats.total.toLocaleString('en-IN')} />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Clicked" value={stats.clicked.toLocaleString('en-IN')} />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Leads" value={stats.leads.toLocaleString('en-IN')} />
                </View>
                <View style={{ width: '48%' }}>
                  <MetricCard label="Bookings" value={stats.bookings.toLocaleString('en-IN')} />
                </View>
                <View style={{ width: '100%' }}>
                  <MetricCard label="Revenue attributed" value={formatCurrency(stats.revenue)} />
                </View>
              </View>
            </View>
          )}

          {/* Delivery breakdown */}
          {stats && (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Delivery" />
              <Card>
                <BarChart
                  data={deliveryBars}
                  variant="status"
                  formatValue={(v) => v.toLocaleString('en-IN')}
                />
              </Card>
            </View>
          )}

          {/* Real hourly send timeline from GET /campaigns/:id/stats */}
          {timeline.length > 1 && (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Messages delivered over time" />
              <Card>
                <AreaChart
                  data={timeline.map((t) => ({
                    label: new Date(t.hour).toLocaleTimeString('en-IN', { hour: 'numeric' }),
                    value: t.delivered,
                  }))}
                  formatValue={(v) => v.toLocaleString('en-IN')}
                  accessibilityLabel="Messages delivered per hour after send"
                />
              </Card>
            </View>
          )}

          {/* Audience & content */}
          <View style={{ gap: s.s3 }}>
            <SectionHeader title="Audience & content" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow
                leading={<Users size={20} color={theme.colors.text.tertiary} />}
                title="Audience"
                subtitle={`${(campaign.audienceCount || campaign.totalRecipients || 0).toLocaleString('en-IN')} contacts`}
              />
              <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
              <ListRow
                leading={<FileText size={20} color={theme.colors.text.tertiary} />}
                title="Template"
                subtitle={campaign.template?.displayName ?? 'Custom message'}
              />
            </Card>
          </View>

          {/* Message preview */}
          {campaign.messageBody ? (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Preview" />
              <Card>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                  {campaign.messageBody}
                </Text>
              </Card>
            </View>
          ) : null}

          {/* Actions */}
          {campaign.status === 'DRAFT' && (
            <Button
              variant="primary"
              label="Send now"
              icon={Send}
              fullWidth
              loading={sendMutation.isPending}
              onPress={confirmSend}
              accessibilityLabel="Send campaign now"
            />
          )}
          {campaign.status === 'SCHEDULED' && (
            <Button
              variant="destructive"
              label="Cancel campaign"
              icon={Ban}
              fullWidth
              loading={cancelMutation.isPending}
              onPress={confirmCancel}
              accessibilityLabel="Cancel scheduled campaign"
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}
