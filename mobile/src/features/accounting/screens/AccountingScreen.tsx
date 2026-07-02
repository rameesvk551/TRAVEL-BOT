// FILE: mobile/src/features/accounting/screens/AccountingScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { MetricCard, SectionHeader, ListRow, Card, Button } from '../../../ui';
import { Calculator, FileText, TrendingUp, DollarSign } from 'lucide-react-native';

export function AccountingScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Accounting</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
         {/* KPI Grid */}
         <View style={{ paddingHorizontal: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3, marginBottom: s.s6 }}>
            <View style={{ width: '48%' }}><MetricCard label="Receivables" value="₹1.2L" /></View>
            <View style={{ width: '48%' }}><MetricCard label="Payables" value="₹45K" /></View>
            <View style={{ width: '48%' }}><MetricCard label="Cash Flow" value="₹75K" delta={12} deltaDirection="up" /></View>
            <View style={{ width: '48%' }}><MetricCard label="Net Profit" value="22%" delta={2} deltaDirection="up" /></View>
         </View>

         {/* Quick Links */}
         <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
            <SectionHeader title="Modules" />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
               <ListRow
                 leading={<FileText size={20} color={theme.colors.accent} />}
                 title="Invoices"
                 subtitle="Manage customer billing"
                 onPress={() => navigation.navigate('Invoices')}
               />
               <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
               <ListRow
                 leading={<TrendingUp size={20} color={theme.colors.accent} />}
                 title="Journals"
                 subtitle="View ledger entries"
                 onPress={() => {}}
               />
               <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
               <ListRow
                 leading={<DollarSign size={20} color={theme.colors.accent} />}
                 title="Chart of Accounts"
                 subtitle="Configure account structure"
                 onPress={() => {}}
               />
            </Card>
         </View>
      </ScrollView>
    </SafeAreaView>
  );
}
