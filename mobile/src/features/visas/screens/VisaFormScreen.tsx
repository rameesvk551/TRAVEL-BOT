// FILE: mobile/src/features/visas/screens/VisaFormScreen.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme/ThemeProvider';
import { Button, Input, CurrencyField, SectionHeader, ProgressBar } from '../../../ui';
import { ArrowLeft } from 'lucide-react-native';

export function VisaFormScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0); // 0: Details, 1: Requirements
  
  const s = theme.spacing;

  const handleNext = () => {
    if (step < 1) setStep(step + 1);
    else navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: s.s4, paddingVertical: s.s3 }}>
        <Button variant="icon" icon={ArrowLeft} onPress={() => step > 0 ? setStep(step - 1) : navigation.goBack()} />
        <View style={{ flex: 1, marginHorizontal: s.s4 }}>
          <ProgressBar progress={(step + 1) / 2} />
        </View>
        <Text style={[theme.typography.subhead, { color: theme.colors.text.secondary }]}>{step + 1} of 2</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: s.s4, paddingBottom: 100 }}>
          {step === 0 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Visa Details" />
              <Input label="Country" value="" onChangeText={() => {}} placeholder="e.g. United Arab Emirates" />
              <Input label="Visa Type" value="" onChangeText={() => {}} placeholder="e.g. Tourist (30 Days)" />
              <CurrencyField label="Price" value="" onChangeText={() => {}} placeholder="7500" />
              <Input label="Processing Time" value="" onChangeText={() => {}} placeholder="e.g. 3-4 Days" />
              <Input label="Validity" value="" onChangeText={() => {}} placeholder="e.g. 30 Days" />
            </View>
          )}

          {step === 1 && (
            <View style={{ gap: s.s4 }}>
              <SectionHeader title="Requirements" />
              <Input label="Add Document" value="" onChangeText={() => {}} placeholder="e.g. 6 months valid passport" />
              <Button variant="secondary" label="Add Requirement" onPress={() => {}} />
              
              <View style={{ marginTop: s.s4 }}>
                <Input label="Eligibility Notes" value="" onChangeText={() => {}} multiline placeholder="Any specific rules..." />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ padding: s.s4, backgroundColor: theme.colors.bg.surface, borderTopWidth: 1, borderTopColor: theme.colors.border.hairline }}>
        <Button 
          variant="primary" 
          label={step === 1 ? "Save Visa" : "Next"} 
          fullWidth 
          onPress={handleNext} 
        />
      </View>
    </SafeAreaView>
  );
}
