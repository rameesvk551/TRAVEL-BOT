// FILE: mobile/src/features/quotations/screens/QuotationsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useQuotations, Quotation } from '../api';
import { Segmented, SwipeableRow, ListRow, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { FileText, Plus, MessageCircle, Download } from 'lucide-react-native';

export function QuotationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Draft, 2: Sent, 3: Accepted, 4: Rejected
  const statuses = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected'];
  const { data: quotations, isLoading, refetch } = useQuotations(statuses[status]);

  const s = theme.spacing;

  const getStatusVariant = (s: string) => {
    if (s === 'Accepted') return 'success';
    if (s === 'Rejected') return 'danger';
    if (s === 'Sent') return 'info';
    return 'neutral';
  };

  const renderItem = ({ item }: { item: Quotation }) => {
    return (
      <SwipeableRow
        leftActions={[
          { label: 'PDF', color: theme.colors.status.info, icon: Download, onPress: () => {} }
        ]}
        rightActions={[
          { label: 'Send', color: '#25D366', icon: MessageCircle, onPress: () => {} }
        ]}
      >
        <ListRow
          title={item.customerName}
          subtitle={`${item.number} • ${new Date(item.date).toLocaleDateString()}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                ₹{item.amount.toLocaleString('en-IN')}
              </Text>
              <Badge label={item.status} variant={getStatusVariant(item.status)} />
            </View>
          }
          onPress={() => navigation.navigate('QuotationForm', { quotationId: item.id })}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Quotations</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: s.s4 }}>
           <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !quotations || quotations.length === 0 ? (
          <EmptyState icon={FileText} title="No quotations" message="Create an estimate to send to a customer." />
        ) : (
          <FL
            data={quotations}
            renderItem={renderItem}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('QuotationForm')} />
      </View>
    </SafeAreaView>
  );
}
