// FILE: mobile/src/features/packages/screens/PackagesScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  usePackages,
  useDeactivatePackage,
  formatPaise,
  getApiErrorMessage,
  Package,
  PackageTab,
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
import { Map, Plus, Trash2, CreditCard } from 'lucide-react-native';

const TABS: { label: string; value: PackageTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Domestic', value: 'DOMESTIC' },
  { label: 'International', value: 'INTERNATIONAL' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function PackagesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const {
    data: packages,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePackages(TABS[tabIndex].value);
  const deactivate = useDeactivatePackage();

  const s = theme.spacing;

  const confirmDeactivate = (pkg: Package) => {
    Alert.alert('Deactivate package', `Deactivate "${pkg.name}"? It will stop showing to customers.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(pkg.id, {
            onSuccess: () => showToast('Package deactivated', 'success'),
            onError: (err) => showToast(getApiErrorMessage(err, 'Could not deactivate'), 'error'),
          }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Package }) => (
    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: s.s4 }}>
      <View
        style={{
          height: 120,
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
          <Map color={theme.colors.text.tertiary} size={32} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              {item.category ? <Badge label={item.category} variant="info" /> : null}
              {!item.isActive ? <Badge label="Inactive" variant="danger" /> : null}
              {item.duration ? (
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  {item.duration}
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
          <View style={{ flexDirection: 'row', gap: s.s2 }}>
            <Button
              variant="plain"
              label="Finance"
              icon={CreditCard}
              onPress={() => navigation.navigate('PackageFinance', { packageId: item.id })}
              accessibilityLabel={`Finance for ${item.name}`}
            />
            <Button
              variant="tinted"
              label="Edit"
              onPress={() => navigation.navigate('PackageForm', { packageId: item.id })}
              accessibilityLabel={`Edit ${item.name}`}
            />
          </View>
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
          Packages
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
              <Skeleton key={i} height={200} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load packages')} onRetry={refetch} />
        ) : !packages || packages.length === 0 ? (
          <EmptyState
            icon={Map}
            title="No packages found"
            message="Try adjusting your filters or create a new one."
            actionLabel="New package"
            onAction={() => navigation.navigate('PackageForm')}
          />
        ) : (
          <FL
            data={packages}
            renderItem={renderItem}
            estimatedItemSize={220}
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
          onPress={() => navigation.navigate('PackageForm')}
          accessibilityLabel="Create package"
        />
      </View>
    </SafeAreaView>
  );
}
