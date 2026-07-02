// FILE: mobile/src/features/customers/screens/CustomerDetailScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useCustomer } from '../api';
import { Avatar, Button, Segmented, Skeleton, Card, ListRow, SectionHeader, EmptyState } from '../../../ui';
import { Phone, MessageCircle, Edit3, ArrowLeft, Briefcase, FileText } from 'lucide-react-native';

export function CustomerDetailScreen({ route, navigation }: any) {
  const { customerId, customerName } = route.params;
  const { theme } = useTheme();
  const { data: customer, isLoading } = useCustomer(customerId);
  const [tabIndex, setTabIndex] = useState(0); // 0: Profile, 1: Services, 2: Messages, 3: Documents, 4: Ledger, 5: Timeline

  const s = theme.spacing;

  if (isLoading || !customer) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
        <View style={{ padding: s.s4, gap: s.s4 }}>
          <Skeleton height={200} />
          <Skeleton height={40} />
          <Skeleton height={300} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }} />
        <Button variant="icon" icon={Edit3} onPress={() => {}} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Profile Card Header */}
        <View style={{ alignItems: 'center', padding: s.s4 }}>
          <Avatar name={customer.name} size={80} />
          <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>
            {customer.name}
          </Text>
          <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary, marginTop: 4 }]}>
            {customer.phone}
          </Text>

          <View style={{ flexDirection: 'row', gap: s.s3, marginTop: s.s4 }}>
            <Button variant="tinted" icon={Phone} label="Call" onPress={() => {}} />
            <Button variant="tinted" icon={MessageCircle} label="WhatsApp" onPress={() => {}} />
          </View>
        </View>

        {/* Financial Summary Strip */}
        <View style={{ flexDirection: 'row', paddingHorizontal: s.s4, marginBottom: s.s6 }}>
          <Card style={{ flex: 1, marginRight: s.s2, padding: s.s3, alignItems: 'center' }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Billed</Text>
            <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginTop: 4 }]}>
              ₹{customer.totalBilled.toLocaleString('en-IN')}
            </Text>
          </Card>
          <Card style={{ flex: 1, marginLeft: s.s2, padding: s.s3, alignItems: 'center' }}>
            <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>Balance</Text>
            <Text style={[theme.typography.headline, { color: customer.balanceDue > 0 ? theme.colors.status.danger : theme.colors.text.primary, marginTop: 4 }]}>
              ₹{customer.balanceDue.toLocaleString('en-IN')}
            </Text>
          </Card>
        </View>

        {/* Segmented Sub-nav */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: s.s4, paddingBottom: s.s4 }}>
          <View style={{ width: 450 }}>
            <Segmented
              segments={['Profile', 'Services', 'Messages', 'Docs', 'Ledger', 'Timeline']}
              selectedIndex={tabIndex}
              onChange={setTabIndex}
            />
          </View>
        </ScrollView>

        {/* Tab Content */}
        <View style={{ paddingHorizontal: s.s4 }}>
          {tabIndex === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Contact Information" />
              <Card>
                <ListRow title="Email" subtitle={customer.email} />
                <ListRow title="Phone" subtitle={customer.phone} />
                <ListRow title="Created" subtitle={new Date(customer.createdAt).toLocaleDateString()} />
              </Card>
            </View>
          )}

          {tabIndex === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Bookings & Services" action="Add New" onAction={() => {}} />
              <EmptyState icon={Briefcase} title="No services" message="This customer hasn't booked anything yet." />
            </View>
          )}

          {tabIndex === 2 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Recent Messages" />
              <EmptyState icon={MessageCircle} title="No messages" message="Start a conversation with this customer." />
            </View>
          )}
          
          {tabIndex === 3 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Documents" action="Upload" onAction={() => {}} />
              <EmptyState icon={FileText} title="No documents" message="Upload passports or visas here." />
            </View>
          )}

          {tabIndex === 4 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Financial Ledger" />
              <EmptyState icon={FileText} title="No transactions" message="No invoices or payments yet." />
            </View>
          )}

          {tabIndex === 5 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Activity Timeline" />
              <EmptyState icon={FileText} title="No activity" message="No recent events." />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
