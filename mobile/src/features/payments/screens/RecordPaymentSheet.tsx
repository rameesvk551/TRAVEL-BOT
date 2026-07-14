// FILE: mobile/src/features/payments/screens/RecordPaymentSheet.tsx
//
// This used to be a manual "record a payment" form (amount + method + reference).
// The backend has no endpoint for that: a Payment row is only ever created by
// POST /payments/request, which mints a Razorpay payment link for the booking's
// outstanding balance and WhatsApps it to the customer — it accepts a bookingId and
// nothing else. So the sheet asks for the one input the API actually takes: which booking.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useRequestPaymentLink, apiErrorMessage } from '../api';
import {
  useBookings,
  Booking,
  bookingBalanceDue,
  bookingItemName,
  isCommissionOnly,
} from '../../bookings/api';
import {
  Button,
  Grabber,
  SectionHeader,
  Card,
  ListRow,
  Skeleton,
  EmptyState,
  ErrorState,
  Badge,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatCurrency } from '../../../lib/formatters';
import { Check, CreditCard } from 'lucide-react-native';

export interface RecordPaymentSheetProps {
  /** Preselect a booking when the sheet is opened from a booking context. */
  bookingId?: string;
}

export const RecordPaymentSheet = React.forwardRef<BottomSheet, RecordPaymentSheetProps>(
  ({ bookingId }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['70%', '90%'], []);
    const s = theme.spacing;

    const [selectedId, setSelectedId] = useState<string | undefined>(bookingId);

    const { data, isLoading, isError, error, refetch } = useBookings();
    const { mutate: requestPaymentLink, isPending } = useRequestPaymentLink();

    // A payment link can only be raised for money the AGENCY is owed. On a commission-only
    // booking the property balance is settled directly by the customer, so once the
    // commission is in, balanceDue is zero and the booking is correctly absent from here.
    const collectable = useMemo(
      () => (data?.bookings ?? []).filter((b) => bookingBalanceDue(b) > 0),
      [data?.bookings],
    );

    const selected = collectable.find((b) => b.id === selectedId);

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      [],
    );

    const handleSend = () => {
      if (!selected) return;
      requestPaymentLink(
        { bookingId: selected.id },
        {
          onSuccess: () => {
            showToast(`Payment link sent to ${selected.customer?.name ?? 'the customer'}`, 'success');
            setSelectedId(undefined);
            // @ts-ignore — forwarded ref is a BottomSheet instance
            ref?.current?.close();
          },
          onError: (err) =>
            showToast(apiErrorMessage(err, 'Could not send the payment link'), 'error'),
        },
      );
    };

    const renderBooking = (booking: Booking, index: number) => {
      const due = bookingBalanceDue(booking);
      const isSelected = booking.id === selectedId;
      const customerName = booking.customer?.name ?? 'Unknown customer';

      return (
        <React.Fragment key={booking.id}>
          {index > 0 && (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.border.hairline,
                marginLeft: 16,
              }}
            />
          )}
          <ListRow
            title={customerName}
            subtitle={`${booking.bookingRef} · ${bookingItemName(booking)}`}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      theme.typography.subhead,
                      { color: theme.colors.text.primary, fontWeight: '600' },
                    ]}
                  >
                    {formatCurrency(due)}
                  </Text>
                  {isCommissionOnly(booking) && <Badge variant="info" label="Comm." />}
                </View>
                {isSelected && <Check size={20} color={theme.colors.accent} />}
              </View>
            }
            onPress={() => setSelectedId(booking.id)}
            accessibilityLabel={`${customerName}, booking ${booking.bookingRef}, ${formatCurrency(
              due,
            )} due${isSelected ? ', selected' : ''}`}
            accessibilityHint="Selects this booking for a payment link"
          />
        </React.Fragment>
      );
    };

    const renderBody = () => {
      if (isLoading) {
        return (
          <View style={{ gap: s.s3 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={64} />
            ))}
          </View>
        );
      }

      if (isError) {
        return (
          <ErrorState
            message={apiErrorMessage(error, 'Could not load bookings')}
            onRetry={refetch}
          />
        );
      }

      if (collectable.length === 0) {
        return (
          <View style={{ height: 260 }}>
            <EmptyState
              icon={CreditCard}
              title="Nothing to collect"
              message="Every booking is settled. A payment link can only be raised against an outstanding balance."
            />
          </View>
        );
      }

      return (
        <>
          <Card style={{ overflow: 'hidden' }}>{collectable.map(renderBooking)}</Card>

          {selected && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: s.s4,
                padding: s.s4,
                backgroundColor: theme.colors.bg.surface,
                borderRadius: theme.radius.md,
              }}
            >
              <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                Link amount
              </Text>
              <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
                {formatCurrency(bookingBalanceDue(selected))}
              </Text>
            </View>
          )}

          <Button
            variant="primary"
            label="Send payment link"
            icon={CreditCard}
            fullWidth
            style={{ marginTop: s.s6 }}
            loading={isPending}
            disabled={!selected}
            onPress={handleSend}
            accessibilityLabel={
              selected
                ? `Send a payment link for ${formatCurrency(bookingBalanceDue(selected))}`
                : 'Select a booking to send a payment link'
            }
          />
        </>
      );
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleComponent={Grabber}
        keyboardBehavior="extend"
        backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ marginBottom: s.s4, marginTop: s.s2 }}>
            <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>
              Send payment link
            </Text>
            <Text
              style={[theme.typography.caption2, { color: theme.colors.text.secondary, marginTop: 4 }]}
            >
              The customer gets a Razorpay link on WhatsApp for the balance they owe.
            </Text>
          </View>

          <SectionHeader title="BOOKINGS WITH A BALANCE" />
          {renderBody()}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);
