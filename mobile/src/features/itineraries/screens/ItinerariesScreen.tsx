// FILE: mobile/src/features/itineraries/screens/ItinerariesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useItineraries, Itinerary } from '../api';
import { Segmented, SwipeableRow, ListRow, Badge, EmptyState, Skeleton, Button, Card } from '../../../ui';
import { Map, Plus, Copy, Trash2 } from 'lucide-react-native';

export function ItinerariesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Draft, 2: Sent, 3: Accepted, 4: Rejected
  const statuses = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected'];
  const { data: itineraries, isLoading, refetch } = useItineraries(statuses[status]);

  const s = theme.spacing;

  const getStatusVariant = (s: string) => {
    if (s === 'Accepted') return 'success';
    if (s === 'Rejected') return 'danger';
    if (s === 'Sent') return 'info';
    return 'neutral';
  };

  const renderItem = ({ item }: { item: Itinerary }) => {
    return (
      <SwipeableRow
        leftActions={[
          { label: 'Duplicate', color: theme.colors.accent, icon: Copy, onPress: () => {} },
          { label: 'Delete', color: theme.colors.status.danger, icon: Trash2, onPress: () => {} },
        ]}
      >
        <Card style={{ padding: s.s3, marginBottom: s.s4, marginHorizontal: s.s4 }} onPress={() => navigation.navigate('ItineraryBuilder', { itineraryId: item.id })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: 2 }]}>{item.client}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
                <Badge label={item.destination} variant="info" />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
            </View>
            <Badge label={item.status} variant={getStatusVariant(item.status)} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s.s3 }}>
            <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
              ₹{item.price.toLocaleString('en-IN')}
            </Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.status.success }]}>{item.margin}% Margin</Text>
          </View>
        </Card>
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Itineraries</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: s.s4 }}>
           <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={120} />)}
          </View>
        ) : !itineraries || itineraries.length === 0 ? (
          <EmptyState icon={Map} title="No itineraries" message="Create an itinerary to send to a customer." />
        ) : (
          <FL
            data={itineraries}
            renderItem={renderItem}
            estimatedItemSize={140}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('ItineraryBuilder')} />
      </View>
    </SafeAreaView>
  );
}
