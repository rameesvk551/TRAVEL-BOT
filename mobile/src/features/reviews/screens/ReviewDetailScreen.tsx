// FILE: mobile/src/features/reviews/screens/ReviewDetailScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useReview } from '../api';
import { Button, SectionHeader, Card, Skeleton, Badge, Avatar, Input } from '../../../ui';
import { ArrowLeft, Star, Send } from 'lucide-react-native';

export function ReviewDetailScreen({ route, navigation }: any) {
  const { reviewId } = route.params;
  const { theme } = useTheme();
  const { data: review, isLoading } = useReview(reviewId);

  const [reply, setReply] = useState('');

  const s = theme.spacing;

  if (isLoading || !review) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <SafeAreaView edges={['top']}>
          <View style={{ padding: s.s4, gap: s.s4 }}>
             <Skeleton height={40} />
             <Skeleton height={150} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3, borderBottomWidth: 1, borderBottomColor: theme.colors.border.hairline }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Review Details</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
           
          {/* Header Card */}
          <View style={{ alignItems: 'center', marginBottom: s.s5 }}>
            <Avatar name={review.customerName} size={64} />
            <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>{review.customerName}</Text>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2 }}>
              <View style={{ flexDirection: 'row', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={16} color={i <= review.rating ? "#FFB800" : theme.colors.border.hairline} fill={i <= review.rating ? "#FFB800" : "transparent"} />
                ))}
              </View>
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>• {new Date(review.date).toLocaleDateString()}</Text>
            </View>
            <View style={{ marginTop: s.s2 }}>
               <Badge label={review.platform} variant="info" />
            </View>
          </View>

          {/* Content */}
          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Customer Feedback" />
            <Card style={{ padding: s.s4 }}>
               <Text style={[theme.typography.body, { color: theme.colors.text.primary, lineHeight: 24 }]}>
                 "{review.content}"
               </Text>
            </Card>

            <SectionHeader title="Public Reply" />
            {review.replied ? (
              <Card style={{ padding: s.s4, backgroundColor: theme.colors.bg.surfaceRaised }}>
                <Text style={[theme.typography.subhead, { color: theme.colors.text.primary, marginBottom: s.s2 }]}>Your response:</Text>
                <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                  Thank you for your feedback! We're glad you enjoyed your trip.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: s.s3 }}>
                <Input label="Write a public response" value={reply} onChangeText={setReply} multiline placeholder="Thank the customer for their review..." />
                <Button variant="primary" label="Post Reply" icon={Send} onPress={() => {}} />
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
