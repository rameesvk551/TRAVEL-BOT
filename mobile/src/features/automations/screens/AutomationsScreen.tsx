// FILE: mobile/src/features/automations/screens/AutomationsScreen.tsx
// Lists drip sequences (/api/drips). There is no "create" affordance here on
// purpose: authoring a multi-step sequence is a desktop job, and the mobile
// FlowBuilder screen is a read-only view (see its header comment).

import React from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useAutomations, useToggleAutomation, Automation, TRIGGER_LABELS } from '../api';
import { ListRow, Badge, EmptyState, ErrorState, Skeleton, Card, Switch } from '../../../ui';
import { Zap } from 'lucide-react-native';

export function AutomationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data: automations, isLoading, isError, error, refetch, isRefetching } = useAutomations();
  const toggleMutation = useToggleAutomation();

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Automation }) => {
    const stepCount = item.steps?.length ?? 0;

    return (
      <Card
        style={{ padding: 0, marginBottom: s.s4, marginHorizontal: s.s4 }}
        onPress={() => navigation.navigate('FlowBuilder', { automationId: item.id })}
        accessibilityLabel={`${item.name}, ${item.isActive ? 'active' : 'inactive'}, ${stepCount} steps`}
      >
        <ListRow
          leading={
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.bg.fill,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Zap
                size={20}
                color={item.isActive ? theme.colors.status.success : theme.colors.text.tertiary}
              />
            </View>
          }
          title={item.name}
          subtitle={TRIGGER_LABELS[item.trigger] ?? item.trigger}
          trailing={<Badge label={item.isActive ? 'Active' : 'Paused'} variant={item.isActive ? 'success' : 'neutral'} />}
          onPress={() => navigation.navigate('FlowBuilder', { automationId: item.id })}
        />

        <View
          style={{
            padding: s.s3,
            paddingTop: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
            {stepCount} {stepCount === 1 ? 'step' : 'steps'} ·{' '}
            {item.enrollmentCount.toLocaleString('en-IN')} enrolled ·{' '}
            {item.completedCount.toLocaleString('en-IN')} completed
          </Text>
          <Switch
            value={item.isActive}
            onValueChange={() => toggleMutation.mutate(item.id)}
            label={`Enable ${item.name}`}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Automations</Text>
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : !automations || automations.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No automations"
            message="Drip sequences you create on the web app will appear here."
          />
        ) : (
          <FL
            data={automations}
            renderItem={renderItem}
            keyExtractor={(item: Automation) => item.id}
            estimatedItemSize={130}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
