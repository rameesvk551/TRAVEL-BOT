// FILE: mobile/src/features/insights/screens/AnalyticsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useInsightsData } from '../api';
import { MetricCard, SectionHeader, Skeleton, Segmented } from '../../../ui';

export function AnalyticsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data, isLoading, refetch } = useInsightsData('analytics');
  const [timeframe, setTimeframe] = React.useState(0);

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Analytics</Text>
        <Segmented segments={['7D', '30D', 'YTD', 'All']} selectedIndex={timeframe} onChange={setTimeframe} />
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
         {isLoading ? (
            <View style={{ padding: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
              {[1, 2, 3, 4].map(i => <View key={i} style={{ width: '48%' }}><Skeleton height={100} /></View>)}
            </View>
         ) : (
            <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
               <SectionHeader title="Business Overview" />
               <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s.s3 }}>
                 {data?.map((item, i) => (
                   <View key={i} style={{ width: '48%' }}>
                     <MetricCard 
                       label={item.title} 
                       value={item.value} 
                       delta={Math.abs(item.delta)} 
                       deltaDirection={item.delta >= 0 ? 'up' : 'down'} 
                     />
                   </View>
                 ))}
               </View>
            </View>
         )}
      </ScrollView>
    </SafeAreaView>
  );
}
