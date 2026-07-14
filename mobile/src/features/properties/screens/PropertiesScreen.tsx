// FILE: mobile/src/features/properties/screens/PropertiesScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useProperties, formatPaise, getApiErrorMessage, Property, PropertyTab } from '../api';
import {
  Segmented,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
} from '../../../ui';
import { Home, Plus, MapPin } from 'lucide-react-native';

// Properties are stays (Hotel/Resort/Villa/…), not sale/rent listings — the
// backend's FOR_SALE/FOR_RENT tabs are dead branches (FOR_RENT is `where.id=null`).
const TABS: { label: string; value: PropertyTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function PropertiesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const {
    data: properties,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useProperties(TABS[tabIndex].value);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Property }) => (
    <Card
      style={{ padding: 0, overflow: 'hidden', marginBottom: s.s4 }}
      onPress={() => navigation.navigate('PropertyDetails', { propertyId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.propertyType}${item.location ? `, ${item.location}` : ''}`}
    >
      <View
        style={{
          height: 160,
          backgroundColor: theme.colors.bg.fill,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Home color={theme.colors.text.tertiary} size={40} />
        )}
      </View>
      <View style={{ padding: s.s3 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={[theme.typography.headline, { color: theme.colors.text.primary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s1 }}>
                <MapPin size={12} color={theme.colors.text.secondary} />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  {item.location}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: s.s2 }}>
            {!item.isActive ? <Badge label="Inactive" variant="danger" /> : null}
            <Badge label={item.propertyType} variant="info" />
          </View>
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
            {item.pricePerNight != null ? (
              <>
                {formatPaise(item.pricePerNight)}
                <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                  /night
                </Text>
              </>
            ) : (
              'On request'
            )}
          </Text>
          <Button
            variant="tinted"
            label="Edit"
            onPress={() => navigation.navigate('PropertyForm', { propertyId: item.id })}
            accessibilityLabel={`Edit ${item.name}`}
          />
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Properties
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
            {[1, 2].map((i) => (
              <Skeleton key={i} height={250} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            message={getApiErrorMessage(error, 'Could not load properties')}
            onRetry={refetch}
          />
        ) : !properties || properties.length === 0 ? (
          <EmptyState
            icon={Home}
            title="No properties found"
            message="Try adjusting your filters or add a new one."
            actionLabel="Add property"
            onAction={() => navigation.navigate('PropertyForm')}
          />
        ) : (
          <FL
            data={properties}
            renderItem={renderItem}
            estimatedItemSize={280}
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
          onPress={() => navigation.navigate('PropertyForm')}
          accessibilityLabel="Add property"
        />
      </View>
    </SafeAreaView>
  );
}
