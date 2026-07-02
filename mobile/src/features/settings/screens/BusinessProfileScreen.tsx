// FILE: mobile/src/features/settings/screens/BusinessProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, SectionHeader } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';
import { useBusinessProfile } from '../api';

export function BusinessProfileScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { data: profile, isLoading } = useBusinessProfile();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
      setPhone(profile.phone);
      setAddress(profile.address);
    }
  }, [profile]);

  const s = theme.spacing;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Business Profile</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Company Information" />
            <Input label="Business Name" value={name} onChangeText={setName} />
            <Input label="Business Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            
            <SectionHeader title="Location" />
            <Input label="Address" value={address} onChangeText={setAddress} multiline />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label="Save Changes" 
          fullWidth 
          onPress={() => navigation.goBack()} 
        />
      </View>
    </SafeAreaView>
  );
}
