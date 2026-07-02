// FILE: mobile/src/features/leads/screens/LeadsScreen.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '../../../theme/ThemeProvider';
import { useLeads, useUpdateLeadStatus, Lead } from '../api';
import { SearchBar, Segmented, FilterChipRow, SwipeableRow, ListRow, Avatar, Badge, EmptyState, Skeleton, Button, Card } from '../../../ui';
import { Users, Plus, Phone, MessageSquare, Clock, MapPin } from 'lucide-react-native';
import { LeadDetailSheet } from './LeadDetailSheet';

export function LeadsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState(0); // 0: List, 1: Board
  const [search, setSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  
  const detailSheetRef = useRef<BottomSheet>(null);

  const { data: leads, isLoading, refetch } = useLeads();
  const { mutate: updateStatus } = useUpdateLeadStatus();

  const s = theme.spacing;

  const openLeadDetail = (id: string) => {
    setSelectedLeadId(id);
    detailSheetRef.current?.expand();
  };

  const renderLeadRow = ({ item }: { item: Lead }) => {
    return (
      <SwipeableRow
        leftActions={[
          { label: 'Follow Up', color: theme.colors.status.warning, onPress: () => {} },
          { label: 'Assign', color: theme.colors.status.info, onPress: () => {} },
        ]}
        rightActions={[
          { label: 'Call', color: theme.colors.status.success, icon: Phone, onPress: () => {} },
          { label: 'WhatsApp', color: '#25D366', icon: MessageSquare, onPress: () => {} },
        ]}
      >
        <ListRow
          leading={<Avatar name={item.name} imageUri={item.avatarUrl} />}
          title={item.name}
          subtitle={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Badge variant="neutral" label={item.status} />
              <Badge variant="info" label={item.source} />
            </View>
          }
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MapPin size={12} color={theme.colors.text.secondary} />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{item.destination}</Text>
              </View>
              {item.nextFollowUp && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} color={item.isOverdue ? theme.colors.status.danger : theme.colors.text.tertiary} />
                  <Text style={[theme.typography.caption2, { color: item.isOverdue ? theme.colors.status.danger : theme.colors.text.tertiary }]}>
                    {new Date(item.nextFollowUp).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          }
          onPress={() => openLeadDetail(item.id)}
        />
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s.s4 }}>
          <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>Leads</Text>
          <Button variant="plain" icon={Users} onPress={() => navigation.navigate('FollowUps')} />
        </View>

        {/* Stat strip mocked */}
        <View style={{ flexDirection: 'row', gap: s.s2, marginBottom: s.s4 }}>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.status.danger }]}>2</Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Overdue</Text>
          </Card>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.status.warning }]}>5</Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Hot</Text>
          </Card>
          <Card style={{ flex: 1, padding: s.s2, alignItems: 'center' }}>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>₹2.4M</Text>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Pipeline</Text>
          </Card>
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search leads..." />
        
        <View style={{ marginTop: s.s4, flexDirection: 'row', alignItems: 'center', gap: s.s4 }}>
          <View style={{ flex: 1 }}>
            <Segmented segments={['List', 'Board']} selectedIndex={viewMode} onChange={setViewMode} />
          </View>
        </View>
      </View>

      <View style={{ paddingVertical: s.s2 }}>
        <FilterChipRow
          chips={[
            { key: 'source', label: 'Source', selected: false },
            { key: 'agent', label: 'Agent', selected: false },
            { key: 'tag', label: 'Tag', selected: false },
            { key: 'hot', label: 'Hot only', selected: false },
          ]}
          onToggle={() => {}}
          onFilterPress={() => {}}
        />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={80} />)}
          </View>
        ) : !leads || leads.length === 0 ? (
          <EmptyState icon={Users} title="No leads found" message="Try adjusting your filters or search." />
        ) : viewMode === 0 ? (
          <FL
            data={leads}
            renderItem={renderLeadRow}
            estimatedItemSize={84}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>Board view coming in Phase 2</Text>
          </View>
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => {}} />
      </View>

      <LeadDetailSheet ref={detailSheetRef} leadId={selectedLeadId} />
    </SafeAreaView>
  );
}
