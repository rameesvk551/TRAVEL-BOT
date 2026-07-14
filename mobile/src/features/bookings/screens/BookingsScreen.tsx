// FILE: mobile/src/features/bookings/screens/BookingsScreen.tsx
import React, { useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useBookings,
  Booking,
  BookingStatus,
  bookingItemName,
  bookingPaymentStatus,
  bookingBalanceDue,
  isCommissionOnly,
  apiErrorMessage,
} from '../api';
import { useRequestPaymentLink, apiErrorMessage as paymentsErrorMessage } from '../../payments/api';
import {
  SearchBar,
  Segmented,
  SwipeableRow,
  ListRow,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { formatCurrency, formatDate } from '../../../lib/formatters';
import {
  Briefcase,
  Plus,
  CreditCard,
  Package,
  Home,
  Ship,
  FileCheck,
  ConciergeBell,
} from 'lucide-react-native';
import { BookingDetailSheet } from './BookingDetailSheet';

// The API filters by status server-side; these are the real enum values.
const STATUS_FILTERS: Array<BookingStatus | undefined> = [undefined, 'CONFIRMED', 'PENDING'];

export function BookingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: All, 1: Confirmed, 2: Pending
  const [search, setSearch] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const detailSheetRef = useRef<BottomSheet>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useBookings(
    STATUS_FILTERS[filterType],
  );
  const { mutate: requestPaymentLink } = useRequestPaymentLink();

  const s = theme.spacing;

  // The bookings API has no free-text search param, so match locally on the fields
  // a user would actually type: the customer's name and the booking reference.
  const bookings = useMemo(() => {
    const all = data?.bookings ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (b) =>
        (b.customer?.name || '').toLowerCase().includes(q) ||
        (b.bookingRef || '').toLowerCase().includes(q),
    );
  }, [data?.bookings, search]);

  const openBookingDetail = (id: string) => {
    setSelectedBookingId(id);
    detailSheetRef.current?.expand();
  };

  const handleRequestPayment = (booking: Booking) => {
    requestPaymentLink(
      { bookingId: booking.id },
      {
        onSuccess: () => showToast(`Payment link sent to ${booking.customer?.name ?? 'customer'}`, 'success'),
        onError: (err) => showToast(paymentsErrorMessage(err, 'Could not send the payment link'), 'error'),
      },
    );
  };

  const getIconForType = (type: Booking['itemType']) => {
    switch (type) {
      case 'PACKAGE': return Package;
      case 'PROPERTY': return Home;
      case 'CRUISE': return Ship;
      case 'VISA': return FileCheck;
      case 'SERVICE': return ConciergeBell;
      default: return Briefcase;
    }
  };

  const getPaymentBadge = (booking: Booking) => {
    switch (bookingPaymentStatus(booking)) {
      case 'PAID': return { variant: 'success' as const, label: 'Paid' };
      case 'PARTIAL': return { variant: 'warning' as const, label: 'Partial' };
      default: return { variant: 'danger' as const, label: 'Due' };
    }
  };

  const renderBookingRow = ({ item }: { item: Booking }) => {
    const TypeIcon = getIconForType(item.itemType);
    const paymentBadge = getPaymentBadge(item);
    const customerName = item.customer?.name ?? 'Unknown customer';
    const commissionOnly = isCommissionOnly(item);
    // Only offer a payment link when the agency is actually owed something. On a settled
    // COMMISSION_ONLY booking this is zero — the rest is paid at the property.
    const canCollect = bookingBalanceDue(item) > 0;

    return (
      <SwipeableRow
        rightActions={
          canCollect
            ? [
                {
                  label: 'Payment link',
                  color: theme.colors.status.success,
                  icon: CreditCard,
                  onPress: () => handleRequestPayment(item),
                },
              ]
            : undefined
        }
      >
        <ListRow
          leading={<Avatar name={customerName} />}
          title={customerName}
          subtitle={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <TypeIcon size={14} color={theme.colors.text.secondary} />
              <Text
                style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}
                numberOfLines={1}
              >
                {bookingItemName(item)}
                {item.travelDate ? ` · ${formatDate(item.travelDate)}` : ''}
              </Text>
            </View>
          }
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text
                style={[
                  theme.typography.subhead,
                  { color: theme.colors.text.primary, fontWeight: '600' },
                ]}
              >
                {formatCurrency(item.totalAmount)}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {commissionOnly && <Badge variant="info" label="Comm." />}
                <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                  {item.bookingRef}
                </Text>
                <Badge variant={paymentBadge.variant} dot />
              </View>
            </View>
          }
          onPress={() => openBookingDetail(item.id)}
          accessibilityLabel={`Booking ${item.bookingRef} for ${customerName}, ${formatCurrency(
            item.totalAmount,
          )}, ${paymentBadge.label}${commissionOnly ? ', commission only' : ''}`}
          accessibilityHint="Opens the booking details"
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Bookings
        </Text>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by customer or ref..." />

        <View style={{ marginTop: s.s4 }}>
          <Segmented
            segments={['All', 'Confirmed', 'Pending']}
            selectedIndex={filterType}
            onChange={setFilterType}
          />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState
              message={apiErrorMessage(error, 'Could not load bookings')}
              onRetry={refetch}
            />
          </View>
        ) : bookings.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={search ? 'No matching bookings' : 'No bookings yet'}
            message={
              search
                ? 'No booking matches that customer or reference.'
                : 'Create your first booking to see it here.'
            }
            actionLabel={search ? undefined : 'New booking'}
            onAction={search ? undefined : () => navigation.navigate('BookingForm')}
          />
        ) : (
          <FL
            data={bookings}
            renderItem={renderBookingRow}
            keyExtractor={(item: Booking) => item.id}
            estimatedItemSize={76}
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
                  marginLeft: 16,
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
          onPress={() => navigation.navigate('BookingForm')}
          accessibilityLabel="New booking"
          accessibilityHint="Opens the new booking form"
        />
      </View>

      <BookingDetailSheet ref={detailSheetRef} bookingId={selectedBookingId} />
    </SafeAreaView>
  );
}
