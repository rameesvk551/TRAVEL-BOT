// FILE: mobile/src/features/inbox/screens/InboxScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useInboxThreads,
  isBotActive,
  threadChannel,
  messagePreview,
  InboxThread,
  InboxFilter,
  InboxChannel,
} from '../api';
import {
  SearchBar,
  Segmented,
  FilterChipRow,
  ListRow,
  Avatar,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
} from '../../../ui';
import { MessageCircle, Bot } from 'lucide-react-native';
import { formatPhone, timeAgo, truncate } from '../../../lib/formatters';

// Order matches the web inbox's filter menu.
const FILTERS: InboxFilter[] = ['all', 'unassigned', 'leads', 'customers'];
const FILTER_LABELS = ['All', 'Unassigned', 'Leads', 'Customers'];

function displayName(thread: InboxThread): string {
  return thread.customer.name || formatPhone(thread.customer.phone) || 'Unknown contact';
}

export function InboxScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [filterIndex, setFilterIndex] = useState(0);
  const [channel, setChannel] = useState<InboxChannel>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // `q` is a server-side search, so don't fire a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data: threads,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  } = useInboxThreads({
    filter: FILTERS[filterIndex],
    channel,
    q: debouncedSearch,
  });

  const chips = useMemo(
    () => [
      { key: 'whatsapp', label: 'WhatsApp', selected: channel === 'whatsapp' },
      { key: 'instagram', label: 'Instagram', selected: channel === 'instagram' },
    ],
    [channel],
  );

  // Channel is single-select: tapping the active chip clears it back to "all".
  const toggleChannel = (key: string) =>
    setChannel((current) => (current === key ? 'all' : (key as InboxChannel)));

  const renderItem = ({ item }: { item: InboxThread }) => {
    const name = displayName(item);
    const preview = messagePreview(item.lastMessage);
    const botActive = isBotActive(item);
    const unassigned = !item.assignedAgent;
    const when = timeAgo(item.lastActivityAt);
    const channelLabel = threadChannel(item) === 'instagram' ? 'Instagram' : 'WhatsApp';

    const a11y = [
      name,
      channelLabel,
      preview,
      when,
      botActive ? 'Bot is replying' : null,
      unassigned ? 'Unassigned' : `Assigned to ${item.assignedAgent?.name}`,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <ListRow
        leading={<Avatar name={name} size={48} />}
        title={name}
        subtitle={
          <View style={{ gap: 2 }}>
            <Text
              numberOfLines={1}
              style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}
            >
              {truncate(preview, 48)}
            </Text>
            {unassigned ? (
              <View style={styles.badgeRow}>
                <Badge variant="warning" label="Unassigned" />
              </View>
            ) : null}
          </View>
        }
        trailing={
          <View style={{ alignItems: 'flex-end', gap: s.s1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
              {when}
            </Text>
            {botActive ? <Bot color={theme.colors.text.tertiary} size={16} /> : null}
          </View>
        }
        accessibilityLabel={a11y}
        accessibilityHint="Opens the conversation"
        onPress={() =>
          navigation.navigate('Thread', {
            customerId: item.customer.id,
            contactName: name,
          })
        }
      />
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={{ padding: s.s4, gap: s.s4 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={64} />
          ))}
        </View>
      );
    }

    if (isError) {
      return (
        <View style={{ padding: s.s4 }}>
          <ErrorState
            message={(error as Error)?.message || 'Could not load conversations.'}
            onRetry={refetch}
          />
        </View>
      );
    }

    if (!threads || threads.length === 0) {
      return (
        <EmptyState
          icon={MessageCircle}
          title="No conversations"
          message="When leads message you, they'll appear here."
        />
      );
    }

    return (
      <FL
        data={threads}
        renderItem={renderItem}
        keyExtractor={(item: InboxThread) => item.customer.id}
        estimatedItemSize={76}
        contentContainerStyle={{ paddingBottom: s.s12 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.colors.accent}
          />
        }
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: theme.colors.border.hairline,
              marginLeft: 76,
            }}
          />
        )}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s2 }}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone"
        />
        <View style={{ marginTop: s.s4 }}>
          <Segmented
            segments={FILTER_LABELS}
            selectedIndex={filterIndex}
            onChange={setFilterIndex}
          />
        </View>
      </View>

      <View style={{ paddingVertical: s.s2 }}>
        <FilterChipRow chips={chips} onToggle={toggleChannel} />
      </View>

      <View style={{ flex: 1 }}>{renderBody()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
  },
});
