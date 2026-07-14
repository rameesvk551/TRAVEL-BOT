// FILE: mobile/src/features/automations/screens/FlowBuilderScreen.tsx
//
// READ-ONLY BY DESIGN.
//
// This screen shows a drip sequence (GET /drips/:id) as an ordered, vertical
// list of steps, plus one real write: the enable/disable toggle
// (POST /drips/:id/toggle). It does NOT edit the sequence graph. Two reasons:
//
//  1. A drag-and-drop node editor is a poor fit for a phone.
//  2. Round-tripping a flow graph through the backend is lossy. The graph
//     normaliser (agencyService.normalizeGraphData) is a WHITELIST: any node
//     field it doesn't know about is silently dropped on write. It has already
//     destroyed configuration this way once. Sending a graph back from a mobile
//     client that models fewer fields than the web builder is exactly how that
//     happens again, so mobile never writes a graph.
//
// Step authoring stays on the web app.

import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Card, SectionHeader, Badge, Skeleton, ErrorState, MetricCard, Switch } from '../../../ui';
import { ArrowLeft, Zap, Clock, MessageSquare, FileText, Image as ImageIcon, MousePointerClick } from 'lucide-react-native';
import { useAutomation, useToggleAutomation, AutomationStep, StepMessageType, TRIGGER_LABELS } from '../api';

function stepIcon(type: StepMessageType) {
  switch (type) {
    case 'TEMPLATE':
      return FileText;
    case 'IMAGE':
      return ImageIcon;
    case 'BUTTONS':
      return MousePointerClick;
    default:
      return MessageSquare;
  }
}

/** "0h" reads as nothing; say what it means. */
function delayLabel(hours: number): string {
  if (!hours) return 'Immediately';
  if (hours < 24) return `Wait ${hours}h`;
  const days = Math.round(hours / 24);
  return `Wait ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function FlowBuilderScreen({ route, navigation }: any) {
  const automationId: string | undefined = route?.params?.automationId;
  const { theme } = useTheme();
  const s = theme.spacing;

  const { data: automation, isLoading, isError, error, refetch, isRefetching } = useAutomation(automationId);
  const toggleMutation = useToggleAutomation();

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
      <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
        Automation
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        {header}
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={100} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !automation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        {header}
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const steps = [...(automation.steps ?? [])].sort((a, b) => a.order - b.order);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {header}

      <ScrollView
        contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {/* Identity + the one write this screen makes */}
        <Card style={{ marginBottom: s.s5 }}>
          <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>{automation.name}</Text>
          {automation.description ? (
            <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: s.s2 }]}>
              {automation.description}
            </Text>
          ) : null}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: s.s4,
              paddingTop: s.s3,
              borderTopWidth: 1,
              borderTopColor: theme.colors.border.hairline,
            }}
          >
            <Badge label={automation.isActive ? 'Active' : 'Paused'} variant={automation.isActive ? 'success' : 'neutral'} />
            <Switch
              value={automation.isActive}
              onValueChange={() => automationId && toggleMutation.mutate(automationId)}
              label="Enable automation"
            />
          </View>
        </Card>

        <View style={{ flexDirection: 'row', gap: s.s3, marginBottom: s.s5 }}>
          <View style={{ flex: 1 }}>
            <MetricCard label="Enrolled" value={automation.enrollmentCount.toLocaleString('en-IN')} />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard label="Completed" value={automation.completedCount.toLocaleString('en-IN')} />
          </View>
        </View>

        <SectionHeader title="Sequence" />

        <View style={{ alignItems: 'center', gap: s.s3, marginTop: s.s3 }}>
          {/* Trigger */}
          <Card
            style={{
              width: '90%',
              alignItems: 'center',
              backgroundColor: theme.colors.bg.surfaceRaised,
              borderColor: theme.colors.accent,
              borderWidth: 1,
            }}
          >
            <Zap size={22} color={theme.colors.accent} />
            <Text
              style={[theme.typography.subhead, { color: theme.colors.text.primary, marginTop: s.s2, textAlign: 'center' }]}
            >
              {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
            </Text>
          </Card>

          {steps.length === 0 ? (
            <>
              <View style={{ height: 24, width: 2, backgroundColor: theme.colors.border.hairline }} />
              <Card style={{ width: '90%', alignItems: 'center' }}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, textAlign: 'center' }]}>
                  This automation has no steps yet.
                </Text>
              </Card>
            </>
          ) : (
            steps.map((step: AutomationStep) => {
              const Icon = stepIcon(step.messageType);
              return (
                <React.Fragment key={step.id}>
                  <View style={{ height: 24, width: 2, backgroundColor: theme.colors.border.hairline }} />

                  <Card style={{ width: '90%' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s2, marginBottom: s.s2 }}>
                      <Clock size={14} color={theme.colors.text.tertiary} />
                      <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                        {delayLabel(step.delayHours)}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s.s3 }}>
                      <Icon size={20} color={theme.colors.text.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                          Step {step.order}
                        </Text>
                        {step.messageBody ? (
                          <Text
                            style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 2 }]}
                            numberOfLines={3}
                          >
                            {step.messageBody}
                          </Text>
                        ) : null}
                      </View>
                      <Badge label={step.messageType} variant="neutral" />
                    </View>
                  </Card>
                </React.Fragment>
              );
            })
          )}
        </View>

        <Text
          style={[
            theme.typography.caption2,
            { color: theme.colors.text.tertiary, textAlign: 'center', marginTop: s.s5 },
          ]}
        >
          Steps are edited on the web app.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
