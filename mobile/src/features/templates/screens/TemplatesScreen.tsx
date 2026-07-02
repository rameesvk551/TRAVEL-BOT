// FILE: mobile/src/features/templates/screens/TemplatesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useTemplates, Template } from '../api';
import { Segmented, Card, Badge, EmptyState, Skeleton, Button, Chip } from '../../../ui';
import { FileText, Plus, MessageCircle, Mail } from 'lucide-react-native';

export function TemplatesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [channel, setChannel] = useState(0); // 0: All, 1: WhatsApp, 2: Email
  const channels = ['All', 'WhatsApp', 'Email'];
  const { data: templates, isLoading, refetch } = useTemplates(channels[channel]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Template }) => {
    const Icon = item.channel === 'WhatsApp' ? MessageCircle : Mail;
    return (
      <Card style={{ padding: s.s3, marginBottom: s.s4, marginHorizontal: s.s4 }} onPress={() => navigation.navigate('TemplateForm', { templateId: item.id })}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: s.s3 }}>
            <View style={{ width: 44, height: 44, borderRadius: theme.radius.full, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
               <Icon size={20} color={item.channel === 'WhatsApp' ? '#25D366' : theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>{item.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
                <Badge label={item.category} variant="info" />
              </View>
            </View>
          </View>
          <Badge label={item.status} variant={item.status === 'Approved' ? 'success' : 'warning'} />
        </View>
        <View style={{ marginTop: s.s3, paddingTop: s.s3, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
          <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]} numberOfLines={2}>
            {item.content}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Templates</Text>
        <Segmented segments={channels} selectedIndex={channel} onChange={setChannel} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={120} />)}
          </View>
        ) : !templates || templates.length === 0 ? (
          <EmptyState icon={FileText} title="No templates" message="Create reusable message templates." />
        ) : (
          <FL
            data={templates}
            renderItem={renderItem}
            estimatedItemSize={140}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('TemplateForm')} />
      </View>
    </SafeAreaView>
  );
}
