// FILE: mobile/src/features/leads/screens/LeadsScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useLeads,
  useUpdateLead,
  leadDisplayName,
  leadStageLabel,
  nextFollowUpAt,
  isPast,
  humanize,
  type Lead,
  type LeadListParams,
} from '../api';
import { getAuthState } from '../../../hooks/useAuth';
import { formatDate } from '../../../lib/formatters';
import {
  SearchBar,
  Segmented,
  FilterChipRow,
  SwipeableRow,
  ListRow,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Button,
  Card,
} from '../../../ui';
import { showToast } from '../../../ui/Toast';
import { Users, Phone, MessageSquare, Clock, MapPin, UserCheck } from 'lucide-react-native';
import { LeadDetailSheet } from './LeadDetailSheet';

/** Server-side filters. Each maps to a param the /leads endpoint actually reads. */
const FILTERS: { key: string; label: string; params: LeadListParams }[] = [
  { key: 'mine', label: 'Mine', params: { agentId: 'mine' } },
  { key: 'unassigned', label: 'Unassigned', params: { agentId: 'unassigned' } },
  { key: 'attention', label: 'Needs attention', params: { attention: 'true' } },
  { key: 'hot', label: 'Hottest first', params: { sortBy: 'hot' } },
];

export function LeadsScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { agent } = getAuthState();
  const [viewMode, setViewMode] = useState(0); // 0: List, 1: Board
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const detailSheetRef = useRef<BottomSheet>(null);

  // Don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const params = useMemo<LeadListParams>(() => {
    const merged: LeadListParams = { pageSize: 50 };
    FILTERS.filter((filter) => activeFilters.includes(filter.key)).forEach((filter) => {
      Object.assign(merged, filter.params);
    });
    if (debouncedSearch) merged.search = debouncedSearch;
    return merged;
  }, [activeFilters, debouncedSearch]);

  const { data, isLoading, isError, refetch, isRefetching } = useLeads(params);
  const { mutate: updateLead } = useUpdateLead();

  const leads = data?.data ?? [];
  const metrics = data?.metrics;

  const s = theme.spacing;

  const openLeadDetail = (id: string) => {
    setSelectedLeadId(id);
    detailSheetRef.current?.expand();
  };

  // Deep link from Home ("Needs attention") and Follow-ups.
  const focusLeadId: string | undefined = route?.params?.focusLeadId;
  useEffect(() => {
    if (focusLeadId) openLeadDetail(focusLeadId);
  }, [focusLeadId]);

  const toggleFilter = (key: string) => {
    setActiveFilters((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  };

  const dial = (phone: string | null | undefined) => {
    if (!phone) return showToast('This lead has no phone number', 'error');
    Linking.openURL(`tel:${phone}`);
  };

  const whatsapp = (phone: string | null | undefined) => {
    if (!phone) return showToast('This lead has no phone number', 'error');
    Linking.openURL(`https://wa.me/${phone.replace(/[^\d]/g, '')}`);
  };

  const assignToMe = (lead: Lead) => {
    if (!agent?.id) return showToast('Sign in again to claim leads', 'error');
    updateLead(
      { id: lead.id, data: { assignedAgentId: agent.id } },
      {
        onSuccess: () => showToast(`${leadDisplayName(lead)} assigned to you`, 'success'),
        onError: () => showToast('Could not assign the lead', 'error'),
      },
    );
  };

  const renderLeadRow = ({ item }: { item: Lead }) => {
    const name = leadDisplayName(item);
    const followUp = nextFollowUpAt(item);
    const overdue = isPast(followUp);
    const phone = item.customer?.phone;

    return (
      <SwipeableRow
        leftActions={[
          { label: 'Assign to me', color: theme.colors.status.info, icon: UserCheck, onPress: () => assignToMe(item) },
        ]}
        rightActions={[
          { label: 'Call', color: theme.colors.status.success, icon: Phone, onPress: () => dial(phone) },
          { label: 'WhatsApp', color: theme.colors.status.success, icon: MessageSquare, onPress: () => whatsapp(phone) },
        ]}
      >
        <ListRow
          leading={<Avatar name={name} />}
          title={name}
          subtitle={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s1, marginTop: s.s1 }}>
              <Badge variant="neutral" label={leadStageLabel(item)} />
              {!!item.source && <Badge variant="info" label={humanize(item.source)} />}
            </View>
          }
          trailing={
            <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
              {!!item.destination && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s1 }}>
                  <MapPin size={12} color={theme.colors.text.secondary} />
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                    {item.destination}
                  </Text>
                </View>
              )}
              {!!followUp && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.s1 }}>
                  <Clock size={12} color={overdue ? theme.colors.status.danger : theme.colors.text.tertiary} />
                  <Text
                    style={[
                      theme.typography.caption2,
                      { color: overdue ? theme.colors.status.danger : theme.colors.text.tertiary },
                    ]}
                  >
                    {formatDate(followUp)}
                  </Text>
                </View>
              )}
            </View>
          }
          onPress={() => openLeadDetail(item.id)}
          accessibilityLabel={`${name}, ${leadStageLabel(item)}${
            item.destination ? `, ${item.destination}` : ''
          }${overdue ? ', follow-up overdue' : ''}`}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: s.s4,
          }}
        >
          <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Leads</Text>
          <Button
            variant="plain"
            icon={Users}
            onPress={() => navigation.navigate('FollowUps')}
            accessibilityLabel="Open follow-ups"
          />
        </View>

        {/* Counts come from the list response, so they always match the filters above */}
        <View style={{ flexDirection: 'row', gap: s.s2, marginBottom: s.s4 }}>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
              {metrics?.totalDeals ?? '—'}
            </Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Total</Text>
          </Card>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.status.warning }]}>
              {metrics?.attention ?? '—'}
            </Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Attention</Text>
          </Card>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.status.success }]}>
              {metrics?.won ?? '—'}
            </Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Won</Text>
          </Card>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search leads..." />

        <View style={{ marginTop: s.s4 }}>
          <Segmented segments={['List', 'Board']} selectedIndex={viewMode} onChange={setViewMode} />
        </View>
      </View>

      <View style={{ paddingVertical: s.s2 }}>
        <FilterChipRow
          chips={FILTERS.map((filter) => ({
            key: filter.key,
            label: filter.label,
            selected: activeFilters.includes(filter.key),
          }))}
          onToggle={toggleFilter}
        />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={80} />
            ))}
          </View>
        ) : isError ? (
          <View style={{ padding: s.s4 }}>
            <ErrorState message="Couldn't load your leads." onRetry={refetch} />
          </View>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No leads found"
            message={
              activeFilters.length || debouncedSearch
                ? 'Try clearing the search or filters.'
                : 'New enquiries will land here.'
            }
          />
        ) : viewMode === 0 ? (
          <FL
            data={leads}
            renderItem={renderLeadRow}
            keyExtractor={(item: Lead) => item.id}
            estimatedItemSize={84}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: s.s4,
                }}
              />
            )}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              Board view coming in Phase 2
            </Text>
          </View>
        )}
      </View>

      <LeadDetailSheet ref={detailSheetRef} leadId={selectedLeadId} />
    </SafeAreaView>
  );
}
