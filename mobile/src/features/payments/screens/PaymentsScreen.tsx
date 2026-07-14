// FILE: mobile/src/features/payments/screens/PaymentsScreen.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { usePayments, useSendReceipt, Payment, PaymentStatus, apiErrorMessage } from '../api';
import { useBookings } from '../../bookings/api';
import {
  Segmented,
  SwipeableRow,
  ListRow,
  MetricCard,
  Skeleton,
  EmptyState,
  ErrorState,
  Badge,
  Button,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { ArrowLeft, CreditCard, Receipt, Plus } from 'lucide-react-native';
import { RecordPaymentSheet } from './RecordPaymentSheet';

// `status` is a real server-side query param on GET /payments.
const STATUS_FILTERS: PaymentStatus[] = ['PAID', 'PENDING', 'FAILED'];

export function PaymentsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: Paid, 1: Pending, 2: Failed

  const status = STATUS_FILTERS[filterType];
  const { data, isLoading, isError, error, refetch, isRefetching } = usePayments(status);
  const { mutate: sendReceipt } = useSendReceipt();

  // Settlement-aware money totals already computed by the bookings endpoint — the payments
  // list itself is status-filtered, so it can't be summed into a meaningful headline.
  const { data: bookingData } = useBookings();

  const sheetRef = useRef<BottomSheet>(null);
  const s = theme.spacing;

  const payments = data?.payments ?? [];

  const handleSendReceipt = (payment: Payment) => {
    sendReceipt(
      { paymentId: payment.id },
      {
        onSuccess: () => showToast('Receipt sent on WhatsApp', 'success'),
        onError: (err) => showToast(apiErrorMessage(err, 'Could not send the receipt'), 'error'),
      },
    );
  };

  const statusVariant = (paymentStatus: PaymentStatus) => {
    switch (paymentStatus) {
      case 'PAID': return 'success' as const;
      case 'PENDING': return 'warning' as const;
      case 'REFUNDED': return 'info' as const;
      default: return 'danger' as const; // FAILED, EXPIRED
    }
  };

  const renderItem = ({ item }: { item: Payment }) => {
    const customerName = item.booking?.customer?.name ?? 'Unknown customer';
    const bookingRef = item.booking?.bookingRef ?? '—';
    // A receipt only exists for money actually received.
    const canSendReceipt = item.status === 'PAID';

    return (
      <SwipeableRow
        rightActions={
          canSendReceipt
            ? [
                {
                  label: 'Receipt',
                  color: theme.colors.status.info,
                  icon: Receipt,
                  onPress: () => handleSendReceipt(item),
                },
              ]
            : undefined
        }
      >
        <ListRow
          leading={
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.bg.fill,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CreditCard size={20} color={theme.colors.text.secondary} />
            </View>
          }
          title={formatCurrency(item.amount)}
          subtitle={`${customerName} · ${bookingRef}`}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge variant={statusVariant(item.status)} label={item.type} />
              <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                {formatDate(item.paidAt ?? item.createdAt)}
              </Text>
            </View>
          }
          accessibilityLabel={`${formatCurrency(item.amount)} ${item.type} payment for ${customerName}, booking ${bookingRef}, ${item.status}`}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: s.s2,
          paddingTop: s.s2,
          paddingBottom: s.s4,
        }}
      >
        <Button
          variant="plain"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        />
        <Text
          style={[
            theme.typography.title2,
            { color: theme.colors.text.primary, marginLeft: s.s2, flex: 1 },
          ]}
        >
          Payments
        </Text>
      </View>

      <View style={{ paddingHorizontal: s.s4 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2, marginBottom: s.s4 }}>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Collected"
              value={formatCurrency(bookingData?.stats.totalAdvancePaid ?? 0)}
            />
          </View>
          <View style={{ width: '48%' }}>
            <MetricCard
              label="Outstanding"
              value={formatCurrency(bookingData?.stats.totalBalanceDue ?? 0)}
              invertDelta
            />
          </View>
        </View>

        <View style={{ marginBottom: s.s4 }}>
          <Segmented
            segments={['Paid', 'Pending', 'Failed']}
            selectedIndex={filterType}
            onChange={setFilterType}
          />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState
              message={apiErrorMessage(error, 'Could not load payments')}
              onRetry={refetch}
            />
          </View>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No transactions"
            message="No payments match this filter."
          />
        ) : (
          <FL
            data={payments}
            renderItem={renderItem}
            keyExtractor={(item: Payment) => item.id}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.colors.accent}
              />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: 72,
                }}
              />
            )}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => sheetRef.current?.expand()}
          accessibilityLabel="Send a payment link"
          accessibilityHint="Choose a booking and send its payment link to the customer"
        />
      </View>

      <RecordPaymentSheet ref={sheetRef} />
    </SafeAreaView>
  );
}
