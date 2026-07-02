// FILE: mobile/src/features/customers/screens/CustomersScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useCustomers, Customer } from '../api';
import { SearchBar, ListRow, Avatar, EmptyState, Skeleton, Button } from '../../../ui';
import { Users, Plus } from 'lucide-react-native';

export function CustomersScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [search, setSearch] = useState('');
  
  const { data: customers, isLoading, refetch } = useCustomers(search);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Customer }) => {
    return (
      <ListRow
        leading={<Avatar name={item.name} imageUri={item.avatarUrl} />}
        title={item.name}
        subtitle={item.phone}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, fontWeight: '600' }]}>
              ₹{item.totalBilled.toLocaleString('en-IN')}
            </Text>
            {item.balanceDue > 0 ? (
              <Text style={[theme.typography.caption2, { color: theme.colors.status.danger, fontWeight: '600' }]}>
                Due: ₹{item.balanceDue.toLocaleString('en-IN')}
              </Text>
            ) : (
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        }
        onPress={() => navigation.navigate('CustomerDetail', { customerId: item.id, customerName: item.name })}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Customers</Text>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search customers..." />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !customers || customers.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" message="Try adjusting your search." />
        ) : (
          <FL
            data={customers}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}
