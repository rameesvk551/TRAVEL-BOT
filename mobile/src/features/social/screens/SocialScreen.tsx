// FILE: mobile/src/features/social/screens/SocialScreen.tsx
// Instagram DM inbox. The backend serves Instagram only (no Facebook DM route),
// so the old All/Instagram/Facebook filter is gone. Threads must be fetched for
// a specific connected account, so we resolve the connection first.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useInstagramConnection,
  useSocialThreads,
  threadDisplayName,
  threadNeedsReply,
  SocialThread,
} from '../api';
import { Segmented, ListRow, Badge, EmptyState, ErrorState, Skeleton, Avatar } from '../../../ui';
// lucide dropped brand glyphs in v1 — there is no `Instagram` icon. Camera is
// the stand-in; the surrounding copy already names the network.
import { MessageSquare, Camera } from 'lucide-react-native';
import { timeAgo } from '../../../lib/formatters';

export function SocialScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const connectionQuery = useInstagramConnection();
  const accounts = connectionQuery.data?.accounts ?? [];

  const [accountIndex, setAccountIndex] = useState(0);
  const activeAccount = accounts[accountIndex] ?? accounts[0];

  // Keep the selection valid if the account list shrinks between refetches.
  useEffect(() => {
    if (accountIndex > accounts.length - 1) setAccountIndex(0);
  }, [accounts.length, accountIndex]);

  const threadsQuery = useSocialThreads(activeAccount?.id);

  const renderItem = ({ item }: { item: SocialThread }) => {
    const name = threadDisplayName(item);
    const needsReply = threadNeedsReply(item);

    return (
      <ListRow
        leading={<Avatar name={name} />}
        title={name}
        subtitle={
          <Text
            style={[
              theme.typography.subhead,
              {
                color: needsReply ? theme.colors.text.primary : theme.colors.text.secondary,
                fontWeight: needsReply ? '600' : '400',
              },
            ]}
            numberOfLines={1}
          >
            {item.text ?? 'Media message'}
          </Text>
        }
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.tertiary }]}>
              {timeAgo(item.timestamp)}
            </Text>
            {needsReply && <Badge label="Awaiting reply" variant="warning" />}
          </View>
        }
        accessibilityLabel={`Conversation with ${name}${needsReply ? ', awaiting reply' : ''}`}
      />
    );
  };

  const isLoading = connectionQuery.isLoading || (Boolean(activeAccount) && threadsQuery.isLoading);
  const isError = connectionQuery.isError || threadsQuery.isError;
  const errorMessage =
    (connectionQuery.error as Error)?.message ?? (threadsQuery.error as Error)?.message;

  const retry = () => {
    connectionQuery.refetch();
    threadsQuery.refetch();
  };

  const threads = threadsQuery.data ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>
          Instagram
        </Text>

        {/* Only worth a switcher when more than one account is connected. */}
        {accounts.length > 1 && (
          <Segmented
            segments={accounts.map((a) => a.username ?? a.name ?? 'Account')}
            selectedIndex={accountIndex}
            onChange={setAccountIndex}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={72} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={errorMessage} onRetry={retry} />
        ) : !connectionQuery.data?.connected || accounts.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Instagram not connected"
            message={
              connectionQuery.data?.errorMessage ??
              'Connect an Instagram account in Settings on the web app to see DMs here.'
            }
          />
        ) : threads.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Inbox zero" message="No Instagram conversations yet." />
        ) : (
          <FL
            data={threads}
            renderItem={renderItem}
            keyExtractor={(item: SocialThread) => item.id}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl
                refreshing={threadsQuery.isRefetching}
                onRefresh={threadsQuery.refetch}
                tintColor={theme.colors.accent}
              />
            }
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: theme.colors.border.hairline,
                  marginLeft: 16,
                }}
              />
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
