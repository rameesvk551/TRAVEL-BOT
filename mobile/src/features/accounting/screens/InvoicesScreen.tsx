// FILE: mobile/src/features/accounting/screens/InvoicesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useInvoices, Invoice } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar, Button } from '../../../ui';
import { FileText, Plus, ArrowLeft } from 'lucide-react-native';

export function InvoicesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Paid, 2: Unpaid, 3: Overdue
  const statuses = ['All', 'Paid', 'Unpaid', 'Overdue'];
  const { data: invoices, isLoading, refetch } = useInvoices(statuses[status]);

  const s = theme.spacing;

  const getStatusVariant = (s: string) => {
    if (s === 'Paid') return 'success';
    if (s === 'Overdue') return 'danger';
    return 'warning';
  };

  const renderItem = ({ item }: { item: Invoice }) => {
    return (
      <ListRow
        leading={<Avatar name={item.customerName} />}
        title={item.customerName}
        subtitle={`${item.invoiceNumber} • Due ${new Date(item.dueDate).toLocaleDateString()}`}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
               ₹{item.amount.toLocaleString('en-IN')}
             </Text>
             <Badge label={item.status} variant={getStatusVariant(item.status)} />
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
         <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Invoices</Text>
      </View>
      <View style={{ paddingHorizontal: s.s4, paddingVertical: s.s4 }}>
        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !invoices || invoices.length === 0 ? (
          <EmptyState icon={FileText} title="No invoices" message="Create an invoice to bill your customers." />
        ) : (
          <FL
            data={invoices}
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
