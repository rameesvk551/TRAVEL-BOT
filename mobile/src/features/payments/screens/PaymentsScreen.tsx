// FILE: mobile/src/features/payments/screens/PaymentsScreen.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { usePayments, PaymentTransaction } from '../api';
import { SearchBar, Segmented, SwipeableRow, ListRow, MetricCard, Skeleton, EmptyState, Badge, Button } from '../../../ui';
import { ArrowLeft, CreditCard, Receipt, Plus } from 'lucide-react-native';
import { RecordPaymentSheet } from './RecordPaymentSheet';

export function PaymentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: Successful, 1: Pending, 2: Failed
  
  const { data: payments, isLoading, refetch } = usePayments();
  const sheetRef = useRef<BottomSheet>(null);

  const s = theme.spacing;

  // Simple client-side filtering for the mock
  const filtered = payments?.filter(p => {
    if (filterType === 0) return p.status === 'successful';
    if (filterType === 1) return p.status === 'pending';
    return p.status === 'failed';
  });

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'upi': return <Badge variant="info" label="UPI" />;
      case 'card': return <Badge variant="neutral" label="Card" />;
      case 'bank_transfer': return <Badge variant="warning" label="Bank" />;
      default: return <Badge variant="neutral" label="Cash" />;
    }
  };

  const renderItem = ({ item }: { item: PaymentTransaction }) => {
    return (
      <SwipeableRow rightActions={[{ label: 'Receipt', color: theme.colors.status.info, icon: Receipt, onPress: () => {} }]}>
        <ListRow
          leading={<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.bg.fill, alignItems: 'center', justifyContent: 'center' }}><CreditCard size={20} color={theme.colors.text.secondary} /></View>}
          title={`₹${item.amount.toLocaleString('en-IN')}`}
          subtitle={`${item.customerName} · ${item.bookingRef}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              {getMethodIcon(item.method)}
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                {new Date(item.date).toLocaleDateString()}
              </Text>
            </View>
          }
          onPress={() => {}} 
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s2, paddingTop: s.s2, paddingBottom: s.s4 }}>
        <Button variant="plain" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginLeft: s.s2, flex: 1 }]}>Payments</Text>
      </View>

      <View style={{ paddingHorizontal: s.s4 }}>
        {/* Stat strip */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s4 }}>
          <View style={{ width: '48%' }}><MetricCard label="Received Today" value="₹12.5k" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Overdue" value="₹45k" /></View>
        </View>

        <View style={{ marginBottom: s.s4 }}>
          <Segmented segments={['Successful', 'Pending', 'Failed']} selectedIndex={filterType} onChange={setFilterType} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !filtered || filtered.length === 0 ? (
          <EmptyState icon={CreditCard} title="No transactions" message="No payments match this filter." />
        ) : (
          <FL
            data={filtered}
            renderItem={renderItem}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 72 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => sheetRef.current?.expand()} />
      </View>

      <RecordPaymentSheet ref={sheetRef} />
    </SafeAreaView>
  );
}
