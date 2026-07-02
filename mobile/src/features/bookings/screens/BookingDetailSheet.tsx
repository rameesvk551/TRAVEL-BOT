// FILE: mobile/src/features/bookings/screens/BookingDetailSheet.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useBooking } from '../api';
import { Badge, Button, Grabber, SectionHeader, Card, Skeleton, ListRow } from '../../../ui';
import { FileText, CreditCard, Edit3 } from 'lucide-react-native';

export interface BookingDetailSheetProps {
  bookingId: string | null;
}

export const BookingDetailSheet = React.forwardRef<BottomSheet, BookingDetailSheetProps>(
  ({ bookingId }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['60%', '95%'], []);
    
    const { data: booking, isLoading } = useBooking(bookingId || '');

    const s = theme.spacing;

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

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
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }}>
          {isLoading || !bookingId ? (
            <View style={{ gap: s.s4, marginTop: s.s4 }}>
              <Skeleton height={100} />
              <Skeleton height={200} />
            </View>
          ) : !booking ? (
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: s.s4 }]}>Booking not found</Text>
          ) : (
            <>
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: s.s6, marginTop: s.s2 }}>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary, marginBottom: 4 }]}>
                  {booking.ref}
                </Text>
                <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: 8 }]}>
                  ₹{booking.amount.toLocaleString('en-IN')}
                </Text>
                <Badge variant={booking.paymentStatus === 'paid' ? 'success' : booking.paymentStatus === 'due' ? 'danger' : 'warning'} label={booking.paymentStatus.toUpperCase()} />
              </View>

              {/* Facts Grid */}
              <SectionHeader title="DETAILS" />
              <Card style={{ padding: s.s4, marginBottom: s.s6 }}>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Customer</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{booking.customerName}</Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Item</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{booking.itemName}</Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Travel Date</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                    {new Date(booking.travelDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Travellers</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>2 Adults</Text>
                </View>
              </Card>

              {/* Payments */}
              <SectionHeader title="PAYMENTS" />
              <View style={{ backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, overflow: 'hidden', ...theme.elevation.e1, marginBottom: s.s6 }}>
                {booking.paymentStatus === 'paid' ? (
                  <View style={{ padding: s.s4, alignItems: 'center' }}>
                    <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>Fully paid</Text>
                  </View>
                ) : (
                  <>
                    <ListRow
                      title="Advance Paid"
                      subtitle="UPI · 12 May 2026"
                      trailing={<Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>₹10,000</Text>}
                    />
                    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />
                    <ListRow
                      title="Balance Due"
                      subtitle="By 15 Jun 2026"
                      trailing={<Text style={[theme.typography.body, { color: theme.colors.status.danger, fontWeight: '600' }]}>₹{(booking.amount - 10000).toLocaleString('en-IN')}</Text>}
                    />
                  </>
                )}
              </View>

              {/* Actions */}
              <Button variant="primary" label="Collect Payment" icon={CreditCard} fullWidth style={{ marginBottom: s.s3 }} />
              <View style={{ flexDirection: 'row', gap: s.s3 }}>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" label="Invoice" icon={FileText} fullWidth />
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" label="Edit" icon={Edit3} fullWidth />
                </View>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
});
