// FILE: mobile/src/features/customers/screens/CustomersScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useCustomers, customerStats, type Customer } from '../api';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { SearchBar, ListRow, Avatar, EmptyState, ErrorState, Skeleton } from '../../../ui';
import { Users } from 'lucide-react-native';

export function CustomersScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');

  const { data: customers, isLoading, isError, refetch, isRefetching } = useCustomers();

  const s = theme.spacing;

  // GET /customers takes no query params, so the search runs against the loaded
  // list rather than pretending the server filtered it.
  const visible = useMemo(() => {
    const list = customers ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((customer) =>
      [customer.name, customer.phone, customer.email]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term)),
    );
  }, [customers, search]);

  const renderItem = ({ item }: { item: Customer }) => {
    const stats = customerStats(item);
    const name = item.name || item.phone || 'Customer';

    return (
      <ListRow
        leading={<Avatar name={name} />}
        title={name}
        subtitle={item.phone ?? ''}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
            <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, fontWeight: '600' }]}>
              {formatCurrency(stats.totalBilled)}
            </Text>
            {stats.balanceDue > 0 ? (
              <Text style={[theme.typography.caption2, { color: theme.colors.status.danger, fontWeight: '600' }]}>
                Due: {formatCurrency(stats.balanceDue)}
              </Text>
            ) : (
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                {formatDate(item.createdAt)}
              </Text>
            )}
          </View>
        }
        onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id, customerName: name })}
        accessibilityLabel={`${name}, billed ${formatCurrency(stats.totalBilled)}${
          stats.balanceDue > 0 ? `, ${formatCurrency(stats.balanceDue)} due` : ''
        }`}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>
          Customers
        </Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search customers..." />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load your customers." onRetry={refetch} />
          </View>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            message={search ? 'Try a different search.' : 'Customers appear here once a lead converts.'}
          />
        ) : (
          <FL
            data={visible}
            renderItem={renderItem}
            keyExtractor={(item: Customer) => item.id}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: s.s4,
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
