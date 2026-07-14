// FILE: mobile/src/features/leads/screens/LeadDetailSheet.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking, ScrollView } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useLead,
  usePipelineStages,
  useMoveLeadStage,
  useUpdateLead,
  leadDisplayName,
  leadStageLabel,
  humanize,
} from '../api';
import { getAuthState } from '../../../hooks/useAuth';
import { formatCurrency, formatDateTime } from '../../../lib/formatters';
import {
  Avatar,
  Badge,
  Button,
  Chip,
  Grabber,
  SectionHeader,
  Card,
  Skeleton,
  ErrorState,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { Phone, MessageSquare, UserCheck } from 'lucide-react-native';

export interface LeadDetailSheetProps {
  leadId: string | null;
}

export const LeadDetailSheet = React.forwardRef<BottomSheet, LeadDetailSheetProps>(({ leadId }, ref) => {
  const { theme } = useTheme();
  const { agent } = getAuthState();
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const { data: lead, isLoading, isError, refetch } = useLead(leadId);
  const { data: stages } = usePipelineStages();
  const { mutate: moveStage, isPending: isMoving } = useMoveLeadStage();
  const { mutate: updateLead } = useUpdateLead();

  const s = theme.spacing;

  const renderBackdrop = React.useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />,
    [],
  );

  const phone = lead?.customer?.phone;

  const dial = () => {
    if (!phone) return showToast('This lead has no phone number', 'error');
    Linking.openURL(`tel:${phone}`);
  };

  const whatsapp = () => {
    if (!phone) return showToast('This lead has no phone number', 'error');
    Linking.openURL(`https://wa.me/${phone.replace(/[^\d]/g, '')}`);
  };

  const assignToMe = () => {
    if (!lead || !agent?.id) return showToast('Sign in again to claim leads', 'error');
    updateLead(
      { id: lead.id, data: { assignedAgentId: agent.id } },
      {
        onSuccess: () => showToast('Lead assigned to you', 'success'),
        onError: () => showToast('Could not assign the lead', 'error'),
      },
    );
  };

  // The PATCH schema accepts pipelineStageId (the service reconciles stage <-> status).
  // Anything not in that schema is stripped by validateBody and the save silently no-ops.
  const changeStage = (pipelineStageId: string) => {
    if (!lead || pipelineStageId === lead.pipelineStageId) return;
    moveStage(
      { id: lead.id, pipelineStageId },
      {
        onSuccess: (updated) => showToast(`Moved to ${leadStageLabel(updated)}`, 'success'),
        onError: () => showToast('Could not move the lead', 'error'),
      },
    );
  };

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      handleComponent={Grabber}
      backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }}>
        {!leadId || isLoading ? (
          <View style={{ gap: s.s4, marginTop: s.s4 }}>
            <Skeleton height={80} />
            <Skeleton height={200} />
          </View>
        ) : isError || !lead ? (
          <View style={{ marginTop: s.s4 }}>
            <ErrorState message="Couldn't load this lead." onRetry={refetch} />
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s.s6, marginTop: s.s2 }}>
              <Avatar name={leadDisplayName(lead)} size={64} />
              <View style={{ marginLeft: s.s4, flex: 1 }}>
                <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>
                  {leadDisplayName(lead)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s2, marginTop: s.s1 }}>
                  <Badge variant="neutral" label={leadStageLabel(lead)} />
                  {!!lead.source && <Badge variant="info" label={humanize(lead.source)} />}
                </View>
              </View>
            </View>

            {/* Quick actions */}
            <View style={{ flexDirection: 'row', gap: s.s2, marginBottom: s.s6 }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" icon={Phone} onPress={dial} accessibilityLabel="Call this lead" />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  icon={MessageSquare}
                  onPress={whatsapp}
                  accessibilityLabel="Message this lead on WhatsApp"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant="secondary"
                  icon={UserCheck}
                  onPress={assignToMe}
                  accessibilityLabel="Assign this lead to me"
                />
              </View>
            </View>

            {/* Stage — the agency's own funnel, straight from the pipeline API */}
            {!!stages?.length && (
              <>
                <SectionHeader title="STAGE" />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: s.s2, paddingBottom: s.s4 }}
                >
                  {stages
                    .filter((stage) => stage.isActive !== false)
                    .map((stage) => (
                      <Chip
                        key={stage.id}
                        label={stage.name}
                        selected={stage.id === lead.pipelineStageId}
                        onPress={isMoving ? undefined : () => changeStage(stage.id)}
                      />
                    ))}
                </ScrollView>
              </>
            )}

            {/* Trip interest */}
            <SectionHeader title="TRIP INTEREST" />
            <Card style={{ padding: s.s4, marginBottom: s.s6 }}>
              <View style={styles.factRow}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 110 }]}>
                  Destination
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                  {lead.destination || lead.place || '—'}
                </Text>
              </View>
              <View style={styles.factRow}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 110 }]}>
                  Budget / head
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                  {lead.budgetPerPerson ? formatCurrency(lead.budgetPerPerson) : '—'}
                </Text>
              </View>
              <View style={styles.factRow}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 110 }]}>
                  Travellers
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                  {lead.travellers ?? '—'}
                </Text>
              </View>
              <View style={styles.factRow}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 110 }]}>
                  Assigned to
                </Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>
                  {lead.assignedAgent?.name || 'Unassigned'}
                </Text>
              </View>
            </Card>

            {/* Timeline — the server-built history, newest first */}
            <SectionHeader title="ACTIVITY TIMELINE" />
            {lead.timeline?.length ? (
              <View
                style={{
                  marginLeft: s.s2,
                  borderLeftWidth: 2,
                  borderLeftColor: theme.colors.border.hairline,
                  paddingLeft: s.s4,
                  paddingBottom: s.s4,
                }}
              >
                {lead.timeline.map((event, index) => (
                  <View key={event.id} style={{ marginBottom: s.s4 }}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: index === 0 ? theme.colors.accent : theme.colors.text.tertiary },
                      ]}
                    />
                    <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>
                      {event.title}
                    </Text>
                    {!!event.description && (
                      <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>
                        {event.description}
                      </Text>
                    )}
                    <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
                      {formatDateTime(event.time)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginBottom: s.s6 }]}>
                Nothing has happened on this lead yet.
              </Text>
            )}
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineDot: {
    position: 'absolute',
    left: -21, // -16 padding, -5 radius, -2 border
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
