// FILE: mobile/src/features/vendors/screens/VendorsScreen.tsx
//
// Read-only vendor list. "Due" is the sum of each vendor's unpaid bills
// (amount - paidAmount), in integer paise — the vendor record itself carries no
// balance. Creating vendors/bills/payments posts to the governed ledgers, so
// mobile does not write.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useVendors, useVendorTypes, VendorWithOutstanding } from '../api';
import {
  FilterChipRow,
  ListRow,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Avatar,
} from '../../../ui';
import { Store } from 'lucide-react-native';
import { formatCurrency, formatPhone } from '../../../lib/formatters';

const ALL = 'ALL';

export function VendorsScreen() {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [selected, setSelected] = useState<string>(ALL);
  const types = useVendorTypes();
  const { data: vendors, isLoading, isError, refetch } = useVendors(
    selected === ALL ? undefined : selected,
  );

  const chips = useMemo(
    () => [
      { key: ALL, label: 'All', selected: selected === ALL },
      ...(types.data ?? []).map((t) => ({
        key: t.name,
        label: t.name,
        selected: selected === t.name,
      })),
    ],
    [types.data, selected],
  );

  const renderItem = ({ item }: { item: VendorWithOutstanding }) => {
    const contact = formatPhone(item.phone) || item.email || '';
    const due = item.outstanding;

    return (
      <ListRow
        leading={<Avatar name={item.name} />}
        title={item.name}
        subtitle={contact}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {item.type ? <Badge label={item.type} variant="info" /> : null}
            {due > 0 ? (
              <Text
                style={[
                  theme.typography.subhead,
                  { color: theme.colors.status.danger, fontWeight: '600' },
                ]}
              >
                Due {formatCurrency(due)}
              </Text>
            ) : (
              <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                Settled
              </Text>
            )}
          </View>
        }
        accessibilityLabel={`${item.name}${item.type ? `, ${item.type}` : ''}, ${
          due > 0 ? `${formatCurrency(due)} outstanding` : 'settled'
        }`}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s3 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>
          Vendors
        </Text>
      </View>

      <View style={{ paddingBottom: s.s3 }}>
        <FilterChipRow chips={chips} onToggle={(key) => setSelected(key)} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load vendors." onRetry={refetch} />
          </View>
        ) : !vendors || vendors.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No vendors"
            message="Suppliers added on the web app will appear here."
          />
        ) : (
          <FL
            data={vendors}
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
