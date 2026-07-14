// FILE: mobile/src/features/referrals/screens/ReferralsScreen.tsx
// The backend models REFERRAL CODES owned by a referrer, not referrer→referred
// pairs, and redemptions are only counted (usedCount / maxUses). So this lists
// codes and filters them by active/inactive — the only status that actually exists.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useReferrals, useReferralStats, useToggleReferral, ReferralCode, formatReward } from '../api';
import { Segmented, ListRow, Badge, EmptyState, ErrorState, Skeleton, Avatar, MetricCard, Switch } from '../../../ui';
import { Gift } from 'lucide-react-native';
import { formatCurrency } from '../../../lib/formatters';

const FILTERS = ['All', 'Active', 'Paused'] as const;

export function ReferralsScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [filterIndex, setFilterIndex] = useState(0);
  const { data: codes, isLoading, isError, error, refetch, isRefetching } = useReferrals();
  const { data: stats } = useReferralStats();
  const toggleMutation = useToggleReferral();

  // The list route takes no filter param, so this narrows client-side.
  const visible = useMemo(() => {
    const all = codes ?? [];
    if (FILTERS[filterIndex] === 'Active') return all.filter((c) => c.isActive);
    if (FILTERS[filterIndex] === 'Paused') return all.filter((c) => !c.isActive);
    return all;
  }, [codes, filterIndex]);

  const renderItem = ({ item }: { item: ReferralCode }) => {
    const referrer = item.customer?.name ?? 'Unknown customer';

    return (
      <ListRow
        leading={<Avatar name={referrer} />}
        title={referrer}
        subtitle={
          <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]} numberOfLines={1}>
            {item.code} · {formatReward(item)} · {item.usedCount}/{item.maxUses} used
          </Text>
        }
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
              {formatCurrency(item.revenueGenerated)}
            </Text>
            <Switch
              value={item.isActive}
              onValueChange={() => toggleMutation.mutate(item.id)}
              label={`Enable code ${item.code}`}
            />
          </View>
        }
        accessibilityLabel={`Referral code ${item.code} from ${referrer}, ${item.usedCount} of ${item.maxUses} used, ${
          item.isActive ? 'active' : 'paused'
        }`}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>
          Referrals
        </Text>

        <View style={{ flexDirection: 'row', gap: s.s3, marginBottom: s.s4 }}>
          <View style={{ flex: 1 }}>
            <MetricCard label="Redemptions" value={(stats?.totalUses ?? 0).toLocaleString('en-IN')} />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard label="Revenue" value={formatCurrency(stats?.totalRevenue ?? 0)} />
          </View>
        </View>

        <Segmented segments={[...FILTERS]} selectedIndex={filterIndex} onChange={setFilterIndex} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No referral codes"
            message="Give your customers a code to share and track what it brings in."
          />
        ) : (
          <FL
            data={visible}
            renderItem={renderItem}
            keyExtractor={(item: ReferralCode) => item.id}
            estimatedItemSize={80}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: 16,
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
