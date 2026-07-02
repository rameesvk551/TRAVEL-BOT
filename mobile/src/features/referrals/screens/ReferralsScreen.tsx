// FILE: mobile/src/features/referrals/screens/ReferralsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useReferrals, Referral } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar } from '../../../ui';
import { Gift } from 'lucide-react-native';

export function ReferralsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Pending, 2: Converted
  const statuses = ['All', 'Pending', 'Converted'];
  const { data: referrals, isLoading, refetch } = useReferrals(statuses[status]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Referral }) => {
    return (
      <ListRow
        leading={<Avatar name={item.referrerName} />}
        title={item.referrerName}
        subtitle={`Referred: ${item.referredName}`}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
               ₹{item.rewardAmount.toLocaleString('en-IN')}
             </Text>
             <Badge label={item.status} variant={item.status === 'Converted' ? 'success' : 'warning'} />
          </View>
        }
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Referrals</Text>
        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !referrals || referrals.length === 0 ? (
          <EmptyState icon={Gift} title="No referrals" message="Encourage your customers to refer others." />
        ) : (
          <FL
            data={referrals}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
