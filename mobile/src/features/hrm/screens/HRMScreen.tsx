// FILE: mobile/src/features/hrm/screens/HRMScreen.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { useLeaveRequests, LeaveRequest } from '../api';
import { MetricCard, SectionHeader, ListRow, Card, Badge, Skeleton, EmptyState, Avatar } from '../../../ui';
import { Users, Calendar } from 'lucide-react-native';

export function HRMScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data: leaves, isLoading, refetch } = useLeaveRequests();
  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>HR & Payroll</Text>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={theme.colors.accent} />}
      >
         {/* KPI Grid */}
         <View style={{ paddingHorizontal: s.s4, flexDirection: 'row', flexWrap: 'wrap', gap: s.s3, marginBottom: s.s6 }}>
            <View style={{ width: '48%' }}><MetricCard label="Headcount" value="12" /></View>
            <View style={{ width: '48%' }}><MetricCard label="On Leave" value="2" /></View>
            <View style={{ width: '48%' }}><MetricCard label="Payroll Cost" value="₹4.2L" /></View>
            <View style={{ width: '48%' }}><MetricCard label="Avg Tenure" value="1.5y" /></View>
         </View>

         {/* Leave Requests */}
         <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
            <SectionHeader title="Leave Requests" />
            {isLoading ? (
              <View style={{ gap: s.s4 }}>
                <Skeleton height={72} />
                <Skeleton height={72} />
              </View>
            ) : !leaves || leaves.length === 0 ? (
              <EmptyState icon={Calendar} title="No requests" message="No pending leave requests." />
            ) : (
              <View style={{ gap: s.s3 }}>
                {leaves.map(item => (
                  <Card key={item.id} style={{ padding: 0, overflow: 'hidden' }}>
                    <ListRow
                      leading={<Avatar name={item.employeeName} />}
                      title={item.employeeName}
                      subtitle={`${item.type} • ${item.days} days`}
                      trailing={
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                           <Badge label={item.status} variant={item.status === 'Approved' ? 'success' : item.status === 'Pending' ? 'warning' : 'danger'} />
                           <Text style={[theme.typography.caption2, { color: theme.colors.text.secondary }]}>
                             {new Date(item.startDate).toLocaleDateString()}
                           </Text>
                        </View>
                      }
                    />
                  </Card>
                ))}
              </View>
            )}
         </View>
      </ScrollView>
    </SafeAreaView>
  );
}
