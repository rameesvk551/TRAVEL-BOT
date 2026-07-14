// FILE: mobile/src/features/bookings/screens/BookingDetailSheet.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useBooking,
  Booking,
  bookingItemName,
  bookingBalanceDue,
  bookingBalanceAtProperty,
  bookingAgencyRevenue,
  bookingPaymentStatus,
  isCommissionOnly,
  apiErrorMessage,
} from '../api';
import { useRequestPaymentLink, apiErrorMessage as paymentsErrorMessage } from '../../payments/api';
import { Badge, Button, Grabber, SectionHeader, Card, Skeleton, ErrorState, ListRow } from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import { CreditCard } from 'lucide-react-native';

export interface BookingDetailSheetProps {
  bookingId: string | null;
}

function Fact({ label, value, emphasis }: { label: string; value: string; emphasis?: 'danger' | 'muted' }) {
  const { theme } = useTheme();
  return (
    <View style={styles.factRow}>
      <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 130 }]}>
        {label}
      </Text>
      <Text
        style={[
          theme.typography.body,
          {
            flex: 1,
            color:
              emphasis === 'danger'
                ? theme.colors.status.danger
                : emphasis === 'muted'
                  ? theme.colors.text.secondary
                  : theme.colors.text.primary,
            fontWeight: emphasis === 'danger' ? '600' : '400',
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export const BookingDetailSheet = React.forwardRef<BottomSheet, BookingDetailSheetProps>(
  ({ bookingId }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['60%', '95%'], []);

    const { data: booking, isLoading, isError, error, refetch } = useBooking(bookingId);
    const { mutate: requestPaymentLink, isPending: isSendingLink } = useRequestPaymentLink();

    const s = theme.spacing;

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      [],
    );

    const handleRequestPayment = (b: Booking) => {
      requestPaymentLink(
        { bookingId: b.id },
        {
          onSuccess: () => showToast('Payment link sent on WhatsApp', 'success'),
          onError: (err) =>
            showToast(paymentsErrorMessage(err, 'Could not send the payment link'), 'error'),
        },
      );
    };

    const renderBody = () => {
      if (!bookingId || isLoading) {
        return (
          <View style={{ gap: s.s4, marginTop: s.s4 }}>
            <Skeleton height={100} />
            <Skeleton height={200} />
          </View>
        );
      }

      if (isError || !booking) {
        return (
          <View style={{ marginTop: s.s4 }}>
            <ErrorState
              message={apiErrorMessage(error, 'Could not load this booking')}
              onRetry={refetch}
            />
          </View>
        );
      }

      const commissionOnly = isCommissionOnly(booking);
      const balanceDue = bookingBalanceDue(booking);
      const balanceAtProperty = bookingBalanceAtProperty(booking);
      const agencyRevenue = bookingAgencyRevenue(booking);
      const paymentStatus = bookingPaymentStatus(booking);
      const payments = booking.payments ?? [];

      const paymentBadgeVariant =
        paymentStatus === 'PAID' ? 'success' : paymentStatus === 'DUE' ? 'danger' : 'warning';

      return (
        <>
          {/* Header — the hero figure is what the AGENCY earns, which on a commission-only
              booking is the commission, not the package's face value. */}
          <View style={{ alignItems: 'center', marginBottom: s.s6, marginTop: s.s2 }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary, marginBottom: 4 }]}>
              {booking.bookingRef}
            </Text>
            <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: 4 }]}>
              {formatCurrency(agencyRevenue)}
            </Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary, marginBottom: 8 }]}>
              {commissionOnly ? 'Your commission' : 'Booking total'}
            </Text>
            <View style={{ flexDirection: 'row', gap: s.s2 }}>
              <Badge variant={paymentBadgeVariant} label={paymentStatus} />
              <Badge
                variant={commissionOnly ? 'info' : 'neutral'}
                label={commissionOnly ? 'Commission only' : 'Agency collects'}
              />
            </View>
          </View>

          <SectionHeader title="DETAILS" />
          <Card style={{ padding: s.s4, marginBottom: s.s6 }}>
            <Fact label="Customer" value={booking.customer?.name ?? '—'} />
            <Fact label="Item" value={bookingItemName(booking)} />
            <Fact label="Travel date" value={booking.travelDate ? formatDate(booking.travelDate) : '—'} />
            <Fact
              label="Travellers"
              value={booking.travellers ? String(booking.travellers) : '—'}
            />
            <Fact label="Status" value={booking.status} />
          </Card>

          <SectionHeader title="MONEY" />
          <Card style={{ padding: s.s4, marginBottom: s.s6 }}>
            <Fact label="Package value" value={formatCurrency(booking.totalAmount)} />
            <Fact label="Collected" value={formatCurrency(booking.advancePaid)} />
            {commissionOnly ? (
              <>
                <Fact label="Your commission" value={formatCurrency(booking.commissionAmount ?? booking.advancePaid)} />
                {/* Off-ledger: the customer settles this directly at the property. It prints on
                    the invoice but is never owed to — or collectable by — the agency. */}
                <Fact
                  label="Paid at property"
                  value={`${formatCurrency(balanceAtProperty)} — by the customer`}
                  emphasis="muted"
                />
              </>
            ) : null}
            <Fact
              label="Balance due"
              value={balanceDue > 0 ? formatCurrency(balanceDue) : 'Nothing outstanding'}
              emphasis={balanceDue > 0 ? 'danger' : 'muted'}
            />
          </Card>

          <SectionHeader title="PAYMENTS" />
          <View
            style={{
              backgroundColor: theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              overflow: 'hidden',
              ...theme.elevation.e1,
              marginBottom: s.s6,
            }}
          >
            {payments.length === 0 ? (
              <View style={{ padding: s.s4, alignItems: 'center' }}>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                  No payments recorded yet
                </Text>
              </View>
            ) : (
              payments.map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: theme.colors.border.hairline,
                        marginLeft: 16,
                      }}
                    />
                  )}
                  <ListRow
                    title={formatCurrency(p.amount)}
                    subtitle={`${p.type} · ${formatDate(p.paidAt ?? p.createdAt)}`}
                    trailing={
                      <Badge
                        variant={
                          p.status === 'PAID'
                            ? 'success'
                            : p.status === 'PENDING'
                              ? 'warning'
                              : 'danger'
                        }
                        label={p.status}
                      />
                    }
                    accessibilityLabel={`Payment of ${formatCurrency(p.amount)}, ${p.type}, ${p.status}`}
                  />
                </React.Fragment>
              ))
            )}
          </View>

          {/* A payment link can only be raised for money the agency is actually owed. */}
          {balanceDue > 0 && (
            <Button
              variant="primary"
              label="Send payment link"
              icon={CreditCard}
              fullWidth
              loading={isSendingLink}
              onPress={() => handleRequestPayment(booking)}
              accessibilityLabel={`Send a payment link for ${formatCurrency(balanceDue)}`}
            />
          )}
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
        backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }}
        >
          {renderBody()}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
});
