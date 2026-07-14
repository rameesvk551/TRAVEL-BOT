// FILE: mobile/src/features/properties/screens/PropertyDetailsScreen.tsx
import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useProperty, formatPaise, getApiErrorMessage } from '../api';
import { Button, SectionHeader, Card, Skeleton, Badge, Chip, ErrorState } from '../../../ui';
import { ArrowLeft, Edit3, MapPin, Home } from 'lucide-react-native';

export function PropertyDetailsScreen({ route, navigation }: any) {
  const { propertyId } = route.params;
  const { theme } = useTheme();
  const { data: property, isLoading, isError, error, refetch } = useProperty(propertyId);

  const s = theme.spacing;

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <Skeleton height={300} radius={0} />
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={40} />
          <Skeleton height={150} />
        </View>
      </View>
    );
  }

  if (isError || !property) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: s.s4,
            paddingVertical: s.s3,
          }}
        >
          <Button
            variant="icon"
            icon={ArrowLeft}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
          />
        </View>
        <View style={{ padding: s.s4 }}>
          <ErrorState
            message={getApiErrorMessage(error, 'Could not load this property')}
            onRetry={refetch}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={{ height: 300, backgroundColor: theme.colors.bg.fill, position: 'relative' }}>
          {property.imageUrl ? (
            <Image
              source={{ uri: property.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Home color={theme.colors.text.tertiary} size={64} />
            </View>
          )}

          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: s.s4 }}>
              <Button
                variant="fab"
                icon={ArrowLeft}
                onPress={() => navigation.goBack()}
                accessibilityLabel="Go back"
              />
              <Button
                variant="fab"
                icon={Edit3}
                onPress={() => navigation.navigate('PropertyForm', { propertyId: property.id })}
                accessibilityLabel={`Edit ${property.name}`}
              />
            </View>
          </SafeAreaView>
        </View>

        <View style={{ padding: s.s4, gap: s.s5 }}>
          <View>
            <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>
              {property.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2 }}>
              <Badge label={property.propertyType} variant="info" />
              {!property.isActive ? <Badge label="Inactive" variant="danger" /> : null}
            </View>
          </View>

          {/* Facts strip */}
          <Card style={{ padding: s.s3, flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                borderRightWidth: 1,
                borderRightColor: theme.colors.border.hairline,
              }}
            >
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                Price
              </Text>
              <Text
                style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: 4 }]}
              >
                {property.pricePerNight != null ? (
                  <>
                    {formatPaise(property.pricePerNight)}
                    <Text style={theme.typography.footnote}>/nt</Text>
                  </>
                ) : (
                  'On request'
                )}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                Location
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                <MapPin size={16} color={theme.colors.text.primary} />
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>
                  {property.location || '—'}
                </Text>
              </View>
            </View>
          </Card>

          {/* Description — real column, no placeholder copy. */}
          {property.description ? (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Description" />
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                {property.description}
              </Text>
            </View>
          ) : null}

          {property.address ? (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Address" />
              <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
                {property.address}
              </Text>
            </View>
          ) : null}

          {property.amenities?.length ? (
            <View style={{ gap: s.s3 }}>
              <SectionHeader title="Amenities" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
                {property.amenities.map((a) => (
                  <Chip key={a} label={a} selected={false} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
