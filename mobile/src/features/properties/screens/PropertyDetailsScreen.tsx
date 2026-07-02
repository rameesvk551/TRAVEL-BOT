// FILE: mobile/src/features/properties/screens/PropertyDetailsScreen.tsx
import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useProperty } from '../api';
import { Button, SectionHeader, Card, Skeleton, Badge, Chip } from '../../../ui';
import { ArrowLeft, Edit3, MapPin, Home } from 'lucide-react-native';

export function PropertyDetailsScreen({ route, navigation }: any) {
  const { propertyId } = route.params;
  const { theme } = useTheme();
  const { data: property, isLoading } = useProperty(propertyId);

  const s = theme.spacing;

  if (isLoading || !property) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
        <Skeleton height={300} />
        <View style={{ padding: s.s4, gap: s.s4 }}>
           <Skeleton height={40} />
           <Skeleton height={150} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero Image */}
        <View style={{ height: 300, backgroundColor: theme.colors.bg.fill, position: 'relative' }}>
          {property.coverImage ? (
            <Image source={{ uri: property.coverImage }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
               <Home color={theme.colors.text.tertiary} size={64} />
            </View>
          )}
          
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: s.s4 }}>
                <Button variant="fab" icon={ArrowLeft} onPress={() => navigation.goBack()} />
                <Button variant="fab" icon={Edit3} onPress={() => navigation.navigate('PropertyForm', { propertyId: property.id })} />
             </View>
          </SafeAreaView>
        </View>

        {/* Content */}
        <View style={{ padding: s.s4, gap: s.s5 }}>
          {/* Title Area */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary }]}>{property.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: s.s2, gap: s.s2 }}>
                   <Badge label={property.type} variant="info" />
                   {!property.isActive && <Badge label="Inactive" variant="danger" />}
                </View>
              </View>
            </View>
          </View>

          {/* Facts Strip */}
          <Card style={{ padding: s.s3, flexDirection: 'row', alignItems: 'center' }}>
             <View style={{ flex: 1, alignItems: 'center', borderRightWidth: 1, borderRightColor: theme.colors.border.hairline }}>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Price</Text>
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: 4 }]}>
                  ₹{property.pricePerNight.toLocaleString('en-IN')}<Text style={theme.typography.footnote}>/nt</Text>
                </Text>
             </View>
             <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Location</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                  <MapPin size={16} color={theme.colors.text.primary} />
                  <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]}>{property.location}</Text>
                </View>
             </View>
          </Card>

          {/* Description */}
          <View style={{ gap: s.s3 }}>
            <SectionHeader title="Description" />
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary }]}>
              A beautiful property located in the heart of {property.location}. Features all modern amenities for a comfortable stay.
            </Text>
          </View>

          {/* Amenities */}
          <View style={{ gap: s.s3 }}>
            <SectionHeader title="Amenities" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s2 }}>
              {property.amenities.map(a => (
                <Chip key={a} label={a} selected={false} />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
