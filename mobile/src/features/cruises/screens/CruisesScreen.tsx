// FILE: mobile/src/features/cruises/screens/CruisesScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useCruises,
  useDeactivateCruise,
  formatPaise,
  getApiErrorMessage,
  Cruise,
  CruiseTab,
} from '../api';
import {
  Segmented,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
  showToast,
} from '../../../ui';
import { Ship, Plus, Trash2 } from 'lucide-react-native';

const TABS: { label: string; value: CruiseTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function CruisesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const {
    data: cruises,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useCruises(TABS[tabIndex].value);
  const deactivate = useDeactivateCruise();

  const s = theme.spacing;

  const confirmDeactivate = (cruise: Cruise) => {
    Alert.alert('Deactivate cruise', `Deactivate "${cruise.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(cruise.id, {
            onSuccess: () => showToast('Cruise deactivated', 'success'),
            onError: (err) => showToast(getApiErrorMessage(err, 'Could not deactivate'), 'error'),
          }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Cruise }) => {
    const meta = [item.duration, item.departurePort].filter(Boolean).join(' • ');
    return (
      <Card style={{ padding: s.s3, marginBottom: s.s4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={[theme.typography.headline, { color: theme.colors.text.primary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              {item.cruiseLine ? <Badge label={item.cruiseLine} variant="info" /> : null}
              {!item.isActive ? <Badge label="Inactive" variant="danger" /> : null}
              {meta ? (
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  {meta}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            variant="icon"
            icon={Trash2}
            onPress={() => confirmDeactivate(item)}
            accessibilityLabel={`Deactivate ${item.name}`}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: s.s3,
          }}
        >
          <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
            {item.basePrice != null ? formatPaise(item.basePrice) : 'On request'}
          </Text>
          <Button
            variant="tinted"
            label="Edit"
            onPress={() => navigation.navigate('CruiseForm', { cruiseId: item.id })}
            accessibilityLabel={`Edit ${item.name}`}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Cruises
        </Text>
        <Segmented
          segments={TABS.map((t) => t.label)}
          selectedIndex={tabIndex}
          onChange={setTabIndex}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: s.s4 }}>
        {isLoading ? (
          <View style={{ gap: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load cruises')} onRetry={refetch} />
        ) : !cruises || cruises.length === 0 ? (
          <EmptyState
            icon={Ship}
            title="No cruises found"
            message="Try adjusting your filters or create a new one."
            actionLabel="New cruise"
            onAction={() => navigation.navigate('CruiseForm')}
          />
        ) : (
          <FL
            data={cruises}
            renderItem={renderItem}
            estimatedItemSize={120}
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
          onPress={() => navigation.navigate('CruiseForm')}
          accessibilityLabel="Create cruise"
        />
      </View>
    </SafeAreaView>
  );
}
