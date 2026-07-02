// FILE: mobile/src/features/reviews/screens/ReviewsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useReviews, Review } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar, Card } from '../../../ui';
import { Star, Globe } from 'lucide-react-native';

export function ReviewsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [platform, setPlatform] = useState(0); // 0: All, 1: Google, 2: Tripadvisor
  const platforms = ['All', 'Google', 'Tripadvisor'];
  const { data: reviews, isLoading, refetch } = useReviews(platforms[platform]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Review }) => {
    return (
      <Card style={{ padding: 0, marginBottom: s.s4, marginHorizontal: s.s4 }} onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}>
        <ListRow
          leading={<Avatar name={item.customerName} />}
          title={item.customerName}
          subtitle={new Date(item.date).toLocaleDateString()}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                 <Star size={14} color="#FFB800" fill="#FFB800" />
                 <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, fontWeight: 'bold' }]}>{item.rating}</Text>
              </View>
              <Badge label={item.platform} variant="info" />
            </View>
          }
          onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
        />
        <View style={{ padding: s.s3, paddingTop: 0 }}>
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
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Reviews</Text>
        <Segmented segments={platforms} selectedIndex={platform} onChange={setPlatform} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map(i => <Skeleton key={i} height={100} />)}
          </View>
        ) : !reviews || reviews.length === 0 ? (
          <EmptyState icon={Star} title="No reviews yet" message="When customers leave reviews, they will appear here." />
        ) : (
          <FL
            data={reviews}
            renderItem={renderItem}
            estimatedItemSize={120}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
