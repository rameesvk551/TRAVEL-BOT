// FILE: mobile/src/features/inbox/screens/InboxScreen.tsx
import React, { useState } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useInboxThreads, InboxThread } from '../api';
import { SearchBar, Segmented, FilterChipRow, ListRow, Avatar, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { MessageCircle, Bot, Plus } from 'lucide-react-native';

export function InboxScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [filterType, setFilterType] = useState(0); // 0: All, 1: Leads, 2: Customers
  const [search, setSearch] = useState('');
  const [chipFilters, setChipFilters] = useState<Record<string, boolean>>({});

  const filterNames = ['all', 'leads', 'customers'] as const;
  const { data: threads, isLoading, refetch } = useInboxThreads(filterNames[filterType]);

  const s = theme.spacing;

  const toggleChip = (key: string) => setChipFilters(prev => ({ ...prev, [key]: !prev[key] }));

  const renderItem = ({ item }: { item: InboxThread }) => (
    <ListRow
      leading={<Avatar name={item.contactName} imageUri={item.avatarUrl} size={48} />}
      title={item.contactName}
      subtitle={item.lastMessage}
      trailing={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {item.unreadCount > 0 ? (
            <Badge variant="danger" label={item.unreadCount.toString()} />
          ) : (
            item.isBotMode && <Bot color={theme.colors.text.tertiary} size={16} />
          )}
        </View>
      }
      onPress={() => navigation.navigate('Thread', { threadId: item.id, contactName: item.contactName })}
    />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search messages..." />
        <View style={{ marginTop: s.s4 }}>
          <Segmented segments={['All', 'Leads', 'Customers']} selectedIndex={filterType} onChange={setFilterType} />
        </View>
      </View>
      
      <View style={{ paddingVertical: s.s2 }}>
        <FilterChipRow
          chips={[
            { key: 'wa', label: 'WhatsApp', selected: !!chipFilters['wa'] },
            { key: 'ig', label: 'Instagram', selected: !!chipFilters['ig'] },
            { key: 'unread', label: 'Unread', selected: !!chipFilters['unread'] },
            { key: 'me', label: 'Assigned to me', selected: !!chipFilters['me'] },
          ]}
          onToggle={toggleChip}
        />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ padding: s.s4, gap: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={64} />)}
          </View>
        ) : !threads || threads.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No conversations yet" message="When leads message you, they'll appear here." />
        ) : (
          <FL
            data={threads}
            renderItem={renderItem}
            estimatedItemSize={72}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 76 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}
