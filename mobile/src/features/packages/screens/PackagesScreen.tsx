// FILE: mobile/src/features/packages/screens/PackagesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { usePackages, Package } from '../api';
import { SearchBar, Segmented, Card, Badge, EmptyState, Skeleton, Button } from '../../../ui';
import { Map, Plus, MoreVertical, CreditCard } from 'lucide-react-native';

export function PackagesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [category, setCategory] = useState(0); // 0: All, 1: Domestic, 2: International, 3: Inactive
  const categories = ['All', 'Domestic', 'International', 'Inactive'];
  const { data: packages, isLoading, refetch } = usePackages(categories[category]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Package }) => {
    return (
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: s.s4 }}>
        <View style={{ height: 120, backgroundColor: theme.colors.bg.fill, justifyContent: 'center', alignItems: 'center' }}>
          {item.coverImage ? (
             <Image source={{ uri: item.coverImage }} style={{ width: '100%', height: '100%' }} />
          ) : (
             <Map color={theme.colors.text.tertiary} size={32} />
          )}
        </View>
        <View style={{ padding: s.s3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headline, { color: theme.colors.text.primary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: s.s2 }}>
                <Badge label={item.category} variant="info" />
                <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{item.duration}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => {}} style={{ padding: 4 }}>
              <MoreVertical color={theme.colors.text.tertiary} size={20} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: s.s3 }}>
            <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
              ₹{item.basePrice.toLocaleString('en-IN')}
            </Text>
            <View style={{ flexDirection: 'row', gap: s.s2 }}>
              <Button variant="plain" label="Finance" icon={CreditCard} onPress={() => navigation.navigate('PackageFinance', { packageId: item.id })} />
              <Button variant="tinted" label="Edit" onPress={() => navigation.navigate('PackageForm', { packageId: item.id })} />
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Packages</Text>
        <Segmented segments={categories} selectedIndex={category} onChange={setCategory} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: s.s4 }}>
        {isLoading ? (
          <View style={{ gap: s.s4 }}>
            {[1, 2].map(i => <Skeleton key={i} height={200} />)}
          </View>
        ) : !packages || packages.length === 0 ? (
          <EmptyState icon={Map} title="No packages found" message="Try adjusting your filters or create a new one." />
        ) : (
          <FL
            data={packages}
            renderItem={renderItem}
            estimatedItemSize={220}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('PackageForm')} />
      </View>
    </SafeAreaView>
  );
}
