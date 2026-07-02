// FILE: mobile/src/features/campaigns/screens/CampaignDetailScreen.tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useCampaign } from '../api';
import { Button, SectionHeader, Card, Skeleton, Badge, MetricCard, ListRow } from '../../../ui';
import { ArrowLeft, Edit3, MessageCircle, Mail, MousePointerClick, Eye, Users } from 'lucide-react-native';

export function CampaignDetailScreen({ route, navigation }: any) {
  const { campaignId } = route.params;
  const { theme } = useTheme();
  const { data: campaign, isLoading } = useCampaign(campaignId);

  const s = theme.spacing;

  if (isLoading || !campaign) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <SafeAreaView edges={['top']}>
          <View style={{ padding: s.s4, gap: s.s4 }}>
             <Skeleton height={40} />
             <Skeleton height={150} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const Icon = campaign.type === 'WhatsApp' ? MessageCircle : Mail;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: theme.colors.bg.surface }}>
         <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
            <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
            {campaign.status !== 'Sent' && <Button variant="icon" icon={Edit3} onPress={() => navigation.navigate('CampaignForm', { campaignId: campaign.id })} />}
         </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border.hairline }}>
           <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s.s3 }}>
              <View style={{ width: 56, height: 56, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
                 <Icon size={24} color={campaign.type === 'WhatsApp' ? '#25D366' : theme.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>{campaign.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2 }}>
                   <Badge label={campaign.type} variant="info" />
                   <Badge label={campaign.status} variant={campaign.status === 'Sent' ? 'success' : 'neutral'} />
                   <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{new Date(campaign.date).toLocaleDateString()}</Text>
                </View>
              </View>
           </View>
        </View>

        {/* Content */}
        <View style={{ padding: s.s4, gap: s.s5 }}>
          
          {/* Performance Grid */}
          {campaign.status === 'Sent' && (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Performance" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                 <View style={{ width: '48%' }}><MetricCard label="Sent" value={campaign.sentCount.toLocaleString()} /></View>
                 <View style={{ width: '48%' }}><MetricCard label="Delivered" value={(campaign.sentCount * 0.98).toFixed(0)} /></View>
                 <View style={{ width: '48%' }}><MetricCard label="Opened" value={campaign.openCount?.toLocaleString() || 'N/A'} /></View>
                 <View style={{ width: '48%' }}><MetricCard label="Clicked" value={campaign.clickCount?.toLocaleString() || 'N/A'} /></View>
              </View>
            </View>
          )}

          {/* Details */}
          <View style={{ gap: s.s3 }}>
            <SectionHeader title="Audience & Content" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <ListRow leading={<Users size={20} color={theme.colors.text.tertiary}/>} title="Audience" subtitle="All Customers (1.5K)" />
              <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
              <ListRow leading={<Mail size={20} color={theme.colors.text.tertiary}/>} title="Template" subtitle="Diwali Offer V1" />
            </Card>
          </View>

          {/* Preview */}
          <View style={{ gap: s.s3 }}>
            <SectionHeader title="Preview" />
            <Card style={{ padding: s.s4 }}>
               <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                 Hi {'{{name}}'},{'\n\n'}
                 Special offer for you this Diwali! Get 20% off on all international bookings.{'\n\n'}
                 Book now: https://link.to/offer
               </Text>
            </Card>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}
