// FILE: mobile/src/features/bookings/screens/BookingsScreen.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useBookings, Booking } from '../api';
import { SearchBar, Segmented, FilterChipRow, SwipeableRow, ListRow, Avatar, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { Briefcase, Plus, CreditCard, FileText, Package, Home, Ship, FileCheck, ConciergeBell } from 'lucide-react-native';
import { BookingDetailSheet } from './BookingDetailSheet';

export function BookingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: All, 1: Confirmed, 2: Pending
  const [search, setSearch] = useState('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const detailSheetRef = useRef<BottomSheet>(null);
  
  const filterNames = ['all', 'confirmed', 'pending'];
  const { data: bookings, isLoading, refetch } = useBookings(filterNames[filterType]);

  const s = theme.spacing;

  const openBookingDetail = (id: string) => {
    setSelectedBookingId(id);
    detailSheetRef.current?.expand();
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'package': return Package;
      case 'property': return Home;
      case 'cruise': return Ship;
      case 'visa': return FileCheck;
      case 'service': return ConciergeBell;
      default: return Briefcase;
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid': return { variant: 'success' as const, label: 'Paid' };
      case 'partial': return { variant: 'warning' as const, label: 'Partial' };
      case 'due': return { variant: 'danger' as const, label: 'Due' };
      default: return { variant: 'neutral' as const, label: status };
    }
  };

  const renderBookingRow = ({ item }: { item: Booking }) => {
    const TypeIcon = getIconForType(item.type);
    const paymentBadge = getPaymentBadge(item.paymentStatus);

    return (
      <SwipeableRow
        leftActions={[
          { label: 'Invoice', color: theme.colors.status.info, icon: FileText, onPress: () => {} },
        ]}
        rightActions={[
          { label: 'Pay', color: theme.colors.status.success, icon: CreditCard, onPress: () => {} },
        ]}
      >
        <ListRow
          leading={<Avatar name={item.customerName} imageUri={item.avatarUrl} />}
          title={item.customerName}
          subtitle={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <TypeIcon size={14} color={theme.colors.text.secondary} />
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                {item.itemName}
              </Text>
            </View>
          }
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, fontWeight: '600' }]}>
                ₹{item.amount.toLocaleString('en-IN')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>{item.ref}</Text>
                <Badge variant={paymentBadge.variant} dot />
              </View>
            </View>
          }
          onPress={() => openBookingDetail(item.id)}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Bookings</Text>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by customer or ref..." />
        
        <View style={{ marginTop: s.s4 }}>
          <Segmented segments={['All', 'Confirmed', 'Pending']} selectedIndex={filterType} onChange={setFilterType} />
        </View>
      </View>

      <View style={{ paddingVertical: s.s2 }}>
        <FilterChipRow
          chips={[
            { key: 'type', label: 'Item Type', selected: false },
            { key: 'customer', label: 'Customer', selected: false },
            { key: 'date', label: 'Travel Date', selected: false },
          ]}
          onToggle={() => {}}
          onFilterPress={() => {}}
        />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !bookings || bookings.length === 0 ? (
          <EmptyState icon={Briefcase} title="No bookings found" message="Try adjusting your filters or search." />
        ) : (
          <FL
            data={bookings}
            renderItem={renderBookingRow}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('BookingForm')} />
      </View>

      <BookingDetailSheet ref={detailSheetRef} bookingId={selectedBookingId} />
    </SafeAreaView>
  );
}
