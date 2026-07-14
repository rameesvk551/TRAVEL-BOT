// FILE: mobile/src/features/inbox/screens/ThreadScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import {
  useMessages,
  useSendMessage,
  useTakeover,
  useInboxThread,
  toDescendingMessages,
  mediaKindOf,
  mediaUri,
  mediaHeaders,
  openAttachment,
  isBotActive,
  ChatMessage,
  MediaKind,
} from '../api';
import { Button, Skeleton, ErrorState } from '../../../ui';
import {
  ArrowLeft,
  Send,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Mic,
  Video as VideoIcon,
} from 'lucide-react-native';
import { formatTime } from '../../../lib/formatters';
import * as haptics from '../../../lib/haptics';

const MEDIA_WIDTH = 220;

interface AttachmentState {
  busy: boolean;
  error?: string;
}

function attachmentLabel(kind: MediaKind, message: ChatMessage): string {
  if (kind === 'audio') return 'Voice message';
  if (kind === 'video') return 'Video';
  return message.mediaFilename || 'Document';
}

export function ThreadScreen({ route, navigation }: any) {
  const { customerId, contactName } = route.params as {
    customerId: string;
    contactName: string;
  };
  const { theme } = useTheme();
  const s = theme.spacing;

  const [text, setText] = useState('');
  // Per-attachment open state, keyed by message id.
  const [attachments, setAttachments] = useState<Record<string, AttachmentState>>({});

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(customerId);

  const { data: thread } = useInboxThread(customerId);
  const { mutate: sendMessage, isPending: isSending } = useSendMessage();
  const { mutate: takeover, isPending: isTakingOver } = useTakeover();

  // Newest -> oldest. The list is `inverted`, so index 0 lands at the bottom:
  // the chat opens on the newest message and scrolling UP loads older history.
  const messages = useMemo(() => toDescendingMessages(data), [data]);

  const botActive = isBotActive(thread);
  const canReply = !botActive;
  const canSend = canReply && text.trim().length > 0 && !isSending;

  const handleSend = () => {
    const content = text.trim();
    if (!content || !canReply) return;
    haptics.light();
    sendMessage({ customerId, content });
    setText('');
  };

  const handleEndReached = () => {
    // Inverted list: "end" is the top of the scroll view, i.e. older messages.
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  const renderStatus = (message: ChatMessage) => {
    if (message.optimistic) {
      return <Clock color={theme.colors.text.tertiary} size={12} />;
    }
    switch (message.status) {
      case 'READ':
        return <CheckCheck color={theme.colors.status.info} size={12} />;
      case 'DELIVERED':
        return <CheckCheck color={theme.colors.text.secondary} size={12} />;
      case 'FAILED':
        return <AlertCircle color={theme.colors.status.danger} size={12} />;
      case 'SENT':
      default:
        return <Check color={theme.colors.text.secondary} size={12} />;
    }
  };

  // Downloads the attachment to the cache (once) and hands it to the OS viewer.
  // Failures are surfaced on the row, never swallowed.
  const handleOpenAttachment = async (message: ChatMessage) => {
    if (attachments[message.id]?.busy) return;
    haptics.light();
    setAttachments((current) => ({ ...current, [message.id]: { busy: true } }));
    try {
      await openAttachment(message);
      setAttachments((current) => ({ ...current, [message.id]: { busy: false } }));
    } catch (err) {
      haptics.error();
      setAttachments((current) => ({
        ...current,
        [message.id]: {
          busy: false,
          error: (err as Error)?.message || 'Could not open the attachment.',
        },
      }));
    }
  };

  const renderMedia = (message: ChatMessage, kind: MediaKind) => {
    // Photos stay inline: <Image> can carry the bearer header itself, so there
    // is nothing to download or hand off.
    if (kind === 'image') {
      return (
        <Image
          source={{ uri: mediaUri(message.id), headers: mediaHeaders() }}
          style={[styles.image, { borderRadius: theme.radius.md }]}
          resizeMode="cover"
          accessible
          accessibilityRole="image"
          accessibilityLabel={message.content ? `Photo: ${message.content}` : 'Photo'}
        />
      );
    }

    const AttachmentIcon = kind === 'audio' ? Mic : kind === 'video' ? VideoIcon : FileText;
    const state = attachments[message.id];
    const busy = Boolean(state?.busy);
    const label = attachmentLabel(kind, message);

    return (
      <View>
        <Pressable
          onPress={() => handleOpenAttachment(message)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens the attachment"
          accessibilityState={{ busy, disabled: busy }}
          style={({ pressed }) => [
            styles.attachment,
            {
              backgroundColor: theme.colors.bg.canvas,
              borderRadius: theme.radius.sm,
              paddingHorizontal: s.s3,
              paddingVertical: s.s2,
              gap: s.s2,
              opacity: pressed || busy ? 0.6 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.colors.accent} />
          ) : (
            <AttachmentIcon color={theme.colors.text.secondary} size={18} />
          )}
          <Text
            numberOfLines={1}
            style={[theme.typography.subhead, { color: theme.colors.text.primary, flexShrink: 1 }]}
          >
            {label}
          </Text>
        </Pressable>

        {state?.error ? (
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.status.danger, marginTop: s.s1 },
            ]}
          >
            {state.error}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOut = item.direction === 'OUT';
    const kind = mediaKindOf(item);
    const time = formatTime(item.timestamp);
    const sender = isOut ? 'You' : contactName;

    const spoken = kind && !item.content ? attachmentLabel(kind, item) : item.content;
    const a11yLabel = [
      `${sender}, ${time}`,
      spoken,
      isOut ? (item.optimistic ? 'Sending' : item.status.toLowerCase()) : null,
    ]
      .filter(Boolean)
      .join(': ');

    return (
      <View style={[styles.messageWrapper, isOut ? styles.outbound : styles.inbound]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isOut ? theme.colors.accentTint : theme.colors.bg.surface,
              borderRadius: theme.radius.lg,
              paddingHorizontal: s.s3,
              paddingVertical: s.s2,
              opacity: item.optimistic ? 0.7 : 1,
            },
            isOut ? { borderBottomRightRadius: theme.radius.sm } : { borderBottomLeftRadius: theme.radius.sm },
          ]}
        >
          {/* The media block stays OUTSIDE the accessible content node below:
              collapsing the subtree with `accessible` would hide the attachment
              button from VoiceOver. Media exposes its own node instead. */}
          {kind ? (
            <View style={{ marginBottom: item.content ? s.s2 : 0 }}>{renderMedia(item, kind)}</View>
          ) : null}

          <View accessible accessibilityLabel={a11yLabel}>
            {item.content ? (
              <Text style={[theme.typography.body, { color: theme.colors.text.primary }]}>
                {item.content}
              </Text>
            ) : null}

            <View style={[styles.metaRow, { marginTop: s.s1, gap: s.s1 }]}>
              <Text style={[theme.typography.caption, { color: theme.colors.text.tertiary }]}>
                {time}
              </Text>
              {isOut ? renderStatus(item) : null}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton width="70%" height={60} style={{ alignSelf: 'flex-start' }} />
          <Skeleton width="60%" height={60} style={{ alignSelf: 'flex-end' }} />
          <Skeleton width="65%" height={60} style={{ alignSelf: 'flex-start' }} />
        </View>
      );
    }

    if (isError) {
      return (
        <View style={{ padding: s.s4 }}>
          <ErrorState
            message={(error as Error)?.message || 'Could not load this conversation.'}
            onRetry={refetch}
          />
        </View>
      );
    }

    return (
      <FL
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item: ChatMessage) => item.id}
        estimatedItemSize={80}
        inverted
        // Re-render rows when an attachment flips to busy / error.
        extraData={attachments}
        contentContainerStyle={{ padding: s.s4 }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        // Inverted, so the footer renders at the TOP — where older history loads in.
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ paddingVertical: s.s3 }}>
              <ActivityIndicator color={theme.colors.accent} />
            </View>
          ) : null
        }
      />
    );
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}
      edges={['top', 'bottom']}
    >
      <View style={[styles.header, { borderBottomColor: theme.colors.border.hairline }]}>
        <Button
          variant="plain"
          icon={ArrowLeft}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to inbox"
        />
        <View style={styles.headerTitle}>
          <Text
            numberOfLines={1}
            style={[theme.typography.headline, { color: theme.colors.text.primary }]}
          >
            {contactName}
          </Text>
          {thread ? (
            <Text style={[theme.typography.caption, { color: theme.colors.text.secondary }]}>
              {thread.assignedAgent ? thread.assignedAgent.name : 'Unassigned'}
            </Text>
          ) : null}
        </View>
        {/* Balances the back button so the title stays centred. */}
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {botActive ? (
          <View
            style={[
              styles.botBar,
              {
                backgroundColor: theme.colors.bg.fill,
                borderBottomColor: theme.colors.border.hairline,
                paddingHorizontal: s.s4,
                paddingVertical: s.s2,
                gap: s.s3,
              },
            ]}
          >
            <Text
              style={[theme.typography.footnote, { color: theme.colors.text.secondary, flex: 1 }]}
            >
              The bot is handling this chat. Take over to reply.
            </Text>
            <Button
              variant="tinted"
              label="Take over"
              loading={isTakingOver}
              onPress={() => {
                haptics.medium();
                takeover(customerId);
              }}
              accessibilityLabel="Take over this conversation from the bot"
            />
          </View>
        ) : null}

        <View style={{ flex: 1 }}>{renderBody()}</View>

        <View
          style={[
            styles.composer,
            {
              backgroundColor: theme.colors.bg.surface,
              borderTopColor: theme.colors.border.hairline,
              paddingHorizontal: s.s3,
              paddingVertical: s.s3,
              gap: s.s2,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              theme.typography.body,
              {
                backgroundColor: theme.colors.bg.fill,
                color: theme.colors.text.primary,
                borderRadius: theme.radius.full,
                paddingHorizontal: s.s4,
              },
            ]}
            placeholder={canReply ? 'Message…' : 'Take over this chat to reply'}
            placeholderTextColor={theme.colors.text.tertiary}
            value={text}
            onChangeText={setText}
            editable={canReply}
            multiline
            maxLength={1000}
            accessibilityLabel="Message text"
          />
          <Button
            variant="plain"
            icon={Send}
            onPress={handleSend}
            disabled={!canSend}
            loading={isSending}
            accessibilityLabel="Send message"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  botBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messageWrapper: {
    width: '100%',
    marginBottom: 12,
  },
  inbound: {
    alignItems: 'flex-start',
  },
  outbound: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
  },
  image: {
    width: MEDIA_WIDTH,
    height: MEDIA_WIDTH,
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
