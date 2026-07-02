// FILE: mobile/src/features/cruises/screens/CruisesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useCruises, Cruise } from '../api';
import { Segmented, Card, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { Ship, Plus } from 'lucide-react-native';

export function CruisesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: Active, 2: Inactive
  const statuses = ['All', 'Active', 'Inactive'];
  const { data: cruises, isLoading, refetch } = useCruises(statuses[status]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Cruise }) => {
    return (
      <Card style={{ padding: s.s3, marginBottom: s.s4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              <Badge label={item.line} variant="info" />
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{item.duration} • {item.port}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s.s3 }}>
          <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
            ₹{item.price.toLocaleString('en-IN')}
          </Text>
          <Button variant="tinted" label="Edit" onPress={() => navigation.navigate('CruiseForm', { cruiseId: item.id })} />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Cruises</Text>
        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: s.s4 }}>
        {isLoading ? (
          <View style={{ gap: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={100} />)}
          </View>
        ) : !cruises || cruises.length === 0 ? (
          <EmptyState icon={Ship} title="No cruises found" message="Try adjusting your filters or create a new one." />
        ) : (
          <FL
            data={cruises}
            renderItem={renderItem}
            estimatedItemSize={120}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('CruiseForm')} />
      </View>
    </SafeAreaView>
  );
}
