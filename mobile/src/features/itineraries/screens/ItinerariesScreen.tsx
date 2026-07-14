// FILE: mobile/src/features/itineraries/screens/ItinerariesScreen.tsx
import React, { useMemo, useState } from 'react';
import { View, Text, Alert, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useItineraries,
  useDeleteItinerary,
  useSendItineraryWhatsApp,
  formatPaise,
  marginPercent,
  getApiErrorMessage,
  ITINERARY_STATUSES,
  STATUS_LABELS,
  type Itinerary,
  type ItineraryStatus,
} from '../api';
import {
  Segmented, SwipeableRow, Badge, EmptyState, ErrorState, Skeleton, Button, Card,
} from '../../../ui';
import { Map, Plus, Send, Trash2 } from 'lucide-react-native';

const FL = FlashList as any;

// 'ALL' first, then the real backend enum. The mock offered Accepted/Rejected,
// which the backend has never had — filtering by them always returned nothing.
const FILTERS: Array<ItineraryStatus | 'ALL'> = ['ALL', ...ITINERARY_STATUSES];
const FILTER_LABELS = ['All', ...ITINERARY_STATUSES.map((s) => STATUS_LABELS[s])];

function statusVariant(status: ItineraryStatus): 'success' | 'info' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'SENT') return 'info';
  return 'neutral';
}

export function ItinerariesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [filterIndex, setFilterIndex] = useState(0);
  const status = FILTERS[filterIndex];

  const { data: itineraries, isLoading, isError, error, refetch, isRefetching } = useItineraries(status);
  const deleteItinerary = useDeleteItinerary();
  const sendWhatsApp = useSendItineraryWhatsApp();

  const confirmDelete = (item: Itinerary) => {
    Alert.alert('Delete itinerary?', `"${item.name}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteItinerary.mutate(item.id, {
            onError: (err) => Alert.alert('Could not delete', getApiErrorMessage(err)),
          }),
      },
    ]);
  };

  const confirmSend = (item: Itinerary) => {
    const to = item.customer?.name || item.customer?.phone;
    if (!to) {
      Alert.alert('No customer attached', 'Attach a customer to this itinerary before sending it on WhatsApp.');
      return;
    }

    Alert.alert('Send on WhatsApp?', `The itinerary PDF will be sent to ${to}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: () =>
          sendWhatsApp.mutate(item.id, {
            onSuccess: () => Alert.alert('Sent', `The itinerary was sent to ${to}.`),
            onError: (err) => Alert.alert('Could not send', getApiErrorMessage(err)),
          }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Itinerary }) => {
    const customerName = item.customer?.name || item.customer?.phone || 'No customer attached';
    const travelDate = item.travelStartDate
      ? new Date(item.travelStartDate).toLocaleDateString()
      : null;

    // totalCost is only populated by the desktop cost editor, so it's usually 0
    // — and a 0 cost would render a triumphant "100% margin" on every row. Only
    // show margin when a cost actually exists.
    const showMargin = (item.totalCost ?? 0) > 0;

    return (
      <SwipeableRow
        rightActions={[
          { label: 'Send', color: theme.colors.accent, icon: Send, onPress: () => confirmSend(item) },
          { label: 'Delete', color: theme.colors.status.danger, icon: Trash2, onPress: () => confirmDelete(item) },
        ]}
      >
        <Card
          style={{ padding: s.s3, marginBottom: s.s3, marginHorizontal: s.s4 }}
          onPress={() => navigation.navigate('ItineraryBuilder', { itineraryId: item.id })}
          accessibilityLabel={`${item.name}, ${customerName}, ${formatPaise(item.totalPrice)}, ${STATUS_LABELS[item.status]}`}
          accessibilityHint="Opens the itinerary"
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: s.s2 }}>
              <Text
                style={[theme.typography.headline, { color: theme.colors.text.primary }]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: 2 }]}
                numberOfLines={1}
              >
                {customerName}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s1, gap: s.s2 }}>
                {item.destination ? <Badge label={item.destination} variant="info" /> : null}
                {travelDate ? (
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                    {travelDate}
                  </Text>
                ) : null}
              </View>
            </View>

            <Badge label={STATUS_LABELS[item.status]} variant={statusVariant(item.status)} />
          </View>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: s.s3,
            }}
          >
            <Text
              style={[
                theme.typography.title3,
                { color: theme.colors.text.primary, fontVariant: ['tabular-nums'] },
              ]}
            >
              {formatPaise(item.totalPrice)}
            </Text>
            {showMargin && (
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                {marginPercent(item)}% margin
              </Text>
            )}
          </View>
        </Card>
      </SwipeableRow>
    );
  };

  const body = useMemo(() => {
    if (isLoading) {
      return (
        <View style={{ gap: s.s3, paddingHorizontal: s.s4 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={120} />
          ))}
        </View>
      );
    }

    if (isError) {
      return (
        <ErrorState
          title="Couldn't load itineraries"
          message={getApiErrorMessage(error)}
          onRetry={refetch}
        />
      );
    }

    if (!itineraries || itineraries.length === 0) {
      return (
        <EmptyState
          icon={Map}
          title={status === 'ALL' ? 'No itineraries yet' : `No ${STATUS_LABELS[status as ItineraryStatus].toLowerCase()} itineraries`}
          message="Build an itinerary and send it to a customer on WhatsApp."
        />
      );
    }

    return (
      <FL
        data={itineraries}
        renderItem={renderItem}
        estimatedItemSize={140}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
      />
    );
  }, [isLoading, isError, error, itineraries, status, isRefetching, theme]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Itineraries
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Segmented segments={FILTER_LABELS} selectedIndex={filterIndex} onChange={setFilterIndex} />
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>{body}</View>

      <Button
        variant="fab"
        icon={Plus}
        accessibilityLabel="New itinerary"
        onPress={() => navigation.navigate('ItineraryBuilder')}
      />
    </SafeAreaView>
  );
}
