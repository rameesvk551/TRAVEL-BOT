// FILE: mobile/src/features/services/screens/ServiceFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, Segmented, SectionHeader, Switch } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';

export function ServiceFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  
  const [pricingType, setPricingType] = useState(0); // 0: Fixed, 1: Starting, 2: Variable
  const [isActive, setIsActive] = useState(true);

  const s = theme.spacing;

  const handleSave = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => navigation.goBack()} />
        <Text style={[theme.typography.headline, { color: theme.colors.text.primary, marginLeft: s.s2 }]}>Service</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          <View style={{ gap: s.s4 }}>
            <SectionHeader title="Details" />
            <Input label="Name" value="" onChangeText={() => {}} placeholder="e.g. Travel Insurance" />
            <Input label="Category" value="" onChangeText={() => {}} placeholder="e.g. Insurance" />
            <Input label="Icon (Emoji)" value="" onChangeText={() => {}} placeholder="🛡️" />
            <Input label="Description" value="" onChangeText={() => {}} multiline />

            <SectionHeader title="Pricing" />
            <View>
              <Text style={[theme.typography.footnote, { color: theme.colors.text.secondary, marginBottom: s.s2 }]}>Pricing Type</Text>
              <Segmented segments={['Fixed', 'Starting', 'Variable']} selectedIndex={pricingType} onChange={setPricingType} />
            </View>
            <CurrencyField label="Price" value="" onChangeText={() => {}} placeholder="1500" />

            <SectionHeader title="Features" />
            <Input label="Add Feature" value="" onChangeText={() => {}} placeholder="e.g. Medical Cover" />
            <Button variant="secondary" label="Add" onPress={() => {}} />

            <SectionHeader title="Settings" />
            <Switch label="Active" value={isActive} onValueChange={setIsActive} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label="Save Service" 
          fullWidth 
          onPress={handleSave} 
        />
      </View>
    </SafeAreaView>
  );
}
