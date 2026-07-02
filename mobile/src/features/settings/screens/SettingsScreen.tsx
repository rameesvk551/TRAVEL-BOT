// FILE: mobile/src/features/settings/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { SectionHeader, ListRow, Card, Avatar } from '../../../ui';
import { User, Bell, Lock, Building, CreditCard, HelpCircle, LogOut } from 'lucide-react-native';

export function SettingsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      <View style={{ paddingHorizontal: s.s4, paddingTop: s.s4, paddingBottom: s.s4 }}>
        <Text style={[theme.typography.largeTitle, { color: theme.colors.text.primary, marginBottom: s.s4 }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
         
         <View style={{ alignItems: 'center', marginBottom: s.s5 }}>
            <Avatar name="Admin User" size={80} />
            <Text style={[theme.typography.title2, { color: theme.colors.text.primary, marginTop: s.s3 }]}>Admin User</Text>
            <Text style={[theme.typography.body, { color: theme.colors.text.secondary, marginTop: 4 }]}>admin@wanderlust.com</Text>
         </View>

         <View style={{ paddingHorizontal: s.s4, gap: s.s4 }}>
            
            <View>
               <SectionHeader title="Account" />
               <Card style={{ padding: 0, overflow: 'hidden' }}>
                 <ListRow leading={<User size={20} color={theme.colors.accent} />} title="Personal Information" onPress={() => {}} />
                 <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                 <ListRow leading={<Bell size={20} color={theme.colors.accent} />} title="Notifications" onPress={() => {}} />
                 <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                 <ListRow leading={<Lock size={20} color={theme.colors.accent} />} title="Security & Passwords" onPress={() => {}} />
               </Card>
            </View>

            <View>
               <SectionHeader title="Workspace" />
               <Card style={{ padding: 0, overflow: 'hidden' }}>
                 <ListRow leading={<Building size={20} color={theme.colors.accent} />} title="Business Profile" onPress={() => navigation.navigate('BusinessProfile')} />
                 <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                 <ListRow leading={<CreditCard size={20} color={theme.colors.accent} />} title="Billing & Plans" onPress={() => {}} />
               </Card>
            </View>

            <View>
               <SectionHeader title="Support" />
               <Card style={{ padding: 0, overflow: 'hidden' }}>
                 <ListRow leading={<HelpCircle size={20} color={theme.colors.accent} />} title="Help Center" onPress={() => {}} />
                 <View style={{ height: 1, backgroundColor: theme.colors.border.hairline, marginLeft: 56 }} />
                 <ListRow leading={<LogOut size={20} color={theme.colors.status.danger} />} title="Sign Out" onPress={() => {}} />
               </Card>
            </View>

         </View>
      </ScrollView>
    </SafeAreaView>
  );
}
