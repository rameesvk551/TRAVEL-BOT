// FILE: mobile/src/features/visas/screens/VisasScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useVisas,
  useDeactivateVisa,
  formatPaise,
  getApiErrorMessage,
  Visa,
  VisaTab,
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
import { FileText, Plus, Trash2 } from 'lucide-react-native';

const TABS: { label: string; value: VisaTab }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Inactive', value: 'INACTIVE' },
];

export function VisasScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0);
  const {
    data: visas,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useVisas(TABS[tabIndex].value);
  const deactivate = useDeactivateVisa();

  const s = theme.spacing;

  const confirmDeactivate = (visa: Visa) => {
    Alert.alert('Deactivate visa', `Deactivate the ${visa.country} visa?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(visa.id, {
            onSuccess: () => showToast('Visa deactivated', 'success'),
            onError: (err) => showToast(getApiErrorMessage(err, 'Could not deactivate'), 'error'),
          }),
      },
    ]);
  };

  const renderItem = ({ item }: { item: Visa }) => (
    <Card style={{ padding: s.s3, marginBottom: s.s4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: s.s3 }}>
          {/* The Visa model has no `flag` column — show the uploaded image, else an icon. */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.sm,
              backgroundColor: theme.colors.bg.fill,
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
            }}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <FileText color={theme.colors.text.tertiary} size={20} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[theme.typography.headline, { color: theme.colors.text.primary }]}
              numberOfLines={1}
            >
              {item.country}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              {item.visaType ? <Badge label={item.visaType} variant="info" /> : null}
              {!item.isActive ? <Badge label="Inactive" variant="danger" /> : null}
              {item.processingTime ? (
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  {item.processingTime}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <Button
          variant="icon"
          icon={Trash2}
          onPress={() => confirmDeactivate(item)}
          accessibilityLabel={`Deactivate ${item.country} visa`}
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
          {item.price != null ? formatPaise(item.price) : 'On request'}
        </Text>
        <Button
          variant="tinted"
          label="Edit"
          onPress={() => navigation.navigate('VisaForm', { visaId: item.id })}
          accessibilityLabel={`Edit ${item.country} visa`}
        />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Visas
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
          <ErrorState message={getApiErrorMessage(error, 'Could not load visas')} onRetry={refetch} />
        ) : !visas || visas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No visas found"
            message="Try adjusting your filters or create a new one."
            actionLabel="New visa"
            onAction={() => navigation.navigate('VisaForm')}
          />
        ) : (
          <FL
            data={visas}
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
          onPress={() => navigation.navigate('VisaForm')}
          accessibilityLabel="Create visa"
        />
      </View>
    </SafeAreaView>
  );
}
