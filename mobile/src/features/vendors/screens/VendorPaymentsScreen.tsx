// FILE: mobile/src/features/vendors/screens/VendorPaymentsScreen.tsx
//
// Read-only payout log. A VendorPayment records money that already moved, so it
// has no Pending/Paid status — the real facet is itemType (what the payout was
// for). Recording a payout posts to the governed ledgers, so mobile does not write.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useVendorPayments,
  paymentItemName,
  VENDOR_ITEM_TYPES,
  VendorItemType,
  VendorPayment,
} from '../api';
import {
  FilterChipRow,
  ListRow,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Avatar,
  Button,
} from '../../../ui';
import { DollarSign, ArrowLeft } from 'lucide-react-native';
import { formatCurrency, formatDate } from '../../../lib/formatters';

const ALL = 'ALL';

export function VendorPaymentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [selected, setSelected] = useState<string>(ALL);
  const { data: payments, isLoading, isError, refetch } = useVendorPayments(
    selected === ALL ? undefined : (selected as VendorItemType),
  );

  const chips = useMemo(
    () => [
      { key: ALL, label: 'All', selected: selected === ALL },
      ...VENDOR_ITEM_TYPES.map((t) => ({
        key: t.key,
        label: t.label,
        selected: selected === t.key,
      })),
    ],
    [selected],
  );

  const renderItem = ({ item }: { item: VendorPayment }) => {
    const vendorName = item.vendor?.name || 'Vendor';
    const itemName = paymentItemName(item);
    const subtitle = [formatDate(item.paymentDate), itemName].filter(Boolean).join(' • ');

    return (
      <ListRow
        leading={<Avatar name={vendorName} />}
        title={vendorName}
        subtitle={subtitle}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
              {formatCurrency(item.amount)}
            </Text>
            {item.paymentMode ? <Badge label={item.paymentMode} variant="neutral" /> : null}
          </View>
        }
        accessibilityLabel={`Paid ${formatCurrency(item.amount)} to ${vendorName} on ${formatDate(
          item.paymentDate,
        )}${itemName ? ` for ${itemName}` : ''}`}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s4,
          paddingTop: s.s4,
          paddingBottom: s.s3,
        }}
      >
        <Button
          variant="icon"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text
          style={[
            theme.typography.largeTitle,
            { color: theme.colors.text.primary, marginLeft: s.s2 },
          ]}
        >
          Vendor Payouts
        </Text>
      </View>

      <View style={{ paddingBottom: s.s3 }}>
        <FilterChipRow chips={chips} onToggle={(key) => setSelected(key)} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load vendor payouts." onRetry={refetch} />
          </View>
        ) : !payments || payments.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No payouts"
            message="Vendor payments recorded on the web app will appear here."
          />
        ) : (
          <FL
            data={payments}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
              />
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
