// FILE: mobile/src/features/social/screens/SocialScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useSocialMessages, SocialMessage } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar } from '../../../ui';
import { MessageSquare } from 'lucide-react-native';

export function SocialScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [platform, setPlatform] = useState(0); // 0: All, 1: Instagram, 2: Facebook
  const platforms = ['All', 'Instagram', 'Facebook'];
  const { data: messages, isLoading, refetch } = useSocialMessages(platforms[platform]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: SocialMessage }) => {
    return (
      <ListRow
        leading={<Avatar name={item.senderName} />}
        title={item.senderName}
        subtitle={
          <Text style={[theme.typography.subhead, { color: item.unread ? theme.colors.text.primary : theme.colors.text.secondary, fontWeight: item.unread ? '600' : '400' }]} numberOfLines={1}>
            {item.preview}
          </Text>
        }
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Text style={[theme.typography.caption2, { color: item.unread ? theme.colors.accent : theme.colors.text.tertiary, fontWeight: item.unread ? 'bold' : 'normal' }]}>
               {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </Text>
             <Badge label={item.platform} variant="info" />
          </View>
        }
        onPress={() => {}}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Social Inbox</Text>
        <Segmented segments={platforms} selectedIndex={platform} onChange={setPlatform} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !messages || messages.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Inbox Zero" message="You're all caught up on social messages." />
        ) : (
          <FL
            data={messages}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
