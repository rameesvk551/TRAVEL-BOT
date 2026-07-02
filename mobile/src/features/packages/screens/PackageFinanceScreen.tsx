// FILE: mobile/src/features/packages/screens/PackageFinanceScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Segmented, MetricCard, ListRow, Badge, EmptyState } from '../../../ui';
import { ArrowLeft, CreditCard, Plus } from 'lucide-react-native';

export function PackageFinanceScreen({ route, navigation }: any) {
  const { packageId } = route.params;
  const { theme } = useTheme();
  const [tabIndex, setTabIndex] = useState(0); // 0: Receivables, 1: Payables, 2: Vendors, 3: Aging

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Finance</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* KPI Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: s.s4, gap: s.s3, marginBottom: s.s6 }}>
          <View style={{ width: '48%' }}><MetricCard label="Expected" value="₹1.5L" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Received" value="₹1.0L" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Pending" value="₹50K" deltaDirection="down" /></View>
          <View style={{ width: '48%' }}><MetricCard label="Cost" value="₹80K" /></View>
        </View>

        {/* Tabs */}
        <View style={{ paddingHorizontal: s.s4, marginBottom: s.s4 }}>
          <Segmented segments={['Receivables', 'Payables', 'Vendors', 'Aging']} selectedIndex={tabIndex} onChange={setTabIndex} />
        </View>

        {/* List Content */}
        <View style={{ paddingHorizontal: s.s4 }}>
          {tabIndex === 0 && (
            <View>
              <ListRow title="Ravi Kumar" subtitle="Booking #B001" trailing={<Badge label="Paid" variant="success" />} />
              <ListRow title="Sunita Sharma" subtitle="Booking #B002" trailing={<Badge label="₹15K Due" variant="danger" />} />
            </View>
          )}

          {tabIndex === 1 && (
            <View>
              <EmptyState icon={CreditCard} title="No Payables" message="Add a vendor payable to track costs." />
            </View>
          )}
        </View>
      </ScrollView>

      {tabIndex === 1 && (
        <View style={{ position: 'absolute', bottom: s.s6, right: s.s4 }}>
          <Button variant="fab" icon={Plus} onPress={() => {}} />
        </View>
      )}
    </SafeAreaView>
  );
}
