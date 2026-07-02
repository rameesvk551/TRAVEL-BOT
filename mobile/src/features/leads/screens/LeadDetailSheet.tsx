// FILE: mobile/src/features/leads/screens/LeadDetailSheet.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useLead } from '../api';
import { Avatar, Badge, Button, Grabber, SectionHeader, Card, Skeleton } from '../../../ui';
import { Phone, MessageSquare, CalendarPlus, UserCheck, ArrowRight } from 'lucide-react-native';

export interface LeadDetailSheetProps {
  leadId: string | null;
}

export const LeadDetailSheet = React.forwardRef<BottomSheet, LeadDetailSheetProps>(
  ({ leadId }, ref) => {
    const { theme } = useTheme();
    const snapPoints = useMemo(() => ['50%', '90%'], []);
    
    // We only fetch when the sheet opens for a specific ID, but keep it simple for now
    const { data: lead, isLoading } = useLead(leadId || '');

    const s = theme.spacing;

    const handleSheetChanges = (index: number) => {
      // Manage state if needed
    };

    const renderBackdrop = React.useCallback(
      (props: any) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
      ),
      []
    );

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleComponent={Grabber}
        backgroundStyle={{ backgroundColor: theme.colors.bg.surfaceRaised }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s10 }}>
          {isLoading || !leadId ? (
            <View style={{ gap: s.s4, marginTop: s.s4 }}>
              <Skeleton height={80} />
              <Skeleton height={200} />
            </View>
          ) : !lead ? (
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: s.s4 }]}>Lead not found</Text>
          ) : (
            <>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s.s6, marginTop: s.s2 }}>
                <Avatar name={lead.name} imageUri={lead.avatarUrl} size={64} />
                <View style={{ marginLeft: s.s4, flex: 1 }}>
                  <Text style={[theme.typography.title2, { color: theme.colors.text.primary }]}>{lead.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s2, marginTop: s.s1 }}>
                    <Badge variant="neutral" label={lead.status} />
                    <Badge variant="info" label={lead.source} />
                  </View>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={{ flexDirection: 'row', gap: s.s2, marginBottom: s.s6 }}>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" icon={Phone} onPress={() => {}} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" icon={MessageSquare} onPress={() => {}} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" icon={CalendarPlus} onPress={() => {}} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="secondary" icon={UserCheck} onPress={() => {}} />
                </View>
              </View>

              {/* Trip Interest */}
              <SectionHeader title="TRIP INTEREST" action="Edit" />
              <Card style={{ padding: s.s4, marginBottom: s.s6 }}>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Destination</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{lead.destination}</Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Budget</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>₹{lead.value.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.factRow}>
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, width: 100 }]}>Assigned to</Text>
                  <Text style={[theme.typography.body, { color: theme.colors.text.primary, flex: 1 }]}>{lead.assignedAgent}</Text>
                </View>
              </Card>

              {/* Primary Conversions */}
              <Button variant="primary" label="Convert to Booking" icon={ArrowRight} fullWidth onPress={() => {}} style={{ marginBottom: s.s6 }} />

              {/* Timeline */}
              <SectionHeader title="ACTIVITY TIMELINE" />
              <View style={{ marginLeft: s.s2, borderLeftWidth: 2, borderLeftColor: theme.colors.border.hairline, paddingLeft: s.s4, paddingBottom: s.s4 }}>
                <View style={{ marginBottom: s.s4, position: 'relative' }}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.colors.accent }]} />
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>Status changed to Follow Up</Text>
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>Today at 10:30 AM</Text>
                </View>
                <View style={{ marginBottom: s.s4, position: 'relative' }}>
                  <View style={[styles.timelineDot, { backgroundColor: theme.colors.text.tertiary }]} />
                  <Text style={[theme.typography.subhead, { color: theme.colors.text.primary }]}>Lead created from Instagram</Text>
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>Yesterday at 4:15 PM</Text>
                </View>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  factRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  timelineDot: {
    position: 'absolute',
    left: -21, // -16 for padding, -5 for radius, -2 for border thickness (maths depends on tokens)
    top: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
  }
});
