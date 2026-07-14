// FILE: mobile/src/features/quotations/screens/QuotationsScreen.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useQuotations,
  useSendQuotationWhatsApp,
  Quotation,
  QuotationStatus,
  quotationCustomerName,
  formatRupees,
  apiErrorMessage,
} from '../api';
import {
  Segmented,
  SwipeableRow,
  ListRow,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatDate } from '../../../lib/formatters';
import { FileText, Plus, MessageCircle } from 'lucide-react-native';

// GET /quotations ignores query params, so the status filter is applied client-side.
const STATUS_FILTERS: Array<QuotationStatus | undefined> = [
  undefined,
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
];
const STATUS_LABELS = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected'];

export function QuotationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [statusIndex, setStatusIndex] = useState(0);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuotations();
  const { mutate: sendWhatsApp } = useSendQuotationWhatsApp();

  const s = theme.spacing;

  const quotations = useMemo(() => {
    const all = data ?? [];
    const status = STATUS_FILTERS[statusIndex];
    return status ? all.filter((q) => q.status === status) : all;
  }, [data, statusIndex]);

  const getStatusVariant = (status: QuotationStatus) => {
    switch (status) {
      case 'ACCEPTED': return 'success' as const;
      case 'REJECTED': return 'danger' as const;
      case 'SENT': return 'info' as const;
      default: return 'neutral' as const; // DRAFT
    }
  };

  const handleSend = (quotation: Quotation) => {
    sendWhatsApp(
      { id: quotation.id },
      {
        onSuccess: () => showToast('Quotation sent on WhatsApp', 'success'),
        onError: (err) => showToast(apiErrorMessage(err, 'Could not send the quotation'), 'error'),
      },
    );
  };

  const renderItem = ({ item }: { item: Quotation }) => {
    const customerName = quotationCustomerName(item);

    return (
      <SwipeableRow
        rightActions={[
          {
            label: 'Send',
            color: theme.colors.status.success,
            icon: MessageCircle,
            onPress: () => handleSend(item),
          },
        ]}
      >
        <ListRow
          title={customerName}
          subtitle={`${item.quotationNumber} · ${formatDate(item.date)}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                {formatRupees(item.totalAmount)}
              </Text>
              <Badge label={item.status} variant={getStatusVariant(item.status)} />
            </View>
          }
          onPress={() => navigation.navigate('QuotationForm', { quotationId: item.id })}
          accessibilityLabel={`Quotation ${item.quotationNumber} for ${customerName}, ${formatRupees(
            item.totalAmount,
          )}, ${item.status}`}
          accessibilityHint="Opens the quotation"
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Quotations
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: s.s4 }}
        >
          <Segmented
            segments={STATUS_LABELS}
            selectedIndex={statusIndex}
            onChange={setStatusIndex}
          />
        </ScrollView>
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
            <ErrorState
              message={apiErrorMessage(error, 'Could not load quotations')}
              onRetry={refetch}
            />
          </View>
        ) : quotations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotations"
            message="Create an estimate to send to a customer."
            actionLabel="New quotation"
            onAction={() => navigation.navigate('QuotationForm')}
          />
        ) : (
          <FL
            data={quotations}
            renderItem={renderItem}
            keyExtractor={(item: Quotation) => item.id}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
              />
            }
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => navigation.navigate('QuotationForm')}
          accessibilityLabel="New quotation"
          accessibilityHint="Opens the new quotation form"
        />
      </View>
    </SafeAreaView>
  );
}
