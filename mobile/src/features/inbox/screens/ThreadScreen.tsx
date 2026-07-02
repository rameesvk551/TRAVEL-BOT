// FILE: mobile/src/features/inbox/screens/ThreadScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useMessages, useSendMessage, ChatMessage } from '../api';
import { Button, Skeleton } from '../../../ui';
import { ArrowLeft, MoreHorizontal, Paperclip, Mic, Send, Check, CheckCheck } from 'lucide-react-native';
import * as haptics from '../../../lib/haptics';

export function ThreadScreen({ route, navigation }: any) {
  const { threadId, contactName } = route.params;
  const { theme } = useTheme();
  const { data: messages, isLoading } = useMessages(threadId);
  const { mutate: sendMessage } = useSendMessage();
  
  const [text, setText] = useState('');

  const s = theme.spacing;

  const handleSend = () => {
    if (text.trim()) {
      haptics.light();
      sendMessage({ threadId, content: text.trim() });
      setText('');
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOut = item.direction === 'outbound';
    
    return (
      <View style={[styles.messageWrapper, isOut ? styles.outbound : styles.inbound]}>
        <View style={[
          styles.bubble, 
          { backgroundColor: isOut ? theme.colors.accentTint : theme.colors.bg.fill },
          isOut ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }
        ]}>
          <Text style={[theme.typography.body, { color: isOut ? theme.colors.accent : theme.colors.text.primary }]}>
            {item.content}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[theme.typography.caption2, { color: isOut ? theme.colors.accent : theme.colors.text.tertiary, opacity: 0.7 }]}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {isOut && (
              <View style={{ marginLeft: 4 }}>
                {item.status === 'sent' ? <Check color={theme.colors.accent} size={12} /> : 
                 item.status === 'read' ? <CheckCheck color={theme.colors.status.info} size={12} /> : 
                 item.status === 'delivered' ? <CheckCheck color={theme.colors.accent} size={12} /> : null}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border.hairline }]}>
        <Button variant="plain" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <View style={styles.headerTitle}>
          <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>{contactName}</Text>
          <Text style={[theme.typography.caption2, { color: theme.colors.status.success }]}>Online</Text>
        </View>
        <Button variant="plain" icon={MoreHorizontal} onPress={() => {}} />
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View style={{ padding: s.s4, gap: s.s4 }}>
              <Skeleton width="70%" height={60} style={{ alignSelf: 'flex-start' }} />
              <Skeleton width="60%" height={60} style={{ alignSelf: 'flex-end' }} />
            </View>
          ) : (
            <FL
            data={messages}
              renderItem={renderMessage}
              estimatedItemSize={80}
              contentContainerStyle={{ padding: s.s4 }}
              inverted={false} // In a real app we might invert to show latest at bottom if data is reversed
            />
          )}
        </View>

        {/* Composer */}
        <View style={[styles.composer, { backgroundColor: theme.colors.bg.surface, borderTopColor: theme.colors.border.hairline }]}>
          <Button variant="plain" icon={Paperclip} onPress={() => {}} />
          <TextInput
            style={[
              styles.input, 
              theme.typography.body, 
              { backgroundColor: theme.colors.bg.fill, color: theme.colors.text.primary, borderRadius: theme.radius.full }
            ]}
            placeholder="Message..."
            placeholderTextColor={theme.colors.text.tertiary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          {text.trim().length > 0 ? (
            <Button variant="plain" icon={Send} onPress={handleSend} />
          ) : (
            <Button variant="plain" icon={Mic} onPress={() => {}} />
          )}
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
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    marginHorizontal: 8,
  },
});
