// FILE: mobile/src/features/reviews/screens/ReviewsScreen.tsx
// Reviews are first-party post-trip testimonials — there is no Google/Tripadvisor
// dimension in the data. The real axis is whether a testimonial has been approved
// for marketing use (isPublished), which is also what the backend can filter on.

import React, { useState } from 'react';
import { View, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useReviews, useReviewStats, Review, ReviewFilter } from '../api';
import {
  Segmented,
  ListRow,
  Badge,
  EmptyState,
  ErrorState,
  Skeleton,
  Avatar,
  Card,
  MetricCard,
  SectionHeader,
  BarChart,
  type BarDatum,
} from '../../../ui';
import { Star } from 'lucide-react-native';
import { formatDate } from '../../../lib/formatters';

const FILTERS: Array<{ label: string; value: ReviewFilter }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Unpublished', value: 'UNPUBLISHED' },
];

export function ReviewsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  const [filterIndex, setFilterIndex] = useState(0);
  const { data: reviews, isLoading, isError, error, refetch, isRefetching } = useReviews(
    FILTERS[filterIndex].value,
  );
  const { data: stats } = useReviewStats();

  // Ratings 1-5 have an inherent order, so the ordinal ramp — not a categorical
  // palette, and certainly not a donut.
  const distributionBars: BarDatum[] = [5, 4, 3, 2, 1].map((rating) => {
    const row = stats?.distribution?.find((d) => Number(d.rating) === rating);
    return { label: `${rating} star`, value: Number(row?.count ?? 0) };
  });

  const hasDistribution = distributionBars.some((b) => b.value > 0);

  const renderItem = ({ item }: { item: Review }) => {
    const name = item.customer?.name ?? 'Customer';

    return (
      <Card
        style={{ padding: 0, marginBottom: s.s4, marginHorizontal: s.s4 }}
        onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
        accessibilityLabel={`${name}, ${item.rating} out of 5 stars, ${
          item.isPublished ? 'published' : 'not published'
        }`}
      >
        <ListRow
          leading={<Avatar name={name} />}
          title={name}
          subtitle={[item.destination, formatDate(item.createdAt)].filter(Boolean).join(' · ')}
          trailing={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Star size={14} color={theme.colors.status.warning} fill={theme.colors.status.warning} />
                <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, fontWeight: '600' }]}>
                  {item.rating}
                </Text>
              </View>
              <Badge
                label={item.isPublished ? 'Published' : 'Draft'}
                variant={item.isPublished ? 'success' : 'neutral'}
              />
            </View>
          }
          onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
        />
        {item.testimonial ? (
          <View style={{ padding: s.s3, paddingTop: 0 }}>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]} numberOfLines={2}>
              {item.testimonial}
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  const listHeader = hasDistribution ? (
    <View style={{ paddingHorizontal: s.s4, paddingBottom: s.s4, gap: s.s3 }}>
      <SectionHeader title="Rating distribution" />
      <Card>
        <BarChart
          data={distributionBars}
          variant="ordinal"
          formatValue={(v) => v.toLocaleString('en-IN')}
        />
      </Card>
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>
          Reviews
        </Text>

        <View style={{ flexDirection: 'row', gap: s.s3, marginBottom: s.s4 }}>
          <View style={{ flex: 1 }}>
            <MetricCard label="Average rating" value={stats ? stats.avgRating.toFixed(1) : '—'} />
          </View>
          <View style={{ flex: 1 }}>
            <MetricCard label="Published" value={(stats?.publishedCount ?? 0).toLocaleString('en-IN')} />
          </View>
        </View>

        <Segmented segments={FILTERS.map((f) => f.label)} selectedIndex={filterIndex} onChange={setFilterIndex} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error)?.message} onRetry={refetch} />
        ) : !reviews || reviews.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews yet"
            message="When customers leave reviews, they will appear here."
          />
        ) : (
          <FL
            data={reviews}
            renderItem={renderItem}
            keyExtractor={(item: Review) => item.id}
            estimatedItemSize={120}
            ListHeaderComponent={listHeader}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
