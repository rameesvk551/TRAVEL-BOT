// FILE: mobile/src/features/reviews/screens/ReviewDetailScreen.tsx
//
// The "Public reply" composer that used to live here has been REMOVED: the
// backend has no reply endpoint for reviews (routes/reviews.ts exposes only
// list, stats, and toggle-published). The one real action is approving a
// testimonial for marketing use, which is what this screen now does.

import React from 'react';
import { View, Text, ScrollView, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useReview, useTogglePublished } from '../api';
import {
  Button,
  SectionHeader,
  Card,
  Skeleton,
  Badge,
  Avatar,
  ErrorState,
  ListRow,
} from '../../../ui';
import { ArrowLeft, Star, Eye, EyeOff, MapPin, Ticket } from 'lucide-react-native';
import { formatDate } from '../../../lib/formatters';

export function ReviewDetailScreen({ route, navigation }: any) {
  const { reviewId } = route.params;
  const { theme } = useTheme();
  const s = theme.spacing;

  const { data: review, isLoading, isError, error, refetch, isRefetching } = useReview(reviewId);
  const toggleMutation = useTogglePublished();

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: s.s4,
        paddingVertical: s.s3,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border.hairline,
      }}
    >
      <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>
        Review
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        {header}
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={80} />
          <Skeleton height={150} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !review) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        {header}
        <ErrorState message={(error as Error)?.message} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const name = review.customer?.name ?? 'Customer';

  const handleToggle = () => {
    toggleMutation.mutate(review.id, {
      onError: (e: any) =>
        Alert.alert(
          'Could not update',
          e?.response?.data?.error ?? e?.message ?? 'Please try again.',
        ),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {header}

      <ScrollView
        contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {/* Identity */}
        <View style={{ alignItems: 'center', marginBottom: s.s5 }}>
          <Avatar name={name} size={64} />
          <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>
            {name}
          </Text>

          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2 }}
            accessibilityLabel={`Rated ${review.rating} out of 5 stars`}
          >
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={16}
                  color={i <= review.rating ? theme.colors.status.warning : theme.colors.border.hairline}
                  fill={i <= review.rating ? theme.colors.status.warning : 'transparent'}
                />
              ))}
            </View>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
              · {formatDate(review.createdAt)}
            </Text>
          </View>

          <View style={{ marginTop: s.s2 }}>
            <Badge
              label={review.isPublished ? 'Published' : 'Not published'}
              variant={review.isPublished ? 'success' : 'neutral'}
            />
          </View>
        </View>

        <View style={{ gap: s.s4 }}>
          <SectionHeader title="Feedback" />
          <Card>
            <Text style={[theme.typography.body, { color: theme.colors.text.primary, lineHeight: 24 }]}>
              {review.testimonial ? `“${review.testimonial}”` : 'This customer left a rating without a comment.'}
            </Text>
          </Card>

          {(review.destination || review.booking?.bookingRef) && (
            <>
              <SectionHeader title="Trip" />
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {review.destination ? (
                  <ListRow
                    leading={<MapPin size={20} color={theme.colors.text.tertiary} />}
                    title="Destination"
                    subtitle={review.destination}
                  />
                ) : null}
                {review.destination && review.booking?.bookingRef ? (
                  <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                ) : null}
                {review.booking?.bookingRef ? (
                  <ListRow
                    leading={<Ticket size={20} color={theme.colors.text.tertiary} />}
                    title="Booking"
                    subtitle={review.booking.bookingRef}
                  />
                ) : null}
              </Card>
            </>
          )}

          <SectionHeader title="Marketing" />
          <Card>
            <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
              {review.isPublished
                ? 'This testimonial is approved and can be used in marketing material.'
                : 'Publish this testimonial to use it in marketing material.'}
            </Text>
          </Card>

          <Button
            variant={review.isPublished ? 'secondary' : 'primary'}
            label={review.isPublished ? 'Unpublish' : 'Publish testimonial'}
            icon={review.isPublished ? EyeOff : Eye}
            fullWidth
            loading={toggleMutation.isPending}
            onPress={handleToggle}
            accessibilityLabel={review.isPublished ? 'Unpublish this testimonial' : 'Publish this testimonial'}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
