// FILE: mobile/src/features/properties/screens/PropertiesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useProperties, Property } from '../api';
import { Segmented, Card, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { Home, Plus, MapPin } from 'lucide-react-native';

export function PropertiesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [status, setStatus] = useState(0); // 0: All, 1: For sale, 2: For rent, 3: Inactive
  const statuses = ['All', 'For sale', 'For rent', 'Inactive'];
  const { data: properties, isLoading, refetch } = useProperties(statuses[status]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Property }) => {
    return (
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: s.s4 }} onPress={() => navigation.navigate('PropertyDetails', { propertyId: item.id })}>
        <View style={{ height: 160, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
          {item.coverImage ? (
             <Image source={{ uri: item.coverImage }} style={{ width: '100%', height: '100%' }} />
          ) : (
             <Home color={theme.colors.text.tertiary} size={40} />
          )}
        </View>
        <View style={{ padding: s.s3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s1 }}>
                <MapPin size={12} color={theme.colors.text.secondary} />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{item.location}</Text>
              </View>
            </View>
            <Badge label={item.type} variant="info" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s.s3 }}>
            <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
              ₹{item.pricePerNight.toLocaleString('en-IN')}<Text style={[theme.typography.footnote, { color: theme.colors.text.secondary }]}>/night</Text>
            </Text>
            <Button variant="tinted" label="Edit" onPress={() => navigation.navigate('PropertyForm', { propertyId: item.id })} />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Properties</Text>
        <Segmented segments={statuses} selectedIndex={status} onChange={setStatus} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: s.s4 }}>
        {isLoading ? (
          <View style={{ gap: s.s4 }}>
            {[1, 2].map(i => <Skeleton key={i} height={250} />)}
          </View>
        ) : !properties || properties.length === 0 ? (
          <EmptyState icon={Home} title="No properties found" message="Try adjusting your filters or add a new one." />
        ) : (
          <FL
            data={properties}
            renderItem={renderItem}
            estimatedItemSize={280}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('PropertyForm')} />
      </View>
    </SafeAreaView>
  );
}
