// FILE: mobile/src/features/vendors/screens/VendorPaymentsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useVendorPayments, VendorPayment } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar, Button } from '../../../ui';
import { DollarSign, ArrowLeft } from 'lucide-react-native';

export function VendorPaymentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Pending, 2: Paid
  const statuses = ['All', 'Pending', 'Paid'];
  const { data: payments, isLoading, refetch } = useVendorPayments(statuses[status]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: VendorPayment }) => {
    return (
      <ListRow
        leading={<Avatar name={item.vendorName} />}
        title={item.vendorName}
        subtitle={new Date(item.date).toLocaleDateString()}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
               ₹{item.amount.toLocaleString('en-IN')}
             </Text>
             <Badge label={item.status} variant={item.status === 'Paid' ? 'success' : 'warning'} />
          </View>
        }
        onPress={() => {}}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingTop: s.s4 }}>
         <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
         <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Vendor Payouts</Text>
      </View>
      <View style={{ paddingHorizontal: s.s4, paddingVertical: s.s4 }}>
        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !payments || payments.length === 0 ? (
          <EmptyState icon={DollarSign} title="No payments" message="No vendor payments found." />
        ) : (
          <FL
            data={payments}
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
