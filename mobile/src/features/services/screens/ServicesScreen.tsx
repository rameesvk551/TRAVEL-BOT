// FILE: mobile/src/features/services/screens/ServicesScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useServices, AddonService } from '../api';
import { FilterChipRow, Card, Badge, EmptyState, Skeleton, Button, Chip } from '../../../ui';
import { Briefcase, Plus, MoreVertical } from 'lucide-react-native';

export function ServicesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const categories = ['All', 'Insurance', 'Transport', 'Ticketing', 'Inactive'];
  const [category, setCategory] = useState(categories[0]);
  
  const { data: services, isLoading, refetch } = useServices(category);

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Services</Text>
        <FilterChipRow 
          chips={categories.map(c => ({ key: c, label: c, selected: c === category }))} 
          onToggle={(k) => setCategory(k)} 
        />
      </View>

      <ScrollView 
        contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
        {isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
             {[1, 2, 3, 4].map(i => <View key={i} style={{ width: '48%' }}><Skeleton height={150} /></View>)}
          </View>
        ) : !services || services.length === 0 ? (
          <EmptyState icon={Briefcase} title="No services found" message="Try adjusting your filters or create a new one." />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
            {services.map(item => (
              <Card key={item.id} style={{ width: '48%', padding: s.s3 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 32 }}>{item.icon}</Text>
                  <Button variant="icon" icon={MoreVertical} onPress={() => navigation.navigate('ServiceForm', { serviceId: item.id })} />
                </View>
                <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: s.s3 }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={{ alignSelf: 'flex-start', marginTop: s.s2 }}>
                  <Badge label={item.category} variant="info" />
                </View>
                <View style={{ marginTop: s.s3 }}>
                  <Text style={[theme.typography.title3, { color: theme.colors.text.primary }]}>
                    ₹{item.price.toLocaleString('en-IN')}
                  </Text>
                  <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>{item.pricingType}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: s.s3 }}>
                  {item.features.slice(0, 2).map((f, i) => (
                    <Chip key={i} label={f} selected={false} />
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
        <Button variant="fab" icon={Plus} onPress={() => navigation.navigate('ServiceForm')} />
      </View>
    </SafeAreaView>
  );
}
