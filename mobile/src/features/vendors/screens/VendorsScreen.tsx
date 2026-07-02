// FILE: mobile/src/features/vendors/screens/VendorsScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
const FL = FlashList as any;
import { useTheme } from '../../../theme/ThemeProvider';
import { useVendors, Vendor } from '../api';
import { Segmented, ListRow, Badge, EmptyState, Skeleton, Avatar, Button } from '../../../ui';
import { Store, Plus, ArrowLeft } from 'lucide-react-native';

export function VendorsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [category, setCategory] = useState(0);
  const categories = ['All', 'Hotel', 'Flight', 'Activity'];
  const { data: vendors, isLoading, refetch } = useVendors(categories[category]);

  const s = theme.spacing;

  const renderItem = ({ item }: { item: Vendor }) => {
    return (
      <ListRow
        leading={<Avatar name={item.name} />}
        title={item.name}
        subtitle={item.contactName}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
             <Badge label={item.category} variant="info" />
             {item.balanceDue > 0 ? (
               <Text style={[theme.typography.subhead, { color: theme.colors.status.danger, fontWeight: 'bold' }]}>
                 Due: ₹{item.balanceDue.toLocaleString('en-IN')}
               </Text>
             ) : (
               <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>
                 Settled
               </Text>
             )}
          </View>
        }
        onPress={() => {}}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Vendors</Text>
        <Segmented segments={categories} selectedIndex={category} onChange={setCategory} />
      </View>

      <View style={{ flex: 1 }}>
        {isLoading ? (
          <View style={{ gap: s.s4, padding: s.s4 }}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height={72} />)}
          </View>
        ) : !vendors || vendors.length === 0 ? (
          <EmptyState icon={Store} title="No vendors" message="Add your suppliers and partners." />
        ) : (
          <FL
            data={vendors}
            renderItem={renderItem}
            estimatedItemSize={76}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
            ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border.hairline, marginLeft: 16 }} />}
          />
        )}
      </View>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => {}} />
      </View>
    </SafeAreaView>
  );
}
