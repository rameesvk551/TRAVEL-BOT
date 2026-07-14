// FILE: mobile/src/features/services/screens/ServicesScreen.tsx
import React, { useState } from 'react';
import { View, Text, RefreshControl, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useServices,
  useDeactivateService,
  formatPaise,
  getApiErrorMessage,
  AddonService,
  ServiceTab,
  PRICING_TYPE_LABELS,
} from '../api';
import {
  FilterChipRow,
  Card,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
  Chip,
  showToast,
} from '../../../ui';
import {
  Briefcase,
  Plus,
  Trash2,
  Plane,
  TrainFront,
  FileText,
  Globe,
  Shield,
  Car,
  Hotel,
  Stamp,
  Files,
  Settings,
  LucideIcon,
} from 'lucide-react-native';

// `icon` is an identifier (see the web's ICON_MAP), so map it to a lucide glyph
// rather than rendering the raw string.
const ICON_MAP: Record<string, LucideIcon> = {
  plane: Plane,
  train: TrainFront,
  document: FileText,
  globe: Globe,
  shield: Shield,
  car: Car,
  hotel: Hotel,
  stamp: Stamp,
  file: Files,
  default: Settings,
};

const FILTERS: { key: ServiceTab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'TICKETING', label: 'Ticketing' },
  { key: 'DOCUMENTATION', label: 'Documentation' },
  { key: 'VISA', label: 'Visa' },
  { key: 'INSURANCE', label: 'Insurance' },
  { key: 'OTHER', label: 'Other' },
  { key: 'INACTIVE', label: 'Inactive' },
];

export function ServicesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [tab, setTab] = useState<ServiceTab>('ALL');
  const {
    data: services,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useServices(tab);
  const deactivate = useDeactivateService();

  const s = theme.spacing;

  const confirmDeactivate = (service: AddonService) => {
    Alert.alert('Deactivate service', `Deactivate "${service.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(service.id, {
            onSuccess: () => showToast('Service deactivated', 'success'),
            onError: (err) => showToast(getApiErrorMessage(err, 'Could not deactivate'), 'error'),
          }),
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text
          style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}
        >
          Services
        </Text>
        <FilterChipRow
          chips={FILTERS.map((f) => ({ key: f.key, label: f.label, selected: f.key === tab }))}
          onToggle={(key) => setTab(key as ServiceTab)}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
      >
        {isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ width: '48%' }}>
                <Skeleton height={150} />
              </View>
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={getApiErrorMessage(error, 'Could not load services')} onRetry={refetch} />
        ) : !services || services.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No services found"
            message="Try adjusting your filters or create a new one."
            actionLabel="New service"
            onAction={() => navigation.navigate('ServiceForm')}
          />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
            {services.map((item) => {
              const Icon = ICON_MAP[item.icon ?? 'default'] ?? Settings;
              return (
                <Card
                  key={item.id}
                  style={{ width: '48%', padding: s.s3 }}
                  onPress={() => navigation.navigate('ServiceForm', { serviceId: item.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.name}`}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Icon color={theme.colors.accent} size={28} />
                    <Button
                      variant="icon"
                      icon={Trash2}
                      onPress={() => confirmDeactivate(item)}
                      accessibilityLabel={`Deactivate ${item.name}`}
                    />
                  </View>
                  <Text
                    style={[
                      theme.typography.headline,
                      { color: theme.colors.text.primary, marginTop: s.s3 },
                    ]}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>
                  <View style={{ alignSelf: 'flex-start', marginTop: s.s2, flexDirection: 'row', gap: s.s1 }}>
                    {item.category ? <Badge label={item.category} variant="info" /> : null}
                    {!item.isActive ? <Badge label="Inactive" variant="danger" /> : null}
                  </View>
                  <View style={{ marginTop: s.s3 }}>
                    <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
                      {item.basePrice != null ? formatPaise(item.basePrice) : 'On request'}
                    </Text>
                    <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                      {PRICING_TYPE_LABELS[item.pricingType] ?? item.pricingType}
                    </Text>
                  </View>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: s.s3 }}
                  >
                    {(item.features ?? []).slice(0, 2).map((f, i) => (
                      <Chip key={`${f}-${i}`} label={f} selected={false} />
                    ))}
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => navigation.navigate('ServiceForm')}
          accessibilityLabel="Create service"
        />
      </View>
    </SafeAreaView>
  );
}
