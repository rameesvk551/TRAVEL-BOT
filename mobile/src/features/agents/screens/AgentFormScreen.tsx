// FILE: mobile/src/features/agents/screens/AgentFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, Segmented, SectionHeader, Switch } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';

export function AgentFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  
  const [role, setRole] = useState(0); // 0: Sales, 1: Support, 2: Admin
  const [routing, setRouting] = useState(true);

  const s = theme.spacing;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Agent Profile</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Personal Details" />
            <Input label="Full Name" value="" onChangeText={() => {}} placeholder="e.g. John Doe" />
            <Input label="Email Address" value="" onChangeText={() => {}} placeholder="john@company.com" keyboardType="email-address" autoCapitalize="none" />
            
            <SectionHeader title="Role & Permissions" />
            <View>
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Role</Text>
              <Segmented segments={['Sales', 'Support', 'Admin']} selectedIndex={role} onChange={setRole} />
            </View>

            <SectionHeader title="Lead Routing" />
            <Switch label="Enable Auto-Routing" value={routing} onValueChange={setRouting} />
            {routing && (
               <Input label="Max Active Leads" value="50" onChangeText={() => {}} placeholder="50" />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label="Save Agent" 
          fullWidth 
          onPress={() => navigation.goBack()} 
        />
      </View>
    </SafeAreaView>
  );
}
