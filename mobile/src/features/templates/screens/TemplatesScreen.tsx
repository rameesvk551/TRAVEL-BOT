// FILE: mobile/src/features/templates/screens/TemplatesScreen.tsx
// Templates are WhatsApp-only Meta message templates, so the filter is by
// approval status (what actually varies) rather than by channel.

import React, { useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useTemplates, useSyncTemplates, Template, TemplateStatus } from '../api';
import { Segmented, Card, Badge, EmptyState, ErrorState, Skeleton, Button } from '../../../ui';
import { FileText, Plus, RefreshCw } from 'lucide-react-native';

const FILTERS: Array<{ label: string; value?: TemplateStatus }> = [
  { label: 'All', value: undefined },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Draft', value: 'DRAFT' },
];

function statusVariant(status: TemplateStatus): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'APPROVED':
      return 'success';
    case 'PENDING':
      return 'warning';
    case 'REJECTED':
      return 'danger';
    case 'PAUSED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function titleCase(value: string): string {
  if (!value) return '';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function TemplatesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterIndex, setFilterIndex] = useState(0);
  const { data: templates, isLoading, isError, error, refetch, isRefetching } = useTemplates(
    FILTERS[filterIndex].value,
  );
  const syncMutation = useSyncTemplates();

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Template }) => (
    <Card
      style={{ padding: s.s3, marginBottom: s.s4, marginHorizontal: s.s4 }}
      onPress={() => navigation.navigate('TemplateForm', { templateId: item.id })}
      accessibilityLabel={`${item.displayName}, ${titleCase(item.status)}`}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: s.s3 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.bg.fill,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {item.icon ? (
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            ) : (
              <FileText size={20} color={theme.colors.accent} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {item.displayName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
              <Badge label={titleCase(item.category)} variant="info" />
              {item.usageCount > 0 && (
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                  Used {item.usageCount.toLocaleString('en-IN')}×
                </Text>
              )}
            </View>
          </View>
        </View>
        <Badge label={titleCase(item.status)} variant={statusVariant(item.status)} />
      </View>

      <View
        style={{
          marginTop: s.s3,
          paddingTop: s.s3,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border.hairline,
        }}
      >
        <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]} numberOfLines={2}>
          {item.body}
        </Text>
      </View>

      {item.status === 'REJECTED' && item.rejectionReason ? (
        <Text style={[theme.typography.caption2, { color: theme.colors.status.danger, marginTop: s.s2 }]}>
          {item.rejectionReason}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: s.s4,
          }}
        >
          <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Templates</Text>
          <Button
            variant="icon"
            icon={RefreshCw}
            loading={syncMutation.isPending}
            onPress={() => syncMutation.mutate()}
            accessibilityLabel="Sync approval status from Meta"
          />
        </View>
        <Segmented segments={FILTERS.map((f) => f.label)} selectedIndex={filterIndex} onChange={setFilterIndex} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={120} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : !templates || templates.length === 0 ? (
          <EmptyState icon={FileText} title="No templates" message="Create reusable message templates." />
        ) : (
          <FL
            data={templates}
            renderItem={renderItem}
            keyExtractor={(item: Template) => item.id}
            estimatedItemSize={140}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button
          variant="fab"
          icon={Plus}
          onPress={() => navigation.navigate('TemplateForm')}
          accessibilityLabel="New template"
        />
      </View>
    </SafeAreaView>
  );
}
